/**
 * Basket utilities for V2 Campaign System
 * Helper functions for basket type determination and transitions
 */

import { BasketType, Customer } from "@/types";
import { getDaysSince } from "./dateUtils";

// Basket configuration (days thresholds)
export const BASKET_CONFIG = {
    UPSELL_HOURS: 24,         // Hours after order to stay in Upsell basket
    MONTH_1_2_DAYS: 60,       // Days threshold for Month 1-2 basket
    MONTH_3_DAYS: 90,         // Days threshold for Month 3 basket
    LAST_CHANCE_DAYS: 120,    // Days threshold for Last Chance basket
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
 * Determine which basket a customer should be in based on last_order_date
 */
export const determineBasketType = (customer: Customer): BasketType => {
    // If not assigned, customer is in Ready pool
    if (!customer.assignedTo) {
        return BasketType.Ready;
    }

    // If no order history, treat as New Customer
    if (!customer.lastOrderDate) {
        return BasketType.NewCustomer;
    }

    const daysSinceLastOrder = getDaysSince(customer.lastOrderDate);

    // Check upsell eligibility (within 24 hours)
    if (customer.isUpsellEligible) {
        return BasketType.Upsell;
    }

    // Determine basket based on days since last order
    if (daysSinceLastOrder <= BASKET_CONFIG.MONTH_1_2_DAYS) {
        return BasketType.Month1_2;
    }

    if (daysSinceLastOrder <= BASKET_CONFIG.MONTH_3_DAYS) {
        return BasketType.Month3;
    }

    if (daysSinceLastOrder <= BASKET_CONFIG.LAST_CHANCE_DAYS) {
        return BasketType.LastChance;
    }

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
        [BasketType.Month3]: "3 เดือน",
        [BasketType.LastChance]: "โอกาสสุดท้าย",
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
