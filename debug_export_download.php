<?php
require 'api/config.php';
$pdo = db_connect();

$exportId = 87; // ตัวอย่าง ID
$companyId = 1; // Company ID ของ user

echo "🔍 Testing export download authorization...\n\n";

// Check if export exists
$stmt = $pdo->prepare('SELECT * FROM exports WHERE id = ?');
$stmt->execute([$exportId]);
$row = $stmt->fetch();

if (!$row) {
    echo "❌ Export ID {$exportId} not found in database\n";
} else {
    echo "✅ Export found:\n";
    echo "  ID: {$row['id']}\n";
    echo "  Filename: {$row['filename']}\n";
    echo "  File Path: {$row['file_path']}\n";
    echo "  Company ID: " . ($row['company_id'] ?? 'NULL') . "\n";
    echo "  User ID: " . ($row['user_id'] ?? 'NULL') . "\n\n";
    
    // Check authorization
    echo "🔐 Authorization check:\n";
    echo "  User's Company ID: {$companyId}\n";
    echo "  Export's Company ID: " . ($row['company_id'] ?? 'NULL') . "\n";
    
    if ($row['company_id'] && $row['company_id'] != $companyId) {
        echo "  ❌ UNAUTHORIZED: Company ID mismatch\n";
    } else {
        echo "  ✅ AUTHORIZED\n";
    }
    
    // Check file exists
    echo "\n📁 File check:\n";
    $path = $row['file_path'];
    echo "  Path: {$path}\n";
    
    if (file_exists($path)) {
        echo "  ✅ File exists\n";
        echo "  Size: " . filesize($path) . " bytes\n";
    } else {
        echo "  ❌ FILE NOT FOUND on disk\n";
        echo "  This is the problem!\n";
    }
}
