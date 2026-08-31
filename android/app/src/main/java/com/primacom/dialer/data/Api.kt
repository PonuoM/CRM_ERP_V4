package com.primacom.dialer.data

import android.os.Build
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedReader
import java.net.HttpURLConnection
import java.net.URL

/** A dial job handed down by the server. [dial] is the only place a real number reaches this app. */
data class DialJob(
    val sessionId: Int,
    val customerId: Int,
    val customerName: String,
    val dial: String,
)

/** One row in the agent's call history — a name and an id, never a number. */
data class CallRecord(
    val sessionId: Int,
    val customerId: Int,
    val customerName: String,
    val direction: String,
    val missed: Boolean,
    val answered: Boolean,
    val durationSec: Int,
    val at: String,
)

/** Result of a call the server could not accept, so the UI can say why in the agent's language. */
class ApiException(val code: String, override val message: String) : Exception(message)

/**
 * Talks to the CRM.
 *
 * Written against HttpURLConnection on purpose: an HTTP client is one more thing that can fail to
 * resolve at build time, and every request here is a short JSON round trip that needs nothing more.
 */
class Api(private val session: Session) {

    suspend fun login(username: String, password: String): String = withContext(Dispatchers.IO) {
        val body = JSONObject()
            .put("username", username)
            .put("password", password)
        val res = request("auth/login", "POST", body, withAuth = false)

        val token = res.optString("token")
        if (token.isBlank()) throw ApiException("NO_TOKEN", "เข้าสู่ระบบไม่สำเร็จ")

        session.token = token
        res.optJSONObject("user")?.let { u ->
            session.agentName = listOf(u.optString("first_name"), u.optString("last_name"))
                .filter { it.isNotBlank() }
                .joinToString(" ")
                .ifBlank { u.optString("username") }
        }
        token
    }

    suspend fun registerDevice(simPhone: String?) = withContext(Dispatchers.IO) {
        val body = JSONObject()
            .put("device_id", session.deviceId)
            .put("label", "${Build.MANUFACTURER} ${Build.MODEL}")
            .put("app_version", APP_VERSION)
        if (!simPhone.isNullOrBlank()) body.put("sim_phone", simPhone)
        val res = request("device/register", "POST", body)

        // From here on the handset authenticates as itself. The web session token stays in storage
        // only so a re-registration can still be authorised if the device token is ever rejected.
        res.optString("device_token").takeIf { it.isNotBlank() }?.let { session.deviceToken = it }
        Unit
    }

    /** Ask for work. Null means nothing to do — the common case, so it must stay cheap. */
    suspend fun poll(): DialJob? = withContext(Dispatchers.IO) {
        val res = request("call/poll?device_id=${session.deviceId}", "GET")
        val call = res.optJSONObject("call") ?: return@withContext null
        DialJob(
            sessionId = call.optInt("session_id"),
            customerId = call.optInt("customer_id"),
            customerName = call.optString("customer_name"),
            dial = call.optString("dial"),
        )
    }

    suspend fun report(
        sessionId: Int,
        status: String,
        durationSec: Int? = null,
        failureReason: String? = null,
    ) = withContext(Dispatchers.IO) {
        val body = JSONObject()
            .put("session_id", sessionId)
            .put("status", status)
        durationSec?.let { body.put("duration_sec", it) }
        failureReason?.let { body.put("failure_reason", it) }
        request("call/event", "POST", body)
        Unit
    }

    /**
     * Incoming call: hand the server the number, get back who it is.
     *
     * Returns the whole envelope because the caller needs the session id too — that session is the
     * only handle for closing the call out afterwards.
     */
    suspend fun identifyFull(phone: String): JSONObject? = withContext(Dispatchers.IO) {
        request("call/identify", "POST", JSONObject().put("phone", phone))
    }

