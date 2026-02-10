-- Migration: Allow collection_amount changes when transitioning to/from RETURNED status
-- This is needed for the Return Management flow

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS `order_boxes_before_update`;

DELIMITER $$
CREATE TRIGGER `order_boxes_before_update` BEFORE UPDATE ON `order_boxes` FOR EACH ROW
BEGIN
    DECLARE v_order_payment VARCHAR(50);
    DECLARE v_effective_payment VARCHAR(50);

    -- Fetch the order-level payment method for reference
    SELECT payment_method INTO v_order_payment
    FROM orders WHERE id = NEW.order_id LIMIT 1;

    -- Set defaults (DO NOT override collection_amount!)
    SET v_effective_payment = COALESCE(NULLIF(NEW.payment_method, ''), NULLIF(OLD.payment_method, ''), v_order_payment, 'COD');
    SET NEW.payment_method = v_effective_payment;
    SET NEW.status = COALESCE(NEW.status, OLD.status, 'PENDING');
    SET NEW.sub_order_id = CONCAT(NEW.order_id, '-', NEW.box_number);
    SET NEW.collection_amount = COALESCE(NEW.collection_amount, OLD.collection_amount, 0);
    SET NEW.collected_amount = COALESCE(NEW.collected_amount, OLD.collected_amount, 0);
    SET NEW.waived_amount = COALESCE(NEW.waived_amount, OLD.waived_amount, 0);

    -- Basic validations only
    IF NEW.collection_amount < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: collection_amount cannot be negative';
    END IF;
    IF NEW.waived_amount < 0 OR NEW.collected_amount < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: collected/waived amounts cannot be negative';
    END IF;
    IF NEW.collected_amount + NEW.waived_amount > NEW.collection_amount THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: collected + waived exceeds collection_amount';
    END IF;

    -- Prevent changes after shipping (except when transitioning to/from RETURNED for return flow)
    IF NEW.collection_amount <> OLD.collection_amount AND OLD.status NOT IN ('PENDING','PREPARING') AND NEW.status <> 'RETURNED' AND OLD.status <> 'RETURNED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: cannot change collection_amount after shipping';
    END IF;
    IF NEW.payment_method <> OLD.payment_method AND OLD.status NOT IN ('PENDING','PREPARING') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: cannot change payment_method after shipping';
    END IF;

    -- REMOVED: box totals validation (allow flexible totals)
    -- REMOVED: single-box restriction for non-COD
END
$$
DELIMITER ;
