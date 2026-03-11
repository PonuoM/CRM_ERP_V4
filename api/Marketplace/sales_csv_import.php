<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");

require_once __DIR__ . '/../config.php';

// Excel serial date to PHP date
function excelSerialToDate($serial) {
    if (empty($serial) || !is_numeric($serial)) return null;
    $serial = floatval($serial);
    if ($serial < 1) return null;
    $unixDays = $serial - 25569;
    $timestamp = $unixDays * 86400;
    return date('Y-m-d', intval($timestamp));
}

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
    $filename = $file['name'];
    $tmpPath = $file['tmp_name'];

    // Read file content and handle BOM
    $content = file_get_contents($tmpPath);
    if (substr($content, 0, 3) === "\xEF\xBB\xBF") {
        $content = substr($content, 3);
    }

    // Parse CSV
    $lines = explode("\n", str_replace("\r\n", "\n", $content));
    $header = str_getcsv(array_shift($lines)); // remove header

    if (count($header) < 10) {
        echo json_encode(["success" => false, "error" => "Invalid CSV format: expected at least 10 columns, got " . count($header)]);
        exit;
    }

    // ========== PHASE 1: Pre-parse all rows ==========
    $parsedRows = [];
    $allProductCodes = [];
    $allStoreKeys = []; // store_name => platform

    foreach ($lines as $lineNum => $line) {
        $line = trim($line);
        if ($line === '') continue;

        $cols = str_getcsv($line);
        if (count($cols) < 8) continue;
        while (count($cols) < 16) $cols[] = '';

        $productCode = trim($cols[0]);
        $storeName = trim($cols[12]);
        $platform = trim($cols[11]);

        if ($productCode !== '') {
            $allProductCodes[$productCode] = true;
        }
        if ($storeName !== '') {
            $allStoreKeys[$storeName] = $platform;
        }

        $parsedRows[] = [
            'lineNum' => $lineNum,
            'cols' => $cols,
        ];
    }

    // ========== PHASE 2: Validate product codes ==========
    $unknownProducts = []; // code => [line numbers]
    if (!empty($allProductCodes)) {
        // Get all known SKUs for this company
        $stmt = $conn->prepare("SELECT sku FROM products WHERE company_id = ?");
        $stmt->execute([$companyId]);
        $knownSkus = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $knownSkus[$row['sku']] = true;
        }

        // Check each parsed row for unknown SKUs and track line numbers
        foreach ($parsedRows as $row) {
            $code = trim($row['cols'][0]);
            if ($code !== '' && !isset($knownSkus[$code])) {
                if (!isset($unknownProducts[$code])) {
                    $unknownProducts[$code] = [];
                }
                $csvLine = $row['lineNum'] + 2; // +2 for header + 0-index
                if (!in_array($csvLine, $unknownProducts[$code])) {
                    $unknownProducts[$code][] = $csvLine;
                }
            }
        }
    }

    // If any unknown product codes found, REJECT the entire import
    if (!empty($unknownProducts)) {
        $details = [];
        foreach ($unknownProducts as $sku => $lines) {
            $lineStr = implode(', ', array_slice($lines, 0, 5));
            if (count($lines) > 5) $lineStr .= '...';
            $details[] = [
                'sku' => $sku,
                'lines' => $lines,
                'line_display' => $lineStr,
                'count' => count($lines),
            ];
        }

        echo json_encode([
            "success" => false,
            "error" => "พบรหัสสินค้าที่ไม่มีในระบบ " . count($unknownProducts) . " รายการ ไม่สามารถนำเข้าได้ กรุณาเพิ่มสินค้าเหล่านี้ในระบบก่อน",
            "unknown_products" => $details,
        ]);
        exit;
    }

    // ========== PHASE 3: Auto-create missing stores ==========
    $createdStores = [];
    if (!empty($allStoreKeys)) {
        // Get existing store names for this company
        $stmt = $conn->prepare("SELECT id, name FROM marketplace_stores WHERE company_id = ?");
        $stmt->execute([$companyId]);
        $existingStores = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $existingStores[trim($row['name'])] = $row['id'];
        }

        $stmtCreateStore = $conn->prepare(
            "INSERT INTO marketplace_stores (name, platform, company_id, active) VALUES (?,?,?,1)"
        );

        foreach ($allStoreKeys as $storeName => $platform) {
            if (!isset($existingStores[$storeName])) {
                $stmtCreateStore->execute([$storeName, $platform, $companyId]);
                $newId = $conn->lastInsertId();
                $existingStores[$storeName] = $newId;
                $createdStores[] = [
                    'name' => $storeName,
                    'platform' => $platform,
                    'id' => intval($newId)
                ];
            }
        }
    }

    // ========== PHASE 4: Create batch & insert rows ==========
    $stmtBatch = $conn->prepare("INSERT INTO marketplace_import_batches (filename, total_rows, user_id, company_id) VALUES (?,?,?,?)");
    $totalRows = count($parsedRows);
    $stmtBatch->execute([$filename, $totalRows, $userId, $companyId]);
    $batchId = $conn->lastInsertId();

    $stmtInsert = $conn->prepare("
        INSERT INTO marketplace_sales_orders 
        (batch_id, product_code, product_name, variant_code, variant_name,
         internal_order_id, online_order_id, quantity, total_price,
         order_date, shipping_date, order_status, platform, store_name,
         warehouse, tracking_number, status, company_id)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ");

    $imported = 0;
    $skipped = 0;
    $errors = [];

    foreach ($parsedRows as $row) {
        $cols = $row['cols'];
        $lineNum = $row['lineNum'];

        $productCode = trim($cols[0]);
        $productName = trim($cols[1]);
        $variantCode = trim($cols[2]);
        $variantName = trim($cols[3]);
        $internalOrderId = trim($cols[4]);
        $onlineOrderId = trim($cols[5]);
        $quantity = intval($cols[6]);
        $totalPrice = floatval(str_replace(',', '', $cols[7]));
        $orderDate = excelSerialToDate($cols[8]);
        $shippingDate = excelSerialToDate($cols[9]);
        $orderStatus = trim($cols[10]);
        $platform = trim($cols[11]);
        $storeName = trim($cols[12]);
        $warehouse = trim($cols[13]);
        $trackingNumber = trim($cols[14]);
        $status = trim($cols[15]);

        try {
            $stmtInsert->execute([
                $batchId, $productCode, $productName, $variantCode, $variantName,
                $internalOrderId, $onlineOrderId, $quantity, $totalPrice,
                $orderDate, $shippingDate, $orderStatus, $platform, $storeName,
                $warehouse, $trackingNumber, $status, $companyId
            ]);
            $imported++;
        } catch (Exception $e) {
            $skipped++;
            if (count($errors) < 5) $errors[] = "Row " . ($lineNum + 2) . ": " . $e->getMessage();
        }
    }

    // Update batch stats
    $stmtUpdate = $conn->prepare("UPDATE marketplace_import_batches SET imported_rows=?, skipped_rows=? WHERE id=?");
    $stmtUpdate->execute([$imported, $skipped, $batchId]);

    // Auto-match store names with stores
    $conn->exec("
        UPDATE marketplace_sales_orders mso
        JOIN marketplace_stores ms ON TRIM(mso.store_name) = TRIM(ms.name) AND ms.company_id = mso.company_id
        SET mso.store_id = ms.id
        WHERE mso.batch_id = $batchId AND mso.store_id IS NULL
    ");

    echo json_encode([
        "success" => true,
        "batch_id" => intval($batchId),
        "total_rows" => $totalRows,
        "imported_rows" => $imported,
        "skipped_rows" => $skipped,
        "errors" => $errors,
        "created_stores" => $createdStores,
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>
