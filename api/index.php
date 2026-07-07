<?php
require_once __DIR__ . '/core/bootstrap.php';
try {
    switch ($resource) {
        case 'distribution_movement':
            require_once __DIR__ . '/Controllers/DistributionReportController.php';
            if ($id === 'stats') {
                DistributionReportController::get_movement_stats($pdo);
            } else if ($id === 'ledger') {
                DistributionReportController::get_movement_ledger($pdo);
            } else if ($id === 'monthly_summary') {
                DistributionReportController::get_monthly_summary($pdo);
            } else if ($id === 'time_travel') {
                DistributionReportController::get_time_travel_snapshot($pdo);
            }
            break;
        case 'system_updates':
            require_once __DIR__ . '/Controllers/SystemUpdateController.php';
            handle_system_updates($pdo, $id);
            break;
        case 'shopee_loyalty':
            require_once __DIR__ . '/shopee_loyalty.php';
            handle_shopee_loyalty($pdo, $id, $action);
            break;
        case 'auth':
            handle_auth($pdo, $id);
            break;
        case 'tags':
            handle_tags($pdo, $id);
            break;
        case 'customer_tags':
            handle_customer_tags($pdo);
            break;
        case 'companies':
            handle_companies($pdo, $id);
            break;
        case 'company_settings':
            handle_company_settings($pdo, $id);
            break;
        case 'roles':
            require_once __DIR__ . '/roles.php';
            handle_roles($pdo, $id, $action);
            break;
        case 'tab_rules':
            require_once __DIR__ . '/Order_DB/tab_rules.php';
            break;
        case 'user_permissions':
            handle_user_permissions($pdo, $id, $action);
            break;
        case 'permissions':
            handle_permissions($pdo);
            break;
        case 'users':
            require_once __DIR__ . '/Controllers/UserController.php';
            $subAction = $parts[3] ?? null;
            handle_users($pdo, $id, $action, $subAction);
            break;
        case 'customer_blocks':
            handle_customer_blocks($pdo, $id);
            break;
        case 'customers':
            try {
                require_once __DIR__ . '/Controllers/CustomerController.php';
                handle_customers($pdo, $id);
            } catch (Throwable $e) {
                file_put_contents(__DIR__ . '/customers_error.log', date('Y-m-d H:i:s') . " CUSTOMERS FATAL: " . $e->getMessage() . "\nFile: " . $e->getFile() . ":" . $e->getLine() . "\n" . $e->getTraceAsString() . "\n\n", FILE_APPEND);
                json_response(['error' => 'INTERNAL_ERROR', 'message' => $e->getMessage(), 'file' => basename($e->getFile()), 'line' => $e->getLine()], 500);
            }
            break;
        case 'products':
            require_once __DIR__ . '/Controllers/ProductController.php';
            handle_products($pdo, $id);
            break;
        case 'returned_orders_report':
            require_once __DIR__ . '/Services/ReturnedOrdersReportService.php';
            $svc = new ReturnedOrdersReportService($pdo);
            if (method() === 'GET') {
                $startDate = $_GET['start_date'] ?? '';
                $endDate = $_GET['end_date'] ?? '';
                $userId = !empty($_GET['user_id']) ? (int)$_GET['user_id'] : null;
                $companyId = !empty($_GET['company_id']) ? (int)$_GET['company_id'] : null;
                // Default to company 1 if not set (or adapt based on auth)
                if (!$companyId) {
                    $authUser = get_authenticated_user($pdo);
                    $companyId = $authUser['company_id'] ?? 1;
                }
                $statusType = $_GET['status_type'] ?? 'Returned';
                $resolutionStatus = $_GET['resolution_status'] ?? 'All';
                try {
                    $data = $svc->getReportData($startDate, $endDate, $userId, $companyId, $statusType, $resolutionStatus);
                    json_response(['ok' => true, 'message' => 'Success', 'data' => $data]);
                } catch (Exception $e) {
                    json_response(['ok' => false, 'message' => $e->getMessage()], 400);
                }
            } elseif (method() === 'POST' && $id === 'auto-match') {
                $input = json_input();
                $orderId = $input['order_id'] ?? '';
                $authUser = get_authenticated_user($pdo);
                $uId = $authUser ? ($authUser['id'] ?? 0) : 0;
                $res = $svc->autoMatchAudio($orderId, $uId);
                json_response(['ok' => true, 'message' => $res['message'], 'data' => $res]);
            } elseif (method() === 'POST' && $id === 'manual-audio') {
                $input = json_input();
                $orderId = $input['order_id'] ?? '';
                $audioUrl = $input['audio_url'] ?? '';
                $audioDate = !empty($input['audio_date']) ? $input['audio_date'] : null;
                $notes = !empty($input['notes']) ? $input['notes'] : null;
                $authUser = get_authenticated_user($pdo);
                $uId = $authUser ? ($authUser['id'] ?? 0) : 0;
                $success = $svc->saveManualAudioLink($orderId, $audioUrl, $uId, $audioDate, $notes);
                json_response(['ok' => $success, 'message' => $success ? 'Saved successfully' : 'Failed or already exists']);
            } elseif (method() === 'POST' && $id === 'summary') {
                $input = json_input();
                $orderId = $input['order_id'] ?? '';
                $summary = $input['summary'] ?? '';
                $success = $svc->saveOrderSummary($orderId, $summary);
                json_response(['ok' => $success, 'message' => $success ? 'Saved successfully' : 'Failed to save summary']);
            } elseif (method() === 'POST' && $id === 'audio-notes') {
                $input = json_input();
                $audioId = !empty($input['id']) ? (int)$input['id'] : 0;
                $notes = $input['notes'] ?? '';
                if ($audioId) {
                    $success = $svc->updateAudioNotes($audioId, $notes);
                    json_response(['ok' => $success, 'message' => $success ? 'Saved successfully' : 'Failed']);
                }
                json_response(['ok' => false, 'message' => 'Invalid ID'], 400);
            } elseif (method() === 'POST' && $id === 'toggle-completed') {
                $input = json_input();
                $orderId = $input['order_id'] ?? '';
                $isCompleted = isset($input['is_completed']) ? (int)$input['is_completed'] : 0;
                $success = $svc->toggleOrderResolutionComplete($orderId, $isCompleted);
                json_response(['ok' => $success, 'message' => $success ? 'Updated status successfully' : 'Failed to update status']);
            } elseif (method() === 'POST' && $id === 'update-details') {
                $input = json_input();
                $orderId = $input['order_id'] ?? '';
                $summaryNotes = isset($input['admin_resolution_notes']) ? $input['admin_resolution_notes'] : null;
                $newAudioLinks = $input['new_audio_links'] ?? [];
                $updatedAudioLinks = $input['updated_audio_links'] ?? [];
                $deletedAudioIds = $input['deleted_audio_ids'] ?? [];
                
                $authUser = get_authenticated_user($pdo);
                $uId = $authUser ? ($authUser['id'] ?? 0) : 0;
                
                if (!$orderId) {
                    json_response(['ok' => false, 'message' => 'Missing order_id'], 400);
                }
                
                $success = $svc->updateOrderDetails($orderId, $summaryNotes, $newAudioLinks, $updatedAudioLinks, $deletedAudioIds, $uId);
                json_response(['ok' => $success, 'message' => $success ? 'Updated details successfully' : 'Failed to update details']);
            }
            break;
        case 'promotions':
            require_once __DIR__ . '/Controllers/PromotionController.php';
            handle_promotions($pdo, $id);
            break;
        case 'price_announcements':
            require_once __DIR__ . '/Controllers/PriceAnnouncementController.php';
            handle_price_announcements($pdo, $id);
            break;
        case 'price_announcement_images':
            require_once __DIR__ . '/Controllers/PriceAnnouncementController.php';
            handle_price_announcement_image_upload($pdo);
            break;
        case 'finance_approval_counts':
            require_once __DIR__ . '/Controllers/PromotionController.php';
            handle_finance_approval_counts($pdo);
            break;
        case 'validate_cod_tracking':
            if (method() === 'POST') {
                // SECURITY: Get authenticated user's company_id
                $authUser = get_authenticated_user($pdo);
                $companyId = $authUser ? ($authUser['company_id'] ?? null) : null;
                if (!$companyId) {
                    json_response(['error' => 'UNAUTHORIZED', 'message' => 'Company not found'], 401);
                }

                $input = json_decode(file_get_contents('php://input'), true);
                $items = $input['items'] ?? [];
                if (empty($items)) {
                    json_response(['results' => []]);
                }

                // Extract Unique Normalized Tracking Numbers
                $trackingMap = []; // normalized -> original
                foreach ($items as $item) {
                    $raw = $item['trackingNumber'] ?? '';
                    $clean = preg_replace('/\s+/', '', strtolower($raw));
                    if ($clean) {
                        $trackingMap[$clean] = $raw;
                    }
                }

                if (empty($trackingMap)) {
                    json_response(['results' => []]);
                    return;
                }

                $trackingsToCheck = array_values(array_map('strval', array_keys($trackingMap)));
                $placeholders = str_repeat('?,', count($trackingsToCheck) - 1) . '?';

                // Debug: Log normalized tracking numbers we're searching for
                error_log("[validate_cod_tracking] Input tracking numbers to search: " . json_encode($trackingsToCheck));

                // 1. Find Tracking Records
                // We join with orders to get main order info immediately
                // We also select order_tracking_numbers info to help find boxes
                // FIX: Use LOWER(REPLACE()) to normalize DB values for case-insensitive matching
                $sql = "SELECT 
                        t.tracking_number, 
                        t.parent_order_id, 
                        t.order_id as track_order_id, 
                        t.box_number as track_box_number,
                        o.cod_amount as order_cod_amount,
                        o.total_amount as order_total_amount,
                        o.amount_paid,
                        o.payment_status
                    FROM order_tracking_numbers t
                    JOIN orders o ON t.parent_order_id = o.id
                    WHERE LOWER(REPLACE(REPLACE(t.tracking_number, ' ', ''), '\t', '')) IN ($placeholders)
                      AND o.company_id = ?";

                $trackingsWithCompany = array_merge($trackingsToCheck, [$companyId]);

                // Debug: Log the SQL query
                error_log("[validate_cod_tracking] SQL: " . $sql);

                // Note: This applies LOWER() and REPLACE() to normalize DB data for comparison
                // The $trackingsToCheck array contains already-normalized (lowercase, no whitespace) values

                $stmt = $pdo->prepare($sql);
                $stmt->execute($trackingsWithCompany);
                $trackingRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

                // Debug: Log raw result
                error_log("[validate_cod_tracking] Raw SQL result count: " . count($trackingRows));
                if (count($trackingRows) > 0) {
                    error_log("[validate_cod_tracking] First row: " . json_encode($trackingRows[0]));
                }

                // Debug: Also try a simpler query without JOIN to see if the issue is the JOIN
                $debugSql = "SELECT tracking_number, parent_order_id FROM order_tracking_numbers WHERE tracking_number = ? LIMIT 1";
                $debugStmt = $pdo->prepare($debugSql);
                $debugStmt->execute([reset($trackingMap)]); // Use first original tracking
                $debugRow = $debugStmt->fetch(PDO::FETCH_ASSOC);
                error_log("[validate_cod_tracking] Debug direct query result: " . json_encode($debugRow));

                // 2. Resolve sub-order / box details
                // We need to query order_boxes for the found parent_order_ids to find specific cod amounts
                $parentIds = array_unique(array_column($trackingRows, 'parent_order_id'));
                $boxesByParent = [];

                if (!empty($parentIds)) {
                    $parentIds = array_values($parentIds); // Re-index for PDO
                    $pPlaceholders = str_repeat('?,', count($parentIds) - 1) . '?';
                    $boxSql = "SELECT order_id, sub_order_id, box_number, cod_amount, collection_amount, collected_amount, status, return_status 
                           FROM order_boxes 
                           WHERE order_id IN ($pPlaceholders)";
                    $bStmt = $pdo->prepare($boxSql);
                    $bStmt->execute($parentIds);
                    $boxes = $bStmt->fetchAll(PDO::FETCH_ASSOC);

                    foreach ($boxes as $b) {
                        $pid = $b['order_id'];
                        $boxesByParent[$pid][] = $b;
                    }
                }

                // 2.4b Query order_slips to get total slip payments per order
                $slipsByParent = [];
                if (!empty($parentIds)) {
                    $slipSql = "SELECT order_id, COALESCE(SUM(amount), 0) as total_slip_amount 
                               FROM order_slips 
                               WHERE order_id IN ($pPlaceholders) 
                               GROUP BY order_id";
                    $slipStmt = $pdo->prepare($slipSql);
                    $slipStmt->execute($parentIds);
                    while ($slipRow = $slipStmt->fetch(PDO::FETCH_ASSOC)) {
                        $slipsByParent[$slipRow['order_id']] = (float) $slipRow['total_slip_amount'];
                    }
                }

                // 2.4c Query freebie items per order (ของแถม)
                $freebiesByParent = [];
                if (!empty($parentIds)) {
                    $freebieSql = "SELECT parent_order_id, 
                                   COUNT(*) as freebie_count,
                                   COALESCE(SUM(quantity * price_per_unit), 0) as freebie_value
                                  FROM order_items 
                                  WHERE parent_order_id IN ($pPlaceholders) AND is_freebie = 1
                                  GROUP BY parent_order_id";
                    $freebieStmt = $pdo->prepare($freebieSql);
                    $freebieStmt->execute($parentIds);
                    while ($fr = $freebieStmt->fetch(PDO::FETCH_ASSOC)) {
                        $freebiesByParent[$fr['parent_order_id']] = [
                            'count' => (int) $fr['freebie_count'],
                            'value' => (float) $fr['freebie_value'],
                        ];
                    }
                }

                // 2.5 Count how many trackings map to each box (parentId + boxNumber)
                $trackingsPerBox = [];
                foreach ($trackingRows as $tr) {
                    $boxKey = $tr['parent_order_id'] . '-' . ($tr['track_box_number'] ?? 'null');
                    if (!isset($trackingsPerBox[$boxKey])) {
                        $trackingsPerBox[$boxKey] = 0;
                    }
                    $trackingsPerBox[$boxKey]++;
                }

                $results = [];

                // Debug: Log what we're searching for
                error_log("[validate_cod_tracking] Searching for " . count($trackingsToCheck) . " tracking numbers");
                error_log("[validate_cod_tracking] Found " . count($trackingRows) . " matches in order_tracking_numbers");

                // Map back to inputs
                // We iterate strict normalized inputs ensuring we cover all requested
                foreach ($trackingMap as $normalized => $original) {
                    // Find matching DB row (Case insensitive)
                    // FIX: Cast $normalized to string because PHP converts numeric string keys to integers
                    $normalizedStr = (string) $normalized;
                    $match = null;
                    foreach ($trackingRows as $tr) {
                        $dbNormalized = preg_replace('/\s+/', '', strtolower($tr['tracking_number']));
                        if ($dbNormalized === $normalizedStr) {
                            $match = $tr;
                            break;
                        }
                    }

                    if (!$match) {
                        error_log("[validate_cod_tracking] Tracking '$original' NOT FOUND in order_tracking_numbers table");
                        $results[] = [
                            'trackingNumber' => $original,
                            'status' => 'pending',
                            'message' => 'ไม่พบ Tracking',
                            'orderId' => null,
                            'expectedAmount' => 0,
                            'difference' => 0
                        ];
                        continue;
                    }

                    // Logic to find expected amount
                    $parentId = $match['parent_order_id'];
                    $trackOrderId = $match['track_order_id']; // might be sub_order_id
                    $trackBoxNum = $match['track_box_number'];

                    $orderFallbackAmount = ($match['order_cod_amount'] > 0) ? $match['order_cod_amount'] : $match['order_total_amount'];
                    $expectedAmount = (float) $orderFallbackAmount;
                    $resolvedOrderId = $trackOrderId ?: $parentId; // Prefer sub, else parent
                    $multipleTrackingsInBox = false;

                    // Try finding specific box
                    $boxes = $boxesByParent[$parentId] ?? [];
                    $foundBox = null;

                    // Priority 1: Match by box_number (User Request: Link via box_number)
                    if ($trackBoxNum !== null) {
                        foreach ($boxes as $bx) {
                            if ((int) $bx['box_number'] === (int) $trackBoxNum) {
                                $foundBox = $bx;
                                break;
                            }
                        }
                    }

                    // Priority 2: Match by sub_order_id (Fallback)
                    if (!$foundBox && $trackOrderId) {
                        foreach ($boxes as $bx) {
                            if (strcasecmp($bx['sub_order_id'] ?? '', $trackOrderId) === 0) {
                                $foundBox = $bx;
                                break;
                            }
                        }
                    }

                    if ($foundBox) {
                        $boxAmt = (float) ($foundBox['collection_amount'] > 0 ? $foundBox['collection_amount'] : $foundBox['cod_amount']);

                        if (!empty($foundBox['sub_order_id'])) {
                            $resolvedOrderId = $foundBox['sub_order_id'];
                        }

                        // Check if multiple trackings share this same box
                        $boxKey = $parentId . '-' . ($trackBoxNum ?? 'null');
                        $trackingCountInBox = $trackingsPerBox[$boxKey] ?? 1;

                        if ($trackingCountInBox > 1) {
                            // Multiple trackings in same box — return full box total
                            // Frontend validates: cod_amount must be 1..boxTotal
                            $expectedAmount = $boxAmt;
                            $multipleTrackingsInBox = true;
                        } else {
                            // Single tracking in box — box amount is authoritative
                            $expectedAmount = $boxAmt;
                        }
                    }

                    $freebieInfo = $freebiesByParent[$parentId] ?? null;
                    $isBoxReturned = $foundBox ? ($foundBox['status'] === 'RETURNED' || !empty($foundBox['return_status'])) : false;
                    $results[] = [
                        'trackingNumber' => $original,
                        'status' => 'found',
                        'orderId' => $resolvedOrderId,
                        'parentOrderId' => $parentId,
                        'expectedAmount' => $expectedAmount,
                        'amountPaid' => (float) $match['amount_paid'],
                        'boxCollectedAmount' => $foundBox ? (float) ($foundBox['collected_amount'] ?? 0) : 0,
                        'totalSlipAmount' => $slipsByParent[$parentId] ?? 0,
                        'message' => $multipleTrackingsInBox ? 'ตรวจสอบแล้ว (หลาย tracking ใน box เดียวกัน)' : 'ตรวจสอบแล้ว',
                        'multipleTrackingsInBox' => $multipleTrackingsInBox,
                        'hasFreebie' => $freebieInfo ? true : false,
                        'freebieValue' => $freebieInfo ? $freebieInfo['value'] : 0,
                        'freebieCount' => $freebieInfo ? $freebieInfo['count'] : 0,
                        'isBoxReturned' => $isBoxReturned,
                    ];
                }

                json_response(['results' => $results]);
            }
            break;

        case 'Orders':
        case 'orders':
            require_once __DIR__ . '/Controllers/OrderController.php';
            handle_orders($pdo, $id);
            break;
        case 'order_counts':
            require_once __DIR__ . '/Orders/get_order_counts.php';
            handle_order_counts($pdo);
            break;

        case 'accounting_orders_sent':
            require_once __DIR__ . '/Accounting/sent_orders.php';
            handle_sent_orders($pdo);
            break;
        case 'accounting_orders_approved':
            require_once __DIR__ . '/Accounting/approved_orders.php';
            handle_approved_orders($pdo);
            break;

        case 'accounting_statement_report':
            require_once __DIR__ . '/Accounting/statement_report.php';
            handle_statement_report($pdo);
            break;

        case 'accounting_dashboard_stats':
            require_once __DIR__ . '/Accounting/dashboard_stats.php';
            handle_dashboard_stats($pdo);
            break;

        case 'accounting_outstanding_orders':
            require_once __DIR__ . '/Accounting/outstanding_orders.php';
            handle_outstanding_orders($pdo);
            break;

        case 'accounting_update_order_status':
            require_once __DIR__ . '/Orders/update_order_status.php';
            handle_update_order_status($pdo);
            break;
        case 'accounting_revenue_recognition':
            require_once __DIR__ . '/Accounting/get_revenue_recognition.php';
            handle_revenue_recognition($pdo);
            break;
        case 'upsell':
            handle_upsell($pdo, $id, $action);
            break;
        case 'user_pancake_mappings':
            handle_user_pancake_mappings($pdo, $id);
            break;
        case 'pages':
            require_once __DIR__ . '/Controllers/PageController.php';
            handle_pages($pdo, $id);
            break;
        case 'platforms':
            require_once __DIR__ . '/Controllers/PlatformController.php';
            handle_platforms($pdo, $id);
            break;
        case 'bank_accounts':
            require_once __DIR__ . '/Controllers/FinanceController.php';
            handle_bank_accounts($pdo, $id);
            break;
        case 'warehouses':
            handle_warehouses($pdo, $id);
            break;
        case 'suppliers':
            handle_suppliers($pdo, $id);
            break;
        case 'purchases':
            handle_purchases($pdo, $id, $action);
            break;
        case 'warehouse_stocks':
            handle_warehouse_stocks($pdo, $id);
            break;
        case 'product_lots':
            handle_product_lots($pdo, $id);
            break;
        case 'stock_movements':
            handle_stock_movements($pdo, $id);
            break;
        case 'validate_tracking_bulk':
            handle_validate_tracking_bulk($pdo);
            break;
        case 'sync_tracking':
            handle_sync_tracking($pdo);
            break;
        case 'allocations':
            require_once __DIR__ . '/Controllers/OrderController.php';
            handle_allocations($pdo, $id, $action);
            break;
        case 'ad_spend':
            handle_ad_spend($pdo, $id);
            break;
        case 'appointments':
            require_once __DIR__ . '/Controllers/AppointmentController.php';
            handle_appointments($pdo, $id);
            break;
        case 'call_history':
            handle_calls($pdo, $id);
            break;
        case 'Statement_DB':
            // Safe inclusion of Statement_DB scripts
            $script = basename($id);
            if (file_exists(__DIR__ . '/Statement_DB/' . $script)) {
                require __DIR__ . '/Statement_DB/' . $script;
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Not Found', 'script' => $script]);
            }
            break;
        case 'cod_documents':
            handle_cod_documents($pdo, $id);
            break;
        case 'cod_records':
            handle_cod_records($pdo, $id);
            break;
        case 'activities':
            handle_activities($pdo, $id);
            break;
        case 'customer_logs':
            handle_customer_logs($pdo, $id);
            break;
        case 'do_dashboard':
            handle_do_dashboard($pdo);
            break;
        case 'upsell_orders':
            handle_upsell_orders($pdo);
            break;
        case 'exports':
            handle_exports($pdo, $id);
            break;
        case 'order_slips':
            handle_order_slips($pdo, $id);
            break;
        case 'uploads':
            // Handle static file serving for uploads (e.g., slips, price_images)
            if ($id === 'slips' && $action !== null) {
                handle_serve_slip_file($action);
            } elseif ($id === 'price_images' && $action !== null) {
                require_once __DIR__ . '/Controllers/PriceAnnouncementController.php';
                handle_serve_price_image($action);
            } else {
                json_response(['error' => 'NOT_FOUND'], 404);
            }
            break;
        case 'ownership':
            require_once __DIR__ . '/ownership_handler.php';
            handle_ownership($pdo, $id);
            break;
        case 'ai_priority':
            require_once __DIR__ . '/ai_priority.php';
            break;
        case 'update_customer_order_tracking.php':
            // Bridge to legacy script without changing frontend path
            require_once __DIR__ . '/update_customer_order_tracking.php';
            break;
        case 'user_login_history':
            handle_user_login_history($pdo, $id);
            break;
        case 'attendance':
            handle_attendance($pdo, $id, $action);
            break;
        case 'call_overview':
            handle_call_overview($pdo);
            break;
        case 'import_google_sheet':
            require_once __DIR__ . '/GoogleSheet/import.php';
            // import.php handles GET/POST internally
            exit;
            break;
        case 'notifications':
            // handled separately below to support nested actions like settings/get
            break;
        case 'jst_inventory':
            require_once __DIR__ . '/Services/JstErpService.php';
            $user = get_authenticated_user($pdo);
            if (!$user) {
                json_response(['error' => 'UNAUTHORIZED'], 401);
            }
            $isSuperAdmin = ($user['role'] === 'Super Admin' || $user['role'] === 'Developer');
            $companyId = isset($_GET['companyId']) && $isSuperAdmin ? (int)$_GET['companyId'] : (int)$user['company_id'];
            
            $service = new JstErpService($pdo, $companyId);
            $force = isset($_GET['force']) && $_GET['force'] === '1';
            if ($force) {
                try {
                    $service->syncInventoryToDb('Manual');
                } catch (Exception $e) {
                    json_response(['error' => 'SYNC_FAILED', 'message' => $e->getMessage()], 500);
                }
            }
            $result = $service->getInventoryPaginated($_GET);
            
                // Read sync info from database
            $envKey = 'JST_LAST_SYNC_INFO_' . $companyId;
            $stmtEnv = $pdo->prepare("SELECT `value` FROM env WHERE `key` = ?");
            $stmtEnv->execute([$envKey]);
            $syncInfoRow = $stmtEnv->fetchColumn();
            $syncInfo = $syncInfoRow ? json_decode($syncInfoRow, true) : ['time' => null, 'source' => 'Unknown'];
            $result['sync_info'] = $syncInfo;
            
            json_response(array_merge(['ok' => true], $result));
            break;
        case 'jst_sync_info':
            $user = get_authenticated_user($pdo);
            if (!$user) {
                json_response(['error' => 'UNAUTHORIZED'], 401);
            }
            $isSuperAdmin = ($user['role'] === 'Super Admin' || $user['role'] === 'Developer');
            $companyId = isset($_GET['companyId']) && $isSuperAdmin ? (int)$_GET['companyId'] : (int)$user['company_id'];
            
            $envKey = 'JST_LAST_SYNC_INFO_' . $companyId;
            $stmtEnv = $pdo->prepare("SELECT `value` FROM env WHERE `key` = ?");
            $stmtEnv->execute([$envKey]);
            $syncInfoRow = $stmtEnv->fetchColumn();
            $syncInfo = $syncInfoRow ? json_decode($syncInfoRow, true) : ['time' => null, 'source' => 'Unknown'];
            
            // Check if JST inventory should be shown
            $showEnvKey = 'SHOW_JST_INVENTORY_' . $companyId;
            $stmtShowEnv = $pdo->prepare("SELECT `value` FROM env WHERE `key` = ?");
            $stmtShowEnv->execute([$showEnvKey]);
            $showJstInventoryVal = $stmtShowEnv->fetchColumn();
            
            // Default to true if not set (or adjust as needed)
            // Considering true/false, 1/0
            $showJstInventory = true;
            if ($showJstInventoryVal !== false && $showJstInventoryVal !== null) {
                $valLower = strtolower(trim((string)$showJstInventoryVal));
                $showJstInventory = ($valLower === '1' || $valLower === 'true');
            }
            $syncInfo['show_inventory'] = $showJstInventory;
            
            json_response(['ok' => true, 'data' => $syncInfo]);
            break;
        case 'jst_inventory_logs':
            $user = get_authenticated_user($pdo);
            if (!$user) {
                json_response(['error' => 'UNAUTHORIZED'], 401);
            }
            $isSuperAdmin = ($user['role'] === 'Super Admin' || $user['role'] === 'Developer');
            if (!$isSuperAdmin && $user['is_system'] != 1) {
                 json_response(['error' => 'FORBIDDEN'], 403);
            }
            
            $logFile = __DIR__ . '/../storage/logs/cron_jst_sync_' . date('Y-m') . '.log';
            if (!file_exists($logFile)) {
                json_response(['ok' => true, 'logs' => []]);
            }
            // Read last 50 lines
            $lines = file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            $lastLines = $lines ? array_slice($lines, -50) : [];
            json_response(['ok' => true, 'logs' => array_values($lastLines)]);
            break;
        default:
            json_response(['ok' => false, 'error' => 'NOT_FOUND', 'path' => $parts], 404);
    }
} catch (Throwable $e) {
    error_log("API Error: " . $e->getMessage() . "\n" . $e->getTraceAsString());
    json_response(['ok' => false, 'error' => 'INTERNAL_ERROR', 'message' => $e->getMessage(), 'trace' => $e->getTraceAsString()], 500);
}

