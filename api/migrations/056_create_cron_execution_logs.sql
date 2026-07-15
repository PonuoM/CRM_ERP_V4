CREATE TABLE `cron_execution_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cron_name` varchar(100) NOT NULL,
  `status` enum('running','success','failed') NOT NULL DEFAULT 'running',
  `snapshot_before` json DEFAULT NULL,
  `snapshot_after` json DEFAULT NULL,
  `transferred_count` int(11) DEFAULT 0,
  `error_count` int(11) DEFAULT 0,
  `started_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `finished_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cron_name_status` (`cron_name`,`status`),
  KEY `idx_started_at` (`started_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
