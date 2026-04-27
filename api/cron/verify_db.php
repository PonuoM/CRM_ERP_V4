<?php
$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');

$res = $conn->query("
    SELECT first_name, last_name, province, company_id, COUNT(*) as cnt 
    FROM customers 
    GROUP BY first_name, last_name, province, company_id 
    HAVING COUNT(*) > 1 
    LIMIT 5
");
while($row = $res->fetch_assoc()) {
    print_r($row);
}
