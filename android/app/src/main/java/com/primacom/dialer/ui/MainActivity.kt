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
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
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
import com.primacom.dialer.data.CallRecord
import com.primacom.dialer.data.CrashLog
import com.primacom.dialer.data.FollowUp
import com.primacom.dialer.data.Session
import com.primacom.dialer.ui.Design.applyGlass
import com.primacom.dialer.ui.Design.aurora
import com.primacom.dialer.ui.Design.avatar
import com.primacom.dialer.ui.Design.chip
import com.primacom.dialer.ui.Design.dp
import com.primacom.dialer.ui.Design.dpf
import com.primacom.dialer.ui.Design.flexSpacer
import com.primacom.dialer.ui.Design.ghostButton
import com.primacom.dialer.ui.Design.glass
import com.primacom.dialer.ui.Design.glassDivider
import com.primacom.dialer.ui.Design.glassHero
import com.primacom.dialer.ui.Design.glassPanel
import com.primacom.dialer.ui.Design.glassSheet
import com.primacom.dialer.ui.Design.label
import com.primacom.dialer.ui.Design.primaryButton
import com.primacom.dialer.ui.Design.statusPill
import com.primacom.dialer.ui.Design.text
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * สองสถานะ: เข้าสู่ระบบ หรือวางรอรับงาน
 *
 * ไม่มีแป้นกด ไม่มีรายชื่อ ไม่มีประวัติที่โชว์เบอร์ — ทุกช่องที่อาจพาเบอร์ลูกค้าขึ้นจอถูกตัดออก
 * โดยตั้งใจ หน้าตาใช้ระบบดีไซน์กลางใน Design.kt
 */
class MainActivity : AppCompatActivity() {

    private var permissionsAsked = false
    private var currentTab = 0          // 0=หน้าหลัก 1=ประวัติ 2=ฉัน
    private var histFilter = 0          // 0=ทั้งหมด 1=ได้คุย 2=ไม่รับสาย
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
        if (session.isSignedIn) showShell() else showSignIn()
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

    // ── shell (3 แท็บ: หน้าหลัก / ประวัติ / ฉัน) ───────────────────────────────────────────────

    private fun showShell() {
        // โครงร่วม (SCREENS): FrameLayout ราก · [0] aurora · [1] เนื้อหา · [2] แถบแท็บลอยทับ
        val root = FrameLayout(this).apply {
            setBackgroundColor(Design.bg)
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        }
        root.addView(aurora("ready"))   // ต้องเป็นลูกคนแรกเสมอ
        val page = when (currentTab) {
            1 -> historyPage()
            2 -> mePage()
            3 -> teamPage()
            else -> homePage()
        }
        // เผื่อแถบระบบ (บน+ล่าง) ให้เพจ — เนื้อหาเลื่อนใต้แถบแท็บที่ลอยอยู่
        with(Design) { page.applyBarInsets(page.paddingLeft, page.paddingTop, page.paddingRight, page.paddingBottom) }
        root.addView(page, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        root.addView(bottomNav(), FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM))
        setContentView(root)
    }

    /** แถบแท็บล่าง — pill กระจกลอย ร่นขอบ 14 ทุกด้าน · radius 26 · pad 8/6 · elevation 12 */
    private fun bottomNav(): View {
        val wrap = FrameLayout(this)
        androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(wrap) { v, insets ->
            val b = insets.getInsets(androidx.core.view.WindowInsetsCompat.Type.systemBars()).bottom
            v.setPadding(dp(14), dp(6), dp(14), dp(14) + b)
            insets
        }
        val pill = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            applyGlass(26, Design.glassFillHi, Design.glassSpecHi, 12)
            setPadding(dp(8), dp(6), dp(8), dp(6))   // SCREENS: padding 8 บนล่าง 6 ซ้ายขวา
        }
        val items = buildList {
            add(Triple(R.drawable.ic_home, "หน้าหลัก", 0))
            add(Triple(R.drawable.ic_history, "ประวัติ", 1))
            if (session.isSupervisor) add(Triple(R.drawable.ic_group, "ทีม", 3))
            add(Triple(R.drawable.ic_person, "ฉัน", 2))
        }
        items.forEach { (icon, lbl, idx) ->
            pill.addView(navItem(icon, lbl, idx == currentTab) {
                if (currentTab != idx) { currentTab = idx; showShell() }
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        }
        wrap.addView(pill)
        if (wrap.isAttachedToWindow) androidx.core.view.ViewCompat.requestApplyInsets(wrap)
        return wrap
    }

    private fun navItem(iconRes: Int, lbl: String, active: Boolean, onClick: () -> Unit): LinearLayout {
        // เลือก: ink 100% · ไม่เลือก: ink 55% (SCREENS: แถบแท็บล่าง)
        val inactive = (Design.ink and 0x00FFFFFF) or 0x8C000000.toInt()
        val tint = if (active) Design.ink else inactive
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER
            setPadding(0, dp(6), 0, dp(6)); isClickable = true
            if (active) background = Design.roundedFill(Design.glassSelected, dpf(20f))
            setOnClickListener { onClick() }
            addView(ImageView(this@MainActivity).apply {
                setImageResource(iconRes)
                imageTintList = android.content.res.ColorStateList.valueOf(tint)
                layoutParams = LinearLayout.LayoutParams(dp(22), dp(22))
            })
            addView(text(lbl, 10.5f, tint,
                if (active) Design.fontMedium else Design.fontRegular, Gravity.CENTER)
                .apply { setPadding(0, dp(3), 0, 0) })
        }
    }

