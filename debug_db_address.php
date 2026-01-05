<?php
require_once 'api/config.php';

try {
    $pdo = db_connect();
    
    // Check for duplicates of 'แสนสุข' in 'เมืองชลบุรี'
    echo "Checking for 'แสนสุข' in 'เมืองชลบุรี' district...\n";
    
    // First get district ID for Mueang Chon Buri
    $stmt = $pdo->prepare("SELECT id, name_th FROM address_districts WHERE name_th = 'เมืองชลบุรี'");
    $stmt->execute();
    $districts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($districts as $district) {
        echo "District: {$district['name_th']} (ID: {$district['id']})\n";
        
        $stmt = $pdo->prepare("SELECT id, name_th, zip_code, district_id FROM address_sub_districts WHERE district_id = ? AND name_th = 'แสนสุข'");
        $stmt->execute([$district['id']]);
        $subDistricts = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo "Found " . count($subDistricts) . " entries:\n";
        foreach ($subDistricts as $sd) {
            echo " - ID: {$sd['id']}, Name: {$sd['name_th']}, Zip: {$sd['zip_code']}\n";
        }
    }
    
    echo "\n--------------------------------\n";
    echo "Checking overall duplicates for 'แสนสุข' (Saen Suk) in DB:\n";
    $stmt = $pdo->query("SELECT count(*) as count, name_th, district_id FROM address_sub_districts WHERE name_th = 'แสนสุข' GROUP BY district_id HAVING count > 1");
    $duplicates = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (count($duplicates) > 0) {
        echo "Found potentially duplicate groups:\n";
        print_r($duplicates);
    } else {
        echo "No grouped duplicates found for 'แสนสุข'.\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
