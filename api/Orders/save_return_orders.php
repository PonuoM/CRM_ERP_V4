<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json');

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config.php';

$data = json_decode(file_get_contents("php://input"), true);

if (!$data || !isset($data['returns']) || !is_array($data['returns'])) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid input data"]);
    exit;
}

$conn = db_connect();
$conn->beginTransaction();

try {
    $successCount = 0;
    $errors = [];
    $mainOrderIdsToUpdate = [];

    foreach ($data['returns'] as $item) {
        $trackingNumber = isset($item['tracking_number']) ? trim($item['tracking_number']) : '';
        $subOrderId = isset($item['sub_order_id']) ? trim($item['sub_order_id']) : '';
        $targetStatus = isset($item['status']) ? $item['status'] : ''; // returning, returned, lost, good, damaged
        $note = isset($item['note']) ? $item['note'] : '';

        if (empty($trackingNumber) && empty($subOrderId)) {
            $errors[] = "Missing Tracking Number or Sub Order ID";
            continue;
        }

        // 1. Resolve Tracking / SubOrderId
        // If tracking is provided, resolve to sub_order_id if possible
        if (!empty($trackingNumber)) {
            // Find Sub Order ID from Tracking
            $stmtTrack = $conn->prepare("SELECT order_id, parent_order_id, box_number FROM order_tracking_numbers WHERE tracking_number = ? LIMIT 1");
            $stmtTrack->execute([$trackingNumber]);
            $trackRow = $stmtTrack->fetch(PDO::FETCH_ASSOC);

            if ($trackRow) {
                // Construct Sub Order ID: {MainID}-{BoxNum}
                // If box_number is 0 or null, assume it's main order? But requirements say "linked to sub_order_id"
                if (!empty($trackRow['parent_order_id']) && !empty($trackRow['box_number'])) {
                    $resolvedSubId = $trackRow['parent_order_id'] . '-' . $trackRow['box_number'];
                    if (empty($subOrderId)) {
                        $subOrderId = $resolvedSubId;
                    }
                } else if (!empty($trackRow['order_id'])) {
                    // Fallback if order_tracking stores sub_order_id in order_id column?
                    // Check if order_id looks like a sub order
                    if (empty($subOrderId)) {
                        $subOrderId = $trackRow['order_id'];
                    }
                }
            }
        }

        // Normalize inputs
        $trackingNumber = $trackingNumber ?: $subOrderId; // Fallback if tracking missing but subID exists? No, tracking is key.

        // Requirement: "Import Returning -> Check if tracking no linked to sub_order_id"
        // If we can't find sub_order_id, maybe we should error for "returning" flow?
        // But for "returned" flow, maybe tracking is enough if it exists in order_returns?

        $stmtCheck = $conn->prepare("SELECT id, status FROM order_returns WHERE tracking_number = ? LIMIT 1");
        $stmtCheck->execute([$trackingNumber]);
        $currentReturn = $stmtCheck->fetch(PDO::FETCH_ASSOC);

        // Unified Unconditional Upsert Logic
        if ($currentReturn) {
            // Update Existing
            $stmtUpdate = $conn->prepare("UPDATE order_returns SET status = ?, note = COALESCE(?, note), updated_at = NOW() WHERE id = ?");
            // Use provided note, or keep existing if empty string?
            // Actually, if note is provided in payload (even empty), user might intend to clear it?
            // User requested "Manual note", so if payload has note, use it.
            // strict update:
            $noteToUse = $note;
            // If payload note is empty string, do we overwrite?
            // Let's assume yes, or use logic: if (!empty($note)) update.
            // Simple approach: Always update status. Update note if provided (not null).

            if ($stmtUpdate->execute([$targetStatus, $note, $currentReturn['id']])) {
                $successCount++;
            }
        } else {
            // Insert New
            $stmtInsert = $conn->prepare("INSERT INTO order_returns (tracking_number, status, note, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())");
            if ($stmtInsert->execute([$trackingNumber, $targetStatus, $note])) {
                $successCount++;

                // Auto-create 'pending' siblings logic (Only on new insert)
                // 1. Identify Main Order ID
                $mainOrderId = null;
                if (!empty($trackRow['parent_order_id'])) {
                    $mainOrderId = $trackRow['parent_order_id'];
                } elseif (!empty($trackRow['order_id'])) {
                    $mainOrderId = $trackRow['order_id'];
                } else {
                    $parts = explode('-', $subOrderId);
                    if (count($parts) >= 2) {
                        if (count($parts) > 1) {
                            array_pop($parts);
                            $mainOrderId = implode('-', $parts);
                        }
                    }
                }

                // 2. Find siblings
                if ($mainOrderId) {
                    $stmtSiblings = $conn->prepare("SELECT tracking_number FROM order_tracking_numbers WHERE parent_order_id = ? OR order_id = ?");
                    $stmtSiblings->execute([$mainOrderId, $mainOrderId]);
                    $siblings = $stmtSiblings->fetchAll(PDO::FETCH_ASSOC);

                    foreach ($siblings as $sib) {
                        $sibTrack = $sib['tracking_number'];
                        if ($sibTrack === $trackingNumber)
                            continue; // Skip self

                        // Check existence
                        $stmtExist = $conn->prepare("SELECT id FROM order_returns WHERE tracking_number = ? LIMIT 1");
                        $stmtExist->execute([$sibTrack]);
                        if (!$stmtExist->fetch()) {
                            // Insert as Pending
                            $stmtPend = $conn->prepare("INSERT INTO order_returns (tracking_number, status, note, created_at, updated_at) VALUES (?, 'pending', '', NOW(), NOW())");
                            $stmtPend->execute([$sibTrack]);
                        }
                    }
                }

            }
        }
    }


    // Update Main Order Statuses
    $mainOrderIdsToUpdate = array_unique($mainOrderIdsToUpdate);
    if (!empty($mainOrderIdsToUpdate)) {
        $placeholders = str_repeat('?,', count($mainOrderIdsToUpdate) - 1) . '?';
        // Only update if not already Returned? Or just force set?
        // Requirement: "อัปเดตข้อมูล orders.order_status = 'Returned'"
        $stmtOrder = $conn->prepare("UPDATE orders SET order_status = 'Returned' WHERE id IN ($placeholders)");
        $stmtOrder->execute(array_values($mainOrderIdsToUpdate));
    }

    $conn->commit();

    echo json_encode([
        "status" => "success",
        "message" => "Processed $successCount items.",
        "errors" => $errors, // Return errors for feedback
        "success_count" => $successCount
    ]);

} catch (Exception $e) {
    if (isset($conn))
        $conn->rollBack();
    error_log("Save Return Orders Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
}

$conn = null;
?>