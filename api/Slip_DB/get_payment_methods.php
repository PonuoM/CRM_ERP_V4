<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

mb_internal_encoding("UTF-8");
mb_http_output("UTF-8");

// No need to connect to DB for hardcoded values
// require_once __DIR__ . "/../config.php";

$paymentMethods = ["Transfer", "COD", "PayAfter"];

echo json_encode([
  "success" => true,
  "data" => $paymentMethods,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
