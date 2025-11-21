<?php
require_once __DIR__ . '/../config.php';

cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
}

$input = json_input();
$batch = isset($input['batch']) ? (int) $input['batch'] : 0;

if ($batch <= 0) {
  json_response(['ok' => false, 'error' => 'Missing or invalid batch'], 400);
}

try {
  $pdo = db_connect();

  $stmt = $pdo->prepare("DELETE FROM statement_logs WHERE batch = :batch");
  $stmt->execute([':batch' => $batch]);
  $deleted = $stmt->rowCount();

  json_response([
    'ok' => true,
    'batch' => $batch,
    'deleted' => $deleted,
  ]);
} catch (Throwable $e) {
  json_response([
    'ok' => false,
    'error' => 'Failed to delete batch',
    'detail' => $e->getMessage(),
  ], 500);
}

