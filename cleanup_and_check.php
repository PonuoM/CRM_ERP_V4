<?php
require_once 'api/config.php';

try {
    $pdo = db_connect();
    
    echo "--- Database Status Before Cleanup ---\n";
    
    // Check total count
    $stmt = $pdo->query("SELECT COUNT(*) FROM address_sub_districts");
    $total = $stmt->fetchColumn();
    echo "Total rows: $total\n";
    
    // Check unique IDs
    $stmt = $pdo->query("SELECT COUNT(DISTINCT id) FROM address_sub_districts");
    $unique = $stmt->fetchColumn();
    echo "Unique IDs: $unique\n";
    
    if ($total > $unique) {
        $duplicates = $total - $unique;
        echo "Found $duplicates duplicate rows (by ID)!\n";
        
        // Find Saen Suk specifically
        $stmt = $pdo->query("SELECT id, name_th, count(*) as c FROM address_sub_districts WHERE name_th = 'แสนสุข' GROUP BY id HAVING c > 1");
        $saenSukDups = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo "Saen Suk duplicates: " . count($saenSukDups) . " groups\n";
        
        // CLEANUP STRATEGY
        // We will create a temporary table with unique IDs, truncate original, and copy back.
        // This is safer/faster for massive duplicates than individual DELETEs.
        
        echo "Starting cleanup...\n";
        
        // 1. Create temp table structure
        $pdo->exec("CREATE TABLE address_sub_districts_temp LIKE address_sub_districts");
        
        // 2. Insert unique records (GROUP BY id picks one of each)
        // We ensure we pick the one with zip_code = 20130 if available for Saen Suk
        // For others, we just pick any.
        // Actually, let's try to be smart.
        // But since ID is unique in JSON source, GROUP BY id should be fine.
        
        $pdo->exec("INSERT INTO address_sub_districts_temp SELECT * FROM address_sub_districts GROUP BY id");
        
        // 3. Check temp table count
        $stmt = $pdo->query("SELECT COUNT(*) FROM address_sub_districts_temp");
        $tempCount = $stmt->fetchColumn();
        echo "Temp table rows: $tempCount\n";
        
        if ($tempCount == $unique) {
            echo "Cleanup prepared. Swapping tables...\n";
            
            // 4. Truncate original and copy back
            $pdo->exec("TRUNCATE TABLE address_sub_districts");
            $pdo->exec("INSERT INTO address_sub_districts SELECT * FROM address_sub_districts_temp");
            
            // 5. Drop temp table
            $pdo->exec("DROP TABLE address_sub_districts_temp");
            
            // 6. Add Primary Key to prevent future duplicates
            echo "Adding PRIMARY KEY constraints...\n";
            try {
                $pdo->exec("ALTER TABLE address_sub_districts ADD PRIMARY KEY (id)");
                echo "Added PK to address_sub_districts\n";
            } catch (Exception $e) {
                echo "Could not add PK: " . $e->getMessage() . "\n";
            }
            
            // Also ensure Saen Suk is 20130
             $pdo->exec("UPDATE address_sub_districts SET zip_code = '20130' WHERE name_th = 'แสนสุข' AND district_id = 2001");
             echo "Forced update of Saen Suk zip code to 20130\n";
            
            echo "Cleanup Complete!\n";
        } else {
            echo "Something went wrong. Temp count ($tempCount) != Unique IDs ($unique). Aborting swap.\n";
        }
    } else {
        echo "No duplicates found. Database is clean.\n";
         // Also ensure Saen Suk is 20130
         $pdo->exec("UPDATE address_sub_districts SET zip_code = '20130' WHERE name_th = 'แสนสุข' AND district_id = 2001");
         echo "Forced update of Saen Suk zip code to 20130\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
