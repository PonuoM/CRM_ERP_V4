<?php
/**
 * CRITICAL SCRIPT: Full Basket Recalculation
 * Implements strict business logic for customer categorization
 * Should be run via Cron or Shift Clicks
 */

require_once __DIR__ . '/../config.php';

header('Content-Type: text/plain; charset=utf-8');

// PREVENT TIMEOUTS
set_time_limit(0);
ignore_user_abort(true);
ob_implicit_flush(true);
while (ob_get_level()) ob_end_flush();

// SECURITY CHECK
$SECRET_KEY = 'recalc_2026_secure';
$providedKey = $_GET['key'] ?? $argv[1] ?? ''; // Support both query param and CLI arg

if (php_sapi_name() !== 'cli' && $providedKey !== $SECRET_KEY) {
    http_response_code(403);
    die("ERROR: Unauthorized. Invalid key.\n");
}

$pdo = db_connect();

// Configurable Basket IDs (Based on User Requirements)
// ASSIGNED
$B_UPSELL = 51;
$B_NEW = 38;
$B_PERSONAL_1_2 = 39;
$B_LAST_CHANCE = 40;
$B_FIND_NEW_CARETAKER_ASSIGNED = 46;
$B_WAITING_TO_WOO_ASSIGNED = 47;
$B_MID_6_12_ASSIGNED = 48;
$B_MID_1_3_ASSIGNED = 49;
$B_ANCIENT_ASSIGNED = 50;

// UNASSIGNED
$B_WAITING_TO_WOO_POOL = 42;
$B_FIND_NEW_CARETAKER_POOL = 41;
$B_MID_6_12_POOL = 43;
$B_MID_1_3_POOL = 44;
$B_ANCIENT_POOL = 45;

echo "Starting Full Basket Recalculation...\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n\n";

// 1. Get All Customers
// We need: id (customer_id seems to be PK in checking script, but standard is usually id. checking script output showed customer_id. Let's select both if possible or check PK)
// Based on previous checks: customers has 'customer_id' as PK? Or 'id'?
// 'check_users_temp.php' showed users.id. 'check_cust_baskets.php' showed customers.customer_id.
// Safe bet: select * or key columns.
// Also need to join with:
// - orders (latest order info: status, date, creator_id)
// - users (creator role)

// OPTIMIZATION: Process in batches to avoid RAM issues
$batchSize = 1000;
$offset = 0;
$totalProcessed = 0;
$totalUpdated = 0;

// Helper to get latest order info efficiently
// Since joining ON max(order_date) is icky in MySQL, we might do a correlated subquery or just fetch customers and query last order for each (N+1 but safer logic) 
// OR use window functions if MySQL 8.0+.
// Let's assume MySQL 5.7+ safety: fetch customers, then fetch their last valid order.

// Query all companies
$sql = "SELECT id FROM companies"; 
$companies = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);

