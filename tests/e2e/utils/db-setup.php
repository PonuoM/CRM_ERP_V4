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
}
