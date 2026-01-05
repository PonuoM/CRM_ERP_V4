<?php
require 'api/config.php';
$pdo = db_connect();

echo "🔍 Checking exports table data...\n\n";

// Get all exports
$stmt = $pdo->query('SELECT id, company_id, category, filename, orders_count, user_id, exported_by, created_at FROM exports ORDER BY created_at DESC LIMIT 10');
$exports = $stmt->fetchAll();

echo "📊 Total exports in database: " . count($exports) . "\n\n";

if (count($exports) > 0) {
    echo "Recent exports:\n";
    foreach ($exports as $export) {
        echo "  ID: {$export['id']}\n";
        echo "    Company ID: " . ($export['company_id'] ?? 'NULL') . "\n";
        echo "    Category: " . ($export['category'] ?? 'NULL') . "\n";
        echo "    Filename: {$export['filename']}\n";
        echo "    Orders: {$export['orders_count']}\n";
        echo "    User ID: " . ($export['user_id'] ?? 'NULL') . "\n";
        echo "    Exported By: " . ($export['exported_by'] ?? 'NULL') . "\n";
        echo "    Created: {$export['created_at']}\n\n";
    }
} else {
    echo "❌ No exports found in database\n";
}

// Check company_id distribution
echo "\n📈 Company ID distribution:\n";
$stmt = $pdo->query('SELECT company_id, COUNT(*) as count FROM exports GROUP BY company_id');
while ($row = $stmt->fetch()) {
    $companyId = $row['company_id'] ?? 'NULL';
    echo "  Company {$companyId}: {$row['count']} exports\n";
}
