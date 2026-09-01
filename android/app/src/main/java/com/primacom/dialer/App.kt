package com.primacom.dialer

import android.app.Application
import com.primacom.dialer.data.CrashLog
import com.primacom.dialer.data.Session
import com.primacom.dialer.ui.Design

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        CrashLog.install(this)
        Design.initFonts(this)   // ฟอนต์ Anuphan (ดีไซน์ v6) ก่อนจอแรกถูกสร้าง
        // ตั้งโหมดสีตั้งแต่โปรเซสเริ่ม ก่อนจอแรกถูกสร้าง (ไม่งั้นเปิดมาเป็นมืดแวบก่อนสลับ)
        Design.mode = Design.resolveMode(Session(this).themeMode, this)
    }
}
