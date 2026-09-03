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
    val status: String?,     // ผลบันทึก: ได้คุย/ไม่รับสาย/… (null ถ้ายังไม่บันทึก)
    val result: String?,     // ขายได้/…
    val missed: Boolean,
    val answered: Boolean,
    val durationSec: Int,
    val at: String,
)

/** One appointment the agent should call today — a name and an id, never a number. */
data class FollowUp(
    val customerId: Int,
    val name: String,
    val at: String,
    val note: String? = null,   // หัวข้อนัด เช่น "ใบเสนอราคาปุ๋ยสูตรใหม่"
)

/** A full appointment row for the appointments screen — with crop/province context. */
data class Appointment(
    val customerId: Int,
    val name: String,
    val at: String,
    val province: String?,
    val crop: String?,
)

/** The "พร้อมรับงาน" home payload: today's tally + today's appointments. */
data class HomeData(
    val calls: Int,
    val talked: Int,
    val missed: Int,
    val sold: Int,
    val talkSec: Int,
    val followups: List<FollowUp>,
    val isSupervisor: Boolean = false,
    val team: String? = null,   // ป้ายทีม เช่น "ทีมหนิง" (null = ไม่มีหัวหน้า)
)

/**
 * ลูกทีมหนึ่งคนในแดชบอร์ดคุมทีม (หัวหน้าเท่านั้นที่เห็น)
 * state: "on_call" กำลังคุย · "calling" กำลังโทร · "online" · "offline"
 */
data class TeamMember(
    val id: Int,
    val name: String,
    val state: String,
    val onCallSince: String?,
    val lastSeen: String?,
    val calls: Int,
    val talked: Int,
    val sold: Int,
    val talkSec: Int,
    val appointments: Int,
)

/** Calls in one hour of the day — for the end-of-day bar chart. */
data class HourBucket(val hour: Int, val count: Int)

/** End-of-day report: today's tally, avg, yesterday compare, hourly spread. */
data class DailySummary(
    val calls: Int,
    val talked: Int,
    val missed: Int,
    val sold: Int,
    val talkSec: Int,
    val avgSec: Int,
    val yesterdayCalls: Int,
    val appointments: Int,
    val hourly: List<HourBucket>,
)

/** A plot the customer already has on file — so the agent needn't re-enter it. */
data class Plot(
    val crop: String,
    val sizeValue: Double?,
    val sizeUnit: String?,
) {
    /** "ทุเรียน 5 ไร่" — for a compact one-line hint. */
    val label: String
        get() = buildString {
            append(crop)
            if (sizeValue != null) {
                val n = if (sizeValue % 1.0 == 0.0) sizeValue.toInt().toString() else sizeValue.toString()
                append(" ").append(n)
                if (!sizeUnit.isNullOrBlank()) append(" ").append(sizeUnit)
            }
        }
}

/** One search hit — name and id only, never a number to dial. */
data class SearchResult(
    val customerId: Int,
    val name: String,
    val province: String?,
    val grade: String?,
    val basket: String?,
)

/** A sellable product the agent can pick when logging a field sale. */
data class ProductOption(
    val id: Int,
    val name: String,
    val unit: String?,
    val price: Double?,
)

/** One line of a "ออเดอร์รอเปิด" draft — product + quantity. */
data class SaleLine(
    val productId: Int?,
    val name: String,
    val qty: Double,
    val unit: String?,
)

