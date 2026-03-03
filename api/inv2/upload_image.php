<?php
// Image Upload API — Upload proof images for inventory documents
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

try {
    $uploadDir = __DIR__ . '/../../uploads/inv2/';
    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }

    $uploadedPaths = [];

    // Handle base64 images from JSON body
    $input = json_decode(file_get_contents('php://input'), true);
    if ($input && !empty($input['images'])) {
        foreach ($input['images'] as $idx => $base64Image) {
            if (strpos($base64Image, 'data:image') === 0) {
                // Extract base64 data
                $parts = explode(',', $base64Image, 2);
                $data = base64_decode($parts[1] ?? '');

                // Determine extension
                $ext = 'jpg';
                if (strpos($parts[0], 'png') !== false) $ext = 'png';
                elseif (strpos($parts[0], 'gif') !== false) $ext = 'gif';
                elseif (strpos($parts[0], 'webp') !== false) $ext = 'webp';

                $filename = 'inv2_' . date('Ymd_His') . '_' . uniqid() . '.' . $ext;
                $filePath = $uploadDir . $filename;
                file_put_contents($filePath, $data);

                $uploadedPaths[] = 'uploads/inv2/' . $filename;
            } elseif (strpos($base64Image, 'uploads/') === 0) {
                // Already a path, keep as is
                $uploadedPaths[] = $base64Image;
            }
        }

        echo json_encode(['success' => true, 'paths' => $uploadedPaths]);
        exit;
    }

    // Handle multipart file uploads
    if (!empty($_FILES['images'])) {
        $files = $_FILES['images'];
        $fileCount = is_array($files['name']) ? count($files['name']) : 1;

        for ($i = 0; $i < $fileCount; $i++) {
            $name = is_array($files['name']) ? $files['name'][$i] : $files['name'];
            $tmpName = is_array($files['tmp_name']) ? $files['tmp_name'][$i] : $files['tmp_name'];
            $error = is_array($files['error']) ? $files['error'][$i] : $files['error'];

            if ($error !== UPLOAD_ERR_OK) continue;

            $ext = pathinfo($name, PATHINFO_EXTENSION) ?: 'jpg';
            $filename = 'inv2_' . date('Ymd_His') . '_' . uniqid() . '.' . $ext;
            $filePath = $uploadDir . $filename;

            if (move_uploaded_file($tmpName, $filePath)) {
                $uploadedPaths[] = 'uploads/inv2/' . $filename;
            }
        }

        echo json_encode(['success' => true, 'paths' => $uploadedPaths]);
        exit;
    }

    throw new Exception('No images provided');

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
