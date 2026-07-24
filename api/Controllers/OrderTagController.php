<?php

class OrderTagController {
    
    /**
     * Manage tag definitions (order_tags)
     */
    public static function handleOrderTags(PDO $pdo): void {
        $method = method();
        $user = get_authenticated_user($pdo);
        $userId = $user['id'] ?? null;
        $companyId = $user['company_id'] ?? null;

        if (!$userId) {
            json_response(['error' => 'UNAUTHORIZED'], 401);
            return;
        }

        switch ($method) {
            case 'GET':
                $type = isset($_GET['type']) ? strtoupper((string) $_GET['type']) : null;
                $targetUserId = isset($_GET['userId']) ? (int) $_GET['userId'] : null;

                $params = [];
                $where = [];

                if ($companyId) {
                    $where[] = "(company_id = ? OR company_id IS NULL)";
                    $params[] = $companyId;
                }

                if ($type === 'SYSTEM') {
                    $where[] = "type = 'SYSTEM'";
                } else if ($type === 'USER' && $targetUserId) {
                    $where[] = "type = 'USER'";
                    $where[] = "created_by = ?";
                    $params[] = $targetUserId;
                }

                $sql = 'SELECT * FROM order_tags';
                if (!empty($where)) {
                    $sql .= ' WHERE ' . implode(' AND ', $where);
                }
                $sql .= ' ORDER BY id';

                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                json_response($stmt->fetchAll());
                break;

            case 'POST':
                $in = json_input();
                $type = strtoupper($in['type'] ?? 'USER');
                $name = trim((string) ($in['name'] ?? ''));
                $color = $in['color'] ?? '#E5E7EB';

                if ($name === '') {
                    json_response(['error' => 'MISSING_NAME'], 400);
                    return;
                }

                if ($type === 'USER') {
                    // Check quota
                    $stmt = $pdo->prepare('SELECT COUNT(*) FROM order_tags WHERE type = ? AND created_by = ?');
                    $stmt->execute(['USER', $userId]);
                    $count = (int)$stmt->fetchColumn();
                    if ($count >= 10) {
                        json_response(['error' => 'TAG_LIMIT_REACHED', 'message' => 'คุณสร้างป้ายกำกับส่วนตัวครบ 10 ป้ายแล้ว (ลบของเดิมก่อน)'], 400);
                        return;
                    }
                }

                $stmt = $pdo->prepare('INSERT INTO order_tags (company_id, name, type, color, created_by) VALUES (?, ?, ?, ?, ?)');
                $stmt->execute([
                    $companyId,
                    $name,
                    $type,
                    $color,
                    $type === 'USER' ? $userId : null
                ]);
                
                json_response([
                    'ok' => true, 
                    'tag' => [
                        'id' => $pdo->lastInsertId(),
                        'company_id' => $companyId,
                        'name' => $name,
                        'type' => $type,
                        'color' => $color,
                        'created_by' => $type === 'USER' ? $userId : null
                    ]
                ]);
                break;

            case 'PUT':
                $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
                $in = json_input();
                $name = trim((string) ($in['name'] ?? ''));
                $color = $in['color'] ?? null;

                if (!$id || $name === '') {
                    json_response(['error' => 'INVALID_INPUT'], 400);
                    return;
                }

                // Verify ownership or permission
                $stmt = $pdo->prepare('SELECT * FROM order_tags WHERE id = ?');
                $stmt->execute([$id]);
                $tag = $stmt->fetch();
                if (!$tag) {
                    json_response(['error' => 'NOT_FOUND'], 404);
                    return;
                }

                if ($tag['type'] === 'USER' && $tag['created_by'] != $userId) {
                    json_response(['error' => 'FORBIDDEN', 'message' => 'Not your tag'], 403);
                    return;
                }

                $upStmt = $pdo->prepare('UPDATE order_tags SET name = ?, color = COALESCE(?, color) WHERE id = ?');
                $upStmt->execute([$name, $color, $id]);
                json_response(['ok' => true]);
                break;

            case 'DELETE':
                $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
                if (!$id) {
                    json_response(['error' => 'MISSING_ID'], 400);
                    return;
                }

                $stmt = $pdo->prepare('SELECT * FROM order_tags WHERE id = ?');
                $stmt->execute([$id]);
                $tag = $stmt->fetch();
                if (!$tag) {
                    json_response(['ok' => true]); // Already gone
                    return;
                }

                if ($tag['type'] === 'USER' && $tag['created_by'] != $userId) {
                    json_response(['error' => 'FORBIDDEN'], 403);
                    return;
                }

                // Foreign key ON DELETE CASCADE will handle order_tag_assignments automatically
                $del = $pdo->prepare('DELETE FROM order_tags WHERE id = ?');
                $del->execute([$id]);
                json_response(['ok' => true]);
                break;

            default:
                json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
        }
    }

