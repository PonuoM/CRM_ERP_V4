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

    // Aliased for JOIN
    $orderWhereAliased = ["o.company_id = $cid", "DATE(o.order_date) >= '$date_from'", "DATE(o.order_date) <= '$date_to'"];
    if ($store_id !== 'all') $orderWhereAliased[] = "o.store_id = " . intval($store_id);
    if ($platform !== 'all') $orderWhereAliased[] = "o.platform = '" . addslashes($platform) . "'";
    $orderWhereSqlAliased = implode(" AND ", $orderWhereAliased);

    // Filter conditions for ads (needs JOIN with marketplace_stores since ads_log lacks company_id)
    $adsWhere = ["s.company_id = $cid", "a.date >= '$date_from'", "a.date <= '$date_to'"];
    if ($store_id !== 'all') $adsWhere[] = "a.store_id = " . intval($store_id);
    $adsWhereSql = implode(" AND ", $adsWhere);

    // 1. KPIs
    // Total Sales, Canceled, Returned, Net Sales
    $kpiSql = "SELECT 
        SUM(total_price) as total_sales,
        SUM(CASE WHEN order_status LIKE '%ยกเลิก%' OR order_status LIKE '%Canceled%' THEN total_price ELSE 0 END) as canceled_amount,
        SUM(CASE WHEN order_status LIKE '%ตีกลับ%' OR order_status LIKE '%Returned%' THEN total_price ELSE 0 END) as returned_amount
        FROM marketplace_sales_orders WHERE $orderWhereSql";
    $kpiSales = $pdo->query($kpiSql)->fetch();

    $total_sales = floatval($kpiSales['total_sales'] ?? 0);
    $canceled = floatval($kpiSales['canceled_amount'] ?? 0);
    $returned = floatval($kpiSales['returned_amount'] ?? 0);
    $net_sales = $total_sales - $canceled - $returned;

    // Ads Spend
    $adsSpendSql = "SELECT SUM(a.ads_cost) as total_ads FROM marketplace_ads_log a JOIN marketplace_stores s ON a.store_id = s.id WHERE $adsWhereSql";
    $adsSpend = $pdo->query($adsSpendSql)->fetchColumn();
    $ads_spend = floatval($adsSpend ?? 0);

    // Invoices (Not implemented yet, return 0)
    $invoice_sales = 0;
    $actual_amount = 0;

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
    $topProducts = $pdo->query("SELECT product_name, product_code as sku, SUM(quantity) as total_qty, SUM(total_price) as total_amount 
        FROM marketplace_sales_orders 
        WHERE $orderWhereSql AND order_status NOT LIKE '%ยกเลิก%' AND order_status NOT LIKE '%Canceled%'
        GROUP BY product_name, product_code 
        ORDER BY total_qty DESC LIMIT 5")->fetchAll();

    // 3. Top 5 Cancel Reasons
    $topCancelReasons = $pdo->query("SELECT cancel_reason as reason, COUNT(*) as count 
        FROM marketplace_sales_orders 
        WHERE $orderWhereSql AND (order_status LIKE '%ยกเลิก%' OR order_status LIKE '%Canceled%') AND cancel_reason != '' AND cancel_reason IS NOT NULL
        GROUP BY cancel_reason 
        ORDER BY count DESC LIMIT 5")->fetchAll();

    // 4. Top 5 Return Reasons
    $topReturnReasons = $pdo->query("SELECT cancel_reason as reason, COUNT(*) as count 
        FROM marketplace_sales_orders 
        WHERE $orderWhereSql AND (order_status LIKE '%ตีกลับ%' OR order_status LIKE '%Returned%') AND cancel_reason != '' AND cancel_reason IS NOT NULL
        GROUP BY cancel_reason 
        ORDER BY count DESC LIMIT 5")->fetchAll();

    // 5. Chart Data (Monthly Trend)
    $chartDataSql = "SELECT DATE_FORMAT(order_date, '%Y-%m') as month,
        SUM(total_price) as total_sales,
        SUM(CASE WHEN order_status LIKE '%ยกเลิก%' OR order_status LIKE '%Canceled%' THEN total_price ELSE 0 END) as canceled,
        SUM(CASE WHEN order_status LIKE '%ตีกลับ%' OR order_status LIKE '%Returned%' THEN total_price ELSE 0 END) as returned
        FROM marketplace_sales_orders WHERE $orderWhereSql AND order_date IS NOT NULL
        GROUP BY DATE_FORMAT(order_date, '%Y-%m')
        ORDER BY month ASC";
    $chartSalesData = $pdo->query($chartDataSql)->fetchAll(PDO::FETCH_ASSOC);

    // Merge Ads into Chart Data
    $chartAdsSql = "SELECT DATE_FORMAT(a.date, '%Y-%m') as month, SUM(a.ads_cost) as ads_spend 
        FROM marketplace_ads_log a 
        JOIN marketplace_stores s ON a.store_id = s.id 
        WHERE $adsWhereSql AND a.date IS NOT NULL 
        GROUP BY DATE_FORMAT(a.date, '%Y-%m')";
    $chartAdsData = $pdo->query($chartAdsSql)->fetchAll(PDO::FETCH_ASSOC);
    
    $chartDataMap = [];
    foreach ($chartSalesData as $row) {
        if (!$row['month']) continue;
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
        if (!$row['month']) continue;
        $m = $row['month'];
        if (!isset($chartDataMap[$m])) {
            $chartDataMap[$m] = ['month' => $m, 'total_sales' => 0, 'canceled' => 0, 'returned' => 0, 'net_sales' => 0, 'ads_spend' => 0];
        }
        $chartDataMap[$m]['ads_spend'] = floatval($row['ads_spend']);
    }
    $chart_data = array_values($chartDataMap);
    usort($chart_data, function($a, $b) { return strcmp($a['month'], $b['month']); });

    // 6. Summary by Platform
    $platformSummary = $pdo->query("SELECT platform, SUM(total_price) as total_sales FROM marketplace_sales_orders WHERE $orderWhereSql GROUP BY platform")->fetchAll(PDO::FETCH_ASSOC);

    // 7. Summary by Store
    $storeSummary = $pdo->query("SELECT s.name as store_name, o.platform, SUM(o.total_price) as total_sales 
        FROM marketplace_sales_orders o 
        LEFT JOIN marketplace_stores s ON o.store_id = s.id 
        WHERE $orderWhereSqlAliased 
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
    // Fix error logging directory issue
    error_log(date('Y-m-d H:i:s') . " dashboard_advanced error: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine());
    json_response(['success' => false, 'error' => $e->getMessage()]);
}
