<?php

function handle_customers(PDO $pdo, ?string $id): void
{

    // Authenticate
    $user = get_authenticated_user($pdo);
    if (!$user) {
        json_response(['error' => 'UNAUTHORIZED'], 401);
    }
    $authCompanyId = $user['company_id'];
    $isSuperAdmin = ($user['role'] === 'Super Admin' || $user['role'] === 'Developer');

    // Enforce company scope for non-SuperAdmins
    if (!$isSuperAdmin) {
        $_GET['companyId'] = $authCompanyId;
    }

    switch (method()) {
        case 'GET':
            try {
                if ($id) {
                    $sql = 'SELECT customers.*, (SELECT basket_name FROM basket_config WHERE id = customers.current_basket_key) AS basket_name FROM customers WHERE (customer_id = ? OR customer_ref_id = ?)';
                    $params = [$id, $id];
                    if (!$isSuperAdmin) {
                        $sql .= ' AND company_id = ?';
                        $params[] = $authCompanyId;
                    }
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($params);
                    $cust = $stmt->fetch();
                    if (!$cust)
                        json_response(['error' => 'NOT_FOUND'], 404);
                    $tags = $pdo->prepare('SELECT t.* FROM tags t JOIN customer_tags ct ON ct.tag_id=t.id LEFT JOIN user_tags ut ON ut.tag_id = t.id WHERE ct.customer_id=? AND (ut.user_id IS NULL OR ut.user_id = ?)');
                    $tags->execute([$id, $user['id']]);
                    $cust['tags'] = $tags->fetchAll();
                    json_response($cust);
                } elseif (isset($_GET['action']) && $_GET['action'] === 'get_realtime_call_minutes') {
                    // Option 2 (Backend Proxy) for OneCall Realtime Data
                    $companyId = $_GET['companyId'] ?? null;
                    $assignedTo = $_GET['assignedTo'] ?? '';
                    $startDateStr = $_GET['start_date'] ?? null;
                    $endDateStr = $_GET['end_date'] ?? null;

                    if (!$companyId || !$assignedTo || !$startDateStr || !$endDateStr) {
                        json_response(['error' => 'Missing parameters'], 400);
                    }

                    // Enforce Max 3 days constraint for realtime to avoid timeout
                    try {
                        $startDateTime = new DateTime($startDateStr);
                        $endDateTime = new DateTime($endDateStr);
                    } catch (Exception $e) {
                        json_response(['error' => 'Invalid date format. Please provide valid start and end dates.'], 400);
                    }
                    $diff = $startDateTime->diff($endDateTime);
                    if ($diff->days > 3) {
                        json_response(['error' => 'Realtime fetch allows maximum 3 days range. Please reduce your date range.'], 400);
                    }

                    // 1. Get Agent Phones
                    $agentIds = array_map('intval', explode(',', $assignedTo));
                    if (empty($agentIds)) {
                        json_response(['agents' => []]);
                    }
                    $placeholders = implode(',', array_fill(0, count($agentIds), '?'));
                    $stmt = $pdo->prepare("SELECT id, phone FROM users WHERE id IN ($placeholders) AND phone IS NOT NULL AND phone != ''");
                    $stmt->execute($agentIds);
                    $agentsDb = $stmt->fetchAll(PDO::FETCH_ASSOC);

                    $phoneToUser = [];
                    foreach ($agentsDb as $agent) {
                        $p = preg_replace('/\D/', '', $agent['phone']);
                        if ($p) {
                            $variants = [];
                            if (strpos($p, '66') === 0 && strlen($p) > 2) {
                                $variants = [$p, '0' . substr($p, 2), '+' . $p];
                            } elseif (strpos($p, '0') === 0) {
                                $variants = [$p, '66' . substr($p, 1), '+66' . substr($p, 1)];
                            } else {
                                $variants = [$p, '0' . $p, '+66' . $p, '66' . $p];
                            }
                            foreach ($variants as $v) {
                                $phoneToUser[$v] = $agent['id'];
                            }
                        }
                    }

                    // 2. Fetch OneCall Credentials
                    $stmt = $pdo->prepare("SELECT `key`, `value` FROM `env` WHERE `key` IN (?, ?)");
                    $stmt->execute(["ONECALL_USERNAME_{$companyId}", "ONECALL_PASSWORD_{$companyId}"]);
                    $envRows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    
                    $username = '';
                    $password = '';
                    foreach ($envRows as $row) {
                        if ($row['key'] === "ONECALL_USERNAME_{$companyId}") $username = trim($row['value'], '"');
                        if ($row['key'] === "ONECALL_PASSWORD_{$companyId}") $password = trim($row['value'], '"');
                    }
                    
                    if (!$username || !$password) {
                        json_response(['error' => "Missing OneCall credentials for company $companyId"], 500);
                    }

                    // 3. Login to OneCall
                    $loginUrl = 'https://onecallvoicerecord.dtac.co.th/orktrack/rest/user/login?version=orktrack&accesspolicy=all&licenseinfo=true';
                    $ch = curl_init($loginUrl);
                    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
                    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
                    curl_setopt($ch, CURLOPT_HTTPHEADER, [
                        'Accept: application/json',
                        'Authorization: Basic ' . base64_encode("$username:$password")
                    ]);
                    $loginRes = curl_exec($ch);
                    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                    curl_close($ch);

                    if ($httpCode !== 200) {
                        json_response(['error' => "Failed to authenticate with OneCall API (HTTP $httpCode)", "res" => $loginRes], 500);
                    }
                    
                    $loginData = json_decode($loginRes, true);
                    $token = $loginData['accesstoken'] ?? null;
                    if (!$token) {
                        json_response(['error' => 'No access token received from OneCall API'], 500);
                    }

                    // 4. Fetch Recordings
                    $formatDateForOneCall = function($dateStr, $isEnd) {
                        $d = new DateTime($dateStr, new DateTimeZone('Asia/Bangkok'));
                        if ($isEnd) {
                            $d->setTime(23, 59, 59);
                        } else {
                            $d->setTime(0, 0, 0);
                        }
                        $d->modify('-7 hours'); // Convert to UTC
                        return $d->format('Ymd_His');
                    };

                    $params = http_build_query([
                        'range' => 'custom',
                        'startdate' => $formatDateForOneCall($startDateStr, false),
                        'enddate' => $formatDateForOneCall($endDateStr, true),
                        'sort' => '',
                        'page' => '1',
                        'pagesize' => '10000',
                        'maxresults' => '-1',
                        'includetags' => 'true',
                        'includemetadata' => 'true',
                        'includeprograms' => 'true'
                    ]);

                    $recUrl = "https://onecallvoicerecord.dtac.co.th/orktrack/rest/recordings?$params";
                    $ch = curl_init($recUrl);
                    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($ch, CURLOPT_TIMEOUT, 120); // Allow 2 minutes for large datasets
                    curl_setopt($ch, CURLOPT_HTTPHEADER, [
                        'Accept: application/json',
                        'Authorization: ' . $token
                    ]);
                    $recRes = curl_exec($ch);
                    $httpCodeRec = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                    curl_close($ch);

                    if ($httpCodeRec !== 200) {
                        json_response(['error' => "Failed to fetch recordings from OneCall API (HTTP $httpCodeRec)"], 500);
                    }

                    $recData = json_decode($recRes, true);
                    $recordings = $recData['objects'] ?? [];

                    // 5. Aggregate
                    $agentMinutes = [];
                    foreach ($agentIds as $id) {
                        $agentMinutes[$id] = 0;
                    }

                    foreach ($recordings as $rec) {
                        $dur = isset($rec['duration']) ? (int)$rec['duration'] : 0;
                        if ($dur < 30) continue; // Only calls >= 30s count

                        $localP = $rec['localParty'] ?? '';
                        $remoteP = $rec['remoteParty'] ?? '';

                        $localId = $phoneToUser[$localP] ?? null;
                        $remoteId = $phoneToUser[$remoteP] ?? null;

                        $matchedId = $localId ?: $remoteId;
                        if ($matchedId !== null && isset($agentMinutes[$matchedId])) {
                            $agentMinutes[$matchedId] += $dur;
                        }
                    }

                    // Convert to minutes
                    foreach ($agentMinutes as $id => $seconds) {
                        $agentMinutes[$id] = round($seconds / 60, 1);
                    }

                    json_response(['agents' => $agentMinutes]);
                } elseif (isset($_GET['action']) && $_GET['action'] === 'get_call_minutes') {
                    // Get total answered call minutes for specified agents within a date range
                    $companyId = $_GET['companyId'] ?? null;
                    $assignedToParam = $_GET['assignedTo'] ?? null;
                    $startDate = $_GET['start_date'] ?? date('Y-m-d', strtotime('-1 day'));
                    $endDate = $_GET['end_date'] ?? date('Y-m-d', strtotime('-1 day'));

                    if (!$companyId || !$assignedToParam) {
                        json_response(['error' => 'companyId and assignedTo required'], 400);
                    }

                    $agentIds = array_filter(array_map('trim', explode(',', $assignedToParam)));

                    if (empty($agentIds)) {
                        json_response(['agents' => []]);
                    }

                    $placeholders = implode(',', array_fill(0, count($agentIds), '?'));
                    
                    $sql = "
                        SELECT matched_user_id, SUM(TIME_TO_SEC(duration)) / 60 as total_minutes 
                        FROM call_import_logs 
                        WHERE call_date >= ? AND call_date <= ? 
                          AND status = 1 
                          AND matched_user_id IN ($placeholders)
                        GROUP BY matched_user_id
                    ";

                    $params = array_merge([$startDate, $endDate], $agentIds);
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($params);
                    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

                    $agentsData = [];
                    foreach ($agentIds as $aId) {
                        $agentsData[$aId] = 0;
                    }

                    foreach ($rows as $row) {
                        $aId = (string) $row['matched_user_id'];
                        if (isset($agentsData[$aId])) {
                            $agentsData[$aId] = (float) $row['total_minutes'];
                        }
                    }

                    json_response(['agents' => $agentsData]);

                } elseif (isset($_GET['action']) && $_GET['action'] === 'count_by_baskets') {
                    // Count customers by basket for specific agent(s)
                    // Support comma-separated assignedTo for bulk fetching
                    // current_basket_key now stores basket_config.id (as string)
                    $companyId = $_GET['companyId'] ?? null;
                    $assignedToParam = $_GET['assignedTo'] ?? null;

                    if (!$companyId || !$assignedToParam) {
                        json_response(['error' => 'companyId and assignedTo required'], 400);
                    }

                    $agentIds = array_filter(array_map('trim', explode(',', $assignedToParam)));

                    if (empty($agentIds)) {
                        json_response(['baskets' => [], 'total' => 0, 'agents' => []]);
                    }

                    // Get all DASHBOARD baskets with their IDs for agent table display
                    $basketStmt = $pdo->prepare("
                        SELECT bc.id, bc.basket_key, bc.basket_name
                        FROM basket_config bc
                        WHERE bc.company_id = 1 AND bc.target_page = 'dashboard_v2' AND bc.is_active = 1 
                        ORDER BY bc.id
                    ");
                    $basketStmt->execute();
                    $baskets = $basketStmt->fetchAll(PDO::FETCH_ASSOC);

                    // Create a mapping from ID -> BasketKey for aggregation
                    $idToKeyMap = [];
                    $allBasketKeys = [];
                    foreach ($baskets as $b) {
                        $key = $b['basket_key'];
                        if (!in_array($key, $allBasketKeys))
                            $allBasketKeys[] = $key;
                        $idToKeyMap[$b['id']] = $key;
                    }

                    $placeholders = implode(',', array_fill(0, count($agentIds), '?'));

                    // Bulk Query: Group by assigned_to and current_basket_key
                    $sql = "
                        SELECT assigned_to, current_basket_key, COUNT(*) as count 
                        FROM customers 
                        WHERE company_id = ? 
                          AND assigned_to IN ($placeholders)
                          AND current_basket_key IS NOT NULL
                        GROUP BY assigned_to, current_basket_key
                    ";

                    $params = array_merge([$companyId], $agentIds);
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($params);
                    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);


                    // Also get total counts per agent
                    $totalSql = "
                        SELECT assigned_to, COUNT(*) as total 
                        FROM customers 
                        WHERE company_id = ? 
                          AND assigned_to IN ($placeholders)
                        GROUP BY assigned_to
                    ";
                    $totalStmt = $pdo->prepare($totalSql);
                    $totalStmt->execute($params);
                    $totalRows = $totalStmt->fetchAll(PDO::FETCH_KEY_PAIR); // agent_id => total

                    // Structure the response
                    $agentsData = [];

                    // Initialize structure for all requested agents
                    foreach ($agentIds as $aId) {
                        $agentsData[$aId] = [
                            'baskets' => array_fill_keys($allBasketKeys, 0),
                            'total' => (int) ($totalRows[$aId] ?? 0)
                        ];
                    }

                    // Fill in aggregated counts
                    foreach ($rows as $row) {
                        $aId = (string) $row['assigned_to'];
                        $basketId = $row['current_basket_key'];
                        $count = (int) $row['count'];

                        if (isset($idToKeyMap[$basketId]) && isset($agentsData[$aId])) {
                            $basketKey = $idToKeyMap[$basketId];
                            $agentsData[$aId]['baskets'][$basketKey] += $count;
                        }
                    }

                    // --- UPSELL BASKET LOGIC ---
                    // Definition: Customers with order TODAY created by role_id=3
                    // Add 'upsell' key if not present
                    if (!in_array('upsell', $allBasketKeys)) {
                        $allBasketKeys[] = 'upsell';
                        foreach ($agentsData as &$ad) {
                            $ad['baskets']['upsell'] = 0;
                        }
                        unset($ad);
                    }

                    // Query for Upsell counts
                    $upsellSql = "
                        SELECT c.assigned_to, COUNT(DISTINCT c.customer_id) as count
                        FROM customers c
                        INNER JOIN orders o ON c.customer_id = o.customer_id
                        INNER JOIN users u ON o.creator_id = u.id
                        WHERE c.company_id = ?
                          AND c.assigned_to IN ($placeholders)
                          AND DATE(o.order_date) = CURDATE()
                          AND u.role_id = 3
                        GROUP BY c.assigned_to
                    ";

                    $upsellStmt = $pdo->prepare($upsellSql);
                    $upsellStmt->execute($params); // Re-use params as it starts with companyId then agentIds
                    $upsellRows = $upsellStmt->fetchAll(PDO::FETCH_ASSOC);

                    foreach ($upsellRows as $row) {
                        $aId = (string) $row['assigned_to'];
                        $count = (int) $row['count'];
                        if (isset($agentsData[$aId])) {
                            $agentsData[$aId]['baskets']['upsell'] = $count;
                            // Note: Upsell might overlap with other baskets in total count? 
                            // Usually existing total includes all assigned customers. 
                            // If upsell criteria is just a filter view, they are already counted in 'total'.
                        }
                    }

                    // Backward compatibility: if single ID request (and NO comma in input), return old flat format?
                    // Re-read requirement: "adjust api... then adjust response display".
                    // The safest is: if comma was present OR we want to support new frontend, return 'agents' key.
                    // But to keep old frontend working if any (unlikely here), we can check input.
                    // HOWEVER, the user explicitly said "adjust... then adjust response display".
                    // So I will return the 'agents' key. Backward compatibility for SINGLE ID:
                    // Return both formats if single ID.

                    if (count($agentIds) === 1) {
                        $singleId = (string) $agentIds[0];
                        json_response([
                            'baskets' => $agentsData[$singleId]['baskets'],
                            'total' => $agentsData[$singleId]['total'],
                            'agents' => $agentsData
                        ]);
                    } else {
                        // Bulk response
                        json_response(['agents' => $agentsData]);
                    }
                } elseif (isset($_GET['action']) && $_GET['action'] === 'counts') {
                    $t_start = microtime(true);
                    log_perf("handle_customers:counts:START");
                    // NEW: Count customers for each filter type (for counter badges)

                    $companyId = $_GET['companyId'] ?? null;
                    $assignedTo = $_GET['assignedTo'] ?? null;

                    if (!$companyId) {
                        json_response(['error' => 'Missing companyId'], 400);
                    }


                    // Detect column name with fallback - use fetch() not rowCount() for reliability
                    $customerIdCol = 'customer_id'; // Default to customer_id
                    try {
                        $testStmt = $pdo->query("SHOW COLUMNS FROM customers LIKE 'customer_id'");
                        $hasCustomerId = $testStmt && $testStmt->fetch();

                        if (!$hasCustomerId) {
                            // customer_id not found, try 'id'
                            $testStmt2 = $pdo->query("SHOW COLUMNS FROM customers LIKE 'id'");
                            $hasId = $testStmt2 && $testStmt2->fetch();
                            if ($hasId) {
                                $customerIdCol = 'id'; // Some environments use 'id'
                            }
                        }
                        // Log detected column for debugging
                        file_put_contents(__DIR__ . '/../debug_counts.log', date('Y-m-d H:i:s') . " Detected PK column: $customerIdCol\n", FILE_APPEND);
                    } catch (Exception $e) {
                        // Fallback: try to detect by querying
                        try {
                            $pdo->query("SELECT customer_id FROM customers LIMIT 1");
                            $customerIdCol = 'customer_id';
                        } catch (Exception $e2) {
                            $customerIdCol = 'id'; // Assume fallback
                        }
                        file_put_contents(__DIR__ . '/../debug_counts.log', date('Y-m-d H:i:s') . " Column detection exception, using: $customerIdCol. Error: " . $e->getMessage() . "\n", FILE_APPEND);
                    }


                    $counts = [];

                    try {
                        // Count for each filter type with simplified queries for performance
                        // 'all' count - simple base count (most used)
                        $allWhere = ["c.company_id = ?"];
                        $allParams = [$companyId];
                        if ($assignedTo && $assignedTo !== 'all') {
                            $allWhere[] = "c.assigned_to = ?";
                            $allParams[] = $assignedTo;
                        }
                        $allWhereSql = implode(' AND ', $allWhere);
                        $allStmt = $pdo->prepare("SELECT COUNT(*) FROM customers c WHERE $allWhereSql");
                        $allStmt->execute($allParams);
                        $counts['all'] = (int) $allStmt->fetchColumn();

                        // 'expiring' count - ownership expiring within 5 days
                        if ($assignedTo && $assignedTo !== 'all') {
                            $expStmt = $pdo->prepare("
                                SELECT COUNT(*) FROM customers c 
                                WHERE c.company_id = ? 
                                  AND c.assigned_to = ?
                                  AND c.ownership_expires IS NOT NULL
                                  AND c.ownership_expires >= CURDATE()
                                  AND c.ownership_expires <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
                            ");
                            $expStmt->execute([$companyId, $assignedTo]);
                            $counts['expiring'] = (int) $expStmt->fetchColumn();
                        } else {
                            $counts['expiring'] = 0;
                        }

                        // 'do' count - customers needing action (expiring OR new without activity)
                        if ($assignedTo && $assignedTo !== 'all') {
                            // Simplified: just count customers with expiring ownership or new status
                            $doStmt = $pdo->prepare("
                                SELECT COUNT(*) FROM customers c 
                                WHERE c.company_id = ? 
                                  AND c.assigned_to = ?
                                  AND (
                                      (c.lifecycle_status IN ('New', 'DailyDistribution')
                                      AND NOT EXISTS (
                                          SELECT 1 FROM call_history ch 
                                          WHERE ch.customer_id = c.customer_id 
                                          AND DATE(CONVERT_TZ(ch.date, '+00:00', '+07:00')) >= DATE(c.date_assigned)
                                      ))
                                      OR 
                                      EXISTS (
                                        SELECT 1 FROM appointments a 
                                        WHERE a.customer_id = c.customer_id 
                                        AND a.status != 'เสร็จสิ้น'
                                        AND DATE(a.date) BETWEEN DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND DATE_ADD(CURDATE(), INTERVAL 2 DAY)
                                      )
                                  )
                            ");
                            $doStmt->execute([$companyId, $assignedTo]);
                            $counts['do'] = (int) $doStmt->fetchColumn();
                        } else {
                            $counts['do'] = 0;
                        }

                        // 'updates' count - customers with recent orders from others
                        if ($assignedTo && $assignedTo !== 'all') {
                            $updStmt = $pdo->prepare("
                                SELECT COUNT(DISTINCT c.$customerIdCol) FROM customers c 
                                INNER JOIN orders o ON o.customer_id = c.$customerIdCol
                                WHERE c.company_id = ? 
                                  AND c.assigned_to = ?
                                  AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                                  AND o.creator_id != ?
                                  AND (o.order_status IS NULL OR o.order_status != 'Cancelled')
                            ");
                            $updStmt->execute([$companyId, $assignedTo, $assignedTo]);
                            $counts['updates'] = (int) $updStmt->fetchColumn();
                        } else {
                            $counts['updates'] = 0;
                        }

                        file_put_contents(__DIR__ . '/../debug_counts.log', date('Y-m-d H:i:s') . " Counts success: " . json_encode($counts) . "\n", FILE_APPEND);

                    } catch (Exception $e) {
                        file_put_contents(__DIR__ . '/../debug_counts.log', date('Y-m-d H:i:s') . " Counts error: " . $e->getMessage() . "\n", FILE_APPEND);
                        // Return zeros on error rather than failing completely
                        $counts = ['all' => 0, 'do' => 0, 'expiring' => 0, 'updates' => 0];
                    }
                    log_perf("handle_customers:counts:END", $t_start);
                    json_response(['counts' => $counts]);
                } elseif (isset($_GET['action']) && $_GET['action'] === 'check_duplicate') {
                    // Pre-save duplicate check for AddCustomerSimpleModal.
                    // Matches input phone against customers.phone AND customers.backup_phone
                    // using last-9-digit substring match (covers 10-digit "0XXXXXXXXX",
                    // 9-digit "XXXXXXXXX", and backup_phone lists with any separator).
                    $phoneIn = trim((string)($_GET['phone'] ?? ''));
                    $companyId = $_GET['companyId'] ?? null;

                    if ($phoneIn === '' || !$companyId) {
                        json_response(['matches' => []]);
                    }

                    // Normalize: digits-only, strip leading zeros → last 9 digits expected for Thai mobile
                    $digits = preg_replace('/\D/', '', $phoneIn);
                    $core = ltrim($digits, '0');
                    if (strlen($core) < 9) {
                        // Not enough digits to safely match — avoid false positives like matching every customer
                        json_response(['matches' => []]);
                    }
                    // Use only the last 9 digits to ignore any country-code prefix like "66"
                    $needle = substr($core, -9);
                    $pattern = '%' . $needle . '%';

                    try {
                        $sql = "
                            SELECT
                                c.customer_id,
                                c.customer_ref_id,
                                c.first_name,
                                c.last_name,
                                c.phone,
                                c.backup_phone,
                                c.assigned_to,
                                c.lifecycle_status,
                                c.current_basket_key,
                                c.ownership_expires,
                                u.first_name AS assigned_first_name,
                                u.last_name  AS assigned_last_name
                            FROM customers c
                            LEFT JOIN users u ON u.id = c.assigned_to
                            WHERE c.company_id = ?
                              AND (c.phone LIKE ? OR c.backup_phone LIKE ?)
                            ORDER BY (c.assigned_to IS NULL) ASC, c.customer_id DESC
                            LIMIT 10
                        ";
                        $stmt = $pdo->prepare($sql);
                        $stmt->execute([$companyId, $pattern, $pattern]);
                        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

                        $matches = [];
                        foreach ($rows as $r) {
                            $assignedName = null;
                            if (!empty($r['assigned_to'])) {
                                $fn = trim((string)($r['assigned_first_name'] ?? ''));
                                $ln = trim((string)($r['assigned_last_name'] ?? ''));
                                $assignedName = trim($fn . ' ' . $ln);
                                if ($assignedName === '') {
                                    $assignedName = null;
                                }
                            }
                            // Determine which field matched (helps the UI explain why)
                            $matchedField = null;
                            if (!empty($r['phone']) && strpos(preg_replace('/\D/', '', (string)$r['phone']), $needle) !== false) {
                                $matchedField = 'phone';
                            } elseif (!empty($r['backup_phone']) && strpos(preg_replace('/\D/', '', (string)$r['backup_phone']), $needle) !== false) {
                                $matchedField = 'backup_phone';
                            }
                            $matches[] = [
                                'customer_id'        => $r['customer_id'],
                                'customer_ref_id'    => $r['customer_ref_id'],
                                'first_name'         => $r['first_name'],
                                'last_name'          => $r['last_name'],
                                'phone'              => $r['phone'],
                                'backup_phone'       => $r['backup_phone'],
                                'assigned_to'        => $r['assigned_to'] !== null ? (int)$r['assigned_to'] : null,
                                'assigned_to_name'   => $assignedName,
                                'lifecycle_status'   => $r['lifecycle_status'],
                                'current_basket_key' => $r['current_basket_key'],
                                'ownership_expires'  => $r['ownership_expires'],
                                'matched_field'      => $matchedField,
                            ];
                        }
                        json_response(['matches' => $matches]);
                    } catch (Throwable $e) {
                        error_log('check_duplicate error: ' . $e->getMessage());
                        json_response(['matches' => [], 'error' => 'QUERY_FAILED'], 500);
                    }
                } else {
                    $t_list_start = microtime(true);
                    log_perf("handle_customers:list:START");
                    require_once __DIR__ . '/../customer/distribution_helper.php';
                    error_log("[customers:list] START memory=" . round(memory_get_usage(true) / 1024 / 1024, 1) . "MB peak=" . round(memory_get_peak_usage(true) / 1024 / 1024, 1) . "MB");
                    $q = $_GET['q'] ?? '';
                    $companyId = $_GET['companyId'] ?? null;
                    $bucket = $_REQUEST['bucket'] ?? $_GET['bucket'] ?? null;
                    $userId = $_REQUEST['userId'] ?? $_GET['userId'] ?? null;
                    $sourceReq = $_REQUEST['source'] ?? $_GET['source'] ?? null;
                    $source = isset($sourceReq) ? strtolower(trim((string) $sourceReq)) : null;

                    // DEBUG: Log the received source
                    file_put_contents(__DIR__ . '/../debug_check.log', date('Y-m-d H:i:s') . " Source: " . ($source ?? 'NULL') . "\n", FILE_APPEND);
                    $freshDays = isset($_GET['freshDays']) ? (int) $_GET['freshDays'] : 7; // for new_sale freshness window

                    if ($bucket === 'NewForMe') {
                        if (!$userId)
                            json_response(['error' => 'USER_ID_REQUIRED'], 400);
                        $sql = 'SELECT c.*
                                FROM customers c
                                JOIN users u ON u.id = ?
                                WHERE c.assigned_to = ?
                                  AND EXISTS (SELECT 1 FROM customer_assignment_history h WHERE h.customer_id=c.customer_id AND h.user_id=?)
                                  AND NOT EXISTS (
                                       SELECT 1 FROM call_history ch
                                       WHERE ch.customer_id=c.customer_id AND ch.caller = CONCAT(u.first_name, " ", u.last_name)
                                  )';
                        $params = [$userId, $userId, $userId];
                        if ($companyId) {
                            $sql .= ' AND c.company_id = ?';
                            $params[] = $companyId;
                        }
                        if ($q !== '') {
                            $searchResult = build_customer_search_conditions($q, 'c');
                            if (!empty($searchResult['conditions'])) {
                                $sql .= ' AND ' . $searchResult['conditions'][0];
                                $params = array_merge($params, $searchResult['params']);
                            }
                        }
                        $sql .= ' ORDER BY c.date_assigned DESC';
                        $stmt = $pdo->prepare($sql);
                        $stmt->execute($params);
                        $customers = $stmt->fetchAll();

                        // Add tags to each customer
                        foreach ($customers as &$customer) {
                            $tagsStmt = $pdo->prepare('SELECT t.* FROM tags t JOIN customer_tags ct ON ct.tag_id=t.id LEFT JOIN user_tags ut ON ut.tag_id = t.id WHERE ct.customer_id=? AND (ut.user_id IS NULL OR ut.user_id = ?)');
                            $tagsStmt->execute([$customer['customer_id'], $user['id']]); // Use customer_id
                            $customer['tags'] = $tagsStmt->fetchAll();
                        }

                        // Attach next appointment data for each customer
                        attach_next_appointments_to_customers($pdo, $customers);
                        // Attach call status (by current owner)
                        attach_call_status_to_customers($pdo, $customers);

                        json_response($customers);
                    } elseif (in_array($source, ['new_sale', 'waiting_return', 'stock', 'all'], true)) {
                        // Source-specific pools using shared helper
                        $parts = [];
                        if ($source === 'new_sale') {
                            $parts = DistributionHelper::getNewSaleParts($companyId, $freshDays, $q);
                        } elseif ($source === 'waiting_return') {
                            $parts = DistributionHelper::getWaitingReturnParts($companyId, $q);
                        } elseif ($source === 'stock') {
                            $parts = DistributionHelper::getStockParts($companyId, $freshDays, $q);
                        } else { // all
                            $parts = DistributionHelper::getGeneralPoolParts($companyId, $q);
                        }

                        $sql = "SELECT c.* FROM customers c " . $parts['join'] . " WHERE " . $parts['where'];
                        if (!empty($parts['groupBy'])) {
                            $sql .= " " . $parts['groupBy'];
                        }
                        $sql .= " " . $parts['orderBy'];

                        $page = isset($_GET['page']) ? (int) $_GET['page'] : null;
                        $limit = isset($_GET['pageSize']) ? (int) $_GET['pageSize'] : (isset($_GET['limit']) ? (int) $_GET['limit'] : 50);
                        if ($limit <= 0)
                            $limit = 50;

                        $params = $parts['params'];

                        // Apply pagination if requested
                        if ($page !== null) {
                            $offset = ($page - 1) * $limit;
                            $sql .= " LIMIT ? OFFSET ?";
                            $params[] = $limit;
                            $params[] = $offset;
                        }

                        $stmt = $pdo->prepare($sql);
                        $stmt->execute($params);
                        $customers = $stmt->fetchAll();

                        // Add tags to each customer
                        foreach ($customers as &$customer) {
                            $tagsStmt = $pdo->prepare('SELECT t.* FROM tags t JOIN customer_tags ct ON ct.tag_id=t.id LEFT JOIN user_tags ut ON ut.tag_id = t.id WHERE ct.customer_id=? AND (ut.user_id IS NULL OR ut.user_id = ?)');
                            $tagsStmt->execute([$customer['customer_id'], $user['id']]);
                            $customer['tags'] = $tagsStmt->fetchAll();
                        }

                        // DEBUG: Log result count
                        file_put_contents(__DIR__ . '/../debug_check.log', date('Y-m-d H:i:s') . " Result Count for $source: " . count($customers) . "\n", FILE_APPEND);

                        // Attach next appointment data for each customer
                        attach_next_appointments_to_customers($pdo, $customers);
                        // Attach call status (by current owner)
                        attach_call_status_to_customers($pdo, $customers);

                        json_response($customers);
                    } else {
                        // Pagination parameters
                        $page = isset($_GET['page']) ? (int) $_GET['page'] : null;
                        $limit = isset($_GET['pageSize']) ? (int) $_GET['pageSize'] : (isset($_GET['limit']) ? (int) $_GET['limit'] : 50);
                        if ($limit <= 0)
                            $limit = 50;
                        $offset = $page ? ($page - 1) * $limit : 0;

                        $where = ['1'];
                        $params = [];

                        // DELTA SYNC IMPLEMENTATION
                        $since = $_GET['since'] ?? null;
                        if ($since && is_numeric($since)) {
                            // Convert JS timestamp (ms) to MySQL datetime or compare as needed
                            // Here we assume client sends ms timestamp, PHP handles it
                            // MySQL updated_at is usually Y-m-d H:i:s
                            $sinceSec = floor($since / 1000);
                            $sinceDate = date('Y-m-d H:i:s', $sinceSec);
                            $where[] = 'updated_at > ?';
                            $params[] = $sinceDate;
                        }


                        if ($q !== '') {
                            $searchResult = build_customer_search_conditions($q, '');
                            if (!empty($searchResult['conditions'])) {
                                $where[] = $searchResult['conditions'][0];
                                $params = array_merge($params, $searchResult['params']);
                            }
                        }
                        if ($companyId) {
                            $where[] = 'company_id = ?';
                            $params[] = $companyId;
                        }

                        // Advanced filters
                        $province = $_GET['province'] ?? null;
                        $lifecycle = $_GET['lifecycle'] ?? null;
                        $behavioral = $_GET['behavioral'] ?? null;
                        $assignedTo = $_GET['assignedTo'] ?? null;

                        if ($province && $province !== '') {
                            $where[] = 'province LIKE ?';
                            $params[] = "%$province%";
                        }
                        if ($lifecycle && $lifecycle !== '') {
                            $where[] = 'lifecycle_status = ?';
                            $params[] = $lifecycle;
                        }
                        if ($behavioral && $behavioral !== '') {
                            $where[] = 'behavioral_status = ?';
                            $params[] = $behavioral;
                        }
                        if ($assignedTo && $assignedTo !== '' && $assignedTo !== 'all') {
                            $where[] = 'assigned_to = ?';
                            $params[] = (int) $assignedTo;
                        }

                        // Sub-menu filter type (do, expiring, updates, all)
                        $filterType = $_GET['filterType'] ?? $_GET['subMenu'] ?? 'all';


                        // Additional advanced filters
                        $name = $_GET['name'] ?? null;
                        $phone = $_GET['phone'] ?? null;
                        $grade = $_GET['grade'] ?? null;
                        $hasOrders = $_GET['hasOrders'] ?? null;
                        $dateAssignedStart = $_GET['dateAssignedStart'] ?? null;
                        $dateAssignedEnd = $_GET['dateAssignedEnd'] ?? null;
                        $ownershipStart = $_GET['ownershipStart'] ?? null;
                        $ownershipEnd = $_GET['ownershipEnd'] ?? null;
                        $excludeBlocked = isset($_GET['excludeBlocked']) && $_GET['excludeBlocked'] === 'true';

                        if ($excludeBlocked) {
                            $where[] = '(is_blocked = 0 OR is_blocked IS NULL)';
                        }

                        if ($name && $name !== '') {
                            $where[] = '(first_name LIKE ? OR last_name LIKE ?)';
                            $params[] = "%$name%";
                            $params[] = "%$name%";
                        }

                        if ($phone && $phone !== '') {
                            // Normalize: search both with and without leading 0
                            $phoneNormalized = preg_replace('/^0+/', '', preg_replace('/\D/', '', $phone));
                            if ($phoneNormalized !== '' && $phoneNormalized !== $phone) {
                                $where[] = '(phone LIKE ? OR phone LIKE ?)';
                                $params[] = "%$phone%";
                                $params[] = "%$phoneNormalized%";
                            } else {
                                $where[] = 'phone LIKE ?';
                                $params[] = "%$phone%";
                            }
                        }

                        if ($grade && $grade !== '') {
                            // Grade is calculated from total_purchases
                            // A+: >= 50000, A: >= 10000, B: >= 5000, C: >= 2000, D: < 2000
                            switch ($grade) {
                                case 'A+':
                                    $where[] = 'total_purchases >= 50000';
                                    break;
                                case 'A':
                                    $where[] = 'total_purchases >= 10000 AND total_purchases < 50000';
                                    break;
                                case 'B':
                                    $where[] = 'total_purchases >= 5000 AND total_purchases < 10000';
                                    break;
                                case 'C':
                                    $where[] = 'total_purchases >= 2000 AND total_purchases < 5000';
                                    break;
                                case 'D':
                                    $where[] = 'total_purchases < 2000';
                                    break;
                            }
                        }

                        if ($hasOrders && $hasOrders !== 'all') {
                            if ($hasOrders === 'yes') {
                                $where[] = 'EXISTS (SELECT 1 FROM orders WHERE orders.customer_id = customers.customer_id)';
                            } elseif ($hasOrders === 'no') {
                                $where[] = 'NOT EXISTS (SELECT 1 FROM orders WHERE orders.customer_id = customers.customer_id)';
                            }
                        }

                        if ($dateAssignedStart && $dateAssignedStart !== '') {
                            $where[] = 'date_assigned >= ?';
                            $params[] = $dateAssignedStart . ' 00:00:00';
                        }

                        if ($dateAssignedEnd && $dateAssignedEnd !== '') {
                            $where[] = 'date_assigned <= ?';
                            $params[] = $dateAssignedEnd . ' 23:59:59';
                        }

                        if ($ownershipStart && $ownershipStart !== '') {
                            $where[] = 'ownership_expires >= ?';
                            $params[] = $ownershipStart . ' 00:00:00';
                        }

                        if ($ownershipEnd && $ownershipEnd !== '') {
                            $where[] = 'ownership_expires <= ?';
                            $params[] = $ownershipEnd . ' 23:59:59';
                        }

                        // Apply sub-menu filter
                        // Detect which column name exists (customer_id or id)
                        $testStmt = $pdo->query("SHOW COLUMNS FROM customers LIKE 'customer_id'");
                        $hasCustomerId = $testStmt->rowCount() > 0;
                        $customerIdCol = $hasCustomerId ? 'customer_id' : 'id';  // Use 'id' if customer_id doesn't exist

                        switch ($filterType) {
                            case 'do':
                                // Do dashboard: appointments due, ownership expiring, new/daily with no activity
                                $doConditions = [];

                                // 1. Has upcoming appointments (0-2 days, not completed)
                                $doConditions[] = "EXISTS (
                                    SELECT 1 FROM appointments a 
                                    WHERE a.customer_id = customers.customer_id 
                                    AND a.status != 'เสร็จสิ้น'
                                    AND DATE(a.date) BETWEEN DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND DATE_ADD(CURDATE(), INTERVAL 2 DAY)
                                )";

                                // 2. Ownership expires logic REMOVED from DO tab as requested
                                /*
                                $doConditions[] = "(
                                    customers.ownership_expires IS NOT NULL 
                                    AND DATEDIFF(customers.ownership_expires, NOW()) BETWEEN 0 AND 7
                                )";
                                */

                                // 3. DailyDistribution assigned today with no activity
                                $doConditions[] = "(
                                    customers.lifecycle_status = 'DailyDistribution'
                                    AND DATE(customers.date_assigned) = CURDATE()
                                    AND NOT EXISTS (
                                        SELECT 1 FROM call_history WHERE customer_id = customers.customer_id AND DATE(CONVERT_TZ(date, '+00:00', '+07:00')) >= DATE(customers.date_assigned)
                                        UNION
                                        SELECT 1 FROM activities WHERE customer_id = customers.customer_id AND DATE(CONVERT_TZ(timestamp, '+00:00', '+07:00')) >= DATE(customers.date_assigned)
                                        UNION
                                        SELECT 1 FROM orders WHERE customer_id = customers.customer_id AND DATE(order_date) >= DATE(customers.date_assigned)
                                    )
                                )";

                                // 4. New customers with no activity
                                $doConditions[] = "(
                                    customers.lifecycle_status = 'New'
                                    AND NOT EXISTS (
                                        SELECT 1 FROM call_history WHERE customer_id = customers.customer_id AND DATE(CONVERT_TZ(date, '+00:00', '+07:00')) >= DATE(customers.date_assigned)
                                        UNION
                                        SELECT 1 FROM activities WHERE customer_id = customers.customer_id AND DATE(CONVERT_TZ(timestamp, '+00:00', '+07:00')) >= DATE(customers.date_assigned)
                                        UNION
                                        SELECT 1 FROM orders WHERE customer_id = customers.customer_id AND DATE(order_date) >= DATE(customers.date_assigned)
                                    )
                                )";

                                // DO Dashboard: Focus on Actionable Items (Appointments & New/Daily not contacted)
                                // Removed Expiring Ownership logic to keep it focused (moved to Expiring tab)

                                $where[] = '(' . implode(' OR ', $doConditions) . ')';
                                break;

                            case 'expiring':
                                // Expiring dashboard: ownership expires in 0-7 days
                                $where[] = "customers.ownership_expires IS NOT NULL";
                                $where[] = "DATEDIFF(customers.ownership_expires, NOW()) BETWEEN 0 AND 7";
                                break;

                            case 'updates':
                                // Updates dashboard: has recent orders by others, no activity after
                                if ($assignedTo && $assignedTo !== '' && $assignedTo !== 'all') {
                                    // Exclude newly registered (< 7 days)
                                    $where[] = "(customers.date_registered IS NULL OR DATEDIFF(NOW(), customers.date_registered) > 7)";

                                    // Has orders by others in last 7 days, no activity after
                                    $where[] = "EXISTS (
                                        SELECT 1 FROM orders o
                                        WHERE o.customer_id = customers.$customerIdCol
                                        AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                                        AND o.creator_id != " . (int) $assignedTo . "
                                        AND (o.order_status IS NULL OR o.order_status != 'Cancelled')
                                        AND NOT EXISTS (
                                            SELECT 1 FROM (
                                                SELECT date as activity_date FROM call_history WHERE customer_id = customers.$customerIdCol
                                                UNION
                                                SELECT timestamp FROM activities WHERE customer_id = customers.$customerIdCol
                                                UNION
                                                SELECT order_date FROM orders WHERE customer_id = customers.$customerIdCol AND id != o.id
                                            ) act
                                            WHERE act.activity_date > o.order_date
                                        )
                                    )";
                                }
                                break;

                            case 'all':
                            default:
                                // No additional filter for 'all'
                                break;
                        }

                        $whereSql = implode(' AND ', $where);

                        // If pagination is requested, get total count
                        $total = 0;
                        if ($page) {
                            $countStmt = $pdo->prepare("SELECT COUNT(*) FROM customers WHERE $whereSql");
                            $countStmt->execute($params);
                            $total = (int) $countStmt->fetchColumn();
                        }

                        // OPTIMIZATION: Removed expensive per-row subqueries
                        // is_upsell_eligible and last_call_note will be fetched in batch AFTER main query

                        // Custom ORDER BY for 'do' filterType:
                        // 1. Customers with upcoming appointments (sorted by nearest appointment date)
                        // 2. DailyDistribution (sorted by date_assigned DESC)
                        // 3. New (sorted by date_assigned DESC)
                        $orderBy = "date_assigned DESC"; // default
                        if ($filterType === 'do') {
                            $orderBy = "
                                CASE 
                                    WHEN EXISTS (
                                        SELECT 1 FROM appointments a 
                                        WHERE a.customer_id = customers.customer_id 
                                        AND a.status != 'เสร็จสิ้น'
                                        AND DATE(a.date) BETWEEN DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND DATE_ADD(CURDATE(), INTERVAL 2 DAY)
                                    ) THEN 1
                                    WHEN lifecycle_status = 'DailyDistribution' THEN 2
                                    WHEN lifecycle_status = 'New' THEN 3
                                    ELSE 4
                                END ASC,
                                (
                                    SELECT MIN(DATE(a.date)) 
                                    FROM appointments a 
                                    WHERE a.customer_id = customers.customer_id 
                                    AND a.status != 'เสร็จสิ้น'
                                    AND DATE(a.date) >= CURDATE()
                                ) ASC,
                                date_assigned DESC
                            ";
                        }
                        // Use specific columns instead of SELECT * to reduce memory
                        $neededCols = "$customerIdCol as id, customer_id, customer_ref_id, first_name, last_name, phone, province, 
                            date_assigned, birth_date, assigned_to, company_id, lifecycle_status, behavioral_status,
                            total_purchases, order_count, first_order_date, last_order_date, current_basket_key,
                            ownership_expires, date_registered, grade, facebook_name, line_id, updated_at,
                            street, subdistrict, district, postal_code, recipient_first_name, recipient_last_name, recipient_phone,
                            backup_phone, email, follow_up_date, total_calls,
                            is_in_waiting_basket, waiting_basket_start_date, is_blocked,
                            (SELECT basket_name FROM basket_config WHERE id = customers.current_basket_key) AS basket_name,
                            (SELECT reason FROM customer_blocks WHERE customer_id = CAST(customers.customer_id AS CHAR) AND active = 1 ORDER BY id DESC LIMIT 1) AS block_reason";
                        $sql = "SELECT $neededCols FROM customers WHERE $whereSql ORDER BY $orderBy";

                        if ($page) {
                            $sql .= " LIMIT $limit OFFSET $offset";
                        } elseif ($limit > 0) {
                            // Apply LIMIT even without page param to prevent unbounded queries
                            $sql .= " LIMIT $limit";
                        }

                        try {
                            $stmt = $pdo->prepare($sql);
                            $t_query_start = microtime(true);
                            $stmt->execute($params);
                            $customers = $stmt->fetchAll();
                            error_log("[customers:list] MAIN_QUERY done rows=" . count($customers) . " memory=" . round(memory_get_usage(true) / 1024 / 1024, 1) . "MB peak=" . round(memory_get_peak_usage(true) / 1024 / 1024, 1) . "MB");
                            log_perf("handle_customers:list:EXECUTE_QUERY source=$source filter=$filterType count=" . count($customers), $t_query_start);

                            error_log("listCustomers: Fetched " . count($customers) . " rows for company " . $companyId);
                        } catch (PDOException $e) {
                            error_log("listCustomers SQL Error: " . $e->getMessage() . " SQL: " . $sql);
                            http_response_code(500);
                            json_response(['error' => 'Database error', 'debug' => $e->getMessage()]);
                            return;
                        }

                        // BATCH FETCH: Upsell eligibility
                        $t_upsell_start = microtime(true);
                        $customerIds = array_column($customers, 'customer_id');
                        $upsellMap = [];
                        if (!empty($customerIds)) {
                            $placeholders = implode(',', array_fill(0, count($customerIds), '?'));
                            $userId = isset($_GET['userId']) ? (int) $_GET['userId'] : null;
                            // Match logic from upsell/check API:
                            // 1. Pending status
                            // 2. Not created by current user
                            // 3. No upsell items added yet (NOT EXISTS)
                            $upsellSql = "SELECT DISTINCT o.customer_id FROM orders o
                                          WHERE o.customer_id IN ($placeholders) 
                                          AND o.order_status = 'Pending'
                                          AND NOT EXISTS (
                                              SELECT 1 FROM order_items oi 
                                              WHERE oi.parent_order_id = o.id 
                                              AND oi.creator_id != o.creator_id
                                          )";
                            if ($userId) {
                                $upsellSql .= " AND (o.creator_id IS NULL OR o.creator_id != $userId)";
                            }
                            $upsellStmt = $pdo->prepare($upsellSql);
                            $upsellStmt->execute($customerIds);
                            while ($row = $upsellStmt->fetch()) {
                                $upsellMap[$row['customer_id']] = true;
                            }
                        }
                        log_perf("handle_customers:list:UPSELL_BATCH", $t_upsell_start);
                        error_log("[customers:list] UPSELL_BATCH done memory=" . round(memory_get_usage(true) / 1024 / 1024, 1) . "MB peak=" . round(memory_get_peak_usage(true) / 1024 / 1024, 1) . "MB");

                        // BATCH FETCH: Last call notes (most recent per customer)
                        $t_notes_start = microtime(true);
                        $notesMap = [];
                        if (!empty($customerIds)) {
                            $placeholders = implode(',', array_fill(0, count($customerIds), '?'));
                            // Use GROUP BY with MAX to get the latest call per customer
                            $notesSql = "SELECT ch.customer_id, ch.notes 
                                         FROM call_history ch
                                         INNER JOIN (
                                             SELECT customer_id, MAX(id) as max_id
                                             FROM call_history
                                             WHERE customer_id IN ($placeholders)
                                             AND notes IS NOT NULL AND notes != ''
                                             GROUP BY customer_id
                                         ) latest ON ch.customer_id = latest.customer_id AND ch.id = latest.max_id";
                            $notesStmt = $pdo->prepare($notesSql);
                            $notesStmt->execute($customerIds);
                            while ($row = $notesStmt->fetch()) {
                                $notesMap[$row['customer_id']] = $row['notes'];
                            }
                        }
                        log_perf("handle_customers:list:NOTES_BATCH", $t_notes_start);
                        error_log("[customers:list] NOTES_BATCH done memory=" . round(memory_get_usage(true) / 1024 / 1024, 1) . "MB peak=" . round(memory_get_peak_usage(true) / 1024 / 1024, 1) . "MB");

                        // BATCH FETCH: Order stats (order_count, total_purchases, first_order_date, last_order_date)
                        $t_order_stats_start = microtime(true);
                        $orderStatsMap = [];
                        if (!empty($customerIds)) {
                            $placeholders = implode(',', array_fill(0, count($customerIds), '?'));
                            $orderStatsSql = "SELECT customer_id, 
                                                     COUNT(*) as order_count, 
                                                     COALESCE(SUM(CASE WHEN order_status != 'Cancelled' THEN total_amount ELSE 0 END), 0) as total_purchases,
                                                     MIN(order_date) as first_order_date,
                                                     MAX(order_date) as last_order_date
                                              FROM orders 
                                              WHERE customer_id IN ($placeholders)
                                              AND order_status != 'Cancelled'
                                              GROUP BY customer_id";
                            $orderStatsStmt = $pdo->prepare($orderStatsSql);
                            $orderStatsStmt->execute($customerIds);
                            while ($row = $orderStatsStmt->fetch()) {
                                // Cast to string for consistent key matching
                                $orderStatsMap[strval($row['customer_id'])] = [
                                    'order_count' => (int) $row['order_count'],
                                    'total_purchases' => (float) $row['total_purchases'],
                                    'first_order_date' => $row['first_order_date'],
                                    'last_order_date' => $row['last_order_date']
                                ];
                            }
                        }
                        log_perf("handle_customers:list:ORDER_STATS_BATCH", $t_order_stats_start);
                        error_log("[customers:list] ORDER_STATS_BATCH done memory=" . round(memory_get_usage(true) / 1024 / 1024, 1) . "MB peak=" . round(memory_get_peak_usage(true) / 1024 / 1024, 1) . "MB");

                        // Apply batch results to customers and free maps
                        foreach ($customers as &$customer) {
                            $cid = strval($customer['customer_id']); // Cast to string for lookup
                            $customer['is_upsell_eligible'] = isset($upsellMap[$cid]) ? 1 : 0;
                            $customer['last_call_note'] = $notesMap[$cid] ?? null;
                            // Order stats from batch query (overrides stale column data)
                            $customer['order_count'] = $orderStatsMap[$cid]['order_count'] ?? 0;
                            $customer['total_purchases'] = $orderStatsMap[$cid]['total_purchases'] ?? ($customer['total_purchases'] ?? 0);
                            $customer['first_order_date'] = $orderStatsMap[$cid]['first_order_date'] ?? ($customer['first_order_date'] ?? null);
                            $customer['last_order_date'] = $orderStatsMap[$cid]['last_order_date'] ?? ($customer['last_order_date'] ?? null);
                        }
                        unset($customer);
                        // Free batch maps immediately to reclaim memory
                        unset($upsellMap, $notesMap, $orderStatsMap);

                        // Optimized: Fetch tags for all customers in one query
                        $t_tags_start = microtime(true);
                        if (!empty($customerIds)) {
                            // Create placeholders for IN clause
                            $placeholders = implode(',', array_fill(0, count($customerIds), '?'));
                            $tagsSql = "SELECT ct.customer_id, t.* 
                                       FROM tags t 
                                       JOIN customer_tags ct ON ct.tag_id = t.id 
                                       LEFT JOIN user_tags ut ON ut.tag_id = t.id 
                                       WHERE ct.customer_id IN ($placeholders)
                                       AND (ut.user_id IS NULL OR ut.user_id = ?)";
                            $tagsStmt = $pdo->prepare($tagsSql);
                            $params = $customerIds;
                            $params[] = $user['id'];
                            $tagsStmt->execute($params);
                            $allTags = $tagsStmt->fetchAll(PDO::FETCH_GROUP | PDO::FETCH_ASSOC); // Group by customer_id

                            foreach ($customers as &$customer) {
                                $cid = $customer['customer_id'];
                                $customer['tags'] = $allTags[$cid] ?? [];
                            }
                            unset($allTags); // Free tags map
                        } else {
                            foreach ($customers as &$customer) {
                                $customer['tags'] = [];
                            }
                        }
                        unset($customer);
                        log_perf("handle_customers:list:TAGS_BATCH", $t_tags_start);
                        error_log("[customers:list] TAGS_BATCH done memory=" . round(memory_get_usage(true) / 1024 / 1024, 1) . "MB peak=" . round(memory_get_peak_usage(true) / 1024 / 1024, 1) . "MB");
                        log_perf("handle_customers:list:TOTAL", $t_list_start);

                        // Attach next appointment data for each customer
                        attach_next_appointments_to_customers($pdo, $customers);
                        error_log("[customers:list] APPOINTMENTS done memory=" . round(memory_get_usage(true) / 1024 / 1024, 1) . "MB peak=" . round(memory_get_peak_usage(true) / 1024 / 1024, 1) . "MB");
                        // Attach call status (by current owner)
                        attach_call_status_to_customers($pdo, $customers);
                        error_log("[customers:list] CALL_STATUS done memory=" . round(memory_get_usage(true) / 1024 / 1024, 1) . "MB peak=" . round(memory_get_peak_usage(true) / 1024 / 1024, 1) . "MB");

                        // Stream JSON response to avoid memory doubling from json_encode on large array
                        $serverTs = round(microtime(true) * 1000);
                        http_response_code(200);
                        header('Content-Type: application/json; charset=utf-8');
                        if ($page) {
                            echo '{"total":' . $total . ',"data":[';
                        } else {
                            echo '{"data":[';
                        }
                        $first = true;
                        foreach ($customers as $c) {
                            if (!$first)
                                echo ',';
                            echo json_encode($c, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                            $first = false;
                        }
                        echo '],"server_timestamp":' . $serverTs . '}';
                        exit();

                    }
                }
            } catch (Throwable $e) {
                json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        case 'POST':
            $in = json_input();
            $phoneCandidate = trim($in['phone'] ?? '');
            $companyCandidate = $in['companyId'] ?? null;
            if ($phoneCandidate !== '' && $companyCandidate) {
                // Normalize: remove leading 0 for comparison
                $normalizedPhone = ltrim($phoneCandidate, '0');
                // Check if any phone in DB (normalized) matches this normalized input
                $dupStmt = $pdo->prepare("SELECT first_name, last_name FROM customers WHERE TRIM(LEADING '0' FROM phone) = ? AND company_id = ? LIMIT 1");
                $dupStmt->execute([$normalizedPhone, $companyCandidate]);
                $duplicate = $dupStmt->fetch();
                if ($duplicate) {
                    json_response([
                        'error' => 'DUPLICATE_PHONE',
                        'message' => "เบอร์โทรศัพท์ซ้ำกับลูกค้า {$duplicate['first_name']} {$duplicate['last_name']}",
                    ], 409);
                }
            }
            // Updated INSERT to use customer_ref_id and let customer_id be auto-increment
            $customerRefId = $in['customerId'] ?? $in['id']; // This is the string ID (CUS-...)

            // Handle Duplicate Customer Ref ID
            // Logic: If Ref ID exists but phone is unique (checked above), generate a new Ref ID with suffix
            $checkIdStmt = $pdo->prepare("SELECT COUNT(*) FROM customers WHERE customer_ref_id = ?");
            $checkIdStmt->execute([$customerRefId]);
            if ($checkIdStmt->fetchColumn() > 0) {
                // ID exists, try to generate a unique one
                // Expected format: CUS-{PHONE}-{COMPANY} or CUS-{PHONE}
                // We want to insert suffix after Phone: CUS-{PHONE}_{SUFFIX}-{COMPANY}

                $baseId = $customerRefId;
                $suffix = 2;
                $maxTries = 10;
                $foundUnique = false;

                // Regex to split ID: CUS-(PhonePart)(-(CompanyPart))?
                if (preg_match('/^(CUS-[^-]+)(?:(-[0-9]+))?$/', $baseId, $matches)) {
                    $prefix = $matches[1]; // CUS-0812345678
                    $compSuffix = $matches[2] ?? ''; // -5 or empty

                    while ($suffix <= $maxTries) {
                        $newId = $prefix . '_' . $suffix . $compSuffix;
                        $checkIdStmt->execute([$newId]);
                        if ($checkIdStmt->fetchColumn() == 0) {
                            $customerRefId = $newId;
                            $foundUnique = true;
                            // Log the auto-adjustment
                            error_log("Duplicate Ref ID detected ($baseId). Generated new ID: $customerRefId");
                            break;
                        }
                        $suffix++;
                    }
                }

                // If regex didn't match or max tries reached, we stick to original and let DB error (or could fail gracefully)
                // But usually this will fix the "Duplicate entry" error for changed numbers.
            }

            error_log(json_encode([
                'action' => 'create_customer',
                'customerId' => $customerRefId,
                'phone' => $in['phone'] ?? null,
                'backupPhone' => $in['backupPhone'] ?? null,
            ]));
            $stmt = $pdo->prepare('INSERT INTO customers (customer_ref_id, first_name, last_name, phone, backup_phone, email, province, company_id, assigned_to, date_assigned, date_registered, follow_up_date, ownership_expires, lifecycle_status, behavioral_status, grade, total_purchases, total_calls, facebook_name, line_id, street, subdistrict, district, postal_code, bucket_type, current_basket_key, recipient_first_name, recipient_last_name, recipient_phone) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
            $params = [
                $customerRefId,
                $in['firstName'] ?? '',
                $in['lastName'] ?? '',
                $in['phone'] ?? '',
                $in['backupPhone'] ?? null,
                $in['email'] ?? null,
                $in['province'] ?? '',
                $in['companyId'] ?? null,
                $in['assignedTo'] ?? null,
                $in['dateAssigned'] ?? date('c'),
                $in['dateRegistered'] ?? null,
                $in['followUpDate'] ?? null,
                $in['ownershipExpires'] ?? null,
                $in['lifecycleStatus'] ?? null,
                $in['behavioralStatus'] ?? null,
                $in['grade'] ?? null,
                $in['totalPurchases'] ?? 0,
                $in['totalCalls'] ?? 0,
                $in['facebookName'] ?? null,
                $in['lineId'] ?? null,
                $in['address']['street'] ?? null,
                $in['address']['subdistrict'] ?? null,
                $in['address']['district'] ?? null,
                $in['address']['postalCode'] ?? null,
                $in['bucketType'] ?? null,
                $in['current_basket_key'] ?? null,
                // Recipient name/phone from address object (for shipping label)
                $in['address']['recipientFirstName'] ?? $in['firstName'] ?? '',
                $in['address']['recipientLastName'] ?? $in['lastName'] ?? '',
                $in['address']['phone'] ?? $in['phone'] ?? '',
            ];
            error_log("Attempting Customer Insert with Params: " . json_encode($params));
            $stmt->execute($params);
            $newPk = $pdo->lastInsertId();
            json_response(['ok' => true, 'id' => $newPk, 'customer_id' => $newPk]);
            break;
        case 'PUT':
        case 'PATCH':
            if (!$id)
                json_response(['error' => 'ID_REQUIRED'], 400);
            $in = json_input();
            error_log(json_encode([
                'action' => 'update_customer',
                'id' => $id,
                'phone' => $in['phone'] ?? null,
                'backupPhone' => $in['backupPhone'] ?? null,
            ]));

            // Fetch current data to check for phone/company changes
            $current = null;
            try {
                // Try to find by customer_id (PK) or customer_ref_id
                $st = $pdo->prepare('SELECT customer_id, phone, company_id, assigned_to, current_basket_key FROM customers WHERE customer_id=? OR customer_ref_id=? LIMIT 1');
                $st->execute([$id, $id]);
                $current = $st->fetch();

                // If found, ensure we use the real PK for updates
                if ($current) {
                    $id = $current['customer_id'];
                }
            } catch (Throwable $e) { /* ignore */
            }

            if (!$current)
                json_response(['error' => 'NOT_FOUND'], 404);

            $oldAssigned = $current['assigned_to'];
            $assignedTo = $in['assignedTo'] ?? null;

            // Calculate new customer_ref_id if phone changes
            $newCustomerRefId = null;
            if (isset($in['phone']) && $in['phone'] !== $current['phone']) {
                $newPhone = $in['phone'];
                $companyId = $in['companyId'] ?? $current['company_id'];
                $cleanedPhone = preg_replace('/\D/', '', $newPhone);
                if ($cleanedPhone === '') {
                    json_response(['error' => 'INVALID_PHONE', 'message' => 'Invalid phone number provided'], 400);
                }

                // Normalize: remove leading 0 for comparison
                $normalizedPhone = ltrim($newPhone, '0');
                $duplicateStmt = $pdo->prepare("SELECT first_name, last_name FROM customers WHERE TRIM(LEADING '0' FROM phone) = ? AND company_id = ? AND customer_id <> ? LIMIT 1");
                $duplicateStmt->execute([$normalizedPhone, $companyId, $id]);
                $duplicate = $duplicateStmt->fetch();
                if ($duplicate) {
                    json_response([
                        'error' => 'DUPLICATE_PHONE',
                        'message' => "เบอร์โทรศัพท์ซ้ำกับลูกค้า {$duplicate['first_name']} {$duplicate['last_name']}"
                    ], 409);
                }
                $companyPrefix = ((int) $companyId === 1) ? '' : "-$companyId";
                $newCustomerRefId = "CUS-$cleanedPhone$companyPrefix";
            }

            $pdo->beginTransaction();
            try {
                set_audit_context($pdo, 'index/customer_update');
                // Disable FK checks to allow updating PK/FKs
                $pdo->exec('SET FOREIGN_KEY_CHECKS=0');

                // AUTO-BACKUP STATUS LOGIC: 
                // If switching TO 'FollowUp', save current status to 'previous_lifecycle_status'
                if (isset($in['lifecycleStatus']) && $in['lifecycleStatus'] === 'FollowUp') {
                    $backupSql = "UPDATE customers SET previous_lifecycle_status = lifecycle_status WHERE customer_id = ? AND lifecycle_status != 'FollowUp'";
                    $backupStmt = $pdo->prepare($backupSql);
                    $backupStmt->execute([$id]);
                }

                $updateFields = [
                    'first_name=COALESCE(?, first_name)',
                    'last_name=COALESCE(?, last_name)',
                    'phone=COALESCE(?, phone)',
                    'backup_phone=COALESCE(?, backup_phone)', // Added backup_phone
                    'email=COALESCE(?, email)',
                    'province=COALESCE(?, province)',
                    'company_id=COALESCE(?, company_id)',
                    (array_key_exists('assignedTo', $in) || array_key_exists('assigned_to', $in)) ? 'assigned_to=?' : 'assigned_to=COALESCE(?, assigned_to)',
                    'date_assigned=COALESCE(?, date_assigned)',
                    'date_registered=COALESCE(?, date_registered)',
                    'follow_up_date=COALESCE(?, follow_up_date)',
                    'ownership_expires=COALESCE(?, ownership_expires)',
                    'lifecycle_status=COALESCE(?, lifecycle_status)',
                    'previous_lifecycle_status=COALESCE(?, previous_lifecycle_status)',
                    'behavioral_status=COALESCE(?, behavioral_status)',
                    'grade=COALESCE(?, grade)',
                    'total_purchases=COALESCE(?, total_purchases)',
                    'total_calls=COALESCE(?, total_calls)',
                    'facebook_name=COALESCE(?, facebook_name)',
                    'line_id=COALESCE(?, line_id)',
                    'street=COALESCE(?, street)',
                    'subdistrict=COALESCE(?, subdistrict)',
                    'district=COALESCE(?, district)',
                    'postal_code=COALESCE(?, postal_code)',
                    'is_in_waiting_basket=COALESCE(?, is_in_waiting_basket)',
                    'waiting_basket_start_date=COALESCE(?, waiting_basket_start_date)',
                    'is_blocked=COALESCE(?, is_blocked)',
                    'followup_bonus_remaining=COALESCE(?, followup_bonus_remaining)',
                    'current_basket_key=COALESCE(?, current_basket_key)',
                    'birth_date=COALESCE(?, birth_date)'
                ];

                // Detect Basket Transition
                $newBasketKey = $in['current_basket_key'] ?? $in['currentBasketKey'] ?? null;
                $oldBasketKey = $current['current_basket_key'];

                // Auto-forward distribution basket on owner change
                if (!empty($assignedTo) && (string) $assignedTo !== (string) $oldAssigned && $oldBasketKey) {
                    // Assumption: current_basket_key holds the ID of basket_config
                    $chkStmt = $pdo->prepare("SELECT target_page, linked_basket_key FROM basket_config WHERE id = ?");
                    $chkStmt->execute([$oldBasketKey]);
                    $bCfg = $chkStmt->fetch();

                    if ($bCfg && $bCfg['target_page'] === 'distribution') {
                        // Default to 'new_customer' if linked_basket_key is NULL
                        $linkedKey = !empty($bCfg['linked_basket_key']) ? $bCfg['linked_basket_key'] : 'new_customer';
                        // Find the ID of the linked basket
                        $linkStmt = $pdo->prepare("SELECT id FROM basket_config WHERE basket_key = ?");
                        $linkStmt->execute([$linkedKey]);
                        $linkedRow = $linkStmt->fetch();
                        if ($linkedRow) {
                            $newBasketKey = $linkedRow['id'];
                        }
                    }
                }

                if ($newBasketKey !== null) {
                    $updateFields[] = 'basket_entered_date=NOW()';

                    // Log Transition
                    // transition_type ENUM('sale', 'fail', 'monthly_cron', 'manual', 'redistribute')
                    // Updates via API endpoint considered 'manual'
                    $authUser = get_authenticated_user($pdo);
                    $triggerUserId = $authUser['id'] ?? null;

                    $logSql = "INSERT INTO basket_transition_log 
                               (customer_id, from_basket_key, to_basket_key, transition_type, triggered_by, notes, created_at) 
                               VALUES (?, ?, ?, 'manual', ?, 'Updated via API', NOW())";
                    $logStmt = $pdo->prepare($logSql);
                    $logStmt->execute([$id, $oldBasketKey, $newBasketKey, $triggerUserId]);
                }

                $params = [
                    $in['firstName'] ?? null,
                    $in['lastName'] ?? null,
                    $in['phone'] ?? null,
                    $in['backupPhone'] ?? null,
                    $in['email'] ?? null,
                    $in['province'] ?? null,
                    $in['companyId'] ?? null,
                    $assignedTo,
                    $in['dateAssigned'] ?? null,
                    $in['dateRegistered'] ?? null,
                    $in['followUpDate'] ?? null,
                    $in['ownershipExpires'] ?? null,
                    $in['lifecycleStatus'] ?? null,
                    $in['previousLifecycleStatus'] ?? null,
                    $in['behavioralStatus'] ?? null,
                    $in['grade'] ?? null,
                    $in['totalPurchases'] ?? null,
                    $in['totalCalls'] ?? null,
                    $in['facebookName'] ?? null,
                    $in['lineId'] ?? null,
                    $in['address']['street'] ?? null,
                    $in['address']['subdistrict'] ?? null,
                    $in['address']['district'] ?? null,
                    $in['address']['postalCode'] ?? null,
                    array_key_exists('is_in_waiting_basket', $in) ? (int) $in['is_in_waiting_basket'] : null,
                    $in['waiting_basket_start_date'] ?? null,
                    array_key_exists('is_blocked', $in) ? (int) $in['is_blocked'] : null,
                    array_key_exists('followup_bonus_remaining', $in) ? (int) $in['followup_bonus_remaining'] : null,
                    // Check both snake_case and camelCase
                    $newBasketKey,
                    $in['birthDate'] ?? $in['birth_date'] ?? null,
                ];

                if ($newCustomerRefId) {
                    $updateFields[] = 'customer_ref_id=?';
                    $params[] = $newCustomerRefId;
                }

                $params[] = $id; // WHERE customer_id = ?

                $sql = 'UPDATE customers SET ' . implode(', ', $updateFields) . ' WHERE customer_id=?';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);

                // Removed updating related tables as customer_id (PK) does not change.
                // customer_ref_id is just a field in customers table now.

                // Normalize ownership history for new assignments
                // Use newCustomerRefId if changed, else id
                $targetId = $id;

                if (!empty($assignedTo) && (string) $assignedTo !== (string) $oldAssigned) {
                    $pdo->prepare('UPDATE customers SET date_assigned=COALESCE(date_assigned, NOW()) WHERE customer_id=?')->execute([$targetId]);
                    $pdo->prepare('INSERT IGNORE INTO customer_assignment_history(customer_id, user_id, assigned_at) VALUES (?,?, NOW())')->execute([$targetId, $assignedTo]);
                }

                // Post-update normalization - REMOVED 2026-01-27
                // Previously this code would clear assigned_to when is_blocked=1 or is_in_waiting_basket=1
                // This caused telesale staff to lose customer ownership unexpectedly when logging calls
                // Now using basket system (Dashboard V2) for ownership management instead
                // $st2 = $pdo->prepare('SELECT assigned_to, is_in_waiting_basket, is_blocked FROM customers WHERE customer_id=?');
                // $st2->execute([$targetId]);
                // $row = $st2->fetch();
                // if ($row) {
                //     $assignedNow = $row['assigned_to'];
                //     $waitingNow = (int) $row['is_in_waiting_basket'] === 1;
                //     $blockedNow = (int) $row['is_blocked'] === 1;
                //     if ($blockedNow) {
                //         $pdo->prepare('UPDATE customers SET assigned_to=NULL, is_in_waiting_basket=0 WHERE customer_id=?')->execute([$targetId]);
                //     } else if ($waitingNow && $assignedNow !== null) {
                //         $pdo->prepare('UPDATE customers SET assigned_to=NULL WHERE customer_id=?')->execute([$targetId]);
                //     }
                // }

                $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
                $pdo->commit();
                $getUpdated = $pdo->prepare('SELECT *, customer_id as pk FROM customers WHERE customer_id = ?');
                $getUpdated->execute([$targetId]);
                $updatedRow = $getUpdated->fetch();

                if (!$updatedRow) {
                    // Fallback: try fetching by internal ID (PK) if customer_id fetch failed
                    // This can happen if the transaction view is not yet consistent or if customer_id changed
                    $getUpdatedByPk = $pdo->prepare('SELECT *, customer_id as pk FROM customers WHERE customer_id = ?');
                    $getUpdatedByPk->execute([$id]); // $id is the PK passed to the function
                    $updatedRow = $getUpdatedByPk->fetch();
                }

                if ($updatedRow) {
                    // Fetch tags for the updated customer to ensure complete object
                    $tagsStmt = $pdo->prepare('SELECT t.* FROM tags t JOIN customer_tags ct ON ct.tag_id=t.id LEFT JOIN user_tags ut ON ut.tag_id = t.id WHERE ct.customer_id=? AND (ut.user_id IS NULL OR ut.user_id = ?)');
                    $tagsStmt->execute([$updatedRow['customer_id'], $user['id']]);
                    $updatedRow['tags'] = $tagsStmt->fetchAll();

                    json_response($updatedRow);
                } else {
                    // Should not happen if update was successful, but return minimal data as fallback
                    json_response(['ok' => true, 'customerId' => $targetId, 'id' => $id]);
                }

            } catch (Throwable $e) {
                $pdo->rollBack();
                // Ensure FK checks are re-enabled even on error (though connection might close)
                try {
                    $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
                } catch (Throwable $ex) {
                }
                json_response(['error' => 'UPDATE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

