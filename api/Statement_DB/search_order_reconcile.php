<?php
/**
 * Search Order Reconcile — ค้นหาว่า order_id หรือ cod_document นี้ไป match กับ statement อันไหน
 *
 * GET ?company_id=1&q=JAT-001  (searches both order_id and cod_document_number)
 * 
 * Returns two sections: reconcile_logs (order matches) and cod_matches (COD document matches)
 */
require_once dirname(__DIR__) . "/config.php";

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    $pdo = db_connect();

    $companyId = isset($_GET['company_id']) ? (int) $_GET['company_id'] : 0;
    // Support both 'q' and 'order_id' param
    $query = isset($_GET['q']) ? trim($_GET['q']) : (isset($_GET['order_id']) ? trim($_GET['order_id']) : '');

    if ($companyId <= 0 || $query === '') {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'company_id and q (search query) are required']);
        exit();
    }

    $searchPattern = '%' . $query . '%';
    $results = [];

    // ========================================
    // 1. Search in statement_reconcile_logs (by order_id)
    // ========================================
    $sqlOrder = "
        SELECT 
            'order' AS match_type,
            srl.id AS reconcile_id,
            srl.order_id,
            srl.statement_log_id,
            srl.statement_amount,
            srl.confirmed_amount,
            srl.reconcile_type,
            srl.auto_matched,
            srl.created_at AS reconcile_created_at,
            srl.confirmed_by,
            srl.note,
            srl.confirmed_payment_method,
            srl.confirmed_at,
            srl.confirmed_action,
            sl.transfer_at,
            sl.amount AS sl_amount,
            sl.channel,
            sl.description AS sl_description,
            ba.id AS bank_account_id,
            ba.bank AS bank_name,
            ba.bank_number,
            srb.document_no AS batch_document_no,
            srb.start_date AS batch_start_date,
            srb.end_date AS batch_end_date,
            srb.created_at AS batch_created_at,
            u_created.first_name AS created_by_first,
            u_created.last_name AS created_by_last,
            u_confirmed.first_name AS confirmed_by_first,
            u_confirmed.last_name AS confirmed_by_last,
            NULL AS cod_document_number,
            NULL AS cod_document_id,
            NULL AS cod_total_amount,
            NULL AS cod_status,
            (SELECT GROUP_CONCAT(srl2.order_id SEPARATOR ', ')
             FROM statement_reconcile_logs srl2 
             WHERE srl2.statement_log_id = srl.statement_log_id 
               AND srl2.order_id != srl.order_id
            ) AS other_orders_on_statement
        FROM statement_reconcile_logs srl
        INNER JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id
        INNER JOIN statement_logs sl ON sl.id = srl.statement_log_id
        LEFT JOIN bank_account ba ON ba.id = srb.bank_account_id
        LEFT JOIN users u_created ON u_created.id = srl.created_by
        LEFT JOIN users u_confirmed ON u_confirmed.id = srl.confirmed_by
        WHERE srb.company_id = ?
          AND srl.order_id LIKE ?
        ORDER BY srl.created_at DESC
        LIMIT 30
    ";

    $stmt = $pdo->prepare($sqlOrder);
    $stmt->execute([$companyId, $searchPattern]);
    $orderRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // ========================================
    // 2. Search in cod_documents (by document_number) 
    //    + cod_records (by order_id)
    // ========================================
    $sqlCod = "
        SELECT 
            'cod' AS match_type,
            NULL AS reconcile_id,
            cr.order_id,
            cd.matched_statement_log_id AS statement_log_id,
            sl.amount AS statement_amount,
            cr.cod_amount AS confirmed_amount,
            'COD' AS reconcile_type,
            0 AS auto_matched,
            cd.created_at AS reconcile_created_at,
            NULL AS confirmed_by,
            NULL AS note,
            NULL AS confirmed_payment_method,
            cd.verified_at AS confirmed_at,
            CASE WHEN cd.verified_at IS NOT NULL THEN 'Confirmed' ELSE NULL END AS confirmed_action,
            sl.transfer_at,
            sl.amount AS sl_amount,
            sl.channel,
            sl.description AS sl_description,
            ba.id AS bank_account_id,
            ba.bank AS bank_name,
            ba.bank_number,
            NULL AS batch_document_no,
            NULL AS batch_start_date,
            NULL AS batch_end_date,
            NULL AS batch_created_at,
            NULL AS created_by_first,
            NULL AS created_by_last,
            NULL AS confirmed_by_first,
            NULL AS confirmed_by_last,
            cd.document_number AS cod_document_number,
            cd.id AS cod_document_id,
            cd.total_input_amount AS cod_total_amount,
            cd.status AS cod_status,
            NULL AS other_orders_on_statement
        FROM cod_documents cd
        INNER JOIN cod_records cr ON cr.document_id = cd.id
        LEFT JOIN statement_logs sl ON sl.id = cd.matched_statement_log_id
        LEFT JOIN statement_batchs sb ON sb.id = sl.batch_id
        LEFT JOIN bank_account ba ON ba.id = sl.bank_account_id
        WHERE cd.company_id = ?
          AND (cd.document_number LIKE ? OR cr.order_id LIKE ?)
        ORDER BY cd.created_at DESC
        LIMIT 30
    ";

    $stmtCod = $pdo->prepare($sqlCod);
    $stmtCod->execute([$companyId, $searchPattern, $searchPattern]);
    $codRows = $stmtCod->fetchAll(PDO::FETCH_ASSOC);

    // ========================================
    // 3. Combine and format results
    // ========================================
    $allRows = array_merge($orderRows, $codRows);

    $results = array_map(function ($row) {
        return [
            'match_type' => $row['match_type'],
            'reconcile_id' => $row['reconcile_id'] ? (int) $row['reconcile_id'] : null,
            'order_id' => $row['order_id'],
            'statement_log_id' => $row['statement_log_id'] ? (int) $row['statement_log_id'] : null,
            'statement_amount' => $row['statement_amount'] !== null ? (float) $row['statement_amount'] : null,
            'confirmed_amount' => $row['confirmed_amount'] !== null ? (float) $row['confirmed_amount'] : null,
            'reconcile_type' => $row['reconcile_type'],
            'auto_matched' => (bool) $row['auto_matched'],
            'reconcile_created_at' => $row['reconcile_created_at'],
            'confirmed_by' => $row['confirmed_by'] ? (int) $row['confirmed_by'] : null,
            'confirmed_at' => $row['confirmed_at'],
            'confirmed_action' => $row['confirmed_action'],
            'note' => $row['note'],
            'payment_method' => $row['confirmed_payment_method'],
            'transfer_at' => $row['transfer_at'],
            'sl_amount' => $row['sl_amount'] !== null ? (float) $row['sl_amount'] : null,
            'channel' => $row['channel'],
            'sl_description' => $row['sl_description'],
            'bank_account_id' => $row['bank_account_id'] ? (int) $row['bank_account_id'] : null,
            'bank_name' => $row['bank_name'],
            'bank_number' => $row['bank_number'],
            'batch_document_no' => $row['batch_document_no'],
            'batch_start_date' => $row['batch_start_date'],
            'batch_end_date' => $row['batch_end_date'],
            'batch_created_at' => $row['batch_created_at'],
            'created_by_name' => trim(($row['created_by_first'] ?? '') . ' ' . ($row['created_by_last'] ?? '')),
            'confirmed_by_name' => $row['confirmed_by'] ? trim(($row['confirmed_by_first'] ?? '') . ' ' . ($row['confirmed_by_last'] ?? '')) : null,
            'cod_document_number' => $row['cod_document_number'],
            'cod_document_id' => $row['cod_document_id'] ? (int) $row['cod_document_id'] : null,
            'cod_total_amount' => $row['cod_total_amount'] !== null ? (float) $row['cod_total_amount'] : null,
            'cod_status' => $row['cod_status'],
            'other_orders_on_statement' => $row['other_orders_on_statement'],
        ];
    }, $allRows);

    echo json_encode([
        'status' => 'success',
        'data' => $results,
        'count' => count($results),
        'order_count' => count($orderRows),
        'cod_count' => count($codRows),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
