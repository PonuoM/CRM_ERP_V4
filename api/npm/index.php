<?php
require_once dirname(__DIR__) . "/../config.php";

cors();
?>
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Management API</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            padding: 25px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
        }
        h2 {
            color: #3498db;
            margin-top: 30px;
        }
        .endpoint {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 15px;
            border-left: 4px solid #3498db;
        }
        .endpoint h3 {
            margin-top: 0;
            color: #2c3e50;
        }
        .endpoint .url {
            font-family: monospace;
            background-color: #e9ecef;
            padding: 5px 8px;
            border-radius: 3px;
            display: inline-block;
            margin-top: 5px;
            font-size: 14px;
        }
        .endpoint .description {
            margin: 10px 0;
        }
        .note {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 5px;
            padding: 15px;
            margin-top: 20px;
        }
        .btn {
            display: inline-block;
            background-color: #3498db;
            color: white;
            padding: 8px 15px;
            border-radius: 4px;
            text-decoration: none;
            margin-top: 5px;
            margin-right: 5px;
            transition: background-color 0.3s;
        }
        .btn:hover {
            background-color: #2980b9;
        }
        .btn-success {
            background-color: #2ecc71;
        }
        .btn-success:hover {
            background-color: #27ae60;
        }
        .btn-warning {
            background-color: #f39c12;
        }
        .btn-warning:hover {
            background-color: #e67e22;
        }
        .btn-danger {
            background-color: #e74c3c;
        }
        .btn-danger:hover {
            background-color: #c0392b;
        }
        .status {
            font-weight: bold;
            padding: 3px 6px;
            border-radius: 3px;
            font-size: 12px;
            margin-left: 5px;
        }
        .status-safe {
            background-color: #d4edda;
            color: #155724;
        }
        .status-warning {
            background-color: #fff3cd;
            color: #856404;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Database Management API</h1>
        <p>API endpoints สำหรับจัดการฐานข้อมูล Prisma ผ่าน HTTP requests</p>

        <div class="note">
            <strong>คำเตือน:</strong> การใช้ API endpoints เหล่านี้จะรันคำสั่งบนเซิร์ฟเวอร์โดยตรง
            ควรใช้ในสภาพแวดล้อมที่ปลอดภัยเท่านั้น และไม่แนะนำให้เปิดให้สาธารณะเข้าถึง
        </div>

        <h2>Available Endpoints</h2>

        <div class="endpoint">
            <h3>Database Push <span class="status status-safe">Safe</span></h3>
            <div class="description">ส่งโครงสร้างฐานข้อมูลจาก Prisma schema ไปยังฐานข้อมูลจริง</div>
            <div class="url">GET /api/npm/push.php</div>
            <a href="push.php" class="btn btn-success">Execute Push</a>
        </div>

        <div class="endpoint">
            <h3>Database Pull <span class="status status-safe">Safe</span></h3>
            <div class="description">ดึงโครงสร้างฐานข้อมูลจากฐานข้อมูลจริงมาสู่ Prisma schema</div>
            <div class="url">GET /api/npm/pull.php</div>
            <a href="pull.php" class="btn">Execute Pull</a>
        </div>

        <div class="endpoint">
            <h3>Database Seed <span class="status status-warning">Caution</span></h3>
            <div class="description">เพิ่มข้อมูลเริ่มต้นลงในฐานข้อมูล (อาจเปลี่ยนแปลงข้อมูลที่มีอยู่)</div>
            <div class="url">GET /api/npm/seed.php</div>
            <a href="seed.php" class="btn btn-warning">Execute Seed</a>
        </div>

        <div class="endpoint">
            <h3>Database Sync <span class="status status-safe">Safe</span></h3>
            <div class="description">ซิงโครไนซ์ URL การเชื่อมต่อฐานข้อมูลระหว่าง config.php และ Prisma</div>
            <div class="url">GET /api/npm/sync.php</div>
            <a href="sync.php" class="btn">Execute Sync</a>
        </div>

        <div class="endpoint">
            <h3>Database Migrate <span class="status status-warning">Caution</span></h3>
            <div class="description">สร้างและใช้ migrations บนฐานข้อมูล (อาจเปลี่ยนแปลงโครงสร้างที่มีอยู่)</div>
            <div class="url">GET /api/npm/migrate.php</div>
            <a href="migrate.php" class="btn btn-danger">Execute Migrate</a>
        </div>

        <h2>API Response Format</h2>
        <p>ทุก endpoint จะส่งคืนข้อมูลในรูปแบบ JSON:</p>
        <pre>{
    "success": true|false,
    "message": "ข้อความแจ้งสถานะ",
    "output": "ข้อความผลลัพธ์จากการรันคำสั่ง"
}</pre>

        <h2>Security Recommendations</h2>
        <ul>
            <li>ควรจำกัดการเข้าถึง endpoints เหล่านี้เฉพาะ IP ที่เชื่อถือได้</li>
            <li>พิจารณาเพิ่ม authentication mechanism (เช่น API keys)</li>
            <li>ใน production ควรปิดการเข้าถึง endpoints เหล่านี้และใช้คำสั่งผ่าน command line แทน</li>
            <li>ตรวจสอบให้แน่ใจว่ามีการ backup ฐานข้อมูลก่อนรันคำสั่งที่มีความเสี่ยง</li>
        </ul>
    </div>
</body>
</html>
