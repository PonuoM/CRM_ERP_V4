<?php
/**
 * Debug Script: Check what parameters the Marketing Dashboard API receives
 * Purpose: Investigate date format (BE vs CE) issue
 */

header("Content-Type: text/html; charset=UTF-8");

try {
    require_once "../config.php";
    $conn = db_connect();

    echo "<h1>🔍 Debug: API Date Parameters</h1>";
    echo "<hr>";

    // Get parameters from URL (same as dashboard_data.php)
    $dateFrom = $_GET["date_from"] ?? null;
    $dateTo = $_GET["date_to"] ?? null;
    $pageIds = $_GET["page_ids"] ?? null;
    $userIds = $_GET["user_ids"] ?? null;
    $companyId = isset($_GET["company_id"]) ? (int) $_GET["company_id"] : null;

    echo "<h2>📥 Received Parameters (From URL)</h2>";
    echo "<table border='1' cellpadding='8' cellspacing='0'>";
    echo "<tr><th>Parameter</th><th>Value</th><th>Analysis</th></tr>";
    
    // Analyze date_from
    $dateFromAnalysis = "";
    if ($dateFrom) {
        $year = (int)substr($dateFrom, 0, 4);
        if ($year > 2500) {
            $dateFromAnalysis = "⚠️ พ.ศ. detected! (Year: $year) - Should convert to ค.ศ.: " . ($year - 543);
        } else if ($year > 2000 && $year < 2100) {
            $dateFromAnalysis = "✅ ค.ศ. format (Year: $year)";
        } else {
            $dateFromAnalysis = "❓ Unknown format";
        }
    } else {
        $dateFromAnalysis = "Not provided";
    }
    echo "<tr><td>date_from</td><td><code>" . htmlspecialchars($dateFrom ?? 'NULL') . "</code></td><td>$dateFromAnalysis</td></tr>";
    
    // Analyze date_to
    $dateToAnalysis = "";
    if ($dateTo) {
        $year = (int)substr($dateTo, 0, 4);
        if ($year > 2500) {
            $dateToAnalysis = "⚠️ พ.ศ. detected! (Year: $year) - Should convert to ค.ศ.: " . ($year - 543);
        } else if ($year > 2000 && $year < 2100) {
            $dateToAnalysis = "✅ ค.ศ. format (Year: $year)";
        } else {
            $dateToAnalysis = "❓ Unknown format";
        }
    } else {
        $dateToAnalysis = "Not provided";
    }
    echo "<tr><td>date_to</td><td><code>" . htmlspecialchars($dateTo ?? 'NULL') . "</code></td><td>$dateToAnalysis</td></tr>";
    
    echo "<tr><td>page_ids</td><td><code>" . htmlspecialchars($pageIds ?? 'NULL') . "</code></td><td></td></tr>";
    echo "<tr><td>user_ids</td><td><code>" . htmlspecialchars($userIds ?? 'NULL') . "</code></td><td></td></tr>";
    echo "<tr><td>company_id</td><td><code>" . ($companyId ?? 'NULL') . "</code></td><td></td></tr>";
    echo "</table>";

    // ================================
    // Test Query with Both Date Formats
    // ================================
    echo "<h2>🧪 Test Queries with Different Date Formats</h2>";

    // Test scenarios
    $testScenarios = [
        ['CE (ค.ศ.)', '2025-12-28', '2026-01-03'],
        ['BE (พ.ศ.)', '2568-12-28', '2569-01-03'],
    ];

    foreach ($testScenarios as $scenario) {
        $label = $scenario[0];
        $from = $scenario[1];
        $to = $scenario[2];

        echo "<h3>Test: $label ($from to $to)</h3>";

        // Count orders
        $sql = "SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount), 0) as total 
                FROM orders WHERE order_date BETWEEN ? AND ?";
        $stmt = $conn->prepare($sql);
        $stmt->execute([$from, $to]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        // Count ads
        $sql = "SELECT COUNT(*) as cnt, COALESCE(SUM(ads_cost), 0) as total 
                FROM marketing_ads_log WHERE date BETWEEN ? AND ?";
        $stmt = $conn->prepare($sql);
        $stmt->execute([$from, $to]);
        $adsResult = $stmt->fetch(PDO::FETCH_ASSOC);

        echo "<table border='1' cellpadding='5'>";
        echo "<tr><th>Table</th><th>Count</th><th>Total</th></tr>";
        echo "<tr><td>orders</td><td>" . $result['cnt'] . "</td><td>" . number_format($result['total'], 2) . "</td></tr>";
        echo "<tr><td>marketing_ads_log</td><td>" . $adsResult['cnt'] . "</td><td>" . number_format($adsResult['total'], 2) . "</td></tr>";
        echo "</table>";

        if ($result['cnt'] == 0 && $adsResult['cnt'] == 0) {
            echo "<p style='color:red;'>❌ No data found with $label format</p>";
        } else {
            echo "<p style='color:green;'>✅ Data found with $label format</p>";
        }
    }

    // ================================
    // Instructions
    // ================================
    echo "<h2>📝 วิธีทดสอบ</h2>";
    echo "<p>ลองเรียก URL นี้พร้อม parameters เพื่อดูว่า Frontend ส่งค่าอะไรมา:</p>";
    echo "<pre style='background:#f0f0f0;padding:10px;'>";
    echo "api/Marketing_DB/debug_api_params.php?date_from=2568-12-28&date_to=2569-01-03&company_id=1\n";
    echo "api/Marketing_DB/debug_api_params.php?date_from=2025-12-28&date_to=2026-01-03&company_id=1";
    echo "</pre>";

    echo "<hr>";
    echo "<p><em>Debug script completed at: " . date('Y-m-d H:i:s') . "</em></p>";

} catch (Exception $e) {
    echo "<h1 style='color:red;'>❌ Error</h1>";
    echo "<pre>" . $e->getMessage() . "</pre>";
}
?>
