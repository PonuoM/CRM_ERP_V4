<?php
$file = dirname(__DIR__) . '/api/index.php';
$search = "debt_collection";

$results = [];
if (file_exists($file)) {
    $content = file_get_contents($file);
    $lines = explode("\n", $content);
    foreach ($lines as $num => $line) {
        if (strpos($line, $search) !== false) {
            $results[] = [
                'line' => $num + 1,
                'content' => trim($line)
            ];
        }
    }
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
