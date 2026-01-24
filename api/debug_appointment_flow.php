<?php
/**
 * Debug Appointment Creation and Status Flow
 * 
 * Access via: https://www.prima49.com/beta_test/api/debug_appointment_flow.php?action=XXX
 * 
 * Actions:
 * - test_create: Simulate appointment creation and check what status is saved
 * - check_recent: Show the 20 most recent appointments
 * - check_customer: Show appointments for a specific customer
 * - trace_insert: Check what the INSERT statement would do
 */
require_once __DIR__ . '/config.php';

set_time_limit(0);
header('Content-Type: text/plain; charset=utf-8');

try {
    $pdo = db_connect();
    $action = $_GET['action'] ?? 'info';
    $customerId = $_GET['customerId'] ?? null;
    
    echo "=== Appointment Debug Tool ===\n";
    echo "Time: " . date('Y-m-d H:i:s') . "\n";
    echo "Action: $action\n";
    echo str_repeat("=", 50) . "\n\n";

    switch ($action) {
        case 'info':
            echo "Available actions:\n";
            echo "  ?action=test_create&customerId=XXXX - Test create appointment\n";
            echo "  ?action=check_recent - Show 20 most recent appointments\n";
            echo "  ?action=check_customer&customerId=XXXX - Show appointments for customer\n";
            echo "  ?action=check_status_counts - Count appointments by status\n";
            echo "  ?action=trace_api_version - Check API version deployed\n";
            break;

        case 'trace_api_version':
            echo "--- API Version Check ---\n";
            echo "API_VERSION constant: " . (defined('API_VERSION') ? API_VERSION : 'NOT DEFINED') . "\n";
            
            // Check if the file was actually updated
            $indexFile = __DIR__ . '/index.php';
            echo "index.php modified: " . date('Y-m-d H:i:s', filemtime($indexFile)) . "\n";
            
            // Look for the appointment handling code
            $content = file_get_contents($indexFile);
            if (preg_match("/INSERT INTO appointments.*VALUES.*\?.*\?.*status.*'([^']+)'/", $content, $m)) {
                echo "Default status in INSERT: {$m[1]}\n";
            } else {
                echo "Could not find default status pattern in index.php\n";
            }
            
            // Check what the actual INSERT looks like
            if (preg_match('/INSERT INTO appointments.*VALUES\s*\([^)]+\)/s', $content, $m)) {
                echo "\nActual INSERT pattern found:\n";
                echo substr($m[0], 0, 300) . "...\n";
            }
            break;

        case 'check_status_counts':
            echo "--- Appointment Status Counts ---\n";
            $stmt = $pdo->query("SELECT status, COUNT(*) as cnt FROM appointments GROUP BY status ORDER BY cnt DESC");
            while ($row = $stmt->fetch()) {
                echo "  '{$row['status']}': " . number_format($row['cnt']) . "\n";
            }
            break;

        case 'check_recent':
            echo "--- 20 Most Recent Appointments ---\n";
            $stmt = $pdo->query("
                SELECT a.id, a.customer_id, a.title, a.status, a.date, a.created_at
                FROM appointments a
                ORDER BY a.id DESC
                LIMIT 20
            ");
            $rows = $stmt->fetchAll();
            
            echo sprintf("%-8s %-12s %-30s %-15s %-20s %-20s\n", 
                "ID", "CustomerID", "Title", "Status", "Date", "Created");
            echo str_repeat("-", 110) . "\n";
            
            foreach ($rows as $r) {
                echo sprintf("%-8s %-12s %-30s %-15s %-20s %-20s\n",
                    $r['id'],
                    $r['customer_id'],
                    mb_substr($r['title'] ?? '', 0, 28),
                    $r['status'],
                    $r['date'] ?? 'NULL',
                    $r['created_at'] ?? 'NULL'
                );
            }
            break;

        case 'check_customer':
            if (!$customerId) {
                echo "ERROR: customerId parameter required\n";
                break;
            }
            
            echo "--- Appointments for Customer: $customerId ---\n\n";
            $stmt = $pdo->prepare("
                SELECT a.*, 
                       CASE 
                           WHEN DATE(a.date) < CURDATE() THEN 'PAST'
                           WHEN DATE(a.date) = CURDATE() THEN 'TODAY'
                           ELSE 'FUTURE'
                       END as date_category
                FROM appointments a
                WHERE a.customer_id = ?
                ORDER BY a.date DESC
            ");
            $stmt->execute([$customerId]);
            $rows = $stmt->fetchAll();
            
            echo "Found " . count($rows) . " appointments\n\n";
            
            foreach ($rows as $r) {
                echo "ID: {$r['id']}\n";
                echo "  Title: {$r['title']}\n";
                echo "  Status: {$r['status']}\n";
                echo "  Date: {$r['date']} ({$r['date_category']})\n";
                echo "  Notes: " . ($r['notes'] ?? 'NULL') . "\n";
                echo "  Created: " . ($r['created_at'] ?? 'NULL') . "\n";
                echo "\n";
            }
            break;

        case 'test_create':
            if (!$customerId) {
                echo "ERROR: customerId parameter required\n";
                echo "Usage: ?action=test_create&customerId=XXXX\n";
                break;
            }
            
            echo "--- Test Create Appointment ---\n\n";
            
            // Prepare test data
            $testData = [
                'customerId' => $customerId,
                'date' => date('Y-m-d H:i:s', strtotime('+1 day')),
                'title' => 'DEBUG_TEST_' . time(),
                'status' => 'รอดำเนินการ', // This is what frontend SHOULD send
                'notes' => 'Test created by debug script'
            ];
            
            echo "Input data:\n";
            print_r($testData);
            echo "\n";
            
            // Simulate what the API does
            echo "Executing INSERT with status = 'รอดำเนินการ'...\n";
            
            $stmt = $pdo->prepare('INSERT INTO appointments (customer_id, date, title, status, notes) VALUES (?,?,?,?,?)');
            $stmt->execute([
                $testData['customerId'],
                $testData['date'],
                $testData['title'],
                $testData['status'],
                $testData['notes']
            ]);
            
            $newId = $pdo->lastInsertId();
            echo "Created appointment ID: $newId\n\n";
            
            // Now read it back
            echo "Reading back from database...\n";
            $stmt = $pdo->prepare("SELECT * FROM appointments WHERE id = ?");
            $stmt->execute([$newId]);
            $created = $stmt->fetch();
            
            echo "Database record:\n";
            print_r($created);
            
            // Check the status
            echo "\n--- STATUS CHECK ---\n";
            if ($created['status'] === 'รอดำเนินการ') {
                echo "✅ SUCCESS: Status is correctly 'รอดำเนินการ'\n";
            } else {
                echo "❌ PROBLEM: Status is '{$created['status']}' instead of 'รอดำเนินการ'\n";
                echo "   This means something is changing the status after INSERT!\n";
            }
            
            // Clean up test record
            echo "\nCleaning up test record...\n";
            $pdo->prepare("DELETE FROM appointments WHERE id = ?")->execute([$newId]);
            echo "Deleted test appointment ID: $newId\n";
            break;

        case 'trace_triggers':
            echo "--- Check for Database Triggers ---\n";
            $stmt = $pdo->query("SHOW TRIGGERS LIKE 'appointments'");
            $triggers = $stmt->fetchAll();
            
            if (empty($triggers)) {
                echo "No triggers found on appointments table\n";
            } else {
                echo "Found " . count($triggers) . " triggers:\n";
                print_r($triggers);
            }
            break;

        case 'simulate_api_post':
            echo "--- Simulate API POST behavior ---\n\n";
            
            // This simulates what the API would receive and process
            $mockInput = [
                'customerId' => $customerId ?? '302970',
                'date' => date('Y-m-d H:i:s', strtotime('+1 day')),
                'title' => 'API_SIMULATION_' . time(),
                'status' => 'ใหม่', // Original frontend value
                'notes' => 'Simulated API call'
            ];
            
            echo "Mock input (what frontend sends):\n";
            print_r($mockInput);
            
            // This is what the API code does:
            $finalStatus = $mockInput['status'] ?? 'รอดำเนินการ';
            
            echo "\nStatus after API default fallback: '$finalStatus'\n";
            echo "(If input has status, it uses that. Otherwise uses 'รอดำเนินการ')\n\n";
            
            echo "ANALYSIS:\n";
            echo "- Frontend sends: '{$mockInput['status']}'\n";
            echo "- API stores: '$finalStatus'\n";
            
            if ($mockInput['status'] !== 'รอดำเนินการ') {
                echo "\n⚠️  PROBLEM FOUND: Frontend is sending '{$mockInput['status']}' but should send 'รอดำเนินการ'\n";
                echo "   The fix in App.tsx may not have been deployed correctly!\n";
            }
            break;

        default:
            echo "Unknown action: $action\n";
            echo "Use ?action=info for available actions\n";
    }

} catch (Throwable $e) {
    echo "\n\n❌ ERROR: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
}
