package com.primacom.dialer.ui

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.content.res.ColorStateList
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

/**
 * ระบบดีไซน์กลางของแอป — สี ตัวอักษร ระยะห่าง และตัวประกอบ view
 *
 * แอปนี้จงใจไม่ใช้ไฟล์ layout (สามหน้าจอไม่คุ้มกับระบบ layout) แต่ "ไม่ใช้ layout" ไม่ได้แปลว่า
 * ต้องหน้าตาจืด ที่นี่คือที่เดียวที่นิยามหน้าตาของทั้งแอป ทุกหน้าจอประกอบจากชิ้นส่วนในนี้
 * เปลี่ยนโทนสีทั้งแอปได้จากจุดเดียว
 *
 * โจทย์: เครื่องวางบนโต๊ะ พนักงานเหลือบมองแวบเดียวต้องอ่านออก ปุ่มต้องกดโดนง่ายเวลาเร่ง
 * โทนเข้ม teal สงบตา ดูเป็นเครื่องมือทำงานจริง ไม่ใช่แอปทั่วไป
 */
object Design {

    // ── สี (เข้ม teal-forward, คุมด้วย role ไม่ใช่ชื่อสี) ────────────────────────────────────
    const val bg = 0xFF0A1A1C.toInt()          // พื้นหลังลึกสุด
    const val surface = 0xFF10262A.toInt()     // การ์ด/ผิวยกระดับ
    const val surfaceHi = 0xFF163438.toInt()   // ผิวที่ถูกเน้น/ปุ่มรอง
    const val line = 0xFF1F4247.toInt()        // เส้นคั่นบาง
    const val ink = 0xFFEAF3F3.toInt()         // ตัวอักษรหลัก
    const val inkDim = 0xFF8FB0B2.toInt()      // ตัวอักษรรอง
    const val inkFaint = 0xFF5E7E80.toInt()    // ตัวอักษรจาง/คำใบ้

    const val accent = 0xFF2AB7A9.toInt()      // สีแบรนด์/ปุ่มหลัก (mint teal)
    const val onAccent = 0xFF04211E.toInt()    // ตัวอักษรบนสีแบรนด์

    const val positive = 0xFF33C481.toInt()    // รับสาย/สำเร็จ (เขียว)
    const val warning = 0xFFF2B44C.toInt()     // เตือน (เหลืองอำพัน)
    const val danger = 0xFFF0564B.toInt()      // วางสาย/ผิดพลาด (แดง)
    const val onSolid = 0xFFFFFFFF.toInt()     // ตัวอักษร/ไอคอนบนปุ่มสีทึบ

    // ── ระยะห่าง (คูณจาก 4dp) ────────────────────────────────────────────────────────────────
    fun Context.dp(v: Int): Int =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()

    // ── ตัวอักษร ─────────────────────────────────────────────────────────────────────────────
    // ขนาด (sp): display 40 · title 27 · headline 21 · body 16 · label 14 · caption 12.5
    val faceBold: Typeface = Typeface.create("sans-serif", Typeface.BOLD)
    val faceMedium: Typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
    val faceRegular: Typeface = Typeface.create("sans-serif", Typeface.NORMAL)
    val faceMono: Typeface = Typeface.create("monospace", Typeface.NORMAL)
    val mono: Typeface get() = faceMono

    fun Context.text(
        value: CharSequence = "",
        size: Float = 16f,
        color: Int = ink,
        face: Typeface = faceRegular,
        gravity: Int = Gravity.START,
        letterSpacingEm: Float = 0f,
    ) = TextView(this).apply {
        text = value
        textSize = size
        setTextColor(color)
        typeface = face
        this.gravity = gravity
        if (letterSpacingEm != 0f) letterSpacing = letterSpacingEm
        includeFontPadding = false
    }

    fun Context.title(value: CharSequence, color: Int = ink) =
        text(value, 27f, color, faceBold, Gravity.CENTER)

    fun Context.label(value: CharSequence, color: Int = inkDim) =
        text(value, 12.5f, color, faceMedium, Gravity.CENTER, 0.06f)

