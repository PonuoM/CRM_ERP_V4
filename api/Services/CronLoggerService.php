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
     * @return bool True if started, false if already running (locked)
     */
    public function start(): bool {
        // Request an execution lock to prevent overlapping runs
        $stmt = $this->pdo->prepare("SELECT GET_LOCK(?, 0)");
        $stmt->execute(['cron_lock_' . $this->cronName]);
        $locked = $stmt->fetchColumn();
        
        if (!$locked) {
            return false; // Cron is already running
        }

        // --- BEST PRACTICE: Self-Healing ---
        // If we acquired the lock, it means no other instance is currently running.
        // Therefore, any existing logs stuck in 'running' state are definitely zombies 
        // (e.g. from a previous script crash or manual cancellation).
        // Let's mark them as 'failed' to keep the log history clean and accurate.
        $stmt = $this->pdo->prepare("
            UPDATE cron_execution_logs 
            SET status = 'failed', finished_at = NOW() 
            WHERE cron_name = ? AND status = 'running'
        ");
        $stmt->execute([$this->cronName]);

        $snapshot = $this->takeCustomerBasketSnapshot();
        
        $stmt = $this->pdo->prepare("
            INSERT INTO cron_execution_logs (cron_name, status, snapshot_before, started_at) 
            VALUES (?, 'running', ?, NOW())
        ");
        $stmt->execute([$this->cronName, json_encode($snapshot)]);
        $this->logId = $this->pdo->lastInsertId();
        return true;
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
        
        // Alert if failed or errors occurred
        if ($status === 'failed' || $errorCount > 0) {
            require_once __DIR__ . '/MailService.php';
            MailService::sendCronAlert($this->cronName, $errorCount);
        }
        
        $this->releaseLock();
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
        
        // Send email alert with exception details
        require_once __DIR__ . '/MailService.php';
        MailService::sendCronAlert($this->cronName, 1, $e->getMessage());
        
        $this->releaseLock();
    }
    
    /**
     * Releases the execution lock
     */
    private function releaseLock(): void {
        $stmt = $this->pdo->prepare("SELECT RELEASE_LOCK(?)");
        $stmt->execute(['cron_lock_' . $this->cronName]);
    }

    /**
     * Queries the DB for the number of customers grouped by assigned_to and current_basket_key
     */
    private function takeCustomerBasketSnapshot(): array {
        $stmt = $this->pdo->query("
            SELECT 
                c.company_id,
                IFNULL(c.assigned_to, 'unassigned_user') as user_id,
                IFNULL(c.current_basket_key, 'unassigned_basket') as basket_key,
                IFNULL(b.target_page, 'unknown') as target_page,
                COUNT(*) as customer_count 
            FROM customers c
            LEFT JOIN basket_config b ON c.current_basket_key = b.id
            GROUP BY c.company_id, c.assigned_to, c.current_basket_key, b.target_page
        ");
        
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $snapshot = [];
        $total = 0;
        
        foreach ($results as $row) {
            $companyId = 'company_' . ($row['company_id'] ?: 'unknown');
            $userId = $row['user_id'] === 'unassigned_user' ? 'unassigned_user' : 'user_' . $row['user_id'];
            $basketKey = $row['basket_key'];
            $targetPage = $row['target_page'];
            $count = (int)$row['customer_count'];
            
            if (!isset($snapshot[$companyId])) {
                $snapshot[$companyId] = [
                    'distribution_pool' => ['__total__' => 0],
                    'users' => [],
                    '__company_total__' => 0
                ];
            }
            
            // Track distribution pool (ตะกร้ากลาง) separately for easy reporting
            if ($targetPage === 'distribution') {
                if (!isset($snapshot[$companyId]['distribution_pool'][$basketKey])) {
                    $snapshot[$companyId]['distribution_pool'][$basketKey] = 0;
                }
                $snapshot[$companyId]['distribution_pool'][$basketKey] += $count;
                $snapshot[$companyId]['distribution_pool']['__total__'] += $count;
            }
            
            // Standard tracking by assigned user
            if (!isset($snapshot[$companyId]['users'][$userId])) {
                $snapshot[$companyId]['users'][$userId] = ['__user_total__' => 0];
            }
            
            $snapshot[$companyId]['users'][$userId][$basketKey] = $count;
            $snapshot[$companyId]['users'][$userId]['__user_total__'] += $count;
            $snapshot[$companyId]['__company_total__'] += $count;
            $total += $count;
        }
        
        // Add a grand total count for easy reference
        $snapshot['__grand_total__'] = $total;
        
        return $snapshot;
    }
}
