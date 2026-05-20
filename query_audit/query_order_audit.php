<?php
header('Content-Type: application/json; charset=utf-8');

// Disable OPcache for this request
if (function_exists('opcache_invalidate')) {
    opcache_invalidate(__FILE__, true);
}

// Increase execution time as Gemini API transcription might take some time
ini_set('max_execution_time', 120);

require_once __DIR__ . '/audit_helper.php';

$orderId = isset($_GET['order_id']) ? trim($_GET['order_id']) : '';
$mode    = isset($_GET['mode']) ? strtolower(trim($_GET['mode'])) : 'full';

if (empty($orderId)) {
    echo json_encode([
        'success' => false,
        'error' => 'Missing parameter: order_id'
    ]);
    exit;
}

try {
    // 1. Establish DB Connection
    $pdo = get_agent_db_connection();

    // 2. Fetch basic details
    $order = fetch_order_details($pdo, $orderId);
    if (!$order) {
        throw new Exception('Order not found on server database');
    }

    $appointments = fetch_appointments($pdo, $order['customer_id']);

    // 3. Fetch OneCall credentials & login
    $creds = fetch_onecall_credentials($pdo, $order['company_id']);
    if (empty($creds['username']) || empty($creds['password'])) {
        throw new Exception('OneCall credentials not found in env table for company ' . $order['company_id']);
    }

    $accessToken = login_onecall($creds['username'], $creds['password']);
    if (empty($accessToken)) {
        throw new Exception('OneCall authentication failed');
    }

    // 4. Fetch recordings from OneCall
    $recordingData = fetch_onecall_recordings($accessToken, $order['customer_phone'], $order['order_date']);
    $recordings = $recordingData['recordings'];

    // Handle DB Mode
    if ($mode === 'db') {
        echo json_encode([
            'success' => true,
            'order' => $order,
            'appointments' => $appointments,
            'onecall_status' => 'Authentication and query successful',
            'query_params' => $recordingData['query_params'],
            'recordings' => $recordings
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Handle Full Mode (transcription & validation)
    if (empty($recordings)) {
        echo json_encode([
            'success' => false,
            'error_type' => 'NO_RECORDINGS',
            'message' => 'ไม่พบไฟล์เสียงในระบบที่ตรงกับเงื่อนไข กรุณาค้นหาและส่งไฟล์เสียงมาให้ฉันโดยตรงเพื่อดำเนินการต่อ',
            'order' => $order,
            'appointments' => $appointments
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Load .env variables for Gemini API Key
    $env = load_env_variables();
    $geminiApiKey = $env['EXTERNAL_API_KEY'] ?? '';
    if (empty($geminiApiKey)) {
        throw new Exception('EXTERNAL_API_KEY not found in .env');
    }

    // Select the best matching recording (closest to the order date)
    $selectedRec = null;
    $minDiff = null;
    $orderTime = strtotime($order['order_date']);

    foreach ($recordings as $rec) {
        $recTime = strtotime($rec['timestamp']) + (7 * 3600); // Convert UTC back to Bangkok local time
        $diff = abs($orderTime - $recTime);
        if ($minDiff === null || $diff < $minDiff) {
            $minDiff = $diff;
            $selectedRec = $rec;
        }
    }

    if (!$selectedRec) {
        throw new Exception('Failed to select a valid recording from results');
    }

    // Download the audio file from OneCall
    $downloadUrl = $selectedRec['recordingURL'];
    $downloadResp = http_get($downloadUrl, [
        'Authorization: ' . $accessToken
    ]);

    if ($downloadResp['info']['http_code'] !== 200 || empty($downloadResp['body'])) {
        throw new Exception('Failed to download audio file from OneCall. HTTP Code: ' . $downloadResp['info']['http_code']);
    }

    $audioData = base64_encode($downloadResp['body']);

    // Call Gemini API to transcribe and analyze the audio
    $geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" . $geminiApiKey;
    $payload = [
        'contents' => [
            [
                'parts' => [
                    [
                        'text' => "คุณคือผู้ช่วยตรวจสอบสายโทรของพนักงานขาย (Telesale) ในระบบ CRM/ERP\n" .
                                 "กรุณาฟังไฟล์เสียงนี้และสรุปการสนทนาตามหัวข้อต่อไปนี้เป็นภาษาไทย:\n" .
                                 "1. สรุปสาระสำคัญจากการสนทนาสั้นๆ ได้ใจความ (Call Summary)\n" .
                                 "2. ถอดความคำต่อคำในส่วนที่พนักงานแนะตัว (แนะนำชื่อว่าอะไร)\n" .
                                 "3. ตรวจสอบว่าในสายคุยมีการนัดหมายในอนาคตหรือไม่ (เช่น นัดโทรกลับวันไหน)\n" .
                                 "4. รายการสินค้าและยอดเงินที่ตกลงกันตรงกันหรือไม่"
                    ],
                    [
                        'inlineData' => [
                            'mimeType' => 'audio/wav',
                            'data' => $audioData
                        ]
                    ]
                ]
            ]
        ]
    ];

    $geminiHeaders = [
        'Content-Type: application/json'
    ];

    $geminiResp = http_post($geminiUrl, $geminiHeaders, json_encode($payload));
    $geminiData = json_decode($geminiResp['body'], true);

    if ($geminiResp['info']['http_code'] !== 200 || empty($geminiData['candidates'][0]['content']['parts'][0]['text'])) {
        throw new Exception('Gemini API call failed: ' . $geminiResp['body']);
    }

    $analysisText = $geminiData['candidates'][0]['content']['parts'][0]['text'];

    // DB Validation Logic
    // Validation 1: Phone Mismatch
    $creatorPhoneNormalized = formatPhoneToPlus66($order['creator_phone']);
    $localPartyNormalized = formatPhoneToPlus66($selectedRec['localParty']);
    $phoneMismatch = ($creatorPhoneNormalized !== $localPartyNormalized);

    // Validation 2: Appointment Check
    $hasFutureAppointment = false;
    $futureAppDetail = null;
    $orderDateOnly = date('Y-m-d', $orderTime);
    foreach ($appointments as $app) {
        $appDateOnly = date('Y-m-d', strtotime($app['due_at']));
        if ($appDateOnly >= $orderDateOnly) {
            $hasFutureAppointment = true;
            $futureAppDetail = $app;
            break;
        }
    }

    echo json_encode([
        'success' => true,
        'order' => $order,
        'appointments' => $appointments,
        'recording' => [
            'id' => $selectedRec['id'],
            'timestamp_utc' => $selectedRec['timestamp'],
            'timestamp_bangkok' => date('Y-m-d H:i:s', strtotime($selectedRec['timestamp']) + 7 * 3600),
            'duration_seconds' => $selectedRec['duration'],
            'local_party' => $selectedRec['localParty'],
            'remote_party' => $selectedRec['remoteParty'],
            'direction' => $selectedRec['direction']
        ],
        'validation' => [
            'phone_mismatch' => $phoneMismatch,
            'creator_phone' => $creatorPhoneNormalized,
            'local_party_phone' => $localPartyNormalized,
            'has_future_appointment' => $hasFutureAppointment,
            'future_appointment' => $futureAppDetail
        ],
        'gemini_analysis' => $analysisText
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}
