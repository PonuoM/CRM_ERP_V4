<?php
require_once __DIR__ . '/../config.php';

try {
    $pdo = db_connect();
    cors();
    validate_auth($pdo);

    $company_id = $_GET['company_id'] ?? null;
    $date_from = $_GET['date_from'] ?? date('Y-m-d', strtotime('-30 days'));
    $date_to = $_GET['date_to'] ?? date('Y-m-d');
    $store_id = $_GET['store_id'] ?? 'all';
    $platform = $_GET['platform'] ?? 'all';

    if (!$company_id) {
        json_response(['success' => false, 'error' => 'Missing company_id']);
    }

    $cid = intval($company_id);

    // Filter conditions for orders
    $orderWhere = ["company_id = $cid", "DATE(order_date) >= '$date_from'", "DATE(order_date) <= '$date_to'"];
    if ($store_id !== 'all') $orderWhere[] = "store_id = " . intval($store_id);
    if ($platform !== 'all') $orderWhere[] = "platform = '" . addslashes($platform) . "'";
    $orderWhereSql = implode(" AND ", $orderWhere);

    // Filter conditions for ads
    $adsWhere = ["company_id = $cid", "date >= '$date_from'", "date <= '$date_to'"];
    if ($store_id !== 'all') $adsWhere[] = "store_id = " . intval($store_id);
    $adsWhereSql = implode(" AND ", $adsWhere);

    // Filter conditions for invoices (month-based)
    $month_from = substr($date_from, 0, 7);
    $month_to = substr($date_to, 0, 7);
    $invWhere = ["company_id = $cid", "month_year >= '$month_from'", "month_year <= '$month_to'"];
    if ($store_id !== 'all') $invWhere[] = "store_id = " . intval($store_id);
    if ($platform !== 'all') $invWhere[] = "platform = '" . addslashes($platform) . "'";
    $invWhereSql = implode(" AND ", $invWhere);

    // 1. KPIs
    // Total Sales, Canceled, Returned, Net Sales
    $kpiSql = "SELECT 
        SUM(net_price) as total_sales,
        SUM(CASE WHEN status LIKE '%ยกเลิก%' OR status LIKE '%Canceled%' THEN net_price ELSE 0 END) as canceled_amount,
        SUM(CASE WHEN status LIKE '%ตีกลับ%' OR status LIKE '%Returned%' THEN net_price ELSE 0 END) as returned_amount
        FROM marketplace_orders WHERE $orderWhereSql";
    $kpiSales = $pdo->query($kpiSql)->fetch();

    $total_sales = floatval($kpiSales['total_sales'] ?? 0);
    $canceled = floatval($kpiSales['canceled_amount'] ?? 0);
    $returned = floatval($kpiSales['returned_amount'] ?? 0);
    $net_sales = $total_sales - $canceled - $returned;

    // Ads Spend
    $adsSpend = $pdo->query("SELECT SUM(ads_cost) as total_ads FROM ads_log WHERE $adsWhereSql")->fetchColumn();
    $ads_spend = floatval($adsSpend ?? 0);

    // Invoices (Invoice Sales & Actual Amount)
    $invSql = "SELECT SUM(total_sales_amount) as invoice_sales, SUM(actual_amount) as actual_amount FROM marketplace_invoices WHERE $invWhereSql";
    $invData = $pdo->query($invSql)->fetch();
    $invoice_sales = floatval($invData['invoice_sales'] ?? 0);
    $actual_amount = floatval($invData['actual_amount'] ?? 0);

    $kpis = [
        'total_sales' => $total_sales,
        'canceled' => $canceled,
        'returned' => $returned,
        'net_sales' => $net_sales,
        'ads_spend' => $ads_spend,
        'invoice_sales' => $invoice_sales,
        'actual_amount' => $actual_amount
    ];

    // 2. Top 5 Products
    $topProducts = $pdo->query("SELECT product_name, sku, SUM(quantity) as total_qty, SUM(net_price) as total_amount 
        FROM marketplace_orders 
        WHERE $orderWhereSql AND status NOT LIKE '%ยกเลิก%' AND status NOT LIKE '%Canceled%'
        GROUP BY product_name, sku 
        ORDER BY total_qty DESC LIMIT 5")->fetchAll();

    // 3. Top 5 Cancel Reasons
    $topCancelReasons = $pdo->query("SELECT reason, COUNT(*) as count 
        FROM marketplace_orders 
        WHERE $orderWhereSql AND (status LIKE '%ยกเลิก%' OR status LIKE '%Canceled%') AND reason != ''
        GROUP BY reason 
        ORDER BY count DESC LIMIT 5")->fetchAll();

    // 4. Top 5 Return Reasons
    $topReturnReasons = $pdo->query("SELECT reason, COUNT(*) as count 
        FROM marketplace_orders 
        WHERE $orderWhereSql AND (status LIKE '%ตีกลับ%' OR status LIKE '%Returned%') AND reason != ''
        GROUP BY reason 
        ORDER BY count DESC LIMIT 5")->fetchAll();

    // 5. Chart Data (Monthly Trend)
    $chartDataSql = "SELECT DATE_FORMAT(order_date, '%Y-%m') as month,
        SUM(net_price) as total_sales,
        SUM(CASE WHEN status LIKE '%ยกเลิก%' OR status LIKE '%Canceled%' THEN net_price ELSE 0 END) as canceled,
        SUM(CASE WHEN status LIKE '%ตีกลับ%' OR status LIKE '%Returned%' THEN net_price ELSE 0 END) as returned
        FROM marketplace_orders WHERE $orderWhereSql
        GROUP BY DATE_FORMAT(order_date, '%Y-%m')
        ORDER BY month ASC";
    $chartSalesData = $pdo->query($chartDataSql)->fetchAll(PDO::FETCH_ASSOC);

    // Merge Ads into Chart Data
    $chartAdsSql = "SELECT DATE_FORMAT(date, '%Y-%m') as month, SUM(ads_cost) as ads_spend FROM ads_log WHERE $adsWhereSql GROUP BY DATE_FORMAT(date, '%Y-%m')";
    $chartAdsData = $pdo->query($chartAdsSql)->fetchAll(PDO::FETCH_ASSOC);
    
    $chartDataMap = [];
    foreach ($chartSalesData as $row) {
        $m = $row['month'];
        $chartDataMap[$m] = [
            'month' => $m,
            'total_sales' => floatval($row['total_sales']),
            'canceled' => floatval($row['canceled']),
            'returned' => floatval($row['returned']),
            'net_sales' => floatval($row['total_sales']) - floatval($row['canceled']) - floatval($row['returned']),
            'ads_spend' => 0
        ];
    }
    foreach ($chartAdsData as $row) {
        $m = $row['month'];
        if (!isset($chartDataMap[$m])) {
            $chartDataMap[$m] = ['month' => $m, 'total_sales' => 0, 'canceled' => 0, 'returned' => 0, 'net_sales' => 0, 'ads_spend' => 0];
        }
        $chartDataMap[$m]['ads_spend'] = floatval($row['ads_spend']);
    }
    $chart_data = array_values($chartDataMap);
    usort($chart_data, function($a, $b) { return strcmp($a['month'], $b['month']); });

    // 6. Summary by Platform
    $platformSummary = $pdo->query("SELECT platform, SUM(net_price) as total_sales FROM marketplace_orders WHERE $orderWhereSql GROUP BY platform")->fetchAll(PDO::FETCH_ASSOC);

    // 7. Summary by Store
    $storeSummary = $pdo->query("SELECT s.name as store_name, o.platform, SUM(o.net_price) as total_sales 
        FROM marketplace_orders o 
        LEFT JOIN marketplace_stores s ON o.store_id = s.id 
        WHERE o.$orderWhereSql 
        GROUP BY s.id, o.platform")->fetchAll(PDO::FETCH_ASSOC);

    json_response([
        'success' => true, 
        'kpis' => $kpis,
        'top_products' => $topProducts,
        'top_cancel_reasons' => $topCancelReasons,
        'top_return_reasons' => $topReturnReasons,
        'chart_data' => $chart_data,
        'platform_summary' => $platformSummary,
        'store_summary' => $storeSummary
    ]);

} catch (\Throwable $e) {
    file_put_contents(__DIR__ . '/../../tmp/php_errors.log', date('Y-m-d H:i:s') . " dashboard_advanced error: " . $e->getMessage() . "\n", FILE_APPEND);
    json_response(['success' => false, 'error' => $e->getMessage()]);
}
