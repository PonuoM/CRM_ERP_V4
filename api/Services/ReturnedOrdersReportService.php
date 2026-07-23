<?php

class ReturnedOrdersReportService
{
    private PDO $pdo;
    private string $audioApiUrl = "https://voicecall.prima49.com/api_search_audio.php";
    private string $audioToken = "voicecall_secret_token_2026";

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function getReportData(
        string $orderStartDate, string $orderEndDate, 
        string $orderStartTime, string $orderEndTime,
        string $actionStartDate, string $actionEndDate,
        ?string $userId, ?int $companyId, string $statusType, string $resolutionStatus = 'All',
        string $audioStatus = 'All', string $reasonKeyword = '', string $searchKeyword = ''
    ): array
    {
        // Allow only Returned or Cancelled
        if (!in_array($statusType, ['Returned', 'Cancelled'])) {
            throw new InvalidArgumentException("Invalid status type");
        }

        $params = [];
        $where = "1=1";
        $limitClause = "";
        
        // --- Order Date Logic ---
        if (!empty($orderStartDate) && !empty($orderEndDate)) {
            $startObj = DateTime::createFromFormat('Y-m-d', $orderStartDate);
            $endObj = DateTime::createFromFormat('Y-m-d', $orderEndDate);
            
            if ($startObj && $endObj && $startObj->format('Y-m-d') === $orderStartDate && $endObj->format('Y-m-d') === $orderEndDate) {
                // 6-month strict limit enforcement
                $diff = $startObj->diff($endObj);
                if ($diff->days > 186) { 
                    throw new InvalidArgumentException("กรุณาเลือกช่วงเวลาวันที่สร้างคำสั่งซื้อไม่เกิน 6 เดือน");
                }
                
                $where .= " AND o.order_date >= :order_start_date AND o.order_date <= :order_end_date";
                $params[':order_start_date'] = $orderStartDate . ' 00:00:00';
                $params[':order_end_date'] = $orderEndDate . ' 23:59:59';
                
                // Daily Time Window (Day-parting)
                if (!empty($orderStartTime) && !empty($orderEndTime)) {
                    // Basic time format validation (H:i)
                    if (preg_match('/^([01][0-9]|2[0-3]):([0-5][0-9])$/', $orderStartTime) && 
                        preg_match('/^([01][0-9]|2[0-3]):([0-5][0-9])$/', $orderEndTime)) {
                        $where .= " AND TIME(o.order_date) >= :order_start_time AND TIME(o.order_date) <= :order_end_time";
                        $params[':order_start_time'] = $orderStartTime . ':00';
                        $params[':order_end_time'] = $orderEndTime . ':59';
                    } else {
                        throw new InvalidArgumentException("รูปแบบเวลาไม่ถูกต้อง (ต้องเป็น HH:MM)");
                    }
                }
            } else {
                $limitClause = "LIMIT 500"; // Fallback for invalid date format
            }
        } else {
            // Require order date to prevent full table scan
            throw new InvalidArgumentException("กรุณาระบุช่วงวันที่สร้างคำสั่งซื้อ (ไม่อนุญาตให้ค้นหาทั้งหมดเพื่อประสิทธิภาพ)");
        }
        
        // --- Action Date Logic (Cancelled or Returned Date) ---
        if (!empty($actionStartDate) && !empty($actionEndDate)) {
            $aStartObj = DateTime::createFromFormat('Y-m-d', $actionStartDate);
            $aEndObj = DateTime::createFromFormat('Y-m-d', $actionEndDate);
            if ($aStartObj && $aEndObj) {
                if ($statusType === 'Cancelled') {
                    $where .= " AND oc.classified_at >= :action_start_date AND oc.classified_at <= :action_end_date";
                } else {
                    // For Returned, we use a subquery to find the max return_created_at
                    $where .= " AND (SELECT MAX(ob.return_created_at) FROM order_boxes ob WHERE ob.order_id = o.id) >= :action_start_date 
                                AND (SELECT MAX(ob.return_created_at) FROM order_boxes ob WHERE ob.order_id = o.id) <= :action_end_date";
                }
                $params[':action_start_date'] = $actionStartDate . ' 00:00:00';
                $params[':action_end_date'] = $actionEndDate . ' 23:59:59';
            }
        }
        
        if ($companyId) {
            $where .= " AND o.company_id = :company_id";
            $params[':company_id'] = $companyId;
        }

        if (!empty($userId)) {
            if (strpos($userId, ',') !== false) {
                $userIds = array_map('intval', explode(',', $userId));
                $inClause = implode(',', $userIds);
                $where .= " AND o.creator_id IN ($inClause)";
            } else {
                $where .= " AND o.creator_id = :user_id";
                $params[':user_id'] = (int)$userId;
            }
        }

        // Filter by status. Note: sometimes order is 'Returned', or it's still 'Completed' but has returned boxes.
        // For 'Returned', we check order_status = 'Returned' OR exists a returned box.
        // For 'Cancelled', we just check order_status = 'Cancelled'.
        if ($statusType === 'Returned') {
            $where .= " AND (o.order_status = 'Returned' OR EXISTS (SELECT 1 FROM order_boxes ob2 WHERE ob2.order_id = o.id AND ob2.return_status IS NOT NULL))";
        } else {
            $where .= " AND o.order_status = 'Cancelled'";
        }

        if ($resolutionStatus === 'Completed') {
            $where .= " AND COALESCE(oar.is_completed, 0) = 1";
        } elseif ($resolutionStatus === 'Pending') {
            $where .= " AND COALESCE(oar.is_completed, 0) = 0";
        }

        if ($audioStatus === 'has_audio') {
            $where .= " AND EXISTS (SELECT 1 FROM order_audio_links oal WHERE oal.order_id = o.id)";
        } elseif ($audioStatus === 'no_audio') {
            $where .= " AND NOT EXISTS (SELECT 1 FROM order_audio_links oal WHERE oal.order_id = o.id)";
        }

        if (!empty($reasonKeyword)) {
            $where .= " AND (ct.label LIKE :reason_keyword_label OR oc.notes LIKE :reason_keyword_notes)";
            $params[':reason_keyword_label'] = '%' . $reasonKeyword . '%';
            $params[':reason_keyword_notes'] = '%' . $reasonKeyword . '%';
        }

        if (!empty($searchKeyword)) {
            $where .= " AND (c.first_name LIKE :search_fname OR c.last_name LIKE :search_lname OR c.phone LIKE :search_phone OR o.id = :exact_keyword)";
            $searchPattern = '%' . $searchKeyword . '%';
            $params[':search_fname'] = $searchPattern;
            $params[':search_lname'] = $searchPattern;
            $params[':search_phone'] = $searchPattern;
            $params[':exact_keyword'] = $searchKeyword;
        }

        $sql = "
            SELECT 
                o.id AS order_id,
                o.order_date,
                o.delivery_date AS shipped_date,
                o.customer_id,
                CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
                CONCAT_WS(' ', NULLIF(c.street, ''), NULLIF(c.subdistrict, ''), NULLIF(c.district, ''), NULLIF(c.province, ''), NULLIF(c.postal_code, '')) AS customer_address,
                c.phone AS customer_phone,
                COALESCE(NULLIF(o.cod_amount, 0), o.total_amount) AS total_amount,
                IF(o.order_status = 'Cancelled',
                    COALESCE(NULLIF(o.cod_amount, 0), o.total_amount),
                    COALESCE((SELECT SUM(ob.cod_amount) FROM order_boxes ob WHERE ob.order_id = o.id AND ob.return_status IS NOT NULL), 0)
                ) AS returned_amount,
                o.payment_method,
                o.order_status,
                ct.label AS cancel_type,
                oc.notes AS cancel_notes,
                oc.classified_at AS cancelled_at,
                (
                    SELECT MAX(ob.return_created_at) 
                    FROM order_boxes ob 
                    WHERE ob.order_id = o.id
                ) AS returned_at,
                u.username AS creator_name,
                oar.resolution_notes AS admin_resolution_notes,
                COALESCE(oar.is_completed, 0) AS admin_resolution_completed
            FROM orders o
            LEFT JOIN order_audio_resolutions oar ON o.id = oar.order_id
            LEFT JOIN customers c ON o.customer_id = c.customer_id
            LEFT JOIN order_cancellations oc ON o.id = oc.order_id
            LEFT JOIN cancellation_types ct ON oc.cancellation_type_id = ct.id
            LEFT JOIN users u ON o.creator_id = u.id
            WHERE $where
            ORDER BY o.order_date DESC
            $limitClause
        ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Fetch audio links
        $orderIds = array_column($results, 'order_id');
        $audioLinksByOrder = [];
        if (!empty($orderIds)) {
            $in = str_repeat('?,', count($orderIds) - 1) . '?';
            $audioStmt = $this->pdo->prepare("SELECT id, order_id, audio_url, audio_date, notes FROM order_audio_links WHERE order_id IN ($in) ORDER BY created_at ASC");
            $audioStmt->execute($orderIds);
            while ($row = $audioStmt->fetch(PDO::FETCH_ASSOC)) {
                $audioLinksByOrder[$row['order_id']][] = [
                    'id' => $row['id'],
                    'url' => $row['audio_url'],
                    'date' => $row['audio_date'],
                    'notes' => $row['notes']
                ];
            }
        }

        // Fetch order items
        $itemsByOrder = [];
        if (!empty($orderIds)) {
            $in = str_repeat('?,', count($orderIds) - 1) . '?';
            $itemStmt = $this->pdo->prepare("SELECT parent_order_id as order_id, product_name, quantity, is_freebie FROM order_items WHERE parent_order_id IN ($in) ORDER BY id ASC");
            $itemStmt->execute($orderIds);
            while ($row = $itemStmt->fetch(PDO::FETCH_ASSOC)) {
                $itemsByOrder[$row['order_id']][] = [
                    'product_name' => $row['product_name'],
                    'quantity' => (int)$row['quantity'],
                    'is_freebie' => (int)$row['is_freebie']
                ];
            }
        }

        foreach ($results as &$row) {
            $row['audio_links'] = $audioLinksByOrder[$row['order_id']] ?? [];
            $row['items'] = $itemsByOrder[$row['order_id']] ?? [];
        }

        return $results;
    }

