<?php

// 1. Load JSON Data
$jsonFile = __DIR__ . '/api/Address_DB/sub_districts.json';
$jsonData = json_decode(file_get_contents($jsonFile), true);

$jsonMap = [];
foreach ($jsonData as $item) {
    // Key by DistrictID_NameTH
    $key = $item['district_id'] . '_' . trim($item['name_th']);
    $jsonMap[$key] = true;
}

// 2. Load CSV Data
$csvFile = __DIR__ . '/api/Address_DB/Sub.districts.csv';
$handle = fopen($csvFile, "r");

$missing = [];
$header = fgetcsv($handle); // Skip header

while (($data = fgetcsv($handle)) !== FALSE) {
    // csv format based on observation:
    // 0: id
    // 1: TambonThai
    // 2: TambonEng
    // 3: TambonThaiShort  <-- Target 
    // 4: TambonEngShort
    // 5: DistrictID       <-- Target
    // 6: DistrictThai
    // ...
    
    $tambonName = trim($data[3]); // TambonThaiShort
    $districtId = trim($data[5]); // DistrictID
    $tambonFull = trim($data[1]); // TambonThai (Full)
    $districtName = trim($data[6]); // DistrictThai
    $provinceName = trim($data[11]); // ProvinceThai
    
    if (empty($tambonName) || empty($districtId)) continue;

    $key = $districtId . '_' . $tambonName;

    if (!isset($jsonMap[$key])) {
        // Double check with "TambonThai" just in case JSON uses full name?
        // JSON preview showed simple names, but let's stick to short for primary check.
        
        $missing[] = [
            'csv_id' => $data[0],
            'district_id' => $districtId,
            'tambon_name' => $tambonName,
            'tambon_full' => $tambonFull,
            'district_name' => $districtName,
            'province_name' => $provinceName
        ];
    }
}

fclose($handle);

// Output results
echo "Total Missing: " . count($missing) . "\n";
echo json_encode($missing, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

?>
