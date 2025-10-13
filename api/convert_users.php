<?php
require_once __DIR__ . '/config.php';

// Set content type
header('Content-Type: application/json');

// Function to check if password is a hash and try to identify the type
function analyzePassword($password) {
    $info = [
        'is_hashed' => false,
        'hash_type' => 'unknown',
        'original_password' => null,
        'notes' => []
    ];
    
    if (empty($password)) {
        $info['notes'][] = 'Empty password';
        return $info;
    }
    
    // Check for bcrypt hash ($2y$)
    if (strpos($password, '$2y$') === 0) {
        $info['is_hashed'] = true;
        $info['hash_type'] = 'bcrypt';
        $info['notes'][] = 'Password is hashed with bcrypt (PHP password_hash)';
        
        // Try some common passwords
        $commonPasswords = ['password', '123456', 'admin', 'admin123', 'password123', '123456789'];
        foreach ($commonPasswords as $pwd) {
            if (password_verify($pwd, $password)) {
                $info['original_password'] = $pwd;
                $info['notes'][] = "Password matches: $pwd";
                break;
            }
        }
        
        if (!$info['original_password']) {
            $info['notes'][] = 'Could not determine original password from common passwords';
        }
    }
    // Check for MD5 hash (32 characters, hexadecimal)
    elseif (strlen($password) === 32 && ctype_xdigit($password)) {
        $info['is_hashed'] = true;
        $info['hash_type'] = 'md5';
        $info['notes'][] = 'Password appears to be MD5 hash';
        
        // Try some common passwords
        $commonPasswords = ['password', '123456', 'admin', 'admin123', 'password123', '123456789'];
        foreach ($commonPasswords as $pwd) {
            if (md5($pwd) === $password) {
                $info['original_password'] = $pwd;
                $info['notes'][] = "Password matches: $pwd";
                break;
            }
        }
        
        if (!$info['original_password']) {
            $info['notes'][] = 'Could not determine original password from common passwords';
        }
    }
    // Check for SHA1 hash (40 characters, hexadecimal)
    elseif (strlen($password) === 40 && ctype_xdigit($password)) {
        $info['is_hashed'] = true;
        $info['hash_type'] = 'sha1';
        $info['notes'][] = 'Password appears to be SHA1 hash';
        
        // Try some common passwords
        $commonPasswords = ['password', '123456', 'admin', 'admin123', 'password123', '123456789'];
        foreach ($commonPasswords as $pwd) {
            if (sha1($pwd) === $password) {
                $info['original_password'] = $pwd;
                $info['notes'][] = "Password matches: $pwd";
                break;
            }
        }
        
        if (!$info['original_password']) {
            $info['notes'][] = 'Could not determine original password from common passwords';
        }
    }
    // Plain text
    else {
        $info['is_hashed'] = false;
        $info['hash_type'] = 'plaintext';
        $info['original_password'] = $password;
        $info['notes'][] = 'Password appears to be plain text';
    }
    
    return $info;
}

// Function to map role_id to role name
function mapRole($roleId) {
    $roleMap = [
        1 => 'Super Admin',
        2 => 'Admin Control',
        3 => 'Supervisor Telesale',
        4 => 'Telesale',
        5 => 'Admin Page',
        6 => 'Marketing',
        7 => 'Backoffice'
    ];
    
    return $roleMap[$roleId] ?? 'Telesale';
}

// Function to map is_active to status
function mapStatus($isActive) {
    return $isActive ? 'active' : 'inactive';
}

// Function to split full_name into first_name and last_name
function splitName($fullName) {
    // Try to split by space
    $parts = explode(' ', $fullName, 2);
    
    if (count($parts) === 2) {
        return [
            'first_name' => $parts[0],
            'last_name' => $parts[1]
        ];
    } else {
        return [
            'first_name' => $fullName,
            'last_name' => ''
        ];
    }
}

