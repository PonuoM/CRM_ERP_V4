<?php
require 'api/config.php';
$pdo = db_connect();

$exportId = 92;

echo "🔍 Checking export file integrity...\n\n";

// Get export info
$stmt = $pdo->prepare('SELECT * FROM exports WHERE id = ?');
$stmt->execute([$exportId]);
$export = $stmt->fetch();

if (!$export) {
    echo "❌ Export not found\n";
    exit;
}

echo "📦 Export Info:\n";
echo "  ID: {$export['id']}\n";
echo "  Filename: {$export['filename']}\n";
echo "  File Path: {$export['file_path']}\n";
echo "  Orders Count: {$export['orders_count']}\n\n";

// Check file
$path = $export['file_path'];
if (!file_exists($path)) {
    echo "❌ File not found: {$path}\n";
    exit;
}

$filesize = filesize($path);
echo "📁 File Info:\n";
echo "  Exists: ✅\n";
echo "  Size: {$filesize} bytes\n";

// Check file header (first 4 bytes for XLSX signature)
$handle = fopen($path, 'rb');
$header = fread($handle, 4);
fclose($handle);

$hex = bin2hex($header);
echo "  Header (hex): {$hex}\n";

// XLSX files should start with PK (ZIP signature: 50 4B 03 04)
if ($hex === '504b0304') {
    echo "  Format: ✅ Valid XLSX (ZIP) signature\n";
} else {
    echo "  Format: ❌ Invalid signature! Expected '504b0304' (PK)\n";
    echo "  This file is corrupted or not a valid XLSX file\n";
}

// Check if file is empty or too small
if ($filesize < 1000) {
    echo "\n⚠️  WARNING: File is suspiciously small ({$filesize} bytes)\n";
    echo "  XLSX files are typically at least several KB\n";
}
