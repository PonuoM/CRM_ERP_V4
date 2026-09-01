package com.primacom.dialer.ui

import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.primacom.dialer.data.Api
import com.primacom.dialer.data.DailySummary
import com.primacom.dialer.data.Session
import com.primacom.dialer.ui.Design.applyBarInsets
import com.primacom.dialer.ui.Design.dp
import com.primacom.dialer.ui.Design.primaryButton
import com.primacom.dialer.ui.Design.text
import kotlinx.coroutines.launch
import java.util.Calendar

/**
 * สรุปผลงานสิ้นวัน — ตัวเลขวันนี้ + เทียบเมื่อวาน + ช่วงที่คุยติดที่สุด (จอ 15)
 *
 * เปิดจากแท็บ "ฉัน" (ยังไม่มี trigger ปิดกะฝั่ง server จึงเป็นเปิดเองไปก่อน)
 */
class EndOfDayActivity : AppCompatActivity() {

    private lateinit var api: Api
    private lateinit var content: LinearLayout
    private lateinit var statusView: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Design.bg
        window.navigationBarColor = Design.bg
        api = Api(Session(this))
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Design.bg)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT)
            applyBarInsets(0, 0, 0, 0)
        }
        content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(20), dp(22), dp(20), dp(24))
        }
        statusView = text(getString(com.primacom.dialer.R.string.history_loading), 14f, Design.inkDim, gravity = Gravity.CENTER)
            .apply { setPadding(0, dp(60), 0, 0) }
        val scroll = ScrollView(this).apply {
            isFillViewport = true
            addView(LinearLayout(this@EndOfDayActivity).apply {
                orientation = LinearLayout.VERTICAL; addView(statusView); addView(content)
            })
        }
        root.addView(scroll)
        setContentView(root)
        load()
    }

    private fun load() {
        lifecycleScope.launch {
            val s = runCatching { api.dailySummary() }.getOrNull()
            if (s == null) { statusView.text = getString(com.primacom.dialer.R.string.error_network); return@launch }
            statusView.visibility = View.GONE
            render(s)
        }
    }

    private fun render(s: DailySummary) {
        content.removeAllViews()

        content.addView(text(thaiDate(), 10.5f, Design.inkFaint, Design.faceMono).apply { letterSpacing = 0.16f })
        content.addView(text("จบวันแล้ว\nวันนี้ทำได้ดี", 30f, Design.ink, Design.faceBold).apply {
            setPadding(0, dp(12), 0, 0); setLineSpacing(dp(4).toFloat(), 1f)
        })

        // การ์ดฮีโร่ (ไล่เฉดเขียว)
        val hero = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(Design.accentSoftBg, Design.surface)
            ).apply { cornerRadius = dp(28).toFloat(); setStroke(dp(1), Design.accentSoftLine) }
            setPadding(dp(20), dp(20), dp(20), dp(20))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                .apply { topMargin = dp(22) }
        }
        val heroTop = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.BOTTOM }
        heroTop.addView(text(s.calls.toString(), 52f, Design.ink, Design.faceMono))
        heroTop.addView(text("สาย", 14f, Design.accentText).apply { setPadding(dp(10), 0, 0, dp(8)) })
        heroTop.addView(View(this).apply {}, LinearLayout.LayoutParams(0, 1, 1f))
        val diff = s.calls - s.yesterdayCalls
        val diffText = when {
            diff > 0 -> "+$diff จากเมื่อวาน"
            diff < 0 -> "$diff จากเมื่อวาน"
            else -> "เท่าเมื่อวาน"
        }
        heroTop.addView(text(diffText, 12f, Design.accentText, Design.faceBold).apply {
            background = Design.roundedFill(Design.accentSoftBg, dp(999).toFloat())
            setPadding(dp(12), dp(6), dp(12), dp(6))
        })
        hero.addView(heroTop)
        val heroCols = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setPadding(0, dp(20), 0, 0) }
        heroCols.addView(heroStat(mmss(s.talkSec, true), "เวลาคุยรวม", Design.ink))
        heroCols.addView(heroStat(mmss(s.avgSec, false), "เฉลี่ยต่อสาย", Design.ink))
        heroCols.addView(heroStat(s.sold.toString(), "ขายได้", Design.accentText))
        hero.addView(heroCols)
        content.addView(hero)

        // ผลการโทรวันนี้ (4 แท่ง)
        content.addView(sectionLabel("ผลการโทรวันนี้"))
        val denom = s.calls.coerceAtLeast(1)
        content.addView(resultBar("ได้คุย", s.talked, denom, Design.accent))
        content.addView(resultBar("ไม่รับสาย", s.missed, denom, Design.danger))
        content.addView(resultBar("ขายได้", s.sold, denom, Design.accentText))
        content.addView(resultBar("นัดหมายใหม่", s.appointments, denom, Design.warning))

        // ช่วงที่คุยติดที่สุด (bar chart รายชั่วโมง)
        content.addView(sectionLabel("ช่วงที่คุยติดที่สุด"))
        content.addView(hourlyChart(s))

        // ปุ่มปิด
        content.addView(View(this).apply { layoutParams = LinearLayout.LayoutParams(1, dp(22)) })
        content.addView(primaryButton("ปิดงานวันนี้").apply { setOnClickListener { finish() } },
            LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        content.addView(text("ดูสรุปนี้ได้อีกจากแท็บ ฉัน", 11.5f, Design.inkFaint, gravity = Gravity.CENTER)
            .apply { setPadding(0, dp(10), 0, 0) })
    }

    private fun heroStat(value: String, label: String, color: Int): LinearLayout =
        LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            addView(text(value, 20f, color, Design.faceMono))
            addView(text(label, 11f, Design.inkDim).apply { setPadding(0, dp(3), 0, 0) })
        }

    private fun resultBar(label: String, value: Int, denom: Int, color: Int): View {
        val wrap = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(0, dp(6), 0, dp(6))
        }
        val top = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        top.addView(text(label, 12.5f, Design.ink3), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        top.addView(text(value.toString(), 12.5f, color, Design.faceMono))
        wrap.addView(top)
        val track = LinearLayout(this).apply {
            background = Design.roundedFill(Design.line, dp(4).toFloat())
            clipToOutline = true; outlineProvider = android.view.ViewOutlineProvider.BACKGROUND
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(7))
                .apply { topMargin = dp(6) }
        }
        val frac = (value.toFloat() / denom).coerceIn(0f, 1f)
        track.addView(View(this).apply {
            setBackgroundColor(color)
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, frac.coerceAtLeast(0.001f))
        })
        track.addView(View(this).apply {
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, (1f - frac).coerceAtLeast(0.001f))
        })
        wrap.addView(track)
        return wrap
    }

    private fun hourlyChart(s: DailySummary): View {
        if (s.hourly.isEmpty()) {
            return text("ยังไม่มีสายวันนี้", 13f, Design.inkFaint).apply {
                background = Design.roundedStroke(Design.surface, Design.line, dp(1), dp(20).toFloat())
                setPadding(dp(16), dp(18), dp(16), dp(18))
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            }
        }
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = Design.roundedStroke(Design.surface, Design.line, dp(1), dp(22).toFloat())
            setPadding(dp(16), dp(16), dp(16), dp(16))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        }
        val bars = s.hourly.takeLast(10)
        val maxN = bars.maxOf { it.count }.coerceAtLeast(1)
        val peak = bars.maxByOrNull { it.count }?.hour
        val chart = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.BOTTOM
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(56))
        }
        bars.forEach { b ->
            val isPeak = b.hour == peak
            val col = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL; gravity = Gravity.BOTTOM
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f)
                    .apply { marginStart = dp(3); marginEnd = dp(3) }
            }
            val hFrac = (b.count.toFloat() / maxN).coerceIn(0.08f, 1f)
            // ดันแท่งลงล่างด้วย spacer ด้านบน
            col.addView(View(this).apply {
                layoutParams = LinearLayout.LayoutParams(1, 0, (1f - hFrac).coerceAtLeast(0.001f))
            })
            col.addView(View(this).apply {
                background = GradientDrawable().apply {
                    setColor(if (isPeak) Design.accent else Design.chartIdle)
                    cornerRadii = floatArrayOf(dp(5).toFloat(), dp(5).toFloat(), dp(5).toFloat(), dp(5).toFloat(), 0f, 0f, 0f, 0f)
                }
                layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, hFrac)
            })
            chart.addView(col)
        }
        box.addView(chart)
        val labels = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setPadding(0, dp(8), 0, 0) }
        bars.forEach { b ->
            labels.addView(text(String.format("%02d", b.hour), 10f,
                if (b.hour == peak) Design.accentText else Design.inkFaint, Design.faceMono, Gravity.CENTER),
                LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        }
        box.addView(labels)
        return box
    }

    private fun sectionLabel(t: String) = text(t, 11f, Design.inkFaint, Design.faceMedium).apply {
        letterSpacing = 0.08f; setPadding(dp(2), dp(22), 0, dp(12))
    }

    /** hh:mm:ss (มีชั่วโมง) หรือ m:ss */
    private fun mmss(sec: Int, withHour: Boolean): String {
        val h = sec / 3600; val m = (sec % 3600) / 60; val s = sec % 60
        return if (withHour && h > 0) String.format("%d:%02d:%02d", h, m, s) else String.format("%d:%02d", sec / 60, s)
    }

    private fun thaiDate(): String {
        val cal = Calendar.getInstance()
        val months = arrayOf("มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
            "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม")
        return "${cal.get(Calendar.DAY_OF_MONTH)} ${months[cal.get(Calendar.MONTH)]} ${cal.get(Calendar.YEAR) + 543}"
    }
}
