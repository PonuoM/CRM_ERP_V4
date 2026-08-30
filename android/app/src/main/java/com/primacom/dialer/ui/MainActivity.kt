package com.primacom.dialer.ui

import android.Manifest
import android.app.role.RoleManager
import android.content.pm.PackageManager
import android.graphics.drawable.GradientDrawable
import android.telecom.TelecomManager
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.EditText
import android.widget.ImageView
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
import com.primacom.dialer.ui.Design.chip
import com.primacom.dialer.ui.Design.dp
import com.primacom.dialer.ui.Design.flexSpacer
import com.primacom.dialer.ui.Design.ghostButton
import com.primacom.dialer.ui.Design.label
import com.primacom.dialer.ui.Design.primaryButton
import com.primacom.dialer.ui.Design.text
import kotlinx.coroutines.launch

/**
 * สองสถานะ: เข้าสู่ระบบ หรือวางรอรับงาน
 *
 * ไม่มีแป้นกด ไม่มีรายชื่อ ไม่มีประวัติที่โชว์เบอร์ — ทุกช่องที่อาจพาเบอร์ลูกค้าขึ้นจอถูกตัดออก
 * โดยตั้งใจ หน้าตาใช้ระบบดีไซน์กลางใน Design.kt
 */
class MainActivity : AppCompatActivity() {

    private var permissionsAsked = false
    private lateinit var session: Session
    private lateinit var api: Api

