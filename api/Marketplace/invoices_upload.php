<?php
require_once __DIR__ . '/../config.php';

try {
    $pdo = db_connect();
    cors();
    validate_auth($pdo);

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_response(['success' => false, 'error' => 'Method not allowed']);
    }

    $company_id = $_POST['company_id'] ?? null;
    $month_year = $_POST['month_year'] ?? '';
    $platform = $_POST['platform'] ?? '';
    $store_id = !empty($_POST['store_id']) ? intval($_POST['store_id']) : null;
    $employee_id = !empty($_POST['employee_id']) ? intval($_POST['employee_id']) : null;
    $total_sales_amount = floatval($_POST['total_sales'] ?? 0);
    $actual_amount = floatval($_POST['actual_amount'] ?? 0);

    if (!$company_id || !$month_year || !$platform) {
        json_response(['success' => false, 'error' => 'Missing required fields']);
    }

    $invoice_url = $_POST['invoice_url'] ?? '';

    $file_path = null;
    if (isset($_FILES['invoice_file']) && $_FILES['invoice_file']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = __DIR__ . '/../../uploads/marketplace/invoices/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }

        $fileTmpPath = $_FILES['invoice_file']['tmp_name'];
        $fileName = $_FILES['invoice_file']['name'];
        $fileExtension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

        $allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];
        if (!in_array($fileExtension, $allowedExtensions)) {
            json_response(['success' => false, 'error' => 'Invalid file type. Allowed: PDF, JPG, PNG']);
        }

        $newFileName = 'invoice_' . $company_id . '_' . time() . '_' . uniqid() . '.' . $fileExtension;
        $destPath = $uploadDir . $newFileName;

        if (move_uploaded_file($fileTmpPath, $destPath)) {
            // Store relative path for DB
            $file_path = 'uploads/marketplace/invoices/' . $newFileName;
        } else {
            json_response(['success' => false, 'error' => 'Failed to save uploaded file']);
        }
    } else if (!empty($invoice_url)) {
        $file_path = $invoice_url;
    }

    $sql = "INSERT INTO marketplace_invoices 
            (company_id, store_id, platform, employee_id, month_year, total_sales_amount, actual_amount, file_path) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        $company_id,
        $store_id,
        $platform,
        $employee_id,
        $month_year,
        $total_sales_amount,
        $actual_amount,
        $file_path
    ]);

    json_response(['success' => true, 'invoice_id' => $pdo->lastInsertId(), 'file_path' => $file_path]);

} catch (\Throwable $e) {
    file_put_contents(__DIR__ . '/../../tmp/php_errors.log', date('Y-m-d H:i:s') . " invoices_upload error: " . $e->getMessage() . "\n", FILE_APPEND);
    json_response(['success' => false, 'error' => $e->getMessage()]);
}
