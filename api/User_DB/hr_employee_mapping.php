<?php
/**
 * HR Employee Mapping API
 * จับคู่ users ของ ERP กับ employees ของ HR Mobile Connect (primacom_hr_mobile_connect)
 *
 * ทำไมต้องมีหน้านี้: ไม่มี key เชื่อมสองระบบ และจับคู่จากชื่ออัตโนมัติล้วนไม่ได้ เพราะ
 * `users.first_name` ของ ERP จริง ๆ เก็บ "ชื่อเล่น" ส่วน `employees.name` ของ HR เก็บชื่อจริง+นามสกุล
 * ระบบจึงแค่ "เดา" ให้ แล้วให้คนกดยืนยัน — ผลการผูกเก็บที่ users.hr_employee_id (migration 081)
 *
 * การจับคู่ทำเป็น 3 ชั้น เพราะพนักงาน HR มี 145 คนจาก 3 บริษัท 36 แผนก ถ้าไม่กรองก่อน dropdown จะยาวจนใช้ไม่ได้
 *   1. บริษัท : hr_company_map     (ERP company -> HR company, 1:1)
 *   2. แผนก   : hr_department_map  (ERP users.role -> HR departments, many-to-many)
 *   3. พนักงาน: users.hr_employee_id
 * ชั้น 1-2 มาจาก migration 082 — ฝั่ง ERP ไม่มีตารางแผนก สิ่งที่ทำหน้าที่แทนคือ users.role
 *
 * GET  ?action=list          - รายชื่อ user พร้อมสถานะการผูก + ตัวเลือกที่ระบบเดาให้ (default)
 * GET  ?action=config        - ข้อมูลสำหรับหน้าตั้งค่าแมปบริษัท/แผนก
 * GET  ?action=hr_employees  - รายชื่อพนักงาน HR ทั้งหมด
 * POST { user_id, hr_employee_id }                                  - ผูก (null = ยกเลิกการผูก)
 * POST { action:'set_company_map', erp_company_id, hr_company_id }   - ตั้งแมปบริษัท (null = ลบ)
 * POST { action:'set_department_map', erp_company_id, erp_role, hr_department_ids:[] } - แทนที่แมปแผนกของ role นั้น
 * POST { action:'auto_link' }                                       - ผูกอัตโนมัติเฉพาะคู่ที่มั่นใจ
 */

require_once __DIR__ . '/../config.php';

cors();

/** ตัดคำนำหน้าชื่อและช่องว่างทั้งหมดออก เพื่อเทียบชื่อแบบไม่สนรูปแบบการพิมพ์ */
function hrm_normalize_name($value): string
{
    $s = trim((string) $value);
    if ($s === '') {
        return '';
    }
    $prefixes = ['นางสาว', 'น.ส.', 'นาง', 'นาย', 'ว่าที่ ร.ต.', 'ว่าที่', 'คุณ', 'Mr.', 'Mrs.', 'Ms.'];
    foreach ($prefixes as $p) {
        if (mb_strpos($s, $p) === 0) {
            $s = mb_substr($s, mb_strlen($p));
            break;
        }
    }
    $s = preg_replace('/\s+/u', '', $s);
    return mb_strtolower(trim((string) $s));
}

/** เหลือเฉพาะตัวเลข 9 ตัวท้าย เพื่อเทียบเบอร์โทรที่พิมพ์คนละรูปแบบ (0812345678 / +66812345678 / 081-234-5678) */
function hrm_phone_key($value): string
{
    $digits = preg_replace('/\D+/', '', (string) $value);
    if (strlen((string) $digits) < 9) {
        return '';
    }
    return substr((string) $digits, -9);
}

