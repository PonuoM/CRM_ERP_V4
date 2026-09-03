package com.primacom.dialer.ui

import android.content.res.ColorStateList
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.primacom.dialer.R
import com.primacom.dialer.data.Api
import com.primacom.dialer.data.CallRecord
import com.primacom.dialer.data.Session
import com.primacom.dialer.ui.Design.dp
import com.primacom.dialer.ui.Design.text
import kotlinx.coroutines.launch

/**
 * ประวัติการโทร — จาก CRM ไม่ใช่ประวัติในเครื่องที่ถูกลบ
 *
 * เห็นแค่ชื่อลูกค้ากับสถานะ ไม่มีเบอร์ · ปุ่มโทรกลับสร้างงานโทรผ่านรหัสลูกค้า แล้วเครื่องกดออกเอง
 */
class HistoryActivity : AppCompatActivity() {

    private lateinit var session: Session
    private lateinit var api: Api
    private lateinit var listCol: LinearLayout
    private lateinit var statusView: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Design.bg
        window.navigationBarColor = Design.bg
        session = Session(this)
        api = Api(session)
        buildUi()
        load()
    }

    private fun buildUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Design.bg)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT)
            // เผื่อ status bar บน + nav bar ล่าง ให้ทั้งหน้า
            with(Design) { applyBarInsets(0, 0, 0, 0) }
        }

        // แถบหัว
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(10), dp(12), dp(18), dp(14))
        }
        val back = ImageView(this).apply {
            setImageResource(R.drawable.ic_arrow_back)
            imageTintList = ColorStateList.valueOf(Design.ink)
            val p = dp(9); setPadding(p, p, p, p)
            layoutParams = LinearLayout.LayoutParams(dp(40), dp(40))
            isClickable = true
            setOnClickListener { finish() }
        }
        bar.addView(back)
        bar.addView(text(getString(R.string.history_title), 19f, Design.ink, Design.faceBold).apply {
            setPadding(dp(6), 0, 0, 0)
        })
        root.addView(bar)

        statusView = text(getString(R.string.history_loading), 14f, Design.inkDim, gravity = Gravity.CENTER).apply {
            setPadding(0, dp(40), 0, 0)
        }
        listCol = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }

        val scroll = ScrollView(this).apply {
            isFillViewport = true
            addView(LinearLayout(this@HistoryActivity).apply {
                orientation = LinearLayout.VERTICAL
                addView(statusView)
                addView(listCol)
            })
        }
        root.addView(scroll, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        setContentView(root)
    }

    private fun load() {
        lifecycleScope.launch {
            try {
                val calls = api.history()
                statusView.visibility = View.GONE
                if (calls.isEmpty()) {
                    statusView.visibility = View.VISIBLE
                    statusView.text = getString(R.string.history_empty)
                    return@launch
                }
                render(calls)
            } catch (e: Exception) {
                statusView.text = getString(R.string.error_network)
            }
        }
    }

    private fun render(calls: List<CallRecord>) {
        listCol.removeAllViews()
        var lastDay = ""
        for (c in calls) {
            val day = dayLabel(c.at)
            if (day != lastDay) {
                lastDay = day
                listCol.addView(text(day, 11f, Design.inkFaint, Design.faceMedium).apply {
                    letterSpacing = 0.06f
                    setPadding(dp(22), dp(16), dp(22), dp(6))
                })
            }
            listCol.addView(row(c))
        }
    }

    private fun row(c: CallRecord): View {
        val r = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(22), dp(12), dp(22), dp(12))
        }
        val color = avatarColor(c.customerName, c.missed)
        val avatar = TextView(this).apply {
            text = c.customerName.trim().firstOrNull()?.toString() ?: "?"
            setTextColor(if (c.missed) Design.danger else 0xFFF2F7F7.toInt())
            textSize = 16f
            typeface = Design.faceBold
            gravity = Gravity.CENTER
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(color) }
            layoutParams = LinearLayout.LayoutParams(dp(42), dp(42))
        }
        val mid = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(13), 0, dp(10), 0)
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            // กดชื่อ/แถว → เปิดรายละเอียดลูกค้า (เฉพาะสายที่รู้ว่าเป็นลูกค้าคนไหน)
            if (c.customerId > 0) {
                isClickable = true
                setOnClickListener {
                    startActivity(android.content.Intent(this@HistoryActivity, CustomerDetailActivity::class.java)
                        .putExtra(CustomerDetailActivity.EXTRA_CUSTOMER_ID, c.customerId))
                }
            }
        }
        mid.addView(text(c.customerName, 15f, Design.ink, Design.faceMedium))
        mid.addView(text(metaLine(c), 12.5f, if (c.missed) Design.danger else Design.inkDim).apply {
            setPadding(0, dp(3), 0, 0)
        })

        val callback = ImageView(this).apply {
            setImageResource(R.drawable.ic_call)
            imageTintList = ColorStateList.valueOf(Design.accent)
            val p = dp(10); setPadding(p, p, p, p)
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setStroke(dp(2), Design.accent)
            }
            layoutParams = LinearLayout.LayoutParams(dp(42), dp(42))
            isClickable = true
            setOnClickListener { callBack(c) }
        }

        r.addView(avatar)
        r.addView(mid)
        if (c.customerId > 0) r.addView(callback)

        val wrap = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        wrap.addView(r)
        wrap.addView(View(this).apply {
            setBackgroundColor(Design.line)
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1))
                .apply { marginStart = dp(22); marginEnd = dp(22) }
        })
        return wrap
    }

    private fun callBack(c: CallRecord) {
        // ถามยืนยันก่อนเสมอ กันกดปุ่มโทรลั่นในหน้าประวัติ
        showCallConfirm(c.customerId, c.customerName) {
            Toast.makeText(this, getString(R.string.calling_back), Toast.LENGTH_SHORT).show()
            lifecycleScope.launch {
                runCatching { api.dialCustomer(c.customerId) }
                finish() // กลับหน้าหลัก แล้วเครื่องจะกดออกเองภายในไม่กี่วินาที จอสายจะเด้ง
            }
        }
    }

    // ── formatting ────────────────────────────────────────────────────────────────────────────

    private fun metaLine(c: CallRecord): String {
        if (c.missed) return "${getString(R.string.call_missed)} · ${timeOf(c.at)}"
        val dir = if (c.direction == "inbound") getString(R.string.call_in) else getString(R.string.call_out)
        val dur = if (c.durationSec > 0) " · คุย ${mmss(c.durationSec)}" else ""
        return "$dir$dur · ${timeOf(c.at)}"
    }

    private fun mmss(sec: Int) = String.format("%d:%02d", sec / 60, sec % 60)

    /** "2026-08-30 17:26:57" → "17:26" */
    private fun timeOf(at: String): String =
        at.substringAfter(' ', "").take(5).ifBlank { at }

    private fun dayLabel(at: String): String {
        val date = at.substringBefore(' ')
        val today = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date())
        val cal = java.util.Calendar.getInstance().apply { add(java.util.Calendar.DAY_OF_YEAR, -1) }
        val yest = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(cal.time)
        return when (date) {
            today -> getString(R.string.day_today)
            yest -> getString(R.string.day_yesterday)
            else -> date
        }
    }

    private fun avatarColor(name: String, missed: Boolean): Int {
        if (missed) return 0xFF3A1C1A.toInt()
        val palette = intArrayOf(
            0xFF2F9E6E.toInt(), 0xFF3A6FB0.toInt(), 0xFF7A5AA8.toInt(),
            0xFFB0793A.toInt(), 0xFF2E8C93.toInt(), 0xFFA84E7A.toInt())
        val h = name.fold(0) { a, ch -> a + ch.code }
        return palette[Math.floorMod(h, palette.size)]
    }
}