try {
    // Connect to database
    $pdo = db_connect();
    
    // Get all users from the old table
    $stmt = $pdo->query('SELECT * FROM users ORDER BY user_id');
    $oldUsers = $stmt->fetchAll();
    
    $convertedUsers = [];
    $passwordAnalysis = [];
    
    foreach ($oldUsers as $oldUser) {
        // Analyze password
        $pwdAnalysis = analyzePassword($oldUser['password_hash']);
        $passwordAnalysis[] = [
            'user_id' => $oldUser['user_id'],
            'username' => $oldUser['username'],
            'password_analysis' => $pwdAnalysis
        ];
        
        // Split name
        $nameParts = splitName($oldUser['full_name']);
        
        // Convert to new schema
        $newUser = [
            'id' => $oldUser['user_id'],
            'username' => $oldUser['username'],
            'password' => $pwdAnalysis['original_password'] ?? $oldUser['password_hash'], // Use original if found, otherwise keep hash
            'first_name' => $nameParts['first_name'],
            'last_name' => $nameParts['last_name'],
            'email' => $oldUser['email'],
            'phone' => $oldUser['phone'],
            'role' => mapRole($oldUser['role_id']),
            'company_id' => 1, // Set to 1 as requested
            'team_id' => null, // Not available in old schema
            'supervisor_id' => $oldUser['supervisor_id'],
            'status' => mapStatus($oldUser['is_active']),
            'created_at' => $oldUser['created_at'],
            'updated_at' => $oldUser['updated_at'],
            'last_login' => $oldUser['last_login'],
            'login_count' => 0 // Default value
        ];
        
        $convertedUsers[] = $newUser;
    }
    
    // Generate SQL INSERT statements
    $sqlStatements = "-- Converted users data for new schema\n\n";
    
    foreach ($convertedUsers as $user) {
        $sqlStatements .= "INSERT INTO users (id, username, password, first_name, last_name, email, phone, role, company_id, team_id, supervisor_id, status, created_at, updated_at, last_login, login_count) VALUES (";
        $sqlStatements .= $user['id'] . ", ";
        $sqlStatements .= "'" . $user['username'] . "', ";
        $sqlStatements .= "'" . $user['password'] . "', ";
        $sqlStatements .= "'" . $user['first_name'] . "', ";
        $sqlStatements .= "'" . $user['last_name'] . "', ";
        $sqlStatements .= ($user['email'] ? "'" . $user['email'] . "'" : 'NULL') . ", ";
        $sqlStatements .= ($user['phone'] ? "'" . $user['phone'] . "'" : 'NULL') . ", ";
        $sqlStatements .= "'" . $user['role'] . "', ";
        $sqlStatements .= $user['company_id'] . ", ";
        $sqlStatements .= ($user['team_id'] ? $user['team_id'] : 'NULL') . ", ";
        $sqlStatements .= ($user['supervisor_id'] ? $user['supervisor_id'] : 'NULL') . ", ";
        $sqlStatements .= "'" . $user['status'] . "', ";
        $sqlStatements .= ($user['created_at'] ? "'" . $user['created_at'] . "'" : 'NOW()') . ", ";
        $sqlStatements .= ($user['updated_at'] ? "'" . $user['updated_at'] . "'" : 'NOW()') . ", ";
        $sqlStatements .= ($user['last_login'] ? "'" . $user['last_login'] . "'" : 'NULL') . ", ";
        $sqlStatements .= $user['login_count'];
        $sqlStatements .= ");\n";
    }
    
    // Save SQL to file
    file_put_contents(__DIR__ . '/converted_users.sql', $sqlStatements);
    
    echo json_encode([
        'ok' => true,
        'message' => 'Users converted successfully',
        'password_analysis' => $passwordAnalysis,
        'sql_file' => 'converted_users.sql created in api directory',
        'total_users' => count($convertedUsers)
    ]);
    
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'CONVERSION_FAILED',
        'message' => $e->getMessage()
    ]);
}
?>
