<?php
class OrderExportService {
    public static function getRegionMap(): array {
        return [
            'กรุงเทพมหานคร' => 'ภาคกลาง', 'นนทบุรี' => 'ภาคกลาง', 'ปทุมธานี' => 'ภาคกลาง',
            'สมุทรปราการ' => 'ภาคกลาง', 'สมุทรสาคร' => 'ภาคกลาง', 'นครปฐม' => 'ภาคกลาง',
            'อยุธยา' => 'ภาคกลาง', 'พระนครศรีอยุธยา' => 'ภาคกลาง',
            'อ่างทอง' => 'ภาคกลาง', 'ลพบุรี' => 'ภาคกลาง', 'สิงห์บุรี' => 'ภาคกลาง',
            'ชัยนาท' => 'ภาคกลาง', 'สระบุรี' => 'ภาคกลาง', 'นครนายก' => 'ภาคกลาง',
            'สุพรรณบุรี' => 'ภาคกลาง', 'สมุทรสงคราม' => 'ภาคกลาง',
            'เชียงใหม่' => 'ภาคเหนือ', 'เชียงราย' => 'ภาคเหนือ', 'ลำปาง' => 'ภาคเหนือ',
            'ลำพูน' => 'ภาคเหนือ', 'แม่ฮ่องสอน' => 'ภาคเหนือ', 'แพร่' => 'ภาคเหนือ',
            'น่าน' => 'ภาคเหนือ', 'พะเยา' => 'ภาคเหนือ', 'อุตรดิตถ์' => 'ภาคเหนือ',
            'ตาก' => 'ภาคเหนือ', 'สุโขทัย' => 'ภาคเหนือ', 'พิษณุโลก' => 'ภาคเหนือ',
            'พิจิตร' => 'ภาคเหนือ', 'กำแพงเพชร' => 'ภาคเหนือ', 'เพชรบูรณ์' => 'ภาคเหนือ',
            'นครสวรรค์' => 'ภาคเหนือ', 'อุทัยธานี' => 'ภาคเหนือ',
            'ขอนแก่น' => 'ภาคอีสาน', 'อุดรธานี' => 'ภาคอีสาน', 'นครราชสีมา' => 'ภาคอีสาน',
            'อุบลราชธานี' => 'ภาคอีสาน', 'ศรีสะเกษ' => 'ภาคอีสาน', 'สุรินทร์' => 'ภาคอีสาน',
            'บุรีรัมย์' => 'ภาคอีสาน', 'ร้อยเอ็ด' => 'ภาคอีสาน', 'มหาสารคาม' => 'ภาคอีสาน',
            'กาฬสินธุ์' => 'ภาคอีสาน', 'สกลนคร' => 'ภาคอีสาน', 'นครพนม' => 'ภาคอีสาน',
            'มุกดาหาร' => 'ภาคอีสาน', 'เลย' => 'ภาคอีสาน', 'หนองคาย' => 'ภาคอีสาน',
            'หนองบัวลำภู' => 'ภาคอีสาน', 'ยโสธร' => 'ภาคอีสาน', 'อำนาจเจริญ' => 'ภาคอีสาน',
            'ชัยภูมิ' => 'ภาคอีสาน', 'บึงกาฬ' => 'ภาคอีสาน',
            'ชลบุรี' => 'ภาคตะวันออก', 'ระยอง' => 'ภาคตะวันออก', 'จันทบุรี' => 'ภาคตะวันออก',
            'ตราด' => 'ภาคตะวันออก', 'ปราจีนบุรี' => 'ภาคตะวันออก', 'สระแก้ว' => 'ภาคตะวันออก',
            'ฉะเชิงเทรา' => 'ภาคตะวันออก',
            'ราชบุรี' => 'ภาคตะวันตก', 'กาญจนบุรี' => 'ภาคตะวันตก', 'เพชรบุรี' => 'ภาคตะวันตก',
            'ประจวบคีรีขันธ์' => 'ภาคตะวันตก',
            'ภูเก็ต' => 'ภาคใต้', 'สุราษฎร์ธานี' => 'ภาคใต้', 'สงขลา' => 'ภาคใต้',
            'กระบี่' => 'ภาคใต้', 'นครศรีธรรมราช' => 'ภาคใต้', 'ตรัง' => 'ภาคใต้',
            'พัทลุง' => 'ภาคใต้', 'สตูล' => 'ภาคใต้', 'ชุมพร' => 'ภาคใต้',
            'ระนอง' => 'ภาคใต้', 'พังงา' => 'ภาคใต้', 'ปัตตานี' => 'ภาคใต้',
            'ยะลา' => 'ภาคใต้', 'นราธิวาส' => 'ภาคใต้',
        ];
    }

