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
import com.primacom.dialer.data.Appointment
import com.primacom.dialer.data.Session
import com.primacom.dialer.ui.Design.applyBarInsets
import com.primacom.dialer.ui.Design.dp
import com.primacom.dialer.ui.Design.text
import kotlinx.coroutines.launch
import java.util.Calendar

/**
 * นัดหมายวันนี้เต็มจอ — ลูกค้าที่ต้องโทรวันนี้ + บริบท (พืช/จังหวัด) · โทรผ่านแผงยืนยัน
 */
class AppointmentsActivity : AppCompatActivity() {

    private lateinit var api: Api
    private lateinit var listCol: LinearLayout
    private lateinit var statusView: TextView
    private lateinit var countView: TextView
    private lateinit var banner: LinearLayout
    private val palette = intArrayOf(
        0xFF2F9E6E.toInt(), 0xFF3A6FB0.toInt(), 0xFF7A5AA8.toInt(),
        0xFFB0793A.toInt(), 0xFF2E8C93.toInt(), 0xFFA84E7A.toInt())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Design.bg
        window.navigationBarColor = Design.bg
        api = Api(Session(this))
        buildUi()
        load()
    }

    private fun buildUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Design.bg)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT)
            applyBarInsets(0, 0, 0, 0)
        }
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(10), dp(12), dp(18), dp(8))
        }
        bar.addView(ImageView(this).apply {
            setImageResource(R.drawable.ic_arrow_back)
            imageTintList = ColorStateList.valueOf(Design.ink)
            val p = dp(9); setPadding(p, p, p, p)
            layoutParams = LinearLayout.LayoutParams(dp(40), dp(40)); isClickable = true
            setOnClickListener { finish() }
        })
        bar.addView(text("นัดหมายวันนี้", 18f, Design.ink, Design.faceBold).apply { setPadding(dp(6), 0, 0, 0) },
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        countView = text("", 12f, Design.inkDim, Design.faceMono)
        bar.addView(countView)
        root.addView(bar)

        banner = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            visibility = View.GONE
            background = Design.roundedStroke(0x17E0A93B, 0x3DE0A93B, dp(1), dp(22).toFloat())
            setPadding(dp(15), dp(14), dp(16), dp(14))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                .apply { leftMargin = dp(20); rightMargin = dp(20); topMargin = dp(4) }
        }
        root.addView(banner)

        statusView = text(getString(R.string.history_loading), 14f, Design.inkDim, gravity = Gravity.CENTER)
            .apply { setPadding(0, dp(40), 0, 0) }
        listCol = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(0, dp(14), 0, dp(20)) }
        root.addView(ScrollView(this).apply {
            isFillViewport = true
            addView(LinearLayout(this@AppointmentsActivity).apply {
                orientation = LinearLayout.VERTICAL; addView(statusView); addView(listCol)
            })
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        setContentView(root)
    }

    private fun load() {
        lifecycleScope.launch {
            val list = runCatching { api.appointments() }.getOrNull()
            if (list == null) { statusView.text = getString(R.string.error_network); return@launch }
            countView.text = "${list.size} ราย"
            if (list.isEmpty()) { statusView.text = "วันนี้ยังไม่มีนัดหมาย"; return@launch }
            statusView.visibility = View.GONE
            renderBanner(list)
            listCol.removeAllViews()
            list.forEach { listCol.addView(row(it)) }
        }
    }

    /** แถบเตือน "อีก N นาทีถึงนัดถัดไป" จากนัดที่เวลายังไม่ถึง */
    private fun renderBanner(list: List<Appointment>) {
        val now = Calendar.getInstance()
        val nowMin = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
        val next = list.firstOrNull { minutesOf(it.at) > nowMin } ?: return
        val diff = minutesOf(next.at) - nowMin
        banner.visibility = View.VISIBLE
        banner.removeAllViews()
        banner.addView(ImageView(this).apply {
            setImageResource(R.drawable.ic_history)
            imageTintList = ColorStateList.valueOf(Design.warning)
            val p = dp(8); setPadding(p, p, p, p)
            background = GradientDrawable().apply { cornerRadius = dp(12).toFloat(); setColor(0x2EE0A93B) }
            layoutParams = LinearLayout.LayoutParams(dp(36), dp(36))
        })
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(13), 0, 0, 0)
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        col.addView(text("อีก $diff นาทีถึงนัดถัดไป", 14f, Design.ink2, Design.faceMedium))
        col.addView(text("${next.name} · ${next.at}", 11.5f, Design.inkDim).apply { setPadding(0, dp(2), 0, 0) })
        banner.addView(col)
    }

    private fun row(a: Appointment): View {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            background = Design.roundedStroke(Design.surface, Design.line, dp(1), dp(20).toFloat())
            setPadding(dp(14), dp(13), dp(14), dp(13))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                .apply { leftMargin = dp(20); rightMargin = dp(20); topMargin = dp(9) }
            isClickable = true
            setOnClickListener {
                startActivity(android.content.Intent(this@AppointmentsActivity, CustomerDetailActivity::class.java)
                    .putExtra(CustomerDetailActivity.EXTRA_CUSTOMER_ID, a.customerId))
            }
        }
        val color = palette[Math.floorMod(a.name.fold(0) { x, ch -> x + ch.code }, palette.size)]
        card.addView(TextView(this).apply {
            text = a.name.trim().firstOrNull()?.toString() ?: "?"
            setTextColor(0xFFF2F7F7.toInt()); textSize = 16f; typeface = Design.faceBold; gravity = Gravity.CENTER
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(color) }
            layoutParams = LinearLayout.LayoutParams(dp(42), dp(42))
        })
        val mid = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(13), 0, dp(8), 0)
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        mid.addView(text(a.name, 15f, Design.ink2, Design.faceMedium))
        val meta = listOfNotNull("#${a.customerId}", a.crop, a.province).joinToString(" · ")
        mid.addView(text(meta, 11.5f, Design.inkDim).apply { setPadding(0, dp(2), 0, 0) })
        card.addView(mid)

        val right = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL }
        if (a.at.isNotBlank()) right.addView(text(a.at, 13f, Design.warning, Design.faceMono, Gravity.CENTER)
            .apply { setPadding(0, 0, 0, dp(6)) })
        right.addView(ImageView(this).apply {
            setImageResource(R.drawable.ic_call)
            imageTintList = ColorStateList.valueOf(Design.accentText)
            val p = dp(9); setPadding(p, p, p, p)
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setStroke(dp(2), 0x80_1E9E63.toInt()) }
            layoutParams = LinearLayout.LayoutParams(dp(38), dp(38)); isClickable = true
            setOnClickListener {
                showCallConfirm(a.customerId, a.name) {
                    Toast.makeText(this@AppointmentsActivity, R.string.calling_back, Toast.LENGTH_SHORT).show()
                    lifecycleScope.launch { runCatching { api.dialCustomer(a.customerId) } }
                }
            }
        })
        card.addView(right)
        return card
    }

    private fun minutesOf(hhmm: String): Int {
        val parts = hhmm.split(":")
        return if (parts.size == 2) (parts[0].toIntOrNull() ?: 0) * 60 + (parts[1].toIntOrNull() ?: 0) else -1
    }
}
