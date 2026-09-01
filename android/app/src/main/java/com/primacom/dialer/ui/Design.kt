package com.primacom.dialer.ui

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.LayerDrawable
import android.graphics.drawable.RippleDrawable
import android.content.res.ColorStateList
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewOutlineProvider
import android.widget.LinearLayout
import android.widget.TextView

/**
 * ═══════════════════════════════════════════════════════════════════════
 *  Design v6 — Liquid Glass
 *  ไฟล์นี้คือแหล่งความจริงเดียวของหน้าตาแอป ห้ามฝังค่าสี/ขนาดที่อื่น
 *  ทุกค่าในไฟล์นี้เป็นค่าสุดท้าย ห้ามปัดเศษ ห้ามเปลี่ยนเอง
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  หลักการ 3 ข้อ (ผิดข้อใดข้อหนึ่ง = หน้าตาจะเพี้ยนทันที)
 *
 *  1. กระจกต้องมีแสงสีอยู่ข้างหลัง — ทุกหน้าจอวาง aurora() เป็นเลเยอร์ล่างสุดเสมอ
 *     ถ้าพื้นเป็นสีทึบ กระจกจะกลายเป็นสี่เหลี่ยมเทา ๆ ไม่มีความหมาย
 *
 *  2. ไม่ต้องทำ backdrop-blur จริง — พื้นหลังเราเป็น gradient อยู่แล้ว
 *     เบลอ gradient ได้ gradient เหมือนเดิม เปลืองแรงเปล่า
 *     ใช้ glass() = พื้นขาวโปร่ง + ขอบผมสะท้อนแสง + เงาทิ้ง พอแล้ว
 *
 *  3. ตัวเลขสรุป ชื่อลูกค้า และปุ่มสำคัญ ห้ามอยู่บนกระจก — ใช้พื้นทึบเสมอ
 *     เครื่องวางบนโต๊ะ มองจากมุมเฉียง กระจกทำคอนทราสต์ตก
 */
object Design {

    enum class Mode { DARK, LIGHT }
    var mode: Mode = Mode.DARK
    private fun pick(dark: Int, light: Int) = if (mode == Mode.LIGHT) light else dark

    fun resolveMode(pref: String, ctx: Context): Mode = when (pref) {
        "light" -> Mode.LIGHT
        "dark" -> Mode.DARK
        else -> {
            val night = ctx.resources.configuration.uiMode and
                android.content.res.Configuration.UI_MODE_NIGHT_MASK
            if (night == android.content.res.Configuration.UI_MODE_NIGHT_NO) Mode.LIGHT else Mode.DARK
        }
    }

    // ── พื้นฐาน ────────────────────────────────────────────────────────────
    val bg          get() = pick(0xFF0B0A14.toInt(), 0xFFF7F5F0.toInt())
    val bgCall      get() = 0xFF08100C.toInt()      // หน้าจอสายตอนสนทนา/โทรออก
    val bgIncoming  get() = 0xFF100A08.toInt()      // หน้าจอสายเข้า

    // ── ตัวอักษร (ค่า alpha สำคัญมาก อย่าปัด) ───────────────────────────────
    val ink         get() = pick(0xFFFFFFFF.toInt(), 0xFF16151C.toInt())   // 100%
    val ink85       get() = pick(0xD9FFFFFF.toInt(), 0xD916151C.toInt())   // 85%
    val ink60       get() = pick(0x99EBEBF5.toInt(), 0x9916151C.toInt())   // 60%
    val ink45       get() = pick(0x73EBEBF5.toInt(), 0x7316151C.toInt())   // 45%
    val ink40       get() = pick(0x66EBEBF5.toInt(), 0x6616151C.toInt())   // 40%

