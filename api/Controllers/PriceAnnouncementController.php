<?php

/**
 * Monthly price/promotion announcement — manual publishing CMS.
 * Does not affect live order calculation; orders.bill_discount stays manual.
 */
function handle_price_announcements(PDO $pdo, ?string $id): void
{
    $user = get_authenticated_user($pdo);
    if (!$user) {
        json_response(['error' => 'UNAUTHORIZED'], 401);
    }
    $authCompanyId = (int) $user['company_id'];
    $isSuperAdmin = ($user['role'] === 'Super Admin' || $user['role'] === 'Developer');

    $roleStmt = $pdo->prepare('SELECT role_id FROM users WHERE id = ?');
    $roleStmt->execute([$user['id']]);
    $authRoleId = (int) $roleStmt->fetchColumn();

    switch (method()) {
        case 'GET':
            if ($id) {
                $detail = pa_fetch_detail($pdo, (int) $id);
                if (!$detail) {
                    json_response(['error' => 'NOT_FOUND'], 404);
                    return;
                }
                if (!$isSuperAdmin && !pa_is_visible_to($pdo, (int) $id, $authCompanyId, $authRoleId)) {
                    json_response(['error' => 'FORBIDDEN'], 403);
                    return;
                }
                json_response($detail);
            } else {
                $month = $_GET['month'] ?? null;
                if (!$month) {
                    json_response(['error' => 'VALIDATION_FAILED', 'message' => 'month is required'], 400);
                    return;
                }
                $month = date('Y-m-01', strtotime($month));
                $productId = isset($_GET['product_id']) ? (int) $_GET['product_id'] : null;

                $sql = 'SELECT pa.*, p.sku, p.name AS product_name, c.name AS company_name
                        FROM price_announcements pa
                        LEFT JOIN products p ON p.id = pa.product_id
                        LEFT JOIN companies c ON c.id = pa.company_id
                        WHERE pa.month = ?';
                $params = [$month];

                if ($productId) {
                    $sql .= ' AND pa.product_id = ?';
                    $params[] = $productId;
                }

                if (!$isSuperAdmin) {
                    $sql .= ' AND (
                        pa.company_id = ?
                        OR EXISTS (SELECT 1 FROM price_announcement_visibility_companies v WHERE v.announcement_id = pa.id AND v.company_id = ?)
                        OR NOT EXISTS (SELECT 1 FROM price_announcement_visibility_companies v2 WHERE v2.announcement_id = pa.id)
                    )
                    AND (
                        NOT EXISTS (SELECT 1 FROM price_announcement_visibility_roles vr WHERE vr.announcement_id = pa.id)
                        OR EXISTS (SELECT 1 FROM price_announcement_visibility_roles vr WHERE vr.announcement_id = pa.id AND vr.role_id = ?)
                    )';
                    $params[] = $authCompanyId;
                    $params[] = $authCompanyId;
                    $params[] = $authRoleId;
                }

                $sql .= ' ORDER BY pa.id DESC';

                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $rows = $stmt->fetchAll();

                $result = [];
                foreach ($rows as $row) {
                    $result[] = pa_attach_children($pdo, $row, true);
                }
                json_response($result);
            }
            break;

        case 'POST':
            $in = json_input();

            $companyId = $isSuperAdmin
                ? (int) ($in['company_id'] ?? $in['companyId'] ?? $authCompanyId)
                : $authCompanyId;
            $productId = (int) ($in['product_id'] ?? $in['productId'] ?? 0);
            $month = $in['month'] ?? null;
            $title = trim((string) ($in['title'] ?? ''));
            $generalNotes = trim((string) ($in['general_notes'] ?? $in['generalNotes'] ?? ''));
            $tiers = $in['tiers'] ?? [];
            $discountTiers = $in['discount_tiers'] ?? $in['discountTiers'] ?? [];
            $discountNotes = $in['discount_notes'] ?? $in['discountNotes'] ?? [];
            $roleIds = $in['visibility_role_ids'] ?? $in['visibilityRoleIds'] ?? [];
            $companyIds = $in['visibility_company_ids'] ?? $in['visibilityCompanyIds'] ?? [];

            if (!$productId || !$month) {
                json_response(['error' => 'VALIDATION_FAILED', 'message' => 'product_id and month are required'], 400);
                return;
            }
            $month = date('Y-m-01', strtotime($month));

            $pdo->beginTransaction();
            try {
                $stmt = $pdo->prepare('INSERT INTO price_announcements (company_id, product_id, month, title, general_notes, created_by) VALUES (?, ?, ?, ?, ?, ?)');
                $stmt->execute([$companyId, $productId, $month, $title !== '' ? $title : null, $generalNotes !== '' ? $generalNotes : null, $user['id']]);
                $announcementId = (int) $pdo->lastInsertId();

                pa_write_children($pdo, $announcementId, $tiers, $discountTiers, $discountNotes, $roleIds, $companyIds);

                $pdo->commit();
                json_response(pa_fetch_detail($pdo, $announcementId), 201);
            } catch (Throwable $e) {
                $pdo->rollBack();
                json_response(['error' => 'CREATE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;

        case 'PUT':
        case 'PATCH':
            if (!$id) {
                json_response(['error' => 'ID_REQUIRED'], 400);
                return;
            }
            $existing = pa_fetch_detail($pdo, (int) $id);
            if (!$existing) {
                json_response(['error' => 'NOT_FOUND'], 404);
                return;
            }
            if (!$isSuperAdmin && (int) $existing['company_id'] !== $authCompanyId) {
                json_response(['error' => 'FORBIDDEN'], 403);
                return;
            }

            $in = json_input();
            $pdo->beginTransaction();
            try {
                $fields = [];
                $params = [];
                if (array_key_exists('product_id', $in) || array_key_exists('productId', $in)) {
                    $fields[] = 'product_id = ?';
                    $params[] = (int) ($in['product_id'] ?? $in['productId']);
                }
                if (array_key_exists('month', $in)) {
                    $fields[] = 'month = ?';
                    $params[] = date('Y-m-01', strtotime($in['month']));
                }
                if (array_key_exists('title', $in)) {
                    $fields[] = 'title = ?';
                    $params[] = trim((string) $in['title']) !== '' ? trim((string) $in['title']) : null;
                }
                if ($isSuperAdmin && (array_key_exists('company_id', $in) || array_key_exists('companyId', $in))) {
                    $fields[] = 'company_id = ?';
                    $params[] = (int) ($in['company_id'] ?? $in['companyId']);
                }
                if (array_key_exists('general_notes', $in) || array_key_exists('generalNotes', $in)) {
                    $notes = trim((string) ($in['general_notes'] ?? $in['generalNotes']));
                    $fields[] = 'general_notes = ?';
                    $params[] = $notes !== '' ? $notes : null;
                }
                if (!empty($fields)) {
                    $fields[] = 'updated_at = NOW()';
                    $params[] = $id;
                    $stmt = $pdo->prepare('UPDATE price_announcements SET ' . implode(', ', $fields) . ' WHERE id = ?');
                    $stmt->execute($params);
                }

                if (
                    array_key_exists('tiers', $in) || array_key_exists('discount_tiers', $in)
                    || array_key_exists('discountTiers', $in) || array_key_exists('discount_notes', $in)
                    || array_key_exists('discountNotes', $in) || array_key_exists('visibility_role_ids', $in)
                    || array_key_exists('visibilityRoleIds', $in) || array_key_exists('visibility_company_ids', $in)
                    || array_key_exists('visibilityCompanyIds', $in)
                ) {
                    pa_delete_children($pdo, (int) $id);
                    pa_write_children(
                        $pdo,
                        (int) $id,
                        $in['tiers'] ?? [],
                        $in['discount_tiers'] ?? $in['discountTiers'] ?? [],
                        $in['discount_notes'] ?? $in['discountNotes'] ?? [],
                        $in['visibility_role_ids'] ?? $in['visibilityRoleIds'] ?? [],
                        $in['visibility_company_ids'] ?? $in['visibilityCompanyIds'] ?? []
                    );
                }

                $pdo->commit();
                json_response(pa_fetch_detail($pdo, (int) $id));
            } catch (Throwable $e) {
                $pdo->rollBack();
                json_response(['error' => 'UPDATE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;

        case 'DELETE':
            if (!$id) {
                json_response(['error' => 'ID_REQUIRED'], 400);
                return;
            }
            $existing = pa_fetch_detail($pdo, (int) $id);
            if (!$existing) {
                json_response(['error' => 'NOT_FOUND'], 404);
                return;
            }
            if (!$isSuperAdmin && (int) $existing['company_id'] !== $authCompanyId) {
                json_response(['error' => 'FORBIDDEN'], 403);
                return;
            }
            try {
                $pdo->prepare('DELETE FROM price_announcements WHERE id = ?')->execute([$id]);
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                json_response(['error' => 'DELETE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;

        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function pa_is_visible_to(PDO $pdo, int $announcementId, int $companyId, int $roleId): bool
{
    $stmt = $pdo->prepare('
        SELECT
            (
                pa.company_id = ?
                OR EXISTS (SELECT 1 FROM price_announcement_visibility_companies v WHERE v.announcement_id = pa.id AND v.company_id = ?)
                OR NOT EXISTS (SELECT 1 FROM price_announcement_visibility_companies v2 WHERE v2.announcement_id = pa.id)
            )
            AND (
                NOT EXISTS (SELECT 1 FROM price_announcement_visibility_roles vr WHERE vr.announcement_id = pa.id)
                OR EXISTS (SELECT 1 FROM price_announcement_visibility_roles vr WHERE vr.announcement_id = pa.id AND vr.role_id = ?)
            ) AS visible
        FROM price_announcements pa WHERE pa.id = ?
    ');
    $stmt->execute([$companyId, $companyId, $roleId, $announcementId]);
    return (bool) $stmt->fetchColumn();
}

/** Insert tiers (+ their notes), discount tiers, discount notes, and visibility rows for an announcement. */
function pa_write_children(PDO $pdo, int $announcementId, array $tiers, array $discountTiers, array $discountNotes, array $roleIds, array $companyIds): void
{
    $tierStmt = $pdo->prepare('INSERT INTO price_announcement_tiers (announcement_id, quantity, new_total_price, sort_order) VALUES (?, ?, ?, ?)');
    $tierNoteStmt = $pdo->prepare('INSERT INTO price_announcement_tier_notes (tier_id, note_text, sort_order) VALUES (?, ?, ?)');
    foreach ($tiers as $i => $tier) {
        $tierStmt->execute([
            $announcementId,
            (int) ($tier['quantity'] ?? 0),
            (float) ($tier['new_total_price'] ?? $tier['newTotalPrice'] ?? 0),
            $i,
        ]);
        $tierId = (int) $pdo->lastInsertId();
        $notes = $tier['notes'] ?? [];
        foreach ((array) $notes as $ni => $note) {
            $note = trim((string) $note);
            if ($note === '') {
                continue;
            }
            $tierNoteStmt->execute([$tierId, $note, $ni]);
        }
    }

    $discountStmt = $pdo->prepare('INSERT INTO price_announcement_discount_tiers (announcement_id, min_amount, cod_discount_pct, transfer_discount_pct, sort_order) VALUES (?, ?, ?, ?, ?)');
    foreach ($discountTiers as $i => $dt) {
        $discountStmt->execute([
            $announcementId,
            (float) ($dt['min_amount'] ?? $dt['minAmount'] ?? 0),
            isset($dt['cod_discount_pct']) || isset($dt['codDiscountPct']) ? (float) ($dt['cod_discount_pct'] ?? $dt['codDiscountPct']) : null,
            isset($dt['transfer_discount_pct']) || isset($dt['transferDiscountPct']) ? (float) ($dt['transfer_discount_pct'] ?? $dt['transferDiscountPct']) : null,
            $i,
        ]);
    }

    $discountNoteStmt = $pdo->prepare('INSERT INTO price_announcement_discount_notes (announcement_id, note_text, sort_order) VALUES (?, ?, ?)');
    foreach ((array) $discountNotes as $i => $note) {
        $note = trim((string) $note);
        if ($note === '') {
            continue;
        }
        $discountNoteStmt->execute([$announcementId, $note, $i]);
    }

    $roleStmt = $pdo->prepare('INSERT IGNORE INTO price_announcement_visibility_roles (announcement_id, role_id) VALUES (?, ?)');
    foreach ((array) $roleIds as $roleId) {
        $roleStmt->execute([$announcementId, (int) $roleId]);
    }

    $companyStmt = $pdo->prepare('INSERT IGNORE INTO price_announcement_visibility_companies (announcement_id, company_id) VALUES (?, ?)');
    foreach ((array) $companyIds as $companyId) {
        $companyStmt->execute([$announcementId, (int) $companyId]);
    }
}

/** Remove all child rows for an announcement (tiers cascade their own notes via FK). */
function pa_delete_children(PDO $pdo, int $announcementId): void
{
    $pdo->prepare('DELETE FROM price_announcement_tiers WHERE announcement_id = ?')->execute([$announcementId]);
    $pdo->prepare('DELETE FROM price_announcement_discount_tiers WHERE announcement_id = ?')->execute([$announcementId]);
    $pdo->prepare('DELETE FROM price_announcement_discount_notes WHERE announcement_id = ?')->execute([$announcementId]);
    $pdo->prepare('DELETE FROM price_announcement_visibility_roles WHERE announcement_id = ?')->execute([$announcementId]);
    $pdo->prepare('DELETE FROM price_announcement_visibility_companies WHERE announcement_id = ?')->execute([$announcementId]);
}

/** Full detail for the edit form: header + tiers/notes + discount config + visibility selections. */
function pa_fetch_detail(PDO $pdo, int $id): ?array
{
    $stmt = $pdo->prepare('
        SELECT pa.*, p.sku, p.name AS product_name, c.name AS company_name
        FROM price_announcements pa
        LEFT JOIN products p ON p.id = pa.product_id
        LEFT JOIN companies c ON c.id = pa.company_id
        WHERE pa.id = ?
    ');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        return null;
    }
    return pa_attach_children($pdo, $row, false);
}

/**
 * Attach tiers (+notes), discount tiers/notes, and visibility selections to an announcement row.
 * When $withPreviousMonth is true, also resolves last month's same company+product announcement
 * to populate old_total_price per matching quantity (for the read-only comparison view).
 */
function pa_attach_children(PDO $pdo, array $row, bool $withPreviousMonth): array
{
    $announcementId = (int) $row['id'];

    $previousPriceByQty = [];
    if ($withPreviousMonth) {
        $prevStmt = $pdo->prepare('
            SELECT id FROM price_announcements
            WHERE company_id = ? AND product_id = ? AND month < ?
            ORDER BY month DESC, id DESC LIMIT 1
        ');
        $prevStmt->execute([$row['company_id'], $row['product_id'], $row['month']]);
        $prevId = $prevStmt->fetchColumn();
        if ($prevId) {
            $prevTiersStmt = $pdo->prepare('SELECT quantity, new_total_price FROM price_announcement_tiers WHERE announcement_id = ?');
            $prevTiersStmt->execute([$prevId]);
            foreach ($prevTiersStmt->fetchAll() as $pt) {
                $previousPriceByQty[(int) $pt['quantity']] = (float) $pt['new_total_price'];
            }
        }
    }

    $tiersStmt = $pdo->prepare('SELECT * FROM price_announcement_tiers WHERE announcement_id = ? ORDER BY sort_order, id');
    $tiersStmt->execute([$announcementId]);
    $tiers = $tiersStmt->fetchAll();
    $noteStmt = $pdo->prepare('SELECT note_text FROM price_announcement_tier_notes WHERE tier_id = ? ORDER BY sort_order, id');
    foreach ($tiers as &$tier) {
        $noteStmt->execute([$tier['id']]);
        $tier['notes'] = $noteStmt->fetchAll(PDO::FETCH_COLUMN);
        $qty = (int) $tier['quantity'];
        $tier['old_total_price'] = $previousPriceByQty[$qty] ?? null;
    }
    unset($tier);
    $row['tiers'] = $tiers;

    $discountStmt = $pdo->prepare('SELECT * FROM price_announcement_discount_tiers WHERE announcement_id = ? ORDER BY sort_order, id');
    $discountStmt->execute([$announcementId]);
    $row['discount_tiers'] = $discountStmt->fetchAll();

    $discountNoteStmt = $pdo->prepare('SELECT note_text FROM price_announcement_discount_notes WHERE announcement_id = ? ORDER BY sort_order, id');
    $discountNoteStmt->execute([$announcementId]);
    $row['discount_notes'] = $discountNoteStmt->fetchAll(PDO::FETCH_COLUMN);

    $roleStmt = $pdo->prepare('SELECT role_id FROM price_announcement_visibility_roles WHERE announcement_id = ?');
    $roleStmt->execute([$announcementId]);
    $row['visibility_role_ids'] = array_map('intval', $roleStmt->fetchAll(PDO::FETCH_COLUMN));

    $companyStmt = $pdo->prepare('SELECT company_id FROM price_announcement_visibility_companies WHERE announcement_id = ?');
    $companyStmt->execute([$announcementId]);
    $row['visibility_company_ids'] = array_map('intval', $companyStmt->fetchAll(PDO::FETCH_COLUMN));

    return $row;
}
