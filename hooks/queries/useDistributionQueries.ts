import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../services/api';
import { BasketConfig, AgentWithBaskets } from '../../types/distribution';
import { UserRole } from '../../types';

export const useBaskets = (companyId?: number) => {
    return useQuery<BasketConfig[], Error>({
        queryKey: ['baskets', companyId],
        queryFn: async () => {
            const response = await apiFetch(`basket_config.php?target_page=distribution&companyId=${companyId}`);
            return response || [];
        },
        enabled: Boolean(companyId)
    });
};

export const useDashboardBaskets = (companyId?: number) => {
    return useQuery<BasketConfig[], Error>({
        queryKey: ['dashboardBaskets', companyId],
        queryFn: async () => {
            const response = await apiFetch(`basket_config.php?target_page=dashboard_v2&companyId=${companyId}`);
            const customOrder = [
                'upsell_dis',
                'new_customer',
                'personal_1_2m',
                'personal_last_chance',
                'find_new_owner_dash',
                'waiting_for_match_dash',
                'mid_6_12m_dash',
                'mid_1_3y_dash',
                'ancient_dash'
            ];
            const sorted = (response || []).sort((a: BasketConfig, b: BasketConfig) => {
                const indexA = customOrder.indexOf(a.basket_key);
                const indexB = customOrder.indexOf(b.basket_key);
                return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
            });
            return sorted;
        },
        enabled: Boolean(companyId)
    });
};

export const useAgents = (companyId?: number) => {
    return useQuery<AgentWithBaskets[], Error>({
        queryKey: ['agents', companyId],
        queryFn: async () => {
            const response = await apiFetch(`users?companyId=${companyId}`);
            const usersArray = Array.isArray(response) ? response : [];
            const telesales = usersArray
                .filter((u: any) => u.role === UserRole.Telesale || u.role === UserRole.Supervisor)
                .map((u: any) => ({
                    ...u,
                    basketCounts: {},
                    totalCustomers: 0,
                    isActive: true
                }));
            return telesales;
        },
        enabled: Boolean(companyId)
    });
};
