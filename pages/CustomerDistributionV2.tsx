import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../services/api';
import { User, Customer, UserRole } from '../types';
import {
    Users, Package, Search, ChevronDown, Check, Loader2, AlertCircle,
    RefreshCw, Eye, Database, ArrowRightLeft, Plus, Trash2, Download, ArrowRight, Filter,
    Zap, Scale, TrendingUp, Minus, History, CalendarClock, Phone
} from 'lucide-react';
import UniversalDateRangePicker, { DateRange } from '../components/UniversalDateRangePicker';
import resolveApiBasePath from '../utils/apiBasePath';
import ExportTypeModal from '../components/ExportTypeModal';
import { downloadDataFile } from '../utils/exportUtils';
import { mapCustomerFromApi } from '../utils/customerMapper';
import Spinner from '../components/Spinner';
import BlockedCustomersModal from '../components/BlockedCustomersModal';
import ExcelJS from 'exceljs';
import { calculateQuotas } from '../utils/distributionLogic';
import ConfirmModal from '../components/DistributionV2/ConfirmModal';
import HistoryModal from '../components/DistributionV2/HistoryModal';
import SessionTagSelect from '../components/DistributionV2/SessionTagSelect';
import TagManagementModal from '../components/DistributionV2/TagManagementModal';
import BulkResultModal from '../components/DistributionV2/BulkResultModal';
import SummaryModal from '../components/DistributionV2/SummaryModal';
import ResetModal from '../components/DistributionV2/ResetModal';
import ReclaimModal from '../components/DistributionV2/ReclaimModal';
import FlexTransferModal from '../components/DistributionV2/FlexTransferModal';
import PreviewModal from '../components/DistributionV2/PreviewModal';
import DistributionStatsCards from '../components/DistributionV2/DistributionStatsCards';
import DistributionSettingsPanel from '../components/DistributionV2/DistributionSettingsPanel';
import DistributionTelesaleTable from '../components/DistributionV2/DistributionTelesaleTable';
import DistributionCustomerPreview from '../components/DistributionV2/DistributionCustomerPreview';
import DistributionReportModal from '../components/DistributionV2/DistributionReportModal';
import CronLogModal from '../components/DistributionV2/CronLogModal';

import { 
    BasketConfig, 
    DistributionPreview, 
    AgentWithBaskets, 
    ResetCandidate, 
    SummaryStats, 
    AssignHistory 
} from '../types/distribution';

interface CustomerDistributionV2Props {
    currentUser?: User | null;
}

