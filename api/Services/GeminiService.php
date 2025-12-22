<?php
// api/Services/GeminiService.php

class GeminiService {
    private $apiKey;
    private $baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

    public function __construct($apiKey) {
        $this->apiKey = $apiKey;
    }

    /**
     * Generate an AI score and insight for a customer
     */
    public function generateInsight($customerData, $orderHistory, $callHistory) {
        $prompt = $this->buildPrompt($customerData, $orderHistory, $callHistory);
        
        $payload = [
            "contents" => [
                [
                    "parts" => [
                        ["text" => $prompt]
                    ]
                ]
            ],
            "generationConfig" => [
                "response_mime_type" => "application/json"
            ]
        ];

        $ch = curl_init($this->baseUrl . "?key=" . $this->apiKey);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            error_log("Gemini API Error (Code $httpCode): " . $response);
            return null;
        }

        $result = json_decode($response, true);
        $content = $result['candidates'][0]['content']['parts'][0]['text'] ?? null;
        
        if ($content) {
            $decoded = json_decode($content, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                return $decoded;
            }
        }

        return null;
    }

    private function buildPrompt($customerData, $orderHistory, $callHistory) {
        // Clean data to remove PII (Personal Identifiable Information)
        $cleanOrders = array_map(function($o) {
            return [
                "date" => $o['order_date'] ?? $o['created_at'] ?? 'N/A',
                "status" => $o['order_status'] ?? 'N/A',
                "total" => $o['total_amount'] ?? 0
            ];
        }, array_slice($orderHistory, 0, 5));

        $cleanCalls = array_map(function($c) {
            return [
                "date" => $c['date'] ?? 'N/A',
                "result" => $c['result'] ?? 'N/A',
                "notes" => mb_substr($c['notes'] ?? '', 0, 50) . "..."
            ];
        }, array_slice($callHistory, 0, 3));

        $context = [
            "lifecycle" => $customerData['lifecycle_status'] ?? 'Unknown',
            "grade" => $customerData['grade'] ?? 'N/A',
            "recent_orders" => $cleanOrders,
            "recent_calls" => $cleanCalls,
            "last_sale_date" => $customerData['last_sale_date'] ?? null,
            "last_call_date" => $customerData['last_follow_up_date'] ?? null
        ];

        return "Task: Analyze sales lead priority.
Provide an AI Priority Score (1-100) and a short Thai reason for the priority.
Consider: Purchase frequency (restock needed?), loyalty (high grade?), and avoiding fatigue (don't call if recent contact exists).
Customer Data: " . json_encode($context) . "
Output MUST be JSON: {\"score\": number, \"reason_thai\": \"string\"}";
    }
}
