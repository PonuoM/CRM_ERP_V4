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

    public function getReportData(string $startDate, string $endDate, ?int $userId, ?int $companyId, string $statusType): array
    {
        // Allow only Returned or Cancelled
        if (!in_array($statusType, ['Returned', 'Cancelled'])) {
            throw new InvalidArgumentException("Invalid status type");
        }

        $params = [
            ':start_date' => $startDate . ' 00:00:00',
            ':end_date' => $endDate . ' 23:59:59'
        ];

        // Base where clauses
        $where = "o.order_date >= :start_date AND o.order_date <= :end_date";
        
        if ($companyId) {
            $where .= " AND o.company_id = :company_id";
            $params[':company_id'] = $companyId;
        }

        if ($userId) {
            $where .= " AND o.creator_id = :user_id";
            $params[':user_id'] = $userId;
        }

        // Filter by status. Note: sometimes order is 'Returned', or it's still 'Completed' but has returned boxes.
        // For 'Returned', we check order_status = 'Returned' OR exists a returned box.
        // For 'Cancelled', we just check order_status = 'Cancelled'.
        if ($statusType === 'Returned') {
            $where .= " AND (o.order_status = 'Returned' OR EXISTS (SELECT 1 FROM order_boxes ob2 WHERE ob2.order_id = o.id AND ob2.return_status IS NOT NULL))";
        } else {
            $where .= " AND o.order_status = 'Cancelled'";
        }

        $sql = "
            SELECT 
                o.id AS order_id,
                o.order_date,
                o.customer_id,
                CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
                c.phone AS customer_phone,
                IF(o.order_status = 'Returned', 
                    COALESCE((SELECT SUM(ob.cod_amount) FROM order_boxes ob WHERE ob.order_id = o.id), 0), 
                    o.total_amount
                ) AS total_amount,
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
                o.admin_resolution_notes
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.customer_id
            LEFT JOIN order_cancellations oc ON o.id = oc.order_id
            LEFT JOIN cancellation_types ct ON oc.cancellation_type_id = ct.id
            LEFT JOIN users u ON o.creator_id = u.id
            WHERE $where
            ORDER BY o.order_date DESC
        ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Fetch audio links
        $orderIds = array_column($results, 'order_id');
        $audioLinksByOrder = [];
        if (!empty($orderIds)) {
            $in = str_repeat('?,', count($orderIds) - 1) . '?';
            $audioStmt = $this->pdo->prepare("SELECT order_id, audio_url, audio_date, notes FROM order_audio_links WHERE order_id IN ($in) ORDER BY created_at ASC");
            $audioStmt->execute($orderIds);
            while ($row = $audioStmt->fetch(PDO::FETCH_ASSOC)) {
                $audioLinksByOrder[$row['order_id']][] = [
                    'url' => $row['audio_url'],
                    'date' => $row['audio_date'],
                    'notes' => $row['notes']
                ];
            }
        }

        foreach ($results as &$row) {
            $row['audio_links'] = $audioLinksByOrder[$row['order_id']] ?? [];
        }

        return $results;
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
            $callTs = strtotime($call['date']);
            $isRelevant = false;

            // Check if call date is >= order date (up to present)
            if ($orderTs && $callTs >= $orderTs) {
                $isRelevant = true;
            }

            if ($isRelevant && !empty($call['link'])) {
                $foundLinks[] = [
                    'url' => $call['link'],
                    'date' => $call['date']
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
        $stmt = $this->pdo->prepare("UPDATE orders SET admin_resolution_notes = :summary WHERE id = :order_id");
        return $stmt->execute([
            ':summary' => $summary,
            ':order_id' => $orderId
        ]);
    }
}