    // ── สีเน้น ─────────────────────────────────────────────────────────────
    val green       get() = 0xFF3DDC84.toInt()
    val greenSoft   get() = 0xFF8BEDB6.toInt()      // ตัวอักษรเขียวบนพื้นมืด
    val onGreen     get() = 0xFF04170D.toInt()      // ตัวอักษรบนปุ่มเขียว
    val red         get() = 0xFFFF453A.toInt()
    val redSoft     get() = 0xFFFF9A90.toInt()
    val amber       get() = 0xFFFF9F0A.toInt()
    val amberSoft   get() = 0xFFFFD79B.toInt()

    // ── ชั้นกระจก (ARGB — สองหลักแรกคือ alpha) ──────────────────────────────
    // เพิ่มความขุ่นขาวจากค่าคัมภีร์ (8/10/7%) เพราะไม่มี backdrop-blur ดูดแสง aurora เข้ากระจก
    // กระจกใสบางเลยมืดเกินบนเครื่องจริง — ดันให้ฝ้าขึ้นเหมือน mockup
    val glassFill      = 0x24FFFFFF   // 14% — แผงลิสต์ทั่วไป
    val glassFillHi    = 0x33FFFFFF   // 20% — แถบล่าง ชิปสถานะ
    val glassFillLow   = 0x1FFFFFFF   // 12% — แผงในแผง
    val glassSpecular  = 0x60FFFFFF   // 38% — ขอบบนรับแสง (boost รอบ 2 — รอบแรก 60% ยังจางบนจอจริง)
    val glassSpecHi    = 0x7AFFFFFF   // 48% — ขอบบนของแถบล่าง (เด่นสุด)
    val glassHairline  = 0x1AFFFFFF   // 10% — เส้นคั่นในแผงกระจก
    val glassSelected  = 0x33FFFFFF   // 20% — ปุ่มที่เลือกใน segmented
    val glassSunken    = 0x38000000   // 22% ดำ — ราง segmented
    val sheetFill      = 0xC7141120.toInt()  // 78% — แผ่นเลื่อนขึ้น (ทึบกว่าปกติ)
    val scrim          = 0x8C000000.toInt()  // 55% — ฉากมืดหลัง sheet

    val greenGlass  = 0x383DDC84   // 22% เขียว — อวาตาร์/ชิปเขียว
    val redGlass    = 0x3DFF453A   // 24% แดง
    val amberGlass  = 0x38FF9F0A   // 22% ส้ม

