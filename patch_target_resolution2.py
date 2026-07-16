import os

file_path = r"c:\laragon\www\CRM_ERP_V4\api\Distribution\index.php"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

target = """            if ($linkedKey) {
                $stmt = $pdo->prepare("SELECT id FROM basket_config WHERE basket_key = ? AND company_id = 1");
                $stmt->execute([$linkedKey]);
                $targetBasketId = $stmt->fetchColumn();
                $resolvedTargetKey = $linkedKey;
            }"""

replacement = """            if ($linkedKey) {
                $stmt = $pdo->prepare("SELECT id FROM basket_config WHERE basket_key = ? AND company_id = 1");
                $stmt->execute([$linkedKey]);
                $targetBasketId = $stmt->fetchColumn();
                
                // If linkedKey was found but NO ID EXISTS (e.g. typo in DB 'mid_6_12m_dash' instead of 'mid_6_9m_dash')
                if (!$targetBasketId) {
                    $reverseStmt = $pdo->prepare("SELECT basket_key FROM basket_config WHERE linked_basket_key = ? AND target_page = 'dashboard_v2' AND company_id = 1");
                    $reverseStmt->execute([$sourceBasketKey]);
                    $linkedKey = $reverseStmt->fetchColumn();
                    if ($linkedKey) {
                        $stmt->execute([$linkedKey]);
                        $targetBasketId = $stmt->fetchColumn();
                    }
                }
                
                $resolvedTargetKey = $linkedKey;
            }"""

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched targetBasketId resolution successfully")
else:
    print("Target not found")
