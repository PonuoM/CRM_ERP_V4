<?php
require_once __DIR__ . '/../config.php';

cors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
}

$batch = isset($_GET['batch']) ? (int) $_GET['batch'] : 0;

if ($batch <= 0) {
  json_response(['ok' => false, 'error' => 'Missing or invalid batch'], 400);
}

try {
  $pdo = db_connect();

  $stmt = $pdo->prepare(
    "SELECT 
        id,
        company_id,
        user_id,
        batch,
        entry_date,
        entry_time,
        amount,
        channel,
        description,
        created_at
     FROM statement_logs
     WHERE batch = :batch
     ORDER BY entry_date, entry_time, id"
  );

  $stmt->execute([':batch' => $batch]);
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  json_response([
    'ok' => true,
    'batch' => $batch,
    'rows' => $rows,
  ]);
} catch (Throwable $e) {
  json_response([
    'ok' => false,
    'error' => 'Failed to get batch details',
    'detail' => $e->getMessage(),
  ], 500);
}