/** A tag the agent may pin on a customer — mirrors the web LogCallModal chips. */
data class TagOption(
    val id: Int,
    val name: String,
    val color: String,
    val selected: Boolean,
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
            session.role = u.optString("role").ifBlank { null }
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
        // ลำดับแถวใน agent_devices → รหัสเครื่องสั้นบนหน้าจอ ("PHONE-07")
        res.optInt("device_no").takeIf { it > 0 }?.let {
            session.deviceCode = "PHONE-" + it.toString().padStart(2, '0')
        }
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

    /** ข้อมูลหน้า "พร้อมรับงาน" — สรุปวันนี้ + นัดหมายวันนี้ */
    suspend fun home(): HomeData = withContext(Dispatchers.IO) {
        val res = request("call/home", "GET")
        val t = res.optJSONObject("today")
        val arr = res.optJSONArray("followups")
        val fus = buildList {
            if (arr != null) for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                add(FollowUp(
                    customerId = o.optInt("customer_id"),
                    name = o.optString("name").ifBlank { "ไม่ทราบชื่อ" },
                    at = o.optString("at"),
                    note = o.optString("note").ifBlank { null }.takeUnless { o.isNull("note") },
                ))
            }
        }
        HomeData(
            calls = t?.optInt("calls") ?: 0,
            talked = t?.optInt("talked") ?: 0,
            missed = t?.optInt("missed") ?: 0,
            sold = t?.optInt("sold") ?: 0,
            talkSec = t?.optInt("talk_sec") ?: 0,
            followups = fus,
            isSupervisor = res.optBoolean("is_supervisor", false),
            team = res.optString("team").ifBlank { null }.takeUnless { res.isNull("team") },
        )
    }

    /** แดชบอร์ดคุมทีม (หัวหน้าเท่านั้น) — รายชื่อลูกทีม + สถานะสด + ตัวเลขวันนี้ */
    suspend fun team(): List<TeamMember> = withContext(Dispatchers.IO) {
        val res = request("call/team", "GET")
        val arr = res.optJSONArray("members") ?: return@withContext emptyList()
        buildList {
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                add(
                    TeamMember(
                        id = o.optInt("id"),
                        name = o.optString("name").ifBlank { "ไม่ทราบชื่อ" },
                        state = o.optString("state").ifBlank { "offline" },
                        onCallSince = o.optString("on_call_since").takeIf { it.isNotBlank() && it != "null" },
                        lastSeen = o.optString("last_seen").takeIf { it.isNotBlank() && it != "null" },
                        calls = o.optInt("calls"),
                        talked = o.optInt("talked"),
                        sold = o.optInt("sold"),
                        talkSec = o.optInt("talk_sec"),
                        appointments = o.optInt("appointments"),
                    )
                )
            }
        }
    }

    /** สถานะปัจจุบันของสายจาก server — ใช้ให้เครื่องรู้ว่าคอมสั่งวางสายมาหรือยัง */
    suspend fun callStatus(sessionId: Int): String? = withContext(Dispatchers.IO) {
        val res = request("call/status?session_id=$sessionId", "GET")
        res.optJSONObject("session")?.optString("status")
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
                    status = o.optString("status").ifBlank { null }.takeUnless { o.isNull("status") },
                    result = o.optString("result").ifBlank { null }.takeUnless { o.isNull("result") },
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

    /** รายละเอียดลูกค้า (ไม่มีเบอร์) + ประวัติการโทรย่อ — คืน JSON ดิบให้หน้าจอ map เอง */
    suspend fun customerDetail(customerId: Int): JSONObject = withContext(Dispatchers.IO) {
        request("call/customer?customer_id=$customerId", "GET")
    }

    /** รายการนัดหมายวันนี้เต็ม (จอ 12) */
    suspend fun appointments(): List<Appointment> = withContext(Dispatchers.IO) {
        val res = request("call/appointments", "GET")
        val arr = res.optJSONArray("appointments") ?: return@withContext emptyList()
        buildList {
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                add(Appointment(
                    customerId = o.optInt("customer_id"),
                    name = o.optString("name").ifBlank { "ไม่ทราบชื่อ" },
                    at = o.optString("at"),
                    province = o.optString("province").ifBlank { null }.takeUnless { o.isNull("province") },
                    crop = o.optString("crop").ifBlank { null }.takeUnless { o.isNull("crop") },
                ))
            }
        }
    }

    /** สรุปผลงานสิ้นวัน (จอ 15) */
    suspend fun dailySummary(): DailySummary = withContext(Dispatchers.IO) {
        val res = request("call/daily_summary", "GET")
        val t = res.optJSONObject("today")
        val hArr = res.optJSONArray("hourly")
        val hours = buildList {
            if (hArr != null) for (i in 0 until hArr.length()) {
                val o = hArr.getJSONObject(i)
                add(HourBucket(o.optInt("hour"), o.optInt("count")))
            }
        }
        DailySummary(
            calls = t?.optInt("calls") ?: 0,
            talked = t?.optInt("talked") ?: 0,
            missed = t?.optInt("missed") ?: 0,
            sold = t?.optInt("sold") ?: 0,
            talkSec = t?.optInt("talk_sec") ?: 0,
            avgSec = t?.optInt("avg_sec") ?: 0,
            yesterdayCalls = res.optInt("yesterday_calls"),
            appointments = res.optInt("appointments"),
            hourly = hours,
        )
    }

    /** ค้นหาลูกค้าด้วยชื่อหรือรหัส (ไม่มีเบอร์) */
    suspend fun search(q: String): List<SearchResult> = withContext(Dispatchers.IO) {
        val res = request("call/search?q=${java.net.URLEncoder.encode(q, "UTF-8")}", "GET")
        val arr = res.optJSONArray("results") ?: return@withContext emptyList()
        buildList {
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                add(SearchResult(
                    customerId = o.optInt("customer_id"),
                    name = o.optString("name").ifBlank { "ไม่ทราบชื่อ" },
                    province = o.optString("province").ifBlank { null }.takeUnless { o.isNull("province") },
                    grade = o.optString("grade").ifBlank { null }.takeUnless { o.isNull("grade") },
                    basket = o.optString("basket").ifBlank { null }.takeUnless { o.isNull("basket") },
                ))
            }
        }
    }

    /** สวนที่ลูกค้าบันทึกไว้แล้ว (customer_plots) — ให้ฟอร์มโชว์กันกรอกซ้ำ */
    suspend fun plots(customerId: Int): List<Plot> = withContext(Dispatchers.IO) {
        val res = request("call/customer?customer_id=$customerId", "GET")
        val arr = res.optJSONObject("customer")?.optJSONArray("plots") ?: return@withContext emptyList()
        buildList {
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                add(Plot(
                    crop = o.optString("crop"),
                    sizeValue = if (o.isNull("size_value")) null else o.optDouble("size_value"),
                    sizeUnit = o.optString("size_unit").ifBlank { null },
                ))
            }
        }
    }

    /** รายการสินค้าสำหรับบันทึกการขาย — คืน (เปิดใช้ไหม, รายการ) · ปิดเบอร์ปิด = enabled=false */
    suspend fun products(q: String = ""): Pair<Boolean, List<ProductOption>> = withContext(Dispatchers.IO) {
        val path = if (q.isBlank()) "call/products"
        else "call/products?q=${java.net.URLEncoder.encode(q, "UTF-8")}"
        val res = request(path, "GET")
        val enabled = res.optBoolean("enabled")
        val arr = res.optJSONArray("products")
        val list = buildList {
            if (arr != null) for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                add(ProductOption(
                    id = o.optInt("id"),
                    name = o.optString("name"),
                    unit = o.optString("unit").ifBlank { null }.takeUnless { o.isNull("unit") },
                    price = if (o.isNull("price")) null else o.optDouble("price"),
                ))
            }
        }
        enabled to list
    }

    /** บันทึก "ออเดอร์รอเปิด" (ขายได้ผ่านมือถือ) → ไปเปิดออเดอร์จริงที่บริษัท */
    suspend fun createPendingOrder(
        sessionId: Int, customerId: Int, note: String?, items: List<SaleLine>, openMode: String = "backoffice",
    ) =
        withContext(Dispatchers.IO) {
            val body = JSONObject().put("customer_id", customerId).put("open_mode", openMode)
            if (sessionId > 0) body.put("session_id", sessionId)
            note?.takeIf { it.isNotBlank() }?.let { body.put("note", it) }
            val arr = org.json.JSONArray()
            items.forEach { line ->
                arr.put(JSONObject().apply {
                    line.productId?.let { put("product_id", it) }
                    put("name", line.name)
                    put("qty", line.qty)
                    line.unit?.let { put("unit", it) }
                })
            }
            body.put("items", arr)
            request("call/pending_order", "POST", body)
            Unit
        }

    /** Tag ที่พนักงานคนนี้ติดได้ (ระบบ + ส่วนตัว); ถ้าส่ง customerId มา จะบอกอันที่ติดไว้แล้ว */
    suspend fun tags(customerId: Int? = null): List<TagOption> = withContext(Dispatchers.IO) {
        val path = if (customerId != null) "call/tags?customer_id=$customerId" else "call/tags"
        val res = request(path, "GET")
        val arr = res.optJSONArray("tags") ?: return@withContext emptyList()
        buildList {
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                add(TagOption(
                    id = o.optInt("id"),
                    name = o.optString("name"),
                    color = o.optString("color").ifBlank { "#2AB7A9" },
                    selected = o.optBoolean("selected"),
                ))
            }
        }
    }

    /** บันทึกผลการโทร (disposition) — เขียนแถว call_history เดียวกับฝั่งคอม */
    suspend fun saveDisposition(
        sessionId: Int, status: String, result: String,
        durationSec: Int? = null, cropType: String? = null, areaSize: String? = null,
        notes: String? = null, followUpDate: String? = null, tagIds: List<Int> = emptyList(),
    ) = withContext(Dispatchers.IO) {
        val body = JSONObject()
            .put("session_id", sessionId)
            .put("status", status)
            .put("result", result)
        durationSec?.let { body.put("duration_sec", it) }
        cropType?.takeIf { it.isNotBlank() }?.let { body.put("crop_type", it) }
        areaSize?.takeIf { it.isNotBlank() }?.let { body.put("area_size", it) }
        notes?.takeIf { it.isNotBlank() }?.let { body.put("notes", it) }
        followUpDate?.takeIf { it.isNotBlank() }?.let { body.put("follow_up_date", it) }
        if (tagIds.isNotEmpty()) body.put("tag_ids", org.json.JSONArray(tagIds))
        request("call/disposition", "POST", body)
        Unit
    }

    /** เช็คว่าผลการโทร session นี้ถูกบันทึกแล้วหรือยัง (ฝั่งคอมหรือมือถือ) → ให้ฟอร์มปิดเอง */
    suspend fun dispositionDone(sessionId: Int): Boolean = withContext(Dispatchers.IO) {
        val res = request("call/disposition_status?session_id=$sessionId", "GET")
        res.optBoolean("disposed")
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
