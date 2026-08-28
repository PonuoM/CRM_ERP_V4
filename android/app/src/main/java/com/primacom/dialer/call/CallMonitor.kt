package com.primacom.dialer.call

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat

/**
 * Reports what the radio is actually doing: ringing, connected, hung up.
 *
 * Needed because placing a call tells you nothing about how it went. Without this the server could
 * never tell an answered call from one that rang out, and every duration would be a guess.
 *
 * Two implementations because the API changed in Android 12: TelephonyCallback from 31, and the
 * deprecated PhoneStateListener for 29 and 30, which plenty of company handsets still run.
 */
class CallMonitor(
    private val context: Context,
    private val onState: (Int) -> Unit,
) {

    private val telephony = context.getSystemService(TelephonyManager::class.java)
    private var callback: TelephonyCallback? = null
    private var legacyListener: PhoneStateListener? = null

    fun start() {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE)
            != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val cb = object : TelephonyCallback(), TelephonyCallback.CallStateListener {
                override fun onCallStateChanged(state: Int) = onState(state)
            }
            callback = cb
            telephony.registerTelephonyCallback(ContextCompat.getMainExecutor(context), cb)
        } else {
            @Suppress("DEPRECATION")
            val listener = object : PhoneStateListener() {
                override fun onCallStateChanged(state: Int, phoneNumber: String?) {
                    // phoneNumber is ignored on purpose. The agent must not see it, and the server
                    // already knows which customer this session belongs to.
                    onState(state)
                }
            }
            legacyListener = listener
            @Suppress("DEPRECATION")
            telephony.listen(listener, PhoneStateListener.LISTEN_CALL_STATE)
        }
    }

    fun stop() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            callback?.let { telephony.unregisterTelephonyCallback(it) }
            callback = null
        } else {
            @Suppress("DEPRECATION")
            legacyListener?.let { telephony.listen(it, PhoneStateListener.LISTEN_NONE) }
            legacyListener = null
        }
    }
}
