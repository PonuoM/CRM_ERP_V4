<?php
/**
 * Sales Targets API
 * - GET: Fetch targets for telesales under supervisor
 * - POST: Save/update targets
 */

require_once __DIR__ . '/../config.php';

cors();

try {
    $pdo = db_connect();
    $user = get_authenticated_user($pdo);
    
    if (!$user) {
        json_response(['success' => false, 'message' => 'Unauthorized'], 401);
        exit;
    }
    
    $companyId = $user['company_id'];
    $currentUserId = $user['id'];
    $currentUserRole = strtolower($user['role'] ?? '');
    
    // Role check - Admin or Supervisor only
    $isAdmin = strpos($currentUserRole, 'admin') !== false && strpos($currentUserRole, 'supervisor') === false;
    $isSupervisor = strpos($currentUserRole, 'supervisor') !== false;
    
    if (!$isAdmin && !$isSupervisor) {
        json_response(['success' => false, 'message' => 'Access denied. Admin or Supervisor only.'], 403);
        exit;
    }
    
    $method = $_SERVER['REQUEST_METHOD'];
    
    if ($method === 'GET') {
        // Get parameters
        $year = isset($_GET['year']) ? intval($_GET['year']) : intval(date('Y'));
        $month = isset($_GET['month']) ? intval($_GET['month']) : intval(date('m'));
        
        // Build user filter for Supervisor
        $userFilter = "";
        $userParams = [];
        
        if ($isSupervisor && !$isAdmin) {
            $userFilter = " AND u.supervisor_id = ?";
            $userParams = [$currentUserId];
        }
        
        // Fetch telesales with their targets
        $sql = "
            SELECT 
                u.id AS user_id,
                u.first_name,
                u.last_name,
                COALESCE(st.target_amount, 0) AS target_amount
            FROM users u
            LEFT JOIN sales_targets st ON u.id = st.user_id 
                AND st.month = ? AND st.year = ?
            WHERE u.company_id = ?
                AND u.role LIKE '%telesale%'
                AND u.status = 'active'
                $userFilter
            ORDER BY u.first_name
        ";
        
        $params = array_merge([$month, $year, $companyId], $userParams);
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $telesales = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        json_response([
            'success' => true,
            'month' => $month,
            'year' => $year,
            'telesales' => $telesales
        ]);
        
    } elseif ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        $action = $input['action'] ?? 'save_one';
        $year = intval($input['year'] ?? date('Y'));
        $month = intval($input['month'] ?? date('m'));
        
        if ($action === 'save_one') {
            // Save single target
            $userId = intval($input['user_id'] ?? 0);
            $targetAmount = floatval($input['target_amount'] ?? 0);
            
            if ($userId <= 0) {
                json_response(['success' => false, 'message' => 'Invalid user_id'], 400);
                exit;
            }
            
            // Upsert target
            $sql = "
                INSERT INTO sales_targets (user_id, month, year, target_amount)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE target_amount = VALUES(target_amount)
            ";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$userId, $month, $year, $targetAmount]);
            
            json_response([
                'success' => true,
                'message' => 'Target saved successfully',
                'user_id' => $userId,
                'target_amount' => $targetAmount
            ]);
            
        } elseif ($action === 'save_all') {
            // Save multiple targets
            $targets = $input['targets'] ?? [];
            
            if (empty($targets)) {
                json_response(['success' => false, 'message' => 'No targets provided'], 400);
                exit;
            }
            
            $pdo->beginTransaction();
            
            try {
                $sql = "
                    INSERT INTO sales_targets (user_id, month, year, target_amount)
                    VALUES (?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE target_amount = VALUES(target_amount)
                ";
                $stmt = $pdo->prepare($sql);
                
                foreach ($targets as $target) {
                    $userId = intval($target['user_id'] ?? 0);
                    $targetAmount = floatval($target['target_amount'] ?? 0);
                    
                    if ($userId > 0) {
                        $stmt->execute([$userId, $month, $year, $targetAmount]);
                    }
                }
                
                $pdo->commit();
                
                json_response([
                    'success' => true,
                    'message' => 'All targets saved successfully',
                    'count' => count($targets)
                ]);
                
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
        }
        
    } else {
        json_response(['success' => false, 'message' => 'Method not allowed'], 405);
    }
    
} catch (Exception $e) {
    error_log("Sales Targets API Error: " . $e->getMessage());
    json_response(['success' => false, 'message' => 'Server error: ' . $e->getMessage()], 500);
}
