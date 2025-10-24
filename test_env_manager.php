<?php
// Simple test file to verify env_manager.php API
?>
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Onecall DB Manager</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .test-section { margin: 20px 0; padding: 15px; border: 1px solid #ccc; }
        .result { margin-top: 10px; padding: 10px; background: #f5f5f5; }
        .success { background: #d4edda; border: 1px solid #c3e6cb; }
        .error { background: #f8d7da; border: 1px solid #f5c6cb; }
        button { padding: 10px 20px; margin: 5px; cursor: pointer; }
        pre { background: #f8f9fa; padding: 10px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>Test Onecall DB Manager API</h1>

    <div class="test-section">
        <h2>1. Test Status Check (POST)</h2>
        <button onclick="testStatusCheck()">Check Status</button>
        <div id="statusResult" class="result"></div>
    </div>

    <div class="test-section">
        <h2>2. Test Insert/Update</h2>
        <input type="text" id="testKey" placeholder="Key (e.g., ONECALL_USERNAME_1)" value="ONECALL_USERNAME_1" style="width: 300px; margin-right: 10px;">
        <input type="text" id="testValue" placeholder="Value" value="+66944845322" style="width: 200px; margin-right: 10px;">
        <button onclick="testInsert()">Insert/Update</button>
        <div id="insertResult" class="result"></div>
    </div>

    <div class="test-section">
        <h2>3. Test Status Check (GET)</h2>
        <button onclick="testStatusCheckGet()">Check Status via GET</button>
        <div id="statusGetResult" class="result"></div>
    </div>

    <div class="test-section">
        <h2>4. Test Real User Data</h2>
        <button onclick="testRealUserData()">Test with Real User Data</button>
        <div id="realUserResult" class="result"></div>
    </div>

    <script>
        const testUser = {
            id: 6,
            company_id: 1,
            role: 'Super Admin'
        };

        async function testStatusCheck() {
            const resultDiv = document.getElementById('statusResult');
            resultDiv.innerHTML = 'Testing...';

            try {
                const response = await fetch('/api/Onecall_DB/env_manager.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'check_status',
                        user: testUser,
                        company_id: 1
                    })
                });

                const result = await response.json();
                resultDiv.className = 'result success';
                resultDiv.innerHTML = `
                    <h4>✅ Status Check Successful</h4>
                    <pre>${JSON.stringify(result, null, 2)}</pre>
                `;
            } catch (error) {
                resultDiv.className = 'result error';
                resultDiv.innerHTML = `<h4>❌ Error</h4><pre>${error.message}</pre>`;
            }
        }

        async function testInsert() {
            const resultDiv = document.getElementById('insertResult');
            const key = document.getElementById('testKey').value;
            const value = document.getElementById('testValue').value;

            if (!key || !value) {
                resultDiv.className = 'result error';
                resultDiv.innerHTML = '<h4>❌ Please enter both key and value</h4>';
                return;
            }

            resultDiv.innerHTML = 'Testing...';

            try {
                const response = await fetch('/api/Onecall_DB/env_manager.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        key: key,
                        value: value,
                        user: testUser
                    })
                });

                const result = await response.json();
                resultDiv.className = result.success ? 'result success' : 'result error';
                resultDiv.innerHTML = `
                    <h4>${result.success ? '✅' : '❌'} Insert/Update ${result.success ? 'Successful' : 'Failed'}</h4>
                    <pre>${JSON.stringify(result, null, 2)}</pre>
                `;
            } catch (error) {
                resultDiv.className = 'result error';
                resultDiv.innerHTML = `<h4>❌ Error</h4><pre>${error.message}</pre>`;
            }
        }

        async function testStatusCheckGet() {
            const resultDiv = document.getElementById('statusGetResult');
            resultDiv.innerHTML = 'Testing...';

            try {
                const response = await fetch(`/api/Onecall_DB/env_manager.php?user_id=${testUser.id}&company_id=${testUser.company_id}&role=${encodeURIComponent(testUser.role)}`, {
                    method: 'GET'
                });

                const result = await response.json();
                resultDiv.className = 'result success';
                resultDiv.innerHTML = `
                    <h4>✅ GET Status Check Successful</h4>
                    <pre>${JSON.stringify(result, null, 2)}</pre>
                `;
            } catch (error) {
                resultDiv.className = 'result error';
                resultDiv.innerHTML = `<h4>❌ Error</h4><pre>${error.message}</pre>`;
            }
        }

        async function testRealUserData() {
            const resultDiv = document.getElementById('realUserResult');
            resultDiv.innerHTML = 'Testing...';

            // Try to get real user data from localStorage
            let realUser = testUser;
            try {
                const sessionUser = localStorage.getItem('sessionUser');
                if (sessionUser) {
                    const user = JSON.parse(sessionUser);
                    realUser = {
                        id: user.id,
                        company_id: user.company_id,
                        role: user.role
                    };
                    console.log('Using real user data:', realUser);
                }
            } catch (e) {
                console.log('Using test user data');
            }

            try {
                const response = await fetch('/api/Onecall_DB/env_manager.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'check_status',
                        user: realUser,
                        company_id: realUser.company_id
                    })
                });

                const result = await response.json();
                resultDiv.className = 'result success';
                resultDiv.innerHTML = `
                    <h4>✅ Real User Test Successful</h4>
                    <p><strong>User:</strong> ${JSON.stringify(realUser)}</p>
                    <pre>${JSON.stringify(result, null, 2)}</pre>
                `;
            } catch (error) {
                resultDiv.className = 'result error';
                resultDiv.innerHTML = `<h4>❌ Error</h4><pre>${error.message}</pre>`;
            }
        }

        // Test on page load
        window.onload = function() {
            console.log('Test page loaded. Ready to test Onecall DB Manager API.');
        };
    </script>
</body>
</html>
