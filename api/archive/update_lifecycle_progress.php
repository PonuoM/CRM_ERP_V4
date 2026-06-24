<?php
/**
 * Check Lifecycle Status Update Progress
 * Access via: https://www.prima49.com/mini_erp/api/update_lifecycle_progress.php
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');

$progress_file = __DIR__ . '/update_lifecycle_progress.json';
$checkpoint_file = __DIR__ . '/update_lifecycle_checkpoint.txt';

if (file_exists($progress_file)) {
    $data = json_decode(file_get_contents($progress_file), true);
    $data['file_age_seconds'] = time() - filemtime($progress_file);
    
    // Check if still running (file updated < 60 seconds ago)
    if ($data['file_age_seconds'] < 60 && $data['status'] === 'running') {
        $data['is_active'] = true;
    } else {
        $data['is_active'] = false;
    }
    
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
} elseif (file_exists($checkpoint_file)) {
    $checkpoint = (int)file_get_contents($checkpoint_file);
    echo json_encode([
        'status' => 'paused',
        'message' => 'Update was paused. Run update_lifecycle_status_safe.php to continue.',
        'checkpoint' => $checkpoint
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
} else {
    echo json_encode([
        'status' => 'not_started',
        'message' => 'No update in progress. Start by accessing api/update_lifecycle_status_safe.php'
    ], JSON_PRETTY_PRINT);
}
