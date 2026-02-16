<?php

class ShippingSyncService
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Syncs order status and delivery info from Google Sheet to Orders table
     * based on Tracking Number match.
     * 
     * @param string $trackingNumber The tracking number to sync (e.g. from Bulk Tracking update)
     * @return array Result of the sync operation
     */
    public function syncOrderFromSheet($trackingNumber)
    {
        $trackingNumber = trim($trackingNumber);
        if (empty($trackingNumber)) {
            return ['success' => false, 'message' => 'Empty tracking number'];
        }

        // 1. Find the Google Sheet record for this tracking number (order_number in sheet = tracking number)
        // We look for the latest record if multiple exist
        $stmt = $this->pdo->prepare("
            SELECT * FROM google_sheet_shipping 
            WHERE order_number = ? 
            ORDER BY id DESC LIMIT 1
        ");
        $stmt->execute([$trackingNumber]);
        $sheetRecord = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$sheetRecord) {
            return ['success' => false, 'message' => 'No sheet record found for tracking: ' . $trackingNumber];
        }

        // 2. Find the Order(s) associated with this tracking number
        $stmt = $this->pdo->prepare("
            SELECT DISTINCT parent_order_id 
            FROM order_tracking_numbers 
            WHERE tracking_number = ?
        ");
        $stmt->execute([$trackingNumber]);
        $orderIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

        if (empty($orderIds)) {
            return ['success' => false, 'message' => 'No orders found for tracking: ' . $trackingNumber];
        }

        $updatedOrders = [];
        foreach ($orderIds as $orderId) {
            $updateResult = $this->updateOrder($orderId, $sheetRecord);
            if ($updateResult['success']) {
                $updatedOrders[] = $orderId;
            }
        }

        return [
            'success' => true,
            'updated_orders' => $updatedOrders,
            'sheet_data' => $sheetRecord
        ];
    }

    /**
     * Syncs multiple orders based on newly imported Sheet records.
     * Used when importing from Google Sheet.
     * 
     * @param array $sheetRecords Array of imported sheet records
     * @return array Summary of sync
     */
    public function syncFromSheetImport(array $sheetRecords)
    {
        $syncedCount = 0;
        $details = [];

        foreach ($sheetRecords as $record) {
            // $record['order_number'] is the Tracking Number
            $trackingNumber = $record['order_number'];
            $result = $this->syncOrderFromSheet($trackingNumber);

            if ($result['success'] && !empty($result['updated_orders'])) {
                $syncedCount++;
                $details[] = [
                    'tracking' => $trackingNumber,
                    'orders' => $result['updated_orders']
                ];
            }
        }

        return [
            'success' => true,
            'synced_count' => $syncedCount,
            'details' => $details
        ];
    }

    private function updateOrder($orderId, $sheetRecord)
    {
        try {
            // Extract data from sheet record
            // NOTE: order_status is intentionally NOT synced from Sheet to prevent
            // auto-closing orders (e.g. "Delivered") before payment is confirmed.
            // Only delivery_date and delivery_status (as a note) are synced.
            $deliveryStatus = $sheetRecord['delivery_status']; // e.g. "Sent"
            $deliveryDate = $sheetRecord['delivery_date'];     // e.g. "2024-01-01"

            $updateFields = [];
            $params = [];

            if (!empty($deliveryDate)) {
                $updateFields[] = "delivery_date = ?";
                $params[] = $deliveryDate;
            }

            // Update note_system with delivery_status (log only, does not change order_status)
            if (!empty($deliveryStatus)) {
                // Check if note_system already contains this status to prevent spamming
                $stmt = $this->pdo->prepare("SELECT note_system FROM orders WHERE id = ?");
                $stmt->execute([$orderId]);
                $currentNoteSystem = $stmt->fetchColumn();

                $noteEntry = "[Auto-Sync] Delivery Status: " . $deliveryStatus;

                if (strpos($currentNoteSystem ?? '', $noteEntry) === false) {
                    $newNoteSystem = $currentNoteSystem ? $currentNoteSystem . "\n" . $noteEntry : $noteEntry;
                    $updateFields[] = "note_system = ?";
                    $params[] = $newNoteSystem;
                }
            }

            if (empty($updateFields)) {
                return ['success' => false, 'message' => 'No fields to update'];
            }

            // Execute Update (only delivery_date + note_system, never order_status)
            $sql = "UPDATE orders SET " . implode(', ', $updateFields) . " WHERE id = ?";
            $params[] = $orderId;

            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);

            return ['success' => true];

        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}
?>