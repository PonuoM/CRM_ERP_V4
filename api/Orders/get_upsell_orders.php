<?php
// Hybrid mode: Can be run directly OR included as a function
// If included from index.php, function handle_get_upsell_orders is defined/called.
// If run directly, we bootstrap and call it.

if (!function_exists('handle_get_upsell_orders')) {
    function handle_get_upsell_orders($pdo) {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            json_response(['error' => 'Method not allowed'], 405);
        }

        try {
            // Check if get_authenticated_user is available (included mode) or need require (standalone)
            if (!function_exists('get_authenticated_user')) {
                 require_once __DIR__ . '/../config.php';
                 // Config might double-connect if we passed pdo? 
                 // If standalone, $pdo passed might be null, so we connect.
                 if (!$pdo) $pdo = db_connect();
            }

            $user = get_authenticated_user($pdo);

            if (!$user) {
                json_response(['error' => 'UNAUTHORIZED'], 401);
            }

            $userId = $user['id'];
            $companyId = isset($_GET['companyId']) ? (int)$_GET['companyId'] : ($user['company_id'] ?? 1);

            // Pagination
            $page = max(1, (int)($_GET['page'] ?? 1));
            $pageSize = max(1, (int)($_GET['pageSize'] ?? 50));
            $offset = ($page - 1) * $pageSize;

            // Filters (Optional, reused from basic list)
            $search = $_GET['search'] ?? '';

            // Step 1: Find Target Order IDs (Upsell Logic)
            $whereClause = "WHERE o.company_id = ? AND o.creator_id != ?";
            $params = [$companyId, $userId];

            // Must have items by me
            $whereClause .= " AND EXISTS (SELECT 1 FROM order_items oi_me WHERE oi_me.parent_order_id = o.id AND oi_me.creator_id = ?)";
            $params[] = $userId;

            // Must have multiple creators (Upsell / Shared)
            $whereClause .= " AND (SELECT COUNT(DISTINCT oi_count.creator_id) FROM order_items oi_count WHERE oi_count.parent_order_id = o.id) > 1";

            if (!empty($search)) {
                $whereClause .= " AND (o.id LIKE ? OR c.first_name LIKE ? OR c.phone LIKE ?)";
                $term = "%$search%";
                $params[] = $term;
                $params[] = $term;
                $params[] = $term;
            }

            // Count Total
            $countSql = "SELECT COUNT(DISTINCT o.id) FROM orders o LEFT JOIN customers c ON o.customer_id = c.customer_id $whereClause";
            $stmtCount = $pdo->prepare($countSql);
            $stmtCount->execute($params);
            $totalOrders = (int)$stmtCount->fetchColumn();
            $totalPages = ceil($totalOrders / $pageSize);

            // Fetch Orders
            $sql = "SELECT o.*, c.first_name as customer_first_name, c.last_name as customer_last_name, 
                        c.phone as customer_phone, c.street as customer_street, 
                        c.subdistrict as customer_subdistrict, c.district as customer_district, 
                        c.province as customer_province, c.postal_code as customer_postal_code
                    FROM orders o 
                    LEFT JOIN customers c ON o.customer_id = c.customer_id 
                    $whereClause 
                    ORDER BY o.order_date DESC 
                    LIMIT $pageSize OFFSET $offset";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $formattedOrders = [];
            foreach ($orders as $order) {
                $orderId = $order['id'];

                // Get Items
                $stmtItems = $pdo->prepare("SELECT * FROM order_items WHERE parent_order_id = ?");
                $stmtItems->execute([$orderId]);
                $items = $stmtItems->fetchAll(PDO::FETCH_ASSOC);

                // Get Slips
                $stmtSlips = $pdo->prepare("SELECT * FROM order_slips WHERE order_id = ?");
                $stmtSlips->execute([$orderId]);
                $slips = $stmtSlips->fetchAll(PDO::FETCH_ASSOC);

                // Get Tracking
                $stmtTracking = $pdo->prepare("SELECT * FROM order_tracking_numbers WHERE order_id = ?");
                $stmtTracking->execute([$orderId]);
                $tracking = $stmtTracking->fetchAll(PDO::FETCH_ASSOC);

                // Aggregate Tracking Numbers for Display
                $trackingNumbers = [];
                foreach ($tracking as $t) {
                    if (!empty($t['tracking_number'])) {
                        $trackingNumbers[] = $t['tracking_number'];
                    }
                }
                $order['tracking_numbers'] = !empty($trackingNumbers) ? implode(', ', array_unique($trackingNumbers)) : null;

                $boxes = []; 

                $order['items'] = $items;
                $order['slips'] = $slips;
                $order['tracking_details'] = $tracking; 
                $order['trackingDetails'] = $tracking;
                $order['boxes'] = $boxes;

                $formattedOrders[] = $order;
            }

            // Match response structure
            header('Content-Type: application/json');
            echo json_encode([
                'ok' => true,
                'orders' => $formattedOrders,
                'pagination' => [
                    'page' => $page,
                    'pageSize' => $pageSize,
                    'total' => $totalOrders,
                    'totalPages' => $totalPages
                ]
            ]);

        } catch (Exception $e) {
            json_response(['error' => $e->getMessage()], 500);
        }
    }
}

// Direct Execution Check
// IF specific functions from config.php are NOT defined AND we are not inside index.php context (roughly)
// A good check is debug_backtrace or checking if a constant from index.php is defined.
// Or just check if included.
// Simplest: Check if variables from index.php scope like $pdo are set? No.
// Check if we are at top level script execution.
if (basename($_SERVER['SCRIPT_FILENAME']) == basename(__FILE__)) {
    require_once __DIR__ . '/../config.php';
    cors();
    $pdo = db_connect();
    handle_get_upsell_orders($pdo);
}
