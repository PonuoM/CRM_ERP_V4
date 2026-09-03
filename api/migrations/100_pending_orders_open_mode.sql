-- โหมดการเปิดออเดอร์รอเปิด: เปิดเอง (self) หรือ ฝาก backoffice
-- self = ไม่โชว์ในคิว backoffice (คนขายเปิดเองบนเว็บ), backoffice = โชว์ให้หลังบ้านเปิด
ALTER TABLE pending_orders
  ADD COLUMN open_mode ENUM('self','backoffice') NOT NULL DEFAULT 'backoffice' AFTER note;
