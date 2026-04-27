const mysql = require('mysql2/promise');

async function run() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'primacom_bloguser',
      password: 'pJnL53Wkhju2LaGPytw8',
      database: 'primacom_mini_erp'
    });

    console.log("Connected successfully!");

    await connection.execute(`START TRANSACTION`);
    await connection.execute(`UPDATE orders SET customer_id = 73837 WHERE customer_id = 48649`);
    await connection.execute(`UPDATE call_history SET customer_id = 73837 WHERE customer_id = 48649`);
    await connection.execute(`UPDATE appointments SET customer_id = 73837 WHERE customer_id = 48649`);
    await connection.execute(`UPDATE activities SET customer_id = 73837 WHERE customer_id = 48649`);
    await connection.execute(`UPDATE customer_address SET customer_id = '73837' WHERE customer_id = '48649'`);
    await connection.execute(`UPDATE customer_assignment_history SET customer_id = 73837 WHERE customer_id = 48649`);
    await connection.execute(`UPDATE customer_audit_log SET customer_id = 73837 WHERE customer_id = 48649`);
    await connection.execute(`UPDATE customer_logs SET customer_id = '73837' WHERE customer_id = '48649'`);
    await connection.execute(`UPDATE customer_blocks SET customer_id = '73837' WHERE customer_id = '48649'`);
    await connection.execute(`UPDATE basket_transition_log SET customer_id = 73837 WHERE customer_id = 48649`);
    await connection.execute(`UPDATE basket_return_log SET customer_id = 73837 WHERE customer_id = 48649`);
    
    // Ignore duplicate tags if any exist
    await connection.execute(`UPDATE IGNORE customer_tags SET customer_id = '73837' WHERE customer_id = '48649'`);
    await connection.execute(`DELETE FROM customer_tags WHERE customer_id = '48649'`);

    await connection.execute(`UPDATE customers SET backup_phone = '961739341', total_purchases = 3720.00, total_calls = 6, order_count = 4 WHERE customer_id = 73837`);
    await connection.execute(`DELETE FROM customers WHERE customer_id = 48649`);
    
    await connection.execute(`COMMIT`);

    console.log("Merge completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

run();
