<?php

class MailService {
    /**
     * Sends an email alert when a cron job fails
     *
     * @param string $cronName Name of the cron job
     * @param int $errorCount Number of errors encountered
     * @param string $errorMessage Optional exception or error message
     * @return bool True if mail was accepted for delivery
     */
    public static function sendCronAlert(string $cronName, int $errorCount, string $errorMessage = ''): bool {
        $recipients = defined('CRON_ALERT_EMAILS') ? CRON_ALERT_EMAILS : [];
        if (empty($recipients)) {
            return false;
        }

        $to = implode(', ', $recipients);
        $subject = "🚨 [CRM Alert] Cron Job Failed: {$cronName}";
        
        $body = "
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { padding: 20px; border: 1px solid #ffcccc; background-color: #fff9f9; border-radius: 5px; }
                h2 { color: #d9534f; margin-top: 0; }
                .footer { margin-top: 30px; font-size: 0.9em; color: #777; border-top: 1px solid #ddd; padding-top: 10px; }
            </style>
        </head>
        <body>
            <div class='container'>
                <h2>⚠️ Cron Job Execution Failed</h2>
                <p>The system detected errors during the execution of a background task.</p>
                <ul>
                    <li><strong>Cron Name:</strong> {$cronName}</li>
                    <li><strong>Time:</strong> " . date('Y-m-d H:i:s') . "</li>
                    <li><strong>Errors Detected:</strong> {$errorCount}</li>
                </ul>
        ";
        
        if ($errorMessage) {
            $body .= "
                <h3>Error Details:</h3>
                <pre style='background: #f4f4f4; padding: 10px; border-left: 3px solid #d9534f; overflow-x: auto;'>
" . htmlspecialchars($errorMessage) . "
                </pre>
            ";
        }
        
        $body .= "
            </div>
            <div class='footer'>
                <p>This is an automated message from the CRM system. Please do not reply directly to this email.</p>
            </div>
        </body>
        </html>
        ";
        
        $headers = implode("\r\n", [
            "MIME-Version: 1.0",
            "Content-Type: text/html; charset=UTF-8",
            "From: CRM System Alert <noreply@" . ($_SERVER['SERVER_NAME'] ?? 'crm.local') . ">"
        ]);
        
        return @mail($to, $subject, $body, $headers);
    }
}
