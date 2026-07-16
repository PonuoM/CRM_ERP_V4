import os

file_path = r"c:\laragon\www\CRM_ERP_V4\api\Distribution\index.php"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

target = """          } else {
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

            if ($linkedKey) {
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
            }
            
            if (!$targetBasketId) {
                http_response_code(400);
                echo json_encode(['error' => "การแจกล้มเหลว: หาตะกร้าปลายทางไม่พบ (linked_basket_key ของ '$sourceBasketKey' ไม่ถูกต้องหรือไม่มีอยู่จริง)"]);
                return;
            }
        }
    }"""

replacement = """          } else {
            $stmt = $pdo->prepare("SELECT linked_basket_key FROM basket_config WHERE basket_key = ? AND company_id = 1");
            $stmt->execute([$sourceBasketKey]);
            $linkedKey = $stmt->fetchColumn();

            if (!$linkedKey) {
                http_response_code(400);
                echo json_encode(['error' => "การแจกล้มเหลว: หาตะกร้าปลายทางไม่พบ (ไม่ได้ตั้งค่า linked_basket_key สำหรับ '$sourceBasketKey' ในระบบ)"]);
                return;
            }

            $stmt = $pdo->prepare("SELECT id FROM basket_config WHERE basket_key = ? AND company_id = 1");
            $stmt->execute([$linkedKey]);
            $targetBasketId = $stmt->fetchColumn();
            
            if (!$targetBasketId) {
                http_response_code(400);
                echo json_encode(['error' => "การแจกล้มเหลว: หาตะกร้าปลายทางไม่พบ (ตั้งค่า linked_basket_key = '$linkedKey' ผิดพลาด หรือไม่มีตะกร้านี้อยู่จริง)"]);
                return;
            }
            
            $resolvedTargetKey = $linkedKey;
        }
    }"""

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched to remove auto-fallback and throw error successfully")
else:
    print("Target not found")
