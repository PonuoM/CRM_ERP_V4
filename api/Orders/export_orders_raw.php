<?php
/**
 * Export Orders Raw as CSV
 * Streamlined export bypassing JS memory limits.
 */
require_once __DIR__ . "/../config.php";
require_once __DIR__ . "/../Services/OrderExportService.php";

try {
    $pdo = db_connect();
    set_time_limit(300);

    $company_id = (int)($_GET['company_id'] ?? 0);
    $status = $_GET['status'] ?? 'all';
    $start_date = $_GET['start_date'] ?? null;
    $end_date = $_GET['end_date'] ?? null;
    $selectedDepartments = $_GET['departments'] ?? 'all';

    $where = "WHERE 1=1";
    $params = [];

    if ($company_id > 0) {
        $where .= " AND o.company_id = ?";
        $params[] = $company_id;
    }

    // Include sub-orders depending on what's expected, orders-raw usually includes them
    // so we don't filter out "-%" like we do in commission.

    if ($start_date) {
        $where .= " AND o.order_date >= ?";
        $params[] = $start_date . ' 00:00:00';
    }
    if ($end_date) {
        $where .= " AND o.order_date <= ?";
        $params[] = $end_date . ' 23:59:59';
    }

    if ($selectedDepartments !== 'all') {
        $deptArray = array_filter(explode(',', $selectedDepartments));
        if (!empty($deptArray)) {
            $placeholders = implode(',', array_fill(0, count($deptArray), '?'));
            $where .= " AND (u.role IN ($placeholders) OR o.sales_channel IN ($placeholders))";
            foreach ($deptArray as $dept) {
                $params[] = $dept;
            }
        }
    }

    if ($status !== 'all') {
        if ($status === 'Returned') {
            $where .= " AND o.order_status = 'Returned'";
        } elseif ($status === 'Pending') {
            $where .= " AND o.order_status = 'Pending'";
        } else {
            $where .= " AND o.order_status = ?";
            $params[] = $status;
        }
    }

    $sql = "
        SELECT
            o.id as order_id,
            o.order_date,
            o.creator_id,
            o.customer_id,
            o.delivery_date,
            o.sales_channel,
            o.payment_method,
            o.payment_status,
            o.order_status,
            o.total_amount,
            o.amount_paid,
            o.shipping_cost,
            o.bill_discount,
            o.street, o.subdistrict, o.district, o.province, o.postal_code,
            o.recipient_first_name, o.recipient_last_name,
            o.customer_type,
            o.slip_url,
            oi.id as item_id,
            oi.product_id,
            oi.product_name,
            oi.quantity,
            oi.price_per_unit,
            oi.discount,
            oi.net_total,
            oi.is_freebie,
            oi.box_number,
            oi.promotion_id,
            oi.parent_item_id,
            oi.is_promotion_parent,
            oi.creator_id as item_creator_id,
            oi.basket_key_at_sale,
            p.sku as product_sku,
            p.category as product_category,
            p.report_category as product_report_category,
            c.first_name as customer_first_name,
            c.last_name as customer_last_name,
            c.phone as customer_phone,
            c.lifecycle_status,
            u.first_name as creator_first_name,
            u.last_name as creator_last_name,
            u.role as creator_role,
            iu.first_name as item_creator_first_name,
            iu.last_name as item_creator_last_name,
            iu.role as item_creator_role,
            pg.name as page_name,
            parent_oi.product_name as parent_product_name
        FROM orders o
        LEFT JOIN order_items oi ON oi.parent_order_id = o.id
        LEFT JOIN products p ON p.id = oi.product_id
        LEFT JOIN customers c ON c.customer_id = o.customer_id
        LEFT JOIN users u ON u.id = o.creator_id
        LEFT JOIN users iu ON iu.id = oi.creator_id
        LEFT JOIN pages pg ON pg.id = o.sales_channel_page_id
        LEFT JOIN order_items parent_oi ON parent_oi.id = oi.parent_item_id
        $where
        ORDER BY o.order_date DESC, o.id, oi.id
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $orderIds = array_values(array_unique(array_column($rows, 'order_id')));

    $lookups = [
        'tracking' => [],
        'slips'    => [],
        'cod'      => [],
        'airport'  => [],
        'boxes'    => [],
    ];

    if (!empty($orderIds)) {
        $chunkSize = 500;
        $chunks = array_chunk($orderIds, $chunkSize);

        try {
            foreach ($chunks as $chunk) {
                $ph = implode(',', array_fill(0, count($chunk), '?'));
                $tStmt = $pdo->prepare("SELECT parent_order_id,
                        GROUP_CONCAT(DISTINCT tracking_number ORDER BY id SEPARATOR ', ') as tracking_numbers
                     FROM order_tracking_numbers
                     WHERE parent_order_id IN ($ph)
                     GROUP BY parent_order_id");
                $tStmt->execute($chunk);
                foreach ($tStmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
                    $lookups['tracking'][$r['parent_order_id']] = $r['tracking_numbers'];
                }
            }
        } catch (Throwable $e) {}

        try {
            foreach ($chunks as $chunk) {
                $ph = implode(',', array_fill(0, count($chunk), '?'));
                $sStmt = $pdo->prepare("SELECT order_id,
                        COUNT(*) as slip_count,
                        MIN(CASE WHEN transfer_date IS NOT NULL THEN transfer_date END) as slip_transfer_date
                     FROM order_slips
                     WHERE order_id IN ($ph)
                     GROUP BY order_id");
                $sStmt->execute($chunk);
                foreach ($sStmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
                    $lookups['slips'][$r['order_id']] = $r;
                }
            }
        } catch (Throwable $e) {}

        try {
            foreach ($chunks as $chunk) {
                $ph = implode(',', array_fill(0, count($chunk), '?'));
                $cStmt = $pdo->prepare("SELECT REGEXP_REPLACE(cr.order_id, '-[0-9]+\$', '') as clean_order_id,
                        MIN(cd.document_datetime) as cod_payment_date,
                        MAX(cd.shortage_reason) as cod_shortage_reason
                     FROM cod_records cr
                     INNER JOIN cod_documents cd ON cr.document_id = cd.id
                     WHERE REGEXP_REPLACE(cr.order_id, '-[0-9]+\$', '') IN ($ph)
                     GROUP BY clean_order_id");
                $cStmt->execute($chunk);
                foreach ($cStmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
                    $lookups['cod'][$r['clean_order_id']] = $r['cod_payment_date'];
                    $lookups['cod_shortage'][$r['clean_order_id']] = $r['cod_shortage_reason'];
                }
            }
        } catch (Throwable $e) {}

        try {
            $trackingOrderMap = [];
            foreach ($chunks as $chunk) {
                $ph = implode(',', array_fill(0, count($chunk), '?'));
                $tmStmt = $pdo->prepare("SELECT parent_order_id, tracking_number
                          FROM order_tracking_numbers
                          WHERE parent_order_id IN ($ph)");
                $tmStmt->execute($chunk);
                foreach ($tmStmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
                    if ($r['tracking_number']) {
                        $trackingOrderMap[$r['tracking_number']] = $r['parent_order_id'];
                    }
                }
            }

            if (!empty($trackingOrderMap)) {
                $allTrackingNums = array_values(array_keys($trackingOrderMap));
                $tnChunks = array_chunk($allTrackingNums, $chunkSize);
                foreach ($tnChunks as $tnChunk) {
                    $tnPh = implode(',', array_fill(0, count($tnChunk), '?'));
                    $aStmt = $pdo->prepare("SELECT gss.order_number as tracking_number,
                            GROUP_CONCAT(DISTINCT gss.delivery_status SEPARATOR ', ') as delivery_status,
                            MAX(gss.delivery_date) as delivery_date
                         FROM google_sheet_shipping gss
                         WHERE gss.order_number IN ($tnPh)
                         GROUP BY gss.order_number");
                    $aStmt->execute($tnChunk);
                    foreach ($aStmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
                        $parentId = $trackingOrderMap[$r['tracking_number']] ?? null;
                        if ($parentId) {
                            if (!isset($lookups['airport'][$parentId])) {
                                $lookups['airport'][$parentId] = ['delivery_status' => '', 'delivery_date' => null];
                            }
                            $existing = $lookups['airport'][$parentId];
                            $statuses = array_filter(array_unique(array_merge(
                                $existing['delivery_status'] ? explode(', ', $existing['delivery_status']) : [],
                                $r['delivery_status'] ? explode(', ', $r['delivery_status']) : []
                            )));
                            $lookups['airport'][$parentId]['delivery_status'] = implode(', ', $statuses);
                            if ($r['delivery_date']) {
                                $lookups['airport'][$parentId]['delivery_date'] = max(
                                    $existing['delivery_date'] ?? '0000-00-00',
                                    $r['delivery_date']
                                );
                            }
                        }
                    }
                }
            }
        } catch (Throwable $e) {}

        try {
            $returnedIds = array_values(array_unique(array_filter(array_map(function($r) {
                return ($r['order_status'] ?? '') === 'Returned' ? $r['order_id'] : null;
            }, $rows))));
            if (!empty($returnedIds)) {
                $retChunks = array_chunk($returnedIds, $chunkSize);
                foreach ($retChunks as $retChunk) {
                    $ph = implode(',', array_fill(0, count($retChunk), '?'));
                    $bStmt = $pdo->prepare("SELECT order_id, box_number, return_status FROM order_boxes WHERE order_id IN ($ph)");
                    $bStmt->execute($retChunk);
                    foreach ($bStmt->fetchAll(PDO::FETCH_ASSOC) as $b) {
                        $lookups['boxes'][$b['order_id'] . '-' . $b['box_number']] = $b['return_status'];
                    }
                }
            }
        } catch (Throwable $e) {}
    }

    $creatorTotals = OrderExportService::calculateCreatorTotals($rows);
    $headers = OrderExportService::getCsvHeaders(false, false);

    $format = $_GET['format'] ?? 'csv';

    if ($format === 'json') {
        header('Content-Type: application/json; charset=utf-8');
        $jsonRows = [$headers];
        $seenCreators = [];
        $seenOrders = [];
        foreach ($rows as $row) {
            $jsonRows[] = OrderExportService::formatOrderCsvRow($row, $lookups, $creatorTotals, $seenCreators, $seenOrders, false, false);
        }
        echo json_encode(['ok' => true, 'data' => $jsonRows]);
        exit;
    }

    header('Content-Type: text/csv; charset=utf-8');
    $filename = "orders_raw_" . date('Y-m-d') . ".csv";
    header("Content-Disposition: attachment; filename=\"$filename\"");

    $output = fopen('php://output', 'w');
    fprintf($output, chr(0xEF) . chr(0xBB) . chr(0xBF));
    fputcsv($output, $headers);

    $seenCreators = [];
    $seenOrders = [];
    foreach ($rows as $row) {
        fputcsv($output, OrderExportService::formatOrderCsvRow($row, $lookups, $creatorTotals, $seenCreators, $seenOrders, false, false));
    }

    fclose($output);
    unset($rows, $lookups);
    exit;

} catch (Exception $e) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
