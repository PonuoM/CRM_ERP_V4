<?php
/**
 * Attendance Management API v2
 * For Supervisor/Admin to view and edit team daily attendance
 * 
 * GET  ?date=YYYY-MM-DD                    - Get all attendance for a date
 * GET  ?action=monthly_summary&year=&month= - Get monthly summary
 * POST { user_id, date, hours, notes }     - Update attendance (only past dates)
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
    $userRole = strtolower($user['role'] ?? '');
    
    // Check role - Supervisor, Admin can access
    $isAllowed = (
        strpos($userRole, 'supervisor') !== false ||
        strpos($userRole, 'admin') !== false
    );
    
    if (!$isAllowed) {
        json_response(['success' => false, 'message' => 'Access denied. Role: ' . $userRole], 403);
        exit;
    }
    
    $method = $_SERVER['REQUEST_METHOD'];
    
    // Determine if user is admin or supervisor
    $isAdmin = strpos($userRole, 'admin') !== false;
    $isSupervisor = strpos($userRole, 'supervisor') !== false;
    
    // Build supervisor filter
    $supervisorFilter = "";
    $supervisorParams = [];
    if ($isSupervisor && !$isAdmin) {
        $supervisorFilter = " AND u.supervisor_id = ?";
        $supervisorParams = [$currentUserId];
    }
    
    // Thai day names
    $thaiDays = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    
    if ($method === 'GET') {
        $action = $_GET['action'] ?? 'daily';
        
        if ($action === 'monthly_summary') {
            // Monthly Summary - ยอดรวมวันทำงานในเดือน
            $year = isset($_GET['year']) ? intval($_GET['year']) : intval(date('Y'));
            $month = isset($_GET['month']) ? intval($_GET['month']) : intval(date('m'));
            
            $startDate = sprintf('%04d-%02d-01', $year, $month);
            $endDate = date('Y-m-t', strtotime($startDate));
            
            $params = [$companyId, $startDate, $endDate];
            $params = array_merge($params, $supervisorParams);
            
            $stmt = $pdo->prepare("
                SELECT 
                    u.id AS user_id,
                    CONCAT(u.first_name, ' ', u.last_name) AS full_name,
                    COALESCE(SUM(a.attendance_value), 0) AS total_days,
                    COUNT(a.id) AS work_days_count
                FROM users u
                LEFT JOIN user_daily_attendance a ON a.user_id = u.id 
                    AND a.work_date BETWEEN ? AND ?
                WHERE u.company_id = ?
                  AND u.status = 'active'
                  AND (u.role LIKE '%telesale%' OR u.role LIKE '%supervisor%')
                  {$supervisorFilter}
                GROUP BY u.id, u.first_name, u.last_name
                ORDER BY u.first_name, u.last_name
            ");
            // Reorder params: company_id first, then dates
            $stmt->execute([$startDate, $endDate, $companyId, ...$supervisorParams]);
            $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            foreach ($records as &$r) {
                $r['user_id'] = (int) $r['user_id'];
                $r['total_days'] = (float) $r['total_days'];
                $r['work_days_count'] = (int) $r['work_days_count'];
            }
            unset($r);
            
            json_response([
                'success' => true,
                'year' => $year,
                'month' => $month,
                'records' => $records
            ]);
            
        } else {
            // Daily attendance
            $date = $_GET['date'] ?? date('Y-m-d', strtotime('-1 day'));
            
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
                throw new Exception('Invalid date format. Use YYYY-MM-DD');
            }
            
            // Get day name
            $dayOfWeek = date('w', strtotime($date));
            $dayName = $thaiDays[$dayOfWeek];
            
            $params = [$date, $companyId];
            $params = array_merge($params, $supervisorParams);
            
            // LEFT JOIN to show all employees even without attendance record
            $stmt = $pdo->prepare("
                SELECT 
                    u.id AS user_id,
                    CONCAT(u.first_name, ' ', u.last_name) AS full_name,
                    a.id,
                    a.work_date,
                    DATE_FORMAT(a.first_login, '%H:%i') AS first_login,
                    CASE 
                        WHEN TIME(a.last_logout) > '18:00:00' THEN '18:00'
                        ELSE DATE_FORMAT(a.last_logout, '%H:%i')
                    END AS last_logout,
                    COALESCE(a.attendance_value, 0) AS attendance_value,
                    ROUND(COALESCE(a.attendance_value, 0) * 8, 2) AS current_hours,
                    a.notes
                FROM users u
                LEFT JOIN user_daily_attendance a ON a.user_id = u.id AND a.work_date = ?
                WHERE u.company_id = ?
                  AND u.status = 'active'
                  AND (u.role LIKE '%telesale%' OR u.role LIKE '%supervisor%')
                  {$supervisorFilter}
                ORDER BY u.first_name, u.last_name
            ");
            $stmt->execute($params);
            $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Calculate status based on hours
            foreach ($records as &$record) {
                $hours = (float) ($record['current_hours'] ?? 0);
                $record['current_hours'] = $hours;
                $record['attendance_value'] = (float) ($record['attendance_value'] ?? 0);
                $record['user_id'] = (int) $record['user_id'];
                
                // Status logic: 8=full, 4=half, 0=leave, else=partial
                if ($hours >= 8) {
                    $record['attendance_status'] = 'full';
                } elseif ($hours >= 4) {
                    $record['attendance_status'] = 'half';
                } elseif ($hours == 0 || $record['first_login'] === null) {
                    $record['attendance_status'] = 'leave';
                } else {
                    $record['attendance_status'] = 'partial';
                }
            }
            unset($record);
            
            $today = date('Y-m-d');
            $isEditable = ($date < $today);
            
            json_response([
                'success' => true,
                'date' => $date,
                'dayName' => $dayName,
                'isEditable' => $isEditable,
                'records' => $records
            ]);
        }
        
    } elseif ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        $userId = $input['user_id'] ?? null;
        $date = $input['date'] ?? null;
        $hours = $input['hours'] ?? null;
        $notes = $input['notes'] ?? null;
        
        if (!$userId || !$date || $hours === null) {
            throw new Exception('Missing required fields: user_id, date, hours');
        }
        
        $today = date('Y-m-d');
        if ($date >= $today) {
            throw new Exception('Can only edit past dates (before today)');
        }
        
        $hours = floatval($hours);
        if ($hours < 0 || $hours > 12) {
            throw new Exception('Hours must be between 0 and 12');
        }
        
        // Calculate attendance_value
        $attendanceValue = round($hours / 8, 2);
        if ($attendanceValue > 1.5) $attendanceValue = 1.5;
        
        // Determine status: 8=full, 4=half, 0=leave, else=partial
        if ($hours >= 8) {
            $status = 'full';
        } elseif ($hours >= 4) {
            $status = 'half';
        } elseif ($hours == 0) {
            $status = 'absent';
        } else {
            $status = 'half'; // partial treated as half for DB
        }
        
        // Check if record exists
        $checkStmt = $pdo->prepare("SELECT id FROM user_daily_attendance WHERE user_id = ? AND work_date = ?");
        $checkStmt->execute([$userId, $date]);
        $existing = $checkStmt->fetch();
        
        if ($existing) {
            // Update existing
            $stmt = $pdo->prepare("
                UPDATE user_daily_attendance 
                SET attendance_value = ?,
                    attendance_status = ?,
                    notes = ?,
                    updated_at = NOW()
                WHERE user_id = ? AND work_date = ?
            ");
            $stmt->execute([$attendanceValue, $status, $notes, $userId, $date]);
        } else {
            // Insert new
            $stmt = $pdo->prepare("
                INSERT INTO user_daily_attendance 
                    (user_id, work_date, attendance_value, attendance_status, notes, computed_at)
                VALUES (?, ?, ?, ?, ?, NOW())
            ");
            $stmt->execute([$userId, $date, $attendanceValue, $status, $notes]);
        }
        
        json_response([
            'success' => true,
            'message' => 'Attendance updated',
            'data' => [
                'user_id' => $userId,
                'date' => $date,
                'hours' => $hours,
                'attendance_value' => $attendanceValue,
                'attendance_status' => $status,
                'notes' => $notes
            ]
        ]);
        
    } else {
        json_response(['success' => false, 'message' => 'Method not allowed'], 405);
    }
    
} catch (Exception $e) {
    json_response(['success' => false, 'message' => $e->getMessage()], 400);
}
