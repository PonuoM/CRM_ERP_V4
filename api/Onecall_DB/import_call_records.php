<?php
/**
 * import_call_records.php
 * POST: รับ CSV file → สร้าง batch → INSERT logs
 * Match agent_phone: เทียบ 9 ตัวท้ายของ CallOrigination/DisplayNumber/CallTermination กับ users.phone
 * Return: { success, batchId, totalRows, matchedRows, duplicateRows, insertedRows }
 */
error_reporting(E_ALL);
ini_set("display_errors", 1);
ini_set('memory_limit', '512M');
set_time_limit(300);

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

// Check file upload
if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    json_response(["success" => false, "error" => "No file uploaded or upload error"], 400);
}

$companyId = isset($_POST['company_id']) ? intval($_POST['company_id']) : null;
$createdBy = isset($_POST['created_by']) ? intval($_POST['created_by']) : null;
$startDate = isset($_POST['start_date']) && $_POST['start_date'] !== '' ? $_POST['start_date'] : null;
$endDate = isset($_POST['end_date']) && $_POST['end_date'] !== '' ? $_POST['end_date'] : null;
$fileName = $_FILES['file']['name'] ?? 'unknown.csv';
$filePath = $_FILES['file']['tmp_name'];

// ── Helper: extract last 9 digits ──
function last9digits($phone)
{
    $digits = preg_replace('/\D/', '', $phone);
    if (strlen($digits) < 9)
        return $digits;
    return substr($digits, -9);
}

// ── Helper: parse DD/MM/YYYY to YYYY-MM-DD ──
function parseDateDMY($dateStr)
{
    $dateStr = trim($dateStr);
    if (empty($dateStr))
        return null;
    // Try DD/MM/YYYY
    $parts = explode('/', $dateStr);
    if (count($parts) === 3) {
        $d = str_pad($parts[0], 2, '0', STR_PAD_LEFT);
        $m = str_pad($parts[1], 2, '0', STR_PAD_LEFT);
        $y = $parts[2];
        return "$y-$m-$d";
    }
    return $dateStr; // return as-is if not parseable
}

// ── Pre-load user phones for matching (scoped by company_id) ──
$userPhones = [];
if ($companyId) {
    $stmt = $pdo->prepare("SELECT id, phone FROM users WHERE phone IS NOT NULL AND phone != '' AND company_id = ?");
    $stmt->execute([$companyId]);
} else {
    $stmt = $pdo->query("SELECT id, phone FROM users WHERE phone IS NOT NULL AND phone != ''");
}
while ($row = $stmt->fetch()) {
    $normalized = last9digits($row['phone']);
    if (strlen($normalized) >= 9) {
        $userPhones[$normalized] = $row;
    }
}

// ── Open CSV ──
$handle = fopen($filePath, 'r');
if (!$handle) {
    json_response(["success" => false, "error" => "Cannot open uploaded file"], 500);
}

// Read headers
$headers = fgetcsv($handle);
if (!$headers) {
    fclose($handle);
    json_response(["success" => false, "error" => "Empty CSV file"], 400);
}

// Clean BOM
$headers[0] = preg_replace('/^\xEF\xBB\xBF/', '', $headers[0]);

// Map header names to indices
$colMap = [];
foreach ($headers as $i => $h) {
    $colMap[trim($h)] = $i;
}

// Required columns check
$requiredCols = ['ID', 'CallDate'];
foreach ($requiredCols as $col) {
    if (!isset($colMap[$col])) {
        fclose($handle);
        json_response(["success" => false, "error" => "CSV missing required column: $col"], 400);
    }
}

// Read all data rows
$rows = [];
while (($row = fgetcsv($handle)) !== false) {
    $rows[] = $row;
}
fclose($handle);

$totalRows = count($rows);
if ($totalRows === 0) {
    json_response(["success" => true, "batchId" => null, "totalRows" => 0, "insertedRows" => 0, "matchedRows" => 0, "duplicateRows" => 0]);
}

