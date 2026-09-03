package com.primacom.dialer.ui

import android.animation.Animator
import android.animation.ObjectAnimator
import android.animation.PropertyValuesHolder
import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.view.animation.LinearInterpolator
import android.view.animation.OvershootInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.primacom.dialer.R
import com.primacom.dialer.ui.Design.dp
import com.primacom.dialer.ui.Design.text

/**
 * แผงยืนยันก่อนโทร — เลื่อนขึ้นจากล่างจอ กันกดปุ่มโทร "ลั่น" ในหน้าประวัติ
 *
 * งานจริงคือถามยืนยันก่อนโทร แต่ทำให้ดูพรีเมียม: วงแหวนเต้นเป็นจังหวะรอบรูปลูกค้า (ฟีลสาย
 * กำลังจะต่อ) · รูปเด้งแบบสปริงตอนเปิด · ชื่อ/ปุ่มค่อย ๆ จางเข้ามาเป็นจังหวะ
 * ยืนยันแล้วเรียก [onConfirm] (ตัวเรียกเป็นคนสั่งโทรจริง)
 */
fun Context.showCallConfirm(
    customerId: Int,
    customerName: String,
    onConfirm: () -> Unit,
) {
    val sheet = BottomSheetDialog(this)
    val running = mutableListOf<Animator>()

    val root = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL
        setBackgroundColor(Design.sheet)
        setPadding(dp(24), dp(10), dp(24), dp(26))
    }

    // ตัวจับลาก (แถบมนบนสุด) — รายละเอียดเล็ก ๆ ที่ทำให้ดูตั้งใจ
    root.addView(View(this).apply {
        background = Design.roundedFill(0xFF2A4A4E.toInt(), dp(2).toFloat())
        layoutParams = LinearLayout.LayoutParams(dp(38), dp(4)).apply { bottomMargin = dp(18) }
    })

    root.addView(text("โทรกลับหาลูกค้า", 12f, Design.inkFaint, Design.faceMedium, Gravity.CENTER).apply {
        letterSpacing = 0.14f
    })

    // ── รูปลูกค้า + วงแหวนเต้น ────────────────────────────────────────────
    val stage = FrameLayout(this).apply {
        layoutParams = LinearLayout.LayoutParams(dp(132), dp(132)).apply { topMargin = dp(20) }
    }
    fun ring(): View = View(this).apply {
        background = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(Color.TRANSPARENT)
            setStroke(dp(2), Design.accent)
        }
        alpha = 0f
        layoutParams = FrameLayout.LayoutParams(dp(84), dp(84), Gravity.CENTER)
    }
    val ring1 = ring(); val ring2 = ring()
    stage.addView(ring1); stage.addView(ring2)

    val palette = intArrayOf(
        0xFF2F9E6E.toInt(), 0xFF3A6FB0.toInt(), 0xFF7A5AA8.toInt(),
        0xFFB0793A.toInt(), 0xFF2E8C93.toInt(), 0xFFA84E7A.toInt())
    val avatarColor = palette[Math.floorMod(customerName.fold(0) { a, ch -> a + ch.code }, palette.size)]
    val avatar = TextView(this).apply {
        text = customerName.trim().firstOrNull()?.toString() ?: "?"
        setTextColor(0xFFF2F7F7.toInt()); textSize = 30f; typeface = Design.faceBold
        gravity = Gravity.CENTER
        background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(avatarColor) }
        layoutParams = FrameLayout.LayoutParams(dp(84), dp(84), Gravity.CENTER)
    }
    stage.addView(avatar)
    root.addView(stage)

    // ชื่อ + รหัส
    val name = text(customerName, 20f, Design.ink, Design.faceBold, Gravity.CENTER).apply {
        setPadding(dp(8), dp(16), dp(8), 0)
    }
    root.addView(name)
    val idText = if (customerId > 0)
        text("รหัสลูกค้า #$customerId", 13f, Design.inkDim, gravity = Gravity.CENTER).apply { setPadding(0, dp(5), 0, 0) }
    else null
    idText?.let { root.addView(it) }

    // ── ปุ่มโทรออก (เขียว มีไอคอน) ─────────────────────────────────────────
    val callBtn = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER
        background = Design.roundedFill(Design.accent, dp(15).toFloat())
        setPadding(dp(20), dp(16), dp(20), dp(16))
        isClickable = true; isFocusable = true
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { topMargin = dp(26) }
    }
    callBtn.addView(ImageView(this).apply {
        setImageResource(R.drawable.ic_call)
        imageTintList = ColorStateList.valueOf(Design.onAccent)
        layoutParams = LinearLayout.LayoutParams(dp(20), dp(20))
    })
    callBtn.addView(text("โทรออก", 16.5f, Design.onAccent, Design.faceBold).apply {
        setPadding(dp(10), 0, 0, 0)
    })
    root.addView(callBtn)

    // ยกเลิก
    root.addView(text("ยกเลิก", 15f, Design.inkDim, Design.faceMedium, Gravity.CENTER).apply {
        setPadding(dp(20), dp(16), dp(20), dp(6)); isClickable = true
        setOnClickListener { sheet.dismiss() }
    }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))

    callBtn.setOnClickListener {
        // กดปุ่มยุบเล็กน้อยเป็น feedback แล้วค่อยโทร
        callBtn.animate().scaleX(0.96f).scaleY(0.96f).setDuration(90).withEndAction {
            sheet.dismiss(); onConfirm()
        }.start()
    }

    // ── อนิเมชั่น ──────────────────────────────────────────────────────────
    fun pulse(v: View, delay: Long): Animator =
        ObjectAnimator.ofPropertyValuesHolder(
            v,
            PropertyValuesHolder.ofFloat(View.SCALE_X, 1f, 1.85f),
            PropertyValuesHolder.ofFloat(View.SCALE_Y, 1f, 1.85f),
            PropertyValuesHolder.ofFloat(View.ALPHA, 0.5f, 0f),
        ).apply {
            duration = 1700; startDelay = delay
            repeatCount = ObjectAnimator.INFINITE; repeatMode = ObjectAnimator.RESTART
            interpolator = LinearInterpolator()
        }

    root.viewTreeObserver.addOnGlobalLayoutListener(
        object : android.view.ViewTreeObserver.OnGlobalLayoutListener {
            override fun onGlobalLayout() {
                root.viewTreeObserver.removeOnGlobalLayoutListener(this)
                // รูปเด้งสปริง
                avatar.scaleX = 0.6f; avatar.scaleY = 0.6f; avatar.alpha = 0f
                avatar.animate().scaleX(1f).scaleY(1f).alpha(1f)
                    .setInterpolator(OvershootInterpolator(2.4f)).setDuration(440).start()
                // ชื่อ/รหัส/ปุ่ม จางเข้าเป็นจังหวะ
                listOf(name, idText, callBtn).forEachIndexed { i, v ->
                    v ?: return@forEachIndexed
                    v.alpha = 0f; v.translationY = dp(10).toFloat()
                    v.animate().alpha(1f).translationY(0f).setStartDelay(120L + i * 70)
                        .setDuration(300).start()
                }
                // วงแหวนเริ่มเต้นหลังรูปโผล่
                running += pulse(ring1, 260).also { it.start() }
                running += pulse(ring2, 260 + 850).also { it.start() }
            }
        })

    sheet.setOnDismissListener { running.forEach { it.cancel() } }
    sheet.setContentView(root)
    sheet.show()
}
