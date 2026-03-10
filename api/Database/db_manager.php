<?php
/**
 * db_manager.php
 * Database Management API — Export schema/data (ZIP), import SQL, run SQL
 * Only accessible by Super Admin via Authorization header
 * 
 * Actions:
 *   GET  ?action=list_tables         — List all tables with row counts
 *   GET  ?action=table_info&table=X  — Show columns & indexes for table X
 *   GET  ?action=export_schema       — Export CREATE TABLE for all/selected tables
 *   POST ?action=export_data         — Export INSERT statements as ZIP
 *   POST ?action=import_sql          — Import SQL from ZIP/SQL file upload
 *   POST ?action=run_sql             — Execute SQL statements (text input)
 */

require_once __DIR__ . '/../config.php';
cors();
$pdo = db_connect();

header('Content-Type: application/json; charset=utf-8');

// ─── Auth: Require Super Admin ───
$user = get_authenticated_user($pdo);
if (!$user) {
    http_response_code(401);
    die(json_encode(['error' => 'Unauthorized']));
}
if ($user['role'] !== 'Super Admin') {
    http_response_code(403);
    die(json_encode(['error' => 'SuperAdmin access required']));
}

// ─── Handle Actions ───
$action = $_GET['action'] ?? $_POST['action'] ?? '';

// For file uploads (import_sql), input comes from $_POST, not JSON body
if ($action === 'import_sql') {
    $input = $_POST;
} else {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input))
        $input = [];
}