    public static function getStatusThaiMap(): array {
        return [
            'Pending' => 'รอดำเนินการ', 'Confirmed' => 'ยืนยันแล้ว',
            'Picking' => 'กำลังจัดเตรียม', 'Preparing' => 'กำลังจัดเตรียมสินค้า',
            'Shipping' => 'กำลังจัดส่ง',
            'Delivered' => 'จัดส่งสำเร็จ', 'Cancelled' => 'ยกเลิก',
            'Returned' => 'ตีกลับ', 'Claiming' => 'รอเคลม',
            'BadDebt' => 'หนี้สูญ', 'PreApproved' => 'รออนุมัติ'
        ];
    }

    public static function getCustomerTypeThaiMap(): array {
        return [
            'New Customer' => 'ลูกค้าใหม่',
            'Reorder Customer' => 'ลูกค้ารีออเดอร์',
            'Reorder' => 'ลูกค้ารีออเดอร์'
        ];
    }

    public static function calculateCreatorTotals(array $rows): array {
        $creatorTotals = [];
        $orderGross = [];
        $orderAdjustments = [];
        $orderStatuses = [];

        foreach ($rows as $r) {
            $orderId = $r['order_id'];
            $creatorId = $r['item_creator_id'] ?? $r['creator_id'] ?? '';
            $orderStatuses[$orderId] = $r['order_status'] ?? '';
            
            if (!isset($orderAdjustments[$orderId])) {
                $orderAdjustments[$orderId] = [
                    'shipping_cost' => (float)($r['shipping_cost'] ?? 0),
                    'bill_discount' => (float)($r['bill_discount'] ?? 0)
                ];
            }
            
            $qty = (int)($r['quantity'] ?? 0);
            $price = (float)($r['price_per_unit'] ?? 0);
            $originalDiscount = (float)($r['discount'] ?? 0);
            $netTotal = (float)($r['net_total'] ?? 0);
            
            $isPromoParent = (bool)$r['is_promotion_parent'];
            $isPromoChild = (bool)$r['parent_item_id'];
            $isClaimOrGift = in_array($r['payment_status'] ?? '', ['Claim', 'Gift']);
            $isFreebie = (bool)$r['is_freebie'];
            
            if ($isPromoParent) {
                $itTotal = 0;
            } elseif ($isPromoChild) {
                $itTotal = $netTotal;
            } elseif ($isClaimOrGift) {
                $itTotal = 0;
            } else {
                $calculatedTotal = ($qty * $price) - $originalDiscount;
                $itTotal = $calculatedTotal > 0 ? $calculatedTotal : $netTotal;
            }

            if (!$isFreebie && !$isPromoParent) {
                if (!isset($creatorTotals[$orderId])) $creatorTotals[$orderId] = [];
                if (!isset($creatorTotals[$orderId][$creatorId])) $creatorTotals[$orderId][$creatorId] = 0;
                $creatorTotals[$orderId][$creatorId] += $itTotal;
                
                if (!isset($orderGross[$orderId])) $orderGross[$orderId] = 0;
                $orderGross[$orderId] += $itTotal;
            }
        }
        
        // Second pass: apply proration for shipping cost and bill discount
        foreach ($creatorTotals as $orderId => &$creators) {
            $status = $orderStatuses[$orderId] ?? '';
            if (in_array($status, ['Cancelled', 'Returned'])) {
                foreach ($creators as &$total) {
                    $total = 0;
                }
                continue; // Skip proration for cancelled/returned
            }

            $gross = $orderGross[$orderId] ?? 0;
            $shipping = $orderAdjustments[$orderId]['shipping_cost'] ?? 0;
            $discount = $orderAdjustments[$orderId]['bill_discount'] ?? 0;
            
            if ($shipping == 0 && $discount == 0) {
                continue; // No adjustments needed
            }
            
            if ($gross > 0) {
                foreach ($creators as $creatorId => &$total) {
                    $ratio = $total / $gross;
                    $total = $total + ($shipping * $ratio) - ($discount * $ratio);
                }
            } else {
                // If gross is 0 (e.g. all items free), divide equally
                $creatorCount = count($creators);
                if ($creatorCount > 0) {
                    foreach ($creators as $creatorId => &$total) {
                        $total = $total + ($shipping / $creatorCount) - ($discount / $creatorCount);
                    }
                }
            }
        }

        return $creatorTotals;
    }

