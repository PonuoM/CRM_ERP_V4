package com.primacom.dialer.call

import android.content.Intent
import android.telecom.Call
import android.telecom.InCallService
import android.util.Log
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
            }
            if (state == Call.STATE_DISCONNECTED) {
                // Outbound sessions are closed by CallBridgeService, which placed them. Inbound ones
                // were opened by identify() and have nobody else to close them — left alone they stay
                // "ringing" for ever and the one-live-call rule locks the agent out of dialling.
                if (ActiveCall.isInbound) closeInboundSession()
                activeSince = 0L
                ActiveCall.clear()
            }
        }
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

        // Full screen, over the lock screen — the agent must see who it is without unlocking, and
        // must never be shown the stock dialer instead.
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
        }
    }

    companion object {
        private const val TAG = "PrimacomInCall"
    }
}
