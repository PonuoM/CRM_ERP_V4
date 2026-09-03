package com.primacom.dialer.ui

import android.app.DatePickerDialog
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.primacom.dialer.R
import com.primacom.dialer.data.Api
import com.primacom.dialer.data.Plot
import com.primacom.dialer.data.ProductOption
import com.primacom.dialer.data.SaleLine
import com.primacom.dialer.data.Session
import com.primacom.dialer.data.TagOption
import com.primacom.dialer.ui.Design.applyBarInsets
import com.primacom.dialer.ui.Design.dp
import com.primacom.dialer.ui.Design.glassPanel
import com.primacom.dialer.ui.Design.ghostButton
import com.primacom.dialer.ui.Design.primaryButton
import com.primacom.dialer.ui.Design.text
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.Calendar

/**
 * บันทึกผลการโทร — เด้งหลังวางสาย (โทรออก=ทุกครั้ง, รับสาย=เฉพาะได้คุย)
 *
 * เขียนลง call_history แถวเดียวกับฝั่งคอม (ผ่าน call/disposition) · ตัวเลือกตรงกับ modal บน PC
 * ระหว่างเปิดฟอร์มจะ poll เช็คว่าคอมบันทึกไปแล้วยัง ถ้าใช่ก็ปิดเอง ไม่ให้กรอกซ้ำ
 */
class DispositionActivity : AppCompatActivity() {

    private lateinit var session: Session
    private lateinit var api: Api

    private var sessionId = 0
    private var customerName = ""
    private var customerId = 0
    private var durationSec = 0
    private var connected = false

    // ค่าที่เลือก
    private var status = ""
    private var result = ""
    private var followUpDate = ""     // yyyy-MM-dd HH:mm
    private var cropName = ""
    private var sizeUnit = "ไร่"
    private var repaintUnit: () -> Unit = {}
    private var saved = false

    private lateinit var statusField: TextView
    private lateinit var resultField: TextView
    private lateinit var apptField: TextView
    private lateinit var cropField: TextView
    private lateinit var sizeInput: EditText
    private lateinit var unitToggle: LinearLayout
    private lateinit var farmHint: LinearLayout
    private lateinit var notesInput: EditText
    private lateinit var saveBtn: TextView
    private lateinit var tagField: TextView
    private var allTags: List<TagOption> = emptyList()
    private val selectedTagIds = linkedSetOf<Int>()

    // ออเดอร์รอเปิด (ขายได้ผ่านมือถือ) — โผล่เมื่อผลการโทร=ขายได้ และเปิดใช้ปิดเบอร์
    private var saleEnabled = false
    private var saleOpenMode = "backoffice"       // "backoffice" = ฝากหลังบ้าน · "self" = เปิดเอง
    private var allProducts: List<ProductOption> = emptyList()
    private val saleItems = mutableListOf<SaleLine>()
    private lateinit var saleBox: LinearLayout
    private lateinit var saleItemsCol: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Design.bg
        window.navigationBarColor = Design.bg
        session = Session(this)
        api = Api(session)

        sessionId = intent.getIntExtra(EXTRA_SESSION_ID, 0)
        customerName = intent.getStringExtra(EXTRA_CUSTOMER_NAME) ?: "ลูกค้า"
        customerId = intent.getIntExtra(EXTRA_CUSTOMER_ID, 0)
        durationSec = intent.getIntExtra(EXTRA_DURATION, 0)
        connected = intent.getBooleanExtra(EXTRA_CONNECTED, false)

        // ปิดการแจ้งเตือน full-screen ที่พามาเปิดหน้านี้
        getSystemService(android.app.NotificationManager::class.java)
            ?.cancel(com.primacom.dialer.call.PrimacomInCallService.DISPO_NOTIFICATION_ID)

        // ค่าเริ่มต้นของสถานะ: ได้คุย ถ้าปลายทางรับ ไม่งั้นไม่รับสาย
        status = if (connected) "ได้คุย" else "ไม่รับสาย"
        result = if (connected) "" else status