    public static function getCsvHeaders(bool $includeCommissionCols = false, bool $includeStampCols = false): array {
        $headers = [
            'วันที่สั่งซื้อ', 'เลขคำสั่งซื้อ', 'user_id', 'ผู้ขาย', 'แผนก',
            'ชื่อลูกค้า', 'เบอร์โทรลูกค้า', 'ประเภทลูกค้า',
            'วันที่จัดส่ง', 'ช่องทางสั่งซื้อ', 'เพจ', 'ช่องทางการชำระ',
            'ที่อยู่', 'ตำบล', 'อำเภอ', 'จังหวัด', 'รหัสไปรษณีย์', 'ภาค',
            'รหัสสินค้า/โปร', 'สินค้า', 'ประเภทสินค้า', 'ประเภทสินค้า (รีพอร์ต)',
            'ชื่อโปร',
            'ของแถม', 'จำนวน (ชิ้น)', 'ราคาต่อหน่วย', 'ส่วนลด', 'ยอดรวมรายการ',
            'ค่าจัดส่ง (ต่อบิล)', 'ส่วนลดท้ายบิล', 'คูปองส่วนลด', 'ยอดรวมทั้งบิล', 'ยอดรวมรายคน',
            'หมายเลขกล่อง', 'หมายเลขติดตาม',
            'วันที่จัดส่ง Airport', 'สถานะจาก Airport',
            'สถานะออเดอร์', 'สถานะการชำระเงิน',
            'สถานะสลิป', 'วันที่รับเงิน', 'ตะกร้าขาย', 'สาเหตุยอดไม่ตรง'
        ];
        
        if ($includeCommissionCols) {
            $headers[] = 'สถานะค่าคอม';
        }

        if ($includeStampCols) {
            $headers = array_merge($headers, [
                'รอบ Stamp', 'ค่าคอม', 'ผู้ได้รับค่าคอม (user_id)', 'วันที่ Stamp', 'หมายเหตุ Stamp'
            ]);
        }
        
        return $headers;
    }

