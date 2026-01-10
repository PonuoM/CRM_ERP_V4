<?php
/**
 * Debug Script: Lifecycle Status Testing for Customer 300104
 * Tests the complete flow of lifecycle status changes when appointments are created and completed
 * 
 * Usage: Access this file via browser, e.g. https://www.prima49.com/mini_erp/api/debug_lifecycle_status.php
 */

require_once __DIR__ . '/config.php';
header('Content-Type: text/html; charset=utf-8');

$customerId = isset($_GET['customer_id']) ? $_GET['customer_id'] : '300104';

try {
    $pdo = db_connect();
} catch (Exception $e) {
    die("Database connection failed: " . $e->getMessage());
}

echo "<html><head><title>Lifecycle Status Debug - Customer {$customerId}</title>";
echo "<style>
    body { font-family: monospace; padding: 20px; background: #1a1a2e; color: #eee; }
    .section { background: #16213e; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #0f3460; }
    .status-box { background: #0f3460; padding: 10px; border-radius: 4px; margin: 5px 0; }
    .success { border-left-color: #00ff88; }
    .warning { border-left-color: #ffcc00; }
    .error { border-left-color: #ff4444; }
    .highlight { color: #00ff88; font-weight: bold; }
    .dim { color: #888; }
    pre { background: #0a0a15; padding: 10px; border-radius: 4px; overflow-x: auto; }
    h2 { color: #00d9ff; margin-top: 0; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #0f3460; }
    th { background: #0f3460; }
    .btn { display: inline-block; padding: 10px 20px; background: #e94560; color: white; text-decoration: none; border-radius: 4px; margin: 5px; border: none; cursor: pointer; }
    .btn:hover { background: #ff6b8a; }
    .btn-success { background: #00cc66; }
    .btn-success:hover { background: #00ff88; }
</style></head><body>";

echo "<h1>🔍 Lifecycle Status Debug - Customer {$customerId}</h1>";
echo "<p class='dim'>Generated at: " . date('Y-m-d H:i:s') . "</p>";

// ============================================
// STEP 1: Get Initial Customer Status
// ============================================
echo "<div class='section'>";
echo "<h2>📋 Step 1: Initial Customer Status</h2>";

$stmt = $pdo->prepare("
    SELECT 
        customer_id, 
        customer_ref_id,
        first_name, 
        last_name, 
        lifecycle_status, 
        previous_lifecycle_status,
        follow_up_date,
        date_assigned,
        assigned_to
    FROM customers 
    WHERE customer_ref_id = ? OR customer_id = ?
");
$stmt->execute([$customerId, $customerId]);
$customer = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$customer) {
    echo "<div class='error'>❌ Customer not found!</div>";
    echo "</div></body></html>";
    exit;
}

echo "<table>";
echo "<tr><th>Field</th><th>Value</th></tr>";
foreach ($customer as $key => $value) {
    $displayValue = $value === null ? '<span class="dim">(null)</span>' : htmlspecialchars($value);
    if ($key === 'lifecycle_status' || $key === 'previous_lifecycle_status') {
        $displayValue = "<span class='highlight'>{$displayValue}</span>";
    }
    echo "<tr><td>{$key}</td><td>{$displayValue}</td></tr>";
}
echo "</table>";

$initialStatus = $customer['lifecycle_status'];
$initialPrevious = $customer['previous_lifecycle_status'];
$customerPk = $customer['customer_id'];
$customerRefId = $customer['customer_ref_id'] ?: $customerId;

echo "<div class='status-box'>";
echo "<strong>Initial:</strong> lifecycle_status = <span class='highlight'>{$initialStatus}</span>, ";
echo "previous_lifecycle_status = <span class='highlight'>" . ($initialPrevious ?: 'NULL') . "</span>";
echo "</div>";
echo "</div>";

// ============================================
// STEP 2: Get Current Appointments
// ============================================
echo "<div class='section'>";
echo "<h2>📅 Step 2: Current Appointments for Customer</h2>";

// Note: appointments table uses customer_ref_id OR customer_id
$stmt = $pdo->prepare("
    SELECT id, customer_id, customer_ref_id, title, date, status, notes
    FROM appointments 
    WHERE customer_id = ? OR customer_ref_id = ?
    ORDER BY date DESC
");
$stmt->execute([$customerPk, $customerRefId]);
$appointments = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (empty($appointments)) {
    echo "<p class='dim'>No appointments found for this customer.</p>";
} else {
    echo "<table>";
    echo "<tr><th>ID</th><th>Customer ID</th><th>Ref ID</th><th>Title</th><th>Date</th><th>Status</th><th>Notes</th></tr>";
    foreach ($appointments as $appt) {
        $statusClass = $appt['status'] === 'เสร็จสิ้น' ? 'dim' : 'highlight';
        echo "<tr>";
        echo "<td>{$appt['id']}</td>";
        echo "<td>{$appt['customer_id']}</td>";
        echo "<td>{$appt['customer_ref_id']}</td>";
        echo "<td>{$appt['title']}</td>";
        echo "<td>{$appt['date']}</td>";
        echo "<td class='{$statusClass}'>{$appt['status']}</td>";
        echo "<td>" . ($appt['notes'] ?: '-') . "</td>";
        echo "</tr>";
    }
    echo "</table>";
}

$pendingCount = count(array_filter($appointments, function($a) { return $a['status'] !== 'เสร็จสิ้น'; }));
echo "<div class='status-box'>";
echo "<strong>Pending appointments:</strong> <span class='highlight'>{$pendingCount}</span>";
echo "</div>";
echo "</div>";

// ============================================
// STEP 3: Actions
// ============================================
echo "<div class='section'>";
echo "<h2>⚡ Step 3: Actions</h2>";

// Handle form submissions
$action = isset($_POST['action']) ? $_POST['action'] : null;

if ($action === 'create_appointment') {
    // Create a new appointment
    $title = 'Test Appointment - Debug';
    $date = date('Y-m-d H:i:s', strtotime('+1 day'));
    
    echo "<h3>Creating Appointment...</h3>";
    
    // First, check and save previous_lifecycle_status if switching to FollowUp
    if ($customer['lifecycle_status'] !== 'FollowUp') {
        $backupSql = "UPDATE customers SET previous_lifecycle_status = lifecycle_status WHERE customer_id = ? AND lifecycle_status != 'FollowUp'";
        $backupStmt = $pdo->prepare($backupSql);
        $backupStmt->execute([$customerPk]);
        echo "<pre>Executed: {$backupSql}\nParams: [{$customerPk}]\nRows affected: " . $backupStmt->rowCount() . "</pre>";
        
        // Update to FollowUp
        $updateSql = "UPDATE customers SET lifecycle_status = 'FollowUp', follow_up_date = ? WHERE customer_id = ?";
        $updateStmt = $pdo->prepare($updateSql);
        $updateStmt->execute([$date, $customerPk]);
        echo "<pre>Executed: {$updateSql}\nParams: [{$date}, {$customerPk}]\nRows affected: " . $updateStmt->rowCount() . "</pre>";
    }
    
    // Create appointment (use customer_ref_id to match frontend)
    $insertSql = "INSERT INTO appointments (customer_id, customer_ref_id, title, date, status, notes) VALUES (?, ?, ?, ?, 'รอดำเนินการ', 'Debug test')";
    $insertStmt = $pdo->prepare($insertSql);
    $insertStmt->execute([$customerPk, $customerRefId, $title, $date]);
    $newApptId = $pdo->lastInsertId();
    
    echo "<pre>Executed: {$insertSql}\nParams: [{$customerPk}, {$customerRefId}, {$title}, {$date}]\nNew ID: {$newApptId}</pre>";
    echo "<div class='section success'><strong>✅ Appointment created with ID: {$newApptId}</strong></div>";
    
    // Refresh customer data
    $stmt = $pdo->prepare("SELECT lifecycle_status, previous_lifecycle_status FROM customers WHERE customer_id = ?");
    $stmt->execute([$customerPk]);
    $updatedCustomer = $stmt->fetch(PDO::FETCH_ASSOC);
    
    echo "<div class='status-box'>";
    echo "<strong>After Create:</strong> lifecycle_status = <span class='highlight'>{$updatedCustomer['lifecycle_status']}</span>, ";
    echo "previous_lifecycle_status = <span class='highlight'>" . ($updatedCustomer['previous_lifecycle_status'] ?: 'NULL') . "</span>";
    echo "</div>";
    
} elseif ($action === 'complete_appointment') {
    $apptId = isset($_POST['appt_id']) ? (int)$_POST['appt_id'] : 0;
    
    if ($apptId > 0) {
        echo "<h3>Completing Appointment ID: {$apptId}...</h3>";
        
        // Update appointment status
        $updateApptSql = "UPDATE appointments SET status = 'เสร็จสิ้น' WHERE id = ?";
        $updateApptStmt = $pdo->prepare($updateApptSql);
        $updateApptStmt->execute([$apptId]);
        echo "<pre>Executed: {$updateApptSql}\nParams: [{$apptId}]\nRows affected: " . $updateApptStmt->rowCount() . "</pre>";
        
        // Check remaining pending appointments
        $checkSql = "SELECT COUNT(*) as pending_count FROM appointments WHERE (customer_id = ? OR customer_ref_id = ?) AND status != 'เสร็จสิ้น'";
        $checkStmt = $pdo->prepare($checkSql);
        $checkStmt->execute([$customerPk, $customerRefId]);
        $remaining = $checkStmt->fetch(PDO::FETCH_ASSOC);
        
        echo "<div class='status-box'>";
        echo "<strong>Remaining pending appointments:</strong> <span class='highlight'>{$remaining['pending_count']}</span>";
        echo "</div>";
        
        // If no more pending, revert lifecycle status
        if ($remaining['pending_count'] == 0) {
            echo "<h3>No more pending appointments - Reverting lifecycle status...</h3>";
            
            // Get current customer state
            $stmt = $pdo->prepare("SELECT lifecycle_status, previous_lifecycle_status FROM customers WHERE customer_id = ?");
            $stmt->execute([$customerPk]);
            $beforeRevert = $stmt->fetch(PDO::FETCH_ASSOC);
            
            echo "<div class='status-box'>";
            echo "<strong>Before Revert:</strong> lifecycle_status = <span class='highlight'>{$beforeRevert['lifecycle_status']}</span>, ";
            echo "previous_lifecycle_status = <span class='highlight'>" . ($beforeRevert['previous_lifecycle_status'] ?: 'NULL') . "</span>";
            echo "</div>";
            
            if ($beforeRevert['lifecycle_status'] === 'FollowUp' && $beforeRevert['previous_lifecycle_status']) {
                $previousStatus = $beforeRevert['previous_lifecycle_status'];
                
                $revertSql = "UPDATE customers SET lifecycle_status = ?, previous_lifecycle_status = NULL, follow_up_date = NULL WHERE customer_id = ?";
                $revertStmt = $pdo->prepare($revertSql);
                $revertStmt->execute([$previousStatus, $customerPk]);
                
                echo "<pre>Executed: {$revertSql}\nParams: [{$previousStatus}, {$customerPk}]\nRows affected: " . $revertStmt->rowCount() . "</pre>";
                
                // Verify
                $stmt = $pdo->prepare("SELECT lifecycle_status, previous_lifecycle_status FROM customers WHERE customer_id = ?");
                $stmt->execute([$customerPk]);
                $afterRevert = $stmt->fetch(PDO::FETCH_ASSOC);
                
                echo "<div class='section success'>";
                echo "<strong>✅ Status Reverted!</strong><br>";
                echo "lifecycle_status = <span class='highlight'>{$afterRevert['lifecycle_status']}</span>, ";
                echo "previous_lifecycle_status = <span class='highlight'>" . ($afterRevert['previous_lifecycle_status'] ?: 'NULL') . "</span>";
                echo "</div>";
            } else {
                echo "<div class='section warning'>";
                echo "<strong>⚠️ Cannot revert:</strong><br>";
                if ($beforeRevert['lifecycle_status'] !== 'FollowUp') {
                    echo "Customer is not in FollowUp status (current: {$beforeRevert['lifecycle_status']})<br>";
                }
                if (!$beforeRevert['previous_lifecycle_status']) {
                    echo "previous_lifecycle_status is NULL - no status to revert to<br>";
                }
                echo "</div>";
            }
        } else {
            echo "<div class='section warning'>";
            echo "<strong>⚠️ Not reverting:</strong> Still have {$remaining['pending_count']} pending appointment(s)";
            echo "</div>";
        }
    }
    
} elseif ($action === 'reset_status') {
    echo "<h3>Resetting Customer Status...</h3>";
    
    $resetSql = "UPDATE customers SET lifecycle_status = 'New', previous_lifecycle_status = NULL, follow_up_date = NULL WHERE customer_id = ?";
    $resetStmt = $pdo->prepare($resetSql);
    $resetStmt->execute([$customerPk]);
    
    echo "<pre>Executed: {$resetSql}\nParams: [{$customerPk}]\nRows affected: " . $resetStmt->rowCount() . "</pre>";
    
    // Delete all test appointments
    $deleteSql = "DELETE FROM appointments WHERE (customer_id = ? OR customer_ref_id = ?) AND notes = 'Debug test'";
    $deleteStmt = $pdo->prepare($deleteSql);
    $deleteStmt->execute([$customerPk, $customerRefId]);
    
    echo "<pre>Executed: {$deleteSql}\nParams: [{$customerPk}, {$customerRefId}]\nRows affected: " . $deleteStmt->rowCount() . "</pre>";
    
    echo "<div class='section success'><strong>✅ Status reset to 'New', debug appointments deleted</strong></div>";
}

// Action buttons
echo "<form method='post' style='margin-top: 20px;'>";
echo "<input type='hidden' name='action' value='create_appointment'>";
echo "<button type='submit' class='btn'>📅 Create Test Appointment</button>";
echo "</form>";

echo "<form method='post' style='margin-top: 10px;'>";
echo "<input type='hidden' name='action' value='reset_status'>";
echo "<button type='submit' class='btn btn-success'>🔄 Reset Status to 'New'</button>";
echo "</form>";

// Complete appointment buttons for each pending
$pendingAppts = array_filter($appointments, function($a) { return $a['status'] !== 'เสร็จสิ้น'; });
if (!empty($pendingAppts)) {
    echo "<h3>Complete Individual Appointments:</h3>";
    foreach ($pendingAppts as $appt) {
        echo "<form method='post' style='display: inline-block;'>";
        echo "<input type='hidden' name='action' value='complete_appointment'>";
        echo "<input type='hidden' name='appt_id' value='{$appt['id']}'>";
        echo "<button type='submit' class='btn'>✅ Complete ID {$appt['id']}</button>";
        echo "</form>";
    }
}

echo "</div>";

echo "<p class='dim'><a href='?customer_id={$customerId}' style='color: #00d9ff;'>🔄 Refresh Page</a></p>";
echo "</body></html>";
