<?php

function handle_users(PDO $pdo, ?string $id, ?string $action = null, ?string $subAction = null): void
{
    if ($id && $action === 'permissions') {
        handle_user_permissions($pdo, $id, $subAction);
        return;
    }

    switch (method()) {
        case 'GET':
            if ($id) {
                $stmt = $pdo->prepare('SELECT id, username, first_name, last_name, email, phone, role, role_id, company_id, team_id, supervisor_id, status, created_at, updated_at, last_login, login_count FROM users WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                if ($row) {
                    // Load customTags for this user
                    $tagsStmt = $pdo->prepare('SELECT t.* FROM tags t JOIN user_tags ut ON t.id = ut.tag_id WHERE ut.user_id = ? AND t.type = ?');
                    $tagsStmt->execute([$id, 'USER']);
                    $row['customTags'] = $tagsStmt->fetchAll();
                    json_response($row);
                } else {
                    json_response(['error' => 'NOT_FOUND'], 404);
                }
            } else {
                $companyId = $_GET['companyId'] ?? null;
                $status = $_GET['status'] ?? null;
                $sql = 'SELECT u.id, u.username, u.first_name, u.last_name, u.email, u.phone, u.role, u.role_id, u.company_id, u.team_id, u.supervisor_id, u.status, u.created_at, u.updated_at, u.last_login, u.login_count, r.is_system FROM users u LEFT JOIN roles r ON u.role = r.name';
                $params = [];
                $conditions = [];

                if ($companyId) {
                    $conditions[] = 'u.company_id = ?';
                    $params[] = $companyId;
                }

                if ($status) {
                    $conditions[] = 'u.status = ?';
                    $params[] = $status;
                }

                if (!empty($conditions)) {
                    $sql .= ' WHERE ' . implode(' AND ', $conditions);
                }

                $sql .= ' ORDER BY u.id';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $users = $stmt->fetchAll();

                // Load customTags for each user
                foreach ($users as &$user) {
                    $tagsStmt = $pdo->prepare('SELECT t.* FROM tags t JOIN user_tags ut ON t.id = ut.tag_id WHERE ut.user_id = ? AND t.type = ?');
                    $tagsStmt->execute([$user['id'], 'USER']);
                    $user['customTags'] = $tagsStmt->fetchAll();
                }
                unset($user);

                json_response($users);
            }
            break;
        case 'POST':
            $in = json_input();
            if (!$in || !is_array($in)) {
                $in = [];
            }
            $username = trim((string) ($in['username'] ?? ''));
            $password = isset($in['password']) ? (string) $in['password'] : null; // plaintext for demo only
            $first = trim((string) ($in['firstName'] ?? ''));
            $last = trim((string) ($in['lastName'] ?? ''));
            $email = $in['email'] ?? null;
            $phone = $in['phone'] ?? null;
            $role = trim((string) ($in['role'] ?? ''));
            $companyId = $in['companyId'] ?? null;
            $teamId = $in['teamId'] ?? null;
            $supervisorId = $in['supervisorId'] ?? null;
            $status = $in['status'] ?? 'active';

            if ($username === '' || $first === '' || $last === '' || $role === '' || !$companyId) {
                json_response(['error' => 'VALIDATION_FAILED', 'message' => 'username, firstName, lastName, role, companyId are required'], 400);
            }
            try {
                // Find matching role_id
                $rStmt = $pdo->prepare('SELECT id FROM roles WHERE name = ?');
                $rStmt->execute([$role]);
                $rId = $rStmt->fetchColumn();

                if ($rId !== false) {
                    $stmt = $pdo->prepare('INSERT INTO users(username, password, first_name, last_name, email, phone, role, role_id, company_id, team_id, supervisor_id, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, NOW(), NOW())');
                    $stmt->execute([$username, $password, $first, $last, $email, $phone, $role, $rId, $companyId, $teamId, $supervisorId, $status]);
                } else {
                    $stmt = $pdo->prepare('INSERT INTO users(username, password, first_name, last_name, email, phone, role, company_id, team_id, supervisor_id, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?, NOW(), NOW())');
                    $stmt->execute([$username, $password, $first, $last, $email, $phone, $role, $companyId, $teamId, $supervisorId, $status]);
                }
                $newId = (int) $pdo->lastInsertId();
                $get = $pdo->prepare('SELECT id, username, first_name, last_name, email, phone, role, role_id, company_id, team_id, supervisor_id, status, created_at, updated_at, last_login, login_count FROM users WHERE id = ?');
                $get->execute([$newId]);
                json_response($get->fetch(), 201);
            } catch (Throwable $e) {
                $code = 500;
                $msg = $e->getMessage();
                if (strpos($msg, 'Duplicate') !== false || strpos($msg, 'UNIQUE') !== false) {
                    $code = 409;
                }
                json_response(['error' => 'CREATE_FAILED', 'message' => $msg], $code);
            }
            break;
        case 'PUT':
        case 'PATCH':
            if (!$id)
                json_response(['error' => 'ID_REQUIRED'], 400);
            $in = json_input();
            if (!$in || !is_array($in)) {
                $in = [];
            }
            $fields = [];
            $params = [];
            $map = [
                'username' => 'username',
                'password' => 'password',
                'firstName' => 'first_name',
                'lastName' => 'last_name',
                'email' => 'email',
                'phone' => 'phone',
                'role' => 'role',
                'companyId' => 'company_id',
                'teamId' => 'team_id',
                'supervisorId' => 'supervisor_id',
                'status' => 'status',
            ];
            foreach ($map as $inKey => $col) {
                if (array_key_exists($inKey, $in)) {
                    $fields[] = "$col = ?";
                    $params[] = $in[$inKey];
                    // Also update role_id if role is updating
                    if ($col === 'role') {
                        $roleName = $in[$inKey];
                        $rStmt = $pdo->prepare('SELECT id FROM roles WHERE name = ?');
                        $rStmt->execute([$roleName]);
                        $rId = $rStmt->fetchColumn();
                        if ($rId !== false) {
                            $fields[] = 'role_id = ?';
                            $params[] = $rId;
                        }
                    }
                }
            }
            if (empty($fields)) {
                json_response(['ok' => true]);
            }
            // Always update updated_at timestamp
            $fields[] = "updated_at = NOW()";
            $params[] = $id;
            try {
                $sql = 'UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $get = $pdo->prepare('SELECT id, username, first_name, last_name, email, phone, role, role_id, company_id, team_id, supervisor_id, status, created_at, updated_at, last_login, login_count FROM users WHERE id = ?');
                $get->execute([$id]);
                $row = $get->fetch();
                $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            } catch (Throwable $e) {
                json_response(['error' => 'UPDATE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        case 'DELETE':
            if (!$id)
                json_response(['error' => 'ID_REQUIRED'], 400);
            try {
                // Instead of deleting, mark as resigned
                $stmt = $pdo->prepare('UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?');
                $stmt->execute(['resigned', $id]);
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                json_response(['error' => 'UPDATE_FAILED', 'message' => $e->getMessage()], 409);
            }
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

/**
 * Helper function: Attach next_appointment data to customers array
 * This eliminates the need to load 12,000+ appointments separately
 * Uses batch query to avoid N+1 problem
 */
function attach_next_appointments_to_customers(PDO $pdo, array &$customers): void
{
    if (empty($customers))
        return;

    // Collect all customer IDs
    $customerIds = [];
    foreach ($customers as $c) {
        $cid = $c['customer_id'] ?? $c['id'] ?? null;
        if ($cid) {
            $customerIds[] = $cid;
        }
    }

    if (empty($customerIds))
        return;

    // Batch query: Get next appointment for each customer (upcoming or most recent overdue)
    // Priority: upcoming appointments first, then overdue if no upcoming
    $placeholders = implode(',', array_fill(0, count($customerIds), '?'));

    try {
        $sql = "
            SELECT 
                a.customer_id,
                a.id as next_appointment_id,
                a.date as next_appointment_date,
                a.title as next_appointment_title,
                a.status as next_appointment_status,
                a.notes as next_appointment_notes
            FROM appointments a
            INNER JOIN (
                SELECT customer_id, MIN(date) as min_date
                FROM appointments
                WHERE customer_id IN ($placeholders)
                  AND status != 'เสร็จสิ้น'
                  AND date >= CURDATE()
                GROUP BY customer_id
            ) upcoming ON a.customer_id = upcoming.customer_id AND a.date = upcoming.min_date
            WHERE a.status != 'เสร็จสิ้น'
            
            UNION ALL
            
            SELECT 
                a.customer_id,
                a.id as next_appointment_id,
                a.date as next_appointment_date,
                a.title as next_appointment_title,
                a.status as next_appointment_status,
                a.notes as next_appointment_notes
            FROM appointments a
            INNER JOIN (
                SELECT customer_id, MAX(date) as max_date
                FROM appointments
                WHERE customer_id IN ($placeholders)
                  AND status != 'เสร็จสิ้น'
                  AND date < CURDATE()
                  AND customer_id NOT IN (
                      SELECT DISTINCT customer_id FROM appointments 
                      WHERE customer_id IN ($placeholders) 
                      AND status != 'เสร็จสิ้น' 
                      AND date >= CURDATE()
                  )
                GROUP BY customer_id
            ) overdue ON a.customer_id = overdue.customer_id AND a.date = overdue.max_date
            WHERE a.status != 'เสร็จสิ้น'
        ";

        // Params: customerIds x 3 (for each subquery: upcoming, upcoming_dedup, overdue)
        // SQL Structure: Main SELECT -> Upcoming JOIN -> UNION -> Main SELECT -> Overdue JOIN (with subquery)
        // Wait, let's count placeholders precisely:
        // 1. Upcoming JOIN: WHERE customer_id IN (...) -> 1 set
        // 2. Overdue JOIN: WHERE customer_id IN (...) -> 2nd set
        // 3. Overdue JOIN -> NOT IN subquery: WHERE customer_id IN (...) -> 3rd set
        // Total = 3 sets. 
        $params = array_merge($customerIds, $customerIds, $customerIds);

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $appointments = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Build lookup map
        $appointmentMap = [];
        foreach ($appointments as $apt) {
            $cid = $apt['customer_id'];
            if (!isset($appointmentMap[$cid])) {
                $appointmentMap[$cid] = $apt;
            }
        }

        // Attach to customers
        foreach ($customers as &$customer) {
            $cid = $customer['customer_id'] ?? $customer['id'] ?? null;
            if ($cid && isset($appointmentMap[$cid])) {
                $apt = $appointmentMap[$cid];
                $customer['next_appointment_id'] = $apt['next_appointment_id'];
                $customer['next_appointment_date'] = $apt['next_appointment_date'];
                $customer['next_appointment_title'] = $apt['next_appointment_title'];
                $customer['next_appointment_status'] = $apt['next_appointment_status'];
                $customer['next_appointment_notes'] = $apt['next_appointment_notes'];
            }
        }
        unset($customer);

    } catch (Throwable $e) {
        // If appointments table doesn't exist or error, silently continue
        error_log("attach_next_appointments_to_customers error: " . $e->getMessage());
    }
}

/**
 * Helper function: Attach call status data to customers array
 * This attaches: last_call_date, call_count_by_owner, last_call_result
 * Only counts calls made by the CURRENT OWNER (matching caller name)
 * Uses batch query to avoid N+1 problem
 */