    public function getUserSummaryData(
        string $orderStartDate, string $orderEndDate, 
        string $orderStartTime, string $orderEndTime,
        string $actionStartDate, string $actionEndDate,
        ?string $userId, ?int $companyId, string $resolutionStatus = 'All',
        string $audioStatus = 'All', string $reasonKeyword = '', string $searchKeyword = ''
    ): array
    {
        $params = [];
        $where = "1=1";
        
        // --- Order Date Logic ---
        if (!empty($orderStartDate) && !empty($orderEndDate)) {
            $startObj = DateTime::createFromFormat('Y-m-d', $orderStartDate);
            $endObj = DateTime::createFromFormat('Y-m-d', $orderEndDate);
            
            if ($startObj && $endObj && $startObj->format('Y-m-d') === $orderStartDate && $endObj->format('Y-m-d') === $orderEndDate) {
                // 6-month strict limit enforcement
                $diff = $startObj->diff($endObj);
                if ($diff->days > 186) { 
                    throw new InvalidArgumentException("กรุณาเลือกช่วงเวลาวันที่สร้างคำสั่งซื้อไม่เกิน 6 เดือน");
                }
                
                $where .= " AND o.order_date >= :order_start_date AND o.order_date <= :order_end_date";
                $params[':order_start_date'] = $orderStartDate . ' 00:00:00';
                $params[':order_end_date'] = $orderEndDate . ' 23:59:59';
                
                if (!empty($orderStartTime) && !empty($orderEndTime)) {
                    if (preg_match('/^([01][0-9]|2[0-3]):([0-5][0-9])$/', $orderStartTime) && 
                        preg_match('/^([01][0-9]|2[0-3]):([0-5][0-9])$/', $orderEndTime)) {
                        $where .= " AND TIME(o.order_date) >= :order_start_time AND TIME(o.order_date) <= :order_end_time";
                        $params[':order_start_time'] = $orderStartTime . ':00';
                        $params[':order_end_time'] = $orderEndTime . ':59';
                    }
                }
            }
        } else {
            throw new InvalidArgumentException("กรุณาระบุช่วงวันที่สร้างคำสั่งซื้อ (ไม่อนุญาตให้ค้นหาทั้งหมดเพื่อประสิทธิภาพ)");
        }
        
        // --- Action Date Logic ---
        if (!empty($actionStartDate) && !empty($actionEndDate)) {
            $aStartObj = DateTime::createFromFormat('Y-m-d', $actionStartDate);
            $aEndObj = DateTime::createFromFormat('Y-m-d', $actionEndDate);
            if ($aStartObj && $aEndObj) {
                $where .= " AND (
                    (o.order_status = 'Cancelled' AND oc.classified_at >= :action_start_date AND oc.classified_at <= :action_end_date)
                    OR 
                    ((o.order_status = 'Returned' OR EXISTS (SELECT 1 FROM order_boxes ob3 WHERE ob3.order_id = o.id AND ob3.return_status IS NOT NULL)) 
                     AND (SELECT MAX(ob.return_created_at) FROM order_boxes ob WHERE ob.order_id = o.id) >= :action_start_date 
                     AND (SELECT MAX(ob.return_created_at) FROM order_boxes ob WHERE ob.order_id = o.id) <= :action_end_date)
                )";
                $params[':action_start_date'] = $actionStartDate . ' 00:00:00';
                $params[':action_end_date'] = $actionEndDate . ' 23:59:59';
            }
        }
        
