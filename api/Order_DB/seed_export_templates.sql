-- ===========================================
-- Seed Default Templates (v.1 + v.2) — Global
-- Templates ใช้ร่วมกันทุกบริษัท
-- ตั้ง default สำหรับ company_id = 5
-- รันหลังจากสร้างตารางด้วย create_export_templates.sql แล้ว
-- ===========================================
-- display_mode: 'all' = แสดงทุก row, 'index' = แสดงเฉพาะแถวแรกของออเดอร์

-- V.1 Template
INSERT INTO export_templates (name) VALUES ('v.1');
SET @v1_id = LAST_INSERT_ID();

INSERT INTO export_template_columns (template_id, header_name, data_source, sort_order, default_value, display_mode) VALUES
(@v1_id, 'หมายเลขออเดอร์ออนไลน์', 'order.onlineOrderId', 0, NULL, 'index'),
(@v1_id, 'ชื่อร้านค้า', 'product.shop', 1, NULL, 'all'),
(@v1_id, 'เวลาที่สั่งซื้อ', 'order.deliveryDate', 2, NULL, 'index'),
(@v1_id, 'บัญชีร้านค้า', '', 3, NULL, 'all'),
(@v1_id, 'หมายเลขใบชำระเงิน', '', 4, NULL, 'all'),
(@v1_id, 'COD', 'order.codFlag', 5, NULL, 'index'),
(@v1_id, 'ช่องทางชำระเงิน', '', 6, NULL, 'all'),
(@v1_id, 'เวลาชำระเงิน', '', 7, NULL, 'all'),
(@v1_id, 'หมายเหตุใบสั่งซื้อ', 'order.notes', 8, NULL, 'all'),
(@v1_id, 'ข้อความจากร้านค้า', '', 9, NULL, 'all'),
(@v1_id, 'ค่าขนส่ง', '', 10, NULL, 'all'),
(@v1_id, 'จำนวนเงินที่ต้องชำระ', 'order.totalAmount', 11, NULL, 'index'),
(@v1_id, 'ผู้รับสินค้า', 'address.recipientFullName', 12, NULL, 'index'),
(@v1_id, 'นามสกุลผู้รับสินค้า', '', 13, NULL, 'index'),
(@v1_id, 'หมายเลขโทรศัพท์', 'customer.phone', 14, NULL, 'index'),
(@v1_id, 'หมายเลขมือถือ', 'customer.phone', 15, NULL, 'index'),
(@v1_id, 'สถานที่', 'address.street', 16, NULL, 'index'),
(@v1_id, 'ภูมิภาค', 'address.subdistrict', 17, NULL, 'index'),
(@v1_id, 'อำเภอ', 'address.district', 18, NULL, 'index'),
(@v1_id, 'จังหวัด', 'address.province', 19, NULL, 'index'),
(@v1_id, 'รหัสไปรษณีย์', 'address.postalCode', 20, NULL, 'index'),
(@v1_id, 'ประเทศ', '', 21, 'ไทย', 'index'),
(@v1_id, 'รับสินค้าที่ร้านหรือไม่', '', 22, NULL, 'all'),
(@v1_id, 'รหัสสินค้าบนแพลตฟอร์ม', '', 23, NULL, 'all'),
(@v1_id, 'รหัสสินค้าในระบบ', 'product.sku', 24, NULL, 'all'),
(@v1_id, 'ชื่อสินค้า', 'item.productName', 25, NULL, 'all'),
(@v1_id, 'สีและรูปแบบ', '', 26, NULL, 'all'),
(@v1_id, 'จำนวน', 'item.quantity', 27, NULL, 'all'),
(@v1_id, 'ราคาสินค้าต่อหน่วย', 'order.totalAmount', 28, NULL, 'index'),
(@v1_id, 'บริษัทขนส่ง', 'order.shippingProvider', 29, NULL, 'all'),
(@v1_id, 'หมายเลขขนส่ง', 'order.trackingNumbers', 30, NULL, 'all'),
(@v1_id, 'เวลาส่งสินค้า', '', 31, NULL, 'all'),
(@v1_id, 'สถานะ', 'order.orderStatus', 32, NULL, 'all'),
(@v1_id, 'พนักงานขาย', '', 33, NULL, 'all'),
(@v1_id, 'หมายเหตุออฟไลน์', '', 34, NULL, 'all'),
(@v1_id, 'รูปแบบคำสั่งซื้อ', '', 35, NULL, 'all'),
(@v1_id, 'รูปแบบการชำระ', '', 36, NULL, 'all');

-- V.2 Template (44 headers จาก order_import_template.xlsx)
INSERT INTO export_templates (name) VALUES ('v.2 วันที่ 2026-03-04');
SET @v2_id = LAST_INSERT_ID();