    /** ประวัติการโทรของพนักงานคนนี้ — ชื่อ+รหัส ไม่มีเบอร์ */
    suspend fun history(limit: Int = 60): List<CallRecord> = withContext(Dispatchers.IO) {
        val res = request("call/history?limit=$limit", "GET")
        val arr = res.optJSONArray("calls") ?: return@withContext emptyList()
        buildList {
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                add(CallRecord(
                    sessionId = o.optInt("session_id"),
                    customerId = o.optInt("customer_id"),
                    customerName = o.optString("customer_name").ifBlank { "ไม่ทราบผู้ติดต่อ" },
                    direction = o.optString("direction"),
                    missed = o.optBoolean("missed"),
                    answered = o.optBoolean("answered"),
                    durationSec = o.optInt("duration_sec"),
                    at = o.optString("at"),
                ))
            }
        }
    }

    /** โทรกลับหาลูกค้าด้วยรหัส — สร้างงานโทรให้ poll loop ของเครื่องนี้หยิบไปกดออกเอง */
    suspend fun dialCustomer(customerId: Int) = withContext(Dispatchers.IO) {
        request("call/dial", "POST", JSONObject().put("customer_id", customerId))
        Unit
    }

    /** ยืนยันผู้ดูแลระดับสูงก่อนออกจากระบบ — คืน true ถ้าผ่าน, โยน ApiException ถ้าไม่ผ่าน */
    suspend fun verifyAdmin(username: String, password: String): Boolean = withContext(Dispatchers.IO) {
        val body = JSONObject().put("username", username).put("password", password)
        val res = request("call/verify_admin", "POST", body)
        res.optBoolean("ok")
    }

    // ── plumbing ──────────────────────────────────────────────────────────────────────────────

    private fun request(
        path: String,
        method: String,
        body: JSONObject? = null,
        withAuth: Boolean = true,
    ): JSONObject {
        val conn = (URL("${session.baseUrl}/$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 20_000
            setRequestProperty("Accept", "application/json")
            if (withAuth) session.authToken?.let { setRequestProperty("Authorization", "Bearer $it") }
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }

        try {
            body?.let { conn.outputStream.use { out -> out.write(it.toString().toByteArray()) } }

            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader()?.use(BufferedReader::readText).orEmpty()
            val json = if (text.isBlank()) JSONObject() else runCatching { JSONObject(text) }
                .getOrElse { throw ApiException("BAD_RESPONSE", "เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง") }

            if (code == 401) {
                // ห้ามล้าง token ทิ้งตรงนี้ — เจอ 401 ชั่วคราว (เช่นจังหวะ race ตอนเพิ่งลงทะเบียน
                // เครื่อง หรือเน็ตสะดุด) ครั้งเดียวก็เคยเตะพนักงานหลุดหน้าล็อกอินทั้งวัน อาการที่เจอจริง:
                // device token เพิ่งออกยังใช้ได้ แต่โดน 401 แวบเดียวแล้วโดนล้าง เหลือแต่ session token เปราะ
                //
                // แค่โยน error ออกไป ให้ผู้เรียก (CallBridgeService) ตัดสินใจว่าจะลงทะเบียนเครื่องใหม่
                // หรือรอ ส่วนการล้าง token จริงเกิดตอนกดออกจากระบบเท่านั้น
                //
                // ใช้ข้อความจริงจาก server ถ้ามี — ตอนล็อกอินรหัสผิดจะได้ขึ้นว่ารหัสไม่ถูกต้อง
                // ไม่ใช่ข้อความกำกวมว่าเซสชันหมดอายุ
                throw ApiException(
                    "UNAUTHORIZED",
                    json.optString("message").ifBlank { "ยืนยันตัวตนไม่ผ่าน กรุณาเข้าสู่ระบบอีกครั้ง" },
                )
            }
            if (code !in 200..299 || (json.has("ok") && !json.optBoolean("ok"))) {
                throw ApiException(
                    json.optString("error").ifBlank { "HTTP_$code" },
                    json.optString("message").ifBlank { "ทำรายการไม่สำเร็จ (HTTP $code)" },
                )
            }
            return json
        } finally {
            conn.disconnect()
        }
    }

    companion object {
        const val APP_VERSION = "0.1.0"
    }
}
