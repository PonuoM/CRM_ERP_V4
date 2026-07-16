import os

file_path = r"c:\laragon\www\CRM_ERP_V4\api\basket_config.php"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

target = """            $basketMapStmt->execute([$basketKey]);
            $basketConfig = $basketMapStmt->fetch(PDO::FETCH_ASSOC);
            $dashboardBasketId = $basketConfig['id'] ?? null;

            if (!$dashboardBasketId)
                continue; // Basket not found

            // Reclaim usually means moving them back to the unassigned state in the same basket.
            // If the source was a dashboard basket, and they were assigned, they might be in the linked agent basket.
            // Wait, if they are assigned, their current basket is the Agent Basket.
            $targetBasketId = $dashboardBasketId; // Default: keep in same basket

            // Select customers to reclaim (Dynamic to support 'all' agents)
            $selectSql = "
                SELECT c.customer_id, c.assigned_to FROM customers c
                WHERE c.company_id = ? 
                AND c.current_basket_key = ?
            ";
            $params = [$companyId, $dashboardBasketId];"""

replacement = """            $basketMapStmt->execute([$basketKey]);
            $basketConfig = $basketMapStmt->fetch(PDO::FETCH_ASSOC);
            $dashboardBasketId = $basketConfig['id'] ?? null;
            $linkedBasketKey = $basketConfig['linked_basket_key'] ?? null;

            if (!$dashboardBasketId)
                continue; // Basket not found

            $searchBasketIds = [$dashboardBasketId];
            if ($linkedBasketKey) {
                $agentBasketStmt = $pdo->prepare("SELECT id FROM basket_config WHERE basket_key = ? AND company_id = 1");
                $agentBasketStmt->execute([$linkedBasketKey]);
                $agentBasketId = $agentBasketStmt->fetchColumn();
                if ($agentBasketId) {
                    $searchBasketIds[] = $agentBasketId;
                }
            }

            // Reclaim means moving them back to the unassigned state in the dashboard basket.
            $targetBasketId = $dashboardBasketId; 

            // Select customers to reclaim (Dynamic to support 'all' agents)
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
