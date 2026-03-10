<?php
/**
 * upload_return_image.php
 * อัปโหลดรูปพัสดุตีกลับ ผูกกับ sub_order_id
 * Method: POST (FormData)
 * Params: sub_order_id (required), file (image)
 */

require_once __DIR__ . '/../config.php';
cors();
$pdo = db_connect();

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid method']);
    exit();
}

if (!isset($_FILES['file'])) {
    echo json_encode(['success' => false, 'message' => 'No file uploaded']);
    exit();
}

$subOrderId = $_POST['sub_order_id'] ?? '';
if (!$subOrderId) {
    echo json_encode(['success' => false, 'message' => 'sub_order_id is required']);
    exit();
}

$file = $_FILES['file'];
if ($file['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'message' => 'Upload error: ' . $file['error']]);
    exit();
}

// Security: allow only image types
$allowedMime = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

$mime = null;
$imgInfo = @getimagesize($file['tmp_name']);
if ($imgInfo && isset($imgInfo['mime'])) {
    $mime = $imgInfo['mime'];
} elseif (function_exists('mime_content_type')) {
    $mime = @mime_content_type($file['tmp_name']);
}

if (!$mime || !isset($allowedMime[$mime])) {
    echo json_encode(['success' => false, 'message' => 'Unsupported file type (jpg, png, webp only)']);
    exit();
}

// Limit file size to 10MB
if ($file['size'] > 10 * 1024 * 1024) {
    echo json_encode(['success' => false, 'message' => 'File too large (max 10MB)']);
    exit();
}

// Prepare upload directory: api/uploads/returns
$baseDir = realpath(__DIR__ . '/..');
if ($baseDir === false) {
    echo json_encode(['success' => false, 'message' => 'Invalid base path']);
    exit();
}
$uploadDir = $baseDir . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'returns';
if (!is_dir($uploadDir)) {
    if (!mkdir($uploadDir, 0775, true) && !is_dir($uploadDir)) {
        echo json_encode(['success' => false, 'message' => 'Failed to create upload directory']);
        exit();
    }
}

if (!is_writable($uploadDir)) {
    echo json_encode(['success' => false, 'message' => 'Upload directory is not writable']);
    exit();
}

// Build safe filename
$ext = $allowedMime[$mime];
$ts = date('Ymd_His');
try {
    $rand = bin2hex(random_bytes(4));
} catch (Exception $e) {
    $rand = bin2hex(substr(md5(uniqid((string)mt_rand(), true)), 0, 4));
}
$safeSubId = preg_replace('/[^a-zA-Z0-9_-]/', '_', $subOrderId);
$filename = 'return_' . $safeSubId . '_' . $ts . '_' . $rand . '.' . $ext;
$targetPath = $uploadDir . DIRECTORY_SEPARATOR . $filename;

if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
    echo json_encode(['success' => false, 'message' => 'Failed to save file']);
    exit();
}

// Build public URL
$url = '/CRM_ERP_V4/api/uploads/returns/' . $filename;

// Insert DB record
try {
    $stmt = $pdo->prepare("INSERT INTO return_images (sub_order_id, filename, url) VALUES (?, ?, ?)");
    $stmt->execute([$subOrderId, $filename, $url]);
    $imageId = $pdo->lastInsertId();

    echo json_encode([
        'success' => true,
        'status' => 'success',
        'image' => [
            'id' => (int)$imageId,
            'sub_order_id' => $subOrderId,
            'filename' => $filename,
            'url' => $url,
        ],
    ]);
} catch (Exception $e) {
    // Clean up file if DB insert fails
    @unlink($targetPath);
    echo json_encode(['success' => false, 'message' => 'DB error: ' . $e->getMessage()]);
}
