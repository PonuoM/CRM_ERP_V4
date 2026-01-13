<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Set UTF-8 encoding
mb_internal_encoding("UTF-8");
mb_http_output("UTF-8");

require_once "../config.php";

// Get JSON input
$json_input = file_get_contents("php://input");
$data = json_decode($json_input, true);

if (!$data) {
  echo json_encode([
    "success" => false,
    "message" => "Invalid JSON data",
  ]);
  exit();
}

// Validate required fields
$required_fields = ["order_id", "amount", "bank_account_id", "transfer_date"];
foreach ($required_fields as $field) {
  // Allow 0 as a valid value for amount
  if (empty($data[$field]) && $data[$field] !== 0 && $data[$field] !== '0') {
    echo json_encode([
      "success" => false,
      "message" => "Field '$field' is required",
    ]);
    exit();
  }
}

try {
  // Database connection using PDO with UTF-8
  $conn = db_connect();
  $conn->exec("SET NAMES utf8mb4");
  $conn->exec("SET CHARACTER SET utf8mb4");
  
  // Ensure bank_account table exists (create without foreign key first, then add FK if needed)
  $table_exists = $conn->query("SELECT COUNT(*) FROM information_schema.tables 
    WHERE table_schema = DATABASE() AND table_name = 'bank_account'")->fetchColumn();
  
  if ($table_exists == 0) {
    // Create table without foreign key first
    $conn->exec("CREATE TABLE `bank_account` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `company_id` INT NOT NULL,
      `bank` VARCHAR(100) NOT NULL,
      `bank_number` VARCHAR(50) NOT NULL,
      `is_active` BOOLEAN DEFAULT 1,
      `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      `deleted_at` DATETIME NULL,
      INDEX `idx_company_id` (`company_id`),
      INDEX `idx_is_active` (`is_active`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    
    // Try to add foreign key constraint (may fail if companies table doesn't exist, but that's ok)
    try {
      $conn->exec("ALTER TABLE `bank_account` 
        ADD CONSTRAINT `fk_bank_account_company` 
        FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE");
    } catch (Exception $e) {
      // Foreign key constraint failed, but table is created - that's acceptable
    }
  }
  
  // Ensure order_slips table exists
  $order_slips_exists = $conn->query("SELECT COUNT(*) FROM information_schema.tables 
    WHERE table_schema = DATABASE() AND table_name = 'order_slips'")->fetchColumn();
  
  if ($order_slips_exists == 0) {
    $conn->exec("CREATE TABLE `order_slips` (
      `id` INT AUTO_INCREMENT PRIMARY KEY,
      `order_id` VARCHAR(32) NOT NULL,
      `url` VARCHAR(1024) NOT NULL,
      `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX `idx_order_slips_order` (`order_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    
    // Try to add foreign key constraint
    try {
      $conn->exec("ALTER TABLE `order_slips` 
        ADD CONSTRAINT `fk_order_slips_order` 
        FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE");
    } catch (Exception $e) {
      // Foreign key constraint failed, but table is created - that's acceptable
    }
  }
  
  // Add columns to order_slips if they don't exist
  $columns_to_add = [
    'amount' => 'INT NULL AFTER `id`',
    'bank_account_id' => 'INT NULL AFTER `amount`',
    'transfer_date' => 'DATETIME NULL AFTER `bank_account_id`',
    'upload_by' => 'INT NULL AFTER `url`',
    'upload_by_name' => 'VARCHAR(255) NULL AFTER `upload_by`',
  ];
  
  foreach ($columns_to_add as $column => $definition) {
    $check_col = $conn->query("SELECT COUNT(*) FROM information_schema.columns 
      WHERE table_schema = DATABASE() 
      AND table_name = 'order_slips' 
      AND column_name = '$column'")->fetchColumn();
    
    if ($check_col == 0) {
      try {
        $conn->exec("ALTER TABLE `order_slips` ADD COLUMN `$column` $definition");
      } catch (Exception $e) {
        // Column add failed, but continue
      }
    }
  }
  
  // Add index for bank_account_id if it doesn't exist
  $check_idx = $conn->query("SELECT COUNT(*) FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
    AND table_name = 'order_slips' 
    AND index_name = 'idx_order_slips_bank_account_id'")->fetchColumn();
  
  if ($check_idx == 0) {
    try {
      $conn->exec("ALTER TABLE `order_slips` ADD INDEX `idx_order_slips_bank_account_id` (`bank_account_id`)");
    } catch (Exception $e) {
      // Index add failed, but continue
    }
  }
  
  // Try to add foreign key for bank_account_id if it doesn't exist
  $check_fk = $conn->query("SELECT COUNT(*) FROM information_schema.table_constraints 
    WHERE table_schema = DATABASE() 
    AND table_name = 'order_slips' 
    AND constraint_name = 'fk_order_slips_bank_account_id'")->fetchColumn();
  
  if ($check_fk == 0) {
    try {
      $conn->exec("ALTER TABLE `order_slips` 
        ADD CONSTRAINT `fk_order_slips_bank_account_id` 
        FOREIGN KEY (`bank_account_id`) REFERENCES `bank_account` (`id`) ON DELETE SET NULL");
    } catch (Exception $e) {
      // Foreign key constraint failed, but continue
    }
  }

  // Validate if order exists and belongs to company
  $order_id = $data["order_id"];
  $company_id = $data["company_id"] ?? 0;

  $order_check_sql = "SELECT id, company_id FROM orders WHERE id = ?";
  $order_stmt = $conn->prepare($order_check_sql);
  $order_stmt->execute([$order_id]);
  $order = $order_stmt->fetch();

  if (!$order) {
    echo json_encode([
      "success" => false,
      "message" => "Order not found",
    ]);
    exit();
  }

  // Verify company_id matches
  if ($order["company_id"] != $company_id) {
    echo json_encode([
      "success" => false,
      "message" => "Company ID mismatch",
    ]);
    exit();
  }

  // Validate bank account exists and belongs to company
  $bank_account_id = $data["bank_account_id"];
  $bank_check_sql =
    "SELECT id FROM bank_account WHERE id = ? AND company_id = ? AND is_active = 1 AND deleted_at IS NULL";
  $bank_stmt = $conn->prepare($bank_check_sql);
  $bank_stmt->execute([$bank_account_id, $company_id]);
  $bank_account = $bank_stmt->fetch();

  if (!$bank_account) {
    echo json_encode([
      "success" => false,
      "message" => "Bank account not found or inactive",
    ]);
    exit();
  }

  // Check if slip already exists for this order - REMOVED to allow multiple slips
  /*
  $existing_slip_sql = "SELECT id FROM order_slips WHERE order_id = ?";
  $existing_stmt = $conn->prepare($existing_slip_sql);
  $existing_stmt->execute([$order_id]);
  $existing_slip = $existing_stmt->fetch();

  if ($existing_slip) {
    echo json_encode([
      "success" => false,
      "message" => "Slip already exists for this order",
    ]);
    exit();
  }
  */


  // Check COD status and update if first slip
  try {
      $checkOrdStmt = $conn->prepare("SELECT payment_method FROM orders WHERE id = ?");
      $checkOrdStmt->execute([$order_id]);
      $pm = $checkOrdStmt->fetchColumn();

      if ($pm === 'COD') {
          $countSlipStmt = $conn->prepare("SELECT COUNT(*) FROM order_slips WHERE order_id = ?");
          $countSlipStmt->execute([$order_id]);
          $existingSlips = (int)$countSlipStmt->fetchColumn();

          if ($existingSlips === 0) {
              $updOrdStmt = $conn->prepare("UPDATE orders SET payment_status = 'PendingVerification' WHERE id = ?");
              $updOrdStmt->execute([$order_id]);
          }
      }
  } catch (Exception $e) {
      // error_log("Error updating COD status: " . $e->getMessage());
  }

  // Insert new order slip
  $amount = (int) $data["amount"];
  $transfer_date = $data["transfer_date"];
  $url = $data["url"] ?? null; // Optional URL field

  $insert_sql = "INSERT INTO order_slips (order_id, amount, bank_account_id, transfer_date, url, upload_by, upload_by_name)
                   VALUES (?, ?, ?, ?, ?, ?, ?)";

  $insert_stmt = $conn->prepare($insert_sql);
  $result = $insert_stmt->execute([
    $order_id,
    $amount,
    $bank_account_id,
    $transfer_date,
    $url,
    isset($data["upload_by"]) ? (int)$data["upload_by"] : null,
    isset($data["upload_by_name"]) ? $data["upload_by_name"] : null,
  ]);

  if ($result) {
    $slip_id = $conn->lastInsertId();
    echo json_encode(
      [
        "success" => true,
        "message" => "Order slip added successfully",
        "data" => [
          "id" => $slip_id,
          "order_id" => $order_id,
          "amount" => $amount,
          "bank_account_id" => $bank_account_id,
          "transfer_date" => $transfer_date,
          "url" => $url,
        ],
      ],
      JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
    );
  } else {
    echo json_encode([
      "success" => false,
      "message" => "Failed to insert order slip",
    ]);
  }
} catch (Exception $e) {
  echo json_encode(
    [
      "success" => false,
      "message" => $e->getMessage(),
    ],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
  );
}
?>
