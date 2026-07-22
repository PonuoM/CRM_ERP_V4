import { User, Customer } from '../types';

export interface BasketConfig {
    id: number;
    basket_key: string;
    basket_name: string;
    linked_basket_key?: string | null;
    min_order_count: number | null;
    max_order_count: number | null;
    min_days_since_order: number | null;
    max_days_since_order: number | null;
    is_active: boolean;
}

export interface DistributionPreview {
    agentId: number;
    agentName: string;
    customers: Customer[];
}

export interface AgentWithBaskets extends User {
    basketCounts: Record<string, number>;
    totalCustomers: number;
    isActive: boolean;
    roleId?: number;
    callMinutes?: number;
    supervisorId?: number;
    attendanceValue?: number;
}

export interface ResetCandidate {
    id: number;
    code: string;
    first_name: string;
    last_name: string;
    phone?: string;
    assigned_count: number;
    agent_names?: string;
    selected?: boolean;
}

export interface SummaryStats {
    totalSuccess: number;
    totalFailed: number;
    agentStats: Record<number, { name: string; success: number; failed: number }>;
    missingTotal: number;
}

export interface AssignHistory {
    first_name: string;
    last_name: string;
    created_at: string;
}
