package com.primacom.dialer.call

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.telecom.TelecomManager
import android.telephony.TelephonyManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.primacom.dialer.data.Api
import com.primacom.dialer.data.ApiException
import com.primacom.dialer.data.DialJob
import com.primacom.dialer.data.Session
import com.primacom.dialer.ui.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Keeps this handset available to the CRM.
 *
 * Runs in the foreground because the phone lives on a desk with the screen off, and a background
 * loop would be dozed within minutes — an agent pressing "call" and getting nothing is the one
 * failure this whole design cannot afford.
 *
 * The loop is deliberately dull: ask, dial if there is work, report what happened.
 */
class CallBridgeService : Service() {

    private lateinit var session: Session
    private lateinit var api: Api
    private var loop: Job? = null
    private val scope = CoroutineScope(SupervisorJob())

    private var activeSessionId: Int? = null
    private var callStartedAt: Long = 0L
    private var monitor: CallMonitor? = null

    /**
     * Has the radio actually done anything for this session yet?
     *
     * Registering a call-state listener delivers the CURRENT state straight away, and before a call
     * is placed that state is IDLE. Without this flag that first callback reads exactly like a
     * hang-up, and every call is reported as ended with a duration of zero before it even rings.
     */
    private var callSawActivity = false
    private var watchdog: Job? = null

