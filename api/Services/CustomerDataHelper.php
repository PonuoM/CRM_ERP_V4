<?php
/**
 * CustomerDataHelper
 * Contains helper functions for attaching related data to customers arrays
 * (e.g. appointments, call status).
 * Extracted during api-controllers refactoring to be shared across controllers.
 */

/**
 * Helper function: Attach next_appointment data to customers array
 * This eliminates the need to load 12,000+ appointments separately
 * Uses batch query to avoid N+1 problem
 */
function attach_next_appointments_to_customers(PDO $pdo, array &$customers): void
{
    if (empty($customers))
        return;

    // Collect all customer IDs
    $customerIds = [];
    foreach ($customers as $c) {
        $cid = $c['customer_id'] ?? $c['id'] ?? null;
        if ($cid) {
            $customerIds[] = $cid;
        }
    }

    if (empty($customerIds))
        return;

    // Batch query: Get next appointment for each customer (upcoming or most recent overdue)
    // Priority: upcoming appointments first, then overdue if no upcoming
    $placeholders = implode(',', array_fill(0, count($customerIds), '?'));

    try {
        $sql = "
            SELECT 
                a.customer_id,
                a.id as next_appointment_id,
                a.date as next_appointment_date,
                a.title as next_appointment_title,
                a.status as next_appointment_status,
                a.notes as next_appointment_notes
            FROM appointments a
            INNER JOIN (
                SELECT customer_id, MIN(date) as min_date
                FROM appointments
                WHERE customer_id IN ($placeholders)
                  AND status NOT IN ('ยกเลิกการติดตาม', 'เสร็จสิ้น')
                  AND date >= CURDATE()
                GROUP BY customer_id
            ) upcoming ON a.customer_id = upcoming.customer_id AND a.date = upcoming.min_date
            WHERE a.status NOT IN ('ยกเลิกการติดตาม', 'เสร็จสิ้น')

            UNION ALL
            
            SELECT 
                a.customer_id,
                a.id as next_appointment_id,
                a.date as next_appointment_date,
                a.title as next_appointment_title,
                a.status as next_appointment_status,
                a.notes as next_appointment_notes
            FROM appointments a
            INNER JOIN (
                SELECT customer_id, MAX(date) as max_date
                FROM appointments
                WHERE customer_id IN ($placeholders)
                  AND status NOT IN ('ยกเลิกการติดตาม', 'เสร็จสิ้น')
                  AND date < CURDATE()
                  AND customer_id NOT IN (
                      SELECT DISTINCT customer_id FROM appointments
                      WHERE customer_id IN ($placeholders)
                      AND status NOT IN ('ยกเลิกการติดตาม', 'เสร็จสิ้น')
                      AND date >= CURDATE()
                  )
                GROUP BY customer_id
            ) overdue ON a.customer_id = overdue.customer_id AND a.date = overdue.max_date
            WHERE a.status NOT IN ('ยกเลิกการติดตาม', 'เสร็จสิ้น')
        ";

        // Params: customerIds x 3 (for each subquery: upcoming, upcoming_dedup, overdue)
        // SQL Structure: Main SELECT -> Upcoming JOIN -> UNION -> Main SELECT -> Overdue JOIN (with subquery)
        $params = array_merge($customerIds, $customerIds, $customerIds);

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $appointments = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Build lookup map
        $appointmentMap = [];
        foreach ($appointments as $apt) {
            $cid = $apt['customer_id'];
            if (!isset($appointmentMap[$cid])) {
                $appointmentMap[$cid] = $apt;
            }
        }

        // Attach to customers
        foreach ($customers as &$customer) {
            $cid = $customer['customer_id'] ?? $customer['id'] ?? null;
            if ($cid && isset($appointmentMap[$cid])) {
                $apt = $appointmentMap[$cid];
                $customer['next_appointment_id'] = $apt['next_appointment_id'];
                $customer['next_appointment_date'] = $apt['next_appointment_date'];
                $customer['next_appointment_title'] = $apt['next_appointment_title'];
                $customer['next_appointment_status'] = $apt['next_appointment_status'];
                $customer['next_appointment_notes'] = $apt['next_appointment_notes'];
            }
        }
        unset($customer);

    } catch (Throwable $e) {
        // If appointments table doesn't exist or error, silently continue
        error_log("attach_next_appointments_to_customers error: " . $e->getMessage());
    }
}

/**
 * Helper function: Attach call status data to customers array
 * This attaches: last_call_date, call_count_by_owner, last_call_result
 * Only counts calls made by the CURRENT OWNER (matching caller name)
 * Uses batch query to avoid N+1 problem
 */
