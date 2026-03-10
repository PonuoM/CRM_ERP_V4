<?php
/**
 * delete_return_image.php
 * ลบรูปพัสดุตีกลับ (ลบทั้ง file + DB record)
 * Method: POST
 * Params: id (image id)
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

$input = json_decode(file_get_contents('php://input'), true);
$imageId = $input['id'] ?? 0;

if (!$imageId) {
    echo json_encode(['success' => false, 'message' => 'Image id is required']);
    exit();
}

try {
    // Get the image record first
    $stmt = $pdo->prepare("SELECT id, filename FROM return_images WHERE id = ?");
    $stmt->execute([$imageId]);
    $image = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$image) {
        echo json_encode(['success' => false, 'message' => 'Image not found']);
        exit();
    }

    // Delete file from filesystem
    $baseDir = realpath(__DIR__ . '/..');
    $filePath = $baseDir . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'returns' . DIRECTORY_SEPARATOR . $image['filename'];
    if (file_exists($filePath)) {
        @unlink($filePath);
    }

    // Delete DB record
    $stmt = $pdo->prepare("DELETE FROM return_images WHERE id = ?");
    $stmt->execute([$imageId]);

    echo json_encode(['success' => true, 'status' => 'success', 'message' => 'Image deleted']);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