try {
    $pdo = db_connect();
    $user = get_authenticated_user($pdo);

    if (!$user) {
        json_response(['success' => false, 'message' => 'Unauthorized'], 401);
    }

    $method = $_SERVER['REQUEST_METHOD'];
    $currentUserId = (int) $user['id'];
    $isSuperAdmin = in_array($user['role'] ?? '', ['Super Admin', 'Developer'], true);
    $permAction = ($method === 'GET') ? 'view' : 'use';

    if (!user_has_permission($pdo, $currentUserId, 'data.hr_employee_mapping', $permAction)) {
        json_response(['success' => false, 'message' => 'ไม่มีสิทธิ์เข้าถึงการจับคู่พนักงาน HR'], 403);
    }

    if (!hr_db_available($pdo)) {
        json_response([
            'success' => false,
            'message' => 'เชื่อมต่อฐานข้อมูล HR (' . HR_DB . ') ไม่ได้จากเซิร์ฟเวอร์นี้',
        ], 503);
    }

    // SuperAdmin เห็นทุกบริษัท คนอื่นเห็นเฉพาะบริษัทตัวเอง
    $companyScope = $isSuperAdmin ? null : (int) $user['company_id'];

    // ---- โหลดแมปบริษัท / แผนก ----
    $companyMap = [];   // erp_company_id => hr_company_id
    foreach ($pdo->query('SELECT erp_company_id, hr_company_id FROM hr_company_map') as $row) {
        $companyMap[(int) $row['erp_company_id']] = (int) $row['hr_company_id'];
    }
    $deptMap = [];      // erp_company_id => [erp_role => [hr_department_id, ...]]
    foreach ($pdo->query('SELECT erp_company_id, erp_role, hr_department_id FROM hr_department_map') as $row) {
        $deptMap[(int) $row['erp_company_id']][$row['erp_role']][] = (int) $row['hr_department_id'];
    }

    /** แผนก HR ที่ role นี้ควรอยู่ — คืน [] ถ้ายังไม่ได้ตั้งแมป (แปลว่าไม่กรองด้วยแผนก) */
    $deptsFor = function ($erpCompanyId, $erpRole) use ($deptMap) {
        $c = (int) $erpCompanyId;
        $r = (string) $erpRole;
        return (isset($deptMap[$c][$r]) ? $deptMap[$c][$r] : []);
    };

    if ($method === 'GET') {
        $action = $_GET['action'] ?? 'list';

        // ---------- หน้าตั้งค่าแมปบริษัท/แผนก ----------
        if ($action === 'config') {
            $sql = 'SELECT c.id, c.name, COUNT(u.id) AS active_users
                    FROM companies c
                    LEFT JOIN users u ON u.company_id = c.id AND u.status = \'active\'';
            $params = [];
            if ($companyScope !== null) {
                $sql .= ' WHERE c.id = ?';
                $params[] = $companyScope;
            }
            $sql .= ' GROUP BY c.id, c.name ORDER BY c.id';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $erpCompanies = [];
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $erpCompanies[] = [
                    'id' => (int) $row['id'],
                    'name' => $row['name'],
                    'active_users' => (int) $row['active_users'],
                    'hr_company_id' => isset($companyMap[(int) $row['id']]) ? $companyMap[(int) $row['id']] : null,
                ];
            }

            // role ที่ "มีอยู่จริง" ในข้อมูล ไม่ใช่ทุก role ที่นิยามไว้ในตาราง roles
            $sql = "SELECT company_id, role, COUNT(*) AS n
                    FROM users WHERE status = 'active' AND role IS NOT NULL AND role <> ''";
            $params = [];
            if ($companyScope !== null) {
                $sql .= ' AND company_id = ?';
                $params[] = $companyScope;
            }
            $sql .= ' GROUP BY company_id, role ORDER BY company_id, n DESC, role';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $erpRoles = [];
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $erpRoles[] = [
                    'company_id' => (int) $row['company_id'],
                    'role' => $row['role'],
                    'user_count' => (int) $row['n'],
                    'hr_department_ids' => $deptsFor($row['company_id'], $row['role']),
                ];
            }

            $hrCompanies = $pdo->query('SELECT id, code, name FROM ' . HR_DB . '.companies ORDER BY id')
                ->fetchAll(PDO::FETCH_ASSOC);
            foreach ($hrCompanies as &$hc) {
                $hc['id'] = (int) $hc['id'];
            }
            unset($hc);

            $hrDepartments = $pdo->query('
                SELECT d.id, d.company_id, d.name,
                       SUM(CASE WHEN e.is_active = 1 THEN 1 ELSE 0 END) AS active_employees
                FROM ' . HR_DB . '.departments d
                LEFT JOIN ' . HR_DB . '.employees e ON e.department_id = d.id
                GROUP BY d.id, d.company_id, d.name
                ORDER BY d.company_id, d.name
            ')->fetchAll(PDO::FETCH_ASSOC);
            foreach ($hrDepartments as &$hd) {
                $hd['id'] = (int) $hd['id'];
                $hd['company_id'] = (int) $hd['company_id'];
                $hd['active_employees'] = (int) $hd['active_employees'];
            }
            unset($hd);

            json_response([
                'success' => true,
                'erp_companies' => $erpCompanies,
                'erp_roles' => $erpRoles,
                'hr_companies' => $hrCompanies,
                'hr_departments' => $hrDepartments,
            ]);
        }

        // ---- พนักงาน HR ทั้งหมด (ใช้เป็นตัวเลือกใน dropdown) ----
        $hrStmt = $pdo->query('
            SELECT e.id, e.company_id, e.department_id, e.name, e.nickname, e.email, e.phone, e.hire_date,
                   e.is_active, e.terminated_at,
                   d.name AS department, p.name AS position, c.name AS company_name
            FROM ' . HR_DB . '.employees e
            LEFT JOIN ' . HR_DB . '.departments d ON d.id = e.department_id
            LEFT JOIN ' . HR_DB . '.positions   p ON p.id = e.position_id
            LEFT JOIN ' . HR_DB . '.companies   c ON c.id = e.company_id
            ORDER BY e.is_active DESC, e.company_id, e.name
        ');
        $hrEmployees = $hrStmt->fetchAll(PDO::FETCH_ASSOC);

        // ใครถูกผูกไปแล้วบ้าง (ดูทั้งระบบเสมอ ไม่ว่า scope จะเป็นบริษัทไหน จะได้ไม่เสนอคนซ้ำ)
        $linkedStmt = $pdo->query("
            SELECT hr_employee_id, id AS user_id, CONCAT(first_name, ' ', last_name) AS erp_name
            FROM users
            WHERE hr_employee_id IS NOT NULL AND hr_employee_id <> ''
        ");
        $linkedByHrId = [];
        foreach ($linkedStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $linkedByHrId[$row['hr_employee_id']] = [
                'user_id' => (int) $row['user_id'],
                'erp_name' => trim((string) $row['erp_name']),
            ];
        }

        foreach ($hrEmployees as &$e) {
            $e['company_id'] = (int) $e['company_id'];
            $e['department_id'] = $e['department_id'] === null ? null : (int) $e['department_id'];
            $e['is_active'] = (int) $e['is_active'] === 1;
            $link = isset($linkedByHrId[$e['id']]) ? $linkedByHrId[$e['id']] : null;
            $e['linked_user_id'] = $link ? $link['user_id'] : null;
            $e['linked_user_name'] = $link ? $link['erp_name'] : null;
        }
        unset($e);

        if ($action === 'hr_employees') {
            json_response(['success' => true, 'employees' => $hrEmployees]);
        }

        // ---- users ฝั่ง ERP ----
        $sql = "
            SELECT u.id, u.username, u.first_name, u.last_name, u.email, u.phone,
                   u.role, u.company_id, u.status, u.hr_employee_id, u.hr_linked_at,
                   c.name AS company_name,
                   lb.first_name AS linked_by_first_name, lb.last_name AS linked_by_last_name
            FROM users u
            LEFT JOIN companies c ON c.id = u.company_id
            LEFT JOIN users lb ON lb.id = u.hr_linked_by
        ";
        $params = [];
        if ($companyScope !== null) {
            $sql .= ' WHERE u.company_id = ?';
            $params[] = $companyScope;
        }
        $sql .= " ORDER BY (u.status = 'active') DESC, u.company_id, u.first_name, u.last_name";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $erpUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // ---- index พนักงาน HR ที่ยังว่าง เพื่อใช้เดาคู่ ----
        $byEmail = [];
        $byFullName = [];
        $byPhone = [];
        $byNickCompany = [];   // [hr_company_id][nickname] => [employee, ...]
        $byNickGlobal = [];    // [nickname] => [employee, ...]

        foreach ($hrEmployees as $e) {
            if (!$e['is_active'] || $e['linked_user_id'] !== null) {
                continue; // คนลาออกหรือถูกผูกไปแล้ว ไม่ต้องเสนอ
            }
            $email = mb_strtolower(trim((string) $e['email']));
            if ($email !== '') {
                $byEmail[$email][] = $e;
            }
            $full = hrm_normalize_name($e['name']);
            if ($full !== '') {
                $byFullName[$full][] = $e;
            }
            $phone = hrm_phone_key($e['phone']);
            if ($phone !== '') {
                $byPhone[$phone][] = $e;
            }
            $nick = hrm_normalize_name($e['nickname']);
            if ($nick !== '') {
                $byNickCompany[$e['company_id']][$nick][] = $e;
                $byNickGlobal[$nick][] = $e;
            }
        }

        // เดาคู่ให้ user ที่ยังไม่ผูก โดยไล่จากสัญญาณที่เชื่อถือได้มากไปน้อย
        $suggest = function (array $u) use ($byEmail, $byFullName, $byPhone, $byNickCompany, $byNickGlobal, $companyMap, $deptsFor) {
            $email = mb_strtolower(trim((string) $u['email']));
            if ($email !== '' && isset($byEmail[$email]) && count($byEmail[$email]) === 1) {
                return ['match' => $byEmail[$email][0], 'confidence' => 'high', 'reason' => 'อีเมลตรงกัน', 'candidates' => []];
            }

            $full = hrm_normalize_name($u['first_name'] . ' ' . $u['last_name']);
            if ($full !== '' && isset($byFullName[$full]) && count($byFullName[$full]) === 1) {
                return ['match' => $byFullName[$full][0], 'confidence' => 'high', 'reason' => 'ชื่อ-นามสกุลตรงกัน', 'candidates' => []];
            }

            $phone = hrm_phone_key($u['phone']);
            if ($phone !== '' && isset($byPhone[$phone]) && count($byPhone[$phone]) === 1) {
                return ['match' => $byPhone[$phone][0], 'confidence' => 'high', 'reason' => 'เบอร์โทรตรงกัน', 'candidates' => []];
            }

            // ERP เก็บชื่อเล่นไว้ใน first_name จึงเทียบกับ employees.nickname
            $nick = hrm_normalize_name($u['first_name']);
            if ($nick === '') {
                return null;
            }

            $erpCompany = (int) $u['company_id'];
            $hrCompany = isset($companyMap[$erpCompany]) ? $companyMap[$erpCompany] : null;
            $allowedDepts = $deptsFor($erpCompany, $u['role']);

            if ($hrCompany !== null && isset($byNickCompany[$hrCompany][$nick])) {
                $hits = $byNickCompany[$hrCompany][$nick];

                if (count($hits) === 1) {
                    $only = $hits[0];
                    // แมปแผนกไว้แล้วแต่คนที่เจออยู่คนละแผนก — ยังเสนอให้ แต่ลดความมั่นใจลงเพื่อให้คนตรวจ
                    if ($allowedDepts && !in_array((int) $only['department_id'], $allowedDepts, true)) {
                        return ['match' => $only, 'confidence' => 'low', 'reason' => 'ชื่อเล่นตรงกัน แต่คนละแผนกกับที่แมปไว้', 'candidates' => []];
                    }
                    return ['match' => $only, 'confidence' => 'medium', 'reason' => 'ชื่อเล่นตรงกัน (บริษัทเดียวกัน)', 'candidates' => []];
                }

                // ชื่อเล่นซ้ำ — ใช้แมปแผนกช่วยตัดตัวเลือกก่อนยอมแพ้
                if ($allowedDepts) {
                    $narrowed = [];
                    foreach ($hits as $h) {
                        if (in_array((int) $h['department_id'], $allowedDepts, true)) {
                            $narrowed[] = $h;
                        }
                    }
                    if (count($narrowed) === 1) {
                        return ['match' => $narrowed[0], 'confidence' => 'medium', 'reason' => 'ชื่อเล่นตรงกัน (แผนกเดียวกัน)', 'candidates' => []];
                    }
                    if (count($narrowed) > 1) {
                        return ['match' => null, 'confidence' => 'ambiguous', 'reason' => 'ชื่อเล่นซ้ำกัน ' . count($narrowed) . ' คนในแผนกเดียวกัน', 'candidates' => $narrowed];
                    }
                }

                return ['match' => null, 'confidence' => 'ambiguous', 'reason' => 'ชื่อเล่นซ้ำกัน ' . count($hits) . ' คน', 'candidates' => $hits];
            }

            if (isset($byNickGlobal[$nick])) {
                $hits = $byNickGlobal[$nick];
                if (count($hits) === 1) {
                    return ['match' => $hits[0], 'confidence' => 'low', 'reason' => 'ชื่อเล่นตรงกัน แต่คนละบริษัท', 'candidates' => []];
                }
                return ['match' => null, 'confidence' => 'ambiguous', 'reason' => 'ชื่อเล่นซ้ำกัน ' . count($hits) . ' คน', 'candidates' => $hits];
            }

            return null;
        };

        $hrById = [];
        foreach ($hrEmployees as $e) {
            $hrById[$e['id']] = $e;
        }

        $slim = function (?array $e) {
            if (!$e) {
                return null;
            }
            return [
                'id' => $e['id'],
                'name' => $e['name'],
                'nickname' => $e['nickname'],
                'company_id' => $e['company_id'],
                'company_name' => $e['company_name'],
                'department_id' => $e['department_id'],
                'department' => $e['department'],
                'position' => $e['position'],
                'hire_date' => $e['hire_date'],
                'is_active' => $e['is_active'],
            ];
        };

        $stats = ['total' => 0, 'linked' => 0, 'suggested' => 0, 'ambiguous' => 0, 'unmatched' => 0, 'no_hr_company' => 0];
        $records = [];
        foreach ($erpUsers as $u) {
            $hrId = $u['hr_employee_id'];
            $linked = ($hrId !== null && $hrId !== '' && isset($hrById[$hrId])) ? $hrById[$hrId] : null;
            $erpCompany = (int) $u['company_id'];
            $hrCompanyId = isset($companyMap[$erpCompany]) ? $companyMap[$erpCompany] : null;
            $allowedDepts = $deptsFor($erpCompany, $u['role']);

            $suggestion = null;
            if ($hrId === null || $hrId === '') {
                $s = $suggest($u);
                if ($s !== null) {
                    $suggestion = [
                        'employee' => $slim($s['match']),
                        'confidence' => $s['confidence'],
                        'reason' => $s['reason'],
                        'candidates' => array_map($slim, $s['candidates']),
                    ];
                }
            }

            $linkedByName = trim(((string) $u['linked_by_first_name']) . ' ' . ((string) $u['linked_by_last_name']));

            $records[] = [
                'user_id' => (int) $u['id'],
                'username' => $u['username'],
                'erp_first_name' => $u['first_name'],
                'erp_last_name' => $u['last_name'],
                'erp_display_name' => trim(((string) $u['first_name']) . ' ' . ((string) $u['last_name'])),
                'email' => $u['email'],
                'phone' => $u['phone'],
                'role' => $u['role'],
                'company_id' => $erpCompany,
                'company_name' => $u['company_name'],
                'status' => $u['status'],
                'hr_employee_id' => ($hrId === '' ? null : $hrId),
                'hr_linked_at' => $u['hr_linked_at'],
                'hr_linked_by_name' => ($linkedByName !== '' ? $linkedByName : null),
                // ถ้าผูกไว้กับ id ที่หาไม่เจอใน HR แล้ว (พนักงานถูกลบ) ให้บอกไปตรง ๆ แทนที่จะเงียบ
                'hr_missing' => ($hrId !== null && $hrId !== '' && $linked === null),
                'hr' => $slim($linked),
                'suggestion' => $suggestion,
                // ใช้กรองตัวเลือกใน dropdown ฝั่งหน้าเว็บ
                'hr_company_id' => $hrCompanyId,
                'hr_company_covered' => $hrCompanyId !== null,
                'hr_department_ids' => $allowedDepts,
            ];

            $stats['total']++;
            if ($linked !== null) {
                $stats['linked']++;
            } elseif ($hrCompanyId === null) {
                $stats['no_hr_company']++;
            } elseif ($suggestion === null) {
                $stats['unmatched']++;
            } elseif ($suggestion['confidence'] === 'ambiguous') {
                $stats['ambiguous']++;
            } else {
                $stats['suggested']++;
            }
        }

        json_response([
            'success' => true,
            'hr_database' => HR_DB,
            'company_map' => $companyMap,
            'department_map_count' => (int) $pdo->query('SELECT COUNT(*) FROM hr_department_map')->fetchColumn(),
            'stats' => $stats,
            'records' => $records,
            'hr_employees' => $hrEmployees,
        ]);
    }

    if ($method !== 'POST') {
        json_response(['success' => false, 'message' => 'Method not allowed'], 405);
    }

    // ---------------- POST ----------------
    $input = json_input();
    $action = $input['action'] ?? 'link';

    /** คนที่ไม่ใช่ SuperAdmin แก้ได้เฉพาะบริษัทตัวเอง */
    $assertCompanyAllowed = function ($erpCompanyId) use ($companyScope) {
        if ($companyScope !== null && (int) $erpCompanyId !== $companyScope) {
            json_response(['success' => false, 'message' => 'แก้ไขได้เฉพาะบริษัทของคุณ'], 403);
        }
    };

    // ---- ชั้นที่ 1: แมปบริษัท ----
    if ($action === 'set_company_map') {
        $erpCompanyId = isset($input['erp_company_id']) ? (int) $input['erp_company_id'] : 0;
        $hrCompanyId = $input['hr_company_id'] ?? null;
        if ($hrCompanyId === '' || $hrCompanyId === null) {
            $hrCompanyId = null;
        } else {
            $hrCompanyId = (int) $hrCompanyId;
        }

        if ($erpCompanyId <= 0) {
            json_response(['success' => false, 'message' => 'ต้องระบุ erp_company_id'], 400);
        }
        $assertCompanyAllowed($erpCompanyId);

        if ($hrCompanyId === null) {
            $stmt = $pdo->prepare('DELETE FROM hr_company_map WHERE erp_company_id = ?');
            $stmt->execute([$erpCompanyId]);
            json_response(['success' => true, 'message' => 'ลบการแมปบริษัทแล้ว']);
        }

        $chk = $pdo->prepare('SELECT id, name FROM ' . HR_DB . '.companies WHERE id = ?');
        $chk->execute([$hrCompanyId]);
        $hrCompany = $chk->fetch(PDO::FETCH_ASSOC);
        if (!$hrCompany) {
            json_response(['success' => false, 'message' => 'ไม่พบบริษัท HR รหัส ' . $hrCompanyId], 404);
        }

        $stmt = $pdo->prepare('
            INSERT INTO hr_company_map (erp_company_id, hr_company_id, updated_by)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE hr_company_id = VALUES(hr_company_id), updated_by = VALUES(updated_by)
        ');
        $stmt->execute([$erpCompanyId, $hrCompanyId, $currentUserId]);

        json_response(['success' => true, 'message' => 'แมปกับบริษัท "' . $hrCompany['name'] . '" แล้ว']);
    }

    // ---- ชั้นที่ 2: แมปแผนก (แทนที่ทั้งชุดของ role นั้น) ----
    if ($action === 'set_department_map') {
        $erpCompanyId = isset($input['erp_company_id']) ? (int) $input['erp_company_id'] : 0;
        $erpRole = trim((string) ($input['erp_role'] ?? ''));
        $deptIds = $input['hr_department_ids'] ?? [];
        if (!is_array($deptIds)) {
            $deptIds = [];
        }
        $deptIds = array_values(array_unique(array_map('intval', $deptIds)));

        if ($erpCompanyId <= 0 || $erpRole === '') {
            json_response(['success' => false, 'message' => 'ต้องระบุ erp_company_id และ erp_role'], 400);
        }
        $assertCompanyAllowed($erpCompanyId);

        if ($deptIds) {
            $ph = implode(',', array_fill(0, count($deptIds), '?'));
            $chk = $pdo->prepare('SELECT COUNT(*) FROM ' . HR_DB . '.departments WHERE id IN (' . $ph . ')');
            $chk->execute($deptIds);
            if ((int) $chk->fetchColumn() !== count($deptIds)) {
                json_response(['success' => false, 'message' => 'มีรหัสแผนก HR ที่ไม่มีอยู่จริง'], 404);
            }
        }

        // แทนที่ทั้งชุด เพื่อให้ผลลัพธ์ตรงกับที่เห็นบนหน้าจอเสมอ (ติ๊กออก = ลบจริง)
        $pdo->beginTransaction();
        try {
            $del = $pdo->prepare('DELETE FROM hr_department_map WHERE erp_company_id = ? AND erp_role = ?');
            $del->execute([$erpCompanyId, $erpRole]);
            if ($deptIds) {
                $ins = $pdo->prepare('INSERT INTO hr_department_map (erp_company_id, erp_role, hr_department_id, created_by) VALUES (?, ?, ?, ?)');
                foreach ($deptIds as $did) {
                    $ins->execute([$erpCompanyId, $erpRole, $did, $currentUserId]);
                }
            }
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        json_response([
            'success' => true,
            'message' => $deptIds ? ('แมป ' . count($deptIds) . ' แผนกให้ "' . $erpRole . '" แล้ว') : ('ล้างการแมปแผนกของ "' . $erpRole . '" แล้ว'),
            'hr_department_ids' => $deptIds,
        ]);
    }

    // ---- ชั้นที่ 3: ผูกพนักงานอัตโนมัติ ----
    if ($action === 'auto_link') {
        // ผูกให้อัตโนมัติเฉพาะคู่ที่มั่นใจ (high = email/ชื่อเต็ม/เบอร์, medium = ชื่อเล่นไม่ซ้ำในบริษัท/แผนกเดียวกัน)
        // ตั้งใจไม่รวม low (คนละบริษัท/คนละแผนก) และ ambiguous — สองอย่างนั้นต้องให้คนเลือกเอง
        $hrStmt = $pdo->query('
            SELECT e.id, e.company_id, e.department_id, e.name, e.nickname, e.email, e.phone
            FROM ' . HR_DB . '.employees e
            WHERE e.is_active = 1
        ');
        $hrRows = $hrStmt->fetchAll(PDO::FETCH_ASSOC);

        $linkedIds = $pdo->query("SELECT hr_employee_id FROM users WHERE hr_employee_id IS NOT NULL AND hr_employee_id <> ''")
            ->fetchAll(PDO::FETCH_COLUMN);
        $linkedIds = array_flip($linkedIds);

        $byEmail = [];
        $byFullName = [];
        $byPhone = [];
        $byNickCompany = [];
        foreach ($hrRows as $e) {
            if (isset($linkedIds[$e['id']])) {
                continue;
            }
            $e['company_id'] = (int) $e['company_id'];
            $e['department_id'] = $e['department_id'] === null ? null : (int) $e['department_id'];
            $email = mb_strtolower(trim((string) $e['email']));
            if ($email !== '') {
                $byEmail[$email][] = $e;
            }
            $full = hrm_normalize_name($e['name']);
            if ($full !== '') {
                $byFullName[$full][] = $e;
            }
            $phone = hrm_phone_key($e['phone']);
            if ($phone !== '') {
                $byPhone[$phone][] = $e;
            }
            $nick = hrm_normalize_name($e['nickname']);
            if ($nick !== '') {
                $byNickCompany[$e['company_id']][$nick][] = $e;
            }
        }

        $sql = "SELECT id, first_name, last_name, email, phone, company_id, role
                FROM users
                WHERE status = 'active' AND (hr_employee_id IS NULL OR hr_employee_id = '')";
        $params = [];
        if ($companyScope !== null) {
            $sql .= ' AND company_id = ?';
            $params[] = $companyScope;
        }
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $candidates = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $update = $pdo->prepare('UPDATE users SET hr_employee_id = ?, hr_linked_at = NOW(), hr_linked_by = ? WHERE id = ?');
        $taken = [];
        $linkedCount = 0;
        $details = [];

        foreach ($candidates as $u) {
            $pick = null;
            $reason = '';

            $email = mb_strtolower(trim((string) $u['email']));
            $full = hrm_normalize_name($u['first_name'] . ' ' . $u['last_name']);
            $phone = hrm_phone_key($u['phone']);
            $nick = hrm_normalize_name($u['first_name']);
            $erpCompany = (int) $u['company_id'];
            $hrCompany = isset($companyMap[$erpCompany]) ? $companyMap[$erpCompany] : null;
            $allowedDepts = $deptsFor($erpCompany, $u['role']);

            if ($email !== '' && isset($byEmail[$email]) && count($byEmail[$email]) === 1) {
                $pick = $byEmail[$email][0];
                $reason = 'อีเมลตรงกัน';
            } elseif ($full !== '' && isset($byFullName[$full]) && count($byFullName[$full]) === 1) {
                $pick = $byFullName[$full][0];
                $reason = 'ชื่อ-นามสกุลตรงกัน';
            } elseif ($phone !== '' && isset($byPhone[$phone]) && count($byPhone[$phone]) === 1) {
                $pick = $byPhone[$phone][0];
                $reason = 'เบอร์โทรตรงกัน';
            } elseif ($hrCompany !== null && $nick !== '' && isset($byNickCompany[$hrCompany][$nick])) {
                $hits = $byNickCompany[$hrCompany][$nick];
                if (count($hits) === 1) {
                    // แมปแผนกไว้แล้วแต่คนละแผนก = ความมั่นใจต่ำ ไม่ผูกอัตโนมัติ
                    if (!$allowedDepts || in_array((int) $hits[0]['department_id'], $allowedDepts, true)) {
                        $pick = $hits[0];
                        $reason = 'ชื่อเล่นตรงกัน (บริษัทเดียวกัน)';
                    }
                } elseif ($allowedDepts) {
                    $narrowed = [];
                    foreach ($hits as $h) {
                        if (in_array((int) $h['department_id'], $allowedDepts, true)) {
                            $narrowed[] = $h;
                        }
                    }
                    if (count($narrowed) === 1) {
                        $pick = $narrowed[0];
                        $reason = 'ชื่อเล่นตรงกัน (แผนกเดียวกัน)';
                    }
                }
            }

            if ($pick === null || isset($taken[$pick['id']])) {
                continue; // ไม่มั่นใจ หรือ HR คนนี้เพิ่งถูกจองไปในรอบเดียวกัน
            }

            $update->execute([$pick['id'], $currentUserId, (int) $u['id']]);
            $taken[$pick['id']] = true;
            $linkedCount++;
            $details[] = [
                'user_id' => (int) $u['id'],
                'erp_name' => trim(((string) $u['first_name']) . ' ' . ((string) $u['last_name'])),
                'hr_employee_id' => $pick['id'],
                'hr_name' => $pick['name'],
                'reason' => $reason,
            ];
        }

        json_response([
            'success' => true,
            'message' => 'ผูกอัตโนมัติสำเร็จ ' . $linkedCount . ' คน',
            'linked' => $linkedCount,
            'details' => $details,
        ]);
    }

    // ---- ชั้นที่ 3: ผูก / ยกเลิกการผูก ทีละคน ----
    $userId = isset($input['user_id']) ? (int) $input['user_id'] : 0;
    $hrEmployeeId = $input['hr_employee_id'] ?? null;
    if (is_string($hrEmployeeId)) {
        $hrEmployeeId = trim($hrEmployeeId);
    }
    if ($hrEmployeeId === '') {
        $hrEmployeeId = null;
    }

    if ($userId <= 0) {
        json_response(['success' => false, 'message' => 'ต้องระบุ user_id'], 400);
    }

    $target = $pdo->prepare('SELECT id, company_id, first_name, last_name FROM users WHERE id = ?');
    $target->execute([$userId]);
    $targetUser = $target->fetch(PDO::FETCH_ASSOC);
    if (!$targetUser) {
        json_response(['success' => false, 'message' => 'ไม่พบผู้ใช้งานนี้'], 404);
    }
    $assertCompanyAllowed($targetUser['company_id']);

    if ($hrEmployeeId !== null) {
        $check = $pdo->prepare('SELECT id, name FROM ' . HR_DB . '.employees WHERE id = ?');
        $check->execute([$hrEmployeeId]);
        $hrRow = $check->fetch(PDO::FETCH_ASSOC);
        if (!$hrRow) {
            json_response(['success' => false, 'message' => 'ไม่พบพนักงาน HR รหัส ' . $hrEmployeeId], 404);
        }

        // กันผูกซ้ำก่อนชน UNIQUE index จะได้แจ้งเป็นภาษาคนแทน SQLSTATE 23000
        $dup = $pdo->prepare("SELECT id, CONCAT(first_name, ' ', last_name) AS name FROM users WHERE hr_employee_id = ? AND id <> ?");
        $dup->execute([$hrEmployeeId, $userId]);
        $dupRow = $dup->fetch(PDO::FETCH_ASSOC);
        if ($dupRow) {
            json_response([
                'success' => false,
                'message' => 'พนักงาน HR คนนี้ถูกผูกกับผู้ใช้ "' . trim((string) $dupRow['name']) . '" อยู่แล้ว',
            ], 409);
        }
    }

    $stmt = $pdo->prepare('UPDATE users SET hr_employee_id = ?, hr_linked_at = ?, hr_linked_by = ? WHERE id = ?');
    $stmt->execute([
        $hrEmployeeId,
        $hrEmployeeId === null ? null : date('Y-m-d H:i:s'),
        $hrEmployeeId === null ? null : $currentUserId,
        $userId,
    ]);

    json_response([
        'success' => true,
        'message' => $hrEmployeeId === null ? 'ยกเลิกการผูกแล้ว' : 'ผูกข้อมูลพนักงานเรียบร้อย',
        'user_id' => $userId,
        'hr_employee_id' => $hrEmployeeId,
    ]);

} catch (Throwable $e) {
    json_response(['success' => false, 'message' => $e->getMessage()], 500);
}
