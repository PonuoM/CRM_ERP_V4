<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

echo "Starting connection test...<br>";

require_once __DIR__ . '/vendor/autoload.php';

use Google\Client;
use Google\Service\Sheets;

try {
    $client = new Client();
    $client->setApplicationName('CRM_ERP Google Sheets Import');
    $client->setScopes([Sheets::SPREADSHEETS_READONLY]);
    $client->setAuthConfig(__DIR__ . '/google-credentials.json');
    $client->setAccessType('offline');
    echo "Client configured.<br>";

    $service = new Sheets($client);
    echo "Service created.<br>";

    $spreadsheetId = '1cWmpAO3OHl4vBMSbHjgkDeZMaQaqauPha0w1VVcsEFA';
    $range = 'Sheet1!A:D';

    echo "Fetching data from Sheet ID: $spreadsheetId<br>";
    $response = $service->spreadsheets_values->get($spreadsheetId, $range);
    $values = $response->getValues();
    
    echo "Data fetched successfully.<br>";
    echo "Row count: " . count($values) . "<br>";
    
    if (!empty($values)) {
        echo "First row: " . print_r($values[0], true) . "<br>";
    }

} catch (Throwable $e) {
    echo "Error: " . $e->getMessage() . "<br>";
    echo "Trace: " . $e->getTraceAsString();
}
