<?php
require_once __DIR__ . '/config.php';

// Set content type
header('Content-Type: text/html; charset=utf-8');

?>
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>แปลงข้อมูลผู้ใช้</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .container {
            background-color: #f9f9f9;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
        }
        .button {
            background-color: #3498db;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px 5px;
        }
        .button:hover {
            background-color: #2980b9;
        }
        .result {
            margin-top: 20px;
            padding: 15px;
            border-radius: 5px;
            white-space: pre-wrap;
            font-family: monospace;
            background-color: #f1f1f1;
            border: 1px solid #ddd;
            max-height: 500px;
            overflow-y: auto;
        }
        .success {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .error {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .info {
            background-color: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
        }
        .section {
            margin: 20px 0;
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 5px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        th, td {
            padding: 8px 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #f2f2f2;
            font-weight: bold;
        }
        .password-found {
            color: #28a745;
            font-weight: bold;
        }
        .password-not-found {
            color: #dc3545;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>เครื่องมือแปลงข้อมูลผู้ใช้</h1>
        
        <div class="section">
            <h2>คำอธิบาย</h2>
            <p>เครื่องมือนี้ใช้สำหรับแปลงข้อมูลผู้ใช้จากตารางเก่าไปยังตารางใหม่ที่มีโครงสร้างตาม schema ล่าสุด</p>
            <p>โดยจะ:</p>
            <ul>
                <li>วิเคราะห์รหัสผ่านที่ถูก hash และพยายาหารหัสผ่านต้นฉบับจากรหัสผ่านที่ใช้กันทั่วไป</li>
                <li>แปลงโครงสร้างข้อมูลให้สอดคล้องกับตารางใหม่</li>
                <li>สร้างไฟล์ SQL สำหรับนำเข้าข้อมูล</li>
            </ul>
        </div>
        
        <div class="section">
            <button class="button" onclick="analyzePasswords()">วิเคราะห์รหัสผ่าน</button>
            <button class="button" onclick="convertUsers()">แปลงข้อมูลผู้ใช้</button>
            <button class="button" onclick="downloadSQL()">ดาวน์โหลดไฟล์ SQL</button>
        </div>
        
        <div id="result" class="result" style="display: none;"></div>
        
        <div id="passwordTable" style="display: none;">
            <h2>ผลการวิเคราะห์รหัสผ่าน</h2>
            <table id="passwordAnalysisTable">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Username</th>
                        <th>Hash Type</th>
                        <th>Original Password</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody id="passwordTableBody">
                </tbody>
            </table>
        </div>
    </div>

    <script>
        function showResult(message, type = 'info') {
            const resultDiv = document.getElementById('result');
            resultDiv.textContent = message;
            resultDiv.className = `result ${type}`;
            resultDiv.style.display = 'block';
        }
        
        function analyzePasswords() {
            showResult('กำลังวิเคราะห์รหัสผ่าน...', 'info');
            
            fetch('convert_users.php')
                .then(response => response.json())
                .then(data => {
                    if (data.ok) {
                        showResult(`วิเคราะห์เสร็จสิ้น! พบผู้ใช้ทั้งหมด ${data.total_users} คน`, 'success');
                        
                        // Display password analysis in table
                        const tableBody = document.getElementById('passwordTableBody');
                        tableBody.innerHTML = '';
                        
                        data.password_analysis.forEach(user => {
                            const row = document.createElement('tr');
                            const analysis = user.password_analysis;
                            
                            let passwordCell = '';
                            let statusClass = '';
                            
                            if (analysis.original_password) {
                                passwordCell = `<span class="password-found">${analysis.original_password}</span>`;
                                statusClass = 'password-found';
                            } else {
                                passwordCell = '<span class="password-not-found">ไม่พบ</span>';
                                statusClass = 'password-not-found';
                            }
                            
                            row.innerHTML = `
                                <td>${user.user_id}</td>
                                <td>${user.username}</td>
                                <td>${analysis.hash_type}</td>
                                <td>${passwordCell}</td>
                                <td class="${statusClass}">${analysis.original_password ? 'พบ' : 'ไม่พบ'}</td>
                            `;
                            
                            tableBody.appendChild(row);
                        });
                        
                        document.getElementById('passwordTable').style.display = 'block';
                    } else {
                        showResult(`เกิดข้อผิดพลาด: ${data.message}`, 'error');
                    }
                })
                .catch(error => {
                    showResult(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
                });
        }
        
        function convertUsers() {
            showResult('กำลังแปลงข้อมูลผู้ใช้...', 'info');
            
            fetch('convert_users.php')
                .then(response => response.json())
                .then(data => {
                    if (data.ok) {
                        showResult(`แปลงข้อมูลเสร็จสิ้น! สร้างไฟล์ SQL สำเร็จแล้ว: ${data.sql_file}`, 'success');
                    } else {
                        showResult(`เกิดข้อผิดพลาด: ${data.message}`, 'error');
                    }
                })
                .catch(error => {
                    showResult(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
                });
        }
        
        function downloadSQL() {
            window.open('converted_users.sql', '_blank');
        }
    </script>
</body>
</html>
