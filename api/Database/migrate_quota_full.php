<?php
/**
 * ========================================
 * Quota System — Full Migration Script
 * สร้างตาราง 5 ตาราง + ทุก ALTER ในไฟล์เดียว
 * Idempotent: รันซ้ำได้โดยไม่ error
 * Date: 2026-03-23
 * ========================================
 *
 * ตาราง:
 *   1. quota_products          — สินค้าที่มีระบบโควตา
 *   2. quota_rate_schedules    — อัตราโควตา (reset/cumulative/confirm)
 *   3. quota_allocations       — ประวัติแจกโควตา
 *   4. quota_usage             — ประวัติใช้โควตา
 *   5. quota_rate_scope        — rate ใช้ได้กับ product ไหน
 */

require __DIR__ . '/../config.php';
$pdo = db_connect();

$results = [];

// ========================================
// Helper: Check if column exists
// ========================================
function columnExists(PDO $pdo, string $table, string $column): bool {
    $stmt = $pdo->prepare("
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
    ");
    $stmt->execute([$table, $column]);
    return (int)$stmt->fetchColumn() > 0;
}

function tableExists(PDO $pdo, string $table): bool {
    $stmt = $pdo->prepare("
        SELECT COUNT(*) FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
    ");
    $stmt->execute([$table]);
    return (int)$stmt->fetchColumn() > 0;
}

function indexExists(PDO $pdo, string $table, string $indexName): bool {
    $stmt = $pdo->prepare("
        SELECT COUNT(*) FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND INDEX_NAME = ?
    ");
    $stmt->execute([$table, $indexName]);
    return (int)$stmt->fetchColumn() > 0;
}

// ========================================
// 1. quota_products — สินค้าที่มีระบบโควตา
// ========================================
$pdo->exec("
    CREATE TABLE IF NOT EXISTS quota_products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL COMMENT 'FK → products.id',
        company_id INT NOT NULL COMMENT 'FK → companies.id',
        display_name VARCHAR(255) NOT NULL COMMENT 'ชื่อที่แสดงในระบบ',
        csv_label VARCHAR(255) DEFAULT NULL COMMENT 'ชื่อที่แสดงใน CSV export',
        quota_cost INT NOT NULL DEFAULT 1 COMMENT 'จำนวนโควตาที่ต้องใช้ต่อ 1 ชิ้น',
        is_active TINYINT(1) DEFAULT 1,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_product_company (product_id, company_id),
        INDEX idx_company (company_id),
        INDEX idx_active (company_id, is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");
$results[] = "✅ quota_products — OK";

// ========================================
// 2. quota_rate_schedules — อัตราโควตา
// ========================================
$pdo->exec("
    CREATE TABLE IF NOT EXISTS quota_rate_schedules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quota_product_id INT DEFAULT NULL COMMENT 'FK → quota_products.id (NULL = global/scoped)',
        sales_per_quota DECIMAL(10,2) NOT NULL COMMENT 'ยอดขายกี่บาท = 1 โควตา',
        effective_date DATE NOT NULL COMMENT 'มีผลตั้งแต่วันนี้เป็นต้นไป',
        order_date_field ENUM('order_date', 'delivery_date') DEFAULT 'order_date' COMMENT 'ใช้วันไหนคำนวณ',
        quota_mode ENUM('reset','cumulative','confirm') DEFAULT 'reset' COMMENT 'reset=รีเซ็ตตามรอบ, cumulative=สะสม, confirm=กำหนดเอง',
        reset_interval_days INT DEFAULT 30 COMMENT 'จำนวนวันต่อรอบ (mode reset + interval)',
        reset_day_of_month TINYINT DEFAULT NULL COMMENT 'วันที่รีเซ็ตของเดือน 1-28 (mode reset + monthly)',
        reset_anchor_date DATE DEFAULT NULL COMMENT 'วันเริ่มนับรอบ (mode reset + interval)',
        calc_period_start DATE DEFAULT NULL COMMENT 'ช่วงออเดอร์เริ่มต้น (confirm mode)',
        calc_period_end DATE DEFAULT NULL COMMENT 'ช่วงออเดอร์สิ้นสุด (confirm mode)',
        usage_start_date DATE DEFAULT NULL COMMENT 'โควตาเริ่มใช้ได้เมื่อไหร่ (confirm mode)',
        usage_end_date DATE DEFAULT NULL COMMENT 'วันหมดอายุโควตา (confirm mode)',
        require_confirm TINYINT NOT NULL DEFAULT 1 COMMENT '1=รอ admin ยืนยัน, 0=อัตโนมัติ',
        created_by INT DEFAULT NULL COMMENT 'FK → users.id',
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_effective (quota_product_id, effective_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");
$results[] = "✅ quota_rate_schedules — OK";

// Drop old UNIQUE constraint if it exists (conflicts with soft delete)
if (indexExists($pdo, 'quota_rate_schedules', 'uq_product_effective')) {
    $pdo->exec("ALTER TABLE quota_rate_schedules DROP INDEX uq_product_effective");
    $results[] = "  ↳ Dropped uq_product_effective index";
}

// ========================================
// 3. quota_allocations — ประวัติแจกโควตา
// ========================================
$pdo->exec("
    CREATE TABLE IF NOT EXISTS quota_allocations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quota_product_id INT DEFAULT NULL COMMENT 'FK → quota_products.id (NULL = global)',
        user_id INT NOT NULL COMMENT 'FK → users.id (พนักงานที่ได้โควตา)',
        company_id INT NOT NULL,
        quantity DECIMAL(10,2) NOT NULL COMMENT 'จำนวนโควตาที่ให้',
        source VARCHAR(50) NOT NULL DEFAULT 'admin' COMMENT 'auto | admin | auto_confirmed',
        source_detail TEXT DEFAULT NULL COMMENT 'รายละเอียด เช่น order_id, หมายเหตุ',
        allocated_by INT DEFAULT NULL COMMENT 'FK → users.id (admin ที่เพิ่ม)',
        period_start DATE DEFAULT NULL COMMENT 'เริ่มต้นรอบ',
        period_end DATE DEFAULT NULL COMMENT 'สิ้นสุดรอบ',
        valid_from DATE DEFAULT NULL COMMENT 'วันเริ่มมีผล',
        valid_until DATE DEFAULT NULL COMMENT 'วันหมดอายุ',
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_product (user_id, quota_product_id),
        INDEX idx_company (company_id),
        INDEX idx_period (quota_product_id, user_id, period_start, period_end)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");
$results[] = "✅ quota_allocations — OK";

// Ensure valid_from / valid_until columns exist (for existing DBs)
if (!columnExists($pdo, 'quota_allocations', 'valid_from')) {
    $pdo->exec("ALTER TABLE quota_allocations ADD COLUMN valid_from DATE DEFAULT NULL AFTER period_end");
    $results[] = "  ↳ Added valid_from";
}
if (!columnExists($pdo, 'quota_allocations', 'valid_until')) {
    $pdo->exec("ALTER TABLE quota_allocations ADD COLUMN valid_until DATE DEFAULT NULL AFTER valid_from");
    $results[] = "  ↳ Added valid_until";
}

// ========================================
// 4. quota_usage — ประวัติใช้โควตา
// ========================================
$pdo->exec("
    CREATE TABLE IF NOT EXISTS quota_usage (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quota_product_id INT NOT NULL COMMENT 'FK → quota_products.id',
        user_id INT NOT NULL COMMENT 'FK → users.id',
        company_id INT NOT NULL,
        order_id VARCHAR(50) NOT NULL COMMENT 'FK → orders.id',
        quantity_used DECIMAL(10,2) NOT NULL COMMENT 'จำนวนโควตาที่ใช้',
        period_start DATE DEFAULT NULL,
        period_end DATE DEFAULT NULL,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_product (user_id, quota_product_id),
        INDEX idx_order (order_id),
        INDEX idx_period (quota_product_id, user_id, period_start, period_end)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");
$results[] = "✅ quota_usage — OK";

// Add UNIQUE constraint on (order_id, quota_product_id) if not exists
if (!indexExists($pdo, 'quota_usage', 'uq_order_product')) {
    $pdo->exec("ALTER TABLE quota_usage ADD UNIQUE KEY uq_order_product (order_id, quota_product_id)");
    $results[] = "  ↳ Added UNIQUE(order_id, quota_product_id)";
}

// ========================================
// 5. quota_rate_scope — rate ↔ product mapping
// ========================================
$pdo->exec("
    CREATE TABLE IF NOT EXISTS quota_rate_scope (
        rate_schedule_id INT NOT NULL COMMENT 'FK → quota_rate_schedules.id',
        quota_product_id INT NOT NULL COMMENT 'FK → quota_products.id',
        sales_per_quota DECIMAL(12,2) DEFAULT NULL COMMENT 'ยอดขาย/โควตาเฉพาะสินค้านี้ (NULL = ใช้ค่าจาก rate)',
        PRIMARY KEY (rate_schedule_id, quota_product_id),
        INDEX idx_product (quota_product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");
$results[] = "✅ quota_rate_scope — OK";

// Ensure sales_per_quota column exists (for existing DBs that ran create before this migration)
if (!columnExists($pdo, 'quota_rate_scope', 'sales_per_quota')) {
    $pdo->exec("ALTER TABLE quota_rate_scope ADD COLUMN sales_per_quota DECIMAL(12,2) DEFAULT NULL COMMENT 'ยอดขาย/โควตาเฉพาะสินค้านี้ (NULL = ใช้ค่าจาก rate)'");
    $results[] = "  ↳ Added sales_per_quota to quota_rate_scope";
}

// ========================================
// Ensure deleted_at on all tables (for existing DBs)
// ========================================
$tablesNeedDeletedAt = ['quota_products', 'quota_rate_schedules', 'quota_allocations', 'quota_usage'];
foreach ($tablesNeedDeletedAt as $tbl) {
    if (tableExists($pdo, $tbl) && !columnExists($pdo, $tbl, 'deleted_at')) {
        $pdo->exec("ALTER TABLE $tbl ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL");
        $results[] = "  ↳ Added deleted_at to $tbl";
    }
}

// ========================================
// Output Results
// ========================================
header('Content-Type: text/plain; charset=utf-8');
echo "========================================\n";
echo "Quota System Migration — Complete\n";
echo "========================================\n\n";
foreach ($results as $r) {
    echo "$r\n";
}
echo "\n✅ All done!\n";