    // ── แท็บ 1: หน้าหลัก — พร้อมรับงาน + สรุปวันนี้ ────────────────────────────────────────────

    private fun homePage(): View {
        val missing = missingPermissions()
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(0, 0, 0, dp(100))  // ล่างเผื่อแถบแท็บลอย
        }
        val ink55 = (Design.ink and 0x00FFFFFF) or 0x8C000000.toInt()

        // 1) แถวบน — ป้ายซ้าย + ปุ่มค้นหาวงกลม
        val topRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(20), dp(15), dp(20), 0)
        }
        topRow.addView(text("PRIMACOM · พร้อมใช้งาน", 13f, ink55),
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        topRow.addView(ImageView(this).apply {
            setImageResource(R.drawable.ic_search)
            imageTintList = android.content.res.ColorStateList.valueOf(Design.ink)
            val p = dp(9); setPadding(p, p, p, p)
            applyGlass(999, Design.glassFillHi, Design.glassSpecular, 0)
            layoutParams = LinearLayout.LayoutParams(dp(34), dp(34))
            isClickable = true
            setOnClickListener { startActivity(android.content.Intent(this@MainActivity, SearchActivity::class.java)) }
        })
        col.addView(topRow)

        // 2) ชิปสถานะ
        val ready = isDefaultDialer()
        val pill = if (ready) statusPill("พร้อมรับงาน · แอปโทรศัพท์หลัก", Design.green)
        else statusPill("ยังไม่ได้ตั้งเป็นแอปโทรศัพท์หลัก", Design.amber).apply {
            isClickable = true; setOnClickListener { requestDialerRole() }
        }
        col.addView(pill, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            .apply { topMargin = dp(20); marginStart = dp(20) })

        // 3) คำทักทาย 2 บรรทัด
        val agent = session.agentName ?: ""
        col.addView(text("${greeting()}\n$agent", 36f, Design.ink, Design.fontSemi, Gravity.START, -0.025f).apply {
            setLineSpacing(0f, 1.12f); setPadding(dp(20), dp(16), dp(20), 0)
        })

        // 4) การ์ดสรุปวันนี้ (เติมหลังโหลด home)
        val summaryBox = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        }
        col.addView(summaryBox)

        // นัดหมายวันนี้
        val followBox = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        }
        col.addView(followBox)

        // ปุ่มตั้งแอปโทรศัพท์หลัก
        if (!isDefaultDialer()) {
            col.addView(spacer(dp(20)))
            col.addView(primaryButton(getString(R.string.action_set_dialer)).apply {
                setOnClickListener { requestDialerRole() }
            }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        }

        // สิทธิ์ที่ยังขาด
        if (missing.isNotEmpty()) {
            col.addView(spacer(dp(14)))
            col.addView(ghostButton(getString(R.string.action_grant), Design.warning).apply {
                setOnClickListener { askPermissions.launch(missing.toTypedArray()) }
            }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
            if (!permissionsAsked) {
                permissionsAsked = true
                askPermissions.launch(missing.toTypedArray())
            }
        }

        // รายงานแครชครั้งล่าสุด
        CrashLog.last(this)?.let { trace ->
            col.addView(spacer(dp(20)))
            val box = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                background = Design.roundedStroke(Design.surface, 0x33E8544F, dp(1), dp(14).toFloat())
                setPadding(dp(14), dp(12), dp(14), dp(12))
            }
            box.addView(text(getString(R.string.crash_title), 12f, Design.warning))
            box.addView(text(trace.lines().take(5).joinToString("\n"), 10.5f, Design.inkDim, Design.faceMono)
                .apply { setPadding(0, dp(8), 0, dp(8)); setTextIsSelectable(true) })
            box.addView(text(getString(R.string.action_clear_crash), 12.5f, Design.accentText, Design.faceMedium).apply {
                setOnClickListener { CrashLog.clear(this@MainActivity); showShell() }
            })
            col.addView(box, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        }

        loadHome(summaryBox, followBox)
        return ScrollView(this).apply { isFillViewport = true; addView(col) }
    }

    /**
     * ดึงสรุปวันนี้ + นัดหมาย แล้วเติมลงจอ
     * - มีแคชล่าสุด → โชว์ทันที (ไม่กระพริบ) แล้วรีเฟรชเบื้องหลัง
     * - ไม่มีแคช → โชว์ skeleton ระหว่างรอเน็ต ให้รู้สึกว่าจอมาแล้ว
     * โหลดไม่ได้ก็คงของเดิม/skeleton ไว้ จอหลักไม่พัง
     */
    private fun loadHome(summaryBox: LinearLayout, followBox: LinearLayout) {
        val cached = homeCache
        if (cached != null) {
            renderHome(summaryBox, followBox, cached, homeCacheAt)
        } else {
            summaryBox.removeAllViews(); summaryBox.addView(summarySkeleton())
            followBox.removeAllViews(); followBox.addView(followSkeleton())
        }
        lifecycleScope.launch {
            val h = runCatching { api.home() }.getOrNull() ?: return@launch
            homeCache = h; homeCacheAt = System.currentTimeMillis()
            renderHome(summaryBox, followBox, h, homeCacheAt)
            // สถานะหัวหน้าเปลี่ยน → สร้างแท็บล่างใหม่ให้แท็บ "ทีม" โผล่/หาย (รีบิลด์ครั้งเดียว)
            if (h.isSupervisor != session.isSupervisor) {
                session.isSupervisor = h.isSupervisor
                if (currentTab == 3 && !h.isSupervisor) currentTab = 0
                showShell()
            }
        }
    }

    /** วาดการ์ดสรุป + รายการนัดหมายลงกล่อง (ใช้ทั้งตอนโชว์แคชและตอนรีเฟรชเสร็จ) */
    private fun renderHome(summaryBox: LinearLayout, followBox: LinearLayout, h: com.primacom.dialer.data.HomeData, asOf: Long) {
        summaryBox.removeAllViews()
        summaryBox.addView(summaryCard(h, asOf))

        followBox.removeAllViews()
        // หัว "นัดหมายวันนี้" + ลิงก์ "ทั้งหมด" (SCREENS 02 · 5)
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(20), dp(22), dp(20), dp(9)); isClickable = true
            setOnClickListener { startActivity(android.content.Intent(this@MainActivity, AppointmentsActivity::class.java)) }
        }
        header.addView(text("นัดหมายวันนี้", 19f, Design.ink, Design.fontSemi, Gravity.START, -0.01f),
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        header.addView(text("ทั้งหมด", 15f, Design.green))
        followBox.addView(header)

        if (h.followups.isEmpty()) {
            followBox.addView(text("วันนี้ยังไม่มีนัดหมาย", 13.5f, Design.ink45, Design.fontRegular, Gravity.CENTER).apply {
                setPadding(dp(16), dp(16), dp(16), dp(16))
                applyGlass(22, Design.glassFill, Design.glassSpecular, 10)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                    .apply { marginStart = dp(16); marginEnd = dp(16) }
            })
        } else {
            val card = LinearLayout(this@MainActivity).apply {
                orientation = LinearLayout.VERTICAL
                applyGlass(22, Design.glassFill, Design.glassSpecular, 10)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                    .apply { marginStart = dp(16); marginEnd = dp(16) }
            }
            h.followups.forEachIndexed { i, f ->
                if (i > 0) card.addView(glassDivider(16))
                card.addView(followRow(f, i == 0))
            }
            followBox.addView(card)
        }
    }

    /** หนึ่งแถวนัดหมาย (SCREENS 02 · 6): เวลา | ชื่อ/รหัส | ปุ่มโทรเขียวทึบ */
    private fun followRow(f: FollowUp, isNext: Boolean): View {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(16), dp(13), dp(16), dp(13))
        }
        row.addView(text(f.at.ifBlank { "--:--" }, 16f,
            if (isNext) 0xFFFFB340.toInt() else Design.ink60, Design.fontSemi).apply {
            layoutParams = LinearLayout.LayoutParams(dp(48), LinearLayout.LayoutParams.WRAP_CONTENT)
        })
        val mid = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(10), 0, dp(8), 0)
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            if (f.customerId > 0) {
                isClickable = true
                setOnClickListener {
                    startActivity(android.content.Intent(this@MainActivity, CustomerDetailActivity::class.java)
                        .putExtra(CustomerDetailActivity.EXTRA_CUSTOMER_ID, f.customerId))
                }
            }
        }
        mid.addView(text(f.name, 16f, Design.ink))
        mid.addView(text("#${f.customerId}", 13f, Design.ink60).apply { setPadding(0, dp(2), 0, 0) })
        row.addView(mid)
        row.addView(ImageView(this).apply {
            setImageResource(R.drawable.ic_call)
            imageTintList = android.content.res.ColorStateList.valueOf(Design.onGreen)
            val p = dp(9); setPadding(p, p, p, p)
            background = android.graphics.drawable.GradientDrawable().apply {
                shape = android.graphics.drawable.GradientDrawable.OVAL; setColor(Design.green)
            }
            outlineProvider = android.view.ViewOutlineProvider.BACKGROUND
            elevation = dpf(6f)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P)
                outlineSpotShadowColor = (Design.green and 0x00FFFFFF) or 0x80000000.toInt()
            layoutParams = LinearLayout.LayoutParams(dp(36), dp(36))
            isClickable = true
            setOnClickListener {
                showCallConfirm(f.customerId, f.name) {
                    Toast.makeText(this@MainActivity, R.string.calling_back, Toast.LENGTH_SHORT).show()
                    lifecycleScope.launch { runCatching { api.dialCustomer(f.customerId) } }
                }
            }
        })
        return row
    }

    /** การ์ดสรุปวันนี้ (SCREENS 02 · 4) — พื้นทึบ 0x8C0C0A16 ตัวเลข 56sp แถบ gradient */
    private fun summaryCard(h: com.primacom.dialer.data.HomeData, asOf: Long = System.currentTimeMillis()): View {
        val ink65 = (Design.ink and 0x00FFFFFF) or 0xA6000000.toInt()
        val ink75 = (Design.ink and 0x00FFFFFF) or 0xBF000000.toInt()
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            applyGlass(26, 0x8C0C0A16.toInt(), 0x38FFFFFF, 14)
            setPadding(dp(20), dp(20), dp(20), dp(20))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                .apply { marginStart = dp(16); marginEnd = dp(16); topMargin = dp(22) }
        }
        // 4a-c ตัวเลขใหญ่ + "สายวันนี้" + เวลาอัปเดต (จัด baseline ล่าง)
        val big = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.BOTTOM }
        big.addView(text(h.calls.toString(), 56f, Design.ink, Design.fontSemi, Gravity.START, -0.035f)
            .apply { setLineSpacing(0f, 0.88f) })
        big.addView(text("สายวันนี้", 15f, ink65).apply { setPadding(dp(13), 0, 0, dp(7)) },
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { gravity = Gravity.BOTTOM })
        big.addView(text(hm(asOf), 12.5f, Design.ink40).apply { setPadding(0, 0, 0, dp(9)) })
        card.addView(big)

        // 4d แถบสัดส่วน ได้คุย(gradient เขียว)/ไม่รับ(gradient แดง)
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            background = Design.roundedFill(0x1FFFFFFF, dpf(4f))
            clipToOutline = true; outlineProvider = android.view.ViewOutlineProvider.BACKGROUND
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(7))
                .apply { topMargin = dp(18) }
        }
        bar.addView(View(this).apply {
            background = android.graphics.drawable.GradientDrawable(
                android.graphics.drawable.GradientDrawable.Orientation.LEFT_RIGHT,
                intArrayOf(0xFF2FB86E.toInt(), 0xFF3DDC84.toInt()))
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, h.talked.toFloat().coerceAtLeast(0f))
        })
        bar.addView(View(this).apply {
            background = android.graphics.drawable.GradientDrawable(
                android.graphics.drawable.GradientDrawable.Orientation.LEFT_RIGHT,
                intArrayOf(0xFFD9453C.toInt(), 0xFFFF6A5E.toInt()))
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, h.missed.toFloat().coerceAtLeast(0f))
        })
        card.addView(bar)

        // 4e legend
        val legend = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setPadding(0, dp(13), 0, 0) }
        legend.addView(legendItem(Design.green, "ได้คุย ${h.talked}", ink75))
        legend.addView(legendItem(0xFFFF6A5E.toInt(), "ไม่รับ ${h.missed}", ink75),
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                .apply { marginStart = dp(18) })
        card.addView(legend)

        // 4f เส้นคั่น
        card.addView(View(this).apply {
            setBackgroundColor(0x1AFFFFFF)
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1))
                .apply { topMargin = dp(17); bottomMargin = dp(17) }
        })

        // 4g 3 คอลัมน์: เวลาคุยรวม · ขายได้ · เฉลี่ยต่อสาย
        val avg = if (h.talked > 0) h.talkSec / h.talked else 0
        val cols = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        cols.addView(miniStat(talkFmt(h.talkSec), "เวลาคุยรวม", Design.ink))
        cols.addView(miniStat(h.sold.toString(), "ขายได้", Design.green))
        cols.addView(miniStat(talkFmt(avg), "เฉลี่ยต่อสาย", Design.ink))
        card.addView(cols)
        return card
    }

    private fun legendItem(color: Int, label: String, textColor: Int): LinearLayout =
        LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            addView(View(this@MainActivity).apply {
                background = android.graphics.drawable.GradientDrawable().apply {
                    shape = android.graphics.drawable.GradientDrawable.OVAL; setColor(color)
                }
                layoutParams = LinearLayout.LayoutParams(dp(7), dp(7))
            })
            addView(text(label, 13.5f, textColor).apply { setPadding(dp(6), 0, 0, 0) })
        }

    private fun miniStat(value: String, label: String, valueColor: Int): LinearLayout =
        LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            addView(text(value, 20f, valueColor, Design.fontMedium))
            addView(text(label, 12f, Design.ink40).apply { setPadding(0, dp(3), 0, 0) })
        }

    private fun hm(millis: Long): String =
        java.text.SimpleDateFormat("HH:mm", java.util.Locale.US).format(java.util.Date(millis))

    // ── skeleton สรุปวันนี้ (โชว์ระหว่างรอเน็ตครั้งแรก) ──────────────────────────────
    /** บล็อกเทาโค้งมน 1 ชิ้น (โครงร่างข้อมูลที่ยังโหลดไม่เสร็จ) */
    private fun skelBlock(wDp: Int, hDp: Int, topDp: Int = 0, full: Boolean = false): View =
        View(this).apply {
            background = Design.roundedFill(Design.surfaceHi, dp(5).toFloat())
            layoutParams = LinearLayout.LayoutParams(
                if (full) LinearLayout.LayoutParams.MATCH_PARENT else dp(wDp), dp(hDp)
            ).apply { if (topDp > 0) topMargin = dp(topDp) }
        }

    /** อนิเมชันจาง ๆ วนไปมา ให้รู้ว่ากำลังโหลด — ยกเลิกเองเมื่อ view หลุดจากจอ */
    private fun shimmer(target: View) {
        val a = android.animation.ObjectAnimator.ofFloat(target, "alpha", 0.4f, 1f).apply {
            duration = 760
            repeatMode = android.animation.ValueAnimator.REVERSE
            repeatCount = android.animation.ValueAnimator.INFINITE
            interpolator = android.view.animation.AccelerateDecelerateInterpolator()
        }
        target.addOnAttachStateChangeListener(object : View.OnAttachStateChangeListener {
            override fun onViewAttachedToWindow(v: View) { a.start() }
            override fun onViewDetachedFromWindow(v: View) { a.cancel() }
        })
        if (target.isAttachedToWindow) a.start()
    }

    private fun summarySkeleton(): View {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = glassHero(dp(26).toFloat()); elevation = dp(8).toFloat()
            setPadding(dp(18), dp(18), dp(18), dp(18))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        }
        card.addView(skelBlock(84, 12))                 // หัวการ์ด
        card.addView(skelBlock(132, 40, topDp = 14))    // ตัวเลขใหญ่
        card.addView(skelBlock(0, 8, topDp = 18, full = true))  // แถบสัดส่วน
        val cols = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; setPadding(0, dp(22), 0, 0)
        }
        repeat(3) {
            cols.addView(LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                addView(skelBlock(44, 18))
                addView(skelBlock(60, 10, topDp = 7))
            })
        }
        card.addView(cols)
        shimmer(card)
        return card
    }

    private fun followSkeleton(): View {
        val box = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        box.addView(sectionLabel("นัดหมายวันนี้ ›"))
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = glassPanel(dp(14).toFloat()); elevation = dp(6).toFloat()
        }
        repeat(2) { i ->
            if (i > 0) card.addView(View(this).apply {
                setBackgroundColor(Design.line)
                layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1))
                    .apply { marginStart = dp(15); marginEnd = dp(15) }
            })
            card.addView(LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
                setPadding(dp(14), dp(11), dp(14), dp(11))
                addView(View(this@MainActivity).apply {
                    background = GradientDrawable().apply {
                        shape = GradientDrawable.OVAL; setColor(Design.surfaceHi) }
                    layoutParams = LinearLayout.LayoutParams(dp(36), dp(36))
                })
                addView(LinearLayout(this@MainActivity).apply {
                    orientation = LinearLayout.VERTICAL; setPadding(dp(12), 0, 0, 0)
                    addView(skelBlock(120, 13))
                    addView(skelBlock(72, 10, topDp = 6))
                })
            })
        }
        box.addView(card)
        shimmer(box)
        return box
    }

    private fun sectionLabel(t: String) = text(t, 11f, Design.inkFaint, Design.faceMedium).apply {
        letterSpacing = 0.06f; setPadding(dp(2), dp(22), 0, dp(9))
    }

    private fun greeting(): String {
        val h = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
        return when { h < 12 -> "สวัสดีตอนเช้า"; h < 17 -> "สวัสดีตอนบ่าย"; else -> "สวัสดีตอนเย็น" }
    }

    private fun talkFmt(sec: Int): String {
        val h = sec / 3600; val m = (sec % 3600) / 60; val s = sec % 60
        return if (h > 0) String.format("%d:%02d:%02d", h, m, s) else String.format("%d:%02d", m, s)
    }

    private fun avatarColorFor(name: String): Int {
        val palette = intArrayOf(
            0xFF2F9E6E.toInt(), 0xFF3A6FB0.toInt(), 0xFF7A5AA8.toInt(),
            0xFFB0793A.toInt(), 0xFF2E8C93.toInt(), 0xFFA84E7A.toInt())
        return palette[Math.floorMod(name.fold(0) { a, ch -> a + ch.code }, palette.size)]
    }

    /** วงกลมอวาตาร์ = ตัวอักษรแรกของชื่อ (สีจากชื่อ หรือกำหนดเอง) */
    private fun avatarView(name: String, sizeDp: Int, textSp: Float, fill: Int = avatarColorFor(name)): TextView =
        TextView(this).apply {
            text = name.trim().firstOrNull()?.toString() ?: "?"
            setTextColor(0xFFF2F7F7.toInt()); textSize = textSp; typeface = Design.faceBold
            gravity = Gravity.CENTER
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(fill) }
            layoutParams = LinearLayout.LayoutParams(dp(sizeDp), dp(sizeDp))
        }

    // ── แท็บ: ทีม (หัวหน้าเท่านั้น) — คุมลูกทีมแบบเรียลไทม์ ─────────────────────────────────────
    private fun teamPage(): View {
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(20), dp(16), dp(20), dp(24))
        }
        col.addView(text("PRIMACOM · คุมทีม", 10.5f, Design.inkFaint, Design.faceMono).apply { letterSpacing = 0.16f })
        col.addView(text("ทีมของฉัน", 22f, Design.ink, Design.faceBold).apply { setPadding(0, dp(6), 0, 0) })

        val statBox = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(0, dp(16), 0, 0)
        }
        col.addView(statBox)

        val listBox = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(0, dp(6), 0, 0)
        }
        col.addView(listBox)

        loadTeam(statBox, listBox)
        return ScrollView(this).apply { isFillViewport = true; addView(col) }
    }

    /** ดึงทีม + วาด แล้วรีเฟรชเองทุก 15 วิ จนกว่าจะออกจากแท็บ (listBox หลุดจากจอ ลูปจบเอง) */
    private fun loadTeam(statBox: LinearLayout, listBox: LinearLayout) {
        if (listBox.childCount == 0) {
            listBox.addView(text("กำลังโหลดทีม…", 13.5f, Design.inkFaint).apply { setPadding(dp(4), dp(20), 0, 0) })
        }
        lifecycleScope.launch {
            while (isActive && (listBox.isAttachedToWindow || listBox.childCount == 1)) {
                val members = runCatching { api.team() }.getOrNull()
                if (members != null) renderTeam(statBox, listBox, members)
                delay(15_000)
                if (!listBox.isAttachedToWindow) break
            }
        }
    }

    private fun renderTeam(
        statBox: LinearLayout, listBox: LinearLayout,
        members: List<com.primacom.dialer.data.TeamMember>
    ) {
        val onCall = members.count { it.state == "on_call" }
        val online = members.count { it.state == "on_call" || it.state == "calling" || it.state == "online" }

        statBox.removeAllViews()
        val chips = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        chips.addView(teamStat(online.toString(), "ออนไลน์", Design.accentText), statChipLp())
        chips.addView(teamStat(onCall.toString(), "กำลังคุย", Design.positive), statChipLp())
        chips.addView(teamStat(members.size.toString(), "ลูกทีม", Design.ink), statChipLp(last = true))
        statBox.addView(chips)

        listBox.removeAllViews()
        if (members.isEmpty()) {
            listBox.addView(text("ยังไม่มีลูกทีมในความดูแล", 13.5f, Design.inkFaint).apply {
                background = glassPanel(dp(12).toFloat())
                setPadding(dp(15), dp(15), dp(15), dp(15))
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                    .apply { topMargin = dp(12) }
            })
            return
        }
        listBox.addView(sectionLabel("รายชื่อ (${members.size})"))
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = glassPanel(dp(16).toFloat()); elevation = dp(6).toFloat()
        }
        members.forEachIndexed { i, m ->
            if (i > 0) card.addView(View(this).apply {
                setBackgroundColor(Design.line)
                layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1))
                    .apply { marginStart = dp(15); marginEnd = dp(15) }
            })
            card.addView(memberRow(m))
        }
        listBox.addView(card)
    }

    private fun statChipLp(last: Boolean = false) =
        LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            .apply { if (!last) marginEnd = dp(10) }

    private fun teamStat(value: String, label: String, color: Int): View =
        LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = glassPanel(dp(16).toFloat()); elevation = dp(6).toFloat()
            setPadding(dp(14), dp(12), dp(14), dp(12))
            addView(text(value, 22f, color, Design.faceMono))
            addView(text(label, 11f, Design.inkFaint).apply { setPadding(0, dp(2), 0, 0) })
        }

    private fun memberRow(m: com.primacom.dialer.data.TeamMember): View {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(14), dp(12), dp(14), dp(12))
        }
        row.addView(avatarView(m.name, 42, 17f))
        val mid = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(12), 0, dp(8), 0)
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        mid.addView(text(m.name, 15f, Design.ink, Design.faceBold))
        mid.addView(text(memberStatsLine(m), 12f, Design.inkDim).apply { setPadding(0, dp(3), 0, 0) })
        row.addView(mid)
        row.addView(statePill(m))
        return row
    }

    private fun memberStatsLine(m: com.primacom.dialer.data.TeamMember): String {
        val sb = StringBuilder("โทร ${m.calls} · คุย ${m.talked} · ขาย ${m.sold}")
        if (m.appointments > 0) sb.append(" · นัด ${m.appointments}")
        return sb.toString()
    }

    /** ป้ายสถานะสด: จุดสี + ข้อความ (กำลังคุย mm:ss / กำลังโทร / ออนไลน์ / ออฟไลน์) */
    private fun statePill(m: com.primacom.dialer.data.TeamMember): View {
        val label: String; val color: Int; val soft: Int
        when (m.state) {
            "on_call" -> { label = onCallLabel(m); color = Design.positive; soft = Design.accentSoftBg }
            "calling" -> { label = "กำลังโทร";      color = Design.warning;    soft = 0x21E0A93B }
            "online"  -> { label = "ออนไลน์";       color = Design.accentText; soft = Design.accentSoftBg }
            else      -> { label = offlineLabel(m); color = Design.inkFaint;   soft = Design.surfaceHi }
        }
        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            background = Design.roundedFill(soft, dp(999).toFloat())
            setPadding(dp(10), dp(6), dp(11), dp(6))
            addView(View(this@MainActivity).apply {
                background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(color) }
                layoutParams = LinearLayout.LayoutParams(dp(7), dp(7)).apply { marginEnd = dp(6) }
            })
            addView(text(label, 11.5f, color, Design.faceMedium))
        }
    }

    private fun onCallLabel(m: com.primacom.dialer.data.TeamMember): String {
        val s = elapsedSec(m.onCallSince)
        return if (s != null && s in 0..86400) "กำลังคุย ${talkFmt(s)}" else "กำลังคุย"
    }

    private fun offlineLabel(m: com.primacom.dialer.data.TeamMember): String {
        val hm = m.lastSeen?.let { runCatching { it.substring(11, 16) }.getOrNull() }
        return if (hm != null) "ล่าสุด $hm" else "ออฟไลน์"
    }

    /** วินาทีที่ผ่านไปจากเวลา "yyyy-MM-dd HH:mm:ss" (เวลาไทย local เท่ากับเครื่อง) — null ถ้าอ่านไม่ได้ */
    private fun elapsedSec(ts: String?): Int? {
        if (ts.isNullOrBlank()) return null
        return runCatching {
            val f = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.US)
            val t = f.parse(ts)?.time ?: return null
            ((System.currentTimeMillis() - t) / 1000).toInt()
        }.getOrNull()
    }

    // ── แท็บ 2: ประวัติการโทร ─────────────────────────────────────────────────────────────────

    private fun historyPage(): View {
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(0, dp(16), 0, dp(20))
        }
        col.addView(text(getString(R.string.history_title), 21f, Design.ink, Design.faceBold)
            .apply { setPadding(dp(20), 0, dp(20), 0) })

        // ชิปกรอง (แนวนอน เลื่อนได้)
        val filters = listOf("ทั้งหมด", "ได้คุย", "ไม่รับสาย", "ขายได้")
        val chipRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; setPadding(dp(20), dp(14), dp(20), 0)
        }
        filters.forEachIndexed { i, f ->
            chipRow.addView(filterChip(f, i == histFilter) {
                if (histFilter != i) { histFilter = i; showShell() }
            }, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                .apply { marginEnd = dp(8) })
        }
        col.addView(HorizontalScrollView(this).apply { isHorizontalScrollBarEnabled = false; addView(chipRow) })

        val listCol = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(0, dp(16), 0, 0) }
        val status = text(getString(R.string.history_loading), 14f, Design.inkDim, gravity = Gravity.CENTER)
            .apply { setPadding(0, dp(40), 0, 0) }
        listCol.addView(status)
        col.addView(listCol)

        loadHistory(listCol, status)
        return ScrollView(this).apply { isFillViewport = true; addView(col) }
    }

    private fun filterChip(label: String, active: Boolean, onClick: () -> Unit): TextView =
        text(label, 12.5f, if (active) Design.onAccent else Design.ink3,
            if (active) Design.faceBold else Design.faceRegular).apply {
            background = if (active) Design.roundedFill(Design.accent, dp(999).toFloat())
            else glassPanel(dp(999).toFloat())
            setPadding(dp(14), dp(8), dp(14), dp(8)); isClickable = true
            setOnClickListener { onClick() }
        }

    private fun loadHistory(listCol: LinearLayout, status: TextView) {
        lifecycleScope.launch {
            val calls = runCatching { api.history() }.getOrNull()
            if (calls == null) { status.text = getString(R.string.error_network); return@launch }
            val shown = calls.filter { c ->
                when (histFilter) {
                    1 -> c.answered && !c.missed
                    2 -> c.missed
                    3 -> c.result == "ขายได้"
                    else -> true
                }
            }
            if (shown.isEmpty()) { status.text = getString(R.string.history_empty); return@launch }
            listCol.removeAllViews()
            var lastDay = ""
            for (c in shown) {
                val day = dayLabel(c.at)
                if (day != lastDay) {
                    lastDay = day
                    listCol.addView(text(day, 11f, Design.inkFaint, Design.faceMedium).apply {
                        letterSpacing = 0.1f; setPadding(dp(20), dp(16), dp(20), dp(8))
                    })
                }
                listCol.addView(historyRow(c))
            }
        }
    }

    private fun historyRow(c: CallRecord): View {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(20), dp(12), dp(20), dp(12))
        }
        val avColor = if (c.missed) 0x28E8544F else if (c.answered) Design.accentSoftBg else Design.avatarNeutral
        val avInk = if (c.missed) Design.danger else if (c.answered) Design.accentText else Design.ink2
        row.addView(TextView(this).apply {
            text = c.customerName.trim().firstOrNull()?.toString() ?: "?"
            setTextColor(avInk); textSize = 16f; typeface = Design.faceBold; gravity = Gravity.CENTER
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(avColor) }
            layoutParams = LinearLayout.LayoutParams(dp(40), dp(40))
        })
        val mid = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(13), 0, dp(10), 0)
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            if (c.customerId > 0) {
                isClickable = true
                setOnClickListener {
                    startActivity(android.content.Intent(this@MainActivity, CustomerDetailActivity::class.java)
                        .putExtra(CustomerDetailActivity.EXTRA_CUSTOMER_ID, c.customerId))
                }
            }
        }
        mid.addView(text(c.customerName, 15f, Design.ink2, Design.faceMedium))
        mid.addView(text(metaLine(c), 11.5f, if (c.missed) Design.danger else Design.inkDim)
            .apply { setPadding(0, dp(2), 0, 0) })
        row.addView(mid)
        if (c.customerId > 0) row.addView(ImageView(this).apply {
            setImageResource(R.drawable.ic_call)
            imageTintList = android.content.res.ColorStateList.valueOf(Design.accentText)
            val p = dp(10); setPadding(p, p, p, p)
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setStroke(dp(2), 0x80_1E9E63.toInt()) }
            layoutParams = LinearLayout.LayoutParams(dp(38), dp(38))
            isClickable = true
            setOnClickListener {
                showCallConfirm(c.customerId, c.customerName) {
                    Toast.makeText(this@MainActivity, R.string.calling_back, Toast.LENGTH_SHORT).show()
                    lifecycleScope.launch { runCatching { api.dialCustomer(c.customerId) } }
                }
            }
        })
        return row
    }

    private fun metaLine(c: CallRecord): String {
        val parts = mutableListOf<String>()
        when {
            c.status != null -> { parts.add(c.status); c.result?.let { parts.add(it) } }
            c.missed -> parts.add(getString(R.string.call_missed))
            else -> parts.add(if (c.direction == "inbound") getString(R.string.call_in) else getString(R.string.call_out))
        }
        if (c.durationSec > 0 && !c.missed) {
            parts.add("คุย ${c.durationSec / 60}:${String.format("%02d", c.durationSec % 60)}")
        }
        parts.add(timeOf(c.at))
        return parts.joinToString(" · ")
    }

    private fun timeOf(at: String): String = at.substringAfter(' ', "").take(5).ifBlank { at }

    private fun dayLabel(at: String): String {
        val date = at.substringBefore(' ')
        val today = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date())
        val cal = java.util.Calendar.getInstance().apply { add(java.util.Calendar.DAY_OF_YEAR, -1) }
        val yest = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(cal.time)
        return when (date) {
            today -> getString(R.string.day_today)
            yest -> getString(R.string.day_yesterday)
            else -> date
        }
    }

    // ── แท็บ 3: ฉัน (โปรไฟล์ + เครื่อง + ออกจากระบบ) ──────────────────────────────────────────

    private fun mePage(): View {
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(20), dp(16), dp(20), dp(24))
        }
        col.addView(text("ฉัน", 21f, Design.ink, Design.faceBold))

        // การ์ดโปรไฟล์
        val agent = session.agentName ?: "-"
        val prof = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            background = glassPanel(dp(22).toFloat()); elevation = dp(7).toFloat()
            setPadding(dp(16), dp(16), dp(16), dp(16))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                .apply { topMargin = dp(16) }
        }
        prof.addView(avatarView(agent, 54, 22f, Design.accent))
        val pcol = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(14), 0, 0, 0) }
        pcol.addView(text(agent, 18f, Design.ink, Design.faceBold))
        pcol.addView(text("พนักงานขาย", 12f, Design.inkDim).apply { setPadding(0, dp(3), 0, 0) })
        prof.addView(pcol)
        col.addView(prof)

        // เครื่องนี้
        col.addView(sectionLabel("เครื่องนี้"))
        val dev = infoCard()
        dev.addView(kvRow("แอปโทรศัพท์หลัก",
            if (isDefaultDialer()) "● ตั้งแล้ว" else "● ยังไม่ได้ตั้ง",
            if (isDefaultDialer()) Design.accentText else Design.warning))
        dev.addView(kvDivider())
        dev.addView(kvRow("รหัสเครื่อง", session.deviceId, Design.inkDim, mono = true))
        col.addView(dev)

        // การแสดงผล — โหมดสี
        col.addView(sectionLabel("การแสดงผล"))
        val seg = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            background = Design.roundedFill(Design.surfaceHi, dp(14).toFloat())
            setPadding(dp(4), dp(4), dp(4), dp(4))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        }
        val cur = session.themeMode
        listOf("มืด" to "dark", "สว่าง" to "light", "ตามระบบ" to "system").forEach { (lbl, value) ->
            seg.addView(segItem(lbl, value == cur) {
                if (session.themeMode != value) {
                    session.themeMode = value
                    Design.mode = Design.resolveMode(value, this)
                    window.statusBarColor = Design.bg
                    window.navigationBarColor = Design.bg
                    showShell()   // สร้างจอใหม่ด้วยสีใหม่ ค้างที่แท็บฉัน
                }
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        }
        col.addView(seg)

        // อื่น ๆ
        col.addView(sectionLabel("อื่น ๆ"))
        val other = infoCard()
        other.addView(LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(14), 0, dp(14)); isClickable = true
            setOnClickListener { startActivity(android.content.Intent(this@MainActivity, EndOfDayActivity::class.java)) }
            addView(text("สรุปผลงานสิ้นวัน", 13.5f, Design.ink3),
                LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            addView(ImageView(this@MainActivity).apply {
                setImageResource(R.drawable.ic_history)
                imageTintList = android.content.res.ColorStateList.valueOf(Design.inkFaint)
                layoutParams = LinearLayout.LayoutParams(dp(18), dp(18))
            })
        })
        col.addView(other)

        col.addView(spacer(dp(28)))
        col.addView(text(getString(R.string.signout_locked), 12.5f, Design.inkFaint, gravity = Gravity.CENTER)
            .apply { setPadding(dp(8), 0, dp(8), dp(12)) })
        col.addView(ghostButton(getString(R.string.action_sign_out), Design.danger).apply {
            setOnClickListener { showAdminSignOutDialog() }
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))

        return ScrollView(this).apply { isFillViewport = true; addView(col) }
    }

    private fun infoCard() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        background = glassPanel(dp(22).toFloat()); elevation = dp(7).toFloat()
        setPadding(dp(16), 0, dp(16), 0)
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
    }

    private fun kvRow(k: String, v: String, vColor: Int = Design.ink2, mono: Boolean = false): View {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(14), 0, dp(14))
        }
        row.addView(text(k, 13.5f, Design.ink3), LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        row.addView(text(v, if (mono) 12.5f else 13f, vColor, if (mono) Design.faceMono else Design.faceRegular, Gravity.END))
        return row
    }

    private fun segItem(label: String, active: Boolean, onClick: () -> Unit): TextView =
        text(label, 13f, if (active) Design.onAccent else Design.ink3,
            if (active) Design.faceBold else Design.faceRegular, Gravity.CENTER).apply {
            background = if (active) Design.roundedFill(Design.accent, dp(11).toFloat()) else null
            setPadding(0, dp(10), 0, dp(10)); isClickable = true; setOnClickListener { onClick() }
        }

    private fun kvDivider() = View(this).apply {
        setBackgroundColor(Design.lineFaint)
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1))
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
        // ฐาน padding ของเนื้อหา ส่วน status/nav bar เผื่อด้วย insets เพื่อไม่ให้แถบระบบบัง
        setPadding(dp(24), dp(20), dp(24), dp(16))
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT)
        with(Design) { applyBarInsets() }
    }

    private fun field(hintText: String) = EditText(this).apply {
        hint = hintText
        setHintTextColor(Design.inkFaint)
        setTextColor(Design.ink)
        textSize = 15.5f
        background = glassPanel(dp(12).toFloat())
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
        // แคชสรุปวันนี้ (คงอยู่ทั้ง process) — โชว์ทันทีตอนสลับแท็บ/กลับเข้าแอป แล้วรีเฟรชเบื้องหลัง
        private var homeCache: com.primacom.dialer.data.HomeData? = null
        private var homeCacheAt: Long = 0L
    }
}
