<?php
require_once __DIR__ . '/config.php';
header('Content-Type: text/plain; charset=utf-8');

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    echo "--- STARTING TRIGGER UPDATE ---\n";

    // 1. Drop existing triggers
    echo "Dropping old triggers...\n";
    $pdo->exec("DROP TRIGGER IF EXISTS trg_order_boxes_bi_enforce");
    $pdo->exec("DROP TRIGGER IF EXISTS trg_order_boxes_bu_enforce");

    // 2. Create INSERT Trigger (Using VARCHAR to support new methods)
    echo "Creating INSERT trigger...\n";
    $trgInsert = <<<SQL
CREATE TRIGGER trg_order_boxes_bi_enforce
BEFORE INSERT ON order_boxes
FOR EACH ROW
BEGIN
    DECLARE v_order_payment VARCHAR(50);
    DECLARE v_expected_total DECIMAL(12,2);
    DECLARE v_sum DECIMAL(14,2);
    DECLARE v_box_count INT;

    SELECT CAST(payment_method AS CHAR), 
           CASE 
               WHEN payment_method IN ('Claim', 'FreeGift') THEN 0
               ELSE COALESCE(cod_amount, total_amount, 0)
           END
    INTO v_order_payment, v_expected_total
    FROM orders
    WHERE id = NEW.order_id;

    IF v_order_payment IS NULL OR v_order_payment = '' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: order not found or payment method missing';
    END IF;

    SET NEW.payment_method = COALESCE(NULLIF(NEW.payment_method, ''), v_order_payment, 'COD');
    SET NEW.status = COALESCE(NEW.status, 'PENDING');
    SET NEW.sub_order_id = CONCAT(NEW.order_id, '-', NEW.box_number);
    SET NEW.collection_amount = COALESCE(NEW.collection_amount, COALESCE(NEW.cod_amount, 0));
    SET NEW.collected_amount = COALESCE(NEW.collected_amount, 0);
    SET NEW.waived_amount = COALESCE(NEW.waived_amount, 0);

    IF NEW.collection_amount < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: collection_amount cannot be negative';
    END IF;

    IF NEW.payment_method <> 'COD' THEN
        SET NEW.collection_amount = v_expected_total;
        SELECT COUNT(*) INTO v_box_count FROM order_boxes WHERE order_id = NEW.order_id;
        IF v_box_count > 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: non-COD orders allow only one box';
        END IF;
    END IF;

    SELECT COALESCE(SUM(collection_amount), 0) INTO v_sum FROM order_boxes WHERE order_id = NEW.order_id;
    SET v_sum = v_sum + NEW.collection_amount;

    IF NEW.payment_method = 'COD' THEN
        IF v_sum > v_expected_total THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: COD box totals exceed order total';
        END IF;
    ELSE
        IF v_sum <> v_expected_total THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: non-COD box must match order total';
        END IF;
    END IF;
END
SQL;
    $pdo->exec($trgInsert);
    echo "INSERT Trigger Created.\n";

    // 3. Create UPDATE Trigger
    echo "Creating UPDATE trigger...\n";
    $trgUpdate = <<<SQL
CREATE TRIGGER trg_order_boxes_bu_enforce
BEFORE UPDATE ON order_boxes
FOR EACH ROW
BEGIN
    DECLARE v_order_payment VARCHAR(50);
    DECLARE v_expected_total DECIMAL(12,2);
    DECLARE v_sum DECIMAL(14,2);
    DECLARE v_box_count INT;
    DECLARE v_effective_payment VARCHAR(50);

    SELECT CAST(payment_method AS CHAR), 
           CASE 
               WHEN payment_method IN ('Claim', 'FreeGift') THEN 0
               ELSE COALESCE(cod_amount, total_amount, 0)
           END
    INTO v_order_payment, v_expected_total
    FROM orders
    WHERE id = NEW.order_id;

    IF v_order_payment IS NULL OR v_order_payment = '' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: order not found or payment method missing';
    END IF;

    SET v_effective_payment = COALESCE(NULLIF(NEW.payment_method, ''), NULLIF(OLD.payment_method, ''), v_order_payment, 'COD');
    SET NEW.payment_method = v_effective_payment;
    SET NEW.status = COALESCE(NEW.status, OLD.status, 'PENDING');
    SET NEW.sub_order_id = CONCAT(NEW.order_id, '-', NEW.box_number);
    SET NEW.collection_amount = COALESCE(NEW.collection_amount, OLD.collection_amount, 0);

    IF NEW.payment_method <> 'COD' THEN
        SET NEW.collection_amount = v_expected_total;
        SELECT COUNT(*) INTO v_box_count FROM order_boxes WHERE order_id = NEW.order_id AND id <> OLD.id;
        IF v_box_count > 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: non-COD orders allow only one box';
        END IF;
    END IF;

    SELECT COALESCE(SUM(collection_amount), 0) INTO v_sum FROM order_boxes WHERE order_id = NEW.order_id AND id <> OLD.id;
    SET v_sum = v_sum + NEW.collection_amount;

    IF NEW.payment_method = 'COD' THEN
        IF v_sum > v_expected_total THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: COD box totals exceed order total';
        END IF;
    ELSE
        IF v_sum <> v_expected_total THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: non-COD box must match order total';
        END IF;
    END IF;
END
SQL;
    $pdo->exec($trgUpdate);
    echo "UPDATE Trigger Created.\n";

    echo "\n--- SUCCESS: Triggers have been updated! ---\n";
    echo "You should now be able to create Claim and FreeGift orders.\n";

} catch (Throwable $e) {
    echo "\nERROR: " . $e->getMessage() . "\n";
    echo "SQL State: " . $pdo->errorInfo()[0] . "\n";
}
