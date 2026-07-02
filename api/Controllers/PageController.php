<?php

function handle_pages(PDO $pdo, ?string $id): void
{
    $user = get_authenticated_user($pdo);
    if (!$user) {
        json_response(['error' => 'UNAUTHORIZED'], 401);
    }
    $userCompanyId = $user['company_id'];
    $isSuperAdmin = ($user['role'] === 'Super Admin' || $user['role'] === 'Developer');

    try {
        switch (method()) {
            case 'GET':
                if ($id) {
                    $stmt = $pdo->prepare('SELECT * FROM pages WHERE id = ?');
                    $stmt->execute([$id]);
                    $row = $stmt->fetch();
                    $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
                } else {
                    $mode = $_GET['mode'] ?? null;
                    if ($mode === 'distinct_sell_product_types') {
                        $stmt = $pdo->prepare('SELECT DISTINCT sell_product_type FROM pages WHERE sell_product_type IS NOT NULL AND sell_product_type != "" ORDER BY sell_product_type');
                        $stmt->execute();
                        json_response($stmt->fetchAll(PDO::FETCH_COLUMN));
                        return;
                    }
                    
                    // Secure by default: always use user's company ID unless explicitly requested otherwise (and allowed)
                    $companyId = $_GET['companyId'] ?? $userCompanyId;
                    if ($companyId != $userCompanyId && !$isSuperAdmin) {
                        $companyId = $userCompanyId;
                    }

                    $pageType = $_GET['page_type'] ?? null;
                    $checkPancakeShow = isset($_GET['CheckPancakeShow']) && $_GET['CheckPancakeShow'] == '1';

                    $sql = 'SELECT p.*, (SELECT COUNT(*) FROM marketing_user_page WHERE page_id = p.id) as marketing_user_count FROM pages p WHERE still_in_list = 1';
                    $params = [];
                    if ($companyId) {
                        $sql .= ' AND company_id = ?';
                        $params[] = $companyId;
                    }
                    if ($pageType) {
                        $sql .= ' AND page_type = ?';
                        $params[] = $pageType;
                    }
                    if (isset($_GET['active'])) {
                        $sql .= ' AND active = ?';
                        $params[] = $_GET['active'];
                    }

                    // CheckPancakeShow logic
                    if ($checkPancakeShow && $companyId) {
                        try {
                            $envStmt = $pdo->prepare("SELECT value FROM env WHERE `key` = 'PANCAKE_SHOW_IN_CREATE_ORDER' AND company_id = ?");
                            $envStmt->execute([$companyId]);
                            $envVal = $envStmt->fetchColumn();

                            // If env value is not '1', exclude pancake pages
                            if ($envVal != '1') {
                                $sql .= " AND (page_type IS NULL OR page_type != 'pancake')";
                            }
                        } catch (Throwable $e) {
                            // If env table issue, exclude by default
                            $sql .= " AND (page_type IS NULL OR page_type != 'pancake')";
                        }
                    }

                    $sql .= ' ORDER BY id DESC';
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($params);
                    json_response($stmt->fetchAll());
                }
                break;
            case 'POST':
                $in = json_input();
                $companyId = $in['companyId'] ?? $userCompanyId;
                if ($companyId != $userCompanyId && !$isSuperAdmin) {
                    $companyId = $userCompanyId;
                }
                
                $stmt = $pdo->prepare('INSERT INTO pages (name, platform, url, company_id, active) VALUES (?,?,?,?,?)');
                // default active = 1 if missing
                $active = isset($in['active']) ? (!empty($in['active']) ? 1 : 0) : 1;
                $stmt->execute([$in['name'] ?? '', $in['platform'] ?? 'Facebook', $in['url'] ?? null, $companyId, $active]);
                json_response(['id' => $pdo->lastInsertId()]);
                break;
            case 'PATCH':
                if (!$id)
                    json_response(['error' => 'ID_REQUIRED'], 400);
                $in = json_input();
                
                // Security check for patching:
                if (!$isSuperAdmin) {
                    $chk = $pdo->prepare('SELECT company_id FROM pages WHERE id = ?');
                    $chk->execute([$id]);
                    if ($chk->fetchColumn() != $userCompanyId) {
                        json_response(['error' => 'UNAUTHORIZED'], 401);
                    }
                }
                
                $stmt = $pdo->prepare('UPDATE pages SET name=COALESCE(?, name), display_name=COALESCE(?, display_name), sell_product_type=COALESCE(?, sell_product_type), platform=COALESCE(?, platform), url=COALESCE(?, url), company_id=COALESCE(?, company_id), active=COALESCE(?, active) WHERE id=?');
                $stmt->execute([
                    $in['name'] ?? null,
                    $in['display_name'] ?? null,
                    $in['sell_product_type'] ?? null,
                    $in['platform'] ?? null,
                    $in['url'] ?? null,
                    $isSuperAdmin ? ($in['companyId'] ?? null) : null,
                    isset($in['active']) ? (!empty($in['active']) ? 1 : 0) : null,
                    $id
                ]);
                json_response(['ok' => true]);
                break;
            default:
                json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
        }
    } catch (Throwable $e) {
        json_response(['error' => 'PAGES_FAILED', 'message' => $e->getMessage()], 500);
    }
}
