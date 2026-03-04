<?php
/**
 * Export Templates API
 * Templates are GLOBAL (shared across all companies)
 * Default setting is PER-COMPANY (via export_template_defaults table)
 * 
 * GET    ?companyId=X              - List all templates with columns (+ is_default per company)
 * GET    ?companyId=X&id=X         - Get single template with columns
 * POST   ?companyId=X              - Create template with columns
 * PUT    ?companyId=X&id=X         - Update template + columns
 * DELETE ?companyId=X&id=X         - Delete template (not if default for any company)
 * POST   ?action=seed&companyId=X  - Seed default v.1 + v.2 templates
 * POST   ?action=setDefault&companyId=X&id=X - Set default for company
 */

require_once __DIR__ . '/../config.php';

cors();
header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = db_connect();
} catch (Exception $e) {
    json_response(['error' => 'DB_CONNECTION_FAILED', 'message' => $e->getMessage()], 500);
}

$method = $_SERVER['REQUEST_METHOD'];
$companyId = $_GET['companyId'] ?? null;
$id = $_GET['id'] ?? null;
$action = $_GET['action'] ?? null;

if (!$companyId) {
    json_response(['error' => 'MISSING_COMPANY_ID'], 400);
}

// Seed action
if ($action === 'seed' && $method === 'POST') {
    seed_default_templates($pdo, (int) $companyId);
    json_response(['ok' => true, 'message' => 'Templates seeded']);
}

// Set default action (per-company) — supports targetCompanyId for super admin
if ($action === 'setDefault' && $method === 'POST' && $id) {
    $targetCompany = $_GET['targetCompanyId'] ?? $companyId;
    $pdo->prepare('REPLACE INTO export_template_defaults (company_id, template_id) VALUES (?, ?)')->execute([$targetCompany, $id]);
    json_response(['ok' => true]);
}

// List all defaults (for super admin settings page)
if ($action === 'listDefaults' && $method === 'GET') {
    $stmt = $pdo->query('SELECT d.company_id, d.template_id, t.name as template_name FROM export_template_defaults d JOIN export_templates t ON d.template_id = t.id ORDER BY d.company_id');
    json_response($stmt->fetchAll());
}

switch ($method) {
    case 'GET':
        if ($id) {
            get_template($pdo, (int) $id, (int) $companyId);
        } else {
            list_templates($pdo, (int) $companyId);
        }
        break;
    case 'POST':
        create_template($pdo);
        break;
    case 'PUT':
        if (!$id)
            json_response(['error' => 'MISSING_ID'], 400);
        update_template($pdo, (int) $id);
        break;
    case 'DELETE':
        if (!$id)
            json_response(['error' => 'MISSING_ID'], 400);
        delete_template($pdo, (int) $id);
        break;
    default:
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
}

// --- Functions ---

function list_templates(PDO $pdo, int $companyId): void
{
    // Auto-seed if no templates exist at all
    $countStmt = $pdo->query('SELECT COUNT(*) FROM export_templates');
    if ((int) $countStmt->fetchColumn() === 0) {
        seed_default_templates($pdo, $companyId);
    }

    // Get the default template_id for this company
    $defStmt = $pdo->prepare('SELECT template_id FROM export_template_defaults WHERE company_id = ?');
    $defStmt->execute([$companyId]);
    $defaultTemplateId = $defStmt->fetchColumn();

    // List all templates (global)
    $stmt = $pdo->query('SELECT * FROM export_templates ORDER BY id ASC');
    $templates = $stmt->fetchAll();

    foreach ($templates as &$tpl) {
        // Mark is_default per company
        $tpl['is_default'] = ((int) $tpl['id'] === (int) $defaultTemplateId) ? 1 : 0;

        $colStmt = $pdo->prepare('SELECT * FROM export_template_columns WHERE template_id = ? ORDER BY sort_order ASC');
        $colStmt->execute([$tpl['id']]);
        $tpl['columns'] = $colStmt->fetchAll();
    }

    // Sort: default first
    usort($templates, function ($a, $b) {
        return $b['is_default'] - $a['is_default'];
    });

    json_response($templates);
}

