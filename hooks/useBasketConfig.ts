/**
 * useBasketConfig - Hook to fetch dynamic basket configurations from API
 * This allows Basket Settings page to control which baskets appear in Dashboard V2
 */

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/services/api';
import { Customer } from '@/types';
import { getDaysSince } from '@/utils/dateUtils';

export interface DynamicBasketConfig {
    id: number;
    basket_key: string;
    basket_name: string;
    min_order_count: number | null;
    max_order_count: number | null;
    min_days_since_order: number | null;
    max_days_since_order: number | null;
    days_since_first_order: number | null;
    days_since_registered: number | null;
    target_page: 'dashboard_v2' | 'distribution';
    display_order: number;
    is_active: boolean;
    company_id: number;
    // Transition Rules
    on_sale_basket_key?: string | null;
    fail_after_days?: number | null;
    on_fail_basket_key?: string | null;
    max_distribution_count?: number | null;
    hold_days_before_redistribute?: number | null;
    linked_basket_key?: string | null;
}

export interface BasketTab {
    key: string;
    name: string;
    count: number;
    config: DynamicBasketConfig;
}

/**
 * Check if a customer matches a basket config's criteria
 * Rules:
 * - NULL in config means "no restriction" (skip this check)
 * - Customer without order data: skip order-related checks if customer has no orders
 */
export const customerMatchesBasket = (customer: Customer, config: DynamicBasketConfig): boolean => {
    const orderCount = customer.orderCount || 0;
    const daysSinceLastOrder = customer.lastOrderDate ? getDaysSince(customer.lastOrderDate) : null;
    const daysSinceFirstOrder = customer.firstOrderDate ? getDaysSince(customer.firstOrderDate) : null;
    const daysSinceRegistered = customer.dateRegistered ? getDaysSince(customer.dateRegistered) : null;

    // Check min_order_count
    if (config.min_order_count !== null && orderCount < config.min_order_count) {
        return false;
    }

    // Check max_order_count
    if (config.max_order_count !== null && orderCount > config.max_order_count) {
        return false;
    }

    // Only check days_since_order if customer HAS orders (orderCount > 0)
    if (orderCount > 0) {
        // Check min_days_since_order
        if (config.min_days_since_order !== null) {
            if (daysSinceLastOrder === null || daysSinceLastOrder < config.min_days_since_order) {
                return false;
            }
        }

        // Check max_days_since_order
        if (config.max_days_since_order !== null) {
            if (daysSinceLastOrder === null || daysSinceLastOrder > config.max_days_since_order) {
                return false;
            }
        }

        // Check days_since_first_order (max days since first order)
        if (config.days_since_first_order !== null) {
            if (daysSinceFirstOrder === null || daysSinceFirstOrder > config.days_since_first_order) {
                return false;
            }
        }
    }

    // Check days_since_registered (applies to all customers)
    if (config.days_since_registered !== null) {
        if (daysSinceRegistered === null || daysSinceRegistered > config.days_since_registered) {
            return false;
        }
    }

    return true;
};

/**
 * Group customers by dynamic basket configurations
 * Supports both ID-based (legacy) and string-based basket keys
 */
