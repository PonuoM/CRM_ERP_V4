package com.primacom.dialer.ui

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.NumberPicker
import android.widget.ScrollView
import android.widget.TextView
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.primacom.dialer.data.ProductOption
import com.primacom.dialer.data.TagOption
import com.primacom.dialer.ui.Design.dp
import com.primacom.dialer.ui.Design.text

/**
 * ตัวเลือกแบบ wheel เลื่อน (iOS-style) ในแผงที่เลื่อนขึ้นจากล่างจอ
 *
 * ใช้ NumberPicker ซึ่งเป็นวงล้อหมุนของแอนดรอยด์อยู่แล้ว — ได้ฟีลสไลด์นิ้วเลือกเหมือน iOS
 * โดยไม่ต้องเขียน snap เอง · ทุก dropdown ในแอปใช้ตัวนี้ตามที่ตกลงไว้
 */
fun Context.showWheelPicker(
    title: String,
    options: List<String>,
    current: Int,
    onDone: (Int) -> Unit,
) {
    if (options.isEmpty()) return
    val sheet = BottomSheetDialog(this)

    val root = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setBackgroundColor(Design.sheet)
        setPadding(0, 0, 0, dp(14))
    }

    val header = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        setPadding(dp(18), dp(13), dp(18), dp(13))
    }
    header.addView(text("ยกเลิก", 15f, Design.inkDim).apply {
        isClickable = true; setOnClickListener { sheet.dismiss() }
    })
    header.addView(text(title, 15.5f, Design.ink, Design.faceBold, Gravity.CENTER),
        LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    val done = text("เสร็จ", 15f, Design.accent, Design.faceBold).apply { isClickable = true }
    header.addView(done)
    root.addView(header)
    root.addView(View(this).apply {
        setBackgroundColor(Design.line)
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1))
    })

    val picker = NumberPicker(this).apply {
        minValue = 0
        maxValue = options.size - 1
        displayedValues = options.toTypedArray()
        value = current.coerceIn(0, options.size - 1)
        wrapSelectorWheel = false
        // API 29+ (minSdk 29): ตั้งสีตัวอักษรให้เข้ากับพื้นเข้ม (setSelectedTextColor ไม่ public
        // จึงใช้สีสว่างสีเดียว ตัวกลางถูกเน้นด้วยเส้นคั่นของ NumberPicker เองอยู่แล้ว)
        setTextColor(Design.ink)
        setTextSize(dp(18).toFloat())
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(190))
    }
    root.addView(picker)

    done.setOnClickListener { onDone(picker.value); sheet.dismiss() }
    sheet.setContentView(root)
    sheet.show()
}

/**
 * ตัวเลือก Tag แบบรายการเลื่อนในแผงล่างจอ — หน้าตาชุดเดียวกับ [showWheelPicker]
 *
 * ใช้รายการแทนวงล้อเพราะแต่ละ Tag ต้องมี "วงกลมสี" นำหน้า (NumberPicker แสดงสีรายตัวไม่ได้)
 * เลือกได้หลายอัน · Tag ที่ลูกค้ามีอยู่แล้ว (selected=true จาก server) ล็อกเป็น "ติดแล้ว" ถอดไม่ได้
 * เพราะระบบเพิ่มอย่างเดียวเหมือนฝั่งคอม · [chosen] เก็บเฉพาะอันที่เลือกใหม่
 */
fun Context.showTagPicker(
    tags: List<TagOption>,
    chosen: MutableSet<Int>,
    onDone: () -> Unit,
) {
    if (tags.isEmpty()) return
    val sheet = BottomSheetDialog(this)

    val root = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setBackgroundColor(Design.sheet)
        setPadding(0, 0, 0, dp(14))
    }

    val header = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        setPadding(dp(18), dp(13), dp(18), dp(13))
    }
    header.addView(text("ปิด", 15f, Design.inkDim).apply {
        isClickable = true; setOnClickListener { sheet.dismiss() }
    })
    header.addView(text("เลือก Tag ลูกค้า", 15.5f, Design.ink, Design.faceBold, Gravity.CENTER),
        LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    val done = text("เสร็จ", 15f, Design.accent, Design.faceBold).apply { isClickable = true }
    header.addView(done)
    root.addView(header)
    root.addView(View(this).apply {
        setBackgroundColor(Design.line)
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1))
    })

    val list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
    // เรียง Tag ที่ติดแล้วขึ้นก่อน
    tags.sortedByDescending { it.selected }.forEach { tag ->
        list.addView(tagRow(tag, chosen))
        list.addView(View(this).apply {
            setBackgroundColor(Design.lineFaint)
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1))
        })
    }
    val scroll = ScrollView(this).apply {
        addView(list)
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(340))
    }
    root.addView(scroll)

    done.setOnClickListener { onDone(); sheet.dismiss() }
    sheet.setContentView(root)
    sheet.show()
}

