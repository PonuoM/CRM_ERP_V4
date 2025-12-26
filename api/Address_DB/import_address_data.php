<?php
/**
 * Import Thai address data from JSON files to database
 * This script imports data from:
 * - geographies.json -> address_geographies table
 * - provinces.json -> address_provinces table
 * - districts.json -> address_districts table
 * - sub_districts.json -> address_sub_districts table
 */

// Include database configuration
require_once '../config.php';

// Set headers for JSON response
header('Content-Type: application/json');

// Function to log messages
function logMessage($message) {
    echo $message . "\n";
}

// Function to insert or update data in a table
function insertOrUpdateData($pdo, $table, $data) {
    try {
        if (empty($data)) return 0;

        // Get the columns from the first data item
        $columns = array_keys($data[0]);
        $count = 0;

        foreach ($data as $row) {
            $values = [];
            $checkParams = [];
            $checkSql = "";

            // Custom check checks based on table
            if ($table === 'address_sub_districts') {
                // For sub-districts, strictly check ID + ZipCode (and maybe DistrictID)
                // Using ID + ZipCode as unique identifier
                $checkSql = "SELECT COUNT(*) FROM `$table` WHERE `id` = ? AND `zip_code` = ?";
                $checkParams = [$row['id'], $row['zip_code']];
            } else {
                // For other tables, assume ID is unique
                $checkSql = "SELECT COUNT(*) FROM `$table` WHERE `id` = ?";
                $checkParams = [$row['id']];
            }

            // Check existence
            $checkStmt = $pdo->prepare($checkSql);
            $checkStmt->execute($checkParams);
            $exists = $checkStmt->fetchColumn() > 0;

            if ($exists) {
                // Update logic (optional, currently just skipping if exists based on user requirement to "not duplicate")
                // Because "ON DUPLICATE KEY UPDATE" was effectively doing upsert.
                // But now we can't rely on key. 
                // Let's UPDATE existing record to be safe?
                // Construct UPDATE query
                $updateClauses = [];
                $updateParams = [];
                foreach ($columns as $column) {
                    if ($column !== 'id') {
                        $updateClauses[] = "`$column` = ?";
                        $updateParams[] = isset($row[$column]) ? $row[$column] : null;
                    }
                }
                
                // Add WHERE clause params
                $sql = "UPDATE `$table` SET " . implode(', ', $updateClauses) . " WHERE ";
                if ($table === 'address_sub_districts') {
                    $sql .= "`id` = ? AND `zip_code` = ?";
                    $updateParams[] = $row['id'];
                    $updateParams[] = $row['zip_code'];
                } else {
                    $sql .= "`id` = ?";
                    $updateParams[] = $row['id'];
                }
                
                $stmt = $pdo->prepare($sql);
                $stmt->execute($updateParams);

            } else {
                // Insert
                $placeholders = implode(', ', array_fill(0, count($columns), '?'));
                $insertSql = "INSERT INTO `$table` (`" . implode('`, `', $columns) . "`) VALUES ($placeholders)";
                
                foreach ($columns as $column) {
                    $values[] = isset($row[$column]) ? $row[$column] : null;
                }
                
                $stmt = $pdo->prepare($insertSql);
                if ($stmt->execute($values)) {
                    $count++;
                }
            }
        }
        
        return $count;
    } catch (PDOException $e) {
        logMessage("Error inserting data into $table: " . $e->getMessage());
        return 0;
    }
}

// Function to read and decode JSON file
function readJsonFile($filename) {
    if (!file_exists($filename)) {
        logMessage("File not found: $filename");
        return null;
    }
    
    $jsonContent = file_get_contents($filename);
    if ($jsonContent === false) {
        logMessage("Failed to read file: $filename");
        return null;
    }
    
    $data = json_decode($jsonContent, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        logMessage("JSON decode error in $filename: " . json_last_error_msg());
        return null;
    }
    
    return $data;
}

// Main execution
try {
    // Connect to database using the existing db_connect function
    $pdo = db_connect();
    
    logMessage("Database connection successful");

    // Disable foreign key checks
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
    
    // Import geographies
    logMessage("Importing geographies...");
    $geographies = readJsonFile('geographies.json');
    if ($geographies !== null) {
        $count = insertOrUpdateData($pdo, 'address_geographies', $geographies);
        logMessage("Imported $count geographies");
    }
    
    // Import provinces
    logMessage("Importing provinces...");
    $provinces = readJsonFile('provinces.json');
    if ($provinces !== null) {
        $count = insertOrUpdateData($pdo, 'address_provinces', $provinces);
        logMessage("Imported $count provinces");
    }
    
    // Import districts
    logMessage("Importing districts...");
    $districts = readJsonFile('districts.json');
    if ($districts !== null) {
        $count = insertOrUpdateData($pdo, 'address_districts', $districts);
        logMessage("Imported $count districts");
    }
    
    // Import sub-districts
    logMessage("Importing sub-districts...");
    $subDistricts = readJsonFile('sub_districts.json');
    if ($subDistricts !== null) {
        $count = insertOrUpdateData($pdo, 'address_sub_districts', $subDistricts);
        logMessage("Imported $count sub-districts");
    }
    
    // Re-enable foreign key checks
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");

    logMessage("Import completed successfully");
    
    echo json_encode([
        'success' => true,
        'message' => 'Address data imported successfully'
    ]);
    
} catch (PDOException $e) {
    // Re-enable foreign key checks even if error
    if (isset($pdo)) $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
    logMessage("Database error: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    if (isset($pdo)) $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
    logMessage("General error: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Error: ' . $e->getMessage()
    ]);
}
?>