<?php

function handle_bank_accounts(PDO $pdo, ?string $id): void
{
    try {
        $companyId = $_GET['companyId'] ?? null;
        if (!$companyId && method() !== 'GET') {
            // For POST, PATCH, DELETE, get companyId from request body
            $in = json_input();
            $companyId = $in['companyId'] ?? null;
        }

        switch (method()) {
            case 'GET':
                if ($id) {
                    $sql = 'SELECT * FROM bank_account WHERE id = ? AND deleted_at IS NULL';
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
                    $sql = 'SELECT * FROM bank_account WHERE deleted_at IS NULL';
                    $params = [];
                    $conditions = [];
                    if ($companyId) {
                        $conditions[] = 'company_id = ?';
                        $params[] = $companyId;
                    }
                    if ($activeOnly) {
                        $conditions[] = 'is_active = 1';
                    }
                    if ($conditions) {
                        $sql .= ' AND ' . implode(' AND ', $conditions);
                    }
                    $sql .= ' ORDER BY bank ASC, bank_number ASC';
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($params);
                    json_response($stmt->fetchAll());
                }
                break;
            case 'POST':
                $in = json_input();
                if (!$companyId) {
                    $companyId = $in['companyId'] ?? null;
                }
                if (!$companyId) {
                    json_response(['error' => 'COMPANY_ID_REQUIRED'], 400);
                    return;
                }
                $stmt = $pdo->prepare('INSERT INTO bank_account (bank, bank_number, company_id, is_active) VALUES (?,?,?,?)');
                $active = isset($in['isActive']) ? (!empty($in['isActive']) ? 1 : 0) : 1;
                $stmt->execute([
                    $in['bank'] ?? '',
                    $in['bankNumber'] ?? '',
                    $companyId,
                    $active
                ]);
                json_response(['id' => $pdo->lastInsertId()]);
                break;
            case 'PATCH':
                if (!$id)
                    json_response(['error' => 'ID_REQUIRED'], 400);
                $in = json_input();
                // Verify company_id matches if provided
                if ($companyId) {
                    $checkStmt = $pdo->prepare('SELECT company_id FROM bank_account WHERE id = ? AND deleted_at IS NULL');
                    $checkStmt->execute([$id]);
                    $bankCompanyId = $checkStmt->fetchColumn();
                    if ($bankCompanyId != $companyId) {
                        json_response(['error' => 'FORBIDDEN'], 403);
                        return;
                    }
                }
                $set = [];
                $params = [];
                if (isset($in['bank'])) {
                    $set[] = 'bank = ?';
                    $params[] = $in['bank'];
                }
                if (isset($in['bankNumber'])) {
                    $set[] = 'bank_number = ?';
                    $params[] = $in['bankNumber'];
                }
                if (isset($in['isActive'])) {
                    $set[] = 'is_active = ?';
                    $params[] = !empty($in['isActive']) ? 1 : 0;
                }
                if (!$set)
                    json_response(['error' => 'NO_FIELDS'], 400);
                $params[] = $id;
                $sql = 'UPDATE bank_account SET ' . implode(', ', $set) . ' WHERE id = ? AND deleted_at IS NULL';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                json_response(['ok' => true]);
                break;
            case 'DELETE':
                if (!$id)
                    json_response(['error' => 'ID_REQUIRED'], 400);
                // Verify company_id matches if provided
                if ($companyId) {
                    $checkStmt = $pdo->prepare('SELECT company_id FROM bank_account WHERE id = ? AND deleted_at IS NULL');
                    $checkStmt->execute([$id]);
                    $bankCompanyId = $checkStmt->fetchColumn();
                    if ($bankCompanyId != $companyId) {
                        json_response(['error' => 'FORBIDDEN'], 403);
                        return;
                    }
                }
                // Soft delete
                $stmt = $pdo->prepare('UPDATE bank_account SET deleted_at = NOW() WHERE id = ?');
                $stmt->execute([$id]);
                json_response(['ok' => true]);
                break;
            default:
                json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
        }
    } catch (Exception $e) {
        error_log("Bank accounts handler error: " . $e->getMessage());
        json_response(['error' => 'INTERNAL_ERROR', 'message' => $e->getMessage()], 500);
    }
}

