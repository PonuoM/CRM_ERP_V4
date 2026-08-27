package com.primacom.dialer.data

import android.content.Context
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Keeps the last crash where a human can read it.
 *
 * These handsets are locked down and often cannot be plugged into a laptop, so `adb logcat` is not
 * available when it is most needed. Writing the trace to preferences and showing it on the next
 * launch turns "it just closes" into something an agent can read out over the phone.
 */
object CrashLog {

    private const val PREFS = "primacom_dialer_crash"
    private const val KEY_TRACE = "last_trace"

    fun install(context: Context) {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            runCatching { save(context, error) }
            previous?.uncaughtException(thread, error)
        }
    }

    private fun save(context: Context, error: Throwable) {
        val stamp = SimpleDateFormat("dd/MM/yyyy HH:mm:ss", Locale.getDefault()).format(Date())
        val trace = StringWriter().also { error.printStackTrace(PrintWriter(it)) }.toString()
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_TRACE, "$stamp\n$trace")
            .apply()
    }

    fun last(context: Context): String? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_TRACE, null)

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(KEY_TRACE).apply()
    }
}
