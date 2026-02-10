/**
 * Basket utilities for V2 Campaign System
 * Helper functions for basket type determination and transitions
 */

import { BasketType, Customer } from "@/types";
import { getDaysSince } from "./dateUtils";

// Basket configuration (days thresholds)
export const BASKET_CONFIG = {
    NEW_CUSTOMER_DAYS: 30,    // Days since first order to be considered "new customer"
    MONTH_1_2_DAYS: 60,       // Days threshold for Month 1-2 basket
    MONTH_3_DAYS_MIN: 61,     // Min days for Month 3 basket (โอกาสสุดท้าย)
    MONTH_3_DAYS_MAX: 90,     // Max days for Month 3 basket
    ARCHIVE_RELEASE_DAYS: 30, // Days in Archive before release to Ready
};

// Thai region mapping for distribution filtering
export const THAI_REGIONS: Record<string, string[]> = {
    "เหนือ": [
        "เชียงใหม่", "เชียงราย", "ลำพูน", "ลำปาง", "แพร่", "น่าน", "พะเยา", "แม่ฮ่องสอน", "อุตรดิตถ์",
    ],
    "อีสาน": [
        "ขอนแก่น", "อุดรธานี", "นครราชสีมา", "อุบลราชธานี", "บุรีรัมย์", "สุรินทร์", "ศรีสะเกษ",
        "ร้อยเอ็ด", "มหาสารคาม", "กาฬสินธุ์", "สกลนคร", "นครพนม", "มุกดาหาร", "ยโสธร", "อำนาจเจริญ",
        "หนองคาย", "หนองบัวลำภู", "เลย", "ชัยภูมิ",
    ],
    "กลาง": [
        "กรุงเทพมหานคร", "นนทบุรี", "ปทุมธานี", "สมุทรปราการ", "นครปฐม", "สมุทรสาคร", "พระนครศรีอยุธยา",
        "อ่างทอง", "ลพบุรี", "สิงห์บุรี", "ชัยนาท", "สระบุรี", "นครนายก", "ปราจีนบุรี", "สระแก้ว",
        "ฉะเชิงเทรา", "ชลบุรี", "ระยอง", "จันทบุรี", "ตราด",
    ],
    "ใต้": [
        "นครศรีธรรมราช", "กระบี่", "พังงา", "ภูเก็ต", "สุราษฎร์ธานี", "ระนอง", "ชุมพร", "สงขลา",
        "สตูล", "ตรัง", "พัทลุง", "ปัตตานี", "ยะลา", "นราธิวาส",
    ],
    "ตะวันตก": [
        "ราชบุรี", "กาญจนบุรี", "สุพรรณบุรี", "สมุทรสงคราม", "เพชรบุรี", "ประจวบคีรีขันธ์", "ตาก",
    ],
};

/**
 * Determine which basket a customer should be in based on new rules:
 * - Upsell: Has Pending order by others - uses isUpsellEligible flag
 * - ลูกค้าใหม่: 
 *   - order_count = 0 AND date_registered within 30 days (ลงทะเบียนใหม่ยังไม่ซื้อ)
 *   - order_count = 1 AND first_order_date within 30 days (ซื้อครั้งแรกภายใน 30 วัน)
 * - 1-2 เดือน: order_count >= 2 AND last_order_date <= 60 days
 * - โอกาสสุดท้าย เดือน 3: order_count >= 2 AND last_order_date 61-90 days
 * - Ready: not assigned
 * - Archive: > 90 days or doesn't fit other categories
 */
