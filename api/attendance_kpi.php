<?php
/**
 * กติกา "วันทำงาน" (KPI) — จุดเดียวที่ตัดสินว่า attendance_value นับเป็นกี่วัน
 *
 * user_daily_attendance.attendance_value เก็บเป็นสัดส่วนของวัน 8 ชม. เสมอ (ชั่วโมง ÷ 8)
 * แต่กะจริงของ Telesale/Supervisor Telesale (role 6/7) วันเสาร์-อาทิตย์คือ 6 ชม.
 * มาครบกะเสาร์จึงนับเป็น 1 วันเต็ม ไม่ใช่ 0.75
 *
 * ตกลงใช้กติกานี้ทุกหน้าเมื่อ 31 ส.ค. 2026 — ก่อนหน้านั้น Call Details V2 /
 * Telesale Performance (แท็บสรุปเดือน) / จัดการเวลา หารด้วย 8 ดิบ ๆ ทำให้
 * "วันทำงาน" ของคนที่มาวันเสาร์ไม่ตรงกันระหว่างหน้า (เช่น 19.1 กับ 19.6)
 * แล้วน้องเทียบ KPI ตัวเองกับที่หัวหน้าเห็นไม่ได้
 *
 * ใช้โดย: User_DB/telesale_daily_performance.php, User_DB/telesale_performance.php,
 *         User_DB/attendance_management.php, Onecall_DB/get_call_overview.php,
 *         Onecall_DB/get_call_overview_v2.php
 * ⚠️ deploy: ไฟล์นี้ถูก require จากไฟล์ข้างบน ต้องอัปขึ้น host พร้อมกันเสมอ
 */

/** จ–ศ = 8 ชม./วัน; ส–อา = 6 ชม./วัน เฉพาะ role 6/7 (Supervisor/Telesale). role อื่น 8 ชม. ทุกวัน */
function kpi_hours_per_work_day(string $date, int $roleId): int {
    $w = (int) date('w', strtotime($date . ' 12:00:00'));
    if (($w === 0 || $w === 6) && in_array($roleId, [6, 7], true)) {
        return 6;
    }
    return 8;
}

/**
 * แปลง attendance_value (สัดส่วนของวัน 8 ชม.) ของวันหนึ่ง ๆ เป็น "วันทำงาน" ตามกติกา KPI
 * เพดาน 1 วันต่อวันเสมอ — ทำเกินกะไม่ทำให้ได้เกิน 1 วัน
 */
function kpi_working_day_fraction($attendanceValue, string $workDate, int $roleId): float {
    $clockHours = min((float) $attendanceValue, 1.0) * 8;
    $hoursPerDay = kpi_hours_per_work_day($workDate, $roleId);
    return $hoursPerDay > 0 ? min($clockHours / $hoursPerDay, 1.0) : 0.0;
}
