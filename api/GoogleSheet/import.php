<?php
/**
 * Google Sheet Import Script - แบบ Preview ก่อน Import
 * ดึงข้อมูลจาก Google Sheet, แสดงข้อมูลใหม่/เปลี่ยนแปลง, แล้วบันทึกเมื่อยืนยัน
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../Services/ShippingSyncService.php';

use Google\Client;
use Google\Service\Sheets;

/**
 * ดึงข้อมูลจาก Google Sheet และเปรียบเทียบกับ Database
 * คืนค่าข้อมูลที่พร้อม Preview
 */
function previewGoogleSheetData(PDO $pdo, ?string $startDate = null, ?string $endDate = null, bool $changesOnly = false): array {
    try {
        // 1. ตั้งค่า Google Client
        // WORKAROUND: Disable SSL Verification for Local Environment (Fix cURL Error 60)
        $httpClient = new \GuzzleHttp\Client(['verify' => false]);
        
        $client = new Client();
        $client->setHttpClient($httpClient);
        $client->setApplicationName('CRM_ERP Google Sheets Import');
        $client->setScopes([Sheets::SPREADSHEETS_READONLY]);
        $client->setAuthConfig(__DIR__ . '/../google-credentials.json');
        $client->setAccessType('offline');

        // 2. สร้าง Google Sheets Service
        $service = new Sheets($client);

        // 3. กำหนด Spreadsheet ID และ Range
        $spreadsheetId = '1cWmpAO3OHl4vBMSbHjgkDeZMaQaqauPha0w1VVcsEFA';
        $range = 'Sheet1!A:D';

        // 4. ดึงข้อมูลจาก Sheet
        $response = $service->spreadsheets_values->get($spreadsheetId, $range);
        $values = $response->getValues();

        if (empty($values)) {
            return ['ok' => false, 'message' => 'ไม่พบข้อมูลใน Google Sheet'];
        }

        // 5. ประมวลผลและจัดกลุ่มข้อมูล
        $newRecords = [];
        $changedRecords = [];
        $unchangedRecords = [];
        $errors = [];
        $dbCache = []; // Initialize cache for database records

        // ข้ามแถวแรก (header)
        for ($i = 1; $i < count($values); $i++) {
            $row = $values[$i];
            
            if (count($row) < 2) continue;

            $systemCreateTime = $row[0] ?? null;
            $orderNumber = $row[1] ?? null;
            $rawDeliveryDate = isset($row[2]) ? trim($row[2]) : null;
            // Strip trailing dash-number suffixes (e.g. "12/1/26-2" -> "12/1/26")
            $deliveryDate = $rawDeliveryDate ? preg_replace('/-\d+$/', '', $rawDeliveryDate) : null;
            $rawDeliveryStatus = isset($row[3]) ? $row[3] : null;
            $orderStatus = null;
            $deliveryStatus = null;

            if ($rawDeliveryStatus) {
                $parts = explode('|', $rawDeliveryStatus);
                if (count($parts) > 1) {
                    $orderStatus = trim($parts[0]);
                    $deliveryStatus = trim($parts[1]);
                } else {
                    // Fallback if no pipe separator
                    $deliveryStatus = trim($rawDeliveryStatus);
                }
            }

            if (empty($orderNumber) || empty($systemCreateTime)) continue;

            try {
                // แปลงวันที่
                $systemCreateTimeFormatted = convertDateTimeFormat($systemCreateTime);
                $deliveryDateFormatted = convertDateFormat($deliveryDate);

                // --- Filtering Logic ---
                if ($changesOnly) {
                    // ถ้าเลือก Changes Only จะต้องไปเช็ค DB ก่อนเสมอ เพื่อดูว่าเปลี่ยนไหม
                    // ดังนั้นไม่ข้าม Loop นี้
                } else if ($startDate || $endDate) {
                    // กรองตามช่วงวันที่ (System Created Time)
                    if (!$systemCreateTimeFormatted) continue; // วันที่ผิดพลาด ข้าม
                    
                    $sysTime = strtotime($systemCreateTimeFormatted);
                    if ($startDate && $sysTime < strtotime($startDate . ' 00:00:00')) continue;
                    if ($endDate && $sysTime > strtotime($endDate . ' 23:59:59')) continue;
                }
                // -----------------------

                // --- Pre-fetch Logic ---
                // เพื่อประสิทธิภาพและรองรับข้อมูลซ้ำ (Smart Matching) เราจะดึงข้อมูลที่เกี่ยวข้องมาเก็บไว้ใน Memory ก่อน
                // แต่เนื่องจากจำนวนอาจเยอะ เราจะดึงเฉพาะ Order Numbers ที่อยู่ใน Sheet นี้ (Chunking ถ้าจำเป็น)
                // เพื่อความง่ายใน Step นี้ เราจะ Query รายตัวแต่จัดการเรื่อง "Consumption" ใน Array
                // หมายเหตุ: การ Query ใน Loop อาจช้าหน่อยแต่แม่นยำที่สุดสำหรับ Logic นี้
                
                // ดึงรายการทั้งหมดใน DB ที่ตรงกับ Order นี้และ Time นี้
                // เราต้องดึงทั้งหมดออกมาเพื่อทำ Pool Matching
                if (!isset($dbCache[$orderNumber . '|' . $systemCreateTimeFormatted])) {
                    $stmt = $pdo->prepare('
                        SELECT * FROM google_sheet_shipping 
                        WHERE order_number = ? AND system_created_time = ?
                        ORDER BY id ASC
                    ');
                    $stmt->execute([$orderNumber, $systemCreateTimeFormatted]);
                    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    
                    // เก็บลง Cache โดยใช้ Key เป็น Order|Time
                    // Value เป็น Array ของ Records ซึ่งเราจะค่อยๆ "หยิบออก" (Consume) เมื่อจับคู่ได้
                    $dbCache[$orderNumber . '|' . $systemCreateTimeFormatted] = $rows;
                }
                
                // ดึง Pool ของ Order|Time นี้ออกมา
                $pool = &$dbCache[$orderNumber . '|' . $systemCreateTimeFormatted];
                
                $matchedDbRecord = null;
                $matchType = 'none'; // 'exact', 'loose', 'none'

                // Strategy 1: หาตัวที่เหมือนกันเป๊ะๆ ก่อน (Exact Match)
                foreach ($pool as $key => $dbRow) {
                    if ($dbRow['delivery_date'] == $deliveryDateFormatted && 
                        $dbRow['delivery_status'] == $deliveryStatus &&
                        (isset($dbRow['order_status']) ? $dbRow['order_status'] : null) == $orderStatus) {
                        $matchedDbRecord = $dbRow;
                        $matchType = 'exact';
                        unset($pool[$key]); // Consume: หยิบออกเพื่อไม่ให้แถวอื่นใน Sheet มาจับคู่ตัวนี้ซ้ำ
                        break;
                    }
                }

                // Strategy 2: ถ้าไม่เจอเป๊ะๆ ให้เอาตัวที่ว่างอยู่ (Loose Match) -> ถือว่าเป็นตัวเดิมแต่มีการ Update
                if (!$matchedDbRecord && count($pool) > 0) {
                    // หยิบตัวแรกที่เหลืออยู่
                    $key = array_key_first($pool);
                    $matchedDbRecord = $pool[$key];
                    $matchType = 'loose';
                    unset($pool[$key]); // Consume
                }

                $record = [
                    'system_created_time' => $systemCreateTimeFormatted,
                    'order_number' => $orderNumber,
                    'delivery_date' => $deliveryDateFormatted,
                    'delivery_status' => $deliveryStatus,
                    'order_status' => $orderStatus,
                    'row_index' => $i + 1
                ];

                if (!$matchedDbRecord) {
                    // ไม่เจอใน DB เลย (หรือหมด Pool แล้ว) -> New Record
                    if (!$changesOnly) {
                        $record['action'] = 'insert';
                        $newRecords[] = $record;
                    }
                } else {
                    // เจอคู่ใน DB
                    if ($matchType === 'exact') {
                        // ข้อมูลเหมือนเดิมเป๊ะ
                         if (!$changesOnly) { // ถ้า Changes Only ไม่เอา Unchanged
                            $record['action'] = 'skip';
                            $unchangedRecords[] = $record;
                        }
                    } else {
                        // ข้อมูลไม่เหมือนกัน (Update)
                        $hasChanges = false;
                         $changes = [];

                        // เช็ควันที่จัดส่ง
                        if ($matchedDbRecord['delivery_date'] != $deliveryDateFormatted) {
                            $hasChanges = true;
                            $changes['delivery_date'] = [
                                'old' => $matchedDbRecord['delivery_date'],
                                'new' => $deliveryDateFormatted
                            ];
                        }

                        // เช็คสถานะจัดส่ง
                        if ($matchedDbRecord['delivery_status'] != $deliveryStatus) {
                            $hasChanges = true;
                            $changes['delivery_status'] = [
                                'old' => $matchedDbRecord['delivery_status'],
                                'new' => $deliveryStatus
                            ];
                        }

                        // เช็คสถานะคำสั่งซื้อ (Official)
                        $dbOrderStatus = isset($matchedDbRecord['order_status']) ? $matchedDbRecord['order_status'] : null;
                        if ($dbOrderStatus != $orderStatus) {
                            $hasChanges = true;
                            $changes['order_status'] = [
                                'old' => $dbOrderStatus,
                                'new' => $orderStatus
                            ];
                        }
                        
                        if ($hasChanges) {
                            $record['action'] = 'update';
                            $record['changes'] = $changes;
                            $record['id'] = $matchedDbRecord['id']; // Important: Use ID from the matched DB record
                            $changedRecords[] = $record;
                        } else {
                            // กรณีที่ Loose Match แต่มันดันเหมือนกัน (ไม่น่าเกิดถ้า Logic ถูก แต่กันเหนียว)
                             $record['action'] = 'skip';
                             $unchangedRecords[] = $record;
                        }
                    }
                }
                
            } catch (Throwable $e) {
                $errors[] = "Row {$i}: " . $e->getMessage();
            }
        }

        // กรองข้อมูล Unchanged
        $unchangedCount = count($unchangedRecords);
        $unchangedRecords = [];

        return [
            'ok' => true,
            'preview' => [
                'new' => $newRecords,
                'changed' => $changedRecords,
                'unchanged' => $unchangedRecords
            ],
            'summary' => [
                'new_count' => count($newRecords),
                'changed_count' => count($changedRecords),
                'unchanged_count' => $unchangedCount,
                'total_rows' => count($values) - 1,
                'filter_info' => [
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'changes_only' => $changesOnly
                ]
            ],
            'errors' => $errors
        ];

    } catch (Throwable $e) {
        return [
            'ok' => false,
            'error' => 'PREVIEW_FAILED',
            'message' => $e->getMessage()
        ];
    }
}

/**
 * บันทึกข้อมูลจาก Preview ลงฐานข้อมูล
 */
function confirmImportGoogleSheetData(PDO $pdo, array $recordsToImport): array {
    try {
        $pdo->beginTransaction();

        $inserted = 0;
        $updated = 0;
        $errors = [];

        foreach ($recordsToImport as $record) {
            try {
                if ($record['action'] === 'insert') {
                    // ไม่ใช้ row_index แล้ว ใช้ auto-increment id
                    $stmt = $pdo->prepare('
                        INSERT INTO google_sheet_shipping 
                        (system_created_time, order_number, delivery_date, delivery_status, order_status)
                        VALUES (?, ?, ?, ?, ?)
                    ');
                    $stmt->execute([
                        $record['system_created_time'],
                        $record['order_number'],
                        $record['delivery_date'],
                        $record['delivery_status'],
                        $record['order_status']
                    ]);
                    $inserted++;
                } elseif ($record['action'] === 'update') {
                    // Update โดยใช้ ID ที่ระบุมาจาก Preview (แม่นยำที่สุด)
                    if (!empty($record['id'])) {
                        $stmt = $pdo->prepare('
                            UPDATE google_sheet_shipping 
                            SET delivery_date = ?, delivery_status = ?, order_status = ?, updated_at = NOW()
                            WHERE id = ?
                        ');
                        $stmt->execute([
                            $record['delivery_date'],
                            $record['delivery_status'],
                            $record['order_status'],
                            $record['id']
                        ]);
                        $updated++;
                    } else {
                        $errors[] = "Order {$record['order_number']}: Missing ID for update";
                    }
                }
            } catch (Throwable $e) {
                $errors[] = "Order {$record['order_number']}: " . $e->getMessage();
            }
        }

        $pdo->commit();

        // --- Auto-Sync Orders with Imported/Updated Data ---
        try {
            $syncService = new ShippingSyncService($pdo);
            // $recordsToImport contains the data we just saved.
            // We can pass it directly to syncFromSheetImport which iterates and syncs.
            $syncResult = $syncService->syncFromSheetImport($recordsToImport);
            
            // Optionally log or add to result
            // $errors could be appended if sync failed, but we probably shouldn't fail the whole import response
            if (!empty($syncResult['details'])) {
                 // Maybe add a note about synced orders? 
                 // For now, we prefer silent success or error logging.
            }
        } catch (Throwable $syncErr) {
            error_log("Post-Import Sync Failed: " . $syncErr->getMessage());
        }
        // ---------------------------------------------------

        return [
            'ok' => true,
            'inserted' => $inserted,
            'updated' => $updated,
            'errors' => $errors
        ];

    } catch (Throwable $e) {
        $pdo->rollBack();
        return [
            'ok' => false,
            'error' => 'IMPORT_FAILED',
            'message' => $e->getMessage()
        ];
    }
}

function convertDateTimeFormat(?string $dateString): ?string {
    if (empty($dateString)) return null;
    
    $formats = ['Y-m-d H:i:s', 'Y-m-d', 'd/m/Y H:i:s', 'd/m/Y', 'd-m-Y', 'm/d/Y', 'Y/m/d H:i:s', 'Y/m/d H:i', 'Y/m/d'];
    
    foreach ($formats as $format) {
        $date = DateTime::createFromFormat($format, $dateString);
        if ($date !== false) {
            return $date->format('Y-m-d H:i:s');
        }
    }
    
    return null;
}

function convertDateFormat(?string $dateString): ?string {
    if (empty($dateString)) return null;
    
    $formats = ['Y-m-d', 'd/m/Y', 'd-m-Y', 'm/d/Y', 'Y/m/d'];
    
    foreach ($formats as $format) {
        $date = DateTime::createFromFormat($format, $dateString);
        if ($date !== false) {
            return $date->format('Y-m-d');
        }
    }
    
    return null;
}

// HTTP Endpoint
if (php_sapi_name() !== 'cli' && !defined('DO_NOT_RUN_IMPORT')) {
    // Catch Fatal Errors
    register_shutdown_function(function() {
        $error = error_get_last();
        if ($error && ($error['type'] === E_ERROR || $error['type'] === E_PARSE || $error['type'] === E_COMPILE_ERROR)) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['ok' => false, 'error' => 'FATAL_ERROR', 'message' => $error['message'], 'file' => $error['file'], 'line' => $error['line']]);
        }
    });

    try {
        cors();
        $pdo = db_connect();
        validate_auth($pdo);
        
        $requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        
        if ($requestMethod === 'GET') {
            // Get Filters
            $startDate = $_GET['start_date'] ?? null;
            $endDate = $_GET['end_date'] ?? null;
            $changesOnly = filter_var($_GET['changes_only'] ?? false, FILTER_VALIDATE_BOOLEAN);

            // Preview data
            $result = previewGoogleSheetData($pdo, $startDate, $endDate, $changesOnly);
            json_response($result);
        } elseif ($requestMethod === 'POST') {
            // Confirm import
            $input = json_input();
            $recordsToImport = $input['records'] ?? [];
            
            if (empty($recordsToImport)) {
                json_response(['ok' => false, 'error' => 'NO_RECORDS'], 400);
                return;
            }
            
            $result = confirmImportGoogleSheetData($pdo, $recordsToImport);
            json_response($result);
        } else {
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
        }
    } catch (Throwable $e) {
        json_response(['ok' => false, 'error' => 'INTERNAL_ERROR', 'message' => $e->getMessage(), 'trace' => $e->getTraceAsString()], 500);
    }
}
