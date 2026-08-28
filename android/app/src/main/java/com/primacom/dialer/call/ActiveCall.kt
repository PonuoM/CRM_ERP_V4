package com.primacom.dialer.call

import android.telecom.Call

/**
 * The one call in progress, shared between the service that owns it and the screen that shows it.
 *
 * Holds who the customer is — never their number. The number exists only inside the telephony stack
 * and in the dial job that placed the call; nothing here ever surfaces it, because the whole point
 * of replacing the system dialer is that this screen cannot show it.
 */
object ActiveCall {

    /** The telephony handle, so the UI can mute, route audio and hang up. */
    @Volatile
    var call: Call? = null

    /** Set by CallBridgeService just before it dials, so the UI knows who is being called. */
    @Volatile
    var customerName: String = ""

    @Volatile
    var customerId: Int = 0

    @Volatile
    var sessionId: Int = 0

    /** Outbound jobs come with an identity already. Inbound ones are looked up on arrival. */
    @Volatile
    var isInbound: Boolean = false

    fun expect(sessionId: Int, customerId: Int, customerName: String) {
        this.sessionId = sessionId
        this.customerId = customerId
        this.customerName = customerName
        this.isInbound = false
    }

    fun describe(): String = when {
        customerName.isNotBlank() -> customerName
        customerId > 0 -> "ลูกค้า #$customerId"
        else -> "ไม่ทราบผู้ติดต่อ"
    }

    fun clear() {
        call = null
        customerName = ""
        customerId = 0
        sessionId = 0
        isInbound = false
    }
}