try {
    switch ($action) {

        // ─── List Tables ───
        case 'list_tables':
            $tables = [];
            $stmt = $pdo->query("SHOW TABLE STATUS");
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                // Skip views (Engine is NULL for views)
                if (empty($row['Engine']))
                    continue;
                $tables[] = [
                    'name' => $row['Name'],
                    'engine' => $row['Engine'],
                    'rows' => (int) $row['Rows'],
                    'data_size' => round(($row['Data_length'] + $row['Index_length']) / 1024, 1),
                    'auto_increment' => $row['Auto_increment'],
                    'collation' => $row['Collation'],
                    'created' => $row['Create_time'],
                    'updated' => $row['Update_time'],
                ];
            }
            echo json_encode(['success' => true, 'tables' => $tables, 'count' => count($tables)]);
            break;

        // ─── Table Info ───
        case 'table_info':
            $table = $_GET['table'] ?? '';
            if (!$table || !preg_match('/^[a-zA-Z0-9_]+$/', $table)) {
                throw new Exception('Invalid table name');
            }

            $columns = [];
            $stmt = $pdo->query("SHOW FULL COLUMNS FROM `$table`");
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $columns[] = [
                    'field' => $row['Field'],
                    'type' => $row['Type'],
                    'null' => $row['Null'],
                    'key' => $row['Key'],
                    'default' => $row['Default'],
                    'extra' => $row['Extra'],
                    'comment' => $row['Comment'],
                ];
            }

            $indexes = [];
            $stmt = $pdo->query("SHOW INDEX FROM `$table`");
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $indexes[] = [
                    'name' => $row['Key_name'],
                    'column' => $row['Column_name'],
                    'unique' => !$row['Non_unique'],
                    'seq' => $row['Seq_in_index'],
                ];
            }

            $stmt = $pdo->query("SHOW CREATE TABLE `$table`");
            $create = $stmt->fetch(PDO::FETCH_ASSOC);
            $createSql = $create['Create Table'] ?? '';

            echo json_encode([
                'success' => true,
                'table' => $table,
                'columns' => $columns,
                'indexes' => $indexes,
                'create_sql' => $createSql,
            ]);
            break;

        // ─── Export Schema ───
        case 'export_schema':
            $selectedTables = isset($_GET['tables']) ? explode(',', $_GET['tables']) : [];

            if (empty($selectedTables)) {
                $stmt = $pdo->query("SHOW TABLES");
                $selectedTables = $stmt->fetchAll(PDO::FETCH_COLUMN);
            }

            $sql = "-- Schema Export\n";
            $sql .= "-- Generated: " . date('Y-m-d H:i:s') . "\n";
            $sql .= "-- Database: " . $pdo->query("SELECT DATABASE()")->fetchColumn() . "\n\n";

            foreach ($selectedTables as $table) {
                $table = trim($table);
                if (!preg_match('/^[a-zA-Z0-9_]+$/', $table))
                    continue;

                $stmt = $pdo->query("SHOW CREATE TABLE `$table`");
                $create = $stmt->fetch(PDO::FETCH_ASSOC);
                $createSql = $create['Create Table'] ?? '';

                $sql .= "-- ─── Table: $table ───\n";
                $sql .= "DROP TABLE IF EXISTS `$table`;\n";
                $sql .= $createSql . ";\n\n";
            }

            echo json_encode([
                'success' => true,
                'sql' => $sql,
                'tables_count' => count($selectedTables),
            ]);
            break;

        // ─── Export Data → temp file → ZIP → stream download ───
        case 'export_data':
            // Large exports need more time — remove timeout
            set_time_limit(0);
            ini_set('memory_limit', '256M');

            $selectedTables = $input['tables'] ?? [];
            $limit = min((int) ($input['limit'] ?? 0), 100000);

            if (empty($selectedTables)) {
                throw new Exception('No tables specified');
            }

            $tmpDir = sys_get_temp_dir();
            $sqlFile = $tmpDir . '/db_export_' . uniqid() . '.sql';
            $zipFile = $tmpDir . '/db_export_' . uniqid() . '.zip';
            $fp = fopen($sqlFile, 'w');
            if (!$fp)
                throw new Exception('Cannot create temp file');

            fwrite($fp, "-- Data Export\n");
            fwrite($fp, "-- Generated: " . date('Y-m-d H:i:s') . "\n");
            fwrite($fp, "-- Tables: " . implode(', ', $selectedTables) . "\n\n");
            fwrite($fp, "SET FOREIGN_KEY_CHECKS = 0;\n\n");

            foreach ($selectedTables as $table) {
                $table = trim($table);
                if (!preg_match('/^[a-zA-Z0-9_]+$/', $table))
                    continue;

                fwrite($fp, "-- ─── Data: $table ───\n");

                $query = "SELECT * FROM `$table`";
                if ($limit > 0)
                    $query .= " LIMIT $limit";

                // Unbuffered query — never loads entire result set into PHP memory
                $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, false);
                $stmt = $pdo->query($query);

                $columns = null;
                $columnList = '';
                $batchValues = [];
                $batchCount = 0;
                $rowCount = 0;

                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    if ($columns === null) {
                        $columns = array_keys($row);
                        $columnList = '`' . implode('`, `', $columns) . '`';
                    }
                    $vals = [];
                    foreach ($row as $val) {
                        $vals[] = ($val === null) ? 'NULL' : $pdo->quote($val);
                    }
                    $batchValues[] = '(' . implode(', ', $vals) . ')';
                    $batchCount++;
                    $rowCount++;

                    if ($batchCount >= 500) {
                        fwrite($fp, "INSERT INTO `$table` ($columnList) VALUES\n");
                        fwrite($fp, implode(",\n", $batchValues) . ";\n\n");
                        $batchValues = [];
                        $batchCount = 0;
                    }
                }

                if ($batchCount > 0) {
                    fwrite($fp, "INSERT INTO `$table` ($columnList) VALUES\n");
                    fwrite($fp, implode(",\n", $batchValues) . ";\n\n");
                }
                if ($rowCount === 0) {
                    fwrite($fp, "-- (empty table)\n\n");
                }
                $stmt->closeCursor();
                $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
            }

            fwrite($fp, "SET FOREIGN_KEY_CHECKS = 1;\n");
            fclose($fp);

            // ZIP the SQL file
            $zip = new ZipArchive();
            if ($zip->open($zipFile, ZipArchive::CREATE) !== true) {
                unlink($sqlFile);
                throw new Exception('Failed to create ZIP');
            }
            $zip->addFile($sqlFile, 'data_export.sql');
            $zip->close();
            unlink($sqlFile); // Remove raw SQL, keep only ZIP

            // Stream ZIP to browser
            header('Content-Type: application/zip');
            header('Content-Disposition: attachment; filename="data_export_' . date('Y-m-d_His') . '.zip"');
            header('Content-Length: ' . filesize($zipFile));
            header('Cache-Control: no-cache');
            readfile($zipFile);
            unlink($zipFile);
            exit;

        // ─── Import SQL from ZIP or SQL file upload ───
        case 'import_sql':
            if (empty($_FILES['file'])) {
                throw new Exception('No file uploaded. Use multipart form with field "file"');
            }

            $file = $_FILES['file'];
            if ($file['error'] !== UPLOAD_ERR_OK) {
                $uploadErrors = [
                    1 => 'File exceeds upload_max_filesize',
                    2 => 'File exceeds MAX_FILE_SIZE',
                    3 => 'File was only partially uploaded',
                    4 => 'No file was uploaded',
                    6 => 'Missing temp folder',
                    7 => 'Failed to write to disk',
                    8 => 'A PHP extension stopped the upload',
                ];
                throw new Exception($uploadErrors[$file['error']] ?? 'Upload error: ' . $file['error']);
            }

            $uploadedPath = $file['tmp_name'];
            $originalName = $file['name'];
            $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
            $sqlFilePath = null;
            $needCleanup = false;

            // If ZIP → extract .sql
            if ($ext === 'zip') {
                $zip = new ZipArchive();
                if ($zip->open($uploadedPath) !== true) {
                    throw new Exception('Cannot open ZIP file');
                }
                for ($i = 0; $i < $zip->numFiles; $i++) {
                    $name = $zip->getNameIndex($i);
                    if (strtolower(pathinfo($name, PATHINFO_EXTENSION)) === 'sql') {
                        $sqlFilePath = sys_get_temp_dir() . '/import_' . uniqid() . '.sql';
                        // Extract to temp to avoid loading into memory
                        $srcStream = $zip->getStream($name);
                        $destFp = fopen($sqlFilePath, 'w');
                        if ($srcStream && $destFp) {
                            while (!feof($srcStream)) {
                                fwrite($destFp, fread($srcStream, 8192));
                            }
                            fclose($srcStream);
                            fclose($destFp);
                        }
                        $needCleanup = true;
                        break;
                    }
                }
                $zip->close();
                if (!$sqlFilePath) {
                    throw new Exception('No .sql file found inside ZIP');
                }
            } elseif ($ext === 'sql') {
                $sqlFilePath = $uploadedPath;
            } else {
                throw new Exception('Unsupported file type. Use .sql or .zip');
            }

            // Execute SQL line-by-line (build statements on semicolons)
            $handle = fopen($sqlFilePath, 'r');
            if (!$handle)
                throw new Exception('Cannot read SQL file');

            $successCount = 0;
            $errorCount = 0;
            $errors = [];
            $currentStmt = '';
            $lineNum = 0;

            $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");

            while (($line = fgets($handle)) !== false) {
                $lineNum++;
                $trimmed = trim($line);

                // Skip empty lines and comments
                if ($trimmed === '' || strpos($trimmed, '--') === 0 || strpos($trimmed, '#') === 0) {
                    continue;
                }

                $currentStmt .= $line;

                // Statement complete when line ends with ;
                if (preg_match('/;\s*$/', $trimmed)) {
                    $stmtToExec = trim($currentStmt);
                    $currentStmt = '';

                    if ($stmtToExec === '')
                        continue;

                    try {
                        $pdo->exec($stmtToExec);
                        $successCount++;
                    } catch (PDOException $e) {
                        $errorCount++;
                        if (count($errors) < 20) {
                            $errors[] = [
                                'line' => $lineNum,
                                'sql' => mb_substr($stmtToExec, 0, 150),
                                'error' => $e->getMessage(),
                            ];
                        }
                    }
                }
            }

            fclose($handle);
            $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");

            if ($needCleanup && $sqlFilePath && file_exists($sqlFilePath)) {
                unlink($sqlFilePath);
            }

            echo json_encode([
                'success' => $errorCount === 0,
                'message' => "Executed $successCount statements" . ($errorCount > 0 ? ", $errorCount errors" : " successfully"),
                'success_count' => $successCount,
                'error_count' => $errorCount,
                'errors' => $errors,
            ]);
            break;

        // ─── Run SQL (text input, with transaction) ───
        case 'run_sql':
            $sqlInput = $input['sql'] ?? '';

            if (!$sqlInput) {
                throw new Exception('No SQL provided');
            }

            $statements = array_filter(
                array_map('trim', preg_split('/;\s*(?=(?:[^\'"]|\'[^\']*\'|"[^"]*")*$)/m', $sqlInput)),
                function ($s) {
                    return $s !== '' && !preg_match('/^--/', $s);
                }
            );

            $results = [];
            $successCount = 0;
            $errorCount = 0;

            $pdo->beginTransaction();

            try {
                foreach ($statements as $stmt) {
                    if (preg_match('/^(--|#|\/\*)/', trim($stmt)))
                        continue;

                    try {
                        $affected = $pdo->exec($stmt);
                        $results[] = [
                            'sql' => mb_substr($stmt, 0, 200),
                            'success' => true,
                            'affected_rows' => $affected,
                        ];
                        $successCount++;
                    } catch (PDOException $e) {
                        $results[] = [
                            'sql' => mb_substr($stmt, 0, 200),
                            'success' => false,
                            'error' => $e->getMessage(),
                        ];
                        $errorCount++;
                        throw $e;
                    }
                }
                $pdo->commit();
            } catch (Exception $e) {
                if ($pdo->inTransaction())
                    $pdo->rollBack();
                echo json_encode([
                    'success' => false,
                    'message' => "Rolled back: " . $e->getMessage(),
                    'results' => $results,
                    'success_count' => $successCount,
                    'error_count' => $errorCount,
                ]);
                exit;
            }

            echo json_encode([
                'success' => true,
                'message' => "Executed $successCount statements successfully",
                'results' => $results,
                'success_count' => $successCount,
                'error_count' => $errorCount,
            ]);
            break;

        default:
            throw new Exception("Unknown action: '$action'");
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
    ]);
}
