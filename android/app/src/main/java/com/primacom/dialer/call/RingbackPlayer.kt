package com.primacom.dialer.call

import android.media.AudioManager
import android.media.ToneGenerator
import android.util.Log

/**
 * The tone an agent hears while an outgoing call is still ringing.
 *
 * Taking over as default dialer means inheriting the sounds the stock app used to make. Nothing in
 * the platform plays this for us: without it, pressing call produces silence until someone answers,
 * and an agent cannot tell a ringing line from a dead one.
 *
 * Kept in the service rather than the screen so the tone follows the call, not the UI.
 */
object RingbackPlayer {

    private var tone: ToneGenerator? = null

    fun start() {
        if (tone != null) return
        try {
            // Routed to the call stream so it ducks and stops with the call, and follows the
            // earpiece/speaker choice the agent has made.
            tone = ToneGenerator(AudioManager.STREAM_VOICE_CALL, VOLUME).apply {
                startTone(ToneGenerator.TONE_SUP_RINGTONE)
            }
        } catch (e: Exception) {
            // A missing tone is a poor experience, never a reason to drop the call.
            Log.w(TAG, "ringback unavailable: ${e.message}")
            tone = null
        }
    }

    fun stop() {
        try {
            tone?.stopTone()
            tone?.release()
        } catch (e: Exception) {
            Log.w(TAG, "ringback stop failed: ${e.message}")
        }
        tone = null
    }

    private const val TAG = "Ringback"

    /** Loud enough to be unmistakable on an earpiece, short of drowning out the answered call. */
    private const val VOLUME = 70
}
