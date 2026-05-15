<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");

require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "error" => "Method not allowed"]);
    exit;
}

try {
    $conn = db_connect();

    $companyId = $_POST['company_id'] ?? null;
    $userId = $_POST['user_id'] ?? null;

    if (!$companyId || !$userId) {
        echo json_encode(["success" => false, "error" => "Missing company_id or user_id"]);
        exit;
    }

    if (!isset($_FILES['csv_file']) || $_FILES['csv_file']['error'] !== UPLOAD_ERR_OK) {
        echo json_encode(["success" => false, "error" => "No file uploaded or upload error"]);
        exit;
    }

    $file = $_FILES['csv_file'];
    $tmpPath = $file['tmp_name'];

    // Read file content and handle BOM
    $content = file_get_contents($tmpPath);
    if (substr($content, 0, 3) === "\xEF\xBB\xBF") {
        $content = substr($content, 3);
    }

    // Parse CSV
    $lines = explode("\n", str_replace("\r\n", "\n", $content));
    $header = str_getcsv(array_shift($lines)); // remove header

    if (count($header) < 5) {
        echo json_encode(["success" => false, "error" => "Invalid CSV format: expected at least 5 columns, got " . count($header)]);
        exit;
    }

    $parsedRows = [];
    $allStoreKeys = []; // store_name => platform

    foreach ($lines as $lineNum => $line) {
        $line = trim($line);
        if ($line === '') continue;

        $cols = str_getcsv($line);
        if (count($cols) < 5) continue;
        while (count($cols) < 6) $cols[] = '';

        $monthYear = trim($cols[0]);
        $platform = trim($cols[1]);
        $storeName = trim($cols[2]);
        $totalSales = floatval(str_replace(',', '', trim($cols[3])));
        $actualAmount = floatval(str_replace(',', '', trim($cols[4])));
        $fileUrl = trim($cols[5]);

        // Basic validation for month_year format (try to coerce to YYYY-MM if it's MM/YYYY)
        if (preg_match('/^(\d{2})\/(\d{4})$/', $monthYear, $matches)) {
            $monthYear = $matches[2] . '-' . $matches[1];
        } else if (preg_match('/^(\d{4})-(\d{2})$/', $monthYear, $matches)) {
            // Already correct
        } else if (!empty($monthYear)) {
            // Unrecognized format, just try formatting date
            $time = strtotime($monthYear);
            if ($time) {
                $monthYear = date('Y-m', $time);
            }
        }

        if (empty($platform) || empty($monthYear)) {
            continue; // Skip invalid rows
        }

        if ($storeName && $platform) {
            $allStoreKeys[$storeName] = $platform;
        }

        $parsedRows[] = [
            'month_year' => $monthYear,
            'platform' => $platform,
            'store_name' => $storeName,
            'total_sales' => $totalSales,
            'actual_amount' => $actualAmount,
            'file_url' => $fileUrl
        ];
    }

    // Lookup or Create Stores
    $storeNameToId = [];
    $stmtStore = $conn->prepare("SELECT id FROM marketplace_stores WHERE company_id = ? AND name = ? AND platform = ?");
    $stmtInsertStore = $conn->prepare("INSERT INTO marketplace_stores (company_id, name, platform, active) VALUES (?, ?, ?, 1)");

    foreach ($allStoreKeys as $name => $plat) {
        $stmtStore->execute([$companyId, $name, $plat]);
        $row = $stmtStore->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            $storeNameToId[$name . '_' . $plat] = $row['id'];
        } else {
            $stmtInsertStore->execute([$companyId, $name, $plat]);
            $storeNameToId[$name . '_' . $plat] = $conn->lastInsertId();
        }
    }

    $conn->beginTransaction();

    $stmtInsertInvoice = $conn->prepare("
        INSERT INTO marketplace_invoices 
        (company_id, store_id, platform, employee_id, month_year, total_sales_amount, actual_amount, file_path) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");

    $importedCount = 0;
    foreach ($parsedRows as $r) {
        $storeId = null;
        if (!empty($r['store_name']) && !empty($r['platform'])) {
            $key = $r['store_name'] . '_' . $r['platform'];
            if (isset($storeNameToId[$key])) {
                $storeId = $storeNameToId[$key];
            }
        }

        $stmtInsertInvoice->execute([
            $companyId,
            $storeId,
            $r['platform'],
            $userId,
            $r['month_year'],
            $r['total_sales'],
            $r['actual_amount'],
            $r['file_url'] ?: null
        ]);
        $importedCount++;
    }

    $conn->commit();

    echo json_encode([
        "success" => true,
        "imported_rows" => $importedCount
    ]);

} catch (\Exception $e) {
    if (isset($conn) && $conn->inTransaction()) {
        $conn->rollBack();
    }
    file_put_contents(__DIR__ . '/../../tmp/php_errors.log', date('Y-m-d H:i:s') . " invoices_csv_import error: " . $e->getMessage() . "\n", FILE_APPEND);
    echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
