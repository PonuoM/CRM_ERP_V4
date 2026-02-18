<?php
/**
 * BasketRoutingServiceV2 - Event-Driven Basket Routing
 * 
 * Unified service that handles ALL basket transitions based on order status changes.
 * Replaces the following cronjobs:
 * - process_picking_baskets.php
 * - process_upsell_51_exit.php
 * - process_upsell_by_others.php
 * - process_upsell_distribution.php
 * - upsell_exit_handler.php
 * 
 * The only remaining cronjob is basket_aging_cron.php for aging/timeout transitions.
 * 
 * @author AI Assistant
 * @date 2026-02-05
 */

class BasketRoutingServiceV2 {
    /** @var PDO */
    private $pdo;
    
    // ===========================
    // BASKET CONSTANTS
    // ===========================
    private const BASKET_NEW_CUSTOMER = 38;        // ลูกค้าใหม่ (ขายไม่ได้)
    private const BASKET_PERSONAL_1_2M = 39;       // ลูกค้า 1-2 เดือน (ขายได้)
    private const BASKET_UPSELL_DASHBOARD = 51;    // Upsell Dashboard (รอ Telesale ขาย)
    private const BASKET_NEW_CUSTOMER_DIST = 52;   // ลูกค้าใหม่ Distribution
    private const BASKET_UPSELL_DIST = 53;         // Upsell Distribution (ไม่มี owner)
    
    // Telesale role IDs
    private const TELESALE_ROLES = [6, 7];
    
    public function __construct(PDO $pdo) {
        $this->pdo = $pdo;
    }
    
    // ===========================
    // MAIN ENTRY POINT
    // ===========================
    
