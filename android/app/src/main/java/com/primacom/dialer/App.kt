package com.primacom.dialer

import android.app.Application
import com.primacom.dialer.data.CrashLog

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        CrashLog.install(this)
    }
}
