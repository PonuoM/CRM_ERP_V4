<?php

class BasketRoutingService {
    private $pdo;
    private $companyId;

    public function __construct($pdo, $companyId) {
        $this->pdo = $pdo;
        $this->companyId = $companyId;
    }

    /**
     * Handle transition when a sale occurs
     * Rule: Move to 'on_sale_basket_key' (usually 'month_1_2') and reset counters
     */
    public function handleSaleTransition($customerId, $userId) {
        // Get current customer basket
        $stmt = $this->pdo->prepare("SELECT current_basket_key, distribution_count FROM customers WHERE id = ?");
        $stmt->execute([$customerId]);
        $customer = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$customer) return false;

        // Default start point
        $targetBasket = 'month_1_2';

        // [New Logic] Check for Active 'Telesale_upsell' users
        // If company has active upsell agents, they get priority for ALL new sales
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM users WHERE role = 'Telesale_upsell' AND status = 'active' AND company_id = ?");
        $stmt->execute([$this->companyId]);
        $upsellCount = $stmt->fetchColumn();

        if ($upsellCount > 0) {
            $targetBasket = 'upsell_waiting';
        } else {
            // Normal Logic: Check if customer has specific assigned basket rule
            if ($customer['current_basket_key']) {
                $stmt = $this->pdo->prepare("SELECT on_sale_basket_key FROM basket_config WHERE basket_key = ? AND company_id = ?");
                $stmt->execute([$customer['current_basket_key'], $this->companyId]);
                $config = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($config && $config['on_sale_basket_key']) {
                    $targetBasket = $config['on_sale_basket_key'];
                }
            }
        }

