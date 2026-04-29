<?php
$host = '127.0.0.1';
$port = '3306';
$user = 'root';
$pass = '12345678';

try {
    $pdo = new PDO("mysql:host=$host;port=$port;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    
    $stmt = $pdo->query("SHOW DATABASES");
    $dbs = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    $result = [];
    foreach($dbs as $db) {
        if(in_array($db, ['information_schema', 'mysql', 'performance_schema', 'sys'])) continue;
        
        try {
            $pdo->exec("USE `$db`");
            $stmt = $pdo->query("SHOW TABLES LIKE 'platforms'");
            if ($stmt->rowCount() > 0) {
                // Actually count rows using select count(*)
                $count = $pdo->query("SELECT COUNT(*) FROM platforms")->fetchColumn();
                $result[$db] = $count;
            }
        } catch (Exception $e) {
            // Ignore
        }
    }
    
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