function attach_call_status_to_customers(PDO $pdo, array &$customers): void
{
    if (empty($customers))
        return;

    // Collect customer info: ID and assigned_to (owner user_id)
    $customerIds = [];
    $ownerUserIds = [];
    foreach ($customers as $c) {
        $cid = $c['customer_id'] ?? $c['id'] ?? null;
        $ownerId = $c['assigned_to'] ?? null;
        if ($cid) {
            $customerIds[] = $cid;
            if ($ownerId) {
                $ownerUserIds[$cid] = $ownerId;
            }
        }
    }

    if (empty($customerIds))
        return;

    try {
        // Step 1: Get owner names from users table (for legacy fallback)
        $uniqueOwnerIds = array_unique(array_values($ownerUserIds));
        if (empty($uniqueOwnerIds)) return;

        $ownerPlaceholders = implode(',', array_fill(0, count($uniqueOwnerIds), '?'));
        $ownerStmt = $pdo->prepare("SELECT id, CONCAT(first_name, ' ', last_name) as full_name FROM users WHERE id IN ($ownerPlaceholders)");
        $ownerStmt->execute($uniqueOwnerIds);
        $ownerRows = $ownerStmt->fetchAll(PDO::FETCH_ASSOC);

        $ownerNameMap = [];
        foreach ($ownerRows as $row) {
            $ownerNameMap[$row['id']] = $row['full_name'];
        }

        // Step 2: Query call_history for all customers
        $placeholders = implode(',', array_fill(0, count($customerIds), '?'));
        // Group by both caller_id and caller text to support legacy data
        $callSql = "
            SELECT 
                customer_id,
                caller_id,
                caller,
                MAX(date) as last_call_date,
                COUNT(*) as call_count,
                (SELECT result FROM call_history ch2 
                 WHERE ch2.customer_id = call_history.customer_id 
                   AND (ch2.caller_id = call_history.caller_id OR (call_history.caller_id IS NULL AND ch2.caller = call_history.caller))
                 ORDER BY ch2.date DESC LIMIT 1) as last_call_result
            FROM call_history
            WHERE customer_id IN ($placeholders)
            GROUP BY customer_id, caller_id, caller
        ";

        $callStmt = $pdo->prepare($callSql);
        $callStmt->execute($customerIds);
        $callRows = $callStmt->fetchAll(PDO::FETCH_ASSOC);

        // Build lookups: by ID and by Name
        $callMapById = [];
        $callMapByName = [];
        foreach ($callRows as $row) {
            $cid = $row['customer_id'];
            if ($row['caller_id'] !== null) {
                $callerIdStr = (string)$row['caller_id'];
                if (!isset($callMapById[$cid])) $callMapById[$cid] = [];
                $callMapById[$cid][$callerIdStr] = [
                    'last_call_date' => $row['last_call_date'],
                    'call_count' => (int) $row['call_count'],
                    'last_call_result' => $row['last_call_result']
                ];
            } else {
                $callerName = $row['caller'];
                if (!isset($callMapByName[$cid])) $callMapByName[$cid] = [];
                $callMapByName[$cid][$callerName] = [
                    'last_call_date' => $row['last_call_date'],
                    'call_count' => (int) $row['call_count'],
                    'last_call_result' => $row['last_call_result']
                ];
            }
        }

        // Step 2: Attach to customers (only for matching owner)
        foreach ($customers as &$customer) {
            $cid = $customer['customer_id'] ?? $customer['id'] ?? null;
            $ownerId = $customer['assigned_to'] ?? null;

            // Default values
            $customer['last_call_date_by_owner'] = null;
            $customer['call_count_by_owner'] = 0;
            $customer['last_call_result_by_owner'] = null;

            if (!$cid || !$ownerId)
                continue;

            $ownerIdStr = (string)$ownerId;
            $ownerName = $ownerNameMap[$ownerId] ?? null;

            // Check if this owner has any calls for this customer by ID first
            if (isset($callMapById[$cid]) && isset($callMapById[$cid][$ownerIdStr])) {
                $callData = $callMapById[$cid][$ownerIdStr];
                $customer['last_call_date_by_owner'] = $callData['last_call_date'];
                $customer['call_count_by_owner'] = $callData['call_count'];
                $customer['last_call_result_by_owner'] = $callData['last_call_result'];
            } 
            // Fallback to name matching for legacy records that didn't get a caller_id
            elseif ($ownerName && isset($callMapByName[$cid]) && isset($callMapByName[$cid][$ownerName])) {
                $callData = $callMapByName[$cid][$ownerName];
                $customer['last_call_date_by_owner'] = $callData['last_call_date'];
                $customer['call_count_by_owner'] = $callData['call_count'];
                $customer['last_call_result_by_owner'] = $callData['last_call_result'];
            }
        }
        unset($customer);

    } catch (Throwable $e) {
        // If call_history table doesn't exist or error, silently continue
        error_log("attach_call_status_to_customers error: " . $e->getMessage());
    }
}