foreach ($companies as $comp) {
    $companyId = $comp['id'];
    
    echo "Processing Company ID: $companyId\n";
    $offset = 0;
    
    while (true) {
        $sql = "
            SELECT 
                c.customer_id, c.first_name, c.assigned_to, c.current_basket_key,
                c.date_registered
            FROM customers c
            WHERE c.company_id = ?
            LIMIT $batchSize OFFSET $offset
        ";
        // Correction: $limit variable is $batchSize
        // $sql = str_replace('$limit', $batchSize, $sql); -> Removed logic, used variable directly
        // $sql = str_replace('$offset', $offset, $sql); -> Removed logic
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$companyId]);
        $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (empty($customers)) break;
        
        // Collect customer IDs for batch order fetching
        $custIds = [];
        $custMap = [];
        foreach ($customers as $c) {
            $pk = $c['customer_id']; // Prefer customer_id based on previous checks
            $custIds[] = $pk;
            $custMap[$pk] = $c;
        }
        
        if (empty($custIds)) break;
        
        // Fetch Last Order Info for these customers
        // Criteria for "Last Order": Not Cancelled.
        // We need: order_date, creator_id, role_id of creator, order_status
        $placeholders = implode(',', array_fill(0, count($custIds), '?'));
        
        $orderSql = "
            SELECT 
                o.customer_id,
                o.id as order_id,
                o.order_date,
                o.order_status,
                o.creator_id,
                u.role_id as creator_role_id
            FROM orders o
            LEFT JOIN users u ON o.creator_id = u.id
            WHERE o.customer_id IN ($placeholders)
            AND o.order_status != 'Cancelled'
            AND o.company_id = ?
            ORDER BY o.order_date DESC
        ";
        // Note: ORDER BY date DESC allows us to pick first one in PHP loop if we fetch all. 
        // Better: For each customer, get only TOP 1. 
        // In PHP, we can iterate all orders and keep only the latest per customer.
        
        $oStmt = $pdo->prepare($orderSql);
        // Params: custIds + companyId
        $oParams = $custIds;
        $oParams[] = $companyId;
        $oStmt->execute($oParams);
        
        $ordersMap = []; // customer_id => order_data
        
        while ($row = $oStmt->fetch(PDO::FETCH_ASSOC)) {
            $cid = $row['customer_id'];
            if (!isset($ordersMap[$cid])) {
                // First one is the latest because of ORDER BY DESC
                $ordersMap[$cid] = $row;
            }
        }
        
        // Process Logic
        $updates = []; // customer_id => new_basket_id
        
        foreach ($customers as $cust) {
            $cid = $cust['customer_id'];
            $assignedTo = $cust['assigned_to'];
            //$assignedTo = ($assignedTo > 0) ? $assignedTo : null; // Ensure 0 is null
            if ($assignedTo == 0) $assignedTo = null; // Strict NULL check
            
            $lastOrder = $ordersMap[$cid] ?? null;
            
            $targetBasket = null;
            
            if (!$lastOrder) {
                // No orders ever? -> Maybe 'New Customer' (38) if recent reg?
                // Or just keep as is? User didn't specify "No Order" case.
                // Assuming "New Customer" if registered recently, else Pool?
                // Use default logic: if registered < 60 days => 38, else 42 (Pool)?
                // Let's skip updating if no order, OR assume "New" (38)
                // Defaulting to NEW (38) for safety if no orders.
                 $targetBasket = $B_NEW;
            } else {
                // Order Info
                $orderDate = $lastOrder['order_date'];
                $daysSince = (time() - strtotime($orderDate)) / (60 * 60 * 24);
                $creatorId = $lastOrder['creator_id'];
                $creatorRoleId = $lastOrder['creator_role_id'];
                $status = $lastOrder['order_status']; // Pending, etc.
                
                // Logic Tree
                if ($assignedTo) {
                    // === HAS OWNER ===
                    
                    // 1. UPSELL (51)
                    // Cond: Admin Page(3) AND Pending status
                    if ($creatorRoleId == 3 && $status == 'Pending') {
                        $targetBasket = $B_UPSELL;
                    }
                    // 2. NEW (38)
                    // Cond: Admin Page(3) AND 1-60 days (Note: Upsell takes priority if Pending?)
                    // Assuming Upsell is specific to Pending. If not pending but Role 3 and <60d -> New
                    else if ($creatorRoleId == 3 && $daysSince <= 60) {
                        $targetBasket = $B_NEW;
                    }
                    // 3. PERSONAL 1-2M (39)
                    // Cond: Created by US (assigned == creator) AND 1-60 days
                    else if ($assignedTo == $creatorId && $daysSince <= 60) {
                        $targetBasket = $B_PERSONAL_1_2;
                    }
                    // 4. LAST CHANCE (40)
                    // Cond: Created by US AND 61-90 days
                    else if ($assignedTo == $creatorId && $daysSince > 60 && $daysSince <= 90) {
                        $targetBasket = $B_LAST_CHANCE;
                    }
                    // 5. WAITING TO WOO (Assigned) (47)
                    // Cond: Created by Telesale(7)/Sup(6) AND NOT Self AND 1-90 days
                    else if (in_array($creatorRoleId, [6, 7]) && $assignedTo != $creatorId && $daysSince <= 90) {
                        $targetBasket = $B_WAITING_TO_WOO_ASSIGNED;
                    }
                    // 6. FIND NEW CARETAKER (Assigned) (46)
                    // Cond: Created by Telesale(7)/Sup(6) AND NOT Self AND 91-180 days
                    else if (in_array($creatorRoleId, [6, 7]) && $assignedTo != $creatorId && $daysSince > 90 && $daysSince <= 180) {
                        $targetBasket = $B_FIND_NEW_CARETAKER_ASSIGNED;
                    }
                    // 7. MID 6-12M (Assigned) (48)
                    // Cond: 181 - 365 days (General fallback for age)
                    else if ($daysSince > 180 && $daysSince <= 365) {
                        $targetBasket = $B_MID_6_12_ASSIGNED;
                    }
                    // 8. MID 1-3Y (Assigned) (49)
                    // Cond: 366 - 1095 days
                    else if ($daysSince > 365 && $daysSince <= 1095) {
                        $targetBasket = $B_MID_1_3_ASSIGNED;
                    }
                    // 9. ANCIENT (Assigned) (50)
                    // Cond: > 1095 days
                    else if ($daysSince > 1095) {
                        $targetBasket = $B_ANCIENT_ASSIGNED;
                    }
                    else {
                        // Fallback for cases not covered? (e.g. Created by Admin(3) but > 60 days)
                        // User didn't specify. Assuming Age based fallbacks.
                         if ($daysSince <= 60) $targetBasket = $B_PERSONAL_1_2; 
                         else if ($daysSince <= 90) $targetBasket = $B_WAITING_TO_WOO_ASSIGNED; 
                         else if ($daysSince <= 180) $targetBasket = $B_FIND_NEW_CARETAKER_ASSIGNED;
                         else if ($daysSince <= 365) $targetBasket = $B_MID_6_12_ASSIGNED;
                         else if ($daysSince <= 1095) $targetBasket = $B_MID_1_3_ASSIGNED;
                         else $targetBasket = $B_ANCIENT_ASSIGNED;
                    }
                    
                } else {
                    // === NO OWNER (POOL) ===
                    
                    // 1. WAITING TO WOO (Pool) (42) -> 1 - 90 days
                    if ($daysSince <= 90) {
                        $targetBasket = $B_WAITING_TO_WOO_POOL;
                    }
                    // 2. FIND NEW CARETAKER (Pool) (41) -> 91 - 180 days
                    else if ($daysSince > 90 && $daysSince <= 180) {
                        $targetBasket = $B_FIND_NEW_CARETAKER_POOL;
                    }
                    // 3. MID 6-12M (Pool) (43) -> 181 - 365 days
                    else if ($daysSince > 180 && $daysSince <= 365) {
                        $targetBasket = $B_MID_6_12_POOL;
                    }
                    // 4. MID 1-3Y (Pool) (44) -> 366 - 1095 days
                    else if ($daysSince > 365 && $daysSince <= 1095) {
                        $targetBasket = $B_MID_1_3_POOL;
                    }
                    // 5. ANCIENT (Pool) (45) -> > 1095 days
                    else if ($daysSince > 1095) {
                        $targetBasket = $B_ANCIENT_POOL;
                    }
                }
            }
            
            // Perform Update if changed
            // We compare IDs directly
            if ($targetBasket && $cust['current_basket_key'] != $targetBasket) {
                $updateStmt = $pdo->prepare("UPDATE customers SET current_basket_key = ? WHERE customer_id = ?");
                $updateStmt->execute([$targetBasket, $cid]);
                $totalUpdated++;
                echo "  Customer $cid: Basket {$cust['current_basket_key']} -> $targetBasket\n";
            }
        }
        
        $totalProcessed += count($customers);
        $offset += $batchSize;
        
        // Safety Break
        if ($totalProcessed > 100000) break; 
    }
}

echo "\nDone. Processed: $totalProcessed. Updated: $totalUpdated.\n";