/**
 * เลือกสินค้าสำหรับบันทึกการขาย — bottom sheet ค้นหา + รายการ · แตะสินค้าเพื่อเพิ่ม
 */
fun Context.showProductPicker(products: List<ProductOption>, onPick: (ProductOption) -> Unit) {
    if (products.isEmpty()) return
    val sheet = BottomSheetDialog(this)
    val root = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setBackgroundColor(Design.sheet)
        setPadding(0, 0, 0, dp(14))
    }
    val header = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
        setPadding(dp(18), dp(13), dp(18), dp(13))
    }
    header.addView(text("ปิด", 15f, Design.inkDim).apply { isClickable = true; setOnClickListener { sheet.dismiss() } })
    header.addView(text("เลือกสินค้า", 15.5f, Design.ink, Design.faceBold, Gravity.CENTER),
        LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    header.addView(text("", 15f))
    root.addView(header)

    val search = EditText(this).apply {
        hint = "ค้นชื่อสินค้า"; setHintTextColor(Design.inkFaint); setTextColor(Design.ink); textSize = 15f
        maxLines = 1
        background = Design.roundedStroke(Design.surface, Design.line, dp(1), dp(12).toFloat())
        setPadding(dp(14), dp(11), dp(14), dp(11))
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            .apply { leftMargin = dp(18); rightMargin = dp(18) }
    }
    root.addView(search)

    val listCol = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(0, dp(8), 0, 0) }
    fun render(q: String) {
        listCol.removeAllViews()
        val filtered = if (q.isBlank()) products else products.filter { it.name.contains(q, ignoreCase = true) }
        filtered.take(80).forEach { p ->
            listCol.addView(LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
                setPadding(dp(18), dp(13), dp(18), dp(13)); isClickable = true
                setOnClickListener { onPick(p); sheet.dismiss() }
                val mid = LinearLayout(this@showProductPicker).apply {
                    orientation = LinearLayout.VERTICAL
                    layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                }
                mid.addView(text(p.name, 15f, Design.ink2, Design.faceMedium))
                val meta = listOfNotNull(p.unit, p.price?.let { "฿${if (it % 1.0 == 0.0) it.toInt() else it}" }).joinToString(" · ")
                if (meta.isNotBlank()) mid.addView(text(meta, 12f, Design.inkDim).apply { setPadding(0, dp(2), 0, 0) })
                addView(mid)
                addView(text("+", 22f, Design.accentText, Design.faceBold))
            })
            listCol.addView(View(this).apply {
                setBackgroundColor(Design.lineFaint)
                layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1))
                    .apply { leftMargin = dp(18); rightMargin = dp(18) }
            })
        }
    }
    search.addTextChangedListener(object : TextWatcher {
        override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
        override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
        override fun afterTextChanged(s: Editable?) = render(s?.toString().orEmpty())
    })
    render("")
    root.addView(ScrollView(this).apply {
        addView(listCol)
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(380))
    })

    sheet.setContentView(root)
    sheet.show()
}

/** วงกลมสีขนาดเล็กสำหรับนำหน้าชื่อ Tag */
private fun Context.colorDot(colorHex: String): View {
    val c = runCatching { Color.parseColor(colorHex) }.getOrDefault(Design.accent)
    return View(this).apply {
        background = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(c)
            setStroke(dp(1), 0x33FFFFFF)   // ขอบจางกันสีเข้มกลืนพื้น
        }
        layoutParams = LinearLayout.LayoutParams(dp(14), dp(14)).apply {
            marginEnd = dp(12); gravity = Gravity.CENTER_VERTICAL
        }
    }
}

/** หนึ่งแถวในตัวเลือก Tag: [วงกลมสี] ชื่อ ........ [ติดแล้ว / เครื่องหมายถูก] */
private fun Context.tagRow(tag: TagOption, chosen: MutableSet<Int>): LinearLayout {
    val row = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        setPadding(dp(18), dp(14), dp(18), dp(14))
    }
    row.addView(colorDot(tag.color))
    row.addView(text(tag.name, 15.5f, Design.ink),
        LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))

    if (tag.selected) {
        // ลูกค้ามีอยู่แล้ว — ล็อก
        row.addView(text("ติดแล้ว", 13f, Design.positive, Design.faceMedium))
        row.alpha = 0.65f
        return row
    }

    val mark = text(if (tag.id in chosen) "✓" else "", 17f, Design.accent, Design.faceBold)
    row.addView(mark)
    row.isClickable = true
    row.setOnClickListener {
        if (!chosen.add(tag.id)) chosen.remove(tag.id)
        (mark as TextView).text = if (tag.id in chosen) "✓" else ""
    }
    return row
}
