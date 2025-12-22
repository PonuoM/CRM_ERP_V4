<?php
// api/ai_priority.php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Services/ScoringService.php';
require_once __DIR__ . '/Services/GeminiService.php';

cors();
$pdo = db_connect();
validate_auth($pdo);

global $GEMINI_API_KEY;

$scoringService = new ScoringService();
$geminiService = new GeminiService($GEMINI_API_KEY);

$userId = $_GET['userId'] ?? null;
$companyId = $_GET['companyId'] ?? null;
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;

if (!$userId) {
    json_response(['error' => 'USER_ID_REQUIRED'], 400);
}

try {
    // 1. Fetch base customers with REAL last call date from history
    $sql = "SELECT c.*, 
            (SELECT MAX(date) FROM call_history WHERE customer_id = c.customer_id) as real_last_call_date 
            FROM customers c WHERE c.assigned_to = ?";
    $params = [$userId];
    if ($companyId) {
        $sql .= " AND c.company_id = ?";
        $params[] = $companyId;
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $customers = $stmt->fetchAll();

    $prioritized = [];
    $now = new DateTime();

    foreach ($customers as $c) {
        $cid = $c['customer_id'];
        
        // OVERRIDE: Trust call_history over customers.last_follow_up_date
        if (!empty($c['real_last_call_date'])) {
            $c['last_follow_up_date'] = $c['real_last_call_date'];
        }
        
        // Fetch appointments for local scoring
        $appStmt = $pdo->prepare("SELECT * FROM appointments WHERE customer_id = ? AND status != 'เสร็จสิ้น'");
        $appStmt->execute([$cid]);
        $appts = $appStmt->fetchAll();

        // Fetch order history for cycle detection (only successful orders)
        $orderStmt = $pdo->prepare("SELECT order_date, total_amount FROM orders WHERE customer_id = ? AND order_status IN ('Delivered', 'Approved', 'Confirmed') ORDER BY order_date DESC LIMIT 5");
        $orderStmt->execute([$cid]);
        $orders = $orderStmt->fetchAll();

        // Fetch call history for engagement signals and farm size
        $callStmt = $pdo->prepare("SELECT date, result, notes, area_size, crop_type FROM call_history WHERE customer_id = ? ORDER BY date DESC LIMIT 3");
        $callStmt->execute([$cid]);
        $calls = $callStmt->fetchAll();

        // Calculate local score with all data
        $localResult = $scoringService->calculateLocalScore($c, $appts, $orders, $calls);
        $localScore = $localResult['score'];
        $localReasons = $localResult['reasons'];
        
        // Fatigue check - if extremely negative, skip AI to save tokens
        if ($localScore < -100) {
            $c['ai_priority_score'] = $localScore;
            // Use local reasons for insight
            $reasonText = !empty($localReasons) ? implode(', ', $localReasons) : "ควรเว้นระยะการโทร";
            $c['ai_insight'] = "{$reasonText} ({$localScore})";
            $prioritized[] = $c;
            continue;
        }

        // OPTIONAL: AI Enhancement (disabled by default to save tokens)
        // Uncomment below to re-enable Gemini AI for high-priority customers
        /*
        $needsAI = empty($c['ai_last_updated']) || 
                   (new DateTime($c['ai_last_updated']))->diff($now)->days >= 1;

        if ($needsAI && $localScore > 200) {
            $aiResult = $geminiService->generateInsight($c, $orders, $calls);
            if ($aiResult) {
                $c['ai_score'] = $aiResult['score'] ?? 0;
                $c['ai_reason_thai'] = $aiResult['reason_thai'] ?? '';
                $c['ai_last_updated'] = $now->format('Y-m-d H:i:s');

                $upd = $pdo->prepare("UPDATE customers SET ai_score = ?, ai_reason_thai = ?, ai_last_updated = ? WHERE customer_id = ?");
                $upd->execute([$c['ai_score'], $c['ai_reason_thai'], $c['ai_last_updated'], $cid]);
            }
        }
        */

        // Final Priority Score = Local only (AI disabled)
        $c['ai_priority_score'] = $localScore;
        
        // Construct Insight: Local Reasons + Score
        if (!empty($localReasons)) {
            $c['ai_insight'] = implode(' | ', $localReasons) . " ({$c['ai_priority_score']})";
        } else {
            $c['ai_insight'] = "เกณฑ์ทั่วไป ({$c['ai_priority_score']})";
        }
        
        $prioritized[] = $c;
    }

    // Sort by final score descending
    usort($prioritized, function($a, $b) {
        return $b['ai_priority_score'] <=> $a['ai_priority_score'];
    });

    json_response(array_slice($prioritized, 0, $limit));

} catch (Exception $e) {
    json_response(['error' => 'AI_PRIORITY_FAILED', 'message' => $e->getMessage()], 500);
}
