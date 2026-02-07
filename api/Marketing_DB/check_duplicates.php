<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

require_once "../config.php";
$conn = db_connect();

// Find duplicate records: same page_id + date but different user_id
$sql = "
SELECT 
    mal.page_id,
    p.name as page_name,
    mal.date,
    COUNT(*) as record_count,
    GROUP_CONCAT(CONCAT(u.first_name, ' (ID:', mal.user_id, ', ads_cost:', COALESCE(mal.ads_cost,0), ')') SEPARATOR ' | ') as entries
FROM marketing_ads_log mal
LEFT JOIN pages p ON mal.page_id = p.id
LEFT JOIN users u ON mal.user_id = u.id
GROUP BY mal.page_id, mal.date
HAVING COUNT(*) > 1
ORDER BY mal.date DESC, p.name ASC
";

$stmt = $conn->prepare($sql);
$stmt->execute();
$duplicates = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Also get total count
$totalSql = "SELECT COUNT(*) as total FROM marketing_ads_log";
$totalStmt = $conn->prepare($totalSql);
$totalStmt->execute();
$total = $totalStmt->fetch(PDO::FETCH_ASSOC)['total'];

echo json_encode([
    "success" => true,
    "total_records" => (int)$total,
    "duplicate_count" => count($duplicates),
    "duplicates" => $duplicates
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
?>
