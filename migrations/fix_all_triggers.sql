DROP TRIGGER IF EXISTS trg_validate_order_creator;
DROP TRIGGER IF EXISTS customer_assignment_history_ref_bi;
DROP TRIGGER IF EXISTS customer_assignment_history_ref_bu;

DELIMITER $$

CREATE TRIGGER `trg_validate_order_creator` BEFORE INSERT ON `orders` FOR EACH ROW BEGIN
    DECLARE customer_company INT;
    DECLARE creator_company INT;
    DECLARE creator_role VARCHAR(64);
    DECLARE customer_pk INT;
    
    -- Use customer_id directly as it is the INT PK
    SET customer_pk = NEW.customer_id;

    IF customer_pk IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Customer not found';
    END IF;
    
    -- Removed reference to customer_ref_id
    -- SET NEW.customer_ref_id = customer_pk;

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
END$$

DELIMITER ;