    // ── รูปทรง ───────────────────────────────────────────────────────────────────────────────
    fun roundedFill(color: Int, radiusPx: Float): GradientDrawable = GradientDrawable().apply {
        setColor(color)
        cornerRadius = radiusPx
    }

    fun roundedStroke(fill: Int, stroke: Int, strokePx: Int, radiusPx: Float): GradientDrawable =
        GradientDrawable().apply {
            setColor(fill)
            setStroke(strokePx, stroke)
            cornerRadius = radiusPx
        }

    private fun ripple(content: GradientDrawable, rippleColor: Int) =
        RippleDrawable(ColorStateList.valueOf(rippleColor), content, null)

    // ── ตัวประกอบ view ───────────────────────────────────────────────────────────────────────

    /** รากของหน้าจอ: คอลัมน์ พื้นหลังแบรนด์ padding มาตรฐาน */
    fun Context.screen(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setBackgroundColor(bg)
        setPadding(dp(24), dp(28), dp(24), dp(28))
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT
        )
    }

    /** ป้ายสถานะกลม ๆ (chip) เช่น "รหัสลูกค้า #123" หรือสถานะสาย */
    fun Context.chip(value: CharSequence, fg: Int, bgTint: Int): TextView =
        text(value, 13f, fg, faceMedium, Gravity.CENTER).apply {
            background = roundedFill(bgTint, dp(999).toFloat())
            setPadding(dp(14), dp(7), dp(14), dp(7))
        }

    /** ปุ่มเต็มความกว้าง สีทึบ — การกระทำหลัก */
    fun Context.primaryButton(value: CharSequence, fill: Int = accent, fg: Int = onAccent): TextView =
        text(value, 16.5f, fg, faceMedium, Gravity.CENTER).apply {
            background = ripple(roundedFill(fill, dp(14).toFloat()), 0x33FFFFFF)
            setPadding(dp(20), dp(16), dp(20), dp(16))
            isClickable = true
            isFocusable = true
        }

    /** ปุ่มโครงร่าง (รอง) */
    fun Context.ghostButton(value: CharSequence, fg: Int = ink): TextView =
        text(value, 15f, fg, faceMedium, Gravity.CENTER).apply {
            background = ripple(roundedStroke(Color.TRANSPARENT, line, dp(1), dp(14).toFloat()), 0x22FFFFFF)
            setPadding(dp(20), dp(14), dp(20), dp(14))
            isClickable = true
            isFocusable = true
        }

    /**
     * ปุ่มวงกลมพร้อมไอคอน + ป้ายกำกับใต้ปุ่ม — สำหรับการกระทำในสาย (รับ/วาง/ปิดเสียง)
     * วงกลมพาสีความหมาย (เขียว=รับ แดง=วาง), ไอคอนขาวคมชัด, ป้ายอ่านชัดจากระยะ
     */
    fun Context.callAction(
        iconRes: Int,
        labelText: CharSequence,
        circleColor: Int,
        diameterDp: Int = 66,
        onClick: () -> Unit,
    ): LinearLayout {
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
        }
        val circle = ImageView(this).apply {
            setImageResource(iconRes)
            imageTintList = ColorStateList.valueOf(onSolid)
            val pad = dp(diameterDp / 4)
            setPadding(pad, pad, pad, pad)
            background = ripple(
                GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(circleColor) },
                0x40FFFFFF,
            )
            layoutParams = LinearLayout.LayoutParams(dp(diameterDp), dp(diameterDp))
            isClickable = true
            isFocusable = true
            setOnClickListener { onClick() }
        }
        val cap = label(labelText, inkDim).apply {
            setPadding(0, dp(10), 0, 0)
        }
        col.addView(circle)
        col.addView(cap)
        return col
    }

    /** เส้นคั่นบาง */
    fun Context.divider(): View = View(this).apply {
        setBackgroundColor(line)
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1))
    }

    /** ตัวเว้นยืดหยุ่น ดันเนื้อหาบน/ล่างแยกกัน (weight = 1) */
    fun Context.flexSpacer(): View = View(this).apply {
        layoutParams = LinearLayout.LayoutParams(1, 0, 1f)
    }
}
