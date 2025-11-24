<?php
require_once __DIR__ . '/../api/config.php';

try {
    $pdo = db_connect();
    $sql = file_get_contents(__DIR__ . '/fix_all_triggers.sql');
    
    // We need to handle DELIMITER logic manually or just split by $$ for the trigger body
    // Simple split by DELIMITER $$ and DELIMITER ;
    
    // Actually, PDO::exec might handle multi-query if configured, but triggers are tricky.
    // Let's parse it simply.
    
    // 1. Drop triggers (simple statements)
    $pdo->exec("DROP TRIGGER IF EXISTS trg_validate_order_creator");
    $pdo->exec("DROP TRIGGER IF EXISTS customer_assignment_history_ref_bi");
    $pdo->exec("DROP TRIGGER IF EXISTS customer_assignment_history_ref_bu");
    
    // 2. Create trigger
    $createTrigger = "
    CREATE TRIGGER `trg_validate_order_creator` BEFORE INSERT ON `orders` FOR EACH ROW BEGIN
        DECLARE customer_company INT;
        DECLARE creator_company INT;
        DECLARE creator_role VARCHAR(64);
        DECLARE customer_pk INT;
        
        SET customer_pk = NEW.customer_id;

        IF customer_pk IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Customer not found';
        END IF;
        
        SELECT company_id INTO customer_company FROM customers WHERE customer_id = customer_pk;
        SELECT company_id, role INTO creator_company, creator_role FROM users WHERE id = NEW.creator_id;
        
        IF creator_company IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Creator user not found';
        END IF;
        
        IF creator_company != customer_company THEN
            IF creator_role != 'Super Admin' THEN
                SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Order creator must belong to same company as customer (unless Super Admin)';
            END IF;
        END IF;
        
        IF NEW.company_id != customer_company THEN
            SET NEW.company_id = customer_company;
        END IF;
    END";
    
    $pdo->exec($createTrigger);
    
    echo "Successfully fixed triggers.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
