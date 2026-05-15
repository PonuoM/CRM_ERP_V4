<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");

require_once __DIR__ . '/../config.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(["success" => false, "error" => "Method not allowed"]);
        exit;
    }

    if (!isset($_FILES['jst_file']) || $_FILES['jst_file']['error'] !== UPLOAD_ERR_OK) {
        $uploadErr = isset($_FILES['jst_file']['error']) ? $_FILES['jst_file']['error'] : 'No file';
        echo json_encode(["success" => false, "error" => "ไม่มีไฟล์ที่อัปโหลด หรืออัปโหลดไฟล์ไม่สำเร็จ (Error Code: $uploadErr)"]);
        exit;
    }

    $fileTmpPath = $_FILES['jst_file']['tmp_name'];
    $filename = $_FILES['jst_file']['name'];
    $companyId = $_POST['company_id'] ?? null;
    $userId = $_POST['user_id'] ?? null;

    if (!$companyId || !$userId) {
        echo json_encode(["success" => false, "error" => "Missing company_id or user_id"]);
        exit;
    }

    $conn = db_connect();
    $zip = new ZipArchive;

    if ($zip->open($fileTmpPath) !== TRUE) {
        echo json_encode(["success" => false, "error" => "ไม่สามารถเปิดไฟล์ Excel ได้ อาจไม่ใช่ไฟล์ .xlsx ที่ถูกต้อง"]);
        exit;
    }

    // 1. Read shared strings
    $strings = [];
    $sharedStringsData = $zip->getFromName('xl/sharedStrings.xml');
    if ($sharedStringsData) {
        $xml = simplexml_load_string($sharedStringsData);
        if ($xml && isset($xml->si)) {
            foreach ($xml->si as $val) {
                if (isset($val->t)) {
                    $strings[] = (string)$val->t;
                } elseif (isset($val->r)) {
                    $text = '';
                    foreach ($val->r as $run) {
                        $text .= (string)$run->t;
                    }
                    $strings[] = $text;
                } else {
                    $strings[] = '';
                }
            }
        }
    }

    // 2. Stream sheet1
    $stream = $zip->getStream('xl/worksheets/sheet1.xml');
    if (!$stream) {
        echo json_encode(["success" => false, "error" => "ไม่พบข้อมูลชีทงาน (sheet1.xml) ในไฟล์"]);
        $zip->close();
        exit;
    }

    $reader = new XMLReader();
    $realPath = realpath($fileTmpPath);
    if (!$realPath) {
        throw new Exception("ไม่สามารถระบุที่อยู่ไฟล์ชั่วคราวได้");
    }
    
    if (!$reader->open('zip://' . $realPath . '#xl/worksheets/sheet1.xml')) {
        throw new Exception("ไม่สามารถเปิดสตรีมข้อมูลชีทได้");
    }

    $rowCount = 0;
    $headerRow = [];
    $i_internal = -1; $i_online = -1; $i_pcode = -1; $i_pname = -1; $i_vcode = -1;
    $i_qty = -1; $i_price = -1; $i_odate = -1; $i_sdate = -1; $i_ostatus = -1;
    $i_platform = -1; $i_store = -1; $i_store_alt = -1; $i_warehouse = -1;
    $i_tracking = -1; $i_status = -1;

    $orders = [];
    $allProductCodes = [];
    $allStoreKeys = [];

    // Helper function to format Excel serial date
    function formatExcelDate($val) {
        if (!$val) return null;
        if (is_numeric($val)) {
            // Excel base date is 1899-12-30.
            $timestamp = ($val - 25569) * 86400; 
            return gmdate("Y-m-d H:i:s", (int)round($timestamp));
        }
        return trim((string)$val);
    }

    while ($reader->read()) {
        if ($reader->nodeType == XMLReader::ELEMENT && $reader->name == 'row') {
            $rowCount++;
            $rowXml = $reader->readOuterXml();
            $rowDom = simplexml_load_string($rowXml);
            
            $rowData = [];
            if ($rowDom && isset($rowDom->c)) {
                foreach ($rowDom->c as $cell) {
                    $val = (string)$cell->v;
                    $type = (string)$cell['t'];
                    $colRef = preg_replace('/[0-9]+/', '', (string)$cell['r']); 
                    
                    $colIndex = 0;
                    $len = strlen($colRef);
                    for ($i = 0; $i < $len; $i++) {
                        $colIndex = $colIndex * 26 + (ord($colRef[$i]) - 64);
                    }
                    $colIndex -= 1; 
                    
                    if ($type == 's' && isset($strings[(int)$val])) {
                        $val = $strings[(int)$val];
                    } elseif ($type == 'inlineStr' && isset($cell->is->t)) {
                        $val = (string)$cell->is->t;
                    }
                    
                    $rowData[$colIndex] = $val;
                }
            }
            
            if ($rowCount === 1) {
                // Process Headers
                $maxCol = empty($rowData) ? 0 : max(array_keys($rowData));
                for ($c = 0; $c <= $maxCol; $c++) {
                    $h = isset($rowData[$c]) ? trim((string)$rowData[$c]) : '';
                    $headerRow[$c] = $h;
                    
                    if ($h === 'หมายเลขออเดอร์ภายใน') $i_internal = $c;
                    if ($h === 'หมายเลขคำสั่งซื้อออนไลน์') $i_online = $c;
                    if ($h === 'รหัสสินค้า') $i_pcode = $c;
                    if ($h === 'ชื่อสินค้า') $i_pname = $c;
                    if ($h === 'รูปแบบสินค้า') $i_vcode = $c;
                    if ($h === 'จำนวน') $i_qty = $c;
                    if ($h === 'จํานวนเงินเท่านั้น') $i_price = $c;
                    if ($h === 'เวลาสั่งซื้อ') $i_odate = $c;
                    if ($h === 'วันที่จัดส่ง') $i_sdate = $c;
                    if ($h === 'สถานะคำสั่งซื้อ') $i_ostatus = $c;
                    if ($h === 'แพลตฟอร์ม') $i_platform = $c;
                    if ($h === 'ร้านค้า' || $h === "ร้านค้า\u{200B}") {
                        if ($i_store === -1) $i_store = $c;
                        else $i_store_alt = $c;
                    }
                    if ($h === 'คลังสินค้าส่งออก') $i_warehouse = $c;
                    if ($h === 'เลขพัสดุ') $i_tracking = $c;
                    if ($h === 'สถานะขนส่ง') $i_status = $c;
                }
                
                if ($i_pcode === -1 || $i_internal === -1 || ($i_store === -1 && $i_store_alt === -1)) {
                    echo json_encode(["success" => false, "error" => "รูปแบบไฟล์ไม่ถูกต้อง (หาคอลัมน์ รหัสสินค้า, หมายเลขออเดอร์ภายใน, หรือ ร้านค้า ไม่พบ)"]);
                    $reader->close();
                    $zip->close();
                    exit;
                }
                continue; 
            }

            // Process Data Row
            if (empty($rowData)) continue;
            
            $sku = isset($rowData[$i_pcode]) ? trim((string)$rowData[$i_pcode]) : '';
            if ($sku === '') continue; 

            $qty = ($i_qty !== -1 && isset($rowData[$i_qty])) ? (int)trim($rowData[$i_qty]) : 1;
            if ($qty <= 0) $qty = 1;

            if (preg_match('/^(.*?)-(\d+)$/', $sku, $matches)) {
                $sku = $matches[1];
                $multiplier = (int)$matches[2];
                $qty = $qty * $multiplier;
            }

            $storeName = '';
            if ($i_store !== -1 && isset($rowData[$i_store])) $storeName = (string)$rowData[$i_store];
            elseif ($i_store_alt !== -1 && isset($rowData[$i_store_alt])) $storeName = (string)$rowData[$i_store_alt];
            $storeName = trim(preg_replace('/[\x{200B}-\x{200D}\x{FEFF}]/u', '', $storeName ?? ''));

            $priceStr = ($i_price !== -1 && isset($rowData[$i_price])) ? str_replace(',', '', (string)$rowData[$i_price]) : '0';
            $price = (float)$priceStr;

            $productName = ($i_pname !== -1 && isset($rowData[$i_pname])) ? trim((string)$rowData[$i_pname]) : '';
            $variantCode = ($i_vcode !== -1 && isset($rowData[$i_vcode])) ? trim((string)$rowData[$i_vcode]) : '';
            $variantName = $variantCode; 
            $internalOrderId = ($i_internal !== -1 && isset($rowData[$i_internal])) ? trim((string)$rowData[$i_internal]) : '';
            $onlineOrderId = ($i_online !== -1 && isset($rowData[$i_online])) ? trim((string)$rowData[$i_online]) : '';
            
            $orderDate = ($i_odate !== -1 && isset($rowData[$i_odate])) ? formatExcelDate($rowData[$i_odate]) : null;
            $shippingDate = ($i_sdate !== -1 && isset($rowData[$i_sdate])) ? formatExcelDate($rowData[$i_sdate]) : null;
            
            $orderStatus = ($i_ostatus !== -1 && isset($rowData[$i_ostatus])) ? trim((string)$rowData[$i_ostatus]) : '';
            $platform = ($i_platform !== -1 && isset($rowData[$i_platform])) ? trim((string)$rowData[$i_platform]) : '';
            $warehouse = ($i_warehouse !== -1 && isset($rowData[$i_warehouse])) ? trim((string)$rowData[$i_warehouse]) : '';
            $trackingNumber = ($i_tracking !== -1 && isset($rowData[$i_tracking])) ? trim((string)$rowData[$i_tracking]) : '';
            $status = ($i_status !== -1 && isset($rowData[$i_status])) ? trim((string)$rowData[$i_status]) : '';

            $orders[] = [
                'product_code' => $sku,
                'product_name' => $productName,
                'variant_code' => $variantCode,
                'variant_name' => $variantName,
                'internal_order_id' => $internalOrderId,
                'online_order_id' => $onlineOrderId,
                'quantity' => $qty,
                'total_price' => $price,
                'order_date' => $orderDate,
                'shipping_date' => $shippingDate,
                'order_status' => $orderStatus,
                'platform' => $platform,
                'store_name' => $storeName,
                'warehouse' => $warehouse,
                'tracking_number' => $trackingNumber,
                'status' => $status
            ];

            if ($sku !== '') $allProductCodes[$sku] = true;
            if ($storeName !== '') $allStoreKeys[$storeName] = $platform;
        }
    }
    $reader->close();
    $zip->close();

    if (empty($orders)) {
        echo json_encode(["success" => false, "error" => "ไม่พบข้อมูลแถวในไฟล์ Excel"]);
        exit;
    }

    // ========== PHASE 2: Validate product codes ==========
    $unknownProducts = []; 
    if (!empty($allProductCodes)) {
        $stmt = $conn->prepare("
            SELECT sku FROM products WHERE company_id = ?
            UNION
            SELECT sku FROM promotions WHERE company_id = ?
        ");
        $stmt->execute([$companyId, $companyId]);
        $knownSkus = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            if (!empty($row['sku'])) {
                $knownSkus[$row['sku']] = true;
            }
        }

        foreach ($orders as $index => $row) {
            $code = trim($row['product_code']);
            if ($code !== '' && !isset($knownSkus[$code])) {
                if (!isset($unknownProducts[$code])) {
                    $unknownProducts[$code] = [];
                }
                $displayLine = $index + 2; 
                if (!in_array($displayLine, $unknownProducts[$code])) {
                    $unknownProducts[$code][] = $displayLine;
                }
            }
        }
    }

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
    $totalRows = count($orders);
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

    $conn->beginTransaction();
    foreach ($orders as $index => $row) {
        try {
            $stmtInsert->execute([
                $batchId, $row['product_code'], $row['product_name'], $row['variant_code'], $row['variant_name'],
                $row['internal_order_id'], $row['online_order_id'], $row['quantity'], $row['total_price'],
                $row['order_date'], $row['shipping_date'], $row['order_status'], $row['platform'], $row['store_name'],
                $row['warehouse'], $row['tracking_number'], $row['status'], $companyId
            ]);
            $imported++;
        } catch (Exception $e) {
            $skipped++;
            if (count($errors) < 5) $errors[] = "Row " . ($index + 2) . ": " . $e->getMessage();
        }
    }

    $stmtUpdate = $conn->prepare("UPDATE marketplace_import_batches SET imported_rows=?, skipped_rows=? WHERE id=?");
    $stmtUpdate->execute([$imported, $skipped, $batchId]);

    $conn->exec("
        UPDATE marketplace_sales_orders mso
        JOIN marketplace_stores ms ON TRIM(mso.store_name) = TRIM(ms.name) AND ms.company_id = mso.company_id
        SET mso.store_id = ms.id
        WHERE mso.batch_id = $batchId AND mso.store_id IS NULL
    ");

    $conn->commit();
    echo json_encode([
        "success" => true,
        "batch_id" => intval($batchId),
        "total_rows" => $totalRows,
        "imported_rows" => $imported,
        "skipped_rows" => $skipped,
        "errors" => $errors,
        "created_stores" => $createdStores,
    ]);

} catch (\Throwable $t) {
    if (isset($conn) && $conn->inTransaction()) {
        $conn->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        "success" => false, 
        "error" => "เซิร์ฟเวอร์เกิดข้อผิดพลาด: " . $t->getMessage(),
        "line" => $t->getLine(),
        "file" => basename($t->getFile())
    ]);
}
?>
