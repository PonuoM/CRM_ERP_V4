<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit();
}

// Basic validations
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  echo json_encode([ 'success' => false, 'message' => 'Invalid method' ]);
  exit();
}

if (!isset($_FILES['file'])) {
  echo json_encode([ 'success' => false, 'message' => 'No file uploaded' ]);
  exit();
}

$orderId = isset($_POST['order_id']) ? preg_replace('/[^0-9]/', '', $_POST['order_id']) : '';

$file = $_FILES['file'];
if ($file['error'] !== UPLOAD_ERR_OK) {
  echo json_encode([ 'success' => false, 'message' => 'Upload error: ' . $file['error'] ]);
  exit();
}

// Security: allow only image types
$allowedMime = [ 'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp' ];

// Detect MIME using getimagesize (safe for images) with fallbacks
$mime = null;
$imgInfo = @getimagesize($file['tmp_name']);
if ($imgInfo && isset($imgInfo['mime'])) {
  $mime = $imgInfo['mime'];
} elseif (function_exists('mime_content_type')) {
  $mime = @mime_content_type($file['tmp_name']);
}
if (!$mime || !isset($allowedMime[$mime])) {
  echo json_encode([ 'success' => false, 'message' => 'Unsupported file type' ]);
  exit();
}

// Limit file size to 10MB
if ($file['size'] > 10 * 1024 * 1024) {
  echo json_encode([ 'success' => false, 'message' => 'File too large (max 10MB)' ]);
  exit();
}

// Prepare upload directory: api/uploads/slips
$baseDir = realpath(__DIR__ . '/..'); // api
if ($baseDir === false) {
  echo json_encode([ 'success' => false, 'message' => 'Invalid base path' ]);
  exit();
}
$uploadDir = $baseDir . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'slips';
if (!is_dir($uploadDir)) {
  if (!mkdir($uploadDir, 0775, true) && !is_dir($uploadDir)) {
    echo json_encode([ 'success' => false, 'message' => 'Failed to create upload directory' ]);
    exit();
  }
  // On Unix-like systems, set the directory permissions explicitly
  if (DIRECTORY_SEPARATOR === '/') { @chmod($uploadDir, 0775); }
}

// Ensure directory is writable
if (!is_writable($uploadDir)) {
  echo json_encode([ 'success' => false, 'message' => 'Upload directory is not writable: ' . $uploadDir ]);
  exit();
}

// Build a safe filename
$ext = $allowedMime[$mime];
$ts = date('Ymd_His');
try {
  $rand = bin2hex(random_bytes(4));
} catch (Exception $e) {
  $rand = bin2hex(substr(md5(uniqid((string)mt_rand(), true)), 0, 4));
}
$prefix = $orderId ? ('order_' . $orderId . '_') : '';
$filename = $prefix . $ts . '_' . $rand . '.' . $ext;
$targetPath = $uploadDir . DIRECTORY_SEPARATOR . $filename;

if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
  echo json_encode([ 'success' => false, 'message' => 'Failed to save file' ]);
  exit();
}

// On Unix-like systems, set file permission to 0644
if (DIRECTORY_SEPARATOR === '/') { @chmod($targetPath, 0644); }

// Build a public URL relative to web root
$url = '/api/uploads/slips/' . $filename;

echo json_encode([
  'success' => true,
  'message' => 'File uploaded',
  'filename' => $filename,
  'url' => $url,
]);
?>