// ── Create batch ──
$pdo->beginTransaction();
try {
    $batchStmt = $pdo->prepare(
        "INSERT INTO call_import_batches (file_name, total_rows, matched_rows, duplicate_rows, company_id, created_by, start_date, end_date) VALUES (?, ?, 0, 0, ?, ?, ?, ?)"
    );
    $batchStmt->execute([$fileName, $totalRows, $companyId, $createdBy, $startDate, $endDate]);
    $batchId = $pdo->lastInsertId();

    // Prepare insert statement
    $insertStmt = $pdo->prepare(
        "INSERT IGNORE INTO call_import_logs
      (batch_id, record_id, business_group_name, call_date, call_origination, display_number,
       call_termination, status, start_time, ringing_duration, answered_time, terminated_time,
       terminated_reason, reason_change, final_number, duration, rec_type, charging_group,
       agent_phone, matched_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    $insertedRows = 0;
    $matchedRows = 0;
    $duplicateRows = 0;

    // Helper to get column value safely
    $getCol = function ($row, $colName) use ($colMap) {
        if (!isset($colMap[$colName]))
            return null;
        $idx = $colMap[$colName];
        return isset($row[$idx]) ? trim($row[$idx]) : null;
    };

    foreach ($rows as $row) {
        $recordId = $getCol($row, 'ID');
        if (empty($recordId))
            continue;

        // Parse fields
        $callDate = parseDateDMY($getCol($row, 'CallDate'));
        $callOrig = $getCol($row, 'CallOrigination') ?? '';
        $displayNum = $getCol($row, 'DisplayNumber') ?? '';
        $callTerm = $getCol($row, 'CallTermination') ?? '';
        $statusVal = $getCol($row, 'Status');
        $startTime = $getCol($row, 'StartTime');
        $ringingDur = $getCol($row, 'RingingDuration');
        $answeredTime = $getCol($row, 'AnswerdTime');  // note: CSV has typo "Answerd"
        $terminatedTime = $getCol($row, 'TerminatedTime');
        $termReason = $getCol($row, 'TerminatedReason');
        $reasonChange = $getCol($row, 'ReasonChange');
        $finalNumber = $getCol($row, 'FinalNumber');
        $duration = $getCol($row, 'Duration');
        $recType = $getCol($row, 'RecType');
        $chargingGroup = $getCol($row, 'ChargingGroup');
        $bgName = $getCol($row, 'BusinessGroupName');

        // ── Agent phone matching ──
        $agentPhone = null;
        $matchedUserId = null;
        $candidates = [$callOrig, $displayNum, $callTerm];
        foreach ($candidates as $candidate) {
            if (empty($candidate))
                continue;
            $norm = last9digits($candidate);
            if (strlen($norm) >= 9 && isset($userPhones[$norm])) {
                $agentPhone = $candidate; // store original value
                $matchedUserId = $userPhones[$norm]['id'];
                break;
            }
        }

        if ($agentPhone !== null) {
            $matchedRows++;
        }

        // Insert (IGNORE handles duplicate record_id)
        $insertStmt->execute([
            $batchId,
            $recordId,
            $bgName,
            $callDate,
            $callOrig,
            $displayNum,
            $callTerm,
            is_numeric($statusVal) ? intval($statusVal) : 0,
            $startTime,
            $ringingDur,
            $answeredTime,
            $terminatedTime,
            $termReason,
            $reasonChange,
            $finalNumber,
            $duration,
            is_numeric($recType) ? intval($recType) : null,
            $chargingGroup,
            $agentPhone,
            $matchedUserId,
        ]);

        if ($insertStmt->rowCount() > 0) {
            $insertedRows++;
        } else {
            $duplicateRows++;
        }
    }

    // Update batch with final counts
    $updateBatch = $pdo->prepare(
        "UPDATE call_import_batches SET total_rows = ?, matched_rows = ?, duplicate_rows = ? WHERE id = ?"
    );
    $updateBatch->execute([$insertedRows + $duplicateRows, $matchedRows, $duplicateRows, $batchId]);

    $pdo->commit();

    json_response([
        "success" => true,
        "batchId" => (int) $batchId,
        "totalRows" => $totalRows,
        "insertedRows" => $insertedRows,
        "matchedRows" => $matchedRows,
        "duplicateRows" => $duplicateRows,
    ], 201);

} catch (Exception $e) {
    if ($pdo->inTransaction())
        $pdo->rollBack();
    error_log("Call import failed: " . $e->getMessage());
    json_response(["success" => false, "error" => "Import failed: " . $e->getMessage()], 500);
}
?>