<?php
/**
 * Automated Hybrid Test for monthly_transfer_web.php
 * 
 * Tests the dynamic retention logic (Sales Thresholds, Maximum Limits)
 * without needing a full PHPUnit setup.
 */

// Bypass auth for cron testing
define('SKIP_AUTH', true);

// 1. Initialize and Connect
require_once __DIR__ . '/../config.php';
$pdo = db_connect();

echo "<pre>";
echo "=================================================\n";
echo "Starting Hybrid Test for monthly_transfer_web.php\n";
echo "=================================================\n\n";

try {
    // 2. Setup Mock Basket Config
    // We create a mock company, mock baskets (ID 9999 for sales, 9997 for appts), and fallback basket (ID 9998)
    $pdo->exec("INSERT IGNORE INTO companies (id, name, created_at) VALUES (9999, 'Test Company', NOW())");
    $pdo->exec("INSERT IGNORE INTO users (id, username, password, first_name, last_name, company_id) VALUES (999, 'test_cron_user', 'pass', 'Test', 'User', 9999)");
    $pdo->exec("DELETE FROM basket_config WHERE id IN (9996, 9997, 9998, 9999)");
    
    $pdo->exec("
        INSERT INTO basket_config 
        (id, company_id, basket_key, basket_name, fail_after_days, on_fail_basket_key, extend_days_sales_amount_threshold, extend_days_sales_reward, extend_days_per_appointment, max_extend_appointments, max_total_days, is_active)
        VALUES 
        (9998, 9999, 'fallback_basket', 'Fallback Basket', 0, NULL, 0, 0, 0, 0, 0, 1),
        (9999, 9999, 'test_basket_cron', 'Test Basket Sales', 30, 'fallback_basket', 50000, 30, 0, 0, 90, 1),
        (9997, 9999, 'test_basket_appt', 'Test Basket Appt', 30, 'fallback_basket', 0, 0, 30, 0, 90, 1),
        (9996, 9999, 'test_basket_appt_cap', 'Test Basket Appt Capped', 30, 'fallback_basket', 0, 0, 30, 2, 150, 1)
    ");
    echo "✅ Mock Basket Configurations inserted.\n";

    // 3. Clear Old Test Data
    $pdo->exec("DELETE FROM customers WHERE company_id = 9999");
    $pdo->exec("DELETE FROM basket_transition_log WHERE from_basket_key IN ('9999', '9997', '9996')");
    $pdo->exec("DELETE FROM appointments WHERE id IN (9999904, 9999905, 99999061, 99999062, 99999063, 99999071, 99999072, 99999073)");
    echo "✅ Cleaned up old test data.\n";

    // 4. Create Mock Customers
    // -- Sales Logic (ID 9999) --
    // Cust 1: Timeout strictly (Fail). 35 days in basket, 0 sales. (Base limit is 30)
    // Cust 2: Extended by Sales. 35 days in basket, 60,000 sales. (Limit becomes 30 + 30 = 60) -> Kept.
    // Cust 3: Extended by Sales but timed out anyway. 65 days in basket, 60,000 sales -> (Limit is 60), so Fail.
    // -- Appointment Logic (ID 9997) --
    // Cust 4: Extended by Appt. 35 days in basket, 1 appt -> (Limit becomes 30 + 30 = 60) -> Kept.
    // Cust 5: Extended by Appt but timed out anyway. 65 days in basket, 1 appt -> (Limit is 60) -> Fail.
    // -- Appointment Cap Logic (ID 9996, Cap = 2 appts -> max 90 days total) --
    // Cust 6: Capped by Appts. 100 days in basket, 3 appts -> (Uncapped=120, Capped=90) -> Since 100 > 90 -> Fail.
    // Cust 7: Capped by Appts but still safe. 80 days in basket, 3 appts -> (Capped=90) -> Since 80 < 90 -> Kept.
    echo "TRACE 1: About to insert customers\n";
    $pdo->exec("
        INSERT INTO customers 
        (customer_id, company_id, first_name, assigned_to, current_basket_key, basket_entered_date, last_order_date) 
        VALUES
        (9999901, 9999, 'Test_Cust_1_Fail', 999, '9999', DATE_SUB(NOW(), INTERVAL 35 DAY), DATE_SUB(NOW(), INTERVAL 35 DAY)),
        (9999902, 9999, 'Test_Cust_2_Keep', 999, '9999', DATE_SUB(NOW(), INTERVAL 35 DAY), DATE_SUB(NOW(), INTERVAL 35 DAY)),
        (9999903, 9999, 'Test_Cust_3_Fail_Max', 999, '9999', DATE_SUB(NOW(), INTERVAL 65 DAY), DATE_SUB(NOW(), INTERVAL 65 DAY)),
        (9999904, 9999, 'Test_Cust_4_Appt_Keep', 999, '9997', DATE_SUB(NOW(), INTERVAL 35 DAY), DATE_SUB(NOW(), INTERVAL 35 DAY)),
        (9999905, 9999, 'Test_Cust_5_Appt_Fail', 999, '9997', DATE_SUB(NOW(), INTERVAL 65 DAY), DATE_SUB(NOW(), INTERVAL 65 DAY)),
        (9999906, 9999, 'Test_Cust_6_ApptCap_Fail', 999, '9996', DATE_SUB(NOW(), INTERVAL 100 DAY), DATE_SUB(NOW(), INTERVAL 100 DAY)),
        (9999907, 9999, 'Test_Cust_7_ApptCap_Keep', 999, '9996', DATE_SUB(NOW(), INTERVAL 80 DAY), DATE_SUB(NOW(), INTERVAL 80 DAY))
    ");
    echo "TRACE 2: Customers inserted\n";
    
    // Mock Orders for Cust 2 and Cust 3
    echo "TRACE 3: About to delete orders\n";
    $pdo->exec("DELETE FROM orders WHERE customer_id IN (9999902, 9999903)");
    echo "TRACE 4: Orders deleted. About to insert orders\n";
    $pdo->exec("
        INSERT INTO orders (id, customer_id, creator_id, total_amount, order_status, order_date) VALUES
        ('TEST_ORD_9999902', 9999902, 999, 60000, 'Delivered', DATE_SUB(NOW(), INTERVAL 35 DAY)),
        ('TEST_ORD_9999903', 9999903, 999, 60000, 'Delivered', DATE_SUB(NOW(), INTERVAL 65 DAY))
    ");
    echo "TRACE 5: Orders inserted\n";
    
    // Mock Appointments for Cust 4 and Cust 5 (created_at must be >= basket_entered_date to count)
    echo "TRACE 6: About to insert appointments\n";
    $pdo->exec("
        INSERT INTO appointments (id, customer_id, created_at, created_by) VALUES
        (9999904, 9999904, DATE_SUB(NOW(), INTERVAL 10 DAY), 999),
        (9999905, 9999905, DATE_SUB(NOW(), INTERVAL 10 DAY), 999),
        (99999061, 9999906, DATE_SUB(NOW(), INTERVAL 10 DAY), 999),
        (99999062, 9999906, DATE_SUB(NOW(), INTERVAL 9 DAY), 999),
        (99999063, 9999906, DATE_SUB(NOW(), INTERVAL 8 DAY), 999),
        (99999071, 9999907, DATE_SUB(NOW(), INTERVAL 10 DAY), 999),
        (99999072, 9999907, DATE_SUB(NOW(), INTERVAL 9 DAY), 999),
        (99999073, 9999907, DATE_SUB(NOW(), INTERVAL 8 DAY), 999)
    ");
    echo "TRACE 7: Appointments inserted\n";
    echo "✅ Mock Customers and Appointments inserted.\n\n";

    // 5. Run the Cron Script in memory
    echo "--- Executing monthly_transfer_web.php ---\n";
    $_GET['company'] = '9999';
    $_GET['dryrun'] = '0'; // We want real updates
    $_GET['key'] = 'basket_transfer_2026_secret'; // Required by the script
    
    // Capture the output so it doesn't clutter the test result too much
    ob_start();
    require __DIR__ . '/../cron/monthly_transfer_web.php';
    $cronOutput = ob_get_clean();
    echo "--- Cron Execution Complete ---\n\n";

    // 6. Assertions
    $stmt = $pdo->query("SELECT customer_id, current_basket_key, first_name FROM customers WHERE company_id = 9999 ORDER BY customer_id");
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $passed = 0;
    $failed = 0;

    echo "--- Test Results ---\n";
    foreach ($results as $row) {
        if ($row['customer_id'] == 9999901) {
            // Expected: Failed -> moved to fallback_basket (which is ID 9998 in DB)
            if ($row['current_basket_key'] == '9998') {
                echo "✅ Cust 1 (Sales - 0฿, 35 days) : Passed (Moved out correctly)\n"; $passed++;
            } else {
                echo "❌ Cust 1 : Failed (Current Basket is '{$row['current_basket_key']}', expected '9998')\n"; $failed++;
            }
        }
        if ($row['customer_id'] == 9999902) {
            // Expected: Kept -> still in test_basket_cron (ID 9999)
            if ($row['current_basket_key'] == '9999') {
                echo "✅ Cust 2 (Sales - 60k฿, 35 days): Passed (Kept due to sales reward)\n"; $passed++;
            } else {
                echo "❌ Cust 2 : Failed (Current Basket is '{$row['current_basket_key']}', expected '9999')\n"; $failed++;
            }
        }
        if ($row['customer_id'] == 9999903) {
            // Expected: Failed -> moved to fallback_basket (ID 9998)
            if ($row['current_basket_key'] == '9998') {
                echo "✅ Cust 3 (Sales - 60k฿, 65 days): Passed (Moved out because exceeded max total days limit of 60)\n"; $passed++;
            } else {
                echo "❌ Cust 3 : Failed (Current Basket is '{$row['current_basket_key']}', expected '9998')\n"; $failed++;
            }
        }
        if ($row['customer_id'] == 9999904) {
            // Expected: Kept -> still in test_basket_appt (ID 9997)
            if ($row['current_basket_key'] == '9997') {
                echo "✅ Cust 4 (Appt - 1x, 35 days): Passed (Kept due to appointment reward)\n"; $passed++;
            } else {
                echo "❌ Cust 4 : Failed (Current Basket is '{$row['current_basket_key']}', expected '9997')\n"; $failed++;
            }
        }
        if ($row['customer_id'] == 9999905) {
            // Expected: Failed -> moved to fallback_basket (ID 9998)
            if ($row['current_basket_key'] == '9998') {
                echo "✅ Cust 5 (Appt - 1x, 65 days): Passed (Moved out because exceeded max total days limit of 60)\n"; $passed++;
            } else {
                echo "❌ Cust 5 : Failed (Current Basket is '{$row['current_basket_key']}', expected '9998')\n"; $failed++;
            }
        }
        if ($row['customer_id'] == 9999906) {
            // Expected: Failed -> moved to fallback_basket (ID 9998) because capped at 90 days
            if ($row['current_basket_key'] == '9998') {
                echo "✅ Cust 6 (ApptCap - 3x, 100 days): Passed (Moved out because cap limits to 2 appts = 90 days max)\n"; $passed++;
            } else {
                echo "❌ Cust 6 : Failed (Current Basket is '{$row['current_basket_key']}', expected '9998')\n"; $failed++;
            }
        }
        if ($row['customer_id'] == 9999907) {
            // Expected: Kept -> still in test_basket_appt_cap (ID 9996) because within 90 days
            if ($row['current_basket_key'] == '9996') {
                echo "✅ Cust 7 (ApptCap - 3x, 80 days): Passed (Kept because 80 days < capped 90 days)\n"; $passed++;
            } else {
                echo "❌ Cust 7 : Failed (Current Basket is '{$row['current_basket_key']}', expected '9996')\n"; $failed++;
            }
        }
    }

    echo "\n=================================================\n";
    echo "Test Run Summary: $passed Passed, $failed Failed\n";
    echo "=================================================\n";
    
    // Show partial cron output for debugging if something failed
    if ($failed > 0) {
        echo "\n[DEBUG] Cron Output:\n$cronOutput\n";
    }

} catch (Exception $e) {
    echo "\n❌ Test Script Error: " . $e->getMessage() . "\n";
} finally {
    // 7. Cleanup
    $pdo->exec("DELETE FROM customers WHERE company_id = 9999");
    $pdo->exec("DELETE FROM basket_config WHERE id IN (9996, 9997, 9998, 9999)");
    $pdo->exec("DELETE FROM basket_transition_log WHERE from_basket_key IN ('9999', '9997', '9996')");
    $pdo->exec("DELETE FROM appointments WHERE id IN (9999904, 9999905, 99999061, 99999062, 99999063, 99999071, 99999072, 99999073)");
    $pdo->exec("DELETE FROM users WHERE id = 999");
    $pdo->exec("DELETE FROM companies WHERE id = 9999");
    echo "\n✅ Test environment cleaned up.\n";
}
echo "</pre>";
