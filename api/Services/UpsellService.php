<?php
/**
 * UpsellService - Round-Robin Auto-Distribution for Upsell
 * 
 * Logic:
 * 1. When new order is created → auto-assign to next Telesale
 * 2. Order appears in Upsell tab for that Telesale
 * 3. When order_status changes to 'picking' → disappears from Upsell tab
 */

// PDO is passed via constructor, no need to require config here
class UpsellService {
    private $pdo;
    private $companyId;

    public function __construct($pdo, $companyId = 1) {
        $this->pdo = $pdo;
        $this->companyId = $companyId;
    }

    /**
     * Get list of active Telesale users for Round-Robin
     */
    private function getTelesaleUsers() {
        $stmt = $this->pdo->prepare("
            SELECT u.id 
            FROM users u
            WHERE u.company_id = ? 
              AND u.is_active = 1 
              AND u.role IN ('telesale', 'Telesale')
            ORDER BY u.id ASC
        ");
        $stmt->execute([$this->companyId]);
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    /**
     * Get next Telesale ID using Round-Robin
     */
    public function getNextTelesaleId() {
        $telesales = $this->getTelesaleUsers();
        
        if (empty($telesales)) {
            return null; // No telesale available
        }

        // Get last assigned user
        $stmt = $this->pdo->prepare("
            SELECT last_assigned_user_id 
            FROM upsell_round_robin 
            WHERE company_id = ?
        ");
        $stmt->execute([$this->companyId]);
        $lastUserId = $stmt->fetchColumn();

        // Find next user in rotation
        $nextUserId = null;
        if ($lastUserId === null || $lastUserId === false) {
            // First time - assign to first telesale
            $nextUserId = $telesales[0];
        } else {
            // Find position of last user and get next
            $currentIndex = array_search($lastUserId, $telesales);
            if ($currentIndex === false || $currentIndex >= count($telesales) - 1) {
                // Last user not found or at end - loop back to first
                $nextUserId = $telesales[0];
            } else {
                $nextUserId = $telesales[$currentIndex + 1];
            }
        }

        // Update round-robin tracker
        $stmt = $this->pdo->prepare("
            UPDATE upsell_round_robin 
            SET last_assigned_user_id = ?, last_assigned_at = NOW()
            WHERE company_id = ?
        ");
        $stmt->execute([$nextUserId, $this->companyId]);

        return $nextUserId;
    }

    /**
     * Assign order to next Telesale for Upsell
     */
    public function assignOrderToTelesale($orderId) {
        $nextTelesaleId = $this->getNextTelesaleId();
        
        if (!$nextTelesaleId) {
            return ['success' => false, 'error' => 'No telesale available'];
        }

        $stmt = $this->pdo->prepare("
            UPDATE orders 
            SET upsell_user_id = ?
            WHERE id = ?
        ");
        $stmt->execute([$nextTelesaleId, $orderId]);

        return [
            'success' => true,
            'assigned_to' => $nextTelesaleId,
            'order_id' => $orderId
        ];
    }

    /**
     * Get Upsell orders for a specific Telesale
     * Only returns orders with status = 'pending'
     */
    public function getUpsellOrdersForUser($userId) {
        $stmt = $this->pdo->prepare("
            SELECT o.*, c.first_name, c.last_name, c.phone
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            WHERE o.upsell_user_id = ?
              AND o.order_status = 'pending'
              AND o.company_id = ?
            ORDER BY o.order_date DESC
        ");
        $stmt->execute([$userId, $this->companyId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Clear upsell assignment when order moves to picking
     */
    public function clearUpsellOnPicking($orderId) {
        $stmt = $this->pdo->prepare("
            UPDATE orders 
            SET upsell_user_id = NULL
            WHERE id = ? AND order_status = 'picking'
        ");
        $stmt->execute([$orderId]);
        return $stmt->rowCount() > 0;
    }
}
