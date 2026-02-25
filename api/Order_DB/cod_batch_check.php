<?php
/**
 * Batch check cod_records for multiple tracking numbers at once.
 * Instead of N individual requests, the frontend sends all trackings in one call.
 *
 * POST body: { "company_id": 5, "tracking_numbers": ["TH123", "TH456", ...] }
 * Response: { "records": { "TH123": { cod_amount, status, document_id, document_number }, ... } }
 */
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit();
}

require_once dirname(__DIR__) . "/config.php";

$input = json_decode(file_get_contents("php://input"), true);
$companyId = isset($input["company_id"]) ? (int) $input["company_id"] : 0;
$trackingNumbers = $input["tracking_numbers"] ?? [];

if ($companyId <= 0 || !is_array($trackingNumbers) || count($trackingNumbers) === 0) {
    echo json_encode(["records" => new \stdClass()]);
    exit();
}

// Limit to 500 to prevent abuse
$trackingNumbers = array_slice($trackingNumbers, 0, 500);

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Build IN clause with placeholders
    $placeholders = implode(',', array_fill(0, count($trackingNumbers), '?'));
    $params = $trackingNumbers;
    $params[] = $companyId;

    $sql = "
    SELECT cr.tracking_number, cr.cod_amount, cr.status, cr.document_id, cd.document_number
    FROM cod_records cr
    LEFT JOIN cod_documents cd ON cr.document_id = cd.id
    WHERE cr.tracking_number IN ($placeholders)
      AND cr.company_id = ?
    ORDER BY cr.created_at DESC
  ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Build map: tracking_number -> first matching record
    $records = [];
    foreach ($rows as $row) {
        $tn = $row['tracking_number'];
        if (!isset($records[$tn])) {
            $records[$tn] = [
                'cod_amount' => (float) $row['cod_amount'],
                'status' => $row['status'] ?? 'unknown',
                'document_id' => $row['document_id'] ? (int) $row['document_id'] : null,
                'document_number' => $row['document_number'],
            ];
        }
    }

    echo json_encode(["records" => empty($records) ? new \stdClass() : $records], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
?>