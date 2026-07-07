<?php

function handle_orders(PDO $pdo, ?string $id): void
{
    if ($id === 'get_upsell_orders.php') {
        require_once __DIR__ . '/../Orders/get_upsell_orders.php';
        handle_get_upsell_orders($pdo);
        return;
    }
    // Handle sequence endpoint for order ID generation
    if ($id === 'sequence') {
        $datePrefix = $_GET['datePrefix'] ?? '';
        $companyId = isset($_GET['companyId']) ? (int) $_GET['companyId'] : 0;
        $period = $_GET['period'] ?? 'day';
        $monthPrefixParam = $_GET['monthPrefix'] ?? '';

        if (empty($datePrefix) || $companyId <= 0) {
            json_response(['error' => 'INVALID_PARAMS'], 400);
            return;
        }

        // Determine prefix key based on requested period
        if ($period === 'month') {
            $sequencePrefix = $monthPrefixParam !== ''
                ? preg_replace('/[^0-9]/', '', $monthPrefixParam)
                : substr($datePrefix, 0, 4);
            if (strlen($sequencePrefix) < 4) {
                json_response(['error' => 'INVALID_MONTH_PREFIX'], 400);
                return;
            }
        } else {
            if (strlen($datePrefix) < 6) {
                json_response(['error' => 'INVALID_DATE_PREFIX'], 400);
                return;
            }
            $sequencePrefix = substr($datePrefix, 0, 6);
        }

        try {
            $pdo->beginTransaction();
            // Insert row or atomically increase last_sequence
            $insert = $pdo->prepare('INSERT INTO order_sequences (company_id, period, prefix, last_sequence) VALUES (?,?,?,1)
                                     ON DUPLICATE KEY UPDATE last_sequence = last_sequence + 1, updated_at = NOW()');
            $insert->execute([$companyId, $period, $sequencePrefix]);

            $seqStmt = $pdo->prepare('SELECT last_sequence FROM order_sequences WHERE company_id=? AND period=? AND prefix=? FOR UPDATE');
            $seqStmt->execute([$companyId, $period, $sequencePrefix]);
            $nextSequence = (int) $seqStmt->fetchColumn();
            $pdo->commit();
            json_response(['sequence' => max(1, $nextSequence)]);
        } catch (Throwable $e) {
            $pdo->rollBack();
            error_log('Order sequence generation failed: ' . $e->getMessage());
            json_response(['error' => 'SEQUENCE_FAILED'], 500);
        }
        return;
    }

    switch (method()) {
        case 'GET':
            if ($id) {
                $o = get_order($pdo, $id);
                $o ? json_response($o) : json_response(['error' => 'NOT_FOUND'], 404);
            } else {
                // Security: Enforce company_id from authenticated user for non-SuperAdmin
                $user = get_authenticated_user($pdo);
                $authCompanyId = $user['company_id'] ?? null;
                $isSuperAdmin = ($user['role'] ?? '') === 'Super Admin' || ($user['role'] ?? '') === 'Developer';

                if (!$isSuperAdmin && $authCompanyId) {
                    // Override any user-supplied companyId with authenticated user's company
                    $companyId = $authCompanyId;
                } else {
                    $companyId = $_GET['companyId'] ?? null;
                }
                $page = max(1, (int) ($_GET['page'] ?? 1));
                $pageSize = max(1, (int) ($_GET['pageSize'] ?? 50));
                $offset = ($page - 1) * $pageSize;

                // Filter parameters
                $orderId = $_GET['orderId'] ?? null;
                $trackingNumber = $_GET['trackingNumber'] ?? null;
                $orderDateStart = $_GET['orderDateStart'] ?? null;
                $orderDateEnd = $_GET['orderDateEnd'] ?? null;
                $orderTimeStart = $_GET['orderTimeStart'] ?? null;
                $orderTimeEnd = $_GET['orderTimeEnd'] ?? null;
                $deliveryDateStart = $_GET['deliveryDateStart'] ?? null;
                $deliveryDateEnd = $_GET['deliveryDateEnd'] ?? null;
                $paymentMethod = $_GET['paymentMethod'] ?? null;
                $paymentStatus = $_GET['paymentStatus'] ?? null;
                $customerName = $_GET['customerName'] ?? null;
                $customerName = $_GET['customerName'] ?? null;
                $customerPhone = $_GET['customerPhone'] ?? null;
                $customerPhone = $_GET['customerPhone'] ?? null;
                $customerId = $_GET['customerId'] ?? null;
                $creatorId = $_GET['creatorId'] ?? null;
                $orderStatus = $_GET['orderStatus'] ?? null;
                $manageTab = $_GET['tab'] ?? null;
                $returnMode = $_GET['returnMode'] ?? null;

                // Performance: shipping_provider column is known to exist, skip INFORMATION_SCHEMA query
                $selectCols = 'o.id, o.customer_id, o.customer_type, o.company_id, o.creator_id, o.order_date, o.delivery_date, 
                               o.street, o.subdistrict, o.district, o.province, o.postal_code, o.recipient_first_name, o.recipient_last_name,
                               o.shipping_provider';

                $selectCols .= ', o.shipping_cost, o.bill_discount, o.coupon_discount, o.total_amount, o.payment_method, o.payment_status, o.order_status,
                               GROUP_CONCAT(DISTINCT t.tracking_number ORDER BY t.id SEPARATOR ",") AS tracking_numbers,
                               o.amount_paid, o.cod_amount, o.slip_url, o.sales_channel, o.sales_channel_page_id, o.warehouse_id,
                               o.bank_account_id, o.transfer_date,
                               c.first_name as customer_first_name, c.last_name as customer_last_name, c.phone as customer_phone, c.phone as phone,
                               c.street as customer_street, c.subdistrict as customer_subdistrict, c.district as customer_district,
                               c.province as customer_province, c.postal_code as customer_postal_code';

                $sql = "SELECT $selectCols
                        FROM orders o
                        LEFT JOIN order_tracking_numbers t ON t.parent_order_id = o.id
                        LEFT JOIN customers c ON o.customer_id = c.customer_id";

                $params = [];
                $whereConditions = [];

                // Filter out sub orders — use simple LIKE instead of REGEXP for better index use
                $whereConditions[] = "o.id NOT LIKE '%-1' AND o.id NOT LIKE '%-2' AND o.id NOT LIKE '%-3' AND o.id NOT LIKE '%-4' AND o.id NOT LIKE '%-5' AND o.id NOT LIKE '%-6' AND o.id NOT LIKE '%-7' AND o.id NOT LIKE '%-8' AND o.id NOT LIKE '%-9' AND o.id NOT LIKE '%-10'";

                if ($companyId) {
                    $whereConditions[] = 'o.company_id = ?';
                    $params[] = $companyId;
                }

                // Apply filters
                if ($orderId) {
                    $whereConditions[] = 'o.id LIKE ?';
                    $params[] = '%' . $orderId . '%';
                }

                if ($trackingNumber) {
                    if (strpos($trackingNumber, ',') !== false) {
                        $tnArray = array_map('trim', explode(',', $trackingNumber));
                        $tnArray = array_filter($tnArray);
                        if (!empty($tnArray)) {
                            $tnPlaceholders = implode(',', array_fill(0, count($tnArray), '?'));
                            $whereConditions[] = "t.tracking_number IN ($tnPlaceholders)";
                            $params = array_merge($params, $tnArray);
                        }
                    } else {
                        $whereConditions[] = 't.tracking_number LIKE ?';
                        $params[] = '%' . $trackingNumber . '%';
                    }
                }

                if ($orderDateStart) {
                    $whereConditions[] = 'o.order_date >= ?';
                    $params[] = $orderDateStart . ' 00:00:00';
                }

                if ($orderStatus) {
                    if (is_array($orderStatus)) {
                        $placeholders = str_repeat('?,', count($orderStatus) - 1) . '?';
                        $whereConditions[] = "o.order_status IN ($placeholders)";
                        $params = array_merge($params, $orderStatus);
                    } else {
                        $whereConditions[] = 'o.order_status = ?';
                        $params[] = $orderStatus;
                    }
                }

                if ($orderDateEnd) {
                    $whereConditions[] = 'o.order_date <= ?';
                    $params[] = $orderDateEnd . ' 23:59:59';
                }

                if ($orderTimeStart) {
                    $whereConditions[] = 'TIME(o.order_date) >= ?';
                    $params[] = $orderTimeStart;
                }

                if ($orderTimeEnd) {
                    $whereConditions[] = 'TIME(o.order_date) <= ?';
                    $params[] = $orderTimeEnd;
                }

                if ($deliveryDateStart) {
                    $whereConditions[] = 'o.delivery_date >= ?';
                    $params[] = $deliveryDateStart . ' 00:00:00';
                }

                if ($deliveryDateEnd) {
                    $whereConditions[] = 'o.delivery_date <= ?';
                    $params[] = $deliveryDateEnd . ' 23:59:59';
                }

                if ($paymentMethod) {
                    $whereConditions[] = 'o.payment_method = ?';
                    $params[] = $paymentMethod;
                }

                if ($paymentStatus) {
                    if (is_array($paymentStatus)) {
                        $placeholders = str_repeat('?,', count($paymentStatus) - 1) . '?';
                        $whereConditions[] = "o.payment_status IN ($placeholders)";
                        $params = array_merge($params, $paymentStatus);
                    } else {
                        $whereConditions[] = 'o.payment_status = ?';
                        $params[] = $paymentStatus;
                    }
                }

                // Tab-specific filters for ManageOrdersPage
                if ($manageTab) {
                    // Optimized: Try to fetch dynamic rules first (Global rules, ignoring company_id)
                    $ruleStmt = $pdo->prepare("SELECT * FROM order_tab_rules WHERE tab_key = ? AND is_active = 1");
                    $ruleStmt->execute([$manageTab]);
                    $rules = $ruleStmt->fetchAll(PDO::FETCH_ASSOC);

                    if ($rules) {
                        $ruleConditions = [];
                        foreach ($rules as $r) {
                            $conds = [];

                            // payment_method
                            if (!empty($r['payment_method'])) {
                                $conds[] = "o.payment_method = " . $pdo->quote($r['payment_method']);
                            }

                            // payment_status
                            if (!empty($r['payment_status']) && $r['payment_status'] !== 'ALL') {
                                if ($r['payment_status'] === 'NULL') {
                                    $conds[] = "o.payment_status IS NULL";
                                } else {
                                    $statuses = explode(',', $r['payment_status']);
                                    if (count($statuses) > 1) {
                                        $quoted = array_map(function ($s) use ($pdo) {
                                            return $pdo->quote(trim($s));
                                        }, $statuses);
                                        $conds[] = "o.payment_status IN (" . implode(',', $quoted) . ")";
                                    } else {
                                        $conds[] = "o.payment_status = " . $pdo->quote(trim($statuses[0]));
                                    }
                                }
                            }

                            // order_status
                            if (!empty($r['order_status']) && $r['order_status'] !== 'ALL') {
                                $statuses = explode(',', $r['order_status']);
                                if (count($statuses) > 1) {
                                    $quoted = array_map(function ($s) use ($pdo) {
                                        return $pdo->quote(trim($s));
                                    }, $statuses);
                                    $conds[] = "o.order_status IN (" . implode(',', $quoted) . ")";
                                } else {
                                    $conds[] = "o.order_status = " . $pdo->quote(trim($statuses[0]));
                                }
                            }

                            // If a rule exists, treat it as a valid valid condition set
                            // If a rule is completely empty (no criteria), it would match everything (Logic: TRUE)
                            // But usually our UI enforces at least one field.
                            if (!empty($conds)) {
                                $ruleConditions[] = "(" . implode(' AND ', $conds) . ")";
                            }
                        }

                        if (!empty($ruleConditions)) {
                            $whereConditions[] = "(" . implode(' OR ', $ruleConditions) . ")";
                        }
                    } else {
                        // Fallback to legacy hardcoded logic if no dynamic rules found
                        switch ($manageTab) {
                            case 'waitingVerifySlip':
                                // Transfer + Pending Status (Exclude Verified, include NULLs)
                                $whereConditions[] = 'o.order_status = ?';
                                $params[] = 'Pending';
                                $whereConditions[] = 'o.payment_method = ?';
                                $params[] = 'Transfer';
                                $whereConditions[] = '(o.payment_status != ? OR o.payment_status IS NULL)';
                                $params[] = 'Verified';
                                // COD orders must have payment_status = Unpaid
                                $whereConditions[] = '(o.payment_method != ? OR o.payment_status = ?)';
                                $params[] = 'COD';
                                $params[] = 'Unpaid';
                                break;

                            case 'waitingExport':
                                // Pending Status
                                // For Transfer, must be Verified. For others (COD), just Pending.
                                $whereConditions[] = 'o.order_status = ?';
                                $params[] = 'Pending';
                                $whereConditions[] = '(o.payment_method != ? OR o.payment_status = ?)';
                                $params[] = 'Transfer';
                                $params[] = 'Verified';
                                // COD orders must have payment_status = Unpaid
                                $whereConditions[] = '(o.payment_method != ? OR o.payment_status = ?)';
                                $params[] = 'COD';
                                $params[] = 'Unpaid';
                                break;

                            case 'preparing':
                                // Preparing OR Picking
                                $whereConditions[] = 'o.order_status IN (?, ?)';
                                $params[] = 'Preparing';
                                $params[] = 'Picking';
                                // And NO tracking number (handled by NOT having tracking numbers usually)
                                // But status Preparing/Picking implies internal process
                                // COD orders must have payment_status = Unpaid
                                $whereConditions[] = '(o.payment_method != ? OR o.payment_status = ?)';
                                $params[] = 'COD';
                                $params[] = 'Unpaid';
                                break;

                            case 'shipping':
                                // Shipping status OR (Pending/AwaitingVerification AND has tracking)
                                // For simplicity and performance, let's rely on standard status flow or simple checks
                                // Or use the exact logic: Status=Shipping OR (Status IN (Pending, Awaiting) AND t.tracking_number IS NOT NULL)
                                // Getting checking tracking IS NOT NULL with left join can be tricky with Group By?
                                // Actually we have tracking_numbers group concat. 
                                $whereConditions[] = 'o.order_status = ?';
                                $params[] = 'Shipping';
                                // COD orders must have payment_status = Unpaid
                                $whereConditions[] = '(o.payment_method != ? OR o.payment_status = ?)';
                                $params[] = 'COD';
                                $params[] = 'Unpaid';
                                break;

                            case 'awaiting_account':
                                // Show orders where payment_status = PreApproved OR order_status = PreApproved
                                $whereConditions[] = '(o.payment_status = "PreApproved" OR o.order_status = "PreApproved")';
                                $whereConditions[] = 'o.payment_method NOT IN ("Claim", "FreeGift")';
                                break;

                            case 'completed':
                                // User Request: payment_status = Approved (ignore order_status)
                                $whereConditions[] = 'o.payment_status = "Approved"';
                                break;

                            case 'cancelled':
                                // Orders with order_status = Cancelled
                                $whereConditions[] = 'o.order_status = "Cancelled"';
                                break;

                            case 'debtCollection':
                                // Default: Orders with payment_status = Unpaid (debt collection)
                                $whereConditions[] = 'o.payment_status = "Unpaid"';
                                break;
                        }
                    }
                }

                if ($customerName) {
                    $whereConditions[] = '(c.first_name LIKE ? OR c.last_name LIKE ? OR CONCAT(c.first_name, " ", c.last_name) LIKE ?)';
                    $nameLike = '%' . $customerName . '%';
                    $params[] = $nameLike;
                    $params[] = $nameLike;
                    $params[] = $nameLike;
                }

                if ($customerId) {
                    $whereConditions[] = 'o.customer_id = ?';
                    $params[] = $customerId;
                }

                if ($customerPhone) {
                    $phoneDigits = preg_replace('/\D/', '', $customerPhone);
                    $whereConditions[] = 'REPLACE(REPLACE(REPLACE(c.phone, "-", ""), " ", ""), "(", "") LIKE ?';
                    $params[] = '%' . $phoneDigits . '%';
                }

                // New Return Mode Logic: Filter out orders that have any return status in order_boxes
                if ($returnMode === 'pending') {
                    // Pending: No boxes have been verified (all return_status IS NULL)
                    // Or no boxes exist (which conceptually is pending if order is returned?)
                    // Logic: NOT EXISTS any box that IS NOT NULL
                    $whereConditions[] = "NOT EXISTS (
                        SELECT 1 FROM order_boxes ob 
                        WHERE ob.order_id = o.id 
                          AND ob.return_status IS NOT NULL
                    )";
                } elseif ($returnMode === 'partial') {
                    // Partial (Checking): 
                    // 1. At least one box IS NOT NULL (Verified)
                    // 2. AND At least one box IS NULL (Unverified)
                    $whereConditions[] = "EXISTS (
                        SELECT 1 FROM order_boxes ob 
                        WHERE ob.order_id = o.id 
                          AND ob.return_status IS NOT NULL
                    )";
                    $whereConditions[] = "EXISTS (
                        SELECT 1 FROM order_boxes ob 
                        WHERE ob.order_id = o.id 
                          AND ob.return_status IS NULL
                    )";
                } elseif ($returnMode === 'verified') {
                    // Verified:
                    // 1. At least one box IS NOT NULL (Verified) - ensures we don't pick up empty orders as verified
                    // 2. AND NOT EXISTS any box that IS NULL (All are verified)
                    $whereConditions[] = "EXISTS (
                        SELECT 1 FROM order_boxes ob 
                        WHERE ob.order_id = o.id 
                          AND ob.return_status IS NOT NULL
                    )";
                    $whereConditions[] = "NOT EXISTS (
                        SELECT 1 FROM order_boxes ob 
                        WHERE ob.order_id = o.id 
                          AND ob.return_status IS NULL
                    )";
                }

                if ($creatorId) {
                    if (is_array($creatorId)) {
                        $placeholders = str_repeat('?,', count($creatorId) - 1) . '?';
                        $whereConditions[] = "o.creator_id IN ($placeholders)";
                        $params = array_merge($params, $creatorId);
                    } else {
                        $whereConditions[] = 'o.creator_id = ?';
                        $params[] = $creatorId;
                    }
                }

                if (!empty($whereConditions)) {
                    $sql .= ' WHERE ' . implode(' AND ', $whereConditions);
                }

                // Get total count before pagination — lightweight query, minimal JOINs
                $countSql = "SELECT COUNT(*) FROM orders o";

                // Add conditional joins only when filter requires them
                if ($trackingNumber) {
                    $countSql .= " LEFT JOIN order_tracking_numbers t ON t.parent_order_id = o.id";
                }
                if ($customerName || $customerPhone) {
                    $countSql .= " LEFT JOIN customers c ON o.customer_id = c.customer_id";
                }

                if (!empty($whereConditions)) {
                    $countSql .= ' WHERE ' . implode(' AND ', $whereConditions);
                }
                $countStmt = $pdo->prepare($countSql);
                if (!empty($params)) {
                    $countStmt->execute($params);
                } else {
                    $countStmt->execute();
                }
                $total = (int) $countStmt->fetchColumn();
                $totalPages = ceil($total / $pageSize);

                $sql .= ' GROUP BY o.id
                          ORDER BY o.order_date DESC
                          LIMIT ' . $pageSize . ' OFFSET ' . $offset;

                $stmt = $pdo->prepare($sql);
                if (!empty($params)) {
                    $stmt->execute($params);
                } else {
                    $stmt->execute();
                }
                $orders = $stmt->fetchAll();

                // Fetch items for each order
                // Need to include items from sub orders (mainOrderId-1, mainOrderId-2, etc.)
                $orderIds = array_column($orders, 'id');
                $itemsMap = [];
                $slipsMap = [];
                $trackingMap = [];
                $reconcileMap = [];
                $airportMap = [];

                if (!empty($orderIds)) {
                    // Fetch items directly using parent_order_id to get ALL items regardless of box count
                    // This avoids the need to guess or query for max box numbers
                    try {
                        $parentPlaceholders = implode(',', array_fill(0, count($orderIds), '?'));
                        $itemSql = "SELECT oi.id, oi.order_id, oi.product_id, oi.product_name, oi.quantity, 
                                           oi.price_per_unit, oi.discount, oi.net_total, oi.is_freebie, oi.box_number, 
                                           oi.promotion_id, oi.parent_item_id, oi.is_promotion_parent,
                                           oi.creator_id, oi.parent_order_id, oi.basket_key_at_sale,
                                           p.sku as product_sku,
                                           p.category as product_category,
                                           p.report_category as product_report_category,
                                           pr.sku as promotion_sku,
                                           r.id as creator_role_id
                                    FROM order_items oi
                                    LEFT JOIN products p ON oi.product_id = p.id
                                    LEFT JOIN promotions pr ON oi.promotion_id = pr.id
                                    LEFT JOIN users u ON oi.creator_id = u.id
                                    LEFT JOIN roles r ON u.role = r.name
                                    WHERE oi.parent_order_id IN ($parentPlaceholders) OR oi.order_id IN ($parentPlaceholders)
                                    ORDER BY oi.order_id, oi.id";

                        // Execute with orderIds for both parent_order_id and order_id placeholders
                        $itemStmt = $pdo->prepare($itemSql);
                        $params = array_merge($orderIds, $orderIds);
                        $itemStmt->execute($params);
                        $items = $itemStmt->fetchAll();
                    } catch (Throwable $e) {
                        error_log("Failed to fetch order items: " . $e->getMessage());
                        error_log("SQL: " . ($itemSql ?? 'N/A'));
                        error_log("Params count: " . count($params ?? []));
                        error_log("Placeholders count: " . (substr_count($parentPlaceholders ?? '', '?') * 2));
                        $items = [];
                    }

                    // Map items to main order IDs
                    // Items from sub orders (mainOrderId-1, mainOrderId-2) should be mapped to main order (mainOrderId)
                    foreach ($items as $item) {
                        if (!isset($item['net_total']) || $item['net_total'] === null) {
                            $item['net_total'] = calculate_order_item_net_total($item);
                        }
                        // Force SKU from promotion for promotion parents
                        if (!empty($item['promotion_sku']) && !empty($item['is_promotion_parent'])) {
                            $item['sku'] = $item['promotion_sku'];
                        }
                        $itemOrderId = $item['order_id'];
                        // Check if this is a sub order
                        $resolved = resolve_main_order_id($pdo, $itemOrderId);
                        if ($resolved['is_sub']) {
                            $mainOrderId = $resolved['main_id']; // Extract main order ID
                            // Map sub order items to main order
                            if (in_array($mainOrderId, $orderIds)) {
                                $itemsMap[$mainOrderId][] = $item;
                            }
                        } else {
                            // Direct mapping for main order items
                            $itemsMap[$itemOrderId][] = $item;
                        }
                    }

                    // Sort items by box_number for each order to ensure 1, 2, 3... 10 order
                    foreach ($itemsMap as &$orderItems) {
                        usort($orderItems, function ($a, $b) {
                            $boxA = isset($a['box_number']) ? (int) $a['box_number'] : 0;
                            $boxB = isset($b['box_number']) ? (int) $b['box_number'] : 0;

                            if ($boxA > 0 && $boxB > 0) {
                                return $boxA - $boxB;
                            }

                            // Fallback to order_id suffix if box_number is 0/missing
                            $aSuffix = 0;
                            $bSuffix = 0;
                            if (preg_match('/-(\d+)$/', $a['order_id'], $m))
                                $aSuffix = (int) $m[1];
                            if (preg_match('/-(\d+)$/', $b['order_id'], $m))
                                $bSuffix = (int) $m[1];

                            if ($aSuffix !== $bSuffix) {
                                return $aSuffix - $bSuffix;
                            }

                            return 0;
                        });
                    }
                    unset($orderItems);

                    // Fetch slips from main orders (using same approach as items query)
                    $slipSql = "SELECT id, order_id, url, created_at, amount, bank_account_id, transfer_date, upload_by, upload_by_name 
                                FROM order_slips 
                                WHERE order_id IN ($parentPlaceholders)
                                ORDER BY created_at DESC";

                    $slipStmt = $pdo->prepare($slipSql);
                    $slipStmt->execute($orderIds);
                    $slips = $slipStmt->fetchAll();

                    // Map slips to main order IDs (similar to items)
                    foreach ($slips as $slip) {
                        $slipOrderId = $slip['order_id'];
                        // Check if this is a sub order
                        $resolved = resolve_main_order_id($pdo, $slipOrderId);
                        if ($resolved['is_sub']) {
                            $mainOrderId = $resolved['main_id']; // Extract main order ID
                            // Map sub order slips to main order
                            if (in_array($mainOrderId, $orderIds)) {
                                $slipsMap[$mainOrderId][] = $slip;
                            }
                        } else {
                            // Direct mapping for main order slips
                            $slipsMap[$slipOrderId][] = $slip;
                        }
                    }

                    // Fetch tracking entries grouped by parent order
                    $parentPlaceholders = implode(',', array_fill(0, count($orderIds), '?'));
                    $trackingSql = "SELECT parent_order_id, order_id, tracking_number, box_number
                                    FROM order_tracking_numbers
                                    WHERE parent_order_id IN ($parentPlaceholders)
                                    ORDER BY id";
                    $trackingStmt = $pdo->prepare($trackingSql);
                    $trackingStmt->execute($orderIds);
                    $trackingRows = $trackingStmt->fetchAll();
                    foreach ($trackingRows as $trackingRow) {
                        $parentId = $trackingRow['parent_order_id'] ?? null;
                        if ($parentId === null)
                            continue;
                        if (!isset($trackingMap[$parentId])) {
                            $trackingMap[$parentId] = [];
                        }
                        $trackingMap[$parentId][] = [
                            'order_id' => $trackingRow['order_id'],
                            'parent_order_id' => $trackingRow['parent_order_id'],
                            'tracking_number' => $trackingRow['tracking_number'],
                            'box_number' => $trackingRow['box_number'],
                        ];
                    }

                    // Fetch boxes from order_boxes for each main order
                    $boxesMap = [];
                    $boxesSql = "SELECT order_id, sub_order_id, box_number, cod_amount, collection_amount, collected_amount, waived_amount, payment_method, status, return_status, return_note
                                 FROM order_boxes
                                 WHERE order_id IN ($parentPlaceholders)
                                 ORDER BY order_id, box_number";
                    $boxesStmt = $pdo->prepare($boxesSql);
                    $boxesStmt->execute($orderIds);
                    $boxesRows = $boxesStmt->fetchAll();
                    foreach ($boxesRows as $boxRow) {
                        $orderId = $boxRow['order_id'] ?? null;
                        if ($orderId === null)
                            continue;
                        if (!isset($boxesMap[$orderId])) {
                            $boxesMap[$orderId] = [];
                        }
                        $boxesMap[$orderId][] = [
                            'sub_order_id' => $boxRow['sub_order_id'] ?? null,
                            'box_number' => $boxRow['box_number'] ?? null,
                            'cod_amount' => $boxRow['cod_amount'] ?? null,
                            'collection_amount' => $boxRow['collection_amount'] ?? null,
                            'collected_amount' => $boxRow['collected_amount'] ?? null,
                            'waived_amount' => $boxRow['waived_amount'] ?? null,
                            'payment_method' => $boxRow['payment_method'] ?? null,
                            'status' => $boxRow['status'] ?? null,
                            'return_status' => $boxRow['return_status'] ?? null,
                            'return_note' => $boxRow['return_note'] ?? null,
                        ];
                    }

                    // Batch fetch reconcile_action for paginated orders only
                    $reconcileMap = [];
                    try {
                        $srlSql = "SELECT 
                                    COALESCE(srl.confirmed_order_id, srl.order_id) as matched_order_id,
                                    MAX(CASE WHEN srl.confirmed_action = 'Confirmed' THEN 'Confirmed' ELSE NULL END) as reconcile_action
                                   FROM statement_reconcile_logs srl
                                   WHERE srl.order_id IN ($parentPlaceholders)
                                      OR srl.confirmed_order_id IN ($parentPlaceholders)
                                   GROUP BY matched_order_id";
                        $srlStmt = $pdo->prepare($srlSql);
                        $srlStmt->execute(array_merge($orderIds, $orderIds));
                        foreach ($srlStmt->fetchAll() as $srlRow) {
                            $reconcileMap[$srlRow['matched_order_id']] = $srlRow['reconcile_action'];
                        }
                    } catch (Throwable $e) {
                        error_log('Reconcile batch query failed: ' . $e->getMessage());
                    }

                    // Batch fetch airport delivery status for paginated orders only
                    $airportMap = [];
                    try {
                        $trackingNums = [];
                        foreach ($trackingRows as $tr) {
                            if (!empty($tr['tracking_number'])) {
                                $trackingNums[] = $tr['tracking_number'];
                            }
                        }
                        if (!empty($trackingNums)) {
                            $tnPlaceholders = implode(',', array_fill(0, count($trackingNums), '?'));
                            $gssSql = "SELECT gss.order_number as tracking_number,
                                              GROUP_CONCAT(DISTINCT gss.delivery_status ORDER BY gss.id SEPARATOR ',') as delivery_status,
                                              MAX(gss.delivery_date) as delivery_date
                                       FROM google_sheet_shipping gss
                                       WHERE gss.order_number IN ($tnPlaceholders)
                                       GROUP BY gss.order_number";
                            $gssStmt = $pdo->prepare($gssSql);
                            $gssStmt->execute($trackingNums);
                            foreach ($gssStmt->fetchAll() as $gssRow) {
                                // Map tracking number -> order via trackingMap
                                foreach ($trackingMap as $parentId => $trackings) {
                                    foreach ($trackings as $t) {
                                        if ($t['tracking_number'] === $gssRow['tracking_number']) {
                                            if (!isset($airportMap[$parentId])) {
                                                $airportMap[$parentId] = ['statuses' => [], 'dates' => []];
                                            }
                                            $airportMap[$parentId]['statuses'][] = $gssRow['delivery_status'];
                                            $airportMap[$parentId]['dates'][] = $gssRow['delivery_date'];
                                        }
                                    }
                                }
                            }
                        }
                    } catch (Throwable $e) {
                        error_log('Airport delivery batch query failed: ' . $e->getMessage());
                    }
                }

                // Batch fetch COD payment dates for paginated orders
                $codPaymentDateMap = [];
                if (!empty($orderIds)) {
                    try {
                        $codSql = "SELECT 
                                     REGEXP_REPLACE(cr.order_id, '-[0-9]+$', '') as clean_order_id,
                                     cd.document_datetime
                                   FROM cod_records cr
                                   INNER JOIN cod_documents cd ON cr.document_id = cd.id
                                   WHERE REGEXP_REPLACE(cr.order_id, '-[0-9]+$', '') IN ($parentPlaceholders)
                                   ORDER BY cd.document_datetime DESC";
                        $codStmt = $pdo->prepare($codSql);
                        $codStmt->execute($orderIds);
                        foreach ($codStmt->fetchAll() as $codRow) {
                            $cleanId = $codRow['clean_order_id'];
                            if (!isset($codPaymentDateMap[$cleanId])) {
                                $codPaymentDateMap[$cleanId] = $codRow['document_datetime'];
                            }
                        }
                    } catch (Throwable $e) {
                        error_log('COD payment date query failed: ' . $e->getMessage());
                    }
                }

                // Add items, slips, tracking details, boxes, reconcile, and airport data to each order
                foreach ($orders as &$order) {
                    $order['items'] = $itemsMap[$order['id']] ?? [];
                    $order['slips'] = $slipsMap[$order['id']] ?? [];
                    // Payment received date: Slip → transfer_date, COD → cod_document.document_datetime
                    $slipDate = null;
                    if (!empty($order['slips'])) {
                        foreach ($order['slips'] as $slip) {
                            if (!empty($slip['transfer_date'])) {
                                $slipDate = $slip['transfer_date'];
                                break;
                            }
                        }
                    }
                    $codDate = $codPaymentDateMap[$order['id']] ?? null;
                    $order['payment_received_date'] = $slipDate ?? $codDate ?? null;
                    $order['tracking_details'] = $trackingMap[$order['id']] ?? [];
                    $order['trackingDetails'] = $order['tracking_details'];
                    $order['boxes'] = $boxesMap[$order['id']] ?? [];
                    $order['reconcile_action'] = $reconcileMap[$order['id']] ?? null;
                    $airportData = $airportMap[$order['id']] ?? null;
                    $order['airport_delivery_status'] = $airportData ? implode(',', $airportData['statuses']) : null;
                    $order['airport_delivery_date'] = $airportData ? max($airportData['dates']) : null;
                }

                // Return paginated response
                $responsePayload = [
                    'ok' => true,
                    'orders' => $orders,
                    'pagination' => [
                        'page' => $page,
                        'pageSize' => $pageSize,
                        'total' => $total,
                        'totalPages' => $totalPages
                    ]
                ];



                json_response($responsePayload);
            }
            break;

        case 'PUT':
            if (!$id) {
                json_response(['error' => 'MISSING_ID'], 400);
            }

            $data = json_decode(file_get_contents('php://input'), true);
            if (!$data) {
                json_response(['error' => 'INVALID_JSON'], 400);
            }

            try {
                $pdo->beginTransaction();

                // Resolve main order ID (remove -1, -2 suffix if present)
                $resolved = resolve_main_order_id($pdo, $id);
                $isSubOrder = $resolved['is_sub'];
                $mainOrderId = $resolved['main_id'];

                if ($isSubOrder) {
                    error_log("PUT /orders: Detected sub-order ID $id. Redirecting update to main order $mainOrderId");
                }

                // Use mainOrderId for the rest of the operation
                $id = $mainOrderId;

                // --- PAST MONTH LOCK ENFORCEMENT ---
                $currentUser = get_authenticated_user($pdo);
                $role = $currentUser['role'] ?? '';
                $managerRoles = ['admin', 'manager', 'Super Admin', 'Admin System', 'Admin Control', 'Admin Page', 'Backoffice', 'Sup Backoffice', 'CEO', 'Finance'];
                if (!in_array($role, $managerRoles)) {
                    $stmtLock = $pdo->prepare('SELECT order_date FROM orders WHERE id = ?');
                    $stmtLock->execute([$id]);
                    $orderLockData = $stmtLock->fetch();
                    if ($orderLockData) {
                        $orderDateStr = $orderLockData['order_date'];
                        if ($orderDateStr) {
                            $orderTs = strtotime($orderDateStr);
                            $orderYearMonth = date('Y-m', $orderTs);
                            $currentYearMonth = date('Y-m');
                            if ($orderYearMonth < $currentYearMonth) {
                                $pdo->rollBack();
                                json_response(['error' => 'ORDER_MONTH_LOCKED', 'message' => 'ไม่สามารถแก้ไขออเดอร์ข้ามเดือนได้ เพื่อป้องกันผลกระทบต่อยอดขาย'], 403);
                            }
                        }
                    }
                }
                // --- END PAST MONTH LOCK ENFORCEMENT ---

                // 1. Update main order fields
                $updateFields = [];
                $params = [];

                $allowedFields = [
                    'order_status' => 'orderStatus',
                    'payment_status' => 'paymentStatus',
                    'payment_method' => 'paymentMethod',
                    'sales_channel' => 'salesChannel',
                    'sales_channel_page_id' => 'salesChannelPageId',
                    'delivery_date' => 'deliveryDate',
                    'transfer_date' => 'transferDate',
                    'shipping_cost' => 'shippingCost',
                    'bill_discount' => 'billDiscount',
                    'total_amount' => 'totalAmount',
                    'amount_paid' => 'amountPaid',
                    'cod_amount' => 'codAmount',
                    // Shipping Address
                    'recipient_first_name' => ['shippingAddress', 'recipientFirstName'],
                    'recipient_last_name' => ['shippingAddress', 'recipientLastName'],
                    'recipient_phone' => ['shippingAddress', 'phone'],
                    'street' => ['shippingAddress', 'street'],
                    'subdistrict' => ['shippingAddress', 'subdistrict'],
                    'district' => ['shippingAddress', 'district'],
                    'province' => ['shippingAddress', 'province'],
                    'postal_code' => ['shippingAddress', 'postalCode'],
                    'shipping_provider' => 'shippingProvider',
                    'tracking_numbers' => 'trackingNumbers', // Special handling maybe?
                    'notes' => 'notes',
                ];

                foreach ($allowedFields as $dbCol => $jsonKey) {
                    $val = null;
                    if (is_array($jsonKey)) {
                        // Nested key e.g. shippingAddress.street
                        $parent = $data[$jsonKey[0]] ?? [];
                        if (isset($parent[$jsonKey[1]])) {
                            $val = $parent[$jsonKey[1]];
                        } else {
                            // FAST FIX: Also check top-level keys if nested not found
                            // e.g. if shippingAddress.street not found, check data['street'] or data['recipient_first_name']
                            // Use the second part of jsonKey (e.g. 'street') or dbCol
                            $fallbackKey = $jsonKey[1];
                            if (array_key_exists($fallbackKey, $data)) {
                                $val = $data[$fallbackKey];
                            } elseif (array_key_exists($dbCol, $data)) {
                                $val = $data[$dbCol];
                            }
                        }
                    } else {
                        // Check both camelCase and snake_case versions
                        if (array_key_exists($jsonKey, $data)) {
                            $val = $data[$jsonKey];
                        } elseif (array_key_exists($dbCol, $data)) {
                            // Fallback: use snake_case key (e.g., 'order_status' instead of 'orderStatus')
                            $val = $data[$dbCol];
                        }
                    }

                    if ($val !== null) {
                        if ($dbCol === 'tracking_numbers' && is_array($val)) {
                            // Skip tracking_numbers column update if it's an array, 
                            // we might need to update the tracking table separately or comma join
                            // For now let's just not update the deprecated column if it exists
                            // Or comma join if the table uses it
                            continue;
                        }
                        if ($dbCol === 'sales_channel_page_id' && $val === '')
                            $val = null;

                        $updateFields[] = "$dbCol = ?";
                        $params[] = $val;
                    }
                }

                // Force clear sales_channel_page_id when sales channel is "โทร" (phone) - it doesn't use pages
                $salesChannelVal = $data['salesChannel'] ?? $data['sales_channel'] ?? null;
                $salesChannelPageIdProvided = array_key_exists('salesChannelPageId', $data) || array_key_exists('sales_channel_page_id', $data);
                $salesChannelPageIdVal = $data['salesChannelPageId'] ?? $data['sales_channel_page_id'] ?? null;
                if ($salesChannelPageIdVal === '')
                    $salesChannelPageIdVal = null;

                $shouldClearPageId = ($salesChannelVal === 'โทร') || ($salesChannelPageIdProvided && $salesChannelPageIdVal === null);
                if ($shouldClearPageId) {
                    $foundIndex = -1;
                    foreach ($updateFields as $i => $field) {
                        if (strpos($field, 'sales_channel_page_id') !== false) {
                            $foundIndex = $i;
                            break;
                        }
                    }

                    if ($foundIndex >= 0) {
                        // Found existing field, just ensure param is null
                        $params[$foundIndex] = null;
                    } else {
                        // Not present, add it
                        $updateFields[] = "sales_channel_page_id = ?";
                        $params[] = null;
                    }
                }

                // Note: updatedBy is NOT a column in orders table - only used as fallback creator_id for items

                // Auto-set payment_status to Cancelled when order_status is Cancelled
                $incomingOrderStatus = $data['orderStatus'] ?? $data['order_status'] ?? null;
                if ($incomingOrderStatus === 'Cancelled') {
                    // Check if payment_status is not already in updateFields
                    $hasPaymentStatus = false;
                    foreach ($updateFields as $field) {
                        if (strpos($field, 'payment_status') !== false) {
                            $hasPaymentStatus = true;
                            break;
                        }
                    }
                    if (!$hasPaymentStatus) {
                        $updateFields[] = "payment_status = ?";
                        $params[] = 'Cancelled';
                    }
                }

                if (!empty($updateFields)) {
                    $sql = "UPDATE orders SET " . implode(', ', $updateFields) . " WHERE id = ?";
                    $params[] = $id;
                    $stmt = $pdo->prepare($sql);

                    // DEBUG LOG (RE-ADDED)
                    $debugMsg = "DEBUG RE-UPDATE SQL: " . $sql . "\n";
                    $debugMsg .= "DEBUG RE-PARAMS COUNT: " . count($params) . "\n";
                    $debugMsg .= "DEBUG RE-PARAMS: " . json_encode($params) . "\n";
                    file_put_contents(__DIR__ . '/../basket_debug.log', $debugMsg, FILE_APPEND);

                    try {
                        $stmt->execute($params);
                        file_put_contents(__DIR__ . '/../basket_debug.log', "DEBUG RE-UPDATE SUCCESS\n", FILE_APPEND);
                    } catch (Throwable $e) {
                        file_put_contents(__DIR__ . '/../basket_debug.log', "DEBUG RE-UPDATE FAILED: " . $e->getMessage() . "\n", FILE_APPEND);
                        throw $e;
                    }
                }

                // 2. Insert/Update Tracking Numbers
                // Check if new format trackingObjects is provided, otherwise fall back to trackingNumbers
                $hasDetailedTracking = isset($data['trackingObjects']) && is_array($data['trackingObjects']);
                $hasLegacyTracking = isset($data['trackingNumbers']) && is_array($data['trackingNumbers']);

                if ($hasDetailedTracking || $hasLegacyTracking) {
                    try {
                        // Delete existing
                        $pdo->prepare("DELETE FROM order_tracking_numbers WHERE parent_order_id = ?")->execute([$id]);

                        if ($hasDetailedTracking) {
                            // New format: [{ trackingNumber: '...', boxNumber: 1 }, ...]
                            $trackStmt = $pdo->prepare("INSERT INTO order_tracking_numbers (parent_order_id, order_id, box_number, tracking_number) VALUES (?, ?, ?, ?)");
                            foreach ($data['trackingObjects'] as $obj) {
                                $tn = trim($obj['trackingNumber'] ?? '');
                                $bn = (int) ($obj['boxNumber'] ?? 1);
                                if ($tn) {
                                    // Correctly map order_id to sub_order_id (pattern: parentId-boxNumber)
                                    $subOrderId = "$id-$bn";
                                    $trackStmt->execute([$id, $subOrderId, $bn, $tn]);
                                }
                            }
                        } else if ($hasLegacyTracking) {
                            // Old format: ['tn1', 'tn2', ...] - Fallback gracefully
                            $boxCounter = 1;
                            $trackStmt = $pdo->prepare("INSERT INTO order_tracking_numbers (parent_order_id, order_id, tracking_number, box_number) VALUES (?, ?, ?, ?)");
                            foreach ($data['trackingNumbers'] as $trackNum) {
                                if (trim($trackNum)) {
                                    $trackStmt->execute([$id, "$id-$boxCounter", trim($trackNum), $boxCounter]);
                                    $boxCounter++;
                                }
                            }
                        }
                        file_put_contents(__DIR__ . '/../basket_debug.log', "DEBUG TRACKING UPDATE SUCCESS\n", FILE_APPEND);
                    } catch (Throwable $e) {
                        file_put_contents(__DIR__ . '/../basket_debug.log', "DEBUG TRACKING UPDATE FAILED: " . $e->getMessage() . "\n", FILE_APPEND);
                        throw $e;
                    }
                }

                // 3. Handle Items (Optional: If provided)
                // 3. Handle Items
                if (isset($data['items']) && is_array($data['items'])) {
                    // Fetch existing item IDs
                    $stmt = $pdo->prepare("SELECT id FROM order_items WHERE order_id = ? OR parent_order_id = ?");
                    $stmt->execute([$id, $id]);
                    $existingIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

                    $incomingIds = [];
                    // Resolve a fallback creator_id
                    $fallbackCreatorId = $data['updatedBy'] ?? $data['updated_by'] ?? null;
                    if (!$fallbackCreatorId) {
                        // Try to get it from the order itself if not provided in the payload
                        $stmt = $pdo->prepare("SELECT creator_id FROM orders WHERE id = ?");
                        $stmt->execute([$id]);
                        $fallbackCreatorId = $stmt->fetchColumn();
                    }

                    // Fetch basket_key_at_sale from orders table if column exists
                    $orderBasketKey = null;
                    try {
                        $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
                        $hasBasketCol = $pdo->query("SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '$dbName' AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'basket_key_at_sale'")->fetchColumn();

                        // Also check if order_items has the column
                        $hasItemBasketCol = $pdo->query("SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '$dbName' AND TABLE_NAME = 'order_items' AND COLUMN_NAME = 'basket_key_at_sale'")->fetchColumn();

                        if ($hasBasketCol && $hasItemBasketCol) {
                            $bkStmt = $pdo->prepare("SELECT basket_key_at_sale FROM orders WHERE id = ?");
                            $bkStmt->execute([$id]);
                            $orderBasketKey = $bkStmt->fetchColumn();
                        }
                    } catch (Throwable $e) {
                        // Ignore error, just default to null
                    }

                    // Prepare the insert statement for reuse
                    // Dynamically build insert based on column existence
                    $baseCols = "order_id, parent_order_id, product_id, product_name, quantity, price_per_unit, discount, net_total, box_number, parent_item_id, is_promotion_parent, is_freebie, promotion_id, creator_id";
                    $baseVals = "?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?";

                    if ($orderBasketKey !== null) {
                        $insertSql = "INSERT INTO order_items ($baseCols, basket_key_at_sale) VALUES ($baseVals, ?)";
                    } else {
                        $insertSql = "INSERT INTO order_items ($baseCols) VALUES ($baseVals)";
                    }

                    $insStmt = $pdo->prepare($insertSql);

                    // Pass 1: Update existing items AND collect existing parent mapping
                    foreach ($data['items'] as $item) {
                        $netTotal = calculate_order_item_net_total($item);
                        $itemId = isset($item['id']) ? $item['id'] : null;
                        $isFreebie = !empty($item['isFreebie']) || !empty($item['is_freebie']);

                        // --- Override net_total and inherit creator_id for child promotion items ---
                        $clientParentIdForUpdate = $item['parentItemId'] ?? $item['parent_item_id'] ?? null;
                        $parentCreatorForUpdate = null;
                        if ($clientParentIdForUpdate) {
                            $overridePrice = (!$isFreebie && isset($item['priceOverride'])) ? (float) $item['priceOverride'] : ((!$isFreebie && isset($item['price_override'])) ? (float) $item['price_override'] : null);
                            $parentQty = 1;
                            $parentPromotionId = null;
                            foreach ($data['items'] as $parentCandidate) {
                                $pid = $parentCandidate['id'] ?? null;
                                if ($pid !== null && (string)$pid === (string)$clientParentIdForUpdate
                                    && (!empty($parentCandidate['isPromotionParent']) || !empty($parentCandidate['is_promotion_parent']))) {
                                    $parentQty = max(1, (int)($parentCandidate['quantity'] ?? 1));
                                    $parentPromotionId = $parentCandidate['promotionId'] ?? $parentCandidate['promotion_id'] ?? null;
                                    // Inherit creator_id from parent
                                    $parentCreatorForUpdate = $parentCandidate['creatorId'] ?? $parentCandidate['creator_id'] ?? null;
                                    break;
                                }
                            }
                            if (!$isFreebie) {
                                if ($overridePrice === null && $parentPromotionId !== null) {
                                    $productIdForLookup = $item['productId'] ?? $item['product_id'] ?? null;
                                    if ($productIdForLookup) {
                                        $poStmt = $pdo->prepare('SELECT price_override FROM promotion_items WHERE promotion_id = ? AND product_id = ? LIMIT 1');
                                        $poStmt->execute([(int)$parentPromotionId, (int)$productIdForLookup]);
                                        $poRow = $poStmt->fetch();
                                        if ($poRow && $poRow['price_override'] !== null) {
                                            $overridePrice = (float) $poRow['price_override'];
                                        }
                                    }
                                }
                                if ($overridePrice !== null) {
                                    $netTotal = $overridePrice * $parentQty;
                                }
                            }
                        }

                        if ($itemId && in_array($itemId, $existingIds)) {
                            $incomingIds[] = (int) $itemId;
                            // If it's an existing parent, add to mapping
                            if (!empty($item['isPromotionParent']) || !empty($item['is_promotion_parent'])) {
                                $clientToDbParent[(string) $itemId] = (int) $itemId;
                            }

                            // Child items inherit creator_id from parent; standalone items use their own
                            $itemCreatorId = $parentCreatorForUpdate ?? $item['creatorId'] ?? $item['creator_id'] ?? $fallbackCreatorId;

                            $updateSql = "UPDATE order_items SET quantity=?, price_per_unit=?, discount=?, net_total=?, box_number=?, is_freebie=?, promotion_id=?, creator_id=? WHERE id=? AND (order_id=? OR parent_order_id=?)";
                            $pdo->prepare($updateSql)->execute([
                                $item['quantity'] ?? 0,
                                $item['pricePerUnit'] ?? $item['price_per_unit'] ?? 0,
                                $item['discount'] ?? 0,
                                $netTotal,
                                $item['boxNumber'] ?? $item['box_number'] ?? 0,
                                $isFreebie ? 1 : 0,
                                $item['promotionId'] ?? $item['promotion_id'] ?? null,
                                $itemCreatorId,
                                $itemId,
                                $id,
                                $id
                            ]);
                        }
                    }

                    // Pass 2: Insert NEW promotion parents
                    foreach ($data['items'] as $item) {
                        $itemId = isset($item['id']) ? $item['id'] : null;
                        $isParent = !empty($item['isPromotionParent']) || !empty($item['is_promotion_parent']);

                        if ((!$itemId || !in_array($itemId, $existingIds)) && $isParent) {
                            $netTotal = calculate_order_item_net_total($item);
                            $isFreebie = !empty($item['isFreebie']) || !empty($item['is_freebie']);
                            $itemCreatorId = $item['creatorId'] ?? $item['creator_id'] ?? $fallbackCreatorId;

                            // Calculate sub-order ID based on box_number
                            $boxNumber = $item['boxNumber'] ?? $item['box_number'] ?? 1;
                            $subOrderId = "$id-$boxNumber";

                            $insParams = [
                                $subOrderId,
                                $id,
                                $item['productId'] ?? $item['product_id'] ?? null,
                                $item['productName'] ?? $item['product_name'] ?? 'Unknown Item',
                                $item['quantity'] ?? 0,
                                $item['pricePerUnit'] ?? $item['price_per_unit'] ?? 0,
                                $item['discount'] ?? 0,
                                $netTotal,
                                $boxNumber,
                                null, // parent_item_id
                                1, // is_promotion_parent
                                $isFreebie ? 1 : 0,
                                $item['promotionId'] ?? $item['promotion_id'] ?? null,
                                $itemCreatorId
                            ];
                            if ($orderBasketKey !== null) {
                                $insParams[] = $orderBasketKey;
                            }

                            $insStmt->execute($insParams);

                            $newDbId = (int) $pdo->lastInsertId();
                            if ($itemId) {
                                $clientToDbParent[(string) $itemId] = $newDbId;
                            }
                            $incomingIds[] = $newDbId;
                        }
                    }

                    // Pass 3: Insert NEW regular items (not parents, not children)
                    foreach ($data['items'] as $item) {
                        $itemId = isset($item['id']) ? $item['id'] : null;
                        $isParent = !empty($item['isPromotionParent']) || !empty($item['is_promotion_parent']);
                        $hasParent = !empty($item['parentItemId']) || !empty($item['parent_item_id']);

                        if ((!$itemId || !in_array($itemId, $existingIds)) && !$isParent && !$hasParent) {
                            $netTotal = calculate_order_item_net_total($item);
                            $isFreebie = !empty($item['isFreebie']) || !empty($item['is_freebie']);
                            $itemCreatorId = $item['creatorId'] ?? $item['creator_id'] ?? $fallbackCreatorId;

                            // Calculate sub-order ID based on box_number
                            $boxNumber = $item['boxNumber'] ?? $item['box_number'] ?? 1;
                            $subOrderId = "$id-$boxNumber";

                            $insParams = [
                                $subOrderId,
                                $id,
                                $item['productId'] ?? $item['product_id'] ?? null,
                                $item['productName'] ?? $item['product_name'] ?? 'Unknown Item',
                                $item['quantity'] ?? 0,
                                $item['pricePerUnit'] ?? $item['price_per_unit'] ?? 0,
                                $item['discount'] ?? 0,
                                $netTotal,
                                $boxNumber,
                                null,
                                0,
                                $isFreebie ? 1 : 0,
                                $item['promotionId'] ?? $item['promotion_id'] ?? null,
                                $itemCreatorId
                            ];
                            if ($orderBasketKey !== null) {
                                $insParams[] = $orderBasketKey;
                            }

                            $insStmt->execute($insParams);

                            $incomingIds[] = (int) $pdo->lastInsertId();
                            $newDbId = (int) $pdo->lastInsertId();

                            // Insert allocation for new regular item
                            $allocIns = $pdo->prepare('INSERT INTO order_item_allocations (order_id, order_item_id, product_id, required_quantity, is_freebie, promotion_id, status, created_by) VALUES (?,?,?,?,?,?,?,?)');
                            $allocIns->execute([
                                $id,
                                $newDbId,
                                $item['productId'] ?? $item['product_id'] ?? null,
                                $item['quantity'] ?? 0,
                                $isFreebie ? 1 : 0,
                                $item['promotionId'] ?? $item['promotion_id'] ?? null,
                                'PENDING',
                                $itemCreatorId
                            ]);
                        }
                    }

                    // Pass 4: Insert NEW promotion children
                    foreach ($data['items'] as $item) {
                        $itemId = isset($item['id']) ? $item['id'] : null;
                        $isParent = !empty($item['isPromotionParent']) || !empty($item['is_promotion_parent']);
                        $clientParentId = $item['parentItemId'] ?? $item['parent_item_id'] ?? null;

                        if ((!$itemId || !in_array($itemId, $existingIds)) && !$isParent && $clientParentId) {
                            $netTotal = calculate_order_item_net_total($item);
                            $isFreebie = !empty($item['isFreebie']) || !empty($item['is_freebie']);
                            // Child items inherit creator_id from their parent item
                            $parentCreatorId = null;
                            foreach ($data['items'] as $parentCandidate) {
                                $pid = $parentCandidate['id'] ?? null;
                                if ($pid !== null && (string)$pid === (string)$clientParentId
                                    && (!empty($parentCandidate['isPromotionParent']) || !empty($parentCandidate['is_promotion_parent']))) {
                                    $parentCreatorId = $parentCandidate['creatorId'] ?? $parentCandidate['creator_id'] ?? null;
                                    break;
                                }
                            }
                            $itemCreatorId = $parentCreatorId ?? $item['creatorId'] ?? $item['creator_id'] ?? $fallbackCreatorId;

                            // --- Override net_total for child promotion items ---
                            if (!$isFreebie) {
                                $overridePrice = isset($item['priceOverride']) ? (float) $item['priceOverride'] : (isset($item['price_override']) ? (float) $item['price_override'] : null);
                                $parentQty = 1;
                                $parentPromotionId = null;
                                foreach ($data['items'] as $parentCandidate) {
                                    $pid = $parentCandidate['id'] ?? null;
                                    if ($pid !== null && (string)$pid === (string)$clientParentId
                                        && (!empty($parentCandidate['isPromotionParent']) || !empty($parentCandidate['is_promotion_parent']))) {
                                        $parentQty = max(1, (int)($parentCandidate['quantity'] ?? 1));
                                        $parentPromotionId = $parentCandidate['promotionId'] ?? $parentCandidate['promotion_id'] ?? null;
                                        break;
                                    }
                                }
                                if ($overridePrice === null && $parentPromotionId !== null) {
                                    $productIdForLookup = $item['productId'] ?? $item['product_id'] ?? null;
                                    if ($productIdForLookup) {
                                        $poStmt = $pdo->prepare('SELECT price_override FROM promotion_items WHERE promotion_id = ? AND product_id = ? LIMIT 1');
                                        $poStmt->execute([(int)$parentPromotionId, (int)$productIdForLookup]);
                                        $poRow = $poStmt->fetch();
                                        if ($poRow && $poRow['price_override'] !== null) {
                                            $overridePrice = (float) $poRow['price_override'];
                                        }
                                    }
                                }
                                if ($overridePrice !== null) {
                                    $netTotal = $overridePrice * $parentQty;
                                }
                            }

                            // Resolve parent DB ID
                            $resolvedParentId = isset($clientToDbParent[(string) $clientParentId]) ? $clientToDbParent[(string) $clientParentId] : null;

                            // Calculate sub-order ID based on box_number
                            $boxNumber = $item['boxNumber'] ?? $item['box_number'] ?? 1;
                            $subOrderId = "$id-$boxNumber";

                            $insParams = [
                                $subOrderId,
                                $id,
                                $item['productId'] ?? $item['product_id'] ?? null,
                                $item['productName'] ?? $item['product_name'] ?? 'Unknown Item',
                                $item['quantity'] ?? 0,
                                $item['pricePerUnit'] ?? $item['price_per_unit'] ?? 0,
                                $item['discount'] ?? 0,
                                $netTotal,
                                $boxNumber,
                                $resolvedParentId,
                                0,
                                $isFreebie ? 1 : 0,
                                $item['promotionId'] ?? $item['promotion_id'] ?? null,
                                $itemCreatorId
                            ];
                            if ($orderBasketKey !== null) {
                                $insParams[] = $orderBasketKey;
                            }

                            $insStmt->execute($insParams);

                            $incomingIds[] = (int) $pdo->lastInsertId();
                            $newDbId = (int) $pdo->lastInsertId();

                            // Insert allocation for new child item
                            $allocIns = $pdo->prepare('INSERT INTO order_item_allocations (order_id, order_item_id, product_id, required_quantity, is_freebie, promotion_id, status, created_by) VALUES (?,?,?,?,?,?,?,?)');
                            $allocIns->execute([
                                $id,
                                $newDbId,
                                $item['productId'] ?? $item['product_id'] ?? null,
                                $item['quantity'] ?? 0,
                                $isFreebie ? 1 : 0,
                                $item['promotionId'] ?? $item['promotion_id'] ?? null,
                                'PENDING',
                                $itemCreatorId
                            ]);
                        }
                    }

                    // DELETE removed items
                    // DELETE removed items
                    $itemsToDelete = array_values(array_diff($existingIds, $incomingIds));
                    if (!empty($itemsToDelete)) {
                        try {
                            $placeholders = implode(',', array_fill(0, count($itemsToDelete), '?'));

                            // Fix FK constraint: Delete dependent allocations first
                            $deleteAllocSql = "DELETE FROM order_item_allocations WHERE order_item_id IN ($placeholders)";
                            // DEBUG LOG
                            file_put_contents(__DIR__ . '/../basket_debug.log', "DEBUG DELETE ALLOC SQL: $deleteAllocSql\n", FILE_APPEND);
                            file_put_contents(__DIR__ . '/../basket_debug.log', "DEBUG DELETE ALLOC PARAMS: " . json_encode($itemsToDelete) . "\n", FILE_APPEND);

                            $pdo->prepare($deleteAllocSql)->execute($itemsToDelete);

                            // Then delete the items
                            $deleteSql = "DELETE FROM order_items WHERE id IN ($placeholders) AND (order_id = ? OR parent_order_id = ?)";
                            $deleteParams = array_merge($itemsToDelete, [$id, $id]);

                            // DEBUG LOG
                            file_put_contents(__DIR__ . '/../basket_debug.log', "DEBUG DELETE ITEMS SQL: $deleteSql\n", FILE_APPEND);
                            file_put_contents(__DIR__ . '/../basket_debug.log', "DEBUG DELETE ITEMS PARAMS: " . json_encode($deleteParams) . "\n", FILE_APPEND);

                            $pdo->prepare($deleteSql)->execute($deleteParams);

                            file_put_contents(__DIR__ . '/../basket_debug.log', "DEBUG DELETE SUCCESS\n", FILE_APPEND);
                        } catch (Throwable $e) {
                            file_put_contents(__DIR__ . '/../basket_debug.log', "DEBUG DELETE FAILED: " . $e->getMessage() . "\n", FILE_APPEND);
                            throw $e;
                        }
                    }
                }

                // 4. Handle Boxes (Optional: If provided)
                if (isset($data['boxes']) && is_array($data['boxes'])) {
                    $boxCount = count($data['boxes']);
                    error_log("Updating boxes for order: $id. Count: " . $boxCount);

                    if ($boxCount > 0) {
                        $selectBox = $pdo->prepare('SELECT id FROM order_boxes WHERE order_id=? AND box_number=? LIMIT 1');
                        $updateBox = $pdo->prepare('UPDATE order_boxes SET payment_method=?, collection_amount=?, cod_amount=?, collected_amount=?, waived_amount=?, sub_order_id=?, status=COALESCE(status, \'PENDING\') WHERE order_id=? AND box_number=?');
                        $insertBox = $pdo->prepare('INSERT INTO order_boxes (order_id, sub_order_id, box_number, payment_method, collection_amount, cod_amount, collected_amount, waived_amount, status) VALUES (?,?,?,?,?,?,?,?,\'PENDING\')');

                        $incomingBoxNumbers = [];

                        foreach ($data['boxes'] as $box) {
                            $boxNumber = $box['box_number'] ?? $box['boxNumber'] ?? 1;
                            $incomingBoxNumbers[] = $boxNumber;
                            
                            $subOrderId = $box['sub_order_id'] ?? $box['subOrderId'] ?? null;
                            if (!$subOrderId) {
                                $subOrderId = "$id-$boxNumber";
                            }

                            $codAmount = $box['cod_amount'] ?? $box['codAmount'] ?? 0;
                            $collectionAmount = $box['collection_amount'] ?? $box['collectionAmount'] ?? $codAmount;
                            $collectedAmount = $box['collected_amount'] ?? $box['collectedAmount'] ?? 0;
                            $waivedAmount = $box['waived_amount'] ?? $box['waivedAmount'] ?? 0;
                            $paymentMethod = $box['payment_method'] ?? $box['paymentMethod'] ?? null;

                            try {
                                $selectBox->execute([$id, $boxNumber]);
                                $existingBoxId = $selectBox->fetchColumn();

                                if ($existingBoxId) {
                                    $success = $updateBox->execute([
                                        $paymentMethod,
                                        $collectionAmount,
                                        $codAmount,
                                        $collectedAmount,
                                        $waivedAmount,
                                        $subOrderId,
                                        $id,
                                        $boxNumber
                                    ]);
                                } else {
                                    $success = $insertBox->execute([
                                        $id,
                                        $subOrderId,
                                        $boxNumber,
                                        $paymentMethod,
                                        $collectionAmount,
                                        $codAmount,
                                        $collectedAmount,
                                        $waivedAmount
                                    ]);
                                }
                                if (!$success) {
                                    error_log("Failed to upsert box $boxNumber: " . json_encode($existingBoxId ? $updateBox->errorInfo() : $insertBox->errorInfo()));
                                }
                            } catch (Exception $be) {
                                error_log("Exception upserting box $boxNumber: " . $be->getMessage());
                            }
                        }

                        // Safely delete removed boxes
                        if (!empty($incomingBoxNumbers)) {
                            $ph = implode(',', array_fill(0, count($incomingBoxNumbers), '?'));
                            $delParams = array_merge([$id], $incomingBoxNumbers);
                            $del = $pdo->prepare("DELETE FROM order_boxes WHERE order_id=? AND box_number NOT IN ($ph)");
                            $del->execute($delParams);
                        }
                    } else {
                        // $data['boxes'] is an empty array []
                        // We SKIP deletion to prevent data loss. If an order genuinely has 0 boxes, 
                        // it should be handled explicitly, but an empty array is usually a missing payload.
                        error_log("Skipped box deletion for order $id because payload 'boxes' was an empty array [].");
                    }
                }

                $pdo->commit();

                // 🔥 HOOK: Event-Driven Basket Routing on order_status change
                $newOrderStatus = $data['orderStatus'] ?? $data['order_status'] ?? null;
                $basketRoutingDebug = ['status_received' => $newOrderStatus, 'triggered' => false];

                if ($newOrderStatus) {
                    try {
                        require_once __DIR__ . '/../Services/BasketRoutingServiceV2.php';
                        $authUser = get_authenticated_user($pdo);
                        $triggeredBy = $authUser ? (int) ($authUser['id'] ?? 0) : 0;

                        $basketRoutingDebug['triggered'] = true;
                        $basketRoutingDebug['triggered_by'] = $triggeredBy;

                        $router = new BasketRoutingServiceV2($pdo);
                        $routingResult = $router->handleOrderStatusChange(
                            $id, // Pass string order ID directly
                            $newOrderStatus,
                            $triggeredBy
                        );

                        $basketRoutingDebug['result'] = $routingResult;

                        if ($routingResult && isset($routingResult['success']) && $routingResult['success']) {
                            error_log("[API/orders PUT] Basket routing triggered for order #$id: " .
                                "Basket {$routingResult['from_basket']} → {$routingResult['to_basket']}");
                        }
                    } catch (Exception $routeError) {
                        // Log but don't fail the order update
                        error_log("[API/orders PUT] Basket routing error for order #$id: " . $routeError->getMessage());
                        $basketRoutingDebug['error'] = $routeError->getMessage();
                    }
                }

                // Return updated order with debug info
                $o = get_order($pdo, $id);

                // Recalculate customer stats safely
                if ($o && !empty($o['customer_id'])) {
                    try {
                        $findStmt = $pdo->prepare('SELECT customer_id FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
                        $findStmt->execute([$o['customer_id'], is_numeric($o['customer_id']) ? (int) $o['customer_id'] : null]);
                        $customerResult = $findStmt->fetch();
                        if ($customerResult && $customerResult['customer_id']) {
                            recalculate_customer_stats_safe($pdo, (int)$customerResult['customer_id']);
                        }
                    } catch (Throwable $e) {}
                }

                $o['basket_routing'] = $basketRoutingDebug;
                json_response($o);

            } catch (Exception $e) {
                $pdo->rollBack();
                error_log("Update order failed: " . $e->getMessage());
                json_response(['error' => 'UPDATE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        case 'POST':
            $in = json_input();
            error_log('Order creation request: ' . json_encode($in));
            $pdo->beginTransaction();
            try {
                // Validate creator_id exists in users table and is active
                $creatorId = $in['creatorId'] ?? null;
                if ($creatorId === null || $creatorId === '') {
                    $pdo->rollBack();
                    json_response(['error' => 'CREATOR_ID_REQUIRED', 'message' => 'Creator user ID is required'], 400);
                    return;
                }

                $creatorCheck = $pdo->prepare('SELECT id, status FROM users WHERE id = ?');
                $creatorCheck->execute([$creatorId]);
                $creatorData = $creatorCheck->fetch(PDO::FETCH_ASSOC);
                if (!$creatorData) {
                    $pdo->rollBack();
                    json_response(['error' => 'CREATOR_USER_NOT_FOUND', 'message' => 'Creator user not found: ' . $creatorId], 400);
                    return;
                }

                if ($creatorData['status'] !== 'active') {
                    $pdo->rollBack();
                    json_response(['error' => 'CREATOR_USER_INACTIVE', 'message' => 'Creator user is not active: ' . $creatorId], 400);
                    return;
                }


                // 🎫 QUOTA ENFORCEMENT: Check if order items would exceed quota limits
                try {
                    $companyId = intval($in['companyId'] ?? 0);
                    $qUserId = intval($creatorId);
                    if ($companyId && $qUserId && !empty($in['items']) && is_array($in['items'])) {
                        // 1. Get all active quota products for this company
                        $qpStmt = $pdo->prepare("
                            SELECT qp.id AS quota_product_id, qp.product_id, qp.quota_cost
                            FROM quota_products qp
                            WHERE qp.company_id = :cid AND qp.is_active = 1 AND qp.deleted_at IS NULL
                        ");
                        $qpStmt->execute([':cid' => $companyId]);
                        $quotaProducts = $qpStmt->fetchAll(PDO::FETCH_ASSOC);

                        if (!empty($quotaProducts)) {
                            // 2. Build lookup: product_id → { quota_product_id, quota_cost }
                            $qpByProductId = [];
                            foreach ($quotaProducts as $qp) {
                                $qpByProductId[intval($qp['product_id'])] = [
                                    'quota_product_id' => intval($qp['quota_product_id']),
                                    'quota_cost' => intval($qp['quota_cost'] ?? 1),
                                ];
                            }

                            // 3. Calculate total quota needed per quota_product
                            $neededPerQP = []; // quota_product_id → total quantity needed
                            foreach ($in['items'] as $it) {
                                $productId = intval($it['productId'] ?? 0);
                                if (!$productId || !isset($qpByProductId[$productId])) continue;
                                $qpInfo = $qpByProductId[$productId];
                                $qty = max(0, intval($it['quantity'] ?? 0));
                                $usageQty = $qty * $qpInfo['quota_cost'];
                                $qpId = $qpInfo['quota_product_id'];
                                $neededPerQP[$qpId] = ($neededPerQP[$qpId] ?? 0) + $usageQty;
                            }

                            // 4. For each quota product needed, check remaining via internal API call
                            if (!empty($neededPerQP)) {
                                foreach ($neededPerQP as $qpId => $neededQty) {
                                    if ($neededQty <= 0) continue;

                                    // Call the quota API internally to get remaining
                                    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
                                    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
                                    $basePath = dirname($_SERVER['SCRIPT_NAME']);
                                    $calcUrl = "{$scheme}://{$host}{$basePath}/Quota/quota.php?action=calculate&quotaProductId={$qpId}&userId={$qUserId}";
                                    $ctx = stream_context_create(['http' => ['timeout' => 5, 'ignore_errors' => true]]);
                                    $calcResponse = @file_get_contents($calcUrl, false, $ctx);

                                    if ($calcResponse) {
                                        $calcData = json_decode($calcResponse, true);
                                        if (isset($calcData['data']['remaining'])) {
                                            $remaining = intval($calcData['data']['remaining']);
                                            if ($neededQty > $remaining) {
                                                // Find the product name for error message
                                                $nameStmt = $pdo->prepare("SELECT display_name FROM quota_products WHERE id = ?");
                                                $nameStmt->execute([$qpId]);
                                                $productName = $nameStmt->fetchColumn() ?: "Product #$qpId";

                                                $pdo->rollBack();
                                                json_response([
                                                    'error' => 'QUOTA_EXCEEDED',
                                                    'message' => "โควตาไม่เพียงพอสำหรับ \"$productName\" — ต้องการ $neededQty แต่คงเหลือ $remaining",
                                                    'details' => [
                                                        'quotaProductId' => $qpId,
                                                        'productName' => $productName,
                                                        'needed' => $neededQty,
                                                        'remaining' => $remaining,
                                                    ],
                                                ], 400);
                                                return;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (Throwable $e) {
                    // Log but don't block order creation if quota check fails
                    error_log('[Quota Enforcement] Error checking quota: ' . $e->getMessage());
                }

                // Check if bank_account_id and transfer_date columns exist
                $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
                $existingColumns = $pdo->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                                                WHERE TABLE_SCHEMA = '$dbName' AND TABLE_NAME = 'orders'")->fetchAll(PDO::FETCH_COLUMN);

                $hasBankAccountId = in_array('bank_account_id', $existingColumns);
                $hasTransferDate = in_array('transfer_date', $existingColumns);
                $hasShippingProvider = in_array('shipping_provider', $existingColumns);
                $hasBasketKeyAtSale = in_array('basket_key_at_sale', $existingColumns);

                // Fetch current_basket_key from customer for statistics
                // Smart mapping: distribution baskets (41-45) get mapped to segment keys
                $customerBasketKey = null;
                if ($hasBasketKeyAtSale && !empty($in['customerId'])) {
                    $basketStmt = $pdo->prepare('SELECT current_basket_key, assigned_to FROM customers WHERE customer_id = ?');
                    $basketStmt->execute([$in['customerId']]);
                    $custRow = $basketStmt->fetch(PDO::FETCH_ASSOC);
                    $rawBasketKey = $custRow ? ($custRow['current_basket_key'] ?: null) : null;
                    $assignedTo = $custRow ? ($custRow['assigned_to'] ?? null) : null;

                    // Distribution basket keys that are NOT in any segment group
                    $distributionBasketKeys = [41, 42, 43, 44, 45];

                    // Check if creator owns this customer (assigned_to matches creator)
                    $isOwnCustomer = ($assignedTo !== null && (int) $assignedTo === (int) $creatorId);

                    // Use raw basket key if: creator owns the customer AND basket is NOT a distribution basket
                    if ($isOwnCustomer && $rawBasketKey !== null && !in_array((int) $rawBasketKey, $distributionBasketKeys)) {
                        $customerBasketKey = $rawBasketKey;
                    } else {
                        // Map based on customerStatus from the frontend
                        $customerStatus = $in['customerStatus'] ?? $in['customerType'] ?? null;
                        switch ($customerStatus) {
                            case 'New Customer':
                                $customerBasketKey = 38; // ลูกค้าใหม่
                                break;
                            case 'Reorder Customer':
                                $customerBasketKey = 39; // ลูกค้ารีออเดอร์ (Core)
                                break;
                            case 'Mined Lead':
                                $customerBasketKey = 49; // ลูกค้าขุด (Revival)
                                break;
                            case 'Upsell':
                                $customerBasketKey = 51; // Upsell
                                break;
                            default:
                                // Fallback: use raw basket key if available, else 38
                                $customerBasketKey = $rawBasketKey ?? 38;
                                break;
                        }
                    }
                }

                // Build INSERT query dynamically based on available columns
                $columns = ['id', 'customer_id', 'company_id', 'creator_id', 'order_date', 'delivery_date', 'street', 'subdistrict', 'district', 'province', 'postal_code', 'recipient_first_name', 'recipient_last_name', 'recipient_phone'];
                if ($hasShippingProvider) {
                    $columns[] = 'shipping_provider';
                }
                $columns = array_merge($columns, ['shipping_cost', 'bill_discount', 'coupon_discount', 'total_amount', 'payment_method', 'payment_status', 'slip_url', 'amount_paid', 'cod_amount', 'order_status', 'notes', 'sales_channel', 'sales_channel_page_id', 'warehouse_id']);
                $values = [];
                $placeholders = [];

                if ($hasBankAccountId) {
                    $columns[] = 'bank_account_id';
                }
                if ($hasTransferDate) {
                    $columns[] = 'transfer_date';
                }
                // Always add customer_type as it was added via migration
                $columns[] = 'customer_type';
                // Add basket_key_at_sale if column exists
                if ($hasBasketKeyAtSale) {
                    $columns[] = 'basket_key_at_sale';
                }

                foreach ($columns as $col) {
                    $placeholders[] = '?';
                }

                $stmt = $pdo->prepare('INSERT INTO orders (' . implode(', ', $columns) . ') VALUES (' . implode(', ', $placeholders) . ')');
                $addr = $in['shippingAddress'] ?? [];
                $recipientFirstName = $addr['recipientFirstName'] ?? ($addr['recipient_first_name'] ?? null);
                $recipientLastName = $addr['recipientLastName'] ?? ($addr['recipient_last_name'] ?? null);

                // Normalize payment method: handle empty string, null, or undefined
                // Also normalize Thai values to match database enum ('COD','Transfer','PayAfter')
                $paymentMethod = $in['paymentMethod'] ?? null;
                if ($paymentMethod === '' || $paymentMethod === 'null' || $paymentMethod === 'undefined') {
                    $paymentMethod = null;
                } else if ($paymentMethod !== null) {
                    // Normalize payment method values to match database enum
                    // Database enum: 'COD', 'Transfer', 'PayAfter'
                    $paymentMethodStr = strval($paymentMethod);
                    if ($paymentMethodStr === 'COD' || $paymentMethodStr === 'cod' || $paymentMethodStr === 'C.O.D' || $paymentMethodStr === 'cash_on_delivery') {
                        $paymentMethod = 'COD';
                    } else if ($paymentMethodStr === 'Transfer' || $paymentMethodStr === 'transfer' || $paymentMethodStr === 'bank_transfer' || $paymentMethodStr === 'โอน') {
                        $paymentMethod = 'Transfer';
                    } else if (
                        $paymentMethodStr === 'PayAfter' || $paymentMethodStr === 'pay_after' || $paymentMethodStr === 'pay-after' ||
                        $paymentMethodStr === 'หลังจากรับสินค้า' || $paymentMethodStr === 'รับสินค้าก่อน' || $paymentMethodStr === 'ผ่อนชำระ' || $paymentMethodStr === 'ผ่อน'
                    ) {
                        $paymentMethod = 'PayAfter';
                    } else if ($paymentMethodStr === 'Claim' || $paymentMethodStr === 'claim' || $paymentMethodStr === 'ส่งเคลม') {
                        $paymentMethod = 'Claim';
                    } else if ($paymentMethodStr === 'FreeGift' || $paymentMethodStr === 'free_gift' || $paymentMethodStr === 'freegift' || $paymentMethodStr === 'ส่งของแถม') {
                        $paymentMethod = 'FreeGift';
                    } else if ($paymentMethodStr === 'DiscountCoupon' || $paymentMethodStr === 'discount_coupon' || $paymentMethodStr === 'discountcoupon' || $paymentMethodStr === 'คูปองส่วนลด' || $paymentMethodStr === 'coupon') {
                        $paymentMethod = 'DiscountCoupon';
                    } else {
                        // If value doesn't match any known pattern, log warning and set to null
                        error_log('Warning: Unknown payment method value: ' . $paymentMethodStr);
                        $paymentMethod = null;
                    }
                }

                // Get main order ID and validate it doesn't have sub order suffix
                $mainOrderId = $in['id'];
                // Ensure main order ID doesn't have sub order suffix (e.g., -1, -2)
                $resolved = resolve_main_order_id($pdo, $mainOrderId);
                if ($resolved['is_sub']) {
                    // If main order ID has suffix, use the base ID instead
                    $mainOrderId = $resolved['main_id'];
                    error_log("Warning: Main order ID had sub order suffix, using base ID: {$mainOrderId}");
                }
                $in['id'] = $mainOrderId;

                // Collect box numbers from items to ensure we cover all boxes
                $itemBoxNumbers = [];
                $maxItemBoxNumber = 1;
                if (!empty($in['items']) && is_array($in['items'])) {
                    foreach ($in['items'] as $it) {
                        $bn = isset($it['boxNumber']) ? (int) $it['boxNumber'] : (int) ($it['box_number'] ?? 1);
                        $bn = $bn > 0 ? $bn : 1;
                        $itemBoxNumbers[] = $bn;
                        if ($bn > $maxItemBoxNumber) {
                            $maxItemBoxNumber = $bn;
                        }
                    }
                }

                // Normalize boxes payload (support codAmount / collectionAmount)
                $normalizedBoxes = [];
                if (!empty($in['boxes']) && is_array($in['boxes'])) {
                    foreach ($in['boxes'] as $box) {
                        $num = isset($box['boxNumber']) ? (int) $box['boxNumber'] : (int) ($box['box_number'] ?? 0);
                        if ($num <= 0) {
                            $num = 1;
                        }
                        $amountRaw = $box['collectionAmount'] ?? $box['codAmount'] ?? $box['amount'] ?? $box['cod_amount'] ?? 0;
                        $amount = (float) $amountRaw;
                        if ($amount < 0) {
                            $amount = 0.0;
                        }
                        $normalizedBoxes[$num] = [
                            'box_number' => $num,
                            'collection_amount' => $amount,
                        ];
                    }
                }

                // Ensure at least one box exists
                $couponDiscount = isset($in['couponDiscount']) ? (float) $in['couponDiscount'] : 0.0;
                $expectedPayableAmount = max(0.0, (float)($in['totalAmount'] ?? 0) - $couponDiscount);
                $primaryAmount = isset($in['codAmount']) && $in['codAmount'] !== '' ? (float) $in['codAmount'] : $expectedPayableAmount;
                if (empty($normalizedBoxes)) {
                    $normalizedBoxes[1] = ['box_number' => 1, 'collection_amount' => $primaryAmount];
                }

                // Ensure boxes cover all item box numbers (fill missing with 0)
                $maxBoxNumber = max($maxItemBoxNumber, (!empty($normalizedBoxes) ? max(array_keys($normalizedBoxes)) : 1));
                for ($i = 1; $i <= $maxBoxNumber; $i++) {
                    if (!isset($normalizedBoxes[$i])) {
                        $normalizedBoxes[$i] = ['box_number' => $i, 'collection_amount' => 0.0];
                    }
                }
                ksort($normalizedBoxes);

                // Validate sequential numbering (1..N)
                $expectedSeq = 1;
                foreach ($normalizedBoxes as $num => $_) {
                    if ($num !== $expectedSeq) {
                        $pdo->rollBack();
                        json_response(['error' => 'INVALID_BOX_NUMBER', 'message' => 'boxNumber ต้องเรียงจาก 1 และห้ามข้ามเลข'], 400);
                        return;
                    }
                    $expectedSeq++;
                }

                $boxCount = count($normalizedBoxes);
                $totalAmount = isset($in['totalAmount']) ? (float) $in['totalAmount'] : 0.0;
                $boxTotal = array_reduce($normalizedBoxes, function ($carry, $b) {
                    return $carry + (float) ($b['collection_amount'] ?? 0);
                }, 0.0);

                $effectivePaymentMethod = $paymentMethod ?? 'COD';
                if ($effectivePaymentMethod === 'COD') {
                    $expectedCod = isset($in['codAmount']) && $in['codAmount'] !== '' ? (float) $in['codAmount'] : $expectedPayableAmount;
                    $expectedCod = max(0.0, $expectedCod);
                    if (abs($boxTotal - $expectedCod) > 0.01) {
                        $pdo->rollBack();
                        json_response(['error' => 'COD_BOX_TOTAL_MISMATCH', 'message' => 'ยอด COD ต่อกล่องรวมไม่ตรงกับยอด COD ทั้งหมด'], 400);
                        return;
                    }
                    $codAmountValue = $boxTotal;
                } else {
                    // Non-COD: Allow multiple boxes. No strict validation on box count.
                    // We keep normalizedBoxes as is (from user input or default).
                    $codAmountValue = null;
                }

                // Build per-box order IDs used only for order_items/order allocations
                $subOrderIds = [];
                for ($i = 1; $i <= $boxCount; $i++) {
                    $subOrderIds[] = "{$mainOrderId}-{$i}";
                }

                $shippingProvider = $in['shippingProvider'] ?? ($in['shipping_provider'] ?? null);
                if ($shippingProvider !== null && trim((string) $shippingProvider) === '') {
                    $shippingProvider = null;
                }

                $values = [
                    $mainOrderId,
                    $in['customerId'],
                    $in['companyId'],
                    $in['creatorId'],
                    $in['orderDate'],
                    $in['deliveryDate'],
                    $addr['street'] ?? null,
                    $addr['subdistrict'] ?? null,
                    $addr['district'] ?? null,
                    $addr['province'] ?? null,
                    $addr['postalCode'] ?? null,
                    $recipientFirstName,
                    $recipientLastName,
                    $addr['phone'] ?? null,
                ];
                if ($hasShippingProvider) {
                    $values[] = $shippingProvider;
                }
                $slipUrl = $in['slipUrl'] ?? null;
                if ($slipUrl === '') $slipUrl = null;
                // Handle base64 slip URL using the robust logic
                if (is_string($slipUrl) && strpos($slipUrl, 'data:image') === 0) {
                    try {
                        if (preg_match('/^data:(image\/(png|jpeg|jpg|gif|webp|bmp|svg\+xml));base64,(.*)$/is', $slipUrl, $m)) {
                            $ext = $m[2];
                            if ($ext === 'jpeg') $ext = 'jpg';
                            if ($ext === 'svg+xml') $ext = 'svg';
                            $data = base64_decode($m[3]);
                            if ($data !== false) {
                                $dir = __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'slips';
                                if (!is_dir($dir)) {
                                    @mkdir($dir, 0775, true);
                                }
                                $fname = 'slip_' . preg_replace('/[^A-Za-z0-9_-]+/', '', $mainOrderId) . '_' . date('Ymd_His') . '_' . substr(md5(uniqid('', true)), 0, 6) . '.' . $ext;
                                $path = $dir . DIRECTORY_SEPARATOR . $fname;
                                if (file_put_contents($path, $data) !== false) {
                                    $slipUrl = 'api/uploads/slips/' . $fname;
                                }
                            }
                        }
                    } catch (Throwable $e) { /* ignore and leave slipUrl as-is */ }
                    
                    // Prevent huge base64 strings from crashing the DB insert
                    if (is_string($slipUrl) && strlen($slipUrl) > 1000 && strpos($slipUrl, 'data:image') === 0) {
                        $slipUrl = null;
                    }
                }

                $values = array_merge($values, [
                    $in['shippingCost'] ?? 0,
                    $in['billDiscount'] ?? 0,
                    $in['couponDiscount'] ?? 0,
                    $in['totalAmount'] ?? 0,
                    $paymentMethod,
                    $in['paymentStatus'] ?? null,
                    $slipUrl,
                    $in['amountPaid'] ?? null,
                    $codAmountValue,
                    $in['orderStatus'] ?? null,
                    $in['notes'] ?? null,
                    $in['salesChannel'] ?? null,
                    $in['salesChannelPageId'] ?? null,
                    $in['warehouseId'] ?? null,
                ]);

                if ($hasBankAccountId) {
                    $values[] = isset($in['bankAccountId']) && $in['bankAccountId'] !== null && $in['bankAccountId'] !== '' ? (int) $in['bankAccountId'] : null;
                }
                if ($hasTransferDate) {
                    $values[] = isset($in['transferDate']) && $in['transferDate'] !== null && $in['transferDate'] !== '' ? $in['transferDate'] : null;
                }
                $values[] = $in['customerStatus'] ?? $in['customerType'] ?? null;
                // Add basket_key_at_sale value
                if ($hasBasketKeyAtSale) {
                    $values[] = $customerBasketKey;
                }

                try {
                    $stmt->execute($values);
                } catch (PDOException $e) {
                    // If duplicate entry error for main order, rollback and return error
                    if ($e->getCode() == 23000 && strpos($e->getMessage(), 'Duplicate entry') !== false) {
                        $pdo->rollBack();
                        json_response(['error' => 'DUPLICATE_ORDER', 'message' => 'Order ID already exists: ' . $mainOrderId], 400);
                        return;
                    }
                    // If validation error (e.g. data truncated), rethrow
                    throw $e;
                }

                // NOTE: customers.recipient_phone is updated ONLY via update_customer_address.php
                // when the user explicitly selects the profile address. It should NOT be auto-synced
                // here because the order may use a secondary address whose phone differs from the
                // customer's primary profile recipient phone.

                // DEBUG: Check what was inserted
                /*
                try {
                    $chk = $pdo->prepare("SELECT payment_method FROM orders WHERE id = ?");
                    $chk->execute([$mainOrderId]);
                    $res = $chk->fetch(PDO::FETCH_ASSOC);
                    // Debug logic removed for production
                } catch (Throwable $e) {}
                */

                // Insert order_boxes for per-box COD/collection tracking
                $boxIns = $pdo->prepare('INSERT INTO order_boxes (order_id, sub_order_id, box_number, payment_method, collection_amount, cod_amount, collected_amount, waived_amount, status) VALUES (?,?,?,?,?,?,?,?,?)');
                foreach ($normalizedBoxes as $box) {
                    $boxNumber = (int) ($box['box_number'] ?? 1);
                    $collectionAmount = (float) ($box['collection_amount'] ?? 0.0);
                    $subOrderIdForBox = "{$mainOrderId}-{$boxNumber}";
                    $boxIns->execute([
                        $mainOrderId,
                        $subOrderIdForBox,
                        $boxNumber,
                        $paymentMethod ?? 'COD',
                        $collectionAmount,
                        $collectionAmount, // keep cod_amount in sync for compatibility
                        0.0,
                        0.0,
                        'PENDING',
                    ]);
                }

                if (!empty($in['items']) && is_array($in['items'])) {
                    // Two-phase insert to satisfy FK parent_item_id -> order_items(id)
                    $ins = $pdo->prepare('INSERT INTO order_items (order_id, parent_order_id, product_id, product_name, quantity, price_per_unit, discount, net_total, is_freebie, box_number, promotion_id, parent_item_id, is_promotion_parent, creator_id, basket_key_at_sale) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');

                    $computeNetValues = function (array $item): array {
                        $quantity = isset($item['quantity']) ? (int) $item['quantity'] : 0;
                        $quantity = $quantity < 0 ? 0 : $quantity;
                        $pricePerUnit = isset($item['pricePerUnit']) ? (float) $item['pricePerUnit'] : (float) ($item['price_per_unit'] ?? 0.0);
                        $pricePerUnit = $pricePerUnit < 0 ? 0.0 : $pricePerUnit;
                        $discount = isset($item['discount']) ? (float) $item['discount'] : 0.0;
                        $isFreebie = (!empty($item['isFreebie']) || (!empty($item['is_freebie']) && (int) $item['is_freebie'] === 1)) ? 1 : 0;
                        $netTotal = calculate_order_item_net_total([
                            'quantity' => $quantity,
                            'pricePerUnit' => $pricePerUnit,
                            'discount' => $discount,
                            'isFreebie' => $isFreebie,
                        ]);
                        return [$quantity, $pricePerUnit, $discount, $netTotal, $isFreebie];
                    };

                    // IMPORTANT: order_items.order_id stores the sub_order_id format (e.g., "251226-00023adminga-3")
                    // This is NOT the parent_order_id. The parent_order_id is stored separately in order_items.parent_order_id
                    // Helper function to get order_id based on box_number (using synthesized per-box IDs)
                    $getOrderIdForBox = function ($boxNumber) use ($mainOrderId, $subOrderIds) {
                        $boxNum = (int) $boxNumber;
                        if ($boxNum <= 0) {
                            return $subOrderIds[0] ?? "{$mainOrderId}-1";
                        }
                        if (isset($subOrderIds[$boxNum - 1])) {
                            return $subOrderIds[$boxNum - 1];
                        }
                        return "{$mainOrderId}-{$boxNum}";
                    };

                    $clientToDbParent = [];
                    $clientToDbItem = [];

                    // 1) Insert promotion parents first and map client item id -> DB id
                    foreach ($in['items'] as $it) {
                        $isParent = !empty($it['isPromotionParent']);
                        if ($isParent) {
                            $boxNumber = isset($it['boxNumber']) ? (int) $it['boxNumber'] : 1;
                            $orderIdForItem = $getOrderIdForBox($boxNumber);
                            [$quantity, $pricePerUnit, $discount, $netTotal, $isFreebie] = $computeNetValues($it);
                            $ins->execute([
                                $orderIdForItem,
                                $mainOrderId,
                                !empty($it['productId']) ? (int)$it['productId'] : null,
                                $it['productName'] ?? null,
                                $quantity,
                                $pricePerUnit,
                                $discount,
                                $netTotal,
                                $isFreebie,
                                $boxNumber,
                                $it['promotionId'] ?? null,
                                null,
                                1,
                                $creatorId,
                                $customerBasketKey,
                            ]);
                            $dbId = (int) $pdo->lastInsertId();
                            if (isset($it['id'])) {
                                $clientToDbParent[(string) $it['id']] = $dbId;
                                $clientToDbItem[(string) $it['id']] = $dbId;
                            }
                        }
                    }

                    // 2) Insert regular items (not parent, not child)
                    foreach ($in['items'] as $it) {
                        $isParent = !empty($it['isPromotionParent']);
                        $hasParent = isset($it['parentItemId']) && $it['parentItemId'] !== null && $it['parentItemId'] !== '';
                        if (!$isParent && !$hasParent) {
                            $boxNumber = isset($it['boxNumber']) ? (int) $it['boxNumber'] : 1;
                            $orderIdForItem = $getOrderIdForBox($boxNumber);
                            [$quantity, $pricePerUnit, $discount, $netTotal, $isFreebie] = $computeNetValues($it);
                            $ins->execute([
                                $orderIdForItem,
                                $mainOrderId,
                                !empty($it['productId']) ? (int)$it['productId'] : null,
                                $it['productName'] ?? null,
                                $quantity,
                                $pricePerUnit,
                                $discount,
                                $netTotal,
                                $isFreebie,
                                $boxNumber,
                                $it['promotionId'] ?? null,
                                null,
                                0,
                                $creatorId,
                                $customerBasketKey,
                            ]);
                            $dbId = (int) $pdo->lastInsertId();
                            if (isset($it['id'])) {
                                $clientToDbItem[(string) $it['id']] = $dbId;
                            }
                        }
                    }

                    // 3) Insert children with resolved parent_item_id (map client id -> DB id)
                    foreach ($in['items'] as $it) {
                        $isParent = !empty($it['isPromotionParent']);
                        $clientParent = $it['parentItemId'] ?? null;
                        if (!$isParent && ($clientParent !== null && $clientParent !== '')) {
                            $resolved = null;
                            if ($clientParent !== null && isset($clientToDbParent[(string) $clientParent])) {
                                $resolved = $clientToDbParent[(string) $clientParent];
                            }
                            $boxNumber = isset($it['boxNumber']) ? (int) $it['boxNumber'] : 1;
                            $orderIdForItem = $getOrderIdForBox($boxNumber);
                            [$quantity, $pricePerUnit, $discount, $netTotal, $isFreebie] = $computeNetValues($it);

                            // --- Resolve priceOverride and parentQty ---
                            $overridePrice = isset($it['priceOverride']) ? (float) $it['priceOverride'] : (isset($it['price_override']) ? (float) $it['price_override'] : null);
                            $parentQty = 1;
                            $parentPromotionId = null;
                            foreach ($in['items'] as $parentItem) {
                                $pid = $parentItem['id'] ?? null;
                                if ($pid !== null && (string)$pid === (string)$clientParent && !empty($parentItem['isPromotionParent'])) {
                                    $parentQty = max(1, (int)($parentItem['quantity'] ?? 1));
                                    $parentPromotionId = $parentItem['promotionId'] ?? $parentItem['promotion_id'] ?? null;
                                    break;
                                }
                            }

                            // If priceOverride not in payload, look it up from promotion_items table
                            if ($overridePrice === null && $parentPromotionId !== null && !empty($it['productId'])) {
                                $poStmt = $pdo->prepare('SELECT price_override FROM promotion_items WHERE promotion_id = ? AND product_id = ? LIMIT 1');
                                $poStmt->execute([(int)$parentPromotionId, (int)$it['productId']]);
                                $poRow = $poStmt->fetch();
                                if ($poRow && $poRow['price_override'] !== null) {
                                    $overridePrice = (float) $poRow['price_override'];
                                }
                            }

                            // Apply override: net_total = priceOverride × parentQuantity
                            if ($overridePrice !== null && !$isFreebie) {
                                $netTotal = $overridePrice * $parentQty;
                            }
                            $ins->execute([
                                $orderIdForItem,
                                $mainOrderId,
                                !empty($it['productId']) ? (int)$it['productId'] : null,
                                $it['productName'] ?? null,
                                $quantity,
                                $pricePerUnit,
                                $discount,
                                $netTotal,
                                $isFreebie,
                                $boxNumber,
                                $it['promotionId'] ?? null,
                                $resolved,
                                0,
                                $creatorId,
                                $customerBasketKey,
                            ]);
                            $dbId = (int) $pdo->lastInsertId();
                            if (isset($it['id'])) {
                                $clientToDbItem[(string) $it['id']] = $dbId;
                            }
                        }
                    }

                    // 4) Create allocation rows for backoffice (warehouse-agnostic at creation time)
                    $alloc = $pdo->prepare('INSERT INTO order_item_allocations (order_id, order_item_id, product_id, required_quantity, is_freebie, promotion_id, status, created_by) VALUES (?,?,?,?,?,?,?,?)');
                    foreach ($in['items'] as $it) {
                        $isParent = !empty($it['isPromotionParent']);
                        $productId = $it['productId'] ?? null;
                        if ($isParent) {
                            continue;
                        }
                        if (!$productId) {
                            continue;
                        }
                        $orderItemId = null;
                        if (isset($it['id']) && isset($clientToDbItem[(string) $it['id']])) {
                            $orderItemId = $clientToDbItem[(string) $it['id']];
                        }
                        // Allocations remain tied to the main order for warehouse processing
                        $alloc->execute([
                            $mainOrderId,
                            $orderItemId,
                            $productId,
                            max(0, (int) ($it['quantity'] ?? 0)),
                            !empty($it['isFreebie']) ? 1 : 0,
                            $it['promotionId'] ?? null,
                            'PENDING',
                            $in['creatorId'] ?? null,
                        ]);
                    }
                }

                if (!empty($in['trackingEntries']) && is_array($in['trackingEntries'])) {
                    save_order_tracking_entries(
                        $pdo,
                        $mainOrderId,
                        $in['trackingEntries'],
                        false,
                        $in['creatorId'] ?? null,
                        $in['customerId'] ?? null
                    );
                } elseif (!empty($in['trackingNumbers']) && is_array($in['trackingNumbers'])) {
                    $legacyEntries = [];
                    foreach ($in['trackingNumbers'] as $tnRaw) {
                        $legacyEntries[] = ['trackingNumber' => $tnRaw];
                    }
                    save_order_tracking_entries(
                        $pdo,
                        $mainOrderId,
                        $legacyEntries,
                        false,
                        $in['creatorId'] ?? null,
                        $in['customerId'] ?? null
                    );
                }

                // Update customer total_purchases, grade, and last_order_date after order creation
                try {
                    $customerId = $in['customerId'] ?? null;
                    $orderTotal = floatval($in['totalAmount'] ?? 0);
                    $orderDate = $in['orderDate'] ?? date('Y-m-d H:i:s');

                    if ($customerId) {
                        // Find customer by customer_ref_id (varchar) or customer_id (int PK)
                        // Note: customers table uses customer_id as PK, not 'id'
                        $customerCheck = $pdo->prepare('SELECT customer_id, total_purchases FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
                        $customerCheck->execute([$customerId, is_numeric($customerId) ? (int) $customerId : 0]);
                        $customerData = $customerCheck->fetch(PDO::FETCH_ASSOC);

                        if ($customerData) {
                            $customerPk = $customerData['customer_id']; // This is the int PK

                            // Recalculate customer stats safely using the new helper function
                            recalculate_customer_stats_safe($pdo, (int)$customerPk);
                        } else {
                            error_log("Customer not found for ID: {$customerId}");
                        }
                    }
                } catch (Throwable $e) {
                    // Log error but don't fail the order creation
                    error_log('Failed to update customer: ' . $e->getMessage());
                }

                // Auto-allocate stock if warehouse is specified
                // This ensures stock is reserved immediately upon order creation
                if (!empty($in['warehouseId'])) {
                    try {
                        auto_allocate_order($pdo, $in['id'], (int) $in['warehouseId'], (int) ($in['companyId'] ?? 0));
                    } catch (Throwable $e) {
                        // Log error but allow order creation to proceed (allocation remains PENDING)
                        error_log("Auto-allocation failed during order creation for {$in['id']}: " . $e->getMessage());
                    }
                }

                $pdo->commit();
                error_log('Order created successfully: ' . $in['id']);

                // 🎫 HOOK: Auto-record quota usage for quota products in this order
                try {
                    $quotaRecorded = recordQuotaUsageForOrder($pdo, $mainOrderId, (int)($in['companyId'] ?? 0), (int)($in['creatorId'] ?? 0));
                    if ($quotaRecorded > 0) {
                        error_log("[Quota] Recorded $quotaRecorded quota usage(s) for new order #$mainOrderId");
                    }
                } catch (Throwable $e) {
                    error_log('[Quota] Failed to record usage for order ' . $mainOrderId . ': ' . $e->getMessage());
                }

                // Auto-assign to Telesale for Upsell (Round-Robin)
                try {
                    require_once __DIR__ . '/../Services/UpsellService.php';
                    $upsellService = new UpsellService($pdo, $in['companyId'] ?? 1);
                    $upsellResult = $upsellService->assignOrderToTelesale($in['id']);
                    if ($upsellResult['success']) {
                        error_log('Upsell assigned order ' . $in['id'] . ' to user ' . $upsellResult['assigned_to']);
                    }
                } catch (Throwable $e) {
                    error_log('Upsell assignment failed: ' . $e->getMessage());
                }

                // 🔥 HOOK: Event-Driven Basket Routing on new order creation
                $newOrderStatus = $in['orderStatus'] ?? 'Pending';
                $basketRoutingDebug = null;
                try {
                    require_once __DIR__ . '/../Services/BasketRoutingServiceV2.php';
                    $triggeredBy = $in['creatorId'] ?? 0;

                    $router = new BasketRoutingServiceV2($pdo);
                    $routingResult = $router->handleOrderStatusChange(
                        $mainOrderId, // Pass string order ID directly
                        $newOrderStatus,
                        (int) $triggeredBy
                    );

                    $basketRoutingDebug = $routingResult;

                    if ($routingResult && isset($routingResult['success']) && $routingResult['success']) {
                        error_log("[API/orders POST] Basket routing triggered for new order #$mainOrderId: " .
                            "Basket {$routingResult['from_basket']} → {$routingResult['to_basket']}");
                    }
                } catch (Exception $routeError) {
                    // Log but don't fail the order creation
                    error_log("[API/orders POST] Basket routing error for order #$mainOrderId: " . $routeError->getMessage());
                    $basketRoutingDebug = ['error' => $routeError->getMessage()];
                }

                // 🔍 DEBUG: Include routing result in response
                json_response(['ok' => true, 'id' => $in['id'], 'basket_routing' => $basketRoutingDebug]);
            } catch (Throwable $e) {
                $pdo->rollBack();
                error_log('Order creation failed: ' . $e->getMessage());
                json_response(['error' => 'ORDER_CREATE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        case 'PUT':
        case 'PATCH':
            // DEBUG: Log at the very start of PATCH handler
            file_put_contents(__DIR__ . '/../basket_debug.log', date('Y-m-d H:i:s') . " [ENTRY] PATCH/PUT Handler - ID: {$id}, Method: " . method() . "\n", FILE_APPEND);

            if (!$id) {
                error_log("PATCH/PUT called without ID");
                json_response(['error' => 'ID_REQUIRED'], 400);
            }
            // error_log("PATCH/PUT Received for ID: " . $id);
            $in = json_input();
            // Normalize incoming values: treat empty strings as NULL so they won't overwrite existing values
            $orderStatus = array_key_exists('orderStatus', $in) ? trim((string) $in['orderStatus']) : (array_key_exists('order_status', $in) ? trim((string) $in['order_status']) : null);
            if ($orderStatus === '')
                $orderStatus = null;
            $paymentStatus = array_key_exists('paymentStatus', $in) ? trim((string) $in['paymentStatus']) : null;
            if ($paymentStatus === '')
                $paymentStatus = null;
            $amountPaid = array_key_exists('amountPaid', $in) ? $in['amountPaid'] : null;
            if ($amountPaid === '')
                $amountPaid = null;
            $codAmount = array_key_exists('codAmount', $in) ? $in['codAmount'] : null;
            if ($codAmount === '')
                $codAmount = null;
            $notes = array_key_exists('notes', $in) ? $in['notes'] : null;
            if ($notes === '')
                $notes = null;
            $salesChannel = array_key_exists('salesChannel', $in) ? $in['salesChannel'] : null;
            if ($salesChannel === '')
                $salesChannel = null;
            $shippingProvider = array_key_exists('shippingProvider', $in) ? trim((string) $in['shippingProvider']) : (array_key_exists('shipping_provider', $in) ? trim((string) $in['shipping_provider']) : null);
            if ($shippingProvider === '')
                $shippingProvider = null;
            $totalAmount = array_key_exists('total_amount', $in) ? $in['total_amount'] : (array_key_exists('totalAmount', $in) ? $in['totalAmount'] : null);
            if ($totalAmount === '')
                $totalAmount = null;
            $couponDiscount = array_key_exists('coupon_discount', $in) ? $in['coupon_discount'] : (array_key_exists('couponDiscount', $in) ? $in['couponDiscount'] : null);
            if ($couponDiscount === '')
                $couponDiscount = null;
            $deliveryDate = array_key_exists('deliveryDate', $in) ? $in['deliveryDate'] : (array_key_exists('delivery_date', $in) ? $in['delivery_date'] : null);
            if ($deliveryDate === '')
                $deliveryDate = null;
            // Handle salesChannelPageId: track if explicitly set to null/empty (should clear the field)
            $salesChannelPageIdProvided = array_key_exists('salesChannelPageId', $in) || array_key_exists('sales_channel_page_id', $in);
            $salesChannelPageId = array_key_exists('salesChannelPageId', $in) ? $in['salesChannelPageId'] : (array_key_exists('sales_channel_page_id', $in) ? $in['sales_channel_page_id'] : null);
            if ($salesChannelPageId === '')
                $salesChannelPageId = null;
            // Force clear sales_channel_page_id when sales channel is "โทร" (phone) - it doesn't use pages
            $forceClearPageId = ($salesChannel === 'โทร' || ($salesChannelPageIdProvided && $salesChannelPageId === null));
            $street = array_key_exists('street', $in) ? $in['street'] : null;
            if ($street === '')
                $street = null;
            $subdistrict = array_key_exists('subdistrict', $in) ? $in['subdistrict'] : (array_key_exists('sub_district', $in) ? $in['sub_district'] : null);
            if ($subdistrict === '')
                $subdistrict = null;
            $district = array_key_exists('district', $in) ? $in['district'] : null;
            if ($district === '')
                $district = null;
            $province = array_key_exists('province', $in) ? $in['province'] : null;
            if ($province === '')
                $province = null;
            $postalCode = array_key_exists('postal_code', $in) ? $in['postal_code'] : (array_key_exists('postalCode', $in) ? $in['postalCode'] : null);
            if ($postalCode === '')
                $postalCode = null;
            $recipientFirstName = array_key_exists('recipient_first_name', $in) ? $in['recipient_first_name'] : (array_key_exists('recipientFirstName', $in) ? $in['recipientFirstName'] : null);
            if ($recipientFirstName === '')
                $recipientFirstName = null;
            $recipientLastName = array_key_exists('recipient_last_name', $in) ? $in['recipient_last_name'] : (array_key_exists('recipientLastName', $in) ? $in['recipientLastName'] : null);
            if ($recipientLastName === '')
                $recipientLastName = null;
            $customerType = array_key_exists('customer_type', $in) ? $in['customer_type'] : (array_key_exists('customerType', $in) ? $in['customerType'] : null);
            if ($customerType === '')
                $customerType = null;

            $slipUrl = array_key_exists('slipUrl', $in) ? $in['slipUrl'] : null;
            if ($slipUrl === '')
                $slipUrl = null;
            // If slipUrl is a data URL image, persist to file and store path
            if (is_string($slipUrl) && strpos($slipUrl, 'data:image') === 0) {
                try {
                    if (preg_match('/^data:(image\/(png|jpeg|jpg|gif|webp|bmp|svg\+xml));base64,(.*)$/is', $slipUrl, $m)) {
                        $ext = $m[2];
                        if ($ext === 'jpeg') $ext = 'jpg';
                        if ($ext === 'svg+xml') $ext = 'svg';
                        $data = base64_decode($m[3]);
                        if ($data !== false) {
                            $dir = __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'slips';
                            if (!is_dir($dir)) {
                                @mkdir($dir, 0775, true);
                            }
                            $fname = 'slip_' . preg_replace('/[^A-Za-z0-9_-]+/', '', $id) . '_' . date('Ymd_His') . '_' . substr(md5(uniqid('', true)), 0, 6) . '.' . $ext;
                            $path = $dir . DIRECTORY_SEPARATOR . $fname;
                            if (file_put_contents($path, $data) !== false) {
                                // Store web-accessible path
                                $slipUrl = 'api/uploads/slips/' . $fname;
                            }
                        }
                    }
                } catch (Throwable $e) { /* ignore and leave slipUrl as-is */
                }
                // Prevent huge base64 strings from crashing the DB update
                if (is_string($slipUrl) && strlen($slipUrl) > 1000 && strpos($slipUrl, 'data:image') === 0) {
                    $slipUrl = null;
                }
            }

            $allocationSummary = [];
            $releaseSummary = [];

            $pdo->beginTransaction();
            try {
                $lockStmt = $pdo->prepare('SELECT order_status, payment_status, customer_id, warehouse_id, company_id, total_amount, payment_method, cod_amount, creator_id, basket_key_at_sale FROM orders WHERE id = ? FOR UPDATE');
                $lockStmt->execute([$id]);
                $existingOrder = $lockStmt->fetch(PDO::FETCH_ASSOC);
                if (!$existingOrder) {
                    error_log("Order NOT FOUND in database for ID: " . $id);
                    $pdo->rollBack();
                    json_response(['error' => 'NOT_FOUND'], 404);
                }
                // error_log("Order Found: " . json_encode($existingOrder));

                // [PREVENTION] AwaitingVerification requires Amount Paid > 0
                $statusTarget = $orderStatus ?? $existingOrder['order_status'];
                if ($statusTarget === 'AwaitingVerification') {
                    $valAmount = $amountPaid !== null ? (float) $amountPaid : (float) ($existingOrder['amount_paid'] ?? 0);
                    if ($valAmount <= 0.0) {
                        $pdo->rollBack();
                        json_response(['error' => 'PAYMENT_REQUIRED', 'message' => 'Status cannot be AwaitingVerification without specifying Amount Paid'], 400);
                    }
                }

                // [PREVENTION] PreApproved requires PaymentStatus != Unpaid
                if ($statusTarget === 'PreApproved') {
                    // Check effective payment status
                    $effectivePaymentStatus = $paymentStatus ?? $existingOrder['payment_status'];
                    if ($effectivePaymentStatus === 'Unpaid') {
                        $pdo->rollBack();
                        json_response(['error' => 'PAYMENT_REQUIRED', 'message' => 'Status cannot be PreApproved if Payment Status is Unpaid'], 400);
                    }
                }

                $previousStatus = (string) ($existingOrder['order_status'] ?? '');
                $previousPayment = (string) ($existingOrder['payment_status'] ?? '');
                $customerId = $existingOrder['customer_id'] ?? null;

                // [PREVENTION] Cap amount_paid at 1.5x total_amount to prevent doubling bugs
                // Allows normal overpayments (ลูกค้าโอนเกิน) but blocks 2x doubling
                if ($amountPaid !== null && $amountPaid !== '' && (float) $amountPaid > 0) {
                    $effectiveTotal = $totalAmount !== null ? (float) $totalAmount : (float) ($existingOrder['total_amount'] ?? 0);
                    $capLimit = $effectiveTotal * 1.5;
                    if ($effectiveTotal > 0 && (float) $amountPaid > $capLimit) {
                        $amountPaid = $effectiveTotal; // Reset to exact total if exceeds 1.5x
                    }
                }

                // [PREVENTION] Floor: don't let amount_paid drop below debt_collection total
                // This prevents slip upload resets (amountPaid: 0) from erasing debt amounts
                if ($amountPaid !== null && $amountPaid !== '') {
                    try {
                        $debtFloorStmt = $pdo->prepare("SELECT COALESCE(SUM(amount_collected), 0) FROM debt_collection WHERE order_id = ?");
                        $debtFloorStmt->execute([$id]);
                        $debtFloor = (float) $debtFloorStmt->fetchColumn();
                        if ($debtFloor > 0 && (float) $amountPaid < $debtFloor) {
                            $amountPaid = $debtFloor;
                        }
                    } catch (Throwable $e) {
                        // debt_collection table might not exist — ignore
                    }
                }

                // [LOGGING] Capture Previous Tracking
                $ptStmt = $pdo->prepare("SELECT tracking_number FROM order_tracking_numbers WHERE parent_order_id = ? ORDER BY id");
                $ptStmt->execute([$id]);
                $prevTrackings = $ptStmt->fetchAll(PDO::FETCH_COLUMN);
                $previousTrackingStr = implode(', ', array_filter($prevTrackings));

                $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
                $existingColumns = $pdo->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '$dbName' AND TABLE_NAME = 'orders'")->fetchAll(PDO::FETCH_COLUMN);
                $hasShippingProvider = in_array('shipping_provider', $existingColumns);

                // Build UPDATE SQL - sales_channel_page_id is handled specially based on $forceClearPageId
                $pageIdSql = $forceClearPageId ? 'sales_channel_page_id=NULL' : 'sales_channel_page_id=COALESCE(?, sales_channel_page_id)';
                $updateSql = 'UPDATE orders SET slip_url=COALESCE(?, slip_url), order_status=COALESCE(?, order_status), payment_status=COALESCE(?, payment_status), amount_paid=COALESCE(?, amount_paid), cod_amount=COALESCE(?, cod_amount), notes=COALESCE(?, notes), sales_channel=COALESCE(?, sales_channel), ' . $pageIdSql . ', delivery_date=COALESCE(?, delivery_date), street=COALESCE(?, street), subdistrict=COALESCE(?, subdistrict), district=COALESCE(?, district), province=COALESCE(?, province), postal_code=COALESCE(?, postal_code), recipient_first_name=COALESCE(?, recipient_first_name), recipient_last_name=COALESCE(?, recipient_last_name), total_amount=COALESCE(?, total_amount), coupon_discount=COALESCE(?, coupon_discount), customer_type=COALESCE(?, customer_type)';

                // Build params - only include salesChannelPageId if not force clearing
                if ($forceClearPageId) {
                    $params = [$slipUrl, $orderStatus, $paymentStatus, $amountPaid, $codAmount, $notes, $salesChannel, $deliveryDate, $street, $subdistrict, $district, $province, $postalCode, $recipientFirstName, $recipientLastName, $totalAmount, $couponDiscount, $customerType];
                } else {
                    $params = [$slipUrl, $orderStatus, $paymentStatus, $amountPaid, $codAmount, $notes, $salesChannel, $salesChannelPageId, $deliveryDate, $street, $subdistrict, $district, $province, $postalCode, $recipientFirstName, $recipientLastName, $totalAmount, $couponDiscount, $customerType];
                }
                if ($hasShippingProvider) {
                    $updateSql .= ', shipping_provider=COALESCE(?, shipping_provider)';
                    $params[] = $shippingProvider;
                }
                $updateSql .= ' WHERE id=?';
                $params[] = $id;

                $stmt = $pdo->prepare($updateSql);

                // DEBUG LOG
                $debugMsg = "DEBUG UPDATE SQL: " . $updateSql . "\n";
                $debugMsg .= "DEBUG PARAMS COUNT: " . count($params) . "\n";
                $debugMsg .= "DEBUG PARAMS: " . json_encode($params) . "\n";
                file_put_contents(__DIR__ . '/../basket_debug.log', $debugMsg, FILE_APPEND);

                $stmt->execute($params);


                $orderRowStmt = $pdo->prepare('SELECT order_status, payment_status, customer_id, warehouse_id, company_id, total_amount, payment_method, cod_amount FROM orders WHERE id=?');
                $orderRowStmt->execute([$id]);
                $updatedOrder = $orderRowStmt->fetch(PDO::FETCH_ASSOC);
                if (!$updatedOrder) {
                    throw new RuntimeException('ORDER_RELOAD_FAILED');
                }

                $newStatus = (string) ($updatedOrder['order_status'] ?? $previousStatus);
                $newPaymentStatus = (string) ($updatedOrder['payment_status'] ?? $previousPayment);
                $customerId = $updatedOrder['customer_id'] ?? $customerId;
                $warehouseIdForAllocation = $updatedOrder['warehouse_id'] !== null ? (int) $updatedOrder['warehouse_id'] : null;
                $companyIdForAllocation = $updatedOrder['company_id'] !== null ? (int) $updatedOrder['company_id'] : null;


                try {
                    if (
                        (isset($paymentStatus) && strcasecmp((string) $paymentStatus, 'Paid') === 0) ||
                        (isset($orderStatus) && strcasecmp((string) $orderStatus, 'Delivered') === 0)
                    ) {
                        if ($customerId) {
                            // Find customer by customer_ref_id or customer_id, then update using customer_id (PK)
                            $findStmt = $pdo->prepare('SELECT customer_id FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
                            $findStmt->execute([$customerId, is_numeric($customerId) ? (int) $customerId : null]);
                            $customer = $findStmt->fetch();
                            if ($customer && $customer['customer_id']) {
                                $upd = $pdo->prepare('UPDATE customers SET lifecycle_status=? WHERE customer_id=?');
                                $upd->execute(['Old3Months', $customer['customer_id']]);
                            }
                        }
                    }
                } catch (Throwable $e) { /* ignore */
                }

                try {
                    // If order status is Picking, grant sale quota (+90 days)
                    // Use delivery_date from order as the sale date, then add 90 days for ownership_expires

                    // DEBUG: Write to file to trace execution
                    $debugFile = __DIR__ . '/../basket_debug.log';
                    file_put_contents($debugFile, date('Y-m-d H:i:s') . " PATCH Order Check: orderId={$id}, customerId={$customerId}, newStatus={$newStatus}\n", FILE_APPEND);

                    if ($customerId && strcasecmp($newStatus, 'Picking') === 0) {
                        file_put_contents($debugFile, date('Y-m-d H:i:s') . " INSIDE PICKING BLOCK - Order {$id}\n", FILE_APPEND);

                        // Clear Upsell assignment when order moves to Picking
                        try {
                            require_once __DIR__ . '/../Services/UpsellService.php';
                            $upsellService = new UpsellService($pdo, $companyIdForAllocation ?? 1);
                            $upsellService->clearUpsellOnPicking($id);
                            error_log('Upsell cleared for order ' . $id . ' (status = Picking)');
                        } catch (Throwable $e) {
                            error_log('Upsell clear failed: ' . $e->getMessage());
                        }

                        // Find customer first (needed for both delivery_date logic and basket transition)
                        $findStmt = $pdo->prepare('SELECT customer_id FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
                        $findStmt->execute([$customerId, is_numeric($customerId) ? (int) $customerId : null]);
                        $customer = $findStmt->fetch();

                        file_put_contents($debugFile, date('Y-m-d H:i:s') . " Customer found: " . json_encode($customer) . "\n", FILE_APPEND);
                        // Get delivery_date from the order for ownership calculation
                        $orderStmt = $pdo->prepare('SELECT delivery_date FROM orders WHERE id=?');
                        $orderStmt->execute([$id]);
                        $deliveryDateStr = $orderStmt->fetchColumn();

                        if ($deliveryDateStr && $customer && $customer['customer_id']) {
                            $deliveryDate = new DateTime($deliveryDateStr);
                            // ownership_expires = delivery_date + 90 days
                            $newExpiry = clone $deliveryDate;
                            $newExpiry->add(new DateInterval('P90D'));

                            // Ensure max 90 days from current date
                            $now = new DateTime();
                            $maxAllowed = (clone $now);
                            $maxAllowed->add(new DateInterval('P90D'));
                            if ($newExpiry > $maxAllowed) {
                                $newExpiry = $maxAllowed;
                            }

                            // Find customer by customer_ref_id or customer_id, then update using customer_id (PK)
                            $findStmt = $pdo->prepare('SELECT customer_id FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
                            $findStmt->execute([$customerId, is_numeric($customerId) ? (int) $customerId : null]);
                            $customer = $findStmt->fetch();
                            if ($customer && $customer['customer_id']) {
                                $u = $pdo->prepare('UPDATE customers SET ownership_expires=?, has_sold_before=1, last_sale_date=?, follow_up_count=0, lifecycle_status=?, followup_bonus_remaining=1 WHERE customer_id=?');
                                $u->execute([$newExpiry->format('Y-m-d H:i:s'), $deliveryDate->format('Y-m-d H:i:s'), 'Old3Months', $customer['customer_id']]);

                                // [Basket Routing] Handle transition on sale
                                try {
                                    $routingService = new BasketRoutingService($pdo, $existingOrder['company_id'] ?? 1);
                                    // Use updatedOrder['creator_id'] or existingOrder['creator_id'] as user causing sale
                                    $userId = $updatedOrder['creator_id'] ?? $existingOrder['creator_id'] ?? null;
                                    $routingService->handleSaleTransition($customer['customer_id'], $userId);
                                } catch (Throwable $routeErr) {
                                    error_log("Basket Routing Failed: " . $routeErr->getMessage());
                                }
                            }
                        }
                    }
                } catch (Throwable $e) { /* ignore quota errors to not block order update */
                }

                // Tracking update logic moved to after box processing to ensure correct box count

                if ($orderStatus !== null) {
                    $normalizedStatus = strtoupper($orderStatus);
                    if ($normalizedStatus === 'PICKING' && strcasecmp($previousStatus, 'Picking') !== 0) {
                        // Only auto-allocate if warehouse_id exists, otherwise skip (for companies not using warehouse system)
                        if ($warehouseIdForAllocation) {
                            try {
                                $allocationSummary = auto_allocate_order($pdo, $id, $warehouseIdForAllocation, $companyIdForAllocation);
                            } catch (Throwable $allocErr) {
                                // Log but don't fail the order status update if allocation fails
                                error_log('Auto-allocation failed for order ' . $id . ': ' . $allocErr->getMessage());
                            }
                        }
                        // If no warehouse_id, just update status without allocation (for companies not using warehouse system)
                    } elseif ($normalizedStatus === 'CANCELLED' && strcasecmp($previousStatus, 'Cancelled') !== 0) {
                        $releaseSummary = release_order_allocations($pdo, $id);
                    }
                }

                if (isset($in['boxes']) && is_array($in['boxes'])) {
                    $effectivePaymentMethod = $updatedOrder['payment_method'] ?? $existingOrder['payment_method'] ?? 'COD';
                    $orderTotal = isset($updatedOrder['total_amount']) ? (float) $updatedOrder['total_amount'] : (float) ($existingOrder['total_amount'] ?? 0);
                    $codTarget = $codAmount !== null ? (float) $codAmount : (isset($updatedOrder['cod_amount']) ? (float) $updatedOrder['cod_amount'] : null);
                    if ($codTarget === null || $codTarget <= 0) {
                        $codTarget = $orderTotal;
                    }

                    $normalizedBoxes = [];
                    foreach ($in['boxes'] as $box) {
                        $num = isset($box['boxNumber']) ? (int) $box['boxNumber'] : (int) ($box['box_number'] ?? 0);
                        if ($num <= 0) {
                            $num = 1;
                        }
                        $collectionAmount = (float) ($box['collectionAmount'] ?? $box['collection_amount'] ?? $box['codAmount'] ?? $box['cod_amount'] ?? 0);
                        if ($collectionAmount < 0) {
                            $collectionAmount = 0.0;
                        }
                        $codAmountBox = (float) ($box['codAmount'] ?? $box['cod_amount'] ?? $collectionAmount);
                        if ($codAmountBox < 0) {
                            $codAmountBox = 0.0;
                        }
                        $collectedAmount = (float) ($box['collectedAmount'] ?? $box['collected_amount'] ?? 0);
                        if ($collectedAmount < 0) {
                            $collectedAmount = 0.0;
                        }
                        $waivedAmount = (float) ($box['waivedAmount'] ?? $box['waived_amount'] ?? 0);
                        if ($waivedAmount < 0) {
                            $waivedAmount = 0.0;
                        }
                        // Preserve box status from frontend for RETURNED check
                        $boxStatus = $box['status'] ?? null;
                        $normalizedBoxes[$num] = [
                            'box_number' => $num,
                            'collection_amount' => $collectionAmount,
                            'cod_amount' => $codAmountBox,
                            'collected_amount' => $collectedAmount,
                            'waived_amount' => $waivedAmount,
                            'status' => $boxStatus,
                        ];
                    }

                    ksort($normalizedBoxes);
                    $expected = 1;
                    foreach ($normalizedBoxes as $num => $_) {
                        if ($num !== $expected) {
                            throw new RuntimeException('INVALID_BOX_NUMBER_SEQUENCE');
                        }
                        $expected++;
                    }

                    if ($effectivePaymentMethod !== 'COD') {
                        // For non-COD: use per-box cod_amount from frontend
                        // If box is RETURNED, preserve existing collection_amount from DB
                        $selectExistingBox = $pdo->prepare('SELECT collection_amount, status FROM order_boxes WHERE order_id=? AND box_number=? LIMIT 1');
                        foreach ($normalizedBoxes as $num => &$boxData) {
                            $selectExistingBox->execute([$id, $num]);
                            $existingBoxRow = $selectExistingBox->fetch(PDO::FETCH_ASSOC);
                            $dbStatus = $existingBoxRow ? strtoupper($existingBoxRow['status'] ?? '') : '';

                            if ($dbStatus === 'RETURNED') {
                                // RETURNED box: update cod_amount but preserve collection_amount from DB
                                $boxData['collection_amount'] = (float) ($existingBoxRow['collection_amount'] ?? 0);
                            } else {
                                // Non-RETURNED box: set collection_amount = cod_amount (from frontend)
                                $boxData['collection_amount'] = $boxData['cod_amount'];
                            }
                            $boxData['collected_amount'] = 0.0;
                            $boxData['waived_amount'] = 0.0;
                        }
                        unset($boxData); // Break reference

                        $boxCount = count($normalizedBoxes);
                        $boxTotal = $totalAmount;
                        $codTarget = null;
                    }

                    $boxSum = array_reduce($normalizedBoxes, function ($carry, $b) {
                        return $carry + (float) ($b['collection_amount'] ?? 0);
                    }, 0.0);

                    if ($effectivePaymentMethod === 'COD') {
                        if (abs($boxSum - $codTarget) > 0.01) {
                            throw new RuntimeException('COD_BOX_TOTAL_MISMATCH');
                        }
                    }

                    $selectBox = $pdo->prepare('SELECT id FROM order_boxes WHERE order_id=? AND box_number=? LIMIT 1');
                    $updateBox = $pdo->prepare('UPDATE order_boxes SET payment_method=?, collection_amount=?, cod_amount=?, collected_amount=?, waived_amount=?, sub_order_id=?, status=COALESCE(status, \'PENDING\') WHERE order_id=? AND box_number=?');
                    $insertBox = $pdo->prepare('INSERT INTO order_boxes (order_id, sub_order_id, box_number, payment_method, collection_amount, cod_amount, collected_amount, waived_amount, status) VALUES (?,?,?,?,?,?,?,?,\'PENDING\')');

                    $boxNumbers = array_keys($normalizedBoxes);
                    if (!empty($boxNumbers)) {
                        $ph = implode(',', array_fill(0, count($boxNumbers), '?'));
                        $delParams = array_merge([$id], $boxNumbers);
                        $del = $pdo->prepare("DELETE FROM order_boxes WHERE order_id=? AND box_number NOT IN ($ph)");
                        $del->execute($delParams);
                    }

                    foreach ($normalizedBoxes as $num => $box) {
                        $subOrderId = "{$id}-{$num}";
                        $selectBox->execute([$id, $num]);
                        $existingBoxId = $selectBox->fetchColumn();
                        if ($existingBoxId) {
                            $updateBox->execute([
                                $effectivePaymentMethod,
                                $box['collection_amount'],
                                $box['cod_amount'] ?? $box['collection_amount'],
                                $box['collected_amount'],
                                $box['waived_amount'],
                                $subOrderId,
                                $id,
                                $num,
                            ]);
                        } else {
                            $insertBox->execute([
                                $id,
                                $subOrderId,
                                $num,
                                $effectivePaymentMethod,
                                $box['collection_amount'],
                                $box['cod_amount'] ?? $box['collection_amount'],
                                $box['collected_amount'],
                                $box['waived_amount'],
                            ]);
                        }
                    }

                    if ($effectivePaymentMethod === 'COD') {
                        $updCodAmount = $pdo->prepare('UPDATE orders SET cod_amount=? WHERE id=?');
                        $updCodAmount->execute([$boxSum, $id]);
                    } else {
                        $updCodAmount = $pdo->prepare('UPDATE orders SET cod_amount=NULL WHERE id=?');
                        $updCodAmount->execute([$id]);
                    }
                }

                // [MOVED] Tracking Processing Logic
                $hasTrackingUpdate = false;
                if (isset($in['trackingEntries']) && is_array($in['trackingEntries']) && !empty($in['trackingEntries'])) {
                    save_order_tracking_entries($pdo, $id, $in['trackingEntries'], true);
                    $hasTrackingUpdate = true;
                } elseif (isset($in['trackingNumbers']) && is_array($in['trackingNumbers']) && !empty($in['trackingNumbers'])) {
                    $legacyEntries = [];
                    foreach ($in['trackingNumbers'] as $tnRaw) {
                        $tn = trim((string) $tnRaw);
                        if ($tn !== '') {
                            $legacyEntries[] = ['trackingNumber' => $tn];
                        }
                    }
                    if (!empty($legacyEntries)) {
                        save_order_tracking_entries($pdo, $id, $legacyEntries, true);
                        $hasTrackingUpdate = true;
                    }
                }

                // --- Auto-Sync with Google Sheet Shipping Data ---
                if ($hasTrackingUpdate) {
                    try {
                        $syncService = new ShippingSyncService($pdo);
                        // We need the tracking numbers to sync.
                        // Collect them from input or fetch from DB if needed.
                        // Here we iterate over what was just added/update.
                        $trackingsToSync = [];

                        if (!empty($in['trackingEntries'])) {
                            foreach ($in['trackingEntries'] as $entry) {
                                if (!empty($entry['trackingNumber']))
                                    $trackingsToSync[] = $entry['trackingNumber'];
                            }
                        } elseif (!empty($in['trackingNumbers'])) {
                            foreach ($in['trackingNumbers'] as $tn) {
                                if (!empty($tn))
                                    $trackingsToSync[] = $tn;
                            }
                        }

                        foreach (array_unique($trackingsToSync) as $tn) {
                            $syncService->syncOrderFromSheet($tn);
                        }
                    } catch (Throwable $syncErr) {
                        error_log("Shipping Sync Failed for Order {$id}: " . $syncErr->getMessage());
                    }
                }
                // -------------------------------------------------

                // Auto-update order_status to Shipping when tracking is added and order is Picking or Preparing
                // Only if order_status is not explicitly set in the request
                // Auto-update logic when tracking is added
                if ($hasTrackingUpdate && $orderStatus === null) {
                    $currentStatus = strtoupper((string) ($updatedOrder['order_status'] ?? $previousStatus));
                    $currentPaymentMethod = (string) ($updatedOrder['payment_method'] ?? $existingOrder['payment_method'] ?? '');

                    // Special handling for Claim and FreeGift
                    if ($currentPaymentMethod === 'Claim' || $currentPaymentMethod === 'FreeGift') {
                        $autoCompleteStmt = $pdo->prepare('UPDATE orders SET order_status = ?, payment_status = ?, amount_paid = 0 WHERE id = ?');
                        $autoCompleteStmt->execute(['Delivered', 'Approved', $id]);

                        $newStatus = 'Delivered';
                        $newPaymentStatus = 'Approved';

                        $updatedOrder['order_status'] = 'Delivered';
                        $updatedOrder['payment_status'] = 'Approved';
                        $updatedOrder['amount_paid'] = 0;

                        // Update Variables to trigger history log and downstream logic
                        $orderStatus = 'Delivered';
                        $paymentStatus = 'Approved';
                    }
                    // Auto-update when tracking is added to Picking/Preparing orders
                    elseif (($currentStatus === 'PICKING' || $currentStatus === 'PREPARING')) {
                        // Check if payment already approved (Bank Audit done before shipping)
                        $currentPaymentStatusCheck = (string) ($updatedOrder['payment_status'] ?? $existingOrder['payment_status'] ?? '');
                        if ($currentPaymentStatusCheck === 'Approved' || $currentPaymentStatusCheck === 'Paid') {
                            // Payment already confirmed + tracking exists = auto-complete to Delivered
                            $autoShippingStmt = $pdo->prepare('UPDATE orders SET order_status = ?, payment_status = ? WHERE id = ?');
                            $autoShippingStmt->execute(['Delivered', 'Approved', $id]);
                            $newStatus = 'Delivered';
                            $newPaymentStatus = 'Approved';
                            $updatedOrder['order_status'] = 'Delivered';
                            $updatedOrder['payment_status'] = 'Approved';
                            // Update variables for history log and downstream logic
                            $orderStatus = 'Delivered';
                            $paymentStatus = 'Approved';
                        } else {
                            // Normal flow: payment not yet confirmed → Shipping
                            $autoShippingStmt = $pdo->prepare('UPDATE orders SET order_status = ? WHERE id = ?');
                            $autoShippingStmt->execute(['Shipping', $id]);
                            $newStatus = 'Shipping';
                            $updatedOrder['order_status'] = 'Shipping';
                        }
                        // Reload order to get updated status
                        $orderRowStmt->execute([$id]);
                        $updatedOrder = $orderRowStmt->fetch(PDO::FETCH_ASSOC);
                        if ($updatedOrder) {
                            $newStatus = (string) ($updatedOrder['order_status'] ?? $newStatus);
                        }
                    }
                }

                // Update items if provided (Delete all existing and re-create)
                if (isset($in['items']) && is_array($in['items'])) {
                    $itemCreatorId = $in['creatorId'] ?? $existingOrder['creator_id'] ?? null;

                    // 1. Backup old items for Upsell preserving
                    $oldItemsStmt = $pdo->prepare('SELECT id, creator_id, basket_key_at_sale FROM order_items WHERE parent_order_id = ?');
                    $oldItemsStmt->execute([$id]);
                    $oldItemsMap = [];
                    foreach ($oldItemsStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                        $oldItemsMap[$row['id']] = $row;
                    }

                    // Fetch current customer basket for new upsell items
                    $currentBasket = null;
                    if (!empty($existingOrder['customer_id'])) {
                        $custStmt = $pdo->prepare('SELECT current_basket_key FROM customers WHERE customer_id = ?');
                        $custStmt->execute([$existingOrder['customer_id']]);
                        $fetchedBasket = $custStmt->fetchColumn();
                        if ($fetchedBasket) {
                            $currentBasket = (string)$fetchedBasket;
                        }
                    }

                    // 1.5 Clear old allocations and items to prevent duplicates/conflicts
                    $pdo->prepare('DELETE FROM order_item_allocations WHERE order_id = ? OR order_id LIKE CONCAT(?, "-%")')->execute([$id, $id]);
                    $pdo->prepare('DELETE FROM order_items WHERE order_id = ? OR order_id LIKE CONCAT(?, "-%")')->execute([$id, $id]);

                    // 2. Prepare insert statement (same as POST) - include basket_key_at_sale
                    $orderBasketKey = $existingOrder['basket_key_at_sale'] ?? null;
                    $ins = $pdo->prepare('INSERT INTO order_items (order_id, parent_order_id, product_id, product_name, quantity, price_per_unit, discount, net_total, is_freebie, box_number, promotion_id, parent_item_id, is_promotion_parent, creator_id, basket_key_at_sale) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');

                    $computeNetValues = function (array $item): array {
                        $quantity = isset($item['quantity']) ? (int) $item['quantity'] : 0;
                        $quantity = $quantity < 0 ? 0 : $quantity;
                        $pricePerUnit = isset($item['pricePerUnit']) ? (float) $item['pricePerUnit'] : (float) ($item['price_per_unit'] ?? 0.0);
                        $pricePerUnit = $pricePerUnit < 0 ? 0.0 : $pricePerUnit;
                        $discount = isset($item['discount']) ? (float) $item['discount'] : 0.0;
                        $isFreebie = (!empty($item['isFreebie']) || (!empty($item['is_freebie']) && (int) $item['is_freebie'] === 1)) ? 1 : 0;
                        $netTotal = calculate_order_item_net_total([
                            'quantity' => $quantity,
                            'pricePerUnit' => $pricePerUnit,
                            'discount' => $discount,
                            'isFreebie' => $isFreebie,
                        ]);
                        return [$quantity, $pricePerUnit, $discount, $netTotal, $isFreebie];
                    };

                    // IMPORTANT: order_items.order_id stores the sub_order_id format (e.g., "251226-00023adminga-3")
                    // This is NOT the parent_order_id. The parent_order_id is stored separately in order_items.parent_order_id
                    // Query order_boxes to get the actual sub_order_id for each box
                    $getOrderIdForBox = function ($boxNumber) use ($pdo, $id) {
                        $boxNum = (int) $boxNumber;
                        if ($boxNum <= 0)
                            $boxNum = 1;

                        // Query order_boxes to get the sub_order_id
                        $stmt = $pdo->prepare('SELECT sub_order_id FROM order_boxes WHERE order_id = ? AND box_number = ? LIMIT 1');
                        $stmt->execute([$id, $boxNum]);
                        $subOrderId = $stmt->fetchColumn();

                        // If not found in order_boxes, generate it (fallback)
                        if (!$subOrderId) {
                            $subOrderId = "{$id}-{$boxNum}";
                        }

                        return $subOrderId;
                    };

                    $clientToDbParent = [];
                    $clientToDbItem = [];

                    // 3.1) Insert promotion parents
                    foreach ($in['items'] as $it) {
                        $isParent = !empty($it['isPromotionParent']);
                        if ($isParent) {
                            $boxNumber = isset($it['boxNumber']) ? (int) $it['boxNumber'] : 1;
                            $orderIdForItem = $getOrderIdForBox($boxNumber);
                            [$quantity, $pricePerUnit, $discount, $netTotal, $isFreebie] = $computeNetValues($it);

                            $thisCreatorId = $itemCreatorId;
                            $thisBasketKey = $currentBasket ?? $orderBasketKey;
                            if (isset($it['id']) && isset($oldItemsMap[$it['id']])) {
                                $thisCreatorId = $oldItemsMap[$it['id']]['creator_id'];
                                $thisBasketKey = $oldItemsMap[$it['id']]['basket_key_at_sale'];
                            }

                            $ins->execute([
                                $orderIdForItem,
                                $id,
                                !empty($it['productId']) ? (int)$it['productId'] : null,
                                $it['productName'] ?? null,
                                $quantity,
                                $pricePerUnit,
                                $discount,
                                $netTotal,
                                $isFreebie,
                                $boxNumber,
                                $it['promotionId'] ?? null,
                                null,
                                1,
                                $thisCreatorId,
                                $thisBasketKey,
                            ]);
                            $dbId = (int) $pdo->lastInsertId();
                            if (isset($it['id'])) {
                                $clientToDbParent[(string) $it['id']] = $dbId;
                                $clientToDbItem[(string) $it['id']] = $dbId;
                            }
                        }
                    }

                    // 3.2) Insert regular items
                    foreach ($in['items'] as $it) {
                        $isParent = !empty($it['isPromotionParent']);
                        $hasParent = isset($it['parentItemId']) && $it['parentItemId'] !== null && $it['parentItemId'] !== '';
                        if (!$isParent && !$hasParent) {
                            $boxNumber = isset($it['boxNumber']) ? (int) $it['boxNumber'] : 1;
                            $orderIdForItem = $getOrderIdForBox($boxNumber);
                            [$quantity, $pricePerUnit, $discount, $netTotal, $isFreebie] = $computeNetValues($it);

                            $thisCreatorId = $itemCreatorId;
                            $thisBasketKey = $currentBasket ?? $orderBasketKey;
                            if (isset($it['id']) && isset($oldItemsMap[$it['id']])) {
                                $thisCreatorId = $oldItemsMap[$it['id']]['creator_id'];
                                $thisBasketKey = $oldItemsMap[$it['id']]['basket_key_at_sale'];
                            }

                            $ins->execute([
                                $orderIdForItem,
                                $id,
                                !empty($it['productId']) ? (int)$it['productId'] : null,
                                $it['productName'] ?? null,
                                $quantity,
                                $pricePerUnit,
                                $discount,
                                $netTotal,
                                $isFreebie,
                                $boxNumber,
                                $it['promotionId'] ?? null,
                                null,
                                0,
                                $thisCreatorId,
                                $thisBasketKey,
                            ]);
                            $dbId = (int) $pdo->lastInsertId();
                            if (isset($it['id'])) {
                                $clientToDbItem[(string) $it['id']] = $dbId;
                            }
                        }
                    }

                    // 3.3) Insert children
                    foreach ($in['items'] as $it) {
                        $isParent = !empty($it['isPromotionParent']);
                        $clientParent = $it['parentItemId'] ?? null;
                        if (!$isParent && ($clientParent !== null && $clientParent !== '')) {
                            $resolved = null;
                            if ($clientParent !== null && isset($clientToDbParent[(string) $clientParent])) {
                                $resolved = $clientToDbParent[(string) $clientParent];
                            }
                            $boxNumber = isset($it['boxNumber']) ? (int) $it['boxNumber'] : 1;
                            $orderIdForItem = $getOrderIdForBox($boxNumber);
                            [$quantity, $pricePerUnit, $discount, $netTotal, $isFreebie] = $computeNetValues($it);

                            // --- Resolve priceOverride and parentQty ---
                            $overridePrice = isset($it['priceOverride']) ? (float) $it['priceOverride'] : (isset($it['price_override']) ? (float) $it['price_override'] : null);
                            $parentQty = 1;
                            $parentPromotionId = null;
                            foreach ($in['items'] as $parentItem) {
                                $pid = $parentItem['id'] ?? null;
                                if ($pid !== null && (string)$pid === (string)$clientParent && !empty($parentItem['isPromotionParent'])) {
                                    $parentQty = max(1, (int)($parentItem['quantity'] ?? 1));
                                    $parentPromotionId = $parentItem['promotionId'] ?? $parentItem['promotion_id'] ?? null;
                                    break;
                                }
                            }

                            // If priceOverride not in payload, look it up from promotion_items table
                            if ($overridePrice === null && $parentPromotionId !== null && !empty($it['productId'])) {
                                $poStmt = $pdo->prepare('SELECT price_override FROM promotion_items WHERE promotion_id = ? AND product_id = ? LIMIT 1');
                                $poStmt->execute([(int)$parentPromotionId, (int)$it['productId']]);
                                $poRow = $poStmt->fetch();
                                if ($poRow && $poRow['price_override'] !== null) {
                                    $overridePrice = (float) $poRow['price_override'];
                                }
                            }

                            // Apply override: net_total = priceOverride × parentQuantity
                            if ($overridePrice !== null && !$isFreebie) {
                                $netTotal = $overridePrice * $parentQty;
                            }

                            $thisCreatorId = $itemCreatorId;
                            $thisBasketKey = $currentBasket ?? $orderBasketKey;
                            if (isset($it['id']) && isset($oldItemsMap[$it['id']])) {
                                $thisCreatorId = $oldItemsMap[$it['id']]['creator_id'];
                                $thisBasketKey = $oldItemsMap[$it['id']]['basket_key_at_sale'];
                            }

                            $ins->execute([
                                $orderIdForItem,
                                $id,
                                $it['productId'] ?? null,
                                $it['productName'] ?? null,
                                $quantity,
                                $pricePerUnit,
                                $discount,
                                $netTotal,
                                $isFreebie,
                                $boxNumber,
                                $it['promotionId'] ?? null,
                                $resolved,
                                0,
                                $thisCreatorId,
                                $thisBasketKey,
                            ]);
                            $dbId = (int) $pdo->lastInsertId();
                            if (isset($it['id'])) {
                                $clientToDbItem[(string) $it['id']] = $dbId;
                            }
                        }
                    }

                    // 4) Re-create allocations (PENDING status)
                    // Note: This resets allocation status to PENDING. If you need to preserve fulfillment status, logic needs to be much more complex.
                    // For now, assuming editing order implies re-evaluating stock.
                    $alloc = $pdo->prepare('INSERT INTO order_item_allocations (order_id, order_item_id, product_id, required_quantity, is_freebie, promotion_id, status, created_by) VALUES (?,?,?,?,?,?,?,?)');
                    foreach ($in['items'] as $it) {
                        $isParent = !empty($it['isPromotionParent']);
                        $productId = $it['productId'] ?? null;
                        if ($isParent) {
                            continue;
                        }
                        if (!$productId) {
                            continue;
                        }
                        $orderItemId = null;
                        if (isset($it['id']) && isset($clientToDbItem[(string) $it['id']])) {
                            $orderItemId = $clientToDbItem[(string) $it['id']];
                        }
                        $alloc->execute([
                            $id,
                            $orderItemId,
                            $productId,
                            max(0, (int) ($it['quantity'] ?? 0)),
                            !empty($it['isFreebie']) ? 1 : 0,
                            $it['promotionId'] ?? null,
                            'PENDING',
                            $itemCreatorId,
                        ]);
                    }
                }

                // [LOGGING] Capture New Tracking & Write Log
                $ntStmt = $pdo->prepare("SELECT tracking_number FROM order_tracking_numbers WHERE parent_order_id = ? ORDER BY id");
                $ntStmt->execute([$id]);
                $newTrackings = $ntStmt->fetchAll(PDO::FETCH_COLUMN);
                $newTrackingStr = implode(', ', array_filter($newTrackings));

                // Determine Trigger Type for merged log
                $triggerType = 'Manual';
                if ($previousStatus !== $newStatus && $previousTrackingStr === $newTrackingStr) {
                    $triggerType = 'StatusChange';
                } elseif ($previousStatus === $newStatus && $previousTrackingStr !== $newTrackingStr) {
                    $triggerType = 'TrackingUpdate';
                }

                create_audit_log_entry($pdo, $id, $previousStatus, $newStatus, $previousTrackingStr, $newTrackingStr, $triggerType);

                $pdo->commit();

                // 🎫 HOOK: Re-record quota usage after order items edit
                try {
                    $orderCompanyId = (int)($existingOrder['company_id'] ?? 0);
                    $orderCreatorId = (int)($existingOrder['creator_id'] ?? 0);
                    $quotaRecorded = recordQuotaUsageForOrder($pdo, $id, $orderCompanyId, $orderCreatorId);
                    if ($quotaRecorded > 0) {
                        error_log("[Quota] Re-recorded $quotaRecorded quota usage(s) for edited order #$id");
                    }
                } catch (Throwable $e) {
                    error_log('[Quota] Failed to re-record usage for order ' . $id . ': ' . $e->getMessage());
                }

                // 🔥 HOOK: Event-Driven Basket Routing V2 on order_status change (PATCH)
                $basketRoutingDebug = ['status_received' => $orderStatus, 'new_status' => $newStatus, 'triggered' => false];
                if ($orderStatus || $newStatus) {
                    $effectiveStatus = $orderStatus ?? $newStatus; // Use explicit status or auto-updated status
                    try {
                        require_once __DIR__ . '/../Services/BasketRoutingServiceV2.php';
                        $authUser = get_authenticated_user($pdo);
                        $triggeredBy = $authUser ? (int) ($authUser['id'] ?? 0) : 0;

                        $basketRoutingDebug['triggered'] = true;
                        $basketRoutingDebug['triggered_by'] = $triggeredBy;
                        $basketRoutingDebug['effective_status'] = $effectiveStatus;

                        $router = new BasketRoutingServiceV2($pdo);
                        $routingResult = $router->handleOrderStatusChange(
                            $id,
                            $effectiveStatus,
                            $triggeredBy
                        );

                        $basketRoutingDebug['result'] = $routingResult;

                        if ($routingResult && isset($routingResult['success']) && $routingResult['success']) {
                            error_log("[API/orders PATCH] Basket routing triggered for order #$id: " .
                                "Basket {$routingResult['from_basket']} → {$routingResult['to_basket']}");
                        }
                    } catch (Exception $routeError) {
                        error_log("[API/orders PATCH] Basket routing error for order #$id: " . $routeError->getMessage());
                        $basketRoutingDebug['error'] = $routeError->getMessage();
                    }
                }

                // Recalculate customer stats safely at the very end of PATCH
                if ($customerId) {
                    try {
                        $findStmt = $pdo->prepare('SELECT customer_id FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
                        $findStmt->execute([$customerId, is_numeric($customerId) ? (int) $customerId : null]);
                        $customerResult = $findStmt->fetch();
                        if ($customerResult && $customerResult['customer_id']) {
                            recalculate_customer_stats_safe($pdo, (int)$customerResult['customer_id']);
                        }
                    } catch (Throwable $e) {}
                }

                $response = ['ok' => true, 'basket_routing' => $basketRoutingDebug];
                if (!empty($allocationSummary)) {
                    $response['autoAllocated'] = $allocationSummary;
                }
                if (!empty($releaseSummary)) {
                    $response['released'] = $releaseSummary;
                }
                json_response($response);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                $msg = $e->getMessage();
                $statusCode = 500;
                if ($msg === 'WAREHOUSE_REQUIRED' || $msg === 'WAREHOUSE_NOT_FOUND' || $msg === 'WAREHOUSE_COMPANY_MISMATCH') {
                    $statusCode = 400;
                } elseif (str_starts_with($msg, 'INSUFFICIENT_STOCK')) {
                    $statusCode = 409;
                } elseif ($msg === 'ORDER_RELOAD_FAILED') {
                    $statusCode = 500;
                } elseif (in_array($msg, ['INVALID_BOX_NUMBER_SEQUENCE', 'NON_COD_SINGLE_BOX_ONLY', 'COD_BOX_TOTAL_MISMATCH'])) {
                    $statusCode = 400;
                }
                json_response(['error' => 'ORDER_UPDATE_FAILED', 'message' => $msg], $statusCode);
            }
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

// Stock allocation API: backoffice assigns warehouse/lot for each order item allocation
function handle_allocations(PDO $pdo, ?string $id, ?string $action): void
{
    // Authenticate
    $user = get_authenticated_user($pdo);
    if (!$user) {
        json_response(['error' => 'UNAUTHORIZED'], 401);
    }
    $companyId = $user['company_id'];

    switch (method()) {
        case 'GET':
            // GET /allocations?order_id=...&status=PENDING
            $orderId = $_GET['order_id'] ?? null;
            $status = $_GET['status'] ?? null;
            $sql = 'SELECT a.*, p.name AS product_name, w.name AS warehouse_name, o.order_status
                    FROM order_item_allocations a
                    JOIN orders o ON o.id = a.order_id
                    LEFT JOIN products p ON p.id = a.product_id
                    LEFT JOIN warehouses w ON w.id = a.warehouse_id
                    WHERE o.order_status NOT IN ("Picking", "Packed", "Shipped", "Completed", "Cancelled")
                    AND o.company_id = ?';
            $params = [$companyId];
            if ($orderId) {
                $sql .= ' AND a.order_id = ?';
                $params[] = $orderId;
            }
            if ($status) {
                $sql .= ' AND a.status = ?';
                $params[] = $status;
            }
            $sql .= ' ORDER BY a.order_id, a.product_id, a.id';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            json_response($stmt->fetchAll());
            break;
        case 'PUT':
        case 'POST':
            // Update an allocation row: { warehouseId, lotNumber, allocatedQuantity, status }
            if (!$id) {
                json_response(['error' => 'MISSING_ID'], 400);
            }
            $in = json_input();
            $warehouseId = $in['warehouseId'] ?? null;
            $lotNumber = $in['lotNumber'] ?? null;
            $allocatedQty = array_key_exists('allocatedQuantity', $in) ? (int) $in['allocatedQuantity'] : null;
            $status = $in['status'] ?? null;

            $pdo->beginTransaction();
            try {
                $allocStmt = $pdo->prepare('SELECT * FROM order_item_allocations WHERE id=? FOR UPDATE');
                $allocStmt->execute([$id]);
                $allocation = $allocStmt->fetch(PDO::FETCH_ASSOC);
                if (!$allocation) {
                    $pdo->rollBack();
                    json_response(['error' => 'NOT_FOUND'], 404);
                }

                $requestedStatus = $status !== null ? strtoupper($status) : null;
                $effectiveWarehouseId = $warehouseId !== null ? (int) $warehouseId : ($allocation['warehouse_id'] !== null ? (int) $allocation['warehouse_id'] : null);

                if ($requestedStatus === 'CANCELLED') {
                    $releasedInfo = release_single_allocation($pdo, $allocation, 'CANCELLED');
                    $pdo->commit();
                    json_response(['ok' => true, 'released' => $releasedInfo]);
                }

                if ($requestedStatus === 'ALLOCATED') {
                    if ($effectiveWarehouseId === null) {
                        throw new RuntimeException('WAREHOUSE_REQUIRED');
                    }
                    $desiredQty = $allocatedQty !== null ? max(0, $allocatedQty) : (int) $allocation['required_quantity'];
                    if ($desiredQty <= 0) {
                        throw new RuntimeException('INVALID_ALLOCATED_QUANTITY');
                    }
                    $preferredLot = ($lotNumber !== null && $lotNumber !== '') ? (string) $lotNumber : null;

                    // Check if allowNegativeStock is set in request body
                    $allowNegativeStock = isset($in['allowNegativeStock']) && $in['allowNegativeStock'] === true;

                    if ($allowNegativeStock) {
                        $allocationResult = allocate_allocation_fifo_allow_negative($pdo, $allocation, $effectiveWarehouseId, $desiredQty, $preferredLot);
                    } else {
                        $allocationResult = allocate_allocation_fifo($pdo, $allocation, $effectiveWarehouseId, $desiredQty, $preferredLot);
                        if (!$allocationResult) {
                            throw new RuntimeException('INSUFFICIENT_STOCK');
                        }
                    }

                    $pdo->commit();
                    json_response(['ok' => true, 'autoAllocated' => $allocationResult]);
                }

                $set = [];
                $params = [];
                if ($warehouseId !== null) {
                    $set[] = 'warehouse_id=?';
                    $params[] = $warehouseId;
                }
                if ($lotNumber !== null) {
                    $set[] = 'lot_number=?';
                    $params[] = $lotNumber;
                }
                if ($allocatedQty !== null) {
                    $set[] = 'allocated_quantity=?';
                    $params[] = max(0, $allocatedQty);
                }
                if ($status !== null) {
                    $set[] = 'status=?';
                    $params[] = $status;
                }
                if (!$set) {
                    $pdo->rollBack();
                    json_response(['error' => 'NO_FIELDS'], 400);
                }
                $params[] = $id;
                $sql = 'UPDATE order_item_allocations SET ' . implode(',', $set) . ' WHERE id=?';
                $upd = $pdo->prepare($sql);
                $upd->execute($params);

                $pdo->commit();
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                $pdo->rollBack();
                $msg = $e->getMessage();
                $code = 500;
                if ($msg === 'WAREHOUSE_REQUIRED' || $msg === 'INVALID_ALLOCATED_QUANTITY') {
                    $code = 400;
                } elseif (str_starts_with($msg, 'INSUFFICIENT_STOCK')) {
                    $code = 409;
                }
                json_response(['error' => 'UPDATE_FAILED', 'message' => $msg], $code);
            }
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}
