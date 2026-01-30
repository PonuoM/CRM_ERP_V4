import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../services/api';
import { User, Customer, UserRole } from '../types';
import {
    Users, Package, Search, ChevronDown, Check, Loader2, AlertCircle,
    RefreshCw, Eye, Database
} from 'lucide-react';
import { mapCustomerFromApi } from '../utils/customerMapper';
import Spinner from '../components/Spinner';

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
}

interface ResetCandidate {
    id: number;
    code: string;
    first_name: string;
    last_name: string;
    assigned_count: number;
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

    // UI state
    const [loading, setLoading] = useState(true);
    const [loadingCustomers, setLoadingCustomers] = useState(false);
    const [loadingAgents, setLoadingAgents] = useState(false);
    const [distributing, setDistributing] = useState(false);
    const [totalToDistribute, setTotalToDistribute] = useState<string>('');
    const [preview, setPreview] = useState<DistributionPreview[]>([]);
    const [showPreview, setShowPreview] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

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
    const RESET_PAGE_SIZE = 50;

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

    useEffect(() => {
        fetchResetOptions();
    }, [fetchResetOptions]);

    // Auto-set target basket for Upsell Distribution
    useEffect(() => {
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
                const response = await apiFetch(
                    `basket_config.php?action=basket_customers&basket_key=${basket.basket_key}&companyId=${currentUser?.companyId}&limit=1`
                );
                counts[basket.basket_key] = response?.count || 0;
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
                    role: u.role,
                    companyId: u.companyId || u.company_id,
                    username: u.username,
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

            setAgents(telesales);

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

            setAgents(telesales);
        } catch (error) {
            console.error('Failed to fetch agents:', error);
        } finally {
            setLoadingAgents(false);
        }
    }, [currentUser?.companyId]);

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

    // Toggle agent selection
    const toggleAgent = (agentId: number) => {
        setSelectedAgents(prev =>
            prev.includes(agentId)
                ? prev.filter(id => id !== agentId)
                : [...prev, agentId]
        );
    };

    // Select all agents
    const selectAllAgents = () => {
        if (selectedAgents.length === agents.length) {
            setSelectedAgents([]);
        } else {
            setSelectedAgents(agents.map(a => a.id));
        }
    };

    // Generate preview with Smart Allocation
    // This ensures customers are not assigned to agents they were previously assigned to
    const handleGeneratePreview = () => {
        if (selectedAgents.length === 0) {
            setMessage({ type: 'error', text: 'กรุณาเลือกพนักงานอย่างน้อย 1 คน' });
            return;
        }
        if (availableCount === 0) {
            setMessage({ type: 'error', text: 'ไม่มีลูกค้าพร้อมแจกในถังนี้' });
            return;
        }

        // Calculate per-person count from total
        const total = parseInt(totalToDistribute) || 0;
        const count = selectedAgents.length > 0 ? Math.floor(total / selectedAgents.length) : 0;
        const customerPool = [...customers]; // Make a copy of the pool
        const previewData: DistributionPreview[] = [];
        const assignedCustomerIds = new Set<string>(); // Track assigned customers

        // Helper function to parse previous_assigned_to (can be JSON string or array)
        const getPreviousAgents = (customer: Customer): number[] => {
            const prev = customer.previous_assigned_to;
            if (!prev) return [];
            if (Array.isArray(prev)) return prev;
            if (typeof prev === 'string') {
                try {
                    const parsed = JSON.parse(prev);
                    return Array.isArray(parsed) ? parsed : [];
                } catch {
                    return [];
                }
            }
            return [];
        };

        // Round-robin allocation: for each agent, find eligible customers
        for (const agentId of selectedAgents) {
            const agent = agents.find(a => a.id === agentId);
            if (!agent) continue;

            const agentCustomers: Customer[] = [];

            // Find customers that:
            // 1. Are not yet assigned in this batch
            // 2. Were NOT previously assigned to this agent
            for (const customer of customerPool) {
                if (agentCustomers.length >= count) break;

                const customerId = customer.customer_id?.toString() || customer.id;
                if (assignedCustomerIds.has(customerId)) continue;

                const previousAgents = getPreviousAgents(customer);
                if (previousAgents.includes(agentId)) continue; // Skip if previously assigned

                agentCustomers.push(customer);
                assignedCustomerIds.add(customerId);
            }

            previewData.push({
                agentId,
                agentName: `${agent.firstName} ${agent.lastName}`,
                customers: agentCustomers
            });
        }

        // Check if any agent got less than expected
        const expectedPerAgent = selectedAgents.length > 0 ? Math.floor((parseInt(totalToDistribute) || 0) / selectedAgents.length) : 0;
        const shortfall = previewData.filter(p => p.customers.length < expectedPerAgent);
        if (shortfall.length > 0) {
            const names = shortfall.map(p => `${p.agentName} (${p.customers.length}/${expectedPerAgent})`).join(', ');
            setMessage({
                type: 'error',
                text: `⚠️ บางพนักงานได้ลูกค้าน้อยกว่าที่กำหนดเนื่องจากมีลูกค้าซ้ำ: ${names}`
            });
        }

        setPreview(previewData);
        setShowPreview(true);
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
            const expectedPerAgent = selectedAgents.length > 0 ? Math.floor((parseInt(totalToDistribute) || 0) / selectedAgents.length) : 0;
            const needyAgents: number[] = [];

            selectedAgents.forEach(agentId => {
                const currentSuccess = summaryStats.agentStats[agentId]?.success || 0;
                if (currentSuccess < expectedPerAgent) {
                    // Add agent to list multiple times for each missing slot
                    for (let i = 0; i < (expectedPerAgent - currentSuccess); i++) {
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
            const res = await apiFetch(`Distribution/reset.php?action=get_candidates&target_count=${resetTargetCount}&companyId=${currentUser?.companyId}&page=${page}&limit=${RESET_PAGE_SIZE}`);
            if (res?.ok) {
                const candidates = (res.candidates || []).map((c: any) => ({ ...c, selected: false }));
                setResetCandidates(candidates);
                setResetTotal(res.total || 0);
                setResetTotalPages(res.total_pages || 1);

                if (candidates.length === 0 && page === 1) {
                    setMessage({ type: 'warning', text: `ไม่พบลูกค้าที่แจกไปแล้วครบ ${resetTargetCount} คน` });
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
    const [reclaimingAgent, setReclaimingAgent] = useState<AgentWithBaskets | null>(null);
    const [reclaimInputs, setReclaimInputs] = useState<Record<string, number>>({});
    const [reclaiming, setReclaiming] = useState(false);

    const openReclaimModal = (agent: AgentWithBaskets) => {
        setReclaimingAgent(agent);
        // Initialize inputs with 0
        const initialInputs: Record<string, number> = {};
        dashboardBaskets.forEach(b => initialInputs[b.basket_key] = 0);
        setReclaimInputs(initialInputs);
        setReclaimModalOpen(true);
    };

    const handleReclaimInput = (basketKey: string, val: string, max: number) => {
        let num = parseInt(val);
        if (isNaN(num)) num = 0;
        if (num < 0) num = 0;
        if (num > max) num = max;
        setReclaimInputs(prev => ({ ...prev, [basketKey]: num }));
    };

    const handleReclaimAll = (basketKey: string, max: number) => {
        setReclaimInputs(prev => ({ ...prev, [basketKey]: max }));
    };

    const handleExecuteReclaim = async () => {
        if (!reclaimingAgent) return;

        // Filter out 0s
        const payloadBaskets: Record<string, number> = {};
        let total = 0;
        Object.entries(reclaimInputs).forEach(([key, val]) => {
            if (val > 0) {
                payloadBaskets[key] = val;
                total += val;
            }
        });

        if (total === 0) {
            setMessage({ type: 'error', text: 'กรุณาระบุจำนวนที่ต้องดึงคืน' });
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
                        baskets: payloadBaskets
                    })
                }
            );

            setMessage({ type: 'success', text: `ดึงคืนลูกค้าสำเร็จ ${result?.reclaimed || total} รายชื่อ` });
            setReclaimModalOpen(false);
            fetchAgents(); // Refresh agent stats
            fetchAllBasketCounts(); // Refresh basket pools
        } catch (error) {
            console.error('Reclaim failed:', error);
            setMessage({ type: 'error', text: 'ดึงคืนลูกค้าไม่สำเร็จ' });
        } finally {
            setReclaiming(false);
        }
    };

    // Get active basket info
    const activeBasketInfo = baskets.find(b => b.basket_key === activeBasket);

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
                <button
                    onClick={() => setResetModalOpen(true)}
                    className="px-3 py-1.5 text-sm bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 flex items-center gap-1"
                >
                    <RefreshCw size={14} />
                    Manual Reset
                </button>
            </div>


            {/* Manual Reset Modal */}
            {resetModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                        <div className="p-6 border-b flex justify-between items-center bg-orange-50 rounded-t-xl">
                            <h3 className="text-lg font-bold text-orange-800 flex items-center gap-2">
                                <span className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">!</span>
                                Manual Reset (ล้างรอบด้วยตนเอง)
                            </h3>
                            <button onClick={() => setResetModalOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="flex gap-4 mb-6 items-end">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        ระบุจำนวน Telesale ที่ลูกค้าถูกแจกไปแล้ว (คน)
                                    </label>
                                    <div className="flex gap-2">
                                        <select
                                            value={resetTargetCount}
                                            onChange={(e) => setResetTargetCount(e.target.value)}
                                            className="flex-1 border rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                                        >
                                            <option value="">-- เลือกเงื่อนไข --</option>
                                            {resetOptions.map(opt => (
                                                <option key={opt.assigned_count} value={opt.assigned_count}>
                                                    รอบที่ {opt.assigned_count} (ลูกค้า {opt.customer_count} รายชื่อ)
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => handleCheckCandidates()}
                                            disabled={!resetTargetCount || findingCandidates}
                                            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2 font-medium"
                                        >
                                            {findingCandidates ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                                            ค้นหา
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {resetCandidates.length > 0 && (
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-semibold text-gray-700">พบ {resetCandidates.length} รายชื่อ</h4>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={toggleAllResetCandidates}
                                                className="text-sm text-blue-600 hover:underline"
                                            >
                                                {allResetSelected ? 'ยกเลิกเลือกทั้งหมด' : 'เลือกทั้งหมด'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 sticky top-0">
                                                <th className="p-3 text-left text-gray-600 font-medium">รหัสลูกค้า</th>
                                                <th className="p-3 text-left text-gray-600 font-medium">ชื่อ-นามสกุล</th>
                                                <th className="p-3 text-center text-gray-600 font-medium">แจกไปแล้ว (คน)</th>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {resetCandidates.map(c => (
                                                    <tr key={c.id} className="hover:bg-orange-50">
                                                        <td className="p-3 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={c.selected || false}
                                                                onChange={() => toggleResetCandidate(c.id)}
                                                                className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                                                            />
                                                        </td>
                                                        <td className="p-3 text-gray-900 font-mono">{c.code}</td>
                                                        <td className="p-3 text-gray-900">{c.first_name} {c.last_name}</td>
                                                        <td className="p-3 text-center text-gray-600 bg-gray-50">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <span>{c.assigned_count}</span>
                                                                <button
                                                                    onClick={() => handleViewHistory(c)}
                                                                    className="text-gray-400 hover:text-blue-600 p-1 rounded-full hover:bg-white transition-colors"
                                                                    title="ดูประวัติการแจก"
                                                                >
                                                                    <Eye size={14} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {resetTotalPages > 1 && (
                                <div className="flex justify-center items-center gap-4 mt-4 py-2">
                                    <button
                                        onClick={() => changeResetPage(resetPage - 1)}
                                        disabled={resetPage === 1 || findingCandidates}
                                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                                    >
                                        <ChevronDown size={20} className="rotate-90" />
                                    </button>
                                    <span className="text-sm text-gray-600">
                                        หน้า {resetPage} / {resetTotalPages}
                                    </span>
                                    <button
                                        onClick={() => changeResetPage(resetPage + 1)}
                                        disabled={resetPage === resetTotalPages || findingCandidates}
                                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                                    >
                                        <ChevronDown size={20} className="-rotate-90" />
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-between items-center">
                            <button
                                onClick={() => handleManualReset('all')}
                                disabled={!resetTotal || resetTotal === 0 || resetting}
                                className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg disabled:opacity-50 flex items-center gap-2"
                            >
                                {resetting ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                Reset ทั้งหมด ({resetTotal.toLocaleString()})
                            </button>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setResetModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    ปิด
                                </button>
                                <button
                                    onClick={() => handleManualReset('selected')}
                                    disabled={resetCandidates.filter(c => c.selected).length === 0 || resetting}
                                    className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 shadow-sm flex items-center gap-2 font-medium"
                                >
                                    {resetting ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                    Reset ที่เลือก ({resetCandidates.filter(c => c.selected).length})
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
                            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl">
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
                {baskets.map(basket => (
                    <button
                        key={basket.basket_key}
                        onClick={() => setActiveBasket(basket.basket_key)}
                        className={`bg-white p-3 rounded-xl shadow-sm border-2 transition-all hover:shadow-md text-left ${activeBasket === basket.basket_key
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-100 hover:border-blue-200'
                            }`}
                    >
                        <p className="text-[11px] font-medium text-gray-500 mb-0.5 truncate">{basket.basket_name}</p>
                        <div className={`text-xl font-bold ${activeBasket === basket.basket_key ? 'text-blue-600' : 'text-gray-900'}`}>
                            {basketCounts[basket.basket_key]?.toLocaleString() || 0}
                        </div>
                    </button>
                ))}

                {/* Total Card */}
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-3 rounded-xl shadow-md text-white">
                    <p className="text-[11px] font-medium text-green-100 mb-0.5">รวมทั้งหมด</p>
                    <div className="text-xl font-bold">
                        {totalInAllBaskets.toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Section 1: Distribution Settings */}
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





            {/* Section 2: Target Employees - Table Layout */}
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
                            max={availableCount}
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
                            onClick={handleGeneratePreview}
                            disabled={selectedAgents.length === 0 || availableCount === 0 || !totalToDistribute || parseInt(totalToDistribute) <= 0 || parseInt(totalToDistribute) > availableCount}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <Eye size={16} />
                            ดูตัวอย่างก่อนแจก
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
                                            checked={selectedAgents.length === agents.length && agents.length > 0}
                                            onChange={selectAllAgents}
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                    </th>
                                    <th className="p-3 text-left font-medium text-gray-600">พนักงาน</th>
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
                                {agents.map(agent => (
                                    <tr
                                        key={agent.id}
                                        className={`border-t hover:bg-gray-50 cursor-pointer ${selectedAgents.includes(agent.id) ? 'bg-blue-50' : ''}`}
                                        onClick={() => toggleAgent(agent.id)}
                                    >
                                        <td className="p-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedAgents.includes(agent.id)}
                                                onChange={() => toggleAgent(agent.id)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                        </td>
                                        <td className="p-3 font-medium">
                                            {agent.firstName} {agent.lastName}
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
                                ))}
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
                        <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-auto shadow-xl">
                            <h3 className="text-xl font-bold mb-2">ดึงลูกค้าคืนจาก {reclaimingAgent.firstName} {reclaimingAgent.lastName}</h3>
                            <p className="text-sm text-gray-500 mb-6">ระบุจำนวนที่ต้องการดึงคืนจากแต่ละถัง</p>

                            <div className="space-y-4 mb-6">
                                {dashboardBaskets.map(basket => {
                                    // Prevent reclaiming from Upsell basket
                                    if (basket.basket_key === 'upsell_dis') return null;

                                    const currentHolding = reclaimingAgent.basketCounts?.[basket.basket_key] || 0;
                                    const isEmpty = currentHolding === 0;

                                    // Check if this dashboard basket has a linked distribution basket
                                    // by checking if linked_basket_key exists in basket config
                                    const hasLinkedDistribution = !!basket.linked_basket_key;

                                    // Treat as disabled if empty OR no linked distribution basket
                                    const isDisabled = isEmpty || !hasLinkedDistribution;

                                    return (
                                        <div key={basket.basket_key} className={`flex items-center gap-4 ${isDisabled ? 'opacity-50' : ''}`}>
                                            <div className="flex-1">
                                                <div className="flex justify-between mb-1">
                                                    <label className={`text-sm font-medium ${isDisabled ? 'text-gray-400' : ''}`}>
                                                        {basket.basket_name}
                                                        {!hasLinkedDistribution && <span className="text-xs text-gray-400 ml-2">(ไม่มีถัง Distribution)</span>}
                                                    </label>
                                                    <span className={`text-xs ${isDisabled ? 'text-gray-400' : 'text-gray-500'}`}>มีอยู่ {currentHolding}</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="number"
                                                        value={reclaimInputs[basket.basket_key] || ''}
                                                        onChange={(e) => handleReclaimInput(basket.basket_key, e.target.value, currentHolding)}
                                                        className={`w-full border rounded p-2 text-sm ${isDisabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                                        min={0}
                                                        max={currentHolding}
                                                        disabled={isDisabled}
                                                    />
                                                    <button
                                                        onClick={() => handleReclaimAll(basket.basket_key, currentHolding)}
                                                        className={`px-3 py-2 text-xs rounded whitespace-nowrap ${isDisabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200'}`}
                                                        disabled={isDisabled}
                                                    >
                                                        คืนหมด
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Empty state if agent has 0 customers */}
                                {Object.values(reclaimingAgent.basketCounts).every(c => c === 0) && (
                                    <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg">
                                        พนักงานนี้ไม่มีลูกค้าในถังใดๆ
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <button
                                    onClick={() => setReclaimModalOpen(false)}
                                    className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-gray-600"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={handleExecuteReclaim}
                                    disabled={reclaiming}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                >
                                    {reclaiming ? <Loader2 className="animate-spin" size={16} /> : null}
                                    ยืนยันดึงคืน
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Preview Modal */}
            {
                showPreview && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-auto">
                            <h3 className="text-xl font-bold mb-4">Preview การแจกงาน</h3>

                            <div className="space-y-4 mb-6">
                                {preview.map(item => (
                                    <div key={item.agentId} className="border rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-medium">{item.agentName}</span>
                                            <span className="text-blue-600 font-semibold">{item.customers.length} รายชื่อ</span>
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            {item.customers.slice(0, 5).map(c => `${c.firstName} ${c.lastName}`).join(', ')}
                                            {item.customers.length > 5 && ` และอีก ${item.customers.length - 5} คน`}
                                        </div>
                                    </div>
                                ))}
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
        </div >
    );
};

export default CustomerDistributionV2;
