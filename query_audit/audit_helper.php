<?php
/**
 * Shared Helpers for Order Call Audit System
 */

// Disable OPcache for this request
if (function_exists('opcache_invalidate')) {
    opcache_invalidate(__FILE__, true);
}

/**
 * Load and parse .env file
 */
function load_env_variables() {
    $envPath = dirname(__DIR__) . '/.env';
    if (!file_exists($envPath)) {
        throw new Exception('.env file not found');
    }

    $variables = [];
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        // Skip comments
        if (strpos(trim($line), '#') === 0) {
            continue;
        }

        // Parse key-value pair
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);

            // Strip surrounding quotes
            if (preg_match('/^["\'](.*)["\']$/', $value, $matches)) {
                $value = $matches[1];
            }

            $variables[$key] = $value;
        }
    }
    return $variables;
}

/**
 * Establish a PDO connection to the production server database using AGENT_DB_* .env credentials
 */
function get_agent_db_connection() {
    $env = load_env_variables();

    $host = $env['AGENT_DB_HOST'] ?? '';
    $port = $env['AGENT_DB_PORT'] ?? '3306';
    $db   = $env['AGENT_DB_NAME'] ?? '';
    $user = $env['AGENT_DB_USER'] ?? '';
    $pass = $env['AGENT_DB_PASS'] ?? '';

    if (empty($host) || empty($db) || empty($user) || empty($pass)) {
        throw new Exception('Missing AGENT database configurations in .env');
    }

    $dsn = "mysql:host={$host};dbname={$db};port={$port};charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 5
    ]);
    return $pdo;
}

/**
 * Format phone number to +66 prefix format
 */
function formatPhoneToPlus66($phone) {
    $digits = preg_replace('/\D/', '', $phone);
    if (strpos($phone, '+66') === 0) {
        return $phone;
    }
    if (strpos($digits, '0') === 0) {
        return '+66' . substr($digits, 1);
    }
    if (strpos($digits, '66') === 0) {
        return '+' . $digits;
    }
    return '+66' . $digits;
}

/**
 * Helper to perform HTTP POST
 */
function http_post($url, $headers, $body = '') {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    if ($body) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    $resp = curl_exec($ch);
    $info = curl_getinfo($ch);
    curl_close($ch);
    return ['body' => $resp, 'info' => $info];
}

/**
 * Helper to perform HTTP GET
 */
function http_get($url, $headers) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    $resp = curl_exec($ch);
    $info = curl_getinfo($ch);
    curl_close($ch);
    return ['body' => $resp, 'info' => $info];
}

/**
 * Fetch basic order information
 */
function fetch_order_details($pdo, $orderId) {
    $stmt = $pdo->prepare("
        SELECT 
            o.id AS order_id, 
            o.order_date, 
            o.creator_id, 
            u.first_name AS creator_name, 
            u.phone AS creator_phone,
            o.customer_id, 
            c.phone AS customer_phone,
            o.company_id
        FROM orders o
        LEFT JOIN users u ON o.creator_id = u.id
        LEFT JOIN customers c ON o.customer_id = c.customer_id
        WHERE o.id = ?
    ");
    $stmt->execute([$orderId]);
    return $stmt->fetch();
}

/**
 * Fetch appointments of a customer
 */
function fetch_appointments($pdo, $customerId) {
    $stmt = $pdo->prepare("
        SELECT id, customer_id, title, notes, date AS due_at, status, created_by 
        FROM appointments 
        WHERE customer_id = ? 
        ORDER BY date DESC
    ");
    $stmt->execute([$customerId]);
    return $stmt->fetchAll();
}

/**
 * Fetch OneCall voice recorder credential configs from DB env table
 */
function fetch_onecall_credentials($pdo, $companyId) {
    $usernameKey = "ONECALL_USERNAME_" . $companyId;
    $passwordKey = "ONECALL_PASSWORD_" . $companyId;

    $stmtEnv = $pdo->prepare("SELECT `key`, `value` FROM env WHERE `key` IN (?, ?)");
    $stmtEnv->execute([$usernameKey, $passwordKey]);
    $envRows = $stmtEnv->fetchAll();

    $onecallUser = '';
    $onecallPass = '';
    foreach ($envRows as $row) {
        if ($row['key'] === $usernameKey) {
            $onecallUser = trim($row['value'], '"');
        } elseif ($row['key'] === $passwordKey) {
            $onecallPass = trim($row['value'], '"');
        }
    }
    return ['username' => $onecallUser, 'password' => $onecallPass];
}

/**
 * Perform login to OneCall and return access token
 */
function login_onecall($username, $password) {
    $authString = base64_encode($username . ':' . $password);
    $loginUrl = 'https://onecallvoicerecord.dtac.co.th/orktrack/rest/user/login?version=orktrack&accesspolicy=all&licenseinfo=true';
    $loginHeaders = [
        'Accept: application/json',
        'Authorization: Basic ' . $authString,
        'Content-Length: 0',
        'Content-Type:'
    ];

    $loginResp = http_post($loginUrl, $loginHeaders);
    $loginData = json_decode($loginResp['body'], true);
    return $loginData['accesstoken'] ?? '';
}

/**
 * Fetch all recording files from OneCall for a target phone and date range
 */
function fetch_onecall_recordings($accessToken, $customerPhone, $orderDate) {
    $formattedCustPhone = formatPhoneToPlus66($customerPhone);

    // Search range: 2 days before order to 1 day after order date
    $orderTime = strtotime($orderDate);
    $startTime = $orderTime - (2 * 86400); 
    $endTime = $orderTime + (1 * 86400);   

    // Convert local Asia/Bangkok time to UTC (subtract 7 hours)
    $utcStart = $startTime - (7 * 3600);
    $utcEnd = $endTime - (7 * 3600);

    $startDateStr = date('Ymd_His', $utcStart);
    $endDateStr = date('Ymd_His', $utcEnd);

    $recordingsUrl = 'https://onecallvoicerecord.dtac.co.th/orktrack/rest/recordings' . 
        '?range=custom' . 
        '&startdate=' . urlencode($startDateStr) . 
        '&enddate=' . urlencode($endDateStr) . 
        '&party=' . urlencode($formattedCustPhone) . 
        '&page=1' . 
        '&pagesize=10' . 
        '&includetags=true' . 
        '&includemetadata=true' . 
        '&includeprograms=true';

    $recHeaders = [
        'Authorization: ' . $accessToken,
        'Accept: application/json'
    ];

    $recResp = http_get($recordingsUrl, $recHeaders);
    $recData = json_decode($recResp['body'], true);

    return [
        'recordings' => $recData['objects'] ?? [],
        'query_params' => [
            'party' => $formattedCustPhone,
            'startdate_utc' => $startDateStr,
            'enddate_utc' => $endDateStr
        ]
    ];
}