    public static function formatOrderCsvRow(array $row, array $lookups, array &$creatorTotals, array &$seenCreators, array &$seenOrders, bool $includeCommissionCols = false, bool $includeStampCols = false): array {
        $regionMap = self::getRegionMap();
        $statusThai = self::getStatusThaiMap();
        $customerTypeThai = self::getCustomerTypeThaiMap();

        $orderId = $row['order_id'];

        $creatorId = $row['item_creator_id'] ?? $row['creator_id'];
        $creatorName = ($row['item_creator_first_name'] ?? $row['creator_first_name'] ?? '') . ' ' . ($row['item_creator_last_name'] ?? $row['creator_last_name'] ?? '');
        $creatorRole = $row['item_creator_role'] ?? $row['creator_role'] ?? '-';
    
        $customerName = trim(($row['customer_first_name'] ?? '') . ' ' . ($row['customer_last_name'] ?? ''));
        if (!$customerName) $customerName = trim(($row['recipient_first_name'] ?? '') . ' ' . ($row['recipient_last_name'] ?? ''));
    
        $province = $row['province'] ?? '';
        $region = $regionMap[$province] ?? 'ไม่ทราบภาค';
    
        $productCode = '-';
        if ($row['is_promotion_parent']) {
            $productCode = $row['promotion_id'] ? 'PROMO-' . str_pad($row['promotion_id'], 3, '0', STR_PAD_LEFT) : '-';
        } elseif ($row['promotion_id']) {
            $productCode = 'PROMO-' . str_pad($row['promotion_id'], 3, '0', STR_PAD_LEFT);
        } elseif ($row['product_sku']) {
            $productCode = $row['product_sku'];
        }
    
        $productName = $row['product_name'] ?? '-';
        if ($row['is_promotion_parent']) $productName = '📦 ' . $productName;
        elseif ($row['is_freebie']) $productName .= ' (ของแถม)';
    
        // ชื่อโปร
        $promoName = '-';
        if ($row['is_promotion_parent']) {
            $promoName = $row['product_name'] ?? '-';
        } elseif ($row['promotion_id'] && $row['parent_item_id']) {
            $promoName = $row['parent_product_name'] ?? '-';
        }
    
        $qty = (int)($row['quantity'] ?? 0);
        $price = (float)($row['price_per_unit'] ?? 0);
        $originalDiscount = (float)($row['discount'] ?? 0);
        $netTotal = (float)($row['net_total'] ?? 0);
        // Claim/Gift orders: discount = full price
        $isClaimOrGift = in_array($row['payment_status'] ?? '', ['Claim', 'Gift']);
        $discount = $isClaimOrGift ? ($qty * $price) : $originalDiscount;
        $calculatedTotal = ($qty * $price) - $discount;
        $itemTotal = $row['is_freebie'] ? 0 : ($calculatedTotal > 0 ? $calculatedTotal : $netTotal);
    
        $paid = (float)($row['amount_paid'] ?? 0);
        $total = (float)($row['total_amount'] ?? 0);
        $shipping = (float)($row['shipping_cost'] ?? 0);
        $billDiscount = (float)($row['bill_discount'] ?? 0);
        $couponDiscount = (float)($row['coupon_discount'] ?? 0);

        // Force revenue to 0 if cancelled or returned
        $orderStatus = $row['order_status'] ?? '';
        if (in_array($orderStatus, ['Cancelled', 'Returned'])) {
            $itemTotal = 0;
            $total = 0;
            $shipping = 0;
            $billDiscount = 0;
            $couponDiscount = 0;
            // $paid is kept as is because they might have paid before cancelling, though often it's 0.
        }
        $paymentComparison = $total == 0 ? 'ไม่มียอด' : ($paid == 0 ? 'ค้าง' : ($paid == $total ? 'ตรง' : ($paid < $total ? 'ขาด' : 'เกิน')));
    
        $isFirstItem = !isset($seenOrders[$orderId]);
        $seenOrders[$orderId] = true;
        
        $displayCreatorTotal = '-';
        if (!isset($seenCreators[$orderId][$creatorId])) {
            $seenCreators[$orderId][$creatorId] = true;
            $displayCreatorTotal = $creatorTotals[$orderId][$creatorId] ?? 0;
        }
    
        // Lookup supplementary data from batch-fetched maps
        $trackingNumbers = $lookups['tracking'][$orderId] ?? '-';
    
        $slipData = $lookups['slips'][$orderId] ?? null;
        $slipCount = $slipData ? (int)$slipData['slip_count'] : 0;
        $slipTransferDate = $slipData['slip_transfer_date'] ?? null;
        $slipUrl = $row['slip_url'] ?? '';
        if ($slipCount > 0) {
            $slipStatus = "อัปโหลดแล้ว ({$slipCount})";
        } elseif ($slipUrl) {
            $slipStatus = 'อัปโหลดแล้ว';
        } else {
            $slipStatus = 'ยังไม่อัปโหลด';
        }
    
        $codPaymentDate = $lookups['cod'][$orderId] ?? null;
        $codShortageReason = $lookups['cod_shortage'][$orderId] ?? '-';
        $paymentReceivedDate = $slipTransferDate ?? $codPaymentDate ?? null;
    
        $airportData = $lookups['airport'][$orderId] ?? null;
        $airportDeliveryDate = $airportData['delivery_date'] ?? null;
        $airportDeliveryStatus = $airportData['delivery_status'] ?? '-';
    
        // สถานะออเดอร์ — enrich with box return_status for Returned orders
        $orderStatus = $row['order_status'] ?? '';
        $boxNumber = $row['box_number'] ?? 1;
        if ($orderStatus === 'Returned') {
            $boxKey = $orderId . '-' . $boxNumber;
            $returnStatus = $lookups['boxes'][$boxKey] ?? '__NONE__';
            $returnStatusThai = [
                'returning' => 'กำลังตีกลับ', 'returned' => 'สภาพดี',
                'good' => 'สภาพดี', 'damaged' => 'ชำรุด', 'lost' => 'ตีกลับสูญหาย'
            ];
            if ($returnStatus === '__NONE__') {
                $statusText = 'ไม่ถูกตีกลับ';
            } else {
                $statusText = $returnStatusThai[$returnStatus] ?? $returnStatus;
            }
            $orderStatusDisplay = "ตีกลับ (กล่อง {$boxNumber} : {$statusText})";
        } else {
            $orderStatusDisplay = $statusThai[$orderStatus] ?? $orderStatus ?: '-';
        }
    
        $result = [
            $row['order_date'] ? date('d/m/Y', strtotime($row['order_date'])) : '-',
            $orderId,
            $creatorId ?? '',
            trim($creatorName) ?: '-',
            $creatorRole,
            $customerName ?: '-',
            $row['customer_phone'] ?? '-',
            $customerTypeThai[$row['customer_type'] ?? $row['lifecycle_status'] ?? ''] ?? ($row['customer_type'] ?? $row['lifecycle_status'] ?? '-'),
            $row['delivery_date'] ? date('d/m/Y', strtotime($row['delivery_date'])) : '-',
            $row['sales_channel'] ?? '-',
            $row['page_name'] ?? '-',
            $row['payment_method'] ?? '-',
            $row['street'] ?? '-',
            $row['subdistrict'] ?? '-',
            $row['district'] ?? '-',
            $province ?: '-',
            $row['postal_code'] ?? '-',
            $region,
            $productCode,
            $productName,
            $row['product_category'] ?? '-',
            $row['product_report_category'] ?? '-',
            $promoName,
            $row['is_freebie'] ? 'ใช่' : 'ไม่',
            $qty,
            $price,
            $discount,
            $itemTotal,
            $isFirstItem ? $shipping : 0,
            $isFirstItem ? $billDiscount : 0,
            $isFirstItem ? $couponDiscount : 0,
            $isFirstItem ? $total : '-',
            $displayCreatorTotal,
            $row['box_number'] ?? 1,
            $trackingNumbers,
            $airportDeliveryDate ? date('d/m/Y', strtotime($airportDeliveryDate)) : '-',
            $airportDeliveryStatus,
            $orderStatusDisplay,
            $paymentComparison,
            $slipStatus,
            $paymentReceivedDate ? date('d/m/Y', strtotime($paymentReceivedDate)) : '-',
            $row['basket_key_at_sale'] ?? '-',
            $codShortageReason ?: '-',
        ];
    
        if ($includeCommissionCols) {
            $commissionStatus = $row['stamp_commission'] !== null || $row['stamp_user_id'] !== null || $row['stamp_date'] !== null
                ? 'คิดค่าคอมแล้ว'
                : ($row['payment_status'] === 'Approved' ? 'รอคิดค่าคอม' : 'ยังไม่สำเร็จ');
            $result[] = $commissionStatus;
        }

        if ($includeStampCols) {
            $result[] = $row['stamp_batch_name'] ?? '-';
            $result[] = $row['stamp_commission'] ?? '-';
            $result[] = $row['stamp_user_id'] ?? '-';
            $result[] = $row['stamp_date'] ? date('d/m/Y H:i', strtotime($row['stamp_date'])) : '-';
            $result[] = $row['stamp_note'] ?? '-';
        }
    
        return $result;
    }
}
