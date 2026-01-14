<?php
/**
 * debug_talktime.php - Debug script to check Talk Time data
 */
error_reporting(E_ALL);
ini_set("display_errors", 1);

require_once __DIR__ . "/../config.php";
require_once __DIR__ . "/../phone_utils.php";

cors();

try {
  $pdo = db_connect();
  
  $date = isset($_GET["date"]) ? $_GET["date"] : date("Y-m-d");
  $companyId = isset($_GET["company_id"]) ? intval($_GET["company_id"]) : 1;
  
  $debug = [];
  
  // 1. Check total logs for date (no filter)
  $stmt = $pdo->prepare("SELECT COUNT(*) as total FROM onecall_log WHERE DATE(`timestamp`) = :date");
  $stmt->execute([":date" => $date]);
  $result = $stmt->fetch(PDO::FETCH_ASSOC);
  $debug["total_logs_for_date"] = $result["total"];
  
  // 2. Check if onecall_batch has company_id column
  $stmt = $pdo->query("SHOW COLUMNS FROM onecall_batch LIKE 'company_id'");
  $debug["batch_has_company_id"] = $stmt->rowCount() > 0;
  
  // 3. Check batch data
  $stmt = $pdo->query("SELECT id, company_id FROM onecall_batch LIMIT 5");
  $debug["sample_batches"] = $stmt->fetchAll(PDO::FETCH_ASSOC);
  
  // 4. Check logs with batch info
  $stmt = $pdo->prepare("
    SELECT 
      ol.id, 
      ol.batch_id, 
      ob.company_id,
      ol.phone_telesale,
      ol.duration
    FROM onecall_log ol
    LEFT JOIN onecall_batch ob ON ol.batch_id = ob.id
    WHERE DATE(ol.`timestamp`) = :date
    LIMIT 5
  ");
  $stmt->execute([":date" => $date]);
  $debug["sample_logs_with_batch"] = $stmt->fetchAll(PDO::FETCH_ASSOC);
  
  // 5. Check logs for specific company
  $stmt = $pdo->prepare("
    SELECT COUNT(*) as total
    FROM onecall_log ol
    LEFT JOIN onecall_batch ob ON ol.batch_id = ob.id
    WHERE DATE(ol.`timestamp`) = :date
      AND ob.company_id = :company_id
  ");
  $stmt->execute([":date" => $date, ":company_id" => $companyId]);
  $result = $stmt->fetch(PDO::FETCH_ASSOC);
  $debug["logs_for_company"] = $result["total"];
  
  // 6. Check distinct companies in logs
  $stmt = $pdo->prepare("
    SELECT ob.company_id, COUNT(*) as count
    FROM onecall_log ol
    LEFT JOIN onecall_batch ob ON ol.batch_id = ob.id
    WHERE DATE(ol.`timestamp`) = :date
    GROUP BY ob.company_id
  ");
  $stmt->execute([":date" => $date]);
  $debug["logs_by_company"] = $stmt->fetchAll(PDO::FETCH_ASSOC);
  
  json_response([
    "success" => true,
    "date" => $date,
    "company_id" => $companyId,
    "debug" => $debug
  ]);
  
} catch (Exception $e) {
  json_response([
    "success" => false,
    "error" => $e->getMessage()
  ], 500);
}
?>
