<?php
// Disable error reporting to ensure JSON output is not corrupted by warnings/notices
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(0);


/**
 * Standalone endpoint for Google Sheet Import
 * Accessible at: /api/google_sheet_import.php
 */

require_once __DIR__ . '/GoogleSheet/import.php';
// import.php handles everything (auth, GET/POST, response)