    private val permissions = buildList {
        add(Manifest.permission.CALL_PHONE)
        add(Manifest.permission.READ_PHONE_STATE)
        add(Manifest.permission.READ_CALL_LOG)
        add(Manifest.permission.WRITE_CALL_LOG)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            add(Manifest.permission.POST_NOTIFICATIONS)
        }
    }.toTypedArray()

    private val askPermissions =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { render() }

    private val askDialerRole =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { render() }

    private fun isDefaultDialer(): Boolean =
        getSystemService(TelecomManager::class.java)?.defaultDialerPackage == packageName

    private fun requestDialerRole() {
        val roles = getSystemService(RoleManager::class.java) ?: return
        if (!roles.isRoleAvailable(RoleManager.ROLE_DIALER)) return
        askDialerRole.launch(roles.createRequestRoleIntent(RoleManager.ROLE_DIALER))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Design.bg
        window.navigationBarColor = Design.bg
        session = Session(this)
        api = Api(session)
        render()
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        render()
        if (session.isSignedIn && missingPermissions().isEmpty()) {
            CallBridgeService.start(this)
        }
        if (intent?.getBooleanExtra(EXTRA_REQUEST_ROLE, false) == true) {
            intent.removeExtra(EXTRA_REQUEST_ROLE)
            if (session.isSignedIn && !isDefaultDialer()) requestDialerRole()
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
        val root = screen()
        val username = field(getString(R.string.hint_username))
        val password = field(getString(R.string.hint_password)).apply {
            inputType = android.text.InputType.TYPE_CLASS_TEXT or
                android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        val serverUrl = field(getString(R.string.hint_server)).apply {
            setText(session.baseUrl)
            textSize = 12.5f
        }
        val status = text("", 13.5f, Design.danger).apply { setPadding(0, dp(14), 0, 0) }
        val signIn = primaryButton(getString(R.string.action_sign_in))

        signIn.setOnClickListener {
            val u = username.text.toString().trim()
            val p = password.text.toString()
            if (u.isEmpty() || p.isEmpty()) {
                status.text = getString(R.string.error_credentials_required)
                return@setOnClickListener
            }
            session.baseUrl = serverUrl.text.toString().trim()
            signIn.isEnabled = false
            signIn.alpha = 0.6f
            status.setTextColor(Design.inkDim)
            status.text = getString(R.string.status_signing_in)

            lifecycleScope.launch {
                try {
                    api.login(u, p)
                    api.registerDevice(simPhone = null)
                    CallBridgeService.start(this@MainActivity)
                    render()
                } catch (e: ApiException) {
                    status.setTextColor(Design.danger); status.text = e.message
                } catch (e: Exception) {
                    status.setTextColor(Design.danger); status.text = getString(R.string.error_network)
                } finally {
                    signIn.isEnabled = true; signIn.alpha = 1f
                }
            }
        }

        // โลโก้แบรนด์
        val logo = ImageView(this).apply {
            setImageResource(R.drawable.ic_call)
            imageTintList = android.content.res.ColorStateList.valueOf(Design.onAccent)
            val p = dp(15); setPadding(p, p, p, p)
            background = GradientDrawable().apply {
                setColor(Design.accent); cornerRadius = dp(16).toFloat()
            }
            layoutParams = LinearLayout.LayoutParams(dp(56), dp(56))
        }
        val brandBlock = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(logo)
            addView(text("Primacom Dialer", 24f, Design.ink, Design.faceBold).apply { setPadding(0, dp(22), 0, 0) })
            addView(text("เข้าสู่ระบบด้วยบัญชีพนักงาน", 13.5f, Design.inkDim).apply { setPadding(0, dp(5), 0, 0) })
        }

        root.addView(brandBlock, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = dp(4) })
        root.addView(flexSpacer())
        root.addView(fieldLabel(getString(R.string.hint_username)))
        root.addView(username)
        root.addView(spacer(dp(14)))
        root.addView(fieldLabel(getString(R.string.hint_password)))
        root.addView(password)
        root.addView(spacer(dp(14)))
        root.addView(fieldLabel(getString(R.string.hint_server)))
        root.addView(serverUrl)
        root.addView(spacer(dp(22)))
        root.addView(signIn, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        root.addView(status)
        setContentView(root)
    }

    // ── standby ───────────────────────────────────────────────────────────────────────────────

    private fun showStandby() {
        val root = screen().apply { gravity = Gravity.CENTER_HORIZONTAL }
        val missing = missingPermissions()

        // แถวบน: แบรนด์ + ปุ่มตั้งค่า (ที่ซ่อนปุ่มออกจากระบบไว้)
        val topRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        }
        topRow.addView(label("Primacom Dialer", Design.inkFaint), LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { gravity = Gravity.START })
        topRow.addView(ImageView(this).apply {
            setImageResource(R.drawable.ic_settings)
            imageTintList = android.content.res.ColorStateList.valueOf(Design.inkDim)
            val p = dp(8); setPadding(p, p, p, p)
            layoutParams = LinearLayout.LayoutParams(dp(40), dp(40))
            isClickable = true
            setOnClickListener { showSettings() }
        })
        root.addView(topRow)
        root.addView(spacer(dp(18)))

        // สถานะการเชื่อมต่อ / แอปโทรศัพท์หลัก
        if (isDefaultDialer()) {
            root.addView(chip("● เชื่อมต่อแล้ว · แอปโทรศัพท์หลัก", Design.positive, 0xFF12291F.toInt()))
        } else {
            root.addView(chip("● ยังไม่ได้ตั้งเป็นแอปโทรศัพท์หลัก", Design.warning, 0xFF2A2415.toInt()))
        }
        root.addView(spacer(dp(20)))

        root.addView(text("พร้อมรับงาน", 27f, Design.ink, Design.faceBold, Gravity.CENTER))
        root.addView(text(session.agentName ?: "", 15f, Design.inkDim, gravity = Gravity.CENTER)
            .apply { setPadding(0, dp(6), 0, 0) })

        root.addView(text(getString(R.string.standby_hint), 13f, Design.inkFaint, gravity = Gravity.CENTER)
            .apply { setPadding(0, dp(22), 0, 0); setLineSpacing(dp(4).toFloat(), 1f) })

        // ปุ่มตั้งแอปโทรศัพท์หลัก (เฉพาะตอนยังไม่ได้ตั้ง)
        if (!isDefaultDialer()) {
            root.addView(spacer(dp(22)))
            root.addView(primaryButton(getString(R.string.action_set_dialer)).apply {
                setOnClickListener { requestDialerRole() }
            }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        }

        // สิทธิ์ที่ยังขาด
        if (missing.isNotEmpty()) {
            root.addView(spacer(dp(16)))
            root.addView(ghostButton(getString(R.string.action_grant), Design.warning).apply {
                setOnClickListener { askPermissions.launch(missing.toTypedArray()) }
            }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
            if (!permissionsAsked) {
                permissionsAsked = true
                askPermissions.launch(missing.toTypedArray())
            }
        }

        // รายงานแครชครั้งล่าสุด (เครื่องมักส่งให้ผู้ดูแลไม่ได้ทางอื่น)
        CrashLog.last(this)?.let { trace ->
            root.addView(spacer(dp(24)))
            val box = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                background = Design.roundedStroke(Design.surface, 0xFF3A2320.toInt(), dp(1), dp(12).toFloat())
                setPadding(dp(14), dp(12), dp(14), dp(12))
            }
            box.addView(text(getString(R.string.crash_title), 12f, Design.warning))
            box.addView(text(trace.lines().take(5).joinToString("\n"), 10.5f, Design.inkDim, Design.faceMono)
                .apply { setPadding(0, dp(8), 0, dp(8)); setTextIsSelectable(true) })
            box.addView(text(getString(R.string.action_clear_crash), 12.5f, Design.accent, Design.faceMedium).apply {
                setOnClickListener { CrashLog.clear(this@MainActivity); render() }
            })
            root.addView(box, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        }

        root.addView(flexSpacer())
        root.addView(ghostButton(getString(R.string.action_view_history)).apply {
            setOnClickListener {
                startActivity(android.content.Intent(this@MainActivity, HistoryActivity::class.java))
            }
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        setContentView(root)
    }

    // ── settings (ปุ่มออกจากระบบซ่อนอยู่ที่นี่ ต้องรหัสแอดมิน) ──────────────────────────────────

    private fun showSettings() {
        val root = screen()

        // แถบหัว: ปุ่มย้อนกลับ + ชื่อ
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 0, 0, dp(8))
        }
        bar.addView(ImageView(this).apply {
            setImageResource(R.drawable.ic_arrow_back)
            imageTintList = android.content.res.ColorStateList.valueOf(Design.ink)
            val p = dp(8); setPadding(p, p, p, p)
            layoutParams = LinearLayout.LayoutParams(dp(40), dp(40))
            isClickable = true
            setOnClickListener { render() }
        })
        bar.addView(text(getString(R.string.settings_title), 19f, Design.ink, Design.faceBold).apply {
            setPadding(dp(6), 0, 0, 0)
        })
        root.addView(bar)
        root.addView(spacer(dp(20)))

        // ข้อมูลบัญชี
        root.addView(fieldLabel("บัญชีที่เข้าใช้"))
        root.addView(infoRow(session.agentName ?: "-"))
        root.addView(spacer(dp(28)))

        root.addView(flexSpacer())

        // ออกจากระบบ (ล็อก)
        root.addView(text(getString(R.string.signout_locked), 12.5f, Design.inkFaint, gravity = Gravity.CENTER)
            .apply { setPadding(dp(8), 0, dp(8), dp(12)) })
        root.addView(ghostButton(getString(R.string.action_sign_out), Design.danger).apply {
            setOnClickListener { showAdminSignOutDialog() }
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))

        setContentView(root)
    }

    private fun infoRow(value: String) = text(value, 15.5f, Design.ink).apply {
        background = Design.roundedStroke(Design.surface, Design.line, dp(1), dp(12).toFloat())
        setPadding(dp(14), dp(13), dp(14), dp(13))
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
    }

    /** ยืนยันด้วยบัญชีผู้ดูแลระดับสูงก่อนออกจากระบบ */
    private fun showAdminSignOutDialog() {
        val pad = dp(22)
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, dp(20), pad, dp(4))
        }
        val userField = field(getString(R.string.admin_user_hint))
        val passField = field(getString(R.string.admin_pass_hint)).apply {
            inputType = android.text.InputType.TYPE_CLASS_TEXT or
                android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        val err = text("", 13f, Design.danger).apply { setPadding(dp(2), dp(10), 0, 0) }
        box.addView(text(getString(R.string.signout_admin_desc), 13.5f, Design.inkDim))
        box.addView(spacer(dp(16)))
        box.addView(userField)
        box.addView(spacer(dp(12)))
        box.addView(passField)
        box.addView(err)

        val dialog = androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle(getString(R.string.signout_admin_title))
            .setView(box)
            .setPositiveButton(getString(R.string.action_confirm_signout), null)
            .setNegativeButton(getString(R.string.action_cancel), null)
            .create()

        dialog.setOnShowListener {
            val confirm = dialog.getButton(android.app.AlertDialog.BUTTON_POSITIVE)
            confirm.setOnClickListener {
                val u = userField.text.toString().trim()
                val p = passField.text.toString()
                if (u.isEmpty() || p.isEmpty()) {
                    err.text = getString(R.string.error_credentials_required); return@setOnClickListener
                }
                confirm.isEnabled = false
                err.setTextColor(Design.inkDim); err.text = getString(R.string.verifying)
                lifecycleScope.launch {
                    try {
                        api.verifyAdmin(u, p)
                        session.clear()
                        stopService(android.content.Intent(this@MainActivity, CallBridgeService::class.java))
                        dialog.dismiss()
                        Toast.makeText(this@MainActivity, R.string.signed_out, Toast.LENGTH_SHORT).show()
                        render()
                    } catch (e: ApiException) {
                        err.setTextColor(Design.danger); err.text = e.message; confirm.isEnabled = true
                    } catch (e: Exception) {
                        err.setTextColor(Design.danger); err.text = getString(R.string.error_network); confirm.isEnabled = true
                    }
                }
            }
        }
        dialog.show()
    }

    // ── view helpers ──────────────────────────────────────────────────────────────────────────

    private fun screen() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setBackgroundColor(Design.bg)
        setPadding(dp(24), dp(56), dp(24), dp(32))
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT)
    }

    private fun field(hintText: String) = EditText(this).apply {
        hint = hintText
        setHintTextColor(Design.inkFaint)
        setTextColor(Design.ink)
        textSize = 15.5f
        background = Design.roundedStroke(Design.surface, Design.line, dp(1), dp(12).toFloat())
        setPadding(dp(14), dp(13), dp(14), dp(13))
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
    }

    private fun fieldLabel(t: String) = text(t, 11f, Design.inkFaint, Design.faceMedium).apply {
        letterSpacing = 0.05f
        setPadding(dp(2), 0, 0, dp(7))
    }

    private fun spacer(h: Int) = View(this).apply {
        layoutParams = LinearLayout.LayoutParams(1, h)
    }

    companion object {
        const val EXTRA_REQUEST_ROLE = "request_dialer_role"
    }
}
