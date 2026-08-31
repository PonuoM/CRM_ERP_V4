package com.primacom.dialer.ui

import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.telecom.Call
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.primacom.dialer.R
import com.primacom.dialer.call.ActiveCall
import com.primacom.dialer.ui.Design.callAction
import com.primacom.dialer.ui.Design.chip
import com.primacom.dialer.ui.Design.dp
import com.primacom.dialer.ui.Design.flexSpacer
import com.primacom.dialer.ui.Design.label
import com.primacom.dialer.ui.Design.text
import com.primacom.dialer.ui.Design.title

/**
 * หน้าจอสาย แทนที่หน้าจอสายเดิมของเครื่อง
 *
 * โชว์ชื่อและรหัสลูกค้า ไม่โชว์เบอร์ ไม่มีแป้นกด ไม่มีปุ่มเพิ่มสาย/รายชื่อ — ทุกอย่างที่อาจพา
 * เบอร์ลูกค้าขึ้นจอถูกตัดออกโดยตั้งใจ
 *
 * เลย์เอาต์: ชื่อลูกค้าเด่นกลางบน · รหัสลูกค้าเป็น chip · สถานะ · นาฬิกาจับเวลาตัวใหญ่ mono ·
 * แถวปุ่มวงกลม (รับ/ปิดเสียง/วาง) ล่างสุด กดโดนง่ายเวลาเร่ง
 */
class InCallActivity : AppCompatActivity() {

    private lateinit var whoView: TextView
    private lateinit var stateView: TextView
    private lateinit var timerView: TextView
    private lateinit var muteButton: LinearLayout
    private lateinit var answerButton: LinearLayout

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

    /** พนักงานไม่ควรต้องปลดล็อกเครื่องเพื่อดูว่าใครโทรเข้า */
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
        window.statusBarColor = Design.bg
        window.navigationBarColor = Design.bg
    }

    private fun buildUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setBackgroundColor(Design.bg)
            setPadding(dp(28), dp(72), dp(28), dp(40))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT
            )
        }

        // ป้ายบนสุด บอกว่าเป็นสายของบริษัท (ตัวตนของแอป ไม่ใช่หน้าสายเครื่องเดิม)
        root.addView(label(getString(R.string.app_name), Design.inkFaint).apply {
            setPadding(0, 0, 0, dp(40))
        })

        whoView = title("").apply {
            setPadding(dp(8), 0, dp(8), 0)
        }
        root.addView(whoView)

        val idChip = if (ActiveCall.customerId > 0) {
            chip("รหัสลูกค้า #${ActiveCall.customerId}", Design.accent, Design.surfaceHi)
        } else null
        idChip?.let {
            root.addView(it, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = dp(16); gravity = Gravity.CENTER_HORIZONTAL })
        }

        stateView = text("", 15f, Design.inkDim, gravity = Gravity.CENTER).apply {
            setPadding(0, dp(36), 0, 0)
            letterSpacing = 0.03f
        }
        root.addView(stateView)

        timerView = text("", 44f, Design.ink, Design.mono, Gravity.CENTER).apply {
            setPadding(0, dp(14), 0, 0)
            letterSpacing = 0.02f
        }
        root.addView(timerView)

        root.addView(flexSpacer())

        // แถวปุ่มวงกลม
        val controls = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }
        val gap = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { marginStart = dp(20); marginEnd = dp(20) }

        answerButton = callAction(R.drawable.ic_call, getString(R.string.action_answer), Design.positive) {
            ActiveCall.call?.answer(android.telecom.VideoProfile.STATE_AUDIO_ONLY)
        }
        muteButton = callAction(R.drawable.ic_mic, getString(R.string.action_mute), Design.surfaceHi) {
            toggleMute()
        }
        val hangUp = callAction(R.drawable.ic_call_end, getString(R.string.action_hang_up), Design.danger, 78) {
            hangUp()
        }

        controls.addView(answerButton, gap)
        controls.addView(muteButton, gap)
        controls.addView(hangUp, gap)
        root.addView(controls)

        setContentView(root)
        refresh()
    }

    private fun toggleMute() {
        muted = !muted
        com.primacom.dialer.call.InCallBridge.setMuted(muted)
        // สลับไอคอนและป้ายให้ตรงสถานะ
        (muteButton.getChildAt(0) as? android.widget.ImageView)
            ?.setImageResource(if (muted) R.drawable.ic_mic_off else R.drawable.ic_mic)
        (muteButton.getChildAt(1) as? TextView)
            ?.text = getString(if (muted) R.string.action_unmute else R.string.action_mute)
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
                stateView.setTextColor(Design.inkDim)
                timerView.text = ""
                answerButton.visibility = View.GONE
            }
            Call.STATE_RINGING -> {
                stateView.text = getString(R.string.call_incoming)
                stateView.setTextColor(Design.warning)
                timerView.text = ""
                answerButton.visibility = View.VISIBLE
            }
            Call.STATE_ACTIVE -> {
                answerButton.visibility = View.GONE
                if (connectedAt == 0L) connectedAt = System.currentTimeMillis()
                stateView.text = getString(R.string.call_active)
                stateView.setTextColor(Design.positive)
                timerView.text = elapsed()
            }
            Call.STATE_DISCONNECTED, Call.STATE_DISCONNECTING -> {
                stateView.text = getString(R.string.call_ended)
                stateView.setTextColor(Design.inkDim)
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
