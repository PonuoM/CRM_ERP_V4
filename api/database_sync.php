<?php
// Simple web frontend to run database sync npm scripts.

// Change working directory to project root so npm scripts run correctly.
$projectRoot = realpath(__DIR__ . '/..');
if ($projectRoot === false) {
  http_response_code(500);
  echo 'ไม่สามารถหาโฟลเดอร์โปรเจกต์ได้';
  exit;
}

chdir($projectRoot);

// Map allowed commands to actual shell commands.
$allowedCommands = [
  'db-pull' => 'npm run db:pull',
  'db-push' => 'npm run db:push',
  'db-seed' => 'npm run db:seed',
];

$selectedKey = null;
$command = null;
$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['command'])) {
  $selectedKey = $_POST['command'];

  if (!array_key_exists($selectedKey, $allowedCommands)) {
    $error = 'คำสั่งไม่ถูกต้อง';
  } else {
    $command = $allowedCommands[$selectedKey] . ' 2>&1';
  }
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
    </style>
  </head>
  <body>
    <h1>Database Sync</h1>
    <p class="note">
      หน้านี้ใช้รันคำสั่ง npm สำหรับซิงค์ฐานข้อมูล:
      <code>db:pull</code>, <code>db:push</code>, <code>db:seed</code>
    </p>

    <form method="post">
      <div class="buttons">
        <button type="submit" name="command" value="db-pull">
          npm run db:pull
        </button>
        <button type="submit" name="command" value="db-push">
          npm run db:push
        </button>
        <button type="submit" name="command" value="db-seed">
          npm run db:seed
        </button>
      </div>
    </form>

    <?php if ($selectedKey !== null): ?>
      <h2>
        ผลลัพธ์คำสั่ง:
        <?php echo htmlspecialchars($allowedCommands[$selectedKey] ?? '', ENT_QUOTES, 'UTF-8'); ?>
      </h2>

      <?php if ($error !== null): ?>
        <p style="color: red;">
          <?php echo htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?>
        </p>
      <?php elseif ($command !== null): ?>
        <pre>
<?php
          // Ensure output is not buffered so the browser sees updates as they happen.
          @ini_set('output_buffering', 'off');
          @ini_set('zlib.output_compression', false);
          while (ob_get_level() > 0) {
            ob_end_flush();
          }
          ob_implicit_flush(true);

          // Some servers (e.g. Nginx) buffer until a certain size, so send a padding chunk first.
          echo str_repeat(' ', 1024) . "\n";
          flush();

          $descriptorspec = [
            1 => ['pipe', 'w'], // stdout
            2 => ['pipe', 'w'], // stderr
          ];

          $process = proc_open($command, $descriptorspec, $pipes, $projectRoot);

          if (!is_resource($process)) {
            echo htmlspecialchars('ไม่สามารถรันคำสั่งได้', ENT_QUOTES, 'UTF-8');
            flush();
          } else {
            stream_set_blocking($pipes[1], false);
            stream_set_blocking($pipes[2], false);

            // Read output while the process is running, similar to terminal.
            while (true) {
              $status = proc_get_status($process);

              $stdout = stream_get_contents($pipes[1]);
              $stderr = stream_get_contents($pipes[2]);

              if ($stdout !== false && $stdout !== '') {
                echo htmlspecialchars($stdout, ENT_QUOTES, 'UTF-8');
                flush();
              }
              if ($stderr !== false && $stderr !== '') {
                echo htmlspecialchars($stderr, ENT_QUOTES, 'UTF-8');
                flush();
              }

              if (!$status['running']) {
                break;
              }

              usleep(100000); // 0.1 วินาที
            }

            fclose($pipes[1]);
            fclose($pipes[2]);
            proc_close($process);
          }
?>
        </pre>
      <?php endif; ?>
    <?php endif; ?>
  </body>
  </html>

