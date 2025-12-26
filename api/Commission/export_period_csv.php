<?php
/**
 * Export Commission Period details to CSV
 * GET /api/Commission/export_period_csv.php?period_id=1
 */

require_once __DIR__ . "/../config.php";

try {
    $pdo = db_connect();
    
    $period_id = (int)($_GET['period_id'] ?? 0);
    
    if (!$period_id) {
        throw new Exception("Missing period_id");
    }
    
    // Get period info
    $periodStmt = $pdo->prepare("SELECT * FROM commission_periods WHERE id = ?");
    $periodStmt->execute([$period_id]);
    $period = $periodStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$period) {
        throw new Exception("Period not found");
    }
    
    // Set headers for CSV download
    $filename = "commission_period_{$period['period_year']}_" . sprintf('%02d', $period['period_month']) . ".csv";
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    
    // Open output stream
    $output = fopen('php://output', 'w');
    
    // Add BOM for Excel UTF-8 compatibility
    fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
    
    // Add Header Row
    fputcsv($output, [
        'Employee ID',
        'Salesperson Name', 
        'Order Date', 
        'Order ID', 
        'Order Amount', 
        'Commission Rate (%)', 
        'Commission Amount',
        'Confirmed Date'
    ]);
    
    // Get commission records with user info
    $recordsStmt = $pdo->prepare("
        SELECT 
            cr.*,
            u.username,
            u.first_name,
            u.last_name
        FROM commission_records cr
        JOIN users u ON u.id = cr.user_id
        WHERE cr.period_id = ?
        ORDER BY cr.total_sales DESC
    ");
    
    $recordsStmt->execute([$period_id]);
    $records = $recordsStmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($records as $record) {
        $salespersonName = $record['first_name'] . ' ' . $record['last_name'];
        $employeeId = $record['user_id']; // Use users.id as requested
        
        // Get order lines for each record
        $linesStmt = $pdo->prepare("
            SELECT * FROM commission_order_lines 
            WHERE record_id = ?
            ORDER BY order_date DESC
        ");
        $linesStmt->execute([$record['id']]);
        $orders = $linesStmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($orders as $order) {
            fputcsv($output, [
                $employeeId,
                $salespersonName,
                $order['order_date'],
                $order['order_id'],
                $order['order_amount'],
                $record['commission_rate'],
                $order['commission_amount'],
                $order['confirmed_at']
            ]);
        }
        
        // Add a summary row for this salesperson (Optional, but helpful)
        /*
        fputcsv($output, [
            '',
            "$salespersonName (Total)",
            '',
            '',
            $record['total_sales'],
            '',
            $record['commission_amount'],
            ''
        ]);
        */
    }
    
    fclose($output);
    exit;
    
} catch (Exception $e) {
    http_response_code(500);
    echo "Error: " . $e->getMessage();
}
