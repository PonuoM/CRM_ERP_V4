# คู่มือการค้นหาและดึงลิงก์ไฟล์เสียงสนทนา (Voice Call Recordings) จาก Google Drive

คู่มือนี้สรุปวิธีการ (Best Practice) สำหรับระบบ Backend ที่ต้องการค้นหาและดึงลิงก์ไฟล์เสียงที่บันทึกไว้ใน Google Drive อัตโนมัติ โดยไม่ต้องให้ผู้ใช้งานต้องล็อกอินยืนยันตัวตน (Server-to-Server)

## สาเหตุที่การใช้แค่ API Key ทั่วไปจึงล้มเหลว
การใช้ **API Key** ธรรมดาในการเรียก Google Drive API จะสามารถค้นหาได้เฉพาะ **ไฟล์ที่เปิดแชร์แบบสาธารณะ (Public)** เท่านั้น หากไฟล์เสียงนั้นไม่ได้แชร์สาธารณะ ระบบจะคืนค่าข้อผิดพลาด เช่น `Google API error: The user does not have sufficient permissions for this file.` 
และเนื่องจากไฟล์เสียงสนทนาของลูกค้าเป็นข้อมูลส่วนบุคคล จึงไม่ควรแชร์แบบ Public เด็ดขาด

---

## การแก้ปัญหา: ใช้ Service Account

เพื่อให้ Server ของเราสามารถอ่านไฟล์ส่วนตัวในโฟลเดอร์ Google Drive ได้ เราต้องใช้ **Service Account** ซึ่งเปรียบเสมือนบัญชีหุ่นยนต์ (Bot Account) ของโปรเจกต์ 

### ขั้นตอนการตั้งค่าเบื้องต้น
1. **สร้าง Service Account:**
   - เข้าไปที่ Google Cloud Console -> **IAM & Admin** -> **Service Accounts**
   - สร้าง Service Account ใหม่ ระบบจะสร้างอีเมลให้ เช่น `bot-audio@project-name.iam.gserviceaccount.com`
2. **สร้าง Key (Credentials):**
   - สร้าง Key ในรูปแบบ **JSON** แล้วดาวน์โหลดมาเก็บไว้ที่เซิร์ฟเวอร์ของเราอย่างปลอดภัย (เช่น `service-account.json`)
3. **แชร์โฟลเดอร์ Google Drive ให้ Service Account (สำคัญมาก):**
   - ไปที่โฟลเดอร์ใน Google Drive หลักที่ใช้เก็บไฟล์เสียง
   - กดแชร์ (Share) โฟลเดอร์นั้น แล้วเพิ่มอีเมลของ Service Account (`bot-audio@...`) เข้าไป โดยให้สิทธิ์เป็น Viewer เป็นอย่างน้อย

---

## การเขียนโค้ดค้นหาไฟล์เสียงด้วย PHP

เพื่อให้ง่ายต่อการสร้าง Token (OAuth 2.0 JWT) แนะนำให้ใช้ Google API Client Library สำหรับ PHP แทนการเขียน cURL แบบดิบๆ

**1. ติดตั้งไลบรารีผ่าน Composer:**
```bash
composer require google/apiclient
```

**2. ตัวอย่างโค้ดค้นหาไฟล์เสียงตามเบอร์โทร:**
```php
<?php
require_once __DIR__ . '/vendor/autoload.php';

// 1. ตั้งค่าและยืนยันตัวตนด้วย Service Account JSON
$client = new \Google\Client();
$client->setAuthConfig('/path/to/service-account.json');
$client->addScope(\Google\Service\Drive::DRIVE_READONLY);

$service = new \Google\Service\Drive($client);

// 2. ข้อมูลสำหรับการค้นหา
$searchPhone = "0945547598"; // เบอร์โทรที่ต้องการค้นหา
$folderId = "YOUR_GOOGLE_DRIVE_FOLDER_ID"; // ไอดีของโฟลเดอร์หลักที่แชร์ให้ Service Account

// 3. สร้าง Query หาเฉพาะไฟล์เสียง .wav ที่มีชื่อเบอร์โทร และอยู่ในโฟลเดอร์ที่กำหนด
$q = "name contains '{$searchPhone}' and mimeType='audio/wav' and trashed=false and '{$folderId}' in parents";

// 4. สั่งค้นหา
try {
    $results = $service->files->listFiles([
        'q' => $q,
        'pageSize' => 100, // จำกัดจำนวนผลลัพธ์
        'fields' => 'nextPageToken, files(id, name, size, mimeType)',
        'orderBy' => 'createdTime desc' // เรียงจากใหม่ไปเก่า
    ]);

    $files = $results->getFiles();

    if (count($files) == 0) {
        echo "ไม่พบไฟล์เสียงสำหรับเบอร์: {$searchPhone}\n";
    } else {
        foreach ($files as $file) {
            echo "พบไฟล์: " . $file->getName() . "\n";
            // สร้างลิงก์สำหรับคลิกเพื่อเปิดฟัง/ดูไฟล์ใน Google Drive
            $fileUrl = "https://drive.google.com/file/d/" . $file->getId() . "/view";
            echo "ลิงก์ฟังเสียง: " . $fileUrl . "\n\n";
        }
    }
} catch (Exception $e) {
    echo "เกิดข้อผิดพลาด: " . $e->getMessage();
}
```

> [!TIP]
> **การเข้าถึงลิงก์ไฟล์ (View Link)**
> ลิงก์แบบ `https://drive.google.com/file/d/{ID}/view` ที่ได้มานั้น ผู้ที่จะคลิกเข้าไปฟังได้ จะต้องเป็นผู้ที่มีสิทธิ์ (เช่น ใช้บัญชี Gmail ของบริษัทที่มีสิทธิ์เข้าถึงโฟลเดอร์นั้นอยู่) หากนำลิงก์ไปให้ User ที่ไม่ได้สิทธิ์กด จะเข้าไม่ได้ตามปกติ ซึ่งถือเป็นการรักษาความปลอดภัยที่ดี
