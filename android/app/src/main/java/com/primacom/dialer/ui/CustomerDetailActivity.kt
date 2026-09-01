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
import com.primacom.dialer.data.Session
import com.primacom.dialer.ui.Design.applyBarInsets
import com.primacom.dialer.ui.Design.chip
import com.primacom.dialer.ui.Design.dp
import com.primacom.dialer.ui.Design.primaryButton
import com.primacom.dialer.ui.Design.text
import kotlinx.coroutines.launch
import org.json.JSONObject

/**
 * รายละเอียดลูกค้า — เปิดจากการกดชื่อในประวัติการโทร
 *
 * โชว์ข้อมูลลูกค้า + สถิติ + ประวัติการโทรย่อ ไม่มีเบอร์ · ปุ่มโทรผ่าน customer_id
 */
class CustomerDetailActivity : AppCompatActivity() {

    private lateinit var session: Session
    private lateinit var api: Api
    private var customerId = 0
    private lateinit var content: LinearLayout
    private lateinit var statusView: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Design.bg
        window.navigationBarColor = Design.bg
        session = Session(this)
        api = Api(session)
        customerId = intent.getIntExtra(EXTRA_CUSTOMER_ID, 0)
        buildScaffold()
        load()
    }

    private fun buildScaffold() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Design.bg)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT)
            applyBarInsets(0, 0, 0, 0)
        }
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(10), dp(12), dp(18), dp(8))
        }
        bar.addView(ImageView(this).apply {
            setImageResource(R.drawable.ic_arrow_back)
            imageTintList = ColorStateList.valueOf(Design.ink)
            val p = dp(9); setPadding(p, p, p, p)
            layoutParams = LinearLayout.LayoutParams(dp(40), dp(40))
            isClickable = true
            setOnClickListener { finish() }
        })
        bar.addView(text(getString(R.string.customer_detail_title), 18f, Design.ink, Design.faceBold)
            .apply { setPadding(dp(6), 0, 0, 0) })
        root.addView(bar)

        statusView = text(getString(R.string.history_loading), 14f, Design.inkDim, gravity = Gravity.CENTER)
            .apply { setPadding(0, dp(40), 0, 0) }
        content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(6), dp(20), dp(24))
        }
        val scroll = ScrollView(this).apply {
            isFillViewport = true
            addView(LinearLayout(this@CustomerDetailActivity).apply {
                orientation = LinearLayout.VERTICAL
                addView(statusView); addView(content)
            })
        }
        root.addView(scroll, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        setContentView(root)
    }

    private fun load() {
        lifecycleScope.launch {
            try {
                val res = api.customerDetail(customerId)
                statusView.visibility = View.GONE
                render(res)
            } catch (e: com.primacom.dialer.data.ApiException) {
                statusView.visibility = View.VISIBLE
                statusView.text = e.message
            } catch (e: Exception) {
                // รวมถึงกรณี render พังกลางคัน — อย่าให้เงียบจนเห็นแค่ครึ่งจอ
                statusView.visibility = View.VISIBLE
                statusView.text = getString(R.string.error_network)
            }
        }
    }

    private fun render(res: JSONObject) {
        val c = res.optJSONObject("customer") ?: return
        val name = c.optString("name")

        // หัว
        val head = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL
            setPadding(0, dp(10), 0, dp(2))
        }
        head.addView(TextView(this).apply {
            text = name.trim().firstOrNull()?.toString() ?: "?"
            setTextColor(0xFFF2F7F7.toInt()); textSize = 30f; typeface = Design.faceBold
            gravity = Gravity.CENTER
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(0xFF3A6FB0.toInt()) }
            layoutParams = LinearLayout.LayoutParams(dp(76), dp(76))
        })
        head.addView(text(name, 22f, Design.ink, Design.faceBold, Gravity.CENTER).apply { setPadding(0, dp(14), 0, 0) })

        val chipRow = LinearLayout(this).apply {
            gravity = Gravity.CENTER; setPadding(0, dp(12), 0, 0)
        }
        chipRow.addView(chip("รหัส #${c.optInt("customer_id")}", Design.accent, Design.surfaceHi))
        c.optString("owner").takeIf { it.isNotBlank() && it != "null" }?.let {
            chipRow.addView(chip("ดูแลโดย: $it", Design.inkDim, Design.surface),
                LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                    .apply { marginStart = dp(8) })
        }
        head.addView(chipRow)
        c.optString("basket").takeIf { it.isNotBlank() && it != "null" }?.let {
            head.addView(chip("ถัง: $it", Design.warning, 0xFF2A2415.toInt()),
                LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                    .apply { topMargin = dp(8); gravity = Gravity.CENTER_HORIZONTAL })
        }
        content.addView(head)

        // สถิติ
        val stats = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setPadding(0, dp(20), 0, 0) }
        // margin ตั้งผ่าน layoutParams ของ addView (อาร์กิวเมนต์ที่สอง) เท่านั้น —
        // ห้าม .apply { layoutParams as ... } บน view ก่อน addView เพราะ layoutParams ยัง null → NPE
        stats.addView(statCard("฿" + fmt(c.optDouble("total_purchases")), "ยอดซื้อรวม", Design.positive), statParams())
        stats.addView(statCard(c.optInt("total_calls").toString(), "จำนวนสาย", Design.ink),
            statParams().apply { marginStart = dp(10) })
        c.optString("grade").takeIf { it.isNotBlank() && it != "null" }?.let {
            stats.addView(statCard(it, "เกรด", Design.ink),
                statParams().apply { marginStart = dp(10) })
        }
        content.addView(stats)

        // ข้อมูลลูกค้า
        content.addView(sectionLabel(getString(R.string.customer_info)))
        val info = card()
        info.addView(infoRow("เบอร์โทร", getString(R.string.phone_hidden), faint = true))
        c.optString("province").takeIf { it.isNotBlank() && it != "null" }?.let { info.addView(infoRow("จังหวัด", it)) }
        c.optString("lifecycle").takeIf { it.isNotBlank() && it != "null" }?.let { info.addView(infoRow("สถานะ", it)) }
        val plots = c.optJSONArray("plots")
        // ถ้ามีแปลงเพาะปลูกในโปรไฟล์แล้ว โชว์เป็นรายแปลงด้านล่างแทน แถวพืชเดี่ยวจึงข้าม
        if (plots == null || plots.length() == 0) {
            c.optString("crop").takeIf { it.isNotBlank() && it != "null" }?.let { info.addView(infoRow("พืชที่ปลูก", it)) }
        }
        c.optString("since").takeIf { it.isNotBlank() && it != "null" }?.let { info.addView(infoRow("ลูกค้าตั้งแต่", it.substringBefore(' '))) }
        stripLastDivider(info)
        content.addView(info)

        // แปลงเพาะปลูก (สวนที่บันทึกไว้จริง)
        if (plots != null && plots.length() > 0) {
            content.addView(sectionLabel("แปลงเพาะปลูก"))
            val farm = card()
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
                farm.addView(infoRow(crop, sizeText))
            }
            stripLastDivider(farm)
            content.addView(farm)
        }

        // ประวัติการโทรย่อ
        val calls = res.optJSONArray("calls")
        if (calls != null && calls.length() > 0) {
            content.addView(sectionLabel(getString(R.string.recent_calls)))
            val cc = card().apply { setPadding(dp(15), dp(2), dp(15), dp(2)) }
            for (i in 0 until calls.length()) cc.addView(callRow(calls.getJSONObject(i)))
            stripLastDivider(cc)
            content.addView(cc)
        }

        // ปุ่มโทร
        content.addView(spacer(dp(22)))
        content.addView(primaryButton(getString(R.string.action_call_customer)).apply {
            setOnClickListener {
                Toast.makeText(this@CustomerDetailActivity, R.string.calling_back, Toast.LENGTH_SHORT).show()
                lifecycleScope.launch { runCatching { api.dialCustomer(customerId) }; finish() }
            }
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
    }

    // ── view helpers ─────────────────────────────────────────────────────────────────────────
    private fun statParams() = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
    private fun statCard(value: String, label: String, valueColor: Int): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER
            background = Design.roundedStroke(Design.surface, Design.line, dp(1), dp(14).toFloat())
            setPadding(dp(10), dp(13), dp(10), dp(13))
            addView(text(value, 20f, valueColor, Design.faceMono, Gravity.CENTER))
            addView(text(label, 11f, Design.inkFaint, gravity = Gravity.CENTER).apply { setPadding(0, dp(3), 0, 0) })
        }
    }
    private fun card() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        background = Design.roundedStroke(Design.surface, Design.line, dp(1), dp(14).toFloat())
    }
    private fun sectionLabel(t: String) = text(t, 11f, Design.inkFaint, Design.faceMedium).apply {
        letterSpacing = 0.08f; setPadding(dp(2), dp(22), 0, dp(8))
    }
    private fun infoRow(k: String, v: String, faint: Boolean = false): View {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(15), dp(13), dp(15), dp(13))
        }
        row.addView(text(k, 13.5f, Design.inkDim), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        row.addView(text(v, 14f, if (faint) Design.inkFaint else Design.ink, Design.faceMedium, Gravity.END))
        val wrap = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        wrap.addView(row)
        wrap.addView(dividerLine())
        return wrap
    }
    private fun callRow(o: JSONObject): View {
        val missed = o.optString("status") == "ไม่รับสาย" || o.optString("status").contains("ไม่")
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(11), 0, dp(11))
        }
        row.addView(View(this).apply {
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL
                setColor(if (missed) Design.danger else Design.accent) }
            layoutParams = LinearLayout.LayoutParams(dp(8), dp(8))
        })
        val mid = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(11), 0, dp(8), 0) }
        val result = o.optString("result").takeIf { it.isNotBlank() && it != "null" }
        val status = o.optString("status").takeIf { it.isNotBlank() && it != "null" } ?: "-"
        mid.addView(text(if (result != null) "$status · $result" else status, 13.5f, Design.ink, Design.faceMedium))
        val dur = o.optInt("duration_sec")
        mid.addView(text(if (dur > 0) "คุย ${dur / 60}:${String.format("%02d", dur % 60)}" else "—",
            12f, if (missed) Design.danger else Design.inkDim).apply { setPadding(0, dp(2), 0, 0) })
        row.addView(mid, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        row.addView(text(o.optString("at").substringBefore(' ').takeLast(5), 12f, Design.inkFaint, Design.faceMono))
        val wrap = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        wrap.addView(row); wrap.addView(dividerLine())
        return wrap
    }
    private fun dividerLine() = View(this).apply {
        setBackgroundColor(Design.line)
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1))
        tag = "divider"
    }
    private fun stripLastDivider(container: LinearLayout) {
        val last = container.getChildAt(container.childCount - 1) as? LinearLayout ?: return
        (last.getChildAt(last.childCount - 1))?.let { if (it.tag == "divider") it.visibility = View.GONE }
    }
    private fun spacer(h: Int) = View(this).apply { layoutParams = LinearLayout.LayoutParams(1, h) }
    private fun fmt(v: Double) = if (v >= 1000) String.format("%,.0f", v) else v.toInt().toString()

    companion object {
        const val EXTRA_CUSTOMER_ID = "customer_id"
    }
}
