<?php

function handle_system_updates(PDO $pdo, ?string $id): void
{
    $user = get_authenticated_user($pdo);
    if (!$user) {
        json_response(['error' => 'UNAUTHORIZED'], 401);
    }
    
    // Determine if the user is an admin
    $role = $user['role'] ?? '';
    $isAdmin = $role === 'Super Admin';

    switch (method()) {
        case 'GET':
            if ($id) {
                // Fetch single update
                $stmt = $pdo->prepare('SELECT * FROM system_updates WHERE id = ?');
                $stmt->execute([(int)$id]);
                $update = $stmt->fetch();
                if (!$update) {
                    json_response(['error' => 'NOT_FOUND'], 404);
                }
                // If not admin and not active, don't show
                if (!$isAdmin && !(int)$update['is_active']) {
                    json_response(['error' => 'FORBIDDEN'], 403);
                }
                json_response($update);
            } else {
                // Fetch all
                $sql = 'SELECT su.*, u.first_name, u.last_name 
                        FROM system_updates su
                        LEFT JOIN users u ON su.created_by = u.id';
                if (!$isAdmin) {
                    $sql .= ' WHERE su.is_active = 1';
                }
                $sql .= ' ORDER BY su.id DESC';
                
                $stmt = $pdo->prepare($sql);
                $stmt->execute();
                json_response($stmt->fetchAll());
            }
            break;

        case 'POST':
            if (!$isAdmin) {
                json_response(['error' => 'FORBIDDEN'], 403);
            }
            $in = json_input();
            $title = trim((string)($in['title'] ?? ''));
            $message = trim((string)($in['message'] ?? ''));
            $type = in_array($in['type'] ?? '', ['info', 'warning', 'success', 'danger']) ? $in['type'] : 'info';
            $isActive = isset($in['is_active']) ? (int)$in['is_active'] : 1;

            $targetRoles = isset($in['target_roles']) ? trim((string)$in['target_roles']) : null;
            if ($targetRoles === '') $targetRoles = null;

            if ($title === '' || $message === '') {
                json_response(['error' => 'VALIDATION_FAILED', 'message' => 'Title and Message are required'], 400);
            }

            try {
                $stmt = $pdo->prepare('INSERT INTO system_updates (title, message, type, is_active, created_by, target_roles) VALUES (?, ?, ?, ?, ?, ?)');
                $stmt->execute([$title, $message, $type, $isActive, $user['id'], $targetRoles]);
                
                $newId = (int)$pdo->lastInsertId();
                $fetch = $pdo->prepare('SELECT * FROM system_updates WHERE id = ?');
                $fetch->execute([$newId]);
                json_response($fetch->fetch(), 201);
            } catch (Throwable $e) {
                json_response(['error' => 'CREATE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;

        case 'PUT':
        case 'PATCH':
            if (!$isAdmin) {
                json_response(['error' => 'FORBIDDEN'], 403);
            }
            if (!$id) {
                json_response(['error' => 'ID_REQUIRED'], 400);
            }
            $in = json_input();
            
            $fields = [];
            $params = [];
            
            if (array_key_exists('title', $in)) {
                $fields[] = 'title = ?';
                $params[] = trim((string)$in['title']);
            }
            if (array_key_exists('message', $in)) {
                $fields[] = 'message = ?';
                $params[] = trim((string)$in['message']);
            }
            if (array_key_exists('type', $in)) {
                $fields[] = 'type = ?';
                $params[] = in_array($in['type'], ['info', 'warning', 'success', 'danger']) ? $in['type'] : 'info';
            }
            if (array_key_exists('is_active', $in)) {
                $fields[] = 'is_active = ?';
                $params[] = (int)$in['is_active'];
            }
            if (array_key_exists('target_roles', $in)) {
                $fields[] = 'target_roles = ?';
                $targetRoles = trim((string)$in['target_roles']);
                $params[] = $targetRoles === '' ? null : $targetRoles;
            }
            
            if (empty($fields)) {
                json_response(['ok' => true]);
            }
            
            $params[] = (int)$id;
            
            try {
                $stmt = $pdo->prepare('UPDATE system_updates SET ' . implode(', ', $fields) . ' WHERE id = ?');
                $stmt->execute($params);
                
                $fetch = $pdo->prepare('SELECT * FROM system_updates WHERE id = ?');
                $fetch->execute([(int)$id]);
                json_response($fetch->fetch());
            } catch (Throwable $e) {
                json_response(['error' => 'UPDATE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;

        case 'DELETE':
            if (!$isAdmin) {
                json_response(['error' => 'FORBIDDEN'], 403);
            }
            if (!$id) {
                json_response(['error' => 'ID_REQUIRED'], 400);
            }
            try {
                $pdo->prepare('DELETE FROM system_updates WHERE id = ?')->execute([(int)$id]);
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                json_response(['error' => 'DELETE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;

        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}
