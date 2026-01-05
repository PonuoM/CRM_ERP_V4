<?php
require 'api/config.php';
$pdo = db_connect();

echo "🔍 Checking recent exports with company_id and user_id...\n\n";

// Get most recent exports
$stmt = $pdo->query('
    SELECT id, filename, company_id, user_id, category, exported_by, created_at 
    FROM exports 
    ORDER BY created_at DESC 
    LIMIT 5
');

$exports = $stmt->fetchAll();

echo "📊 Recent 5 exports:\n\n";

foreach ($exports as $export) {
    echo "Export ID: {$export['id']}\n";
    echo "  Filename: {$export['filename']}\n";
    echo "  Company ID: " . ($export['company_id'] ?? 'NULL') . "\n";
    echo "  User ID: " . ($export['user_id'] ?? 'NULL') . "\n";
    echo "  Category: " . ($export['category'] ?? 'NULL') . "\n";
    echo "  Exported By: " . ($export['exported_by'] ?? 'NULL') . "\n";
    echo "  Created: {$export['created_at']}\n\n";
}

// Check if any recent exports have company_id and user_id
$stmt = $pdo->query('
    SELECT COUNT(*) as count 
    FROM exports 
    WHERE company_id IS NOT NULL AND user_id IS NOT NULL
    AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
');
$result = $stmt->fetch();

echo "📈 Exports in last hour with company_id AND user_id: {$result['count']}\n";

if ($result['count'] == 0) {
    echo "❌ No recent exports have both company_id and user_id!\n";
    echo "   This confirms the problem.\n";
} else {
    echo "✅ Some exports have company_id and user_id\n";
}
