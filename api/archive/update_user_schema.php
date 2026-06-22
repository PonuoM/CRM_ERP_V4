<?php
require_once __DIR__ . '/config.php';

// Set content type
header('Content-Type: application/json');

try {
    // Connect to database
    $pdo = db_connect();
    
    // Read and execute the SQL script
    $sqlScript = file_get_contents(__DIR__ . '/add_user_status_fields.sql');
    
    if ($sqlScript === false) {
        throw new Exception('Could not read SQL script file');
    }
    
    // Split the script into individual statements
    $statements = array_filter(array_map('trim', explode(';', $sqlScript)));
    
    $pdo->beginTransaction();
    
    foreach ($statements as $statement) {
        if (empty($statement)) continue;
        
        try {
            $pdo->exec($statement);
        } catch (PDOException $e) {
            // Some statements might fail if they already exist, which is okay
            // For example, if the column already exists
            if (strpos($e->getMessage(), 'Duplicate column name') === false && 
                strpos($e->getMessage(), 'already exists') === false) {
                throw $e;
            }
        }
    }
    
    $pdo->commit();
    
    echo json_encode([
        'ok' => true,
        'message' => 'Database schema updated successfully'
    ]);
    
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'SCHEMA_UPDATE_FAILED',
        'message' => $e->getMessage()
    ]);
}
?>
