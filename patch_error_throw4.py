import os

file_path = r"c:\laragon\www\CRM_ERP_V4\api\Distribution\index.php"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Instead of exact string replacement, we will use regex to replace the entire else block
import re

pattern = re.compile(r"} else {\s+\$stmt = \$pdo->prepare\(\"SELECT linked_basket_key FROM basket_config WHERE basket_key = \? AND company_id = 1\"\);\s+\$stmt->execute\(\[\$sourceBasketKey\]\);\s+\$linkedKey = \$stmt->fetchColumn\(\);.*?if \(!\$targetBasketId\) {\s+http_response_code\(400\);\s+echo json_encode\(\['error' => \".*?\"\]\);\s+return;\s+}\s+}\s+}", re.DOTALL)

replacement = """} else {
            $stmt = $pdo->prepare("SELECT linked_basket_key FROM basket_config WHERE basket_key = ? AND company_id = 1");
            $stmt->execute([$sourceBasketKey]);
            $linkedKey = $stmt->fetchColumn();

            if (!$linkedKey) {
                http_response_code(400);
                echo json_encode(['error' => "การแจกล้มเหลว: หาตะกร้าปลายทางไม่พบ (ไม่ได้ตั้งค่า linked_basket_key สำหรับ '\$sourceBasketKey' ในระบบ)"]);
                return;
            }

            $stmt = $pdo->prepare("SELECT id FROM basket_config WHERE basket_key = ? AND company_id = 1");
            $stmt->execute([$linkedKey]);
            $targetBasketId = $stmt->fetchColumn();
            
            if (!$targetBasketId) {
                http_response_code(400);
                echo json_encode(['error' => "การแจกล้มเหลว: หาตะกร้าปลายทางไม่พบ (ตั้งค่า linked_basket_key = '\$linkedKey' ผิดพลาด หรือไม่มีตะกร้านี้อยู่จริง)"]);
                return;
            }
            
            $resolvedTargetKey = $linkedKey;
        }
    }"""

if pattern.search(content):
    content = pattern.sub(replacement, content)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched successfully with regex")
else:
    print("Target not found via regex")
