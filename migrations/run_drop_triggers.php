<?php
require_once __DIR__ . '/../api/config.php';

try {
    $pdo = db_connect();
    $sql = file_get_contents(__DIR__ . '/drop_activities_triggers.sql');
    
    // Split by semicolon and execute each command
    $commands = array_filter(array_map('trim', explode(';', $sql)));
    
    foreach ($commands as $command) {
        if (!empty($command)) {
            echo "Executing: $command\n";
            $pdo->exec($command);
        }
    }
    
    echo "Successfully dropped triggers.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
