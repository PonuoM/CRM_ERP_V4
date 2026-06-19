<?php
require_once __DIR__ . '/config.php';

function columnExists(PDO $pdo, string $table, string $column): bool {
    try {
        $stmt = $pdo->prepare("SHOW COLUMNS FROM `$table` LIKE ?");
        $stmt->execute([$column]);
        return (bool)$stmt->fetch();
    } catch (Throwable $e) {
        return false;
    }
}

function getColumnType(PDO $pdo, string $table, string $column): string {
    try {
        $stmt = $pdo->prepare("SHOW COLUMNS FROM `$table` LIKE ?");
        $stmt->execute([$column]);
        $row = $stmt->fetch();
        return $row ? strtolower($row['Type']) : '';
    } catch (Throwable $e) {
        return '';
    }
}

try {
    $pdo = db_connect();
    echo "Starting intelligent cleanup migration...\n";

    // 1. Orders
    if (columnExists($pdo, 'orders', 'customer_ref_id')) {
        echo "Processing orders...\n";
        $pdo->exec("UPDATE orders o JOIN customers c ON o.customer_ref_id = c.customer_ref_id SET o.customer_id = c.customer_id WHERE (o.customer_id IS NULL OR o.customer_id = 0) AND o.customer_ref_id IS NOT NULL");
        
        // Drop FK if exists
        try { $pdo->exec("ALTER TABLE orders DROP FOREIGN KEY fk_orders_customer"); } catch (Throwable $e) {}
        
        $pdo->exec("ALTER TABLE orders DROP COLUMN customer_ref_id");
        $pdo->exec("ALTER TABLE orders ADD CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE ON UPDATE CASCADE");
        echo "orders done.\n";
    } else {
        echo "orders already cleaned.\n";
    }

    // 2. Activities
    if (columnExists($pdo, 'activities', 'customer_ref_id')) {
        echo "Processing activities...\n";
        $pdo->exec("UPDATE activities a JOIN customers c ON a.customer_ref_id = c.customer_ref_id SET a.customer_id = c.customer_id WHERE (a.customer_id IS NULL OR a.customer_id = 0) AND a.customer_ref_id IS NOT NULL");
        
        try { $pdo->exec("ALTER TABLE activities DROP FOREIGN KEY fk_activity_customer"); } catch (Throwable $e) {}
        
        $pdo->exec("ALTER TABLE activities DROP COLUMN customer_ref_id");
        $pdo->exec("ALTER TABLE activities ADD CONSTRAINT fk_activity_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE ON UPDATE CASCADE");
        echo "activities done.\n";
    } else {
        echo "activities already cleaned.\n";
    }

    // 3. Appointments
    if (columnExists($pdo, 'appointments', 'customer_ref_id')) {
        echo "Processing appointments...\n";
        $pdo->exec("UPDATE appointments a JOIN customers c ON a.customer_ref_id = c.customer_ref_id SET a.customer_id = c.customer_id WHERE (a.customer_id IS NULL OR a.customer_id = 0) AND a.customer_ref_id IS NOT NULL");
        
        try { $pdo->exec("ALTER TABLE appointments DROP FOREIGN KEY fk_appt_customer"); } catch (Throwable $e) {}
        
        $pdo->exec("ALTER TABLE appointments DROP COLUMN customer_ref_id");
        $pdo->exec("ALTER TABLE appointments ADD CONSTRAINT fk_appt_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE ON UPDATE CASCADE");
        echo "appointments done.\n";
    } else {
        echo "appointments already cleaned.\n";
    }

    // 4. Call History
    if (columnExists($pdo, 'call_history', 'customer_ref_id')) {
        echo "Processing call_history...\n";
        $pdo->exec("UPDATE call_history c JOIN customers cust ON c.customer_ref_id = cust.customer_ref_id SET c.customer_id = cust.customer_id WHERE (c.customer_id IS NULL OR c.customer_id = 0) AND c.customer_ref_id IS NOT NULL");
        
        try { $pdo->exec("ALTER TABLE call_history DROP FOREIGN KEY fk_call_customer"); } catch (Throwable $e) {}
        
        $pdo->exec("ALTER TABLE call_history DROP COLUMN customer_ref_id");
        $pdo->exec("ALTER TABLE call_history ADD CONSTRAINT fk_call_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE ON UPDATE CASCADE");
        echo "call_history done.\n";
    } else {
        echo "call_history already cleaned.\n";
    }

    // 5. Customer Assignment History
    if (columnExists($pdo, 'customer_assignment_history', 'customer_ref_id')) {
        echo "Processing customer_assignment_history...\n";
        $pdo->exec("UPDATE customer_assignment_history cah JOIN customers c ON cah.customer_ref_id = c.customer_ref_id SET cah.customer_id = c.customer_id WHERE (cah.customer_id IS NULL OR cah.customer_id = 0) AND cah.customer_ref_id IS NOT NULL");
        
        try { $pdo->exec("ALTER TABLE customer_assignment_history DROP FOREIGN KEY fk_cah_customer"); } catch (Throwable $e) {}
        
        $pdo->exec("ALTER TABLE customer_assignment_history DROP COLUMN customer_ref_id");
        $pdo->exec("ALTER TABLE customer_assignment_history ADD CONSTRAINT fk_cah_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE ON UPDATE CASCADE");
        echo "customer_assignment_history done.\n";
    } else {
        echo "customer_assignment_history already cleaned.\n";
    }

    // 6. Customer Tags
    // Check if customer_id is VARCHAR (needs fix)
    $type = getColumnType($pdo, 'customer_tags', 'customer_id');
    if (strpos($type, 'varchar') !== false) {
        echo "Processing customer_tags...\n";
        // Sync INT from VARCHAR if needed (assuming customer_ref_id is the INT one)
        if (columnExists($pdo, 'customer_tags', 'customer_ref_id')) {
             $pdo->exec("UPDATE customer_tags ct JOIN customers c ON ct.customer_id = c.customer_ref_id SET ct.customer_ref_id = c.customer_id WHERE (ct.customer_ref_id IS NULL OR ct.customer_ref_id = 0) AND ct.customer_id IS NOT NULL");
             
             try { $pdo->exec("ALTER TABLE customer_tags DROP FOREIGN KEY fk_customer_tags_customer"); } catch (Throwable $e) {}
             
             $pdo->exec("ALTER TABLE customer_tags DROP COLUMN customer_id");
             $pdo->exec("ALTER TABLE customer_tags CHANGE customer_ref_id customer_id INT NOT NULL");
             $pdo->exec("ALTER TABLE customer_tags ADD CONSTRAINT fk_customer_tags_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE ON UPDATE CASCADE");
             echo "customer_tags done.\n";
        } else {
            echo "Error: customer_tags has varchar customer_id but no customer_ref_id to swap with.\n";
        }
    } else {
        echo "customer_tags already cleaned (customer_id is $type).\n";
    }

    echo "Migration completed successfully.\n";

} catch (Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "Trace: " . $e->getTraceAsString() . "\n";
}
