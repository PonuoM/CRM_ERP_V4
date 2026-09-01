package com.primacom.dialer.call

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.telecom.Call
import android.telecom.InCallService
import android.util.Log
import androidx.core.app.NotificationCompat
import com.primacom.dialer.R
import com.primacom.dialer.data.Api
import com.primacom.dialer.data.Session
import com.primacom.dialer.ui.InCallActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Takes over the in-call screen.
 *
 * This is the half of the problem that hiding numbers in the CRM cannot solve. Asking the system to
 * place a call hands the screen to the stock dialer, which prints the number in large type — so an
 * agent reads it off the handset and the masking upstream was for nothing. Once this app holds the
 * dialer role the system routes calls here instead, and the screen shows a name and nothing else.
 */
class PrimacomInCallService : InCallService() {

    private val scope = CoroutineScope(SupervisorJob())

    /** When the current call went live, so an inbound session can be closed with a real duration. */
    private var activeSince = 0L

    private val callCallback = object : Call.Callback() {
        override fun onStateChanged(call: Call, state: Int) {
            // The dialler owns the sounds now. Nothing else plays the ringing tone an agent listens
            // to while waiting for an answer, so start it here and stop it the moment it stops
            // being true — a tone still playing over a live call is worse than no tone at all.
            when (state) {
                Call.STATE_DIALING, Call.STATE_CONNECTING -> RingbackPlayer.start()
                else -> RingbackPlayer.stop()
            }
            if (state == Call.STATE_ACTIVE && activeSince == 0L) {
                activeSince = System.currentTimeMillis()
                // จังหวะเดียวที่รู้แน่ว่าอีกฝั่งยกหูจริง วิทยุบอกได้แค่ว่าเราเริ่มกดเบอร์
                // สายโทรออกที่ CallBridgeService เป็นคนวาง ต้องเริ่มจับเวลาคุยตรงนี้
                if (!ActiveCall.isInbound) CallBridgeService.notifyRemoteAnswered()
            }
            if (state == Call.STATE_DISCONNECTED) {
                // Outbound sessions are closed by CallBridgeService, which placed them. Inbound ones
                // were opened by identify() and have nobody else to close them — left alone they stay
                // "ringing" for ever and the one-live-call rule locks the agent out of dialling.
                if (ActiveCall.isInbound) closeInboundSession()
                // เปิดฟอร์มบันทึกการโทรก่อนล้าง ActiveCall — ยิงจาก service ผ่าน full-screen intent
                // ไม่ใช่ startActivity ตรง ๆ จาก Activity ที่กำลังจะปิด ซึ่งโดน BAL บล็อกบน Android 14+
                maybeShowDisposition()
                activeSince = 0L
                ActiveCall.clear()
            }
        }
    }