    /**
     * Manage tag assignments to orders (order_tag_assignments)
     */
    public static function handleOrderTagAssignments(PDO $pdo): void {
        $method = method();
        $user = get_authenticated_user($pdo);
        $userId = $user['id'] ?? null;

        if (!$userId) {
            json_response(['error' => 'UNAUTHORIZED'], 401);
            return;
        }

        switch ($method) {
            case 'POST':
                $in = json_input();
                $orderId = $in['orderId'] ?? null;
                $tagId = $in['tagId'] ?? null;

                if (!$orderId || !$tagId) {
                    json_response(['error' => 'MISSING_PARAMS'], 400);
                    return;
                }

                $check = $pdo->prepare('SELECT id, deleted_at FROM order_tag_assignments WHERE order_id = ? AND tag_id = ? ORDER BY id DESC LIMIT 1');
                $check->execute([$orderId, $tagId]);
                $row = $check->fetch();

                if ($row && $row['deleted_at'] === null) {
                    json_response(['ok' => true, 'message' => 'Already assigned']);
                    return;
                }

                $stmt = $pdo->prepare('INSERT INTO order_tag_assignments (order_id, tag_id, created_by, created_at) VALUES (?, ?, ?, NOW())');
                $stmt->execute([$orderId, $tagId, $userId]);
                json_response(['ok' => true]);
                break;

            case 'DELETE':
                $orderId = $_GET['orderId'] ?? null;
                $tagId = $_GET['tagId'] ?? null;

                if (!$orderId || !$tagId) {
                    json_response(['error' => 'MISSING_PARAMS'], 400);
                    return;
                }

                $stmt = $pdo->prepare('UPDATE order_tag_assignments SET deleted_at = NOW(), deleted_by = ? WHERE order_id = ? AND tag_id = ? AND deleted_at IS NULL');
                $stmt->execute([$userId, $orderId, $tagId]);
                json_response(['ok' => true]);
                break;

            case 'GET':
                $orderId = $_GET['orderId'] ?? null;
                $history = $_GET['history'] ?? null;

                if (!$orderId) {
                    json_response(['error' => 'MISSING_ORDER_ID'], 400);
                    return;
                }

                if ($history) {
                    $stmt = $pdo->prepare('
                        SELECT ota.*, t.name as tag_name, t.color as tag_color, 
                               u1.first_name as creator_first, u1.last_name as creator_last,
                               u2.first_name as deleter_first, u2.last_name as deleter_last
                        FROM order_tag_assignments ota
                        JOIN order_tags t ON ota.tag_id = t.id
                        LEFT JOIN users u1 ON ota.created_by = u1.id
                        LEFT JOIN users u2 ON ota.deleted_by = u2.id
                        WHERE ota.order_id = ?
                        ORDER BY ota.created_at DESC
                    ');
                    $stmt->execute([$orderId]);
                    json_response($stmt->fetchAll());
                } else {
                    $stmt = $pdo->prepare('
                        SELECT t.* 
                        FROM order_tags t
                        JOIN order_tag_assignments ota ON ota.tag_id = t.id
                        WHERE ota.order_id = ? AND ota.deleted_at IS NULL
                    ');
                    $stmt->execute([$orderId]);
                    json_response($stmt->fetchAll());
                }
                break;

            default:
                json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
        }
    }
}
