<?php
// api/Services/ScoringService.php

class ScoringService {
    /**
     * Calculate a local priority score based on hard rules
     */
    public function calculateLocalScore($customer, $appointments, $orders = [], $calls = []) {
        $score = 0;
        $now = new DateTime();
        $reasons = [];

        // TIER 1: Critical Priority - Appointments (300-500 points)
        foreach ($appointments as $appt) {
            if ($appt['status'] !== 'เสร็จสิ้น' && !empty($appt['date'])) {
                try {
                    $apptDate = new DateTime($appt['date']);
                    if ($apptDate->format('Y-m-d') === $now->format('Y-m-d')) {
                        $score += 500; 
                        $reasons[] = "⭐ มีนัดหมายวันนี้";
                    } elseif ($apptDate < $now) {
                        $score += 300; 
                        $reasons[] = "⚠️ นัดหมายเกินกำหนด";
                    }
                } catch (Exception $e) {}
            }
        }

        // TIER 2: Hot Leads - Recent Purchase Follow-up (200-300 points)
        if (!empty($customer['last_sale_date'])) {
            try {
                $lastSale = new DateTime($customer['last_sale_date']);
                $diff = $now->diff($lastSale);
                if ($diff->days <= 3) {
                    $score += 300; 
                    $reasons[] = "🔥 ดูแลหลังการขาย (ซื้อ " . $diff->days . " วันก่อน)";
                } elseif ($diff->days <= 7) {
                    $score += 200;
                    $reasons[] = "📞 ติดตามหลังขาย (ซื้อ " . $diff->days . " วันก่อน)";
                }
            } catch (Exception $e) {}
        }

        // TIER 3: Predictive - Restock Cycle Detection (150-250 points)
        $cycleResult = $this->calculateRestockCycle($orders, $now);
        if ($cycleResult['bonus'] > 0) {
            $score += $cycleResult['bonus'];
            $reasons[] = $cycleResult['reason'];
        }

        // TIER 4: Engagement - Call Status Signals (100-200 points)
        $callBonus = $this->getCallStatusBonus($calls);
        if ($callBonus['bonus'] > 0) {
            $score += $callBonus['bonus'];
            $reasons[] = $callBonus['reason'];
        }

        // Customer Grade (20-80 points)
        $gradeWeight = [
            'A+' => 80,
            'A' => 60,
            'B' => 40,
            'C' => 20,
            'D' => 0
        ];
        $grade = $customer['grade'] ?? '';
        if (isset($gradeWeight[$grade]) && $gradeWeight[$grade] > 0) {
            $score += $gradeWeight[$grade];
            $reasons[] = "เกรด {$grade}";
        }

        // Lifecycle Bonus
        if (($customer['lifecycle_status'] ?? '') === 'New') {
            $score += 30; 
            $reasons[] = "ลูกค้าใหม่";
        }

        // Farm Size Multiplier (before fatigue)
        $sizeMultiplier = $this->getFarmSizeMultiplier($calls);
        if ($sizeMultiplier > 1.0) {
            $reasons[] = "🚜 ไร่ใหญ่ (x{$sizeMultiplier})";
        }

        // Fatigue Protection (CRITICAL - applies BEFORE multiplier)
        $fatigueScore = 0;
        if (!empty($customer['last_follow_up_date'])) {
            try {
                $lastCall = new DateTime($customer['last_follow_up_date']);
                $diff = $now->diff($lastCall);
                
                if ($diff->days < 1 && $diff->invert === 1) {
                    $fatigueScore = -300; 
                    $reasons[] = "⛔ โทรวันนี้แล้ว (" . $lastCall->format('d/m/Y H:i') . ")";
                } elseif ($diff->days < 3) {
                    $fatigueScore = -100; 
                    $reasons[] = "⏸️ เพิ่งโทรไปเมื่อเร็วๆ นี้ (" . $lastCall->format('d/m/Y') . ")";
                }
            } catch (Exception $e) {}
        }

        // Apply farm size multiplier to positive score, then add fatigue
        $finalScore = ($score * $sizeMultiplier) + $fatigueScore;

        return ['score' => (int)$finalScore, 'reasons' => $reasons];
    }

    /**
     * Calculate restock cycle prediction
     */
    private function calculateRestockCycle($orders, $now) {
        if (count($orders) < 2) {
            return ['bonus' => 0, 'reason' => ''];
        }

        // Calculate average days between orders
        $intervals = [];
        for ($i = 0; $i < count($orders) - 1; $i++) {
            try {
                $date1 = new DateTime($orders[$i]['order_date']);
                $date2 = new DateTime($orders[$i + 1]['order_date']);
                $intervals[] = abs($date1->diff($date2)->days);
            } catch (Exception $e) {}
        }

        if (empty($intervals)) {
            return ['bonus' => 0, 'reason' => ''];
        }

        $avgCycle = array_sum($intervals) / count($intervals);
        
        // Check time since last order
        try {
            $lastOrder = new DateTime($orders[0]['order_date']);
            $daysSinceOrder = $now->diff($lastOrder)->days;
            
            $cycleProgress = $daysSinceOrder / $avgCycle;
            
            if ($cycleProgress >= 0.95) {
                return ['bonus' => 250, 'reason' => "📅 ใกล้ถึงรอบสั่ง (Cycle " . round($avgCycle) . " วัน, ผ่านมา " . $daysSinceOrder . " วัน)"];
            } elseif ($cycleProgress >= 0.85) {
                return ['bonus' => 200, 'reason' => "🔔 ใกล้รอบสั่ง (Cycle " . round($avgCycle) . " วัน)"];
            } elseif ($cycleProgress >= 0.80) {
                return ['bonus' => 150, 'reason' => "⏰ เฝ้าดูรอบสั่ง (Cycle " . round($avgCycle) . " วัน)"];
            }
        } catch (Exception $e) {}

        return ['bonus' => 0, 'reason' => ''];
    }

    /**
     * Analyze call history for engagement signals
     */
    private function getCallStatusBonus($calls) {
        if (empty($calls)) {
            return ['bonus' => 0, 'reason' => ''];
        }

        $latestCall = $calls[0];
        $result = strtolower($latestCall['result'] ?? '');
        $notes = strtolower($latestCall['notes'] ?? '');

        // Check for high-value signals
        if (strpos($result, 'สนใจ') !== false || strpos($notes, 'สนใจ') !== false) {
            return ['bonus' => 200, 'reason' => "💰 ลูกค้าสนใจ (รอปิดการขาย)"];
        }
        
        if (strpos($result, 'ไม่ติด') !== false || strpos($result, 'ไม่รับ') !== false) {
            return ['bonus' => 150, 'reason' => "📱 โทรไม่ติด (ลองใหม่)"];
        }

        if (strpos($result, 'โทรกลับ') !== false || strpos($notes, 'โทรกลับ') !== false) {
            return ['bonus' => 180, 'reason' => "☎️ ขอโทรกลับ"];
        }

        return ['bonus' => 0, 'reason' => ''];
    }

    /**
     * Get farm size multiplier from call history
     */
    private function getFarmSizeMultiplier($calls) {
        if (empty($calls)) {
            return 1.0;
        }

        // Find most recent area_size
        foreach ($calls as $call) {
            $areaSize = floatval($call['area_size'] ?? 0);
            if ($areaSize > 0) {
                if ($areaSize >= 100) {
                    return 2.0;
                } elseif ($areaSize >= 50) {
                    return 1.5;
                } elseif ($areaSize >= 20) {
                    return 1.2;
                }
                break;
            }
        }

        return 1.0;
    }
}
