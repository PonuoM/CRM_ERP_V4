<?php
/**
 * API endpoint to query Thai address data
 * Provides various endpoints to retrieve address information
 */

// Include database configuration
require_once '../config.php';

// Set headers for JSON response
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, PATCH, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Get the requested endpoint
$endpoint = $_GET['endpoint'] ?? '';
$id = $_GET['id'] ?? '';
$search = $_GET['search'] ?? '';
$limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 100;
$offset = isset($_GET['offset']) ? (int) $_GET['offset'] : 0;

try {
    // Connect to database
    $pdo = db_connect();

    $response = ['success' => true, 'data' => []];

    switch ($endpoint) {
        case 'geographies':
            // Get all geographies or a specific one
            if ($id) {
                $stmt = $pdo->prepare("SELECT * FROM address_geographies WHERE id = ? AND deleted_at IS NULL");
                $stmt->execute([$id]);
                $response['data'] = $stmt->fetch();
            } else {
                $stmt = $pdo->prepare("
                    SELECT g.*, 
                        (SELECT COUNT(*) FROM address_provinces p WHERE p.geography_id = g.id AND p.deleted_at IS NULL) AS child_count
                    FROM address_geographies g 
                    WHERE g.deleted_at IS NULL ORDER BY g.id LIMIT ? OFFSET ?");
                $stmt->execute([$limit, $offset]);
                $response['data'] = $stmt->fetchAll();
            }
            break;

        case 'provinces':
            // Get provinces by geography or all provinces
            if ($id) {
                $stmt = $pdo->prepare("
                    SELECT p.*, 
                        (SELECT COUNT(*) FROM address_districts d WHERE d.province_id = p.id AND d.deleted_at IS NULL) AS child_count
                    FROM address_provinces p 
                    WHERE p.geography_id = ? AND p.deleted_at IS NULL ORDER BY p.name_th");
                $stmt->execute([$id]);
                $response['data'] = $stmt->fetchAll();
            } else {
                $stmt = $pdo->prepare("
                    SELECT p.*, 
                        (SELECT COUNT(*) FROM address_districts d WHERE d.province_id = p.id AND d.deleted_at IS NULL) AS child_count
                    FROM address_provinces p 
                    WHERE p.deleted_at IS NULL ORDER BY p.name_th LIMIT ? OFFSET ?");
                $stmt->execute([$limit, $offset]);
                $response['data'] = $stmt->fetchAll();
            }
            break;

        case 'districts':
            // Get districts by province or all districts
            if ($id) {
                $stmt = $pdo->prepare("
                    SELECT d.*, 
                        (SELECT COUNT(*) FROM address_sub_districts sd WHERE sd.district_id = d.id AND sd.deleted_at IS NULL) AS child_count
                    FROM address_districts d 
                    WHERE d.province_id = ? AND d.deleted_at IS NULL ORDER BY d.name_th");
                $stmt->execute([$id]);
                $response['data'] = $stmt->fetchAll();
            } else {
                $stmt = $pdo->prepare("
                    SELECT d.*, 
                        (SELECT COUNT(*) FROM address_sub_districts sd WHERE sd.district_id = d.id AND sd.deleted_at IS NULL) AS child_count
                    FROM address_districts d 
                    WHERE d.deleted_at IS NULL ORDER BY d.name_th LIMIT ? OFFSET ?");
                $stmt->execute([$limit, $offset]);
                $response['data'] = $stmt->fetchAll();
            }
            break;

        case 'sub_districts':
            // Get sub-districts by district or all sub-districts
            if ($id) {
                $stmt = $pdo->prepare("SELECT * FROM address_sub_districts WHERE district_id = ? AND deleted_at IS NULL ORDER BY name_th");
                $stmt->execute([$id]);
                $response['data'] = $stmt->fetchAll();
            } else {
                $stmt = $pdo->prepare("SELECT * FROM address_sub_districts WHERE deleted_at IS NULL ORDER BY name_th LIMIT ? OFFSET ?");
                $stmt->execute([$limit, $offset]);
                $response['data'] = $stmt->fetchAll();
            }
            break;

        case 'search':
            // Search by zip code
            if ($search) {
                $stmt = $pdo->prepare("
                    SELECT
                        sd.id, sd.name_th AS sub_district, sd.zip_code,
                        d.name_th AS district, d.id AS district_id,
                        p.name_th AS province, p.id AS province_id,
                        g.name AS geography, g.id AS geography_id
                    FROM address_sub_districts sd
                    JOIN address_districts d ON sd.district_id = d.id
                    JOIN address_provinces p ON d.province_id = p.id
                    LEFT JOIN address_geographies g ON p.geography_id = g.id
                    WHERE sd.zip_code LIKE ?
                    ORDER BY sd.name_th
                ");
                $stmt->execute([$search . '%']);
                $response['data'] = $stmt->fetchAll();
            } else {
                $response['success'] = false;
                $response['message'] = 'Search parameter is required';
            }
            break;

        case 'complete_address':
            // Get complete address hierarchy for a sub-district
            if ($id) {
                $stmt = $pdo->prepare("
                    SELECT
                        sd.id, sd.name_th AS sub_district_name, sd.name_en AS sub_district_name_en, sd.zip_code,
                        d.id AS district_id, d.name_th AS district_name, d.name_en AS district_name_en,
                        p.id AS province_id, p.name_th AS province_name, p.name_en AS province_name_en,
                        g.id AS geography_id, g.name AS geography_name
                    FROM address_sub_districts sd
                    JOIN address_districts d ON sd.district_id = d.id
                    JOIN address_provinces p ON d.province_id = p.id
                    JOIN address_geographies g ON p.geography_id = g.id
                    WHERE sd.id = ?
                ");
                $stmt->execute([$id]);
                $response['data'] = $stmt->fetch();
            } else {
                $response['success'] = false;
                $response['message'] = 'Sub-district ID is required';
            }
            break;

        case 'customer_addresses':
            // Get addresses for a specific customer (allow customer_id = 0)
            if ($id !== null && $id !== '') {
                $stmt = $pdo->prepare("SELECT * FROM customer_address WHERE customer_id = ? ORDER BY created_at DESC");
                $stmt->execute([$id]);
                $response['data'] = $stmt->fetchAll();
            } else {
                $response['success'] = false;
                $response['message'] = 'Customer ID is required';
            }
            break;

        case 'save_customer_address':
            // Save a new customer address
            $data = json_decode(file_get_contents('php://input'), true);

            if (!$data || !isset($data['customer_id']) || !isset($data['address'])) {
                $response['success'] = false;
                $response['message'] = 'Missing required fields';
                break;
            }

            try {
                $recipientFirstName = '';
                $recipientLastName = '';
                if (isset($data['recipient_first_name']) || isset($data['recipientFirstName'])) {
                    $recipientFirstName = trim((string) ($data['recipient_first_name'] ?? $data['recipientFirstName']));
                }
                if (isset($data['recipient_last_name']) || isset($data['recipientLastName'])) {
                    $recipientLastName = trim((string) ($data['recipient_last_name'] ?? $data['recipientLastName']));
                }

                $stmt = $pdo->prepare("INSERT INTO customer_address (customer_id, address, recipient_first_name, recipient_last_name, province, district, sub_district, zip_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())");
                $stmt->execute([
                    $data['customer_id'],
                    $data['address'],
                    $recipientFirstName !== '' ? $recipientFirstName : null,
                    $recipientLastName !== '' ? $recipientLastName : null,
                    $data['province'] ?? '',
                    $data['district'] ?? '',
                    $data['sub_district'] ?? '',
                    $data['zip_code'] ?? ''
                ]);

                $response['success'] = true;
                $response['message'] = 'Customer address saved successfully';
                $response['id'] = $pdo->lastInsertId();
            } catch (PDOException $e) {
                $response['success'] = false;
                $response['message'] = 'Database error: ' . $e->getMessage();
            }
            break;

        case 'set_primary_address':
            // Set an address as primary by swapping with customer's current address
            $data = json_decode(file_get_contents('php://input'), true);

            if (!$data || !isset($data['customerId']) || !isset($data['newPrimaryAddressId'])) {
                $response['success'] = false;
                $response['message'] = 'Customer ID and new primary address ID are required';
                break;
            }

            try {
                $pdo->beginTransaction();

                // Get the new primary address
                $stmt = $pdo->prepare("SELECT * FROM customer_address WHERE id = ? AND customer_id = ?");
                $stmt->execute([$data['newPrimaryAddressId'], $data['customerId']]);
                $newPrimaryAddress = $stmt->fetch();

                if (!$newPrimaryAddress) {
                    $response['success'] = false;
                    $response['message'] = 'Address not found or does not belong to this customer';
                    $pdo->rollBack();
                    break;
                }

                // Get current customer address
                // Find customer by customer_ref_id or customer_id, then select using customer_id (PK)
                $findStmt = $pdo->prepare('SELECT customer_id FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
                $findStmt->execute([$data['customerId'], is_numeric($data['customerId']) ? (int) $data['customerId'] : null]);
                $customer = $findStmt->fetch();
                if (!$customer || !$customer['customer_id']) {
                    json_response(['error' => 'Customer not found'], 404);
                    return;
                }
                $stmt = $pdo->prepare("SELECT street, province, district, subdistrict, postal_code FROM customers WHERE customer_id = ?");
                $stmt->execute([$customer['customer_id']]);
                $currentCustomerAddress = $stmt->fetch();

                $oldAddressId = null;

                // If customer has a current address, add it to customer_address table
                if ($currentCustomerAddress && $currentCustomerAddress['street']) {
                    $stmt = $pdo->prepare("INSERT INTO customer_address (customer_id, address, recipient_first_name, recipient_last_name, province, district, sub_district, zip_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())");
                    $stmt->execute([
                        $customer['customer_id'],
                        $currentCustomerAddress['street'],
                        null,
                        null,
                        $currentCustomerAddress['province'],
                        $currentCustomerAddress['district'],
                        $currentCustomerAddress['subdistrict'],
                        $currentCustomerAddress['postal_code']
                    ]);
                    $oldAddressId = $pdo->lastInsertId();
                }

                // Update customer's primary address with the new one
                $stmt = $pdo->prepare("UPDATE customers SET street = ?, province = ?, district = ?, subdistrict = ?, postal_code = ? WHERE customer_id = ?");
                $stmt->execute([
                    $newPrimaryAddress['address'],
                    $newPrimaryAddress['province'],
                    $newPrimaryAddress['district'],
                    $newPrimaryAddress['sub_district'],
                    $newPrimaryAddress['zip_code'],
                    $customer['customer_id']
                ]);

                // Delete the new primary address from customer_address table since it's now in customers table
                $stmt = $pdo->prepare("DELETE FROM customer_address WHERE id = ?");
                $stmt->execute([$data['newPrimaryAddressId']]);

                $pdo->commit();

                $response['success'] = true;
                $response['message'] = 'Primary address updated successfully';
                $response['oldAddressId'] = $oldAddressId;

            } catch (PDOException $e) {
                $pdo->rollBack();
                $response['success'] = false;
                $response['message'] = 'Database error: ' . $e->getMessage();
            }
            break;

        case 'delete_customer_address':
            // Delete a customer address
            $data = json_decode(file_get_contents('php://input'), true);

            if (!$data || !isset($data['id'])) {
                $response['success'] = false;
                $response['message'] = 'Address ID is required';
                break;
            }

            try {
                $stmt = $pdo->prepare("DELETE FROM customer_address WHERE id = ?");
                $stmt->execute([$data['id']]);

                if ($stmt->rowCount() > 0) {
                    $response['success'] = true;
                    $response['message'] = 'Customer address deleted successfully';
                } else {
                    $response['success'] = false;
                    $response['message'] = 'Address not found or already deleted';
                }
            } catch (PDOException $e) {
                $response['success'] = false;
                $response['message'] = 'Database error: ' . $e->getMessage();
            }
            break;

        case 'stats':
            // Get statistics about the address data
            $stats = [];

            $stmt = $pdo->query("SELECT COUNT(*) as count FROM address_geographies WHERE deleted_at IS NULL");
            $stats['geographies'] = $stmt->fetch()['count'];

            $stmt = $pdo->query("SELECT COUNT(*) as count FROM address_provinces WHERE deleted_at IS NULL");
            $stats['provinces'] = $stmt->fetch()['count'];

            $stmt = $pdo->query("SELECT COUNT(*) as count FROM address_districts WHERE deleted_at IS NULL");
            $stats['districts'] = $stmt->fetch()['count'];

            $stmt = $pdo->query("SELECT COUNT(*) as count FROM address_sub_districts WHERE deleted_at IS NULL");
            $stats['sub_districts'] = $stmt->fetch()['count'];

            $response['data'] = $stats;
            break;

        // ============ CRUD: Geographies ============
        case 'add_geography':
            $data = json_decode(file_get_contents('php://input'), true);
            if (!$data || empty($data['name'])) {
                $response['success'] = false;
                $response['message'] = 'กรุณาระบุชื่อภาค';
                break;
            }
            try {
                $stmt = $pdo->query("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM address_geographies");
                $nextId = $stmt->fetch()['next_id'];
                $stmt = $pdo->prepare("INSERT INTO address_geographies (id, name, created_at, updated_at) VALUES (?, ?, NOW(), NOW())");
                $stmt->execute([$nextId, $data['name']]);
                $response['data'] = ['id' => $nextId, 'name' => $data['name']];
                $response['message'] = 'เพิ่มภาคสำเร็จ';
            } catch (PDOException $e) {
                $response['success'] = false;
                $response['message'] = 'Database error: ' . $e->getMessage();
            }
            break;

        case 'update_geography':
            $data = json_decode(file_get_contents('php://input'), true);
            if (!$data || !isset($data['id']) || empty($data['name'])) {
                $response['success'] = false;
                $response['message'] = 'กรุณาระบุ ID และชื่อภาค';
                break;
            }
            try {
                $stmt = $pdo->prepare("UPDATE address_geographies SET name = ?, updated_at = NOW() WHERE id = ?");
                $stmt->execute([$data['name'], $data['id']]);
                $response['message'] = 'แก้ไขภาคสำเร็จ';
            } catch (PDOException $e) {
                $response['success'] = false;
                $response['message'] = 'Database error: ' . $e->getMessage();
            }
            break;

        case 'delete_geography':
            $data = json_decode(file_get_contents('php://input'), true);
            if (!$data || !isset($data['id'])) {
                $response['success'] = false;
                $response['message'] = 'กรุณาระบุ ID ภาค';
                break;
            }
            try {
                // Check child references
                $chk = $pdo->prepare("SELECT COUNT(*) AS cnt FROM address_provinces WHERE geography_id = ? AND deleted_at IS NULL");
                $chk->execute([$data['id']]);
                $cnt = (int) $chk->fetch()['cnt'];
                if ($cnt > 0) {
                    $response['success'] = false;
                    $response['message'] = "ไม่สามารถลบได้ เนื่องจากมีจังหวัดภายใต้ภาคนี้ {$cnt} รายการ";
                    break;
                }
                $stmt = $pdo->prepare("UPDATE address_geographies SET deleted_at = NOW() WHERE id = ?");
                $stmt->execute([$data['id']]);
                $response['message'] = 'ลบภาคสำเร็จ';
            } catch (PDOException $e) {
                $response['success'] = false;
                $response['message'] = 'Database error: ' . $e->getMessage();
            }
            break;

        // ============ CRUD: Provinces ============
        case 'add_province':
            $data = json_decode(file_get_contents('php://input'), true);
            if (!$data || empty($data['name_th'])) {
                $response['success'] = false;
                $response['message'] = 'กรุณาระบุชื่อจังหวัด (ภาษาไทย)';
                break;
            }
            try {
                $stmt = $pdo->query("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM address_provinces");
                $nextId = $stmt->fetch()['next_id'];
                $stmt = $pdo->prepare("INSERT INTO address_provinces (id, name_th, name_en, geography_id, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())");
                $stmt->execute([$nextId, $data['name_th'], $data['name_en'] ?? '', $data['geography_id'] ?? null]);
                $response['data'] = ['id' => $nextId];
                $response['message'] = 'เพิ่มจังหวัดสำเร็จ';
            } catch (PDOException $e) {
                $response['success'] = false;
                $response['message'] = 'Database error: ' . $e->getMessage();
            }
            break;

        case 'update_province':
            $data = json_decode(file_get_contents('php://input'), true);
            if (!$data || !isset($data['id']) || empty($data['name_th'])) {
                $response['success'] = false;
                $response['message'] = 'กรุณาระบุ ID และชื่อจังหวัด';
                break;
            }
            try {
                $stmt = $pdo->prepare("UPDATE address_provinces SET name_th = ?, name_en = ?, geography_id = ?, updated_at = NOW() WHERE id = ?");
                $stmt->execute([$data['name_th'], $data['name_en'] ?? '', $data['geography_id'] ?? null, $data['id']]);
                $response['message'] = 'แก้ไขจังหวัดสำเร็จ';
            } catch (PDOException $e) {
                $response['success'] = false;
                $response['message'] = 'Database error: ' . $e->getMessage();
            }
            break;

        case 'delete_province':
            $data = json_decode(file_get_contents('php://input'), true);
            if (!$data || !isset($data['id'])) {
                $response['success'] = false;
                $response['message'] = 'กรุณาระบุ ID จังหวัด';
                break;
            }
            try {
                // Check child references
                $chk = $pdo->prepare("SELECT COUNT(*) AS cnt FROM address_districts WHERE province_id = ? AND deleted_at IS NULL");
                $chk->execute([$data['id']]);
                $cnt = (int) $chk->fetch()['cnt'];
                if ($cnt > 0) {
                    $response['success'] = false;
                    $response['message'] = "ไม่สามารถลบได้ เนื่องจากมีอำเภอภายใต้จังหวัดนี้ {$cnt} รายการ";
                    break;
                }
                $stmt = $pdo->prepare("UPDATE address_provinces SET deleted_at = NOW() WHERE id = ?");
                $stmt->execute([$data['id']]);
                $response['message'] = 'ลบจังหวัดสำเร็จ';
            } catch (PDOException $e) {
                $response['success'] = false;
                $response['message'] = 'Database error: ' . $e->getMessage();
            }
            break;

        // ============ CRUD: Districts ============
        case 'add_district':
            $data = json_decode(file_get_contents('php://input'), true);
            if (!$data || empty($data['name_th']) || !isset($data['province_id'])) {
                $response['success'] = false;
                $response['message'] = 'กรุณาระบุชื่ออำเภอและจังหวัด';
                break;
            }
            try {
                // Generate contextual ID: province_id * 100 + next sequence
                $provinceId = (int) $data['province_id'];
                $stmt = $pdo->prepare("SELECT COALESCE(MAX(id), ? * 100) + 1 AS next_id FROM address_districts WHERE province_id = ?");
                $stmt->execute([$provinceId, $provinceId]);
                $nextId = $stmt->fetch()['next_id'];
                $stmt = $pdo->prepare("INSERT INTO address_districts (id, name_th, name_en, province_id, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())");
                $stmt->execute([$nextId, $data['name_th'], $data['name_en'] ?? '', $provinceId]);
                $response['data'] = ['id' => $nextId];
                $response['message'] = 'เพิ่มอำเภอสำเร็จ';
            } catch (PDOException $e) {
                $response['success'] = false;
                $response['message'] = 'Database error: ' . $e->getMessage();
            }
            break;

        case 'update_district':
            $data = json_decode(file_get_contents('php://input'), true);
            if (!$data || !isset($data['id']) || empty($data['name_th'])) {
                $response['success'] = false;
                $response['message'] = 'กรุณาระบุ ID และชื่ออำเภอ';
                break;
            }
            try {
                $stmt = $pdo->prepare("UPDATE address_districts SET name_th = ?, name_en = ?, province_id = ?, updated_at = NOW() WHERE id = ?");
                $stmt->execute([$data['name_th'], $data['name_en'] ?? '', $data['province_id'] ?? null, $data['id']]);
                $response['message'] = 'แก้ไขอำเภอสำเร็จ';
            } catch (PDOException $e) {
                $response['success'] = false;
                $response['message'] = 'Database error: ' . $e->getMessage();
            }
            break;

        case 'delete_district':
            $data = json_decode(file_get_contents('php://input'), true);
            if (!$data || !isset($data['id'])) {
                $response['success'] = false;
                $response['message'] = 'กรุณาระบุ ID อำเภอ';
                break;
            }
            try {
                // Check child references
                $chk = $pdo->prepare("SELECT COUNT(*) AS cnt FROM address_sub_districts WHERE district_id = ? AND deleted_at IS NULL");
                $chk->execute([$data['id']]);
                $cnt = (int) $chk->fetch()['cnt'];
                if ($cnt > 0) {
                    $response['success'] = false;
                    $response['message'] = "ไม่สามารถลบได้ เนื่องจากมีตำบลภายใต้อำเภอนี้ {$cnt} รายการ";
                    break;
                }
                $stmt = $pdo->prepare("UPDATE address_districts SET deleted_at = NOW() WHERE id = ?");
                $stmt->execute([$data['id']]);
                $response['message'] = 'ลบอำเภอสำเร็จ';
            } catch (PDOException $e) {
                $response['success'] = false;
                $response['message'] = 'Database error: ' . $e->getMessage();
            }
            break;

        // ============ CRUD: Sub-Districts ============
        case 'add_sub_district':
            $data = json_decode(file_get_contents('php://input'), true);
            if (!$data || empty($data['name_th']) || !isset($data['district_id'])) {
                $response['success'] = false;
                $response['message'] = 'กรุณาระบุชื่อตำบลและอำเภอ';
                break;
            }
            try {
                $districtId = (int) $data['district_id'];
                $stmt = $pdo->prepare("SELECT COALESCE(MAX(id), ? * 100) + 1 AS next_id FROM address_sub_districts WHERE district_id = ?");
                $stmt->execute([$districtId, $districtId]);
                $nextId = $stmt->fetch()['next_id'];
                $stmt = $pdo->prepare("INSERT INTO address_sub_districts (id, zip_code, name_th, name_en, district_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())");
                $stmt->execute([$nextId, $data['zip_code'] ?? '', $data['name_th'], $data['name_en'] ?? '', $districtId]);
                $response['data'] = ['id' => $nextId];
                $response['message'] = 'เพิ่มตำบลสำเร็จ';
            } catch (PDOException $e) {
                $response['success'] = false;
                $response['message'] = 'Database error: ' . $e->getMessage();
            }
            break;

        case 'update_sub_district':
            $data = json_decode(file_get_contents('php://input'), true);
            if (!$data || !isset($data['id']) || empty($data['name_th'])) {
                $response['success'] = false;
                $response['message'] = 'กรุณาระบุ ID และชื่อตำบล';
                break;
            }
            try {
                $stmt = $pdo->prepare("UPDATE address_sub_districts SET name_th = ?, name_en = ?, zip_code = ?, district_id = ?, updated_at = NOW() WHERE id = ?");
                $stmt->execute([$data['name_th'], $data['name_en'] ?? '', $data['zip_code'] ?? '', $data['district_id'] ?? null, $data['id']]);
                $response['message'] = 'แก้ไขตำบลสำเร็จ';
            } catch (PDOException $e) {
                $response['success'] = false;
                $response['message'] = 'Database error: ' . $e->getMessage();
            }
            break;

        case 'delete_sub_district':
            $data = json_decode(file_get_contents('php://input'), true);
            if (!$data || !isset($data['id'])) {
                $response['success'] = false;
                $response['message'] = 'กรุณาระบุ ID ตำบล';
                break;
            }
            try {
                $stmt = $pdo->prepare("UPDATE address_sub_districts SET deleted_at = NOW() WHERE id = ?");
                $stmt->execute([$data['id']]);
                $response['message'] = 'ลบตำบลสำเร็จ';
            } catch (PDOException $e) {
                $response['success'] = false;
                $response['message'] = 'Database error: ' . $e->getMessage();
            }
            break;

        default:
            $response['success'] = false;
            $response['message'] = 'Invalid endpoint. Available endpoints: geographies, provinces, districts, sub_districts, search, complete_address, stats, customer_addresses, save_customer_address, delete_customer_address, set_primary_address, add_geography, update_geography, delete_geography, add_province, update_province, delete_province, add_district, update_district, delete_district, add_sub_district, update_sub_district, delete_sub_district';
            break;
    }

    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error: ' . $e->getMessage()
    ]);
}
?>