const CustomerDistributionV2: React.FC<CustomerDistributionV2Props> = ({ currentUser }) => {
    // Data
    const [baskets, setBaskets] = useState<BasketConfig[]>([]);
    const [dashboardBaskets, setDashboardBaskets] = useState<BasketConfig[]>([]);
    const [basketCounts, setBasketCounts] = useState<Record<string, number>>({});
    const [activeBasket, setActiveBasket] = useState<string>('');
    const [strictDuplicateCheck, setStrictDuplicateCheck] = useState(false);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [agents, setAgents] = useState<AgentWithBaskets[]>([]);
    const [selectedAgents, setSelectedAgents] = useState<number[]>([]);
    const [agentSupervisorFilter, setAgentSupervisorFilter] = useState<number | ''>('');
    const [targetBasket, setTargetBasket] = useState<string>('');
    const [forceDistributeHolding, setForceDistributeHolding] = useState(false);
    const [distributionExportRange, setDistributionExportRange] = useState<DateRange>({ start: '', end: '' });
    const [isExportTypeModalOpen, setIsExportTypeModalOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [sessionTag, setSessionTag] = useState<number | ''>('');
    const [sessionTagsList, setSessionTagsList] = useState<any[]>([]);

    // UI state
    const [loading, setLoading] = useState(true);
    const [loadingBasketCounts, setLoadingBasketCounts] = useState(false);
    const [loadingCustomers, setLoadingCustomers] = useState(false);
    const [loadingAgents, setLoadingAgents] = useState(false);
    const [distributing, setDistributing] = useState(false);
    const [totalToDistribute, setTotalToDistribute] = useState<string>('');
    const [callThresholdMinutes, setCallThresholdMinutes] = useState<string>('100');
    const [hasCallFilterApplied, setHasCallFilterApplied] = useState<boolean>(false);
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
    const [loadingCallMinutes, setLoadingCallMinutes] = useState(false);

    // Called History Filter State
    const [calledFilterDays, setCalledFilterDays] = useState<string>(''); // '', '30', '60', 'custom'
    const [calledFilterCustomDays, setCalledFilterCustomDays] = useState<string>('');
    const [calledFilterMode, setCalledFilterMode] = useState<'include' | 'exclude'>('exclude');

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
    const [tagManagementModalOpen, setTagManagementModalOpen] = useState(false);
    const [isReportModalOpen, setReportModalOpen] = useState(false);
    const [isCronLogModalOpen, setCronLogModalOpen] = useState(false);
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

    const fetchSessionTags = useCallback(async () => {
        try {
            const response = await apiFetch(`Distribution/index.php?action=get_session_tags&companyId=${currentUser?.companyId}`);
            if (response?.ok && response.tags) {
                setSessionTagsList(response.tags);
            }
        } catch (error) {
            console.error('Failed to fetch session tags:', error);
        }
    }, [currentUser?.companyId]);

    useEffect(() => {
        fetchSessionTags();
    }, [fetchSessionTags]);

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

        setLoadingBasketCounts(true);
        const actualCalledFilterDays = calledFilterDays === 'custom' ? calledFilterCustomDays : calledFilterDays;
        const calledFilterParams = actualCalledFilterDays ? `&called_filter_days=${actualCalledFilterDays}&called_filter_mode=${calledFilterMode}` : '';

        const counts: Record<string, number> = {};
        await Promise.all(baskets.map(async (basket) => {
            try {
                if (basket.basket_key === 'block_customer') {
                    // Blocked customers use separate API (basket_customers filters is_blocked=0)
                    const res = await apiFetch(`get_blocked_customers.php?company_id=${currentUser?.companyId}`);
                    counts[basket.basket_key] = res?.success ? (res.data?.length || 0) : 0;
                } else {
                    const response = await apiFetch(
                        `basket_config.php?action=basket_customers&basket_key=${basket.basket_key}&companyId=${currentUser?.companyId}&limit=1&t=${Date.now()}${calledFilterParams}`
                    );
                    counts[basket.basket_key] = response?.count || 0;
                }
            } catch {
                counts[basket.basket_key] = 0;
            }
        }));
        setBasketCounts(counts);
        setLoadingBasketCounts(false);
    }, [baskets, currentUser?.companyId, calledFilterDays, calledFilterCustomDays, calledFilterMode]);

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
                    supervisorId: u.supervisor_id || u.supervisorId,
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
            const actualCalledFilterDays = calledFilterDays === 'custom' ? calledFilterCustomDays : calledFilterDays;
            const calledFilterParams = actualCalledFilterDays ? `&called_filter_days=${actualCalledFilterDays}&called_filter_mode=${calledFilterMode}` : '';

            const response = await apiFetch(
                `basket_config.php?action=basket_customers&basket_key=${activeBasket}&companyId=${currentUser?.companyId}&limit=50000${calledFilterParams}`
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
        
        // Pass the subset of 'agents' based on 'selectedAgents'
        // 'agents' is of type AgentWithBaskets[], we map it to AgentData expected by calculateQuotas
        const mappedAgents = selectedAgents.map(id => {
            const ag = agents.find(a => a.id === id);
            return {
                id,
                totalCustomers: ag?.totalCustomers || 0,
                callMinutes: ag?.callMinutes || 0
            };
        });

        const newQuotas = calculateQuotas({
            selectedAgents,
            agents: mappedAgents,
            totalToDistribute: total,
            distributionMode,
            distributeRemainder
        });

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

    // Memoize available supervisors to prevent recalculation on every render (Best Practice)
    const availableSupervisors = useMemo(() => {
        const uniqueIds = Array.from(new Set(agents.map(a => a.supervisorId).filter(id => id))) as number[];
        return uniqueIds.map(id => {
            const supervisor = agents.find(a => a.id === id);
            return {
                id,
                name: supervisor ? `${supervisor.firstName} ${supervisor.lastName}` : `Supervisor ID: ${id}`
            };
        });
    }, [agents]);

    // Filter agents for display
    const displayAgents = useMemo(() => {
        if (agentSupervisorFilter) {
            return agents.filter(a => a.supervisorId === agentSupervisorFilter);
        }
        return agents;
    }, [agents, agentSupervisorFilter]);

    // Select all agents (only active ones in current view)
    const activeAgents = displayAgents.filter(a => a.isActive);
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
            const customerIds = customerPool.map(c => c.customer_id?.toString() || c.id);

            if (customerIds.length > 0) {
                // Chunk the customerIds to prevent API payload/PDO limits
                const CHUNK_SIZE = 3000;
                for (let i = 0; i < customerIds.length; i += CHUNK_SIZE) {
                    const chunk = customerIds.slice(i, i + CHUNK_SIZE);
                    const res = await apiFetch(
                        `Distribution/index.php?action=get_assign_checks&companyId=${currentUser?.companyId}`,
                        {
                            method: 'POST',
                            body: JSON.stringify({ customer_ids: chunk })
                        }
                    );
                    if (res?.ok && res.conflicts) {
                        conflictMap = { ...conflictMap, ...res.conflicts };
                    }
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
                .filter(id => quota[id] > 0 && (!strictDuplicateCheck || !conflictSet.has(id)))
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

            const actualCalledFilterDays = calledFilterDays === 'custom' ? calledFilterCustomDays : calledFilterDays;
            const calledFilterParams = actualCalledFilterDays ? `&called_filter_days=${actualCalledFilterDays}&called_filter_mode=${calledFilterMode}` : '';

            // Fetch
            const fetchResult = await apiFetch(`basket_config.php?action=basket_customers&basket_key=${activeBasket}&companyId=${currentUser?.companyId}&limit=${needyAgents.length}&skip=${skipCount}${calledFilterParams}`);

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

            // Build Agent Snapshot
            const agentSnapshot = agents.map(a => ({
                id: a.id,
                name: `${a.firstName} ${a.lastName}`,
                role: a.role,
                callMinutes: a.callMinutes || 0,
                isActive: a.isActive
            }));

            const result = await apiFetch(
                `Distribution/index.php?action=distribute&companyId=${currentUser?.companyId}`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        assignments,
                        source_basket_key: activeBasket,
                        target_basket_key: targetBasket || undefined,
                        triggered_by: (currentUser as any)?.id,
                        distribution_mode: distributionMode,
                        min_call_minutes: hasCallFilterApplied ? parseInt(callThresholdMinutes) : null,
                        strict_duplicate_check: strictDuplicateCheck,
                        agent_snapshot: agentSnapshot,
                        tag_id: sessionTag === '' ? null : sessionTag
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
            fetchSessionTags();

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
    const [bulkActionType, setBulkActionType] = useState<'transfer' | 'reclaim' | null>(null);
    const [bulkFilterType, setBulkFilterType] = useState<'all' | 'no_call_no_appt' | 'called_no_appt' | 'called_with_appt'>('all');
    const [bulkTargetAgents, setBulkTargetAgents] = useState<number[]>([]);
    const [bulkTargetSupervisorFilter, setBulkTargetSupervisorFilter] = useState<number | ''>('');
    const [bulkLimit, setBulkLimit] = useState<string>('');
    const [bulkReclaimDestinationType, setBulkReclaimDestinationType] = useState<'auto' | 'force'>('auto');
    const [bulkForceBasketKey, setBulkForceBasketKey] = useState<string>('');

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
        setBulkTargetAgents([]); // Reset target agents
        setBulkTargetSupervisorFilter(''); // Reset supervisor filter
        setBulkLimit(''); // Reset limit
        setBulkReclaimDestinationType('auto'); // Reset destination type
        setBulkForceBasketKey(''); // Reset force basket key
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
        setBulkTargetAgents([]);
        setBulkTargetSupervisorFilter('');
        setBulkLimit('');
        setBulkReclaimDestinationType('auto');
        setBulkForceBasketKey('');
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
            if (bulkFilterType === 'no_call_no_appt') return reclaimPreviewNoCallNoAppt[key] || 0;
            if (bulkFilterType === 'called_no_appt') return reclaimPreviewCalledNoAppt[key] || 0;
            if (bulkFilterType === 'called_with_appt') return reclaimPreviewCalledWithAppt[key] || 0;
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
            if (bulkTargetAgents.length === 0) {
                setMessage({ type: 'error', text: 'กรุณาเลือกพนักงานปลายทางสำหรับการโอน' });
                return;
            }
            
            // Build transfer payload and distribute evenly among target agents
            const transfers: any[] = [];
            selectedBaskets.forEach(key => {
                const availableCount = getAvailableCount(key);
                const count = hasLimit ? Math.min(limitVal, availableCount) : availableCount;
                if (count > 0) {
                    const baseCount = Math.floor(count / bulkTargetAgents.length);
                    let remainder = count % bulkTargetAgents.length;

                    bulkTargetAgents.forEach(targetId => {
                        let agentCount = baseCount;
                        if (remainder > 0) {
                            agentCount += 1;
                            remainder -= 1;
                        }
                        if (agentCount > 0) {
                            transfers.push({
                                from_agent_id: reclaimingAgent.id,
                                to_agent_id: targetId,
                                basket_key: key,
                                count: agentCount
                            });
                        }
                    });
                }
            });
            
            if (transfers.length === 0) return;

            setTransferring(true);
            try {
                const result = await apiFetch(
                    `basket_config.php?action=transfer_customers&companyId=${currentUser?.companyId}`,
                    {
                        method: 'POST',
                        body: JSON.stringify({ 
                            transfers,
                            transfer_mode: bulkFilterType,
                            tag_id: sessionTag === '' ? null : sessionTag 
                        })
                    }
                );
                if (result?.error) throw new Error(result.error);

                const targetNames = bulkTargetAgents
                    .map(id => {
                        const a = agents.find(ag => ag.id === id);
                        return a ? `${a.firstName} ${a.lastName}` : 'ไม่ทราบชื่อ';
                    })
                    .join(', ');

                fetchSessionTags();
                setBulkResultModal({
                    isOpen: true,
                    title: 'สรุปผลการโอนลูกค้า',
                    type: 'transfer',
                    fromAgentName: `${reclaimingAgent.firstName} ${reclaimingAgent.lastName}`,
                    toName: targetNames || 'พนักงานปลายทาง',
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
            setReclaiming(true);
            try {
                const result = await apiFetch(
                    `basket_config.php?action=reclaim_customers&companyId=${currentUser?.companyId}`,
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            agent_id: reclaimingAgent.id,
                            baskets: payloadBaskets,
                            reclaim_mode: bulkFilterType,
                            reclaim_destination: bulkReclaimDestinationType,
                            force_basket_key: bulkReclaimDestinationType === 'force' ? bulkForceBasketKey : null,
                            triggered_by: currentUser?.id,
                            tag_id: sessionTag === '' ? null : sessionTag
                        })
                    }
                );
                if (result?.error) throw new Error(result.error);

                let toNameDisplay = 'ถังอัตโนมัติ (Linked Pool)';
                if (bulkReclaimDestinationType === 'force') {
                    if (bulkForceBasketKey === 'holding_before_redistribute') {
                        toNameDisplay = 'ถังพักรอแจก';
                    } else if (bulkForceBasketKey === 'upsell_dis') {
                        toNameDisplay = 'Upsell (Distribution)';
                    } else {
                        toNameDisplay = dashboardBaskets.find(b => b.basket_key === bulkForceBasketKey)?.basket_name || 'ถังกลาง (Pool)';
                    }
                }

                fetchSessionTags();
                setBulkResultModal({
                    isOpen: true,
                    title: 'สรุปผลการดึงคืนลูกค้า',
                    type: 'reclaim',
                    fromAgentName: `${reclaimingAgent.firstName} ${reclaimingAgent.lastName}`,
                    toName: toNameDisplay,
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
                        reclaim_mode: unassignedReclaimMode,
                        tag_id: sessionTag === '' ? null : sessionTag
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
                        onClick={() => setReportModalOpen(true)}
                        className="px-4 py-2 text-sm bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 flex items-center gap-2 font-medium transition-colors"
                    >
                        <History size={16} />
                        ประวัติการแจกงาน
                    </button>
                    
                        <button
                            onClick={() => setCronLogModalOpen(true)}
                            className="px-4 py-2 text-sm bg-teal-50 text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-100 flex items-center gap-2 font-medium transition-colors"
                            title="ประวัติโอนย้ายสิ้นเดือน (Cron)"
                        >
                            <CalendarClock size={16} />
                            ประวัติ Cron
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
            <ResetModal 
                isOpen={resetModalOpen}
                onClose={() => setResetModalOpen(false)}
                resetAgentDropdownOpen={resetAgentDropdownOpen}
                setResetAgentDropdownOpen={setResetAgentDropdownOpen}
                resetTargetCount={resetTargetCount}
                setResetTargetCount={setResetTargetCount}
                resetOptions={resetOptions}
                handleCheckCandidates={handleCheckCandidates}
                findingCandidates={findingCandidates}
                resetSearchText={resetSearchText}
                setResetSearchText={setResetSearchText}
                resetAgentFilter={resetAgentFilter}
                setResetAgentFilter={setResetAgentFilter}
                resetAgentMode={resetAgentMode}
                setResetAgentMode={setResetAgentMode}
                resetAgentOptions={resetAgentOptions}
                resetCandidates={resetCandidates}
                resetTotal={resetTotal}
                toggleAllResetCandidates={toggleAllResetCandidates}
                allResetSelected={allResetSelected}
                toggleResetCandidate={toggleResetCandidate}
                handleViewHistory={handleViewHistory}
                resetTotalPages={resetTotalPages}
                resetPage={resetPage}
                changeResetPage={changeResetPage}
                handleManualReset={handleManualReset}
                resetting={resetting}
            />

            {/* Summary Modal (Distribution Result) */}
            <SummaryModal 
                isOpen={summaryModalOpen}
                summaryStats={summaryStats}
                onClose={closeSummaryModal}
                onExport={handleExportSummary}
                onDistributeMore={handleDistributeMore}
                distributing={distributing}
            />
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

            {/* Global Filters (Applies to Cards & Distribution) */}
            <div className="mb-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Phone size={18} className="text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">ประวัติการโทร:</span>
                    </div>
                    
                    <select 
                        value={calledFilterDays}
                        onChange={(e) => setCalledFilterDays(e.target.value)}
                        className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="">ทั้งหมด (ไม่กรอง)</option>
                        <option value="1">เมื่อวาน (1 วัน)</option>
                        <option value="3">3 วันที่ผ่านมา</option>
                        <option value="7">สัปดาห์ที่แล้ว (7 วัน)</option>
                        <option value="14">2 สัปดาห์ที่ผ่านมา (14 วัน)</option>
                        <option value="30">1 เดือนที่ผ่านมา (30 วัน)</option>
                        <option value="60">2 เดือนที่ผ่านมา (60 วัน)</option>
                        <option value="90">3 เดือนที่ผ่านมา (90 วัน)</option>
                        <option value="custom">กำหนดจำนวนวันเอง...</option>
                    </select>

                    {calledFilterDays === 'custom' && (
                        <input 
                            type="number"
                            min="1"
                            value={calledFilterCustomDays}
                            onChange={(e) => setCalledFilterCustomDays(e.target.value)}
                            placeholder="จำนวนวัน"
                            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 w-24 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    )}

                    {calledFilterDays !== '' && (
                        <div className="flex items-center gap-2 ml-4 bg-gray-50 px-3 py-1 rounded-lg border border-gray-200">
                            <label className="flex items-center gap-1 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="calledMode"
                                    checked={calledFilterMode === 'exclude'}
                                    onChange={() => setCalledFilterMode('exclude')}
                                    className="text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">ซ่อนคนที่โทรแล้ว</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer ml-3">
                                <input 
                                    type="radio" 
                                    name="calledMode"
                                    checked={calledFilterMode === 'include'}
                                    onChange={() => setCalledFilterMode('include')}
                                    className="text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">เอาเฉพาะคนที่โทรแล้ว</span>
                            </label>
                        </div>
                    )}
                </div>
            </div>

            {/* Stats Cards - All Baskets in Grid */}
            <DistributionStatsCards
                baskets={baskets}
                basketCounts={basketCounts}
                activeBasket={activeBasket}
                setActiveBasket={(key) => {
                    if (key === 'block_customer') {
                        handleBlockedBasketClick();
                    } else {
                        setActiveBasket(key);
                    }
                }}
                totalInAllBaskets={totalInAllBaskets}
                handleBlockedBasketClick={handleBlockedBasketClick}
                forceDistributeHolding={forceDistributeHolding}
                setForceDistributeHolding={setForceDistributeHolding}
                setTargetBasket={setTargetBasket}
                loadingBasketCounts={loadingBasketCounts}
            />
            {/* Section 1: Distribution Settings */}
            {!isHoldingBasketActive && (
                <DistributionSettingsPanel
                    strictDuplicateCheck={strictDuplicateCheck}
                    setStrictDuplicateCheck={setStrictDuplicateCheck}
                    baskets={baskets}
                    basketCounts={basketCounts}
                    activeBasket={activeBasket}
                    setActiveBasket={setActiveBasket}
                    totalToDistribute={totalToDistribute}
                    setTotalToDistribute={setTotalToDistribute}
                    availableCount={availableCount}
                    loadingCustomers={loadingCustomers}
                    fetchAllBasketCounts={fetchAllBasketCounts}
                    fetchCustomers={fetchCustomers}
                    fetchAgents={fetchAgents}
                />
            )}
            {/* Section 2: Target Employees - Table Layout */}
            {!isHoldingBasketActive && (
                <DistributionTelesaleTable
                    agents={agents}
                    setAgents={setAgents}
                    selectedAgents={selectedAgents}
                    setSelectedAgents={setSelectedAgents}
                    totalToDistribute={totalToDistribute}
                    dashboardBaskets={dashboardBaskets}
                    availableCount={availableCount}
                    callThresholdMinutes={callThresholdMinutes}
                    setCallThresholdMinutes={setCallThresholdMinutes}
                    setHasCallFilterApplied={setHasCallFilterApplied}
                    handlePreparePreview={handlePreparePreview}
                    openReclaimModal={openReclaimModal}
                    setMessage={setMessage}
                    currentUser={currentUser}
                />
            )}
            {/* Customer Preview Table */}
            <DistributionCustomerPreview
                activeBasketInfo={activeBasketInfo}
                availableCount={availableCount}
                customers={customers}
                loadingCustomers={loadingCustomers}
                fetchCustomers={fetchCustomers}
            />

            {/* Reclaim Modal */}
            <ReclaimModal 
                isOpen={reclaimModalOpen}
                reclaimingAgent={reclaimingAgent}
                onClose={() => setReclaimModalOpen(false)}
                dashboardBaskets={dashboardBaskets}
                selectedBaskets={selectedBaskets}
                setSelectedBaskets={setSelectedBaskets}
                loadingReclaimPreviews={loadingReclaimPreviews}
                reclaimPreviewNoCallNoAppt={reclaimPreviewNoCallNoAppt}
                reclaimPreviewCalledNoAppt={reclaimPreviewCalledNoAppt}
                reclaimPreviewCalledWithAppt={reclaimPreviewCalledWithAppt}
                bulkActionType={bulkActionType}
                setBulkActionType={setBulkActionType}
                bulkFilterType={bulkFilterType}
                setBulkFilterType={setBulkFilterType}
                bulkTargetSupervisorFilter={bulkTargetSupervisorFilter}
                setBulkTargetSupervisorFilter={setBulkTargetSupervisorFilter}
                availableSupervisors={availableSupervisors}
                bulkTargetAgents={bulkTargetAgents}
                setBulkTargetAgents={setBulkTargetAgents}
                agents={agents}
                bulkLimit={bulkLimit}
                setBulkLimit={setBulkLimit}
                bulkReclaimDestinationType={bulkReclaimDestinationType}
                setBulkReclaimDestinationType={setBulkReclaimDestinationType}
                bulkForceBasketKey={bulkForceBasketKey}
                setBulkForceBasketKey={setBulkForceBasketKey}
                handleExecuteBulkAction={handleExecuteBulkAction}
                reclaiming={reclaiming}
                transferring={transferring}
                sessionTag={sessionTag}
                setSessionTag={setSessionTag}
                sessionTagsList={sessionTagsList}
            />


            {/* Flexible Transfer Modal */}
            <FlexTransferModal 
                isOpen={flexTransferModalOpen}
                onClose={() => setFlexTransferModalOpen(false)}
                flexTransferMode={flexTransferMode}
                setFlexTransferMode={setFlexTransferMode}
                flex1toManySourceAgent={flex1toManySourceAgent}
                setFlex1toManySourceAgent={setFlex1toManySourceAgent}
                flex1toManyBasket={flex1toManyBasket}
                setFlex1toManyBasket={setFlex1toManyBasket}
                flex1toManyTotalTransferCount={flex1toManyTotalTransferCount}
                setFlex1toManyTotalTransferCount={setFlex1toManyTotalTransferCount}
                flex1toManyTargets={flex1toManyTargets}
                setFlex1toManyTargets={setFlex1toManyTargets}
                flex1toManyCheckedTargets={flex1toManyCheckedTargets}
                setFlex1toManyCheckedTargets={setFlex1toManyCheckedTargets}
                flexManyto1TargetAgent={flexManyto1TargetAgent}
                setFlexManyto1TargetAgent={setFlexManyto1TargetAgent}
                flexManyto1Sources={flexManyto1Sources}
                setFlexManyto1Sources={setFlexManyto1Sources}
                agents={agents}
                dashboardBaskets={dashboardBaskets}
                handleDistributeEvenly={handleDistributeEvenly}
                handleExecuteFlexTransfer={handleExecuteFlexTransfer}
                flexTransferring={flexTransferring}
            />

            {/* Preview Modal */}
            <PreviewModal 
                showPreview={showPreview}
                setShowPreview={setShowPreview}
                distributionMode={distributionMode}
                setDistributionMode={setDistributionMode}
                distributeRemainder={distributeRemainder}
                setDistributeRemainder={setDistributeRemainder}
                previewWarning={previewWarning}
                preview={preview}
                distributing={distributing}
                handleExecuteDistribution={handleExecuteDistribution}
                sessionTag={sessionTag}
                setSessionTag={setSessionTag}
                sessionTagsList={sessionTagsList}
            />

            {/* Confirmation Modal */}
            <ConfirmModal modalState={confirmModal} onClose={closeConfirmModal} />

            {/* History Modal */}
            <HistoryModal 
                isOpen={historyModalOpen}
                onClose={() => setHistoryModalOpen(false)}
                viewingCustomer={viewingCustomer}
                historyLoading={historyLoading}
                historyData={historyData}
            />

            {/* Bulk Result Modal */}
            <BulkResultModal 
                modalState={bulkResultModal}
                onClose={() => setBulkResultModal(null)}
                dashboardBaskets={dashboardBaskets}
            />

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

            <DistributionReportModal
                isOpen={isReportModalOpen}
                onClose={() => setReportModalOpen(false)}
                setMessage={setMessage}
            />
            <CronLogModal isOpen={isCronLogModalOpen} onClose={() => setCronLogModalOpen(false)} companyId={currentUser?.companyId} />
        </div >
    );
};

export default CustomerDistributionV2;
