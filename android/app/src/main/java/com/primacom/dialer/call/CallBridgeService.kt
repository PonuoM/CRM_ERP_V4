package com.primacom.dialer.call

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
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

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        session = Session(this)
        api = Api(session)
        startInForeground(getString(com.primacom.dialer.R.string.status_connecting))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (loop?.isActive != true) {
            loop = scope.launch { runLoop() }
        }
        // Restart if the system kills us — an unavailable handset is invisible to the agent.
        return START_STICKY
    }

    override fun onDestroy() {
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

            try {
                val job = api.poll()
                backoff = POLL_IDLE_MS
                updateNotification(
                    getString(com.primacom.dialer.R.string.status_ready, session.agentName ?: "")
                )
                if (job != null) startCall(job)
            } catch (e: ApiException) {
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

    private fun onCallState(state: Int) {
        val sessionId = activeSessionId ?: return

        when (state) {
            TelephonyManager.CALL_STATE_OFFHOOK, TelephonyManager.CALL_STATE_RINGING -> {
                callSawActivity = true
                if (state == TelephonyManager.CALL_STATE_OFFHOOK && callStartedAt == 0L) {
                    callStartedAt = System.currentTimeMillis()
                    scope.launch { runCatching { api.report(sessionId, "answered") } }
                }
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
        // Android 14 only lets the default dialer run a phoneCall-typed service, and this app is not
        // that yet. dataSync also describes what the loop really does: it syncs a work queue.
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (e: Exception) {
            // Losing the notification is survivable; taking the app down with it is not.
            Log.e(TAG, "startForeground failed", e)
        }
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
        private const val TAG = "CallBridge"
        private const val CHANNEL_ID = "call_bridge"
        private const val NOTIFICATION_ID = 1001

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
