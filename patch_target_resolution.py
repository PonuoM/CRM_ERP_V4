import os

file_path = r"c:\laragon\www\CRM_ERP_V4\api\Distribution\index.php"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

target = """        } else {
            $stmt = $pdo->prepare("SELECT linked_basket_key FROM basket_config WHERE basket_key = ? AND company_id = 1");
            $stmt->execute([$sourceBasketKey]);
            $linkedKey = $stmt->fetchColumn();
            if ($linkedKey) {"""

replacement = """        } else {
            $stmt = $pdo->prepare("SELECT linked_basket_key FROM basket_config WHERE basket_key = ? AND company_id = 1");
            $stmt->execute([$sourceBasketKey]);
            $linkedKey = $stmt->fetchColumn();
            
            // Fallback: If DB is misconfigured (e.g., mid_9_12m has empty linked_basket_key),
            // we search for the dashboard_v2 basket that points BACK to this source basket.
            if (!$linkedKey) {
                $reverseStmt = $pdo->prepare("SELECT basket_key FROM basket_config WHERE linked_basket_key = ? AND target_page = 'dashboard_v2' AND company_id = 1");
                $reverseStmt->execute([$sourceBasketKey]);
                $linkedKey = $reverseStmt->fetchColumn();
            }

            if ($linkedKey) {"""

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched target resolution successfully")
else:
    print("Target not found")
