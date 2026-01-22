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
 */
// Helper to categorize customers into baskets
export const groupCustomersByDynamicBaskets = (
    customers: Customer[],
    configs: DynamicBasketConfig[]
): Map<string, Customer[]> => {
    const groups = new Map<string, Customer[]>();

    // Initialize empty arrays for each basket
    configs.forEach(config => {
        groups.set(config.basket_key, []);
    });

    // Sort configs by display_order to ensure priority (for fallback matching)
    const sortedConfigs = [...configs].sort((a, b) => a.display_order - b.display_order);

    customers.forEach(customer => {
        // [Logic Update] Priority: Check if customer has an explicit 'current_basket_key'
        const currentBasketKey = (customer as any).current_basket_key; // Cast as any because type needs update
        let matched = false;

        if (currentBasketKey) {
            // Find config that matches this key OR has this key as a linked_basket_key
            // Since we are grouping for display (e.g. Dashboard), we look for a config IN THIS LIST matching the customer's key
            const matchingConfig = sortedConfigs.find(c =>
                c.basket_key === currentBasketKey ||
                c.linked_basket_key === currentBasketKey
            );

            if (matchingConfig) {
                const existing = groups.get(matchingConfig.basket_key) || [];
                existing.push(customer);
                groups.set(matchingConfig.basket_key, existing);
                matched = true;
            }
        }

        // Fallback: Use rule-based matching if not matched by key
        if (!matched) {
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
