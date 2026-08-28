package com.primacom.dialer.call

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.primacom.dialer.data.Session

/**
 * Brings the bridge back up without anyone touching the handset.
 *
 * These phones live on a desk with the screen off. Starting the service only when someone opens the
 * app means a power cut, a nightly reboot or an app update silently takes an agent offline until
 * somebody notices and taps the icon — across 51 desks, nobody notices.
 *
 * MY_PACKAGE_REPLACED matters as much as BOOT_COMPLETED: updating the app stops the service, and an
 * update happens far more often than a reboot.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != Intent.ACTION_MY_PACKAGE_REPLACED &&
            action != Intent.ACTION_LOCKED_BOOT_COMPLETED
        ) {
            return
        }

        // Nothing to bring back for a handset that was never enrolled.
        if (!Session(context).isSignedIn) return

        Log.i(TAG, "restarting bridge after $action")
        CallBridgeService.start(context)
    }

    companion object {
        private const val TAG = "BootReceiver"
    }
}
