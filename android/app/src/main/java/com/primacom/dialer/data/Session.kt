package com.primacom.dialer.data

import android.content.Context
import android.content.SharedPreferences
import java.util.UUID

/**
 * What this handset remembers between runs: who it belongs to, and which server to ask.
 *
 * The auth token lives here and nowhere else. It is the only credential on the device, so the app
 * never stores a password and signing out is a single clear().
 */
class Session(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("primacom_dialer", Context.MODE_PRIVATE)

    var baseUrl: String
        get() = prefs.getString(KEY_BASE_URL, DEFAULT_BASE_URL) ?: DEFAULT_BASE_URL
        set(value) = prefs.edit().putString(KEY_BASE_URL, value.trimEnd('/')).apply()

    var token: String?
        get() = prefs.getString(KEY_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_TOKEN, value).apply()

    /**
     * Long-lived token belonging to this handset, issued at registration.
     *
     * Preferred over [token] for every call-bridge request. The web session token expires nightly
     * for geo-fenced staff, which is right for a browser and wrong for a phone sitting on a desk.
     */
    var deviceToken: String?
        get() = prefs.getString(KEY_DEVICE_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_DEVICE_TOKEN, value).apply()

    var agentName: String?
        get() = prefs.getString(KEY_AGENT_NAME, null)
        set(value) = prefs.edit().putString(KEY_AGENT_NAME, value).apply()

    /**
     * Stable for the life of the install. Generated here rather than read from the hardware: device
     * identifiers need privileged permissions on modern Android, and the server only needs
     * something that stays the same, not something that identifies the handset globally.
     */
    val deviceId: String
        get() = prefs.getString(KEY_DEVICE_ID, null) ?: UUID.randomUUID().toString()
            .also { prefs.edit().putString(KEY_DEVICE_ID, it).apply() }

    /** Whatever this handset should present as its credential. */
    val authToken: String? get() = deviceToken ?: token

    val isSignedIn: Boolean get() = !authToken.isNullOrBlank()

    fun clear() {
        // deviceId survives a sign-out — the same handset coming back should not look like a new one.
        val device = deviceId
        prefs.edit().clear().putString(KEY_DEVICE_ID, device).apply()
    }

    companion object {
        const val DEFAULT_BASE_URL = "https://www.prima49.com/beta_test/api"

        private const val KEY_BASE_URL = "base_url"
        private const val KEY_TOKEN = "token"
        private const val KEY_DEVICE_TOKEN = "device_token"
        private const val KEY_AGENT_NAME = "agent_name"
        private const val KEY_DEVICE_ID = "device_id"
    }
}