export const determineBasketType = (customer: Customer): BasketType => {
    // If not assigned, customer is in Ready pool
    if (!customer.assignedTo) {
        return BasketType.Ready;
    }

    // Check upsell eligibility (same-day order)
    if (customer.isUpsellEligible) {
        return BasketType.Upsell;
    }

    const orderCount = customer.orderCount || 0;
    const firstOrderDate = customer.firstOrderDate;
    const lastOrderDate = customer.lastOrderDate;
    const dateRegistered = customer.dateRegistered;

    // Calculate days since orders
    const daysSinceFirstOrder = firstOrderDate ? getDaysSince(firstOrderDate) : Infinity;
    const daysSinceLastOrder = lastOrderDate ? getDaysSince(lastOrderDate) : Infinity;
    const daysSinceRegistered = dateRegistered ? getDaysSince(dateRegistered) : Infinity;

    // ลูกค้าใหม่ (NEW): order_count = 0 AND date_registered within 30 days
    // (ลงทะเบียนใหม่แต่ยังไม่มี order)
    if (orderCount === 0 && daysSinceRegistered <= BASKET_CONFIG.NEW_CUSTOMER_DAYS) {
        return BasketType.NewCustomer;
    }

    // ลูกค้าใหม่ (FIRST ORDER): order_count = 1 AND first_order_date within 30 days
    if (orderCount === 1 && daysSinceFirstOrder <= BASKET_CONFIG.NEW_CUSTOMER_DAYS) {
        return BasketType.NewCustomer;
    }

    // 1-2 เดือน: order_count >= 2 AND last_order_date <= 60 days
    if (orderCount >= 2 && daysSinceLastOrder <= BASKET_CONFIG.MONTH_1_2_DAYS) {
        return BasketType.Month1_2;
    }

    // โอกาสสุดท้าย เดือน 3: order_count >= 2 AND last_order_date 61-90 days
    if (orderCount >= 2 &&
        daysSinceLastOrder >= BASKET_CONFIG.MONTH_3_DAYS_MIN &&
        daysSinceLastOrder <= BASKET_CONFIG.MONTH_3_DAYS_MAX) {
        return BasketType.Month3;
    }

    // Everything else goes to Archive (> 90 days or doesn't fit criteria)
    // These will be handled by the Distribution page
    return BasketType.Archive;
};

/**
 * Get Thai display name for basket type
 */
export const getBasketDisplayName = (basketType: BasketType): string => {
    const names: Record<BasketType, string> = {
        [BasketType.Upsell]: "Upsell",
        [BasketType.NewCustomer]: "ลูกค้าใหม่",
        [BasketType.Month1_2]: "1-2 เดือน",
        [BasketType.Month3]: "โอกาสสุดท้าย เดือน 3",
        [BasketType.LastChance]: "โอกาสสุดท้าย",  // Reserved for distribution page
        [BasketType.Archive]: "พักรายชื่อ",
        [BasketType.Ready]: "พร้อมแจก",
    };
    return names[basketType] || basketType;
};

/**
 * Get color classes for basket type (Tailwind)
 */
export const getBasketColorClasses = (basketType: BasketType): string => {
    const colors: Record<BasketType, string> = {
        [BasketType.Upsell]: "bg-yellow-100 text-yellow-800 border-yellow-300",
        [BasketType.NewCustomer]: "bg-green-100 text-green-800 border-green-300",
        [BasketType.Month1_2]: "bg-blue-100 text-blue-800 border-blue-300",
        [BasketType.Month3]: "bg-purple-100 text-purple-800 border-purple-300",
        [BasketType.LastChance]: "bg-red-100 text-red-800 border-red-300",
        [BasketType.Archive]: "bg-gray-100 text-gray-800 border-gray-300",
        [BasketType.Ready]: "bg-emerald-100 text-emerald-800 border-emerald-300",
    };
    return colors[basketType] || "bg-gray-100 text-gray-800";
};

/**
 * Get region from province name
 */
export const getRegionFromProvince = (province: string | undefined): string | null => {
    if (!province) return null;
    for (const [region, provinces] of Object.entries(THAI_REGIONS)) {
        if (provinces.includes(province)) {
            return region;
        }
    }
    return null;
};

/**
 * Filter customers by region
 */
export const filterCustomersByRegion = (
    customers: Customer[],
    selectedRegions: string[]
): Customer[] => {
    if (selectedRegions.length === 0) return customers;

    return customers.filter((c) => {
        const region = getRegionFromProvince(c.province);
        return region && selectedRegions.includes(region);
    });
};

/**
 * Group customers by basket type
 */
export const groupCustomersByBasket = (
    customers: Customer[]
): Record<BasketType, Customer[]> => {
    const groups: Record<BasketType, Customer[]> = {
        [BasketType.Upsell]: [],
        [BasketType.NewCustomer]: [],
        [BasketType.Month1_2]: [],
        [BasketType.Month3]: [],
        [BasketType.LastChance]: [],
        [BasketType.Archive]: [],
        [BasketType.Ready]: [],
    };

    customers.forEach((customer) => {
        const basketType = determineBasketType(customer);
        groups[basketType].push(customer);
    });

    return groups;
};
