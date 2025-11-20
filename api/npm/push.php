<?php
require_once dirname(__DIR__) . "/config.php";

cors();

// If accessed via GET without action, render a simple HTML UI
$requestMethod = $_SERVER["REQUEST_METHOD"] ?? "";
if ($requestMethod === "GET" && !isset($_GET["action"])) {
  header("Content-Type: text/html; charset=utf-8");
  ?>
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Prisma DB Push</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          margin: 0;
          padding: 24px;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 8px;
          padding: 24px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
        }
        h1 {
          margin-top: 0;
          font-size: 20px;
        }
        button {
          padding: 10px 20px;
          border-radius: 4px;
          border: none;
          cursor: pointer;
          background-color: #2563eb;
          color: #ffffff;
          font-size: 14px;
        }
        button:disabled {
          background-color: #9ca3af;
          cursor: not-allowed;
        }
        .status {
          margin-top: 12px;
          font-size: 14px;
        }
        .status.success {
          color: #16a34a;
        }
        .status.error {
          color: #dc2626;
        }
        pre {
          margin-top: 16px;
          padding: 12px;
          background: #111827;
          color: #e5e7eb;
          border-radius: 4px;
          max-height: 400px;
          overflow: auto;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Prisma DB Push</h1>
        <p>กดปุ่มด้านล่างเพื่อเริ่มทำการ push โครงสร้างฐานข้อมูลด้วยสคริปต์เดิมที่มีอยู่แล้ว</p>
        <button id="pushButton">Run DB Push</button>
        <div id="status" class="status"></div>
        <pre id="output" hidden></pre>
      </div>
      <script>
        const button = document.getElementById("pushButton");
        const statusEl = document.getElementById("status");
        const outputEl = document.getElementById("output");

        async function runPush() {
          button.disabled = true;
          statusEl.textContent = "กำลังทำการ push โครงสร้างฐานข้อมูล...";
          statusEl.className = "status";
          outputEl.hidden = true;
          outputEl.textContent = "";

          try {
            const url = new URL(window.location.href);
            url.searchParams.set("action", "push");

            const res = await fetch(url.toString(), {
              method: "POST",
              headers: { "Accept": "application/json" }
            });

            const data = await res.json().catch(() => null);

            if (!res.ok || !data) {
              statusEl.textContent = "เกิดข้อผิดพลาดในการเรียก API";
              statusEl.className = "status error";
              return;
            }

            statusEl.textContent = data.message || (data.success ? "Push completed" : "Push failed");
            statusEl.className = "status " + (data.success ? "success" : "error");

            if (typeof data.output === "string" && data.output.trim() !== "") {
              outputEl.hidden = false;
              outputEl.textContent = data.output;
            }
          } catch (err) {
            statusEl.textContent = "เกิดข้อผิดพลาด: " + err;
            statusEl.className = "status error";
          } finally {
            button.disabled = false;
          }
        }

        button.addEventListener("click", runPush);
      </script>
    </body>
  </html>
  <?php
  exit;
}

// Set working directory to project root
$projectRoot = dirname(dirname(__DIR__));
chdir($projectRoot);

// Execute the db:push command
$output = [];
$returnCode = 0;

try {
  // Run the command and capture output
  exec("npx tsx scripts/prisma/db-push.ts 2>&1", $output, $returnCode);

  // Convert output array to string
  $outputString = implode("\n", $output);

  if ($returnCode === 0) {
    // Success
    json_response([
      "success" => true,
      "message" => "Database push completed successfully",
      "output" => $outputString,
    ]);
  } else {
    // Error
    json_response(
      [
        "success" => false,
        "message" => "Database push failed with exit code: $returnCode",
        "output" => $outputString,
      ],
      500,
    );
  }
} catch (Exception $e) {
  json_response(
    [
      "success" => false,
      "message" => "Error executing database push: " . $e->getMessage(),
      "output" => "",
    ],
    500,
  );
}
