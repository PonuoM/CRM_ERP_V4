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
        case 'PUT':
        case 'PATCH':
            if (!$isAdmin) {
                json_response(['error' => 'FORBIDDEN'], 403);
            }
            
            $contentType = $_SERVER["CONTENT_TYPE"] ?? '';
            $isMultipart = strpos($contentType, 'multipart/form-data') !== false;
            $in = $isMultipart ? $_POST : json_input();
            
            $title = isset($in['title']) ? trim((string)$in['title']) : null;
            $message = isset($in['message']) ? trim((string)$in['message']) : null;
            $type = isset($in['type']) && in_array($in['type'], ['info', 'warning', 'success', 'danger']) ? $in['type'] : null;
            $isActive = isset($in['is_active']) ? (int)$in['is_active'] : null;
            $targetRoles = isset($in['target_roles']) ? trim((string)$in['target_roles']) : null;
            if ($targetRoles === '') $targetRoles = null;
            
            // Image upload logic
            $uploadedImages = [];
            $retainedImages = isset($in['retained_images']) ? $in['retained_images'] : [];
            if (!is_array($retainedImages)) {
                $retainedImages = $retainedImages ? [$retainedImages] : [];
            }
            
            $uploadDir = realpath(__DIR__ . '/../../') . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'updates';
            
            if (isset($_FILES['images'])) {
                if (!is_dir($uploadDir)) {
                    @mkdir($uploadDir, 0775, true);
                }
                
                $files = $_FILES['images'];
                $isMulti = is_array($files['name']);
                $count = $isMulti ? count($files['name']) : 1;
                
                for ($i = 0; $i < $count; $i++) {
                    $tmpName = $isMulti ? $files['tmp_name'][$i] : $files['tmp_name'];
                    $error = $isMulti ? $files['error'][$i] : $files['error'];
                    $size = $isMulti ? $files['size'][$i] : $files['size'];
                    
                    if ($error === UPLOAD_ERR_OK) {
                        $allowedMime = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
                        $mime = @mime_content_type($tmpName);
                        if ($mime && isset($allowedMime[$mime]) && $size <= 5 * 1024 * 1024) {
                            $ext = $allowedMime[$mime];
                            $filename = 'update_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
                            $targetPath = $uploadDir . DIRECTORY_SEPARATOR . $filename;
                            
                            if (move_uploaded_file($tmpName, $targetPath)) {
                                $uploadedImages[] = '/CRM_ERP_V4/api/uploads/updates/' . $filename;
                            }
                        }
                    }
                }
            }

            $finalImages = array_merge($retainedImages, $uploadedImages);
            $imageUrl = count($finalImages) > 0 ? json_encode($finalImages) : null;
            
            // For backward compatibility when someone updates without multipart
            // We only want to update image_url if the request is multipart (meaning the form was fully submitted with image states)
            $updateImageField = $isMultipart;

            if ($id || method() === 'PUT' || method() === 'PATCH') {
                // UPDATE
                if (!$id) {
                    json_response(['error' => 'ID_REQUIRED'], 400);
                }
                $fields = [];
                $params = [];
                
                if ($title !== null) { $fields[] = 'title = ?'; $params[] = $title; }
                if ($message !== null) { $fields[] = 'message = ?'; $params[] = $message; }
                if ($type !== null) { $fields[] = 'type = ?'; $params[] = $type; }
                if ($isActive !== null) { $fields[] = 'is_active = ?'; $params[] = $isActive; }
                if (array_key_exists('target_roles', $in)) { $fields[] = 'target_roles = ?'; $params[] = $targetRoles; }
                if ($updateImageField) { $fields[] = 'image_url = ?'; $params[] = $imageUrl; }
                
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
            } else {
                // INSERT
                if ($title === null || $message === null || $title === '' || $message === '') {
                    json_response(['error' => 'VALIDATION_FAILED', 'message' => 'Title and Message are required'], 400);
                }
                $type = $type ?? 'info';
                $isActive = $isActive ?? 1;
                
                try {
                    $stmt = $pdo->prepare('INSERT INTO system_updates (title, message, type, is_active, created_by, target_roles, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)');
                    $stmt->execute([$title, $message, $type, $isActive, $user['id'], $targetRoles, $imageUrl]);
                    
                    $newId = (int)$pdo->lastInsertId();
                    $fetch = $pdo->prepare('SELECT * FROM system_updates WHERE id = ?');
                    $fetch->execute([$newId]);
                    json_response($fetch->fetch(), 201);
                } catch (Throwable $e) {
                    json_response(['error' => 'CREATE_FAILED', 'message' => $e->getMessage()], 500);
                }
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
