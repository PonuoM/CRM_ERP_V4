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
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
                'upsell',
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

    // Auto-set target basket for Upsell
    useEffect(() => {
        if (activeBasket === 'upsell') {
            // Try to find basket with ID 51 if possible, otherwise just hint user?
            // Since we don't hold IDs in a map easily, we just rely on user or default.
            // But if we want to BE explicit, we could set it if we knew the key.
            // For now, let's keep it empty to use backend default, or user handles it.
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

    // Execute distribution
    const handleExecuteDistribution = async () => {
        setDistributing(true);
        try {
            const assignments: { customer_id: string | number; agent_id: number }[] = [];
            for (const item of preview) {
                for (const customer of item.customers) {
                    assignments.push({
                        customer_id: customer.id,
                        agent_id: item.agentId
                    });
                }
            }

            const result = await apiFetch(
                `basket_config.php?action=bulk_assign&companyId=${currentUser?.companyId}`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        assignments,
                        source_basket_key: activeBasket,
                        target_basket_key: targetBasket || undefined,
                        triggered_by: currentUser?.userId
                    })
                }
            );

            const totalAssigned = result?.assigned || assignments.length;
            setMessage({ type: 'success', text: `แจกงานสำเร็จ ${totalAssigned} รายชื่อ` });
            setShowPreview(false);
            setPreview([]);
            setSelectedAgents([]);
            fetchCustomers();
            fetchAllBasketCounts();
            fetchAgents();
        } catch (error) {
            console.error('Distribution failed:', error);
            setMessage({ type: 'error', text: 'แจกงานไม่สำเร็จ' });
        } finally {
            setDistributing(false);
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
        <div className="p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800 mb-2">แจกงาน V2</h1>
                <p className="text-gray-600">แจกลูกค้าจากถังต่างๆ ให้ Telesale</p>
            </div>

            {/* Message */}
            {message && (
                <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                    <AlertCircle size={20} />
                    {message.text}
                    <button onClick={() => setMessage(null)} className="ml-auto">×</button>
                </div>
            )}

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
                                    if (basket.basket_key === 'upsell') return null;

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
                                        onClick={handleExecuteDistribution}
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
        </div >
    );
};

export default CustomerDistributionV2;