function get_template(PDO $pdo, int $id, int $companyId): void
{
    $stmt = $pdo->prepare('SELECT * FROM export_templates WHERE id = ?');
    $stmt->execute([$id]);
    $tpl = $stmt->fetch();
    if (!$tpl)
        json_response(['error' => 'NOT_FOUND'], 404);

    // Check default for this company
    $defStmt = $pdo->prepare('SELECT template_id FROM export_template_defaults WHERE company_id = ?');
    $defStmt->execute([$companyId]);
    $defaultTemplateId = $defStmt->fetchColumn();
    $tpl['is_default'] = ((int) $tpl['id'] === (int) $defaultTemplateId) ? 1 : 0;

    $colStmt = $pdo->prepare('SELECT * FROM export_template_columns WHERE template_id = ? ORDER BY sort_order ASC');
    $colStmt->execute([$id]);
    $tpl['columns'] = $colStmt->fetchAll();

    json_response($tpl);
}

function create_template(PDO $pdo): void
{
    $in = json_input();
    if (empty($in['name']))
        json_response(['error' => 'MISSING_NAME'], 400);

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('INSERT INTO export_templates (name) VALUES (?)');
        $stmt->execute([$in['name']]);
        $templateId = (int) $pdo->lastInsertId();

        if (!empty($in['columns']) && is_array($in['columns'])) {
            insert_columns($pdo, $templateId, $in['columns']);
        }

        $pdo->commit();
        json_response(['ok' => true, 'id' => $templateId]);
    } catch (PDOException $e) {
        $pdo->rollBack();
        json_response(['error' => 'CREATE_FAILED', 'message' => $e->getMessage()], 500);
    }
}

function update_template(PDO $pdo, int $id): void
{
    $in = json_input();

    // Verify exists
    $check = $pdo->prepare('SELECT id FROM export_templates WHERE id = ?');
    $check->execute([$id]);
    if (!$check->fetch())
        json_response(['error' => 'NOT_FOUND'], 404);

    $pdo->beginTransaction();
    try {
        if (isset($in['name'])) {
            $stmt = $pdo->prepare('UPDATE export_templates SET name = ? WHERE id = ?');
            $stmt->execute([$in['name'], $id]);
        }

        if (isset($in['columns']) && is_array($in['columns'])) {
            // Delete old columns and re-insert
            $pdo->prepare('DELETE FROM export_template_columns WHERE template_id = ?')->execute([$id]);
            insert_columns($pdo, $id, $in['columns']);
        }

        $pdo->commit();
        json_response(['ok' => true]);
    } catch (PDOException $e) {
        $pdo->rollBack();
        json_response(['error' => 'UPDATE_FAILED', 'message' => $e->getMessage()], 500);
    }
}

function delete_template(PDO $pdo, int $id): void
{
    // Check exists
    $check = $pdo->prepare('SELECT id FROM export_templates WHERE id = ?');
    $check->execute([$id]);
    if (!$check->fetch())
        json_response(['error' => 'NOT_FOUND'], 404);

    // Check not default for any company
    $defCheck = $pdo->prepare('SELECT COUNT(*) FROM export_template_defaults WHERE template_id = ?');
    $defCheck->execute([$id]);
    if ((int) $defCheck->fetchColumn() > 0)
        json_response(['error' => 'CANNOT_DELETE_DEFAULT', 'message' => 'Template is set as default for one or more companies'], 400);

    $pdo->prepare('DELETE FROM export_templates WHERE id = ?')->execute([$id]);
    json_response(['ok' => true]);
}

function insert_columns(PDO $pdo, int $templateId, array $columns): void
{
    $stmt = $pdo->prepare('INSERT INTO export_template_columns (template_id, header_name, data_source, sort_order, default_value, display_mode) VALUES (?, ?, ?, ?, ?, ?)');
    foreach ($columns as $i => $col) {
        $stmt->execute([
            $templateId,
            $col['header_name'] ?? '',
            $col['data_source'] ?? '',
            $col['sort_order'] ?? $i,
            $col['default_value'] ?? null,
            $col['display_mode'] ?? 'all',
        ]);
    }
}

