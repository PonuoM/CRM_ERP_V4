<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../config.php';

cors();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    $pdo = db_connect();
    
    // Get company_id from query parameter
    $companyId = isset($_GET['company_id']) ? (int)$_GET['company_id'] : null;
    
    if (!$companyId) {
        json_response(['ok' => false, 'error' => 'company_id is required'], 400);
    }
    
    // Fetch telesale and supervisor users for the company
    $stmtUsers = $pdo->prepare("
        SELECT id, first_name, last_name, role
        FROM users
        WHERE company_id = ?
        AND (LOWER(role) = 'telesale' OR LOWER(role) LIKE '%supervisor%')
        AND status = 'active'
        ORDER BY first_name, last_name
    ");
    $stmtUsers->execute([$companyId]);
    $users = $stmtUsers->fetchAll(PDO::FETCH_ASSOC);
    
    $result = [];
    
    foreach ($users as $user) {
        $userId = (int)$user['id'];
        
        // Get total customers assigned to this user
        $stmtTotal = $pdo->prepare("
            SELECT COUNT(*) as total
            FROM customers
            WHERE company_id = ?
            AND assigned_to = ?
        ");
        $stmtTotal->execute([$companyId, $userId]);
        $totalCustomers = (int)$stmtTotal->fetchColumn();
        
        // Get grade distribution - use actual grade column from database
        $stmtGrades = $pdo->prepare("
            SELECT 
                COALESCE(NULLIF(TRIM(grade), ''), 'Unknown') as grade,
                COUNT(*) as count
            FROM customers
            WHERE company_id = ?
            AND assigned_to = ?
            GROUP BY grade
        ");
        $stmtGrades->execute([$companyId, $userId]);
        $gradeRows = $stmtGrades->fetchAll(PDO::FETCH_ASSOC);
        
        // Initialize all grades with 0
        $gradeDistribution = [
            'A+' => 0,
            'A' => 0,
            'B' => 0,
            'C' => 0,
            'D' => 0,
            'Unknown' => 0
        ];
        
        // Fill in actual counts
        foreach ($gradeRows as $row) {
            $grade = $row['grade'];
            if (isset($gradeDistribution[$grade])) {
                $gradeDistribution[$grade] = (int)$row['count'];
            } else {
                // Handle any unexpected grades by adding to Unknown
                $gradeDistribution['Unknown'] += (int)$row['count'];
            }
        }
        
        $result[] = [
            'id' => $userId,
            'firstName' => $user['first_name'],
            'lastName' => $user['last_name'],
            'role' => $user['role'],
            'totalCustomers' => $totalCustomers,
            'gradeDistribution' => $gradeDistribution
        ];
    }
    
    json_response([
        'ok' => true,
        'users' => $result
    ]);
    
} catch (Exception $e) {
    error_log("Error in telesale.php: " . $e->getMessage());
    json_response([
        'ok' => false,
        'error' => 'Failed to fetch telesale users',
        'message' => $e->getMessage()
    ], 500);
}
