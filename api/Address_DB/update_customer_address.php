<?php
/**
 * API endpoint to update customer's main address
 * Updates the address fields in the customers table
 */

// Include database configuration
require_once '../config.php';

// Set headers for JSON response
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    // Connect to database
    $pdo = db_connect();

    $response = ['success' => false, 'message' => ''];

    // Get POST data
    $data = json_decode(file_get_contents('php://input'), true);

    // Validate required fields
    if (!$data || !isset($data['customer_id'])) {
        $response['message'] = 'Customer ID is required';
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    $customerId = $data['customer_id'];

    // Prepare update fields
    $updateFields = [];
    $updateValues = [];

    // Check for address fields and add them to update
    if (isset($data['street'])) {
        $updateFields[] = 'street = ?';
        $updateValues[] = $data['street'];
    }

    if (isset($data['subdistrict'])) {
        $updateFields[] = 'subdistrict = ?';
        $updateValues[] = $data['subdistrict'];
    }

    if (isset($data['district'])) {
        $updateFields[] = 'district = ?';
        $updateValues[] = $data['district'];
    }

    if (isset($data['province'])) {
        $updateFields[] = 'province = ?';
        $updateValues[] = $data['province'];
    }

    if (isset($data['postal_code'])) {
        $updateFields[] = 'postal_code = ?';
        $updateValues[] = $data['postal_code'];
    }

    if (isset($data['facebook_name'])) {
        $updateFields[] = 'facebook_name = ?';
        $updateValues[] = $data['facebook_name'];
    }

    if (isset($data['line_id'])) {
        $updateFields[] = 'line_id = ?';
        $updateValues[] = $data['line_id'];
    }

    // If no fields to update, return error
    if (empty($updateFields)) {
        $response['message'] = 'No fields to update';
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    // No updated_at field needed for customers table

    // Add customer_id to values for WHERE clause
    $updateValues[] = $customerId;

    // Build and execute UPDATE query
    $sql = "UPDATE customers SET " . implode(', ', $updateFields) . " WHERE id = ?";

    $stmt = $pdo->prepare($sql);
    $result = $stmt->execute($updateValues);

    if ($result) {
        $affectedRows = $stmt->rowCount();

        if ($affectedRows > 0) {
            // Get updated customer data
            $selectStmt = $pdo->prepare("SELECT id, first_name, last_name, phone, email, street, subdistrict, district, province, postal_code, facebook_name, line_id FROM customers WHERE id = ?");
            $selectStmt->execute([$customerId]);
            $updatedCustomer = $selectStmt->fetch(PDO::FETCH_ASSOC);

            $response['success'] = true;
            $response['message'] = 'Customer address updated successfully';
            $response['data'] = $updatedCustomer;
        } else {
            $response['message'] = 'Customer not found or no changes made';
        }
    } else {
        $response['message'] = 'Failed to update customer address';
    }

} catch (PDOException $e) {
    $response['message'] = 'Database error: ' . $e->getMessage();
} catch (Exception $e) {
    $response['message'] = 'Error: ' . $e->getMessage();
}

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
?>
