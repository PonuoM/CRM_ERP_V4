<?php
/**
 * API endpoint to validate address relationships
 * Checks if province, district, subdistrict, and postal code are related in the database
 */

// Include database configuration
require_once '../config.php';

// Set headers for JSON response
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode([
        'success' => false,
        'message' => 'Only POST method is allowed'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    // Get JSON input
    $data = json_decode(file_get_contents('php://input'), true);

    // Validate required fields
    if (!$data || !isset($data['province']) || !isset($data['district']) || 
        !isset($data['subdistrict']) || !isset($data['postalCode'])) {
        echo json_encode([
            'success' => false,
            'valid' => false,
            'message' => 'Missing required fields: province, district, subdistrict, postalCode'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $province = trim($data['province']);
    $district = trim($data['district']);
    $subdistrict = trim($data['subdistrict']);
    $postalCode = trim($data['postalCode']);

    // Connect to database
    $pdo = db_connect();

    // Query to validate the address relationships
    // Join all tables to verify the hierarchical relationship
    $stmt = $pdo->prepare("
        SELECT 
            p.name_th AS province_name,
            d.name_th AS district_name,
            sd.name_th AS subdistrict_name,
            sd.zip_code AS postal_code
        FROM address_sub_districts sd
        JOIN address_districts d ON sd.district_id = d.id
        JOIN address_provinces p ON d.province_id = p.id
        WHERE sd.zip_code = ?
            AND sd.name_th = ?
            AND d.name_th = ?
            AND p.name_th = ?
        LIMIT 1
    ");

    $stmt->execute([$postalCode, $subdistrict, $district, $province]);
    $result = $stmt->fetch();

    if ($result) {
        // All relationships are valid
        echo json_encode([
            'success' => true,
            'valid' => true,
            'message' => 'Address is valid',
            'details' => [
                'province' => $result['province_name'],
                'district' => $result['district_name'],
                'subdistrict' => $result['subdistrict_name'],
                'postalCode' => $result['postal_code']
            ]
        ], JSON_UNESCAPED_UNICODE);
    } else {
        // Check what went wrong - provide detailed feedback
        $details = [
            'province_match' => false,
            'district_match' => false,
            'subdistrict_match' => false,
            'postal_code_match' => false
        ];

        // Check if postal code exists
        $stmt = $pdo->prepare("SELECT * FROM address_sub_districts WHERE zip_code = ? LIMIT 1");
        $stmt->execute([$postalCode]);
        $postalCodeExists = $stmt->fetch();

        if ($postalCodeExists) {
            $details['postal_code_match'] = true;

            // Check subdistrict
            $stmt = $pdo->prepare("
                SELECT sd.*, d.name_th AS district_name, p.name_th AS province_name
                FROM address_sub_districts sd
                JOIN address_districts d ON sd.district_id = d.id
                JOIN address_provinces p ON d.province_id = p.id
                WHERE sd.zip_code = ?
            ");
            $stmt->execute([$postalCode]);
            $postalCodeData = $stmt->fetchAll();

            foreach ($postalCodeData as $row) {
                if ($row['name_th'] === $subdistrict) {
                    $details['subdistrict_match'] = true;
                }
                if ($row['district_name'] === $district) {
                    $details['district_match'] = true;
                }
                if ($row['province_name'] === $province) {
                    $details['province_match'] = true;
                }
            }

            // Get correct address for this postal code
            $correctAddresses = array_map(function($row) {
                return [
                    'province' => $row['province_name'],
                    'district' => $row['district_name'],
                    'subdistrict' => $row['name_th']
                ];
            }, $postalCodeData);

            echo json_encode([
                'success' => true,
                'valid' => false,
                'message' => 'ที่อยู่ไม่สัมพันธ์กัน กรุณาตรวจสอบและระบุที่อยู่อีกครั้ง',
                'details' => $details,
                'correctAddresses' => $correctAddresses
            ], JSON_UNESCAPED_UNICODE);
        } else {
            // Postal code doesn't exist
            echo json_encode([
                'success' => true,
                'valid' => false,
                'message' => 'ไม่พบรหัสไปรษณีย์ในระบบ กรุณาตรวจสอบและระบุที่อยู่อีกครั้ง',
                'details' => $details
            ], JSON_UNESCAPED_UNICODE);
        }
    }

} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>
