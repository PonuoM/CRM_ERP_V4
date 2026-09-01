package com.primacom.dialer.ui

import android.content.ContentValues
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.provider.MediaStore
import android.view.Gravity
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import com.primacom.dialer.R
import com.primacom.dialer.ui.Design.applyBarInsets
import com.primacom.dialer.ui.Design.dp
import com.primacom.dialer.ui.Design.ghostButton
import com.primacom.dialer.ui.Design.primaryButton
import com.primacom.dialer.ui.Design.text
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * สรุปการขายที่ฝากหลังบ้าน — การ์ดแคปได้ + บันทึกลงแกลเลอรี + แชร์ (ไปไลน์ประสานงาน)
 *
 * โผล่หลังบันทึก "ขายได้ · ฝากหลังบ้านเปิด" คนขายแคป/แชร์ไปแจ้งหลังบ้านได้เลย ไม่ต้องรอเฝ้าคิว
 */
class SaleSummaryActivity : AppCompatActivity() {

    private lateinit var card: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Design.bg
        window.navigationBarColor = Design.bg

        val customer = intent.getStringExtra(EXTRA_CUSTOMER) ?: "ลูกค้า"
        val agent = intent.getStringExtra(EXTRA_AGENT) ?: ""
        val note = intent.getStringExtra(EXTRA_NOTE) ?: ""
        val items = intent.getStringExtra(EXTRA_ITEMS) ?: ""

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Design.bg)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT)
            applyBarInsets(0, 0, 0, 0)
        }
        // แถบหัว
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(20), dp(14), dp(20), dp(6))
        }
        bar.addView(text("เสร็จ", 15f, Design.inkDim).apply { isClickable = true; setOnClickListener { finish() } })
        bar.addView(text("ฝากหลังบ้านเปิดบิล", 17f, Design.ink, Design.faceBold, Gravity.CENTER),
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        bar.addView(text("", 15f))
        root.addView(bar)

        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(20), dp(8), dp(20), dp(24))
        }
        content.addView(text("แคปหน้าจอนี้ หรือกดแชร์ ไปแจ้งหลังบ้านในไลน์ประสานงาน", 12.5f, Design.inkFaint)
            .apply { setPadding(dp(2), 0, dp(2), dp(14)); (this as TextView).setLineSpacing(dp(2).toFloat(), 1f) })

        // ── การ์ดสรุป (ส่วนที่แคป) ─────────────────────────────────────────
        card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = Design.roundedStroke(Design.accentSoftBg, Design.accentSoftLine, dp(1), dp(22).toFloat())
            setPadding(dp(20), dp(20), dp(20), dp(20))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        }
        val head = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        head.addView(ImageView(this).apply {
            setImageResource(R.drawable.ic_call)
            imageTintList = android.content.res.ColorStateList.valueOf(Design.onAccent)
            val p = dp(9); setPadding(p, p, p, p)
            background = GradientDrawable().apply { cornerRadius = dp(11).toFloat(); setColor(Design.accent) }
            layoutParams = LinearLayout.LayoutParams(dp(40), dp(40))
        })
        head.addView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(12), 0, 0, 0)
            addView(text("ฝากเปิดบิล — รอหลังบ้าน", 14f, Design.accentText, Design.faceBold))
            addView(text(SimpleDateFormat("d MMM yyyy · HH:mm", Locale("th")).format(Date()), 11.5f, Design.inkDim)
                .apply { setPadding(0, dp(2), 0, 0) })
        })
        card.addView(head)

        card.addView(kv("ฝากขายโดย", agent.ifBlank { "-" }))
        card.addView(kv("ลูกค้า", customer))
        card.addView(text("สินค้า", 11f, Design.inkFaint, Design.faceMedium).apply { setPadding(0, dp(14), 0, dp(6)); letterSpacing = 0.05f })
        items.split("\n").filter { it.isNotBlank() }.forEach { line ->
            card.addView(LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(0, dp(4), 0, dp(4))
                addView(View(this@SaleSummaryActivity).apply {
                    background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(Design.accent) }
                    layoutParams = LinearLayout.LayoutParams(dp(6), dp(6))
                })
                addView(text(line, 14.5f, Design.ink, Design.faceMedium).apply { setPadding(dp(10), 0, 0, 0) })
            })
        }
        if (note.isNotBlank()) card.addView(kv("โน้ต", note))
        content.addView(card)

        // ปุ่ม (ไม่อยู่ในภาพที่แคป)
        content.addView(View(this).apply { layoutParams = LinearLayout.LayoutParams(1, dp(20)) })
        content.addView(primaryButton("แชร์ไปไลน์ / แอปอื่น").apply { setOnClickListener { shareCard() } },
            LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        content.addView(View(this).apply { layoutParams = LinearLayout.LayoutParams(1, dp(10)) })
        content.addView(ghostButton("บันทึกลงแกลเลอรี").apply { setOnClickListener { saveToGallery() } },
            LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))

        root.addView(ScrollView(this).apply { isFillViewport = true; addView(content) },
            LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        setContentView(root)
    }

    private fun kv(k: String, v: String): View = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL; setPadding(0, dp(12), 0, 0)
        addView(text(k, 11f, Design.inkFaint, Design.faceMedium).apply { letterSpacing = 0.05f })
        addView(text(v, 15f, Design.ink, Design.faceMedium).apply { setPadding(0, dp(3), 0, 0) })
    }

    /** วาดการ์ดลง Bitmap (พื้นทึบตามธีม กันภาพโปร่ง) */
    private fun cardBitmap(): Bitmap {
        val bmp = Bitmap.createBitmap(card.width, card.height, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        c.drawColor(Design.bg)
        card.draw(c)
        return bmp
    }

    private fun saveToGallery() {
        try {
            val values = ContentValues().apply {
                put(MediaStore.Images.Media.DISPLAY_NAME, "primacom_sale_${System.currentTimeMillis()}.png")
                put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/Primacom")
            }
            val uri = contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
                ?: throw IllegalStateException("no uri")
            contentResolver.openOutputStream(uri)?.use { os -> cardBitmap().compress(Bitmap.CompressFormat.PNG, 100, os) }
            Toast.makeText(this, "บันทึกลงแกลเลอรีแล้ว", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Toast.makeText(this, "บันทึกไม่สำเร็จ", Toast.LENGTH_SHORT).show()
        }
    }

    private fun shareCard() {
        try {
            val dir = File(cacheDir, "shared").apply { mkdirs() }
            val f = File(dir, "sale_${System.currentTimeMillis()}.png")
            FileOutputStream(f).use { cardBitmap().compress(Bitmap.CompressFormat.PNG, 100, it) }
            val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", f)
            val share = Intent(Intent.ACTION_SEND).apply {
                type = "image/png"
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            startActivity(Intent.createChooser(share, "แชร์สรุปการขาย"))
        } catch (e: Exception) {
            Toast.makeText(this, "แชร์ไม่สำเร็จ", Toast.LENGTH_SHORT).show()
        }
    }

    companion object {
        const val EXTRA_CUSTOMER = "customer"
        const val EXTRA_AGENT = "agent"
        const val EXTRA_NOTE = "note"
        const val EXTRA_ITEMS = "items"
    }
}
