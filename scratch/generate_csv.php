<?php
require_once __DIR__ . '/../api/config.php';

try {
    $pdo = db_connect();

    // 1. Fetch latest 15000 records (instant primary key scan with join)
    $stmt = $pdo->query("
        SELECT ch.id, ch.date, ch.caller, ch.result, ch.crop_type, ch.notes,
               c.first_name, c.last_name, c.phone
        FROM call_history ch
        JOIN customers c ON ch.customer_id = c.customer_id
        ORDER BY ch.id DESC
        LIMIT 15000
    ");
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 2. Group by caller in PHP
    $grouped = [];
    foreach ($records as $rec) {
        $caller = trim($rec['caller']);
        $note = trim($rec['notes'] ?? '');
        
        if (empty($caller) || empty($note)) {
            continue;
        }

        if (!isset($grouped[$caller])) {
            $grouped[$caller] = [];
        }

        $grouped[$caller][] = $rec;
    }

    // 3. For each caller, shuffle their list of notes and take 5 random ones
    $results = [];
    $selectedCallers = [];
    
    // Select callers with at least 5 notes first
    foreach ($grouped as $callerName => $notesList) {
        if (count($notesList) >= 5) {
            $selectedCallers[] = $callerName;
        }
        if (count($selectedCallers) >= 5) {
            break;
        }
    }

    // Fallback if less than 5
    if (count($selectedCallers) < 5) {
        foreach ($grouped as $callerName => $notesList) {
            if (!in_array($callerName, $selectedCallers)) {
                $selectedCallers[] = $callerName;
            }
            if (count($selectedCallers) >= 5) {
                break;
            }
        }
    }

    foreach ($selectedCallers as $callerName) {
        $notesList = $grouped[$callerName] ?? [];
        
        // Randomize the notes in PHP
        shuffle($notesList);
        $randomNotes = array_slice($notesList, 0, 5);

        $results[] = [
            'employee_name' => $callerName,
            'notes' => $randomNotes
        ];
    }

    // 4. Write to CSV
    $csvFile = __DIR__ . '/../employee_notes_export.csv';
    $fp = fopen($csvFile, 'w');
    
    // Write UTF-8 BOM so Excel opens it with correct Thai characters
    fwrite($fp, "\xEF\xBB\xBF");
    
    // Headers
    fputcsv($fp, [
        'ลำดับ',
        'ชื่อพนักงาน',
        'วันที่บันทึก',
        'ชื่อลูกค้า',
        'เบอร์โทรลูกค้า',
        'ผลการโทร',
        'พืชที่ปลูก',
        'รายละเอียดบันทึก'
    ]);

    $rowNo = 1;
    foreach ($results as $emp) {
        foreach ($emp['notes'] as $noteData) {
            fputcsv($fp, [
                $rowNo++,
                $emp['employee_name'],
                $noteData['date'],
                trim($noteData['first_name'] . ' ' . $noteData['last_name']),
                $noteData['phone'],
                $noteData['result'] ?? '-',
                $noteData['crop_type'] ?? '-',
                $noteData['notes']
            ]);
        }
    }

    fclose($fp);

    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'ok' => true,
        'message' => 'Randomized CSV generated successfully in PHP',
        'path' => $csvFile,
        'data' => $results
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage()
    ]);
}
