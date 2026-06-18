import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../services/api';
import { User, Customer, UserRole } from '../types';
import {
    Users, Package, Search, ChevronDown, Check, Loader2, AlertCircle,
    RefreshCw, Eye, Database, ArrowRightLeft, Plus, Trash2, Download, ArrowRight, Filter,
    Zap, Scale, TrendingUp, Minus
} from 'lucide-react';
import UniversalDateRangePicker, { DateRange } from '../components/UniversalDateRangePicker';
import resolveApiBasePath from '../utils/apiBasePath';
import ExportTypeModal from '../components/ExportTypeModal';
import { downloadDataFile } from '../utils/exportUtils';
import { mapCustomerFromApi } from '../utils/customerMapper';
import Spinner from '../components/Spinner';
import BlockedCustomersModal from '../components/BlockedCustomersModal';
import ExcelJS from 'exceljs';

interface CustomerDistributionV2Props {
    currentUser?: User | null;
}

interface BasketConfig {
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

interface DistributionPreview {
    agentId: number;
    agentName: string;
    customers: Customer[];
}

interface AgentWithBaskets extends User {
    basketCounts: Record<string, number>;
    totalCustomers: number;
    isActive: boolean;
    roleId?: number;
    callMinutes?: number;
}

interface ResetCandidate {
    id: number;
    code: string;
    first_name: string;
    last_name: string;
    phone?: string;
    assigned_count: number;
    agent_names?: string;
    selected?: boolean;
}

interface SummaryStats {
    totalSuccess: number;
    totalFailed: number;
    agentStats: Record<number, { name: string; success: number; failed: number }>;
    missingTotal: number;
}

interface AssignHistory {
    first_name: string;
    last_name: string;
    created_at: string;
}

const CustomerDistributionV2: React.FC<CustomerDistributionV2Props> = ({ currentUser }) => {
    // Data
    const [baskets, setBaskets] = useState<BasketConfig[]>([]);
    const [dashboardBaskets, setDashboardBaskets] = useState<BasketConfig[]>([]);
    const [basketCounts, setBasketCounts] = useState<Record<string, number>>({});
    const [activeBasket, setActiveBasket] = useState<string>('');
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [agents, setAgents] = useState<AgentWithBaskets[]>([]);
    const [selectedAgents, setSelectedAgents] = useState<number[]>([]);
    const [targetBasket, setTargetBasket] = useState<string>('');
    const [forceDistributeHolding, setForceDistributeHolding] = useState(false);
    const [distributionExportRange, setDistributionExportRange] = useState<DateRange>({ start: '', end: '' });
    const [isExportTypeModalOpen, setIsExportTypeModalOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // UI state
    const [loading, setLoading] = useState(true);
    const [loadingCustomers, setLoadingCustomers] = useState(false);
    const [loadingAgents, setLoadingAgents] = useState(false);
    const [distributing, setDistributing] = useState(false);
    const [totalToDistribute, setTotalToDistribute] = useState<string>('');
    const [preview, setPreview] = useState<DistributionPreview[]>([]);
    const [showPreview, setShowPreview] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

    // Call Threshold Filter State
    const [callFilterStartDate, setCallFilterStartDate] = useState<string>(
        new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0]
    );
    const [callFilterEndDate, setCallFilterEndDate] = useState<string>(
        new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0]
    );
    const [callDataSource, setCallDataSource] = useState<'db' | 'realtime'>('db');
    const [callThresholdMinutes, setCallThresholdMinutes] = useState<string>('100');
    const [loadingCallMinutes, setLoadingCallMinutes] = useState(false);

    // Distribution Modes State
    type DistributionMode = 'equal' | 'load_balance' | 'performance';
    const [distributionMode, setDistributionMode] = useState<DistributionMode>('equal');
    const [distributeRemainder, setDistributeRemainder] = useState(false);
    const [agentQuotas, setAgentQuotas] = useState<Record<number, string>>({});
    const [previewConflictMap, setPreviewConflictMap] = useState<Record<string, number[]>>({});
    const [previewCustomerPool, setPreviewCustomerPool] = useState<Customer[]>([]);
    const [previewWarning, setPreviewWarning] = useState<string>('');

    // Manual Reset State
    const [resetModalOpen, setResetModalOpen] = useState(false);
    const [resetTargetCount, setResetTargetCount] = useState<string>('');
    const [resetCandidates, setResetCandidates] = useState<ResetCandidate[]>([]);
    const [resetting, setResetting] = useState(false);
    const [findingCandidates, setFindingCandidates] = useState(false);
    const [allResetSelected, setAllResetSelected] = useState(false);
    const [resetPage, setResetPage] = useState(1);
    const [resetTotal, setResetTotal] = useState(0);
    const [resetTotalPages, setResetTotalPages] = useState(1);
    const [resetOptions, setResetOptions] = useState<{ assigned_count: number; customer_count: number }[]>([]);
    const [resetSearchText, setResetSearchText] = useState('');
    const [resetAgentFilter, setResetAgentFilter] = useState<number[]>([]);
    const [resetAgentDropdownOpen, setResetAgentDropdownOpen] = useState(false);
    const [resetAgentMode, setResetAgentMode] = useState<'any' | 'all'>('any');
    const [resetAgentOptions, setResetAgentOptions] = useState<{id: number; first_name: string; last_name: string}[]>([]);
    const RESET_PAGE_SIZE = 50;

    // Blocked Customer Modal State
    const [blockedModalOpen, setBlockedModalOpen] = useState(false);
    const [blockedCustomers, setBlockedCustomers] = useState<any[]>([]);
    const [loadingBlocked, setLoadingBlocked] = useState(false);

    const fetchBlockedCustomers = useCallback(async () => {
        setLoadingBlocked(true);
        try {
            const res = await apiFetch(`get_blocked_customers.php?company_id=${currentUser?.companyId}`);
            if (res?.success) {
                setBlockedCustomers(res.data || []);
            }
        } catch (e) {
            console.error('Failed to fetch blocked customers:', e);
        } finally {
            setLoadingBlocked(false);
        }
    }, [currentUser?.companyId]);

    const handleBlockedBasketClick = () => {
        setBlockedModalOpen(true);
        fetchBlockedCustomers();
    };

