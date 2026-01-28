<?php
/**
 * Cron Logger Utility
 * 
 * Logs cron job executions to daily log files
 * Only writes logs when there's actual work done (to reduce log clutter)
 * 
 * Usage in cron:
 *   require_once __DIR__ . '/cron_logger.php';
 *   $logger = new CronLogger('process_picking_baskets');
 *   $logger->logStart();
 *   $logger->log('Processing...');
 *   // ... do work ...
 *   $logger->logEnd($movedCount > 0); // Only write to file if work was done
 */

class CronLogger {
    private $cronName;
    private $logDir;
    private $logFile;
    private $buffer = [];
    private $hasWork = false;
    
    public function __construct($cronName) {
        $this->cronName = $cronName;
        $this->logDir = __DIR__ . '/logs';
        
        // Create logs directory if not exists
        if (!is_dir($this->logDir)) {
            mkdir($this->logDir, 0755, true);
        }
        
        // Monthly log file: logs/process_picking_baskets_2026-01.txt
        $month = date('Y-m');
        $this->logFile = $this->logDir . '/' . $cronName . '_' . $month . '.txt';
    }
    
    /**
     * Add message to buffer (not written to file yet)
     */
    public function log($message) {
        $timestamp = date('Y-m-d H:i:s');
        $this->buffer[] = "[$timestamp] $message";
    }
    
    /**
     * Mark that work was done - this will cause logs to be written
     */
    public function setHasWork($hasWork = true) {
        $this->hasWork = $hasWork;
    }
    
    /**
     * Write directly to file (for errors - always log)
     */
    private function writeToFile($message) {
        $timestamp = date('Y-m-d H:i:s');
        $line = "[$timestamp] $message\n";
        file_put_contents($this->logFile, $line, FILE_APPEND | LOCK_EX);
    }
    
    /**
     * Flush buffer to file if there's work done
     */
    public function flush() {
        if ($this->hasWork && !empty($this->buffer)) {
            $content = implode("\n", $this->buffer) . "\n";
            file_put_contents($this->logFile, $content, FILE_APPEND | LOCK_EX);
            $this->buffer = [];
        }
    }
    
    public function logResult($result) {
        $this->log("Result: " . json_encode($result, JSON_UNESCAPED_UNICODE));
    }
    
    public function logStart() {
        $this->log("========== CRON START ==========");
    }
    
    /**
     * End logging - write to file only if hasWork is true
     * @param bool $hasWork Whether any work was actually done
     */
    public function logEnd($hasWork = null) {
        if ($hasWork !== null) {
            $this->hasWork = $hasWork;
        }
        $this->log("========== CRON END ==========");
        $this->flush();
    }
    
    /**
     * Log error - errors are ALWAYS written to file
     */
    public function logError($error) {
        // Flush buffer first, then write error
        $this->hasWork = true; // Errors always trigger logging
        $this->flush();
        $this->writeToFile("ERROR: $error");
    }
}