        if ($companyId) {
            $where .= " AND o.company_id = :company_id";
            $params[':company_id'] = $companyId;
        }

        if (!empty($userId)) {
            if (strpos($userId, ',') !== false) {
                $userIds = array_map('intval', explode(',', $userId));
                $inClause = implode(',', $userIds);
                $where .= " AND o.creator_id IN ($inClause)";
            } else {
                $where .= " AND o.creator_id = :user_id";
                $params[':user_id'] = (int)$userId;
            }
        }

        // Must be either returned or cancelled
        $where .= " AND (o.order_status = 'Cancelled' OR o.order_status = 'Returned' OR EXISTS (SELECT 1 FROM order_boxes ob4 WHERE ob4.order_id = o.id AND ob4.return_status IS NOT NULL))";

        if ($resolutionStatus === 'Completed') {
            $where .= " AND COALESCE(oar.is_completed, 0) = 1";
        } elseif ($resolutionStatus === 'Pending') {
            $where .= " AND COALESCE(oar.is_completed, 0) = 0";
        }

        if ($audioStatus === 'has_audio') {
            $where .= " AND EXISTS (SELECT 1 FROM order_audio_links oal WHERE oal.order_id = o.id)";
        } elseif ($audioStatus === 'no_audio') {
            $where .= " AND NOT EXISTS (SELECT 1 FROM order_audio_links oal WHERE oal.order_id = o.id)";
        }

