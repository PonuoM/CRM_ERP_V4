# ตั้งเครื่องพนักงานใหม่ในรอบเดียว: เสียบสาย USB แล้วรันสคริปต์นี้
#
#   .\provision-phone.ps1           ลงแอป + ปิดแอปโทรศัพท์เดิม (ไอคอนเขียวหาย)
#   .\provision-phone.ps1 -Undo     เปิดแอปโทรศัพท์เดิมกลับคืน (ตอนเลิกใช้เครื่อง/คืนเครื่อง)
#
# ต้องเปิด USB debugging บนเครื่องก่อน (Settings > Developer options)
# และกดอนุญาตบนป็อปอัพที่มือถือรอบแรก
#
# ทำไมต้องปิดแอปโทรศัพท์เดิม: มันมีป้ายชวน "ตั้งเป็นค่าเริ่มต้น" ในตัวเอง กดครั้งเดียว
# role หลุดจากแอปเรา ทุกสายกลับไปโชว์เบอร์ลูกค้าบนหน้าจอเดิมทันที ปิดทิ้งคือตัดปุ่มนั้นตั้งแต่ต้น
# (แอปเรามี guard ตรวจจับและหยุดรับงานอยู่แล้วอีกชั้น แต่กันไว้ดีกว่าตามแก้)
#
# ข้อควรรู้: เมื่อปิดแอปโทรศัพท์เดิมแล้ว ถ้าถอนแอปเราออก เครื่องจะโทรปกติไม่ได้
# จนกว่าจะรัน -Undo (โทรฉุกเฉินยังได้ เป็นของระบบคนละส่วน)

param(
    [switch]$Undo
)

$ErrorActionPreference = "Stop"

# แอปโทรศัพท์ติดเครื่องที่รู้จัก แตกต่างตามยี่ห้อ — ปิดเฉพาะตัวที่มีจริงในเครื่องนั้น
$stockDialers = @(
    "com.samsung.android.dialer",   # Samsung
    "com.google.android.dialer",    # Pixel / หลายยี่ห้อที่ใช้ของ Google
    "com.android.dialer"            # AOSP
)

$adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
if (-not (Test-Path $adb)) {
    Write-Host "ไม่พบ adb ที่ $adb — ติดตั้ง Android SDK platform-tools ก่อน" -ForegroundColor Red
    exit 1
}

# ── เช็คว่ามีเครื่องเสียบอยู่และกดอนุญาตแล้ว ──────────────────────────────────────────
$devices = (& $adb devices) | Select-Object -Skip 1 | Where-Object { $_ -match "\S" }
$ready   = $devices | Where-Object { $_ -match "\sdevice$" }
if (-not $ready) {
    if ($devices -match "unauthorized") {
        Write-Host "เครื่องยังไม่อนุญาต — ดูป็อปอัพ 'อนุญาตการดีบัก USB?' บนมือถือแล้วกดอนุญาต" -ForegroundColor Yellow
    } else {
        Write-Host "ไม่พบมือถือ — เช็คสาย USB และเปิด USB debugging ใน Developer options" -ForegroundColor Yellow
    }
    exit 1
}
if (@($ready).Count -gt 1) {
    Write-Host "เสียบไว้หลายเครื่อง — ถอดให้เหลือเครื่องเดียวกันพลาด" -ForegroundColor Red
    exit 1
}

$model = (& $adb shell getprop ro.product.model).Trim()
Write-Host "เครื่อง: $model" -ForegroundColor Cyan

# ── โหมดคืนเครื่อง ────────────────────────────────────────────────────────────────────
if ($Undo) {
    foreach ($pkg in $stockDialers) {
        $out = & $adb shell pm enable $pkg 2>$null
        if ($out -match "enabled") { Write-Host "เปิดคืนแล้ว: $pkg" -ForegroundColor Green }
    }
    Write-Host "เสร็จ — อย่าลืมเข้า Settings ตั้งแอปโทรศัพท์เดิมกลับเป็นค่าเริ่มต้น" -ForegroundColor Cyan
    exit 0
}

# ── ลงแอป ────────────────────────────────────────────────────────────────────────────
# ใช้ release ถ้ามี (ลายเซ็นจริง อัปเดตต่อยอดได้) — debug มีไว้เฉพาะเครื่อง dev
$apkRelease = Join-Path $PSScriptRoot "app\build\outputs\apk\release\app-release.apk"
$apkDebug   = Join-Path $PSScriptRoot "app\build\outputs\apk\debug\app-debug.apk"
if (Test-Path $apkRelease) { $apk = $apkRelease } else { $apk = $apkDebug }
if (-not (Test-Path $apk)) {
    Write-Host "ไม่พบไฟล์ APK — build ก่อน: .\gradlew.bat assembleRelease" -ForegroundColor Red
    exit 1
}

Write-Host "กำลังติดตั้ง $(Split-Path $apk -Leaf) …"
& $adb install -r $apk
if (-not $?) {
    Write-Host "ติดตั้งไม่สำเร็จ — ถ้าขึ้น signature mismatch แปลว่าเครื่องมีแอปคนละลายเซ็นอยู่ ให้ถอนก่อน" -ForegroundColor Red
    exit 1
}

# ── ปิดแอปโทรศัพท์เดิม ────────────────────────────────────────────────────────────────
$installed = & $adb shell pm list packages
foreach ($pkg in $stockDialers) {
    if ($installed -match [regex]::Escape($pkg)) {
        $out = & $adb shell pm disable-user --user 0 $pkg 2>$null
        if ($out -match "disabled") {
            Write-Host "ปิดแล้ว: $pkg" -ForegroundColor Green
        } else {
            Write-Host "ปิดไม่ได้: $pkg — เครื่องรุ่นนี้ป้องกันไว้ ต้องพึ่ง guard ในแอปแทน" -ForegroundColor Yellow
        }
    }
}

# ── เปิดแอปทิ้งไว้ให้ทำขั้นตอนที่เหลือ ─────────────────────────────────────────────────
& $adb shell am start -n com.primacom.dialer/.ui.MainActivity | Out-Null

Write-Host ""
Write-Host "เหลือทำบนมือถือ (สคริปต์ทำแทนไม่ได้ ต้องกดยืนยันเป็นคน):" -ForegroundColor Cyan
Write-Host "  1. ล็อกอินด้วยบัญชีพนักงานคนที่จะใช้เครื่องนี้"
Write-Host "  2. กดอนุญาตสิทธิ์ทั้งหมดที่แอปขอ"
Write-Host "  3. กด 'ตั้งเป็นแอปโทรศัพท์หลัก' แล้วยืนยัน"
Write-Host "  4. เช็คว่าหน้าแอปขึ้น 'เป็นแอปโทรศัพท์หลักแล้ว' ตัวเขียว"
