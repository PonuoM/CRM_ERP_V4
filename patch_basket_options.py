import os
import re

file_path = r"c:\laragon\www\CRM_ERP_V4\api\Distribution\index.php"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add to routing
pattern_route = r"(} elseif \(\$action === 'get_session_tags'\) \{\s*handleGetSessionTags\(\$pdo, \$companyId\);\s*)"
replacement_route = r"\1} elseif ($action === 'get_basket_options') {\n        handleGetBasketOptions($pdo, $companyId);\n    "

content = re.sub(pattern_route, replacement_route, content)

# Add the function
function_code = """
function handleGetBasketOptions($pdo, $companyId) {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['error' => 'GET required']);
        return;
    }

    if ($companyId === 'all') {
        $stmt = $pdo->prepare("SELECT id, basket_key, basket_name FROM basket_config ORDER BY list_order ASC");
        $stmt->execute();
    } else {
        $stmt = $pdo->prepare("SELECT id, basket_key, basket_name FROM basket_config WHERE company_id = ? ORDER BY list_order ASC");
        $stmt->execute([$companyId]);
    }
    
    $baskets = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['ok' => true, 'baskets' => $baskets]);
}
"""

content += function_code

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Backend API patched with get_basket_options successfully")
