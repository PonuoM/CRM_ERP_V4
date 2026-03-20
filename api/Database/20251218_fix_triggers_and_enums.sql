-- Migration: support_claim_freegift_triggers.sql
-- Purpose: 
-- 1. Add Claim/FreeGift to ENUMs in orders and order_boxes
-- 2. Update Triggers to handle Claim/FreeGift by enforcing 0 collection amount
-- 3. Use VARCHAR variables in triggers to prevent errors
-- UPDATED 2026-03-19: Removed single-box restriction for non-COD orders

-- 1. Update Columns
ALTER TABLE orders MODIFY COLUMN payment_method ENUM('COD', 'Transfer', 'PayAfter', 'Claim', 'FreeGift') DEFAULT NULL;
ALTER TABLE order_boxes MODIFY COLUMN payment_method ENUM('COD', 'Transfer', 'PayAfter', 'Claim', 'FreeGift') DEFAULT 'COD';

-- 2. Drop Triggers
DROP TRIGGER IF EXISTS trg_order_boxes_bi_enforce;
DROP TRIGGER IF EXISTS trg_order_boxes_bu_enforce;

-- 3. Recreate INSERT Trigger - SIMPLIFIED (no single-box restriction)
DELIMITER $$
CREATE TRIGGER trg_order_boxes_bi_enforce
BEFORE INSERT ON order_boxes
FOR EACH ROW
BEGIN
    DECLARE v_order_payment VARCHAR(50);

    -- Get order payment method
    SELECT CAST(payment_method AS CHAR)
    INTO v_order_payment
    FROM orders
    WHERE id = NEW.order_id;

    IF v_order_payment IS NULL OR v_order_payment = '' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: order not found or payment method missing';
    END IF;

    -- Set defaults (DO NOT override collection_amount!)
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

    -- REMOVED: single-box restriction for non-COD (all payment methods allow multiple boxes)
    -- REMOVED: box totals validation (allow flexible totals)
END$$
DELIMITER ;

-- 4. Recreate UPDATE Trigger - SIMPLIFIED (no single-box restriction)
DELIMITER $$
CREATE TRIGGER trg_order_boxes_bu_enforce
BEFORE UPDATE ON order_boxes
FOR EACH ROW
BEGIN
    DECLARE v_order_payment VARCHAR(50);
    DECLARE v_effective_payment VARCHAR(50);

    -- Get order payment method
    SELECT CAST(payment_method AS CHAR)
    INTO v_order_payment
    FROM orders
    WHERE id = NEW.order_id;

    IF v_order_payment IS NULL OR v_order_payment = '' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: order not found or payment method missing';
    END IF;

    -- Set defaults (DO NOT override collection_amount!)
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

    -- Prevent changes after shipping (except RETURNED status for return flow)
    IF NEW.collection_amount <> OLD.collection_amount AND OLD.status NOT IN ('PENDING','PREPARING') AND NEW.status <> 'RETURNED' AND OLD.status <> 'RETURNED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: cannot change collection_amount after shipping';
    END IF;
    IF NEW.payment_method <> OLD.payment_method AND OLD.status NOT IN ('PENDING','PREPARING') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: cannot change payment_method after shipping';
    END IF;

    -- REMOVED: single-box restriction for non-COD (all payment methods allow multiple boxes)
    -- REMOVED: box totals validation (allow flexible totals)
END$$
DELIMITER ;

SELECT 'Success' as Status;
