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

  // Prefer new transfer_at column; fall back to entry_at or entry_date/entry_time if needed
  $hasTransferAt = false;
  $hasEntryAt = false;

  $colStmt = $pdo->query("SHOW COLUMNS FROM statement_logs LIKE 'transfer_at'");
  if ($colStmt !== false && $colStmt->fetch(PDO::FETCH_ASSOC)) {
    $hasTransferAt = true;
  } else {
    $colStmt = $pdo->query("SHOW COLUMNS FROM statement_logs LIKE 'entry_at'");
    if ($colStmt !== false && $colStmt->fetch(PDO::FETCH_ASSOC)) {
      $hasEntryAt = true;
    }
  }

  if ($hasTransferAt) {
    $stmt = $pdo->prepare(
      "SELECT 
        id,
        company_id,
        user_id,
        batch,
        DATE(transfer_at) AS entry_date,
        TIME(transfer_at) AS entry_time,
        amount,
        channel,
        description,
        created_at
       FROM statement_logs
       WHERE batch = :batch
       ORDER BY transfer_at, id"
    );
  } elseif ($hasEntryAt) {
    $stmt = $pdo->prepare(
      "SELECT 
        id,
        company_id,
        user_id,
        batch,
        DATE(entry_at) AS entry_date,
        TIME(entry_at) AS entry_time,
        amount,
        channel,
        description,
        created_at
       FROM statement_logs
       WHERE batch = :batch
       ORDER BY entry_at, id"
    );
  } else {
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
  }

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
