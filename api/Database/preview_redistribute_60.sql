-- SQL Preview Script (Version แก้ไข: ใช้ customer_id และรองรับ MySQL เก่า)
-- รันโค้ดนี้เพื่อดูว่าใครจะได้ลูกค้าคนไหนบ้าง

SET @row_number = 0;

SELECT 
    t.customer_id,
    t.first_name,
    t.last_name,
    t.current_owner,
    CASE 
        WHEN t.rn % 5 = 1 THEN 1718
        WHEN t.rn % 5 = 2 THEN 1720
        WHEN t.rn % 5 = 3 THEN 1721
        WHEN t.rn % 5 = 4 THEN 63
        ELSE 59
    END AS new_owner_preview
FROM (
    SELECT 
        customer_id,
        first_name,
        last_name,
        assigned_to AS current_owner,
        (@row_number:=@row_number + 1) AS rn
    FROM customers
    WHERE assigned_to = 60 AND company_id = 7
    ORDER BY customer_id
) AS t;
