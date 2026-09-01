package com.primacom.dialer.ui

import android.animation.ObjectAnimator
import android.content.res.ColorStateList
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.telecom.Call
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.animation.OvershootInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.primacom.dialer.R
import com.primacom.dialer.call.ActiveCall
import com.primacom.dialer.data.Api
import com.primacom.dialer.data.Session
import com.primacom.dialer.ui.Design.callAction
import com.primacom.dialer.ui.Design.chip
import com.primacom.dialer.ui.Design.dp
import com.primacom.dialer.ui.Design.glassPanel
import com.primacom.dialer.ui.Design.glassSheet
import com.primacom.dialer.ui.Design.flexSpacer
import com.primacom.dialer.ui.Design.label
import com.primacom.dialer.ui.Design.text
import kotlinx.coroutines.launch
import org.json.JSONObject

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
    private lateinit var tapControls: LinearLayout    // กำลังโทร: ปิดไมค์ + วางสาย
    private lateinit var swipeControls: View          // สายเข้า: ปัดรับ/ปัดวาง
    private var contentRoot: LinearLayout? = null     // ราก buildUi — สลับ aurora ตามสถานะสาย
    private var downX = 0f

    private lateinit var api: Api
    // เลย์เอาต์ "กำลังสนทนา" (แผงคุมสาย + ข้อมูลลูกค้า)
    private var activeShown = false
    private var activeTab = 0                 // 0=ข้อมูล 1=ประวัติ 2=สวน
    private var custData: JSONObject? = null
    private lateinit var activeTimerView: TextView
    private lateinit var metaView: TextView
    private lateinit var tabRowView: LinearLayout
    private lateinit var tabContentView: LinearLayout

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
        api = Api(Session(this))
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
            background = Aurora.incoming()   // v6: พื้นแสง (ปรับตามสถานะจริงใน bindState)
            // ฐาน padding แล้วเผื่อแถบระบบด้วย insets ปุ่มวางสายล่างสุดจะได้ไม่โดน nav bar บัง
            setPadding(dp(28), dp(40), dp(28), dp(24))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT
            )
            with(Design) { applyBarInsets() }
        }.also { contentRoot = it }

        // ป้ายบนสุด บอกว่าเป็นสายของบริษัท (ตัวตนของแอป ไม่ใช่หน้าสายเครื่องเดิม)
        root.addView(label(getString(R.string.app_name), Design.inkFaint).apply {
            setPadding(0, 0, 0, dp(26))
        })

        // สถานะ (สายเข้า/กำลังโทร/สนทนา) — ย้ายขึ้นเหนืออวาตาร์ให้เหมือนดีไซน์
        stateView = text("", 12.5f, Design.inkDim, Design.faceMedium, Gravity.CENTER).apply {
            background = Design.roundedFill(Design.surfaceHi, dp(999).toFloat())
            setPadding(dp(15), dp(7), dp(15), dp(7))
            letterSpacing = 0.02f
        }
        root.addView(stateView, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT))

        // อวาตาร์วงกลมใหญ่
        val name = ActiveCall.customerName.ifBlank { ActiveCall.describe() }
        root.addView(TextView(this).apply {
            text = name.trim().firstOrNull()?.toString() ?: "?"
            setTextColor(Design.ink); textSize = 40f; typeface = Design.faceBold; gravity = Gravity.CENTER
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(Design.avatarNeutral) }
            layoutParams = LinearLayout.LayoutParams(dp(104), dp(104)).apply { topMargin = dp(44) }
        })

        whoView = text("", 30f, Design.ink, Design.faceBold, Gravity.CENTER).apply {
            setPadding(dp(8), dp(22), dp(8), 0)
        }
        root.addView(whoView)

        val idChip = if (ActiveCall.customerId > 0) {
            chip("รหัสลูกค้า #${ActiveCall.customerId}", Design.ink3, Design.surfaceHi)
        } else null
        idChip?.let {
            root.addView(it, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = dp(12); gravity = Gravity.CENTER_HORIZONTAL })
        }

        timerView = text("", 42f, Design.ink, Design.mono, Gravity.CENTER).apply {
            setPadding(0, dp(28), 0, 0)
            letterSpacing = 0.02f
        }
        root.addView(timerView)

        // ย้ำว่าเบอร์ถูกซ่อน
        root.addView(text("เบอร์ลูกค้าถูกซ่อน · โทรผ่านระบบเท่านั้น", 12.5f, Design.inkFaint, gravity = Gravity.CENTER)
            .apply { setPadding(0, dp(14), 0, 0) })

        root.addView(flexSpacer())

        // ปุ่มตอนกำลังโทรออก: ปิดไมค์ + วางสาย (แบ่งช่องน้ำหนักเท่ากัน กันปุ่มล้นจอ)
        tapControls = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        }
        fun cell() = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        muteButton = callAction(R.drawable.ic_mic, getString(R.string.action_mute), Design.surfaceHi, 66) { toggleMute() }
        val hangUpTap = callAction(R.drawable.ic_call_end, getString(R.string.action_hang_up), Design.danger, 72) { hangUp() }
        tapControls.addView(muteButton, cell())
        tapControls.addView(hangUpTap, cell())
        root.addView(tapControls)

        // ปุ่มตอนสายเข้า: ปัดรับ/ปัดวาง (คุมความสูงรางตายตัว)
        swipeControls = buildSwipeControls().apply { visibility = View.GONE }
        root.addView(swipeControls, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(76)))

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
        val call = ActiveCall.call
        if (call == null) { finish(); return }

        if (call.state == Call.STATE_DISCONNECTED || call.state == Call.STATE_DISCONNECTING) {
            // ฟอร์มบันทึกการโทรถูกเปิดจาก PrimacomInCallService (full-screen intent) ที่นี่แค่ปิดจอสาย
            finish(); return
        }

        // สาย active → สลับไปเลย์เอาต์ "กำลังสนทนา" ที่เปิดดูข้อมูลลูกค้าได้
        if (call.state == Call.STATE_ACTIVE) {
            if (connectedAt == 0L) connectedAt = System.currentTimeMillis()
            if (!activeShown) showActive() else activeTimerView.text = elapsed()
            return
        }

        // เลย์เอาต์ตรงกลาง (กำลังโทร / สายเข้า)
        whoView.text = ActiveCall.describe()
        when (call.state) {
            Call.STATE_DIALING, Call.STATE_CONNECTING -> {
                stateView.text = getString(R.string.call_dialing)
                stateView.setTextColor(Design.inkDim)
                timerView.text = "--:--"
                timerView.setTextColor(Design.timerIdle)
                tapControls.visibility = View.VISIBLE
                swipeControls.visibility = View.GONE
                contentRoot?.background = Aurora.active()   // โทรออก = พื้นเขียว
            }
            Call.STATE_RINGING -> {
                stateView.text = getString(R.string.call_incoming)
                stateView.setTextColor(Design.warning)
                timerView.text = ""
                // สายเข้า: ปัดรับ/ปัดวาง (ไม่มีปิดไมค์ — โผล่หลังรับสาย)
                tapControls.visibility = View.GONE
                swipeControls.visibility = View.VISIBLE
                contentRoot?.background = Aurora.incoming() // สายเข้า = พื้นส้ม
            }
            else -> stateView.text = ""
        }
    }

    // ── ปัดรับ/ปัดวาง (สายเข้า) ────────────────────────────────────────────────────────────────

    private fun buildSwipeControls(): View {
        val track = FrameLayout(this).apply {
            background = Design.roundedFill(Design.surfaceHi, dp(999).toFloat())
        }
        // เชฟรอนบอกทิศ (เขียวชี้ขวา = รับ, แดงชี้ซ้าย = วาง)
        val answerChev = text("›››", 26f, Design.accentText, Design.faceBold).apply { letterSpacing = -0.05f }
        track.addView(answerChev, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.START or Gravity.CENTER_VERTICAL).apply { marginStart = dp(82) })
        val rejectChev = text("‹‹‹", 26f, Design.danger, Design.faceBold).apply { letterSpacing = -0.05f }
        track.addView(rejectChev, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.END or Gravity.CENTER_VERTICAL).apply { marginEnd = dp(82) })
        animateChevrons(answerChev, 1f)
        animateChevrons(rejectChev, -1f)

        val answer = circleHandle(R.drawable.ic_call, Design.accent)
        track.addView(answer, FrameLayout.LayoutParams(dp(60), dp(60),
            Gravity.START or Gravity.CENTER_VERTICAL).apply { marginStart = dp(8) })
        val reject = circleHandle(R.drawable.ic_call_end, Design.danger)
        track.addView(reject, FrameLayout.LayoutParams(dp(60), dp(60),
            Gravity.END or Gravity.CENTER_VERTICAL).apply { marginEnd = dp(8) })

        val travel = { (track.width - dp(60) - dp(16)).coerceAtLeast(dp(140)).toFloat() }
        setupSwipeHandle(answer, answerChev, 1f, travel) {
            ActiveCall.call?.answer(android.telecom.VideoProfile.STATE_AUDIO_ONLY)
        }
        setupSwipeHandle(reject, rejectChev, -1f, travel) { hangUp() }
        return track
    }

    /** ปัดหนึ่งด้าน: กดแล้วขยาย, เชฟรอนจางตามระยะ, ถึงจุดสั่นตอบมือ, ปล่อยสุด=ทำงาน, ไม่สุด=เด้งสปริงกลับ */
    private fun setupSwipeHandle(handle: View, chev: View, dir: Float, travel: () -> Float, onCommit: () -> Unit) {
        var armed = false
        handle.setOnTouchListener { v, e ->
            when (e.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    downX = e.rawX
                    v.animate().scaleX(1.08f).scaleY(1.08f).setDuration(110).start()
                    v.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val max = travel()
                    val prog = ((e.rawX - downX) * dir).coerceIn(0f, max)
                    v.translationX = prog * dir
                    val ratio = prog / max
                    chev.alpha = (0.55f - ratio * 0.55f).coerceIn(0f, 0.55f)
                    val past = ratio >= 0.6f
                    if (past && !armed) { armed = true; v.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS) }
                    else if (!past && armed) armed = false
                    true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    v.animate().scaleX(1f).scaleY(1f).setDuration(120).start()
                    if (armed) {
                        v.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
                        onCommit()
                    } else {
                        v.animate().translationX(0f).setInterpolator(OvershootInterpolator(2f)).setDuration(300).start()
                        chev.animate().alpha(0.55f).setDuration(220).start()
                    }
                    armed = false
                    v.performClick()
                    true
                }
                else -> false
            }
        }
    }

    /** ลูกศรเชฟรอนขยับเป็นจังหวะไปทางที่ต้องปัด (dir = +1 ขวา, −1 ซ้าย) */
    private fun animateChevrons(v: View, dir: Float) {
        v.alpha = 0.55f
        ObjectAnimator.ofFloat(v, View.TRANSLATION_X, 0f, dp(8).toFloat() * dir).apply {
            duration = 720
            repeatCount = ObjectAnimator.INFINITE
            repeatMode = ObjectAnimator.REVERSE
            interpolator = android.view.animation.AccelerateDecelerateInterpolator()
            start()
        }
    }

    private fun circleHandle(iconRes: Int, color: Int): ImageView = ImageView(this).apply {
        setImageResource(iconRes)
        imageTintList = ColorStateList.valueOf(Design.onSolid)
        val p = dp(17); setPadding(p, p, p, p)
        background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(color) }
    }

    // ── เลย์เอาต์ "กำลังสนทนา" ─────────────────────────────────────────────────────────────────

    private fun showActive() {
        activeShown = true
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; background = Aurora.active()
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT)
            with(Design) { applyBarInsets(0, 0, 0, 0) }
        }

        // แผงคุมสาย (บน) มุมล่างโค้ง
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable().apply {
                setColor(Design.surfaceHi)
                cornerRadii = floatArrayOf(0f, 0f, 0f, 0f,
                    dp(28).toFloat(), dp(28).toFloat(), dp(28).toFloat(), dp(28).toFloat())
            }
            setPadding(dp(20), dp(18), dp(20), dp(20))
        }
        val row1 = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        row1.addView(chip("กำลังสนทนา", Design.accentText, Design.accentSoftBg))
        row1.addView(View(this).apply {}, LinearLayout.LayoutParams(0, 1, 1f))
        activeTimerView = text(elapsed(), 28f, Design.ink, Design.faceMono)
        row1.addView(activeTimerView)
        panel.addView(row1)

        val row2 = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(0, dp(16), 0, 0)
        }
        val nm = ActiveCall.customerName.ifBlank { ActiveCall.describe() }
        row2.addView(TextView(this).apply {
            text = nm.trim().firstOrNull()?.toString() ?: "?"
            setTextColor(Design.ink); textSize = 20f; typeface = Design.faceBold; gravity = Gravity.CENTER
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(Design.avatarNeutral) }
            layoutParams = LinearLayout.LayoutParams(dp(50), dp(50))
        })
        val nameCol = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(13), 0, 0, 0)
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        nameCol.addView(text(ActiveCall.describe(), 20f, Design.ink, Design.faceBold))
        metaView = text("#${ActiveCall.customerId}", 12f, Design.inkDim).apply { setPadding(0, dp(2), 0, 0) }
        nameCol.addView(metaView)
        row2.addView(nameCol)
        panel.addView(row2)

        val row3 = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setPadding(0, dp(18), 0, 0) }
        row3.addView(activeMutePill(), LinearLayout.LayoutParams(0, dp(50), 1f))
        row3.addView(hangupWide(), LinearLayout.LayoutParams(dp(98), dp(50)).apply { marginStart = dp(9) })
        panel.addView(row3)
        root.addView(panel)

        // แถบแท็บ + เนื้อหาข้อมูลลูกค้า (เลื่อนได้ขณะคุย)
        tabRowView = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setPadding(dp(16), dp(16), dp(16), 0) }
        root.addView(tabRowView)
        tabContentView = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(16), dp(14), dp(16), dp(20)) }
        root.addView(ScrollView(this).apply { isFillViewport = true; addView(tabContentView) },
            LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))

        setContentView(root)
        renderTabs()
        loadCustomer()
    }

    private fun activeMutePill(): LinearLayout {
        val pill = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER
            background = glassPanel(dp(999).toFloat())
            isClickable = true
        }
        val icon = ImageView(this).apply {
            setImageResource(if (muted) R.drawable.ic_mic_off else R.drawable.ic_mic)
            imageTintList = ColorStateList.valueOf(Design.ink)
            layoutParams = LinearLayout.LayoutParams(dp(20), dp(20))
        }
        val lbl = text(getString(if (muted) R.string.action_unmute else R.string.action_mute), 13.5f, Design.ink, Design.faceMedium)
            .apply { setPadding(dp(8), 0, 0, 0) }
        pill.addView(icon); pill.addView(lbl)
        pill.setOnClickListener {
            muted = !muted
            com.primacom.dialer.call.InCallBridge.setMuted(muted)
            icon.setImageResource(if (muted) R.drawable.ic_mic_off else R.drawable.ic_mic)
            lbl.text = getString(if (muted) R.string.action_unmute else R.string.action_mute)
            pill.background = if (muted) Design.roundedFill(Design.surfaceHi, dp(999).toFloat())
            else glassPanel(dp(999).toFloat())
        }
        return pill
    }

    private fun hangupWide(): View = LinearLayout(this).apply {
        gravity = Gravity.CENTER
        background = Design.roundedFill(Design.danger, dp(999).toFloat())
        isClickable = true; setOnClickListener { hangUp() }
        addView(ImageView(this@InCallActivity).apply {
            setImageResource(R.drawable.ic_call_end)
            imageTintList = ColorStateList.valueOf(Design.onSolid)
            layoutParams = LinearLayout.LayoutParams(dp(24), dp(24))
        })
    }

    private fun renderTabs() {
        val calls = custData?.optJSONArray("calls")
        val plots = custData?.optJSONObject("customer")?.optJSONArray("plots")
        val tabs = listOf(
            "ข้อมูล" to 0,
            "ประวัติ" + (calls?.let { " ${it.length()}" } ?: "") to 1,
            "สวน" + (plots?.let { " ${it.length()}" } ?: "") to 2,
        )
        tabRowView.removeAllViews()
        tabs.forEach { (lbl, idx) ->
            tabRowView.addView(tabChip(lbl, idx == activeTab) { activeTab = idx; renderTabs() },
                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                    .apply { marginEnd = dp(8) })
        }
        tabContentView.removeAllViews()
        if (custData == null) {
            tabContentView.addView(text("กำลังโหลดข้อมูลลูกค้า…", 13f, Design.inkFaint).apply { setPadding(dp(2), dp(10), 0, 0) })
            return
        }
        when (activeTab) {
            1 -> renderHistoryTab(calls)
            2 -> renderPlotsTab(plots)
            else -> renderInfoTab(custData?.optJSONObject("customer"))
        }
    }

    private fun tabChip(label: String, active: Boolean, onClick: () -> Unit): TextView =
        text(label, 13f, if (active) Design.onAccent else Design.ink3,
            if (active) Design.faceBold else Design.faceRegular).apply {
            background = if (active) Design.roundedFill(Design.accent, dp(999).toFloat())
            else glassPanel(dp(999).toFloat())
            setPadding(dp(15), dp(9), dp(15), dp(9)); isClickable = true; setOnClickListener { onClick() }
        }

    private fun infoCard() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        background = glassSheet(dp(22).toFloat())
        setPadding(dp(16), 0, dp(16), 0)
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
    }

    private fun kvRow(k: String, v: String, vColor: Int, mono: Boolean = false, withDivider: Boolean = true): View {
        val wrap = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(0, dp(14), 0, dp(14))
        }
        row.addView(text(k, 12.5f, Design.inkDim), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        row.addView(text(v, if (mono) 13.5f else 13f, vColor, if (mono) Design.faceMono else Design.faceRegular, Gravity.END))
        wrap.addView(row)
        if (withDivider) wrap.addView(View(this).apply {
            setBackgroundColor(Design.lineFaint)
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1))
        })
        return wrap
    }

    private fun renderInfoTab(c: JSONObject?) {
        val card = infoCard()
        card.addView(kvRow("เบอร์โทร", "ซ่อนไว้ · โทรผ่านระบบ", Design.inkFaint))
        if (c != null) {
            val purchases = c.optDouble("total_purchases", 0.0)
            card.addView(kvRow("ยอดซื้อรวม", "฿" + money(purchases), Design.accentText, mono = true))
            c.optString("province").takeIf { it.isNotBlank() && it != "null" }?.let { card.addView(kvRow("จังหวัด", it, Design.ink2)) }
            c.optString("grade").takeIf { it.isNotBlank() && it != "null" }?.let { card.addView(kvRow("เกรด", it, Design.ink2)) }
            c.optString("owner").takeIf { it.isNotBlank() && it != "null" }?.let { card.addView(kvRow("ดูแลโดย", it, Design.ink2, withDivider = false)) }
        }
        // ตัดเส้นคั่นแถวสุดท้ายถ้าเป็น divider ค้าง
        tabContentView.addView(card)
    }

    private fun renderHistoryTab(calls: org.json.JSONArray?) {
        if (calls == null || calls.length() == 0) {
            tabContentView.addView(text("ยังไม่มีประวัติการโทร", 13f, Design.inkFaint).apply { setPadding(dp(2), dp(10), 0, 0) })
            return
        }
        val card = infoCard()
        for (i in 0 until calls.length()) {
            val o = calls.getJSONObject(i)
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(0, dp(12), 0, dp(12))
            }
            val st = o.optString("status").takeIf { it.isNotBlank() && it != "null" } ?: "-"
            val rs = o.optString("result").takeIf { it.isNotBlank() && it != "null" }
            row.addView(View(this).apply {
                background = GradientDrawable().apply { shape = GradientDrawable.OVAL
                    setColor(if (st.contains("ไม่")) Design.danger else Design.accent) }
                layoutParams = LinearLayout.LayoutParams(dp(8), dp(8))
            })
            val mid = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(11), 0, dp(8), 0) }
            mid.addView(text(if (rs != null) "$st · $rs" else st, 13f, Design.ink2, Design.faceMedium))
            val dur = o.optInt("duration_sec")
            if (dur > 0) mid.addView(text("คุย ${dur / 60}:${String.format("%02d", dur % 60)}", 11.5f, Design.inkDim).apply { setPadding(0, dp(2), 0, 0) })
            row.addView(mid, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            row.addView(text(o.optString("at").substringBefore(' '), 11f, Design.inkFaint, Design.faceMono))
            card.addView(row)
            if (i < calls.length() - 1) card.addView(View(this).apply {
                setBackgroundColor(Design.lineFaint)
                layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1))
            })
        }
        tabContentView.addView(card)
    }

    private fun renderPlotsTab(plots: org.json.JSONArray?) {
        if (plots == null || plots.length() == 0) {
            tabContentView.addView(text("ยังไม่มีข้อมูลแปลงเพาะปลูก", 13f, Design.inkFaint).apply { setPadding(dp(2), dp(10), 0, 0) })
            return
        }
        val card = infoCard()
        for (i in 0 until plots.length()) {
            val p = plots.getJSONObject(i)
            val crop = p.optString("crop")
            val sizeVal = if (p.isNull("size_value")) null else p.optDouble("size_value")
            val unit = p.optString("size_unit").takeIf { it.isNotBlank() && it != "null" }
            val sizeText = when {
                sizeVal == null -> "—"
                sizeVal % 1.0 == 0.0 -> "${sizeVal.toInt()}${unit?.let { " $it" } ?: ""}"
                else -> "$sizeVal${unit?.let { " $it" } ?: ""}"
            }
            card.addView(kvRow(crop, sizeText, Design.ink2, withDivider = i < plots.length() - 1))
        }
        tabContentView.addView(card)
    }

    private fun loadCustomer() {
        if (ActiveCall.customerId <= 0) return
        lifecycleScope.launch {
            val res = runCatching { api.customerDetail(ActiveCall.customerId) }.getOrNull() ?: return@launch
            custData = res
            res.optJSONObject("customer")?.let { c ->
                val meta = listOfNotNull(
                    "#${ActiveCall.customerId}",
                    c.optString("grade").takeIf { it.isNotBlank() && it != "null" }?.let { "เกรด $it" },
                    c.optString("basket").takeIf { it.isNotBlank() && it != "null" }?.let { "ถัง $it" },
                ).joinToString(" · ")
                if (::metaView.isInitialized) metaView.text = meta
            }
            if (::tabRowView.isInitialized) renderTabs()
        }
    }

    private fun money(v: Double): String =
        if (v >= 1_000_000) String.format("%.2fM", v / 1_000_000)
        else if (v >= 1000) String.format("%,.0f", v) else v.toInt().toString()

    private fun elapsed(): String {
        val seconds = ((System.currentTimeMillis() - connectedAt) / 1000).toInt()
        return String.format("%02d:%02d", seconds / 60, seconds % 60)
    }
}
