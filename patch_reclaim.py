import os

file_path = r"c:\laragon\www\CRM_ERP_V4\api\basket_config.php"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

target = """            $updateStmt = $pdo->prepare($updateSql);
            $updateStmt->execute(array_merge([$targetBasketId], $affectedCustomerIds));
            $reclaimedCount = $updateStmt->rowCount();
            $totalReclaimed += $reclaimedCount;
            
            $results[] = [
                'basket_key' => $basketKey,
                'reclaimed' => $reclaimedCount
            ];

            // Log basket transitions for each customer with assigned_to info (Bulk Insert)
            $chunkSize = 1000;
            $chunks = array_chunk($affectedCustomers, $chunkSize);
            
            foreach ($chunks as $chunk) {
                $logValues = [];
                $logParams = [];
                foreach ($chunk as $cust) {
                    $custId = $cust['customer_id'];
                    $oldAgent = $cust['assigned_to'];
                    $triggeredBy = $agentId === 'all' ? $oldAgent : $agentId;
                    
                    $logValues[] = "(?, ?, ?, ?, NULL, ?, ?, ?, NOW())";
                    array_push($logParams, $custId, $dashboardBasketId, $targetBasketId, $oldAgent, 'reclaim', $triggeredBy, 'Reclaimed from Telesale');
                }
                
                $logSql = "INSERT INTO basket_transition_log 
                    (customer_id, from_basket_key, to_basket_key, assigned_to_old, assigned_to_new, transition_type, triggered_by, notes, created_at) 
                    VALUES " . implode(', ', $logValues);
                $logStmt = $pdo->prepare($logSql);
                $logStmt->execute($logParams);
            }
        }"""

replacement = """            $updateStmt = $pdo->prepare($updateSql);
            $updateStmt->execute(array_merge([$targetBasketId], $affectedCustomerIds));
            
            // Use count of IDs because rowCount() might return 0 if the row was already identical (e.g. current_basket_key hasn't changed)
            $reclaimedCount = count($affectedCustomerIds);
            $totalReclaimed += $reclaimedCount;
            
            $results[] = [
                'basket_key' => $basketKey,
                'reclaimed' => $reclaimedCount
            ];

            // Log basket transitions & insert into distribution_session_details for each customer (Bulk Insert)
            $chunkSize = 1000;
            $chunks = array_chunk($affectedCustomers, $chunkSize);
            
            foreach ($chunks as $chunk) {
                $logValues = [];
                $logParams = [];
                
                $detailValues = [];
                $detailParams = [];

                foreach ($chunk as $cust) {
                    $custId = $cust['customer_id'];
                    $oldAgent = $cust['assigned_to'];
                    $triggeredBy = $agentId === 'all' ? $oldAgent : $agentId;
                    
                    // Transition Log
                    $logValues[] = "(?, ?, ?, ?, NULL, ?, ?, ?, NOW())";
                    array_push($logParams, $custId, $dashboardBasketId, $targetBasketId, $oldAgent, 'reclaim', $triggeredBy, 'Reclaimed from Telesale');
                    
                    // Distribution Session Details (so they appear in Export / History)
                    // The agent who previously owned it is $oldAgent, target agent is NULL because they are reclaimed
                    // Note: session_details requires agent_id, which we'll record as $oldAgent for tracking whose customer was reclaimed.
                    $detailValues[] = "(?, ?, ?, ?, ?, ?)";
                    array_push($detailParams, $sessionId, $oldAgent, $custId, $oldAgent, $dashboardBasketId, 'Assigned');
                }
                
                // 1. Insert into transition log
                $logSql = "INSERT INTO basket_transition_log 
                    (customer_id, from_basket_key, to_basket_key, assigned_to_old, assigned_to_new, transition_type, triggered_by, notes, created_at) 
                    VALUES " . implode(', ', $logValues);
                $logStmt = $pdo->prepare($logSql);
                $logStmt->execute($logParams);
                
                // 2. Insert into session details
                $detailSql = "INSERT INTO distribution_session_details 
                    (session_id, agent_id, customer_id, previous_assigned_to, previous_basket_key, previous_lifecycle_status)
                    VALUES " . implode(', ', $detailValues);
                $detailStmtBatch = $pdo->prepare($detailSql);
                $detailStmtBatch->execute($detailParams);
            }
        }"""

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched successfully")
else:
    print("Target not found")
