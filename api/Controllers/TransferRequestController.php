<?php
/**
 * คำขอโอนลูกค้า — เส้นทางทดแทนหลังจาก 095 ตัดสิทธิ์เปลี่ยนเจ้าของออกจากหัวหน้าทีม
 *
 * เดิมเรื่องนี้เกิดนอกระบบทั้งหมด คุยไลน์แล้วยื่นไอทีแก้ให้ ไม่มีร่องรอยว่าใครขออะไร
 * ด้วยเหตุผลอะไร และใครอนุมัติ ที่นี่ทำให้ทั้งคำขอและการตัดสินใจกลายเป็นบันทึกในระบบ
 */

/** สิทธิ์ที่ใช้ตัดสินว่าใครกดอนุมัติได้ ตัวเดียวกับที่ใช้กันการเปลี่ยนเจ้าของตรง ๆ */
const TRANSFER_APPROVE_PERMISSION = 'customers.transfer_owner';

class TransferRequestController
{
    /** POST /api/transfer_requests — ยื่นคำขอ */
    public static function create(PDO $pdo): void
    {
        $me = get_authenticated_user($pdo);
        if (!$me) {
            json_response(['error' => 'UNAUTHORIZED'], 401);
        }

        $in = json_input();
        $customerId = trim((string) ($in['customerId'] ?? $in['customer_id'] ?? ''));
        $reason = trim((string) ($in['reason'] ?? ''));
        if ($customerId === '') {
            json_response(['error' => 'CUSTOMER_ID_REQUIRED'], 400);
        }

        $stmt = $pdo->prepare(
            'SELECT customer_id, company_id, assigned_to FROM customers WHERE customer_id = ? LIMIT 1'
        );
        $stmt->execute([$customerId]);
        $customer = $stmt->fetch();
        if (!$customer) {
            json_response(['error' => 'NOT_FOUND', 'message' => 'ไม่พบลูกค้ารายนี้'], 404);
        }

        // ขอโอนข้ามบริษัทไม่ได้ เป็นคนละชุดข้อมูลกันโดยสิ้นเชิง
        if ((int) $customer['company_id'] !== (int) ($me['company_id'] ?? 0)) {
            json_response([
                'error'   => 'FORBIDDEN',
                'message' => 'ลูกค้ารายนี้อยู่คนละบริษัท ขอโอนไม่ได้',
            ], 403);
        }

        // หัวหน้ายื่นแทนลูกทีมได้ ถ้าไม่ระบุก็ถือว่าขอมาเป็นของตัวเอง
        $requestedOwner = isset($in['requestedOwnerId']) && $in['requestedOwnerId'] !== ''
            ? (int) $in['requestedOwnerId']
            : (int) $me['id'];

        $currentOwner = $customer['assigned_to'] !== null ? (int) $customer['assigned_to'] : null;
        if ($currentOwner !== null && $currentOwner === $requestedOwner) {
            json_response([
                'error'   => 'ALREADY_OWNED',
                'message' => 'ลูกค้ารายนี้เป็นของผู้ที่ระบุอยู่แล้ว ไม่ต้องขอโอน',
            ], 409);
        }

        try {
            $ins = $pdo->prepare(
                'INSERT INTO customer_transfer_requests
                    (customer_id, company_id, requested_by, requested_owner_id, current_owner_id, reason)
                 VALUES (?, ?, ?, ?, ?, ?)'
            );
            $ins->execute([
                $customer['customer_id'],
                (int) $customer['company_id'],
                (int) $me['id'],
                $requestedOwner,
                $currentOwner,
                $reason !== '' ? $reason : null,
            ]);
        } catch (PDOException $e) {
            // ชนกับ uq_one_pending_per_customer แปลว่ามีใบที่ยังไม่ตัดสินอยู่แล้ว
            if ((int) $e->getCode() === 23000) {
                json_response([
                    'error'   => 'DUPLICATE_PENDING',
                    'message' => 'ลูกค้ารายนี้มีคำขอโอนที่รออนุมัติอยู่แล้ว',
                ], 409);
            }
            throw $e;
        }

        json_response(['ok' => true, 'id' => (int) $pdo->lastInsertId()], 201);
    }

    /** GET /api/transfer_requests?status=pending — คิวสำหรับแอดมิน และรายการของตัวเอง */
    public static function index(PDO $pdo): void
    {
        $me = get_authenticated_user($pdo);
        if (!$me) {
            json_response(['error' => 'UNAUTHORIZED'], 401);
        }

        $status = $_GET['status'] ?? 'pending';
        $canApprove = user_has_permission($pdo, (int) $me['id'], TRANSFER_APPROVE_PERMISSION);

        $where = ['r.company_id = ?'];
        $params = [(int) ($me['company_id'] ?? 0)];

        if ($status !== 'all') {
            $where[] = 'r.status = ?';
            $params[] = $status;
        }
        // คนที่อนุมัติไม่ได้ เห็นเฉพาะใบที่ตัวเองยื่นหรือใบที่ขอให้ตัวเองเป็นผู้ดูแล
        if (!$canApprove) {
            $where[] = '(r.requested_by = ? OR r.requested_owner_id = ?)';
            $params[] = (int) $me['id'];
            $params[] = (int) $me['id'];
        }

        $sql =
            "SELECT r.*,
                    TRIM(CONCAT(c.first_name, ' ', c.last_name))   AS customer_name,
                    TRIM(CONCAT(rb.first_name, ' ', rb.last_name)) AS requested_by_name,
                    TRIM(CONCAT(ro.first_name, ' ', ro.last_name)) AS requested_owner_name,
                    TRIM(CONCAT(co.first_name, ' ', co.last_name)) AS current_owner_name,
                    TRIM(CONCAT(db.first_name, ' ', db.last_name)) AS decided_by_name
             FROM customer_transfer_requests r
             LEFT JOIN customers c ON c.customer_id = r.customer_id
             LEFT JOIN users rb ON rb.id = r.requested_by
             LEFT JOIN users ro ON ro.id = r.requested_owner_id
             LEFT JOIN users co ON co.id = r.current_owner_id
             LEFT JOIN users db ON db.id = r.decided_by
             WHERE " . implode(' AND ', $where) . '
             ORDER BY r.created_at DESC
             LIMIT 200';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        json_response(['ok' => true, 'canApprove' => $canApprove, 'data' => $stmt->fetchAll()]);
    }