function seed_default_templates(PDO $pdo, int $companyId): void
{
    // Check if any templates exist globally
    $check = $pdo->query('SELECT COUNT(*) FROM export_templates');
    if ((int) $check->fetchColumn() > 0)
        return;

    // V.1 - Current 36 headers
    $v1Columns = [
        ['header_name' => 'หมายเลขออเดอร์ออนไลน์', 'data_source' => 'order.onlineOrderId'],
        ['header_name' => 'ชื่อร้านค้า', 'data_source' => 'product.shop'],
        ['header_name' => 'เวลาที่สั่งซื้อ', 'data_source' => 'order.deliveryDate'],
        ['header_name' => 'บัญชีร้านค้า', 'data_source' => ''],
        ['header_name' => 'หมายเลขใบชำระเงิน', 'data_source' => ''],
        ['header_name' => 'COD', 'data_source' => 'order.codFlag'],
        ['header_name' => 'ช่องทางชำระเงิน', 'data_source' => ''],
        ['header_name' => 'เวลาชำระเงิน', 'data_source' => ''],
        ['header_name' => 'หมายเหตุใบสั่งซื้อ', 'data_source' => 'order.notes'],
        ['header_name' => 'ข้อความจากร้านค้า', 'data_source' => ''],
        ['header_name' => 'ค่าขนส่ง', 'data_source' => ''],
        ['header_name' => 'จำนวนเงินที่ต้องชำระ', 'data_source' => 'order.totalAmount'],
        ['header_name' => 'ผู้รับสินค้า', 'data_source' => 'address.recipientFullName'],
        ['header_name' => 'นามสกุลผู้รับสินค้า', 'data_source' => ''],
        ['header_name' => 'หมายเลขโทรศัพท์', 'data_source' => 'customer.phone'],
        ['header_name' => 'หมายเลขมือถือ', 'data_source' => 'customer.phone'],
        ['header_name' => 'สถานที่', 'data_source' => 'address.street'],
        ['header_name' => 'ภูมิภาค', 'data_source' => 'address.subdistrict'],
        ['header_name' => 'อำเภอ', 'data_source' => 'address.district'],
        ['header_name' => 'จังหวัด', 'data_source' => 'address.province'],
        ['header_name' => 'รหัสไปรษณีย์', 'data_source' => 'address.postalCode'],
        ['header_name' => 'ประเทศ', 'data_source' => '', 'default_value' => 'ไทย'],
        ['header_name' => 'รับสินค้าที่ร้านหรือไม่', 'data_source' => ''],
        ['header_name' => 'รหัสสินค้าบนแพลตฟอร์ม', 'data_source' => ''],
        ['header_name' => 'รหัสสินค้าในระบบ', 'data_source' => 'product.sku'],
        ['header_name' => 'ชื่อสินค้า', 'data_source' => 'item.productName'],
        ['header_name' => 'สีและรูปแบบ', 'data_source' => ''],
        ['header_name' => 'จำนวน', 'data_source' => 'item.quantity'],
        ['header_name' => 'ราคาสินค้าต่อหน่วย', 'data_source' => 'order.totalAmount'],
        ['header_name' => 'บริษัทขนส่ง', 'data_source' => 'order.shippingProvider'],
        ['header_name' => 'หมายเลขขนส่ง', 'data_source' => 'order.trackingNumbers'],
        ['header_name' => 'เวลาส่งสินค้า', 'data_source' => ''],
        ['header_name' => 'สถานะ', 'data_source' => 'order.orderStatus'],
        ['header_name' => 'พนักงานขาย', 'data_source' => ''],
        ['header_name' => 'หมายเหตุออฟไลน์', 'data_source' => ''],
        ['header_name' => 'รูปแบบคำสั่งซื้อ', 'data_source' => ''],
        ['header_name' => 'รูปแบบการชำระ', 'data_source' => ''],
    ];

    // V.2 - 44 headers (from order_import_template.xlsx)
    $v2Columns = [
        ['header_name' => 'หมายเลขออเดอร์ออนไลน์', 'data_source' => 'order.onlineOrderId'],
        ['header_name' => 'ชื่อร้านค้า', 'data_source' => 'product.shop'],
        ['header_name' => 'เวลาที่สั่งซื้อ', 'data_source' => 'order.deliveryDate'],
        ['header_name' => 'บัญชีร้านค้า', 'data_source' => ''],
        ['header_name' => 'หมายเลขใบชำระเงิน', 'data_source' => ''],
        ['header_name' => 'COD', 'data_source' => 'order.codFlag'],
        ['header_name' => 'ช่องทางชำระเงิน', 'data_source' => ''],
        ['header_name' => 'เวลาชำระเงิน', 'data_source' => ''],
        ['header_name' => 'คลังสินค้า', 'data_source' => ''],
        ['header_name' => 'หมายเหตุใบสั่งซื้อ', 'data_source' => 'order.notes'],
        ['header_name' => 'ข้อความจากร้านค้า', 'data_source' => ''],
        ['header_name' => 'ค่าขนส่ง', 'data_source' => ''],
        ['header_name' => 'จำนวนเงินที่ต้องชำระ', 'data_source' => 'order.totalAmount'],
        ['header_name' => 'ผู้รับสินค้า', 'data_source' => 'address.recipientFullName'],
        ['header_name' => 'นามสกุลผู้รับสินค้า', 'data_source' => ''],
        ['header_name' => 'รหัสไปรษณีย์', 'data_source' => 'address.postalCode'],
        ['header_name' => 'หมายเลขโทรศัพท์', 'data_source' => 'customer.phone'],
        ['header_name' => 'หมายเลขมือถือ', 'data_source' => 'customer.phone'],
        ['header_name' => 'ประเทศ', 'data_source' => '', 'default_value' => 'ไทย'],
        ['header_name' => 'ภูมิภาค', 'data_source' => 'address.subdistrict'],
        ['header_name' => 'จังหวัด', 'data_source' => 'address.province'],
        ['header_name' => 'อำเภอ', 'data_source' => 'address.district'],
        ['header_name' => 'สถานที่', 'data_source' => 'address.street'],
        ['header_name' => 'รับสินค้าที่ร้านหรือไม่', 'data_source' => ''],
        ['header_name' => 'รหัสสินค้าบนแพลตฟอร์ม', 'data_source' => ''],
        ['header_name' => 'รหัสสินค้าในระบบ', 'data_source' => '{product.sku}-{item.quantity}'],
        ['header_name' => 'ชื่อสินค้า', 'data_source' => '{item.productName} {item.quantity}'],
        ['header_name' => 'สีและรูปแบบ', 'data_source' => ''],
        ['header_name' => 'จำนวน', 'data_source' => 'item.quantity'],
        ['header_name' => 'ราคาสินค้าต่อหน่วย', 'data_source' => 'order.totalAmount'],
        ['header_name' => 'บริษัทขนส่ง', 'data_source' => 'order.shippingProvider'],
        ['header_name' => 'หมายเลขขนส่ง', 'data_source' => 'order.trackingNumbers'],
        ['header_name' => 'เวลาส่งสินค้า', 'data_source' => ''],
        ['header_name' => 'สถานะ', 'data_source' => 'order.orderStatus'],
        ['header_name' => 'พนักงานขาย', 'data_source' => ''],
        ['header_name' => 'หมายเหตุออฟไลน์', 'data_source' => ''],
        ['header_name' => 'รูปแบบคำสั่งซื้อ', 'data_source' => ''],
        ['header_name' => 'รูปแบบการชำระ', 'data_source' => ''],
        ['header_name' => 'ประเภทใบเสร็จ', 'data_source' => ''],
        ['header_name' => 'ชื่อใบกำกับภาษี', 'data_source' => ''],
        ['header_name' => 'เลขผู้เสียภาษีอากร', 'data_source' => ''],
        ['header_name' => 'อีเมล', 'data_source' => 'customer.email'],
        ['header_name' => 'เบอร์โทรใบแจ้งหนี้', 'data_source' => ''],
        ['header_name' => 'ที่อยู่ใบแจ้งหนี้', 'data_source' => ''],
    ];

    $pdo->beginTransaction();
    try {
        // V.1 (global)
        $stmt = $pdo->prepare('INSERT INTO export_templates (name) VALUES (?)');
        $stmt->execute(['v.1']);
        $v1Id = (int) $pdo->lastInsertId();
        insert_columns($pdo, $v1Id, $v1Columns);

        // V.2 (global)
        $stmt->execute(['v.2 วันที่ 2026-03-04']);
        $v2Id = (int) $pdo->lastInsertId();
        insert_columns($pdo, $v2Id, $v2Columns);

        // Set v.1 as default for this company
        $pdo->prepare('REPLACE INTO export_template_defaults (company_id, template_id) VALUES (?, ?)')->execute([$companyId, $v1Id]);

        $pdo->commit();
    } catch (PDOException $e) {
        $pdo->rollBack();
        error_log('Seed templates failed: ' . $e->getMessage());
    }
}