    /** กันลงทะเบียนเครื่องซ้ำซ้อนตอนเจอ 401 หลายรอบติด */
    private var reregistering = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        running = this
        session = Session(this)
        api = Api(session)
        startInForeground(getString(com.primacom.dialer.R.string.status_connecting))
        // เก็บกวาดประวัติการโทรที่อาจตกค้าง — สายที่จบตอนโปรเซสถูกฆ่าก่อนได้ลบ
        // หรือสายที่เกิดก่อนแอปได้สิทธิ์ call log
        CallLogScrubber.scrubSoon(this, STARTUP_SCRUB_DELAY_MS)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (loop?.isActive != true) {
            loop = scope.launch { runLoop() }
        }
        // Restart if the system kills us — an unavailable handset is invisible to the agent.
        return START_STICKY
    }

    /**
     * พนักงานปัดแอปทิ้งจากหน้าแอปล่าสุด
     *
     * START_STICKY เอาไม่อยู่บนเครื่องหลายยี่ห้อ โดยเฉพาะ Samsung ที่จัดการหน่วยความจำแรง
     * service จะถูกฆ่าแล้วไม่ถูกปลุกกลับ ผลคือเครื่องเงียบไปเฉย ๆ พนักงานไม่รู้ว่าไม่ได้รับงานแล้ว
     * และคนกดโทรจากคอมก็ได้แต่รอ
     *
     * ตั้งปลุกให้ตัวเองกลับมาในอีกไม่กี่วินาที การปัดแอปทิ้งเป็นการปิดหน้าจอ ไม่ใช่การเลิกรับงาน
     * ถ้าจะเลิกรับงานจริงมีปุ่มออกจากระบบให้กดอยู่แล้ว
     */
    override fun onTaskRemoved(rootIntent: Intent?) {
        try {
            if (session.isSignedIn) {
                val restart = PendingIntent.getService(
                    this, RESTART_REQUEST_CODE,
                    Intent(this, CallBridgeService::class.java),
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
                )
                getSystemService(AlarmManager::class.java)?.set(
                    AlarmManager.ELAPSED_REALTIME,
                    android.os.SystemClock.elapsedRealtime() + RESTART_DELAY_MS,
                    restart,
                )
            }
        } catch (e: Exception) {
            Log.w(TAG, "onTaskRemoved: ตั้งปลุกกลับไม่สำเร็จ: ${e.message}")
        }
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        if (running === this) running = null
        monitor?.stop()
        scope.cancel()
        super.onDestroy()
    }

    // ── the loop ──────────────────────────────────────────────────────────────────────────────

    private suspend fun runLoop() {
        var backoff = POLL_IDLE_MS
        while (scope.isActive) {
            if (!session.isSignedIn) {
                updateNotification(getString(com.primacom.dialer.R.string.status_signed_out))
                delay(POLL_IDLE_MS)
                continue
            }
            if (activeSessionId != null) {
                // A call is in progress; asking for more work would only queue a second one.
                delay(POLL_BUSY_MS)
                continue
            }

            // แอปโทรศัพท์เดิมที่ยังอยู่ในเครื่องมีป้ายชวน "ตั้งเป็นค่าเริ่มต้น" กดครั้งเดียว
            // role หลุดจากเรา แล้วทุกสายกลับไปโชว์เบอร์บนหน้าจอเดิมทันที ห้ามการกดไม่ได้
            // สิ่งที่ทำได้คือรู้ให้เร็ว เตือนบนเครื่อง และหยุดรับงานจนกว่าจะตั้งกลับ —
            // เครื่องที่ไม่ซ่อนเบอร์ต้องใช้ทำงานไม่ได้
            val dialerOk = checkDialerRole()

            try {
                val job = api.poll()
                backoff = POLL_IDLE_MS
                if (dialerOk) {
                    updateNotification(
                        getString(com.primacom.dialer.R.string.status_ready, session.agentName ?: "")
                    )
                }
                if (job != null) {
                    if (dialerOk) {
                        startCall(job)
                    } else {
                        // ตีกลับให้คนกดบนคอมเห็นว่าล้มเหลวพร้อมเหตุผล แทนที่จะปล่อยให้สายออก
                        // ผ่านหน้าจอเดิมที่โชว์เบอร์ — ร่องรอยอยู่ใน call_sessions.failure_reason
                        runCatching { api.report(job.sessionId, "failed", failureReason = "not_default_dialer") }
                    }
                }
            } catch (e: ApiException) {
                // token โดนปฏิเสธ — ไม่เตะออกทันที ลองลงทะเบียนเครื่องใหม่ด้วย session token ที่ยังมี
                // เพื่อขอ device token ใบใหม่ (self-heal) ถ้ายังมี session token อยู่ ไม่รบกวนพนักงาน
                if (e.code == "UNAUTHORIZED" && session.isSignedIn && !reregistering) {
                    reregistering = true
                    val ok = runCatching { api.registerDevice(simPhone = null) }.isSuccess
                    reregistering = false
                    if (!ok) {
                        // ลงทะเบียนใหม่ก็ยังไม่ผ่าน = credential ตายจริง ค่อยแจ้งให้เข้าสู่ระบบใหม่
                        // (ยังไม่ล้าง token อัตโนมัติ ให้พนักงานเห็นสถานะก่อน)
                        updateNotification(getString(com.primacom.dialer.R.string.status_reauth))
                    }
                    delay(POLL_IDLE_MS)
                    continue
                }
                updateNotification(e.message)
                Log.w(TAG, "poll: ${e.code} ${e.message}")
            } catch (e: Exception) {
                // Network blip. Back off so a dead connection does not hammer the server or the battery.
                backoff = (backoff * 2).coerceAtMost(POLL_MAX_BACKOFF_MS)
                updateNotification(getString(com.primacom.dialer.R.string.status_offline))
                Log.w(TAG, "poll failed: ${e.message}")
            }

            delay(backoff)
        }
    }

    // ── placing the call ──────────────────────────────────────────────────────────────────────

    private fun startCall(job: DialJob) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE)
            != PackageManager.PERMISSION_GRANTED
        ) {
            reportFailure(job.sessionId, "no_permission")
            return
        }
        if (job.dial.isBlank()) {
            reportFailure(job.sessionId, "no_number")
            return
        }

        activeSessionId = job.sessionId
        callStartedAt = 0L
        callSawActivity = false
        // Hand the identity to the in-call screen before the call exists, so it never has to fall
        // back to showing the handle it was dialled with.
        ActiveCall.expect(job.sessionId, job.customerId, job.customerName)
        updateNotification(getString(com.primacom.dialer.R.string.status_calling, job.customerName))

        // Watch the radio rather than trusting placeCall to tell us anything — this is what
        // distinguishes "rang out" from "they answered and talked for four minutes".
        monitor = CallMonitor(this) { state -> onCallState(state) }.also { it.start() }

        // If the radio never stirs, nobody will ever close this session. Release the agent rather
        // than leaving them unable to place another call.
        watchdog = scope.launch {
            delay(CALL_WATCHDOG_MS)
            if (activeSessionId == job.sessionId && !callSawActivity) {
                runCatching { api.report(job.sessionId, "failed", failureReason = "no_call_state") }
                finishCall()
            }
        }

        try {
            val telecom = getSystemService(TelecomManager::class.java)
            val uri = Uri.fromParts("tel", job.dial, null)
            scope.launch { runCatching { api.report(job.sessionId, "ringing") } }
            telecom.placeCall(uri, null)
        } catch (e: SecurityException) {
            reportFailure(job.sessionId, "security")
        } catch (e: Exception) {
            Log.e(TAG, "placeCall failed", e)
            reportFailure(job.sessionId, "dial_failed")
        }
    }

    /**
     * ปลายทางรับสายแล้วจริง เรียกจาก PrimacomInCallService ตอนเห็น Call.STATE_ACTIVE
     *
     * เป็นจุดเดียวที่รู้แน่ว่าอีกฝั่งยกหู ไม่ใช่แค่วิทยุเริ่มกดเบอร์ นาฬิกาจับเวลาคุยเริ่มที่นี่
     */
    fun onRemoteAnswered() {
        val sessionId = activeSessionId ?: return
        if (callStartedAt != 0L) return
        callStartedAt = System.currentTimeMillis()
        callSawActivity = true
        scope.launch { runCatching { api.report(sessionId, "answered") } }
    }

    private fun onCallState(state: Int) {
        val sessionId = activeSessionId ?: return

        when (state) {
            TelephonyManager.CALL_STATE_OFFHOOK, TelephonyManager.CALL_STATE_RINGING -> {
                // ใช้บอกแค่ว่ามีสายเกิดขึ้นจริง ไม่ใช่ว่าปลายทางรับแล้ว
                //
                // สำหรับสายโทรออก OFFHOOK เกิดตั้งแต่ตอนยกหูไปกดเบอร์ วิทยุยังไม่รู้เลยว่าอีกฝั่ง
                // จะรับหรือไม่ ของเดิมรายงาน answered ตรงนี้ เวลาคุยจึงถูกนับตั้งแต่เริ่มโทร
                // เจอของจริง: คุย 9 วินาที แต่บันทึกไป 28 วินาที
                //
                // จังหวะรับสายจริงรู้ได้จาก Call.STATE_ACTIVE ซึ่ง PrimacomInCallService เห็นอยู่
                // แล้วในฐานะแอปโทรศัพท์เริ่มต้น จึงย้ายไปรายงานที่นั่นแทน
                callSawActivity = true
            }
            TelephonyManager.CALL_STATE_IDLE -> {
                // The state we were already in when we subscribed, not a hang-up.
                if (!callSawActivity) return

                val seconds =
                    if (callStartedAt == 0L) 0
                    else ((System.currentTimeMillis() - callStartedAt) / 1000).toInt()

                scope.launch { runCatching { api.report(sessionId, "ended", durationSec = seconds) } }
                finishCall()
            }
        }
    }

    /** เตือนครั้งเดียวตอน role หลุด และเก็บป้ายเตือนคืนทันทีที่ตั้งกลับ ไม่รัวทุก 2 วินาที */
    private var roleWarned = false

    private fun checkDialerRole(): Boolean {
        val ok = getSystemService(TelecomManager::class.java)?.defaultDialerPackage == packageName
        if (!ok && !roleWarned) {
            roleWarned = true
            postRoleLostNotification()
            updateNotification(getString(com.primacom.dialer.R.string.status_role_lost))
        } else if (ok && roleWarned) {
            roleWarned = false
            getSystemService(NotificationManager::class.java)?.cancel(ROLE_NOTIFICATION_ID)
        }
        return ok
    }

    /** เสียง/สั่นเต็มที่โดยตั้งใจ — เงียบไปพนักงานจะไม่รู้ว่าเครื่องเลิกซ่อนเบอร์และเลิกรับงานแล้ว */
    private fun postRoleLostNotification() {
        val manager = getSystemService(NotificationManager::class.java) ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(
                    ALERT_CHANNEL_ID,
                    getString(com.primacom.dialer.R.string.notif_channel_alert),
                    NotificationManager.IMPORTANCE_HIGH,
                )
            )
        }
        val open = PendingIntent.getActivity(
            this, ROLE_NOTIFICATION_ID,
            Intent(this, MainActivity::class.java)
                .putExtra(MainActivity.EXTRA_REQUEST_ROLE, true),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        manager.notify(
            ROLE_NOTIFICATION_ID,
            NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_warning)
                .setContentTitle(getString(com.primacom.dialer.R.string.role_lost_title))
                .setContentText(getString(com.primacom.dialer.R.string.role_lost_text))
                .setStyle(NotificationCompat.BigTextStyle()
                    .bigText(getString(com.primacom.dialer.R.string.role_lost_text)))
                .setCategory(NotificationCompat.CATEGORY_ERROR)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setOngoing(true)
                .setContentIntent(open)
                .build(),
        )
    }

    private fun reportFailure(sessionId: Int, reason: String) {
        scope.launch { runCatching { api.report(sessionId, "failed", failureReason = reason) } }
        finishCall()
    }

    private fun finishCall() {
        watchdog?.cancel()
        watchdog = null
        monitor?.stop()
        monitor = null
        activeSessionId = null
        callStartedAt = 0L
        callSawActivity = false
        updateNotification(getString(com.primacom.dialer.R.string.status_ready, session.agentName ?: ""))
        // ตัวหลักที่ลบคือ InCallService ตอน onCallRemoved — ตรงนี้เป็นตาข่ายรองรับ
        // สำหรับสายที่ radio เห็นแต่ InCallService ไม่เห็น (เช่น จบด้วย watchdog)
        CallLogScrubber.scrubSoon(this)
    }

    // ── notification ──────────────────────────────────────────────────────────────────────────

    private fun startInForeground(text: String) {
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "สถานะการเชื่อมต่อ", NotificationManager.IMPORTANCE_LOW)
                    .apply { setShowBadge(false) }
            )
        }
        val notification = buildNotification(text)
        // ตั้งแต่ Android 15 ชนิด dataSync ถูกจำกัดไว้ 6 ชั่วโมงต่อ 24 ชั่วโมง แต่ลูปนี้ต้องอยู่
        // ตลอดวันทำงานเพื่อรอรับคำสั่งโทร ถ้าโดนตัดกลางวันพนักงานจะกดโทรจากคอมแล้วเครื่องเงียบ
        // โดยไม่มีอะไรบอก จึงประกาศเป็น specialUse ซึ่งไม่ติดเพดานนั้น (คำอธิบายอยู่ใน manifest)
        // เครื่อง Android 13 ลงไปยังใช้ dataSync ได้ตามเดิม เพราะยังไม่มีเพดานและยังไม่รู้จัก specialUse
        try {
            when {
                Build.VERSION.SDK_INT >= 34 ->
                    startForeground(
                        NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                    )
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ->
                    startForeground(
                        NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                    )
                else -> startForeground(NOTIFICATION_ID, notification)
            }
        } catch (e: Exception) {
            // Losing the notification is survivable; taking the app down with it is not.
            Log.e(TAG, "startForeground failed", e)
        }
    }

    /**
     * ระบบแจ้งว่าหมดเวลาที่อนุญาตให้ service นี้ทำงาน
     *
     * ไม่ควรถูกเรียกเลยเมื่อประกาศเป็น specialUse แต่ถ้า Google ปฏิเสธชนิดนี้แล้วต้องถอยกลับไป
     * ใช้ dataSync หรือกฎเปลี่ยนอีกในอนาคต การเงียบหายไปคือสิ่งที่แย่ที่สุด เพราะพนักงานจะไม่รู้ว่า
     * เครื่องเลิกรับงานแล้ว ที่นี่จึงหยุดอย่างเป็นระเบียบพร้อมบอกสถานะไว้บนแถบแจ้งเตือน
     * ให้พนักงานเห็นว่าต้องเปิดแอปใหม่
     */
    override fun onTimeout(startId: Int) {
        Log.w(TAG, "onTimeout: ระบบสั่งหยุด foreground service")
        updateNotification("การเชื่อมต่อถูกระบบหยุด กรุณาเปิดแอปอีกครั้ง")
        stopSelf()
    }

    private fun buildNotification(text: String): Notification {
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_phone_call)
            .setContentTitle(getString(com.primacom.dialer.R.string.app_name))
            .setContentText(text)
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(open)
            .build()
    }

    private fun updateNotification(text: String) {
        getSystemService(NotificationManager::class.java)
            .notify(NOTIFICATION_ID, buildNotification(text))
    }

    companion object {
        /**
         * service ที่กำลังทำงานอยู่ ใช้ให้ PrimacomInCallService บอกกลับมาได้ว่าปลายทางรับสายแล้ว
         *
         * ทั้งสอง service อยู่ในโปรเซสเดียวกัน การอ้างถึงกันตรง ๆ จึงถูกต้องและไม่ต้องผ่าน Intent
         * ล้างค่าใน onDestroy เพื่อไม่ให้ค้างอ้างถึง service ที่ตายแล้ว
         */
        @Volatile
        private var running: CallBridgeService? = null

        /** ปลายทางยกหูแล้ว เรียกจาก PrimacomInCallService ตอนสายเปลี่ยนเป็น STATE_ACTIVE */
        fun notifyRemoteAnswered() {
            running?.onRemoteAnswered()
        }

        private const val TAG = "CallBridge"
        private const val CHANNEL_ID = "call_bridge"
        private const val NOTIFICATION_ID = 1001
        private const val ALERT_CHANNEL_ID = "alerts"
        private const val ROLE_NOTIFICATION_ID = 1003

        /** ปลุก service กลับมาหลังพนักงานปัดแอปทิ้ง สั้นพอที่จะไม่พลาดงาน ยาวพอให้ระบบเก็บกวาดเสร็จ */
        private const val RESTART_REQUEST_CODE = 1002
        private const val RESTART_DELAY_MS = 3_000L

        /** รอให้ service ตั้งตัวเสร็จก่อนค่อยกวาดประวัติการโทรตกค้าง ไม่ใช่งานเร่ง */
        private const val STARTUP_SCRUB_DELAY_MS = 10_000L

        /** Fast enough that pressing "call" feels immediate; slow enough to be invisible on a charger. */
        private const val POLL_IDLE_MS = 2_000L
        private const val POLL_BUSY_MS = 3_000L
        private const val POLL_MAX_BACKOFF_MS = 30_000L

        /** Long enough for a slow network to connect a call, short enough not to strand the agent. */
        private const val CALL_WATCHDOG_MS = 45_000L

        /**
         * Never let a failure to start the bridge take the UI with it. If the system refuses the
         * service the agent still needs to reach the screen that explains why.
         */
        fun start(context: android.content.Context) {
            try {
                ContextCompat.startForegroundService(context, Intent(context, CallBridgeService::class.java))
            } catch (e: Exception) {
                Log.e(TAG, "could not start bridge", e)
            }
        }
    }
}
