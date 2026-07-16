import re

file_path = r"c:\laragon\www\CRM_ERP_V4\api\Distribution\index.php"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

pattern = re.compile(
    r"(function handleGetSessions\(\$pdo, \$companyId\)\s*\{\s*if \(\$_SERVER\['REQUEST_METHOD'\] !== 'GET'\) \{\s*http_response_code\(405\);\s*echo json_encode\(\['error' => 'GET required'\]\);\s*return;\s*\}\s*\$limit = \$_GET\['limit'\] \?\? 50;\s*)(// Fetch sessions.*?)(    \$sessions = \$sessionStmt->fetchAll\(PDO::FETCH_ASSOC\);)",
    re.DOTALL
)

replacement = r"""\1
    $startDate = $_GET['startDate'] ?? null;
    $endDate = $_GET['endDate'] ?? null;
    $type = $_GET['type'] ?? 'all';

    $whereClauses = [];
    $params = [];

    if ($companyId !== 'all') {
        $whereClauses[] = "ds.company_id = ?";
        $params[] = $companyId;
    }

    if ($startDate && $endDate) {
        $start = $startDate . ' 00:00:00';
        $end = $endDate . ' 23:59:59';
        $whereClauses[] = "ds.created_at BETWEEN ? AND ?";
        $params[] = $start;
        $params[] = $end;
    }

    if ($type === 'distribution') {
        $whereClauses[] = "(ds.distribution_mode NOT LIKE '%Reclaim%' AND ds.distribution_mode NOT LIKE '%Transfer%')";
    } else if ($type === 'reclaim') {
        $whereClauses[] = "(ds.distribution_mode LIKE '%Reclaim%' OR ds.distribution_mode LIKE '%Transfer%')";
    }

    $whereSql = "";
    if (!empty($whereClauses)) {
        $whereSql = "WHERE " . implode(" AND ", $whereClauses);
    }

    $sql = "
        SELECT ds.*, u.first_name, u.last_name, c.name as company_name
        FROM distribution_sessions ds
        LEFT JOIN users u ON ds.distributed_by = u.id
        LEFT JOIN companies c ON ds.company_id = c.id
        $whereSql
        ORDER BY ds.created_at DESC
        LIMIT " . (int)$limit . "
    ";

    $sessionStmt = $pdo->prepare($sql);
    $sessionStmt->execute($params);
\3"""

if pattern.search(content):
    content = pattern.sub(replacement, content)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched handleGetSessions successfully")
else:
    print("Could not find handleGetSessions pattern")