    // Summary Modal State
    const [summaryModalOpen, setSummaryModalOpen] = useState(false);
    const [summaryStats, setSummaryStats] = useState<SummaryStats>({
        totalSuccess: 0,
        totalFailed: 0,
        agentStats: {},
        missingTotal: 0
    });

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: React.ReactNode;
        onConfirm: () => void;
        confirmLabel?: string;
        confirmColor?: 'blue' | 'red' | 'orange';
        variant?: 'default' | 'danger' | 'warning';
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { }
    });

    const closeConfirmModal = () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
    };





    // History Modal State
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [historyData, setHistoryData] = useState<AssignHistory[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [viewingCustomer, setViewingCustomer] = useState<{ name: string, code: string } | null>(null);

    const handleViewHistory = async (customer: ResetCandidate) => {
        setViewingCustomer({ name: `${customer.first_name} ${customer.last_name}`, code: customer.code });
        setHistoryModalOpen(true);
        setHistoryLoading(true);
        try {
            const res = await apiFetch(`Distribution/reset.php?action=get_assign_history&companyId=${currentUser?.companyId}&customer_id=${customer.id}`);
            if (res.ok) {
                setHistoryData(res.history || []);
            }
        } catch (e) {
            console.error(e);
            setHistoryData([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    // Fetch basket configurations
    const fetchBaskets = useCallback(async () => {
        try {
            const response = await apiFetch(
                `basket_config.php?target_page=distribution&companyId=${currentUser?.companyId}`
            );
            setBaskets(response || []);

            // Use functional update to avoid dependency on activeBasket
            setActiveBasket(current => {
                if (!current && response?.length > 0) {
                    return response[0].basket_key;
                }
                return current;
                return current;
            });
        } catch (error) {
            console.error('Failed to fetch baskets:', error);
        }
    }, [currentUser?.companyId]);

    // Fetch dashboard basket configurations for agent table
    const fetchDashboardBaskets = useCallback(async () => {
        try {
            const response = await apiFetch(
                `basket_config.php?target_page=dashboard_v2&companyId=${currentUser?.companyId}`
            );
            // Custom sort order as requested
            const customOrder = [
                'upsell_dis', // Basket 53 - Upsell Distribution
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
                // If not in custom order, put at end
                return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
            });
            setDashboardBaskets(sorted);
        } catch (error) {
            console.error('Failed to fetch dashboard baskets:', error);
        }
    }, [currentUser?.companyId]);

    // Fetch Reset Options (Summary)
    const fetchResetOptions = useCallback(async () => {
        if (!resetModalOpen) return;
        try {
            const res = await apiFetch(`Distribution/reset.php?action=get_reset_summary&companyId=${currentUser?.companyId}`);
            if (res.ok) {
                setResetOptions(res.summary || []);
            }
        } catch (e) {
            console.error("Failed to fetch reset summary", e);
        }
    }, [resetModalOpen, currentUser?.companyId]);

    // Fetch agents for reset filter dropdown
    const fetchResetAgents = useCallback(async () => {
        if (!resetModalOpen) return;
        try {
            const res = await apiFetch(`Distribution/reset.php?action=get_agents_in_checks&companyId=${currentUser?.companyId}`);
            if (res.ok) {
                setResetAgentOptions(res.agents || []);
            }
        } catch (e) {
            console.error('Failed to fetch reset agents', e);
        }
    }, [resetModalOpen, currentUser?.companyId]);

    useEffect(() => {
        fetchResetOptions();
        fetchResetAgents();
    }, [fetchResetOptions, fetchResetAgents]);

    // Auto-set target basket for Upsell Distribution
    useEffect(() => {
        setForceDistributeHolding(false);
        if (activeBasket === 'upsell_dis') {
            // Basket 53 (upsell_dis) targets basket 51 (upsell) on distribution
            // This is handled by backend logic in basket_config.php
            setTargetBasket('');
        } else {
            setTargetBasket('');
        }
    }, [activeBasket]);

    // Fetch all basket counts
    const fetchAllBasketCounts = useCallback(async () => {
        if (baskets.length === 0) return;

        const counts: Record<string, number> = {};
        await Promise.all(baskets.map(async (basket) => {
            try {
                if (basket.basket_key === 'block_customer') {
                    // Blocked customers use separate API (basket_customers filters is_blocked=0)
                    const res = await apiFetch(`get_blocked_customers.php?company_id=${currentUser?.companyId}`);
                    counts[basket.basket_key] = res?.success ? (res.data?.length || 0) : 0;
                } else {
                    const response = await apiFetch(
                        `basket_config.php?action=basket_customers&basket_key=${basket.basket_key}&companyId=${currentUser?.companyId}&limit=1`
                    );
                    counts[basket.basket_key] = response?.count || 0;
                }
            } catch {
                counts[basket.basket_key] = 0;
            }
        }));
        setBasketCounts(counts);
    }, [baskets, currentUser?.companyId]);

    // Fetch telesale agents with their basket holdings
    const fetchAgents = useCallback(async () => {
        setLoadingAgents(true);
        try {
            const response = await apiFetch(`users?companyId=${currentUser?.companyId}`);
            const usersArray = Array.isArray(response) ? response : [];
            const telesales = usersArray
                .filter((u: any) => u.role === UserRole.Telesale || u.role === UserRole.Supervisor)
                .map((u: any) => ({
                    id: u.id || u.user_id,
                    firstName: u.firstName || u.first_name || '',
                    lastName: u.lastName || u.last_name || '',
                    status: u.status || 'active',
                    isActive: (u.status || 'active') === 'active',
                    role: u.role,
                    roleId: u.role_id || u.roleId || (u.role === UserRole.Supervisor ? 7 : 6), // Fallback if missing
                    companyId: u.companyId || u.company_id,
                    username: u.username,
                    phone: u.phone,
                    customTags: u.customTags || [],
                    basketCounts: {},
                    totalCustomers: 0,
                })) as AgentWithBaskets[];

            if (telesales.length > 0) {
                try {
                    const agentIds = telesales.map(a => a.id).join(',');
                    const countRes = await apiFetch(
                        `customers?action=count_by_baskets&assignedTo=${agentIds}&companyId=${currentUser?.companyId}`
                    );

                    if (countRes?.agents) {
                        telesales.forEach(agent => {
                            const stats = countRes.agents[agent.id];
                            if (stats) {
                                agent.basketCounts = stats.baskets || {};
                                agent.totalCustomers = stats.total || 0;
                            }
                        });
                    }
                } catch (error) {
                    console.error('Failed to fetch basket counts:', error);
                    // Keep empty counts on error
                }
            }

            // Filter: Active agents always shown, Inactive only if they still have customers
            const filtered = telesales.filter(agent => {
                return agent.isActive || agent.totalCustomers > 0;
            });

            setAgents(filtered);
        } catch (error) {
            console.error('Failed to fetch agents:', error);
        } finally {
            setLoadingAgents(false);
        }
    }, [currentUser?.companyId]);

    // Fetch call minutes dynamically
    const fetchCallMinutes = useCallback(async () => {
        if (!agents || agents.length === 0) return;
        
        setLoadingCallMinutes(true);
        try {
            const agentIds = agents.map(a => a.id).join(',');
            const actionEndpoint = callDataSource === 'realtime' ? 'get_realtime_call_minutes' : 'get_call_minutes';
            
            const response = await apiFetch(
                `customers?action=${actionEndpoint}&assignedTo=${agentIds}&companyId=${currentUser?.companyId}&start_date=${callFilterStartDate}&end_date=${callFilterEndDate}`
            );
            
            if (response?.agents) {
                setAgents(prev => prev.map(agent => ({
                    ...agent,
                    callMinutes: response.agents[agent.id] || 0
                })));
            } else if (response?.error) {
                setMessage({ type: 'error', text: response.error });
            }
        } catch (error: any) {
            console.error('Failed to fetch call minutes:', error);
            setMessage({ type: 'error', text: `Failed to fetch call minutes: ${error.message}` });
        } finally {
            setLoadingCallMinutes(false);
        }
    }, [agents.length, callFilterStartDate, callFilterEndDate, currentUser?.companyId, callDataSource]);

    // Effect to trigger fetchCallMinutes when dates change or agents are loaded
    useEffect(() => {
        if (agents.length > 0) {
            fetchCallMinutes();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [callFilterStartDate, callFilterEndDate, agents.length, callDataSource]);

    // Fetch customers for active basket
    const fetchCustomers = useCallback(async () => {
        if (!activeBasket) return;

        setLoadingCustomers(true);
        try {
            const response = await apiFetch(
                `basket_config.php?action=basket_customers&basket_key=${activeBasket}&companyId=${currentUser?.companyId}&limit=5000`
            );
            const data = response?.data || [];
            const mapped = data.map((r: any) => mapCustomerFromApi(r));
            setCustomers(mapped);
            if (activeBasket) {
                setBasketCounts(prev => ({ ...prev, [activeBasket]: response?.count || mapped.length }));
            }
        } catch (error) {
            console.error('Failed to fetch customers:', error);
            setCustomers([]);
        } finally {
            setLoadingCustomers(false);
        }
    }, [activeBasket, currentUser?.companyId]);

    // Initial load
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await Promise.all([fetchBaskets(), fetchDashboardBaskets(), fetchAgents()]);
            setLoading(false);
        };
        if (currentUser?.companyId) {
            init();
        }
    }, [currentUser?.companyId, fetchBaskets, fetchDashboardBaskets, fetchAgents]);

    // Fetch counts when baskets are loaded
    useEffect(() => {
        if (baskets.length > 0) {
            fetchAllBasketCounts();
        }
    }, [baskets, fetchAllBasketCounts]);

    // Fetch customers when basket changes
    useEffect(() => {
        if (activeBasket && baskets.length > 0) {
            fetchCustomers();
        }
    }, [activeBasket, baskets, fetchCustomers]);

    // Available customers count
    const availableCount = basketCounts[activeBasket] || 0;
    const totalInAllBaskets = Object.values(basketCounts).reduce((a, b) => a + b, 0);

    // Auto-calculate quotas when mode, total, or agents change
    useEffect(() => {
        if (selectedAgents.length === 0) {
            setAgentQuotas({});
            return;
        }

        const total = parseInt(totalToDistribute) || 0;
        if (total <= 0) {
            const zeros: Record<number, string> = {};
            selectedAgents.forEach(id => zeros[id] = '0');
            setAgentQuotas(zeros);
            return;
        }

        const newQuotas: Record<number, number> = {};
        selectedAgents.forEach(id => newQuotas[id] = 0);
        let remainder = total;

        if (distributionMode === 'equal') {
            const base = Math.floor(total / selectedAgents.length);
            selectedAgents.forEach(id => newQuotas[id] = base);
            remainder = total - (base * selectedAgents.length);

            if (distributeRemainder && remainder > 0) {
                for (let i = 0; i < selectedAgents.length && remainder > 0; i++) {
                    newQuotas[selectedAgents[i]]++;
                    remainder--;
                }
            }
        } else if (distributionMode === 'load_balance') {
            const currentLoads: Record<number, number> = {};
            selectedAgents.forEach(id => {
                currentLoads[id] = agents.find(ag => ag.id === id)?.totalCustomers || 0;
            });

            for (let i = 0; i < total; i++) {
                let minLoad = Infinity;
                let minAgentId = selectedAgents[0];
                for (const id of selectedAgents) {
                    if (currentLoads[id] < minLoad) {
                        minLoad = currentLoads[id];
                        minAgentId = id;
                    }
                }
                newQuotas[minAgentId]++;
                currentLoads[minAgentId]++;
            }
        } else if (distributionMode === 'performance') {
            const stats: Record<number, number> = {};
            let totalCallMinutes = 0;
            selectedAgents.forEach(id => {
                const mins = agents.find(ag => ag.id === id)?.callMinutes || 0;
                stats[id] = mins > 0 ? mins : 0;
                totalCallMinutes += stats[id];
            });

            if (totalCallMinutes === 0) {
                // Fallback to equal
                const base = Math.floor(total / selectedAgents.length);
                selectedAgents.forEach(id => newQuotas[id] = base);
                remainder = total - (base * selectedAgents.length);
                if (distributeRemainder && remainder > 0) {
                    for (let i = 0; i < selectedAgents.length && remainder > 0; i++) {
                        newQuotas[selectedAgents[i]]++;
                        remainder--;
                    }
                }
            } else {
                selectedAgents.forEach(id => {
                    const share = Math.floor((stats[id] / totalCallMinutes) * total);
                    newQuotas[id] = share;
                    remainder -= share;
                });

                if (remainder > 0) {
                    const sortedAgents = [...selectedAgents].sort((a, b) => stats[b] - stats[a]);
                    for (let i = 0; i < selectedAgents.length && remainder > 0; i++) {
                        newQuotas[sortedAgents[i]]++;
                        remainder--;
                    }
                }
            }
        }

        const quotasStr: Record<number, string> = {};
        for (const id in newQuotas) {
            quotasStr[id] = newQuotas[id].toString();
        }
        setAgentQuotas(quotasStr);

    }, [distributionMode, distributeRemainder, totalToDistribute, selectedAgents.length]);

    // Toggle agent selection
    const toggleAgent = (agentId: number) => {
        setSelectedAgents(prev =>
            prev.includes(agentId)
                ? prev.filter(id => id !== agentId)
                : [...prev, agentId]
        );
    };

    // Select all agents (only active ones)
    const activeAgents = agents.filter(a => a.isActive);
    const selectAllAgents = () => {
        const activeIds = activeAgents.map(a => a.id);
        const allActiveSelected = activeIds.every(id => selectedAgents.includes(id));
        if (allActiveSelected) {
            // Uncheck all active agents, keep any manually selected inactive agents
            setSelectedAgents(prev => prev.filter(id => !activeIds.includes(id)));
        } else {
            // Select all active agents + keep any manually selected inactive agents
            setSelectedAgents(prev => [...new Set([...prev, ...activeIds])]);
        }
    };

    // Generate preview with Conflict-Aware Smart Allocation
    // Fetches real conflict data from customer_assign_check, then uses
    // Most-Constrained-First + greedy agent selection to minimize duplicates
    const handlePreparePreview = async () => {
        if (selectedAgents.length === 0) {
            setMessage({ type: 'error', text: 'กรุณาเลือกพนักงานอย่างน้อย 1 คน' });
            return;
        }
        if (availableCount === 0) {
            setMessage({ type: 'error', text: 'ไม่มีลูกค้าพร้อมแจกในถังนี้' });
            return;
        }

        const total = parseInt(totalToDistribute) || 0;
        
        if (total <= 0) {
            setMessage({ type: 'error', text: 'กรุณาระบุจำนวนรายชื่อรวมที่ต้องการแจก' });
            return;
        }

        const customerPool = [...customers];

        // ═══════════════════════════════════════════
        // 1. Fetch conflict data from backend
        // ═══════════════════════════════════════════
        let conflictMap: Record<string, number[]> = {};
        try {
            const customerIds = customerPool
                .map(c => c.customer_id?.toString() || c.id)
                .slice(0, 5000); // limit to 5000

            if (customerIds.length > 0) {
                const res = await apiFetch(
                    `Distribution/index.php?action=get_assign_checks&companyId=${currentUser?.companyId}`,
                    {
                        method: 'POST',
                        body: JSON.stringify({ customer_ids: customerIds })
                    }
                );
                if (res?.ok && res.conflicts) {
                    conflictMap = res.conflicts;
                }
            }
        } catch (e) {
            console.warn('[Distribution] Failed to fetch conflict data, falling back to previous_assigned_to', e);
        }

        setPreviewConflictMap(conflictMap);
        setPreviewCustomerPool(customerPool);
        setShowPreview(true);
    };

    // Auto-generate preview when quotas or modal state changes
    useEffect(() => {
        if (!showPreview || previewCustomerPool.length === 0) return;

        // Helper: get conflict agents for a customer (merge backend + local data)
        const getConflictAgents = (customer: Customer): number[] => {
            const cid = customer.customer_id?.toString() || customer.id;
            const backendConflicts = previewConflictMap[cid] || [];
            const prev = customer.previous_assigned_to;
            let localConflicts: number[] = [];
            if (prev) {
                if (Array.isArray(prev)) localConflicts = prev;
                else if (typeof prev === 'string') {
                    try { localConflicts = JSON.parse(prev) || []; } catch { /* ignore */ }
                }
            }
            return [...new Set([...backendConflicts, ...localConflicts])];
        };

        // ═══════════════════════════════════════════
        // 2. Sort customers: Most Constrained First
        // ═══════════════════════════════════════════
        const selectedSet = new Set(selectedAgents);
        const pool = [...previewCustomerPool];
        pool.sort((a, b) => {
            const conflictsA = getConflictAgents(a).filter(id => selectedSet.has(id)).length;
            const conflictsB = getConflictAgents(b).filter(id => selectedSet.has(id)).length;
            return conflictsB - conflictsA; // more conflicts first
        });

        // ═══════════════════════════════════════════
        // 3. Greedy Assignment
        // ═══════════════════════════════════════════
        const quota: Record<number, number> = {};
        const assigned: Record<number, Customer[]> = {};
        selectedAgents.forEach(id => {
            quota[id] = parseInt(agentQuotas[id]) || 0;
            assigned[id] = [];
        });
        const usedCustomers = new Set<string>();

        // Pass 1: Assign without conflicts
        for (const customer of pool) {
            const cid = customer.customer_id?.toString() || customer.id;
            if (usedCustomers.has(cid)) continue;

            const conflicts = getConflictAgents(customer);
            const conflictSet = new Set(conflicts);

            const bestAgent = selectedAgents
                .filter(id => quota[id] > 0 && !conflictSet.has(id))
                .sort((a, b) => assigned[a].length - assigned[b].length)[0];

            if (bestAgent !== undefined) {
                assigned[bestAgent].push(customer);
                quota[bestAgent]--;
                usedCustomers.add(cid);
            }

            if (selectedAgents.every(id => quota[id] <= 0)) break;
        }

        // Pass 2: Fallback — fill remaining quotas (allow conflicts)
        for (const customer of pool) {
            if (selectedAgents.every(id => quota[id] <= 0)) break;

            const cid = customer.customer_id?.toString() || customer.id;
            if (usedCustomers.has(cid)) continue;

            const fallbackAgent = selectedAgents
                .filter(id => quota[id] > 0)
                .sort((a, b) => quota[b] - quota[a])[0];

            if (fallbackAgent !== undefined) {
                assigned[fallbackAgent].push(customer);
                quota[fallbackAgent]--;
                usedCustomers.add(cid);
            }
        }

        // ═══════════════════════════════════════════
        // 4. Build preview
        // ═══════════════════════════════════════════
        const previewData: DistributionPreview[] = selectedAgents.map(agentId => {
            const agent = agents.find(a => a.id === agentId);
            return {
                agentId,
                agentName: agent ? `${agent.firstName} ${agent.lastName}` : `Agent ${agentId}`,
                customers: assigned[agentId] || []
            };
        });

        setPreview(previewData);
        
        const shortfall = previewData.filter(p => p.customers.length < (parseInt(agentQuotas[p.agentId]) || 0));
        if (shortfall.length > 0) {
            const names = shortfall.map(p => `${p.agentName} (${p.customers.length}/${parseInt(agentQuotas[p.agentId]) || 0})`).join(', ');
            setPreviewWarning(`⚠️ ได้รับลูกค้าน้อยกว่าโควตาที่ตั้งไว้ (อาจเพราะจำนวนรายชื่อมีจำกัด หรือติดเงื่อนไขรายชื่อซ้ำ): ${names}`);
        } else {
            setPreviewWarning('');
        }
    }, [agentQuotas, previewCustomerPool, previewConflictMap, showPreview, selectedAgents, agents]);



    const handleExportSummary = async () => {
        // Prepare list of all active Telesales/Supervisors
        let targetAgents = agents.filter(a => a.isActive);

        // Sort by roleId (6 then 7), then agent id asc
        targetAgents.sort((a, b) => {
            const rA = a.roleId || 99;
            const rB = b.roleId || 99;
            if (rA !== rB) return rA - rB;
            return a.id - b.id;
        });

        const passedAgents = targetAgents.filter(a => selectedAgents.includes(a.id));
        const failedAgents = targetAgents.filter(a => !selectedAgents.includes(a.id));
        const receivedAgents = targetAgents.filter(a => (summaryStats.agentStats[a.id]?.success || 0) > 0);

        const maxRows = Math.max(targetAgents.length, passedAgents.length, failedAgents.length, receivedAgents.length);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Summary');

        // Column widths
        worksheet.columns = [
            { width: 10 }, // A
            { width: 25 }, // B
            { width: 22 }, // C
            { width: 20 }, // D (Call Time)
            { width: 25 }, // E
            { width: 20 }, // F
            { width: 4 },  // G (spacer)
            { width: 25 }, // H
            { width: 4 },  // I (spacer)
            { width: 25 }, // J
            { width: 4 },  // K (spacer)
            { width: 25 }, // L
            { width: 20 }  // M
        ];

        // Row 1: Titles
        const row1 = worksheet.addRow(["ตารางหลัก", "", "", "", "", "", "", "เข้าเกณฑ์", "", "ไม่เข้าเกณฑ์", "", "พนักงาน/รายชื่อ", ""]);
        row1.font = { bold: true };
        row1.alignment = { horizontal: 'center' };
        worksheet.mergeCells('A1:F1');
        worksheet.mergeCells('L1:M1');

        // Row 2: Headers
        const row2 = worksheet.addRow([
            "Agent ID", "ชื่อพนักงาน", "ตำแหน่ง", "เวลาโทร", "สถานะ", "จำนวนที่ได้รับรายชื่อ", "", 
            "ชื่อพนักงาน", "", "ชื่อพนักงาน", "", "ชื่อพนักงาน", "จำนวนที่ได้รับรายชื่อ"
        ]);

        const headerFills = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
        const headerFont = { color: { argb: 'FFFFFFFF' }, bold: true };
        const borderThin = { style: 'thin' };
        const allBorders = { top: borderThin, left: borderThin, bottom: borderThin, right: borderThin };

        const styledCols = [1, 2, 3, 4, 5, 6, 8, 10, 12, 13]; // 1-based index
        styledCols.forEach(col => {
            const cell = row2.getCell(col);
            cell.fill = headerFills as any;
            cell.font = headerFont;
            cell.border = allBorders as any;
        });

        // Rows 3..N
        for (let i = 0; i < maxRows; i++) {
            const a = targetAgents[i];
            let col1 = "", col2 = "", col3 = "", col4 = "", col5 = "", col6: number | string = "";
            if (a) {
                const stat = summaryStats.agentStats[a.id];
                const received = stat ? stat.success : 0;
                let status = '';
                if (received > 0) {
                    status = 'ได้รับรายชื่อ';
                } else {
                    if (selectedAgents.includes(a.id)) {
                        status = 'เข้าเกณฑ์แต่รายชื่อไม่พอ';
                    } else {
                        status = 'หลุดเกณฑ์';
                    }
                }
                
                let timeStr = "-";
                if (a.callMinutes !== undefined) {
                    const totalSecs = Math.round(a.callMinutes * 60);
                    const m = Math.floor(totalSecs / 60);
                    const s = totalSecs % 60;
                    timeStr = `${m} นาที ${s} วินาที`;
                }

                col1 = a.id.toString();
                col2 = `${a.firstName} ${a.lastName}`;
                col3 = a.role === UserRole.Supervisor ? 'Supervisor Telesale' : (a.role === UserRole.Telesale ? 'Telesale' : (a.role || '-'));
                col4 = timeStr;
                col5 = status;
                col6 = received;
            }

            const p = passedAgents[i];
            const col8 = p ? `${p.firstName} ${p.lastName}` : "";

            const f = failedAgents[i];
            const col10 = f ? `${f.firstName} ${f.lastName}` : "";

            const r = receivedAgents[i];
            let col12 = "", col13: number | string = "";
            if (r) {
                const stat = summaryStats.agentStats[r.id];
                col12 = `${r.firstName} ${r.lastName}`;
                col13 = stat ? stat.success : 0;
            }

            const row = worksheet.addRow([col1, col2, col3, col4, col5, col6, "", col8, "", col10, "", col12, col13]);
            
            // Add borders to cells with data
            if (a) {
                [1, 2, 3, 4, 5, 6].forEach(c => row.getCell(c).border = allBorders as any);
            }
            if (p) {
                row.getCell(8).border = allBorders as any;
            }
            if (f) {
                row.getCell(10).border = allBorders as any;
            }
            if (r) {
                [12, 13].forEach(c => row.getCell(c).border = allBorders as any);
            }
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Distribution_Summary_${new Date().toISOString().split('T')[0]}.xlsx`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Close Summary Modal & Cleanup
    const closeSummaryModal = () => {
        setSummaryModalOpen(false);
        setSummaryStats({
            totalSuccess: 0,
            totalFailed: 0,
            agentStats: {},
            missingTotal: 0
        });

        // Cleanup functions
        setShowPreview(false);
        setPreview([]);
        setSelectedAgents([]);
        fetchCustomers();
        fetchAllBasketCounts();
        fetchAgents();
    };

    // Distribute More (Retry Loop)
    const handleDistributeMore = async () => {
        if (summaryStats.missingTotal <= 0) return;

        try {
            // Calculate skip based on total failed so far (assuming we skip the bad ones)
            const skipCount = summaryStats.totalFailed;

            // Identify needy agents
            const needyAgents: number[] = [];

            selectedAgents.forEach(agentId => {
                const currentSuccess = summaryStats.agentStats[agentId]?.success || 0;
                const expected = parseInt(agentQuotas[agentId]) || 0;
                if (currentSuccess < expected) {
                    // Add agent to list multiple times for each missing slot
                    for (let i = 0; i < (expected - currentSuccess); i++) {
                        needyAgents.push(agentId);
                    }
                }
            });

            if (needyAgents.length === 0) {
                setMessage({ type: 'warning', text: 'โควต้าครบแล้ว' });
                return;
            }

            // Fetch
            const fetchResult = await apiFetch(`basket_config.php?action=basket_customers&basket_key=${activeBasket}&companyId=${currentUser?.companyId}&limit=${needyAgents.length}&skip=${skipCount}`);

            const newCandidates = fetchResult?.data || [];
            if (newCandidates.length === 0) {
                setMessage({ type: 'warning', text: 'ไม่พบรายชื่อเพิ่มเติมในระบบ' });
                return;
            }

            // Map
            const newAssignments: { customer_id: string | number; agent_id: number }[] = [];
            for (let i = 0; i < newCandidates.length; i++) {
                if (i < needyAgents.length) {
                    newAssignments.push({
                        customer_id: newCandidates[i].customer_id,
                        agent_id: needyAgents[i]
                    });
                }
            }

            if (newAssignments.length > 0) {
                await handleExecuteDistribution(newAssignments, true);
            }

        } catch (e) {
            console.error(e);
            setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการแจกเพิ่ม' });
        }
    };

    // Execute distribution
    const handleExecuteDistribution = async (
        assignmentsToUse: { customer_id: string | number; agent_id: number }[] = [],
        isRetry = false
    ) => {
        setDistributing(true);
        try {
            // Use provided assignments or build from preview
            let assignments = assignmentsToUse;
            if (assignments.length === 0 && !isRetry) {
                for (const item of preview) {
                    for (const customer of item.customers) {
                        assignments.push({
                            customer_id: customer.id,
                            agent_id: item.agentId
                        });
                    }
                }
            }

            const result = await apiFetch(
                `Distribution/index.php?action=distribute&companyId=${currentUser?.companyId}`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        assignments,
                        source_basket_key: activeBasket,
                        target_basket_key: targetBasket || undefined,
                        triggered_by: (currentUser as any)?.id
                    })
                }
            );

            // Handle Response
            const totalSuccess = result?.total_success || 0;
            const totalFailed = result?.total_failed || 0;
            const agentStatsResponse = result?.agent_stats || {};

            // Update Summary Stats
            setSummaryStats(prev => {
                const newStats = isRetry ? { ...prev } : {
                    totalSuccess: 0,
                    totalFailed: 0,
                    agentStats: {},
                    missingTotal: 0
                };

                newStats.totalSuccess += totalSuccess;
                newStats.totalFailed += totalFailed;

                // Init/Update Agent Stats
                assignments.forEach(a => {
                    if (!newStats.agentStats[a.agent_id]) {
                        const agent = agents.find(ag => ag.id === a.agent_id);
                        newStats.agentStats[a.agent_id] = {
                            name: agent ? `${agent.firstName} ${agent.lastName}` : `Agent ${a.agent_id}`,
                            success: 0,
                            failed: 0
                        };
                    }
                    // We assume attempt = fail first, effectively counting "Attempts"
                    newStats.agentStats[a.agent_id].failed++;
                });

                // Correct with Success counts
                Object.entries(agentStatsResponse).forEach(([idStr, successCount]) => {
                    const id = parseInt(idStr);
                    if (newStats.agentStats[id]) {
                        const sc = successCount as number;
                        newStats.agentStats[id].success += sc;
                        newStats.agentStats[id].failed -= sc; // Convert attempt to success
                    }
                });

                // Calculate Missing
                const expectedPerAgent = selectedAgents.length > 0 ? Math.floor((parseInt(totalToDistribute) || 0) / selectedAgents.length) : 0;
                let missing = 0;
                if (expectedPerAgent > 0) {
                    selectedAgents.forEach(id => {
                        const current = newStats.agentStats[id]?.success || 0;
                        if (current < expectedPerAgent) {
                            missing += (expectedPerAgent - current);
                        }
                    });
                }
                newStats.missingTotal = missing;

                return newStats;
            });

            setMessage({ type: 'success', text: isRetry ? `แจกเพิ่มสำเร็จ ${totalSuccess} รายการ` : `แจกงานสำเร็จ ${totalSuccess} รายการ` });
            setSummaryModalOpen(true);

        } catch (error) {
            console.error('Distribution failed:', error);
            setMessage({ type: 'error', text: 'แจกงานไม่สำเร็จ' });
        } finally {
            setDistributing(false);
        }
    };

    // Manual Reset Functions
    // Manual Reset Functions
    const handleCheckCandidates = async (page = 1) => {
        if (!resetTargetCount) return;
        setFindingCandidates(true);
        setResetCandidates([]);
        setAllResetSelected(false);
        setResetPage(page);

        try {
            let url = `Distribution/reset.php?action=get_candidates&target_count=${resetTargetCount}&companyId=${currentUser?.companyId}&page=${page}&limit=${RESET_PAGE_SIZE}`;
            if (resetSearchText.trim()) {
                url += `&search=${encodeURIComponent(resetSearchText.trim())}`;
            }
            if (resetAgentFilter.length > 0) {
                url += `&agent_ids=${resetAgentFilter.join(',')}&agent_mode=${resetAgentMode}`;
            }
            const res = await apiFetch(url);
            if (res?.ok) {
                const candidates = (res.candidates || []).map((c: any) => ({ ...c, selected: false }));
                setResetCandidates(candidates);
                setResetTotal(res.total || 0);
                setResetTotalPages(res.total_pages || 1);

                if (candidates.length === 0 && page === 1) {
                    setMessage({ type: 'warning', text: `ไม่พบลูกค้าที่ตรงเงื่อนไข` });
                }
            }
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการค้นหา' });
        } finally {
            setFindingCandidates(false);
            setAllResetSelected(false);
        }
    };

    const changeResetPage = (newPage: number) => {
        if (newPage >= 1 && newPage <= resetTotalPages) {
            handleCheckCandidates(newPage);
        }
    };

    const toggleResetCandidate = (id: number) => {
        setResetCandidates(prev => prev.map(c =>
            c.id === id ? { ...c, selected: !c.selected } : c
        ));
    };

    const toggleAllResetCandidates = () => {
        const newValue = !allResetSelected;
        setAllResetSelected(newValue);
        setResetCandidates(prev => prev.map(c => ({ ...c, selected: newValue })));
    };

    const executeManualReset = async (payload: any, mode: 'selected' | 'all') => {
        setResetting(true);
        try {
            const res = await apiFetch(`Distribution/reset.php?action=manual_reset&companyId=${currentUser?.companyId}`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (res?.ok) {
                setMessage({ type: 'success', text: `Reset สำเร็จ ${res.total_reset} รายการ` });
                if (mode === 'all') {
                    setResetModalOpen(false);
                    setResetCandidates([]);
                    setResetTargetCount('');
                } else {
                    // Refresh current page
                    handleCheckCandidates(resetPage);
                }
            }
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Reset ไม่สำเร็จ' });
        } finally {
            setResetting(false);
            closeConfirmModal();
        }
    };

    const handleManualReset = (mode: 'selected' | 'all' = 'selected') => {
        let payload: any = {
            mode,
            triggered_by: (currentUser as any)?.id,
            companyId: currentUser?.companyId
        };

        if (mode === 'selected') {
            const selected = resetCandidates.filter(c => c.selected);
            if (selected.length === 0) return;

            payload.customer_ids = selected.map(c => c.id);

            setConfirmModal({
                isOpen: true,
                title: 'ยืนยันการ Reset รอบแจก',
                message: (
                    <div>
                        <p>ยืนยันการ Reset สำหรับลูกค้าที่เลือก <span className="font-bold text-red-600">{selected.length}</span> คน?</p>
                        <p className="text-sm text-gray-500 mt-2">ข้อมูลการแจกในรอบปัจจุบันจะถูกลบ และเริ่มนับรอบใหม่</p>
                    </div>
                ),
                confirmLabel: 'ยืนยัน Reset',
                confirmColor: 'orange',
                onConfirm: () => executeManualReset(payload, mode)
            });

        } else {
            if (!resetTargetCount || resetTotal === 0) return;

            payload.target_count = resetTargetCount;

            setConfirmModal({
                isOpen: true,
                title: '⚠️ ยืนยัน Reset ทั้งหมด',
                variant: 'danger',
                message: (
                    <div className="space-y-3">
                        <p className="font-semibold text-red-700">คำเตือน: การกระทำนี้ไม่สามารถย้อนกลับได้</p>
                        <p>คุณกำลังจะ Reset ลูกค้าทั้งหมด <span className="font-bold text-xl">{resetTotal.toLocaleString()}</span> คน</p>
                        <p>ที่แจกไปแล้ว <span className="font-bold">{resetTargetCount}</span> ครั้ง</p>
                    </div>
                ),
                confirmLabel: 'ยืนยัน Reset ทั้งหมด',
                confirmColor: 'red',
                onConfirm: () => executeManualReset(payload, mode)
            });
        }
    };

    // Reclaim Logic
    const [reclaimModalOpen, setReclaimModalOpen] = useState(false);
    const [reclaimingAgent, setReclaimingAgent] = useState<any | null>(null);
    const [reclaiming, setReclaiming] = useState(false);
    
    // Reclaim Preview Data
    const [reclaimPreviewNoCallNoAppt, setReclaimPreviewNoCallNoAppt] = useState<Record<string, number>>({});
    const [reclaimPreviewCalledNoAppt, setReclaimPreviewCalledNoAppt] = useState<Record<string, number>>({});
    const [reclaimPreviewCalledWithAppt, setReclaimPreviewCalledWithAppt] = useState<Record<string, number>>({});
    const [loadingReclaimPreviews, setLoadingReclaimPreviews] = useState(false);
    
    // Bulk Result Modal
    const [bulkResultModal, setBulkResultModal] = useState<{
        isOpen: boolean;
        title: string;
        total: number;
        results: any[];
    } | null>(null);

    // Bulk Action State
    const [selectedBaskets, setSelectedBaskets] = useState<string[]>([]);
    const [bulkActionType, setBulkActionType] = useState<'transfer' | 'reclaim_all' | 'reclaim_no_call_no_appt' | 'reclaim_called_no_appt' | 'reclaim_called_with_appt' | null>(null);
    const [bulkTargetAgent, setBulkTargetAgent] = useState<number | null>(null);
    const [bulkLimit, setBulkLimit] = useState<string>('');

    // Flexible Transfer Logic
    const [flexTransferModalOpen, setFlexTransferModalOpen] = useState(false);
    const [flexTransferMode, setFlexTransferMode] = useState<'1_to_many' | 'many_to_1'>('1_to_many');
    const [flexTransferring, setFlexTransferring] = useState(false);

    // 1 -> Many state
    const [flex1toManySourceAgent, setFlex1toManySourceAgent] = useState<number | null>(null);
    const [flex1toManyBasket, setFlex1toManyBasket] = useState<string>('');
    const [flex1toManyTargets, setFlex1toManyTargets] = useState<Record<number, string>>({});
    const [flex1toManyTotalTransferCount, setFlex1toManyTotalTransferCount] = useState<string>('');
    const [flex1toManyCheckedTargets, setFlex1toManyCheckedTargets] = useState<number[]>([]);

    // Many -> 1 state
    const [flexManyto1Sources, setFlexManyto1Sources] = useState<{ id: string, agentId: number | null, basketKey: string, count: string }[]>([]); 
    const [flexManyto1TargetAgent, setFlexManyto1TargetAgent] = useState<number | null>(null);

    const openFlexTransferModal = () => {
        setFlexTransferMode('1_to_many');
        setFlex1toManySourceAgent(null);
        setFlex1toManyBasket('');
        setFlex1toManyTargets({});
        setFlex1toManyTotalTransferCount('');
        setFlex1toManyCheckedTargets([]);
        setFlexManyto1Sources([{ id: Math.random().toString(), agentId: null, basketKey: '', count: '' }]);
        setFlexManyto1TargetAgent(null);
        setFlexTransferModalOpen(true);
    };

    const handleDistributeEvenly = () => {
        const total = parseInt(flex1toManyTotalTransferCount) || 0;
        if (total <= 0) {
            setMessage({ type: 'error', text: 'กรุณาระบุจำนวนที่จะโอนรวมก่อน' });
            return;
        }
        if (flex1toManyCheckedTargets.length === 0) {
            setMessage({ type: 'warning', text: 'กรุณาติ๊กเลือกพนักงานปลายทางอย่างน้อย 1 คน' });
            return;
        }

        const maxAgent = agents.find(a => a.id === flex1toManySourceAgent);
        const maxAvailable = maxAgent?.basketCounts?.[flex1toManyBasket] || 0;
        
        if (total > maxAvailable) {
             setMessage({ type: 'warning', text: `โอนได้สูงสุด ${maxAvailable} รายชื่อเท่านั้น` });
             return;
        }

        const baseCount = Math.floor(total / flex1toManyCheckedTargets.length);
        let remainder = total % flex1toManyCheckedTargets.length;
        
        const newTargets: Record<number, string> = { ...flex1toManyTargets };
        
        flex1toManyCheckedTargets.forEach((agentId) => {
            let assign = baseCount;
            if (remainder > 0) {
                assign += 1;
                remainder -= 1;
            }
            newTargets[agentId] = assign.toString();
        });
        
        // Only keep selected targets' inputs
        const finalTargets: Record<number, string> = {};
        flex1toManyCheckedTargets.forEach(id => {
             finalTargets[id] = newTargets[id];
        });
        
        setFlex1toManyTargets(finalTargets);
    };

    const handleExecuteFlexTransfer = async () => {
        setFlexTransferring(true);
        try {
            const transfers: { from_agent_id: number, to_agent_id: number, basket_key: string, count: number }[] = [];

            if (flexTransferMode === '1_to_many') {
                if (!flex1toManySourceAgent || !flex1toManyBasket) throw new Error('กรุณาเลือกพนักงานต้นทางและถัง');
                Object.entries(flex1toManyTargets).forEach(([tgtIdStr, countStr]) => {
                    const tgtId = parseInt(tgtIdStr);
                    const count = parseInt(countStr) || 0;
                    if (count > 0 && flex1toManySourceAgent !== tgtId) {
                        transfers.push({
                            from_agent_id: flex1toManySourceAgent,
                            to_agent_id: tgtId,
                            basket_key: flex1toManyBasket,
                            count: count
                        });
                    }
                });
            } else {
                if (!flexManyto1TargetAgent) throw new Error('กรุณาเลือกพนักงานปลายทาง');
                flexManyto1Sources.forEach(src => {
                    const count = parseInt(src.count) || 0;
                    if (src.agentId && src.basketKey && count > 0 && src.agentId !== flexManyto1TargetAgent) {
                        transfers.push({
                            from_agent_id: src.agentId,
                            to_agent_id: flexManyto1TargetAgent,
                            basket_key: src.basketKey,
                            count: count
                        });
                    }
                });
            }

            if (transfers.length === 0) {
                 throw new Error('กรุณาระบุจำนวนหรือปลายทางให้ถูกต้อง (โอนข้ามตัวเองจะไม่ถูกนับ)');
            }

            const result = await apiFetch(
                `basket_config.php?action=transfer_customers&companyId=${currentUser?.companyId}`,
                {
                    method: 'POST',
                    body: JSON.stringify({ transfers })
                }
            );

            if (result?.error) throw new Error(result.error);

            setMessage({ type: 'success', text: `โอนลูกค้าสำเร็จ รวม ${result?.transferred || 0} รายชื่อ` });
            setFlexTransferModalOpen(false);
            fetchAgents();
            fetchAllBasketCounts();

        } catch (error: any) {
            console.error('Transfer failed:', error);
            setMessage({ type: 'error', text: error.message || 'โอนลูกค้าไม่สำเร็จ' });
        } finally {
            setFlexTransferring(false);
        }
    };

    const [transferring, setTransferring] = useState(false);

    const openReclaimModal = (agent: AgentWithBaskets) => {
        setReclaimingAgent(agent);
        setSelectedBaskets([]); // Reset selection
        setBulkActionType(null); // Reset action
        setBulkTargetAgent(null); // Reset target agent
        setBulkLimit(''); // Reset limit
        setReclaimModalOpen(true);
    };

    const handleOpenBulkActionAllModal = () => {
        const aggregateCounts: Record<string, number> = {};
        agents.forEach(agent => {
            if (agent.basketCounts) {
                Object.keys(agent.basketCounts).forEach(key => {
                    aggregateCounts[key] = (aggregateCounts[key] || 0) + agent.basketCounts[key];
                });
            }
        });

        const allAgentFake = {
            id: 'all',
            firstName: 'ดึงคืน/โอน',
            lastName: '(พนักงานทั้งหมด)',
            basketCounts: aggregateCounts,
            role: 'all',
            status: 'active',
            team_id: 0,
            avatar_url: null,
            company_id: currentUser?.companyId || 1
        };
        
        setReclaimingAgent(allAgentFake);
        setSelectedBaskets([]);
        setBulkActionType(null);
        setBulkTargetAgent(null);
        setBulkLimit('');
        setReclaimModalOpen(true);
    };

    useEffect(() => {
        const fetchPreviews = async () => {
            if (reclaimModalOpen && reclaimingAgent?.id) {
                setLoadingReclaimPreviews(true);
                try {
                    const res = await apiFetch(`basket_config.php?action=preview_reclaim_unassigned&agent_id=${reclaimingAgent.id}&companyId=${currentUser?.companyId}&reclaim_mode=all_categories`);
                    
                    if (res?.ok && res.counts) {
                        setReclaimPreviewNoCallNoAppt(res.counts.no_call_no_appt || {});
                        setReclaimPreviewCalledNoAppt(res.counts.called_no_appt || {});
                        setReclaimPreviewCalledWithAppt(res.counts.called_with_appt || {});
                    }
                } catch (e) {
                    console.error('Failed to fetch reclaim previews', e);
                } finally {
                    setLoadingReclaimPreviews(false);
                }
            } else {
                setReclaimPreviewNoCallNoAppt({});
                setReclaimPreviewCalledNoAppt({});
                setReclaimPreviewCalledWithAppt({});
            }
        };
        fetchPreviews();
    }, [reclaimModalOpen, reclaimingAgent?.id, currentUser?.companyId]);

    const handleExecuteBulkAction = async () => {
        if (!reclaimingAgent || selectedBaskets.length === 0 || !bulkActionType) return;

        const limitVal = parseInt(bulkLimit, 10);
        const hasLimit = !isNaN(limitVal) && limitVal > 0;

        // Helper to get true available count based on action
        const getAvailableCount = (key: string) => {
            const currentHolding = reclaimingAgent.basketCounts?.[key] || 0;
            if (bulkActionType === 'reclaim_no_call_no_appt') return reclaimPreviewNoCallNoAppt[key] || 0;
            if (bulkActionType === 'reclaim_called_no_appt') return reclaimPreviewCalledNoAppt[key] || 0;
            if (bulkActionType === 'reclaim_called_with_appt') return reclaimPreviewCalledWithAppt[key] || 0;
            return currentHolding;
        };

        // Build payload
        const payloadBaskets: Record<string, number> = {};
        let total = 0;
        
        selectedBaskets.forEach(key => {
            const availableCount = getAvailableCount(key);
            const count = hasLimit ? Math.min(limitVal, availableCount) : availableCount;
            if (count > 0) {
                payloadBaskets[key] = count;
                total += count;
            }
        });

        if (total === 0) {
            setMessage({ type: 'error', text: 'ไม่พบลูกค้าในตะกร้าที่เลือก หรือจำนวนดึง/โอนไม่ถูกต้อง' });
            return;
        }

        if (bulkActionType === 'transfer') {
            if (!bulkTargetAgent) {
                setMessage({ type: 'error', text: 'กรุณาเลือกพนักงานปลายทางสำหรับการโอน' });
                return;
            }
            
            // Build transfer payload
            const transfers = selectedBaskets.map(key => {
                const availableCount = getAvailableCount(key);
                const count = hasLimit ? Math.min(limitVal, availableCount) : availableCount;
                return {
                    from_agent_id: reclaimingAgent.id,
                    to_agent_id: bulkTargetAgent,
                    basket_key: key,
                    count: count
                };
            }).filter(t => t.count > 0);
            
            if (transfers.length === 0) return;

            setTransferring(true);
            try {
                const result = await apiFetch(
                    `basket_config.php?action=transfer_customers&companyId=${currentUser?.companyId}`,
                    {
                        method: 'POST',
                        body: JSON.stringify({ transfers })
                    }
                );
                if (result?.error) throw new Error(result.error);

                const targetAgentName = agents.find(a => a.id === bulkTargetAgent);
                setBulkResultModal({
                    isOpen: true,
                    title: 'สรุปผลการโอนลูกค้า',
                    type: 'transfer',
                    fromAgentName: `${reclaimingAgent.firstName} ${reclaimingAgent.lastName}`,
                    toName: targetAgentName ? `${targetAgentName.firstName} ${targetAgentName.lastName}` : 'พนักงานปลายทาง',
                    total: result?.transferred || 0,
                    results: result?.results || []
                });

                setReclaimModalOpen(false);
                fetchAgents();
                fetchAllBasketCounts();
            } catch (error: any) {
                console.error('Transfer failed:', error);
                setMessage({ type: 'error', text: error.message || 'โอนลูกค้าไม่สำเร็จ' });
            } finally {
                setTransferring(false);
            }
        } else {
            // Reclaim
            let reclaimMode = 'all';
            if (bulkActionType === 'reclaim_no_call_no_appt') reclaimMode = 'no_call_no_appt';
            if (bulkActionType === 'reclaim_called_no_appt') reclaimMode = 'called_no_appt';
            if (bulkActionType === 'reclaim_called_with_appt') reclaimMode = 'called_with_appt';
            
            setReclaiming(true);
            try {
                const result = await apiFetch(
                    `basket_config.php?action=reclaim_customers&companyId=${currentUser?.companyId}`,
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            agent_id: reclaimingAgent.id,
                            baskets: payloadBaskets,
                            reclaim_mode: reclaimMode
                        })
                    }
                );
                if (result?.error) throw new Error(result.error);

                setBulkResultModal({
                    isOpen: true,
                    title: 'สรุปผลการดึงคืนลูกค้า',
                    type: 'reclaim',
                    fromAgentName: `${reclaimingAgent.firstName} ${reclaimingAgent.lastName}`,
                    toName: 'ถังกลาง (Pool)',
                    total: result?.reclaimed || 0,
                    results: result?.results || []
                });

                setReclaimModalOpen(false);
                fetchAgents();
                fetchAllBasketCounts();
            } catch (error) {
                console.error('Reclaim failed:', error);
                setMessage({ type: 'error', text: 'ดึงคืนลูกค้าไม่สำเร็จ' });
            } finally {
                setReclaiming(false);
            }
        }
    };

    const handlePreviewUnassigned = async (basketKey: string | 'ALL', mode: 'all_no_appt' | 'called_no_appt') => {
        if (!reclaimingAgent) return;
        setUnassignedReclaimMode(mode);
        setFetchingUnassigned(true);
        try {
            const result = await apiFetch(`basket_config.php?action=preview_reclaim_unassigned&agent_id=${reclaimingAgent.id}&companyId=${currentUser?.companyId}&reclaim_mode=${mode}`);
            if (result?.ok && result.counts) {
                setUnassignedPreviewData(result.counts);
                if (basketKey === 'ALL') {
                    setUnassignedTargetBaskets(dashboardBaskets.map(b => b.basket_key));
                } else {
                    setUnassignedTargetBaskets([basketKey]);
                }
                setShowUnassignedPreview(true);
            } else {
                setMessage({ type: 'error', text: `ไม่สามารถโหลดข้อมูลได้ (Backend): ${JSON.stringify(result)}` });
            }
        } catch (error: any) {
            console.error('Failed to preview unassigned:', error);
            setMessage({ type: 'error', text: `ข้อผิดพลาดระบบ: ${error?.message || 'Unknown'}` });
        } finally {
            setFetchingUnassigned(false);
        }
    };

    const handleExecuteUnassignedReclaim = async () => {
        if (!reclaimingAgent) return;

        // Collect payloads
        const payloadBaskets: Record<string, number> = {};
        let total = 0;
        
        unassignedTargetBaskets.forEach(key => {
            const count = unassignedPreviewData[key] || 0;
            if (count > 0 && key !== 'upsell_dis') {
                payloadBaskets[key] = count;
                total += count;
            }
        });

        if (total === 0) {
            setMessage({ type: 'error', text: 'ไม่พบลูกค้าที่ไม่มีนัดหมายในตะกร้าที่เลือก' });
            return;
        }

        setReclaiming(true);
        try {
            const result = await apiFetch(
                `basket_config.php?action=reclaim_customers&companyId=${currentUser?.companyId}`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        agent_id: reclaimingAgent.id,
                        baskets: payloadBaskets,
                        reclaim_mode: unassignedReclaimMode
                    })
                }
            );

            setMessage({ type: 'success', text: `ดึงคืนไม่มีนัดหมายสำเร็จ ${result?.reclaimed || total} รายชื่อ` });
            setShowUnassignedPreview(false);
            setReclaimModalOpen(false);
            fetchAgents(); // Refresh agent stats
            fetchAllBasketCounts(); // Refresh basket pools
        } catch (error) {
            console.error('Reclaim unassigned failed:', error);
            setMessage({ type: 'error', text: 'ดึงคืนลูกค้าไม่มีนัดหมายไม่สำเร็จ' });
        } finally {
            setReclaiming(false);
        }
    };

    // Get active basket info
    const activeBasketInfo = baskets.find(b => b.basket_key === activeBasket);
    const isHoldingBasketActive = activeBasket === 'holding_before_redistribute' && !forceDistributeHolding;

    // Handle Export Distribution
    const executeExport = async (type: 'csv' | 'xlsx') => {
        const companyId = currentUser?.companyId || 1;
        const sd = distributionExportRange.start;
        const ed = distributionExportRange.end;
        const basket = activeBasket || '';

        setIsExporting(true);

        try {
            const basePath = typeof window !== 'undefined' ? resolveApiBasePath() : '/api';
            const url = `${basePath.replace(/\/$/, '')}/Distribution/export_distribution.php?companyId=${companyId}&start_date=${sd}&end_date=${ed}&basket_key=${basket}&format=json`;
            const response = await fetch(url);
            const result = await response.json();

            if (result.ok && result.data) {
                const headers = [
                    'วันที่จ่ายออก', 'รหัสลูกค้า', 'ชื่อลูกค้า', 'นามสกุล', 'เบอร์โทรศัพท์', 
                    'จากตะกร้า', 'ไปตะกร้า', 'ผู้รับงาน (Telesale)', 'ผู้ดำเนินการแจก (Supervisor)'
                ];
                
                const rows = result.data.map((row: any) => {
                    const formattedDate = row.distribute_date ? new Date(row.distribute_date).toLocaleString('th-TH') : '-';
                    const newAgentName = [row.new_agent_first, row.new_agent_last].filter(Boolean).join(' ').trim();
                    const triggerName = [row.trigger_first, row.trigger_last].filter(Boolean).join(' ').trim();

                    return [
                        formattedDate,
                        row.customer_id,
                        row.first_name || '-',
                        row.last_name || '-',
                        row.phone || '-',
                        row.from_basket_key || '-',
                        row.to_basket_key || '-',
                        newAgentName || '-',
                        triggerName || '-'
                    ];
                });

                const filename = `distribution_history_${new Date().toISOString().slice(0, 10)}`;
                downloadDataFile([headers, ...rows], filename, type);
            } else {
                alert('ไม่สามารถดึงข้อมูลได้: ' + (result.error || 'Unknown error'));
            }
        } catch (e: any) {
            alert('เกิดข้อผิดพลาดในการส่งออกข้อมูล: ' + e.message);
        } finally {
            setIsExporting(false);
            setIsExportTypeModalOpen(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="p-6 relative">
            {/* Header */}
            <div className="mb-6 flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">แจกงาน V2</h1>
                    <p className="text-gray-600">แจกลูกค้าจากถังต่างๆ ให้ Telesale</p>
                </div>
                <div className="flex gap-2 items-center">
                    <UniversalDateRangePicker
                        value={distributionExportRange}
                        onChange={setDistributionExportRange}
                        label="เวลาจ่ายออก"
                        buttonClassName="w-56 px-3 py-1.5 text-left border border-gray-200 rounded-lg bg-white shadow-sm hover:border-blue-400 focus:ring-2 focus:ring-blue-500 transition-colors flex items-center justify-between"
                        placeholder="เลือกช่วงวันที่"
                    />
                    <button
                        onClick={() => setIsExportTypeModalOpen(true)}
                        disabled={isExporting}
                        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1.5 font-medium shadow-sm transition-colors disabled:opacity-50"
                        title="ดาวน์โหลด Export Data"
                    >
                        <Download size={16} />
                        Export
                    </button>
                    <button
                        onClick={handleOpenBulkActionAllModal}
                        className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 font-medium shadow-sm transition-colors"
                    >
                        <ArrowRightLeft size={16} />
                        ดึงคืน/โอน (ทั้งหมด)
                    </button>
                    <button
                        onClick={openFlexTransferModal}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium shadow-sm transition-colors"
                    >
                        <ArrowRightLeft size={16} />
                        โอนรายชื่อ
                    </button>
                    <button
                        onClick={() => setResetModalOpen(true)}
                        className="px-4 py-2 text-sm bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 flex items-center gap-2 font-medium transition-colors"
                    >
                        <RefreshCw size={16} />
                        Manual Reset
                    </button>
                </div>
            </div>


            {/* Manual Reset Modal */}
            {resetModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setResetAgentDropdownOpen(false); }}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-gradient-to-r from-orange-50 to-amber-50 rounded-t-2xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                                    <RefreshCw size={20} className="text-orange-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800">Manual Reset</h3>
                                    <p className="text-xs text-gray-500">ล้างประวัติการถือครองเพื่อแจกซ้ำได้</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setResetModalOpen(false)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-white/80 transition-colors"
                            >✕</button>
                        </div>

                        {/* Filters - NOT scrollable so dropdown won't be clipped */}
                        <div className="px-5 pt-5 pb-2">
                            {/* Step 1: Round selector */}
                            <div className="bg-gray-50 rounded-xl p-4 mb-4">
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                    เลือกรอบที่ต้องการล้าง
                                </label>
                                <div className="flex gap-2">
                                    <select
                                        value={resetTargetCount}
                                        onChange={(e) => setResetTargetCount(e.target.value)}
                                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white"
                                    >
                                        <option value="">-- เลือกเงื่อนไข --</option>
                                        {resetOptions.map(opt => (
                                            <option key={opt.assigned_count} value={opt.assigned_count}>
                                                รอบที่ {opt.assigned_count} ({opt.customer_count.toLocaleString()} รายชื่อ)
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => handleCheckCandidates()}
                                        disabled={!resetTargetCount || findingCandidates}
                                        className="px-5 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 font-medium text-sm shadow-sm transition-colors"
                                    >
                                        {findingCandidates ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                                        ค้นหา
                                    </button>
                                </div>
                            </div>

                            {/* Step 2: Filters */}
                            <div className="flex gap-3 items-end">
                                <div className="flex-1 min-w-0">
                                    <label className="block text-xs font-medium text-gray-500 mb-1.5">🔍 ค้นหา (ชื่อ/เบอร์/รหัส)</label>
                                    <input
                                        type="text"
                                        value={resetSearchText}
                                        onChange={(e) => setResetSearchText(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleCheckCandidates(); }}
                                        placeholder="พิมพ์แล้วกด Enter..."
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                                    />
                                </div>
                                <div className="flex-1 min-w-0 relative">
                                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                                        👤 กรองตาม Agent
                                        {resetAgentFilter.length > 0 && (
                                            <span className="ml-1 bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">{resetAgentFilter.length}</span>
                                        )}
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setResetAgentDropdownOpen(!resetAgentDropdownOpen)}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-left bg-white hover:bg-gray-50 flex justify-between items-center transition-colors"
                                    >
                                        <span className={resetAgentFilter.length === 0 ? 'text-gray-400' : 'text-gray-800 font-medium'}>
                                            {resetAgentFilter.length === 0
                                                ? 'ทุก Agent'
                                                : `${resetAgentFilter.length} คน · ${resetAgentMode === 'any' ? 'คนใดคนหนึ่ง' : 'ต้องครบทุกคน'}`}
                                        </span>
                                        <ChevronDown size={14} className={`text-gray-400 transition-transform ${resetAgentDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    {resetAgentDropdownOpen && (
                                        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 flex flex-col overflow-hidden">
                                            {/* Mode toggle + clear */}
                                            <div className="p-2.5 border-b bg-gray-50 flex items-center justify-between gap-2">
                                                <div className="flex bg-white rounded-lg p-0.5 text-xs border shadow-sm">
                                                    <button
                                                        onClick={() => setResetAgentMode('any')}
                                                        className={`px-2.5 py-1 rounded-md transition-all ${resetAgentMode === 'any' ? 'bg-orange-500 text-white font-semibold shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                    >คนใดคนหนึ่ง</button>
                                                    <button
                                                        onClick={() => setResetAgentMode('all')}
                                                        className={`px-2.5 py-1 rounded-md transition-all ${resetAgentMode === 'all' ? 'bg-orange-500 text-white font-semibold shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                    >ต้องครบทุกคน</button>
                                                </div>
                                                {resetAgentFilter.length > 0 && (
                                                    <button
                                                        onClick={() => setResetAgentFilter([])}
                                                        className="text-xs text-red-500 hover:text-red-700 hover:underline whitespace-nowrap"
                                                    >ล้างทั้งหมด</button>
                                                )}
                                            </div>
                                            {/* Agent list */}
                                            <div className="overflow-y-auto flex-1">
                                                {resetAgentOptions.map(a => (
                                                    <label key={a.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-orange-50 cursor-pointer text-sm border-b border-gray-50 last:border-0">
                                                        <input
                                                            type="checkbox"
                                                            checked={resetAgentFilter.includes(a.id)}
                                                            onChange={() => {
                                                                setResetAgentFilter(prev =>
                                                                    prev.includes(a.id)
                                                                        ? prev.filter(id => id !== a.id)
                                                                        : [...prev, a.id]
                                                                );
                                                            }}
                                                            className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                                                        />
                                                        <span className="truncate">{a.first_name} {a.last_name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => { setResetAgentDropdownOpen(false); handleCheckCandidates(); }}
                                    disabled={!resetTargetCount || findingCandidates}
                                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap transition-colors shadow-sm"
                                >
                                    {findingCandidates ? <Loader2 size={14} className="animate-spin" /> : '🔄'} กรอง
                                </button>
                            </div>
                        </div>

                        {/* Scrollable results area */}
                        <div className="px-5 pb-3 overflow-y-auto flex-1">
                            {/* Results table */}
                            {resetCandidates.length > 0 && (
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-3">
                                            <h4 className="text-sm font-semibold text-gray-700">
                                                พบ <span className="text-orange-600 text-base">{resetTotal.toLocaleString()}</span> รายชื่อ
                                            </h4>
                                            {(resetSearchText || resetAgentFilter.length > 0) && (
                                                <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide">Filtered</span>
                                            )}
                                        </div>
                                        <button
                                            onClick={toggleAllResetCandidates}
                                            className="text-xs text-orange-600 hover:text-orange-800 font-medium hover:underline"
                                        >
                                            {allResetSelected ? '☐ ยกเลิกทั้งหมด' : '☑ เลือกทั้งหมด'}
                                        </button>
                                    </div>

                                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                                        <div className="max-h-[350px] overflow-y-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 sticky top-0 z-10">
                                                    <tr className="border-b border-gray-200">
                                                        <th className="p-2.5 w-10"></th>
                                                        <th className="p-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">รหัส</th>
                                                        <th className="p-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">ชื่อ-นามสกุล</th>
                                                        <th className="p-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">เบอร์โทร</th>
                                                        <th className="p-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">เคยแจกให้</th>
                                                        <th className="p-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-16">ครั้ง</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {resetCandidates.map(c => (
                                                        <tr key={c.id} className={`transition-colors ${c.selected ? 'bg-orange-50/70' : 'hover:bg-gray-50'}`}>
                                                            <td className="p-2.5 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={c.selected || false}
                                                                    onChange={() => toggleResetCandidate(c.id)}
                                                                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                                                                />
                                                            </td>
                                                            <td className="p-2.5 text-gray-400 font-mono text-xs">{c.code}</td>
                                                            <td className="p-2.5 text-gray-800 font-medium">{c.first_name} {c.last_name}</td>
                                                            <td className="p-2.5 text-gray-500 text-xs font-mono">{c.phone || '-'}</td>
                                                            <td className="p-2.5">
                                                                {c.agent_names ? (
                                                                    <span className="inline-block text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md max-w-[200px] truncate" title={c.agent_names}>
                                                                        {c.agent_names}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-gray-300 text-xs">-</span>
                                                                )}
                                                            </td>
                                                            <td className="p-2.5 text-center">
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <span className="text-gray-600 font-medium">{c.assigned_count}</span>
                                                                    <button
                                                                        onClick={() => handleViewHistory(c)}
                                                                        className="text-gray-300 hover:text-blue-600 p-1 rounded-md hover:bg-blue-50 transition-colors"
                                                                        title="ดูประวัติการแจก"
                                                                    >
                                                                        <Eye size={13} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Pagination */}
                            {resetTotalPages > 1 && (
                                <div className="flex justify-center items-center gap-3 mt-3 py-2">
                                    <button
                                        onClick={() => changeResetPage(1)}
                                        disabled={resetPage === 1 || findingCandidates}
                                        className="px-2 py-1 rounded-md text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                    >«</button>
                                    <button
                                        onClick={() => changeResetPage(resetPage - 1)}
                                        disabled={resetPage === 1 || findingCandidates}
                                        className="px-2 py-1 rounded-md text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                    >‹ ก่อนหน้า</button>
                                    <span className="text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded-lg font-mono">
                                        {resetPage} / {resetTotalPages.toLocaleString()}
                                    </span>
                                    <button
                                        onClick={() => changeResetPage(resetPage + 1)}
                                        disabled={resetPage === resetTotalPages || findingCandidates}
                                        className="px-2 py-1 rounded-md text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                    >ถัดไป ›</button>
                                    <button
                                        onClick={() => changeResetPage(resetTotalPages)}
                                        disabled={resetPage === resetTotalPages || findingCandidates}
                                        className="px-2 py-1 rounded-md text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                    >»</button>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3.5 border-t bg-gray-50/80 rounded-b-2xl flex justify-between items-center">
                            <button
                                onClick={() => handleManualReset('all')}
                                disabled={!resetTotal || resetTotal === 0 || resetting}
                                className="px-4 py-2 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm transition-colors"
                            >
                                {resetting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                Reset ทั้งหมด <span className="font-mono text-xs">({resetTotal.toLocaleString()})</span>
                            </button>

                            <div className="flex gap-2 items-center">
                                <button
                                    onClick={() => setResetModalOpen(false)}
                                    className="px-4 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg text-sm transition-colors"
                                >
                                    ปิด
                                </button>
                                <button
                                    onClick={() => handleManualReset('selected')}
                                    disabled={resetCandidates.filter(c => c.selected).length === 0 || resetting}
                                    className="px-5 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm flex items-center gap-1.5 font-medium text-sm transition-colors"
                                >
                                    {resetting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                    Reset ที่เลือก
                                    <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs font-mono">
                                        {resetCandidates.filter(c => c.selected).length}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Summary Modal (Distribution Result) */}
            {
                summaryModalOpen && (
                    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col animate-in fade-in duration-200">
                            {/* Header */}
                            <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                                <h3 className="text-xl font-bold text-gray-800">สรุปผลการแจกงาน</h3>
                                <button onClick={closeSummaryModal} className="text-gray-500 hover:text-gray-700">✕</button>
                            </div>

                            {/* Body - Stats Table */}
                            <div className="p-6 overflow-y-auto flex-1">
                                {/* Top Summary Cards */}
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-green-50 p-4 rounded-lg border border-green-100 text-center">
                                        <div className="text-3xl font-bold text-green-600">{summaryStats.totalSuccess}</div>
                                        <div className="text-sm text-green-800">แจกสำเร็จ (รายการ)</div>
                                    </div>
                                    <div className="bg-red-50 p-4 rounded-lg border border-red-100 text-center">
                                        <div className="text-3xl font-bold text-red-600">{summaryStats.totalFailed}</div>
                                        <div className="text-sm text-red-800">แจกไม่สำเร็จ (รายการ)</div>
                                    </div>
                                </div>

                                {/* Table */}
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm border-collapse">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="p-3 text-left font-semibold text-gray-600">พนักงาน</th>
                                                <th className="p-3 text-center text-green-700 font-semibold">สำเร็จ</th>
                                                <th className="p-3 text-center text-red-700 font-semibold">ไม่สำเร็จ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {Object.values(summaryStats.agentStats).map((stat, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="p-3 font-medium text-gray-800">{stat.name}</td>
                                                    <td className="p-3 text-center text-green-600 font-bold">{stat.success}</td>
                                                    <td className="p-3 text-center text-red-500 font-medium">{stat.failed > 0 ? stat.failed : '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Missing Alert */}
                                {summaryStats.missingTotal > 0 && (
                                    <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-3">
                                        <AlertCircle className="text-orange-600 shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="font-bold text-orange-800">ยังแจกไม่ครบตามเป้าหมาย</h4>
                                            <p className="text-sm text-orange-700">ขาดอีกประมาณ <span className="font-bold">{summaryStats.missingTotal}</span> รายชื่อ</p>
                                            <p className="text-xs text-orange-600 mt-1">ต้องการค้นหาลูกค้าเพิ่มเติมและแจกต่อหรือไม่?</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-6 border-t bg-gray-50 flex justify-between gap-3 rounded-b-xl">
                                <button
                                    onClick={handleExportSummary}
                                    className="px-6 py-2 border border-green-600 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 font-bold transition-colors flex items-center gap-2"
                                >
                                    <Download size={18} />
                                    Export เป็น Excel
                                </button>
                                <div className="flex gap-3">
                                    <button
                                        onClick={closeSummaryModal}
                                        className="px-6 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                                    >
                                        ปิด (เสร็จสิ้น)
                                    </button>
                                    {summaryStats.missingTotal > 0 && (
                                        <button
                                            onClick={handleDistributeMore}
                                            disabled={distributing}
                                            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-bold flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                                        >
                                            {distributing ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                                            แจกเพิ่มส่วนที่ขาด
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Message */}
            {
                message && (
                    <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-100 text-green-700' :
                        message.type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                        }`}>
                        <AlertCircle size={20} />
                        {message.text}
                        <button onClick={() => setMessage(null)} className="ml-auto">×</button>
                    </div>
                )
            }

            {/* Stats Cards - All Baskets in Grid */}
            <div className="grid grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
                {baskets.map(basket => {
                    const isHolding = basket.basket_key === 'holding_before_redistribute';
                    const isActive = activeBasket === basket.basket_key;
                    return (
                        <button
                            key={basket.basket_key}
                            onClick={() => {
                                if (basket.basket_key === 'block_customer') {
                                    handleBlockedBasketClick();
                                    return;
                                }
                                setActiveBasket(basket.basket_key);
                            }}
                            className={`p-3 rounded-xl shadow-sm border-2 transition-all hover:shadow-md text-left ${isHolding
                                ? (isActive
                                    ? 'border-amber-500 bg-amber-50'
                                    : 'border-amber-200 bg-amber-50/50 hover:border-amber-400')
                                : (isActive
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-100 bg-white hover:border-blue-200')
                                }`}
                        >
                            <p className={`text-[11px] font-medium mb-0.5 truncate ${basket.basket_key === 'block_customer' ? 'text-red-600' : isHolding ? 'text-amber-600' : 'text-gray-500'}`}>
                                {basket.basket_key === 'block_customer' ? '🚫 ' : isHolding ? '⏳ ' : ''}{basket.basket_name}
                            </p>
                            <div className={`text-xl font-bold ${isHolding
                                ? (isActive ? 'text-amber-600' : 'text-amber-700')
                                : (isActive ? 'text-blue-600' : 'text-gray-900')
                                }`}>
                                {basketCounts[basket.basket_key]?.toLocaleString() || 0}
                            </div>
                        </button>
                    );
                })}

                {/* Total Card */}
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-3 rounded-xl shadow-md text-white">
                    <p className="text-[11px] font-medium text-green-100 mb-0.5">รวมทั้งหมด</p>
                    <div className="text-xl font-bold">
                        {totalInAllBaskets.toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Holding Basket Notice */}
            {activeBasket === 'holding_before_redistribute' && !forceDistributeHolding && (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6 mb-6 text-center">
                    <div className="text-amber-500 text-5xl mb-3">⏳</div>
                    <h3 className="text-lg font-bold text-amber-800">ถังพักรอแจก</h3>
                    <p className="text-amber-700 mt-2">
                        ลูกค้าในถังนี้กำลังอยู่ระหว่างช่วงพัก 30 วัน
                        ก่อนจะถูกย้ายไปถัง "หาคนดูแลใหม่" โดยอัตโนมัติ
                    </p>
                    <p className="text-amber-600 text-sm mt-3 font-medium">ไม่สามารถแจกลูกค้าจากถังนี้ตาม Flow ปกติได้</p>
                    <button 
                        onClick={() => {
                            setForceDistributeHolding(true);
                            setTargetBasket('find_new_owner_dash');
                        }}
                        className="mt-4 px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium transition-colors shadow-sm"
                    >
                        ยืนยันที่จะแจก (แจกไป "หาคนดูแลใหม่")
                    </button>
                </div>
            )}

            {/* Section 1: Distribution Settings */}
            {!isHoldingBasketActive && (
                <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
                    <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <span className="w-7 h-7 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                        ตั้งค่าการแจก
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm text-gray-500 mb-2">สถานะการแจก</label>
                            <select
                                value={activeBasket}
                                onChange={(e) => setActiveBasket(e.target.value)}
                                className="w-full border rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                {baskets.map(basket => (
                                    <option key={basket.basket_key} value={basket.basket_key}>
                                        {basket.basket_name} ({basketCounts[basket.basket_key] || 0})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-500 mb-2">จำนวนรวมที่ต้องการแจก</label>
                            <input
                                type="number"
                                value={totalToDistribute}
                                onChange={(e) => setTotalToDistribute(e.target.value)}
                                className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                min={1}
                                max={availableCount || 1000}
                                placeholder={`มี ${availableCount} พร้อมแจก`}
                            />
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={() => { fetchAllBasketCounts(); fetchCustomers(); fetchAgents(); }}
                                className="px-4 py-2.5 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
                            >
                                <RefreshCw size={16} className={loadingCustomers ? 'animate-spin' : ''} />
                                รีเฟรช
                            </button>
                        </div>
                    </div>
                </div>
            )}





            {/* Section 2: Target Employees - Table Layout */}
            {!isHoldingBasketActive && (
                <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                            <span className="w-7 h-7 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                            เลือกพนักงานเป้าหมาย
                        </h3>
                        <div className="flex items-center gap-4">
                            <div className="bg-blue-50 border border-blue-200 px-4 py-2 rounded-lg">
                                <span className="text-blue-700 font-semibold">มีรายชื่อพร้อมแจก: {availableCount.toLocaleString()} รายการ</span>
                            </div>
                            <input
                                type="number"
                                value={totalToDistribute}
                                onChange={(e) => setTotalToDistribute(e.target.value)}
                                min={1}
                                className="w-32 border rounded-lg p-2 text-center"
                                placeholder="จำนวนรวม"
                            />
                            {selectedAgents.length > 0 && parseInt(totalToDistribute) > 0 && (
                                <span className="text-sm text-gray-500">
                                    ≈ {Math.floor((parseInt(totalToDistribute) || 0) / selectedAgents.length)} / คน
                                </span>
                            )}
                            <button
                                onClick={handlePreparePreview}
                                disabled={selectedAgents.length === 0 || availableCount === 0 || !totalToDistribute || parseInt(totalToDistribute) <= 0}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Eye size={16} />
                                ดูตัวอย่างก่อนแจก
                            </button>
                        </div>
                    </div>

                    {/* Call Threshold Filter */}
                    <div className="mb-4 bg-orange-50 border border-orange-100 rounded-lg p-4 flex flex-wrap items-end gap-4 shadow-sm">
                        <div>
                            <label className="block text-xs font-semibold text-orange-800 mb-1">แหล่งข้อมูลเวลาโทร</label>
                            <select
                                value={callDataSource}
                                onChange={(e) => {
                                    const val = e.target.value as 'db' | 'realtime';
                                    setCallDataSource(val);
                                    if (val === 'realtime') {
                                        // Auto-adjust date range if > 3 days
                                        const s = new Date(callFilterStartDate);
                                        const eDate = new Date(callFilterEndDate);
                                        const diffDays = (eDate.getTime() - s.getTime()) / (1000 * 60 * 60 * 24);
                                        if (diffDays > 3) {
                                            const newStart = new Date(eDate);
                                            newStart.setDate(eDate.getDate() - 3);
                                            setCallFilterStartDate(newStart.toISOString().split('T')[0]);
                                            setMessage({ type: 'warning', text: 'ข้อมูลสด (Realtime) ดึงย้อนหลังได้สูงสุด 3 วัน ระบบได้ปรับวันที่อัตโนมัติ' });
                                        }
                                    }
                                }}
                                className="border border-orange-200 rounded p-2 text-sm focus:ring-orange-500 focus:border-orange-500 bg-white"
                            >
                                <option value="db">ฐานข้อมูล CRM</option>
                                <option value="realtime">เว็บไฟล์เสียง (Realtime)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-orange-800 mb-1">กรองตั้งแต่วันที่</label>
                            <input
                                type="date"
                                value={callFilterStartDate}
                                onChange={(e) => {
                                    const newStart = e.target.value;
                                    if (callDataSource === 'realtime') {
                                        const s = new Date(newStart);
                                        const eDate = new Date(callFilterEndDate);
                                        if ((eDate.getTime() - s.getTime()) / (1000 * 60 * 60 * 24) > 3) {
                                            setMessage({ type: 'warning', text: 'ข้อมูลสด (Realtime) ดึงย้อนหลังได้สูงสุด 3 วัน' });
                                            const adjustedStart = new Date(eDate);
                                            adjustedStart.setDate(eDate.getDate() - 3);
                                            setCallFilterStartDate(adjustedStart.toISOString().split('T')[0]);
                                            return;
                                        }
                                    }
                                    setCallFilterStartDate(newStart);
                                }}
                                className="border border-orange-200 rounded p-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-orange-800 mb-1">ถึงวันที่</label>
                            <input
                                type="date"
                                value={callFilterEndDate}
                                onChange={(e) => {
                                    const newEnd = e.target.value;
                                    if (callDataSource === 'realtime') {
                                        const s = new Date(callFilterStartDate);
                                        const eDate = new Date(newEnd);
                                        if ((eDate.getTime() - s.getTime()) / (1000 * 60 * 60 * 24) > 3) {
                                            setMessage({ type: 'warning', text: 'ข้อมูลสด (Realtime) ดึงย้อนหลังได้สูงสุด 3 วัน' });
                                            const adjustedEnd = new Date(s);
                                            adjustedEnd.setDate(s.getDate() + 3);
                                            setCallFilterEndDate(adjustedEnd.toISOString().split('T')[0]);
                                            return;
                                        }
                                    }
                                    setCallFilterEndDate(newEnd);
                                }}
                                className="border border-orange-200 rounded p-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-orange-800 mb-1">เกณฑ์เวลาโทร (นาที)</label>
                            <input
                                type="number"
                                value={callThresholdMinutes}
                                onChange={(e) => setCallThresholdMinutes(e.target.value)}
                                className="border border-orange-200 rounded p-2 text-sm focus:ring-orange-500 focus:border-orange-500 w-24 text-center"
                                min={0}
                            />
                        </div>
                        <div className="flex-1">
                            <button
                                onClick={() => {
                                    const threshold = parseInt(callThresholdMinutes) || 0;
                                    const activeIds = activeAgents.map(a => a.id);
                                    
                                    // Start with currently selected inactive agents (preserve them)
                                    const inactiveSelected = selectedAgents.filter(id => !activeIds.includes(id));
                                    
                                    // Find eligible active agents
                                    const eligibleIds = activeAgents
                                        .filter(a => (a.callMinutes || 0) >= threshold)
                                        .map(a => a.id);
                                        
                                    setSelectedAgents([...inactiveSelected, ...eligibleIds]);
                                }}
                                disabled={loadingCallMinutes || agents.length === 0}
                                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
                            >
                                {loadingCallMinutes ? <Loader2 size={16} className="animate-spin" /> : <Filter size={16} />}
                                เลือกพนักงานที่โทรเกินเกณฑ์
                            </button>
                        </div>
                    </div>



                    {loadingAgents ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="p-3 text-left">
                                            <input
                                                type="checkbox"
                                                checked={activeAgents.length > 0 && activeAgents.every(a => selectedAgents.includes(a.id))}
                                                onChange={selectAllAgents}
                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                        </th>
                                        <th className="p-3 text-left font-medium text-gray-600">พนักงาน</th>
                                        <th className="p-3 text-center font-medium text-gray-600">เวลาโทร (สายรับ)</th>
                                        <th className="p-3 text-center font-medium text-gray-600">Action</th>
                                        <th className="p-3 text-center font-medium text-gray-600">ลูกค้าทั้งหมด</th>
                                        {dashboardBaskets.map(basket => (
                                            <th key={basket.basket_key} className="p-3 text-center font-medium text-gray-600 text-xs">
                                                {basket.basket_name}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {agents.map(agent => {
                                        const isInactive = !agent.isActive;
                                        const isSelected = selectedAgents.includes(agent.id);
                                        return (
                                            <tr
                                                key={agent.id}
                                                className={`border-t ${isInactive ? 'opacity-60 bg-gray-50' : ''} hover:bg-gray-50 cursor-pointer ${isSelected ? 'bg-blue-50' : ''}`}
                                                onClick={() => toggleAgent(agent.id)}
                                            >
                                                <td className="p-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleAgent(agent.id)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                </td>
                                                <td className="p-3 font-medium">
                                                    {agent.firstName} {agent.lastName}
                                                    {isInactive && (
                                                        <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-600 rounded">
                                                            {agent.status === 'resigned' ? 'ลาออก' : 'ไม่ใช้งาน'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {loadingCallMinutes ? (
                                                        <span className="text-gray-300 text-xs">...</span>
                                                    ) : (
                                                        <span className={`font-semibold ${agent.callMinutes && agent.callMinutes >= parseInt(callThresholdMinutes) ? 'text-green-600' : 'text-gray-500'}`}>
                                                            {agent.callMinutes !== undefined ? `${Math.floor(agent.callMinutes)} นาที` : '-'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openReclaimModal(agent);
                                                        }}
                                                        className="px-3 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 border border-red-200"
                                                    >
                                                        ดึงคืน
                                                    </button>
                                                </td>
                                                <td className="p-3 text-center font-semibold text-gray-700">{agent.totalCustomers}</td>
                                                {dashboardBaskets.map(basket => (
                                                    <td key={basket.basket_key} className="p-3 text-center text-gray-600 text-sm">
                                                        {agent.basketCounts?.[basket.basket_key] || 0}
                                                    </td>
                                                ))}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="mt-4 text-sm text-gray-500">
                        เลือกแล้ว {selectedAgents.length} คน | จำนวนรวม: {totalToDistribute || 0} |
                        <span className="font-semibold text-blue-600">
                            ≈ {selectedAgents.length > 0 ? Math.floor((parseInt(totalToDistribute) || 0) / selectedAgents.length) : 0} / คน
                        </span>
                    </div>
                </div>
            )}

            {/* Customer Preview Table */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-700">
                        รายชื่อพร้อมแจก: {activeBasketInfo?.basket_name}
                        <span className="ml-2 text-gray-400">({availableCount} รายชื่อ)</span>
                    </h3>
                    <button
                        onClick={fetchCustomers}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                        title="รีเฟรช"
                    >
                        <RefreshCw size={18} className={loadingCustomers ? 'animate-spin' : ''} />
                    </button>
                </div>

                {loadingCustomers ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                ) : customers.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        ไม่พบลูกค้าในถังนี้
                    </div>
                ) : (
                    <div className="overflow-auto max-h-80">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="text-left p-3 font-medium">ชื่อ</th>
                                    <th className="text-left p-3 font-medium">เบอร์โทร</th>
                                    <th className="text-left p-3 font-medium">จังหวัด</th>
                                    <th className="text-left p-3 font-medium">Order ล่าสุด</th>
                                    <th className="text-right p-3 font-medium">ยอดซื้อ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {customers.slice(0, 50).map(customer => (
                                    <tr key={customer.id} className="border-t hover:bg-gray-50">
                                        <td className="p-3">{customer.firstName} {customer.lastName}</td>
                                        <td className="p-3">{customer.phone}</td>
                                        <td className="p-3">{customer.province || '-'}</td>
                                        <td className="p-3">
                                            {customer.lastOrderDate
                                                ? new Date(customer.lastOrderDate).toLocaleDateString('th-TH')
                                                : '-'}
                                        </td>
                                        <td className="p-3 text-right">฿{(customer.totalPurchases || 0).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {customers.length > 50 && (
                            <div className="text-center py-3 text-gray-400 text-sm">
                                แสดง 50 จาก {customers.length} รายการ
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Reclaim Modal */}
            {
                reclaimModalOpen && reclaimingAgent && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-gray-50 rounded-2xl p-0 w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
                            
                            {/* Modal Header */}
                            <div className="px-6 py-4 bg-white border-b flex items-center justify-between shadow-sm z-10">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800">โอน / ดึงคืนลูกค้า (แบบกลุ่ม)</h3>
                                    <p className="text-sm text-gray-500">จัดการลูกค้าของ {reclaimingAgent.firstName} {reclaimingAgent.lastName}</p>
                                </div>
                                <button onClick={() => setReclaimModalOpen(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded-full transition-colors">
                                    ✕
                                </button>
                            </div>

                            {/* Modal Body (Scrollable Basket List) */}
                            <div className="flex-1 overflow-auto p-6 space-y-3">
                                {/* Select All Bar */}
                                <div className="flex items-center pb-2 mb-2 border-b">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={
                                                dashboardBaskets.filter(b => b.basket_key !== 'upsell_dis' && (reclaimingAgent.basketCounts?.[b.basket_key] || 0) > 0).length > 0 &&
                                                selectedBaskets.length === dashboardBaskets.filter(b => b.basket_key !== 'upsell_dis' && (reclaimingAgent.basketCounts?.[b.basket_key] || 0) > 0).length
                                            }
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedBaskets(dashboardBaskets.filter(b => b.basket_key !== 'upsell_dis' && (reclaimingAgent.basketCounts?.[b.basket_key] || 0) > 0).map(b => b.basket_key));
                                                } else {
                                                    setSelectedBaskets([]);
                                                }
                                            }}
                                            className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 transition-colors"
                                        />
                                        <span className="font-semibold text-gray-700">เลือกทั้งหมด (เฉพาะตะกร้าที่มีลูกค้า)</span>
                                    </label>
                                </div>

                                {dashboardBaskets.filter(b => b.basket_key !== 'upsell_dis').map(basket => {
                                    const currentHolding = reclaimingAgent.basketCounts?.[basket.basket_key] || 0;
                                    const isEmpty = currentHolding === 0;
                                    const isSelected = selectedBaskets.includes(basket.basket_key);

                                    return (
                                        <label 
                                            key={basket.basket_key} 
                                            className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                                                isEmpty 
                                                    ? 'opacity-50 bg-gray-50 border-transparent cursor-not-allowed' 
                                                    : isSelected 
                                                        ? 'bg-blue-50/50 border-blue-500 shadow-sm' 
                                                        : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
                                            }`}
                                        >
                                            <div className="flex items-center justify-center pt-0.5">
                                                <input 
                                                    type="checkbox" 
                                                    disabled={isEmpty}
                                                    checked={isSelected}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedBaskets(prev => [...prev, basket.basket_key]);
                                                        } else {
                                                            setSelectedBaskets(prev => prev.filter(k => k !== basket.basket_key));
                                                        }
                                                    }}
                                                    className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 transition-colors"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-semibold text-gray-800">{basket.basket_name}</div>
                                            </div>
                                            <div className="flex items-center gap-4 text-right">
                                                {!isEmpty && (
                                                    <>
                                                        <div className="flex flex-col items-end">
                                                            <div className="text-[10px] text-gray-400 font-medium leading-none mb-1">ไม่มีการโทร</div>
                                                            <div className={`text-sm font-semibold ${loadingReclaimPreviews ? 'text-gray-300' : 'text-orange-500'}`}>
                                                                {loadingReclaimPreviews ? '...' : (reclaimPreviewNoCallNoAppt[basket.basket_key] || 0).toLocaleString()}
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <div className="text-[10px] text-gray-400 font-medium leading-none mb-1">โทรแล้วไม่นัด</div>
                                                            <div className={`text-sm font-semibold ${loadingReclaimPreviews ? 'text-gray-300' : 'text-red-500'}`}>
                                                                {loadingReclaimPreviews ? '...' : (reclaimPreviewCalledNoAppt[basket.basket_key] || 0).toLocaleString()}
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <div className="text-[10px] text-gray-400 font-medium leading-none mb-1">โทรและนัด</div>
                                                            <div className={`text-sm font-semibold ${loadingReclaimPreviews ? 'text-gray-300' : 'text-green-600'}`}>
                                                                {loadingReclaimPreviews ? '...' : (reclaimPreviewCalledWithAppt[basket.basket_key] || 0).toLocaleString()}
                                                            </div>
                                                        </div>
                                                        <div className="w-[1px] h-8 bg-gray-200 mx-1"></div>
                                                    </>
                                                )}
                                                <div className="flex flex-col items-end min-w-[60px]">
                                                    <div className="text-[11px] text-gray-500 font-medium leading-none mb-1">มีอยู่ทั้งหมด</div>
                                                    <div className={`text-xl font-bold leading-none ${isEmpty ? 'text-gray-400' : 'text-blue-600'}`}>
                                                        {currentHolding.toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                        </label>
                                    );
                                })}

                                {Object.values(reclaimingAgent.basketCounts).every(c => c === 0) && (
                                    <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
                                        พนักงานนี้ไม่มีลูกค้าในถังใดๆ
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer / Action Bar (Fixed Bottom) */}
                            <div className="bg-white border-t px-6 py-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
                                <div className="flex flex-col gap-4">
                                    
                                    {/* Action Config Row */}
                                    <div className="flex items-start gap-4">
                                        
                                        {/* Action Type Dropdown */}
                                        <div className="flex-1">
                                            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">รูปแบบการกระทำ</label>
                                            <select
                                                value={bulkActionType || ''}
                                                onChange={(e) => setBulkActionType(e.target.value as any)}
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                                            >
                                                <option value="">-- เลือกการกระทำ --</option>
                                                <option value="transfer">➡️ โอนให้ Telesale อื่น</option>
                                                <option value="reclaim_all">🔄 ดึงคืนทั้งหมด</option>
                                                <option value="reclaim_no_call_no_appt">📅 ดึงเฉพาะไม่มีการโทร</option>
                                                <option value="reclaim_called_no_appt">📞 ดึงเฉพาะโทรแล้วไม่นัด</option>
                                                <option value="reclaim_called_with_appt">✅ ดึงเฉพาะโทรและนัด</option>
                                            </select>
                                        </div>

                                        {/* Target Agent (Only for Transfer) */}
                                        {bulkActionType === 'transfer' && (
                                            <div className="flex-1 animate-in fade-in slide-in-from-right-4 duration-200">
                                                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">พนักงานปลายทาง</label>
                                                <select
                                                    value={bulkTargetAgent || ''}
                                                    onChange={(e) => setBulkTargetAgent(Number(e.target.value))}
                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                                                >
                                                    <option value="">-- เลือกพนักงาน --</option>
                                                    {agents.filter(a => a.id !== reclaimingAgent.id && a.role !== 'admin' && a.role !== 'manager').map(agent => (
                                                        <option key={agent.id} value={agent.id}>
                                                            {agent.firstName} {agent.lastName}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {/* Limit Input */}
                                        <div className="w-32">
                                            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">จำนวน / ถัง</label>
                                            <input
                                                type="number"
                                                placeholder="ทั้งหมด"
                                                value={bulkLimit}
                                                onChange={(e) => setBulkLimit(e.target.value)}
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                                                min={1}
                                            />
                                        </div>
                                    </div>

                                    {/* Execute Row */}
                                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                        <div className="text-sm">
                                            <span className="text-gray-500">เลือกแล้ว: </span>
                                            <span className="font-bold text-blue-600">{selectedBaskets.length}</span>
                                            <span className="text-gray-500"> ถัง</span>
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setReclaimModalOpen(false)}
                                                className="px-5 py-2.5 font-medium border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors"
                                            >
                                                ยกเลิก
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleExecuteBulkAction}
                                                disabled={
                                                    selectedBaskets.length === 0 || 
                                                    !bulkActionType || 
                                                    (bulkActionType === 'transfer' && !bulkTargetAgent) ||
                                                    reclaiming || transferring
                                                }
                                                className={`px-6 py-2.5 font-medium text-white rounded-lg flex items-center gap-2 shadow-sm transition-all
                                                    ${bulkActionType === 'transfer' 
                                                        ? 'bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2' 
                                                        : 'bg-orange-600 hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2'} 
                                                    disabled:opacity-50 disabled:cursor-not-allowed`}
                                            >
                                                {(reclaiming || transferring) ? (
                                                    <Loader2 className="animate-spin w-5 h-5" />
                                                ) : bulkActionType === 'transfer' ? (
                                                    'ดำเนินการโอน'
                                                ) : (
                                                    'ดำเนินการดึงคืน'
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }


            {/* Flexible Transfer Modal */}
            {flexTransferModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                                    <ArrowRightLeft size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800">โอนรายชื่อลูกค้า</h3>
                                    <p className="text-xs text-gray-500">โอนรายชื่อระหว่าง Telesale</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setFlexTransferModalOpen(false)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-white transition-colors"
                            >✕</button>
                        </div>
                        
                        {/* Body */}
                        <div className="p-6 overflow-y-auto flex-1">
                            {/* Mode toggle */}
                            <div className="flex bg-gray-100 p-1 rounded-xl mb-6 shadow-inner">
                                <button
                                    onClick={() => setFlexTransferMode('1_to_many')}
                                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${flexTransferMode === '1_to_many' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    1 คน → โอนให้หลายคน
                                </button>
                                <button
                                    onClick={() => setFlexTransferMode('many_to_1')}
                                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${flexTransferMode === 'many_to_1' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    หลายคน → โอนรวมให้ 1 คน
                                </button>
                            </div>

                            {flexTransferMode === '1_to_many' ? (
                                <div className="space-y-6">
                                    {/* Source Agent & Basket */}
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">พนักงานต้นทาง (1 คน)</label>
                                            <select 
                                                value={flex1toManySourceAgent || ''} 
                                                onChange={e => {
                                                    setFlex1toManySourceAgent(parseInt(e.target.value) || null);
                                                    setFlex1toManyBasket(''); // reset basket when source changes
                                                }}
                                                className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                            >
                                                <option value="">-- เลือกพนักงาน --</option>
                                                {agents.map(a => (
                                                    <option key={a.id} value={a.id}>{a.firstName} {a.lastName} ({a.totalCustomers})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">ถังงานที่จะโอน</label>
                                            <select
                                                value={flex1toManyBasket}
                                                onChange={e => setFlex1toManyBasket(e.target.value)}
                                                disabled={!flex1toManySourceAgent}
                                                className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                                            >
                                                <option value="">-- เลือกถังงาน --</option>
                                                {flex1toManySourceAgent && dashboardBaskets.map(b => {
                                                    const agent = agents.find(a => a.id === flex1toManySourceAgent);
                                                    const count = agent?.basketCounts?.[b.basket_key] || 0;
                                                    if (count === 0) return null;
                                                    return <option key={b.basket_key} value={b.basket_key}>{b.basket_name} ({count})</option>
                                                })}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Availability & Auto Distribute */}
                                    <div className="flex gap-4">
                                        {/* Available count info */}
                                        <div className="flex-1 bg-blue-50 p-3 rounded-lg text-sm text-blue-800 flex flex-col justify-center border border-blue-100">
                                            <span className="text-xs text-blue-600 mb-1">จำนวนที่โอนได้สูงสุด:</span>
                                            <span className="font-bold text-lg">
                                                {flex1toManySourceAgent && flex1toManyBasket ? 
                                                    (agents.find(a => a.id === flex1toManySourceAgent)?.basketCounts?.[flex1toManyBasket] || 0) 
                                                    : 0} รายชื่อ
                                            </span>
                                        </div>

                                        {/* Total count input & distribute button */}
                                        <div className="flex-[2_2_0%]">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                จำนวนที่ต้องการโอนทั้งหมด
                                            </label>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="number" 
                                                    min="1"
                                                    value={flex1toManyTotalTransferCount}
                                                    onChange={e => setFlex1toManyTotalTransferCount(e.target.value)}
                                                    placeholder="เช่น 50"
                                                    className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                                    disabled={!flex1toManyBasket}
                                                />
                                                <button
                                                    onClick={handleDistributeEvenly}
                                                    disabled={!flex1toManyTotalTransferCount || flex1toManyCheckedTargets.length === 0}
                                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:bg-gray-300 disabled:text-gray-500 text-sm font-medium whitespace-nowrap transition-colors"
                                                >
                                                    เฉลี่ยให้คนที่เลือก
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Target Agents */}
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-sm font-medium text-gray-700">เลือกพนักงานปลายทางที่ต้องการโอนให้</label>
                                            <div className="text-xs text-blue-600 font-medium">
                                                เลือกแล้ว {flex1toManyCheckedTargets.length} คน
                                            </div>
                                        </div>
                                        <div className="border rounded-xl max-h-60 overflow-y-auto divide-y bg-gray-50/50">
                                            {agents.filter(a => a.id !== flex1toManySourceAgent).map(agent => (
                                                <div key={agent.id} className={`p-3 flex items-center justify-between transition-colors ${flex1toManyCheckedTargets.includes(agent.id) ? 'bg-blue-50/50' : 'hover:bg-gray-100/50'}`}>
                                                    <div className="flex items-center gap-3">
                                                        <input 
                                                            type="checkbox"
                                                            checked={flex1toManyCheckedTargets.includes(agent.id)}
                                                            onChange={e => {
                                                                if (e.target.checked) {
                                                                    setFlex1toManyCheckedTargets(p => [...p, agent.id]);
                                                                } else {
                                                                    setFlex1toManyCheckedTargets(p => p.filter(id => id !== agent.id));
                                                                    setFlex1toManyTargets(p => {
                                                                        const newT = { ...p };
                                                                        delete newT[agent.id];
                                                                        return newT;
                                                                    });
                                                                }
                                                            }}
                                                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                                        />
                                                        <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xs uppercase cursor-default">
                                                            {agent.firstName.substring(0, 2)}
                                                        </div>
                                                        <div className="cursor-pointer" onClick={() => {
                                                            if (flex1toManyCheckedTargets.includes(agent.id)) {
                                                                setFlex1toManyCheckedTargets(p => p.filter(id => id !== agent.id));
                                                                setFlex1toManyTargets(p => {
                                                                    const newT = { ...p };
                                                                    delete newT[agent.id];
                                                                    return newT;
                                                                });
                                                            } else {
                                                                setFlex1toManyCheckedTargets(p => [...p, agent.id]);
                                                            }
                                                        }}>
                                                            <div className="font-semibold text-gray-800 text-sm">{agent.firstName} {agent.lastName}</div>
                                                            <div className="text-xs text-gray-400">ปัจจุบันมีรวม {agent.totalCustomers} รายการ</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-gray-500">รับเพิ่ม</span>
                                                        <input 
                                                            type="number" 
                                                            min="0"
                                                            value={flex1toManyTargets[agent.id] || ''}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                setFlex1toManyTargets(p => ({ ...p, [agent.id]: val }));
                                                                if (val && !flex1toManyCheckedTargets.includes(agent.id)) {
                                                                    setFlex1toManyCheckedTargets(p => [...p, agent.id]);
                                                                }
                                                            }}
                                                            placeholder="0"
                                                            className="w-20 border rounded-lg px-2 py-1.5 text-center text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex justify-between items-center mt-3 text-sm">
                                            <span className="text-gray-500">โอนรวมทั้งหมด:</span>
                                            <span className="font-bold text-blue-600 text-base">
                                                {Object.values(flex1toManyTargets).reduce((sum, val) => sum + (parseInt(val) || 0), 0)} รายชื่อ
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Target Agent (Many -> 1) */}
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">พนักงานปลายทาง (1 คน)</label>
                                        <select 
                                            value={flexManyto1TargetAgent || ''} 
                                            onChange={e => setFlexManyto1TargetAgent(parseInt(e.target.value) || null)}
                                            className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                        >
                                            <option value="">-- เลือกพนักงาน --</option>
                                            {agents.map(a => (
                                                <option key={a.id} value={a.id}>{a.firstName} {a.lastName} (ปัจจุบันมี {a.totalCustomers})</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Sources */}
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-sm font-medium text-gray-700">พนักงานต้นทางและถังงาน</label>
                                            <button 
                                                onClick={() => setFlexManyto1Sources(p => [...p, { id: Math.random().toString(), agentId: null, basketKey: '', count: '' }])}
                                                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold"
                                            >
                                                <Plus size={14} /> เพิ่มต้นทาง
                                            </button>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            {flexManyto1Sources.map((src, index) => {
                                                const agent = src.agentId ? agents.find(a => a.id === src.agentId) : null;
                                                const maxCount = agent && src.basketKey ? (agent.basketCounts?.[src.basketKey] || 0) : 0;
                                                
                                                return (
                                                    <div key={src.id} className="flex gap-2 items-end border p-3 rounded-lg bg-gray-50 relative group">
                                                        <div className="flex-1">
                                                            <label className="block text-xs text-gray-500 mb-1">จากพนักงาน</label>
                                                            <select 
                                                                value={src.agentId || ''} 
                                                                onChange={e => {
                                                                    const val = parseInt(e.target.value) || null;
                                                                    setFlexManyto1Sources(p => p.map((item, i) => i === index ? { ...item, agentId: val, basketKey: '' } : item));
                                                                }}
                                                                className="w-full border rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                                                            >
                                                                <option value="">-- พนักงาน --</option>
                                                                {agents.filter(a => a.id !== flexManyto1TargetAgent).map(a => (
                                                                    <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="flex-1">
                                                            <label className="block text-xs text-gray-500 mb-1">จากถัง</label>
                                                            <select 
                                                                value={src.basketKey} 
                                                                onChange={e => {
                                                                    setFlexManyto1Sources(p => p.map((item, i) => i === index ? { ...item, basketKey: e.target.value } : item));
                                                                }}
                                                                disabled={!src.agentId}
                                                                className="w-full border rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500 text-xs disabled:bg-gray-100"
                                                            >
                                                                <option value="">-- ถัง --</option>
                                                                {src.agentId && dashboardBaskets.map(b => {
                                                                    const count = agent?.basketCounts?.[b.basket_key] || 0;
                                                                    if (count === 0) return null;
                                                                    return <option key={b.basket_key} value={b.basket_key}>{b.basket_name} ({count})</option>
                                                                })}
                                                            </select>
                                                        </div>
                                                        <div className="w-24">
                                                            <label className="block text-xs text-gray-500 mb-1">จำนวน</label>
                                                            <input 
                                                                type="number" 
                                                                min="0"
                                                                value={src.count}
                                                                onChange={e => {
                                                                    setFlexManyto1Sources(p => p.map((item, i) => i === index ? { ...item, count: e.target.value } : item));
                                                                }}
                                                                disabled={!src.basketKey}
                                                                placeholder={`Max ${maxCount}`}
                                                                className="w-full border rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500 text-xs text-center disabled:bg-gray-100"
                                                            />
                                                        </div>
                                                        <button 
                                                            onClick={() => setFlexManyto1Sources(p => p.filter((_, i) => i !== index))}
                                                            className="h-8 w-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                            disabled={flexManyto1Sources.length === 1}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="flex justify-between items-center mt-3 text-sm">
                                            <span className="text-gray-500">โอนรวมทั้งหมด:</span>
                                            <span className="font-bold text-blue-600 text-base">
                                                {flexManyto1Sources.reduce((sum, val) => sum + (parseInt(val.count) || 0), 0)} รายชื่อ
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
                            <button
                                onClick={() => setFlexTransferModalOpen(false)}
                                className="px-5 py-2.5 rounded-lg hover:bg-gray-200 text-gray-600 font-medium transition-colors text-sm"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleExecuteFlexTransfer}
                                disabled={flexTransferring}
                                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-sm transition-colors text-sm"
                            >
                                {flexTransferring ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                ยืนยันโอนรายชื่อ
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {
                showPreview && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-auto">
                            <h3 className="text-xl font-bold mb-4">Preview การแจกงาน</h3>

                            {/* Distribution Modes */}
                            <div className="mb-4">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">เลือกนโยบายการแจก (Distribution Mode)</label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                                    {/* Equal Mode */}
                                    <div 
                                        onClick={() => setDistributionMode('equal')}
                                        className={`border rounded-xl p-3 cursor-pointer transition-all ${distributionMode === 'equal' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <Scale className={distributionMode === 'equal' ? 'text-blue-600' : 'text-gray-500'} size={18} />
                                            <span className="font-semibold text-sm text-gray-800">Equal (เท่ากันทุกคน)</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mb-2 leading-tight">ทำยังไง: นำรายชื่อหารจำนวนคนตรงๆ ทุกคนได้เท่ากัน</p>
                                    </div>
                                    
                                    {/* Load Balance Mode */}
                                    <div 
                                        onClick={() => setDistributionMode('load_balance')}
                                        className={`border rounded-xl p-3 cursor-pointer transition-all ${distributionMode === 'load_balance' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <Zap className={distributionMode === 'load_balance' ? 'text-blue-600' : 'text-gray-500'} size={18} />
                                            <span className="font-semibold text-sm text-gray-800">Load Balance</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mb-2 leading-tight">ทำยังไง: ดูยอดลูกค้าปัจจุบัน ใครถือน้อยจะได้เยอะเพื่อบาลานซ์</p>
                                    </div>

                                    {/* Performance Mode */}
                                    <div 
                                        onClick={() => setDistributionMode('performance')}
                                        className={`border rounded-xl p-3 cursor-pointer transition-all ${distributionMode === 'performance' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <TrendingUp className={distributionMode === 'performance' ? 'text-blue-600' : 'text-gray-500'} size={18} />
                                            <span className="font-semibold text-sm text-gray-800">Performance (ความขยัน)</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mb-2 leading-tight">ทำยังไง: อิงยอด 'เวลาโทร' คนโทรเยอะจะได้สัดส่วนลูกค้าเยอะ</p>
                                    </div>
                                </div>

                                {distributionMode === 'equal' && (
                                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer w-fit">
                                        <input 
                                            type="checkbox" 
                                            checked={distributeRemainder}
                                            onChange={(e) => setDistributeRemainder(e.target.checked)}
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span>กระจายเศษรายชื่อที่หารไม่ลงตัวให้พนักงาน (คนแรกๆ จะได้ +1)</span>
                                    </label>
                                )}
                            </div>

                            {previewWarning && (
                                <div className="mb-6 p-4 bg-orange-50 border border-orange-200 text-orange-800 rounded-xl text-sm">
                                    {previewWarning}
                                </div>
                            )}

                            {/* Summary Dashboard */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
                                    <div>
                                        <div className="text-blue-600 font-semibold text-2xl">{preview.filter(p => p.customers.length > 0).length} คน</div>
                                        <div className="text-sm text-blue-800">พนักงานที่ได้รับการแจก</div>
                                    </div>
                                    <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center text-blue-600">
                                        <Check size={20} />
                                    </div>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                                    <div>
                                        <div className="text-gray-600 font-semibold text-2xl">{preview.filter(p => p.customers.length === 0).length} คน</div>
                                        <div className="text-sm text-gray-500">พนักงานที่ไม่ได้การแจก (ได้ 0 คน)</div>
                                    </div>
                                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500">
                                        <Minus size={20} />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 mb-6">
                                {preview.filter(item => item.customers.length > 0).map(item => (
                                    <div key={item.agentId} className="border border-blue-200 bg-blue-50/30 rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-semibold text-blue-900">{item.agentName}</span>
                                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">{item.customers.length} รายชื่อ</span>
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            {item.customers.slice(0, 5).map(c => `${c.firstName} ${c.lastName}`).join(', ')}
                                            {item.customers.length > 5 && <span className="text-gray-400"> และอีก {item.customers.length - 5} คน</span>}
                                        </div>
                                    </div>
                                ))}

                                {/* Agents who received 0 */}
                                {preview.filter(item => item.customers.length === 0).length > 0 && (
                                    <>
                                        <h4 className="text-sm font-semibold text-gray-500 mt-6 mb-2">พนักงานที่ไม่ได้รับการแจกรายชื่อในรอบนี้:</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {preview.filter(item => item.customers.length === 0).map(item => (
                                                <div key={item.agentId} className="border border-gray-200 bg-gray-50 text-gray-500 px-3 py-1.5 rounded-lg text-sm flex items-center gap-2">
                                                    {item.agentName} <span className="bg-gray-200 text-gray-500 text-xs px-1.5 py-0.5 rounded">0</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="flex justify-between items-center pt-4 border-t">
                                <div className="text-gray-600">
                                    รวมทั้งหมด: {preview.reduce((sum, p) => sum + p.customers.length, 0)} รายชื่อ
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowPreview(false)}
                                        className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        onClick={() => handleExecuteDistribution()}
                                        disabled={distributing}
                                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {distributing ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                        ยืนยันแจกงาน
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Confirmation Modal */}
            {
                confirmModal.isOpen && (
                    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-xl max-w-md w-full animate-in zoom-in-95 duration-200 overflow-hidden">
                            <div className={`p-4 border-b flex items-center gap-3 ${confirmModal.variant === 'danger' ? 'bg-red-50 border-red-100' :
                                confirmModal.variant === 'warning' ? 'bg-orange-50 border-orange-100' :
                                    'bg-gray-50'
                                }`}>
                                {confirmModal.variant === 'danger' && <AlertCircle className="text-red-600" />}
                                {confirmModal.variant === 'warning' && <AlertCircle className="text-orange-600" />}
                                <h3 className={`font-bold ${confirmModal.variant === 'danger' ? 'text-red-800' :
                                    confirmModal.variant === 'warning' ? 'text-orange-800' :
                                        'text-gray-800'
                                    }`}>
                                    {confirmModal.title}
                                </h3>
                            </div>

                            <div className="p-6 text-gray-700">
                                {confirmModal.message}
                            </div>

                            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                                <button
                                    onClick={closeConfirmModal}
                                    className="px-4 py-2 border rounded-lg hover:bg-gray-100 text-gray-700 font-medium"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={confirmModal.onConfirm}
                                    className={`px-4 py-2 rounded-lg text-white font-medium shadow-sm flex items-center gap-2 ${confirmModal.confirmColor === 'red' ? 'bg-red-600 hover:bg-red-700' :
                                        confirmModal.confirmColor === 'orange' ? 'bg-orange-600 hover:bg-orange-700' :
                                            'bg-blue-600 hover:bg-blue-700'
                                        }`}
                                >
                                    {confirmModal.confirmLabel || 'ยืนยัน'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* History Modal */}
            {
                historyModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-gray-800">ประวัติการแจกงาน</h3>
                                    <p className="text-xs text-gray-500">{viewingCustomer?.code} - {viewingCustomer?.name}</p>
                                </div>
                                <button onClick={() => setHistoryModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto p-0">
                                {historyLoading ? (
                                    <div className="py-8 flex justify-center">
                                        <Loader2 className="animate-spin text-blue-500" />
                                    </div>
                                ) : historyData.length === 0 ? (
                                    <div className="py-8 text-center text-gray-400 text-sm">ไม่พบประวัติ</div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 text-gray-500 font-medium sticky top-0">
                                            <tr>
                                                <th className="p-3 text-left pl-6">พนักงานที่ได้รับ</th>
                                                <th className="p-3 text-right pr-6">วันที่ได้รับ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {historyData.map((h, i) => (
                                                <tr key={i}>
                                                    <td className="p-3 pl-6 text-gray-800">{h.first_name} {h.last_name}</td>
                                                    <td className="p-3 pr-6 text-right text-gray-500">
                                                        {new Date(h.created_at).toLocaleDateString('th-TH', {
                                                            day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            <div className="p-3 border-t bg-gray-50 text-right">
                                <button onClick={() => setHistoryModalOpen(false)} className="px-3 py-1.5 bg-white border rounded text-sm hover:bg-gray-50">ปิด</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Bulk Result Modal */}
            {bulkResultModal && bulkResultModal.isOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80] p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-6 border-b bg-gray-50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-100 text-green-600 rounded-xl flex items-center justify-center">
                                    <Check size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 text-lg">{bulkResultModal.title}</h3>
                                    <p className="text-sm text-gray-500">ดำเนินการเสร็จสิ้น</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex flex-col items-center justify-center">
                                <div className="text-3xl font-black text-blue-700">{bulkResultModal.total.toLocaleString()}</div>
                                <div className="text-sm text-blue-600/80 font-medium mt-1">รายชื่อทั้งหมด</div>
                            </div>
                            
                            {bulkResultModal.results && bulkResultModal.results.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-bold text-gray-700 mb-3">รายละเอียดการทำรายการ</h4>
                                    <div className="space-y-3">
                                        {bulkResultModal.results.map((r, i) => {
                                            const bname = dashboardBaskets.find(b => b.basket_key === r.basket_key)?.basket_name || r.basket_key;
                                            const val = r.reclaimed || r.transferred || 0;
                                            return (
                                                <div key={i} className="flex flex-col p-3 bg-gray-50 rounded-lg border border-gray-100">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-sm font-bold text-gray-800">ตะกร้า: {bname}</span>
                                                        <span className="text-sm font-bold text-blue-600">{val.toLocaleString()} รายชื่อ</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                                                        <div className="bg-white px-2 py-1.5 border rounded flex-1 truncate shadow-sm">
                                                            จาก: <span className="font-semibold text-gray-700">{bulkResultModal.fromAgentName}</span>
                                                        </div>
                                                        <ArrowRight size={14} className="text-gray-400 shrink-0" />
                                                        <div className="bg-white px-2 py-1.5 border rounded flex-1 truncate shadow-sm">
                                                            ไปที่: <span className="font-semibold text-gray-700">{bulkResultModal.toName}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t bg-white flex justify-end">
                            <button 
                                onClick={() => setBulkResultModal(null)}
                                className="px-6 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                ปิด
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Blocked Customers Modal */}
            <BlockedCustomersModal
                isOpen={blockedModalOpen}
                onClose={() => setBlockedModalOpen(false)}
                blockedCustomers={blockedCustomers}
                loading={loadingBlocked}
                baskets={baskets.map(b => ({ id: b.id, basket_key: b.basket_key, basket_name: b.basket_name }))}
                currentUserId={currentUser?.id || 0}
                companyId={currentUser?.companyId || 0}
                onUnblockSuccess={() => {
                    fetchBlockedCustomers();
                    fetchAllBasketCounts();
                }}
            />

            {/* Export Format Modal */}
            <ExportTypeModal
                isOpen={isExportTypeModalOpen}
                onClose={() => !isExporting && setIsExportTypeModalOpen(false)}
                onConfirm={executeExport}
                isExporting={isExporting}
            />
        </div >
    );
};

export default CustomerDistributionV2;
