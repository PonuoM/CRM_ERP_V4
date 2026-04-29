<?php
/**
 * Migration: Add require_page column to platforms table
 * 
 * This column controls whether a platform requires page selection 
 * in the Create Order page. Default is 1 (true) for backward compatibility.
 * Set to 0 for platforms like "โทร" that don't need page selection.
 */
require_once __DIR__ . '/../config.php';

try {
    $pdo = db_connect();
    
    // Check if column already exists
    $stmt = $pdo->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'platforms' AND COLUMN_NAME = 'require_page'");
    
    if ($stmt->rowCount() === 0) {
        $pdo->exec("ALTER TABLE platforms ADD COLUMN require_page TINYINT(1) NOT NULL DEFAULT 1 AFTER show_pages_from");
        
        // Set require_page = 0 for "โทร" platform (the one that historically doesn't need page selection)
        $pdo->exec("UPDATE platforms SET require_page = 0 WHERE name = 'โทร'");
        
        echo json_encode([
            'ok' => true,
            'message' => 'Column require_page added successfully. Set to 0 for "โทร" platform.'
        ]);
    } else {
        echo json_encode([
            'ok' => true,
            'message' => 'Column require_page already exists, no changes needed.'
        ]);
    }
} catch (Exception $e) {
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage()
    ]);
}
