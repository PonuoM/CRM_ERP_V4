package com.primacom.dialer.call

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Handler
import android.os.Looper
import android.provider.CallLog
import android.util.Log
import androidx.core.content.ContextCompat

/**
 * ลบประวัติการโทรออกจากตัวเครื่อง
 *
 * การซ่อนเบอร์บนหน้าจอสายอย่างเดียวยังรั่ว: ระบบเป็นคนเขียนทุกสายลง call log กลางหลังวางสาย
 * แล้วแอปโทรศัพท์/รายชื่อเดิมที่ยังติดเครื่องอยู่เปิดดู "ล่าสุด" ได้เบอร์เต็ม ๆ ห้ามระบบเขียนไม่ได้
 * ทำได้อย่างเดียวคือตามลบทิ้งในฐานะแอปโทรศัพท์หลัก
 *
 * ลบทั้งหมด ไม่เลือกเฉพาะเบอร์ลูกค้า — การเลือกลบต้องเก็บเบอร์ไว้เทียบซึ่งขัดหลักของระบบ
 * และพลาดง่ายกับรูปแบบเบอร์ที่ต่างกัน (+66 / 0 นำหน้า) เครื่องนี้เป็นเครื่องงาน
 * ประวัติการโทรตัวจริงอยู่ใน CRM ซึ่งบันทึกทุกสายผ่าน call bridge อยู่แล้ว
 */
object CallLogScrubber {

    private const val TAG = "CallLogScrub"
    private val handler = Handler(Looper.getMainLooper())

    /**
     * ระบบเขียนบันทึกการโทร "หลัง" สายจบแบบ async — ลบทันทีจะแข่งกับการเขียนแล้วแพ้
     * จึงหน่วงไว้ก่อน และเกาะ application context เพราะ service ที่เรียก (โดยเฉพาะ
     * InCallService ที่ระบบ unbind แทบจะทันทีหลังวางสาย) มักตายก่อนถึงเวลาลบ
     */
    fun scrubSoon(context: Context, delayMs: Long = SCRUB_DELAY_MS) {
        val app = context.applicationContext
        handler.postDelayed({ scrub(app) }, delayMs)
    }

    fun scrub(context: Context) {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_CALL_LOG)
            != PackageManager.PERMISSION_GRANTED
        ) {
            Log.w(TAG, "ไม่มีสิทธิ์ WRITE_CALL_LOG — ประวัติการโทรบนเครื่องยังมีเบอร์ค้างอยู่")
            return
        }
        try {
            val deleted = context.contentResolver.delete(CallLog.Calls.CONTENT_URI, null, null)
            if (deleted > 0) Log.i(TAG, "ลบประวัติการโทร $deleted รายการ")
        } catch (e: Exception) {
            Log.w(TAG, "ลบประวัติการโทรไม่สำเร็จ: ${e.message}")
        }
    }

    private const val SCRUB_DELAY_MS = 5_000L
}
