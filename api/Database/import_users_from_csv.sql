-- Import users from CSV file
-- This script imports users from the CSV file with proper data types and foreign key handling

-- First, let's make sure we have the required company in the companies table
INSERT IGNORE INTO companies (id, name) VALUES (1, 'Default Company');

-- Now import the users from CSV
INSERT INTO users (
    id, username, password, first_name, last_name, email, phone, 
    role, company_id, team_id, supervisor_id, status, 
    created_at, updated_at, last_login, login_count
) VALUES
(2, 'supervisor', '1234', 'หัวหน้าทีมขาย', '[Supervisor]', 'supervisor@prima49.com', '081-234-5679', 'Supervisor Telesale', 1, 99, NULL, 'active', '2025-08-03 14:19:00', '2025-09-10 16:03:00', '2025-09-10 16:03:00', 0),
(3, 'telesales1', '1234', 'พนักงานขาย', 'telesale', 'telesales1@prima49.com', '081-234-5680', 'Telesale', 1, 99, 2, 'active', '2025-08-03 14:19:00', '2025-10-13 10:37:00', '2025-10-13 10:37:00', 0),
(24, 'pnr', '1234', 'ปอนด์', '[Supervisor]', 'pnr@gmail.com', '66950546556', 'Supervisor Telesale', 1, NULL, NULL, 'active', '2025-09-03 14:13:00', '2025-10-13 09:22:00', '2025-10-13 09:22:00', 0),
(25, 'nnn', '1234', 'หนิง', '[Supervisor]', 'nnn@gmail.com', '66994164440', 'Supervisor Telesale', 1, NULL, NULL, 'active', '2025-09-03 14:14:00', '2025-10-13 09:43:00', '2025-10-13 09:43:00', 0),
(26, 'nam', '1234', 'น้ำ', '[Supervisor]', 'nam@gmail.com', '66944272646', 'Supervisor Telesale', 1, NULL, NULL, 'active', '2025-09-03 14:15:00', '2025-10-13 09:14:00', '2025-10-13 09:14:00', 0),
(27, 'dva', '1234', 'แหวว', '[Supervisor]', 'dva@gmail.com', '66634656660', 'Supervisor Telesale', 1, NULL, NULL, 'active', '2025-09-03 14:15:00', '2025-10-13 08:59:00', '2025-10-13 08:59:00', 0),
(28, 'bee', '1234', 'บี', 'telesale', 'bee@gmail.com', '66626209650', 'Telesale', 1, 1, 24, 'active', '2025-09-03 14:26:00', '2025-10-13 08:58:00', '2025-10-13 08:58:00', 0),
(29, 'fff', '1234', 'ฝ้าย', '[Telesale]', 'fff@gmail.com', '66942491352', 'Telesale', 1, 2, 25, 'active', '2025-09-03 14:27:00', '2025-10-13 11:05:00', '2025-10-13 11:05:00', 0),
(30, 'fon', '1234', 'ฝน', '[Telesale]', 'fon@gmail.com', '66617060440', 'Telesale', 1, 2, 25, 'active', '2025-09-03 14:29:00', '2025-10-13 11:05:00', '2025-10-13 11:05:00', 0),
(31, 'viv', '1234', 'กวาง', '[Telesale]', 'viv@gmail.com', '66652041252', 'Telesale', 1, 3, 26, 'active', '2025-09-03 14:30:00', '2025-10-13 08:43:00', '2025-10-13 08:43:00', 0),
(32, 'eng', '1234', 'พลอยใส', '[Telesale]', 'eng@gmail.com', '66945547266', 'Telesale', 1, 3, 26, 'active', '2025-09-03 14:31:00', '2025-10-13 09:08:00', '2025-10-13 09:08:00', 0),
(33, 'noi', '1234', 'หน่อย', '[Telesale]', 'noi@gmail.com', '66660624651', 'Telesale', 1, 4, 27, 'active', '2025-09-03 14:32:00', '2025-10-13 09:11:00', '2025-10-13 09:11:00', 0),
(34, 'min', '1234', 'มินนี่', '[Telesale]', 'min@gmail.com', '66660524963', 'Telesale', 1, 4, 27, 'active', '2025-09-03 14:33:00', '2025-10-13 09:15:00', '2025-10-13 09:15:00', 0),
(35, 'ggg', '1234', 'แกรน', '[Telelsale]', 'ggg@gmail.com', '66626633267', 'Telesale', 1, 4, 27, 'active', '2025-09-03 14:34:00', '2025-10-13 08:51:00', '2025-10-13 08:51:00', 0),
(36, 'gof', '1234', 'กล๊อฟ', '[Telesale]', 'gof@gmail.com', '66945547598', 'Telesale', 1, 1, 24, 'active', '2025-09-03 14:35:00', '2025-10-13 09:04:00', '2025-10-13 09:04:00', 0),
(37, 'api', '1234', 'ตูน', '[Telesale]', 'api@gmail.com', '66831092265', 'Telesale', 1, 1, 24, 'active', '2025-09-03 14:37:00', '2025-10-13 09:08:00', '2025-10-13 09:08:00', 0),
(38, 'cha', '1234', 'เอ้', '[Telesale]', 'cha@gmail.com', '66991451323', 'Telesale', 1, 3, 26, 'active', '2025-09-03 14:37:00', '2025-10-13 08:36:00', '2025-10-13 08:36:00', 0),
(39, 'see', '1234', 'ซี', '[Telesale]', 'see@gmail.com', '66831092262', 'Telesale', 1, 2, 25, 'active', '2025-09-03 14:38:00', '2025-10-13 11:03:00', '2025-10-13 11:03:00', 0),
(40, 'nut', '1234', 'นัท', '[Telesale]', 'nut@gmail.com', '66831092264', 'Telesale', 1, 4, 27, 'active', '2025-09-03 14:39:00', '2025-10-13 08:43:00', '2025-10-13 08:43:00', 0),
(47, 'thanu', '1234', 'ธนู', 'สุริวงศ์', 'prima.thanu.s@gmail.com', '952519797', 'Super Admin', 1, NULL, NULL, 'active', '2025-09-03 23:03:00', '2025-10-08 16:40:00', '2025-10-08 16:40:00', 0),
(48, 'Boss', '1234', 'วัชรพัน', 'ลิ้มถาวรวิวัฒน์', 'watcharaphan.prima@gmail.com', '958765410', 'Super Admin', 1, NULL, NULL, 'active', '2025-09-04 09:31:00', '2025-10-13 08:59:00', '2025-10-13 08:59:00', 0),
(62, 'tai', '1234', 'ต่าย', '[Telesale]', 'tai@gmail.com', '626831777', 'Telesale', 1, 2, 25, 'active', '2025-09-04 14:04:00', '2025-10-13 11:14:00', '2025-10-13 11:14:00', 0),
(64, 'sry1', '1234', 'ปอ', 'Admin Page', 'sry1@prima49.com', '-', 'Admin Page', 1, NULL, NULL, 'active', '2025-09-05 13:43:00', '2025-09-05 13:43:00', NULL, 0),
(65, 'bow1', '1234', 'โบว์', 'Admin Page', 'bow1@prima49.com', '-', 'Admin Page', 1, NULL, NULL, 'active', '2025-09-05 13:43:00', '2025-09-05 13:43:00', NULL, 0),
(66, 'May-01', '1234', 'เมล์', 'Admin Page', 'may1@gmail.com', '-', 'Admin Page', 1, NULL, NULL, 'active', '2025-09-05 13:44:00', '2025-09-05 13:44:00', NULL, 0),
(67, 'yng1', '1234', 'หญิง', 'Admin Page', 'yng1@prima49.com', '-', 'Admin Page', 1, NULL, NULL, 'active', '2025-09-05 13:48:00', '2025-09-05 13:48:00', NULL, 0),
(68, 'pla1', '1234', 'เพลง', 'Admin Page', 'pla1@prima49.com', '-', 'Admin Page', 1, NULL, NULL, 'active', '2025-09-05 13:48:00', '2025-09-05 13:48:00', NULL, 0),
(69, 'ice1', '1234', 'ไอซ์', 'Admin Page', 'ice1@prima49.com', '-', 'Admin Page', 1, NULL, NULL, 'active', '2025-09-05 13:49:00', '2025-09-05 13:49:00', NULL, 0),
(70, 'imp1', '1234', 'อิ๊ม', 'Admin Page', 'imp1@prima49.com', '-', 'Admin Page', 1, NULL, NULL, 'active', '2025-09-05 13:50:00', '2025-09-05 13:50:00', NULL, 0),
(71, 'May-11', '1234', 'พี่่เมย์', 'Admin Page', 'may1@prima49.com', '-', 'Admin Page', 1, NULL, NULL, 'active', '2025-09-05 13:51:00', '2025-09-05 13:51:00', NULL, 0),
(72, 'tuu1', '1234', 'ตู่', 'Admin Page', 'test1@test.com', '-', 'Admin Page', 1, NULL, NULL, 'active', '2025-09-09 11:42:00', '2025-09-09 11:43:00', NULL, 0),
(73, 'mpp1', '1234', 'ปราย', 'Admin Page', 'test1@test.com', '-', 'Admin Page', 1, NULL, NULL, 'active', '2025-09-09 11:45:00', '2025-09-09 11:46:00', NULL, 0),
(74, 'ben1', '1234', 'เบญ', 'Admin Page', 'test1@test.com', '-', 'Admin Page', 1, NULL, NULL, 'active', '2025-09-09 11:45:00', '2025-09-09 11:46:00', NULL, 0),
(75, 'jay1', '1234', 'เจ', 'Admin Page', 'test1@test.com', '-', 'Admin Page', 1, NULL, NULL, 'active', '2025-09-09 11:46:00', '2025-09-09 11:46:00', NULL, 0),
(83, 'Zim', '1234', 'ซิ้ม', '[Telesale]', 'prima.telesale.001@gmail.com', '945551165', 'Telesale', 1, 4, 27, 'active', '2025-09-12 14:34:00', '2025-10-13 08:38:00', '2025-10-13 08:38:00', 0),
(84, 'aee', '1234', 'เอ๋', '[Telesale]', 'aee@gmail.com', '-', 'Telesale', 1, 1, 24, 'active', '2025-09-13 08:31:00', '2025-10-13 08:50:00', '2025-10-13 08:50:00', 0),
(85, 'pie', '1234', 'เปิ้ล', 'Telesale', 'pie@gmail.com', '66945463805', 'Telesale', 1, 1, 24, 'active', '2025-09-25 16:26:00', '2025-10-13 09:00:00', '2025-10-13 09:00:00', 0),
(88, 'som', '1234', 'ส้ม', '[Telesale]', 'prima.telesale.003@gmail.com', '805604433', 'Telesale', 1, 3, 26, 'active', '2025-09-26 14:33:00', '2025-10-13 08:06:00', '2025-10-13 08:06:00', 0),
(89, 'Nook', '1234', 'นุ๊ก', '[Telesale]', 'prima.telesale.004@gmail.com', '', 'Telesale', 1, 4, 27, 'active', '2025-09-26 14:35:00', '2025-10-13 09:00:00', '2025-10-13 09:00:00', 0),
(91, 'Took', '1234', 'ตุ๊กตา', '[Telesale]', 'prima.telesale.005@gmail.com', '', 'Telesale', 1, 4, 27, 'active', '2025-09-26 14:38:00', '2025-10-07 16:38:00', '2025-10-07 16:38:00', 0),
(92, 'TIKTOK', '1234', 'TIK', 'TOK', 'SHOP', 'TIKTOK@Gmail.com', '', 'Admin Page', 1, NULL, NULL, 'active', '2025-10-02 12:11:00', '2025-10-02 12:13:00', NULL, 0),
(93, 'Admin12', '1234', 'AdminPage', '[ไม่ทราบชื่อ]', 'Admin@prima.com', '', 'Admin Page', 1, NULL, NULL, 'active', '2025-10-02 15:44:00', '2025-10-02 15:44:00', NULL, 0);
