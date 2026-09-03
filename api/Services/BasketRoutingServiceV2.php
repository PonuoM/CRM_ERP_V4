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

class BasketRoutingServiceV2
{
    /** @var array<string,int>|null key -> id ของ basket_config (โหลดครั้งเดียวต่อ request) */
    private $basketKeyCache = null;

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

    public function __construct(PDO $pdo)
    {
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
    public function handleOrderStatusChange(string $orderId, string $newStatus, int $triggeredBy): ?array
    {
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

            // Skip routing for blocked customers — basket 55 must not be overwritten
            if (!empty($customer['is_blocked'])) {
                error_log("[BasketRoutingV2] ABORT: Customer #{$customer['customer_id']} is blocked, skipping basket routing");
                return null;
            }

            // 2. Route based on status
            switch ($newStatus) {
                case 'Pending':
                    error_log("[BasketRoutingV2] Routing to handlePendingOrder");
                    return $this->handlePendingOrder($order, $customer, $triggeredBy);

                case 'Picking':
                case 'Shipping':
                    error_log("[BasketRoutingV2] Routing to handlePickingOrder");
                    return $this->handlePickingOrder($order, $customer, $triggeredBy);

                case 'Cancelled':
                case 'Returned':
                    error_log("[BasketRoutingV2] Routing to handleCancelledOrder");
                    return $this->handleCancelledOrder($order, $customer, $triggeredBy);

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
    private function handlePendingOrder(array $order, array $customer, int $triggeredBy): ?array
    {
        $creatorRole = $this->getUserRole($order['creator_id']);
        $isTelesale = in_array($creatorRole, self::TELESALE_ROLES);
        $hasOwner = !empty($customer['assigned_to']) && $customer['assigned_to'] > 0;
        $currentBasket = (int) ($customer['current_basket_key'] ?? 0);

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
    private function handlePickingOrder(array $order, array $customer, int $triggeredBy): ?array
    {
        $currentBasket = (int) ($customer['current_basket_key'] ?? 0);
        $hasOwner = !empty($customer['assigned_to']) && $customer['assigned_to'] > 0;
        $assignedTo = $customer['assigned_to'];

        $creatorRole = $this->getUserRole($order['creator_id']);
        $isTelesale = in_array($creatorRole, self::TELESALE_ROLES);

        // ===== DUPLICATE PROCESSING CHECK =====
        // If this specific order has already triggered a picking/shipping transition,
        // skip routing to prevent ping-pong transitions (e.g. from Picking -> Shipping)
        if ($this->hasOrderAlreadyProcessedRouting($order['id'])) {
            error_log("[BasketRoutingV2] SKIPPED: Order #{$order['id']} already processed picking routing");
            return [
                'success' => true,
                'customer_id' => $customer['customer_id'],
                'skipped' => true,
                'reason' => 'Order already processed picking basket routing',
                'order_id' => $order['id']
            ];
        }

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

    /**
     * Handle Cancelled/Returned order status
     * 
     * Business Rules:
     * - C1: Basket 51 -> 39 (if came from 39) or 38 (New Customer Pool)
     * - C2: Basket 53 -> 52 (New Customer Dist)
     * - Other baskets -> ignored
     * - Do NOT clear assigned_to
     */
    private function handleCancelledOrder(array $order, array $customer, int $triggeredBy): ?array
    {
        $currentBasket = (int) ($customer['current_basket_key'] ?? 0);
        $assignedTo = $customer['assigned_to'] ? (int) $customer['assigned_to'] : null;
        $statusStr = $order['order_status']; // 'Cancelled' or 'Returned'

        // Prevent ping-pong if there's a newer successful order
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

        // === BASKET 51 (Upsell Dashboard) ===
        if ($currentBasket === self::BASKET_UPSELL_DASHBOARD) {
            $cameFrom39 = $this->getPreviousBasketBefore51($customer['customer_id']);
            $preserveDate = false;

            if ($cameFrom39) {
                // Return to 39 without resetting date
                $target = self::BASKET_PERSONAL_1_2M;
                $type = 'cancelled_upsell_return_39';
                $statusMsg = "กลับ 39 (มาจากเดิม)";
                $preserveDate = true;
            } else {
                // Drop to 38 (Pool)
                $target = self::BASKET_NEW_CUSTOMER;
                $type = 'cancelled_upsell_to_pool';
                $statusMsg = "ตกตะกร้า 38";
            }

            return $this->transitionTo(
                $customer['customer_id'],
                $target,
                $type,
                $order['id'],
                $assignedTo,
                $assignedTo, // Keep the same owner
                "Order #{$order['id']} $statusStr - $statusMsg",
                $preserveDate
            );
        }

        // === BASKET 53 (Upsell Distribution) ===
        if ($currentBasket === self::BASKET_UPSELL_DIST) {
            return $this->transitionTo(
                $customer['customer_id'],
                self::BASKET_NEW_CUSTOMER_DIST,
                'cancelled_dist_to_pool',
                $order['id'],
                $assignedTo,
                $assignedTo, // Keep the same owner
                "Basket 53 → 52: Order #{$order['id']} $statusStr"
            );
        }

        // Ignore for other baskets
        error_log("[BasketRoutingV2] SKIPPED: $statusStr order for basket $currentBasket requires no action");
        return null;
    }

    // ===========================
    // HELPER METHODS
    // ===========================

    /**
     * Get order with customer data
     */
    private function getOrderWithCustomer(string $orderId): ?array
    {
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
                c.basket_entered_date,
                c.is_blocked
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
                'basket_entered_date' => $row['basket_entered_date'],
                'is_blocked' => $row['is_blocked'] ?? 0
            ]
        ];
    }

    /**
     * Get user's role ID
     * Falls back to role text field if role_id is NULL
     */
    private function getUserRole(int $userId): ?int
    {
        $stmt = $this->pdo->prepare("SELECT role_id, role FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row)
            return null;

        // ถ้ามี role_id ใช้เลย
        if ($row['role_id'] !== null) {
            return (int) $row['role_id'];
        }

        // Fallback: ใช้ role (text) เพื่อ map เป็น role_id
        $roleText = strtolower($row['role'] ?? '');
        if ($roleText === 'telesale') {
            error_log("[BasketRoutingV2] WARNING: User $userId has role_id=NULL but role='$roleText' - using fallback role_id=7");
            return 7; // Telesale role ID
        }
        if ($roleText === 'supervisor telesale') {
            error_log("[BasketRoutingV2] WARNING: User $userId has role_id=NULL but role='$roleText' - using fallback role_id=6");
            return 6; // Supervisor Telesale role ID
        }

        return null;
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
    private function hasNewerOrderAlreadyProcessed(int $customerId, string $currentOrderId, string $currentOrderDate): bool
    {
        $stmt = $this->pdo->prepare("
            SELECT COUNT(*) FROM orders 
            WHERE customer_id = ?
              AND id != ?
              AND order_date > ?
              AND order_status IN ('Picking', 'Shipping', 'Closed', 'Delivered')
        ");
        $stmt->execute([$customerId, $currentOrderId, $currentOrderDate]);
        $count = (int) $stmt->fetchColumn();

        if ($count > 0) {
            error_log("[BasketRoutingV2] hasNewerOrderAlreadyProcessed: Found $count newer orders for customer $customerId");
        }

        return $count > 0;
    }

    /**
     * Check if this specific order has already triggered a picking/shipping basket routing transition
     * 
     * @param string $orderId The order ID
     * @return bool True if a picking transition already exists for this order
     */
    private function hasOrderAlreadyProcessedRouting(string $orderId): bool
    {
        $stmt = $this->pdo->prepare("
            SELECT COUNT(*) FROM basket_transition_log 
            WHERE order_id = ? 
              AND (transition_type LIKE 'picking_%' OR transition_type = '')
        ");
        $stmt->execute([$orderId]);
        $count = (int) $stmt->fetchColumn();

        if ($count > 0) {
            error_log("[BasketRoutingV2] hasOrderAlreadyProcessedRouting: Order $orderId already processed in transition log");
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
    private function checkTelesaleInvolvement(int $customerId): bool
    {
        // === กรณี A: Telesale สร้าง Order ใหม่ ===
        // เช็คทั้ง Pending และ Picking เพราะ Telesale อาจขายพ่วงแต่ยังไม่ถึงวันส่ง
        $orderStmt = $this->pdo->prepare("
            SELECT COUNT(*) FROM orders o
            JOIN users u ON o.creator_id = u.id
            WHERE o.customer_id = ?
              AND o.order_status IN ('Pending', 'Picking', 'Shipping')
              AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
              AND (u.role_id IN (6, 7) OR (u.role_id IS NULL AND LOWER(u.role) IN ('telesale', 'supervisor telesale')))
        ");
        $orderStmt->execute([$customerId]);
        $telesaleOrders = (int) $orderStmt->fetchColumn();

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
              AND (u.role_id IN (6, 7) OR (u.role_id IS NULL AND LOWER(u.role) IN ('telesale', 'supervisor telesale')))
        ");
        $itemStmt->execute([$customerId]);
        $telesaleItems = (int) $itemStmt->fetchColumn();

        return $telesaleItems > 0;
    }

    /**
     * Assign owner to customer
     */
    private function assignOwner(int $customerId, int $newOwnerId): bool
    {
        set_audit_context($this->pdo, 'basket_routing_v2/assign_owner');
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
    private function refreshBasketDate(int $customerId): bool
    {
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
    private function getPreviousBasketBefore51(int $customerId): bool
    {
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

        return (int) $fromBasket === self::BASKET_PERSONAL_1_2M;
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
        // Check if already in a transaction (e.g. called from batch_process_export)
        $ownTransaction = !$this->pdo->inTransaction();
        if ($ownTransaction) {
            $this->pdo->beginTransaction();
        }

        try {
            set_audit_context($this->pdo, 'basket_routing_v2/' . $transitionType);
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

            if ($ownTransaction) {
                $this->pdo->commit();
                error_log("[BasketRoutingV2] COMMIT SUCCESS");
            }

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
            if ($ownTransaction) {
                $this->pdo->rollBack();
            }
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
    public function processAgingCustomers(bool $dryRun = false): array
    {
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
                  AND COALESCE(c.is_blocked, 0) = 0
            ");
            $stmt->execute([$config['id'], $config['fail_after_days']]);
            $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($customers as $customer) {
                $results['processed']++;

                // Determine target basket
                //
                // ⚠️ ทั้งสองทางต้องคืน "id ตัวเลข" เท่านั้น
                //    on_fail_basket_key เก็บเป็น basket_key (เช่น 'waiting_for_match') แต่
                //    customers.current_basket_key เก็บเป็น id ของ basket_config
                //    ของเดิมส่ง key เข้า transitionTo() ที่ประกาศพารามิเตอร์เป็น int ตรง ๆ
                //    PHP จึง cast ให้เป็น 0 เงียบ ๆ -- ลูกค้าได้ถัง 0 ที่ไม่มีอยู่จริง
                //    = หลุดออกนอกระบบถังทันที เหมือนเคสถังเป็น NULL
                //    dry run 28 ส.ค. 2569 พบว่าจะโดนแบบนี้ประมาณ 8,100 ราย
                //    (cron ตัวนี้ไม่เคยถูกตั้งบน host เลย บั๊กจึงไม่เคยแสดงตัว)
                $targetBasket = null;
                if ($config['on_fail_reevaluate']) {
                    // Re-evaluate based on days since last order
                    $targetBasket = $this->findMatchingBasket(
                        $customer['customer_id'],
                        !empty($customer['assigned_to'])
                    );
                }

                if (!$targetBasket && $config['on_fail_basket_key']) {
                    $targetBasket = $this->basketIdByKey($config['on_fail_basket_key']);
                    if (!$targetBasket) {
                        $results['errors']++;
                        $results['details'][] = [
                            'customer_id' => $customer['customer_id'],
                            'error' => "on_fail_basket_key '{$config['on_fail_basket_key']}' ของถัง {$config['basket_name']} ไม่ตรงกับถังไหนใน basket_config"
                        ];
                        continue;
                    }
                }

                if (!$targetBasket) {
                    continue;
                }

                // ถังปลายทางเท่ากับถังปัจจุบัน = ไม่มีอะไรต้องย้าย
                //
                // เกิดจริงเยอะมาก: ถังที่ตั้ง on_fail_reevaluate ไว้ พอคำนวณตามอายุออเดอร์
                // แล้วมักได้ถังเดิมกลับมา (dry run 28 ส.ค. 2569 เจอ 11,786 ราย ในนั้น
                // 49 -> 49 อย่างเดียว 10,672 ราย) ถ้าปล่อยผ่านจะเขียน log เปล่า ๆ
                // หมื่นกว่าแถวทุกรอบ และที่แย่กว่าคือ transitionTo() รีเซ็ต
                // basket_entered_date ทุกครั้ง = นาฬิกาถังถูกปัดใหม่ไม่รู้จบ
                // ลูกค้าจะไม่มีวันแก่พอจะหลุดไปถังถัดไปได้เลย
                if ((int) $targetBasket === (int) $customer['current_basket_key']) {
                    continue;
                }

                if (!$dryRun) {
                    try {
                        $this->transitionTo(
                            $customer['customer_id'],
                            (int) $targetBasket,
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
     * เก็บกวาดลูกค้าที่ "หลุดออกนอกระบบถัง"
     *
     * processAgingCustomers() ข้างบนวนจาก basket_config แล้วยิง
     * WHERE current_basket_key = ? ทีละถัง ลูกค้าที่ถังเป็น NULL หรือเป็นค่าที่ไม่ตรงกับ
     * basket_config.id ใดเลย จึงไม่แมตช์รอบไหนทั้งสิ้น -- ไม่มีอะไรในระบบมองเห็นหรือ
     * เก็บกวาดได้อีกตลอดกาล ยืนยันด้วยของจริง 1,583 ราย (ส.ค. 2569) ที่ไม่มีแถวใน
     * basket_transition_log สักแถวเดียวนับจากวันที่ถูกสร้าง
     *
     * ตรวจ 4 อาการ:
     *   1. ถังเป็น NULL
     *   2. ถังเป็นค่าที่ไม่มีใน basket_config (เช่นเก็บ basket_key แทน id)
     *   3. มีเจ้าของ แต่ถังอยู่ฝั่ง distribution -> เจ้าของมองไม่เห็นบน Dashboard
     *   4. ไม่มีเจ้าของ แต่ถังอยู่ฝั่ง dashboard_v2 -> เอาไปแจกต่อไม่ได้
     *
     * ตั้งใจให้ idempotent: รันซ้ำแล้วไม่ขยับอะไรถ้าไม่มีของเสียใหม่
     */
    public function reconcileOrphanedBaskets(bool $dryRun = false): array
    {
        $results = ['processed' => 0, 'moved' => 0, 'errors' => 0, 'skipped' => 0, 'details' => []];

        // key -> id ใช้แทนการ hardcode id เพราะ id เปลี่ยนได้เวลาตั้งค่าถังใหม่
        $byKey = [];
        $byId = [];
        $rows = $this->pdo->query("
            SELECT id, basket_key, basket_name, target_page, linked_basket_key, is_active
            FROM basket_config
        ")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $r) {
            $byId[(string)$r['id']] = $r;
            if ($r['is_active']) $byKey[$r['basket_key']] = $r;
        }

        $idOf = function (?string $key) use ($byKey) {
            return isset($byKey[$key]) ? (int)$byKey[$key]['id'] : null;
        };

        // ลูกค้าที่ต้องตรวจ -- ดึงเฉพาะที่อาการเข้าข่าย ไม่กวาดทั้งตาราง
        $stmt = $this->pdo->query("
            SELECT c.customer_id, c.current_basket_key, c.assigned_to,
                   u.status AS owner_status,
                   DATEDIFF(NOW(), o.last_order_date) AS days_since_order,
                   o.last_order_date
            FROM customers c
            LEFT JOIN users u ON u.id = c.assigned_to
            LEFT JOIN basket_config bc ON bc.id = c.current_basket_key
            LEFT JOIN (
                SELECT customer_id, MAX(order_date) AS last_order_date
                FROM orders WHERE order_status <> 'Cancelled' GROUP BY customer_id
            ) o ON o.customer_id = c.customer_id
            WHERE COALESCE(c.is_blocked, 0) = 0
              AND (
                    bc.id IS NULL
                 OR (c.assigned_to IS NOT NULL AND bc.target_page = 'distribution')
                 OR (c.assigned_to IS NULL     AND bc.target_page = 'dashboard_v2')
              )
        ");

        while ($c = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $results['processed']++;
            $customerId = (int)$c['customer_id'];
            $currentKey = $c['current_basket_key'];
            $current    = $currentKey !== null && isset($byId[(string)$currentKey]) ? $byId[(string)$currentKey] : null;
            $hasOwner   = !empty($c['assigned_to']);

            // เจ้าของลาออก/ปิดใช้งานแล้ว: ย้ายไปถัง Dashboard ก็ไม่มีใครเห็นอยู่ดี
            // และการปลดเจ้าของเป็นการตัดสินใจเชิงธุรกิจ ไม่ใช่หน้าที่ cron -- รายงานไว้เฉย ๆ
            if ($hasOwner && in_array($c['owner_status'], ['inactive', 'resigned'], true)) {
                $results['skipped']++;
                $results['details'][] = [
                    'customer_id' => $customerId,
                    'reason'      => 'owner_' . $c['owner_status'],
                    'from'        => $currentKey,
                ];
                continue;
            }

            $target = null;
            $reason = null;

            if ($current === null) {
                // อาการ 1 + 2: ไม่มีถัง หรือถังเป็นค่าเพี้ยน
                $reason = $currentKey === null ? 'orphan_null_basket' : 'orphan_unknown_basket';

                // ค่าเพี้ยนส่วนใหญ่คือ "เก็บ basket_key แทน id" ซึ่งบอกเจตนาเดิมไว้ครบแล้ว
                // ต้องแปลงกลับเป็น id ของถังนั้น ไม่ใช่โยนไปคำนวณใหม่ตามอายุ
                // (ของจริง 24 ราย ค้างเป็น 'marketplace_dis' -- เป็นลูกค้า Marketplace จริง
                // ถ้า re-route ตามอายุจะหลุดออกจากถัง Marketplace ไปทั้งที่ไม่ควรหลุด)
                $target = $currentKey !== null ? $idOf((string)$currentKey) : null;

                if (!$target) {
                    $target = $hasOwner
                        ? $idOf('new_customer')
                        : $this->poolBasketIdForAge($c['last_order_date'], $c['days_since_order'], $idOf);
                }
            } elseif ($hasOwner && $current['target_page'] === 'distribution') {
                // อาการ 3: มีเจ้าของแต่จมอยู่ถังกองกลาง -> ถังคู่ฝั่ง Dashboard
                $reason = 'owned_in_distribution';
                $target = $idOf($current['linked_basket_key']) ?? $idOf('new_customer');
            } elseif (!$hasOwner && $current['target_page'] === 'dashboard_v2') {
                // อาการ 4: ไม่มีเจ้าของแต่อยู่ถังส่วนตัว -> ถังคู่ฝั่ง Distribution
                // ถัง "ส่วนตัว" (personal_1_2m / personal_last_chance) ไม่มีถังคู่โดยเจตนา
                // เพราะออกแบบให้มีอยู่ได้เฉพาะตอนมีเจ้าของ จึงต้องจัดถังตามอายุออเดอร์แทน
                $reason = 'unowned_in_dashboard';
                $target = $idOf($current['linked_basket_key'])
                    ?? $this->poolBasketIdForAge($c['last_order_date'], $c['days_since_order'], $idOf);
            }

            if (!$target || (int)$target === (int)$currentKey) {
                $results['skipped']++;
                continue;
            }

            if ($dryRun) {
                $results['moved']++;
                $results['details'][] = [
                    'customer_id' => $customerId,
                    'from' => $currentKey,
                    'to' => $target,
                    'reason' => $reason,
                    'dry_run' => true,
                ];
                continue;
            }

            try {
                $this->transitionTo(
                    $customerId,
                    (int)$target,
                    'reconcile_orphan',
                    null,
                    $hasOwner ? (int)$c['assigned_to'] : null,
                    $hasOwner ? (int)$c['assigned_to'] : null,
                    $reason
                );
                $results['moved']++;
                $results['details'][] = [
                    'customer_id' => $customerId,
                    'from' => $currentKey,
                    'to' => $target,
                    'reason' => $reason,
                ];
            } catch (Exception $e) {
                $results['errors']++;
                $results['details'][] = ['customer_id' => $customerId, 'error' => $e->getMessage()];
            }
        }

        return $results;
    }

    /**
     * ถังฝั่ง Distribution ที่เหมาะกับอายุออเดอร์ล่าสุด
     *
     * ใช้ช่วงเดียวกับ full_recalc_baskets.php เพื่อไม่ให้มีกติกาสองชุดในระบบ
     * ไม่เคยซื้อเลย -> ถัง never_purchased ไม่ใช่ถังตามอายุ เพราะ date_registered
     * ของลูกค้า import มักเป็นวันที่ import ไม่ใช่วันที่รู้จักลูกค้าจริง
     */
    private function poolBasketIdForAge(?string $lastOrderDate, $daysSinceOrder, callable $idOf): ?int
    {
        if ($lastOrderDate === null) {
            return $idOf('never_purchased') ?? $idOf('new_customer_dis');
        }

        $days = (int)$daysSinceOrder;
        if ($days <= 90)   return $idOf('waiting_for_match');
        if ($days <= 180)  return $idOf('find_new_owner');
        if ($days <= 270)  return $idOf('mid_6_9m');
        if ($days <= 365)  return $idOf('mid_9_12m');
        if ($days <= 1095) return $idOf('mid_1_3y');
        return $idOf('ancient');
    }

    /**
     * แปลง basket_key -> id ของ basket_config
     *
     * ทั้งระบบเก็บ customers.current_basket_key เป็น id ตัวเลข แต่ basket_config
     * อ้างถึงกันเองด้วย basket_key (linked_basket_key, on_fail_basket_key)
     * ทุกที่ที่หยิบค่าจากคอลัมน์พวกนั้นไปเขียนลง customers ต้องผ่านตัวนี้ก่อนเสมอ
     */
    private function basketIdByKey(?string $key): ?int
    {
        if ($key === null || $key === '') return null;

        if (!isset($this->basketKeyCache)) {
            $this->basketKeyCache = [];
            $rows = $this->pdo->query("SELECT id, basket_key FROM basket_config WHERE is_active = 1")
                              ->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as $r) {
                $this->basketKeyCache[$r['basket_key']] = (int) $r['id'];
            }
        }

        return $this->basketKeyCache[$key] ?? null;
    }

    /**
     * หาถังที่เหมาะกับอายุออเดอร์ล่าสุด
     *
     * ⚠️ ต้องรู้ว่าลูกค้ามีเจ้าของหรือไม่ ก่อนเลือกถัง
     *    ถังมาเป็นคู่เสมอ ฝั่ง dashboard_v2 (เจ้าของเห็นบนหน้าจอตัวเอง) กับ
     *    ฝั่ง distribution (เอาไปแจกต่อได้) ของเดิมคืน id ตายตัว 44/45/50 โดยไม่ดู
     *    เจ้าของเลย ลูกค้าที่มีคนดูแลอยู่จึงถูกโยนไปถังกองกลาง เจ้าของมองไม่เห็นทันที
     *    dry run 28 ส.ค. 2569 พบว่าจะโดนแบบนี้ 10,672 ราย จากถัง 49 ถังเดียว
     *
     *    คอมเมนต์ของเดิมยังไม่ตรงกับ config ด้วย: เขียน 45 = mid_1_3y แต่ 45 คือ
     *    ancient ส่วน 50 คือ ancient_dash (คนละฝั่งกัน) จึงเลิกใช้ id ตายตัว
     *    เปลี่ยนมาค้นด้วย basket_key แทนทั้งหมด
     */
    private function findMatchingBasket(int $customerId, bool $hasOwner = false): ?int
    {
        $stmt = $this->pdo->prepare("
            SELECT DATEDIFF(NOW(), COALESCE(last_order_date, date_registered)) as days_since
            FROM customers 
            WHERE customer_id = ?
        ");
        $stmt->execute([$customerId]);
        $daysSince = (int) $stmt->fetchColumn();

        if ($daysSince < 180) {
            return null; // ยังไม่ถึงเกณฑ์ ปล่อยให้ on_fail_basket_key ตัดสิน
        }

        if ($daysSince <= 270) {
            // ถัง 6-12 เดือนถูกแตกเป็น 6-9 กับ 9-12 แล้ว (mid_6_12m ตัวเก่า is_active=0)
            $key = $hasOwner ? 'mid_6_9m_dash' : 'mid_6_9m';
        } elseif ($daysSince <= 365) {
            $key = $hasOwner ? 'mid_9_12m_dash' : 'mid_9_12m';
        } elseif ($daysSince <= 1095) {
            $key = $hasOwner ? 'mid_1_3y_dash' : 'mid_1_3y';
        } else {
            $key = $hasOwner ? 'ancient_dash' : 'ancient';
        }

        return $this->basketIdByKey($key);
    }
}
