<?php
require_once __DIR__ . '/../api/config.php';

try {
    $pdo = db_connect();
    echo "Connected to database.\n";

    $sqlFile = __DIR__ . '/../api/Order_DB/create_order_tab_rules.sql';
    if (!file_exists($sqlFile)) {
        die("SQL file not found: $sqlFile\n");
    }

    $sql = file_get_contents($sqlFile);
    $pdo->exec($sql);
    echo "Migration completed successfully: order_tab_rules table created/verified.\n";

    // Check if payment_status column exists, add if not (for existing tables)
    $stmt = $pdo->prepare("SHOW COLUMNS FROM order_tab_rules LIKE 'payment_status'");
    $stmt->execute();
    if ($stmt->rowCount() == 0) {
        echo "Adding missing column: payment_status...\n";
        $pdo->exec("ALTER TABLE order_tab_rules ADD COLUMN payment_status VARCHAR(50) NULL COMMENT 'Payment status filter value' AFTER payment_method");
        echo "Column added.\n";
    }

    // Seed default rules if empty
    $stmt = $pdo->query("SELECT COUNT(*) FROM order_tab_rules");
    if ($stmt->fetchColumn() == 0) {
        echo "Seeding default rules...\n";
        // Default rules based on legacy logic
        // Unpaid: PayAfter, Transfer (PaymentSlip=null OR ''), COD (no tracking)
        // Pending: Transfer + Slip uploaded (verification_status=pending)
        // ToConfirm: COD + Tracking uploaded
        // ... This is complex to seed perfectly 1-to-1 with legacy logic in SQL,
        // but we can insert some basic examples.
        
        $rules = [
            ['unpaid', 'PayAfter', 'Pending'],
            ['unpaid', 'Transfer', 'Pending'], // And no slip logic handled in code
            ['unpaid', 'COD', 'Pending'],
        ];

        $insert = $pdo->prepare("INSERT INTO order_tab_rules (tab_key, payment_method, order_status, company_id) VALUES (?, ?, ?, 0)");
        foreach ($rules as $rule) {
            $insert->execute($rule);
        }
        echo "Seeded default rules.\n";
    }

} catch (PDOException $e) {
    die("Migration failed: " . $e->getMessage() . "\n");
}
