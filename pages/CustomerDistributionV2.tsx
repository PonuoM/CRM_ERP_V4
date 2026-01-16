import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../services/api';
import { User, Customer, UserRole } from '../types';
import {
    Users, Package, Search, ChevronDown, Check, Loader2, AlertCircle,
    Filter, RefreshCw, UserPlus, Shuffle
} from 'lucide-react';
import { mapCustomerFromApi } from '../utils/customerMapper';

interface CustomerDistributionV2Props {
    currentUser?: User | null;
}

interface BasketConfig {
    id: number;
    basket_key: string;
    basket_name: string;
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

const CustomerDistributionV2: React.FC<CustomerDistributionV2Props> = ({ currentUser }) => {
    const [baskets, setBaskets] = useState<BasketConfig[]>([]);
    const [activeBasket, setActiveBasket] = useState<string>('');
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [agents, setAgents] = useState<User[]>([]);
    const [selectedAgents, setSelectedAgents] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingCustomers, setLoadingCustomers] = useState(false);
    const [distributing, setDistributing] = useState(false);
    const [countPerAgent, setCountPerAgent] = useState(10);
    const [preview, setPreview] = useState<DistributionPreview[]>([]);
    const [showPreview, setShowPreview] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [basketCounts, setBasketCounts] = useState<Record<string, number>>({});

    // Fetch basket configurations from database
    const fetchBaskets = useCallback(async () => {
        try {
            const response = await apiFetch(
                `basket_config.php?target_page=distribution&companyId=${currentUser?.companyId}`
            );
            setBaskets(response || []);
            if (response?.length > 0 && !activeBasket) {
                setActiveBasket(response[0].basket_key);
            }
        } catch (error) {
            console.error('Failed to fetch baskets:', error);
        }
    }, [currentUser?.companyId, activeBasket]);

    // Fetch telesale agents
    const fetchAgents = useCallback(async () => {
        try {
            const response = await apiFetch(`/users?companyId=${currentUser?.companyId}`);
            // Map API response (snake_case) to User interface (camelCase)
            const mappedUsers = (response || []).map((u: any) => ({
                id: u.id || u.user_id,
                firstName: u.firstName || u.first_name || '',
                lastName: u.lastName || u.last_name || '',
                role: u.role,
                companyId: u.companyId || u.company_id,
                username: u.username,
            }));
            const telesales = mappedUsers.filter((u: User) =>
                u.role === UserRole.Telesale || u.role === UserRole.Supervisor
            );
            setAgents(telesales);
        } catch (error) {
            console.error('Failed to fetch agents:', error);
        }
    }, [currentUser?.companyId]);



    // Fetch customers for active basket
    const fetchCustomers = useCallback(async () => {
        if (!activeBasket) return;

        setLoadingCustomers(true);
        try {
            // Use basket_config API with basket_customers action
            const response = await apiFetch(
                `basket_config.php?action=basket_customers&basket_key=${activeBasket}&companyId=${currentUser?.companyId}&limit=500`
            );
            const data = response?.data || [];
            const mapped = data.map((r: any) => mapCustomerFromApi(r));
            setCustomers(mapped);
            // Update basket count for active basket
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

    // Fetch counts for ALL baskets (for sidebar display)
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

    // Initial load
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await Promise.all([fetchBaskets(), fetchAgents()]);
            setLoading(false);
        };
        if (currentUser?.companyId) {
            init();
        }
    }, [currentUser?.companyId, fetchBaskets, fetchAgents]);

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

    // Filter customers by search
    const filteredCustomers = useMemo(() => {
        if (!searchTerm) return customers;
        const term = searchTerm.toLowerCase();
        return customers.filter(c =>
            c.firstName?.toLowerCase().includes(term) ||
            c.lastName?.toLowerCase().includes(term) ||
            c.phone?.includes(term)
        );
    }, [customers, searchTerm]);

    // Generate preview
    const handleGeneratePreview = () => {
        if (selectedAgents.length === 0) {
            setMessage({ type: 'error', text: 'กรุณาเลือกพนักงานอย่างน้อย 1 คน' });
            return;
        }

        const availableCustomers = [...filteredCustomers];
        const previewData: DistributionPreview[] = [];

        for (const agentId of selectedAgents) {
            const agent = agents.find(a => a.id === agentId);
            if (!agent) continue;

            const assignCount = Math.min(countPerAgent, availableCustomers.length);
            const agentCustomers = availableCustomers.splice(0, assignCount);

            previewData.push({
                agentId,
                agentName: `${agent.firstName} ${agent.lastName}`,
                customers: agentCustomers
            });
        }

        setPreview(previewData);
        setShowPreview(true);
    };

    // Execute distribution
    const handleExecuteDistribution = async () => {
        setDistributing(true);
        try {
            // Build assignments array for bulk API
            const assignments: { customer_id: string | number; agent_id: number }[] = [];
            for (const item of preview) {
                for (const customer of item.customers) {
                    assignments.push({
                        customer_id: customer.id,
                        agent_id: item.agentId
                    });
                }
            }

            // Call bulk assign API (single request for all assignments)
            const result = await apiFetch(
                `basket_config.php?action=bulk_assign&companyId=${currentUser?.companyId}`,
                {
                    method: 'POST',
                    body: JSON.stringify({ assignments })
                }
            );

            const totalAssigned = result?.assigned || assignments.length;
            setMessage({ type: 'success', text: `แจกงานสำเร็จ ${totalAssigned} รายชื่อ` });
            setShowPreview(false);
            setPreview([]);
            setSelectedAgents([]);
            fetchCustomers();
            fetchAllBasketCounts();
        } catch (error) {
            console.error('Distribution failed:', error);
            setMessage({ type: 'error', text: 'แจกงานไม่สำเร็จ' });
        } finally {
            setDistributing(false);
        }
    };

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

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
                    <div className="flex items-center gap-3">
                        <Shuffle className="w-8 h-8 text-purple-600" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">แจกงาน V2</h1>
                            <p className="text-gray-500">แจกลูกค้าจากถังต่างๆ ให้ Telesale</p>
                        </div>
                    </div>
                </div>