        // Perform transition
        return $this->performTransition($customerId, $targetBasket, 'sale', $userId);
    }

    /**
     * Perform the actual transition
     */
    public function performTransition($customerId, $targetBasketKey, $type, $userId = null) {
        $this->pdo->beginTransaction();

        try {
            // Get current state for logging
            $stmt = $this->pdo->prepare("SELECT current_basket_key, assigned_to, distribution_count FROM customers WHERE id = ? FOR UPDATE");
            $stmt->execute([$customerId]);
            $current = $stmt->fetch(PDO::FETCH_ASSOC);

            // Update customer
            $updates = [
                'current_basket_key' => $targetBasketKey,
                'basket_entered_date' => date('Y-m-d H:i:s')
            ];

            // Reset distribution count on sale
            if ($type === 'sale') {
                $updates['distribution_count'] = 0;
                $updates['hold_until_date'] = null; // Clear hold
            }

            // Perform Update
            $sql = "UPDATE customers SET ";
            $params = [];
            foreach ($updates as $key => $val) {
                $sql .= "$key = ?, ";
                $params[] = $val;
            }
            $sql = rtrim($sql, ", ") . " WHERE id = ?";
            $params[] = $customerId;
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);

            // Log transition
            $stmt = $this->pdo->prepare("
                INSERT INTO basket_transition_log 
                (customer_id, from_basket_key, to_basket_key, transition_type, triggered_by)
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $customerId,
                $current['current_basket_key'],
                $targetBasketKey,
                $type,
                $userId
            ]);

            $this->pdo->commit();
            return true;

        } catch (Exception $e) {
            $this->pdo->rollBack();
            error_log("Basket Transition Error: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Find matching basket for customer based on their current data
     * Used for "Re-Evaluate on Fail" feature
     * 
     * Logic:
     * - < 180 days since last order: loop back (return null to use current basket's fail target)
     * - 180-365 days: mid_6_12m
     * - 366-1095 days: mid_1_3y
     * - 1096+ days: ancient
     */
    public function findMatchingBasket($customerId, $currentBasketKey = null) {
        // Get customer data
        $stmt = $this->pdo->prepare("
            SELECT customer_id, last_order_date, first_order_date, date_registered, order_count,
                   DATEDIFF(NOW(), last_order_date) as days_since_last_order,
                   DATEDIFF(NOW(), first_order_date) as days_since_first_order,
                   DATEDIFF(NOW(), date_registered) as days_since_registered
            FROM customers WHERE customer_id = ?
        ");
        $stmt->execute([$customerId]);
        $customer = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$customer) return null;

        $daysSince = $customer['days_since_last_order'] ?? 9999;

        // Route based on days since last order
        if ($daysSince < 180) {
            // Loop back - return distribution version of current basket
            // e.g., waiting_for_match_dash -> waiting_for_match
            if ($currentBasketKey) {
                return str_replace('_dash', '', $currentBasketKey);
            }
            return null; // Use default on_fail_basket_key
        } elseif ($daysSince >= 180 && $daysSince <= 365) {
            return 'mid_6_12m';
        } elseif ($daysSince >= 366 && $daysSince <= 1095) {
            return 'mid_1_3y';
        } else {
            return 'ancient';
        }
    }

    /**
     * Check if a user was previously assigned to this customer
     * Used to prevent repeated distribution to same agent
     */
    public function wasPreviouslyAssigned($customerId, $userId) {
        $stmt = $this->pdo->prepare("SELECT previous_assigned_to FROM customers WHERE customer_id = ?");
        $stmt->execute([$customerId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$row || !$row['previous_assigned_to']) return false;
        
        $prevAssigned = json_decode($row['previous_assigned_to'], true);
        return is_array($prevAssigned) && in_array($userId, $prevAssigned);
    }

    /**
     * Get list of eligible agents for distribution (excluding previously assigned)
     */
    public function getEligibleAgentsForCustomer($customerId, $allAgentIds) {
        $stmt = $this->pdo->prepare("SELECT previous_assigned_to FROM customers WHERE customer_id = ?");
        $stmt->execute([$customerId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $prevAssigned = [];
        if ($row && $row['previous_assigned_to']) {
            $prevAssigned = json_decode($row['previous_assigned_to'], true) ?: [];
        }
        
        // Return agents NOT in previous_assigned_to list
        return array_filter($allAgentIds, function($agentId) use ($prevAssigned) {
            return !in_array($agentId, $prevAssigned);
        });
    }


    /**
     * Release customer back to pool (Unassign)
     * Rule: Set hold_until_date, add logic for distribution limit
     */
    public function releaseToPool($customerId, $reason = 'manual') {
        $this->pdo->beginTransaction();

        try {
            $stmt = $this->pdo->prepare("SELECT assigned_to, current_basket_key, previous_assigned_to, distribution_count FROM customers WHERE id = ?");
            $stmt->execute([$customerId]);
            $customer = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$customer) return false;

            // Get config for hold period
            // Default: 0 hold days (immediate), 0 max dist (unlimited)
            $holdDays = 0; 
            $maxDist = 0;
            $maxDistTarget = null;
            $reevaluateOnFail = false; // New flag for re-evaluation

            if ($customer['current_basket_key']) {
                $stmt = $this->pdo->prepare("SELECT hold_days_before_redistribute, max_distribution_count, on_fail_basket_key, on_max_dist_basket_key, on_fail_reevaluate FROM basket_config WHERE basket_key = ? AND company_id = ?");
                $stmt->execute([$customer['current_basket_key'], $this->companyId]);
                $config = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($config) {
                    $holdDays = (int)($config['hold_days_before_redistribute'] ?? 0);
                    $maxDist = (int)($config['max_distribution_count'] ?? 0);
                    $maxDistTarget = $config['on_max_dist_basket_key'];
                    $reevaluateOnFail = (bool)($config['on_fail_reevaluate'] ?? 0);
                }
            }

            // [New Logic] Special handling for 'upsell_waiting' exit
            // ... (keep generic logic for upsell return) ...
             if ($customer['current_basket_key'] === 'upsell_waiting' && !empty($customer['assigned_to'])) {
                 return $this->performTransition($customerId, 'month_1_2', 'upsell_return_owner');
             }

            // Update assigned history
            $prevAssigned = json_decode($customer['previous_assigned_to'] ?? '[]', true);
            if ($customer['assigned_to'] && !in_array($customer['assigned_to'], $prevAssigned)) {
                $prevAssigned[] = $customer['assigned_to'];
            }

            $updates = [
                'assigned_to' => null,
                'previous_assigned_to' => json_encode($prevAssigned),
                'hold_until_date' => $holdDays > 0 ? date('Y-m-d H:i:s', strtotime("+$holdDays days")) : null
            ];
            
            // Increment count on release
            $newDistCount = $customer['distribution_count'] + 1;
            $updates['distribution_count'] = $newDistCount;

            // Check if we need to move basket (only if maxDist > 0 AND target is defined)
            if ($maxDist > 0 && $newDistCount >= $maxDist) {
                // Determine target basket
                $targetBasket = null;
                
                if ($reevaluateOnFail) {
                    // Re-evaluate: find matching basket based on customer's current data
                    $targetBasket = $this->findMatchingBasket($customerId);
                } else {
                    $targetBasket = $maxDistTarget;
                }
                
                if ($targetBasket) {
                    $updates['current_basket_key'] = $targetBasket;
                    $updates['basket_entered_date'] = date('Y-m-d H:i:s');
                    $updates['distribution_count'] = 0; // Reset count for new basket
                    
                    // Log transition
                    $stmt = $this->pdo->prepare("INSERT INTO basket_transition_log (customer_id, from_basket_key, to_basket_key, transition_type, notes) VALUES (?, ?, ?, 'fail', ?)");
                    $stmt->execute([$customerId, $customer['current_basket_key'], $targetBasket, $reevaluateOnFail ? 'Re-evaluated to matching basket' : 'Max distribution count reached']);
                }
            }

            // Execute Updates
            $sql = "UPDATE customers SET ";
            $params = [];
            foreach ($updates as $key => $val) {
                $sql .= "$key = ?, ";
                $params[] = $val;
            }
            $sql = rtrim($sql, ", ") . " WHERE id = ?";
            $params[] = $customerId;
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);

            $this->pdo->commit();
            return true;

        } catch (Exception $e) {
            $this->pdo->rollBack();
            return false;
        }
    }
}
