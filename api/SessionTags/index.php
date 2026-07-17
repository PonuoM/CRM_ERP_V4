<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

require_once '../config.php';
require_once '../auth_check.php';
require_once '../audit_logger.php';

$action = $_GET['action'] ?? '';
$companyId = $_GET['companyId'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    if ($action === 'get_tags') {
        handleGetTags($pdo, $companyId);
    } elseif ($action === 'create_tag') {
        handleCreateTag($pdo, $companyId);
    } elseif ($action === 'update_tag') {
        handleUpdateTag($pdo, $companyId);
    } elseif ($action === 'delete_tag') {
        handleDeleteTag($pdo, $companyId);
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

function handleGetTags($pdo, $companyId) {
    $stmt = $pdo->prepare("SELECT * FROM distribution_tags WHERE company_id = ? ORDER BY tag_name ASC");
    $stmt->execute([$companyId]);
    echo json_encode(['ok' => true, 'data' => $stmt->fetchAll()]);
}

function handleCreateTag($pdo, $companyId) {
    $input = json_decode(file_get_contents('php://input'), true);
    $tagName = trim($input['tag_name'] ?? '');
    $color = trim($input['color'] ?? '#E5E7EB');
    $createdBy = $input['created_by'] ?? null;

    if (!$tagName) {
        http_response_code(400);
        echo json_encode(['error' => 'Tag name is required', 'ok' => false]);
        return;
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO distribution_tags (company_id, tag_name, color, created_by) VALUES (?, ?, ?, ?)");
        $stmt->execute([$companyId, $tagName, $color, $createdBy]);
        echo json_encode(['ok' => true, 'id' => $pdo->lastInsertId(), 'message' => 'Tag created successfully']);
    } catch (PDOException $e) {
        if ($e->getCode() == 23000) { // Duplicate entry
            echo json_encode(['ok' => false, 'error' => 'ชื่อ Tag นี้มีอยู่แล้วในระบบ']);
        } else {
            throw $e;
        }
    }
}

function handleUpdateTag($pdo, $companyId) {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = $input['id'] ?? null;
    $tagName = trim($input['tag_name'] ?? '');
    $color = trim($input['color'] ?? '#E5E7EB');

    if (!$id || !$tagName) {
        http_response_code(400);
        echo json_encode(['error' => 'ID and Tag name are required', 'ok' => false]);
        return;
    }

    try {
        $stmt = $pdo->prepare("UPDATE distribution_tags SET tag_name = ?, color = ? WHERE id = ? AND company_id = ?");
        $stmt->execute([$tagName, $color, $id, $companyId]);
        echo json_encode(['ok' => true, 'message' => 'Tag updated successfully']);
    } catch (PDOException $e) {
        if ($e->getCode() == 23000) { // Duplicate entry
            echo json_encode(['ok' => false, 'error' => 'ชื่อ Tag นี้มีการใช้งานอยู่แล้ว']);
        } else {
            throw $e;
        }
    }
}

function handleDeleteTag($pdo, $companyId) {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = $input['id'] ?? null;

    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'ID is required', 'ok' => false]);
        return;
    }

    $stmt = $pdo->prepare("DELETE FROM distribution_tags WHERE id = ? AND company_id = ?");
    $stmt->execute([$id, $companyId]);
    
    echo json_encode(['ok' => true, 'message' => 'Tag deleted successfully']);
}
