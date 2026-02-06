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

    // Check which columns exist in the customers table
    // recipient_first_name and recipient_last_name are used for primary address (profile address) in customers table
    // Additional addresses use recipient_first_name and recipient_last_name in customer_address table
    $existingColumns = [];
    $columnsToCheck = ['recipient_first_name', 'recipient_last_name', 'street', 'subdistrict', 'district', 'province', 'postal_code', 'facebook_name', 'line_id', 'birth_date'];

    // Use INFORMATION_SCHEMA to check for existing columns
    $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
    $checkColumnsSql = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customers' AND COLUMN_NAME IN (?,?,?,?,?,?,?,?,?,?)";
    $checkColumns = $pdo->prepare($checkColumnsSql);
    $params = array_merge([$dbName], $columnsToCheck);
    $checkColumns->execute($params);
    $existingColumns = $checkColumns->fetchAll(PDO::FETCH_COLUMN);

    // Prepare update fields
    $updateFields = [];
    $updateValues = [];
    $requestedFields = [];

    // Field map for customers table
    // Primary address (profile address) uses recipient_first_name and recipient_last_name from customers table
    // Additional addresses use recipient_first_name and recipient_last_name from customer_address table
    $fieldMap = [
        'recipient_first_name' => 'recipient_first_name',
        'recipient_last_name' => 'recipient_last_name',
        'street' => 'street',
        'subdistrict' => 'subdistrict',
        'district' => 'district',
        'province' => 'province',
        'postal_code' => 'postal_code',
        'facebook_name' => 'facebook_name',
        'line_id' => 'line_id',
        'birth_date' => 'birth_date',
    ];

    foreach ($fieldMap as $inputKey => $column) {
        // Only include columns that exist in the table
        if (array_key_exists($inputKey, $data) && in_array($column, $existingColumns)) {
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
    $sql = "UPDATE customers SET " . implode(', ', $updateFields) . " WHERE customer_id = ?";

    $stmt = $pdo->prepare($sql);
    $result = $stmt->execute($updateValues);

    // Retrieve the latest state regardless of affected rows
    // Build SELECT query dynamically based on existing columns
    // Note: customers table uses customer_id (PK) and customer_ref_id (public ID)
    $selectColumns = ['customer_id', 'customer_ref_id', 'first_name', 'last_name', 'phone', 'email'];
    $selectColumns = array_merge($selectColumns, $existingColumns);
    $selectColumnsStr = implode(', ', $selectColumns);
    $selectStmt = $pdo->prepare("SELECT {$selectColumnsStr} FROM customers WHERE customer_id = ?");
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
                if ((string) $currentValue !== (string) $value) {
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