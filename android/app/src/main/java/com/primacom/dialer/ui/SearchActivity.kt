package com.primacom.dialer.ui

import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.primacom.dialer.R
import com.primacom.dialer.data.Api
import com.primacom.dialer.data.SearchResult
import com.primacom.dialer.data.Session
import com.primacom.dialer.ui.Design.applyBarInsets
import com.primacom.dialer.ui.Design.dp
import com.primacom.dialer.ui.Design.text
import kotlinx.coroutines.launch

/**
 * ค้นหาลูกค้าด้วยชื่อหรือรหัส — ไม่มีเบอร์ ไม่รับค้นด้วยเบอร์
 *
 * แตะผลลัพธ์ → หน้ารายละเอียดลูกค้า (โทรต่อจากที่นั่นผ่านแผงยืนยัน)
 */
class SearchActivity : AppCompatActivity() {

    private lateinit var session: Session
    private lateinit var api: Api
    private lateinit var input: EditText
    private lateinit var listCol: LinearLayout
    private lateinit var statusView: TextView

    private val debounce = Handler(Looper.getMainLooper())
    private var queryToken = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Design.bg
        window.navigationBarColor = Design.bg
        session = Session(this)
        api = Api(session)
        buildUi()
    }

    private fun buildUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Design.bg)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT)
            applyBarInsets(0, 0, 0, 0)
        }

        // แถวค้นหา: ช่อง pill + ยกเลิก
        val searchRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(20), dp(14), dp(20), 0)
        }
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            background = Design.roundedStroke(Design.surfaceHi, Design.line, dp(1), dp(999).toFloat())
            setPadding(dp(15), dp(4), dp(15), dp(4))
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        box.addView(ImageView(this).apply {
            setImageResource(R.drawable.ic_search)
            imageTintList = android.content.res.ColorStateList.valueOf(Design.inkDim)
            layoutParams = LinearLayout.LayoutParams(dp(19), dp(19))
        })
        input = EditText(this).apply {
            hint = "ชื่อ หรือ รหัสลูกค้า"
            setHintTextColor(Design.inkFaint); setTextColor(Design.ink); textSize = 15f
            background = null
            setPadding(dp(10), dp(11), dp(10), dp(11))
            maxLines = 1
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
                override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
                override fun afterTextChanged(s: Editable?) = scheduleSearch(s?.toString().orEmpty())
            })
        }
        box.addView(input)
        searchRow.addView(box)
        searchRow.addView(text("ยกเลิก", 14.5f, Design.inkDim).apply {
            setPadding(dp(12), 0, 0, 0); isClickable = true; setOnClickListener { finish() }
        })
        root.addView(searchRow)

        // คำใบ้กติกา
        root.addView(text("ค้นด้วยชื่อหรือรหัสลูกค้า · ระบบไม่รับค้นด้วยเบอร์โทร", 11.5f, Design.inkFaint)
            .apply { setPadding(dp(22), dp(10), dp(22), 0) })

        statusView = text("", 14f, Design.inkDim, gravity = Gravity.CENTER).apply { setPadding(0, dp(40), 0, 0) }
        listCol = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(0, dp(14), 0, 0) }
        val scroll = ScrollView(this).apply {
            isFillViewport = true
            addView(LinearLayout(this@SearchActivity).apply {
                orientation = LinearLayout.VERTICAL; addView(statusView); addView(listCol)
            })
        }
        root.addView(scroll, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        setContentView(root)
        input.requestFocus()
    }

    private fun scheduleSearch(q: String) {
        debounce.removeCallbacksAndMessages(null)
        val trimmed = q.trim()
        if (trimmed.isEmpty()) {
            listCol.removeAllViews(); statusView.visibility = View.GONE
            return
        }
        debounce.postDelayed({ runSearch(trimmed) }, 280)
    }

    private fun runSearch(q: String) {
        val token = ++queryToken
        statusView.visibility = View.VISIBLE
        statusView.text = getString(R.string.history_loading)
        lifecycleScope.launch {
            val results = runCatching { api.search(q) }.getOrNull()
            if (token != queryToken) return@launch      // มีคำค้นใหม่แซงแล้ว ทิ้งผลเก่า
            if (results == null) { statusView.text = getString(R.string.error_network); return@launch }
            listCol.removeAllViews()
            if (results.isEmpty()) {
                statusView.visibility = View.VISIBLE
                statusView.text = "ไม่พบลูกค้า"
                return@launch
            }
            statusView.visibility = View.GONE
            listCol.addView(text("ผลการค้นหา · ${results.size} ราย", 11f, Design.inkFaint, Design.faceMedium).apply {
                letterSpacing = 0.1f; setPadding(dp(20), 0, dp(20), dp(8))
            })
            results.forEach { listCol.addView(resultRow(it)) }
        }
    }

    private fun resultRow(r: SearchResult): View {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(20), dp(12), dp(20), dp(12)); isClickable = true
            setOnClickListener {
                startActivity(android.content.Intent(this@SearchActivity, CustomerDetailActivity::class.java)
                    .putExtra(CustomerDetailActivity.EXTRA_CUSTOMER_ID, r.customerId))
            }
        }
        row.addView(TextView(this).apply {
            text = r.name.trim().firstOrNull()?.toString() ?: "?"
            setTextColor(Design.ink2); textSize = 16f; typeface = Design.faceBold; gravity = Gravity.CENTER
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(Design.avatarNeutral) }
            layoutParams = LinearLayout.LayoutParams(dp(40), dp(40))
        })
        val mid = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(13), 0, dp(10), 0)
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        mid.addView(text(r.name, 15f, Design.ink2, Design.faceMedium))
        val meta = listOfNotNull("#${r.customerId}", r.province, r.grade?.let { "เกรด $it" }).joinToString(" · ")
        mid.addView(text(meta, 11.5f, Design.inkDim).apply { setPadding(0, dp(2), 0, 0) })
        row.addView(mid)
        r.basket?.let {
            row.addView(text(it, 11f, Design.warning, Design.faceBold).apply {
                background = Design.roundedFill(0x21E0A93B, dp(999).toFloat())
                setPadding(dp(10), dp(5), dp(10), dp(5))
            })
        }
        return row
    }
}
