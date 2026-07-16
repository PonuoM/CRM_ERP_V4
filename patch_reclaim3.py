import os

file_path = r"c:\laragon\www\CRM_ERP_V4\api\basket_config.php"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

target = """            // First, get the customer IDs that will be affected (for logging)
            $selectSql = "
                SELECT c.customer_id, c.assigned_to FROM customers c
                WHERE c.company_id = ? 
                AND c.current_basket_key = ?
            ";
            
            $params = [$companyId, $dashboardBasketId];"""

replacement = """            // Find the agent basket ID (because assigned customers are usually in the agent basket)
            $searchBasketIds = [$dashboardBasketId];
            if ($linkedBasketKey) {
                $agentBasketStmt = $pdo->prepare("SELECT id FROM basket_config WHERE basket_key = ? AND company_id = 1");
                $agentBasketStmt->execute([$linkedBasketKey]);
                $agentBasketId = $agentBasketStmt->fetchColumn();
                if ($agentBasketId) {
                    $searchBasketIds[] = $agentBasketId;
                }
            }

            // First, get the customer IDs that will be affected (for logging)
            $placeholders = implode(',', array_fill(0, count($searchBasketIds), '?'));
            $selectSql = "
                SELECT c.customer_id, c.assigned_to FROM customers c
                WHERE c.company_id = ? 
                AND c.current_basket_key IN ($placeholders)
            ";
            
            $params = array_merge([$companyId], $searchBasketIds);"""

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched handleReclaimCustomers successfully")
else:
    print("Target not found")
