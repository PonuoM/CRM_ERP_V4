<?php
/**
 * API endpoint to manage multiple customer addresses
 * Supports GET, POST, PUT, DELETE for customer_address and primary customers table
 */

require_once 'config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    $pdo = db_connect();
    
    // Auth Validation (optional depending on system strictness)
    // validate_auth($pdo); 

    $method = $_SERVER['REQUEST_METHOD'];
    
    function sanitizeValue($value) {
        if (is_string($value)) {
            $value = trim($value);
            return (strtolower($value) === 'undefined' || strtolower($value) === 'null') ? '' : $value;
        }
        return $value;
    }
    
    if ($method === 'GET') {
        $customerId = $_GET['customer_id'] ?? null;
        if (!$customerId) {
            json_response(['error' => 'Missing customer_id'], 400);
        }
        
        $addresses = [];
        
        // 1. Fetch Primary Address from 'customers'
        $stmtPrimary = $pdo->prepare("SELECT customer_id, first_name, last_name, phone, street, subdistrict, district, province, postal_code, recipient_first_name, recipient_last_name FROM customers WHERE customer_id = ?");
        $stmtPrimary->execute([$customerId]);
        $primary = $stmtPrimary->fetch();
        
        if ($primary) {
            $addresses[] = [
                'id' => 'primary',
                'customerId' => $primary['customer_id'],
                'recipientFirstName' => $primary['recipient_first_name'] ?: $primary['first_name'],
                'recipientLastName' => $primary['recipient_last_name'] ?: $primary['last_name'],
                'address' => $primary['street'],
                'subdistrict' => $primary['subdistrict'],
                'district' => $primary['district'],
                'province' => $primary['province'],
                'zipCode' => $primary['postal_code'],
                'isPrimary' => true,
                'phone' => $primary['phone']
            ];
        }
        
        // 2. Fetch Secondary Addresses from 'customer_address'
        $stmtSecondary = $pdo->prepare("SELECT id, customer_id, address, sub_district, district, province, zip_code, recipient_first_name, recipient_last_name FROM customer_address WHERE customer_id = ?");
        $stmtSecondary->execute([$customerId]);
        $secondaryList = $stmtSecondary->fetchAll();
        
        foreach ($secondaryList as $sec) {
            $addresses[] = [
                'id' => (int)$sec['id'],
                'customerId' => $sec['customer_id'],
                'recipientFirstName' => $sec['recipient_first_name'],
                'recipientLastName' => $sec['recipient_last_name'],
                'address' => $sec['address'],
                'subdistrict' => $sec['sub_district'],
                'district' => $sec['district'],
                'province' => $sec['province'],
                'zipCode' => $sec['zip_code'],
                'isPrimary' => false,
                'phone' => '' // phone not typically tracked in customer_address yet
            ];
        }
        
        json_response(['success' => true, 'data' => $addresses]);
    }
    
    else if ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        $customerId = $data['customer_id'] ?? $data['customerId'] ?? null;
        
        if (!$customerId) {
            json_response(['error' => 'Missing customerId'], 400);
        }
        
        $sql = "INSERT INTO customer_address (customer_id, recipient_first_name, recipient_last_name, address, sub_district, district, province, zip_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $customerId,
            sanitizeValue($data['recipientFirstName'] ?? ''),
            sanitizeValue($data['recipientLastName'] ?? ''),
            sanitizeValue($data['address'] ?? ''),
            sanitizeValue($data['subdistrict'] ?? ''),
            sanitizeValue($data['district'] ?? ''),
            sanitizeValue($data['province'] ?? ''),
            sanitizeValue($data['zipCode'] ?? '')
        ]);
        
        $insertId = $pdo->lastInsertId();
        json_response(['success' => true, 'id' => $insertId]);
    }
    
    else if ($method === 'PUT') {
        $addressId = $_GET['id'] ?? null;
        if (!$addressId) {
            json_response(['error' => 'Missing address id'], 400);
        }
        
        $data = json_decode(file_get_contents('php://input'), true);
        $customerId = $data['customer_id'] ?? $data['customerId'] ?? null;
        
        if ($addressId === 'primary') {
            if (!$customerId) {
                json_response(['error' => 'Missing customerId for primary update'], 400);
            }
            // Update customers table
            $sql = "UPDATE customers SET recipient_first_name = ?, recipient_last_name = ?, street = ?, subdistrict = ?, district = ?, province = ?, postal_code = ? WHERE customer_id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                sanitizeValue($data['recipientFirstName'] ?? ''),
                sanitizeValue($data['recipientLastName'] ?? ''),
                sanitizeValue($data['address'] ?? ''),
                sanitizeValue($data['subdistrict'] ?? ''),
                sanitizeValue($data['district'] ?? ''),
                sanitizeValue($data['province'] ?? ''),
                sanitizeValue($data['zipCode'] ?? ''),
                $customerId
            ]);
            json_response(['success' => true]);
        } else {
            // Update customer_address table
            $sql = "UPDATE customer_address SET recipient_first_name = ?, recipient_last_name = ?, address = ?, sub_district = ?, district = ?, province = ?, zip_code = ? WHERE id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                sanitizeValue($data['recipientFirstName'] ?? ''),
                sanitizeValue($data['recipientLastName'] ?? ''),
                sanitizeValue($data['address'] ?? ''),
                sanitizeValue($data['subdistrict'] ?? ''),
                sanitizeValue($data['district'] ?? ''),
                sanitizeValue($data['province'] ?? ''),
                sanitizeValue($data['zipCode'] ?? ''),
                $addressId
            ]);
            json_response(['success' => true]);
        }
    }
    
    else if ($method === 'DELETE') {
        $addressId = $_GET['id'] ?? null;
        if (!$addressId || $addressId === 'primary') {
            json_response(['error' => 'Invalid address id or cannot delete primary address'], 400);
        }
        
        $sql = "DELETE FROM customer_address WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$addressId]);
        
        json_response(['success' => true]);
    }
    
    else {
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed']);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