    /**
     * เปิดฟอร์มบันทึกการโทรตามกติกา: โทรออก = ทุกครั้ง, รับสาย = เฉพาะที่ได้คุยจริง (activeSince != 0)
     *
     * ใช้ full-screen intent notification เหมือนหน้าจอสายเข้า — เชื่อถือได้กว่า startActivity จาก
     * service/Activity ที่กำลังปิด ซึ่งโดน background-activity-launch บล็อกบน Android รุ่นใหม่
     */
    private fun maybeShowDisposition() {
        val sid = ActiveCall.sessionId
        if (sid <= 0) return
        val talked = activeSince != 0L
        if (ActiveCall.isInbound && !talked) return
        val duration = if (talked) ((System.currentTimeMillis() - activeSince) / 1000).toInt() else 0
        val name = ActiveCall.describe()
        val cid = ActiveCall.customerId

        val manager = getSystemService(NotificationManager::class.java) ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(CALL_CHANNEL_ID, getString(R.string.notif_channel_call),
                    NotificationManager.IMPORTANCE_HIGH).apply {
                    setSound(null, null); enableVibration(false); setShowBadge(false)
                }
            )
        }
        val intent = Intent(this, com.primacom.dialer.ui.DispositionActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra(com.primacom.dialer.ui.DispositionActivity.EXTRA_SESSION_ID, sid)
            .putExtra(com.primacom.dialer.ui.DispositionActivity.EXTRA_CUSTOMER_NAME, name)
            .putExtra(com.primacom.dialer.ui.DispositionActivity.EXTRA_CUSTOMER_ID, cid)
            .putExtra(com.primacom.dialer.ui.DispositionActivity.EXTRA_DURATION, duration)
            .putExtra(com.primacom.dialer.ui.DispositionActivity.EXTRA_CONNECTED, talked)

        // เปิดฟอร์มตรง ๆ ก่อน — แอปเพิ่งมีหน้าจอสาย (foreground) อยู่แวบก่อน จึงมักได้รับข้อยกเว้น
        // background-activity-launch ให้เปิดได้แม้จอปลดล็อก ถ้าโดนบล็อก notification ด้านล่างเป็นตัวสำรอง
        try {
            startActivity(intent)
        } catch (e: Exception) {
            Log.w(TAG, "direct disposition launch blocked: ${e.message}")
        }

        val open = PendingIntent.getActivity(
            this, DISPO_REQUEST, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val notif = NotificationCompat.Builder(this, CALL_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_edit)
            .setContentTitle(getString(R.string.disposition_title))
            .setContentText(name)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(open)
            .setFullScreenIntent(open, true)
            .build()
        manager.notify(DISPO_NOTIFICATION_ID, notif)
    }

    private fun closeInboundSession() {
        val sessionId = ActiveCall.sessionId
        if (sessionId <= 0) return

        val seconds =
            if (activeSince == 0L) 0
            else ((System.currentTimeMillis() - activeSince) / 1000).toInt()
        val session = Session(this)
        if (!session.isSignedIn) return

        scope.launch {
            runCatching { Api(session).report(sessionId, "ended", durationSec = seconds) }
        }
    }

    override fun onCreate() {
        super.onCreate()
        InCallBridge.attach(this)
    }

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        call.registerCallback(callCallback)
        ActiveCall.call = call

        // callDirection comes back UNKNOWN on several vendor builds while the call is still
        // ringing, so trust the state instead: an incoming call always starts in STATE_RINGING.
        if (call.state == Call.STATE_DIALING || call.state == Call.STATE_CONNECTING) {
            RingbackPlayer.start()
        }

        val inbound = call.state == Call.STATE_RINGING ||
            call.details.callDirection == Call.Details.DIRECTION_INCOMING
        if (inbound) {
            ActiveCall.isInbound = true
            identifyCaller(call)
        }

        // การเปิดหน้าจอตรง ๆ จาก service ถูกบล็อกตั้งแต่ Android 10 เมื่อแอปไม่ได้อยู่หน้าจอ
        // และถูกทิ้งเงียบ ๆ ไม่มี error — อาการที่เจอจริง: พนักงานปัดแอปทิ้งแล้วมีสายเข้า
        // ระบบยังปลุก service นี้ให้ (เพราะเราเป็นแอปโทรศัพท์หลัก) แต่จอของเราไม่ขึ้น
        // เครื่องเลยโชว์การแจ้งเตือนสายเข้าของระบบที่พิมพ์เบอร์เต็ม ๆ แทน
        //
        // ทางที่ระบบอนุญาตคือ notification แบบ full-screen intent: จอล็อก/จอดับ → เด้งหน้าจอสาย
        // ของเราเต็มจอทันที, จออยู่ในแอปอื่น → ขึ้น heads-up ชื่อลูกค้า (ไม่มีเบอร์) ให้แตะรับ
        postCallNotification()

        // Full screen, over the lock screen — the agent must see who it is without unlocking, and
        // must never be shown the stock dialer instead. ยังเรียกไว้สำหรับกรณีแอปอยู่หน้าจอ
        // ซึ่งเปิดได้ทันทีไม่ต้องรอ notification
        startActivity(
            Intent(this, InCallActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        )
    }

    override fun onCallRemoved(call: Call) {
        super.onCallRemoved(call)
        call.unregisterCallback(callCallback)
        RingbackPlayer.stop()
        ActiveCall.clear()
        getSystemService(NotificationManager::class.java)?.cancel(CALL_NOTIFICATION_ID)
        // ระบบเพิ่งเขียนสายนี้ลง call log กลางของเครื่อง ตามไปลบก่อนที่ใครจะเปิดแอปโทรศัพท์เดิมดู
        CallLogScrubber.scrubSoon(this)
    }

    /**
     * แจ้งเตือนสายที่กำลังเกิดขึ้น พร้อม full-screen intent ให้ระบบเด้งหน้าจอสายของเราได้
     * แม้แอปถูกปัดทิ้งไปแล้ว — โชว์แค่ชื่อ/รหัสลูกค้า ไม่มีเบอร์ เหมือนหน้าจอสายทุกประการ
     *
     * เงียบโดยตั้งใจ: เสียงเรียกเข้าเป็นของระบบอยู่แล้ว (เราไม่ประกาศ IN_CALL_SERVICE_RINGING)
     * ถ้า notification ส่งเสียงด้วยจะดังซ้อนกัน
     */
    private fun postCallNotification() {
        val manager = getSystemService(NotificationManager::class.java) ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(
                    CALL_CHANNEL_ID,
                    getString(R.string.notif_channel_call),
                    // ต่ำกว่า HIGH จะไม่ขึ้น heads-up และ full-screen intent ไม่ทำงาน
                    NotificationManager.IMPORTANCE_HIGH,
                ).apply {
                    setSound(null, null)
                    enableVibration(false)
                    setShowBadge(false)
                }
            )
        }
        val openScreen = PendingIntent.getActivity(
            this, 0,
            Intent(this, InCallActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val who =
            if (ActiveCall.isInbound && ActiveCall.customerName.isBlank()) {
                getString(R.string.call_identifying)
            } else {
                ActiveCall.describe()
            }
        val notification = NotificationCompat.Builder(this, CALL_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_phone_call)
            .setContentTitle(
                getString(if (ActiveCall.isInbound) R.string.call_incoming else R.string.call_dialing)
            )
            .setContentText(who)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(openScreen)
            .setFullScreenIntent(openScreen, true)
            .build()
        manager.notify(CALL_NOTIFICATION_ID, notification)
    }

    override fun onDestroy() {
        RingbackPlayer.stop()
        InCallBridge.detach()
        scope.cancel()
        super.onDestroy()
    }

    /**
     * An incoming call arrives as a number and nothing else. Trade it with the server for a name so
     * the screen can show who is calling — the number itself goes no further than this method.
     */
    private fun identifyCaller(call: Call) {
        val number = call.details.handle?.schemeSpecificPart ?: return
        val session = Session(this)
        if (!session.isSignedIn) return

        scope.launch {
            try {
                val identified = Api(session).identifyFull(number)
                ActiveCall.sessionId = identified?.optInt("session_id") ?: 0
                val customer = identified?.optJSONObject("customer")
                if (customer != null) {
                    ActiveCall.customerId = customer.optInt("customer_id")
                    ActiveCall.customerName = customer.optString("name")
                } else {
                    ActiveCall.customerName = "ไม่พบในระบบ"
                }
            } catch (e: Exception) {
                Log.w(TAG, "identify failed: ${e.message}")
                ActiveCall.customerName = "ตรวจสอบไม่ได้"
            }
            // heads-up ที่โพสต์ไปตอนสายเข้ายังเขียนว่า "กำลังตรวจสอบ" — โพสต์ทับด้วยชื่อจริง
            if (ActiveCall.call != null) postCallNotification()
        }
    }

    companion object {
        private const val TAG = "PrimacomInCall"

        /** คนละ channel กับแถบสถานะของ CallBridgeService ซึ่งตั้งใจให้เงียบและความสำคัญต่ำ */
        private const val CALL_CHANNEL_ID = "active_call"
        private const val CALL_NOTIFICATION_ID = 2001
        const val DISPO_NOTIFICATION_ID = 2002
        private const val DISPO_REQUEST = 2003
    }
}
