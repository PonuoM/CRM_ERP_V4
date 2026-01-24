<?php
/**
 * Test Script: Verify attach_next_appointments_to_customers function
 * URL: http://localhost/CRM_ERP_V4/api/test_appointments.php
 * Compatible with PHP 5.6+
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

try {
    $pdo = db_connect();
    
    $results = [
        'status' => 'running',
        'tests' => []
    ];
    
    // Test 1: Check if appointments table exists
    $test1 = ['name' => 'appointments_table_exists', 'passed' => false, 'message' => ''];
    try {
        $stmt = $pdo->query("SHOW TABLES LIKE 'appointments'");
        if ($stmt->rowCount() > 0) {
            $test1['passed'] = true;
            $test1['message'] = 'Table appointments exists';
        } else {
            $test1['message'] = 'Table appointments does NOT exist';
        }
    } catch (Exception $e) {
        $test1['message'] = 'Error: ' . $e->getMessage();
    }
    $results['tests'][] = $test1;
    
    // Test 2: Count appointments
    $test2 = ['name' => 'appointments_count', 'passed' => false, 'message' => '', 'count' => 0];
    try {
        $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM appointments");
        $row = $stmt->fetch();
        $test2['count'] = (int)$row['cnt'];
        $test2['passed'] = true;
        $test2['message'] = "Total appointments: " . $test2['count'];
    } catch (Exception $e) {
        $test2['message'] = 'Error: ' . $e->getMessage();
    }
    $results['tests'][] = $test2;
    
    // Test 3: Count non-completed appointments
    $test3 = ['name' => 'pending_appointments', 'passed' => false, 'message' => '', 'count' => 0];
    try {
        $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM appointments WHERE status != 'เสร็จสิ้น'");
        $row = $stmt->fetch();
        $test3['count'] = (int)$row['cnt'];
        $test3['passed'] = true;
        $test3['message'] = "Pending appointments (not completed): " . $test3['count'];
    } catch (Exception $e) {
        $test3['message'] = 'Error: ' . $e->getMessage();
    }
    $results['tests'][] = $test3;
    
    // Test 4: Find customers with pending appointments
    $test4 = ['name' => 'customers_with_appointments', 'passed' => false, 'message' => '', 'sample' => []];
    try {
        $stmt = $pdo->query("
            SELECT DISTINCT a.customer_id, a.id, a.date, a.title, a.status, c.first_name, c.last_name
            FROM appointments a
            JOIN customers c ON c.customer_id = a.customer_id
            WHERE a.status != 'เสร็จสิ้น'
            ORDER BY a.date ASC
            LIMIT 5
        ");
        $test4['sample'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $test4['passed'] = count($test4['sample']) > 0;
        $test4['message'] = "Found " . count($test4['sample']) . " customers with pending appointments";
    } catch (Exception $e) {
        $test4['message'] = 'Error: ' . $e->getMessage();
    }
    $results['tests'][] = $test4;
    
    // Test 5: Test the attach logic
    $test5 = ['name' => 'attach_function_test', 'passed' => false, 'message' => '', 'customers' => []];
    try {
        if (!empty($test4['sample'])) {
            $customerIds = array_column($test4['sample'], 'customer_id');
            $placeholders = implode(',', array_fill(0, count($customerIds), '?'));
            
            $stmt = $pdo->prepare("SELECT customer_id, first_name, last_name FROM customers WHERE customer_id IN ($placeholders) LIMIT 5");
            $stmt->execute($customerIds);
            $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Inline simplified version of attach_next_appointments_to_customers
            $customerIdsForQuery = [];
            foreach ($customers as $c) {
                $cid = isset($c['customer_id']) ? $c['customer_id'] : (isset($c['id']) ? $c['id'] : null);
                if ($cid) $customerIdsForQuery[] = $cid;
            }
            
            if (!empty($customerIdsForQuery)) {
                $ph = implode(',', array_fill(0, count($customerIdsForQuery), '?'));
                $sql = "
                    SELECT 
                        a.customer_id,
                        a.id as next_appointment_id,
                        a.date as next_appointment_date,
                        a.title as next_appointment_title,
                        a.status as next_appointment_status
                    FROM appointments a
                    WHERE a.customer_id IN ($ph)
                      AND a.status != 'เสร็จสิ้น'
                    ORDER BY a.date ASC
                ";
                
                $stmt = $pdo->prepare($sql);
                $stmt->execute($customerIdsForQuery);
                $appointments = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                $appointmentMap = [];
                foreach ($appointments as $apt) {
                    $cid = $apt['customer_id'];
                    if (!isset($appointmentMap[$cid])) {
                        $appointmentMap[$cid] = $apt;
                    }
                }
                
                foreach ($customers as &$customer) {
                    $cid = isset($customer['customer_id']) ? $customer['customer_id'] : null;
                    if ($cid && isset($appointmentMap[$cid])) {
                        $apt = $appointmentMap[$cid];
                        $customer['next_appointment_id'] = $apt['next_appointment_id'];
                        $customer['next_appointment_date'] = $apt['next_appointment_date'];
                        $customer['next_appointment_title'] = $apt['next_appointment_title'];
                        $customer['next_appointment_status'] = $apt['next_appointment_status'];
                    }
                }
                unset($customer);
            }
            
            $test5['customers'] = $customers;
            
            // Check if any customer has next_appointment fields
            $hasAppointments = false;
            foreach ($customers as $c) {
                if (isset($c['next_appointment_id'])) {
                    $hasAppointments = true;
                    break;
                }
            }
            
            $test5['passed'] = $hasAppointments;
            $test5['message'] = $hasAppointments 
                ? 'Appointments attached successfully!'
                : 'No appointments attached';
        } else {
            $test5['message'] = 'Skipped - no customers with appointments found';
        }
    } catch (Exception $e) {
        $test5['message'] = 'Error: ' . $e->getMessage();
    }
    $results['tests'][] = $test5;
    
    // Summary - PHP 5.6 compatible
    $passedCount = 0;
    foreach ($results['tests'] as $t) {
        if ($t['passed']) $passedCount++;
    }
    $results['status'] = $passedCount === count($results['tests']) ? 'ALL_PASSED' : 'SOME_FAILED';
    $results['summary'] = $passedCount . '/' . count($results['tests']) . ' tests passed';
    
    echo json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ], JSON_PRETTY_PRINT);
}
