<?php
/**
 * check_call_duplicates.php
 * POST: รับ CSV file → parse เฉพาะ ID column → เช็ค duplicate กับ call_import_logs.record_id
 *       + เช็คเบอร์ซ้ำในตาราง users (scoped by company_id)
 * Return: { duplicateCount, duplicateIds[], totalRows, duplicatePhones[] }
 */
error_reporting(E_ALL);
ini_set("display_errors", 1);

require_once __DIR__ . "/../config.php";
cors();

try {
    $pdo = db_connect();
} catch (RuntimeException $e) {
    json_response(["success" => false, "error" => "Database connection failed: " . $e->getMessage()], 500);
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    json_response(["success" => false, "error" => "Method not allowed"], 405);
}

// Check if file was uploaded
if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    json_response(["success" => false, "error" => "No file uploaded or upload error"], 400);
}

$companyId = isset($_POST['company_id']) ? intval($_POST['company_id']) : null;
$filePath = $_FILES['file']['tmp_name'];

// ═══════════════════════════════════════
// CHECK: duplicate phone numbers in users table
// ═══════════════════════════════════════
$duplicatePhones = [];
if ($companyId) {
    $phoneSql = "SELECT RIGHT(phone, 9) AS phone9, GROUP_CONCAT(CONCAT(first_name, ' ', COALESCE(last_name, '')) SEPARATOR ', ') AS user_names, COUNT(*) AS cnt
                 FROM users
                 WHERE company_id = ? AND phone IS NOT NULL AND phone != '' AND status = 'active'
                 GROUP BY RIGHT(phone, 9)
                 HAVING cnt > 1";
    $phoneStmt = $pdo->prepare($phoneSql);
    $phoneStmt->execute([$companyId]);
    $duplicatePhones = $phoneStmt->fetchAll(PDO::FETCH_ASSOC);
}

// ═══════════════════════════════════════
// CHECK: duplicate record IDs in CSV vs database
// ═══════════════════════════════════════

// Open and parse CSV
$handle = fopen($filePath, 'r');
if (!$handle) {
    json_response(["success" => false, "error" => "Cannot open uploaded file"], 500);
}

// Read header row
$headers = fgetcsv($handle);
if (!$headers) {
    fclose($handle);
    json_response(["success" => false, "error" => "Empty CSV file"], 400);
}

// Clean BOM from first header
$headers[0] = preg_replace('/^\xEF\xBB\xBF/', '', $headers[0]);

// Find ID column index
$idIndex = array_search('ID', $headers);
if ($idIndex === false) {
    fclose($handle);
    json_response(["success" => false, "error" => "CSV file missing 'ID' column"], 400);
}

// Collect all record IDs from CSV
$csvIds = [];
while (($row = fgetcsv($handle)) !== false) {
    if (isset($row[$idIndex]) && trim($row[$idIndex]) !== '') {
        $csvIds[] = trim($row[$idIndex]);
    }
}
fclose($handle);

$totalRows = count($csvIds);

if ($totalRows === 0) {
    json_response([
        "success" => true,
        "totalRows" => 0,
        "duplicateCount" => 0,
        "duplicateIds" => [],
        "newRows" => 0,
        "duplicatePhones" => $duplicatePhones,
    ]);
}

// Check which IDs already exist in database (batch query)
$duplicateIds = [];
$batchSize = 500;
$chunks = array_chunk($csvIds, $batchSize);

foreach ($chunks as $chunk) {
    $placeholders = implode(',', array_fill(0, count($chunk), '?'));
    $stmt = $pdo->prepare("SELECT record_id FROM call_import_logs WHERE record_id IN ($placeholders)");
    $stmt->execute($chunk);
    $existing = $stmt->fetchAll(PDO::FETCH_COLUMN);
    $duplicateIds = array_merge($duplicateIds, $existing);
}

json_response([
    "success" => true,
    "totalRows" => $totalRows,
    "duplicateCount" => count($duplicateIds),
    "duplicateIds" => $duplicateIds,
    "newRows" => $totalRows - count($duplicateIds),
    "duplicatePhones" => $duplicatePhones,
]);
?>