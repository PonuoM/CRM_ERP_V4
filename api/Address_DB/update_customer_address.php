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

    $sanitizeValue = static function ($value) {
        if (is_string($value)) {
            $value = trim($value);
            $lower = strtolower($value);
            if ($lower === 'undefined' || $lower === 'null') {
                return '';
            }
            return $value;
        }
        return $value;
    };

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
    $requestedFields = [];

    $fieldMap = [
        'street' => 'street',
        'subdistrict' => 'subdistrict',
        'district' => 'district',
        'province' => 'province',
        'postal_code' => 'postal_code',
        'facebook_name' => 'facebook_name',
        'line_id' => 'line_id',
    ];

    foreach ($fieldMap as $inputKey => $column) {
        if (array_key_exists($inputKey, $data)) {
            $value = $sanitizeValue($data[$inputKey]);
            $updateFields[] = "{$column} = ?";
            $updateValues[] = $value;
            $requestedFields[$column] = $value;
        }
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

    // Retrieve the latest state regardless of affected rows
    $selectStmt = $pdo->prepare("SELECT id, first_name, last_name, phone, email, street, subdistrict, district, province, postal_code, facebook_name, line_id FROM customers WHERE id = ?");
    $selectStmt->execute([$customerId]);
    $updatedCustomer = $selectStmt->fetch(PDO::FETCH_ASSOC);

    if (!$updatedCustomer) {
        $response['message'] = 'Customer not found';
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    // Sanitize returned data for consistency
    foreach ($fieldMap as $inputKey => $column) {
        if (isset($updatedCustomer[$column])) {
            $updatedCustomer[$column] = $sanitizeValue($updatedCustomer[$column]);
        }
    }

    if ($result) {
        $affectedRows = $stmt->rowCount();

        if ($affectedRows > 0) {
            $response['success'] = true;
            $response['message'] = 'Customer address updated successfully';
            $response['data'] = $updatedCustomer;
        } else {
            // Check if the requested data already matches the stored data
            $allMatch = true;
            foreach ($requestedFields as $column => $value) {
                $currentValue = $updatedCustomer[$column] ?? '';
                if ((string)$currentValue !== (string)$value) {
                    $allMatch = false;
                    break;
                }
            }

            if ($allMatch) {
                $response['success'] = true;
                $response['message'] = 'Customer address already up to date';
                $response['data'] = $updatedCustomer;
            } else {
                $response['message'] = 'Customer not found or no changes made';
                $response['data'] = $updatedCustomer;
            }
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
