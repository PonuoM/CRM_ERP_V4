<?php
require_once __DIR__ . '/../config.php';

function handle_statement_report(PDO $pdo) {
    if (method() !== 'GET') {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }

    $month = isset($_GET['month']) ? (int)$_GET['month'] : (int)date('m');
    $year = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
    $bankId = isset($_GET['bankId']) && $_GET['bankId'] !== '' ? (int)$_GET['bankId'] : null;
    $search = isset($_GET['q']) ? trim($_GET['q']) : '';

    $params = [];
    $sql = "
        SELECT 
            sl.id as statement_id,
            sl.transfer_at,
            COALESCE(sl.bank_display_name, CONCAT(b.bank, ' ', b.bank_number)) as bank_name,
            sl.amount as statement_amount,
            sl.channel,
            sl.description,
            srl.order_id,
            srl.confirmed_amount,
            o.total_amount as order_total_amount,
            o.payment_method,
            o.order_status,
            o.payment_status
        FROM statement_logs sl
        LEFT JOIN bank_account b ON b.id = sl.bank_account_id
        LEFT JOIN statement_reconcile_logs srl ON srl.statement_log_id = sl.id
        LEFT JOIN orders o ON o.id = srl.order_id
        WHERE MONTH(sl.transfer_at) = ? AND YEAR(sl.transfer_at) = ?
    ";
    
    $params[] = $month;
    $params[] = $year;

    if ($bankId) {
        $sql .= " AND sl.bank_account_id = ?";
        $params[] = $bankId;
    }

    if ($search) {
        $sql .= " AND (
            srl.order_id LIKE ? 
            OR sl.description LIKE ? 
            OR sl.channel LIKE ?
            OR sl.bank_display_name LIKE ?
        )";
        $like = "%$search%";
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
    }

    $sql .= " ORDER BY sl.transfer_at ASC";

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
        json_response($data);
    } catch (PDOException $e) {
        json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
    }
}

// Check if included or executed directly
if (basename(__FILE__) == basename($_SERVER["SCRIPT_FILENAME"])) {
    $pdo = db_connect();
    handle_statement_report($pdo);
}
?>
