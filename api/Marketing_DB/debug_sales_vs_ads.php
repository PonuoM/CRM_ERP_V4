<?php
/**
 * Debug Script: Check Sales vs Ads Data for Marketing Dashboard
 * Date Range: 28 Dec 2025 - 03 Jan 2026
 * Purpose: Investigate why total_sales shows 0 in Marketing Dashboard
 */

header("Content-Type: text/html; charset=UTF-8");

try {
    require_once "../config.php";
    $conn = db_connect();

    echo "<h1>🔍 Debug: Marketing Dashboard Sales vs Ads</h1>";
    echo "<hr>";

    // Date ranges to test
    $dateFrom_CE = "2025-12-28";
    $dateTo_CE = "2026-01-03";
    
    // BE dates (พ.ศ. = ค.ศ. + 543)
    $dateFrom_BE = "2568-12-28";
    $dateTo_BE = "2569-01-03";

    echo "<h2>📅 Date Ranges Being Tested</h2>";
    echo "<ul>";
    echo "<li><strong>CE (ค.ศ.):</strong> $dateFrom_CE - $dateTo_CE</li>";
    echo "<li><strong>BE (พ.ศ.):</strong> $dateFrom_BE - $dateTo_BE</li>";
    echo "</ul>";

    // ================================
    // 1. Check Orders Table Structure
    // ================================
    echo "<h2>📋 1. Orders Table - Date Column Check</h2>";
    $sql = "SELECT 
                MIN(order_date) as oldest_order_date,
                MAX(order_date) as newest_order_date,
                COUNT(*) as total_orders
            FROM orders";
    $result = $conn->query($sql);
    $row = $result->fetch(PDO::FETCH_ASSOC);
    echo "<ul>";
    echo "<li><strong>Oldest order_date:</strong> " . ($row['oldest_order_date'] ?? 'NULL') . "</li>";
    echo "<li><strong>Newest order_date:</strong> " . ($row['newest_order_date'] ?? 'NULL') . "</li>";
    echo "<li><strong>Total orders in DB:</strong> " . $row['total_orders'] . "</li>";
    echo "</ul>";

    // ================================
    // 2. Check Orders in CE Date Range
    // ================================
    echo "<h2>📦 2. Orders in CE Date Range ($dateFrom_CE to $dateTo_CE)</h2>";
    $sql = "SELECT 
                o.id, 
                o.order_date, 
                o.total_amount, 
                o.sales_channel_page_id,
                o.customer_type,
                p.name as page_name,
                p.id as page_id_in_pages
            FROM orders o
            LEFT JOIN pages p ON o.sales_channel_page_id = p.id
            WHERE o.order_date BETWEEN ? AND ?
            ORDER BY o.order_date DESC
            LIMIT 20";
    $stmt = $conn->prepare($sql);
    $stmt->execute([$dateFrom_CE, $dateTo_CE]);
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "<p><strong>Orders found (CE): " . count($orders) . " rows (showing max 20)</strong></p>";
    if (count($orders) > 0) {
        echo "<table border='1' cellpadding='5' cellspacing='0'>";
        echo "<tr><th>ID</th><th>order_date</th><th>total_amount</th><th>sales_channel_page_id</th><th>page_name (from join)</th><th>customer_type</th></tr>";
        foreach ($orders as $o) {
            $pageMatch = $o['page_name'] ? "✅ " . $o['page_name'] : "❌ No match (NULL or not found)";
            echo "<tr>";
            echo "<td>" . $o['id'] . "</td>";
            echo "<td>" . $o['order_date'] . "</td>";
            echo "<td>" . number_format($o['total_amount'], 2) . "</td>";
            echo "<td>" . ($o['sales_channel_page_id'] ?? 'NULL') . "</td>";
            echo "<td>" . $pageMatch . "</td>";
            echo "<td>" . ($o['customer_type'] ?? '-') . "</td>";
            echo "</tr>";
        }
        echo "</table>";
    } else {
        echo "<p style='color:red;'>❌ No orders found in CE date range</p>";
    }

    // ================================
    // 3. Check Orders with NULL sales_channel_page_id
    // ================================
    echo "<h2>⚠️ 3. Orders with NULL sales_channel_page_id (in CE range)</h2>";
    $sql = "SELECT COUNT(*) as count_null FROM orders WHERE order_date BETWEEN ? AND ? AND sales_channel_page_id IS NULL";
    $stmt = $conn->prepare($sql);
    $stmt->execute([$dateFrom_CE, $dateTo_CE]);
    $nullCount = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $sql = "SELECT COUNT(*) as count_total FROM orders WHERE order_date BETWEEN ? AND ?";
    $stmt = $conn->prepare($sql);
    $stmt->execute([$dateFrom_CE, $dateTo_CE]);
    $totalCount = $stmt->fetch(PDO::FETCH_ASSOC);

    echo "<ul>";
    echo "<li><strong>Total orders in range:</strong> " . $totalCount['count_total'] . "</li>";
    echo "<li><strong>Orders with NULL sales_channel_page_id:</strong> " . $nullCount['count_null'] . "</li>";
    echo "<li><strong>Orders with valid sales_channel_page_id:</strong> " . ($totalCount['count_total'] - $nullCount['count_null']) . "</li>";
    echo "</ul>";

    // ================================
    // 4. Check Ads Log Data
    // ================================
    echo "<h2>📊 4. Ads Log Data in Date Range</h2>";
    
    // CE date range
    echo "<h3>4a. Ads Log (CE: $dateFrom_CE to $dateTo_CE)</h3>";
    $sql = "SELECT 
                mal.id,
                mal.date,
                mal.page_id,
                mal.ads_cost,
                mal.impressions,
                mal.clicks,
                p.name as page_name
            FROM marketing_ads_log mal
            LEFT JOIN pages p ON mal.page_id = p.id
            WHERE mal.date BETWEEN ? AND ?
            ORDER BY mal.date DESC
            LIMIT 20";
    $stmt = $conn->prepare($sql);
    $stmt->execute([$dateFrom_CE, $dateTo_CE]);
    $adsLogs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "<p><strong>Ads logs found (CE): " . count($adsLogs) . " rows</strong></p>";
    if (count($adsLogs) > 0) {
        echo "<table border='1' cellpadding='5' cellspacing='0'>";
        echo "<tr><th>ID</th><th>date</th><th>page_id</th><th>page_name</th><th>ads_cost</th><th>impressions</th><th>clicks</th></tr>";
        foreach ($adsLogs as $a) {
            echo "<tr>";
            echo "<td>" . $a['id'] . "</td>";
            echo "<td>" . $a['date'] . "</td>";
            echo "<td>" . $a['page_id'] . "</td>";
            echo "<td>" . ($a['page_name'] ?? 'NULL') . "</td>";
            echo "<td>" . number_format($a['ads_cost'], 2) . "</td>";
            echo "<td>" . $a['impressions'] . "</td>";
            echo "<td>" . $a['clicks'] . "</td>";
            echo "</tr>";
        }
        echo "</table>";
    } else {
        echo "<p style='color:red;'>❌ No ads logs found in CE date range</p>";
    }

    // Check all ads log dates to see the format
    echo "<h3>4b. Sample Ads Log Dates (to check format)</h3>";
    $sql = "SELECT MIN(date) as min_date, MAX(date) as max_date, COUNT(*) as total FROM marketing_ads_log";
    $result = $conn->query($sql);
    $adsRange = $result->fetch(PDO::FETCH_ASSOC);
    echo "<ul>";
    echo "<li><strong>Oldest ads log date:</strong> " . ($adsRange['min_date'] ?? 'NULL') . "</li>";
    echo "<li><strong>Newest ads log date:</strong> " . ($adsRange['max_date'] ?? 'NULL') . "</li>";
    echo "<li><strong>Total ads logs:</strong> " . $adsRange['total'] . "</li>";
    echo "</ul>";

    // ================================
    // 5. Check Pages Table
    // ================================
    echo "<h2>📄 5. Pages Table Sample</h2>";
    $sql = "SELECT id, name, platform, page_type, active FROM pages ORDER BY id LIMIT 15";
    $result = $conn->query($sql);
    $pages = $result->fetchAll(PDO::FETCH_ASSOC);

    echo "<p><strong>Total pages in sample: " . count($pages) . "</strong></p>";
    echo "<table border='1' cellpadding='5' cellspacing='0'>";
    echo "<tr><th>id</th><th>name</th><th>platform</th><th>page_type</th><th>active</th></tr>";
    foreach ($pages as $pg) {
        echo "<tr>";
        echo "<td>" . $pg['id'] . "</td>";
        echo "<td>" . $pg['name'] . "</td>";
        echo "<td>" . ($pg['platform'] ?? '-') . "</td>";
        echo "<td>" . ($pg['page_type'] ?? '-') . "</td>";
        echo "<td>" . ($pg['active'] ?? '-') . "</td>";
        echo "</tr>";
    }
    echo "</table>";

    // ================================
    // 6. Cross-check: Orders grouped by sales_channel_page_id
    // ================================
    echo "<h2>🔗 6. Orders Grouped by sales_channel_page_id (in CE range)</h2>";
    $sql = "SELECT 
                o.sales_channel_page_id,
                p.name as page_name,
                COUNT(*) as order_count,
                SUM(o.total_amount) as total_sales
            FROM orders o
            LEFT JOIN pages p ON o.sales_channel_page_id = p.id
            WHERE o.order_date BETWEEN ? AND ?
            GROUP BY o.sales_channel_page_id, p.name
            ORDER BY total_sales DESC";
    $stmt = $conn->prepare($sql);
    $stmt->execute([$dateFrom_CE, $dateTo_CE]);
    $grouped = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (count($grouped) > 0) {
        echo "<table border='1' cellpadding='5' cellspacing='0'>";
        echo "<tr><th>sales_channel_page_id</th><th>page_name</th><th>order_count</th><th>total_sales</th></tr>";
        foreach ($grouped as $g) {
            echo "<tr>";
            echo "<td>" . ($g['sales_channel_page_id'] ?? 'NULL') . "</td>";
            echo "<td>" . ($g['page_name'] ?? '❌ Not matched') . "</td>";
            echo "<td>" . $g['order_count'] . "</td>";
            echo "<td>" . number_format($g['total_sales'], 2) . "</td>";
            echo "</tr>";
        }
        echo "</table>";
    } else {
        echo "<p style='color:red;'>❌ No orders found</p>";
    }

    // ================================
    // 7. Summary
    // ================================
    echo "<h2>📝 7. Summary & Diagnosis</h2>";
    echo "<ul>";
    if ($totalCount['count_total'] == 0) {
        echo "<li style='color:red;'>❌ <strong>NO ORDERS</strong> found in CE date range. Check if dates are stored in BE (พ.ศ.) format.</li>";
    } else {
        echo "<li>✅ Found " . $totalCount['count_total'] . " orders in CE date range.</li>";
    }
    
    if ($nullCount['count_null'] > 0) {
        echo "<li style='color:orange;'>⚠️ " . $nullCount['count_null'] . " orders have NULL sales_channel_page_id - these won't count in Marketing Dashboard!</li>";
    }
    
    if (count($adsLogs) == 0) {
        echo "<li style='color:red;'>❌ <strong>NO ADS LOGS</strong> found in CE date range.</li>";
    } else {
        echo "<li>✅ Found " . count($adsLogs) . " ads log entries in CE date range.</li>";
    }
    echo "</ul>";

    echo "<hr>";
    echo "<p><em>Debug script completed at: " . date('Y-m-d H:i:s') . "</em></p>";

} catch (Exception $e) {
    echo "<h1 style='color:red;'>❌ Error</h1>";
    echo "<pre>" . $e->getMessage() . "</pre>";
}
?>
