package com.primacom.dialer.ui

import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.telecom.Call
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.primacom.dialer.R
import com.primacom.dialer.call.ActiveCall

/**
 * The in-call screen, replacing the one the phone shipped with.
 *
 * It shows a name and a customer id. It does not show a number, it has no keypad, and there is no
 * "add call" or "contacts" affordance — every one of those is a route back to the digits this whole
 * system exists to keep out of an agent's hands.
 */
class InCallActivity : AppCompatActivity() {

    private lateinit var whoView: TextView
    private lateinit var stateView: TextView
    private lateinit var timerView: TextView
    private lateinit var muteButton: Button
    private lateinit var answerButton: Button

    private val ticker = Handler(Looper.getMainLooper())
    private var connectedAt = 0L
    private var muted = false

    private val tick = object : Runnable {
        override fun run() {
            refresh()
            ticker.postDelayed(this, 1000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showOverLockScreen()
        buildUi()
    }

    override fun onResume() {
        super.onResume()
        ticker.post(tick)
    }

    override fun onPause() {
        ticker.removeCallbacks(tick)
        super.onPause()
    }

    /** An agent should not have to unlock the handset to see who is on the line. */
    private fun showOverLockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }
    }

    private fun buildUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(64, 160, 64, 96)
            setBackgroundColor(0xFF0B1F22.toInt())
        }

        whoView = TextView(this).apply {
            textSize = 26f
            setTextColor(0xFFFFFFFF.toInt())
            gravity = Gravity.CENTER
        }
        val idView = TextView(this).apply {
            textSize = 14f
            setTextColor(0xFF7FB4B8.toInt())
            gravity = Gravity.CENTER
            setPadding(0, 12, 0, 0)
            text = if (ActiveCall.customerId > 0) "รหัสลูกค้า #${ActiveCall.customerId}" else ""
        }
        stateView = TextView(this).apply {
            textSize = 15f
            setTextColor(0xFF9FC6C9.toInt())
            gravity = Gravity.CENTER
            setPadding(0, 40, 0, 0)
        }
        timerView = TextView(this).apply {
            textSize = 34f
            setTextColor(0xFFFFFFFF.toInt())
            gravity = Gravity.CENTER
            setPadding(0, 16, 0, 0)
        }

        val spacer = android.view.View(this).apply {
            layoutParams = LinearLayout.LayoutParams(1, 0, 1f)
        }

        muteButton = Button(this).apply {
            text = getString(R.string.action_mute)
            setOnClickListener {
                muted = !muted
                // setMuted lives on the service; the system keeps one instance, so ask through it.
                ActiveCall.call?.let { _ ->
                    com.primacom.dialer.call.InCallBridge.setMuted(muted)
                }
                text = getString(if (muted) R.string.action_unmute else R.string.action_mute)
            }
        }
        answerButton = Button(this).apply {
            text = getString(R.string.action_answer)
            // Visibility follows the live call state in refresh(); deciding once at build time meant
            // a call still being identified never grew an answer button.
            visibility = android.view.View.GONE
            setOnClickListener {
                ActiveCall.call?.answer(android.telecom.VideoProfile.STATE_AUDIO_ONLY)
            }
        }
        val hangUp = Button(this).apply {
            text = getString(R.string.action_hang_up)
            setOnClickListener { hangUp() }
        }

        root.addView(whoView)
        root.addView(idView)
        root.addView(stateView)
        root.addView(timerView)
        root.addView(spacer)
        root.addView(answerButton)
        root.addView(muteButton)
        root.addView(hangUp)
        setContentView(root)
        refresh()
    }

    private fun hangUp() {
        ActiveCall.call?.disconnect()
        finish()
    }

    private fun refresh() {
        whoView.text = ActiveCall.describe()

        val call = ActiveCall.call
        if (call == null) {
            finish()
            return
        }

        when (call.state) {
            Call.STATE_DIALING, Call.STATE_CONNECTING -> {
                stateView.text = getString(R.string.call_dialing)
                timerView.text = ""
            }
            Call.STATE_RINGING -> {
                stateView.text = getString(R.string.call_incoming)
                timerView.text = ""
                answerButton.visibility = android.view.View.VISIBLE
            }
            Call.STATE_ACTIVE -> {
                answerButton.visibility = android.view.View.GONE
                if (connectedAt == 0L) connectedAt = System.currentTimeMillis()
                stateView.text = getString(R.string.call_active)
                timerView.text = elapsed()
            }
            Call.STATE_DISCONNECTED, Call.STATE_DISCONNECTING -> {
                stateView.text = getString(R.string.call_ended)
                finish()
            }
            else -> stateView.text = ""
        }
    }

    private fun elapsed(): String {
        val seconds = ((System.currentTimeMillis() - connectedAt) / 1000).toInt()
        return String.format("%02d:%02d", seconds / 60, seconds % 60)
    }
}
