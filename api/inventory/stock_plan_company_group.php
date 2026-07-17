<?php
// กลุ่มบริษัทที่ทำงานร่วมกันในระบบแพลนรับสินค้า -- เห็นแพลน/รายงาน/ตั้งค่าร่วมกันทั้งกลุ่ม
// 1 = พรีม่าแพสชั่น49, 2 = พรีออนิค (ยืนยันโดย user 2026-07-08 ว่าสองบริษัทนี้ทำงานร่วมกัน)
// บริษัทอื่นที่ไม่อยู่ในกลุ่มยังเห็นเฉพาะของตัวเองตามเดิม

const STOCK_PLAN_COMPANY_GROUPS = [
    [1, 2],
];

/**
 * @return int[] every company id that should share visibility with $companyId (including itself)
 */
function stock_plan_company_ids(int $companyId): array
{
    foreach (STOCK_PLAN_COMPANY_GROUPS as $group) {
        if (in_array($companyId, $group, true)) {
            return $group;
        }
    }
    return [$companyId];
}
