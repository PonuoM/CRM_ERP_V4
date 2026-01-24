<?php
/**
 * Script to populate users.role_id based on users.role string
 * URL: /api/cron/fix_user_role_ids.php?key=fix_roles_2026
 */

require_once __DIR__ . '/../config.php';

header('Content-Type: text/plain; charset=utf-8');

// Security check
$SECRET_KEY = 'fix_roles_2026';
if (($_GET['key'] ?? '') !== $SECRET_KEY) {
    die("ERROR: Invalid key\n");
}

$pdo = db_connect();

echo "=== Fix Users Role IDs ===\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n\n";

// First, get all roles from roles table
$stmt = $pdo->query("SELECT id, code, name FROM roles");
$roles = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "Available roles in DB:\n";
foreach ($roles as $r) {
    echo "  ID {$r['id']}: code='{$r['code']}' | name='{$r['name']}'\n";
}
echo "\n";

// Build mapping from role string to role_id
// We need to match users.role (string) to roles.name or roles.code
$roleMapping = [
    // Exact matches (case insensitive)
    'super admin' => 1,
    'admin control' => 2,
    'admin page' => 3,
    'adminpage' => 3,
    '[admin pages]' => 3,
    '[admin page]' => 3,
    'backoffice' => 4,
    'marketing' => 5,
    'supervisor telesale' => 6,
    'supervisor' => 6,
    'sup admin' => 6,
    'telesale' => 7,
    '[telesale]' => 7,
    'finance' => 8,
    'บัญชี' => 9,
    'account' => 9,
    'test' => 10,
    'admin system' => 1,
];

// Get all users with NULL role_id
$stmt = $pdo->query("SELECT id, username, role FROM users WHERE role_id IS NULL OR role_id = 0");
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "Found " . count($users) . " users with NULL/0 role_id\n\n";

$updated = 0;
$notMatched = [];

foreach ($users as $user) {
    $roleName = strtolower(trim($user['role'] ?? ''));
    $roleId = null;
    
    // Try exact match first
    if (isset($roleMapping[$roleName])) {
        $roleId = $roleMapping[$roleName];
    } else {
        // Try partial match
        foreach ($roleMapping as $key => $id) {
            if (strpos($roleName, $key) !== false || strpos($key, $roleName) !== false) {
                $roleId = $id;
                break;
            }
        }
    }
    
    if ($roleId) {
        $updateStmt = $pdo->prepare("UPDATE users SET role_id = ? WHERE id = ?");
        $updateStmt->execute([$roleId, $user['id']]);
        echo "  User {$user['id']} ({$user['username']}): '{$user['role']}' -> role_id = $roleId\n";
        $updated++;
    } else {
        $notMatched[] = $user;
    }
}

echo "\n=== Summary ===\n";
echo "Updated: $updated users\n";

if (!empty($notMatched)) {
    echo "\nNot matched (" . count($notMatched) . " users):\n";
    foreach ($notMatched as $u) {
        echo "  ID {$u['id']}: username='{$u['username']}' | role='{$u['role']}'\n";
    }
}

echo "\nDone!\n";
