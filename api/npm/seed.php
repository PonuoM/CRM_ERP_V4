<?php
require_once dirname(__DIR__) . "/config.php";

cors();

// Set working directory to project root
$projectRoot = dirname(dirname(__DIR__));
chdir($projectRoot);

// Execute the db:seed command
$output = [];
$returnCode = 0;

try {
  // Run command and capture output
  exec("npx tsx scripts/prisma/db-seed.ts 2>&1", $output, $returnCode);

  // Convert output array to string
  $outputString = implode("\n", $output);

  if ($returnCode === 0) {
    // Success
    json_response([
      "success" => true,
      "message" => "Database seeding completed successfully",
      "output" => $outputString,
    ]);
  } else {
    // Error
    json_response(
      [
        "success" => false,
        "message" => "Database seeding failed with exit code: $returnCode",
        "output" => $outputString,
      ],
      500,
    );
  }
} catch (Exception $e) {
  json_response(
    [
      "success" => false,
      "message" => "Error executing database seeding: " . $e->getMessage(),
      "output" => "",
    ],
    500,
  );
}
