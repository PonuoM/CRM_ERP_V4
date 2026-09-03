package com.primacom.dialer.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.RadialGradient
import android.graphics.Rect
import android.graphics.Shader
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable

/**
 * "Liquid Glass" (ดีไซน์ v6) — แต่ทำบน Android แบบไม่ใช้ backdrop-blur จริง
 *
 * เบลอฉากหลังจริง (RenderEffect) เป็น API 31+ และเบลอ "เนื้อ view ตัวเอง" ไม่ใช่ของที่อยู่ข้างหลัง
 * จะทำ backdrop blur ต้อง capture+blur real-time = เปลืองแรง เสี่ยง jank (แอปเคยมี incident perf)
 *
 * แทนที่ด้วย "กระจกปลอมแต่เนียน":
 *  1. พื้น aurora จริง — RadialGradient หลายชั้นวางบนสีเข้ม เปลี่ยนโทนตามสถานะ (เขียว/ส้ม/ฯลฯ)
 *  2. แผงกระจก = พื้นขาวโปร่ง + ขอบสว่าง (rim) + มุมโค้ง + เงา (ตั้ง elevation ที่ view)
 * เพราะ aurora เป็น gradient นุ่มอยู่แล้ว ไม่มีของคมข้างหลังให้ต้องเบลอ กระจกปลอมจึงแทบไม่ต่างจากจริง
 *
 * ทุกอย่างเคารพ [Design.mode] — โหมดสว่างคืนพื้น/แผงทึบแบบเดิม (v6 เป็นดีไซน์มืดล้วน)
 */

/** หนึ่งก้อนแสง aurora: สี (มี alpha), จุดศูนย์กลางเป็นสัดส่วน 0..1, รัศมีเป็นสัดส่วนของด้านยาว */
data class AuroraBlob(val color: Int, val cx: Float, val cy: Float, val radius: Float)

/** พื้น aurora: สีฐานทึบ + ก้อนแสงเรเดียลซ้อนกัน (สร้าง shader ใหม่เมื่อขนาดเปลี่ยนเท่านั้น) */
class AuroraDrawable(private val base: Int, private val blobs: List<AuroraBlob>) : Drawable() {
    private val basePaint = Paint().apply { color = base; style = Paint.Style.FILL }
    private val blobPaints = ArrayList<Paint>()

    override fun onBoundsChange(b: Rect) {
        blobPaints.clear()
        val w = b.width().toFloat(); val h = b.height().toFloat()
        if (w <= 0f || h <= 0f) return
        val maxd = maxOf(w, h)
        for (blob in blobs) {
            val r = (blob.radius * maxd).coerceAtLeast(1f)
            blobPaints.add(Paint(Paint.ANTI_ALIAS_FLAG).apply {
                shader = RadialGradient(
                    blob.cx * w, blob.cy * h, r,
                    intArrayOf(blob.color, blob.color and 0x00FFFFFF), // สีกลาง → โปร่งใสสนิท (RGB เดิม)
                    floatArrayOf(0f, 1f), Shader.TileMode.CLAMP,
                )
            })
        }
    }

    override fun draw(canvas: Canvas) {
        val b = bounds
        canvas.drawRect(b, basePaint)
        for (p in blobPaints) canvas.drawRect(b, p)
    }

    override fun setAlpha(alpha: Int) {}
    override fun setColorFilter(colorFilter: ColorFilter?) {}
    @Deprecated("deprecated in API level 29")
    override fun getOpacity(): Int = PixelFormat.OPAQUE
}

/**
 * พรีเซ็ต aurora ต่อจอ (สีตามดีไซน์ v6) — คืนพื้นแบนสีอ่อนถ้าอยู่โหมดสว่าง
 * green=พร้อม/คุย · orange=สายเข้า · โทนเปลี่ยนบอกสถานะ (กติกา 3)
 */
object Aurora {
    private const val GREEN = 0x3DDC84
    private const val PURPLE = 0x6E56F0
    private const val BLUE = 0x2878BE
    private const val TEAL = 0x2896C8
    private const val ORANGE = 0xFF9F0A
    private const val RED = 0xD9453C

    // เพิ่มความสว่าง aurora ~35% ให้เรืองใกล้ดีไซน์ (จอจริงดูทึบกว่า mockup ที่เรนเดอร์บนเว็บ)
    private fun a(alpha: Int, rgb: Int): Int =
        ((alpha * 1.35f).toInt().coerceAtMost(0xF0) shl 24) or rgb

    private fun build(baseDark: Int, blobs: List<AuroraBlob>): Drawable =
        if (Design.mode == Design.Mode.DARK) AuroraDrawable(baseDark, blobs)
        else ColorDrawable(Design.bg)

    fun home(): Drawable = build(
        0xFF0B0A14.toInt(), listOf(
            AuroraBlob(a(0x5C, GREEN), 0.12f, 0.02f, 0.62f),
            AuroraBlob(a(0x6B, PURPLE), 0.96f, 0.14f, 0.66f),
            AuroraBlob(a(0x4D, BLUE), 0.50f, 1.04f, 0.70f),
        ),
    )

    fun incoming(): Drawable = build(
        0xFF100A08.toInt(), listOf(
            AuroraBlob(a(0x85, ORANGE), 0.50f, -0.04f, 0.64f),
            AuroraBlob(a(0x52, RED), 0.08f, 0.34f, 0.66f),
            AuroraBlob(a(0x47, PURPLE), 0.92f, 0.96f, 0.70f),
        ),
    )

    fun active(): Drawable = build(
        0xFF08100C.toInt(), listOf(
            AuroraBlob(a(0x70, GREEN), 0.50f, -0.02f, 0.62f),
            AuroraBlob(a(0x4D, TEAL), 0.96f, 0.40f, 0.68f),
            AuroraBlob(a(0x42, PURPLE), 0.04f, 0.92f, 0.70f),
        ),
    )

    fun disposition(): Drawable = build(
        0xFF0B0A14.toInt(), listOf(
            AuroraBlob(a(0x66, GREEN), 0.14f, 0.00f, 0.62f),
            AuroraBlob(a(0x73, PURPLE), 0.94f, 0.18f, 0.66f),
        ),
    )

    fun history(): Drawable = build(
        0xFF0B0A14.toInt(), listOf(
            AuroraBlob(a(0x6B, PURPLE), 0.88f, 0.00f, 0.64f),
            AuroraBlob(a(0x3D, GREEN), 0.06f, 0.22f, 0.68f),
            AuroraBlob(a(0x42, BLUE), 0.50f, 1.02f, 0.70f),
        ),
    )

    fun team(): Drawable = build(
        0xFF0B0A14.toInt(), listOf(
            AuroraBlob(a(0x57, GREEN), 0.10f, 0.00f, 0.62f),
            AuroraBlob(a(0x66, PURPLE), 0.96f, 0.26f, 0.66f),
            AuroraBlob(a(0x47, BLUE), 0.40f, 1.04f, 0.70f),
        ),
    )

    /** จอ "ฉัน" ไม่มีในดีไซน์ — ใช้โทนสงบ (ม่วง/เขียวจาง) ให้เข้าชุด */
    fun me(): Drawable = build(
        0xFF0B0A14.toInt(), listOf(
            AuroraBlob(a(0x52, PURPLE), 0.90f, 0.00f, 0.64f),
            AuroraBlob(a(0x3D, GREEN), 0.08f, 0.30f, 0.66f),
        ),
    )
}