        buildUi()
        watchOtherSide()
        loadTags()
        loadFarm()
        loadSaleProducts()
    }

    /** โหลดสินค้า + เช็คว่าเปิดใช้ฟีเจอร์ออเดอร์รอเปิดไหม (ผูกปิดเบอร์) */
    private fun loadSaleProducts() {
        lifecycleScope.launch {
            val res = runCatching { api.products() }.getOrNull()
            saleEnabled = res?.first ?: false
            allProducts = res?.second ?: emptyList()
            updateSaleVisibility()
        }
    }

    private fun updateSaleVisibility() {
        if (!::saleBox.isInitialized) return
        saleBox.visibility = if (saleEnabled && result == "ขายได้") View.VISIBLE else View.GONE
    }

    private fun addSaleItem(p: ProductOption) {
        val existing = saleItems.indexOfFirst { it.productId == p.id }
        if (existing >= 0) {
            val cur = saleItems[existing]
            saleItems[existing] = cur.copy(qty = cur.qty + 1)
        } else {
            saleItems.add(SaleLine(p.id, p.name, 1.0, p.unit))
        }
        renderSaleItems()
    }

    private fun renderSaleItems() {
        saleItemsCol.removeAllViews()
        if (saleItems.isEmpty()) {
            saleItemsCol.addView(text("ยังไม่ได้เลือกสินค้า", 12.5f, Design.inkFaint).apply { setPadding(dp(2), dp(4), 0, dp(4)) })
            return
        }
        saleItems.forEachIndexed { i, item ->
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
                background = glassPanel(dp(12).toFloat())
                setPadding(dp(13), dp(9), dp(10), dp(9))
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                    .apply { topMargin = dp(8) }
            }
            val mid = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }
            mid.addView(text(item.name, 14f, Design.ink2, Design.faceMedium))
            item.unit?.let { mid.addView(text(it, 11.5f, Design.inkDim).apply { setPadding(0, dp(2), 0, 0) }) }
            row.addView(mid)
            // stepper − จำนวน +
            row.addView(stepBtn("−") {
                val cur = saleItems[i]
                if (cur.qty > 1) { saleItems[i] = cur.copy(qty = cur.qty - 1); renderSaleItems() }
                else { saleItems.removeAt(i); renderSaleItems() }
            })
            row.addView(text(fmtQty(item.qty), 15f, Design.ink, Design.faceMono, Gravity.CENTER).apply {
                minWidth = dp(34)
            })
            row.addView(stepBtn("+") {
                val cur = saleItems[i]; saleItems[i] = cur.copy(qty = cur.qty + 1); renderSaleItems()
            })
            saleItemsCol.addView(row)
        }
    }

    private fun stepBtn(sym: String, onClick: () -> Unit): TextView =
        text(sym, 20f, Design.accentText, Design.faceBold, Gravity.CENTER).apply {
            background = glassPanel(dp(10).toFloat())
            val w = dp(34); minWidth = w; setPadding(0, dp(4), 0, dp(6)); isClickable = true
            setOnClickListener { onClick() }
        }

    private fun fmtQty(q: Double) = if (q % 1.0 == 0.0) q.toInt().toString() else q.toString()

    /** โชว์สวนที่ลูกค้าเคยบันทึกไว้ — แตะเพื่อเติมลงช่อง จะได้ไม่กรอกซ้ำ */
    private fun loadFarm() {
        if (customerId <= 0) return
        lifecycleScope.launch {
            val plots = runCatching { api.plots(customerId) }.getOrNull().orEmpty()
            if (plots.isEmpty()) return@launch
            farmHint.removeAllViews()
            farmHint.addView(text("เคยบันทึกสวนไว้ · แตะเพื่อใช้ซ้ำ", 11f, Design.inkFaint, Design.faceMedium).apply {
                letterSpacing = 0.03f; setPadding(dp(2), 0, 0, dp(6))
            })
            val wrap = LinearLayout(this@DispositionActivity).apply {
                orientation = LinearLayout.HORIZONTAL
            }
            plots.take(4).forEach { p -> wrap.addView(farmChip(p)) }
            val hs = android.widget.HorizontalScrollView(this@DispositionActivity).apply {
                isHorizontalScrollBarEnabled = false; addView(wrap)
            }
            farmHint.addView(hs)
            farmHint.visibility = View.VISIBLE
        }
    }

    /** ป้ายสวนเดิม 1 อัน — แตะแล้วเติม พืช+ขนาด+หน่วย ลงในฟอร์ม */
    private fun farmChip(p: Plot): TextView = text("🌿 ${p.label}", 13.5f, Design.accentText, Design.faceMedium).apply {
        background = Design.roundedStroke(Design.accentSoftBg, Design.accentSoftLine, dp(1), dp(20).toFloat())
        setPadding(dp(13), dp(9), dp(13), dp(9))
        isClickable = true
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            .apply { marginEnd = dp(8) }
        setOnClickListener {
            cropName = p.crop
            cropField.text = p.crop
            (cropField as TextView).setTextColor(Design.ink)
            if (p.sizeValue != null) {
                val n = if (p.sizeValue % 1.0 == 0.0) p.sizeValue.toInt().toString() else p.sizeValue.toString()
                sizeInput.setText(n)
            }
            if (!p.sizeUnit.isNullOrBlank() && (p.sizeUnit == "ไร่" || p.sizeUnit == "ต้น")) {
                sizeUnit = p.sizeUnit; repaintUnit()
            }
        }
    }

    /** ดึงรายการ Tag ที่พนักงานติดได้ แล้วเปิดใช้ dropdown */
    private fun loadTags() {
        lifecycleScope.launch {
            val tags = runCatching { api.tags(customerId.takeIf { it > 0 }) }.getOrNull()
            allTags = tags ?: emptyList()
            when {
                tags == null -> { tagField.text = "โหลด Tag ไม่ได้"; tagField.setTextColor(Design.inkFaint) }
                tags.isEmpty() -> { tagField.text = "ยังไม่มี Tag ในระบบ"; tagField.setTextColor(Design.inkFaint) }
                else -> updateTagField()
            }
        }
    }

    /**
     * แสดง Tag ที่จะติดในช่อง เป็นวงกลมสี + ชื่อ (ใช้ ● แบบมีสีราย Tag)
     * รวม Tag ที่ลูกค้ามีอยู่แล้ว (ติดแล้ว) + ที่เลือกใหม่ · ว่าง = คำใบ้ให้แตะ
     */
    private fun updateTagField() {
        val shown = allTags.filter { it.selected || it.id in selectedTagIds }
        if (shown.isEmpty()) {
            tagField.text = "แตะเพื่อเลือก Tag"
            tagField.setTextColor(Design.inkFaint)
            return
        }
        val sb = android.text.SpannableStringBuilder()
        shown.forEachIndexed { i, tag ->
            if (i > 0) sb.append("   ")
            val start = sb.length
            sb.append("●")
            val c = runCatching { android.graphics.Color.parseColor(tag.color) }.getOrDefault(Design.accent)
            sb.setSpan(android.text.style.ForegroundColorSpan(c), start, sb.length,
                android.text.Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)
            sb.append(" ").append(tag.name)
        }
        tagField.text = sb
        tagField.setTextColor(Design.ink)
    }

    private fun buildUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Design.scrim)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT)
            applyBarInsets(0, 0, 0, 0)
        }

        // ช่องว่างบน (ฉากมืด) แตะเพื่อปิด — ให้ดูเป็นแผ่นเลื่อนขึ้นทับ
        root.addView(View(this).apply {
            isClickable = true; setOnClickListener { finish() }
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(40))
        })

        // แผ่น sheet (มุมบนโค้ง)
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable().apply {
                setColor(Design.sheet)
                cornerRadii = floatArrayOf(
                    dp(32).toFloat(), dp(32).toFloat(), dp(32).toFloat(), dp(32).toFloat(), 0f, 0f, 0f, 0f)
            }
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f)
        }
        panel.addView(View(this).apply {
            background = Design.roundedFill(Design.handle, dp(2).toFloat())
            layoutParams = LinearLayout.LayoutParams(dp(44), dp(4)).apply {
                topMargin = dp(11); gravity = Gravity.CENTER_HORIZONTAL
            }
        })

        // แถบหัว: ทีหลัง | บันทึกการโทร | mm:ss
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(20), dp(12), dp(20), dp(8))
        }
        bar.addView(text("ทีหลัง", 14f, Design.inkDim).apply {
            isClickable = true; setOnClickListener { finish() }
        })
        bar.addView(text(getString(R.string.disposition_title), 17f, Design.ink, Design.faceBold, Gravity.CENTER),
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        bar.addView(text(mmss(durationSec), 14f, Design.accentText, Design.faceMono))
        panel.addView(bar)

        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(6), dp(20), dp(20))
        }

        // การ์ดสรุปสาย (โทนเขียวจาง)
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = Design.roundedStroke(Design.accentSoftBg, Design.accentSoftLine, dp(1), dp(18).toFloat())
            setPadding(dp(15), dp(13), dp(15), dp(13))
        }
        val cardTop = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        cardTop.addView(text(customerName, 15.5f, Design.ink, Design.faceBold),
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        cardTop.addView(text((if (connected) "คุย " else "") + mmss(durationSec), 13f,
            if (connected) Design.accentText else Design.inkDim, Design.faceMono))
        card.addView(cardTop)
        if (customerId > 0) card.addView(text("#$customerId", 12f, Design.inkDim).apply { setPadding(0, dp(3), 0, 0) })
        content.addView(card)

        // แถบซิงก์ (บรรทัดจาง ใต้การ์ด)
        content.addView(text(getString(R.string.disposition_sync_hint), 11.5f, Design.inkFaint).apply {
            setPadding(dp(2), dp(10), dp(2), 0)
            (this as TextView).setLineSpacing(dp(2).toFloat(), 1f)
        })

        // สถานะการโทร (wheel)
        content.addView(fieldLabel("สถานะการโทร"))
        statusField = selectField(status) {
            showWheelPicker("สถานะการโทร", CALL_STATUS, CALL_STATUS.indexOf(status).coerceAtLeast(0)) { i ->
                status = CALL_STATUS[i]; statusField.text = status
                // ตามตรรกะ PC: ถ้าเป็นสถานะที่ไม่ได้คุย ผลการโทร = สถานะนั้น
                if (status !in CONVERSATION_STATUSES) { result = status; resultField.text = result }
                updateSaleVisibility()
            }
        }
        content.addView(statusField)

        // ผลการโทร (wheel — ตัวเลือกขึ้นกับว่าได้คุยไหม)
        content.addView(fieldLabel("ผลการโทร"))
        resultField = selectField(result.ifBlank { "เลือกผลการโทร" }, result.isBlank()) {
            val opts = if (status in CONVERSATION_STATUSES) RESULT_TALKED else RESULT_NOT_TALKED
            showWheelPicker("ผลการโทร", opts, opts.indexOf(result).coerceAtLeast(0)) { i ->
                result = opts[i]; resultField.text = result
                (resultField as TextView).setTextColor(Design.ink)
                updateSaleVisibility()
            }
        }
        content.addView(resultField)

        // สินค้าที่ขาย (ออเดอร์รอเปิด) — โผล่เมื่อผลการโทร=ขายได้ + เปิดใช้ปิดเบอร์
        saleBox = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; visibility = View.GONE
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        }
        saleBox.addView(fieldLabel("สินค้าที่ขาย · ใครเปิดบิล?"))
        saleBox.addView(buildOpenModeToggle())
        saleItemsCol = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(0, dp(12), 0, 0)
        }
        saleBox.addView(saleItemsCol)
        saleBox.addView(ghostButton("+ เพิ่มสินค้า", Design.accentText).apply {
            setOnClickListener {
                if (allProducts.isEmpty()) {
                    Toast.makeText(this@DispositionActivity, "ยังไม่มีสินค้าให้เลือก", Toast.LENGTH_SHORT).show()
                } else showProductPicker(allProducts) { p -> addSaleItem(p) }
            }
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            .apply { topMargin = dp(10) })
        content.addView(saleBox)
        renderSaleItems()

        // นัดหมายครั้งถัดไป
        content.addView(fieldLabel("นัดหมายครั้งถัดไป"))
        apptField = selectField("ไม่นัดหมาย", true) { pickDate() }
        content.addView(apptField)

        // ข้อมูลสวน (พืช + ขนาด + หน่วย)
        content.addView(fieldLabel("ข้อมูลสวน (ถ้ามี)"))
        // สวนที่เคยบันทึกไว้ — โผล่เมื่อโหลดเสร็จ แตะแล้วเติมลงช่องอัตโนมัติ กันกรอกซ้ำ
        farmHint = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            visibility = View.GONE
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                .apply { bottomMargin = dp(10) }
        }
        content.addView(farmHint)
        cropField = selectField("เลือกชนิดพืช", true) {
            showWheelPicker("เลือกชนิดพืช", CROPS, CROPS.indexOf(cropName).coerceAtLeast(0)) { i ->
                cropName = CROPS[i]; cropField.text = cropName
                (cropField as TextView).setTextColor(Design.ink)
            }
        }
        content.addView(cropField)
        val sizeRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, dp(10), 0, 0)
        }
        sizeInput = EditText(this).apply {
            hint = "ขนาด"; setHintTextColor(Design.inkFaint); setTextColor(Design.ink); textSize = 15f
            inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL
            background = glassPanel(dp(12).toFloat())
            setPadding(dp(14), dp(12), dp(14), dp(12))
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        sizeRow.addView(sizeInput)
        unitToggle = buildUnitToggle()
        sizeRow.addView(unitToggle, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.MATCH_PARENT)
            .apply { marginStart = dp(10) })
        content.addView(sizeRow)

        // หมายเหตุ
        content.addView(fieldLabel("หมายเหตุ"))
        notesInput = EditText(this).apply {
            hint = "รายละเอียดเพิ่มเติม…"; setHintTextColor(Design.inkFaint); setTextColor(Design.ink); textSize = 15f
            gravity = Gravity.TOP; minLines = 2
            background = glassPanel(dp(12).toFloat())
            setPadding(dp(14), dp(12), dp(14), dp(12))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        }
        content.addView(notesInput)

        // Tag ลูกค้า — dropdown เปิดรายการที่มีวงกลมสีนำหน้า (เลือกได้หลายอัน เพิ่มอย่างเดียว)
        content.addView(fieldLabel("Tag ลูกค้า"))
        tagField = selectField("กำลังโหลด Tag…", true) {
            if (allTags.isEmpty()) return@selectField
            showTagPicker(allTags, selectedTagIds) { updateTagField() }
        }
        content.addView(tagField)

        val scroll = ScrollView(this).apply { isFillViewport = true; addView(content) }
        panel.addView(scroll, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))

        // แถบบันทึกติดล่าง (เส้นคั่นบน + คำอธิบาย + ปุ่ม)
        panel.addView(View(this).apply {
            setBackgroundColor(Design.line)
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1))
        })
        val saveBar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(20), dp(12), dp(20), dp(16))
        }
        saveBar.addView(text("บันทึกแล้วเครื่องจะรับงานถัดไปอัตโนมัติ", 11.5f, Design.inkFaint).apply {
            (this as TextView).setLineSpacing(dp(2).toFloat(), 1f)
        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        saveBtn = primaryButton(getString(R.string.action_save_call)).apply {
            setOnClickListener { save() }
        }
        saveBar.addView(saveBtn, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            .apply { marginStart = dp(12) })
        panel.addView(saveBar)

        root.addView(panel)
        setContentView(root)
    }

    /** เลือกว่าใครเปิดบิล: ฝากหลังบ้าน (เข้าคิว backoffice) หรือ เปิดเองพรุ่งนี้ */
    private fun buildOpenModeToggle(): LinearLayout {
        val toggle = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            background = Design.roundedFill(Design.surfaceHi, dp(12).toFloat())
            setPadding(dp(4), dp(4), dp(4), dp(4))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        }
        fun seg(label: String): TextView = text(label, 13.5f, Design.inkDim, Design.faceMedium, Gravity.CENTER).apply {
            setPadding(dp(10), dp(11), dp(10), dp(11)); isClickable = true
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        val back = seg("ฝากหลังบ้านเปิด"); val self = seg("เปิดเองพรุ่งนี้")
        fun paint() {
            back.background = if (saleOpenMode == "backoffice") Design.roundedFill(Design.accent, dp(9).toFloat()) else null
            back.setTextColor(if (saleOpenMode == "backoffice") Design.onAccent else Design.inkDim)
            self.background = if (saleOpenMode == "self") Design.roundedFill(Design.accent, dp(9).toFloat()) else null
            self.setTextColor(if (saleOpenMode == "self") Design.onAccent else Design.inkDim)
        }
        back.setOnClickListener { saleOpenMode = "backoffice"; paint() }
        self.setOnClickListener { saleOpenMode = "self"; paint() }
        paint()
        toggle.addView(back); toggle.addView(self)
        return toggle
    }

    private fun buildUnitToggle(): LinearLayout {
        val toggle = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            background = glassPanel(dp(12).toFloat())
        }
        fun seg(label: String): TextView = text(label, 14.5f, Design.inkDim, Design.faceMedium, Gravity.CENTER).apply {
            setPadding(dp(16), dp(12), dp(16), dp(12)); isClickable = true
        }
        val rai = seg("ไร่"); val ton = seg("ต้น")
        fun paint() {
            rai.background = if (sizeUnit == "ไร่") Design.roundedFill(Design.accent, dp(11).toFloat()) else null
            rai.setTextColor(if (sizeUnit == "ไร่") Design.onAccent else Design.inkDim)
            ton.background = if (sizeUnit == "ต้น") Design.roundedFill(Design.accent, dp(11).toFloat()) else null
            ton.setTextColor(if (sizeUnit == "ต้น") Design.onAccent else Design.inkDim)
        }
        rai.setOnClickListener { sizeUnit = "ไร่"; paint() }
        ton.setOnClickListener { sizeUnit = "ต้น"; paint() }
        repaintUnit = ::paint
        paint()
        toggle.addView(rai); toggle.addView(ton)
        return toggle
    }

    private fun pickDate() {
        val cal = Calendar.getInstance()
        DatePickerDialog(this, { _, y, m, d ->
            val picked = Calendar.getInstance().apply { set(y, m, d, 10, 0, 0) }
            followUpDate = String.format("%04d-%02d-%02d 10:00", y, m + 1, d)
            apptField.text = String.format("%02d/%02d/%d · 10:00", d, m + 1, y + 543)
            (apptField as TextView).setTextColor(Design.ink)
        }, cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH)).apply {
            datePicker.minDate = System.currentTimeMillis() - 1000
            // นัดได้ไม่เกิน 30 วัน (ตามกติกา PC)
            datePicker.maxDate = System.currentTimeMillis() + 30L * 24 * 3600 * 1000
        }.show()
    }

    private fun save() {
        if (result.isBlank()) {
            Toast.makeText(this, R.string.disposition_need_result, Toast.LENGTH_SHORT).show()
            return
        }
        saveBtn.isEnabled = false; saveBtn.alpha = 0.6f
        val areaSize = sizeInput.text.toString().trim().takeIf { it.isNotEmpty() }?.let { "$it $sizeUnit" }
        lifecycleScope.launch {
            try {
                api.saveDisposition(
                    sessionId = sessionId, status = status, result = result,
                    durationSec = durationSec, cropType = cropName.ifBlank { null },
                    areaSize = areaSize, notes = notesInput.text.toString().trim().ifBlank { null },
                    followUpDate = followUpDate.ifBlank { null },
                    tagIds = selectedTagIds.toList(),
                )
                // ขายได้ + เลือกสินค้าไว้ → บันทึกเป็น "ออเดอร์รอเปิด"
                var madePending = false
                if (result == "ขายได้" && saleItems.isNotEmpty()) {
                    madePending = runCatching {
                        api.createPendingOrder(
                            sessionId, customerId,
                            notesInput.text.toString().trim().ifBlank { null },
                            saleItems.toList(), saleOpenMode,
                        )
                    }.isSuccess
                }
                saved = true
                Toast.makeText(this@DispositionActivity, R.string.disposition_saved, Toast.LENGTH_SHORT).show()
                // ฝากหลังบ้าน → เปิดจอสรุปให้แคป/แชร์ไปแจ้งไลน์ประสานงาน
                if (madePending && saleOpenMode == "backoffice") {
                    startActivity(android.content.Intent(this@DispositionActivity, SaleSummaryActivity::class.java)
                        .putExtra(SaleSummaryActivity.EXTRA_CUSTOMER, customerName)
                        .putExtra(SaleSummaryActivity.EXTRA_AGENT, session.agentName ?: "")
                        .putExtra(SaleSummaryActivity.EXTRA_NOTE, notesInput.text.toString().trim())
                        .putExtra(SaleSummaryActivity.EXTRA_ITEMS,
                            saleItems.joinToString("\n") { "${it.name} ×${if (it.qty % 1.0 == 0.0) it.qty.toInt() else it.qty}${it.unit?.let { u -> " $u" } ?: ""}" }))
                }
                finish()
            } catch (e: Exception) {
                Toast.makeText(this@DispositionActivity, e.message ?: getString(R.string.error_network), Toast.LENGTH_LONG).show()
                saveBtn.isEnabled = true; saveBtn.alpha = 1f
            }
        }
    }

    /** ระหว่างเปิดฟอร์ม เช็คว่าฝั่งคอมบันทึกไปแล้วยัง ถ้าใช่ก็ปิดเอง */
    private fun watchOtherSide() {
        if (sessionId <= 0) return
        lifecycleScope.launch {
            while (isActive && !saved) {
                delay(4000)
                val done = runCatching { api.dispositionDone(sessionId) }.getOrDefault(false)
                if (done && !saved) {
                    Toast.makeText(this@DispositionActivity, R.string.disposition_done_elsewhere, Toast.LENGTH_SHORT).show()
                    finish(); break
                }
            }
        }
    }

    private fun fieldLabel(t: String) = text(t, 11f, Design.inkFaint, Design.faceMedium).apply {
        letterSpacing = 0.05f; setPadding(dp(2), dp(18), 0, dp(8))
    }

    private fun selectField(value: String, empty: Boolean = false, onClick: () -> Unit): TextView =
        text(value, 15f, if (empty) Design.inkFaint else Design.ink).apply {
            background = glassPanel(dp(12).toFloat())
            setPadding(dp(14), dp(13), dp(14), dp(13))
            isClickable = true
            setOnClickListener { onClick() }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        }

    private fun mmss(sec: Int) = String.format("%02d:%02d", sec / 60, sec % 60)

    companion object {
        const val EXTRA_SESSION_ID = "session_id"
        const val EXTRA_CUSTOMER_NAME = "customer_name"
        const val EXTRA_CUSTOMER_ID = "customer_id"
        const val EXTRA_DURATION = "duration"
        const val EXTRA_CONNECTED = "connected"

        // ตัวเลือกตรงกับ LogCallModal บน PC เป๊ะ (เขียน call_history ตารางเดียวกัน)
        val CALL_STATUS = listOf("รับสาย", "ได้คุย", "ไม่รับสาย", "สายไม่ว่าง", "ติดสายซ้อน", "ไม่มีสัญญาณ", "ตัดสายทิ้ง")
        val CONVERSATION_STATUSES = setOf("รับสาย", "ได้คุย")
        val RESULT_TALKED = listOf(
            "สินค้ายังไม่หมด", "ใช้แล้วไม่เห็นผล", "ยังไม่ได้ลองใช้", "ยังไม่ถึงรอบใช้งาน",
            "สั่งช่องทางอื่นแล้ว", "ไม่สะดวกคุย", "ติดสายซ้อน", "ฝากส่งไม่ได้ใช้เอง",
            "คนอื่นรับสายแทน", "เลิกทำสวน", "ไม่สนใจ", "ห้ามติดต่อ", "ได้คุย", "ขายได้", "ตัดสายทิ้ง")
        val RESULT_NOT_TALKED = listOf("ไม่รับสาย", "สายไม่ว่าง", "ติดสายซ้อน", "ไม่มีสัญญาณ", "ตัดสายทิ้ง")
        val CROPS = listOf("ทุเรียน", "ทุเรียนหมอนทอง", "มังคุด", "ลำไย", "เงาะ", "ลองกอง", "มะม่วง",
            "ยางพารา", "ปาล์มน้ำมัน", "ข้าว", "มันสำปะหลัง", "อ้อย", "กาแฟ", "พริกไทย", "มะพร้าว")
    }
}
