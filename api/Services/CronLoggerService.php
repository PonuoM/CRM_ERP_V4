<?php
class CronLoggerService {
    private $pdo;
    private $cronName;
    private $logId;

    public function __construct(PDO $pdo, string $cronName) {
        $this->pdo = $pdo;
        $this->cronName = $cronName;
    }

    /**
     * Start the cron log, taking a snapshot of the current basket distribution
     */
    public function start(): void {
        $snapshot = $this->takeCustomerBasketSnapshot();
        
        $stmt = $this->pdo->prepare("
            INSERT INTO cron_execution_logs (cron_name, status, snapshot_before, started_at) 
            VALUES (?, 'running', ?, NOW())
        ");
        $stmt->execute([$this->cronName, json_encode($snapshot)]);
        $this->logId = $this->pdo->lastInsertId();
    }

    /**
     * Finish the cron log, taking an after snapshot and saving results
     */
    public function finish(int $transferredCount, int $errorCount, string $status = 'success'): void {
        if (!$this->logId) {
            return; // Was not started properly
        }

        $snapshot = $this->takeCustomerBasketSnapshot();

        $stmt = $this->pdo->prepare("
            UPDATE cron_execution_logs 
            SET status = ?, 
                snapshot_after = ?, 
                transferred_count = ?, 
                error_count = ?, 
                finished_at = NOW() 
            WHERE id = ?
        ");
        $stmt->execute([
            $status, 
            json_encode($snapshot), 
            $transferredCount, 
            $errorCount, 
            $this->logId
        ]);
    }

    /**
     * Mark the cron as failed due to an exception
     */
    public function fail(Exception $e): void {
        if (!$this->logId) {
            return;
        }

        // We can optionally store the error message in the after snapshot
        $errorData = ['error_message' => $e->getMessage()];

        $stmt = $this->pdo->prepare("
            UPDATE cron_execution_logs 
            SET status = 'failed', 
                snapshot_after = ?, 
                finished_at = NOW() 
            WHERE id = ?
        ");
        $stmt->execute([
            json_encode($errorData), 
            $this->logId
        ]);
    }

    /**
     * Queries the DB for the number of customers grouped by assigned_to and current_basket_key
     */
    private function takeCustomerBasketSnapshot(): array {
        $stmt = $this->pdo->query("
            SELECT 
                IFNULL(assigned_to, 'unassigned_user') as user_id,
                IFNULL(current_basket_key, 'unassigned_basket') as basket_key, 
                COUNT(*) as customer_count 
            FROM customers 
            GROUP BY assigned_to, current_basket_key
        ");
        
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $snapshot = [];
        $total = 0;
        foreach ($results as $row) {
            $userId = $row['user_id'] === 'unassigned_user' ? 'unassigned_user' : 'user_' . $row['user_id'];
            $basketKey = $row['basket_key'];
            $count = (int)$row['customer_count'];
            
            if (!isset($snapshot[$userId])) {
                $snapshot[$userId] = ['__user_total__' => 0];
            }
            
            $snapshot[$userId][$basketKey] = $count;
            $snapshot[$userId]['__user_total__'] += $count;
            $total += $count;
        }
        
        // Add a total count for easy reference
        $snapshot['__total__'] = $total;
        
        return $snapshot;
    }
}
