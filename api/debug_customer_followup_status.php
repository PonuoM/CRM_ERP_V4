<?php
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

try {
    $pdo = db_connect();
    
    $customerId = $_GET['id'] ?? 100290;
    
    $stmt = $pdo->prepare('SELECT 
        customer_id, 
        customer_ref_id, 
        first_name, 
        last_name, 
        lifecycle_status, 
        ownership_expires, 
        followup_bonus_remaining, 
        follow_up_count, 
        last_follow_up_date,
        date_assigned,
        assigned_to
    FROM customers 
    WHERE customer_id = ? OR customer_ref_id LIKE ? 
    LIMIT 1');
    
    $stmt->execute([$customerId, "%$customerId%"]);
    $customer = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($customer) {
        // Calculate days until ownership expires
        $ownershipExpires = $customer['ownership_expires'] ?? null;
        $daysRemaining = null;
        $maxAllowedDate = null;
        
        if ($ownershipExpires) {
            $now = new DateTime();
            $expiry = new DateTime($ownershipExpires);
            $diff = $now->diff($expiry);
            $daysRemaining = $diff->invert ? -$diff->days : $diff->days;
            
            // Max allowed is 90 days from now
            $maxAllowed = (clone $now);
            $maxAllowed->add(new DateInterval('P90D'));
            $maxAllowedDate = $maxAllowed->format('Y-m-d H:i:s');
        }
        
        echo json_encode([
            'ok' => true,
            'customer' => $customer,
            'analysis' => [
                'days_remaining' => $daysRemaining,
                'max_allowed_date' => $maxAllowedDate,
                'can_add_days' => $customer['followup_bonus_remaining'] > 0,
                'bonus_remaining' => (int)$customer['followup_bonus_remaining'],
                'note' => $customer['followup_bonus_remaining'] > 0 
                    ? 'Can add 90 days on next follow-up' 
                    : 'No bonus remaining - follow-up will NOT add ownership days'
            ]
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode(['ok' => false, 'error' => 'Customer not found'], JSON_PRETTY_PRINT);
    }
} catch (Exception $e) {
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_PRETTY_PRINT);
}
