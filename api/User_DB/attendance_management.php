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
    
    // Determine if user is admin, supervisor, or CEO
    $isAdmin = strpos($userRole, 'admin') !== false;
    $isSupervisor = strpos($userRole, 'supervisor') !== false;
    $isCEO = strpos($userRole, 'ceo') !== false;
    
    // CEO gets admin-level access
    if ($isCEO) $isAdmin = true;
    
    // Build supervisor filter - include supervisor themselves + their subordinates
    $supervisorFilter = "";
    $supervisorParams = [];
    if ($isSupervisor && !$isAdmin) {
        $supervisorFilter = " AND (u.supervisor_id = ? OR u.id = ?)";
        $supervisorParams = [$currentUserId, $currentUserId];
    }
    
    // Thai day names
    $thaiDays = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

    /**
     * เติมข้อมูลจากระบบ HR (ชื่อจริง นามสกุล ชื่อเล่น วันเข้างาน และเวลาตอกบัตร) ลงในผลลัพธ์
     *
     * ผูกกันผ่าน users.hr_employee_id ที่ตั้งไว้ในหน้า "จับคู่พนักงาน HR" (migration 081)
     * ตัวเลขฝั่ง HR เป็นเวลาตอกบัตรจริง ส่วน login/logout กับชั่วโมงที่แก้ได้ในหน้านี้เป็นของ ERP
     * ทั้งสองชุดเก็บแยกกันโดยตั้งใจ — คนละวิธีวัด และหน้าเว็บแสดงคู่กันให้เห็นทั้งสองอย่าง
     *
     * ทุกอย่างที่นี่เป็นข้อมูลเสริม ถ้าฐาน HR ล่มหรือไม่มี (เช่นเครื่อง dev) records เดิมต้องยังใช้ได้
     *
     * @param string|null $date ถ้าระบุ จะดึงเวลาตอกบัตรของวันนั้นมาด้วย
     * @param array|null  $range [start, end] ถ้าระบุ จะนับจำนวนวันที่ตอกบัตรในช่วงนั้น
     */
    $attachHrInfo = function (array $records, ?string $date = null, ?array $range = null) use ($pdo) {
        $ids = [];
        foreach ($records as $r) {
            $hrId = $r['hr_employee_id'] ?? null;
            if ($hrId !== null && $hrId !== '') {
                $ids[$hrId] = true;
            }
        }

        $blank = [
            'hr_employee_id' => null, 'hr_full_name' => null, 'hr_first_name' => null,
            'hr_last_name' => null, 'hr_nickname' => null, 'hr_hire_date' => null,
            'hr_department' => null, 'hr_clock_in' => null, 'hr_clock_out' => null,
            'hr_hours' => null, 'hr_location' => null, 'hr_is_offsite' => false,
            'hr_note' => null, 'hr_days_worked' => null,
        ];

        if (!$ids || !hr_db_available($pdo)) {
            foreach ($records as &$r) {
                $r = array_merge($r, $blank);
            }
            unset($r);
            return $records;
        }

        $ids = array_keys($ids);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $select = 'e.id, e.name, e.nickname, e.hire_date, d.name AS department';
        $joins = ' LEFT JOIN ' . HR_DB . '.departments d ON d.id = e.department_id';
        // ผูกค่าตามลำดับที่ placeholder ปรากฏใน SQL: SELECT list ก่อน แล้วค่อย JOIN แล้วค่อย WHERE
        $selectParams = [];
        $joinParams = [];

        if ($range !== null) {
            // นับเฉพาะวันที่มีเวลาเข้างานจริง (แถวที่ตอกเข้าไม่ตอกออกก็ยังนับว่ามาทำงาน)
            $select .= ', (SELECT COUNT(*) FROM ' . HR_DB . '.attendance ra
                             WHERE ra.employee_id = e.id AND ra.date BETWEEN ? AND ? AND ra.clock_in IS NOT NULL) AS days_worked';
            $selectParams[] = $range[0];
            $selectParams[] = $range[1];
        }
        if ($date !== null) {
            $select .= ', a.clock_in, a.clock_out, a.location_name, a.is_offsite, a.admin_note';
            $joins .= ' LEFT JOIN ' . HR_DB . '.attendance a ON a.employee_id = e.id AND a.date = ?';
            $joinParams[] = $date;
        }

        try {
            $stmt = $pdo->prepare('SELECT ' . $select . ' FROM ' . HR_DB . '.employees e' . $joins . ' WHERE e.id IN (' . $placeholders . ')');
            $stmt->execute(array_merge($selectParams, $joinParams, $ids));
            $hrRows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Throwable $e) {
            error_log('attendance_management: HR lookup failed - ' . $e->getMessage());
            foreach ($records as &$r) {
                $r = array_merge($r, $blank);
            }
            unset($r);
            return $records;
        }

        $byId = [];
        foreach ($hrRows as $row) {
            // employees.name เก็บ "ชื่อจริง นามสกุล" รวมช่องเดียว — ตัดที่ช่องว่างแรก
            $fullName = trim((string) $row['name']);
            $spacePos = mb_strpos($fullName, ' ');
            $firstName = $spacePos === false ? $fullName : mb_substr($fullName, 0, $spacePos);
            $lastName = $spacePos === false ? '' : trim(mb_substr($fullName, $spacePos + 1));

            $clockIn = $row['clock_in'] ?? null;
            $clockOut = $row['clock_out'] ?? null;
            $hrHours = null;
            if ($clockIn && $clockOut) {
                $seconds = strtotime($clockOut) - strtotime($clockIn);
                if ($seconds > 0) {
                    $hrHours = round($seconds / 3600, 2);
                }
            }

            $byId[$row['id']] = [
                'hr_employee_id' => $row['id'],
                'hr_full_name' => $fullName,
                'hr_first_name' => $firstName,
                'hr_last_name' => $lastName,
                'hr_nickname' => $row['nickname'],
                'hr_hire_date' => $row['hire_date'],
                'hr_department' => $row['department'],
                'hr_clock_in' => $clockIn ? substr((string) $clockIn, 0, 5) : null,
                'hr_clock_out' => $clockOut ? substr((string) $clockOut, 0, 5) : null,
                'hr_hours' => $hrHours,
                'hr_location' => $row['location_name'] ?? null,
                'hr_is_offsite' => isset($row['is_offsite']) ? ((int) $row['is_offsite'] === 1) : false,
                'hr_note' => $row['admin_note'] ?? null,
                'hr_days_worked' => isset($row['days_worked']) ? (int) $row['days_worked'] : null,
            ];
        }

        foreach ($records as &$r) {
            $hrId = $r['hr_employee_id'] ?? null;
            $r = array_merge($r, ($hrId !== null && isset($byId[$hrId])) ? $byId[$hrId] : $blank);
        }
        unset($r);

        return $records;
    };


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
                    u.hr_employee_id,
                    COALESCE(SUM(a.attendance_value), 0) AS total_days,
                    COUNT(a.id) AS work_days_count
                FROM users u
                LEFT JOIN user_daily_attendance a ON a.user_id = u.id
                    AND a.work_date BETWEEN ? AND ?
                WHERE u.company_id = ?
                  AND u.status = 'active'
                  AND (u.role LIKE '%telesale%' OR u.role LIKE '%supervisor%')
                  {$supervisorFilter}
                GROUP BY u.id, u.first_name, u.last_name, u.hr_employee_id
                ORDER BY u.first_name, u.last_name
            ");
            // Reorder params: company_id first, then dates
            $stmt->execute(array_merge([$startDate, $endDate, $companyId], $supervisorParams));
            $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            foreach ($records as &$r) {
                $r['user_id'] = (int) $r['user_id'];
                $r['total_days'] = (float) $r['total_days'];
                $r['work_days_count'] = (int) $r['work_days_count'];
            }
            unset($r);

            // เสริมชื่อจริง/ชื่อเล่น + จำนวนวันที่ตอกบัตรจริงในเดือนเดียวกัน
            $records = $attachHrInfo($records, null, [$startDate, $endDate]);

            json_response([
                'success' => true,
                'year' => $year,
                'month' => $month,
                'hr_available' => hr_db_available($pdo),
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
                    u.hr_employee_id,
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

            // เสริมชื่อจริง/นามสกุล/ชื่อเล่น + เวลาตอกบัตรจริงของวันเดียวกัน
            $records = $attachHrInfo($records, $date, null);

            $today = date('Y-m-d');
            $isEditable = ($date < $today);

            json_response([
                'success' => true,
                'date' => $date,
                'dayName' => $dayName,
                'isEditable' => $isEditable,
                'hr_available' => hr_db_available($pdo),
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
        
        // Calculate attendance_value with 4 decimal precision for HH:MM accuracy
        $attendanceValue = round($hours / 8, 4);
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