        if (!empty($reasonKeyword)) {
            $where .= " AND (ct.label LIKE :reason_keyword_label OR oc.notes LIKE :reason_keyword_notes)";
            $params[':reason_keyword_label'] = '%' . $reasonKeyword . '%';
            $params[':reason_keyword_notes'] = '%' . $reasonKeyword . '%';
        }

        if (!empty($searchKeyword)) {
            $where .= " AND (c.first_name LIKE :search_fname OR c.last_name LIKE :search_lname OR c.phone LIKE :search_phone OR o.id = :exact_keyword)";
            $searchPattern = '%' . $searchKeyword . '%';
            $params[':search_fname'] = $searchPattern;
            $params[':search_lname'] = $searchPattern;
            $params[':search_phone'] = $searchPattern;
            $params[':exact_keyword'] = $searchKeyword;
        }

        $sql = "
            SELECT 
                u.username AS creator_name,
                SUM(CASE WHEN o.order_status = 'Returned' OR EXISTS (SELECT 1 FROM order_boxes ob5 WHERE ob5.order_id = o.id AND ob5.return_status IS NOT NULL) THEN 1 ELSE 0 END) AS returned_count,
                SUM(CASE WHEN o.order_status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled_count,
                SUM(
                    CASE 
                        WHEN o.order_status = 'Returned' OR EXISTS (SELECT 1 FROM order_boxes ob6 WHERE ob6.order_id = o.id AND ob6.return_status IS NOT NULL) 
                        THEN COALESCE((SELECT SUM(ob7.cod_amount) FROM order_boxes ob7 WHERE ob7.order_id = o.id AND ob7.return_status IS NOT NULL), 0)
                        ELSE 0 
                    END
                ) AS returned_amount,
                SUM(
                    CASE 
                        WHEN o.order_status = 'Cancelled' 
                        THEN COALESCE(NULLIF(o.cod_amount, 0), o.total_amount)
                        ELSE 0 
                    END
                ) AS cancelled_amount
            FROM orders o
            LEFT JOIN users u ON o.creator_id = u.id
            LEFT JOIN order_audio_resolutions oar ON o.id = oar.order_id
            LEFT JOIN customers c ON o.customer_id = c.customer_id
            LEFT JOIN order_cancellations oc ON o.id = oc.order_id
            LEFT JOIN cancellation_types ct ON oc.cancellation_type_id = ct.id
            WHERE $where
            GROUP BY u.id, u.username
            ORDER BY u.username ASC
        ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function autoMatchAudio(string $orderId, int $userId): array
    {
        // Get order details needed for matching
        $stmt = $this->pdo->prepare("
            SELECT o.order_date, c.phone, oc.classified_at AS cancelled_at,
            (SELECT MAX(ob.return_created_at) FROM order_boxes ob WHERE ob.order_id = o.id) AS returned_at
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.customer_id
            LEFT JOIN order_cancellations oc ON o.id = oc.order_id
            WHERE o.id = :order_id
        ");
        $stmt->execute([':order_id' => $orderId]);
        $order = $stmt->fetch();

        if (!$order || empty($order['phone'])) {
            return ['found' => false, 'message' => 'Order or customer phone not found'];
        }

        // Clean phone number
        $cleanPhone = preg_replace('/[^0-9\+]/', '', $order['phone']);
        if (strpos($cleanPhone, '0') === 0) {
            $cleanPhone = substr($cleanPhone, 1);
        }

        if (empty($cleanPhone)) {
            return ['found' => false, 'message' => 'Invalid phone number'];
        }

        // Call Audio API
        $requestUrl = $this->audioApiUrl . "?phone=" . urlencode($cleanPhone);
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $requestUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer " . $this->audioToken]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if (!$response || $httpCode != 200) {
            return ['found' => false, 'message' => 'Audio API request failed'];
        }

        $data = json_decode($response, true);
        if (!$data || empty($data['success']) || empty($data['data'])) {
            return ['found' => false, 'message' => 'No audio found from API'];
        }

        $orderTs = strtotime(substr($order['order_date'], 0, 10));
        $cancelTs = !empty($order['cancelled_at']) ? strtotime(substr($order['cancelled_at'], 0, 10)) : 0;
        $returnTs = !empty($order['returned_at']) ? strtotime(substr($order['returned_at'], 0, 10)) : 0;

        $foundLinks = [];

        foreach ($data['data'] as $call) {
            $callDate = $call['date'];
            if (!empty($call['time'])) {
                $callDate .= ' ' . $call['time'];
            }
            $callTs = strtotime($callDate);
            $isRelevant = false;

            // Check if call date is >= order date (up to present)
            if ($orderTs && $callTs >= $orderTs) {
                $isRelevant = true;
            }

            if ($isRelevant && !empty($call['link'])) {
                $foundLinks[] = [
                    'url' => $call['link'],
                    'date' => $callDate
                ];
            }
        }

        if (empty($foundLinks)) {
            return ['found' => false, 'message' => 'No relevant audio links found for the specified dates'];
        }

        // Save found links to database
        $savedCount = 0;
        foreach ($foundLinks as $linkData) {
            if ($this->saveAudioLink($orderId, $linkData['url'], 'auto', $userId, $linkData['date'])) {
                $savedCount++;
            }
        }

        return [
            'found' => true, 
            'links' => $foundLinks,
            'message' => "Found and saved {$savedCount} audio links"
        ];
    }

    public function saveManualAudioLink(string $orderId, string $audioUrl, int $userId, ?string $audioDate = null, ?string $notes = null): bool
    {
        return $this->saveAudioLink($orderId, $audioUrl, 'manual', $userId, $audioDate, $notes);
    }

    private function saveAudioLink(string $orderId, string $audioUrl, string $source, int $userId, ?string $audioDate = null, ?string $notes = null): bool
    {
        $check = $this->pdo->prepare("SELECT id, audio_date, notes FROM order_audio_links WHERE order_id = :order_id AND audio_url = :audio_url");
        $check->execute([':order_id' => $orderId, ':audio_url' => $audioUrl]);
        $existing = $check->fetch();
        
        if ($existing) {
            // Update the record if we have new audio_date or notes
            if (($audioDate && empty($existing['audio_date'])) || ($notes && empty($existing['notes']))) {
                $upd = $this->pdo->prepare("UPDATE order_audio_links SET audio_date = COALESCE(audio_date, :audio_date), notes = COALESCE(notes, :notes) WHERE id = :id");
                $upd->execute([
                    ':audio_date' => $audioDate ?: null,
                    ':notes' => $notes ?: null,
                    ':id' => $existing['id']
                ]);
                return true; // Consider it updated
            }
            return false; // Already exists and no updates needed
        }

        $stmt = $this->pdo->prepare("
            INSERT INTO order_audio_links (order_id, audio_url, source, created_by, audio_date, notes)
            VALUES (:order_id, :audio_url, :source, :created_by, :audio_date, :notes)
        ");
        
        return $stmt->execute([
            ':order_id' => $orderId,
            ':audio_url' => $audioUrl,
            ':source' => $source,
            ':created_by' => $userId,
            ':audio_date' => $audioDate ?: null,
            ':notes' => $notes ?: null
        ]);
    }

    public function saveOrderSummary(string $orderId, string $summary): bool
    {
        $stmt = $this->pdo->prepare("
            INSERT INTO order_audio_resolutions (order_id, resolution_notes) 
            VALUES (:order_id, :summary)
            ON DUPLICATE KEY UPDATE resolution_notes = VALUES(resolution_notes)
        ");
        return $stmt->execute([
            ':summary' => $summary,
            ':order_id' => $orderId
        ]);
    }

    public function updateAudioNotes(int $id, string $notes): bool
    {
        $stmt = $this->pdo->prepare("UPDATE order_audio_links SET notes = :notes WHERE id = :id");
        return $stmt->execute([
            ':notes' => $notes,
            ':id' => $id
        ]);
    }

    public function toggleOrderResolutionComplete(string $orderId, int $isCompleted): bool
    {
        $stmt = $this->pdo->prepare("
            INSERT INTO order_audio_resolutions (order_id, is_completed) 
            VALUES (:id, :status)
            ON DUPLICATE KEY UPDATE is_completed = VALUES(is_completed)
        ");
        return $stmt->execute([
            ':status' => $isCompleted,
            ':id' => $orderId
        ]);
    }

    public function updateOrderDetails(string $orderId, ?string $summaryNotes, array $newAudioLinks, array $updatedAudioLinks, array $deletedAudioIds, int $userId): bool
    {
        try {
            $this->pdo->beginTransaction();

            // 1. Update Order Summary
            if ($summaryNotes !== null) {
                $stmt = $this->pdo->prepare("
                    INSERT INTO order_audio_resolutions (order_id, resolution_notes) 
                    VALUES (:id, :notes)
                    ON DUPLICATE KEY UPDATE resolution_notes = VALUES(resolution_notes)
                ");
                $stmt->execute([':notes' => $summaryNotes, ':id' => $orderId]);
            }

            // 2. Delete audio links
            if (!empty($deletedAudioIds)) {
                $inQuery = implode(',', array_fill(0, count($deletedAudioIds), '?'));
                $delStmt = $this->pdo->prepare("DELETE FROM order_audio_links WHERE id IN ($inQuery) AND order_id = ?");
                $delParams = array_merge($deletedAudioIds, [$orderId]);
                $delStmt->execute($delParams);
            }

            // 3. Update existing audio links
            if (!empty($updatedAudioLinks)) {
                $updStmt = $this->pdo->prepare("UPDATE order_audio_links SET audio_url = :url, audio_date = :adate, notes = :notes WHERE id = :id AND order_id = :order_id");
                foreach ($updatedAudioLinks as $link) {
                    $updStmt->execute([
                        ':url' => $link['url'] ?? '',
                        ':adate' => !empty($link['date']) ? $link['date'] : null,
                        ':notes' => !empty($link['notes']) ? $link['notes'] : null,
                        ':id' => $link['id'],
                        ':order_id' => $orderId
                    ]);
                }
            }

            // 4. Insert new audio links
            if (!empty($newAudioLinks)) {
                $insStmt = $this->pdo->prepare("INSERT INTO order_audio_links (order_id, audio_url, source, created_by, audio_date, notes) VALUES (:order_id, :url, 'manual', :uid, :adate, :notes)");
                foreach ($newAudioLinks as $link) {
                    $insStmt->execute([
                        ':order_id' => $orderId,
                        ':url' => $link['url'] ?? '',
                        ':uid' => $userId,
                        ':adate' => !empty($link['date']) ? $link['date'] : null,
                        ':notes' => !empty($link['notes']) ? $link['notes'] : null
                    ]);
                }
            }

            $this->pdo->commit();
            return true;
        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }
}