    /** POST /api/transfer_requests/{id}/decide — อนุมัติหรือปฏิเสธ */
    public static function decide(PDO $pdo, string $id): void
    {
        $me = get_authenticated_user($pdo);
        if (!$me || !user_has_permission($pdo, (int) $me['id'], TRANSFER_APPROVE_PERMISSION)) {
            json_response([
                'error'   => 'FORBIDDEN',
                'message' => 'ตำแหน่งของคุณอนุมัติคำขอโอนไม่ได้',
            ], 403);
        }

        $in = json_input();
        $decision = $in['decision'] ?? '';
        if (!in_array($decision, ['approved', 'rejected'], true)) {
            json_response(['error' => 'INVALID_DECISION'], 400);
        }
        $note = trim((string) ($in['note'] ?? ''));

        $pdo->beginTransaction();
        try {
            // ล็อกใบไว้ก่อน กันแอดมินสองคนกดพร้อมกันแล้วโอนซ้อน
            $stmt = $pdo->prepare(
                'SELECT * FROM customer_transfer_requests WHERE id = ? FOR UPDATE'
            );
            $stmt->execute([(int) $id]);
            $req = $stmt->fetch();
            if (!$req) {
                $pdo->rollBack();
                json_response(['error' => 'NOT_FOUND'], 404);
            }
            if ($req['status'] !== 'pending') {
                $pdo->rollBack();
                json_response([
                    'error'   => 'ALREADY_DECIDED',
                    'message' => 'คำขอใบนี้ถูกตัดสินไปแล้ว',
                ], 409);
            }

            if ($decision === 'approved') {
                // เจ้าของอาจเปลี่ยนไประหว่างรออนุมัติ จาก cron ดึงคืนรอบเดือนหรือการแจกลูกค้า
                // ถ้าไม่ตรงกับตอนยื่น แปลว่าเรื่องที่กำลังอนุมัติไม่ใช่เรื่องเดิมแล้ว ให้คนตัดสินรู้ตัว
                $cur = $pdo->prepare('SELECT assigned_to FROM customers WHERE customer_id = ? FOR UPDATE');
                $cur->execute([$req['customer_id']]);
                $nowOwner = $cur->fetchColumn();
                $nowOwner = $nowOwner === false || $nowOwner === null ? null : (int) $nowOwner;
                $thenOwner = $req['current_owner_id'] !== null ? (int) $req['current_owner_id'] : null;

                if ($nowOwner !== $thenOwner && empty($in['confirmOwnerChanged'])) {
                    $pdo->rollBack();
                    json_response([
                        'error'   => 'OWNER_CHANGED',
                        'message' => 'เจ้าของลูกค้าเปลี่ยนไปตั้งแต่ตอนยื่นคำขอ กรุณาตรวจสอบก่อนอนุมัติ',
                        'then'    => $thenOwner,
                        'now'     => $nowOwner,
                    ], 409);
                }

                set_audit_context($pdo, 'transfer_request/approve', (int) $me['id']);
                $upd = $pdo->prepare(
                    'UPDATE customers
                        SET assigned_to = ?, previous_assigned_to = ?, date_assigned = NOW()
                      WHERE customer_id = ?'
                );
                $upd->execute([
                    (int) $req['requested_owner_id'],
                    $nowOwner,
                    $req['customer_id'],
                ]);
            }

            $fin = $pdo->prepare(
                'UPDATE customer_transfer_requests
                    SET status = ?, decided_by = ?, decided_at = NOW(), decision_note = ?
                  WHERE id = ?'
            );
            $fin->execute([$decision, (int) $me['id'], $note !== '' ? $note : null, (int) $id]);

            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        json_response(['ok' => true, 'status' => $decision]);
    }

    /** POST /api/transfer_requests/{id}/cancel — คนยื่นถอนคำขอเอง */
    public static function cancel(PDO $pdo, string $id): void
    {
        $me = get_authenticated_user($pdo);
        if (!$me) {
            json_response(['error' => 'UNAUTHORIZED'], 401);
        }

        $stmt = $pdo->prepare(
            "UPDATE customer_transfer_requests
                SET status = 'cancelled'
              WHERE id = ? AND requested_by = ? AND status = 'pending'"
        );
        $stmt->execute([(int) $id, (int) $me['id']]);

        if ($stmt->rowCount() === 0) {
            json_response([
                'error'   => 'NOT_CANCELLABLE',
                'message' => 'ถอนคำขอใบนี้ไม่ได้ อาจถูกตัดสินไปแล้วหรือไม่ใช่ใบที่คุณยื่น',
            ], 409);
        }
        json_response(['ok' => true]);
    }
}
