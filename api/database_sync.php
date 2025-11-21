<?php
// Simple web frontend to run database sync npm scripts
// and show "live" output in the browser.

// Project root so npm scripts run correctly.
$projectRoot = realpath(__DIR__ . '/..');
if ($projectRoot === false) {
  http_response_code(500);
  echo 'ไม่สามารถหาโฟลเดอร์โปรเจกต์ได้';
  exit;
}

chdir($projectRoot);

// Map allowed commands to actual npm scripts.
$allowedCommands = [
  'db-pull' => 'npm run db:pull',
  'db-push' => 'npm run db:push',
  'db-seed' => 'npm run db:seed',
  'db-format' => 'npm run db:format',
  'db-export' => 'npm run db:export',
];

// Directory for log files.
$logDir = __DIR__ . '/logs';
if (!is_dir($logDir)) {
  @mkdir($logDir, 0777, true);
}

// Small helper to send JSON.
function send_json($data, int $status = 200): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

// API mode: start command or read log.
if (isset($_GET['action'])) {
  $action = $_GET['action'];

  if ($action === 'start') {
    $key = $_POST['command'] ?? $_GET['command'] ?? null;

    if (!$key || !isset($allowedCommands[$key])) {
      send_json(['ok' => false, 'error' => 'คำสั่งไม่ถูกต้อง'], 400);
      exit;
    }

    $logId = date('Ymd_His') . '_' . $key . '_' . bin2hex(random_bytes(4));
    $logFile = $logDir . DIRECTORY_SEPARATOR . $logId . '.log';

    $npmCmd = $allowedCommands[$key];

    // Windows background execution: use start /B with cmd.
    if (stripos(PHP_OS, 'WIN') === 0) {
      $cmd = 'start "" /B cmd /C "cd /D ' .
        escapeshellarg($projectRoot) .
        ' && ' . $npmCmd .
        ' >> ' . escapeshellarg($logFile) .
        ' 2>&1 && echo __COMMAND_DONE__ >> ' . escapeshellarg($logFile) . '"';
      @pclose(@popen($cmd, 'r'));
    } else {
      // Unix-like (fallback if ever used): background with &.
      $cmd = 'cd ' . escapeshellarg($projectRoot) .
        ' && ' . $npmCmd .
        ' >> ' . escapeshellarg($logFile) .
        ' 2>&1 && echo __COMMAND_DONE__ >> ' . escapeshellarg($logFile) . ' &';
      @pclose(@popen($cmd, 'r'));
    }

    send_json(['ok' => true, 'logId' => $logId]);
    exit;
  }

  if ($action === 'read') {
    $logId = $_GET['log'] ?? '';

    if (!preg_match('/^[A-Za-z0-9_\-]+$/', $logId)) {
      send_json(['ok' => false, 'error' => 'log id ไม่ถูกต้อง'], 400);
      exit;
    }

    $logFile = $logDir . DIRECTORY_SEPARATOR . $logId . '.log';
    if (!is_file($logFile)) {
      send_json(['ok' => false, 'error' => 'ไม่พบไฟล์ log'], 404);
      exit;
    }

    $content = @file_get_contents($logFile);
    if ($content === false) {
      $content = '';
    }

    $finished = false;
    if (strpos($content, '__COMMAND_DONE__') !== false) {
      $finished = true;
      $content = str_replace('__COMMAND_DONE__', '', $content);
    }

    send_json(['ok' => true, 'log' => $content, 'finished' => $finished]);
    exit;
  }

  // Unknown action.
  send_json(['ok' => false, 'error' => 'action ไม่ถูกต้อง'], 400);
  exit;
}

