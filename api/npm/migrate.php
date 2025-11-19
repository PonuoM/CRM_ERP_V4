<?php
require_once dirname(__DIR__) . "/../config.php";

cors();

// Set working directory to project root
$projectRoot = dirname(dirname(__DIR__));
chdir($projectRoot);

// Execute the db:migrate command
$output = [];
$returnCode = 0;

try {
  // Run command and capture output
  exec("npm run db:migrate 2>&1", $output, $returnCode);

  // Convert output array to string
  $outputString = implode("\n", $output);

  if ($returnCode === 0) {
    // Success
    json_response([
      "success" => true,
      "message" => "Database migration completed successfully",
      "output" => $outputString,
    ]);
  } else {
    // Error
    json_response(
      [
        "success" => false,
        "message" => "Database migration failed with exit code: $returnCode",
        "output" => $outputString,
      ],
      500,
    );
  }
} catch (Exception $e) {
  json_response(
    [
      "success" => false,
      "message" => "Error executing database migration: " . $e->getMessage(),
      "output" => "",
    ],
    500,
  );
}
