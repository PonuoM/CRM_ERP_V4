-- Migration: Fix order_boxes COD validation (VERIFIED VERSION)
-- This version ensures triggers are properly dropped and recreated
-- Date: 2025-12-11

-- Force drop existing triggers (ignore errors if they don't exist)
DROP TRIGGER IF EXISTS trg_order_boxes_bi_enforce;
DROP TRIGGER IF EXISTS trg_order_boxes_bu_enforce;

-- Recreate INSERT trigger with RELAXED validation
DELIMITER $$
CREATE TRIGGER trg_order_boxes_bi_enforce
BEFORE INSERT ON order_boxes
FOR EACH ROW
BEGIN
    DECLARE v_order_payment ENUM('COD','Transfer','PayAfter');
    DECLARE v_expected_total DECIMAL(12,2);
    DECLARE v_sum DECIMAL(14,2);
    DECLARE v_box_count INT;

    -- Get order payment method and expected total
    SELECT NULLIF(payment_method, ''), COALESCE(cod_amount, total_amount, 0)
    INTO v_order_payment, v_expected_total
    FROM orders
    WHERE id = NEW.order_id;

    IF v_order_payment IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: order not found or payment method missing';
    END IF;

    -- Set defaults
    SET NEW.payment_method = COALESCE(NULLIF(NEW.payment_method, ''), v_order_payment, 'COD');
    SET NEW.status = COALESCE(NEW.status, 'PENDING');
    SET NEW.sub_order_id = CONCAT(NEW.order_id, '-', NEW.box_number);
    SET NEW.collection_amount = COALESCE(NEW.collection_amount, COALESCE(NEW.cod_amount, 0));
    SET NEW.collected_amount = COALESCE(NEW.collected_amount, 0);
    SET NEW.waived_amount = COALESCE(NEW.waived_amount, 0);

    -- Basic validations
    IF NEW.collection_amount < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: collection_amount cannot be negative';
    END IF;
    IF NEW.waived_amount < 0 OR NEW.collected_amount < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: collected/waived amounts cannot be negative';
    END IF;
    IF NEW.collected_amount + NEW.waived_amount > NEW.collection_amount THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: collected + waived exceeds collection_amount';
    END IF;

    -- Non-COD special handling
    IF NEW.payment_method <> 'COD' THEN
        SET NEW.collection_amount = v_expected_total;
        SELECT COUNT(*) INTO v_box_count FROM order_boxes WHERE order_id = NEW.order_id;
        IF v_box_count > 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: non-COD orders allow only one box';
        END IF;
    END IF;

    -- Calculate sum of all boxes including this new one
    SELECT COALESCE(SUM(collection_amount), 0) INTO v_sum FROM order_boxes WHERE order_id = NEW.order_id;
    SET v_sum = v_sum + NEW.collection_amount;

    -- RELAXED VALIDATION: Only error if sum EXCEEDS total (allow less than)
    IF NEW.payment_method = 'COD' THEN
        IF v_sum > v_expected_total THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: COD box totals exceed order total';
        END IF;
        -- REMOVED: strict equality check
    ELSE
        -- For non-COD, still require exact match
        IF v_sum <> v_expected_total THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: non-COD box must match order total';
        END IF;
    END IF;
END$$
DELIMITER ;

-- Recreate UPDATE trigger with RELAXED validation
DELIMITER $$
CREATE TRIGGER trg_order_boxes_bu_enforce
BEFORE UPDATE ON order_boxes
FOR EACH ROW
BEGIN
    DECLARE v_order_payment ENUM('COD','Transfer','PayAfter');
    DECLARE v_expected_total DECIMAL(12,2);
    DECLARE v_sum DECIMAL(14,2);
    DECLARE v_box_count INT;
    DECLARE v_effective_payment ENUM('COD','Transfer','PayAfter');

    -- Get order payment method and expected total
    SELECT NULLIF(payment_method, ''), COALESCE(cod_amount, total_amount, 0)
    INTO v_order_payment, v_expected_total
    FROM orders
    WHERE id = NEW.order_id;

    IF v_order_payment IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: order not found or payment method missing';
    END IF;

    -- Set defaults
    SET v_effective_payment = COALESCE(NULLIF(NEW.payment_method, ''), NULLIF(OLD.payment_method, ''), v_order_payment, 'COD');
    SET NEW.payment_method = v_effective_payment;
    SET NEW.status = COALESCE(NEW.status, OLD.status, 'PENDING');
    SET NEW.sub_order_id = CONCAT(NEW.order_id, '-', NEW.box_number);
    SET NEW.collection_amount = COALESCE(NEW.collection_amount, OLD.collection_amount, 0);
    SET NEW.collected_amount = COALESCE(NEW.collected_amount, OLD.collected_amount, 0);
    SET NEW.waived_amount = COALESCE(NEW.waived_amount, OLD.waived_amount, 0);

    -- Basic validations
    IF NEW.collection_amount < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: collection_amount cannot be negative';
    END IF;
    IF NEW.waived_amount < 0 OR NEW.collected_amount < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: collected/waived amounts cannot be negative';
    END IF;
    IF NEW.collected_amount + NEW.waived_amount > NEW.collection_amount THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: collected + waived exceeds collection_amount';
    END IF;

    -- Prevent changes after shipping
    IF NEW.collection_amount <> OLD.collection_amount AND OLD.status NOT IN ('PENDING','PREPARING') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: cannot change collection_amount after shipping';
    END IF;
    IF NEW.payment_method <> OLD.payment_method AND OLD.status NOT IN ('PENDING','PREPARING') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: cannot change payment_method after shipping';
    END IF;

    -- Non-COD special handling
    IF NEW.payment_method <> 'COD' THEN
        SET NEW.collection_amount = v_expected_total;
        SELECT COUNT(*) INTO v_box_count FROM order_boxes WHERE order_id = NEW.order_id AND id <> OLD.id;
        IF v_box_count > 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: non-COD orders allow only one box';
        END IF;
    END IF;

    -- Calculate sum excluding the old value of this box
    SELECT COALESCE(SUM(collection_amount), 0)
    INTO v_sum
    FROM order_boxes
    WHERE order_id = NEW.order_id
      AND id <> OLD.id;
    SET v_sum = v_sum + NEW.collection_amount;

    -- RELAXED VALIDATION: Only error if sum EXCEEDS total (allow less than)
    IF NEW.payment_method = 'COD' THEN
        IF v_sum > v_expected_total THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: COD box totals exceed order total';
        END IF;
        -- REMOVED: strict equality check
    ELSE
        -- For non-COD, still require exact match
        IF v_sum <> v_expected_total THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: non-COD box must match order total';
        END IF;
    END IF;
END$$
DELIMITER ;

-- Success message
SELECT 'Triggers updated successfully! COD validation is now relaxed.' AS Status;
