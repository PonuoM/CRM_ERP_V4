<?php

function handle_platforms(PDO $pdo, ?string $id): void
{
    // Authenticate
    $user = get_authenticated_user($pdo);
    if (!$user) {
        json_response(['error' => 'UNAUTHORIZED'], 401);
    }
    $userCompanyId = $user['company_id'];
    $isSuperAdmin = ($user['role'] === 'Super Admin' || $user['role'] === 'Developer');

    try {
        $companyId = $_GET['companyId'] ?? null;
        if (!$companyId && method() !== 'GET') {
            // For POST, PATCH, DELETE, get companyId from request body
            $in = json_input();
            $companyId = $in['companyId'] ?? null;
        }

        // Secure by default: always use user's company ID unless explicitly requested otherwise (and allowed)
        if (!$companyId) {
            $companyId = $userCompanyId;
        }
        if ($companyId != $userCompanyId && !$isSuperAdmin) {
            $companyId = $userCompanyId; // Force back to user's company
        }

        // Optional role-based visibility filter (Super Admin sees all)
        $userRole = isset($_GET['userRole']) ? trim((string) $_GET['userRole']) : null;
        if ($userRole === '') {
            $userRole = null;
        }

        switch (method()) {
            case 'GET':
                if ($id) {
                    $sql = 'SELECT * FROM platforms WHERE id = ?';
                    $params = [$id];
                    if ($companyId) {
                        $sql .= ' AND company_id = ?';
                        $params[] = $companyId;
                    }
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($params);
                    $row = $stmt->fetch();
                    $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
                } else {
                    $activeOnly = isset($_GET['active']) && $_GET['active'] === 'true';
                    $sql = 'SELECT * FROM platforms';
                    $params = [];
                    $conditions = [];
                    if ($companyId) {
                        $conditions[] = 'company_id = ?';
                        $params[] = $companyId;
                    }
                    if ($activeOnly) {
                        $conditions[] = 'active = 1';
                    }
                    // If not Super Admin or Admin Control, restrict to platforms where role_show JSON contains this role
                    if ($userRole && $userRole !== 'Super Admin' && $userRole !== 'Admin Control') {
                        $conditions[] = '(JSON_VALID(role_show) AND JSON_CONTAINS(role_show, JSON_QUOTE(?), \'$\'))';
                        $params[] = $userRole;
                    }
                    if ($conditions) {
                        $sql .= ' WHERE ' . implode(' AND ', $conditions);
                    }
                    $sql .= ' ORDER BY sort_order ASC, id ASC';
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($params);
                    json_response($stmt->fetchAll());
                }
                break;
            case 'POST':
                $in = json_input();
                if (!$companyId) {
                    $companyId = $in['companyId'] ?? $userCompanyId;
                }
                if (!$companyId) {
                    json_response(['error' => 'COMPANY_ID_REQUIRED'], 400);
                    return;
                }
                $stmt = $pdo->prepare('INSERT INTO platforms (name, display_name, description, company_id, active, sort_order, show_pages_from, require_page, role_show) VALUES (?,?,?,?,?,?,?,?,?)');
                $active = isset($in['active']) ? (!empty($in['active']) ? 1 : 0) : 1;
                $sortOrder = isset($in['sortOrder']) ? (int) $in['sortOrder'] : 0;
                $showPagesFrom = isset($in['showPagesFrom']) ? (trim($in['showPagesFrom']) ?: null) : null;
                $requirePage = isset($in['requirePage']) ? (!empty($in['requirePage']) ? 1 : 0) : 1;
                $roleShow = isset($in['roleShow']) ? $in['roleShow'] : null;
                if (is_array($roleShow)) {
                    $roleShow = json_encode(array_values($roleShow));
                } else {
                    $roleShow = null;
                }
                $stmt->execute([
                    $in['name'] ?? '',
                    $in['displayName'] ?? $in['name'] ?? '',
                    $in['description'] ?? null,
                    $companyId,
                    $active,
                    $sortOrder,
                    $showPagesFrom,
                    $requirePage,
                    $roleShow
                ]);
                json_response(['id' => $pdo->lastInsertId()]);
                break;
            case 'PATCH':
                if (!$id)
                    json_response(['error' => 'ID_REQUIRED'], 400);
                $in = json_input();
                // Verify company_id matches if provided
                if ($companyId) {
                    $checkStmt = $pdo->prepare('SELECT company_id FROM platforms WHERE id = ?');
                    $checkStmt->execute([$id]);
                    $platformCompanyId = $checkStmt->fetchColumn();
                    if ($platformCompanyId != $companyId) {
                        json_response(['error' => 'FORBIDDEN'], 403);
                        return;
                    }
                }
                $set = [];
                $params = [];
                if (isset($in['name'])) {
                    $set[] = 'name = ?';
                    $params[] = $in['name'];
                }
                if (isset($in['displayName'])) {
                    $set[] = 'display_name = ?';
                    $params[] = $in['displayName'];
                }
                if (isset($in['description'])) {
                    $set[] = 'description = ?';
                    $params[] = $in['description'];
                }
                if (isset($in['active'])) {
                    $set[] = 'active = ?';
                    $params[] = !empty($in['active']) ? 1 : 0;
                }
                if (isset($in['sortOrder'])) {
                    $set[] = 'sort_order = ?';
                    $params[] = (int) $in['sortOrder'];
                }
                if (isset($in['showPagesFrom'])) {
                    $set[] = 'show_pages_from = ?';
                    $params[] = trim($in['showPagesFrom']) ?: null;
                }
                if (array_key_exists('requirePage', $in)) {
                    $set[] = 'require_page = ?';
                    $params[] = !empty($in['requirePage']) ? 1 : 0;
                }
                if (array_key_exists('roleShow', $in)) {
                    $set[] = 'role_show = ?';
                    $value = $in['roleShow'];
                    if (is_array($value)) {
                        $params[] = json_encode(array_values($value));
                    } else {
                        $params[] = null;
                    }
                }
                if (!$set)
                    json_response(['error' => 'NO_FIELDS'], 400);
                $params[] = $id;
                $sql = 'UPDATE platforms SET ' . implode(', ', $set) . ' WHERE id = ?';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                json_response(['ok' => true]);
                break;
            case 'DELETE':
                if (!$id)
                    json_response(['error' => 'ID_REQUIRED'], 400);
                // Verify company_id matches if provided
                if ($companyId) {
                    $checkStmt = $pdo->prepare('SELECT company_id FROM platforms WHERE id = ?');
                    $checkStmt->execute([$id]);
                    $platformCompanyId = $checkStmt->fetchColumn();
                    if ($platformCompanyId != $companyId) {
                        json_response(['error' => 'FORBIDDEN'], 403);
                        return;
                    }
                }
                // Soft delete by setting active = 0 instead of actually deleting
                $stmt = $pdo->prepare('UPDATE platforms SET active = 0 WHERE id = ?');
                $stmt->execute([$id]);
                json_response(['ok' => true]);
                break;
            default:
                json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
        }
    } catch (Throwable $e) {
        json_response(['error' => 'PLATFORMS_FAILED', 'message' => $e->getMessage()], 500);
    }
}