                {/* Message */}
                {message && (
                    <div className={`mb-4 p-4 rounded-xl flex items-center gap-2 ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                        <AlertCircle size={20} />
                        {message.text}
                        <button onClick={() => setMessage(null)} className="ml-auto">×</button>
                    </div>
                )}

                <div className="flex gap-6">
                    {/* Basket Sidebar */}
                    <div className="w-72 bg-white rounded-2xl shadow-sm border p-4">
                        <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                            <Package size={20} />
                            ถังสำหรับแจก
                        </h3>
                        <div className="space-y-2">
                            {baskets.map(basket => (
                                <button
                                    key={basket.basket_key}
                                    onClick={() => setActiveBasket(basket.basket_key)}
                                    className={`w-full text-left p-3 rounded-xl transition-colors flex items-center justify-between ${activeBasket === basket.basket_key
                                        ? 'bg-purple-100 text-purple-700 font-medium'
                                        : 'hover:bg-gray-100 text-gray-600'
                                        }`}
                                >
                                    <span>{basket.basket_name}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${activeBasket === basket.basket_key
                                        ? 'bg-purple-200'
                                        : 'bg-gray-200'
                                        }`}>
                                        {basketCounts[basket.basket_key] || 0}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Distribution Settings */}
                        <div className="mt-6 pt-6 border-t">
                            <h4 className="font-medium text-gray-700 mb-3">ตั้งค่าการแจก</h4>
                            <div className="mb-4">
                                <label className="block text-sm text-gray-500 mb-1">จำนวนต่อพนักงาน</label>
                                <input
                                    type="number"
                                    value={countPerAgent}
                                    onChange={(e) => setCountPerAgent(parseInt(e.target.value) || 10)}
                                    className="w-full border rounded-lg p-2"
                                    min={1}
                                    max={100}
                                />
                            </div>

                            <button
                                onClick={handleGeneratePreview}
                                disabled={selectedAgents.length === 0 || filteredCustomers.length === 0}
                                className="w-full py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <UserPlus size={20} />
                                Preview การแจก
                            </button>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 space-y-6">
                        {/* Agent Selection */}
                        <div className="bg-white rounded-2xl shadow-sm border p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                                    <Users size={20} />
                                    เลือกพนักงาน ({selectedAgents.length}/{agents.length})
                                </h3>
                                <button
                                    onClick={selectAllAgents}
                                    className="text-sm text-purple-600 hover:underline"
                                >
                                    {selectedAgents.length === agents.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                                </button>
                            </div>
                            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                {agents.map(agent => (
                                    <button
                                        key={agent.id}
                                        onClick={() => toggleAgent(agent.id)}
                                        className={`p-3 rounded-xl border-2 transition-colors text-sm ${selectedAgents.includes(agent.id)
                                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${selectedAgents.includes(agent.id)
                                                ? 'bg-purple-500 text-white'
                                                : 'bg-gray-200'
                                                }`}>
                                                {selectedAgents.includes(agent.id) ? <Check size={14} /> : (agent.firstName || '?').charAt(0)}
                                            </div>
                                            <span className="truncate">{agent.firstName || 'Unknown'}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Customer List */}
                        <div className="bg-white rounded-2xl shadow-sm border p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-gray-700">
                                    ลูกค้าในถัง: {baskets.find(b => b.basket_key === activeBasket)?.basket_name}
                                    <span className="ml-2 text-gray-400">({filteredCustomers.length} รายชื่อ)</span>
                                </h3>
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input
                                            type="text"
                                            placeholder="ค้นหา..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-9 pr-4 py-2 border rounded-lg text-sm"
                                        />
                                    </div>
                                    <button
                                        onClick={fetchCustomers}
                                        className="p-2 hover:bg-gray-100 rounded-lg"
                                        title="รีเฟรช"
                                    >
                                        <RefreshCw size={18} className={loadingCustomers ? 'animate-spin' : ''} />
                                    </button>
                                </div>
                            </div>

                            {loadingCustomers ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                                </div>
                            ) : filteredCustomers.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    ไม่พบลูกค้าในถังนี้
                                </div>
                            ) : (
                                <div className="overflow-auto max-h-96">
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
                                            {filteredCustomers.slice(0, 100).map(customer => (
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
                                    {filteredCustomers.length > 100 && (
                                        <div className="text-center py-3 text-gray-400 text-sm">
                                            แสดง 100 จาก {filteredCustomers.length} รายการ
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Preview Modal */}
                {showPreview && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-auto">
                            <h3 className="text-xl font-bold mb-4">Preview การแจกงาน</h3>

                            <div className="space-y-4 mb-6">
                                {preview.map(item => (
                                    <div key={item.agentId} className="border rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-medium">{item.agentName}</span>
                                            <span className="text-purple-600">{item.customers.length} รายชื่อ</span>
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            {item.customers.slice(0, 3).map(c => c.firstName).join(', ')}
                                            {item.customers.length > 3 && ` และอีก ${item.customers.length - 3} คน`}
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
                                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {distributing ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                        ยืนยันแจกงาน
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomerDistributionV2;
