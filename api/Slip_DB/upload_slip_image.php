<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Set UTF-8 encoding
mb_internal_encoding("UTF-8");
mb_http_output("UTF-8");

require_once "../config.php";

try {
    // Check if file was uploaded
    if (!isset($_FILES['slip_image']) || $_FILES['slip_image']['error'] !== UPLOAD_ERR_OK) {
        echo json_encode([
            "success" => false,
            "message" => "No file uploaded or upload error occurred",
        ]);
        exit();
    }

    $file = $_FILES['slip_image'];
    $order_id = isset($_POST['order_id']) ? trim($_POST['order_id']) : '';

    if (empty($order_id)) {
        echo json_encode([
            "success" => false,
            "message" => "Order ID is required",
        ]);
        exit();
    }

    // Validate file type
    $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    $fileType = $file['type'];

    if (!in_array($fileType, $allowedTypes)) {
        echo json_encode([
            "success" => false,
            "message" => "Invalid file type. Only JPG, PNG, and GIF files are allowed",
        ]);
        exit();
    }

    // Validate file size (max 5MB)
    $maxFileSize = 5 * 1024 * 1024; // 5MB in bytes
    if ($file['size'] > $maxFileSize) {
        echo json_encode([
            "success" => false,
            "message" => "File size too large. Maximum size is 5MB",
        ]);
        exit();
    }

    // Create uploads directory if it doesn't exist
    $uploadDir = __DIR__ . '/../uploads/slips/';
    if (!file_exists($uploadDir)) {
        if (!mkdir($uploadDir, 0755, true)) {
            echo json_encode([
                "success" => false,
                "message" => "Failed to create upload directory",
            ]);
            exit();
        }
    }

    // Generate unique filename
    $fileExtension = pathinfo($file['name'], PATHINFO_EXTENSION);
    $timestamp = date('Ymd_His');
    $randomString = substr(md5(uniqid(rand(), true)), 0, 6);
    $filename = "slip_ORD-{$order_id}_{$timestamp}_{$randomString}.{$fileExtension}";
    $filepath = $uploadDir . $filename;

    // Move uploaded file
    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        echo json_encode([
            "success" => false,
            "message" => "Failed to move uploaded file",
        ]);
        exit();
    }

    // Create URL for the uploaded file
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'];
    $url = "{$protocol}://{$host}/api/uploads/slips/{$filename}";

    echo json_encode([
        "success" => true,
        "message" => "File uploaded successfully",
        "url" => $url,
        "filename" => $filename,
        "filepath" => $filepath
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
?>
