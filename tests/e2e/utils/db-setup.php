<?php
require_once __DIR__ . '/../../../api/config.php';

// Connect explicitly as root for local tests
$testDb = getenv("DB_NAME_TEST") ?: "primacom_mini_erp_test";
$pdo = new PDO("mysql:host=127.0.0.1;dbname={$testDb};charset=utf8mb4", "root", "12345678", [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

$action = $argv[1] ?? '';

if ($action === 'wipe') {
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0;");
    $pdo->exec("TRUNCATE TABLE customers;");
    $pdo->exec("TRUNCATE TABLE orders;");
    $pdo->exec("TRUNCATE TABLE order_items;");
    $pdo->exec("TRUNCATE TABLE order_slips;");
    $pdo->exec("TRUNCATE TABLE customer_grades_config;");
    $pdo->exec("TRUNCATE TABLE customer_grades_settings;");
    $pdo->exec("TRUNCATE TABLE bank_account;");
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1;");
    echo "Wiped successfully";
} elseif ($action === 'seed') {
    $pdo->exec("
        INSERT IGNORE INTO companies (id, name, created_at, updated_at) VALUES 
        (1, 'Test Company 1', NOW(), NOW()),
        (2, 'Test Company 2', NOW(), NOW())
    ");

    $pdo->exec("
        INSERT IGNORE INTO bank_account (id, company_id, bank, bank_number, is_active, created_at, updated_at) VALUES
        (1, 1, 'KBANK', '1234567890', 1, NOW(), NOW())
    ");

    $pdo->exec("
        INSERT IGNORE INTO address_geographies (id, name) VALUES (1, 'ภาคกลาง');
    ");
    $pdo->exec("
        INSERT IGNORE INTO address_provinces (id, name_th, geography_id) VALUES (1, 'กรุงเทพมหานคร', 1);
    ");
    $pdo->exec("
        INSERT IGNORE INTO address_districts (id, name_th, province_id) VALUES (1, 'เขตคลองเตย', 1);
    ");
    $pdo->exec("
        INSERT IGNORE INTO address_sub_districts (id, zip_code, name_th, district_id) VALUES (1, '10110', 'แขวงคลองเตย', 1);
    ");

    $pdo->exec("
        INSERT IGNORE INTO customers (customer_id, customer_ref_id, company_id, first_name, last_name, phone, street, subdistrict, district, province, postal_code, date_assigned, grade, updated_at) VALUES
        (1, 'C001', 1, 'Customer', 'Fixed', '0811111111', '111/1', 'แขวงคลองเตย', 'เขตคลองเตย', 'กรุงเทพมหานคร', '10110', NOW(), 'Normal', NOW()),
        (2, 'C002', 1, 'Customer', 'Relative', '0822222222', '222/2', 'แขวงคลองเตย', 'เขตคลองเตย', 'กรุงเทพมหานคร', '10110', NOW(), 'Normal', NOW()),
        (3, 'C003', 1, 'Customer', 'Realtime', '0833333333', '333/3', 'แขวงคลองเตย', 'เขตคลองเตย', 'กรุงเทพมหานคร', '10110', NOW(), 'Normal', NOW())
    ");

    $pdo->exec("
        INSERT IGNORE INTO users (id, company_id, username, password, role, first_name, last_name, status, created_at, updated_at) VALUES
        (1, 1, 'admin', '\$2y\$10\$wL/H73v0z5A6P15s/L.0I.Lq8h1TIn2qZ/pQ5vYd9d/B9qY5Z8U5W', 'Admin Control', 'System', 'Admin', 'active', NOW(), NOW()),
        (2, 1, 'telesale1', '\$2y\$10\$wL/H73v0z5A6P15s/L.0I.Lq8h1TIn2qZ/pQ5vYd9d/B9qY5Z8U5W', 'Telesale', 'Thida', 'Telesale', 'active', NOW(), NOW()),
        (3, 2, 'admin_co2', '\$2y\$10\$wL/H73v0z5A6P15s/L.0I.Lq8h1TIn2qZ/pQ5vYd9d/B9qY5Z8U5W', 'Admin Page', 'Admin', 'Co 2', 'active', NOW(), NOW())
    ");

    $pdo->exec("
        INSERT IGNORE INTO user_tokens (id, user_id, token, expires_at, created_at) VALUES
        (1, 1, 'test_admin_token_123', DATE_ADD(NOW(), INTERVAL 1 DAY), NOW()),
        (2, 2, 'test_telesale_token_123', DATE_ADD(NOW(), INTERVAL 1 DAY), NOW())
    ");

    $pdo->exec("
        INSERT IGNORE INTO orders (id, company_id, creator_id, customer_id, order_status, total_amount, order_date, delivery_date) VALUES
        ('101', 1, 2, 1, 'Delivered', 10000, '2025-06-01 10:00:00', '2025-06-01 10:00:00'),
        ('102', 1, 2, 1, 'Delivered', 20000, '2026-06-01 10:00:00', '2026-06-01 10:00:00')
    ");

    $pdo->exec("
        INSERT IGNORE INTO orders (id, company_id, creator_id, customer_id, order_status, total_amount, order_date, delivery_date) VALUES
        ('201', 1, 2, 2, 'Delivered', 10000, DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_SUB(CURDATE(), INTERVAL 10 DAY)),
        ('202', 1, 2, 2, 'Delivered', 20000, DATE_SUB(NOW(), INTERVAL 40 DAY), DATE_SUB(CURDATE(), INTERVAL 40 DAY))
    ");
    echo "Seeded successfully";
} elseif ($action === 'get_grade') {
    $customerId = $argv[2] ?? 0;
    $stmt = $pdo->prepare('SELECT grade FROM customers WHERE customer_id = ?');
    $stmt->execute([$customerId]);
    $row = $stmt->fetch();
    echo $row['grade'] ?? '';
} elseif ($action === 'get_co2_grades') {
    $stmt = $pdo->query('SELECT grade_name FROM customer_grades_config WHERE company_id = 2');
    $rows = $stmt->fetchAll();
    echo json_encode($rows);
} elseif ($action === 'get_customer_info') {
    $customerId = $argv[2] ?? 0;
    $stmt = $pdo->prepare("SELECT c.first_name, c.last_name, c.grade, (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE customer_id = c.customer_id AND order_status != 'Cancelled') as total_amount FROM customers c WHERE c.customer_id = ?");
    $stmt->execute([$customerId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    echo json_encode($row);
} elseif ($action === 'seed_finance') {
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0;");
    $pdo->exec("TRUNCATE TABLE statement_reconcile_logs;");
    $pdo->exec("TRUNCATE TABLE statement_reconcile_batches;");
    $pdo->exec("TRUNCATE TABLE cod_records;");
    $pdo->exec("TRUNCATE TABLE cod_documents;");
    $pdo->exec("TRUNCATE TABLE statement_logs;");
    $pdo->exec("TRUNCATE TABLE statement_batchs;");
    $pdo->exec("TRUNCATE TABLE orders;");

    $pdo->exec("
        INSERT IGNORE INTO companies (id, name, created_at, updated_at) VALUES 
        (1, 'Test Company 1', NOW(), NOW())
    ");
    $pdo->exec("
        INSERT IGNORE INTO users (id, company_id, username, password, role, first_name, last_name, status, created_at, updated_at) VALUES
        (1, 1, 'admin', '\$2y\$10\$wL/H73v0z5A6P15s/L.0I.Lq8h1TIn2qZ/pQ5vYd9d/B9qY5Z8U5W', 'Admin Control', 'System', 'Admin', 'active', NOW(), NOW()),
        (2, 1, 'finance', '\$2y\$10\$wL/H73v0z5A6P15s/L.0I.Lq8h1TIn2qZ/pQ5vYd9d/B9qY5Z8U5W', 'Finance', 'Finance', 'User', 'active', NOW(), NOW())
    ");
    $pdo->exec("
        REPLACE INTO user_tokens (id, user_id, token, expires_at, created_at) VALUES
        (1, 1, 'test_admin_token_123', DATE_ADD(NOW(), INTERVAL 1 DAY), NOW()),
        (2, 2, 'test_finance_token_123', DATE_ADD(NOW(), INTERVAL 1 DAY), NOW())
    ");
    $pdo->exec("
        INSERT IGNORE INTO bank_account (id, company_id, bank, bank_number, is_active, created_at, updated_at) VALUES
        (1, 1, 'KBANK', '1234567890', 1, NOW(), NOW())
    ");
    $pdo->exec("
        INSERT IGNORE INTO customers (customer_id, company_id, first_name, last_name, phone) VALUES
        (1, 1, 'Customer', 'Finance', '0899999999')
    ");

    $pdo->exec("
        INSERT IGNORE INTO orders (id, company_id, creator_id, customer_id, order_status, total_amount, payment_method, payment_status, order_date, transfer_date, bank_account_id) VALUES
        ('ORD-MATCH-1', 1, 2, 1, 'Pending', 1000.00, 'Transfer', 'PreApproved', '2023-10-27 10:00:00', '2023-10-27 10:00:00', 1),
        ('ORD-MATCH-2', 1, 2, 1, 'Pending', 1500.00, 'Transfer', 'PreApproved', '2023-10-27 11:00:00', '2023-10-27 11:00:00', 1),
        ('ORD-MATCH-3', 1, 2, 1, 'Pending', 1200.00, 'Transfer', 'PreApproved', '2023-10-27 12:00:00', '2023-10-27 12:00:00', 1),
        ('ORD-MATCH-4', 1, 2, 1, 'Pending', 1200.00, 'Transfer', 'PreApproved', '2023-10-27 12:00:00', '2023-10-27 12:00:00', 1),
        ('ORD-COD-1', 1, 2, 1, 'Confirmed', 3000.00, 'COD', 'PendingVerification', '2023-10-29 10:00:00', NULL, NULL),
        ('ORD-COD-2', 1, 2, 1, 'Confirmed', 2000.00, 'COD', 'PendingVerification', '2023-10-29 11:00:00', NULL, NULL)
    ");

    $pdo->exec("
        INSERT IGNORE INTO statement_batchs (id, company_id, user_id, row_count, transfer_min, transfer_max, created_at) VALUES
        (1, 1, 2, 3, '2023-10-27 00:00:00', '2023-10-27 23:59:59', '2023-10-27 23:59:59'),
        (2, 1, 2, 2, '2023-10-29 00:00:00', '2023-10-29 23:59:59', '2023-10-29 23:59:59')
    ");

    $pdo->exec("
        INSERT IGNORE INTO statement_logs (id, batch_id, transfer_at, amount, bank_account_id) VALUES
        (1, 1, '2023-10-27 10:00:00', 1000.00, 1),
        (2, 1, '2023-10-27 11:05:00', 1500.00, 1),
        (3, 1, '2023-10-27 12:00:00', 1200.00, 1),
        (4, 2, '2023-10-29 10:00:00', 2980.00, 1),
        (5, 2, '2023-10-29 11:00:00', 2000.00, 1)
    ");

    $pdo->exec("
        INSERT IGNORE INTO cod_documents (id, document_number, document_datetime, bank_account_id, company_id, total_input_amount, total_order_amount, status, created_by) VALUES
        (201, 'COD-DOC-001', '2023-10-29 10:00:00', 1, 1, 3000.00, 3000.00, 'pending', 2),
        (202, 'COD-DOC-002', '2023-10-29 11:00:00', 1, 1, 2000.00, 2000.00, 'pending', 2)
    ");

    $pdo->exec("
        INSERT IGNORE INTO cod_records (document_id, order_id, cod_amount, tracking_number) VALUES
        (201, 'ORD-COD-1-1', 3000.00, 'TRACK001'),
        (202, 'ORD-COD-2-1', 2000.00, 'TRACK002')
    ");

    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1;");
    echo "Seeded finance successfully\n";
} elseif ($action === 'get_order_payment_status') {
    $orderId = $argv[2] ?? '';
    $stmt = $pdo->prepare("SELECT payment_status FROM orders WHERE id = ?");
    $stmt->execute([$orderId]);
    echo $stmt->fetchColumn();
} elseif ($action === 'get_cod_document_info') {
    $docId = $argv[2] ?? '';
    $stmt = $pdo->prepare("SELECT status, matched_statement_log_id, shortage_reason FROM cod_documents WHERE id = ?");
    $stmt->execute([$docId]);
    echo json_encode($stmt->fetch(PDO::FETCH_ASSOC));
} elseif ($action === 'get_statement_matched_order') {
    $logId = $argv[2] ?? '';
    $stmt = $pdo->prepare("SELECT order_id FROM statement_reconcile_logs WHERE statement_log_id = ?");
    $stmt->execute([$logId]);
    echo $stmt->fetchColumn();
}
