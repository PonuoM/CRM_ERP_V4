<?php
$pdo = new PDO('mysql:host=localhost;dbname=mini_erp', 'root', '12345678');
$stmt = $pdo->query('SELECT basket_key, basket_name, target_page, has_loop FROM basket_config WHERE company_id = 1 ORDER BY display_order');
foreach($stmt as $r) {
    echo $r['basket_key'] . ' | ' . $r['target_page'] . ' | loop:' . $r['has_loop'] . "\n";
}