export const groupCustomersByDynamicBaskets = (
    customers: Customer[],
    configs: DynamicBasketConfig[]
): Map<string, Customer[]> => {
    const groups = new Map<string, Customer[]>();

    // Initialize empty arrays for each basket
    configs.forEach(config => {
        groups.set(config.basket_key, []);
    });

    // Create a mapping from ID to basket_key for legacy support
    const idToBasketKeyMap = new Map<number, string>();
    // Also create a mapping from basket_key to config for quick lookup
    const basketKeyToConfigMap = new Map<string, DynamicBasketConfig>();

    configs.forEach(config => {
        // Map ID to basket_key (legacy support)
        idToBasketKeyMap.set(config.id, config.basket_key);
        // Map basket_key to config
        basketKeyToConfigMap.set(config.basket_key, config);
    });

    // Sort configs by display_order to ensure priority (for fallback matching)
    const sortedConfigs = [...configs].sort((a, b) => a.display_order - b.display_order);

    customers.forEach(customer => {
        const currentBasketKey = (customer as any).current_basket_key; // Cast as any because type needs update
        let matched = false;

        if (currentBasketKey !== null && currentBasketKey !== undefined && currentBasketKey !== '') {
            let resolvedBasketKey: string | null = null;

            // Check if currentBasketKey is a number (legacy ID-based system)
            // Handle both string numbers ("38") and actual numbers (38)
            const numericValue = typeof currentBasketKey === 'string' && /^\d+$/.test(currentBasketKey)
                ? Number(currentBasketKey)
                : typeof currentBasketKey === 'number'
                    ? currentBasketKey
                    : null;

            if (numericValue !== null) {
                // First try to look up by ID (legacy behavior)
                resolvedBasketKey = idToBasketKeyMap.get(numericValue) || null;

                // If ID lookup fails, but the numeric value exists as a direct key, use it
                if (!resolvedBasketKey && basketKeyToConfigMap.has(String(currentBasketKey))) {
                    resolvedBasketKey = String(currentBasketKey);
                }
            } else {
                // It's already a string key (non-numeric)
                resolvedBasketKey = String(currentBasketKey);
            }

            if (resolvedBasketKey) {
                // Find config that matches the resolved basket key
                const matchingConfig = basketKeyToConfigMap.get(resolvedBasketKey);

                if (matchingConfig) {
                    const existing = groups.get(matchingConfig.basket_key) || [];
                    existing.push(customer);
                    groups.set(matchingConfig.basket_key, existing);
                    matched = true;
                }
            }
        }

        // Fallback: Use rule-based matching if not matched by key
        // IMPORTANT: Only use fallback if customer has NO current_basket_key
        // If customer has a basket key but it doesn't match any config, don't fallback
        if (!matched && (currentBasketKey === null || currentBasketKey === undefined || currentBasketKey === '')) {
            for (const config of sortedConfigs) {
                if (customerMatchesBasket(customer, config)) {
                    const existing = groups.get(config.basket_key) || [];
                    existing.push(customer);
                    groups.set(config.basket_key, existing);
                    break; // Customer assigned to first matching basket
                }
            }
        }
    });

    return groups;
};

/**
 * Hook to fetch and manage dynamic basket configurations
 */
export const useBasketConfig = (companyId: number | undefined, targetPage: 'dashboard_v2' | 'distribution' = 'dashboard_v2') => {
    const [configs, setConfigs] = useState<DynamicBasketConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchConfigs = useCallback(async () => {
        if (!companyId) return;

        setLoading(true);
        setError(null);

        try {
            const response = await apiFetch(`basket_config.php?companyId=${companyId}&target_page=${targetPage}`);
            const activeConfigs = (response || []).filter((c: DynamicBasketConfig) => c.is_active);

            // Hardcode Upsell Basket for Distribution page
            if (targetPage === 'distribution') {
                const upsellBasket: DynamicBasketConfig = {
                    id: 999999,
                    basket_key: 'upsell',
                    basket_name: 'Upsell',
                    min_order_count: null,
                    max_order_count: null,
                    min_days_since_order: null,
                    max_days_since_order: null,
                    days_since_first_order: null,
                    days_since_registered: null,
                    target_page: 'distribution',
                    display_order: -100, // Ensure it's first
                    is_active: true,
                    company_id: companyId
                };
                activeConfigs.push(upsellBasket);
            }

            setConfigs(activeConfigs.sort((a: DynamicBasketConfig, b: DynamicBasketConfig) => a.display_order - b.display_order));
        } catch (err) {
            console.error('[useBasketConfig] Failed to fetch basket configs:', err);
            setError('Failed to load basket configurations');
            setConfigs([]);
        } finally {
            setLoading(false);
        }
    }, [companyId, targetPage]);

    useEffect(() => {
        fetchConfigs();
    }, [fetchConfigs]);

    return {
        configs,
        loading,
        error,
        refetch: fetchConfigs
    };
};

export default useBasketConfig;