?>
<!DOCTYPE html>
<html lang="th">
  <head>
    <meta charset="UTF-8" />
    <title>Database Sync</title>
    <style>
      body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
          sans-serif;
        margin: 20px;
        background: #f5f5f5;
      }
      h1 {
        margin-bottom: 0.5rem;
      }
      .buttons {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1rem;
      }
      button {
        padding: 0.5rem 1rem;
        border-radius: 4px;
        border: 1px solid #ccc;
        cursor: pointer;
        background: white;
      }
      button:hover {
        background: #eef;
      }
      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      pre {
        background: #111;
        color: #0f0;
        padding: 1rem;
        border-radius: 4px;
        max-height: 70vh;
        overflow: auto;
        font-size: 13px;
        white-space: pre-wrap;
      }
      .note {
        font-size: 13px;
        color: #555;
        margin-bottom: 0.5rem;
      }
      #status {
        font-size: 13px;
        margin-bottom: 0.5rem;
      }
    </style>
  </head>
  <body>
    <h1>Database Sync</h1>
    <p class="note">
      คำสั่ง npm ที่สามารถรันจากหน้านี้ได้:
      <code>db:pull</code>,
      <code>db:push</code>,
      <code>db:seed</code>,
      <code>db:format</code>,
      <code>db:export</code>
    </p>

    <div id="status"></div>

    <div class="buttons">
      <button type="button" data-command="db-pull">
        npm run db:pull
      </button>
      <button type="button" data-command="db-push">
        npm run db:push
      </button>
      <button type="button" data-command="db-seed">
        npm run db:seed
      </button>
      <button type="button" data-command="db-format">
        npm run db:format
      </button>
      <button type="button" data-command="db-export">
        npm run db:export
      </button>
    </div>

    <pre id="output"></pre>

    <script>
      const buttons = document.querySelectorAll('button[data-command]');
      const outputEl = document.getElementById('output');
      const statusEl = document.getElementById('status');

      let currentLogId = null;
      let polling = false;

      function setButtonsDisabled(disabled) {
        buttons.forEach((btn) => {
          btn.disabled = disabled;
        });
      }

      async function startCommand(key, label) {
        setButtonsDisabled(true);
        outputEl.textContent = '';
        statusEl.textContent = 'กำลังรันคำสั่ง: ' + label;

        try {
          const res = await fetch(
            'database_sync.php?action=start&command=' + encodeURIComponent(key),
            {
              method: 'POST',
              headers: { 'X-Requested-With': 'XMLHttpRequest' },
            },
          );

          const data = await res.json();
          if (!data.ok) {
            statusEl.textContent =
              'เริ่มคำสั่งไม่สำเร็จ: ' + (data.error || '');
            setButtonsDisabled(false);
            return;
          }

          currentLogId = data.logId;
          polling = true;
          pollLog();
        } catch (e) {
          console.error(e);
          statusEl.textContent =
            'เกิดข้อผิดพลาดระหว่างเริ่มคำสั่ง กรุณาลองใหม่อีกครั้ง';
          setButtonsDisabled(false);
        }
      }

      async function pollLog() {
        if (!polling || !currentLogId) {
          return;
        }

        try {
          const res = await fetch(
            'database_sync.php?action=read&log=' +
              encodeURIComponent(currentLogId) +
              '&_t=' +
              Date.now(),
            {
              method: 'GET',
              headers: { 'X-Requested-With': 'XMLHttpRequest' },
              cache: 'no-store',
            },
          );

          if (!res.ok) {
            setTimeout(pollLog, 1000);
            return;
          }

          const data = await res.json();
          if (!data.ok) {
            setTimeout(pollLog, 1000);
            return;
          }

          outputEl.textContent = data.log || '';
          outputEl.scrollTop = outputEl.scrollHeight;

          if (data.finished) {
            polling = false;
            setButtonsDisabled(false);
            statusEl.textContent = 'คำสั่งเสร็จสมบูรณ์';
          } else {
            setTimeout(pollLog, 1000);
          }
        } catch (e) {
          console.error(e);
          statusEl.textContent =
            'เกิดข้อผิดพลาดระหว่างอ่าน log กรุณาลองใหม่อีกครั้ง';
          polling = false;
          setButtonsDisabled(false);
        }
      }

      buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const key = btn.getAttribute('data-command');
          const label = btn.textContent.trim();
          startCommand(key, label);
        });
      });
    </script>
  </body>
  </html>

