package com.primacom.dialer.ui

import android.Manifest
import android.app.role.RoleManager
import android.content.pm.PackageManager
import android.telecom.TelecomManager
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.primacom.dialer.R
import com.primacom.dialer.call.CallBridgeService
import com.primacom.dialer.data.Api
import com.primacom.dialer.data.ApiException
import com.primacom.dialer.data.CrashLog
import com.primacom.dialer.data.Session
import kotlinx.coroutines.launch

/**
 * Two states and nothing else: sign in, or stand by.
 *
 * There is no dialpad, no contact list and no call log — not as an omission but as the point. Every
 * control that could put a customer's number on this screen is a hole in the reason this app exists.
 */
class MainActivity : AppCompatActivity() {

    private var permissionsAsked = false
    private lateinit var session: Session
    private lateinit var api: Api

    private val permissions = buildList {
        add(Manifest.permission.CALL_PHONE)
        add(Manifest.permission.READ_PHONE_STATE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            add(Manifest.permission.POST_NOTIFICATIONS)
        }
    }.toTypedArray()

    private val askPermissions =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { render() }

    private val askDialerRole =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { render() }

    /**
     * Holding the dialer role is what stops the stock in-call screen from printing the number.
     * Without it every other precaution in this system is undone by the handset itself.
     */
    private fun isDefaultDialer(): Boolean =
        getSystemService(TelecomManager::class.java)?.defaultDialerPackage == packageName

    private fun requestDialerRole() {
        val roles = getSystemService(RoleManager::class.java) ?: return
        if (!roles.isRoleAvailable(RoleManager.ROLE_DIALER)) return
        askDialerRole.launch(roles.createRequestRoleIntent(RoleManager.ROLE_DIALER))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        session = Session(this)
        api = Api(session)
        render()
    }

    override fun onResume() {
        super.onResume()
        // Draw first, start the bridge second. The old order meant a service the system refused took
        // the whole activity down before the screen that explains the problem could appear.
        render()
        if (session.isSignedIn && missingPermissions().isEmpty()) {
            CallBridgeService.start(this)
        }
    }

    private fun render() {
        if (session.isSignedIn) showStandby() else showSignIn()
    }

    private fun missingPermissions(): List<String> = permissions.filter {
        ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
    }

    // ── sign in ───────────────────────────────────────────────────────────────────────────────

    private fun showSignIn() {
        val root = column()
        val username = EditText(this).apply { hint = getString(R.string.hint_username) }
        val password = EditText(this).apply {
            hint = getString(R.string.hint_password)
            inputType = android.text.InputType.TYPE_CLASS_TEXT or
                android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        val serverUrl = EditText(this).apply {
            hint = getString(R.string.hint_server)
            setText(session.baseUrl)
            textSize = 12f
        }
        val status = TextView(this).apply { setPadding(0, 24, 0, 0) }
        val signIn = Button(this).apply { text = getString(R.string.action_sign_in) }

        signIn.setOnClickListener {
            val u = username.text.toString().trim()
            val p = password.text.toString()
            if (u.isEmpty() || p.isEmpty()) {
                status.text = getString(R.string.error_credentials_required)
                return@setOnClickListener
            }
            session.baseUrl = serverUrl.text.toString().trim()
            signIn.isEnabled = false
            status.text = getString(R.string.status_signing_in)

            lifecycleScope.launch {
                try {
                    api.login(u, p)
                    api.registerDevice(simPhone = null)
                    CallBridgeService.start(this@MainActivity)
                    render()
                } catch (e: ApiException) {
                    status.text = e.message
                } catch (e: Exception) {
                    status.text = getString(R.string.error_network)
                } finally {
                    signIn.isEnabled = true
                }
            }
        }

        root.addView(heading(getString(R.string.app_name)))
        root.addView(username)
        root.addView(password)
        root.addView(serverUrl)
        root.addView(signIn)
        root.addView(status)
        setContentView(root)
    }

    // ── standby ───────────────────────────────────────────────────────────────────────────────

    private fun showStandby() {
        val root = column()
        val missing = missingPermissions()

        root.addView(heading(
            if (missing.isEmpty()) getString(R.string.standby_title)
            else getString(R.string.permissions_needed)
        ))

        // A crash the agent could not otherwise report — these handsets often cannot reach a laptop.
        CrashLog.last(this)?.let { trace ->
            root.addView(TextView(this).apply {
                text = getString(R.string.crash_title)
                setPadding(0, 0, 0, 8)
            })
            root.addView(TextView(this).apply {
                text = trace.lines().take(6).joinToString("\n")
                textSize = 10f
                setTextIsSelectable(true)
                setPadding(24, 16, 24, 16)
                setBackgroundColor(0xFFF3E5E5.toInt())
            })
            root.addView(Button(this).apply {
                text = getString(R.string.action_clear_crash)
                setOnClickListener { CrashLog.clear(this@MainActivity); render() }
            })
        }

        root.addView(TextView(this).apply {
            text = session.agentName ?: ""
            textSize = 18f
            setPadding(0, 8, 0, 24)
        })
        root.addView(TextView(this).apply {
            text = getString(R.string.standby_hint)
            textSize = 13f
        })

        if (isDefaultDialer()) {
            root.addView(TextView(this).apply {
                text = getString(R.string.dialer_role_ok)
                textSize = 13f
                setTextColor(0xFF256E4F.toInt())
                setPadding(0, 24, 0, 0)
            })
        } else {
            root.addView(TextView(this).apply {
                text = getString(R.string.dialer_role_needed)
                textSize = 13f
                setTextColor(0xFF94600A.toInt())
                setPadding(0, 24, 0, 8)
            })
            root.addView(Button(this).apply {
                text = getString(R.string.action_set_dialer)
                setOnClickListener { requestDialerRole() }
            })
        }

        if (missing.isNotEmpty()) {
            root.addView(TextView(this).apply {
                text = getString(R.string.permissions_hint)
                setPadding(0, 32, 0, 8)
            })
            root.addView(Button(this).apply {
                text = getString(R.string.action_grant)
                setOnClickListener { askPermissions.launch(missing.toTypedArray()) }
            })
            // Ask straight away the first time rather than waiting for a tap the agent may not expect.
            if (!permissionsAsked) {
                permissionsAsked = true
                askPermissions.launch(missing.toTypedArray())
            }
        }

        root.addView(View(this).apply {
            layoutParams = LinearLayout.LayoutParams(1, 0, 1f)
        })
        root.addView(Button(this).apply {
            text = getString(R.string.action_sign_out)
            setOnClickListener {
                session.clear()
                stopService(android.content.Intent(this@MainActivity, CallBridgeService::class.java))
                Toast.makeText(this@MainActivity, R.string.signed_out, Toast.LENGTH_SHORT).show()
                render()
            }
        })
        setContentView(root)
    }

    // ── tiny view helpers (no layout files: three screens do not earn a layout system) ────────

    private fun column() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(64, 96, 64, 64)
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.MATCH_PARENT,
        )
    }

    private fun heading(text: String) = TextView(this).apply {
        this.text = text
        textSize = 22f
        gravity = Gravity.START
        setPadding(0, 0, 0, 32)
    }
}
