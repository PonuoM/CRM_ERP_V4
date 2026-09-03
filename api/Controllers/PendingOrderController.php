<?php
/**
 * ออเดอร์รอเปิด (ฝั่งเว็บ) — รายการที่เทเลบันทึก "ขายได้ที่บ้าน" ผ่านมือถือ รอมาเปิดที่บริษัท
 *
 * มือถือสร้างผ่าน CallController::pendingOrder (call/pending_order)
 * เว็บอ่าน/เปิด/ยกเลิกที่นี่ · auth แบบ Bearer เหมือน endpoint เว็บอื่น (get_authenticated_user)
 * เมนูฝั่ง frontend โผล่เฉพาะตอนเปิดปิดเบอร์ — ส่วนนี้แค่ทำงานตาม scope บริษัท
 */
class PendingOrderController
{
    public static function handle(PDO $pdo): void
    {
        $user = get_authenticated_user($pdo);
        if (!$user) {
            json_response(['ok' => false, 'error' => 'UNAUTHORIZED'], 401);
        }
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
            self::action($pdo, $user);
        } else {
            self::list($pdo, $user);
        }
    }

    private static function isSuper(array $user): bool
    {
        return in_array($user['role'] ?? '', ['Super Admin', 'Developer'], true);
    }

    /** GET — รายการออเดอร์รอเปิด (status=pending) พร้อมสินค้า + เจ้าของลูกค้า + โหมด */
    private static function list(PDO $pdo, array $user): void
    {
        $me = (int) $user['id'];
        // backoffice: เห็นของฝาก backoffice ทั้งบริษัท + self ของตัวเองด้วย (เปิดเองได้บนเว็บ)
        $where = ["po.status = 'pending'", "(po.open_mode = 'backoffice' OR (po.open_mode = 'self' AND po.agent_user_id = ?))"];
        $params = [$me];
        if (!self::isSuper($user)) {
            $where[] = 'po.company_id = ?';
            $params[] = (int) ($user['company_id'] ?? 0);
        }
        $sql = "SELECT po.id, po.customer_id, po.note, po.created_at, po.open_mode, po.agent_user_id,
                       TRIM(CONCAT(COALESCE(c.first_name,''),' ',COALESCE(c.last_name,''))) AS customer_name,
                       c.assigned_to AS owner_id,
                       TRIM(CONCAT(COALESCE(u.first_name,''),' ',COALESCE(u.last_name,''))) AS agent_name,
                       TRIM(CONCAT(COALESCE(ow.first_name,''),' ',COALESCE(ow.last_name,''))) AS owner_name
                  FROM pending_orders po
                  LEFT JOIN customers c ON c.customer_id = po.customer_id
                  LEFT JOIN users u ON u.id = po.agent_user_id
                  LEFT JOIN users ow ON ow.id = c.assigned_to
                 WHERE " . implode(' AND ', $where) . "
                 ORDER BY po.created_at DESC LIMIT 200";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // รายการสินค้าของทุกออเดอร์ในคิวเดียว
        $itemsByPo = [];
        if ($orders) {
            $ids = [];
            foreach ($orders as $o) {
                $ids[] = (int) $o['id'];
            }
            $ph = implode(',', array_fill(0, count($ids), '?'));
            $it = $pdo->prepare(
                "SELECT pending_order_id, product_id, product_name, qty, unit
                   FROM pending_order_items WHERE pending_order_id IN ($ph) ORDER BY id"
            );
            $it->execute($ids);
            foreach ($it->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $itemsByPo[(int) $r['pending_order_id']][] = [
                    'product_id' => $r['product_id'] !== null ? (int) $r['product_id'] : null,
                    'name'       => $r['product_name'],
                    'qty'        => (float) $r['qty'],
                    'unit'       => $r['unit'] ?: null,
                ];
            }
        }

        $out = array_map(function ($o) use ($itemsByPo) {
            $ownerId = $o['owner_id'] !== null ? (int) $o['owner_id'] : null;
            $agentId = (int) $o['agent_user_id'];
            // เปิดได้เมื่อ: ไม่มีเจ้าของ หรือ เจ้าของ = คนขาย (คนละคน = ล็อก ต้องโอนก่อน)
            $ownerConflict = $ownerId !== null && $ownerId !== $agentId;
            return [
                'id'             => (int) $o['id'],
                'customer_id'    => (int) $o['customer_id'],
                'customer_name'  => trim((string) $o['customer_name']) ?: 'ไม่ทราบชื่อ',
                'agent_user_id'  => $agentId,
                'agent_name'     => trim((string) $o['agent_name']) ?: null,
                'owner_id'       => $ownerId,
                'owner_name'     => trim((string) ($o['owner_name'] ?? '')) ?: null,
                'owner_conflict' => $ownerConflict,
                'open_mode'      => $o['open_mode'],
                'note'           => $o['note'] ?: null,
                'created_at'     => $o['created_at'],
                'items'          => $itemsByPo[(int) $o['id']] ?? [],
            ];
        }, $orders);

        json_response(['ok' => true, 'orders' => $out]);
    }

    /** POST { id, action: 'open'|'cancel', order_id? } — เปิด/ยกเลิกออเดอร์รอเปิด */
    private static function action(PDO $pdo, array $user): void
    {
        $in = json_input();
        $id = (int) ($in['id'] ?? 0);
        $action = (string) ($in['action'] ?? '');
        if ($id <= 0 || !in_array($action, ['open', 'cancel'], true)) {
            json_response(['ok' => false, 'error' => 'INVALID'], 400);
        }

        // ตรวจว่าเป็นออเดอร์ของบริษัทตัวเอง (กันข้ามบริษัท)
        $chk = $pdo->prepare('SELECT company_id, status FROM pending_orders WHERE id = ? LIMIT 1');
        $chk->execute([$id]);
        $row = $chk->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            json_response(['ok' => false, 'error' => 'NOT_FOUND'], 404);
        }
        if (!self::isSuper($user) && (int) $row['company_id'] !== (int) ($user['company_id'] ?? 0)) {
            json_response(['ok' => false, 'error' => 'FORBIDDEN'], 403);
        }
        if ($row['status'] !== 'pending') {
            json_response(['ok' => false, 'error' => 'ALREADY_' . strtoupper($row['status'])], 409);
        }

        if ($action === 'open') {
            $orderId = isset($in['order_id']) && $in['order_id'] ? (int) $in['order_id'] : null;
            $pdo->prepare(
                "UPDATE pending_orders
                    SET status = 'opened', opened_at = NOW(), opened_by = ?, order_id = ?
                  WHERE id = ? AND status = 'pending'"
            )->execute([(int) $user['id'], $orderId, $id]);
        } else {
            $pdo->prepare("UPDATE pending_orders SET status = 'cancelled' WHERE id = ? AND status = 'pending'")
                ->execute([$id]);
        }
        json_response(['ok' => true]);
    }
}