    /**
     * Handle order status change - Main entry point
     * 
     * This method is called from API hooks when order_status changes.
     * It determines the appropriate basket transition based on:
     * - New order status (Pending, Picking, etc.)
     * - Customer's current basket
     * - Creator role (Telesale vs Admin)
     * - Customer's assigned_to status
     * 
     * @param string $orderId Order ID that triggered the change
     * @param string $newStatus New order status ('Pending', 'Picking', 'Shipping', etc.)
     * @param int $triggeredBy User ID who triggered the change
     * @return array|null Transition result or null if no transition needed
     */
    public function handleOrderStatusChange(string $orderId, string $newStatus, int $triggeredBy): ?array {
        // 🔍 DEBUG: Log all calls
        error_log("[BasketRoutingV2] CALLED: orderId=$orderId, status=$newStatus, triggeredBy=$triggeredBy");
        
        try {
            // 1. Load order + customer data
            $order = $this->getOrderWithCustomer($orderId);
            if (!$order) {
                error_log("[BasketRoutingV2] ABORT: Order not found for ID: $orderId");
                return null;
            }
            
            $customer = $order['customer'];
            error_log("[BasketRoutingV2] Loaded: customer_id={$customer['customer_id']}, basket={$customer['current_basket_key']}, assigned_to={$customer['assigned_to']}");
            
            // 2. Route based on status
            switch ($newStatus) {
                case 'Pending':
                    error_log("[BasketRoutingV2] Routing to handlePendingOrder");
                    return $this->handlePendingOrder($order, $customer, $triggeredBy);
                    
                case 'Picking':
                case 'Shipping':
                    error_log("[BasketRoutingV2] Routing to handlePickingOrder");
                    return $this->handlePickingOrder($order, $customer, $triggeredBy);
                    
                default:
                    error_log("[BasketRoutingV2] ABORT: Status '$newStatus' not handled");
                    return null;
            }
        } catch (Exception $e) {
            error_log("[BasketRoutingV2] ERROR: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
    
    // ===========================
    // STATUS HANDLERS
    // ===========================
    
    /**
     * Handle Pending order creation
     * 
     * Business Rules:
     * - A1: Admin creates + No owner → 53 (Upsell Distribution)
     * - A2: Admin creates + Has owner → 51 (Upsell Dashboard)
     * - A3: Telesale creates → No action (wait for Picking)
     */
    private function handlePendingOrder(array $order, array $customer, int $triggeredBy): ?array {
        $creatorRole = $this->getUserRole($order['creator_id']);
        $isTelesale = in_array($creatorRole, self::TELESALE_ROLES);
        $hasOwner = !empty($customer['assigned_to']) && $customer['assigned_to'] > 0;
        $currentBasket = (int)($customer['current_basket_key'] ?? 0);
        
        // 🔍 DEBUG
        error_log("[BasketRoutingV2] handlePendingOrder: creator_id={$order['creator_id']}, role=$creatorRole, isTelesale=" . ($isTelesale ? 'YES' : 'NO') . ", hasOwner=" . ($hasOwner ? 'YES' : 'NO') . ", currentBasket=$currentBasket");
        
        // Rule A3: Telesale สร้าง order → ไม่ทำอะไร (รอ Picking)
        if ($isTelesale) {
            error_log("[BasketRoutingV2] handlePendingOrder: SKIPPED - Telesale created, wait for Picking");
            return null;
        }
        
        // Rule A1: Admin สร้าง + ไม่มี owner → 53
        if (!$hasOwner) {
            // ถ้าอยู่ถัง 53 อยู่แล้ว ไม่ต้องย้าย
            if ($currentBasket === self::BASKET_UPSELL_DIST) {
                error_log("[BasketRoutingV2] handlePendingOrder: SKIPPED - Already in basket 53");
                return null;
            }
            
            error_log("[BasketRoutingV2] handlePendingOrder: EXECUTE - Moving to basket 53");
            return $this->transitionTo(
                $customer['customer_id'],
                self::BASKET_UPSELL_DIST,
                'pending_admin_unowned',
                $order['id'],
                null,
                null,
                "Admin created order #{$order['id']} - no owner, sent to upsell distribution"
            );
        }
        
        // Rule A2: Admin สร้าง + มี owner → 51
        // แต่ถ้าอยู่ถัง 51 อยู่แล้ว ไม่ต้องย้าย
        if ($currentBasket !== self::BASKET_UPSELL_DASHBOARD) {
            error_log("[BasketRoutingV2] handlePendingOrder: EXECUTE - Moving to basket 51");
            return $this->transitionTo(
                $customer['customer_id'],
                self::BASKET_UPSELL_DASHBOARD,
                'pending_admin_owned',
                $order['id'],
                $customer['assigned_to'],
                $customer['assigned_to'], // Keep same owner
                "Admin created order #{$order['id']} - has owner #{$customer['assigned_to']}, sent to upsell"
            );
        }
        
        error_log("[BasketRoutingV2] handlePendingOrder: SKIPPED - Has owner but already in basket 51");
        return null;
    }
    
    /**
     * Handle Picking/Shipping order status
     * 
     * Business Rules:
     * - P1: Basket 51 + Telesale sold → 39 (ขายได้)
     * - P2: Basket 51 + No Telesale → 38 (ขายไม่ได้)
     * - P3: Basket 53 + Not assigned yet → 52
     * - P4: Has owner + Telesale sold → 39
     * - P5: Has owner + Admin sold → 51
     * - P6: No owner + Telesale sold → 39 + Assign owner
     * - P7: No owner + Admin sold → 52
     */
    private function handlePickingOrder(array $order, array $customer, int $triggeredBy): ?array {
        $currentBasket = (int)($customer['current_basket_key'] ?? 0);
        $hasOwner = !empty($customer['assigned_to']) && $customer['assigned_to'] > 0;
        $assignedTo = $customer['assigned_to'];
        
        $creatorRole = $this->getUserRole($order['creator_id']);
        $isTelesale = in_array($creatorRole, self::TELESALE_ROLES);
        
        // ===== RACE CONDITION CHECK =====
        // If there's a NEWER order for the same customer that already Picking/Shipping/Closed,
        // skip routing for this older order to prevent "ping-pong" basket changes
        if ($this->hasNewerOrderAlreadyProcessed($customer['customer_id'], $order['id'], $order['order_date'])) {
            error_log("[BasketRoutingV2] SKIPPED: Newer order already processed for customer #{$customer['customer_id']}");
            return [
                'success' => true,
                'customer_id' => $customer['customer_id'],
                'skipped' => true,
                'reason' => 'Newer order already processed basket routing',
                'order_id' => $order['id']
            ];
        }
        
        $hasTelesaleInvolvement = $this->checkTelesaleInvolvement($customer['customer_id']);
        
        // === BASKET 51 (Upsell Dashboard) ===
        // Rule P1 & P2
        if ($currentBasket === self::BASKET_UPSELL_DASHBOARD) {
            $preserveDate = false;
            
            if ($hasTelesaleInvolvement) {
                // P1: Telesale involvement → 39 (ขายได้)
                $target = self::BASKET_PERSONAL_1_2M;
                $type = 'picking_upsell_sold';
                $status = 'ขายได้';
            } else {
                // P2: ไม่มี Telesale → เช็คว่ามาจาก 39 หรือไม่
                $cameFrom39 = $this->getPreviousBasketBefore51($customer['customer_id']);
                if ($cameFrom39) {
                    // P2-A: มาจาก 39 → กลับ 39 โดยไม่ reset วัน
                    $target = self::BASKET_PERSONAL_1_2M;
                    $type = 'picking_upsell_return_39';
                    $status = 'กลับ 39 (มาจากเดิม)';
                    $preserveDate = true;
                } else {
                    // P2-B: มาจาก basket อื่น → 38 (ขายไม่ได้)
                    $target = self::BASKET_NEW_CUSTOMER;
                    $type = 'picking_upsell_not_sold';
                    $status = 'ขายไม่ได้';
                }
            }
            
            return $this->transitionTo(
                $customer['customer_id'],
                $target,
                $type,
                $order['id'],
                $assignedTo,
                $assignedTo,
                "$status - Order #{$order['id']} picked",
                $preserveDate
            );
        }
        
        // === BASKET 53 (Upsell Distribution) ===
        // Rule P3: ยังไม่ได้แจก + Picking → 52
        if ($currentBasket === self::BASKET_UPSELL_DIST) {
            return $this->transitionTo(
                $customer['customer_id'],
                self::BASKET_NEW_CUSTOMER_DIST,
                'picking_dist_to_pool',
                $order['id'],
                null,
                null,
                "Basket 53 → 52: Order #{$order['id']} picked before assignment"
            );
        }
        
        // === HAS OWNER ===
        if ($hasOwner) {
            // Rule P4: Telesale ขายลูกค้าตัวเอง → 39
            if ($isTelesale) {
                // ถ้าอยู่ 39 อยู่แล้ว ก็ refresh basket_entered_date
                if ($currentBasket === self::BASKET_PERSONAL_1_2M) {
                    $this->refreshBasketDate($customer['customer_id']);
                    return null;
                }
                
                return $this->transitionTo(
                    $customer['customer_id'],
                    self::BASKET_PERSONAL_1_2M,
                    'picking_telesale_own',
                    $order['id'],
                    $assignedTo,
                    $assignedTo,
                    "Telesale #{$order['creator_id']} sold to owned customer"
                );
            }
            
            // Rule P5: Admin ขาย + มี owner → 51 (ถ้ายังไม่อยู่ 51)
            if ($currentBasket !== self::BASKET_UPSELL_DASHBOARD) {
                return $this->transitionTo(
                    $customer['customer_id'],
                    self::BASKET_UPSELL_DASHBOARD,
                    'picking_admin_to_upsell',
                    $order['id'],
                    $assignedTo,
                    $assignedTo,
                    "Admin sold but customer has owner #{$assignedTo} - sent to upsell for follow-up"
                );
            }
            return null;
        }
        
        // === NO OWNER (Distribution) ===
        // Rule P6: Telesale ขายลูกค้า Distribution → 39 + Assign owner
        if ($isTelesale) {
            $this->assignOwner($customer['customer_id'], $order['creator_id']);
            
            return $this->transitionTo(
                $customer['customer_id'],
                self::BASKET_PERSONAL_1_2M,
                'picking_telesale_from_dist',
                $order['id'],
                null,
                $order['creator_id'], // New owner = creator
                "Telesale #{$order['creator_id']} sold to unassigned customer - now owner"
            );
        }
        
        // Rule P7: Admin ขาย + ไม่มี owner → 52
        return $this->transitionTo(
            $customer['customer_id'],
            self::BASKET_NEW_CUSTOMER_DIST,
            'picking_admin_no_owner',
            $order['id'],
            null,
            null,
            "Admin sold to unassigned customer - sent to new customer distribution"
        );
    }
    
    // ===========================
    // HELPER METHODS
    // ===========================
    
    /**
     * Get order with customer data
     */
    private function getOrderWithCustomer(string $orderId): ?array {
        $stmt = $this->pdo->prepare("
            SELECT 
                o.id,
                o.customer_id,
                o.order_status,
                o.order_date,
                o.creator_id,
                c.customer_id as cust_id,
                c.first_name,
                c.last_name,
                c.current_basket_key,
                c.assigned_to,
                c.basket_entered_date
            FROM orders o
            JOIN customers c ON o.customer_id = c.customer_id OR o.customer_id = c.customer_ref_id
            WHERE o.id = ?
        ");
        $stmt->execute([$orderId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$row) {
            return null;
        }
        
        return [
            'id' => $row['id'],
            'customer_id' => $row['customer_id'],
            'order_status' => $row['order_status'],
            'order_date' => $row['order_date'],
            'creator_id' => $row['creator_id'],
            'customer' => [
                'customer_id' => $row['cust_id'],
                'first_name' => $row['first_name'],
                'last_name' => $row['last_name'],
                'current_basket_key' => $row['current_basket_key'],
                'assigned_to' => $row['assigned_to'],
                'basket_entered_date' => $row['basket_entered_date']
            ]
        ];
    }
    
    /**
     * Get user's role ID
     */
    private function getUserRole(int $userId): ?int {
        $stmt = $this->pdo->prepare("SELECT role_id FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $result = $stmt->fetchColumn();
        return $result !== false ? (int)$result : null;
    }
    
    /**
     * Check if there's a NEWER order for this customer that has already been processed (Picking/Shipping/Closed)
     * Used to prevent "ping-pong" basket transitions when multiple orders are processed
     * 
     * @param int $customerId The customer ID
     * @param string $currentOrderId The current order being processed
     * @param string $currentOrderDate The order_date of the current order
     * @return bool True if a newer order already exists in Picking+ status
     */
    private function hasNewerOrderAlreadyProcessed(int $customerId, string $currentOrderId, string $currentOrderDate): bool {
        $stmt = $this->pdo->prepare("
            SELECT COUNT(*) FROM orders 
            WHERE customer_id = ?
              AND id != ?
              AND order_date > ?
              AND order_status IN ('Picking', 'Shipping', 'Closed', 'Delivered')
        ");
        $stmt->execute([$customerId, $currentOrderId, $currentOrderDate]);
        $count = (int)$stmt->fetchColumn();
        
        if ($count > 0) {
            error_log("[BasketRoutingV2] hasNewerOrderAlreadyProcessed: Found $count newer orders for customer $customerId");
        }
        
        return $count > 0;
    }
    
    /**
     * 🔥 CRITICAL: Check if Telesale was involved in ANY order for this customer
     * 
     * KEY POINT: เมื่อ Order ใด Order หนึ่งเป็น Picking → ต้องเช็ค "ทุก Order" ของลูกค้า
     * รวมถึง Orders ที่ยังเป็น Pending ด้วย!
     * 
     * Scenario ที่ต้อง handle:
     * - Admin สร้าง Order A (Pending, จัดส่งวันนี้) → ลูกค้าไป 51
     * - Telesale สร้าง Order B (Pending, จัดส่งพรุ่งนี้) → ยัง Pending
     * - Order A เป็น Picking → TRIGGER!
     * - ต้องเช็คทั้ง Order A และ B → พบว่า Order B เป็นของ Telesale → "ขายได้" ✅
     * 
     * @param int $customerId Customer ID to check
     * @return bool True if Telesale was involved
     */
    private function checkTelesaleInvolvement(int $customerId): bool {
        // === กรณี A: Telesale สร้าง Order ใหม่ ===
        // เช็คทั้ง Pending และ Picking เพราะ Telesale อาจขายพ่วงแต่ยังไม่ถึงวันส่ง
        $orderStmt = $this->pdo->prepare("
            SELECT COUNT(*) FROM orders o
            JOIN users u ON o.creator_id = u.id
            WHERE o.customer_id = ?
              AND o.order_status IN ('Pending', 'Picking', 'Shipping')
              AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
              AND u.role_id IN (6, 7)
        ");
        $orderStmt->execute([$customerId]);
        $telesaleOrders = (int)$orderStmt->fetchColumn();
        
        if ($telesaleOrders > 0) {
            return true;
        }
        
        // === กรณี B: Telesale เพิ่ม Items เข้า Order ที่ Admin สร้าง ===
        $itemStmt = $this->pdo->prepare("
            SELECT COUNT(*) FROM order_items oi
            JOIN orders o ON oi.parent_order_id = o.id
            JOIN users u ON oi.creator_id = u.id
            WHERE o.customer_id = ?
              AND o.order_status IN ('Pending', 'Picking', 'Shipping')
              AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
              AND u.role_id IN (6, 7)
        ");
        $itemStmt->execute([$customerId]);
        $telesaleItems = (int)$itemStmt->fetchColumn();
        
        return $telesaleItems > 0;
    }
    
    /**
     * Assign owner to customer
     */
    private function assignOwner(int $customerId, int $newOwnerId): bool {
        $stmt = $this->pdo->prepare("
            UPDATE customers 
            SET assigned_to = ?,
                date_assigned = NOW()
            WHERE customer_id = ?
        ");
        return $stmt->execute([$newOwnerId, $customerId]);
    }
    
    /**
     * Refresh basket_entered_date without changing basket
     */
    private function refreshBasketDate(int $customerId): bool {
        $stmt = $this->pdo->prepare("
            UPDATE customers 
            SET basket_entered_date = NOW()
            WHERE customer_id = ?
        ");
        return $stmt->execute([$customerId]);
    }
    
    /**
     * Check if customer came from basket 39 before entering basket 51
     * ดู transition log ล่าสุดที่เข้า 51 ว่ามาจาก basket ไหน
     * 
     * @param int $customerId Customer ID
     * @return bool True if came from basket 39 (BASKET_PERSONAL_1_2M)
     */
    private function getPreviousBasketBefore51(int $customerId): bool {
        $stmt = $this->pdo->prepare("
            SELECT from_basket_key FROM basket_transition_log
            WHERE customer_id = ? AND to_basket_key = ?
            ORDER BY id DESC LIMIT 1
        ");
        $stmt->execute([$customerId, self::BASKET_UPSELL_DASHBOARD]);
        $fromBasket = $stmt->fetchColumn();
        
        if ($fromBasket === false) {
            return false;
        }
        
        return (int)$fromBasket === self::BASKET_PERSONAL_1_2M;
    }
    
    // ===========================
    // TRANSITION EXECUTOR
    // ===========================
    
    /**
     * Execute basket transition with full logging
     * 
     * @param int $customerId Customer ID
     * @param int $targetBasket Target basket ID
     * @param string $transitionType Type for logging
     * @param string|int $orderId Order that triggered this
     * @param int|null $assignedToOld Old owner (before)
     * @param int|null $assignedToNew New owner (after)
     * @param string|null $notes Additional notes
     * @return array Result with success status and details
     */
    private function transitionTo(
        int $customerId,
        int $targetBasket,
        string $transitionType,
        $orderId,
        ?int $assignedToOld,
        ?int $assignedToNew,
        ?string $notes = null,
        bool $preserveDate = false
    ): array {
        $this->pdo->beginTransaction();
        
        try {
            // Get current state
            $stmt = $this->pdo->prepare("
                SELECT current_basket_key, assigned_to 
                FROM customers 
                WHERE customer_id = ? 
                FOR UPDATE
            ");
            $stmt->execute([$customerId]);
            $current = $stmt->fetch(PDO::FETCH_ASSOC);
            
            $fromBasket = $current['current_basket_key'] ?? null;
            
            // 🔍 DEBUG
            error_log("[BasketRoutingV2] transitionTo: customer=$customerId, from=$fromBasket, to=$targetBasket, type=$transitionType, order=$orderId, preserveDate=" . ($preserveDate ? 'true' : 'false'));
            
            // Update customer basket
            if ($preserveDate) {
                // ไม่ reset basket_entered_date (เช่น กลับ 39 จาก 51)
                $updateStmt = $this->pdo->prepare("
                    UPDATE customers 
                    SET current_basket_key = ?
                    WHERE customer_id = ?
                ");
            } else {
                $updateStmt = $this->pdo->prepare("
                    UPDATE customers 
                    SET current_basket_key = ?,
                        basket_entered_date = NOW()
                    WHERE customer_id = ?
                ");
            }
            $updateResult = $updateStmt->execute([$targetBasket, $customerId]);
            error_log("[BasketRoutingV2] UPDATE result: " . ($updateResult ? 'SUCCESS' : 'FAILED'));
            
            // Log transition with new columns
            $logStmt = $this->pdo->prepare("
                INSERT INTO basket_transition_log 
                (customer_id, from_basket_key, to_basket_key, assigned_to_old, assigned_to_new, 
                 transition_type, triggered_by, order_id, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, NOW())
            ");
            
            $logParams = [
                $customerId,
                $fromBasket,
                $targetBasket,
                $assignedToOld,
                $assignedToNew,
                $transitionType,
                $orderId,
                $notes
            ];
            error_log("[BasketRoutingV2] INSERT params: " . json_encode($logParams));
            
            $logResult = $logStmt->execute($logParams);
            
            if (!$logResult) {
                $errorInfo = $logStmt->errorInfo();
                error_log("[BasketRoutingV2] INSERT FAILED: " . json_encode($errorInfo));
            } else {
                error_log("[BasketRoutingV2] INSERT SUCCESS: log_id=" . $this->pdo->lastInsertId());
            }
            
            $this->pdo->commit();
            error_log("[BasketRoutingV2] COMMIT SUCCESS");
            
            return [
                'success' => true,
                'customer_id' => $customerId,
                'from_basket' => $fromBasket,
                'to_basket' => $targetBasket,
                'transition_type' => $transitionType,
                'assigned_to_old' => $assignedToOld,
                'assigned_to_new' => $assignedToNew,
                'order_id' => $orderId,
                'notes' => $notes
            ];
            
        } catch (Exception $e) {
            $this->pdo->rollBack();
            error_log("[BasketRoutingV2] TRANSACTION ERROR: " . $e->getMessage());
            throw $e;
        }
    }
    
    // ===========================
    // AGING HANDLER (for cron)
    // ===========================
    
    /**
     * Process aging customers (replaces monthly_basket_transfer.php)
     * 
     * This method is called by basket_aging_cron.php daily.
     * It handles customers who have exceeded their fail_after_days in their current basket.
     * 
     * @param bool $dryRun If true, only simulate without making changes
     * @return array Results summary
     */
    public function processAgingCustomers(bool $dryRun = false): array {
        $results = [
            'processed' => 0,
            'moved' => 0,
            'errors' => 0,
            'details' => []
        ];
        
        // Get basket configurations with fail rules
        $configStmt = $this->pdo->query("
            SELECT id, basket_key, basket_name, fail_after_days, 
                   on_fail_basket_key, on_fail_reevaluate, target_page
            FROM basket_config
            WHERE fail_after_days IS NOT NULL 
              AND fail_after_days > 0
              AND is_active = 1
        ");
        $configs = $configStmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($configs as $config) {
            // Find customers exceeding fail_after_days
            $stmt = $this->pdo->prepare("
                SELECT c.customer_id, c.current_basket_key, c.assigned_to,
                       DATEDIFF(NOW(), c.basket_entered_date) as days_in_basket
                FROM customers c
                WHERE c.current_basket_key = ?
                  AND c.basket_entered_date IS NOT NULL
                  AND DATEDIFF(NOW(), c.basket_entered_date) >= ?
            ");
            $stmt->execute([$config['id'], $config['fail_after_days']]);
            $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            foreach ($customers as $customer) {
                $results['processed']++;
                
                // Determine target basket
                $targetBasket = null;
                if ($config['on_fail_reevaluate']) {
                    // Re-evaluate based on days since last order
                    $targetBasket = $this->findMatchingBasket($customer['customer_id']);
                }
                
                if (!$targetBasket && $config['on_fail_basket_key']) {
                    $targetBasket = $config['on_fail_basket_key'];
                }
                
                if (!$targetBasket) {
                    continue;
                }
                
                if (!$dryRun) {
                    try {
                        $this->transitionTo(
                            $customer['customer_id'],
                            (int)$targetBasket,
                            'aging_timeout',
                            0, // No order triggered this
                            $customer['assigned_to'],
                            $customer['assigned_to'],
                            "Exceeded {$config['fail_after_days']} days in basket {$config['basket_name']}"
                        );
                        $results['moved']++;
                    } catch (Exception $e) {
                        $results['errors']++;
                        $results['details'][] = [
                            'customer_id' => $customer['customer_id'],
                            'error' => $e->getMessage()
                        ];
                    }
                } else {
                    $results['moved']++;
                    $results['details'][] = [
                        'customer_id' => $customer['customer_id'],
                        'from' => $customer['current_basket_key'],
                        'to' => $targetBasket,
                        'dry_run' => true
                    ];
                }
            }
        }
        
        return $results;
    }
    
    /**
     * Find matching basket based on days since last order
     */
    private function findMatchingBasket(int $customerId): ?int {
        $stmt = $this->pdo->prepare("
            SELECT DATEDIFF(NOW(), COALESCE(last_order_date, date_registered)) as days_since
            FROM customers 
            WHERE customer_id = ?
        ");
        $stmt->execute([$customerId]);
        $daysSince = (int)$stmt->fetchColumn();
        
        // Route based on days
        if ($daysSince < 180) {
            return null; // Keep in current or use on_fail_basket_key
        } elseif ($daysSince >= 180 && $daysSince <= 365) {
            return 44; // mid_6_12m
        } elseif ($daysSince >= 366 && $daysSince <= 1095) {
            return 45; // mid_1_3y
        } else {
            return 50; // ancient
        }
    }
}
