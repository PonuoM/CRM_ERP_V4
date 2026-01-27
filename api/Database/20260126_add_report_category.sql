-- เพิ่ม column report_category สำหรับแยกประเภทปุ๋ยเพื่อทำรีพอร์ต
-- กระสอบเล็ก (25 กก.) | กระสอบใหญ่ (50 กก.) | อื่นๆ ใช้ค่าเดิมจาก category

-- Step 1: เพิ่ม column report_category
ALTER TABLE `products` 
ADD COLUMN `report_category` VARCHAR(128) DEFAULT NULL AFTER `category`;

-- Step 2: Update report_category สำหรับปุ๋ยกระสอบเล็ก (25 กก.)
UPDATE `products` 
SET `report_category` = 'กระสอบเล็ก'
WHERE (
    `name` LIKE '%25 กิโลกรัม%' 
    OR `name` LIKE '%25 ก.ก.%'
    OR `name` LIKE '%25 กก.%'
    OR `name` LIKE '%25กก%'
    OR `name` LIKE '%25 KG%'
    OR `name` LIKE '%25 Kg%'
    OR `category` = 'ปุ๋ยกระสอบเล็ก'
)
AND `category` IN ('ปุ๋ย', 'ปุ๋ยเม็ด', 'ปุ๋ยกระสอบเล็ก', 'ปุ๋ยกระสอบใหญ่');

-- Step 3: Update report_category สำหรับปุ๋ยกระสอบใหญ่ (50 กก.)
UPDATE `products` 
SET `report_category` = 'กระสอบใหญ่'
WHERE (
    `name` LIKE '%50 กิโลกรัม%' 
    OR `name` LIKE '%50 ก.ก.%'
    OR `name` LIKE '%50 กก.%'
    OR `name` LIKE '%50กก%'
    OR `name` LIKE '%50 KG%'
    OR `name` LIKE '%50 Kg%'
    OR `category` = 'ปุ๋ยกระสอบใหญ่'
)
AND `category` IN ('ปุ๋ย', 'ปุ๋ยเม็ด', 'ปุ๋ยกระสอบเล็ก', 'ปุ๋ยกระสอบใหญ่');

-- Step 4: Update report_category สำหรับสินค้าอื่นๆ (ใช้ค่า category เดิม)
UPDATE `products` 
SET `report_category` = `category`
WHERE `report_category` IS NULL;

-- ตรวจสอบผลลัพธ์
SELECT id, sku, name, category, report_category 
FROM products 
WHERE category IN ('ปุ๋ย', 'ปุ๋ยเม็ด', 'ปุ๋ยกระสอบเล็ก', 'ปุ๋ยกระสอบใหญ่')
ORDER BY report_category, name;
