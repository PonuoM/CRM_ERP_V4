<?php
require_once 'api/config.php';

try {
    $pdo = db_connect();

    // 1. Get the current Saen Suk entry (which is now 20130)
    $stmt = $pdo->prepare("SELECT * FROM address_sub_districts WHERE name_th = 'แสนสุข' AND district_id = 2001 LIMIT 1");
    $stmt->execute();
    $current = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$current) {
        die("Could not find Saen Suk entry.\n");
    }

    echo "Found current Saen Suk: ID {$current['id']} - Zip {$current['zip_code']}\n";

    // 2. Prepare new entry with Zip 20000 (The standard Mueang Chon Buri zip)
    // We need a NEW unique ID.
    $stmt = $pdo->query("SELECT MAX(id) FROM address_sub_districts");
    $maxId = $stmt->fetchColumn();
    $newId = $maxId + 1;

    $newZip = '20000'; // Default for Mueang Chon Buri
    if ($current['zip_code'] == '20000') {
        $newZip = '20130'; // Swap if current is 20000
    }

    echo "Creating variant: ID $newId - Zip $newZip\n";

    // 3. Insert new row
    $sql = "INSERT INTO address_sub_districts (`id`, `zip_code`, `name_th`, `name_en`, `district_id`, `lat`, `long`, `created_at`, `updated_at`) 
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        $newId,
        $newZip,
        $current['name_th'],
        $current['name_en'],
        $current['district_id'],
        $current['lat'],
        $current['long']
    ]);

    echo "Success! Added Saen Suk variant.\n";

    // 4. Verify
    $stmt = $pdo->prepare("SELECT id, name_th, zip_code FROM address_sub_districts WHERE name_th = 'แสนสุข' AND district_id = 2001");
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Current Saen Suk entries in DB:\n";
    foreach ($rows as $r) {
        echo " - ID: {$r['id']}, Zip: {$r['zip_code']}\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
