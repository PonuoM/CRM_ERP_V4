<?php
require_once '../config.php';

// Use the same pattern as other API files in the project
cors();

try {
    $pdo = db_connect();
} catch (Throwable $e) {
    json_response(['ok' => false, 'error' => 'DB_CONNECT_FAILED', 'message' => $e->getMessage()], 500);
}

// Get request method
$method = $_SERVER['REQUEST_METHOD'];

// Authenticate user via Token to get Company ID
$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
if (!$auth && function_exists('getallheaders')) {
    $headers = getallheaders();
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
}

$currentCompanyId = null;

if (preg_match('/Bearer\s+(\S+)/', $auth, $matches)) {
    $token = $matches[1];
    $stmt = $pdo->prepare("
      SELECT u.company_id
      FROM user_tokens ut
      JOIN users u ON ut.user_id = u.id
      WHERE ut.token = ? AND ut.expires_at > NOW()
    ");
    $stmt->execute([$token]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($user) {
        $currentCompanyId = $user['company_id'];
    }
}

try {
    switch ($method) {
        case 'GET':
            // Get all env variables or a specific one
            if (isset($_GET['key'])) {
                $key = $_GET['key'];
                
                // If company_id is present, try to find company specific value first
                if ($currentCompanyId) {
                    $stmt = $pdo->prepare("SELECT * FROM env WHERE `key` = :key AND company_id = :company_id");
                    $stmt->bindParam(':key', $key);
                    $stmt->bindParam(':company_id', $currentCompanyId);
                    $stmt->execute();
                    $result = $stmt->fetch(PDO::FETCH_ASSOC);
                    
                    if ($result) {
                        json_response($result);
                        return; // Stop here if found
                    }
                }
                
                // Fallback to global (company_id IS NULL)
                $stmt = $pdo->prepare("SELECT * FROM env WHERE `key` = :key AND company_id IS NULL");
                $stmt->bindParam(':key', $key);
                $stmt->execute();
                $result = $stmt->fetch(PDO::FETCH_ASSOC);
                json_response($result ?: ['error' => 'Environment variable not found']);
            } else {
                // Get all and merge (Company overrides Global)
                // Strategy: Fetch all global, then fetch all company specific, then merge in PHP
                
                $sql = "SELECT * FROM env WHERE company_id IS NULL";
                if ($currentCompanyId) {
                    $sql .= " OR company_id = :company_id";
                }
                $sql .= " ORDER BY company_id ASC"; // Global (NULL) comes first typically, but safe to fetch all
                
                $stmt = $pdo->prepare($sql);
                if ($currentCompanyId) {
                    $stmt->bindParam(':company_id', $currentCompanyId);
                }
                $stmt->execute();
                $allResults = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                // Merge logic: Use key as index. Later entries (Company) overwrite earlier (Global) if we verify order?
                // Better: explicit check.
                $finalEnv = [];
                foreach ($allResults as $row) {
                    // If row is global, add it.
                    // If row is company, add/overwrite it.
                    // Since we want company to take precedence, we process them.
                    // If we populate $finalEnv[$row['key']], simply assigning:
                    // If query returns global first then company, iterating will naturally overwrite.
                    // Is company_id NULL < company_id INT? Yes in MySQL sort order usually.
                    // Let's rely on explicit logic to be sure.
                    
                    if ($row['company_id'] === null) {
                        if (!isset($finalEnv[$row['key']])) {
                           $finalEnv[$row['key']] = $row;
                        }
                    } else {
                        // This is a company specific row, it always takes precedence for this user
                        $finalEnv[$row['key']] = $row;
                    }
                }
                
                json_response(array_values($finalEnv));
            }
            break;
            
        case 'POST':
            // Create or update env variable
            $in = json_input();
            
            if (!isset($in['key']) || !isset($in['value'])) {
                json_response(['error' => 'Key and value are required'], 400);
            }
            
            $key = $in['key'];
            $value = $in['value'];
            
            // Check if key already exists for this scope (Company or Global)
            // If logged in, we save to Company scope. If not, we save to Global (legacy behavior check?)
            // Or should we ONLY allow global update if explicitly requested?
            // For this requirement: "checkbox to add/edit in env table", implying for the user's company.
            // If user is not logged in (no token), fall back to global? Or deny?
            // Let's allow global if no token (legacy), but company if token exists.
            
            $scopeCompanyId = $currentCompanyId; // Could be null

            // Upsert Logic: Try to insert, if duplicate key, update value
            // This handles both cases: new variable or existing variable (even if race condition)
            $stmt = $pdo->prepare("
                INSERT INTO env (`key`, `value`, `company_id`, created_at, updated_at) 
                VALUES (:key, :value, :company_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON DUPLICATE KEY UPDATE 
                `value` = :update_value, 
                updated_at = CURRENT_TIMESTAMP
            ");
            
            $stmt->bindParam(':key', $key);
            $stmt->bindParam(':value', $value);
            $stmt->bindParam(':company_id', $scopeCompanyId);
            $stmt->bindParam(':update_value', $value);
            
            $stmt->execute();
            
            if ($stmt->rowCount() > 0) {
                 json_response(['success' => true, 'message' => 'Environment variable saved']);
            } else {
                 // rowCount can be 0 if value is same as existing
                 json_response(['success' => true, 'message' => 'Environment variable saved (no changes)']);
            }
            break;
            
        case 'PUT':
            // Update env variable
            $in = json_input();
            
            if (!isset($in['key']) || !isset($in['value'])) {
                json_response(['error' => 'Key and value are required'], 400);
            }
            
            $key = $in['key'];
            $value = $in['value'];
            
            $stmt = $pdo->prepare("UPDATE env SET `value` = :value, updated_at = CURRENT_TIMESTAMP WHERE `key` = :key");
            $stmt->bindParam(':key', $key);
            $stmt->bindParam(':value', $value);
            $stmt->execute();
            
            if ($stmt->rowCount() > 0) {
                json_response(['success' => true, 'message' => 'Environment variable updated']);
            } else {
                json_response(['error' => 'Environment variable not found'], 404);
            }
            break;
            
        case 'DELETE':
            // Delete env variable
            if (!isset($_GET['key'])) {
                json_response(['error' => 'Key is required'], 400);
            }
            
            $key = $_GET['key'];
            $stmt = $pdo->prepare("DELETE FROM env WHERE `key` = :key");
            $stmt->bindParam(':key', $key);
            $stmt->execute();
            
            if ($stmt->rowCount() > 0) {
                json_response(['success' => true, 'message' => 'Environment variable deleted']);
            } else {
                json_response(['error' => 'Environment variable not found'], 404);
            }
            break;
            
        default:
            json_response(['error' => 'Method not allowed'], 405);
            break;
    }
} catch (PDOException $e) {
    json_response(['error' => 'Database error: ' . $e->getMessage()], 500);
}
?>