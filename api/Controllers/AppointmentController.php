<?php

function handle_appointments(PDO $pdo, ?string $id): void
{
    switch (method()) {
        case 'GET':
            if ($id) {
                $stmt = $pdo->prepare('SELECT * FROM appointments WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            } else {
                $cid = $_GET['customerId'] ?? null;
                $assignedTo = $_GET['assignedTo'] ?? null;
                $companyId = $_GET['companyId'] ?? null;
                $dateFrom = $_GET['dateFrom'] ?? null;
                $excludeStatus = $_GET['excludeStatus'] ?? null; // Filter เพื่อกรอง status ที่ไม่ต้องการ เช่น "เสร็จสิ้น"
                $pageSize = isset($_GET['pageSize']) ? (int) $_GET['pageSize'] : 500; // Limit default to 500

                $sql = 'SELECT a.* FROM appointments a';
                $params = [];
                $wheres = [];

                // Join with customers table for filtering by assignedTo or companyId
                if ($assignedTo || $companyId) {
                    $sql .= ' JOIN customers c ON a.customer_id = c.customer_id';
                    if ($assignedTo) {
                        $wheres[] = 'c.assigned_to = ?';
                        $params[] = $assignedTo;
                    }
                    if ($companyId) {
                        $wheres[] = 'c.company_id = ?';
                        $params[] = $companyId;
                    }
                }

                if ($cid) {
                    $wheres[] = 'a.customer_id = ?';
                    $params[] = $cid;
                }

                if ($dateFrom) {
                    $wheres[] = 'a.date >= ?';
                    $params[] = $dateFrom;
                }

                // Filter เพื่อกรอง status ที่ไม่ต้องการ (เช่น "เสร็จสิ้น")
                if ($excludeStatus) {
                    $wheres[] = 'a.status != ?';
                    $params[] = $excludeStatus;
                }

                if (!empty($wheres)) {
                    $sql .= ' WHERE ' . implode(' AND ', $wheres);
                }


                $sql .= ' ORDER BY a.date DESC LIMIT ?';
                $params[] = $pageSize;

                $stmt = $pdo->prepare($sql);
                // Bind parameters with proper types (LIMIT must be INT)
                $paramCount = count($params);
                for ($i = 0; $i < $paramCount - 1; $i++) {
                    $stmt->bindValue($i + 1, $params[$i]);
                }
                $stmt->bindValue($paramCount, $pageSize, PDO::PARAM_INT);

                $stmt->execute();
                json_response($stmt->fetchAll());
            }
            break;
        case 'POST':
            $authUser = get_authenticated_user($pdo);
            $createdBy = $authUser ? $authUser['id'] : null;
            $in = json_input();
            $stmt = $pdo->prepare('INSERT INTO appointments (customer_id, date, title, status, notes, created_by) VALUES (?,?,?,?,?,?)');
            $stmt->execute([$in['customerId'] ?? null, $in['date'] ?? date('c'), $in['title'] ?? '', $in['status'] ?? 'รอดำเนินการ', $in['notes'] ?? null, $createdBy]);
            json_response(['id' => $pdo->lastInsertId()]);
            break;
        case 'PATCH':
            if (!$id) {
                json_response(['error' => 'MISSING_ID'], 400);
                return;
            }
            $in = json_input();
            $fields = [];
            $params = [];
            foreach (['customer_id' => 'customerId', 'date' => 'date', 'title' => 'title', 'status' => 'status', 'notes' => 'notes'] as $col => $key) {
                if (isset($in[$key])) {
                    $fields[] = "$col=?";
                    $params[] = $in[$key];
                }
            }
            if (!$fields) {
                json_response(['error' => 'NO_FIELDS_TO_UPDATE'], 400);
                return;
            }
            $params[] = $id;
            $sql = 'UPDATE appointments SET ' . implode(',', $fields) . ' WHERE id=?';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            json_response(['ok' => true]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

