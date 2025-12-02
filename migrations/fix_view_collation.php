<?php
/**
 * Fix View Collation
 * 
 * This script recreates the view v_telesale_call_overview_monthly
 * with proper collation for month_key column
 */

require_once __DIR__ . '/../api/config.php';

echo "========================================\n";
echo "Fix View Collation\n";
echo "========================================\n\n";

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
    echo "Database: {$dbName}\n";
    echo "Target Collation: utf8mb4_unicode_ci\n\n";
    
    $targetCollation = 'utf8mb4_unicode_ci';
    
    echo "Step 1: Dropping existing view...\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    try {
        $pdo->exec("DROP VIEW IF EXISTS `v_telesale_call_overview_monthly`");
        echo "  [OK] View dropped\n\n";
    } catch (PDOException $e) {
        echo "  [WARN] Could not drop view: " . $e->getMessage() . "\n\n";
    }
    
    echo "Step 2: Recreating view with proper collation...\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    // Recreate view with explicit collation for month_key
    $viewSQL = "
    CREATE VIEW `v_telesale_call_overview_monthly` AS
    WITH
      users_ts AS (
        SELECT 
          u.id AS id,
          u.first_name AS first_name,
          u.role AS role,
          CAST(REPLACE(REPLACE(u.phone, '-', ''), ' ', '') AS CHAR CHARACTER SET utf8mb4) COLLATE {$targetCollation} AS phone0
        FROM users u
        WHERE u.role IN ('Telesale', 'Supervisor Telesale')
      ),
      calls AS (
        SELECT
          uts.id AS user_id,
          CAST(DATE_FORMAT(ocl.timestamp, '%Y-%m') AS CHAR CHARACTER SET utf8mb4) COLLATE {$targetCollation} AS month_key,
          COUNT(*) AS total_calls,
          SUM(CASE WHEN ocl.duration >= 40 THEN 1 ELSE 0 END) AS connected_calls,
          ROUND(SUM(ocl.duration)/60, 2) AS total_minutes
        FROM onecall_log ocl
        JOIN users_ts uts
          ON (
            CAST(
              CASE
                WHEN REGEXP_REPLACE(COALESCE(ocl.phone_telesale, ''), '[^0-9]+', '') LIKE '66%'
                  THEN CONCAT('0', SUBSTRING(REGEXP_REPLACE(COALESCE(ocl.phone_telesale, ''), '[^0-9]+', ''),
                                             CASE WHEN SUBSTRING(REGEXP_REPLACE(COALESCE(ocl.phone_telesale, ''), '[^0-9]+', ''), 3, 1) = '0' THEN 4 ELSE 3 END))
                WHEN REGEXP_REPLACE(COALESCE(ocl.phone_telesale, ''), '[^0-9]+', '') LIKE '0%'
                  THEN REGEXP_REPLACE(COALESCE(ocl.phone_telesale, ''), '[^0-9]+', '')
                ELSE CONCAT('0', REGEXP_REPLACE(COALESCE(ocl.phone_telesale, ''), '[^0-9]+', ''))
              END AS CHAR CHARACTER SET utf8mb4
            ) COLLATE {$targetCollation}
          ) = uts.phone0
        GROUP BY uts.id, DATE_FORMAT(ocl.timestamp, '%Y-%m')
      ),
      attendance AS (
        SELECT
          uts.id AS user_id,
          CAST(DATE_FORMAT(a.work_date, '%Y-%m') AS CHAR CHARACTER SET utf8mb4) COLLATE {$targetCollation} AS month_key,
          SUM(a.attendance_value) AS working_days
        FROM user_daily_attendance a
        JOIN users_ts uts ON uts.id = a.user_id
        GROUP BY uts.id, DATE_FORMAT(a.work_date, '%Y-%m')
      ),
      months AS (
        SELECT user_id, month_key FROM calls
        UNION
        SELECT user_id, month_key FROM attendance
      )
    SELECT
      m.month_key COLLATE {$targetCollation} AS month_key,
      uts.id AS user_id,
      uts.first_name,
      uts.role,
      uts.phone0 AS phone,
      COALESCE(att.working_days, 0) AS working_days,
      COALESCE(c.total_minutes, 0) AS total_minutes,
      COALESCE(c.connected_calls, 0) AS connected_calls,
      COALESCE(c.total_calls, 0) AS total_calls,
      ROUND(
        COALESCE(c.total_minutes, 0) / NULLIF(COALESCE(att.working_days, 0), 0)
      , 2) AS minutes_per_workday
    FROM months m
    JOIN users_ts uts ON uts.id = m.user_id
    LEFT JOIN calls c ON c.user_id = m.user_id AND c.month_key = m.month_key
    LEFT JOIN attendance att ON att.user_id = m.user_id AND att.month_key = m.month_key
    ORDER BY m.month_key DESC, uts.id
    ";
    
    try {
        $pdo->exec($viewSQL);
        echo "  [OK] View recreated with utf8mb4_unicode_ci collation\n\n";
    } catch (PDOException $e) {
        echo "  [ERROR] Failed to create view: " . $e->getMessage() . "\n";
        echo "  SQL: " . substr($viewSQL, 0, 200) . "...\n";
        throw $e;
    }
    
    echo "Step 3: Verifying view collation...\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    $collationCheck = $pdo->query("
        SELECT COLLATION_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '{$dbName}'
            AND TABLE_NAME = 'v_telesale_call_overview_monthly'
            AND COLUMN_NAME = 'month_key'
    ")->fetch(PDO::FETCH_ASSOC);
    
    if ($collationCheck && $collationCheck['COLLATION_NAME'] === $targetCollation) {
        echo "  [SUCCESS] View month_key collation: {$targetCollation}\n";
    } else {
        $actualCollation = $collationCheck['COLLATION_NAME'] ?? 'NULL';
        echo "  [WARN] View month_key collation: {$actualCollation} (expected: {$targetCollation})\n";
    }
    
    echo "\n";
    echo "========================================\n";
    echo "Summary\n";
    echo "========================================\n";
    echo "[SUCCESS] View recreated successfully!\n";
    echo "========================================\n";
    
} catch (Throwable $e) {
    echo "\n[FATAL ERROR] " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}

