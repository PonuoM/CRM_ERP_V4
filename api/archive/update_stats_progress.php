<?php
/**
 * Check Update Progress
 * Access via: https://www.prima49.com/mini_erp/api/update_stats_progress.php
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');

$progress_file = __DIR__ . '/update_stats_progress.json';

if (file_exists($progress_file)) {
    $data = json_decode(file_get_contents($progress_file), true);
    $data['file_age_seconds'] = time() - filemtime($progress_file);
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
} else {
    echo json_encode([
        'status' => 'not_started',
        'message' => 'No update in progress. Start by accessing api/update_stats_v2.php'
    ], JSON_PRETTY_PRINT);
}
