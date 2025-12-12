<?php
/**
 * Role Management API
 * Handles CRUD operations for roles and role permissions
 */

function handle_roles(PDO $pdo, ?string $id, ?string $action) {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    // ============================================================================
    // Routes
    // ============================================================================

    // GET /api/roles - Get all roles
    if ($method === 'GET' && !$id) {
        $includeInactive = isset($_GET['includeInactive']) && $_GET['includeInactive'] === 'true';
        
        $sql = 'SELECT * FROM roles';
        if (!$includeInactive) {
            $sql .= ' WHERE is_active = 1';
        }
        $sql .= ' ORDER BY is_system DESC, name ASC';
        
        $stmt = $pdo->query($sql);
        $roles = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        json_response(['roles' => $roles]);
    }

    // GET /api/roles/{id} - Get single role
    if ($method === 'GET' && $id && !$action) {
        $stmt = $pdo->prepare('SELECT * FROM roles WHERE id = ?');
        $stmt->execute([$id]);
        $role = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$role) {
            json_response(['error' => 'NOT_FOUND'], 404);
        }
        
        json_response(['role' => $role]);
    }

    // POST /api/roles - Create new role
    if ($method === 'POST' && !$id) {
        $input = json_input();
        
        $code = trim($input['code'] ?? '');
        $name = trim($input['name'] ?? '');
        $description = $input['description'] ?? null;
        $isActive = $input['isActive'] ?? true;
        
        // Validation
        if (!$code || !$name) {
            json_response(['error' => 'VALIDATION_ERROR', 'message' => 'code and name are required'], 400);
        }
        
        // Check duplicate code
        $stmt = $pdo->prepare('SELECT id FROM roles WHERE code = ?');
        $stmt->execute([$code]);
        if ($stmt->fetch()) {
            json_response(['error' => 'DUPLICATE_CODE', 'message' => 'Role code already exists'], 400);
        }
        
        // Insert role
        $stmt = $pdo->prepare('
            INSERT INTO roles (code, name, description, is_active, is_system) 
            VALUES (?, ?, ?, ?, 0)
        ');
        $stmt->execute([$code, $name, $description, $isActive ? 1 : 0]);
        $roleId = $pdo->lastInsertId();
        
        // Create default empty permissions
        $stmt = $pdo->prepare('
            INSERT INTO role_permissions (role, data, description) 
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE role = role
        ');
        $stmt->execute([$code, '{}', "Permissions for {$name}"]);
        
        json_response(['id' => $roleId, 'message' => 'Role created successfully'], 201);
    }

    // PUT /api/roles/{id} - Update role
    if ($method === 'PUT' && $id && !$action) {
        $input = json_input();
        
        // Check if role exists and is not system role
        $stmt = $pdo->prepare('SELECT is_system, code FROM roles WHERE id = ?');
        $stmt->execute([$id]);
        $role = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$role) {
            json_response(['error' => 'NOT_FOUND'], 404);
        }
        
        if ($role['is_system']) {
            json_response(['error' => 'FORBIDDEN', 'message' => 'Cannot edit system role'], 403);
        }
        
        $updates = [];
        $params = [];
        
        if (isset($input['name'])) {
            $updates[] = 'name = ?';
            $params[] = trim($input['name']);
        }
        if (isset($input['description'])) {
            $updates[] = 'description = ?';
            $params[] = $input['description'];
        }
        if (isset($input['isActive'])) {
            $updates[] = 'is_active = ?';
            $params[] = $input['isActive'] ? 1 : 0;
        }
        
        if (empty($updates)) {
            json_response(['message' => 'Nothing to update']);
        }
        
        $params[] = $id;
        $stmt = $pdo->prepare('UPDATE roles SET ' . implode(', ', $updates) . ' WHERE id = ?');
        $stmt->execute($params);
        
        json_response(['message' => 'Role updated successfully']);
    }

    // DELETE /api/roles/{id} - Delete role
    if ($method === 'DELETE' && $id && !$action) {
        // Check if role exists and is not system role
        $stmt = $pdo->prepare('SELECT is_system, code FROM roles WHERE id = ?');
        $stmt->execute([$id]);
        $role = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$role) {
            json_response(['error' => 'NOT_FOUND'], 404);
        }
        
        if ($role['is_system']) {
            json_response(['error' => 'FORBIDDEN', 'message' => 'Cannot delete system role'], 403);
        }
        
        // Check if role is assigned to any users
        $stmt = $pdo->prepare('SELECT COUNT(*) as count FROM users WHERE role_id = ?');
        $stmt->execute([$id]);
        $count = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
        
        if ($count > 0) {
            json_response([
                'error' => 'IN_USE', 
                'message' => "Cannot delete role. {$count} user(s) are assigned to this role.",
                'userCount' => $count
            ], 400);
        }
        
        // Delete role permissions first
        $stmt = $pdo->prepare('DELETE FROM role_permissions WHERE role = ?');
        $stmt->execute([$role['code']]);
        
        // Delete role
        $stmt = $pdo->prepare('DELETE FROM roles WHERE id = ?');
        $stmt->execute([$id]);
        
        json_response(['message' => 'Role deleted successfully']);
    }

    // GET /api/roles/{id}/permissions - Get role permissions
    if ($method === 'GET' && $id && $action === 'permissions') {
        $stmt = $pdo->prepare('SELECT code FROM roles WHERE id = ?');
        $stmt->execute([$id]);
        $role = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$role) {
            json_response(['error' => 'NOT_FOUND'], 404);
        }
        
        $stmt = $pdo->prepare('SELECT data FROM role_permissions WHERE role = ?');
        $stmt->execute([$role['code']]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $permissions = $row ? json_decode($row['data'], true) : [];
        
        json_response(['permissions' => $permissions]);
    }

    // PUT /api/roles/{id}/permissions - Update role permissions
    if ($method === 'PUT' && $id && $action === 'permissions') {
        $input = json_input();
        $permissions = $input['permissions'] ?? [];
        
        $stmt = $pdo->prepare('SELECT code, is_system FROM roles WHERE id = ?');
        $stmt->execute([$id]);
        $role = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$role) {
            json_response(['error' => 'NOT_FOUND'], 404);
        }
        
        // Allow editing even system roles permissions
        $stmt = $pdo->prepare('
            INSERT INTO role_permissions (role, data, updated_by, updated_at) 
            VALUES (?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE 
                data = VALUES(data),
                updated_by = VALUES(updated_by),
                updated_at = NOW()
        ');
        $stmt->execute([
            $role['code'], 
            json_encode($permissions),
            $_SESSION['user_id'] ?? null
        ]);
        
        json_response(['message' => 'Permissions updated successfully']);
    }

    // If no route matched
    json_response(['error' => 'NOT_FOUND', 'message' => 'Endpoint not found'], 404);
}