INSERT INTO export_template_columns (template_id, header_name, data_source, sort_order, default_value, display_mode) VALUES
(@v2_id, 'หมายเลขออเดอร์ออนไลน์', 'order.onlineOrderId', 0, NULL, 'index'),
(@v2_id, 'ชื่อร้านค้า', 'product.shop', 1, NULL, 'all'),
(@v2_id, 'เวลาที่สั่งซื้อ', 'order.deliveryDate', 2, NULL, 'index'),
(@v2_id, 'บัญชีร้านค้า', '', 3, NULL, 'all'),
(@v2_id, 'หมายเลขใบชำระเงิน', '', 4, NULL, 'all'),
(@v2_id, 'COD', 'order.codFlag', 5, NULL, 'index'),
(@v2_id, 'ช่องทางชำระเงิน', '', 6, NULL, 'all'),
(@v2_id, 'เวลาชำระเงิน', '', 7, NULL, 'all'),
(@v2_id, 'คลังสินค้า', '', 8, NULL, 'all'),
(@v2_id, 'หมายเหตุใบสั่งซื้อ', 'order.notes', 9, NULL, 'all'),
(@v2_id, 'ข้อความจากร้านค้า', '', 10, NULL, 'all'),
(@v2_id, 'ค่าขนส่ง', '', 11, NULL, 'all'),
(@v2_id, 'จำนวนเงินที่ต้องชำระ', 'order.totalAmount', 12, NULL, 'index'),
(@v2_id, 'ผู้รับสินค้า', 'address.recipientFullName', 13, NULL, 'index'),
(@v2_id, 'นามสกุลผู้รับสินค้า', '', 14, NULL, 'index'),
(@v2_id, 'รหัสไปรษณีย์', 'address.postalCode', 15, NULL, 'index'),
(@v2_id, 'หมายเลขโทรศัพท์', 'customer.phone', 16, NULL, 'index'),
(@v2_id, 'หมายเลขมือถือ', 'customer.phone', 17, NULL, 'index'),
(@v2_id, 'ประเทศ', '', 18, 'ไทย', 'index'),
(@v2_id, 'ภูมิภาค', 'address.subdistrict', 19, NULL, 'index'),
(@v2_id, 'จังหวัด', 'address.province', 20, NULL, 'index'),
(@v2_id, 'อำเภอ', 'address.district', 21, NULL, 'index'),
(@v2_id, 'สถานที่', 'address.street', 22, NULL, 'index'),
(@v2_id, 'รับสินค้าที่ร้านหรือไม่', '', 23, NULL, 'all'),
(@v2_id, 'รหัสสินค้าบนแพลตฟอร์ม', '', 24, NULL, 'all'),
(@v2_id, 'รหัสสินค้าในระบบ', '{product.sku}-{item.quantity}', 25, NULL, 'all'),
(@v2_id, 'ชื่อสินค้า', '{item.productName} {item.quantity}', 26, NULL, 'all'),
(@v2_id, 'สีและรูปแบบ', '', 27, NULL, 'all'),
(@v2_id, 'จำนวน', 'item.quantity', 28, NULL, 'all'),
(@v2_id, 'ราคาสินค้าต่อหน่วย', 'order.totalAmount', 29, NULL, 'index'),
(@v2_id, 'บริษัทขนส่ง', 'order.shippingProvider', 30, NULL, 'all'),
(@v2_id, 'หมายเลขขนส่ง', 'order.trackingNumbers', 31, NULL, 'all'),
(@v2_id, 'เวลาส่งสินค้า', '', 32, NULL, 'all'),
(@v2_id, 'สถานะ', 'order.orderStatus', 33, NULL, 'all'),
(@v2_id, 'พนักงานขาย', '', 34, NULL, 'all'),
(@v2_id, 'หมายเหตุออฟไลน์', '', 35, NULL, 'all'),
(@v2_id, 'รูปแบบคำสั่งซื้อ', '', 36, NULL, 'all'),
(@v2_id, 'รูปแบบการชำระ', '', 37, NULL, 'all'),
(@v2_id, 'ประเภทใบเสร็จ', '', 38, NULL, 'all'),
(@v2_id, 'ชื่อใบกำกับภาษี', '', 39, NULL, 'all'),
(@v2_id, 'เลขผู้เสียภาษีอากร', '', 40, NULL, 'all'),
(@v2_id, 'อีเมล', 'customer.email', 41, NULL, 'all'),
(@v2_id, 'เบอร์โทรใบแจ้งหนี้', '', 42, NULL, 'all'),
(@v2_id, 'ที่อยู่ใบแจ้งหนี้', '', 43, NULL, 'all');

-- ตั้ง v.1 เป็น default สำหรับ company_id = 5
INSERT INTO export_template_defaults (company_id, template_id) VALUES (5, @v1_id);
