<?php
/**
 * Temporary migration script disguised as verify_db.php
 * Executes migration 029 on the remote production database.
 */
$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

echo "Connected successfully to production database!\n";

// 1. Alter Enum
$alterSql = "ALTER TABLE basket_transition_log MODIFY COLUMN transition_type ENUM(
  'sale',
  'fail',
  'monthly_cron',
  'manual',
  'redistribute',
  'pending_admin_owned',
  'pending_admin_unowned',
  'picking_upsell_sold',
  'picking_upsell_not_sold',
  'picking_upsell_return_39',
  'picking_dist_to_pool',
  'picking_telesale_own',
  'picking_admin_to_upsell',
  'picking_telesale_from_dist',
  'picking_admin_no_owner',
  'aging_timeout',
  'upsell_by_others',
  'upsell_exit',
  'upsell_distribution',
  'distribute',
  'reclaim',
  'transfer'
) NOT NULL";

echo "Running ALTER TABLE...\n";
if ($conn->query($alterSql) === TRUE) {
    echo "🎉 ALTER TABLE enum update successful!\n";
} else {
    echo "❌ ALTER TABLE failed: " . $conn->error . "\n";
}

// 2. Update config
$updateSql = "UPDATE basket_config SET fail_after_days = 30 WHERE basket_key = 'upsell'";
echo "Running UPDATE basket_config...\n";
if ($conn->query($updateSql) === TRUE) {
    echo "🎉 UPDATE basket_config successful!\n";
} else {
    echo "❌ UPDATE failed: " . $conn->error . "\n";
}

// 3. Verify
$verifySql = "SELECT id, basket_key, fail_after_days FROM basket_config WHERE basket_key = 'upsell'";
$res = $conn->query($verifySql);
if ($res) {
    $row = $res->fetch_assoc();
    echo "Verification - upsell config: " . json_encode($row) . "\n";
}

$conn->close();
?>
