import os

file_path = r"c:\laragon\www\CRM_ERP_V4\api\Distribution\index.php"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

target = """                }
                
                $resolvedTargetKey = $linkedKey;
            }
        }
    }

    $pdo->beginTransaction();"""

replacement = """                }
                
                $resolvedTargetKey = $linkedKey;
            }
            
            if (!$targetBasketId) {
                http_response_code(400);
                echo json_encode(['error' => "การแจกล้มเหลว: หาตะกร้าปลายทางไม่พบ (linked_basket_key ของ '$sourceBasketKey' ไม่ถูกต้องหรือไม่มีอยู่จริง)"]);
                return;
            }
        }
    }

    $pdo->beginTransaction();"""

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched error throwing successfully")
else:
    print("Target not found")