    // ═══ ระยะห่าง ═══════════════════════════════════════════════════════════
    // ขอบจอ 20dp · แผงกระจกร่นจากขอบจอ 18dp (ไม่ใช่ 20 — กระจกต้องลอย)
    // แถบล่างร่น 14dp ทุกด้าน
    fun Context.dp(v: Int): Int =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()
    fun Context.dpf(v: Float): Float =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, resources.displayMetrics)

    // ═══ ตัวอักษร ═══════════════════════════════════════════════════════════
    // ฟอนต์: Anuphan (Google Fonts) — ต้องใส่ใน res/font/ ห้ามใช้ sans-serif ของระบบ
    // เพราะทรงตัวเลขกับหางไทยต่างกันชัดเจน หน้าตาจะไม่ตรงแบบ
    //
    // สเกล (sp):  34 หัวหน้า · 26 ชื่อใหญ่ · 20 หัวข้อกลุ่ม · 17 ค่าในฟอร์ม
    //             16 ชื่อในลิสต์ · 15 body · 13.5 meta · 12.5 label · 10.5 แท็บ
    // ตัวเลขใหญ่: 56 (สรุปวันนี้) · 46 (นาฬิกาในสาย)
    // น้ำหนัก: 600 หัวเรื่องทั้งหมด · 500 เน้น · 400 ปกติ · 300 นาฬิกาในสาย
    // letterSpacing: หัวเรื่อง 34sp/26sp = -0.025em · ตัวเลข 56sp = -0.035em · อื่น ๆ 0
    var fontRegular: Typeface = Typeface.DEFAULT
    var fontMedium: Typeface = Typeface.DEFAULT
    var fontSemi: Typeface = Typeface.DEFAULT
    var fontLight: Typeface = Typeface.DEFAULT

    /** เรียกครั้งเดียวใน App.onCreate() — Anuphan static weights ใน res/font (ตามคัมภีร์) */
    fun loadFonts(ctx: Context) {
        try {
            fontRegular = androidx.core.content.res.ResourcesCompat.getFont(ctx, com.primacom.dialer.R.font.anuphan_regular)!!
            fontMedium  = androidx.core.content.res.ResourcesCompat.getFont(ctx, com.primacom.dialer.R.font.anuphan_medium)!!
            fontSemi    = androidx.core.content.res.ResourcesCompat.getFont(ctx, com.primacom.dialer.R.font.anuphan_semibold)!!
            fontLight   = androidx.core.content.res.ResourcesCompat.getFont(ctx, com.primacom.dialer.R.font.anuphan_light)!!
        } catch (e: Throwable) {
            // คงฟอนต์ระบบถ้าโหลดพลาด
        }
    }

    /** ชื่อเดิม (App.onCreate เรียก initFonts อยู่) */
    fun initFonts(ctx: Context) = loadFonts(ctx)

    fun Context.text(
        value: CharSequence = "",
        size: Float = 15f,
        color: Int = ink,
        face: Typeface = fontRegular,
        gravity: Int = Gravity.START,
        tracking: Float = 0f,
    ) = TextView(this).apply {
        text = value
        textSize = size
        setTextColor(color)
        typeface = face
        this.gravity = gravity
        if (tracking != 0f) letterSpacing = tracking
        includeFontPadding = false
        // ตัวเลขต้องกว้างเท่ากันทุกตัว ไม่งั้นนาฬิกาจะเต้นทุกวินาที
        fontFeatureSettings = "tnum"
    }

    // ═══ AURORA — เลเยอร์ล่างสุดของทุกหน้าจอ ════════════════════════════════
    /**
     * แสงสีนุ่มที่กระจกใช้หักเห — ถ้าไม่มีอันนี้ ดีไซน์พังทั้งใบ
     *
     * ทำด้วย View ที่วาด RadialGradient 3 วง ซ้อนกันแบบ SRC_OVER
     * ต้องเป็น "ลูกคนแรก" ของ FrameLayout ราก แล้วเนื้อหาทับข้างบน
     *
     * @param variant "ready"=เขียว (หน้าปกติ) · "call"=เขียวเข้ม (ในสาย) · "incoming"=ส้ม
     */
    fun Context.aurora(variant: String = "ready"): View = object : View(this) {
        override fun onDraw(canvas: android.graphics.Canvas) {
            val w = width.toFloat(); val h = height.toFloat()
            val p = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG)
            fun blob(cx: Float, cy: Float, r: Float, color: Int) {
                p.shader = android.graphics.RadialGradient(
                    cx, cy, r, color, color and 0x00FFFFFF, android.graphics.Shader.TileMode.CLAMP)
                canvas.drawCircle(cx, cy, r, p)
            }
            // หมายเหตุ: boost alpha ~1.5x + ลดรัศมี ~0.85x จากค่าคัมภีร์
            // เพราะ RadialGradient บนเครื่องจริงกระจายกว้าง/จางกว่า radial-gradient ของ CSS
            // (ค่าเดิมให้พื้นเกือบดำ ไม่เรืองเหมือน .dc.html) — จุดเดียวที่ขยับจากสเปกเพื่อให้ตรงตา
            when (variant) {
                "incoming" -> {
                    blob(w * 0.50f, h * -0.04f, w * 0.82f, 0xC7FF9F0A.toInt())
                    blob(w * 0.08f, h * 0.34f, w * 0.70f, 0x7BD9453C.toInt())
                    blob(w * 0.92f, h * 0.96f, w * 0.78f, 0x6A6E56F0)
                }
                "call" -> {
                    blob(w * 0.50f, h * -0.02f, w * 0.80f, 0xA83DDC84.toInt())
                    blob(w * 0.96f, h * 0.40f, w * 0.66f, 0x722896C8)
                    blob(w * 0.04f, h * 0.92f, w * 0.78f, 0x636E56F0)
                }
                else -> {
                    blob(w * 0.12f, h * 0.02f, w * 0.75f, 0x8A3DDC84.toInt())
                    blob(w * 0.96f, h * 0.14f, w * 0.70f, 0xA06E56F0.toInt())
                    blob(w * 0.50f, h * 1.04f, w * 0.85f, 0x732878BE)
                }
            }
        }
    }.apply {
        setLayerType(View.LAYER_TYPE_SOFTWARE, null)   // RadialGradient ต้องใช้ software layer
        layoutParams = android.widget.FrameLayout.LayoutParams(
            android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
            android.widget.FrameLayout.LayoutParams.MATCH_PARENT)
    }

    // ═══ GLASS — แผงกระจก ═══════════════════════════════════════════════════
    /**
     * พื้นกระจก 1 ชั้น = สีขาวโปร่ง + ขอบผมสะท้อนแสง
     *
     * "ขอบบนรับแสง" คือสิ่งที่ทำให้มันดูเป็นกระจกจริง ไม่ใช่แค่โปร่งใส
     * ทำด้วย LayerDrawable 2 ชั้น: ชั้นล่างพื้น ชั้นบน stroke สีขาวจาง
     *
     * ใช้คู่กับ elevation เสมอ (ดู applyGlass) เงาทิ้งทำให้รู้ว่ามันลอยอยู่
     */
    fun Context.glass(
        radiusDp: Int,
        fill: Int = glassFill,
        specular: Int = glassSpecular,
    ): LayerDrawable {
        val r = dpf(radiusDp.toFloat())
        // "สันกระจกรับแสง" 3 ชั้น (CSS inset 0 1px 0 white + drop shadow):
        //  [0] topHighlight = ขาว 80% แถบบางๆ 1.5dp ที่ขอบบนสุด — ตัวที่ทำให้ดูเป็นกระจกนูน
        //  [1] sheen       = ไล่บน→ล่าง จาง→0  (inner shadow) หนา 2dp ต่อจาก highlight
        //  [2] body        = พื้นกระจก หลัง sheen 3.5dp จากขอบบน — ปล่อยให้ขอบบนเป็นแสงสะท้อนล้วน
        val topHighlight = GradientDrawable().apply { setColor(0xCCFFFFFF.toInt()); cornerRadius = r }
        val sheen = GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
            intArrayOf(specular, (specular and 0x00FFFFFF) or 0x0D000000)).apply { cornerRadius = r }
        val body = GradientDrawable().apply { cornerRadius = r; setColor(fill) }
        val topGap = dpf(1.5f).toInt()   // highlight หนา 1.5dp
        val sheenH = dp(2)        // sheen หนา 2dp ต่อจาก highlight
        return LayerDrawable(arrayOf(topHighlight, sheen, body)).apply {
            setLayerInset(1, 0, topGap, 0, 0)                  // sheen เริ่ม 1.5dp จากบน
            setLayerInset(2, 0, topGap + sheenH, 0, dp(1))    // body เริ่ม 3.5dp จากบน, 1dp จากล่าง
        }
    }

    /** ติดกระจก + เงาทิ้ง + ตัดมุมให้ลูก ๆ ในคราวเดียว — ใช้ตัวนี้เป็นหลัก */
    fun View.applyGlass(
        radiusDp: Int,
        fill: Int = glassFill,
        specular: Int = glassSpecular,
        elevationDp: Int = 10,
    ) = with(Design) {
        background = context.glass(radiusDp, fill, specular)
        outlineProvider = ViewOutlineProvider.BACKGROUND
        clipToOutline = true
        elevation = context.dpf(elevationDp.toFloat())
        // เงาต้องเป็นสีดำเข้ม ไม่ใช่เทาอ่อนของ Android
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
            outlineAmbientShadowColor = 0xB3000000.toInt()
            outlineSpotShadowColor = 0xB3000000.toInt()
        }
    }

    /** เส้นคั่นในแผงกระจก — ร่นจากซ้ายตามระยะที่แต่ละหน้ากำหนด (ปกติ 16dp) */
    fun Context.glassDivider(insetStartDp: Int = 16): View = View(this).apply {
        setBackgroundColor(glassHairline)
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1))
            .apply { marginStart = dp(insetStartDp) }
    }

    // ═══ ปุ่ม ═══════════════════════════════════════════════════════════════
    /** ปุ่มหลัก — พื้นทึบเสมอ ห้ามเป็นกระจก · radius 17 · padding 17 · 17sp/600 */
    fun Context.primaryButton(label: CharSequence, fill: Int = green, fg: Int = onGreen): TextView =
        text(label, 17f, fg, fontSemi, Gravity.CENTER).apply {
            val base = GradientDrawable().apply { cornerRadius = dpf(17f); setColor(fill) }
            background = RippleDrawable(ColorStateList.valueOf(0x33000000), base, null)
            setPadding(dp(20), dp(17), dp(20), dp(17))
            isClickable = true; isFocusable = true
            elevation = dpf(8f)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                outlineSpotShadowColor = (fill and 0x00FFFFFF) or 0x66000000
            }
        }

    /** ปุ่มรอง — กระจก · radius 17 · 16sp/500 */
    fun Context.glassButton(label: CharSequence, fg: Int = ink): TextView =
        text(label, 16f, fg, fontMedium, Gravity.CENTER).apply {
            background = RippleDrawable(ColorStateList.valueOf(0x22FFFFFF),
                glass(17, glassFillHi, glassSpecular), null)
            setPadding(dp(20), dp(16), dp(20), dp(16))
            isClickable = true; isFocusable = true
        }

    /** ปุ่มกลมในหน้าจอสาย — ปุ่มรับ/วางเป็นสีทึบ ปุ่มรองเป็นกระจก */
    fun Context.callCircle(iconRes: Int, diameterDp: Int, fill: Int, tint: Int, glassy: Boolean): View =
        android.widget.ImageView(this).apply {
            setImageResource(iconRes)
            imageTintList = ColorStateList.valueOf(tint)
            val pad = dp(diameterDp * 5 / 16)
            setPadding(pad, pad, pad, pad)
            background = if (glassy) {
                LayerDrawable(arrayOf(
                    GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(glassFillHi) },
                    GradientDrawable().apply { shape = GradientDrawable.OVAL; setStroke(dp(1), glassSpecular) }))
            } else {
                GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(fill) }
            }
            outlineProvider = ViewOutlineProvider.BACKGROUND
            elevation = if (glassy) dpf(8f) else dpf(14f)
            if (!glassy && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                outlineSpotShadowColor = (fill and 0x00FFFFFF) or 0x80000000.toInt()
            }
            layoutParams = LinearLayout.LayoutParams(dp(diameterDp), dp(diameterDp))
            isClickable = true; isFocusable = true
        }

    /** ชิปสถานะบนหัวจอ — pill กระจก · padding 14x7 · 13.5sp/500 + จุดสี 8dp เรืองแสง */
    fun Context.statusPill(label: CharSequence, dotColor: Int): LinearLayout =
        LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            applyGlass(999, glassFillHi, 0x57FFFFFF, 6)
            setPadding(dp(14), dp(7), dp(14), dp(7))
            addView(View(this@statusPill).apply {
                background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(dotColor) }
                layoutParams = LinearLayout.LayoutParams(dp(8), dp(8)).apply { marginEnd = dp(8) }
            })
            addView(text(label, 13.5f, ink, fontMedium))
        }

    /** อวาตาร์ = ตัวอักษรแรกบนวงกลม — ห้ามใส่รูปลูกค้า */
    fun Context.avatar(letter: String, sizeDp: Int, textSp: Float, fill: Int, fg: Int): TextView =
        text(letter, textSp, fg, fontMedium, Gravity.CENTER).apply {
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(fill) }
            layoutParams = LinearLayout.LayoutParams(dp(sizeDp), dp(sizeDp))
        }

    /** segmented control (ตัวกรอง/โหมดสี) — ราง radius 14 padding 3 · ปุ่ม radius 11 padding 7 · 13.5sp */
    fun Context.segmented(labels: List<String>, activeIndex: Int, onPick: (Int) -> Unit): LinearLayout =
        LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            background = glass(14, glassFillHi, 0x42FFFFFF)
            setPadding(dp(3), dp(3), dp(3), dp(3))
            labels.forEachIndexed { i, s ->
                val on = i == activeIndex
                addView(text(s, 13.5f, if (on) ink else ink60,
                    if (on) fontMedium else fontRegular, Gravity.CENTER).apply {
                    if (on) background = GradientDrawable().apply {
                        cornerRadius = dpf(11f); setColor(glassSelected) }
                    setPadding(0, dp(7), 0, dp(7))
                    isClickable = true
                    setOnClickListener { onPick(i) }
                }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            }
        }

    // ═══════════════════════════════════════════════════════════════════════
    //  COMPAT — ชื่อ/helper เดิม ชี้ไปค่าใหม่ ให้จอที่ยังไม่รื้อ (InCall/Disposition/
    //  ประวัติ/ทีม/ฉัน) คอมไพล์ผ่านระหว่างทยอยรื้อทีละหน้า · จอที่รื้อแล้วเลิกใช้ส่วนนี้
    //  รื้อครบทุกหน้าเมื่อไหร่ค่อยลบทิ้ง (ไม่มี hex ใหม่ ทุกค่าอ้าง token ด้านบน)
    // ═══════════════════════════════════════════════════════════════════════
    val surface       get() = glassFill
    val surfaceHi     get() = glassFillHi
    val sheet         get() = sheetFill
    val line          get() = glassHairline
    val lineFaint     get() = glassHairline
    val ink2          get() = ink85
    val ink3          get() = ink85
    val inkDim        get() = ink60
    val inkFaint      get() = ink45
    val accent        get() = green
    val onAccent      get() = onGreen
    val accentText    get() = greenSoft
    val accentSoftBg  get() = greenGlass
    val accentSoftLine get() = 0x4D3DDC84
    val positive      get() = greenSoft
    val warning       get() = amber
    val danger        get() = red
    val dangerText    get() = redSoft
    val avatarNeutral get() = glassFillHi
    val onSolid       get() = 0xFFFFFFFF.toInt()
    val handle        get() = 0x4DFFFFFF
    val chartIdle     get() = 0x1FFFFFFF
    val timerIdle     get() = ink40

    val faceBold: Typeface get() = fontSemi
    val faceMedium: Typeface get() = fontMedium
    val faceRegular: Typeface get() = fontRegular
    val faceMono: Typeface get() = fontMedium
    val mono: Typeface get() = fontMedium

    fun roundedFill(color: Int, radiusPx: Float): GradientDrawable =
        GradientDrawable().apply { setColor(color); cornerRadius = radiusPx }
    fun roundedStroke(fill: Int, stroke: Int, strokePx: Int, radiusPx: Float): GradientDrawable =
        GradientDrawable().apply { setColor(fill); setStroke(strokePx, stroke); cornerRadius = radiusPx }

    fun Context.title(value: CharSequence, color: Int = ink) =
        text(value, 27f, color, fontSemi, Gravity.CENTER)
    fun Context.label(value: CharSequence, color: Int = ink60) =
        text(value, 12.5f, color, fontMedium, Gravity.CENTER, 0.06f)

    fun Context.screen(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL; setBackgroundColor(bg)
        setPadding(dp(24), dp(28), dp(24), dp(28))
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT)
    }

    fun Context.chip(value: CharSequence, fg: Int, bgTint: Int): TextView =
        text(value, 13f, fg, fontMedium, Gravity.CENTER).apply {
            background = roundedFill(bgTint, dpf(999f)); setPadding(dp(14), dp(7), dp(14), dp(7))
        }

    fun Context.ghostButton(value: CharSequence, fg: Int = ink): TextView =
        text(value, 15f, fg, fontMedium, Gravity.CENTER).apply {
            background = RippleDrawable(ColorStateList.valueOf(0x22FFFFFF),
                GradientDrawable().apply { setStroke(dp(1), glassHairline); cornerRadius = dpf(999f) }, null)
            setPadding(dp(20), dp(15), dp(20), dp(15)); isClickable = true; isFocusable = true
        }

    fun Context.divider(): View = View(this).apply {
        setBackgroundColor(glassHairline)
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1))
    }

    fun Context.flexSpacer(): View = View(this).apply {
        layoutParams = LinearLayout.LayoutParams(1, 0, 1f)
    }

    /** ปุ่มกลมในสาย (ลายเซ็นเดิม) — วงกลมสีทึบ + ป้ายใต้ปุ่ม */
    fun Context.callAction(iconRes: Int, labelText: CharSequence, circleColor: Int,
                           diameterDp: Int = 66, onClick: () -> Unit): LinearLayout {
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL
        }
        col.addView(android.widget.ImageView(this).apply {
            setImageResource(iconRes)
            imageTintList = ColorStateList.valueOf(0xFFFFFFFF.toInt())
            val pad = dp(diameterDp / 4); setPadding(pad, pad, pad, pad)
            background = RippleDrawable(ColorStateList.valueOf(0x40FFFFFF),
                GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(circleColor) }, null)
            layoutParams = LinearLayout.LayoutParams(dp(diameterDp), dp(diameterDp))
            isClickable = true; isFocusable = true; setOnClickListener { onClick() }
        })
        col.addView(label(labelText, ink60).apply { setPadding(0, dp(10), 0, 0) })
        return col
    }

    /** glass เดิมที่รับรัศมีเป็น px (จอเก่าเรียกแบบนี้) — map ไป glass() แบบใหม่ */
    private fun Context.glassPx(radiusPx: Float, fill: Int, spec: Int): android.graphics.drawable.Drawable {
        if (mode != Mode.DARK)
            return GradientDrawable().apply { setColor(0xFFF2F0EA.toInt()); setStroke(dp(1), 0xFFE3DFD6.toInt()); cornerRadius = radiusPx }
        // สันขาวรับแสงขอบบน (เหมือน glass() ใหม่)
        val sheen = GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
            intArrayOf(spec, (spec and 0x00FFFFFF) or 0x0D000000)).apply { cornerRadius = radiusPx }
        val body = GradientDrawable().apply { cornerRadius = radiusPx; setColor(fill) }
        val e = maxOf(1, dp(1))
        return LayerDrawable(arrayOf(sheen, body)).apply { setLayerInset(1, 0, e, 0, e) }
    }
    fun Context.glassPanel(radiusPx: Float): android.graphics.drawable.Drawable = glassPx(radiusPx, glassFill, glassSpecular)
    fun Context.glassHero(radiusPx: Float): android.graphics.drawable.Drawable = glassPx(radiusPx, 0x8C0C0A16.toInt(), 0x38FFFFFF)
    fun Context.glassSheet(radiusPx: Float): android.graphics.drawable.Drawable = glassPx(radiusPx, sheetFill, glassSpecHi)

    fun View.applyBarInsets(
        l: Int = paddingLeft, t: Int = paddingTop, r: Int = paddingRight, b: Int = paddingBottom,
    ) {
        androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(this) { v, insets ->
            val bars = insets.getInsets(androidx.core.view.WindowInsetsCompat.Type.systemBars())
            v.setPadding(l + bars.left, t + bars.top, r + bars.right, b + bars.bottom)
            insets
        }
        if (isAttachedToWindow) androidx.core.view.ViewCompat.requestApplyInsets(this)
        else addOnAttachStateChangeListener(object : View.OnAttachStateChangeListener {
            override fun onViewAttachedToWindow(v: View) {
                androidx.core.view.ViewCompat.requestApplyInsets(v); v.removeOnAttachStateChangeListener(this)
            }
            override fun onViewDetachedFromWindow(v: View) {}
        })
    }
}