function ensure_user_pancake_mapping_table(PDO $pdo): void
{
    $pdo->exec('CREATE TABLE IF NOT EXISTS user_pancake_mapping (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_user INT NOT NULL,
        id_panake VARCHAR(191) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_user (id_user),
        UNIQUE KEY uniq_panake (id_panake),
        KEY idx_user (id_user),
        KEY idx_panake (id_panake),
        CONSTRAINT fk_upm_user FOREIGN KEY (id_user) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
}

function handle_user_pancake_mappings(PDO $pdo, ?string $id): void
{
    ensure_user_pancake_mapping_table($pdo);

    // Authenticate
    $user = get_authenticated_user($pdo);
    if (!$user) {
        json_response(['error' => 'UNAUTHORIZED'], 401);
    }

    switch (method()) {
        case 'GET':
            if ($id) {
                // Ensure the mapping belongs to a user in the same company
                $stmt = $pdo->prepare('SELECT m.* FROM user_pancake_mapping m 
                                       JOIN users u ON m.id_user = u.id 
                                       WHERE m.id = ? AND u.company_id = ?');
                $stmt->execute([$id, $user['company_id']]);
                $row = $stmt->fetch();
                $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            } else {
                $stmt = $pdo->prepare('SELECT m.* FROM user_pancake_mapping m 
                                       JOIN users u ON m.id_user = u.id 
                                       WHERE u.company_id = ? 
                                       ORDER BY m.created_at DESC');
                $stmt->execute([$user['company_id']]);
                json_response($stmt->fetchAll());
            }
            break;
        case 'POST':
            $in = json_input();
            $idUser = isset($in['id_user']) ? (int) $in['id_user'] : null;
            $idPanake = isset($in['id_panake']) ? (string) $in['id_panake'] : null;
            if (!$idUser || $idPanake === null || $idPanake === '') {
                json_response(['error' => 'VALIDATION_FAILED', 'message' => 'id_user and id_panake are required'], 400);
            }

            // Validate target user belongs to same company
            $checkUser = $pdo->prepare('SELECT company_id FROM users WHERE id = ?');
            $checkUser->execute([$idUser]);
            $targetUserCompany = $checkUser->fetchColumn();

            if ($targetUserCompany != $user['company_id']) {
                json_response(['error' => 'UNAUTHORIZED', 'message' => 'Cannot assign mapping to user from another company'], 403);
            }

            try {
                $sql = 'INSERT INTO user_pancake_mapping (id_user, id_panake) VALUES (?, ?) 
                        ON DUPLICATE KEY UPDATE id_panake = VALUES(id_panake), created_at = NOW()';
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$idUser, $idPanake]);
                $sel = $pdo->prepare('SELECT * FROM user_pancake_mapping WHERE id_user = ?');
                $sel->execute([$idUser]);
                json_response($sel->fetch(), 201);
            } catch (Throwable $e) {
                json_response(['error' => 'UPSERT_FAILED', 'message' => $e->getMessage()], 409);
            }
            break;
        case 'PUT':
        case 'PATCH':
            if (!$id)
                json_response(['error' => 'ID_REQUIRED'], 400);

            // Verify ownership of the mapping to be updated
            $checkMapping = $pdo->prepare('SELECT u.company_id FROM user_pancake_mapping m JOIN users u ON m.id_user = u.id WHERE m.id = ?');
            $checkMapping->execute([$id]);
            $mappingCompany = $checkMapping->fetchColumn();

            if (!$mappingCompany || $mappingCompany != $user['company_id']) {
                json_response(['error' => 'UNAUTHORIZED', 'message' => 'Mapping not found or access denied'], 403);
            }

            $in = json_input();
            $fields = [];
            $params = [];

            // If updating id_user, ensure new user is in same company
            if (array_key_exists('id_user', $in)) {
                $newIdUser = (int) $in['id_user'];
                $checkNewUser = $pdo->prepare('SELECT company_id FROM users WHERE id = ?');
                $checkNewUser->execute([$newIdUser]);
                if ($checkNewUser->fetchColumn() != $user['company_id']) {
                    json_response(['error' => 'UNAUTHORIZED', 'message' => 'Target user is not in your company'], 403);
                }
                $fields[] = 'id_user = ?';
                $params[] = $newIdUser;
            }

            if (array_key_exists('id_panake', $in)) {
                $fields[] = 'id_panake = ?';
                $params[] = (string) $in['id_panake'];
            }
            if (empty($fields))
                json_response(['ok' => true]);
            $sql = 'UPDATE user_pancake_mapping SET ' . implode(', ', $fields) . ', created_at = created_at WHERE id = ?';
            $params[] = (int) $id;
            try {
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                json_response(['error' => 'UPDATE_FAILED', 'message' => $e->getMessage()], 409);
            }
            break;
        case 'DELETE':
            if (!$id)
                json_response(['error' => 'ID_REQUIRED'], 400);

            // Verify ownership
            $checkMapping = $pdo->prepare('SELECT u.company_id FROM user_pancake_mapping m JOIN users u ON m.id_user = u.id WHERE m.id = ?');
            $checkMapping->execute([$id]);
            $mappingCompany = $checkMapping->fetchColumn();

            if (!$mappingCompany || $mappingCompany != $user['company_id']) {
                json_response(['error' => 'UNAUTHORIZED', 'message' => 'Mapping not found or access denied'], 403);
            }

            $stmt = $pdo->prepare('DELETE FROM user_pancake_mapping WHERE id = ?');
            $stmt->execute([(int) $id]);
            json_response(['ok' => true]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}
function handle_auth(PDO $pdo, ?string $id): void
{
    if ($id === 'login' && method() === 'POST') {
        $in = json_input();
        // Fallbacks for non-JSON posts
        if (!$in || !is_array($in)) {
            $in = [];
        }
        if (!isset($in['username']) && isset($_POST['username'])) {
            $in['username'] = $_POST['username'];
        }
        if (!isset($in['password']) && isset($_POST['password'])) {
            $in['password'] = $_POST['password'];
        }
        if (!isset($in['username']) && isset($_GET['username'])) {
            $in['username'] = $_GET['username'];
        }
        if (!isset($in['password']) && isset($_GET['password'])) {
            $in['password'] = $_GET['password'];
        }
        $username = $in['username'] ?? '';
        $password = $in['password'] ?? '';
        if ($username === '' || $password === '') {
            json_response(['ok' => false, 'error' => 'MISSING_CREDENTIALS'], 400);
        }

        // Check if user status is active and fetch is_system from roles
        $stmt = $pdo->prepare('SELECT u.id, u.username, u.password, u.first_name, u.last_name, u.email, u.phone, u.role, u.role_id, u.company_id, u.team_id, u.supervisor_id, u.status, r.is_system FROM users u LEFT JOIN roles r ON u.role = r.name WHERE u.username=? LIMIT 1');
        $stmt->execute([$username]);
        $u = $stmt->fetch();
        if (!$u)
            json_response(['ok' => false, 'error' => 'INVALID_CREDENTIALS'], 401);

        // Check if user is active
        if ($u['status'] !== 'active') {
            json_response(['ok' => false, 'error' => 'ACCOUNT_INACTIVE', 'message' => 'Your account is not active'], 401);
        }

        // Demo: plaintext password match (replace with hashing in production)
        if (!hash_equals((string) $u['password'], (string) $password)) {
            json_response(['ok' => false, 'error' => 'INVALID_CREDENTIALS'], 401);
        }

        // Update last login and increment login count
        try {
            $updateStmt = $pdo->prepare('UPDATE users SET last_login = NOW(), login_count = login_count + 1 WHERE id = ?');
            $updateStmt->execute([$u['id']]);

            // Generate Access Token
            $token = bin2hex(random_bytes(32));
            $expires = date('Y-m-d H:i:s', strtotime('+30 days'));
            $pdo->prepare('INSERT INTO user_tokens (user_id, token, expires_at) VALUES (?, ?, ?)')->execute([$u['id'], $token, $expires]);

            // Optionally record work login when explicitly requested
            $workLogin = isset($in['workLogin']) ? (bool) $in['workLogin'] : false;
            if ($workLogin) {
                $today = (new DateTime('now'))->format('Y-m-d');
                // Prevent duplicate login history rows for the same user/date
                $existsStmt = $pdo->prepare('SELECT id, login_time FROM user_login_history WHERE user_id = ? AND login_time >= ? AND login_time < DATE_ADD(?, INTERVAL 1 DAY) ORDER BY login_time ASC LIMIT 1');
                $existsStmt->execute([$u['id'], $today, $today]);
                $existing = $existsStmt->fetch();
                if ($existing) {
                    $loginHistoryId = (int) $existing['id'];
                    $loginHistoryTime = $existing['login_time'];
                } else {
                    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? null;
                    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;
                    $loginStmt = $pdo->prepare('INSERT INTO user_login_history (user_id, login_time, ip_address, user_agent) VALUES (?, NOW(), ?, ?)');
                    $loginStmt->execute([$u['id'], $ipAddress, $userAgent]);
                    $loginHistoryId = (int) $pdo->lastInsertId();
                    $loginHistoryTime = null;
                }

                // Keep daily attendance in sync when a login history already exists
                try {
                    $pdo->prepare('CALL sp_upsert_user_daily_attendance(?, ?)')->execute([$u['id'], $today]);
                } catch (Throwable $e) {
                    // Non-fatal: attendance will recompute on next check-in/list call
                }
            }
        } catch (Throwable $e) {
            // Log error but don't fail login
            error_log('Failed to update login info: ' . $e->getMessage());
        }

        unset($u['password']);
        $resp = ['ok' => true, 'user' => $u, 'token' => $token];
        if (isset($loginHistoryId)) {
            $resp['loginHistoryId'] = $loginHistoryId;
            if (isset($loginHistoryTime)) {
                $resp['loginTime'] = $loginHistoryTime;
            }
        }
        json_response($resp);
    }
    json_response(['error' => 'NOT_FOUND'], 404);
}



/**
 * Build dynamic customer search conditions
 * - Splits search term by space for name matching (ชื่อ นามสกุล)
 * - Normalizes phone numbers (strips leading 0)
 * - Searches: first_name, last_name, phone, customer_id, facebook_name, line_id
 * @return array ['conditions' => string[], 'params' => array]
 */
function build_customer_search_conditions(string $q, string $tableAlias = ''): array
{
    $conditions = [];
    $params = [];

    if ($q === '') {
        return ['conditions' => [], 'params' => []];
    }

    $prefix = $tableAlias ? "$tableAlias." : '';

    // Split by space for multiple term support (e.g., "สมชาย ใจดี")
    $terms = array_filter(array_map('trim', preg_split('/\s+/', $q)));

    if (count($terms) === 0) {
        return ['conditions' => [], 'params' => []];
    }

    // Searchable columns
    $searchCols = [
        "{$prefix}first_name",
        "{$prefix}last_name",
        "{$prefix}phone",
        "{$prefix}backup_phone",
        "{$prefix}customer_id",
        "{$prefix}facebook_name",
        "{$prefix}line_id"
    ];

    // Normalize phone for matching (strip leading 0)
    $normalizedPhone = preg_replace('/^0+/', '', preg_replace('/\D/', '', $q));

    // Build conditions for each term
    foreach ($terms as $term) {
        $termConditions = [];

        // Normal text match for each column
        foreach ($searchCols as $col) {
            $termConditions[] = "$col LIKE ?";
            $params[] = "%$term%";
        }

        // For phone: also match without leading 0
        $termPhoneNormalized = preg_replace('/^0+/', '', preg_replace('/\D/', '', $term));
        if ($termPhoneNormalized !== '' && $termPhoneNormalized !== $term) {
            $termConditions[] = "{$prefix}phone LIKE ?";
            $params[] = "%$termPhoneNormalized%";
            $termConditions[] = "{$prefix}backup_phone LIKE ?";
            $params[] = "%$termPhoneNormalized%";
        }

        $conditions[] = '(' . implode(' OR ', $termConditions) . ')';
    }

    // If multiple terms, all must match (AND between terms)
    // This handles "สมชาย ใจดี" → must match both
    $finalCondition = implode(' AND ', $conditions);

    return [
        'conditions' => [$finalCondition],
        'params' => $params
    ];
}

function handle_finance_approval_counts(PDO $pdo): void
{
    if (method() !== 'GET') {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
    $companyId = isset($_GET['companyId']) ? (int) $_GET['companyId'] : 0;

    // Base WHERE conditions
    // 1. Filter out sub-orders
    // 2. Filter by companyId if provided
    $baseWhere = "id NOT REGEXP '^.+-[0-9]+$'";
    $params = [];

    if ($companyId > 0) {
        $baseWhere .= " AND company_id = ?";
        $params[] = $companyId;
    }

    // Transfers Count: payment_method = 'Transfer' AND payment_status = 'PreApproved'
    // Note: Use simple strings for ENUMs or VARCHARs
    $sqlTransfers = "SELECT COUNT(*) FROM orders WHERE $baseWhere AND payment_method = 'Transfer' AND payment_status = 'PreApproved'";

    // PayAfter Count: payment_method = 'PayAfter' AND (payment_status = 'PreApproved' OR order_status = 'Delivered')
    $sqlPayAfter = "SELECT COUNT(*) FROM orders WHERE $baseWhere AND payment_method = 'PayAfter' AND (payment_status = 'PreApproved' OR order_status = 'Delivered')";

    // Execute Transfers Query
    $stmtT = $pdo->prepare($sqlTransfers);
    $stmtT->execute($params);
    $transfersCount = (int) $stmtT->fetchColumn();

    // Execute PayAfter Query
    $stmtP = $pdo->prepare($sqlPayAfter);
    $stmtP->execute($params);
    $payafterCount = (int) $stmtP->fetchColumn();

    json_response([
        'transfers' => $transfersCount,
        'payafter' => $payafterCount
    ]);
}

// recalculate_customer_stats_safe() is provided by Services/CustomerStatsHelper.php




// Customer blocks API
function handle_customer_blocks(PDO $pdo, ?string $id): void
{
    switch (method()) {
        case 'GET':
            $customerId = $_GET['customerId'] ?? null;
            if ($id) {
                $stmt = $pdo->prepare('SELECT * FROM customer_blocks WHERE id = ?');
                $stmt->execute([(int) $id]);
                $row = $stmt->fetch();
                $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            } else if ($customerId) {
                $stmt = $pdo->prepare('SELECT * FROM customer_blocks WHERE customer_id = ? ORDER BY blocked_at DESC');
                $stmt->execute([$customerId]);
                json_response($stmt->fetchAll());
            } else {
                $stmt = $pdo->query('SELECT * FROM customer_blocks WHERE active = 1 ORDER BY blocked_at DESC');
                json_response($stmt->fetchAll());
            }
            break;
        case 'POST':
            $in = json_input();
            $action = $in['action'] ?? '';

            // Batch unblock: unblock multiple customers and move to target basket
            if ($action === 'batch_unblock') {
                $blockIds = $in['block_ids'] ?? [];
                $targetBasketKey = (int) ($in['target_basket_key'] ?? 0);
                $unblockedBy = (int) ($in['unblockedBy'] ?? 0);
                if (empty($blockIds) || !$targetBasketKey || !$unblockedBy) {
                    json_response(['error' => 'VALIDATION_FAILED', 'message' => 'block_ids, target_basket_key, unblockedBy required'], 400);
                }
                $results = ['success' => 0, 'failed' => 0, 'errors' => []];
                foreach ($blockIds as $blockId) {
                    try {
                        // 1. Update customer_blocks
                        $pdo->prepare('UPDATE customer_blocks SET active = 0, unblocked_by = ?, unblocked_at = NOW() WHERE id = ? AND active = 1')
                            ->execute([$unblockedBy, (int) $blockId]);

                        // 2. Find customer and update
                        $cidStmt = $pdo->prepare('SELECT customer_id FROM customer_blocks WHERE id = ?');
                        $cidStmt->execute([(int) $blockId]);
                        $cid = $cidStmt->fetchColumn();
                        if ($cid) {
                            $findStmt = $pdo->prepare('SELECT customer_id, current_basket_key FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
                            $findStmt->execute([$cid, is_numeric($cid) ? (int) $cid : null]);
                            $customer = $findStmt->fetch();
                            if ($customer && $customer['customer_id']) {
                                $oldBasketKey = $customer['current_basket_key'];
                                set_audit_context($pdo, 'customer_blocks/batch_unblock');
                                $pdo->prepare('UPDATE customers SET is_blocked = 0, current_basket_key = ?, basket_entered_date = NOW() WHERE customer_id = ?')
                                    ->execute([$targetBasketKey, $customer['customer_id']]);
                                // Log transition
                                if ((int)$oldBasketKey !== $targetBasketKey) {
                                    try {
                                        $pdo->prepare('INSERT INTO basket_transition_log (customer_id, from_basket_key, to_basket_key, transition_type, notes, created_at) VALUES (?, ?, ?, ?, ?, NOW())')
                                            ->execute([$customer['customer_id'], $oldBasketKey, $targetBasketKey, 'unblocked', 'Batch unblock from Distribution V2']);
                                    } catch (Throwable $logErr) { /* ignore */ }
                                }
                            }
                        }
                        $results['success']++;
                    } catch (Throwable $e) {
                        $results['failed']++;
                        $results['errors'][] = "block_id=$blockId: " . $e->getMessage();
                    }
                }
                json_response(['ok' => true, 'results' => $results]);
                break;
            }

            // Original single-customer block logic
            $customerId = $in['customerId'] ?? '';
            $reason = trim((string) ($in['reason'] ?? ''));
            $blockedBy = (int) ($in['blockedBy'] ?? 0);
            if ($customerId === '' || strlen($reason) < 5 || !$blockedBy) {
                json_response(['error' => 'VALIDATION_FAILED', 'message' => 'customerId, reason(>=5), blockedBy required'], 400);
            }
            try {
                $stmt = $pdo->prepare('INSERT INTO customer_blocks (customer_id, reason, blocked_by, blocked_at, active) VALUES (?, ?, ?, NOW(), 1)');
                $stmt->execute([$customerId, $reason, $blockedBy]);
                // Remove assignment, flag as blocked, and move to block_customer basket (ID 55)
                try {
                    // Try to find customer by customer_ref_id or customer_id, then update using customer_id (PK)
                    $findStmt = $pdo->prepare('SELECT customer_id, current_basket_key FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
                    $findStmt->execute([$customerId, is_numeric($customerId) ? (int) $customerId : null]);
                    $customer = $findStmt->fetch();
                    if ($customer && $customer['customer_id']) {
                        $oldBasketKey = $customer['current_basket_key'];
                        set_audit_context($pdo, 'customer_blocks/block');
                        $pdo->prepare('UPDATE customers SET assigned_to = NULL, is_blocked = 1, current_basket_key = 55, basket_entered_date = NOW() WHERE customer_id = ?')->execute([$customer['customer_id']]);

                        // Log basket transition
                        try {
                            $pdo->prepare('INSERT INTO basket_transition_log (customer_id, from_basket_key, to_basket_key, transition_type, notes, created_at) VALUES (?, ?, 55, ?, ?, NOW())')
                                ->execute([$customer['customer_id'], $oldBasketKey, 'blocked', 'Customer blocked: ' . $reason]);
                        } catch (Throwable $logErr) { /* ignore log failure */ }
                    }
                } catch (Throwable $e) { /* ignore */
                }
                json_response(['ok' => true], 201);
            } catch (Throwable $e) {
                json_response(['error' => 'INSERT_FAILED', 'message' => $e->getMessage()], 409);
            }
            break;
        case 'PATCH':
            if (!$id)
                json_response(['error' => 'ID_REQUIRED'], 400);
            $in = json_input();
            $active = array_key_exists('active', $in) ? (int) !!$in['active'] : null;
            $unblockedBy = (int) ($in['unblockedBy'] ?? 0);
            $fields = [];
            $params = [];
            if ($active !== null) {
                $fields[] = 'active = ?';
                $params[] = $active;
            }
            if ($unblockedBy) {
                $fields[] = 'unblocked_by = ?';
                $params[] = $unblockedBy;
                $fields[] = 'unblocked_at = NOW()';
            }
            if (empty($fields))
                json_response(['ok' => true]);
            $params[] = (int) $id;
            try {
                $pdo->prepare('UPDATE customer_blocks SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
                if ($active === 0) {
                    // clear block flag on customer and move out of block_customer basket
                    try {
                        $cidStmt = $pdo->prepare('SELECT customer_id FROM customer_blocks WHERE id=?');
                        $cidStmt->execute([(int) $id]);
                        $cid = $cidStmt->fetchColumn();
                        if ($cid) {
                            // Find customer by customer_ref_id (from customer_blocks) or customer_id, then update using customer_id (PK)
                            $findStmt = $pdo->prepare('SELECT customer_id, current_basket_key FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
                            $findStmt->execute([$cid, is_numeric($cid) ? (int) $cid : null]);
                            $customer = $findStmt->fetch();
                            if ($customer && $customer['customer_id']) {
                                $oldBasketKey = $customer['current_basket_key'];
                                set_audit_context($pdo, 'customer_blocks/unblock');
                                // Move to ลูกค้าใหม่ Distribution (basket 52) if currently in block_customer basket
                                $newBasketKey = ((int)$oldBasketKey === 55) ? 52 : $oldBasketKey;
                                $pdo->prepare('UPDATE customers SET is_blocked = 0, current_basket_key = ?, basket_entered_date = NOW() WHERE customer_id = ?')->execute([$newBasketKey, $customer['customer_id']]);

                                // Log basket transition if basket changed
                                if ((int)$oldBasketKey !== (int)$newBasketKey) {
                                    try {
                                        $pdo->prepare('INSERT INTO basket_transition_log (customer_id, from_basket_key, to_basket_key, transition_type, notes, created_at) VALUES (?, ?, ?, ?, ?, NOW())')
                                            ->execute([$customer['customer_id'], $oldBasketKey, $newBasketKey, 'unblocked', 'Customer unblocked']);
                                    } catch (Throwable $logErr) { /* ignore */ }
                                }
                            }
                        }
                    } catch (Throwable $e) { /* ignore */
                    }
                }
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                json_response(['error' => 'UPDATE_FAILED', 'message' => $e->getMessage()], 409);
            }
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_ad_spend(PDO $pdo, ?string $id): void
{
    switch (method()) {
        case 'GET':
            $pageId = $_GET['pageId'] ?? null;
            $sql = 'SELECT * FROM ad_spend';
            $params = [];
            if ($pageId) {
                $sql .= ' WHERE page_id=?';
                $params[] = $pageId;
            }
            $sql .= ' ORDER BY spend_date DESC, id DESC';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            json_response($stmt->fetchAll());
            break;
        case 'POST':
            $in = json_input();
            $stmt = $pdo->prepare('INSERT INTO ad_spend (page_id, spend_date, amount, notes) VALUES (?,?,?,?)');
            $stmt->execute([$in['pageId'] ?? null, $in['date'] ?? date('Y-m-d'), $in['amount'] ?? 0, $in['notes'] ?? null]);
            json_response(['id' => $pdo->lastInsertId()]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}
function ensure_order_slips_table(PDO $pdo): void
{
    // Check if table exists
    $tableExists = $pdo->query("SELECT COUNT(*) FROM information_schema.tables 
                                WHERE table_schema = DATABASE() AND table_name = 'order_slips'")->fetchColumn();

    if ($tableExists == 0) {
        $pdo->exec('CREATE TABLE order_slips (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id VARCHAR(32) NOT NULL,
            url VARCHAR(1024) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_order_slips_order (order_id),
            CONSTRAINT fk_order_slips_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    }

    // Check if columns exist and add them if needed
    $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
    $columnCheck = $pdo->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                                WHERE TABLE_SCHEMA = '$dbName' AND TABLE_NAME = 'order_slips'")->fetchAll(PDO::FETCH_COLUMN);
    $columns = $columnCheck ?: [];

    if (!in_array('amount', $columns)) {
        try {
            $pdo->exec('ALTER TABLE order_slips ADD COLUMN amount DECIMAL(12,2) NULL AFTER order_id');
            $columns[] = 'amount';
        } catch (Exception $e) {
            // Column may already exist, ignore
        }
    } else {
        // Ensure amount can store decimals for partial payments
        try {
            $pdo->exec('ALTER TABLE order_slips MODIFY amount DECIMAL(12,2) NULL');
        } catch (Exception $e) {
            // ignore if cannot alter (permission or already correct)
        }
    }
    if (!in_array('bank_account_id', $columns)) {
        try {
            $pdo->exec('ALTER TABLE order_slips ADD COLUMN bank_account_id INT NULL AFTER amount');
            $columns[] = 'bank_account_id';
        } catch (Exception $e) {
            // Column may already exist, ignore
        }
    }
    if (!in_array('transfer_date', $columns)) {
        try {
            $pdo->exec('ALTER TABLE order_slips ADD COLUMN transfer_date DATETIME NULL AFTER bank_account_id');
            $columns[] = 'transfer_date';
        } catch (Exception $e) {
            // Column may already exist, ignore
        }
    }
    if (!in_array('mismatch_reason', $columns)) {
        try {
            $pdo->exec('ALTER TABLE order_slips ADD COLUMN mismatch_reason VARCHAR(255) NULL AFTER transfer_date');
            $columns[] = 'mismatch_reason';
        } catch (Exception $e) {
            // Column may already exist, ignore
        }
    }
    if (!in_array('upload_by', $columns)) {
        try {
            $pdo->exec('ALTER TABLE order_slips ADD COLUMN upload_by INT NULL AFTER url');
            $columns[] = 'upload_by';
        } catch (Exception $e) {
            // Column may already exist, ignore
        }
    }
    if (!in_array('upload_by_name', $columns)) {
        try {
            $pdo->exec('ALTER TABLE order_slips ADD COLUMN upload_by_name VARCHAR(255) NULL AFTER upload_by');
            $columns[] = 'upload_by_name';
        } catch (Exception $e) {
            // Column may already exist, ignore
        }
    }

    // Add index for bank_account_id if it doesn't exist
    if (in_array('bank_account_id', $columns)) {
        $indexCheck = $pdo->query("SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                                    WHERE TABLE_SCHEMA = '$dbName' AND TABLE_NAME = 'order_slips' 
                                    AND INDEX_NAME = 'idx_order_slips_bank_account_id'")->fetchColumn();
        if ($indexCheck == 0) {
            try {
                $pdo->exec('ALTER TABLE order_slips ADD INDEX idx_order_slips_bank_account_id (bank_account_id)');
            } catch (Exception $e) {
                // Index may already exist, ignore
            }
        }

        // Add foreign key constraint if it doesn't exist
        $constraintCheck = $pdo->query("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
                                        WHERE TABLE_SCHEMA = '$dbName' AND TABLE_NAME = 'order_slips' 
                                        AND CONSTRAINT_NAME = 'fk_order_slips_bank_account_id'")->fetchColumn();
        if ($constraintCheck == 0) {
            try {
                $pdo->exec('ALTER TABLE order_slips ADD CONSTRAINT fk_order_slips_bank_account_id 
                           FOREIGN KEY (bank_account_id) REFERENCES bank_account(id) ON DELETE SET NULL');
            } catch (Exception $e) {
                // Foreign key may fail if bank_account table doesn't exist, ignore
            }
        }
    }
}

function ensure_cod_schema(PDO $pdo): void
{
    try {
        $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
    } catch (Throwable $e) {
        return;
    }

    // 1) cod_documents table
    try {
        $tableExists = $pdo->query("SELECT COUNT(*) FROM information_schema.tables 
                                    WHERE table_schema = '$dbName' AND table_name = 'cod_documents'")->fetchColumn();
        if ((int) $tableExists === 0) {
            $pdo->exec("CREATE TABLE cod_documents (
                id INT AUTO_INCREMENT PRIMARY KEY,
                document_number VARCHAR(64) NOT NULL,
                document_datetime DATETIME NOT NULL,
                bank_account_id INT NULL,
                matched_statement_log_id INT NULL,
                company_id INT NOT NULL,
                total_input_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                total_order_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                status VARCHAR(32) NOT NULL DEFAULT 'pending',
                notes TEXT NULL,
                created_by INT NULL,
                verified_by INT NULL,
                verified_at DATETIME NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_cod_document_company_number (company_id, document_number),
                KEY idx_cod_documents_company (company_id),
                KEY idx_cod_documents_datetime (document_datetime),
                KEY idx_cod_documents_status (status),
                KEY idx_cod_documents_statement (matched_statement_log_id),
                CONSTRAINT fk_cod_documents_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                CONSTRAINT fk_cod_documents_bank FOREIGN KEY (bank_account_id) REFERENCES bank_account(id) ON DELETE SET NULL,
                CONSTRAINT fk_cod_documents_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
                CONSTRAINT fk_cod_documents_statement FOREIGN KEY (matched_statement_log_id) REFERENCES statement_logs(id) ON DELETE SET NULL,
                CONSTRAINT fk_cod_documents_verified_by FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }
    } catch (Throwable $e) { /* ignore */
    }

    // Ensure additional COD document columns exist for verification
    $docColumns = [];
    try {
        $docColumnRows = $pdo->query("SELECT column_name, column_type, data_type FROM information_schema.columns 
                                      WHERE table_schema = '$dbName' AND table_name = 'cod_documents'")
            ->fetchAll(PDO::FETCH_ASSOC);
        foreach ($docColumnRows as $col) {
            $docColumns[strtolower($col['column_name'])] = $col;
        }
    } catch (Throwable $e) { /* ignore */
    }

    if (!isset($docColumns['matched_statement_log_id'])) {
        try {
            $pdo->exec("ALTER TABLE cod_documents ADD COLUMN matched_statement_log_id INT NULL AFTER bank_account_id");
        } catch (Throwable $e) { /* ignore */
        }
    }
    if (!isset($docColumns['status'])) {
        try {
            $pdo->exec("ALTER TABLE cod_documents ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'pending' AFTER total_order_amount");
        } catch (Throwable $e) { /* ignore */
        }
    }
    if (!isset($docColumns['verified_by'])) {
        try {
            $pdo->exec("ALTER TABLE cod_documents ADD COLUMN verified_by INT NULL AFTER created_by");
        } catch (Throwable $e) { /* ignore */
        }
    }
    if (!isset($docColumns['verified_at'])) {
        try {
            $pdo->exec("ALTER TABLE cod_documents ADD COLUMN verified_at DATETIME NULL AFTER verified_by");
        } catch (Throwable $e) { /* ignore */
        }
    }
    try {
        $idx = $pdo->query("SELECT COUNT(*) FROM information_schema.statistics 
                            WHERE table_schema = '$dbName' AND table_name = 'cod_documents' AND index_name = 'idx_cod_documents_status'")->fetchColumn();
        if ((int) $idx === 0) {
            $pdo->exec("ALTER TABLE cod_documents ADD INDEX idx_cod_documents_status (status)");
        }
    } catch (Throwable $e) { /* ignore */
    }
    try {
        $idx = $pdo->query("SELECT COUNT(*) FROM information_schema.statistics 
                            WHERE table_schema = '$dbName' AND table_name = 'cod_documents' AND index_name = 'idx_cod_documents_statement'")->fetchColumn();
        if ((int) $idx === 0) {
            $pdo->exec("ALTER TABLE cod_documents ADD INDEX idx_cod_documents_statement (matched_statement_log_id)");
        }
    } catch (Throwable $e) { /* ignore */
    }
    try {
        $pdo->exec("ALTER TABLE cod_documents ADD CONSTRAINT fk_cod_documents_statement FOREIGN KEY (matched_statement_log_id) REFERENCES statement_logs(id) ON DELETE SET NULL");
    } catch (Throwable $e) { /* ignore */
    }
    try {
        $pdo->exec("ALTER TABLE cod_documents ADD CONSTRAINT fk_cod_documents_verified_by FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL");
    } catch (Throwable $e) { /* ignore */
    }

    // 2) Ensure cod_records columns exist
    $columns = [];
    try {
        $columnRows = $pdo->query("SELECT column_name, column_type, data_type FROM information_schema.columns 
                                   WHERE table_schema = '$dbName' AND table_name = 'cod_records'")
            ->fetchAll(PDO::FETCH_ASSOC);
        foreach ($columnRows as $col) {
            $cName = $col['column_name'] ?? $col['COLUMN_NAME'] ?? '';
            if ($cName !== '') {
                $columns[strtolower($cName)] = $col;
            }
        }
    } catch (Throwable $e) { /* ignore */
    }

    // document_id
    if (!isset($columns['document_id'])) {
        try {
            $pdo->exec("ALTER TABLE cod_records ADD COLUMN document_id INT NULL AFTER id");
        } catch (Throwable $e) { /* ignore */
        }
    }
    try {
        $idx = $pdo->query("SELECT COUNT(*) FROM information_schema.statistics 
                            WHERE table_schema = '$dbName' AND table_name = 'cod_records' AND index_name = 'idx_cod_records_document'")->fetchColumn();
        if ((int) $idx === 0) {
            $pdo->exec("ALTER TABLE cod_records ADD INDEX idx_cod_records_document (document_id)");
        }
    } catch (Throwable $e) { /* ignore */
    }
    try {
        $fkExists = $pdo->query("SELECT COUNT(*) FROM information_schema.table_constraints 
                                 WHERE table_schema = '$dbName' AND table_name = 'cod_records' AND constraint_name = 'fk_cod_records_document'")->fetchColumn();
        if ((int) $fkExists === 0) {
            $pdo->exec("ALTER TABLE cod_records 
                ADD CONSTRAINT fk_cod_records_document FOREIGN KEY (document_id) REFERENCES cod_documents(id) ON DELETE SET NULL");
        }
    } catch (Throwable $e) { /* ignore */
    }

    // order_id
    if (!isset($columns['order_id'])) {
        try {
            $pdo->exec("ALTER TABLE cod_records ADD COLUMN order_id VARCHAR(32) NULL AFTER tracking_number");
        } catch (Throwable $e) { /* ignore */
        }
    }
    try {
        $idx = $pdo->query("SELECT COUNT(*) FROM information_schema.statistics 
                            WHERE table_schema = '$dbName' AND table_name = 'cod_records' AND index_name = 'idx_cod_records_order'")->fetchColumn();
        if ((int) $idx === 0) {
            $pdo->exec("ALTER TABLE cod_records ADD INDEX idx_cod_records_order (order_id)");
        }
    } catch (Throwable $e) { /* ignore */
    }

    // order_amount
    if (!isset($columns['order_amount'])) {
        try {
            $pdo->exec("ALTER TABLE cod_records ADD COLUMN order_amount DECIMAL(12,2) NULL DEFAULT 0.00 AFTER cod_amount");
        } catch (Throwable $e) { /* ignore */
        }
    }

    // status should accept new values; relax to VARCHAR
    try {
        $statusCol = $columns['status'] ?? null;
        $isVarchar = $statusCol && strtolower($statusCol['data_type']) === 'varchar';
        $supportsMatched = $statusCol && isset($statusCol['column_type']) && stripos($statusCol['column_type'], 'matched') !== false;
        if (!$isVarchar || !$supportsMatched) {
            $pdo->exec("ALTER TABLE cod_records MODIFY status VARCHAR(32) NOT NULL DEFAULT 'pending'");
        }
    } catch (Throwable $e) { /* ignore */
    }
}

function handle_order_slips(PDO $pdo, ?string $id): void
{
    ensure_order_slips_table($pdo);
    $baseDir = __DIR__ . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'slips';
    if (!is_dir($baseDir)) {
        @mkdir($baseDir, 0775, true);
    }

    switch (method()) {
        case 'GET':
            $orderId = $_GET['orderId'] ?? null;
            if (!$orderId) {
                json_response(['error' => 'ORDER_ID_REQUIRED'], 400);
            }
            $st = $pdo->prepare('SELECT id, url, created_at, upload_by, upload_by_name, amount, bank_account_id, transfer_date, mismatch_reason FROM order_slips WHERE order_id=? ORDER BY id DESC');
            $st->execute([$orderId]);
            json_response($st->fetchAll());
            break;
        case 'POST':
            $in = json_input();
            $orderId = $in['orderId'] ?? '';
            $content = $in['contentBase64'] ?? '';
            $bankAccountId = isset($in['bankAccountId']) ? (int) $in['bankAccountId'] : null;
            $transferDate = $in['transferDate'] ?? null;
            $amount = isset($in['amount']) && $in['amount'] !== '' ? (float) $in['amount'] : null;
            $uploadedBy = $in['uploadedBy'] ?? $in['uploadBy'] ?? $in['upload_by'] ?? null;
            $uploadedByName = $in['uploadedByName'] ?? $in['uploadByName'] ?? $in['upload_by_name'] ?? null;
            $mismatchReason = $in['mismatchReason'] ?? $in['mismatch_reason'] ?? null;

            if ($orderId === '' || $content === '') {
                json_response(['error' => 'INVALID_INPUT'], 400);
            }

            /**
             * [MODIFIED] Logic per user request:
             * 1. Check if order.payment_method is 'COD'
             * 2. Check current order_slips count for this order
             * 3. If COD and count == 0, update orders.payment_status = 'PendingVerification'
             */
            try {
                $checkOrdStmt = $pdo->prepare("SELECT payment_method FROM orders WHERE id = ?");
                $checkOrdStmt->execute([$orderId]);
                $pm = $checkOrdStmt->fetchColumn();

                // Applies to all payment methods now!
                $countSlipStmt = $pdo->prepare("SELECT COUNT(*) FROM order_slips WHERE order_id = ?");
                $countSlipStmt->execute([$orderId]);
                $existingSlips = (int) $countSlipStmt->fetchColumn();

                if ($existingSlips === 0) {
                    $updOrdStmt = $pdo->prepare("UPDATE orders SET payment_status = 'PendingVerification' WHERE id = ?");
                    $updOrdStmt->execute([$orderId]);
                }
            } catch (Throwable $e) {
                // Log but do not block the slip upload? Or fail? 
                // User said "don't error" for data check, but for logic usually best to proceed or log.
                error_log("Error updating COD status: " . $e->getMessage());
            }
            $url = null;
            // Handle both data URL format (data:image/...) and raw base64
            if (preg_match('/^data:(image\/(png|jpeg|jpg|gif|webp|bmp|svg\+xml));base64,(.*)$/s', $content, $m)) {
                $ext = $m[2];
                if ($ext === 'jpeg') $ext = 'jpg';
                if ($ext === 'svg+xml') $ext = 'svg';
                $data = base64_decode($m[3]);
                if ($data !== false) {
                    $fname = 'slip_' . preg_replace('/[^A-Za-z0-9_-]+/', '', $orderId) . '_' . date('Ymd_His') . '_' . substr(md5(uniqid('', true)), 0, 6) . '.' . $ext;
                    $path = $baseDir . DIRECTORY_SEPARATOR . $fname;
                    if (file_put_contents($path, $data) !== false) {
                        $url = 'api/uploads/slips/' . $fname;
                    }
                }
            } else {
                // Raw base64 string (strip any whitespace/newlines)
                $cleanContent = preg_replace('/\s+/', '', $content);
                if (preg_match('/^[A-Za-z0-9+\/]+=*$/', $cleanContent)) {
                    $data = base64_decode($cleanContent);
                    if ($data !== false) {
                        // Try to detect image type from data
                        $finfo = finfo_open(FILEINFO_MIME_TYPE);
                        $mimeType = finfo_buffer($finfo, $data);
                        finfo_close($finfo);
                        $ext = 'jpg'; // default
                        if (strpos($mimeType, 'png') !== false)
                            $ext = 'png';
                        else if (strpos($mimeType, 'jpeg') !== false || strpos($mimeType, 'jpg') !== false)
                            $ext = 'jpg';
                        else if (strpos($mimeType, 'gif') !== false)
                            $ext = 'gif';
                        else if (strpos($mimeType, 'webp') !== false)
                            $ext = 'webp';

                        $fname = 'slip_' . preg_replace('/[^A-Za-z0-9_-]+/', '', $orderId) . '_' . date('Ymd_His') . '_' . substr(md5(uniqid('', true)), 0, 6) . '.' . $ext;
                        $path = $baseDir . DIRECTORY_SEPARATOR . $fname;
                        if (file_put_contents($path, $data) !== false) {
                            $url = 'api/uploads/slips/' . $fname;
                        }
                    }
                }
            }
            if (!$url) {
                json_response(['error' => 'DECODE_FAILED'], 400);
            }

            // Build INSERT query dynamically based on available columns
            $columns = ['order_id', 'url'];
            $values = [$orderId, $url];
            $placeholders = ['?', '?'];

            // Check if columns exist
            $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
            $existingColumns = $pdo->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                                            WHERE TABLE_SCHEMA = '$dbName' AND TABLE_NAME = 'order_slips'")->fetchAll(PDO::FETCH_COLUMN);

            if (in_array('amount', $existingColumns) && $amount !== null) {
                $columns[] = 'amount';
                $values[] = $amount;
                $placeholders[] = '?';
            }
            if (in_array('bank_account_id', $existingColumns) && $bankAccountId !== null) {
                $columns[] = 'bank_account_id';
                $values[] = $bankAccountId;
                $placeholders[] = '?';
            }
            if (in_array('transfer_date', $existingColumns) && $transferDate !== null) {
                $columns[] = 'transfer_date';
                $values[] = $transferDate;
                $placeholders[] = '?';
            }

            if (in_array('upload_by', $existingColumns) && $uploadedBy !== null && $uploadedBy !== '') {
                $columns[] = 'upload_by';
                $values[] = $uploadedBy;
                $placeholders[] = '?';
            }
            if (in_array('upload_by_name', $existingColumns) && $uploadedByName !== null && $uploadedByName !== '') {
                $columns[] = 'upload_by_name';
                $values[] = $uploadedByName;
                $placeholders[] = '?';
            }
            if (in_array('mismatch_reason', $existingColumns) && $mismatchReason !== null && $mismatchReason !== '') {
                $columns[] = 'mismatch_reason';
                $values[] = $mismatchReason;
                $placeholders[] = '?';
            }

            $sql = 'INSERT INTO order_slips (' . implode(', ', $columns) . ') VALUES (' . implode(', ', $placeholders) . ')';
            $st = $pdo->prepare($sql);
            $st->execute($values);
            json_response([
                'ok' => true,
                'id' => $pdo->lastInsertId(),
                'url' => $url,
                'uploaded_by' => $uploadedBy,
                'uploaded_by_name' => $uploadedByName,
                'amount' => $amount,
                'bank_account_id' => $bankAccountId,
                'transfer_date' => $transferDate,
                'created_at' => date('Y-m-d H:i:s'),
            ]);
            break;
        case 'PATCH':
            if (!$id) {
                json_response(['error' => 'ID_REQUIRED'], 400);
            }
            $in = json_input();

            // Check if slip exists
            $checkStmt = $pdo->prepare('SELECT id FROM order_slips WHERE id=?');
            $checkStmt->execute([$id]);
            if (!$checkStmt->fetch()) {
                json_response(['error' => 'NOT_FOUND'], 404);
            }

            // Build UPDATE query dynamically based on provided fields
            $set = [];
            $params = [];

            // Check which columns exist in the table
            $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
            $existingColumns = $pdo->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                                            WHERE TABLE_SCHEMA = '$dbName' AND TABLE_NAME = 'order_slips'")->fetchAll(PDO::FETCH_COLUMN);

            if (isset($in['amount']) && in_array('amount', $existingColumns)) {
                $set[] = 'amount = ?';
                $params[] = $in['amount'] !== null && $in['amount'] !== '' ? (float) $in['amount'] : null;
            }
            if (isset($in['bankAccountId']) && in_array('bank_account_id', $existingColumns)) {
                $set[] = 'bank_account_id = ?';
                $params[] = $in['bankAccountId'] !== null && $in['bankAccountId'] !== '' ? (int) $in['bankAccountId'] : null;
            }
            if (isset($in['transferDate']) && in_array('transfer_date', $existingColumns)) {
                $set[] = 'transfer_date = ?';
                $params[] = $in['transferDate'] !== null && $in['transferDate'] !== '' ? $in['transferDate'] : null;
            }

            if (empty($set)) {
                json_response(['ok' => true]); // Nothing to update
            }

            $params[] = $id; // Add ID for WHERE clause
            $sql = 'UPDATE order_slips SET ' . implode(', ', $set) . ' WHERE id = ?';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);

            json_response(['ok' => true]);
            break;
        case 'DELETE':
            if (!$id) {
                json_response(['error' => 'ID_REQUIRED'], 400);
            }
            
            // เริ่มต้น Transaction (จุด A)
            $pdo->beginTransaction();
            
            try {
                $st = $pdo->prepare('SELECT url, order_id FROM order_slips WHERE id=?');
                $st->execute([$id]);
                $row = $st->fetch();
                if (!$row) {
                    $pdo->rollBack();
                    json_response(['error' => 'NOT_FOUND'], 404);
                }
                $url = $row['url'];
                $orderId = $row['order_id']; // Capture orderId for post-delete check

                if ($url) {
                    $prefix = 'api/uploads/slips/';
                    if (strpos($url, $prefix) === 0) {
                        $fs = __DIR__ . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'slips' . DIRECTORY_SEPARATOR . substr($url, strlen($prefix));
                        if (file_exists($fs)) {
                            @unlink($fs);
                        }
                    }
                }
                
                // ลบสลิป
                $pdo->prepare('DELETE FROM order_slips WHERE id=?')->execute([$id]);

                if ($orderId) {
                    // ดึงข้อมูลผู้ใช้เพื่อใช้เขียน log
                    $authUser = get_authenticated_user($pdo);
                    $userId = $authUser ? (int) $authUser['id'] : null;

                    set_audit_context($pdo, 'index/slip_delete', $userId);

                    $checkOrdStmt = $pdo->prepare("SELECT total_amount, amount_paid, payment_status, order_status FROM orders WHERE id = ?");
                    $checkOrdStmt->execute([$orderId]);
                    $orderRow = $checkOrdStmt->fetch(PDO::FETCH_ASSOC);

                    if ($orderRow) {
                        $orderTotal = (float) ($orderRow['total_amount'] ?? 0);
                        $oldAmountPaid = $orderRow['amount_paid'] !== null ? (float) $orderRow['amount_paid'] : 0.0;
                        $oldPaymentStatus = (string) ($orderRow['payment_status'] ?? '');
                        $oldOrderStatus = (string) ($orderRow['order_status'] ?? '');

                        // นับสลิปที่เหลือ
                        $countSlipStmt = $pdo->prepare("SELECT COUNT(*) FROM order_slips WHERE order_id = ?");
                        $countSlipStmt->execute([$orderId]);
                        $remainingSlips = (int) $countSlipStmt->fetchColumn();

                        // หายอดเงิน COD จาก cod_records
                        $codSumStmt = $pdo->prepare("
                            SELECT COALESCE(SUM(cr.cod_amount), 0) 
                            FROM cod_records cr
                            WHERE cr.order_id = ? OR cr.order_id LIKE ?
                        ");
                        $codSumStmt->execute([$orderId, $orderId . '-%']);
                        $codTotal = (float) $codSumStmt->fetchColumn();

                        // recalc amount_paid จาก slips ที่เหลือ + cod_amount
                        $slipSumStmt = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) FROM order_slips WHERE order_id = ?");
                        $slipSumStmt->execute([$orderId]);
                        $remainingSlipTotal = (float) $slipSumStmt->fetchColumn();

                        $newAmountPaid = min($orderTotal, $remainingSlipTotal + $codTotal);
                        $newPaymentStatus = $oldPaymentStatus;
                        $newOrderStatus = $oldOrderStatus;

                        $threshold = $orderTotal * 0.95;
                        if ($newAmountPaid <= 0) {
                            $newPaymentStatus = 'Unpaid';
                            if (in_array($oldOrderStatus, ['PreApproved', 'Delivered', 'Confirmed'], true)) {
                                $trackStmt = $pdo->prepare("SELECT COUNT(*) FROM order_tracking_numbers WHERE parent_order_id = ? OR order_id = ?");
                                $trackStmt->execute([$orderId, $orderId]);
                                $hasTracking = (int) $trackStmt->fetchColumn();
                                if ($hasTracking > 0) {
                                    $newOrderStatus = 'Shipping';
                                }
                            }
                        } elseif ($newAmountPaid >= $threshold) {
                            // Keep current statuses
                            $newPaymentStatus = $oldPaymentStatus;
                            $newOrderStatus = $oldOrderStatus;
                        } else {
                            // Below 95% — revert to Unpaid + Shipping
                            $newPaymentStatus = 'Unpaid';
                            if (in_array($oldOrderStatus, ['PreApproved', 'Delivered', 'Confirmed'], true)) {
                                $trackStmt = $pdo->prepare("SELECT COUNT(*) FROM order_tracking_numbers WHERE parent_order_id = ? OR order_id = ?");
                                $trackStmt->execute([$orderId, $orderId]);
                                $hasTracking = (int) $trackStmt->fetchColumn();
                                if ($hasTracking > 0) {
                                    $newOrderStatus = 'Shipping';
                                }
                            }
                        }

                        // ทำการอัปเดตคำสั่งซื้อ
                        $updStmt = $pdo->prepare("
                            UPDATE orders
                            SET amount_paid = ?, payment_status = ?, order_status = ?
                            WHERE id = ?
                        ");
                        $updStmt->execute([$newAmountPaid, $newPaymentStatus, $newOrderStatus, $orderId]);

                        // บันทึกประวัติการเปลี่ยนแปลงลงตาราง order_audit_log (จุด B)
                        $logStmt = $pdo->prepare("
                            INSERT INTO order_audit_log (order_id, field_name, old_value, new_value, api_source, changed_by, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, NOW())
                        ");

                        if (abs($oldAmountPaid - $newAmountPaid) > 0.005) {
                            $logStmt->execute([$orderId, 'amount_paid', (string)$oldAmountPaid, (string)$newAmountPaid, 'index/slip_delete', $userId]);
                        }
                        if ($oldPaymentStatus !== $newPaymentStatus) {
                            $logStmt->execute([$orderId, 'payment_status', $oldPaymentStatus, $newPaymentStatus, 'index/slip_delete', $userId]);
                        }
                        if ($oldOrderStatus !== $newOrderStatus) {
                            $logStmt->execute([$orderId, 'order_status', $oldOrderStatus, $newOrderStatus, 'index/slip_delete', $userId]);
                        }
                    }
                }
                
                $pdo->commit();
                json_response(['ok' => true]);
                
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                error_log("Error recalculating after slip delete: " . $e->getMessage());
                json_response(['error' => 'DELETE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_serve_slip_file(string $filename): void
{
    // Security: only allow alphanumeric, dash, underscore, and dot in filename
    if (!preg_match('/^[a-zA-Z0-9._-]+$/', $filename)) {
        http_response_code(400);
        echo 'Invalid filename';
        exit;
    }

    $baseDir = __DIR__ . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'slips';
    $filePath = $baseDir . DIRECTORY_SEPARATOR . $filename;

    // Check if file exists and is within the uploads/slips directory
    if (!file_exists($filePath) || !is_file($filePath)) {
        http_response_code(404);
        echo 'File not found';
        exit;
    }

    // Ensure the file is within the allowed directory (prevent directory traversal)
    $realBaseDir = realpath($baseDir);
    $realFilePath = realpath($filePath);
    if (!$realBaseDir || !$realFilePath || strpos($realFilePath, $realBaseDir) !== 0) {
        http_response_code(403);
        echo 'Access denied';
        exit;
    }

    // Determine content type based on file extension
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    $mimeTypes = [
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
    ];
    $contentType = $mimeTypes[$ext] ?? 'application/octet-stream';

    // Set headers and serve file
    header('Content-Type: ' . $contentType);
    header('Content-Length: ' . filesize($filePath));
    header('Cache-Control: public, max-age=31536000, immutable');
    readfile($filePath);
    exit;
}


function cleanup_old_exports(PDO $pdo, string $dir): void
{
    try {
        // Delete DB rows older than 30 days and remove files
        $stmt = $pdo->prepare('SELECT id, file_path FROM exports WHERE created_at < (NOW() - INTERVAL 30 DAY)');
        $stmt->execute();
        $rows = $stmt->fetchAll();
        foreach ($rows as $r) {
            $path = $r['file_path'] ?? '';
            if ($path && file_exists($path)) {
                @unlink($path);
            }
        }
        $pdo->exec('DELETE FROM exports WHERE created_at < (NOW() - INTERVAL 30 DAY)');
    } catch (Throwable $e) { /* ignore cleanup errors */
    }
}

function handle_exports(PDO $pdo, ?string $id): void
{
    // Get authenticated user for company_id and user_id
    $authUser = get_authenticated_user($pdo);
    $userId = $authUser['id'] ?? null;
    $companyId = $authUser['company_id'] ?? null;

    $baseDir = __DIR__ . DIRECTORY_SEPARATOR . 'exports';
    if (!is_dir($baseDir)) {
        @mkdir($baseDir, 0775, true);
    }
    
    cleanup_old_exports($pdo, $baseDir);


    if ($id) {
        if (isset($_GET['download'])) {
            $stmt = $pdo->prepare('SELECT * FROM exports WHERE id = ? AND (company_id = ? OR company_id IS NULL)');
            $stmt->execute([$id, $companyId]);
            $row = $stmt->fetch();

            if (!$row) {
                http_response_code(404);
                die('File not found or unauthorized');
            }

            $path = $row['file_path'];
            if (!file_exists($path)) {
                http_response_code(404);
                die('Physical file missing');
            }

            try {
                $pdo->prepare('UPDATE exports SET download_count = download_count + 1 WHERE id = ?')->execute([$id]);
            } catch (Throwable $e) { /* ignore */
            }

            // Determine content type based on file extension
            $ext = strtolower(pathinfo($row['filename'], PATHINFO_EXTENSION));
            $contentType = 'application/octet-stream'; // default
            if ($ext === 'csv') {
                $contentType = 'text/csv; charset=utf-8';
            } elseif ($ext === 'xlsx') {
                $contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            } elseif ($ext === 'xls') {
                $contentType = 'application/vnd.ms-excel';
            }

            header('Content-Type: ' . $contentType);
            header('Content-Disposition: attachment; filename="' . basename($row['filename']) . '"');
            header('Content-Length: ' . filesize($path));
            readfile($path);
            exit;
        }
        // Return order IDs linked to this export
        if (isset($_GET['orderItems'])) {
            try {
                $stmt2 = $pdo->prepare('SELECT order_id FROM export_order_items WHERE export_id = ?');
                $stmt2->execute([$id]);
                $orderIds = $stmt2->fetchAll(PDO::FETCH_COLUMN, 0);
                json_response(['ok' => true, 'orderIds' => $orderIds]);
            } catch (Throwable $e) {
                json_response(['ok' => true, 'orderIds' => []]);
            }
        }
        // Only download is supported for ID right now
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    } else {
        switch (method()) {
            case 'GET':
                $category = $_GET['category'] ?? null;
                $sql = 'SELECT * FROM exports WHERE (company_id = ? OR company_id IS NULL) AND created_at >= (NOW() - INTERVAL 30 DAY)';
                $params = [$companyId];

                if ($category) {
                    $sql .= ' AND category = ?';
                    $params[] = $category;
                }

                $sql .= ' ORDER BY created_at DESC';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                json_response($stmt->fetchAll());
                break;

            case 'POST':
                try {
                    $in = json_input();
                    if (empty($in['filename']) || empty($in['contentBase64'])) {
                        json_response(['error' => 'MISSING_PARAMS'], 400);
                    }

                    $filename = $in['filename'];
                    // Ensure unique filename
                    $safeName = preg_replace('/[^a-zA-Z0-9._-]/', '', $filename);
                    if (!$safeName)
                        $safeName = 'export_' . date('Ymd_His') . '.csv';

                    // Add timestamp to filename to prevent collision
                    $info = pathinfo($safeName);
                    $safeName = $info['filename'] . '_' . date('Ymd_His') . '.' . ($info['extension'] ?? 'csv');

                    $content = base64_decode($in['contentBase64']);
                    if ($content === false) {
                        json_response(['error' => 'INVALID_BASE64'], 400);
                    }

                    // Add BOM for Excel UTF-8 (CSV files only, not XLSX)
                    $ext = strtolower(pathinfo($safeName, PATHINFO_EXTENSION));
                    if ($ext === 'csv') {
                        $bom = "\xEF\xBB\xBF";
                        if (substr($content, 0, 3) !== $bom) {
                            $content = $bom . $content;
                        }
                    }

                    $uploadDir = __DIR__ . '/../uploads/exports';
                    if (!is_dir($uploadDir)) {
                        mkdir($uploadDir, 0777, true);
                    }

                    $path = $uploadDir . '/' . $safeName;
                    if (file_put_contents($path, $content) === false) {
                        json_response(['error' => 'WRITE_FAILED'], 500);
                    }

                    $ordersCount = (int) ($in['ordersCount'] ?? 0);
                    $exportedBy = $in['exportedBy'] ?? 'Unknown';
                    $category = $in['category'] ?? null;
                    $templateId = isset($in['templateId']) ? (int) $in['templateId'] : null;
                    $orderIds = $in['orderIds'] ?? [];

                    $stmt = $pdo->prepare('INSERT INTO exports (filename, file_path, orders_count, user_id, exported_by, company_id, category, template_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
                    $stmt->execute([$safeName, $path, $ordersCount, $userId, $exportedBy, $companyId, $category, $templateId]);
                    $exportId = (int) $pdo->lastInsertId();

                    // Save order IDs for re-download
                    if (!empty($orderIds) && is_array($orderIds)) {
                        $insStmt = $pdo->prepare('INSERT INTO export_order_items (export_id, order_id) VALUES (?, ?)');
                        foreach ($orderIds as $oid) {
                            $insStmt->execute([$exportId, (string) $oid]);
                        }
                    }

                    json_response(['ok' => true, 'id' => $exportId]);
                } catch (Throwable $e) {
                    json_response(['error' => 'EXPORT_LOG_FAILED', 'message' => $e->getMessage()], 500);
                }
                break;

            default:
                json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
        }
    }
}

function save_order_tracking_entries(PDO $pdo, string $parentOrderId, array $entries, bool $replaceExisting = false, ?int $creatorId = null, ?string $customerId = null): void
{
    // 1. Fetch existing tracking numbers to perform a diff (if replacing)
    $existing = [];
    if ($replaceExisting) {
        $stmt = $pdo->prepare('SELECT id, box_number, tracking_number FROM order_tracking_numbers WHERE parent_order_id = ?');
        $stmt->execute([$parentOrderId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $row) {
            // Key by box_number + tracking_number to identify duplicates/unchanged items
            // Use a unique key format: "box_{box}_{tracking}"
            $box = $row['box_number'] !== null ? (int) $row['box_number'] : 'NULL';
            $tn = trim($row['tracking_number']);
            $key = "{$box}_{$tn}";
            $existing[$key] = $row['id'];
        }
    }

    // Check if order has boxes - if yes, auto-assign box_number to tracking entries without box_number
    $boxCount = 0;
    try {
        $boxStmt = $pdo->prepare('SELECT COUNT(*) FROM order_boxes WHERE order_id = ?');
        $boxStmt->execute([$parentOrderId]);
        $boxCount = (int) $boxStmt->fetchColumn();
    } catch (Throwable $e) {
        // If order_boxes table doesn't exist or error, ignore
    }

    $normalized = [];
    $mainTrackingIndex = 0; // Index for tracking without box_number to prevent overwriting
    $autoBoxIndex = 1; // Auto-assign box number starting from 1

    foreach ($entries as $entry) {
        $trackingRaw = $entry['trackingNumber'] ?? ($entry['tracking_number'] ?? null);
        $tn = trim((string) $trackingRaw);
        if ($tn === '') {
            continue;
        }

        $boxRaw = $entry['boxNumber'] ?? ($entry['box_number'] ?? null);
        $boxNumber = null;
        if ($boxRaw !== null && $boxRaw !== '') {
            $boxNumber = max(1, (int) $boxRaw);
        }

        $entryOrderId = trim((string) ($entry['orderId'] ?? ($entry['order_id'] ?? '')));
        if ($boxNumber === null && $entryOrderId !== '') {
            if (preg_match('/^' . preg_quote($parentOrderId, '/') . '\-(\d+)$/', $entryOrderId, $m)) {
                $boxNumber = (int) $m[1];
            }
        }

        // Auto-assign box_number if order has boxes and tracking doesn't have box_number
        if ($boxNumber === null && $boxCount > 0) {
            // If order has multiple boxes, assign box_number sequentially (1, 2, 3, ...)
            if ($boxCount > 1) {
                if ($autoBoxIndex <= $boxCount) {
                    $boxNumber = $autoBoxIndex;
                    $autoBoxIndex++;
                }
                // If tracking count exceeds box count, leave box_number as null for extra tracking
            } else {
                // Single box, assign box_number = 1
                $boxNumber = 1;
            }
        }

        // Use box_number as key if available, otherwise use index to prevent overwriting
        // This allows multiple tracking numbers without box_number to be stored
        // BUT for diffing, we need to know strictly if this combination exists.

        // For processing, we keep the original logic's key structure for uniqueness within the input batch
        if ($boxNumber !== null) {
            $boxKey = 'box_' . $boxNumber;
        } else {
            // Use tracking number + index as key to prevent overwriting when multiple tracking without box_number
            $boxKey = 'main_' . $mainTrackingIndex . '_' . $tn;
            $mainTrackingIndex++;
        }

        $normalized[$boxKey] = [
            'tracking_number' => $tn,
            'box_number' => $boxNumber,
        ];
    }

    if (empty($normalized) && $replaceExisting) {
        // Input empty + replace = Delete All
        $del = $pdo->prepare('DELETE FROM order_tracking_numbers WHERE parent_order_id=?');
        $del->execute([$parentOrderId]);
        return;
    }

    if ($replaceExisting) {
        $toKeepIds = [];
        $toInsert = [];

        foreach ($normalized as $data) {
            $tn = $data['tracking_number'];
            $box = $data['box_number'] !== null ? $data['box_number'] : 'NULL';
            $key = "{$box}_{$tn}";

            if (isset($existing[$key])) {
                // Found in existing -> Keep it
                $toKeepIds[] = $existing[$key];
                // Remove from existing list so we know what to delete later? 
                // Actually, we can just collect IDs to DELETE = array_diff(all_existing_ids, $toKeepIds)
            } else {
                // Not found -> Insert
                $toInsert[] = $data;
            }
        }

        // 2. Delete removed items
        $idsToDelete = array_diff(array_values($existing), $toKeepIds);
        if (!empty($idsToDelete)) {
            $placeholders = implode(',', array_fill(0, count($idsToDelete), '?'));
            $delStmt = $pdo->prepare("DELETE FROM order_tracking_numbers WHERE id IN ($placeholders)");
            $delStmt->execute(array_values($idsToDelete));
        }

        // 3. Insert new items
        if (!empty($toInsert)) {
            $ins = $pdo->prepare('INSERT INTO order_tracking_numbers (order_id, parent_order_id, box_number, tracking_number) VALUES (?,?,?,?)');
            foreach ($toInsert as $data) {
                $boxNumber = $data['box_number'];
                $subOrderId = $boxNumber !== null ? "{$parentOrderId}-{$boxNumber}" : $parentOrderId;
                $ins->execute([$subOrderId, $parentOrderId, $boxNumber, $data['tracking_number']]);
            }
        }

    } else {
        // Legacy behavior: Append (INSERT only), no deletes
        // Original code didn't check for duplicates here, but we probably should to be safe?
        // For now, keep original logic: just insert.
        $ins = $pdo->prepare('INSERT INTO order_tracking_numbers (order_id, parent_order_id, box_number, tracking_number) VALUES (?,?,?,?)');
        foreach ($normalized as $data) {
            $boxNumber = $data['box_number'];
            $subOrderId = $boxNumber !== null ? "{$parentOrderId}-{$boxNumber}" : $parentOrderId;
            $ins->execute([$subOrderId, $parentOrderId, $boxNumber, $data['tracking_number']]);
        }
    }

    if ($creatorId !== null && $customerId !== null) {
        try {
            // Find customer by customer_ref_id or customer_id, then update using customer_id (PK)
            $findStmt = $pdo->prepare('SELECT customer_id FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
            $findStmt->execute([$customerId, is_numeric($customerId) ? (int) $customerId : null]);
            $customer = $findStmt->fetch();
            if ($customer && $customer['customer_id']) {
                $auto = $pdo->prepare('UPDATE customers SET assigned_to=?, date_assigned = COALESCE(date_assigned, NOW()) WHERE customer_id=? AND (assigned_to IS NULL OR assigned_to=0)');
                $auto->execute([$creatorId, $customer['customer_id']]);
                $hist = $pdo->prepare('INSERT IGNORE INTO customer_assignment_history(customer_id, user_id, assigned_at) VALUES (?,?, NOW())');
                $hist->execute([$customer['customer_id'], $creatorId]);
            }
        } catch (Throwable $e) { /* ignore auto-assign failures */
        }
    }
}

function create_audit_log_entry(PDO $pdo, string $orderId, ?string $prevStatus, ?string $newStatus, ?string $prevTracking, ?string $newTracking, string $triggerType): void
{
    if ($prevStatus === $newStatus && $prevTracking === $newTracking) {
        return;
    }

    // Formatting Rules:
    // previous_status: Always show context
    // new_status: Show only if changed from previous
    // previous_tracking: Always show context
    // new_tracking: Show only if changed from previous

    $logNewStatus = ($prevStatus !== $newStatus) ? $newStatus : null;
    $logNewTracking = ($prevTracking !== $newTracking) ? $newTracking : null;

    if ($logNewStatus === null && $logNewTracking === null) {
        return; // No effective change to log
    }

    $stmt = $pdo->prepare("
        INSERT INTO order_status_logs 
        (order_id, previous_status, new_status, previous_tracking, new_tracking, trigger_type, changed_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
    ");
    $stmt->execute([$orderId, $prevStatus, $logNewStatus, $prevTracking, $logNewTracking, $triggerType]);
}

function get_order(PDO $pdo, string $id): ?array
{
    // Select all columns including bank_account_id and transfer_date
    // Check if this is a main order (not a sub order)
    $resolved = resolve_main_order_id($pdo, $id);
    $isSubOrder = $resolved['is_sub'];
    $mainOrderId = $resolved['main_id'];

    // Always fetch main order record (not sub order)
    $stmt = $pdo->prepare('SELECT o.*, MAX(CASE WHEN srl.confirmed_action = \'Confirmed\' THEN \'Confirmed\' ELSE NULL END) as reconcile_action 
                           FROM orders o 
                           LEFT JOIN statement_reconcile_logs srl ON (
                               srl.order_id COLLATE utf8mb4_unicode_ci = o.id 
                               OR srl.confirmed_order_id COLLATE utf8mb4_unicode_ci = o.id
                           )
                           WHERE o.id=?
                           GROUP BY o.id');
    $stmt->execute([$mainOrderId]);
    $o = $stmt->fetch();
    if (!$o)
        return null;

    // Fetch full customer details
    if (!empty($o['customer_id'])) {
        try {
            $custStmt = $pdo->prepare('SELECT * FROM customers WHERE customer_id = ? OR customer_ref_id = ? LIMIT 1');
            $custStmt->execute([$o['customer_id'], $o['customer_id']]);
            $cust = $custStmt->fetch();
            if ($cust) {
                $o['customer'] = $cust;
                // Keep for backward compatibility
                $o['customer_phone'] = $cust['phone'];
                $o['phone'] = $cust['phone'];
                $o['customer_backup_phone'] = $cust['backup_phone'];
            }
        } catch (Throwable $e) { /* ignore */
        }
    }

    // Fetch order creator name
    if (!empty($o['creator_id'])) {
        try {
            $userStmt = $pdo->prepare('SELECT first_name, last_name FROM users WHERE id = ?');
            $userStmt->execute([$o['creator_id']]);
            $userData = $userStmt->fetch();
            if ($userData) {
                $o['creator_name'] = trim(($userData['first_name'] ?? '') . ' ' . ($userData['last_name'] ?? ''));
            }
        } catch (Throwable $e) { /* ignore */
        }
    }

    // Fetch items from main order and all sub orders
    // Use parent_order_id to find all items for this order group
    $items = $pdo->prepare("
        SELECT oi.*, u.first_name as creator_first_name, u.last_name as creator_last_name,
               p.sku as product_sku,
               pr.sku as promotion_sku
        FROM order_items oi 
        LEFT JOIN users u ON u.id = oi.creator_id
        LEFT JOIN products p ON oi.product_id = p.id
        LEFT JOIN promotions pr ON oi.promotion_id = pr.id
        WHERE oi.parent_order_id = ? OR oi.order_id = ? 
        ORDER BY oi.order_id, oi.id
    ");
    $items->execute([$mainOrderId, $mainOrderId]);
    $allItems = $items->fetchAll();
    foreach ($allItems as &$itemRow) {
        if (!isset($itemRow['net_total']) || $itemRow['net_total'] === null) {
            $itemRow['net_total'] = calculate_order_item_net_total($itemRow);
        }
        // Force SKU from promotion for promotion parents
        if (!empty($itemRow['promotion_sku']) && !empty($itemRow['is_promotion_parent'])) {
            $itemRow['sku'] = $itemRow['promotion_sku'];
        }
    }
    unset($itemRow);

    // Build list of order IDs for slips query (slips don't have parent_order_id)
    // Increased limit to 50 to cover most cases
    $allOrderIds = [$mainOrderId];
    for ($i = 1; $i <= 50; $i++) {
        $allOrderIds[] = "{$mainOrderId}-{$i}";
    }
    $placeholders = implode(',', array_fill(0, count($allOrderIds), '?'));

    // Filter items: if this is a sub order request, only return items for that sub order
    // Otherwise, return all items from main order and sub orders
    if ($isSubOrder) {
        $o['items'] = array_filter($allItems, function ($item) use ($id) {
            return $item['order_id'] === $id;
        });
    } else {
        $o['items'] = $allItems;
    }

    // Fetch tracking numbers per box (parent order)
    $tn = $pdo->prepare("SELECT order_id, tracking_number, box_number FROM order_tracking_numbers WHERE parent_order_id=? ORDER BY id");
    $tn->execute([$mainOrderId]);
    $tnRows = $tn->fetchAll();
    $tnList = [];
    $trackingDetails = [];
    foreach ($tnRows as $r) {
        $tnList[] = $r['tracking_number'];
        $trackingDetails[] = [
            'order_id' => $r['order_id'],
            'tracking_number' => $r['tracking_number'],
            'box_number' => $r['box_number'],
        ];
    }
    $o['trackingDetails'] = $trackingDetails;
    $o['tracking_details'] = $trackingDetails;
    $o['trackingNumbers'] = array_values(array_unique($tnList));

    // Fetch boxes from main order
    $bx = $pdo->prepare('SELECT box_number, cod_amount, collection_amount, collected_amount, waived_amount, payment_method, status, sub_order_id, return_status, return_note FROM order_boxes WHERE order_id=? ORDER BY box_number');
    $bx->execute([$mainOrderId]);
    $o['boxes'] = $bx->fetchAll();

    // Include slips from main order and all sub orders
    try {
        $sl = $pdo->prepare("SELECT id, order_id, url, created_at, amount, bank_account_id, transfer_date, upload_by, upload_by_name, mismatch_reason FROM order_slips WHERE order_id IN ($placeholders) ORDER BY id DESC");
        $sl->execute($allOrderIds);
        $o['slips'] = $sl->fetchAll();
    } catch (Throwable $e) { /* ignore if table not present */
    }

    // Fetch activities related to this order
    try {
        $actStmt = $pdo->prepare("
            SELECT id, customer_id, timestamp, type, description, actor_name 
            FROM activities 
            WHERE description LIKE ? 
            ORDER BY timestamp DESC
        ");
        $actStmt->execute(['%' . $mainOrderId . '%']);
        $o['activities'] = $actStmt->fetchAll();
    } catch (Throwable $e) { /* ignore */
    }

    return $o;
}

function handle_calls(PDO $pdo, ?string $id): void
{
    $t_calls_start = microtime(true);
    switch (method()) {
        case 'GET':
            if ($id) {
                $stmt = $pdo->prepare('SELECT ch.*, c.first_name AS customer_first_name, c.last_name AS customer_last_name, c.phone AS customer_phone FROM call_history ch LEFT JOIN customers c ON ch.customer_id = c.customer_id WHERE ch.id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            } else {
                // Pagination and Filtering
                $companyId = $_GET['companyId'] ?? null;
                $customerId = $_GET['customerId'] ?? null;
                $assignedTo = $_GET['assignedTo'] ?? null;
                $date = $_GET['date'] ?? null;
                $dateStart = $_GET['dateStart'] ?? null;
                $dateEnd = $_GET['dateEnd'] ?? null;
                $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
                $pageSize = isset($_GET['pageSize']) ? (int) $_GET['pageSize'] : 500;
                $offset = ($page - 1) * $pageSize;

                // Build Query
                $sql = "SELECT ch.*, c.first_name AS customer_first_name, c.last_name AS customer_last_name, c.phone AS customer_phone FROM call_history ch LEFT JOIN customers c ON ch.customer_id = c.customer_id";
                $params = [];
                $wheres = [];

                if ($companyId) {
                    $wheres[] = "c.company_id = ?";
                    $params[] = $companyId;
                }
                if ($assignedTo) {
                    $wheres[] = "c.assigned_to = ?";
                    $params[] = $assignedTo;
                }

                if ($customerId) {
                    $wheres[] = "ch.customer_id = ?";
                    $params[] = $customerId;
                }

                if ($date) {
                    $wheres[] = "DATE(ch.date) = ?";
                    $params[] = $date;
                } elseif ($dateStart && $dateEnd) {
                    $wheres[] = "DATE(ch.date) BETWEEN ? AND ?";
                    $params[] = $dateStart;
                    $params[] = $dateEnd;
                } elseif ($dateStart) {
                    $wheres[] = "DATE(ch.date) >= ?";
                    $params[] = $dateStart;
                } elseif ($dateEnd) {
                    $wheres[] = "DATE(ch.date) <= ?";
                    $params[] = $dateEnd;
                }

                if (!empty($wheres)) {
                    $sql .= " WHERE " . implode(' AND ', $wheres);
                }

                // Count Total (for pagination)
                $countSql = "SELECT COUNT(*) FROM (" . $sql . ") as sub"; // robust way to count
                // Optimization: simple count if possible, but subquery works safely with joins
                $stmtCount = $pdo->prepare($countSql);
                $stmtCount->execute($params);
                $total = $stmtCount->fetchColumn();

                // Order and Limit
                $sql .= " ORDER BY ch.date DESC LIMIT ? OFFSET ?";
                $params[] = $pageSize;
                $params[] = $offset;

                $stmt = $pdo->prepare($sql);
                // bind parameters specifically for Limit/Offset as integers (PDO quirk with varying modes)
                // For safety, re-bind all
                foreach ($params as $k => $v) {
                    // keys are 0-indexed. simple execute($params) works mostly, but LIMIT/OFFSET often need strict INT in some drivers.
                    // Let's stick to execute($params) if emulation is on, but ideally bindValue.
                    // For simplicity in this codebase style (uses execute($params)), we'll try execute($params).
                    // BUT execute() treats all as strings which breaks LIMIT in non-emulated mode.
                    // So we do manual binding for LIMIT/OFFSET if needed, or just rely on emulation.
                    // Given existing code uses execute($params) for everything, we assume emulation is ON or it works.
                    // Update: existing code doesn't use limit.
                }

                // Safe binding for LIMIT/OFFSET
                // $stmt->execute($params); Warning: might fail if strict mode.
                // Let's use loop binding.
                $stmt = $pdo->prepare($sql);
                // Bind standard params
                $paramCount = count($params);
                $limitOffsetStart = $paramCount - 2;

                for ($i = 0; $i < $limitOffsetStart; $i++) {
                    $stmt->bindValue($i + 1, $params[$i]);
                }
                // Bind Limit and Offset as INT
                $stmt->bindValue($limitOffsetStart + 1, $pageSize, PDO::PARAM_INT);
                $stmt->bindValue($limitOffsetStart + 2, $offset, PDO::PARAM_INT);

                $stmt->execute();
                $data = $stmt->fetchAll();

                // If page/pageSize was requested, return envelope. 
                // BUT to fix 500 error for existing callers who don't expect envelope, we must be careful.
                // Existing global fetching calls without params.
                // If we default pageSize=100, we limit the data.
                // If the caller expects just array, returning object breaks it.

                // Strategy: If 'page' is explicit in query, return envelope.
                // If not, return array (but still capped at 100 for safety/speed? Or 500?).
                // Let's cap at 500 for legacy calls to prevent 500 error, but risk missing data.
                // Ideally, existing global fetch should be updated.

                if (isset($_GET['page'])) {
                    log_perf("handle_calls:END_PAGINATED", $t_calls_start);
                    json_response(['data' => $data, 'total' => $total, 'page' => $page, 'pageSize' => $pageSize]);
                } else {
                    log_perf("handle_calls:END_LEGACY", $t_calls_start);
                    json_response($data);
                }
            }
            break;
        case 'POST':
            $in = json_input();
            // Convert date to Thai timezone if provided (frontend may send UTC)
            $callDate = $in['date'] ?? null;
            if ($callDate) {
                try {
                    $dt = new DateTime($callDate);
                    $dt->setTimezone(new DateTimeZone('Asia/Bangkok'));
                    $callDate = $dt->format('Y-m-d H:i:s');
                } catch (Exception $e) {
                    $callDate = date('Y-m-d H:i:s');
                }
            } else {
                $callDate = date('Y-m-d H:i:s');
            }

            $stmt = $pdo->prepare('INSERT INTO call_history (customer_id, date, caller, caller_id, status, result, crop_type, area_size, notes, duration) VALUES (?,?,?,?,?,?,?,?,?,?)');
            $stmt->execute([
                $in['customerId'] ?? null,
                $callDate,
                $in['caller'] ?? '',
                $in['callerId'] ?? null,
                $in['status'] ?? '',
                $in['result'] ?? '',
                $in['cropType'] ?? null,
                $in['areaSize'] ?? null,
                $in['notes'] ?? null,
                $in['duration'] ?? null
            ]);

            // Increment total_calls and mark lifecycle to Old on first call
            if (!empty($in['customerId'])) {
                try {
                    // Find customer by customer_ref_id or customer_id, then update using customer_id (PK)
                    $findStmt = $pdo->prepare('SELECT customer_id FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
                    $findStmt->execute([$in['customerId'], is_numeric($in['customerId']) ? (int) $in['customerId'] : null]);
                    $customer = $findStmt->fetch();
                    if ($customer && $customer['customer_id']) {
                        // FIX: Update last_call_note and last_call_date along with total_calls
                        // This ensures the "Last Call Note" column in the dashboard is accurate without needing expensive joins.
                        $updateStmt = $pdo->prepare('UPDATE customers SET total_calls = COALESCE(total_calls,0) + 1, last_call_note = ?, last_call_date = ? WHERE customer_id=?');
                        $updateStmt->execute([
                            $in['notes'] ?? null,
                            $callDate,
                            $customer['customer_id']
                        ]);
                    }
                } catch (Throwable $e) { /* ignore */
                }
            }
            json_response(['id' => $pdo->lastInsertId()]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_cod_documents(PDO $pdo, ?string $id): void
{
    // Auto-migrate minimal COD schema so the feature works without manual SQL
    ensure_cod_schema($pdo);

    switch (method()) {
        case 'GET':
            $companyId = $_GET['companyId'] ?? null;
            $includeItems = isset($_GET['includeItems']) && $_GET['includeItems'] === 'true';
            if ($id) {
                $sql = 'SELECT cd.*, b.bank, b.bank_number 
                        FROM cod_documents cd 
                        LEFT JOIN bank_account b ON b.id = cd.bank_account_id
                        WHERE cd.id = ?';
                $params = [$id];
                if ($companyId) {
                    $sql .= ' AND cd.company_id = ?';
                    $params[] = $companyId;
                }
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $doc = $stmt->fetch();
                if (!$doc) {
                    json_response(['error' => 'NOT_FOUND'], 404);
                }
                if ($includeItems) {
                    $itemsStmt = $pdo->prepare('SELECT * FROM cod_records WHERE document_id = ? ORDER BY id');
                    $itemsStmt->execute([$doc['id']]);
                    $doc['items'] = $itemsStmt->fetchAll();
                }
                json_response($doc);
            } else {
                $params = [];
                $sql = 'SELECT cd.*, b.bank, b.bank_number,
                        (SELECT COUNT(*) FROM cod_records cr WHERE cr.document_id = cd.id) AS item_count
                        FROM cod_documents cd 
                        LEFT JOIN bank_account b ON b.id = cd.bank_account_id
                        WHERE 1=1';
                if ($companyId) {
                    $sql .= ' AND cd.company_id = ?';
                    $params[] = $companyId;
                }
                $sql .= ' ORDER BY cd.document_datetime DESC, cd.id DESC';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $docs = $stmt->fetchAll();

                // Check reference in statement_reconcile_batches.notes
                // notes format: "COD Document: {document_number}"
                try {
                    $refStmt = $pdo->prepare('SELECT notes FROM statement_reconcile_batches WHERE company_id = ?');
                    $refParams = [$companyId ?: 0];
                    $refStmt->execute($refParams);
                    $allNotes = $refStmt->fetchAll(PDO::FETCH_COLUMN, 0);
                    $referencedDocNumbers = [];
                    foreach ($allNotes as $note) {
                        if ($note && strpos($note, 'COD Document: ') === 0) {
                            $referencedDocNumbers[] = substr($note, strlen('COD Document: '));
                        }
                    }
                    foreach ($docs as &$doc) {
                        $doc['is_referenced'] = in_array($doc['document_number'], $referencedDocNumbers) ? 1 : 0;
                    }
                    unset($doc);
                } catch (Throwable $e) {
                    // If table doesn't exist yet, just set all to 0
                    foreach ($docs as &$doc) {
                        $doc['is_referenced'] = 0;
                    }
                    unset($doc);
                }

                json_response($docs);
            }
            break;
        case 'DELETE':
            if (!$id) {
                json_response(['error' => 'VALIDATION_FAILED', 'message' => 'Document ID is required'], 400);
            }
            $companyId = $_GET['companyId'] ?? null;

            // Fetch document
            $docStmt = $pdo->prepare('SELECT * FROM cod_documents WHERE id = ?');
            $docStmt->execute([$id]);
            $doc = $docStmt->fetch();
            if (!$doc) {
                json_response(['error' => 'NOT_FOUND'], 404);
            }
            if ($companyId && (int) $doc['company_id'] !== (int) $companyId) {
                json_response(['error' => 'FORBIDDEN', 'message' => 'Document does not belong to this company'], 403);
            }

            // Check if referenced in statement_reconcile_batches
            $docNumber = $doc['document_number'];
            $noteSearch = 'COD Document: ' . $docNumber;
            try {
                $refCheck = $pdo->prepare('SELECT COUNT(*) FROM statement_reconcile_batches WHERE notes = ? AND company_id = ?');
                $refCheck->execute([$noteSearch, $doc['company_id']]);
                if ((int) $refCheck->fetchColumn() > 0) {
                    json_response(['error' => 'REFERENCED', 'message' => 'เอกสารนี้ถูกอ้างอิงในระบบ Reconcile แล้ว ไม่สามารถลบได้'], 409);
                }
            } catch (Throwable $e) {
                // If table doesn't exist, proceed with delete
            }

            // Delete cod_records first, then cod_document
            try {
                $pdo->beginTransaction();
                $authUser = get_authenticated_user($pdo);
                $userId = $authUser ? (int) $authUser['id'] : null;
                set_audit_context($pdo, 'index/cod_document_delete', $userId);

                // Get affected order IDs and tracking numbers before deleting records
                $affectedOrdersStmt = $pdo->prepare('SELECT DISTINCT order_id FROM cod_records WHERE document_id = ?');
                $affectedOrdersStmt->execute([$id]);
                $rawOrderIds = $affectedOrdersStmt->fetchAll(PDO::FETCH_COLUMN);
                // Normalize to parent order IDs (remove -1, -2 suffix)
                $affectedOrderIds = array_unique(array_map(function($oid) {
                    return preg_replace('/-\d+$/', '', $oid);
                }, array_filter($rawOrderIds)));

                // Get tracking numbers before deleting (for order_boxes recalculation)
                $affectedTrackingsStmt = $pdo->prepare('SELECT tracking_number FROM cod_records WHERE document_id = ?');
                $affectedTrackingsStmt->execute([$id]);
                $affectedTrackings = $affectedTrackingsStmt->fetchAll(PDO::FETCH_COLUMN);

                $delRecords = $pdo->prepare('DELETE FROM cod_records WHERE document_id = ?');
                $delRecords->execute([$id]);
                $deletedRecords = $delRecords->rowCount();

                $delDoc = $pdo->prepare('DELETE FROM cod_documents WHERE id = ?');
                $delDoc->execute([$id]);

                // Recalculate order_boxes.collected_amount for affected tracking numbers
                if (!empty($affectedTrackings)) {
                    $trkPh = implode(',', array_fill(0, count($affectedTrackings), '?'));
                    $boxLookupStmt = $pdo->prepare("
                        SELECT otn.parent_order_id, otn.box_number, otn.order_id as sub_order_id
                        FROM order_tracking_numbers otn
                        WHERE otn.tracking_number IN ($trkPh)
                    ");
                    $boxLookupStmt->execute($affectedTrackings);
                    $boxRows = $boxLookupStmt->fetchAll(PDO::FETCH_ASSOC);

                    $updateBoxStmt = $pdo->prepare("
                        UPDATE order_boxes SET collected_amount = (
                            SELECT COALESCE(SUM(cr.cod_amount), 0)
                            FROM cod_records cr
                            INNER JOIN order_tracking_numbers otn 
                                ON LOWER(REPLACE(otn.tracking_number, ' ', '')) = LOWER(REPLACE(cr.tracking_number, ' ', ''))
                            WHERE otn.parent_order_id = ? AND otn.box_number = ?
                        ) WHERE order_id = ? AND box_number = ?
                    ");
                    foreach ($boxRows as $boxRow) {
                        $updateBoxStmt->execute([
                            $boxRow['parent_order_id'], $boxRow['box_number'],
                            $boxRow['parent_order_id'], $boxRow['box_number']
                        ]);
                    }
                }

                // Recalculate amount_paid for all affected orders from ALL payment sources
                foreach ($affectedOrderIds as $affOid) {
                    // Source 1: Sum remaining COD records (match by parent order pattern)
                    $codSumStmt = $pdo->prepare("
                        SELECT COALESCE(SUM(cr.cod_amount), 0) 
                        FROM cod_records cr
                        WHERE cr.order_id = ? OR cr.order_id LIKE ?
                    ");
                    $codSumStmt->execute([$affOid, $affOid . '-%']);
                    $remainingCod = (float) $codSumStmt->fetchColumn();

                    // Source 2: Sum remaining reconcile logs (confirmed amounts from Bank Audit)
                    $reconSumStmt = $pdo->prepare("
                        SELECT COALESCE(SUM(srl.confirmed_amount), 0) 
                        FROM statement_reconcile_logs srl
                        INNER JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id
                        WHERE srl.order_id = ? AND srb.company_id = ?
                    ");
                    $reconSumStmt->execute([$affOid, $doc['company_id']]);
                    $remainingRecon = (float) $reconSumStmt->fetchColumn();

                    // Source 3: Sum remaining order slips
                    $slipSumStmt = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) FROM order_slips WHERE order_id = ?");
                    $slipSumStmt->execute([$affOid]);
                    $remainingSlip = (float) $slipSumStmt->fetchColumn();

                    // Get order info
                    $orderInfoStmt = $pdo->prepare("SELECT total_amount, amount_paid, payment_status, order_status FROM orders WHERE id = ?");
                    $orderInfoStmt->execute([$affOid]);
                    $orderInfo = $orderInfoStmt->fetch(PDO::FETCH_ASSOC);
                    if (!$orderInfo) continue;
                    $orderTotal = (float) $orderInfo['total_amount'];
                    $oldAmountPaid = $orderInfo['amount_paid'] !== null ? (float) $orderInfo['amount_paid'] : 0.0;
                    $oldPaymentStatus = (string) ($orderInfo['payment_status'] ?? '');
                    $oldOrderStatus = (string) ($orderInfo['order_status'] ?? '');

                    // Use the greater of COD records vs reconcile logs, plus slips
                    $bestCodAmount = max($remainingCod, $remainingRecon);
                    $recalcPaid = min($orderTotal, round($bestCodAmount + $remainingSlip, 2));

                    // Determine correct statuses based on remaining amount vs 95% threshold
                    $threshold = $orderTotal * 0.95;
                    if ($recalcPaid <= 0) {
                        $newPaymentStatus = 'Unpaid';
                        $newOrderStatus = in_array($orderInfo['order_status'], ['PreApproved', 'Delivered']) ? 'Shipping' : $orderInfo['order_status'];
                    } elseif ($recalcPaid >= $threshold) {
                        // Still above 95% — keep current statuses
                        $newPaymentStatus = $orderInfo['payment_status'];
                        $newOrderStatus = $orderInfo['order_status'];
                    } else {
                        // Below 95% — revert to Unpaid + Shipping
                        $newPaymentStatus = 'Unpaid';
                        $newOrderStatus = in_array($orderInfo['order_status'], ['PreApproved', 'Delivered']) ? 'Shipping' : $orderInfo['order_status'];
                    }

                    $pdo->prepare("UPDATE orders SET amount_paid = ?, payment_status = ?, order_status = ? WHERE id = ?")
                        ->execute([$recalcPaid, $newPaymentStatus, $newOrderStatus, $affOid]);

                    // บันทึกประวัติการเปลี่ยนแปลงลงตาราง order_audit_log (จุด B)
                    $logStmt = $pdo->prepare("
                        INSERT INTO order_audit_log (order_id, field_name, old_value, new_value, api_source, changed_by, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, NOW())
                    ");

                    if (abs($oldAmountPaid - $recalcPaid) > 0.005) {
                        $logStmt->execute([$affOid, 'amount_paid', (string)$oldAmountPaid, (string)$recalcPaid, 'index/cod_document_delete', $userId]);
                    }
                    if ($oldPaymentStatus !== $newPaymentStatus) {
                        $logStmt->execute([$affOid, 'payment_status', $oldPaymentStatus, $newPaymentStatus, 'index/cod_document_delete', $userId]);
                    }
                    if ($oldOrderStatus !== $newOrderStatus) {
                        $logStmt->execute([$affOid, 'order_status', $oldOrderStatus, $newOrderStatus, 'index/cod_document_delete', $userId]);
                    }
                }

                $pdo->commit();
                json_response(['ok' => true, 'deleted_records' => $deletedRecords]);
            } catch (Throwable $e) {
                if ($pdo->inTransaction())
                    $pdo->rollBack();
                json_response(['error' => 'DELETE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        case 'POST':
            $in = json_input();
            $documentNumber = trim((string) ($in['document_number'] ?? ''));
            $documentDatetimeRaw = $in['document_datetime'] ?? null;
            $companyId = $in['company_id'] ?? null;
            $bankAccountId = $in['bank_account_id'] ?? null;
            $notes = $in['notes'] ?? null;
            $createdBy = $in['created_by'] ?? null;
            $items = isset($in['items']) && is_array($in['items']) ? $in['items'] : [];

            if ($documentNumber === '' || !$companyId) {
                json_response(['error' => 'VALIDATION_FAILED', 'message' => 'document_number and company_id are required'], 400);
            }
            if (empty($items)) {
                json_response(['error' => 'VALIDATION_FAILED', 'message' => 'items are required'], 400);
            }

            $documentDatetime = $documentDatetimeRaw ? date('Y-m-d H:i:s', strtotime((string) $documentDatetimeRaw)) : date('Y-m-d H:i:s');

            $totalInput = 0.0;
            $totalOrder = 0.0;
            foreach ($items as $it) {
                $totalInput += (float) ($it['cod_amount'] ?? 0);
                $totalOrder += (float) ($it['order_amount'] ?? 0);
            }

            try {
                $pdo->beginTransaction();
                $docStmt = $pdo->prepare('INSERT INTO cod_documents (document_number, document_datetime, bank_account_id, company_id, total_input_amount, total_order_amount, notes, created_by) VALUES (?,?,?,?,?,?,?,?)');
                $docStmt->execute([
                    $documentNumber,
                    $documentDatetime,
                    $bankAccountId ?: null,
                    $companyId,
                    $totalInput,
                    $totalOrder,
                    $notes,
                    $createdBy ?: null,
                ]);
                $docId = (int) $pdo->lastInsertId();

                $itemStmt = $pdo->prepare('INSERT INTO cod_records (document_id, tracking_number, order_id, cod_amount, order_amount, received_amount, difference, status, company_id, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)');
                // Prepared statement for updating order_boxes.collected_amount
                $updateBoxCollectedStmt = $pdo->prepare(
                    'UPDATE order_boxes SET collected_amount = (
                        SELECT COALESCE(SUM(cr.cod_amount), 0)
                        FROM cod_records cr
                        INNER JOIN order_tracking_numbers otn ON LOWER(REPLACE(otn.tracking_number, " ", "")) = LOWER(REPLACE(cr.tracking_number, " ", ""))
                        WHERE otn.parent_order_id = ? AND otn.box_number = ?
                    ) WHERE order_id = ? AND box_number = ?'
                );

                // === BATCH PRE-FETCH: existing cod_records for all tracking numbers ===
                $allTrackings = [];
                foreach ($items as $it) {
                    $tn = trim((string) ($it['tracking_number'] ?? ''));
                    if ($tn !== '')
                        $allTrackings[] = $tn;
                }

                $existingMap = []; // tracking_number -> { document_id, cod_amount, order_amount }
                if (count($allTrackings) > 0) {
                    $ph = implode(',', array_fill(0, count($allTrackings), '?'));
                    $existStmt = $pdo->prepare("SELECT tracking_number, document_id, cod_amount, order_amount FROM cod_records WHERE tracking_number IN ($ph) AND company_id = ?");
                    $existParams = $allTrackings;
                    $existParams[] = $companyId;
                    $existStmt->execute($existParams);
                    foreach ($existStmt->fetchAll(PDO::FETCH_ASSOC) as $er) {
                        // Only store the first match per tracking (same as LIMIT 1)
                        if (!isset($existingMap[$er['tracking_number']])) {
                            $existingMap[$er['tracking_number']] = $er;
                        }
                    }
                }

                // === BATCH PRE-FETCH: order_tracking_numbers for box lookup ===
                $trackingBoxMap = []; // tracking_number -> { order_id, box_number, parent_order_id }
                if (count($allTrackings) > 0) {
                    $ph = implode(',', array_fill(0, count($allTrackings), '?'));
                    $trkStmt = $pdo->prepare("SELECT tracking_number, order_id, box_number, parent_order_id FROM order_tracking_numbers WHERE tracking_number IN ($ph)");
                    $trkStmt->execute($allTrackings);
                    foreach ($trkStmt->fetchAll(PDO::FETCH_ASSOC) as $tr) {
                        if (!isset($trackingBoxMap[$tr['tracking_number']])) {
                            $trackingBoxMap[$tr['tracking_number']] = $tr;
                        }
                    }
                }

                // === BATCH PRE-FETCH: order payment_method to skip order_boxes update for non-COD orders ===
                $orderPaymentMethodMap = []; // order_id -> payment_method
                $allBoxOrderIds = [];
                foreach ($trackingBoxMap as $tr) {
                    $boid = $tr['parent_order_id'] ?? $tr['order_id'];
                    if ($boid && !isset($orderPaymentMethodMap[$boid])) {
                        $allBoxOrderIds[] = $boid;
                        $orderPaymentMethodMap[$boid] = null; // placeholder
                    }
                }
                if (count($allBoxOrderIds) > 0) {
                    $ph = implode(',', array_fill(0, count($allBoxOrderIds), '?'));
                    $pmStmt = $pdo->prepare("SELECT id, payment_method FROM orders WHERE id IN ($ph)");
                    $pmStmt->execute($allBoxOrderIds);
                    foreach ($pmStmt->fetchAll(PDO::FETCH_ASSOC) as $pmRow) {
                        $orderPaymentMethodMap[$pmRow['id']] = $pmRow['payment_method'];
                    }
                }

                $skippedItems = [];
                foreach ($items as $it) {
                    $trackingNumber = trim((string) ($it['tracking_number'] ?? ''));
                    if ($trackingNumber === '') {
                        continue;
                    }
                    // Check if tracking exists in a DIFFERENT document (from pre-fetched map)
                    $oldRecord = $existingMap[$trackingNumber] ?? null;
                    $forceImport = (bool) ($it['force_import'] ?? false);
                    if ($oldRecord && $oldRecord['document_id'] && (int) $oldRecord['document_id'] !== $docId) {
                        if (!$forceImport) {
                            $skippedItems[] = ['tracking_number' => $trackingNumber, 'existing_document_id' => (int) $oldRecord['document_id']];
                            continue;
                        }
                    }
                    $orderId = isset($it['order_id']) ? trim((string) $it['order_id']) : null;
                    $codAmount = (float) ($it['cod_amount'] ?? 0);
                    $orderAmount = (float) ($it['order_amount'] ?? ($it['received_amount'] ?? 0));
                    $difference = $codAmount - $orderAmount;
                    $status = $it['status'] ?? null;
                    if ($status === null) {
                        if ($orderId && $orderAmount > 0) {
                            $status = abs($difference) < 0.01 ? 'matched' : 'unmatched';
                        } else {
                            $status = 'pending';
                        }
                    }
                    $itemStmt->execute([
                        $docId,
                        $trackingNumber,
                        $orderId ?: null,
                        $codAmount,
                        $orderAmount,
                        $orderAmount,
                        $difference,
                        $status,
                        $companyId,
                        $createdBy ?: null,
                    ]);

                    // Update order_boxes.collected_amount (from pre-fetched map)
                    // GUARD: Skip for non-COD orders to avoid trigger rejection
                    $trackingRow = $trackingBoxMap[$trackingNumber] ?? null;
                    if ($trackingRow && $trackingRow['box_number'] !== null) {
                        $boxOrderId = $trackingRow['parent_order_id'] ?? $trackingRow['order_id'];
                        $boxPaymentMethod = $orderPaymentMethodMap[$boxOrderId] ?? null;
                        if ($boxPaymentMethod === 'COD') {
                            $boxNumber = (int) $trackingRow['box_number'];
                            $updateBoxCollectedStmt->execute([$boxOrderId, $boxNumber, $boxOrderId, $boxNumber]);
                        }
                    }
                }

                $pdo->commit();
                $response = ['id' => $docId];
                if (!empty($skippedItems)) {
                    $response['skipped'] = $skippedItems;
                    $response['skipped_count'] = count($skippedItems);
                }
                json_response($response);
            } catch (Throwable $e) {
                $pdo->rollBack();
                $code = 500;
                $errMsg = $e->getMessage();
                if (strpos($errMsg, 'uniq_cod_document_company_number') !== false) {
                    $code = 409;
                    $errMsg = 'เลขที่เอกสารซ้ำ กรุณาใช้เลขที่เอกสารอื่น';
                }
                // Note: excess COD amounts are now ALLOWED (trigger updated 2026-02-21)
                json_response(['error' => 'CREATE_FAILED', 'message' => $errMsg], $code);
            }
            break;
        case 'PATCH':
            if (!$id) {
                json_response(['error' => 'ID_REQUIRED'], 400);
            }
            $in = json_input();
            $docStmt = $pdo->prepare('SELECT * FROM cod_documents WHERE id = ?');
            $docStmt->execute([$id]);
            $doc = $docStmt->fetch(PDO::FETCH_ASSOC);
            if (!$doc) {
                json_response(['error' => 'NOT_FOUND'], 404);
            }

            // NEW: Handle adding items to existing document
            $itemsProvided = isset($in['items']) && is_array($in['items']) && count($in['items']) > 0;
            if ($itemsProvided) {
                // Check if document is still editable (not yet matched with statement)
                if (!empty($doc['matched_statement_log_id']) || $doc['status'] === 'verified') {
                    json_response(['error' => 'DOCUMENT_ALREADY_VERIFIED', 'message' => 'ไม่สามารถแก้ไขเอกสารที่จับคู่กับ Statement แล้ว'], 400);
                }

                $items = $in['items'];
                $addedInputTotal = 0.0;
                $addedOrderTotal = 0.0;
                $createdBy = $in['created_by'] ?? null;

                $itemStmt = $pdo->prepare('INSERT INTO cod_records 
                    (document_id, tracking_number, order_id, cod_amount, order_amount, 
                     received_amount, difference, status, company_id, created_by) 
                    VALUES (?,?,?,?,?,?,?,?,?,?)');
                // Prepared statement for updating order_boxes.collected_amount
                $updateBoxCollectedStmt = $pdo->prepare(
                    'UPDATE order_boxes SET collected_amount = (
                        SELECT COALESCE(SUM(cr.cod_amount), 0)
                        FROM cod_records cr
                        INNER JOIN order_tracking_numbers otn ON LOWER(REPLACE(otn.tracking_number, " ", "")) = LOWER(REPLACE(cr.tracking_number, " ", ""))
                        WHERE otn.parent_order_id = ? AND otn.box_number = ?
                    ) WHERE order_id = ? AND box_number = ?'
                );

                // === BATCH PRE-FETCH: existing cod_records ===
                $allTrackings = [];
                foreach ($items as $it) {
                    $tn = trim((string) ($it['tracking_number'] ?? ''));
                    if ($tn !== '')
                        $allTrackings[] = $tn;
                }

                $existingMap = [];
                if (count($allTrackings) > 0) {
                    $ph = implode(',', array_fill(0, count($allTrackings), '?'));
                    $existStmt = $pdo->prepare("SELECT tracking_number, document_id, cod_amount, order_amount FROM cod_records WHERE tracking_number IN ($ph) AND company_id = ?");
                    $existParams = $allTrackings;
                    $existParams[] = $doc['company_id'];
                    $existStmt->execute($existParams);
                    foreach ($existStmt->fetchAll(PDO::FETCH_ASSOC) as $er) {
                        if (!isset($existingMap[$er['tracking_number']])) {
                            $existingMap[$er['tracking_number']] = $er;
                        }
                    }
                }

                // === BATCH PRE-FETCH: order_tracking_numbers for box lookup ===
                $trackingBoxMap = [];
                if (count($allTrackings) > 0) {
                    $ph = implode(',', array_fill(0, count($allTrackings), '?'));
                    $trkStmt = $pdo->prepare("SELECT tracking_number, order_id, box_number, parent_order_id FROM order_tracking_numbers WHERE tracking_number IN ($ph)");
                    $trkStmt->execute($allTrackings);
                    foreach ($trkStmt->fetchAll(PDO::FETCH_ASSOC) as $tr) {
                        if (!isset($trackingBoxMap[$tr['tracking_number']])) {
                            $trackingBoxMap[$tr['tracking_number']] = $tr;
                        }
                    }
                }

                // === BATCH PRE-FETCH: order payment_method to skip order_boxes update for non-COD orders ===
                $orderPaymentMethodMap = []; // order_id -> payment_method
                $allBoxOrderIds = [];
                foreach ($trackingBoxMap as $tr) {
                    $boid = $tr['parent_order_id'] ?? $tr['order_id'];
                    if ($boid && !isset($orderPaymentMethodMap[$boid])) {
                        $allBoxOrderIds[] = $boid;
                        $orderPaymentMethodMap[$boid] = null; // placeholder
                    }
                }
                if (count($allBoxOrderIds) > 0) {
                    $ph = implode(',', array_fill(0, count($allBoxOrderIds), '?'));
                    $pmStmt = $pdo->prepare("SELECT id, payment_method FROM orders WHERE id IN ($ph)");
                    $pmStmt->execute($allBoxOrderIds);
                    foreach ($pmStmt->fetchAll(PDO::FETCH_ASSOC) as $pmRow) {
                        $orderPaymentMethodMap[$pmRow['id']] = $pmRow['payment_method'];
                    }
                }

                $skippedItems = [];
                foreach ($items as $it) {
                    $trackingNumber = trim((string) ($it['tracking_number'] ?? ''));
                    if ($trackingNumber === '')
                        continue;

                    // Check if tracking exists in a DIFFERENT document (from pre-fetched map)
                    $oldRecord = $existingMap[$trackingNumber] ?? null;
                    $forceImport = (bool) ($it['force_import'] ?? false);
                    if ($oldRecord && $oldRecord['document_id'] && (int) $oldRecord['document_id'] !== (int) $id) {
                        if (!$forceImport) {
                            $skippedItems[] = ['tracking_number' => $trackingNumber, 'existing_document_id' => (int) $oldRecord['document_id']];
                            continue;
                        }
                    }

                    $codAmount = (float) ($it['cod_amount'] ?? 0);
                    $orderAmount = (float) ($it['order_amount'] ?? 0);

                    // Determine status and orderId
                    $orderId = isset($it['order_id']) && $it['order_id'] !== '' ? trim((string) $it['order_id']) : null;
                    $status = $it['status'] ?? 'pending';
                    // Only override to 'forced' (no order association) for truly unmatched forced rows
                    if ((bool) ($it['force_import'] ?? false) && !$orderId) {
                        $status = 'forced';
                    }

                    $difference = $codAmount - $orderAmount;

                    $itemStmt->execute([
                        $id, // document_id
                        $trackingNumber,
                        $orderId,
                        $codAmount,
                        $orderAmount,
                        $orderAmount, // received_amount
                        $difference,
                        $status,
                        $doc['company_id'],
                        $createdBy
                    ]);

                    // Update order_boxes.collected_amount (from pre-fetched map)
                    // GUARD: Skip for non-COD orders to avoid trigger rejection
                    if (!$forceImport) {
                        $trackingRow = $trackingBoxMap[$trackingNumber] ?? null;
                        if ($trackingRow && $trackingRow['box_number'] !== null) {
                            $boxOrderId = $trackingRow['parent_order_id'] ?? $trackingRow['order_id'];
                            $boxPaymentMethod = $orderPaymentMethodMap[$boxOrderId] ?? null;
                            if ($boxPaymentMethod === 'COD') {
                                $boxNumber = (int) $trackingRow['box_number'];
                                $updateBoxCollectedStmt->execute([$boxOrderId, $boxNumber, $boxOrderId, $boxNumber]);
                            }
                        }
                    }

                    $addedInputTotal += $codAmount;
                    $addedOrderTotal += $orderAmount;
                }

                // Update document totals
                if ($addedInputTotal > 0 || $addedOrderTotal > 0) {
                    $updateTotalsStmt = $pdo->prepare('UPDATE cod_documents SET 
                        total_input_amount = total_input_amount + ?,
                        total_order_amount = total_order_amount + ?,
                        updated_at = NOW()
                        WHERE id = ?');
                    $updateTotalsStmt->execute([$addedInputTotal, $addedOrderTotal, $id]);
                }

                $patchResponse = ['ok' => true, 'added_count' => count($items), 'added_input_total' => $addedInputTotal];
                if (!empty($skippedItems)) {
                    $patchResponse['skipped'] = $skippedItems;
                    $patchResponse['skipped_count'] = count($skippedItems);
                }
                json_response($patchResponse);
            }

            // Existing logic for updating document metadata (statement matching, etc.)
            $updates = [];
            $params = [];
            $statementProvided = false;
            $statementId = $in['matched_statement_log_id'] ?? $in['statement_log_id'] ?? $in['statementLogId'] ?? null;
            if ($statementId !== null) {
                $statementProvided = true;
                if ($statementId !== '') {
                    $statementId = (int) $statementId;
                    $stmtInfo = $pdo->prepare("
                        SELECT sl.id, sb.company_id
                        FROM statement_logs sl
                        INNER JOIN statement_batchs sb ON sb.id = sl.batch_id
                        WHERE sl.id = ?
                    ");
                    $stmtInfo->execute([$statementId]);
                    $stmtRow = $stmtInfo->fetch(PDO::FETCH_ASSOC);
                    if (!$stmtRow) {
                        json_response(['error' => 'STATEMENT_NOT_FOUND'], 404);
                    }
                    if ((int) $stmtRow['company_id'] !== (int) $doc['company_id']) {
                        json_response(['error' => 'STATEMENT_COMPANY_MISMATCH'], 400);
                    }
                } else {
                    $statementId = null;
                }
                $updates[] = 'matched_statement_log_id = ?';
                $params[] = $statementId;
            }

            $statusProvided = array_key_exists('status', $in);
            if ($statusProvided) {
                $updates[] = 'status = ?';
                $params[] = (string) $in['status'];
            } elseif ($statementProvided) {
                $updates[] = 'status = ?';
                $params[] = $statementId ? 'verified' : 'pending';
            }

            if (array_key_exists('verified_by', $in) || array_key_exists('verifiedBy', $in) || array_key_exists('user_id', $in)) {
                $verifier = $in['verified_by'] ?? $in['verifiedBy'] ?? $in['user_id'] ?? null;
                $updates[] = 'verified_by = ?';
                $params[] = $verifier ? (int) $verifier : null;
            }

            $verifiedAtProvided = array_key_exists('verified_at', $in) || array_key_exists('verifiedAt', $in);
            if ($verifiedAtProvided) {
                $raw = $in['verified_at'] ?? $in['verifiedAt'];
                $verifiedAt = $raw ? date('Y-m-d H:i:s', strtotime((string) $raw)) : null;
                $updates[] = 'verified_at = ?';
                $params[] = $verifiedAt;
            } elseif ($statementProvided && $statementId) {
                $updates[] = 'verified_at = ?';
                $params[] = date('Y-m-d H:i:s');
            }

            if (empty($updates)) {
                json_response(['ok' => true]);
            }

            $updates[] = 'updated_at = NOW()';
            $params[] = $id;
            $sql = 'UPDATE cod_documents SET ' . implode(', ', $updates) . ' WHERE id = ?';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            json_response(['ok' => true]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_cod_records(PDO $pdo, ?string $id): void
{
    // Ensure schema before any operation (covers direct cod_records API use)
    ensure_cod_schema($pdo);

    switch (method()) {
        case 'GET':
            if ($id) {
                $stmt = $pdo->prepare('SELECT * FROM cod_records WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            } else {
                $companyId = $_GET['companyId'] ?? null;
                $trackingNumber = $_GET['trackingNumber'] ?? null;
                $status = $_GET['status'] ?? null;
                $sql = 'SELECT cr.*, cd.document_number FROM cod_records cr LEFT JOIN cod_documents cd ON cr.document_id = cd.id WHERE 1=1';
                $params = [];
                if ($companyId) {
                    $sql .= ' AND cr.company_id = ?';
                    $params[] = $companyId;
                }
                if ($trackingNumber) {
                    $sql .= ' AND cr.tracking_number LIKE ?';
                    $params[] = '%' . $trackingNumber . '%';
                }
                $orderId = $_GET['orderId'] ?? null;
                if ($orderId) {
                    $sql .= ' AND cr.order_id LIKE ?';
                    $params[] = $orderId . '%';
                }
                if ($status) {
                    $sql .= ' AND cr.status = ?';
                    $params[] = $status;
                }
                $sql .= ' ORDER BY cr.created_at DESC';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                json_response($stmt->fetchAll());
            }
            break;
        case 'POST':
            $in = json_input();
            $trackingNumber = $in['tracking_number'] ?? '';
            $orderId = $in['order_id'] ?? ($in['orderId'] ?? null);
            $deliveryStartDate = $in['delivery_start_date'] ?? null;
            $deliveryEndDate = $in['delivery_end_date'] ?? null;
            $codAmount = isset($in['cod_amount']) ? (float) $in['cod_amount'] : 0;
            $orderAmount = isset($in['order_amount']) ? (float) $in['order_amount'] : null;
            $receivedAmount = isset($in['received_amount']) ? (float) $in['received_amount'] : 0;
            if ($orderAmount === null) {
                $orderAmount = $receivedAmount;
            }
            $companyId = $in['company_id'] ?? null;
            $createdBy = $in['created_by'] ?? null;
            $documentId = $in['document_id'] ?? null;

            if (!$trackingNumber || !$companyId) {
                json_response(['error' => 'VALIDATION_FAILED', 'message' => 'tracking_number and company_id are required'], 400);
            }

            $difference = $codAmount - ($orderAmount ?? 0);
            $status = 'pending';
            if ($orderId && $orderAmount !== null && $orderAmount > 0) {
                $status = abs($difference) < 0.01 ? 'matched' : 'unmatched';
            } elseif ($receivedAmount === 0) {
                $status = 'missing';
            } elseif ($receivedAmount === $codAmount) {
                $status = 'received';
            } elseif ($receivedAmount > 0) {
                $status = 'partial';
            }

            $stmt = $pdo->prepare('INSERT INTO cod_records (tracking_number, order_id, delivery_start_date, delivery_end_date, cod_amount, order_amount, received_amount, difference, status, company_id, created_by, document_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
            $stmt->execute([
                $trackingNumber,
                $orderId ?: null,
                $deliveryStartDate,
                $deliveryEndDate,
                $codAmount,
                $orderAmount,
                $orderAmount ?? $receivedAmount,
                $difference,
                $status,
                $companyId,
                $createdBy,
                $documentId ?: null,
            ]);
            json_response(['id' => $pdo->lastInsertId()]);
            break;
        case 'PATCH':
            if (!$id)
                json_response(['error' => 'ID_REQUIRED'], 400);
            $in = json_input();
            $updates = [];
            $params = [];

            if (isset($in['order_id'])) {
                $updates[] = 'order_id = ?';
                $params[] = $in['order_id'] !== '' ? $in['order_id'] : null;
            }
            if (isset($in['order_amount'])) {
                $updates[] = 'order_amount = ?';
                $params[] = (float) $in['order_amount'];
            }
            if (isset($in['received_amount'])) {
                $receivedAmount = (float) $in['received_amount'];
                $updates[] = 'received_amount = ?';
                $params[] = $receivedAmount;

                // Recalculate difference and status
                $stmt = $pdo->prepare('SELECT cod_amount, order_amount FROM cod_records WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                if ($row) {
                    $codAmount = (float) $row['cod_amount'];
                    $orderAmount = isset($row['order_amount']) ? (float) $row['order_amount'] : $receivedAmount;
                    $difference = $codAmount - ($orderAmount ?? $receivedAmount);
                    $status = 'pending';
                    if ($receivedAmount === 0) {
                        $status = 'missing';
                    } elseif ($receivedAmount === $codAmount) {
                        $status = 'received';
                    } elseif ($receivedAmount > 0) {
                        $status = 'partial';
                    }

                    $updates[] = 'difference = ?';
                    $params[] = $difference;
                    $updates[] = 'status = ?';
                    $params[] = $status;
                }
            }

            if (isset($in['order_amount']) && !isset($in['received_amount'])) {
                $stmt = $pdo->prepare('SELECT cod_amount, received_amount, order_id FROM cod_records WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                if ($row) {
                    $codAmount = (float) $row['cod_amount'];
                    $receivedAmount = isset($row['received_amount']) ? (float) $row['received_amount'] : (float) $in['order_amount'];
                    $difference = $codAmount - (float) $in['order_amount'];
                    $status = 'pending';
                    if (!empty($row['order_id'])) {
                        $status = abs($difference) < 0.01 ? 'matched' : 'unmatched';
                    } elseif ($receivedAmount === 0) {
                        $status = 'missing';
                    } elseif ($receivedAmount === $codAmount) {
                        $status = 'received';
                    } elseif ($receivedAmount > 0) {
                        $status = 'partial';
                    }
                    $updates[] = 'difference = ?';
                    $params[] = $difference;
                    $updates[] = 'status = ?';
                    $params[] = $status;
                }
            }

            if (isset($in['status'])) {
                $updates[] = 'status = ?';
                $params[] = $in['status'];
            }

            if (empty($updates)) {
                json_response(['ok' => true]);
            }

            $params[] = $id;
            $sql = 'UPDATE cod_records SET ' . implode(', ', $updates) . ' WHERE id = ?';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            json_response(['ok' => true]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_tags(PDO $pdo, ?string $id): void
{
    switch (method()) {
        case 'GET':
            $type = isset($_GET['type']) ? strtoupper((string) $_GET['type']) : null;
            $userId = isset($_GET['userId']) ? (int) $_GET['userId'] : null;

            // Filter by type and owner when requested
            if ($type === 'SYSTEM') {
                $stmt = $pdo->prepare('SELECT * FROM tags WHERE type = ? ORDER BY id');
                $stmt->execute(['SYSTEM']);
                json_response($stmt->fetchAll());
                break;
            }

            if ($type === 'USER' && $userId) {
                $stmt = $pdo->prepare('SELECT t.* FROM tags t JOIN user_tags ut ON ut.tag_id = t.id WHERE t.type = ? AND ut.user_id = ? ORDER BY t.id');
                $stmt->execute(['USER', $userId]);
                json_response($stmt->fetchAll());
                break;
            }

            // Fallback: return all tags (used by admin screens)
            $stmt = $pdo->query('SELECT * FROM tags ORDER BY id');
            json_response($stmt->fetchAll());
            break;
        case 'POST':
            $in = json_input();
            $tagType = strtoupper($in['type'] ?? 'USER');
            $userId = $in['userId'] ?? null;
            $name = trim((string) ($in['name'] ?? ''));
            $color = $in['color'] ?? null;

            if ($name === '') {
                json_response(['error' => 'VALIDATION_FAILED', 'message' => 'Name is required'], 400);
            }

            // If creating a USER tag, check limit (10 tags per user)
            if ($tagType === 'USER' && $userId) {
                $countStmt = $pdo->prepare('SELECT COUNT(*) FROM user_tags ut JOIN tags t ON t.id = ut.tag_id WHERE ut.user_id = ? AND t.type = \'USER\'');
                $countStmt->execute([$userId]);
                $tagCount = (int) $countStmt->fetchColumn();
                if ($tagCount >= 10) {
                    json_response(['error' => 'TAG_LIMIT_REACHED', 'message' => 'User has reached the maximum limit of 10 tags'], 400);
                    return;
                }
            }

            // Check for existing tag with the same name/type
            if ($tagType === 'USER' && $userId) {
                // Check ONLY if THIS user already owns a tag with this name
                $existingStmt = $pdo->prepare('
                    SELECT t.id 
                    FROM tags t 
                    JOIN user_tags ut ON ut.tag_id = t.id 
                    WHERE t.name = ? AND t.type = ? AND ut.user_id = ? 
                    LIMIT 1
                ');
                $existingStmt->execute([$name, $tagType, $userId]);
            } else {
                // For SYSTEM tags, check globally
                $existingStmt = $pdo->prepare('SELECT id FROM tags WHERE name = ? AND type = ? LIMIT 1');
                $existingStmt->execute([$name, $tagType]);
            }
            $existingId = (int) $existingStmt->fetchColumn();

            if ($existingId) {
                // If found, it already belongs to this user (or is a SYSTEM tag)
                json_response(['id' => $existingId, 'existing' => true]);
                break;
            }

            $stmt = $pdo->prepare('INSERT INTO tags (name, type, color) VALUES (?, ?, ?)');
            $stmt->execute([
                $name,
                $tagType,
                $color ?? null
            ]);
            $tagId = (int) $pdo->lastInsertId();

            // If creating a USER tag, link it to the user in user_tags table
            if ($tagType === 'USER' && $userId) {
                try {
                    $linkStmt = $pdo->prepare('INSERT INTO user_tags (user_id, tag_id) VALUES (?, ?)');
                    $linkStmt->execute([$userId, $tagId]);
                } catch (Throwable $e) {
                    // If linking fails, delete the tag we just created
                    $pdo->prepare('DELETE FROM tags WHERE id = ?')->execute([$tagId]);
                    json_response(['error' => 'LINK_FAILED', 'message' => $e->getMessage()], 500);
                    return;
                }
            }

            json_response(['id' => $tagId]);
            break;
        case 'PUT':
        case 'PATCH':
            if (!$id)
                json_response(['error' => 'ID_REQUIRED'], 400);
            try {
                $in = json_input();
                $updates = [];
                $params = [];

                if (isset($in['name'])) {
                    $updates[] = 'name = ?';
                    $params[] = $in['name'];
                }
                if (isset($in['color'])) {
                    $updates[] = 'color = ?';
                    $params[] = $in['color'];
                }

                if (empty($updates)) {
                    json_response(['error' => 'NO_UPDATES'], 400);
                    return;
                }

                $params[] = $id;
                $stmt = $pdo->prepare('UPDATE tags SET ' . implode(', ', $updates) . ' WHERE id = ?');
                $stmt->execute($params);
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                json_response(['error' => 'UPDATE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        case 'DELETE':
            if (!$id)
                json_response(['error' => 'ID_REQUIRED'], 400);
            $tagId = (int) $id;
            if ($tagId <= 0)
                json_response(['error' => 'INVALID_ID'], 400);
            try {
                $pdo->beginTransaction();

                // First check if tag exists
                $checkStmt = $pdo->prepare('SELECT id, name, type FROM tags WHERE id = ?');
                $checkStmt->execute([$tagId]);
                $tag = $checkStmt->fetch(PDO::FETCH_ASSOC);

                if (!$tag) {
                    $pdo->rollBack();
                    json_response(['error' => 'NOT_FOUND'], 404);
                    return;
                }

                // Clean up tag references manually (in case foreign key cascade doesn't work)
                // This ensures data is cleaned up even if CASCADE constraints are missing
                $customerTagsStmt = $pdo->prepare('DELETE FROM customer_tags WHERE tag_id = ?');
                $customerTagsStmt->execute([$tagId]);
                $customerTagsDeleted = $customerTagsStmt->rowCount();

                $userTagsStmt = $pdo->prepare('DELETE FROM user_tags WHERE tag_id = ?');
                $userTagsStmt->execute([$tagId]);
                $userTagsDeleted = $userTagsStmt->rowCount();

                // Finally delete the tag itself
                // Foreign key CASCADE should handle the above, but we do it manually to be sure
                $stmt = $pdo->prepare('DELETE FROM tags WHERE id = ?');
                $stmt->execute([$tagId]);

                $deletedRows = $stmt->rowCount();

                if ($deletedRows === 0) {
                    $pdo->rollBack();
                    json_response(['error' => 'DELETE_FAILED', 'message' => 'Tag could not be deleted'], 500);
                    return;
                }

                $pdo->commit();
                json_response([
                    'ok' => true,
                    'deleted' => [
                        'tag' => true,
                        'customer_tags' => $customerTagsDeleted,
                        'user_tags' => $userTagsDeleted
                    ]
                ]);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                error_log("Tag deletion failed for tag_id=$tagId: " . $e->getMessage());
                json_response(['error' => 'DELETE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_customer_tags(PDO $pdo): void
{
    $user = get_authenticated_user($pdo);
    if (!$user) {
        json_response(['error' => 'UNAUTHORIZED'], 401);
    }
    $authUserId = $user['id'];

    switch (method()) {
        case 'GET':
            try {
                $customerId = $_GET['customerId'] ?? null;
                if ($customerId) {
                    $stmt = $pdo->prepare('SELECT ct.customer_id, t.id, t.name, t.type, t.color FROM customer_tags ct JOIN tags t ON t.id=ct.tag_id LEFT JOIN user_tags ut ON ut.tag_id = t.id WHERE ct.customer_id=? AND (ut.user_id IS NULL OR ut.user_id = ?) ORDER BY t.name');
                    $stmt->execute([$customerId, $authUserId]);
                    json_response($stmt->fetchAll());
                } else {
                    // Stream JSON output row-by-row to avoid OOM on large datasets
                    $companyId = $_GET['companyId'] ?? null;
                    if ($companyId) {
                        $stmt = $pdo->prepare('SELECT ct.customer_id, t.id, t.name, t.type, t.color FROM customer_tags ct JOIN tags t ON t.id=ct.tag_id JOIN customers c ON c.customer_id=ct.customer_id LEFT JOIN user_tags ut ON ut.tag_id = t.id WHERE c.company_id=? AND (ut.user_id IS NULL OR ut.user_id = ?) ORDER BY ct.customer_id, t.name');
                        $stmt->execute([$companyId, $authUserId]);
                    } else {
                        $stmt = $pdo->prepare('SELECT ct.customer_id, t.id, t.name, t.type, t.color FROM customer_tags ct JOIN tags t ON t.id=ct.tag_id LEFT JOIN user_tags ut ON ut.tag_id = t.id WHERE (ut.user_id IS NULL OR ut.user_id = ?) ORDER BY ct.customer_id, t.name');
                        $stmt->execute([$authUserId]);
                    }
                    // Stream output to avoid loading everything into memory
                    http_response_code(200);
                    header('Content-Type: application/json; charset=utf-8');
                    echo '[';
                    $first = true;
                    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                        if (!$first)
                            echo ',';
                        echo json_encode($row, JSON_UNESCAPED_UNICODE);
                        $first = false;
                    }
                    echo ']';
                    exit();
                }
            } catch (Throwable $e) {
                json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        case 'POST':
            try {
                $in = json_input();
                $cid = $in['customerId'] ?? '';
                $tid = $in['tagId'] ?? 0;

                // Resolve customer_id if it's a ref_id
                $findStmt = $pdo->prepare('SELECT customer_id FROM customers WHERE customer_id = ? OR customer_ref_id = ? LIMIT 1');
                $findStmt->execute([$cid, $cid]);
                $customer = $findStmt->fetch();

                if ($customer) {
                    $stmt = $pdo->prepare('INSERT IGNORE INTO customer_tags (customer_id, tag_id) VALUES (?, ?)');
                    $stmt->execute([$customer['customer_id'], $tid]);
                    json_response(['ok' => true]);
                } else {
                    json_response(['error' => 'CUSTOMER_NOT_FOUND', 'message' => "Customer not found: $cid"], 404);
                }
            } catch (Throwable $e) {
                json_response(['error' => 'INSERT_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        case 'DELETE':
            try {
                $customerId = $_GET['customerId'] ?? '';
                $tagId = $_GET['tagId'] ?? '';
                if ($customerId === '' || $tagId === '')
                    json_response(['error' => 'MISSING_PARAMS'], 400);
                $stmt = $pdo->prepare('DELETE FROM customer_tags WHERE customer_id=? AND tag_id=?');
                $stmt->execute([$customerId, $tagId]);
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                json_response(['error' => 'DELETE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_activities(PDO $pdo, ?string $id): void
{
    switch (method()) {
        case 'GET':
            if ($id) {
                $stmt = $pdo->prepare('SELECT * FROM activities WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            } else {
                $cid = $_GET['customerId'] ?? null;
                $sql = 'SELECT a.* FROM activities a';
                $params = [];
                if ($cid) {
                    // ถ้าเป็นตัวเลข ให้ query ด้วย customer_id โดยตรง
                    // ถ้าเป็น string ให้ join กับ customers เพื่อหา customer_id จาก customer_ref_id
                    if (is_numeric($cid)) {
                        $sql .= ' WHERE a.customer_id=?';
                        $params[] = (int) $cid;
                    } else {
                        // หา customer_id จาก customer_ref_id
                        $findStmt = $pdo->prepare('SELECT customer_id FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
                        $findStmt->execute([$cid, is_numeric($cid) ? (int) $cid : null]);
                        $customer = $findStmt->fetch();
                        if ($customer && $customer['customer_id']) {
                            $sql .= ' WHERE a.customer_id=?';
                            $params[] = (int) $customer['customer_id'];
                        } else {
                            // ถ้าหาไม่เจอ ให้ return empty array
                            json_response([]);
                            return;
                        }
                    }
                }
                $sql .= ' ORDER BY a.timestamp DESC';
                $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 0;
                if ($limit > 0) {
                    $sql .= " LIMIT $limit";
                }
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                json_response($stmt->fetchAll());
            }
            break;
        case 'POST':
            $in = json_input();
            $serverTime = date('Y-m-d H:i:s');
            $stmt = $pdo->prepare('INSERT INTO activities (customer_id, timestamp, type, description, actor_name) VALUES (?,?,?,?,?)');
            $stmt->execute([
                $in['customerId'] ?? null,
                $serverTime,
                $in['type'] ?? '',
                $in['description'] ?? '',
                $in['actorName'] ?? ''
            ]);
            json_response(['id' => $pdo->lastInsertId(), 'timestamp' => $serverTime]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_customer_logs(PDO $pdo, ?string $id): void
{
    if (method() !== 'GET') {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
        return;
    }

    $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 50;
    if ($limit <= 0) {
        $limit = 50;
    } elseif ($limit > 200) {
        $limit = 200;
    }

    if ($id) {
        $stmt = $pdo->prepare(
            'SELECT cl.*, CONCAT(u.first_name, " ", u.last_name) AS created_by_name
             FROM customer_logs cl
             LEFT JOIN users u ON cl.created_by = u.id
             WHERE cl.id = ?'
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
        return;
    }

    $customerId = $_GET['customerId'] ?? null;
    $params = [];
    $sql = 'SELECT cl.*, CONCAT(u.first_name, " ", u.last_name) AS created_by_name
            FROM customer_logs cl
            LEFT JOIN users u ON cl.created_by = u.id';
    if ($customerId) {
        $sql .= ' WHERE cl.customer_id = ?';
        $params[] = $customerId;
    }
    $sql .= ' ORDER BY cl.created_at DESC LIMIT ' . $limit;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    json_response($stmt->fetchAll());
}

/**
 * Get Upsell orders for a Telesale user
 * Returns orders with upsell_user_id = userId and order_status = pending
 */
function handle_upsell_orders(PDO $pdo): void
{
    if (method() !== 'GET') {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
        return;
    }

    $userId = $_GET['userId'] ?? null;
    $companyId = $_GET['companyId'] ?? 1;

    if (!$userId) {
        json_response(['error' => 'USER_ID_REQUIRED'], 400);
        return;
    }

    // Get pending orders assigned to this user for Upsell
    $sql = "SELECT o.*, 
                   c.first_name, c.last_name, c.phone, c.email,
                   c.customer_ref_id,
                   (SELECT GROUP_CONCAT(CONCAT(p.product_name, ' x', oi.quantity) SEPARATOR ', ')
                    FROM order_items oi 
                    LEFT JOIN products p ON p.id = oi.product_id 
                    WHERE oi.order_id = o.id) as items_summary
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            WHERE o.upsell_user_id = ?
              AND o.order_status = 'pending'
              AND o.company_id = ?
            ORDER BY o.order_date DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$userId, $companyId]);
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

    json_response([
        'orders' => $orders,
        'count' => count($orders)
    ]);
}

function handle_do_dashboard(PDO $pdo): void
{
    if (method() !== 'GET') {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
        return;
    }

    $userId = $_GET['userId'] ?? null;
    $companyId = $_GET['companyId'] ?? null;

    if (!$userId) {
        json_response(['error' => 'USER_ID_REQUIRED'], 400);
        return;
    }

    // Get current time
    $now = new DateTime();
    $twoDaysLater = clone $now;
    $twoDaysLater->modify('+2 days');
    $fiveDaysLater = clone $now;
    $fiveDaysLater->modify('+5 days');
    $today = $now->format('Y-m-d');

    // Get customers assigned to the user
    $sql = "SELECT c.*,
                   (SELECT COUNT(*) FROM appointments a WHERE a.customer_id = c.customer_id AND a.status != 'เสร็จสิ้น' AND a.date <= ?) as upcoming_appointments,
                   (SELECT COUNT(*) FROM activities act WHERE act.customer_id = c.customer_id) as activity_count
            FROM customers c
            WHERE c.assigned_to = ?";

    $params = [$twoDaysLater->format('Y-m-d H:i:s'), $userId];

    if ($companyId) {
        $sql .= " AND c.company_id = ?";
        $params[] = $companyId;
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $customers = $stmt->fetchAll();

    // Filter customers for the Do dashboard
    $doCustomers = [];
    $counts = [
        'followUp' => 0,
        'expiring' => 0,
        'daily' => 0,
        'new' => 0
    ];

    foreach ($customers as $customer) {
        $includeCustomer = false;

        // Check for upcoming follow-ups (due within 2 days)
        if ($customer['upcoming_appointments'] > 0) {
            $includeCustomer = true;
            $counts['followUp']++;
        }
        // Check for expiring ownership (within 5 days)
        else if ($customer['ownership_expires'] && new DateTime($customer['ownership_expires']) <= $fiveDaysLater && new DateTime($customer['ownership_expires']) >= $now) {
            $includeCustomer = true;
            $counts['expiring']++;
        }
        // Check for daily distribution customers with no activity
        else if ($customer['lifecycle_status'] === 'DailyDistribution' && $customer['activity_count'] == 0) {
            $assignedDate = new DateTime($customer['date_assigned']);
            $assignedDate->setTime(0, 0, 0);
            $todayDate = new DateTime($today);
            if ($assignedDate->format('Y-m-d') === $todayDate->format('Y-m-d')) {
                $includeCustomer = true;
                $counts['daily']++;
            }
        }
        // Check for new customers with no activity
        else if ($customer['lifecycle_status'] === 'New' && $customer['activity_count'] == 0) {
            $includeCustomer = true;
            $counts['new']++;
        }

        if ($includeCustomer) {
            // Add tags to customer
            $tagStmt = $pdo->prepare('SELECT t.* FROM tags t JOIN customer_tags ct ON ct.tag_id=t.id LEFT JOIN user_tags ut ON ut.tag_id = t.id WHERE ct.customer_id=? AND (ut.user_id IS NULL OR ut.user_id = ?)');
            $tagStmt->execute([$customer['id'], $userId]);
            $customer['tags'] = $tagStmt->fetchAll();

            $doCustomers[] = $customer;
        }
    }

    // Sort customers: 1) With appointments (by nearest date), 2) DailyDistribution (by date_assigned), 3) New (by date_assigned)
    // First, get nearest appointment date for each customer with appointments
    $customerIdsWithAppointments = [];
    foreach ($doCustomers as $customer) {
        if ($customer['upcoming_appointments'] > 0) {
            $customerIdsWithAppointments[] = $customer['customer_id'];
        }
    }

    $appointmentDates = [];
    if (!empty($customerIdsWithAppointments)) {
        $placeholders = implode(',', array_fill(0, count($customerIdsWithAppointments), '?'));
        $apptStmt = $pdo->prepare("
            SELECT customer_id, MIN(DATE(date)) as nearest_date 
            FROM appointments 
            WHERE customer_id IN ($placeholders) 
            AND status != 'เสร็จสิ้น'
            AND DATE(date) >= CURDATE()
            GROUP BY customer_id
        ");
        $apptStmt->execute($customerIdsWithAppointments);
        while ($row = $apptStmt->fetch()) {
            $appointmentDates[$row['customer_id']] = $row['nearest_date'];
        }
    }

    // Sort the customers
    usort($doCustomers, function ($a, $b) use ($appointmentDates) {
        $aHasAppt = $a['upcoming_appointments'] > 0;
        $bHasAppt = $b['upcoming_appointments'] > 0;

        // Priority: 1 = appointments, 2 = DailyDistribution, 3 = New, 4 = others
        $getPriority = function ($c) {
            if ($c['upcoming_appointments'] > 0)
                return 1;
            if ($c['lifecycle_status'] === 'DailyDistribution')
                return 2;
            if ($c['lifecycle_status'] === 'New')
                return 3;
            return 4;
        };

        $aPriority = $getPriority($a);
        $bPriority = $getPriority($b);

        if ($aPriority !== $bPriority) {
            return $aPriority - $bPriority;
        }

        // Within same priority
        if ($aHasAppt && $bHasAppt) {
            // Sort by nearest appointment date ASC
            $aDate = $appointmentDates[$a['customer_id']] ?? '9999-12-31';
            $bDate = $appointmentDates[$b['customer_id']] ?? '9999-12-31';
            return strcmp($aDate, $bDate);
        }

        // For DailyDistribution and New, sort by date_assigned DESC
        $aAssigned = $a['date_assigned'] ?? '1970-01-01';
        $bAssigned = $b['date_assigned'] ?? '1970-01-01';
        return strcmp($bAssigned, $aAssigned); // DESC
    });

    json_response([
        'customers' => $doCustomers,
        'counts' => $counts
    ]);
}
function handle_permissions(PDO $pdo): void
{
    // Ensure table exists
    $pdo->exec('CREATE TABLE IF NOT EXISTS role_permissions (
        role VARCHAR(64) PRIMARY KEY,
        data TEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;');

    switch (method()) {
        case 'GET':
            $role = $_GET['role'] ?? '';
            if ($role === '')
                json_response(['error' => 'ROLE_REQUIRED'], 400);
            $stmt = $pdo->prepare('SELECT data FROM role_permissions WHERE role = ?');
            $stmt->execute([$role]);
            $row = $stmt->fetch();
            $data = null;
            if ($row && isset($row['data'])) {
                $decoded = json_decode($row['data'], true);
                $data = is_array($decoded) ? $decoded : null;
            }
            json_response(['role' => $role, 'data' => $data]);
        case 'PUT':
        case 'POST':
            $in = json_input();
            $role = $in['role'] ?? '';
            $data = $in['data'] ?? [];
            if ($role === '')
                json_response(['error' => 'ROLE_REQUIRED'], 400);
            $json = json_encode($data);
            $stmt = $pdo->prepare('INSERT INTO role_permissions(role, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data=VALUES(data)');
            $stmt->execute([$role, $json]);
            json_response(['ok' => true]);
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

// ==================== Companies Handler ====================
function handle_companies(PDO $pdo, ?string $id): void
{
    // Authenticate
    $user = get_authenticated_user($pdo);
    if (!$user) {
        json_response(['error' => 'UNAUTHORIZED'], 401);
    }
    $companyId = $user['company_id'];
    $isSuperAdmin = ($user['role'] === 'Super Admin' || $user['role'] === 'Developer');
    // Admin Control / Admin System manage cross-company features (e.g. Price Announcements'
    // "show to other companies too" picker) and need to see every company, not just their own.
    $canSeeAllCompanies = $isSuperAdmin || in_array($user['role'], ['Admin Control', 'Admin System'], true);

    switch (method()) {
        case 'GET':
            if ($id) {
                // If specific ID requested, ensure it belongs to user's company (unless they can see all)
                $sql = 'SELECT * FROM companies WHERE id = ?';
                $params = [$id];
                if (!$canSeeAllCompanies) {
                    $sql .= ' AND id = ?';
                    $params[] = $companyId;
                }
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $row = $stmt->fetch();
                $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            } else {
                // List companies: only show user's company unless they can see all
                $sql = 'SELECT * FROM companies';
                $params = [];
                if (!$canSeeAllCompanies) {
                    $sql .= ' WHERE id = ?';
                    $params[] = $companyId;
                }
                $sql .= ' ORDER BY id ASC';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                json_response($stmt->fetchAll());
            }
            break;
        case 'POST':
            $in = json_input();
            $name = $in['name'] ?? '';
            if (!$name)
                json_response(['error' => 'NAME_REQUIRED'], 400);

            $address = $in['address'] ?? null;
            $phone = $in['phone'] ?? null;
            $email = $in['email'] ?? null;
            $taxId = $in['taxId'] ?? null;

            $stmt = $pdo->prepare('INSERT INTO companies (name, address, phone, email, tax_id) VALUES (?, ?, ?, ?, ?)');
            $stmt->execute([$name, $address, $phone, $email, $taxId]);
            json_response(['id' => $pdo->lastInsertId()]);
            break;
        case 'PATCH':
            if (!$id)
                json_response(['error' => 'ID_REQUIRED'], 400);
            $in = json_input();

            $updates = [];
            $params = [];
            if (isset($in['name'])) {
                $updates[] = 'name = ?';
                $params[] = $in['name'];
            }
            if (isset($in['address'])) {
                $updates[] = 'address = ?';
                $params[] = $in['address'];
            }
            if (isset($in['phone'])) {
                $updates[] = 'phone = ?';
                $params[] = $in['phone'];
            }
            if (isset($in['email'])) {
                $updates[] = 'email = ?';
                $params[] = $in['email'];
            }
            if (isset($in['taxId'])) {
                $updates[] = 'tax_id = ?';
                $params[] = $in['taxId'];
            }

            if (empty($updates))
                json_response(['ok' => true]);

            $params[] = $id;
            $sql = 'UPDATE companies SET ' . implode(', ', $updates) . ' WHERE id = ?';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            json_response(['ok' => true]);
            break;
        case 'DELETE':
            if (!$id)
                json_response(['error' => 'ID_REQUIRED'], 400);
            $stmt = $pdo->prepare('DELETE FROM companies WHERE id = ?');
            $stmt->execute([$id]);
            json_response(['ok' => true]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

// ==================== Warehouses Handler ====================
function handle_warehouses(PDO $pdo, ?string $id): void
{
    switch (method()) {
        case 'GET':
            if ($id) {
                $stmt = $pdo->prepare('SELECT w.*, c.name as company_name FROM warehouses w LEFT JOIN companies c ON w.company_id = c.id WHERE w.id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                if ($row) {
                    $row['responsible_provinces'] = json_decode($row['responsible_provinces'] ?? '[]', true);
                    json_response($row);
                } else {
                    json_response(['error' => 'NOT_FOUND'], 404);
                }
            } else {
                $companyId = $_GET['companyId'] ?? null;
                $sql = 'SELECT w.*, c.name as company_name FROM warehouses w LEFT JOIN companies c ON w.company_id = c.id';
                $params = [];
                if ($companyId) {
                    $sql .= ' WHERE w.company_id = ?';
                    $params[] = $companyId;
                }
                $sql .= ' ORDER BY w.id ASC';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $rows = $stmt->fetchAll();
                foreach ($rows as &$row) {
                    $row['responsible_provinces'] = json_decode($row['responsible_provinces'] ?? '[]', true);
                }
                json_response($rows);
            }
            break;
        case 'POST':
            $in = json_input();
            $name = $in['name'] ?? '';
            $companyId = $in['companyId'] ?? null;
            $address = $in['address'] ?? '';
            $province = $in['province'] ?? '';
            $district = $in['district'] ?? '';
            $subdistrict = $in['subdistrict'] ?? '';
            $managerName = $in['managerName'] ?? '';

            if (!$name || !$companyId || !$address || !$province || !$district || !$subdistrict || !$managerName) {
                json_response(['error' => 'REQUIRED_FIELDS_MISSING'], 400);
            }

            $postalCode = $in['postalCode'] ?? null;
            $phone = $in['phone'] ?? null;
            $email = $in['email'] ?? null;
            $managerPhone = $in['managerPhone'] ?? null;
            $responsibleProvinces = json_encode($in['responsibleProvinces'] ?? []);
            $isActive = isset($in['isActive']) ? ($in['isActive'] ? 1 : 0) : 1;

            $stmt = $pdo->prepare('INSERT INTO warehouses (name, company_id, address, province, district, subdistrict, postal_code, phone, email, manager_name, manager_phone, responsible_provinces, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([$name, $companyId, $address, $province, $district, $subdistrict, $postalCode, $phone, $email, $managerName, $managerPhone, $responsibleProvinces, $isActive]);
            json_response(['id' => $pdo->lastInsertId()]);
            break;
        case 'PATCH':
            if (!$id)
                json_response(['error' => 'ID_REQUIRED'], 400);
            $in = json_input();

            $updates = [];
            $params = [];
            if (isset($in['name'])) {
                $updates[] = 'name = ?';
                $params[] = $in['name'];
            }
            if (isset($in['companyId'])) {
                $updates[] = 'company_id = ?';
                $params[] = $in['companyId'];
            }
            if (isset($in['address'])) {
                $updates[] = 'address = ?';
                $params[] = $in['address'];
            }
            if (isset($in['province'])) {
                $updates[] = 'province = ?';
                $params[] = $in['province'];
            }
            if (isset($in['district'])) {
                $updates[] = 'district = ?';
                $params[] = $in['district'];
            }
            if (isset($in['subdistrict'])) {
                $updates[] = 'subdistrict = ?';
                $params[] = $in['subdistrict'];
            }
            if (isset($in['postalCode'])) {
                $updates[] = 'postal_code = ?';
                $params[] = $in['postalCode'];
            }
            if (isset($in['phone'])) {
                $updates[] = 'phone = ?';
                $params[] = $in['phone'];
            }
            if (isset($in['email'])) {
                $updates[] = 'email = ?';
                $params[] = $in['email'];
            }
            if (isset($in['managerName'])) {
                $updates[] = 'manager_name = ?';
                $params[] = $in['managerName'];
            }
            if (isset($in['managerPhone'])) {
                $updates[] = 'manager_phone = ?';
                $params[] = $in['managerPhone'];
            }
            if (isset($in['responsibleProvinces'])) {
                $updates[] = 'responsible_provinces = ?';
                $params[] = json_encode($in['responsibleProvinces']);
            }
            if (isset($in['isActive'])) {
                $updates[] = 'is_active = ?';
                $params[] = $in['isActive'] ? 1 : 0;
            }

            if (empty($updates))
                json_response(['ok' => true]);

            $params[] = $id;
            $sql = 'UPDATE warehouses SET ' . implode(', ', $updates) . ' WHERE id = ?';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            json_response(['ok' => true]);
            break;
        case 'DELETE':
            if (!$id)
                json_response(['error' => 'ID_REQUIRED'], 400);
            $stmt = $pdo->prepare('DELETE FROM warehouses WHERE id = ?');
            $stmt->execute([$id]);
            json_response(['ok' => true]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}


function handle_suppliers(PDO $pdo, ?string $id): void
{
    switch (method()) {
        case 'GET':
            if ($id) {
                $stmt = $pdo->prepare('SELECT * FROM suppliers WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            } else {
                $companyId = $_GET['companyId'] ?? null;
                $sql = 'SELECT * FROM suppliers';
                $params = [];
                if ($companyId) {
                    $sql .= ' WHERE company_id = ?';
                    $params[] = $companyId;
                }
                $sql .= ' ORDER BY id DESC';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                json_response($stmt->fetchAll());
            }
            break;
        case 'POST':
            $in = json_input();
            $code = trim((string) ($in['code'] ?? ''));
            $name = trim((string) ($in['name'] ?? ''));
            $companyId = $in['companyId'] ?? null;
            if ($code === '' || $name === '' || !$companyId) {
                json_response(['error' => 'VALIDATION_FAILED', 'message' => 'code, name, companyId are required'], 400);
            }
            $contactPerson = $in['contactPerson'] ?? null;
            $phone = $in['phone'] ?? null;
            $email = $in['email'] ?? null;
            $address = $in['address'] ?? null;
            $province = $in['province'] ?? null;
            $taxId = $in['taxId'] ?? null;
            $paymentTerms = $in['paymentTerms'] ?? null;
            $creditLimit = $in['creditLimit'] ?? null;
            $isActive = isset($in['isActive']) ? ($in['isActive'] ? 1 : 0) : 1;
            $notes = $in['notes'] ?? null;
            $stmt = $pdo->prepare('INSERT INTO suppliers (code, name, contact_person, phone, email, address, province, tax_id, payment_terms, credit_limit, company_id, is_active, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
            $stmt->execute([$code, $name, $contactPerson, $phone, $email, $address, $province, $taxId, $paymentTerms, $creditLimit, $companyId, $isActive, $notes]);
            json_response(['id' => $pdo->lastInsertId()], 201);
            break;
        case 'PATCH':
            if (!$id)
                json_response(['error' => 'ID_REQUIRED'], 400);
            $in = json_input();
            $updates = [];
            $params = [];
            $map = [
                'code' => 'code',
                'name' => 'name',
                'contactPerson' => 'contact_person',
                'phone' => 'phone',
                'email' => 'email',
                'address' => 'address',
                'province' => 'province',
                'taxId' => 'tax_id',
                'paymentTerms' => 'payment_terms',
                'creditLimit' => 'credit_limit',
                'companyId' => 'company_id',
                'notes' => 'notes',
            ];
            foreach ($map as $inKey => $col) {
                if (array_key_exists($inKey, $in)) {
                    $updates[] = "$col = ?";
                    $params[] = $in[$inKey];
                }
            }
            if (isset($in['isActive'])) {
                $updates[] = 'is_active = ?';
                $params[] = $in['isActive'] ? 1 : 0;
            }
            if (empty($updates))
                json_response(['ok' => true]);
            $params[] = $id;
            $sql = 'UPDATE suppliers SET ' . implode(', ', $updates) . ' WHERE id = ?';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            json_response(['ok' => true]);
            break;
        case 'DELETE':
            if (!$id)
                json_response(['error' => 'ID_REQUIRED'], 400);
            $stmt = $pdo->prepare('DELETE FROM suppliers WHERE id = ?');
            $stmt->execute([$id]);
            json_response(['ok' => true]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_purchases(PDO $pdo, ?string $id, ?string $action = null): void
{
    if ($action === 'receive' && method() === 'POST') {
        if (!$id)
            json_response(['error' => 'ID_REQUIRED'], 400);
        $in = json_input();
        $receivedDate = $in['receivedDate'] ?? date('Y-m-d');
        $items = is_array($in['items'] ?? null) ? $in['items'] : [];
        if (empty($items))
            json_response(['error' => 'NO_ITEMS'], 400);
        // Load purchase
        $pstmt = $pdo->prepare('SELECT * FROM purchases WHERE id = ?');
        $pstmt->execute([$id]);
        $purchase = $pstmt->fetch();
        if (!$purchase)
            json_response(['error' => 'NOT_FOUND'], 404);
        $warehouseId = (int) $purchase['warehouse_id'];
        $supplierId = (int) $purchase['supplier_id'];
        $purchaseDate = $purchase['purchase_date'];

        try {
            $pdo->beginTransaction();
            foreach ($items as $it) {
                $productId = (int) ($it['productId'] ?? 0);
                $qty = (float) ($it['quantity'] ?? 0);
                $lotNumber = trim((string) ($it['lotNumber'] ?? ''));
                $expiryDate = $it['expiryDate'] ?? null;
                $unitCostOverride = isset($it['unitCost']) ? (float) $it['unitCost'] : null;
                if ($productId <= 0 || $qty <= 0 || $lotNumber === '') {
                    throw new RuntimeException('INVALID_ITEM');
                }
                // Fetch unit cost from purchase_items if not provided
                $uc = $unitCostOverride;
                if ($uc === null) {
                    $ucstmt = $pdo->prepare('SELECT unit_cost FROM purchase_items WHERE purchase_id = ? AND product_id = ? LIMIT 1');
                    $ucstmt->execute([$id, $productId]);
                    $row = $ucstmt->fetch();
                    $uc = $row ? (float) $row['unit_cost'] : 0.0;
                }

                // Upsert product_lots
                $lotIns = $pdo->prepare('INSERT INTO product_lots (lot_number, product_id, warehouse_id, purchase_date, expiry_date, quantity_received, quantity_remaining, unit_cost, supplier_id, status, notes) VALUES (?,?,?,?,?,?,?,?,?,"Active", NULL) ON DUPLICATE KEY UPDATE quantity_received = quantity_received + VALUES(quantity_received), quantity_remaining = quantity_remaining + VALUES(quantity_remaining), unit_cost = VALUES(unit_cost), expiry_date = COALESCE(VALUES(expiry_date), expiry_date)');
                $lotIns->execute([$lotNumber, $productId, $warehouseId, $purchaseDate ?: date('Y-m-d'), $expiryDate, $qty, $qty, $uc, $supplierId]);

                // Upsert warehouse_stocks by warehouse/product/lot
                $sel = $pdo->prepare('SELECT id, quantity FROM warehouse_stocks WHERE warehouse_id = ? AND product_id = ? AND lot_number = ? LIMIT 1');
                $sel->execute([$warehouseId, $productId, $lotNumber]);
                $ws = $sel->fetch();
                if ($ws) {
                    $upd = $pdo->prepare('UPDATE warehouse_stocks SET quantity = quantity + ?, expiry_date = COALESCE(?, expiry_date), purchase_price = COALESCE(?, purchase_price) WHERE id = ?');
                    $upd->execute([(int) $qty, $expiryDate, $uc, $ws['id']]);
                } else {
                    $ins = $pdo->prepare('INSERT INTO warehouse_stocks (warehouse_id, product_id, lot_number, quantity, reserved_quantity, expiry_date, purchase_price, created_at) VALUES (?, ?, ?, ?, 0, ?, ?, NOW())');
                    $ins->execute([$warehouseId, $productId, $lotNumber, (int) $qty, $expiryDate, $uc]);
                }

                // Stock movement (IN)
                $mv = $pdo->prepare('INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity, lot_number, reference_type, reference_id, reason, created_by, created_at) VALUES (?, ?, "IN", ?, ?, "PURCHASE", ?, "Receive", ?, NOW())');
                $mv->execute([$warehouseId, $productId, (int) $qty, $lotNumber, $id, 1]);

                // Update purchase_items received
                if (isset($it['purchaseItemId'])) {
                    $piId = (int) $it['purchaseItemId'];
                    if ($piId > 0) {
                        $pu = $pdo->prepare('UPDATE purchase_items SET received_quantity = received_quantity + ? WHERE id = ?');
                        $pu->execute([$qty, $piId]);
                    }
                } else {
                    $pu = $pdo->prepare('UPDATE purchase_items SET received_quantity = received_quantity + ?, lot_number = COALESCE(?, lot_number) WHERE purchase_id = ? AND product_id = ?');
                    $pu->execute([$qty, $lotNumber, $id, $productId]);
                }
            }

            // Update purchase header
            $pdo->prepare('UPDATE purchases SET received_date = ?, status = (SELECT CASE WHEN SUM(quantity) > SUM(received_quantity) THEN "Partial" ELSE "Received" END FROM purchase_items WHERE purchase_id = ?) WHERE id = ?')
                ->execute([$receivedDate, $id, $id]);

            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction())
                $pdo->rollBack();
            json_response(['error' => 'RECEIVE_FAILED', 'message' => $e->getMessage()], 400);
        }

        // Return updated purchase with items
        $get = $pdo->prepare('SELECT * FROM purchases WHERE id = ?');
        $get->execute([$id]);
        $p = $get->fetch();
        $itemsStmt = $pdo->prepare('SELECT * FROM purchase_items WHERE purchase_id = ?');
        $itemsStmt->execute([$id]);
        $p['items'] = $itemsStmt->fetchAll();
        json_response($p);
        return;
    }

    switch (method()) {
        case 'GET':
            if ($id) {
                $stmt = $pdo->prepare('SELECT * FROM purchases WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                if (!$row)
                    json_response(['error' => 'NOT_FOUND'], 404);
                $items = $pdo->prepare('SELECT * FROM purchase_items WHERE purchase_id = ?');
                $items->execute([$id]);
                $row['items'] = $items->fetchAll();
                json_response($row);
            } else {
                $params = [];
                $sql = 'SELECT p.* FROM purchases p';
                $w = [];
                if (isset($_GET['companyId'])) {
                    $w[] = 'p.company_id = ?';
                    $params[] = $_GET['companyId'];
                }
                if (isset($_GET['supplierId'])) {
                    $w[] = 'p.supplier_id = ?';
                    $params[] = $_GET['supplierId'];
                }
                if (isset($_GET['warehouseId'])) {
                    $w[] = 'p.warehouse_id = ?';
                    $params[] = $_GET['warehouseId'];
                }
                if (isset($_GET['status'])) {
                    $w[] = 'p.status = ?';
                    $params[] = $_GET['status'];
                }
                if ($w) {
                    $sql .= ' WHERE ' . implode(' AND ', $w);
                }
                $sql .= ' ORDER BY p.id DESC';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $rows = $stmt->fetchAll();
                json_response($rows);
            }
            break;
        case 'POST':
            $in = json_input();
            $purchaseNumber = $in['purchaseNumber'] ?? '';
            $supplierId = $in['supplierId'] ?? null;
            $warehouseId = $in['warehouseId'] ?? null;
            $companyId = $in['companyId'] ?? null;
            $purchaseDate = $in['purchaseDate'] ?? date('Y-m-d');
            $expectedDate = $in['expectedDeliveryDate'] ?? null;
            $notes = $in['notes'] ?? null;
            $items = is_array($in['items'] ?? null) ? $in['items'] : [];
            if (!$purchaseNumber || !$supplierId || !$warehouseId || !$companyId || empty($items)) {
                json_response(['error' => 'VALIDATION_FAILED', 'message' => 'purchaseNumber, supplierId, warehouseId, companyId, items required'], 400);
            }
            try {
                $pdo->beginTransaction();
                $ins = $pdo->prepare('INSERT INTO purchases (purchase_number, supplier_id, warehouse_id, company_id, purchase_date, expected_delivery_date, status, payment_status, payment_method, notes, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
                $ins->execute([$purchaseNumber, $supplierId, $warehouseId, $companyId, $purchaseDate, $expectedDate, 'Ordered', 'Unpaid', null, $notes, null]);
                $pid = (int) $pdo->lastInsertId();
                $total = 0.0;
                $pi = $pdo->prepare('INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost, notes) VALUES (?,?,?,?,?)');
                foreach ($items as $it) {
                    $prod = (int) ($it['productId'] ?? 0);
                    $qty = (float) ($it['quantity'] ?? 0);
                    $uc = (float) ($it['unitCost'] ?? 0);
                    $note = $it['notes'] ?? null;
                    if ($prod <= 0 || $qty <= 0)
                        throw new RuntimeException('INVALID_ITEM');
                    $pi->execute([$pid, $prod, $qty, $uc, $note]);
                    $total += ($qty * $uc);
                }
                $upd = $pdo->prepare('UPDATE purchases SET total_amount = ? WHERE id = ?');
                $upd->execute([$total, $pid]);
                $pdo->commit();
                json_response(['id' => $pid], 201);
            } catch (Throwable $e) {
                if ($pdo->inTransaction())
                    $pdo->rollBack();
                json_response(['error' => 'CREATE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        case 'PATCH':
            if (!$id)
                json_response(['error' => 'ID_REQUIRED'], 400);
            $in = json_input();
            $updates = [];
            $params = [];
            $map = [
                'purchaseNumber' => 'purchase_number',
                'supplierId' => 'supplier_id',
                'warehouseId' => 'warehouse_id',
                'companyId' => 'company_id',
                'purchaseDate' => 'purchase_date',
                'expectedDeliveryDate' => 'expected_delivery_date',
                'receivedDate' => 'received_date',
                'totalAmount' => 'total_amount',
                'status' => 'status',
                'paymentStatus' => 'payment_status',
                'paymentMethod' => 'payment_method',
                'notes' => 'notes',
            ];
            foreach ($map as $inKey => $col) {
                if (array_key_exists($inKey, $in)) {
                    $updates[] = "$col = ?";
                    $params[] = $in[$inKey];
                }
            }
            if (empty($updates))
                json_response(['ok' => true]);
            $params[] = $id;
            $sql = 'UPDATE purchases SET ' . implode(', ', $updates) . ' WHERE id = ?';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            json_response(['ok' => true]);
            break;
        case 'DELETE':
            if (!$id)
                json_response(['error' => 'ID_REQUIRED'], 400);
            $stmt = $pdo->prepare('DELETE FROM purchases WHERE id = ?');
            $stmt->execute([$id]);
            json_response(['ok' => true]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_warehouse_stocks(PDO $pdo, ?string $id): void
{
    // Authenticate
    $user = get_authenticated_user($pdo);
    if (!$user) {
        json_response(['error' => 'UNAUTHORIZED'], 401);
    }
    $companyId = $user['company_id'];

    if (method() === 'GET') {
        if ($id) {
            $stmt = $pdo->prepare('SELECT * FROM warehouse_stocks WHERE id = ?');
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            return;
        }
        $params = [];
        $w = [];
        $sql = 'SELECT ws.* FROM warehouse_stocks ws';
        if (isset($_GET['warehouseId'])) {
            $w[] = 'ws.warehouse_id = ?';
            $params[] = $_GET['warehouseId'];
        }
        if (isset($_GET['productId'])) {
            $w[] = 'ws.product_id = ?';
            $params[] = $_GET['productId'];
        }
        if (isset($_GET['lotNumber'])) {
            $w[] = 'ws.lot_number = ?';
            $params[] = $_GET['lotNumber'];
        }

        // Add company filter
        $w[] = 'ws.warehouse_id IN (SELECT id FROM warehouses WHERE company_id = ?)';
        $params[] = $companyId;

        if ($w) {
            $sql .= ' WHERE ' . implode(' AND ', $w);
        }
        $sql .= ' ORDER BY ws.warehouse_id, ws.product_id, ws.lot_number';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        json_response($stmt->fetchAll());
    } else {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_product_lots(PDO $pdo, ?string $id): void
{
    // Authenticate
    $user = get_authenticated_user($pdo);
    if (!$user) {
        json_response(['error' => 'UNAUTHORIZED'], 401);
    }
    $companyId = $user['company_id'];

    if (method() === 'GET') {
        if ($id) {
            $stmt = $pdo->prepare('SELECT pl.* FROM product_lots pl JOIN warehouses w ON w.id = pl.warehouse_id WHERE pl.id = ? AND w.company_id = ?');
            $stmt->execute([$id, $companyId]);
            $row = $stmt->fetch();
            $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            return;
        }
        $params = [];
        $w = [];
        $sql = 'SELECT pl.* FROM product_lots pl JOIN warehouses w ON w.id = pl.warehouse_id';

        $w[] = 'w.company_id = ?';
        $params[] = $companyId;

        if (isset($_GET['warehouseId'])) {
            $w[] = 'pl.warehouse_id = ?';
            $params[] = $_GET['warehouseId'];
        }
        if (isset($_GET['productId'])) {
            $w[] = 'pl.product_id = ?';
            $params[] = $_GET['productId'];
        }
        if (isset($_GET['status'])) {
            $w[] = 'pl.status = ?';
            $params[] = $_GET['status'];
        }
        if (isset($_GET['lotNumber'])) {
            $w[] = 'pl.lot_number = ?';
            $params[] = $_GET['lotNumber'];
        }
        if ($w) {
            $sql .= ' WHERE ' . implode(' AND ', $w);
        }
        $sql .= ' ORDER BY pl.purchase_date DESC, pl.id DESC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        json_response($stmt->fetchAll());
    } elseif (method() === 'POST') {
        // Create new product lot
        $in = json_input();

        // Validate required fields
        if (empty($in['lot_number']) || empty($in['product_id']) || empty($in['warehouse_id']) || empty($in['quantity_received'])) {
            json_response(['error' => 'Missing required fields: lot_number, product_id, warehouse_id, quantity_received'], 400);
            return;
        }

        // Check if lot number already exists for this product
        $checkStmt = $pdo->prepare('SELECT id FROM product_lots WHERE lot_number = ? AND product_id = ?');
        $checkStmt->execute([$in['lot_number'], $in['product_id']]);
        if ($checkStmt->fetch()) {
            json_response(['error' => 'Lot number already exists for this product'], 409);
            return;
        }

        // Insert new lot
        $stmt = $pdo->prepare('
            INSERT INTO product_lots (
                lot_number, product_id, warehouse_id, purchase_date, expiry_date,
                quantity_received, quantity_remaining, unit_cost, status, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');

        $stmt->execute([
            $in['lot_number'],
            $in['product_id'],
            $in['warehouse_id'],
            $in['purchase_date'] ?? date('Y-m-d'),
            $in['expiry_date'] ?? null,
            $in['quantity_received'],
            $in['quantity_received'], // Initial remaining quantity is the same as received
            $in['unit_cost'] ?? 0,
            $in['status'] ?? 'Active',
            $in['notes'] ?? null
        ]);

        // Update warehouse stock
        $updateStockStmt = $pdo->prepare('
            INSERT INTO warehouse_stocks (warehouse_id, product_id, lot_number, quantity, expiry_date, purchase_price, selling_price)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            quantity = quantity + VALUES(quantity),
            expiry_date = VALUES(expiry_date),
            purchase_price = VALUES(purchase_price)
        ');

        $updateStockStmt->execute([
            $in['warehouse_id'],
            $in['product_id'],
            $in['lot_number'],
            $in['quantity_received'],
            $in['expiry_date'] ?? null,
            $in['unit_cost'] ?? 0,
            0 // selling_price - would need to get from product table
        ]);

        // Create stock movement record
        $movementStmt = $pdo->prepare('
            INSERT INTO stock_movements (
                warehouse_id, product_id, lot_number, movement_type, quantity,
                reference_type, reference_id, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ');

        $movementStmt->execute([
            $in['warehouse_id'],
            $in['product_id'],
            $in['lot_number'],
            'IN',
            $in['quantity_received'],
            'LOT',
            $pdo->lastInsertId(),
            $in['notes'] ?? 'Initial stock in'
        ]);

        json_response(['id' => $pdo->lastInsertId()], 201);
    } elseif (method() === 'PUT' && $id) {
        // Update existing product lot
        $in = json_input();

        // Get current lot data
        $currentStmt = $pdo->prepare('SELECT * FROM product_lots WHERE id = ?');
        $currentStmt->execute([$id]);
        $current = $currentStmt->fetch();

        if (!$current) {
            json_response(['error' => 'Lot not found'], 404);
            return;
        }

        // Build update query
        $updateFields = [];
        $updateValues = [];

        if (isset($in['expiry_date'])) {
            $updateFields[] = 'expiry_date = ?';
            $updateValues[] = $in['expiry_date'];
        }

        if (isset($in['unit_cost'])) {
            $updateFields[] = 'unit_cost = ?';
            $updateValues[] = $in['unit_cost'];
        }

        if (isset($in['status'])) {
            $updateFields[] = 'status = ?';
            $updateValues[] = $in['status'];
        }

        if (isset($in['notes'])) {
            $updateFields[] = 'notes = ?';
            $updateValues[] = $in['notes'];
        }

        if (empty($updateFields)) {
            json_response(['error' => 'No fields to update'], 400);
            return;
        }

        $updateFields[] = 'updated_at = NOW()';
        $updateValues[] = $id;

        $updateSql = 'UPDATE product_lots SET ' . implode(', ', $updateFields) . ' WHERE id = ?';
        $updateStmt = $pdo->prepare($updateSql);
        $updateStmt->execute($updateValues);

        json_response(['success' => true]);
    } elseif (method() === 'DELETE' && $id) {
        // Delete product lot
        $stmt = $pdo->prepare('SELECT * FROM product_lots WHERE id = ?');
        $stmt->execute([$id]);
        $lot = $stmt->fetch();

        if (!$lot) {
            json_response(['error' => 'Lot not found'], 404);
            return;
        }

        // Check if lot has been used (quantity remaining < quantity received)
        if ($lot['quantity_remaining'] < $lot['quantity_received']) {
            json_response(['error' => 'Cannot delete lot that has been used'], 409);
            return;
        }

        // Delete the lot
        $deleteStmt = $pdo->prepare('DELETE FROM product_lots WHERE id = ?');
        $deleteStmt->execute([$id]);

        // Update warehouse stock
        $updateStockStmt = $pdo->prepare('
            UPDATE warehouse_stocks
            SET quantity = quantity - ?
            WHERE warehouse_id = ? AND product_id = ? AND lot_number = ?
        ');

        $updateStockStmt->execute([
            $lot['quantity_remaining'],
            $lot['warehouse_id'],
            $lot['product_id'],
            $lot['lot_number']
        ]);

        // Create stock movement record
        $movementStmt = $pdo->prepare('
            INSERT INTO stock_movements (
                warehouse_id, product_id, lot_number, movement_type, quantity,
                reference_type, reference_id, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ');

        $movementStmt->execute([
            $lot['warehouse_id'],
            $lot['product_id'],
            $lot['lot_number'],
            'OUT',
            $lot['quantity_remaining'],
            'LOT',
            $id,
            'Lot deletion'
        ]);

        json_response(['success' => true]);
    } else {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_stock_movements(PDO $pdo, ?string $id): void
{
    // Authenticate
    $user = get_authenticated_user($pdo);
    if (!$user) {
        json_response(['error' => 'UNAUTHORIZED'], 401);
    }
    $companyId = $user['company_id'];

    if (method() === 'GET') {
        if ($id) {
            $stmt = $pdo->prepare('SELECT sm.* FROM stock_movements sm JOIN warehouses w ON w.id = sm.warehouse_id WHERE sm.id = ? AND w.company_id = ?');
            $stmt->execute([$id, $companyId]);
            $row = $stmt->fetch();
            $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            return;
        }
        $params = [];
        $w = [];
        $sql = 'SELECT sm.* FROM stock_movements sm JOIN warehouses w ON w.id = sm.warehouse_id';

        $w[] = 'w.company_id = ?';
        $params[] = $companyId;

        if (isset($_GET['warehouseId'])) {
            $w[] = 'sm.warehouse_id = ?';
            $params[] = $_GET['warehouseId'];
        }
        if (isset($_GET['productId'])) {
            $w[] = 'sm.product_id = ?';
            $params[] = $_GET['productId'];
        }
        if (isset($_GET['lotNumber'])) {
            $w[] = 'sm.lot_number = ?';
            $params[] = $_GET['lotNumber'];
        }
        if (isset($_GET['type'])) {
            $w[] = 'sm.movement_type = ?';
            $params[] = $_GET['type'];
        }
        if ($w) {
            $sql .= ' WHERE ' . implode(' AND ', $w);
        }
        $sql .= ' ORDER BY sm.created_at DESC, sm.id DESC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        json_response($stmt->fetchAll());
    } else {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_user_login_history(PDO $pdo, ?string $id): void
{
    switch (method()) {
        case 'GET':
            if ($id) {
                // Get specific login history record
                $stmt = $pdo->prepare('SELECT * FROM user_login_history WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            } else {
                // Get login history with filters
                $userId = $_GET['userId'] ?? null;
                $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 50;
                $offset = isset($_GET['offset']) ? (int) $_GET['offset'] : 0;

                $sql = 'SELECT h.*, u.username, u.first_name, u.last_name
                        FROM user_login_history h
                        JOIN users u ON h.user_id = u.id';
                $params = [];
                $conditions = [];

                if ($userId) {
                    $conditions[] = 'h.user_id = ?';
                    $params[] = $userId;
                }

                if (!empty($conditions)) {
                    $sql .= ' WHERE ' . implode(' AND ', $conditions);
                }

                $sql .= ' ORDER BY h.login_time DESC LIMIT ? OFFSET ?';
                $params[] = $limit;
                $params[] = $offset;

                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                json_response($stmt->fetchAll());
            }
            break;
        case 'POST':
            // Record logout time
            $in = json_input();
            $historyId = $in['historyId'] ?? null;
            if (!$historyId)
                json_response(['error' => 'HISTORY_ID_REQUIRED'], 400);

            try {
                $stmt = $pdo->prepare('SELECT login_time FROM user_login_history WHERE id = ? AND logout_time IS NULL');
                $stmt->execute([$historyId]);
                $record = $stmt->fetch();

                if (!$record) {
                    json_response(['error' => 'INVALID_HISTORY_ID'], 404);
                }

                $loginTime = new DateTime($record['login_time']);
                $logoutTime = new DateTime();
                $duration = $logoutTime->getTimestamp() - $loginTime->getTimestamp();

                $updateStmt = $pdo->prepare('UPDATE user_login_history SET logout_time = NOW(), session_duration = ? WHERE id = ?');
                $updateStmt->execute([$duration, $historyId]);

                json_response(['ok' => true]);
            } catch (Throwable $e) {
                json_response(['error' => 'UPDATE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}


function handle_attendance(PDO $pdo, ?string $id, ?string $action): void
{
    switch (method()) {
        case 'GET':
            // Sub-route: /attendance/report - Pivot table for monthly report
            if ($id === 'report') {
                $month = isset($_GET['month']) ? (int) $_GET['month'] : (int) date('m');
                $year = isset($_GET['year']) ? (int) $_GET['year'] : (int) date('Y');
                $companyId = isset($_GET['companyId']) ? (int) $_GET['companyId'] : null;

                // Get first and last day of month
                $startDate = sprintf('%04d-%02d-01', $year, $month);
                $endDate = date('Y-m-t', strtotime($startDate));
                $daysInMonth = (int) date('t', strtotime($startDate));

                // Build query - join with roles table to get role id for ordering
                $sql = "
                    SELECT 
                        u.id as user_id,
                        u.first_name,
                        u.last_name,
                        u.role,
                        COALESCE(r.id, 999) as role_order,
                        DATE(h.login_time) as work_date,
                        SUM(
                            TIMESTAMPDIFF(SECOND, 
                                h.login_time, 
                                COALESCE(h.logout_time, NOW())
                            )
                        ) as effective_seconds
                    FROM users u
                    LEFT JOIN roles r ON u.role = r.name
                    LEFT JOIN user_login_history h 
                        ON u.id = h.user_id 
                        AND DATE(h.login_time) >= ? 
                        AND DATE(h.login_time) <= ?
                    WHERE u.status = 'active'
                ";
                $params = [$startDate, $endDate];

                if ($companyId) {
                    $sql .= " AND u.company_id = ?";
                    $params[] = $companyId;
                }

                $sql .= " GROUP BY u.id, u.first_name, u.last_name, u.role, r.id, DATE(h.login_time)";
                $sql .= " ORDER BY role_order, u.first_name, DATE(h.login_time)";

                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $rows = $stmt->fetchAll();

                // Get roles ordered by id
                $rolesStmt = $pdo->query("SELECT name FROM roles WHERE is_active = 1 ORDER BY id");
                $orderedRoles = $rolesStmt->fetchAll(PDO::FETCH_COLUMN);

                // Transform to pivot structure
                $userMap = [];
                $roleSet = [];

                foreach ($rows as $row) {
                    $uid = $row['user_id'];
                    $role = $row['role'];

                    if (!isset($userMap[$uid])) {
                        $userMap[$uid] = [
                            'userId' => $uid,
                            'name' => $row['first_name'] . ' ' . $row['last_name'],
                            'role' => $role,
                            'roleOrder' => (int) $row['role_order'],
                            'days' => [],
                            'totalSeconds' => 0,
                            'workDays' => 0,
                        ];
                        $roleSet[$role] = (int) $row['role_order'];
                    }

                    if ($row['work_date']) {
                        $day = (int) date('j', strtotime($row['work_date']));
                        $seconds = (int) $row['effective_seconds'];
                        $hours = $seconds / 3600;
                        $userMap[$uid]['days'][$day] = $seconds;
                        $userMap[$uid]['totalSeconds'] += $seconds;

                        // Work day calculation: ≥4h=1, 2-4h=0.5, <2h=0
                        if ($hours >= 4) {
                            $userMap[$uid]['workDays'] += 1.0;
                        } elseif ($hours >= 2) {
                            $userMap[$uid]['workDays'] += 0.5;
                        }
                        // <2h = 0, don't add anything
                    }
                }

                // Sort roles by their order (from roles table)
                asort($roleSet);
                $roles = array_keys($roleSet);

                // Group by role
                $grouped = [];
                foreach ($roles as $role) {
                    $grouped[$role] = [];
                }
                foreach ($userMap as $user) {
                    $grouped[$user['role']][] = $user;
                }

                json_response([
                    'month' => $month,
                    'year' => $year,
                    'daysInMonth' => $daysInMonth,
                    'roles' => $roles,
                    'data' => $grouped,
                ]);
            }

            // Parameters
            $userId = isset($_GET['userId']) ? (int) $_GET['userId'] : null;
            $companyId = isset($_GET['companyId']) ? (int) $_GET['companyId'] : null;
            $date = $_GET['date'] ?? null;         // yyyy-mm-dd
            $start = $_GET['start'] ?? null;       // yyyy-mm-dd
            $end = $_GET['end'] ?? null;           // yyyy-mm-dd
            $roleOnly = $_GET['roleOnly'] ?? 'telesale'; // telesale|all

            // On-demand recompute to include ongoing sessions (COALESCE(logout_time, NOW()))
            try {
                if ($date) {
                    $stmt = $pdo->prepare('CALL sp_compute_daily_attendance(?)');
                    $stmt->execute([$date]);
                }
            } catch (Throwable $e) {
                json_response(['error' => 'ATTENDANCE_SP_MISSING', 'message' => $e->getMessage()], 500);
            }

            // Choose view/source
            $isKpis = ($id === 'kpis' || $action === 'kpis');
            $base = $isKpis ? 'v_user_daily_kpis' : 'v_user_daily_attendance';
            $sql = "SELECT * FROM {$base} WHERE 1";
            $params = [];

            if ($userId) {
                $sql .= ' AND user_id = ?';
                $params[] = $userId;
            }
            if ($date) {
                $sql .= ' AND work_date = ?';
                $params[] = $date;
            }
            if ($start && $end) {
                $sql .= ' AND work_date BETWEEN ? AND ?';
                $params[] = $start;
                $params[] = $end;
            }
            if ($roleOnly !== 'all') {
                $sql .= " AND role IN ('Telesale','Supervisor Telesale')";
            }
            if ($companyId) {
                $sql .= ' AND user_id IN (SELECT id FROM users WHERE company_id = ?)';
                $params[] = $companyId;
            }

            $sql .= ' ORDER BY work_date DESC, user_id';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            json_response($stmt->fetchAll());

        case 'POST':
            // Sub-actions: /attendance/check_in
            if ($id === 'check_in') {
                $in = json_input();
                $userId = isset($in['userId']) ? (int) $in['userId'] : null;
                if (!$userId) {
                    json_response(['error' => 'USER_ID_REQUIRED'], 400);
                }
                // Guard: ensure user is active and allowed to track attendance
                $uStmt = $pdo->prepare("SELECT role, status FROM users WHERE id = ?");
                $uStmt->execute([$userId]);
                $user = $uStmt->fetch();
                if (!$user) {
                    json_response(['error' => 'NOT_FOUND'], 404);
                }
                if ($user['status'] !== 'active') {
                    json_response(['error' => 'USER_INACTIVE'], 403);
                }
                // All active users can check in (no role restriction)

                $today = (new DateTime('now'))->format('Y-m-d');

                // If there is already a login record today, return it to avoid duplicates
                $exists = $pdo->prepare('SELECT id, login_time FROM user_login_history WHERE user_id = ? AND login_time >= ? AND login_time < DATE_ADD(?, INTERVAL 1 DAY) ORDER BY login_time ASC LIMIT 1');
                $exists->execute([$userId, $today, $today]);
                $row = $exists->fetch();
                if ($row) {
                    // Recompute attendance for today and return current attendance row
                    try {
                        $pdo->prepare('CALL sp_upsert_user_daily_attendance(?, ?)')->execute([$userId, $today]);
                    } catch (Throwable $e) {
                    }
                    $att = $pdo->prepare('SELECT * FROM v_user_daily_attendance WHERE user_id = ? AND work_date = ?');
                    $att->execute([$userId, $today]);
                    json_response(['ok' => true, 'already' => true, 'loginHistoryId' => (int) $row['id'], 'loginTime' => $row['login_time'], 'attendance' => $att->fetch() ?: null]);
                }

                // Create a new login history row (explicit work check-in)
                $ip = $_SERVER['REMOTE_ADDR'] ?? null;
                $ua = $_SERVER['HTTP_USER_AGENT'] ?? null;
                $ins = $pdo->prepare('INSERT INTO user_login_history (user_id, login_time, ip_address, user_agent) VALUES (?, NOW(), ?, ?)');
                $ins->execute([$userId, $ip, $ua]);
                $hid = (int) $pdo->lastInsertId();
                // Compute attendance for today
                try {
                    $pdo->prepare('CALL sp_upsert_user_daily_attendance(?, ?)')->execute([$userId, $today]);
                } catch (Throwable $e) {
                }
                $att = $pdo->prepare('SELECT * FROM v_user_daily_attendance WHERE user_id = ? AND work_date = ?');
                $att->execute([$userId, $today]);
                json_response(['ok' => true, 'loginHistoryId' => $hid, 'attendance' => $att->fetch() ?: null]);
            }

            // Sub-action: /attendance/ping - Heartbeat to keep session alive
            if ($id === 'ping') {
                $in = json_input();
                $userId = isset($in['userId']) ? (int) $in['userId'] : null;
                if (!$userId) {
                    json_response(['error' => 'USER_ID_REQUIRED'], 400);
                }

                $today = (new DateTime('now'))->format('Y-m-d');

                // Find the latest active session for today
                $stmt = $pdo->prepare('
                    SELECT id FROM user_login_history 
                    WHERE user_id = ? 
                      AND login_time >= ? 
                      AND login_time < DATE_ADD(?, INTERVAL 1 DAY)
                      AND logout_time IS NULL 
                    ORDER BY login_time DESC 
                    LIMIT 1
                ');
                $stmt->execute([$userId, $today, $today]);
                $row = $stmt->fetch();

                if ($row) {
                    // Update last_activity
                    $update = $pdo->prepare('UPDATE user_login_history SET last_activity = NOW() WHERE id = ?');
                    $update->execute([$row['id']]);
                    json_response(['ok' => true, 'sessionId' => (int) $row['id']]);
                }

                // No active session - check if user checked in today and auto-resume
                $checkedInToday = $pdo->prepare('
                    SELECT id FROM user_login_history 
                    WHERE user_id = ? 
                      AND login_time >= ? 
                      AND login_time < DATE_ADD(?, INTERVAL 1 DAY)
                    LIMIT 1
                ');
                $checkedInToday->execute([$userId, $today, $today]);

                if ($checkedInToday->fetch()) {
                    // User checked in today, auto-resume with new session
                    $ip = $_SERVER['REMOTE_ADDR'] ?? null;
                    $ua = $_SERVER['HTTP_USER_AGENT'] ?? null;
                    $ins = $pdo->prepare('INSERT INTO user_login_history (user_id, login_time, last_activity, ip_address, user_agent) VALUES (?, NOW(), NOW(), ?, ?)');
                    $ins->execute([$userId, $ip, $ua]);
                    $newId = (int) $pdo->lastInsertId();

                    // Recompute attendance
                    try {
                        $pdo->prepare('CALL sp_upsert_user_daily_attendance(?, ?)')->execute([$userId, $today]);
                    } catch (Throwable $e) {
                    }

                    json_response(['ok' => true, 'sessionId' => $newId, 'resumed' => true]);
                }

                json_response(['ok' => false, 'error' => 'NO_ACTIVE_SESSION'], 404);
            }

            // Sub-action: /attendance/logout - Manual logout when closing browser
            if ($id === 'logout') {
                $in = json_input();
                $userId = isset($in['userId']) ? (int) $in['userId'] : null;
                if (!$userId) {
                    json_response(['error' => 'USER_ID_REQUIRED'], 400);
                }

                $today = (new DateTime('now'))->format('Y-m-d');

                // Close all active sessions for today
                $stmt = $pdo->prepare('
                    UPDATE user_login_history 
                    SET logout_time = NOW(),
                        session_duration = TIMESTAMPDIFF(SECOND, login_time, NOW())
                    WHERE user_id = ? 
                      AND login_time >= ? 
                      AND login_time < DATE_ADD(?, INTERVAL 1 DAY)
                      AND logout_time IS NULL
                ');
                $stmt->execute([$userId, $today, $today]);

                // Recompute attendance
                try {
                    $pdo->prepare('CALL sp_upsert_user_daily_attendance(?, ?)')->execute([$userId, $today]);
                } catch (Throwable $e) {
                }

                json_response(['ok' => true, 'closed' => $stmt->rowCount()]);
            }

            json_response(['error' => 'NOT_FOUND'], 404);
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}




function handle_call_overview(PDO $pdo): void
{
    if (method() !== 'GET') {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }

    $month = $_GET['month'] ?? null; // YYYY-MM
    $userId = isset($_GET['userId']) ? (int) $_GET['userId'] : null;
    $companyId = isset($_GET['companyId']) ? (int) $_GET['companyId'] : null;

    $sql = 'SELECT * FROM v_telesale_call_overview_monthly WHERE 1';
    $params = [];
    if ($month) {
        $sql .= ' AND month_key = ?';
        $params[] = $month;
    }
    if ($userId) {
        $sql .= ' AND user_id = ?';
        $params[] = $userId;
    }
    if ($companyId) {
        $sql .= ' AND user_id IN (SELECT id FROM users WHERE company_id = ?)';
        $params[] = $companyId;
    }
    $sql .= ' ORDER BY month_key DESC, user_id';

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        json_response($stmt->fetchAll());
    } catch (Throwable $e) {
        json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
    }
}

// =============================================
// Notification API Endpoints
// =============================================

// Get notifications for user
function handle_get_notifications(PDO $pdo): void
{
    if (method() !== 'POST') {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }

    $data = json_decode(file_get_contents('php://input'), true);
    $userId = $data['userId'] ?? null;
    $userRole = $data['userRole'] ?? null;
    $limit = $data['limit'] ?? 50;
    $includeRead = !empty($data['includeRead']);

    if (!$userId || !$userRole) {
        json_response(['error' => 'MISSING_PARAMETERS'], 400);
    }

    try {
        // Get notifications for user based on role
        $sql = '
            SELECT DISTINCT n.*,
                   COALESCE(nrs.read_at IS NOT NULL, FALSE) AS is_read_by_user
            FROM notifications n
            LEFT JOIN notification_roles nr ON n.id = nr.notification_id
            LEFT JOIN notification_users nu ON n.id = nu.notification_id
            LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id AND nrs.user_id = ?
            WHERE (nr.role = ? OR nu.user_id = ?)';
        if (!$includeRead) {
            $sql .= '
              AND nrs.read_at IS NULL';
        }
        $sql .= '
            ORDER BY n.timestamp DESC
            LIMIT ?';

        $params = [$userId, $userRole, $userId, $limit];
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $notifications = $stmt->fetchAll();

        json_response(['success' => true, 'notifications' => $notifications]);
    } catch (Throwable $e) {
        json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
    }
}

// Get notification count by category for user
function handle_get_notification_count(PDO $pdo): void
{
    if (method() !== 'POST') {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }

    $data = json_decode(file_get_contents('php://input'), true);
    $userId = $data['userId'] ?? null;
    $userRole = $data['userRole'] ?? null;

    if (!$userId || !$userRole) {
        json_response(['error' => 'MISSING_PARAMETERS'], 400);
    }

    try {
        // Get notification counts by category
        $stmt = $pdo->prepare('
            SELECT n.category, COUNT(*) as count
            FROM notifications n
            LEFT JOIN notification_roles nr ON n.id = nr.notification_id
            LEFT JOIN notification_users nu ON n.id = nu.notification_id
            LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id AND nrs.user_id = ?
            WHERE (nr.role = ? OR nu.user_id = ?)
              AND nrs.read_at IS NULL
            GROUP BY n.category
        ');
        $stmt->execute([$userId, $userRole, $userId]);
        $counts = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

        json_response(['success' => true, 'counts' => $counts]);
    } catch (Throwable $e) {
        json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
    }
}

// Mark notification as read
function handle_mark_notification_as_read(PDO $pdo): void
{
    if (method() !== 'POST') {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }

    $data = json_decode(file_get_contents('php://input'), true);
    $notificationId = $data['notificationId'] ?? null;
    $userId = $data['userId'] ?? null;

    if (!$notificationId || !$userId) {
        json_response(['error' => 'MISSING_PARAMETERS'], 400);
    }

    try {
        // Check if notification exists and user has access
        $stmt = $pdo->prepare('
            SELECT n.id
            FROM notifications n
            LEFT JOIN notification_roles nr ON n.id = nr.notification_id
            LEFT JOIN notification_users nu ON n.id = nu.notification_id
            WHERE n.id = ? AND (nr.role IN (SELECT role FROM users WHERE id = ?) OR nu.user_id = ?)
        ');
        $stmt->execute([$notificationId, $userId, $userId]);

        if (!$stmt->fetch()) {
            json_response(['error' => 'NOT_FOUND_OR_NO_ACCESS'], 404);
        }

        // Mark as read
        $stmt = $pdo->prepare('
            INSERT INTO notification_read_status (notification_id, user_id, read_at)
            VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE read_at = NOW()
        ');
        $stmt->execute([$notificationId, $userId]);

        json_response(['success' => true]);
    } catch (Throwable $e) {
        json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
    }
}

// Mark all notifications as read for user
function handle_mark_all_notifications_as_read(PDO $pdo): void
{
    if (method() !== 'POST') {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }

    $data = json_decode(file_get_contents('php://input'), true);
    $userId = $data['userId'] ?? null;
    $userRole = $data['userRole'] ?? null;

    if (!$userId || !$userRole) {
        json_response(['error' => 'MISSING_PARAMETERS'], 400);
    }

    try {
        // Get all unread notifications for user
        $stmt = $pdo->prepare('
            SELECT n.id
            FROM notifications n
            LEFT JOIN notification_roles nr ON n.id = nr.notification_id
            LEFT JOIN notification_users nu ON n.id = nu.notification_id
            LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id AND nrs.user_id = ?
            WHERE (nr.role = ? OR nu.user_id = ?)
              AND nrs.read_at IS NULL
        ');
        $stmt->execute([$userId, $userRole, $userId]);
        $notificationIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

        // Mark all as read
        if (!empty($notificationIds)) {
            $valuePlaceholders = [];
            $params = [];
            foreach ($notificationIds as $notificationId) {
                $valuePlaceholders[] = '(?, ?, NOW())';
                $params[] = $notificationId;
                $params[] = $userId;
            }

            $sql = "
                INSERT INTO notification_read_status (notification_id, user_id, read_at)
                VALUES " . implode(',', $valuePlaceholders) . "
                ON DUPLICATE KEY UPDATE read_at = NOW()
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
        }

        json_response(['success' => true, 'count' => count($notificationIds)]);
    } catch (Throwable $e) {
        json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
    }
}

// Create new notification
function handle_create_notification(PDO $pdo): void
{
    if (method() !== 'POST') {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }

    $data = json_decode(file_get_contents('php://input'), true);
    $notification = $data['notification'] ?? null;

    if (!$notification) {
        json_response(['error' => 'MISSING_NOTIFICATION'], 400);
    }

    try {
        // Generate unique ID if not provided
        $id = $notification['id'] ?? 'notif_' . uniqid();

        // Insert notification
        $stmt = $pdo->prepare('
            INSERT INTO notifications (
                id, type, category, title, message, priority,
                related_id, page_id, page_name, platform,
                previous_value, current_value, percentage_change,
                action_url, action_text, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $id,
            $notification['type'],
            $notification['category'],
            $notification['title'],
            $notification['message'],
            $notification['priority'],
            $notification['relatedId'] ?? null,
            $notification['pageId'] ?? null,
            $notification['pageName'] ?? null,
            $notification['platform'] ?? null,
            $notification['metrics']['previousValue'] ?? null,
            $notification['metrics']['currentValue'] ?? null,
            $notification['metrics']['percentageChange'] ?? null,
            $notification['actionUrl'] ?? null,
            $notification['actionText'] ?? null,
            $notification['metadata'] ? json_encode($notification['metadata']) : null
        ]);

        // Add roles
        if (!empty($notification['forRoles'])) {
            $stmt = $pdo->prepare('INSERT INTO notification_roles (notification_id, role) VALUES (?, ?)');
            foreach ($notification['forRoles'] as $role) {
                $stmt->execute([$id, $role]);
            }
        }

        // Add specific users
        if (!empty($notification['userId'])) {
            $stmt = $pdo->prepare('INSERT INTO notification_users (notification_id, user_id) VALUES (?, ?)');
            $stmt->execute([$id, $notification['userId']]);
        }

        // Get the created notification
        $stmt = $pdo->prepare('SELECT * FROM notifications WHERE id = ?');
        $stmt->execute([$id]);
        $createdNotification = $stmt->fetch();

        json_response(['success' => true, 'notification' => $createdNotification]);
    } catch (Throwable $e) {
        json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
    }
}

// Get notification settings for user
function handle_get_notification_settings(PDO $pdo): void
{
    if (method() !== 'POST') {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }

    $data = json_decode(file_get_contents('php://input'), true);
    $userId = $data['userId'] ?? null;

    if (!$userId) {
        json_response(['error' => 'MISSING_USER_ID'], 400);
    }

    try {
        $stmt = $pdo->prepare('SELECT * FROM notification_settings WHERE user_id = ?');
        $stmt->execute([$userId]);
        $settings = $stmt->fetchAll();

        json_response(['success' => true, 'settings' => $settings]);
    } catch (Throwable $e) {
        json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
    }
}

// Update notification settings
function handle_update_notification_settings(PDO $pdo): void
{
    if (method() !== 'POST') {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }

    $data = json_decode(file_get_contents('php://input'), true);
    $settings = $data['settings'] ?? null;

    if (!$settings || !isset($settings['userId']) || !isset($settings['notificationType'])) {
        json_response(['error' => 'MISSING_PARAMETERS'], 400);
    }

    try {
        $stmt = $pdo->prepare('
            INSERT INTO notification_settings (
                user_id, notification_type, in_app_enabled, email_enabled, 
                sms_enabled, business_hours_only
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                in_app_enabled = VALUES(in_app_enabled),
                email_enabled = VALUES(email_enabled),
                sms_enabled = VALUES(sms_enabled),
                business_hours_only = VALUES(business_hours_only),
                updated_at = NOW()
        ');
        $stmt->execute([
            $settings['userId'],
            $settings['notificationType'],
            $settings['inAppEnabled'] ?? true,
            $settings['emailEnabled'] ?? false,
            $settings['smsEnabled'] ?? false,
            $settings['businessHoursOnly'] ?? false
        ]);

        // Get the updated setting
        $stmt = $pdo->prepare('
            SELECT * FROM notification_settings 
            WHERE user_id = ? AND notification_type = ?
        ');
        $stmt->execute([$settings['userId'], $settings['notificationType']]);
        $updatedSetting = $stmt->fetch();

        json_response(['success' => true, 'setting' => $updatedSetting]);
    } catch (Throwable $e) {
        json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
    }
}

// Main router for notifications
if ($resource === 'notifications') {
    switch ($action) {
        case 'get':
            handle_get_notifications($pdo);
            break;
        case 'count':
            handle_get_notification_count($pdo);
            break;
        case 'markAsRead':
            handle_mark_notification_as_read($pdo);
            break;
        case 'markAllAsRead':
            handle_mark_all_notifications_as_read($pdo);
            break;
        case 'create':
            handle_create_notification($pdo);
            break;
        case 'settings':
            if ($parts[3] === 'get') {
                handle_get_notification_settings($pdo);
            } elseif ($parts[3] === 'update') {
                handle_update_notification_settings($pdo);
            } else {
                json_response(['error' => 'INVALID_ACTION'], 400);
            }
            break;
        default:
            json_response(['error' => 'INVALID_ACTION'], 400);
    }
}

// Handle POST requests for notifications (for backward compatibility)
if (method() === 'POST' && isset($_POST['action'])) {
    switch ($_POST['action']) {
        case 'getNotifications':
            handle_get_notifications($pdo);
            break;
        case 'getNotificationCount':
            handle_get_notification_count($pdo);
            break;
        case 'markNotificationAsRead':
            handle_mark_notification_as_read($pdo);
            break;
        case 'markAllNotificationsAsRead':
            handle_mark_all_notifications_as_read($pdo);
            break;
        case 'createNotification':
            handle_create_notification($pdo);
            break;
        case 'getNotificationSettings':
            handle_get_notification_settings($pdo);
            break;
        case 'updateNotificationSettings':
            handle_update_notification_settings($pdo);
            break;
    }
}

/**
 * Handle upsell endpoints
 * GET /api/upsell/check?customerId=xxx - Check if customer has orders eligible for upsell
 * GET /api/upsell/orders?customerId=xxx - Get orders eligible for upsell
 * POST /api/upsell/items - Add new items to existing order (upsell)
 */
function handle_upsell(PDO $pdo, ?string $id, ?string $action): void
{
    $method = $_SERVER['REQUEST_METHOD'];

    switch ($method) {
        case 'GET':
            if ($id === 'check') {
                // Check if customer has orders eligible for upsell
                $customerId = $_GET['customerId'] ?? null;
                $requesterId = isset($_GET['userId']) ? (int) $_GET['userId'] : null;
                if (!$customerId) {
                    json_response(['error' => 'CUSTOMER_ID_REQUIRED'], 400);
                    return;
                }

                // Find orders that are eligible for upsell:
                // 1. order_status = 'Pending'
                // 2. No upsell items exist yet (no order_items with creator_id != order.creator_id)
                // 3. creator_id != assigned_to (creator is not the owner)
                $excludeCreatorClause = '';
                $params = [$customerId];
                if ($requesterId !== null) {
                    // Do not surface upsell for orders created by the same requester
                    $excludeCreatorClause = " AND (o.creator_id IS NULL OR o.creator_id != ?)";
                    $params[] = $requesterId;
                }

                $stmt = $pdo->prepare("
                    SELECT COUNT(*) as eligible_count
                    FROM orders o
                    INNER JOIN customers c ON (c.customer_ref_id = o.customer_id OR c.customer_id = o.customer_id)
                    LEFT JOIN users u ON u.id = o.creator_id
                    WHERE (c.customer_id = ? OR c.customer_ref_id = ?)
                    AND o.order_status = 'Pending'
                    {$excludeCreatorClause}
                    AND NOT EXISTS (
                        SELECT 1
                        FROM order_items oi
                        WHERE oi.parent_order_id = o.id
                        AND oi.creator_id != o.creator_id
                    )
                    AND c.assigned_to IS NOT NULL
                    AND c.assigned_to > 0
                    AND o.creator_id != c.assigned_to
                ");
                // Add customerId twice for both conditions
                array_unshift($params, $customerId);
                $stmt->execute($params);
                $result = $stmt->fetch(PDO::FETCH_ASSOC);

                json_response([
                    'hasEligibleOrders' => ($result['eligible_count'] ?? 0) > 0,
                    'eligibleCount' => (int) ($result['eligible_count'] ?? 0)
                ]);
            } else if ($id === 'orders') {
                // Get orders eligible for upsell for a customer
                $customerId = $_GET['customerId'] ?? null;
                $requesterId = isset($_GET['userId']) ? (int) $_GET['userId'] : null;
                if (!$customerId) {
                    json_response(['error' => 'CUSTOMER_ID_REQUIRED'], 400);
                    return;
                }

                // Get orders that are eligible for upsell
                // 1. order_status = 'Pending'
                // 2. No upsell items exist yet (no order_items with creator_id != order.creator_id)
                // 3. creator_id != assigned_to (creator is not the owner)
                $excludeCreatorClause = '';
                $params = [$customerId];
                if ($requesterId !== null) {
                    // Do not surface upsell for orders created by the same requester
                    $excludeCreatorClause = " AND (o.creator_id IS NULL OR o.creator_id != ?)";
                    $params[] = $requesterId;
                }

                $stmt = $pdo->prepare("
                    SELECT o.id, o.order_date, o.delivery_date, o.order_status, o.total_amount, o.creator_id,
                           o.sales_channel_page_id, o.sales_channel, o.payment_method, o.payment_status,
                           o.street, o.subdistrict, o.district, o.province, o.postal_code,
                           o.recipient_first_name, o.recipient_last_name,
                           COUNT(oi.id) as item_count
                    FROM orders o
                    INNER JOIN customers c ON (c.customer_ref_id = o.customer_id OR c.customer_id = o.customer_id)
                    LEFT JOIN users u ON u.id = o.creator_id
                    LEFT JOIN order_items oi ON oi.parent_order_id = o.id
                    WHERE (c.customer_id = ? OR c.customer_ref_id = ?)
                    AND o.order_status = 'Pending'
                    {$excludeCreatorClause}
                    AND NOT EXISTS (
                        SELECT 1
                        FROM order_items oi2
                        WHERE oi2.parent_order_id = o.id
                        AND oi2.creator_id != o.creator_id
                    )
                    AND c.assigned_to IS NOT NULL
                    AND c.assigned_to > 0
                    AND o.creator_id != c.assigned_to
                    GROUP BY o.id
                    ORDER BY o.order_date DESC
                ");
                // Add customerId twice for both conditions
                array_unshift($params, $customerId);
                $stmt->execute($params);
                $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

                // For each order, fetch items with creator_id
                foreach ($orders as &$order) {
                    $orderId = $order['id'];
                    $itemStmt = $pdo->prepare("
                        SELECT oi.id, oi.order_id, oi.product_id, oi.product_name, oi.quantity,
                               oi.price_per_unit, oi.discount, oi.net_total, oi.is_freebie, oi.box_number,
                               oi.promotion_id, oi.parent_item_id, oi.is_promotion_parent,
                               oi.creator_id, oi.parent_order_id,
                               p.sku as product_sku
                        FROM order_items oi
                        LEFT JOIN products p ON oi.product_id = p.id
                        WHERE oi.parent_order_id = ?
                        ORDER BY oi.id
                    ");
                    $itemStmt->execute([$orderId]);
                    $order['items'] = $itemStmt->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($order['items'] as &$orderItem) {
                        if (!isset($orderItem['net_total']) || $orderItem['net_total'] === null) {
                            $orderItem['net_total'] = calculate_order_item_net_total($orderItem);
                        }
                    }
                    unset($orderItem);
                }

                json_response($orders);
            } else if ($id === 'batch-status') {
                // Batch check upsell status for multiple customers
                // Returns: { customerId: { hasUpsell: bool, upsellDone: bool } }
                $userId = isset($_GET['userId']) ? (int) $_GET['userId'] : null;
                $customerIds = isset($_GET['customerIds']) ? explode(',', $_GET['customerIds']) : [];

                if (empty($customerIds)) {
                    json_response(['error' => 'CUSTOMER_IDS_REQUIRED'], 400);
                    return;
                }

                // Limit to 500 customers per request
                $customerIds = array_slice($customerIds, 0, 500);
                $placeholders = implode(',', array_fill(0, count($customerIds), '?'));

                // Query 1: Get customers with eligible upsell orders (hasUpsell)
                // Order is Pending, creator != assigned_to, no upsell items yet
                $upsellEligibleParams = $customerIds;
                if ($userId !== null) {
                    $upsellEligibleParams[] = $userId;
                }

                $excludeCreatorClause = $userId !== null ? " AND o.creator_id != ?" : "";

                $stmt = $pdo->prepare("
                    SELECT DISTINCT c.customer_id
                    FROM orders o
                    INNER JOIN customers c ON (c.customer_ref_id = o.customer_id OR c.customer_id = o.customer_id)
                    WHERE c.customer_id IN ({$placeholders})
                    AND o.order_status = 'Pending'
                    AND c.assigned_to IS NOT NULL
                    AND c.assigned_to > 0
                    AND o.creator_id != c.assigned_to
                    {$excludeCreatorClause}
                    AND NOT EXISTS (
                        SELECT 1 FROM order_items oi
                        WHERE oi.parent_order_id = o.id
                        AND oi.creator_id != o.creator_id
                    )
                ");
                $stmt->execute($upsellEligibleParams);
                $upsellEligible = $stmt->fetchAll(PDO::FETCH_COLUMN);

                // Query 2: Get customers with upsell done orders (has upsell items, still Pending)
                $stmt2 = $pdo->prepare("
                    SELECT DISTINCT c.customer_id
                    FROM orders o
                    INNER JOIN customers c ON (c.customer_ref_id = o.customer_id OR c.customer_id = o.customer_id)
                    WHERE c.customer_id IN ({$placeholders})
                    AND o.order_status = 'Pending'
                    AND EXISTS (
                        SELECT 1 FROM order_items oi
                        WHERE oi.parent_order_id = o.id
                        AND oi.creator_id != o.creator_id
                    )
                ");
                $stmt2->execute($customerIds);
                $upsellDone = $stmt2->fetchAll(PDO::FETCH_COLUMN);

                // Build result map
                $result = [];
                foreach ($customerIds as $cid) {
                    $result[$cid] = [
                        'hasUpsell' => in_array($cid, $upsellEligible),
                        'upsellDone' => in_array($cid, $upsellDone)
                    ];
                }

                json_response($result);
            } else {
                json_response(['error' => 'INVALID_ENDPOINT'], 404);
            }
            break;

        case 'POST':
            if ($id === 'items') {
                // Add new items to existing order (upsell)
                $in = json_input();

                $orderId = $in['orderId'] ?? null;
                $creatorId = $in['creatorId'] ?? null;
                $items = $in['items'] ?? [];

                if (!$orderId || !$creatorId || empty($items)) {
                    json_response(['error' => 'MISSING_REQUIRED_FIELDS', 'message' => 'orderId, creatorId, and items are required'], 400);
                    return;
                }

                // Validate order exists and is eligible for upsell
                $orderCheck = $pdo->prepare("
                    SELECT id, customer_id, order_status, order_date, creator_id, total_amount, payment_method, cod_amount
                    FROM orders
                    WHERE id = ?
                ");
                $orderCheck->execute([$orderId]);
                $order = $orderCheck->fetch(PDO::FETCH_ASSOC);

                if (!$order) {
                    json_response(['error' => 'ORDER_NOT_FOUND'], 404);
                    return;
                }

                // Check if order is eligible for upsell
                if ($order['order_status'] !== 'Pending') {
                    json_response(['error' => 'ORDER_NOT_ELIGIBLE', 'message' => 'Order status must be Pending'], 400);
                    return;
                }

                // Prevent upsell on orders created by the same requester
                $orderCreatorId = isset($order['creator_id']) ? (int) $order['creator_id'] : null;
                if ($orderCreatorId !== null && (int) $creatorId === $orderCreatorId) {
                    json_response(['error' => 'ORDER_NOT_ELIGIBLE', 'message' => 'Upsell is not allowed on orders you created'], 400);
                    return;
                }

                // Time limit removed: Upsell allowed on any Pending order regardless of age

                // Validate creator_id exists and get creator name
                $creatorCheck = $pdo->prepare('SELECT id, status, first_name, last_name FROM users WHERE id = ?');
                $creatorCheck->execute([$creatorId]);
                $creatorData = $creatorCheck->fetch(PDO::FETCH_ASSOC);
                if (!$creatorData || $creatorData['status'] !== 'active') {
                    json_response(['error' => 'INVALID_CREATOR', 'message' => 'Creator user not found or inactive'], 400);
                    return;
                }
                $creatorName = trim(($creatorData['first_name'] ?? '') . ' ' . ($creatorData['last_name'] ?? ''));

                $pdo->beginTransaction();
                try {
                    // Fetch current_basket_key from customer for basket_key_at_sale snapshot
                    $upsellBasketKey = null;
                    $basketStmt = $pdo->prepare('SELECT current_basket_key FROM customers WHERE customer_id = ?');
                    $basketStmt->execute([$order['customer_id']]);
                    $upsellBasketKey = $basketStmt->fetchColumn() ?: null;
                    // Default to basket 38 (ลูกค้าใหม่) if customer not found or has no basket
                    if ($upsellBasketKey === null) {
                        $upsellBasketKey = 38;
                    }

                    $insertedItems = [];
                    // Initialize with existing total amount
                    $newTotalAmount = isset($order['total_amount']) ? (float) $order['total_amount'] : 0.0;
                    // Track additional net total per box for order_boxes
                    $boxNetAdditions = [];

                    // Get max box_number for this order
                    $boxStmt = $pdo->prepare("SELECT COALESCE(MAX(box_number), 0) as max_box FROM order_items WHERE parent_order_id = ?");
                    $boxStmt->execute([$orderId]);
                    $boxResult = $boxStmt->fetch(PDO::FETCH_ASSOC);
                    $currentBoxNumber = (int) ($boxResult['max_box'] ?? 0);

                    // === Two-pass insert: parents first, then link children ===
                    // Map frontend temp IDs (Date.now()) → real DB IDs
                    $tempIdToRealId = [];

                    // Build a map of parent item quantities (frontend temp id → qty)
                    // so child items can use: net_total = price_override × parent_qty
                    $parentQtyMap = [];
                    foreach ($items as $it) {
                        if (!empty($it['isPromotionParent'])) {
                            $fid = $it['id'] ?? null;
                            if ($fid !== null) {
                                $parentQtyMap[$fid] = max(1, (int)($it['quantity'] ?? 1));
                            }
                        }
                    }

                    foreach ($items as $item) {
                        $productId = $item['productId'] ?? null;
                        $productName = $item['productName'] ?? '';
                        $quantity = max(0, (int) ($item['quantity'] ?? 1));
                        $pricePerUnit = isset($item['pricePerUnit']) ? (float) $item['pricePerUnit'] : (float) ($item['price_per_unit'] ?? 0);
                        $pricePerUnit = $pricePerUnit < 0 ? 0.0 : $pricePerUnit;
                        $discount = (float) ($item['discount'] ?? 0);
                        $isFreebie = isset($item['isFreebie']) && $item['isFreebie'] ? 1 : 0;
                        $promotionId = $item['promotionId'] ?? null;

                        $isPromotionParent = isset($item['isPromotionParent']) && $item['isPromotionParent'] ? 1 : 0;

                        // Use priceOverride for promotion child items (non-freebie)
                        $priceOverride = isset($item['priceOverride']) && $item['priceOverride'] !== null && $item['priceOverride'] !== ''
                            ? (float) $item['priceOverride']
                            : null;

                        if ($priceOverride !== null && !$isFreebie) {
                            // child net_total = price_override × parent_qty
                            $rawParentId = $item['parentItemId'] ?? null;
                            $parentQty = ($rawParentId !== null && isset($parentQtyMap[$rawParentId]))
                                ? $parentQtyMap[$rawParentId]
                                : 1;
                            $netTotal = $priceOverride * $parentQty;
                        } else {
                            $netTotal = calculate_order_item_net_total([
                                'quantity' => $quantity,
                                'pricePerUnit' => $pricePerUnit,
                                'discount' => $discount,
                                'isFreebie' => $isFreebie,
                            ]);
                        }

                        // Determine box_number (increment if needed)
                        $boxNumber = $item['boxNumber'] ?? ($currentBoxNumber + 1);
                        if ($boxNumber > $currentBoxNumber) {
                            $currentBoxNumber = $boxNumber;
                        }

                        // Generate order_id (sub order ID)
                        $subOrderId = "{$orderId}-{$boxNumber}";

                        // Pass 1: Insert with parent_item_id = null (will link in pass 2)
                        $itemStmt = $pdo->prepare("
                            INSERT INTO order_items (
                                order_id, parent_order_id, product_id, product_name, quantity,
                                price_per_unit, discount, net_total, is_freebie, box_number,
                                promotion_id, parent_item_id, is_promotion_parent, creator_id, basket_key_at_sale
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ");

                        $itemStmt->execute([
                            $subOrderId,
                            $orderId,
                            $productId,
                            $productName,
                            $quantity,
                            $pricePerUnit,
                            $discount,
                            $netTotal,
                            $isFreebie,
                            $boxNumber,
                            $promotionId,
                            null, // parent_item_id = null initially, linked in pass 2
                            $isPromotionParent,
                            $creatorId,
                            $upsellBasketKey
                        ]);

                        $itemId = (int) $pdo->lastInsertId();

                        // Record temp → real ID mapping (frontend id → db id)
                        $frontendId = $item['id'] ?? null;
                        if ($frontendId !== null) {
                            $tempIdToRealId[$frontendId] = $itemId;
                        }
                        // Also map for isPromotionParent items by their temp id
                        if ($isPromotionParent && $frontendId !== null) {
                            $tempIdToRealId[$frontendId] = $itemId;
                        }

                        // Only add to total for non-child items
                        // Children's net_total is already included in parent's net_total
                        $rawParentItemId = $item['parentItemId'] ?? null;
                        if ($rawParentItemId === null) {
                            $newTotalAmount += $netTotal;

                            // Accumulate net total per box for order_boxes
                            if (!isset($boxNetAdditions[$boxNumber])) {
                                $boxNetAdditions[$boxNumber] = 0.0;
                            }
                            $boxNetAdditions[$boxNumber] += $netTotal;
                        }

                        // Store raw parentItemId from frontend for pass 2
                        $rawParentItemId = $item['parentItemId'] ?? null;

                        $insertedItems[] = [
                            'id' => $itemId,
                            'order_id' => $subOrderId,
                            'parent_order_id' => $orderId,
                            'product_id' => $productId,
                            'product_name' => $productName,
                            'quantity' => $quantity,
                            'price_per_unit' => $pricePerUnit,
                            'discount' => $discount,
                            'net_total' => $netTotal,
                            'is_freebie' => $isFreebie,
                            'box_number' => $boxNumber,
                            'promotion_id' => $promotionId,
                            'parent_item_id' => null, // updated in pass 2
                            'is_promotion_parent' => $isPromotionParent,
                            'creator_id' => $creatorId,
                            '_raw_parent_item_id' => $rawParentItemId, // temp, for pass 2
                        ];
                    }

                    // === Pass 2: Link children's parent_item_id using tempId → realId map ===
                    $updateParentStmt = $pdo->prepare('UPDATE order_items SET parent_item_id = ? WHERE id = ?');
                    foreach ($insertedItems as &$inserted) {
                        $rawParent = $inserted['_raw_parent_item_id'] ?? null;
                        if ($rawParent !== null && isset($tempIdToRealId[$rawParent])) {
                            $realParentId = $tempIdToRealId[$rawParent];
                            $updateParentStmt->execute([$realParentId, $inserted['id']]);
                            $inserted['parent_item_id'] = $realParentId;
                        }
                        unset($inserted['_raw_parent_item_id']);
                    }
                    unset($inserted);

                    // Update order total_amount
                    $updateFields = ["total_amount = ?"];
                    $updateParams = [$newTotalAmount];

                    // If payment method is COD, also update cod_amount
                    if (($order['payment_method'] ?? '') === 'COD') {
                        $updateFields[] = "cod_amount = ?";
                        $updateParams[] = $newTotalAmount;
                    }

                    $updateParams[] = $orderId;
                    $updateOrderStmt = $pdo->prepare("UPDATE orders SET " . implode(', ', $updateFields) . " WHERE id = ?");
                    $updateOrderStmt->execute($updateParams);

                    // Recalculate customer stats if order amount changed
                    if (!empty($order['customer_id'])) {
                        recalculate_customer_stats_safe($pdo, (int)$order['customer_id']);
                    }

                    // Maintain per-box COD/collection amounts in order_boxes for COD orders
                    if (($order['payment_method'] ?? '') === 'COD' && !empty($boxNetAdditions)) {
                        $selectBox = $pdo->prepare('SELECT collection_amount, cod_amount FROM order_boxes WHERE order_id=? AND box_number=? LIMIT 1');
                        $updateBox = $pdo->prepare('UPDATE order_boxes SET collection_amount=?, cod_amount=? WHERE order_id=? AND box_number=?');
                        $insertBox = $pdo->prepare('INSERT INTO order_boxes (order_id, sub_order_id, box_number, payment_method, collection_amount, cod_amount, collected_amount, waived_amount, status) VALUES (?,?,?,?,?,?,?,?,?)');
                        $paymentMethod = $order['payment_method'] ?? 'COD';

                        foreach ($boxNetAdditions as $boxNumber => $addedNet) {
                            $boxNum = (int) $boxNumber;
                            if ($boxNum <= 0) {
                                $boxNum = 1;
                            }
                            $subOrderIdForBox = "{$orderId}-{$boxNum}";

                            $selectBox->execute([$orderId, $boxNum]);
                            $existing = $selectBox->fetch(PDO::FETCH_ASSOC);
                            if ($existing) {
                                $existingCollection = isset($existing['collection_amount']) ? (float) $existing['collection_amount'] : 0.0;
                                $existingCod = isset($existing['cod_amount']) ? (float) $existing['cod_amount'] : 0.0;
                                $newCollection = $existingCollection + $addedNet;
                                $newCod = $existingCod + $addedNet;
                                $updateBox->execute([$newCollection, $newCod, $orderId, $boxNum]);
                            } else {
                                $collectionAmount = (float) $addedNet;
                                $codAmount = (float) $addedNet;
                                $insertBox->execute([
                                    $orderId,
                                    $subOrderIdForBox,
                                    $boxNum,
                                    $paymentMethod,
                                    $collectionAmount,
                                    $codAmount,
                                    0.0,
                                    0.0,
                                    'PENDING',
                                ]);
                            }
                        }
                    }

                    // Create activity log for successful upsell
                    $activityStmt = $pdo->prepare('INSERT INTO activities (customer_id, timestamp, type, description, actor_name) VALUES (?, NOW(), ?, ?, ?)');
                    $itemCount = count($items);
                    $activityDescription = "เพิ่มรายการสินค้าในออเดอร์ {$orderId} (Upsell) - เพิ่ม {$itemCount} รายการ";
                    $activityStmt->execute([
                        $order['customer_id'],
                        'order_status_changed', // ActivityType.OrderStatusChanged
                        $activityDescription,
                        $creatorName ?: 'System'
                    ]);

                    $pdo->commit();

                    // 🎫 HOOK: Record quota usage for upsell items
                    try {
                        $upsellCompanyId = (int)($order['company_id'] ?? 0);
                        $quotaRecorded = recordQuotaUsageForOrder($pdo, $orderId, $upsellCompanyId, (int)$creatorId);
                        if ($quotaRecorded > 0) {
                            error_log("[Quota] Recorded $quotaRecorded quota usage(s) for upsell on order #$orderId");
                        }
                    } catch (Throwable $e) {
                        error_log('[Quota] Failed to record usage for upsell order ' . $orderId . ': ' . $e->getMessage());
                    }

                    json_response([
                        'success' => true,
                        'orderId' => $orderId,
                        'newTotalAmount' => $newTotalAmount,
                        'items' => $insertedItems
                    ], 201);

                } catch (Throwable $e) {
                    $pdo->rollBack();
                    error_log('Upsell error: ' . $e->getMessage());
                    json_response(['error' => 'UPSELL_FAILED', 'message' => $e->getMessage()], 500);
                }
            } else {
                json_response(['error' => 'INVALID_ENDPOINT'], 404);
            }
            break;

        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

// ==================== User Permission Overrides Handler ====================
function handle_user_permissions(PDO $pdo, ?string $userId, ?string $action): void
{
    if (!$userId) {
        json_response(['error' => 'USER_ID_REQUIRED'], 400);
    }

    // GET /api/user_permissions/{userId}/effective - Get effective permissions (Role + Overrides)
    if (method() === 'GET' && $action === 'effective') {
        // Get role permissions
        // FIX: Join by role_id first, fallback to role name (for legacy/mixed support)
        // Use COALESCE to prioritize role_id, prevent multiple matches
        $stmt = $pdo->prepare('
            SELECT rp.data as role_permissions, r.code as role_code
            FROM users u
            LEFT JOIN roles r ON (
                (u.role_id IS NOT NULL AND r.id = u.role_id) OR
                (u.role_id IS NULL AND (r.name = u.role OR r.code = u.role))
            )
            LEFT JOIN role_permissions rp ON rp.role = r.code
            WHERE u.id = ?
            LIMIT 1
        ');
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        $rolePermissions = $row && $row['role_permissions']
            ? json_decode($row['role_permissions'], true)
            : [];

        // Get user overrides
        $stmt = $pdo->prepare('
            SELECT permission_key, permission_value 
            FROM user_permission_overrides 
            WHERE user_id = ?
        ');
        $stmt->execute([$userId]);
        $overrides = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Merge: Override ทับ Role Permission
        // Normalize Role Data: Check if it's new structure (with keys 'permissions', 'menu_order') or legacy (direct map)
        $basePermissions = [];
        $menuOrder = [];

        if (isset($rolePermissions['permissions']) && is_array($rolePermissions['permissions'])) {
            $basePermissions = $rolePermissions['permissions'];
            $menuOrder = $rolePermissions['menu_order'] ?? [];
        } else {
            $basePermissions = $rolePermissions; // Legacy structure
            // Optional: Default menu order (empty implies default system order)
        }

        $effectivePermissions = $basePermissions;
        foreach ($overrides as $override) {
            $key = $override['permission_key'];
            $value = json_decode($override['permission_value'], true);
            $effectivePermissions[$key] = $value;
        }

        json_response([
            'permissions' => $effectivePermissions,
            'menu_order' => $menuOrder,
            'roleCode' => $row['role_code'] ?? null
        ]);
    }

    // GET /api/user_permissions/{userId}/overrides - Get user overrides only
    if (method() === 'GET' && $action === 'overrides') {
        $stmt = $pdo->prepare('
            SELECT id, permission_key, permission_value, notes, created_by, created_at, updated_at
            FROM user_permission_overrides 
            WHERE user_id = ?
            ORDER BY permission_key
        ');
        $stmt->execute([$userId]);
        $overrides = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Decode JSON values
        foreach ($overrides as &$override) {
            $override['permission_value'] = json_decode($override['permission_value'], true);
        }
        unset($override);

        json_response(['overrides' => $overrides]);
    }

    // POST /api/user_permissions/{userId}/overrides - Add/Update override
    if (method() === 'POST' && $action === 'overrides') {
        $input = json_input();
        $permissionKey = $input['permission_key'] ?? '';
        $permissionValue = $input['permission_value'] ?? [];
        $notes = $input['notes'] ?? null;

        if (!$permissionKey) {
            json_response(['error' => 'PERMISSION_KEY_REQUIRED'], 400);
        }

        $stmt = $pdo->prepare('
            INSERT INTO user_permission_overrides 
            (user_id, permission_key, permission_value, notes, created_by) 
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                permission_value = VALUES(permission_value),
                notes = VALUES(notes),
                updated_at = CURRENT_TIMESTAMP
        ');
        $stmt->execute([
            $userId,
            $permissionKey,
            json_encode($permissionValue),
            $notes,
            $_SESSION['user_id'] ?? null
        ]);

        json_response(['message' => 'Override saved successfully']);
    }

    // DELETE /api/user_permissions/{userId}/overrides?key={key} - Delete override
    if (method() === 'DELETE' && $action === 'overrides') {
        $permissionKey = $_GET['key'] ?? '';

        if (!$permissionKey) {
            json_response(['error' => 'PERMISSION_KEY_REQUIRED'], 400);
        }

        $stmt = $pdo->prepare('
            DELETE FROM user_permission_overrides 
            WHERE user_id = ? AND permission_key = ?
        ');
        $stmt->execute([$userId, $permissionKey]);

        json_response(['message' => 'Override deleted successfully']);
    }

    json_response(['error' => 'NOT_FOUND'], 404);
}





function handle_validate_tracking_bulk($pdo)
{
    if (method() !== 'POST') {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }

    $in = json_input();
    if (!isset($in['items']) || !is_array($in['items'])) {
        json_response(['error' => 'INVALID_PAYLOAD', 'message' => 'items must be an array'], 400);
    }

    $results = [];

    // Prepare statements
    $orderLookupInfo = $pdo->prepare("SELECT id FROM orders WHERE id = ?");
    $boxLookupInfo = $pdo->prepare("SELECT order_id, box_number FROM order_boxes WHERE sub_order_id = ?");
    $dupCheck = $pdo->prepare("SELECT order_id FROM order_tracking_numbers WHERE tracking_number = ? LIMIT 1");

    foreach ($in['items'] as $item) {
        $orderId = trim($item['orderId'] ?? '');
        $trackingNumber = trim($item['trackingNumber'] ?? '');

        $res = [
            'orderId' => $orderId,
            'trackingNumber' => $trackingNumber,
            'isValid' => true,
            'status' => 'valid',
            'message' => '',
            'foundOrderId' => null,
            'boxNumber' => null
        ];

        if (!$orderId) {
            $res['isValid'] = false;
            $res['status'] = 'error';
            $res['message'] = 'Missing Order ID';
            $results[] = $res;
            continue;
        }

        // 1. Check Order Existence using robust helper
        $resolved = resolve_main_order_id($pdo, $orderId);
        if ($resolved['found']) {
            $res['foundOrderId'] = $resolved['main_id'];
            $res['boxNumber'] = $resolved['box_number'];
        }

        if (!$res['foundOrderId']) {
            $res['isValid'] = false;
            $res['status'] = 'error';
            $res['message'] = 'Order not found';
        }

        // 2. Check Tracking Number Duplication
        if ($res['isValid'] && $trackingNumber) {
            $dupCheck->execute([$trackingNumber]);
            $existing = $dupCheck->fetch(PDO::FETCH_ASSOC);

            if ($existing) {
                $res['isValid'] = false;
                $res['status'] = 'duplicate';
                $res['message'] = 'Tracking number used by order ' . $existing['order_id'];
            }
        }

        $results[] = $res;
    }

    json_response(['ok' => true, 'results' => $results]);
}

function handle_sync_tracking($pdo)
{
    if (method() !== 'POST') {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }

    $in = json_input();
    if (!isset($in['updates']) || !is_array($in['updates'])) {
        json_response(['error' => 'INVALID_PAYLOAD', 'message' => 'updates must be an array'], 400);
    }

    $pdo->beginTransaction();
    try {
        // Prepare statements
        $checkStmt = $pdo->prepare("SELECT id FROM order_tracking_numbers WHERE parent_order_id = ? AND box_number = ? LIMIT 1");
        $updateStmt = $pdo->prepare("UPDATE order_tracking_numbers SET tracking_number = ? WHERE id = ?");
        $insertStmt = $pdo->prepare("INSERT INTO order_tracking_numbers (parent_order_id, order_id, box_number, tracking_number) VALUES (?, ?, ?, ?)");

        // Update shipping_provider and statuses with GUARD for already-approved payments
        // GUARD: If payment_status is already 'Approved' or 'Paid', don't downgrade to PreApproved
        // and auto-complete to Delivered (payment confirmed + tracking = done)
        $updateOrderStmt = $pdo->prepare("UPDATE orders SET shipping_provider = CASE WHEN ? = '' THEN shipping_provider ELSE ? END, payment_status = CASE WHEN payment_status IN ('Approved', 'Paid') THEN payment_status WHEN order_status IN ('Preparing', 'Picking') AND payment_method = 'Transfer' THEN 'PreApproved' ELSE payment_status END, order_status = CASE WHEN order_status IN ('Preparing', 'Picking') AND payment_status IN ('Approved', 'Paid') THEN 'Delivered' WHEN order_status IN ('Preparing', 'Picking') THEN (CASE WHEN payment_method = 'Transfer' THEN 'PreApproved' ELSE 'Shipping' END) ELSE order_status END WHERE id = ?");

        // Box lookup logic is now handled by resolve_main_order_id

        $results = [];

        foreach ($in['updates'] as $update) {
            $subOrderId = $update['sub_order_id'] ?? $update['order_id'] ?? null;
            $trackingNumber = trim($update['tracking_number'] ?? '');
            $shippingProvider = trim($update['shipping_provider'] ?? '');

            if (!$subOrderId || !$trackingNumber)
                continue;

            // Resolve parent order ID and box number using robust helper
            $resolved = resolve_main_order_id($pdo, $subOrderId);
            $parentOrderId = $resolved['main_id'];
            $boxNumber = $resolved['box_number'];

            // Always use parentOrderId-boxNumber for consistency with order_boxes sub_order_id
            $resolvedSubOrderId = "$parentOrderId-$boxNumber";

            // UPSERT LOGIC
            // Check if tracking record exists for this Parent + Box
            // Note: We use parent_order_id + box_number as the unique constraint concept for tracking numbers
            $checkStmt->execute([$parentOrderId, $boxNumber]);
            $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

            if ($existing) {
                // UPDATE
                $updateStmt->execute([$trackingNumber, $existing['id']]);
                $results[] = [
                    'sub_order_id' => $resolvedSubOrderId,
                    'parent_order_id' => $parentOrderId,
                    'box_number' => $boxNumber,
                    'status' => 'updated'
                ];
            } else {
                // INSERT
                $insertStmt->execute([$parentOrderId, $resolvedSubOrderId, $boxNumber, $trackingNumber]);
                $results[] = [
                    'sub_order_id' => $resolvedSubOrderId,
                    'parent_order_id' => $parentOrderId,
                    'box_number' => $boxNumber,
                    'status' => 'created'
                ];
            }

            // 2. Update statuses (and shipping_provider if present)
            $updateOrderStmt->execute([$shippingProvider, $shippingProvider, $parentOrderId]);
        }

        $pdo->commit();
        json_response(['ok' => true, 'results' => $results]);

    } catch (Exception $e) {
        $pdo->rollBack();
        json_response(['error' => 'SYNC_FAILED', 'message' => $e->getMessage()], 500);
    }
}

function handle_company_settings(PDO $pdo, ?string $id)
{
    $user = get_authenticated_user($pdo);
    if (!$user) {
        json_response(['error' => 'UNAUTHORIZED'], 401);
    }

    $isSystem = false;
    $stmt = $pdo->prepare('SELECT is_system FROM roles WHERE name = ? LIMIT 1');
    $stmt->execute([$user['role']]);
    $roleInfo = $stmt->fetch();
    if ($roleInfo && (int)$roleInfo['is_system'] === 1) {
        $isSystem = true;
    }

    $isSuperAdmin = ($user['role'] === 'Super Admin' || $user['role'] === 'Developer');

    if (!$isSuperAdmin && !$isSystem) {
        json_response(['error' => 'FORBIDDEN', 'message' => 'Not authorized to view settings'], 403);
    }

    if (method() === 'GET') {
        // Query param could specify companyId if SuperAdmin
        $companyId = isset($_GET['companyId']) ? (int)$_GET['companyId'] : (int)$user['company_id'];

        if (!$isSuperAdmin && $companyId !== (int)$user['company_id']) {
            json_response(['error' => 'FORBIDDEN', 'message' => 'Can only view own company settings'], 403);
        }

        $stmt = $pdo->prepare('SELECT `key` as setting_key, `value` as setting_value FROM env WHERE company_id = ?');
        $stmt->execute([$companyId]);
        $settings = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Convert to key-value array
        $result = [];
        foreach ($settings as $row) {
            $result[$row['setting_key']] = $row['setting_value'];
        }

        json_response($result);
    } elseif (method() === 'POST') {
        $in = json_input();
        $companyId = isset($in['companyId']) ? (int)$in['companyId'] : (int)$user['company_id'];

        if (!$isSuperAdmin && $companyId !== (int)$user['company_id']) {
            json_response(['error' => 'FORBIDDEN', 'message' => 'Can only edit own company settings'], 403);
        }

        $settings = $in['settings'] ?? [];
        if (!is_array($settings)) {
            json_response(['error' => 'INVALID_INPUT', 'message' => 'settings must be an object'], 400);
        }

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('INSERT INTO env (company_id, `key`, `value`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)');
            foreach ($settings as $key => $value) {
                $stmt->execute([$companyId, $key, (string)$value]);
            }
            $pdo->commit();
            json_response(['ok' => true]);
        } catch (Exception $e) {
            $pdo->rollBack();
            json_response(['error' => 'SAVE_FAILED', 'message' => $e->getMessage()], 500);
        }
    } else {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function ensure_shopee_loyalty_tables(PDO $pdo): void
{
    $pdo->exec('CREATE TABLE IF NOT EXISTS shopee_loyalty_settings (
        company_id INT PRIMARY KEY,
        spend_per_point DECIMAL(10,2) NOT NULL DEFAULT 1500.00,
        points_for_coupon INT NOT NULL DEFAULT 10,
        coupon_prefix VARCHAR(10) NOT NULL DEFAULT \'CAT3000\',
        coupon_discount DECIMAL(10,2) NOT NULL DEFAULT 300.00,
        coupon_min_spend DECIMAL(10,2) NOT NULL DEFAULT 1500.00,
        coupon_expiry_days INT NOT NULL DEFAULT 30,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    $columns_to_add = [
        "ADD COLUMN coupon_prefix VARCHAR(10) NOT NULL DEFAULT 'CAT3000' AFTER points_for_coupon",
        "ADD COLUMN coupon_discount DECIMAL(10,2) NOT NULL DEFAULT 300.00 AFTER coupon_prefix",
        "ADD COLUMN coupon_min_spend DECIMAL(10,2) NOT NULL DEFAULT 1500.00 AFTER coupon_discount",
        "ADD COLUMN coupon_expiry_days INT NOT NULL DEFAULT 30 AFTER coupon_min_spend",
        "ADD COLUMN baseline_aov DECIMAL(10,2) NOT NULL DEFAULT 696.00 AFTER coupon_expiry_days",
        "ADD COLUMN target_aov DECIMAL(10,2) NOT NULL DEFAULT 850.00 AFTER baseline_aov",
        "ADD COLUMN baseline_repeat_rate DECIMAL(5,2) NOT NULL DEFAULT 17.78 AFTER target_aov",
        "ADD COLUMN target_repeat_rate DECIMAL(5,2) NOT NULL DEFAULT 25.00 AFTER baseline_repeat_rate",
        "ADD COLUMN target_members INT NOT NULL DEFAULT 100 AFTER target_repeat_rate",
        "ADD COLUMN target_10_points INT NOT NULL DEFAULT 20 AFTER target_members",
        "ADD COLUMN target_sales_percent DECIMAL(5,2) NOT NULL DEFAULT 30.00 AFTER target_10_points",
        "ADD COLUMN points_calculation_mode VARCHAR(20) NOT NULL DEFAULT 'capped' AFTER target_sales_percent"
    ];

    foreach ($columns_to_add as $col_def) {
        try {
            $pdo->exec("ALTER TABLE shopee_loyalty_settings $col_def");
        } catch (PDOException $e) {
            // Ignore duplicate column errors
        }
    }

    $pdo->exec('CREATE TABLE IF NOT EXISTS shopee_loyalty_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        shopee_username VARCHAR(255) NOT NULL UNIQUE,
        total_points INT NOT NULL DEFAULT 0,
        company_id INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_shopee_loyalty_members_username (shopee_username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    $pdo->exec('CREATE TABLE IF NOT EXISTS shopee_loyalty_orders (
        order_id VARCHAR(128) PRIMARY KEY,
        shopee_username VARCHAR(255) NOT NULL,
        order_date DATETIME NOT NULL,
        total_amount DECIMAL(12,2) NOT NULL,
        points_earned INT NOT NULL DEFAULT 1,
        company_id INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_shopee_loyalty_orders_username (shopee_username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    $pdo->exec('CREATE TABLE IF NOT EXISTS loyalty_coupons (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(32) NOT NULL UNIQUE,
        shopee_username VARCHAR(255) NOT NULL,
        discount_value DECIMAL(10,2) NOT NULL DEFAULT 300.00,
        min_spend DECIMAL(10,2) NOT NULL DEFAULT 1500.00,
        status VARCHAR(32) NOT NULL DEFAULT "active",
        expiry_date DATETIME NOT NULL,
        company_id INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        used_at DATETIME NULL,
        used_in_order_id VARCHAR(128) NULL,
        INDEX idx_loyalty_coupons_username (shopee_username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    try {
        $pdo->exec("ALTER TABLE loyalty_coupons ADD COLUMN used_in_order_id VARCHAR(128) NULL AFTER used_at");
    } catch (PDOException $e) {
        // Ignore if column already exists
    }

    $pdo->exec('CREATE TABLE IF NOT EXISTS shopee_loyalty_order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(128) NOT NULL,
        sku_reference VARCHAR(500) NULL,
        variation_name VARCHAR(1000) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_shopee_loyalty_order_items_order_id (order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    try {
        $pdo->exec("ALTER TABLE shopee_loyalty_order_items MODIFY COLUMN sku_reference VARCHAR(500) NULL");
        $pdo->exec("ALTER TABLE shopee_loyalty_order_items MODIFY COLUMN variation_name VARCHAR(1000) NULL");
    } catch (PDOException $e) {
        // Ignore errors
    }
}
?>
