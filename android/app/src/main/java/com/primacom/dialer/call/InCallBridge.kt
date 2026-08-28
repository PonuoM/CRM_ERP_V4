package com.primacom.dialer.call

import android.telecom.CallAudioState
import android.telecom.InCallService
import java.lang.ref.WeakReference

/**
 * Lets the in-call screen reach the service that owns the audio.
 *
 * Muting and speakerphone are methods on InCallService, not on the Call, and the system owns that
 * instance — the activity cannot construct one. A weak reference keeps the screen from holding the
 * service alive after the system has finished with it.
 */
object InCallBridge {

    private var service: WeakReference<InCallService>? = null

    fun attach(instance: InCallService) {
        service = WeakReference(instance)
    }

    fun detach() {
        service = null
    }

    fun setMuted(muted: Boolean) {
        service?.get()?.setMuted(muted)
    }

    fun setSpeaker(on: Boolean) {
        service?.get()?.setAudioRoute(
            if (on) CallAudioState.ROUTE_SPEAKER else CallAudioState.ROUTE_EARPIECE
        )
    }
}
