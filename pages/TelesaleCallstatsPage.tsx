import React, { useState, useEffect, useMemo } from 'react';
import { Inbox, PhoneCall, CalendarCheck, CalendarDays, BarChart4, Loader2, Activity, Clock, Calendar, Download, RotateCcw } from 'lucide-react';
import resolveApiBasePath from '@/utils/apiBasePath';
import DateRangePicker, { DateRange } from '@/components/DateRangePicker';

interface BasketStat {
    assigned_current: number;
    not_called_current: number;
    called_no_appt_current: number;
    called_and_appt_current: number;
    appt_no_call_current: number;
    assigned_total: number;
    called: number;
    appointments: number;
    reclaimed: number;
}

interface AgentData {
    agent_id: number;
    agent_name: string;
    stats: Record<string, BasketStat>;
}

interface BasketDef {
    basket_key: string;
    basket_name: string;
}

const TelesaleCallstatsPage: React.FC = () => {
    const apiBase = useMemo(() => resolveApiBasePath(), []);
    const [viewMode, setViewMode] = useState<'performance' | 'realtime'>('performance');
    const [filter, setFilter] = useState('today');
    const [customDateRange, setCustomDateRange] = useState<DateRange>({ start: '', end: '' });
    const [loading, setLoading] = useState(true);
    const [baskets, setBaskets] = useState<BasketDef[]>([]);
    const [agents, setAgents] = useState<AgentData[]>([]);
    const [selectedAgentId, setSelectedAgentId] = useState<number | 'all'>('all');
    const [isExporting, setIsExporting] = useState(false);

    const filteredAgents = useMemo(() => {
        if (selectedAgentId === 'all') return agents;
        return agents.filter(a => a.agent_id === selectedAgentId);
    }, [agents, selectedAgentId]);

    // Drill-down Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [drilldownData, setDrilldownData] = useState<any[]>([]);
    const [isLoadingDrilldown, setIsLoadingDrilldown] = useState(false);
    const [modalContext, setModalContext] = useState({ agentId: 0, agentName: '', basketKey: '', basketName: '' });
    const [modalTab, setModalTab] = useState<'all' | 'not_called' | 'called_no_appt' | 'called_and_appt' | 'appt_no_call' | 'reclaimed'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [drilldownCounts, setDrilldownCounts] = useState({ total_all: 0, total_not_called: 0, total_called_no_appt: 0, total_called_and_appt: 0, total_appt_no_call: 0, total_reclaimed: 0 });


    const handleExport = async () => {
        setIsExporting(true);
        try {
            const token = localStorage.getItem("authToken");
            let url = `${apiBase}/Monitor/telesale_callstats.php?export=true&filter=${filter}&view_mode=${viewMode}&agent_id=${selectedAgentId}`;
            if (filter === 'custom' && customDateRange.start && customDateRange.end) {
                url += `&start_date=${encodeURIComponent(customDateRange.start)}&end_date=${encodeURIComponent(customDateRange.end)}`;
            }
            
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (!res.ok) throw new Error("Export failed");
            
            const blob = await res.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `telesale_callstats_${viewMode}_${new Date().getTime()}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (error) {
            console.error("Failed to export data", error);
            alert("เกิดข้อผิดพลาดในการส่งออกข้อมูล");
        } finally {
            setIsExporting(false);
        }
    };

    useEffect(() => {
        if (filter === 'custom') {
            if (customDateRange.start && customDateRange.end) {
                fetchData();
            }
        } else {
            fetchData();
        }
    }, [filter, customDateRange]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("authToken");
            let url = `${apiBase}/Monitor/telesale_callstats.php?filter=${filter}`;
            if (filter === 'custom' && customDateRange.start && customDateRange.end) {
                url += `&start_date=${encodeURIComponent(customDateRange.start)}&end_date=${encodeURIComponent(customDateRange.end)}`;
            }
            const res = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });
            const data = await res.json();
            if (data.success) {
                setBaskets(data.baskets || []);
                setAgents(data.data || []);
            }
        } catch (error) {
            console.error("Failed to fetch callstats", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDrilldown = async (agentId: number, basketKey: string, tab: string, page: number) => {
        setIsLoadingDrilldown(true);
        try {
            const token = localStorage.getItem("authToken");
            let url = `${apiBase}/Monitor/telesale_callstats_drilldown.php?agent_id=${agentId}&basket_key=${basketKey}&filter=${filter}&view_mode=${viewMode}&tab=${tab}&page=${page}&limit=50`;
            if (filter === 'custom' && customDateRange.start && customDateRange.end) {
                url += `&start_date=${encodeURIComponent(customDateRange.start)}&end_date=${encodeURIComponent(customDateRange.end)}`;
            }
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setDrilldownData(data.data || []);
                setTotalPages(data.pagination.total_pages);
                setDrilldownCounts(data.counts);
            }
        } catch (e) {
            console.error("Failed to load drilldown", e);
        } finally {
            setIsLoadingDrilldown(false);
        }
    };

    const handleCellClick = (agentId: number, agentName: string, basketKey: string, basketName: string) => {
        setIsModalOpen(true);
        setModalContext({ agentId, agentName, basketKey, basketName });
        setModalTab('all');
        setCurrentPage(1);
        fetchDrilldown(agentId, basketKey, 'all', 1);
    };

    const handleTabChange = (tab: 'all' | 'not_called' | 'called_no_appt' | 'called_and_appt' | 'appt_no_call' | 'reclaimed') => {
        setModalTab(tab);
        setCurrentPage(1);
        fetchDrilldown(modalContext.agentId, modalContext.basketKey, tab, 1);
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
            fetchDrilldown(modalContext.agentId, modalContext.basketKey, modalTab, newPage);
        }
    };

    const filters = [
        { id: 'today', label: 'วันนี้' },
        { id: 'this_week', label: 'สัปดาห์นี้' },
        { id: 'this_month', label: 'เดือนนี้' },
        { id: 'this_year', label: 'ปีนี้' },
        { id: 'custom', label: 'กำหนดเอง' },
        { id: 'all', label: 'ทั้งหมด' }
    ];

    return (
        <div className="p-4 md:p-8 bg-slate-50 min-h-screen font-sans">
            <div className="max-w-[1600px] mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                            <BarChart4 className="w-8 h-8 text-indigo-600" />
                            ติดตามการโทร (Telesale Matrix)
                        </h1>
                        <p className="text-slate-500 mt-2 text-sm">
                            ตรวจสอบผลการทำงาน: จำนวนลูกค้าที่อยู่ในมือ, ที่ถูกโทรหา, และนัดหมายที่เกิดขึ้น
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 items-end">
                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
                            <button
                                onClick={handleExport}
                                disabled={isExporting || loading || filteredAgents.length === 0}
                                className="px-4 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 bg-white shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isExporting ? <Loader2 className="w-4 h-4 animate-spin text-slate-500" /> : <Download className="w-4 h-4 text-slate-500" />}
                                Export CSV
                            </button>

                            {/* Agent Selector */}
                            <select
                                value={selectedAgentId}
                                onChange={(e) => setSelectedAgentId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]"
                            >
                                <option value="all">ดูพนักงานทั้งหมด</option>
                                {agents.map(a => (
                                    <option key={a.agent_id} value={a.agent_id}>{a.agent_name}</option>
                                ))}
                            </select>

                            {/* View Mode Toggle */}
                            <div className="flex bg-slate-200/60 p-1 rounded-lg">
                            <button
                                onClick={() => setViewMode('performance')}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                                    viewMode === 'performance' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <Activity className="w-4 h-4" /> ประเมินผลงาน
                            </button>
                            <button
                                onClick={() => setViewMode('realtime')}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                                    viewMode === 'realtime' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <Clock className="w-4 h-4" /> ลูกค้าในมือ (Realtime)
                            </button>
                        </div>
                        </div>

                        {/* Filter Toggle */}
                        {viewMode === 'performance' ? (
                            <div className="flex flex-col md:flex-row items-end gap-3">
                                <div className="flex bg-white/60 backdrop-blur-md p-1.5 rounded-full border border-slate-200 shadow-sm overflow-x-auto">
                                    {filters.map(f => (
                                        <button
                                            key={f.id}
                                            onClick={() => setFilter(f.id)}
                                            className={`px-5 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                                                filter === f.id
                                                    ? 'bg-slate-900 text-white shadow-md'
                                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                            }`}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                                {filter === 'custom' && (
                                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                        <DateRangePicker 
                                            value={customDateRange} 
                                            onApply={setCustomDateRange} 
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200 flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                ข้อมูลเรียลไทม์ (ไม่ใช้ตัวกรองวันที่)
                            </div>
                        )}
                    </div>
                </div>

                {/* Matrix Content */}
                <div className="bg-white/80 backdrop-blur-xl border border-slate-200 shadow-xl rounded-3xl overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center p-32 flex-col gap-4">
                            <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                            <p className="text-slate-500 font-medium">กำลังโหลดข้อมูลสถิติ...</p>
                        </div>
                    ) : filteredAgents.length === 0 ? (
                        <div className="flex items-center justify-center p-32 text-slate-500 font-medium">
                            ไม่พบข้อมูลพนักงาน Telesale
                        </div>
                    ) : (
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-max">
                                <thead>
                                    <tr>
                                        {/* Sticky Agent Column Header */}
                                        <th className="sticky left-0 top-0 z-20 bg-slate-100/90 backdrop-blur-md p-5 border-b border-slate-200 shadow-[4px_0_12px_rgba(0,0,0,0.03)] font-semibold text-slate-800 tracking-wide min-w-[220px]">
                                            พนักงาน Telesale
                                        </th>
                                        
                                        {/* Basket Headers */}
                                        {baskets.map(basket => (
                                            <th key={basket.basket_key} className="p-5 border-b border-slate-200 bg-white/50 backdrop-blur-sm text-center font-medium text-slate-700 min-w-[180px]">
                                                {basket.basket_name}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAgents.map((agent, idx) => (
                                        <tr key={agent.agent_id} className="group hover:bg-indigo-50/40 transition-colors border-b border-slate-100 last:border-0">
                                            {/* Sticky Agent Name */}
                                            <td className="sticky left-0 z-10 bg-white group-hover:bg-indigo-50 p-5 shadow-[4px_0_12px_rgba(0,0,0,0.02)] transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 border border-indigo-200/50 flex items-center justify-center text-indigo-700 font-bold shadow-sm">
                                                        {agent.agent_name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-slate-800">{agent.agent_name}</div>
                                                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                            <CalendarDays className="w-3 h-3" />
                                                            ID: {agent.agent_id}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Basket Stats Cells */}
                                            {baskets.map(basket => {
                                                const stat = agent.stats[basket.basket_key];
                                                if (!stat) return <td key={basket.basket_key} className="p-4"></td>;
                                                
                                                const hasWork = viewMode === 'performance' 
                                                    ? (stat.assigned_total > 0 || stat.called > 0 || stat.appointments > 0)
                                                    : (stat.assigned_current > 0);
                                                
                                                return (
                                                    <td key={basket.basket_key} className="p-4 border-l border-slate-50/50">
                                                        {hasWork ? (
                                                            viewMode === 'performance' ? (
                                                                <div 
                                                                    onClick={() => handleCellClick(agent.agent_id, agent.agent_name, basket.basket_key, basket.basket_name)}
                                                                    className="bg-slate-50/50 rounded-2xl p-3 border border-slate-100/50 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:ring-2 hover:ring-indigo-200 transition-all duration-300 cursor-pointer"
                                                                >
                                                                    <div className="grid grid-cols-4 gap-2 text-center divide-x divide-slate-200/60">
                                                                        {/* Assigned Total */}
                                                                        <div className="flex flex-col items-center justify-center group/item py-1" title="ยอดแจกช่วงเวลานี้">
                                                                            <Inbox className="w-4 h-4 text-slate-300 mb-1 group-hover/item:text-blue-500 transition-colors" />
                                                                            <span className="font-bold text-slate-800 text-lg leading-none">{stat.assigned_total}</span>
                                                                            <span className="text-[10px] text-slate-500 font-medium mt-1">รับแจก</span>
                                                                        </div>
                                                                        {/* Called */}
                                                                        <div className="flex flex-col items-center justify-center group/item py-1" title="โทรหาแล้ว (Unique)">
                                                                            <PhoneCall className="w-4 h-4 text-slate-300 mb-1 group-hover/item:text-green-500 transition-colors" />
                                                                            <span className="font-bold text-slate-800 text-lg leading-none">{stat.called}</span>
                                                                            <span className="text-[10px] text-slate-500 font-medium mt-1">โทรแล้ว</span>
                                                                        </div>
                                                                        {/* Appts */}
                                                                        <div className="flex flex-col items-center justify-center group/item py-1" title="นัดหมายที่สร้าง">
                                                                            <CalendarCheck className="w-4 h-4 text-slate-300 mb-1 group-hover/item:text-amber-500 transition-colors" />
                                                                            <span className="font-bold text-slate-800 text-lg leading-none">{stat.appointments}</span>
                                                                            <span className="text-[10px] text-slate-500 font-medium mt-1">นัดหมาย</span>
                                                                        </div>
                                                                        {/* Reclaimed */}
                                                                        <div className="flex flex-col items-center justify-center group/item py-1" title="ถูกดึงคืน">
                                                                            <RotateCcw className="w-4 h-4 text-slate-300 mb-1 group-hover/item:text-rose-500 transition-colors" />
                                                                            <span className="font-bold text-slate-800 text-lg leading-none">{stat.reclaimed || 0}</span>
                                                                            <span className="text-[10px] text-slate-500 font-medium mt-1">ดึงคืน</span>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {stat.assigned_total > 0 && (
                                                                        <div className="mt-3 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden" title={`โทรแล้ว ${Math.round((stat.called / stat.assigned_total) * 100)}% ของยอดแจก`}>
                                                                            <div 
                                                                                className="h-full bg-indigo-500 rounded-full transition-all duration-700 ease-out"
                                                                                style={{ width: `${Math.min(100, (stat.called / stat.assigned_total) * 100)}%` }}
                                                                            ></div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div 
                                                                    onClick={() => handleCellClick(agent.agent_id, agent.agent_name, basket.basket_key, basket.basket_name)}
                                                                    className="bg-blue-50/30 rounded-2xl p-3 border border-blue-100/50 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:ring-2 hover:ring-blue-200 transition-all duration-300 cursor-pointer"
                                                                >
                                                                    <div className="grid grid-cols-5 gap-1 text-center divide-x divide-blue-200/50">
                                                                        {/* Assigned Current */}
                                                                        <div className="flex flex-col items-center justify-center group/item py-1" title="ลูกค้าในมือ (ปัจจุบัน)">
                                                                            <Inbox className="w-3.5 h-3.5 text-blue-300 mb-1 group-hover/item:text-blue-600 transition-colors" />
                                                                            <span className="font-bold text-blue-900 text-base leading-none">{stat.assigned_current}</span>
                                                                            <span className="text-[9px] text-blue-500 font-medium mt-1 truncate w-full px-1">ในมือ</span>
                                                                        </div>
                                                                        {/* Not Called Current */}
                                                                        <div className="flex flex-col items-center justify-center group/item py-1" title="ยังไม่โทร">
                                                                            <PhoneCall className="w-3.5 h-3.5 text-slate-300 mb-1 group-hover/item:text-slate-500 transition-colors" />
                                                                            <span className="font-bold text-slate-700 text-base leading-none">{stat.not_called_current}</span>
                                                                            <span className="text-[9px] text-slate-500 font-medium mt-1 truncate w-full px-1">ยังไม่โทร</span>
                                                                        </div>
                                                                        {/* Called No Appt */}
                                                                        <div className="flex flex-col items-center justify-center group/item py-1" title="โทรแล้วไม่นัด">
                                                                            <PhoneCall className="w-3.5 h-3.5 text-blue-300 mb-1 group-hover/item:text-green-500 transition-colors" />
                                                                            <span className="font-bold text-blue-800 text-base leading-none">{stat.called_no_appt_current}</span>
                                                                            <span className="text-[9px] text-blue-500 font-medium mt-1 truncate w-full px-1">โทร/ไม่นัด</span>
                                                                        </div>
                                                                        {/* Called And Appt */}
                                                                        <div className="flex flex-col items-center justify-center group/item py-1" title="โทรและนัด">
                                                                            <CalendarCheck className="w-3.5 h-3.5 text-blue-300 mb-1 group-hover/item:text-emerald-500 transition-colors" />
                                                                            <span className="font-bold text-blue-800 text-base leading-none">{stat.called_and_appt_current}</span>
                                                                            <span className="text-[9px] text-blue-500 font-medium mt-1 truncate w-full px-1">โทร+นัด</span>
                                                                        </div>
                                                                        {/* Appt No Call */}
                                                                        <div className="flex flex-col items-center justify-center group/item py-1" title="นัดแต่ไม่โทร">
                                                                            <CalendarDays className="w-3.5 h-3.5 text-red-300 mb-1 group-hover/item:text-red-500 transition-colors" />
                                                                            <span className="font-bold text-red-800 text-base leading-none">{stat.appt_no_call_current}</span>
                                                                            <span className="text-[9px] text-red-500 font-medium mt-1 truncate w-full px-1">นัด/ไม่โทร</span>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {stat.assigned_current > 0 && (
                                                                        <div className="mt-3 h-1.5 w-full bg-blue-100 rounded-full overflow-hidden" title={`โทรแล้ว ${Math.round(((stat.called_no_appt_current + stat.called_and_appt_current) / stat.assigned_current) * 100)}% ของลูกค้าในมือ`}>
                                                                            <div 
                                                                                className="h-full bg-blue-500 rounded-full transition-all duration-700 ease-out"
                                                                                style={{ width: `${Math.min(100, ((stat.called_no_appt_current + stat.called_and_appt_current) / stat.assigned_current) * 100)}%` }}
                                                                            ></div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )
                                                        ) : (
                                                            <div className="flex items-center justify-center h-full text-slate-300 text-sm">
                                                                -
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                
                {/* Legend */}
                <div className="mt-6 flex items-center gap-6 text-sm text-slate-500 justify-end px-4">
                    <div className="flex items-center gap-2">
                        <Inbox className="w-4 h-4 text-blue-500" />
                        <span>{viewMode === 'performance' ? 'ยอดที่ได้รับแจก' : 'ลูกค้าในมือ'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <PhoneCall className="w-4 h-4 text-green-500" />
                        <span>โทรหาแล้ว</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <CalendarCheck className="w-4 h-4 text-amber-500" />
                        <span>สร้างนัดหมาย</span>
                    </div>
                    {viewMode === 'performance' && (
                        <div className="flex items-center gap-2">
                            <RotateCcw className="w-4 h-4 text-rose-500" />
                            <span>ถูกดึงคืน</span>
                        </div>
                    )}
                </div>
                
                {/* Modal for Drilldown */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-all">
                        <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">รายชื่อลูกค้า</h3>
                                    <p className="text-sm text-slate-500 mt-0.5">
                                        พนักงาน: <span className="font-semibold text-slate-700">{modalContext.agentName}</span> | ตะกร้า: <span className="font-semibold text-indigo-600">{modalContext.basketName}</span>
                                    </p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            {/* Body */}
                            <div className="p-6 flex-1 overflow-y-auto bg-slate-50/30 custom-scrollbar">
                                {isLoadingDrilldown ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                                        <div className="text-sm text-slate-500">กำลังดึงข้อมูลรายชื่อ...</div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Tabs */}
                                        <div className="flex gap-2 mb-6 border-b border-slate-200 pb-px">
                                            <button 
                                                onClick={() => handleTabChange('all')}
                                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${modalTab === 'all' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                                            >
                                                ทั้งหมด ({drilldownCounts.total_all})
                                            </button>
                                            <button 
                                                onClick={() => handleTabChange('not_called')}
                                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${modalTab === 'not_called' ? 'border-slate-500 text-slate-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                                            >
                                                ยังไม่โทร ({drilldownCounts.total_not_called || 0})
                                            </button>
                                            <button 
                                                onClick={() => handleTabChange('called_no_appt')}
                                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${modalTab === 'called_no_appt' ? 'border-green-500 text-green-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                                            >
                                                <PhoneCall className="w-3.5 h-3.5" /> โทรแล้วไม่นัด ({drilldownCounts.total_called_no_appt || 0})
                                            </button>
                                            <button 
                                                onClick={() => handleTabChange('called_and_appt')}
                                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${modalTab === 'called_and_appt' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                                            >
                                                <CalendarCheck className="w-3.5 h-3.5" /> โทรและนัด ({drilldownCounts.total_called_and_appt || 0})
                                            </button>
                                            <button 
                                                onClick={() => handleTabChange('appt_no_call')}
                                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${modalTab === 'appt_no_call' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                                            >
                                                <CalendarDays className="w-3.5 h-3.5" /> นัดแต่ไม่โทร ({drilldownCounts.total_appt_no_call || 0})
                                            </button>
                                            {viewMode === 'performance' && (
                                                <button 
                                                    onClick={() => handleTabChange('reclaimed')}
                                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${modalTab === 'reclaimed' ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5" /> ดึงคืน ({drilldownCounts.total_reclaimed || 0})
                                                </button>
                                            )}
                                        </div>
                                        
                                        {/* Table */}
                                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600">
                                                    <tr>
                                                        <th className="px-4 py-3 font-semibold w-24">รหัสลูกค้า</th>
                                                        <th className="px-4 py-3 font-semibold">ชื่อลูกค้า</th>
                                                        <th className="px-4 py-3 font-semibold">เบอร์โทร</th>
                                                        {viewMode === 'performance' && (
                                                            <th className="px-4 py-3 font-semibold">ผู้ดูแลปัจจุบัน</th>
                                                        )}
                                                        <th className="px-4 py-3 font-semibold text-center w-28">สถานะการโทร</th>
                                                        <th className="px-4 py-3 font-semibold text-center w-28">นัดหมาย</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {drilldownData.map(customer => (
                                                            <tr key={customer.customer_id} className="hover:bg-slate-50 transition-colors">
                                                                <td className="px-4 py-3 text-slate-500">#{customer.customer_id}</td>
                                                                <td className="px-4 py-3 font-medium">
                                                                    <a 
                                                                        href={`?page=Dashboard+V2&customerId=${customer.customer_id}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1.5 w-fit"
                                                                        title="คลิกเพื่อเปิดหน้าต่างรายละเอียดลูกค้าในแท็บใหม่"
                                                                    >
                                                                        {customer.full_name}
                                                                        <svg className="w-3 h-3 text-indigo-400 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                                        </svg>
                                                                    </a>
                                                                    {customer.reclaimed_at && modalTab === 'reclaimed' && (
                                                                        <div className="text-[11px] text-rose-500 mt-0.5 flex items-center gap-1 w-fit bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                                                                            <RotateCcw className="w-2.5 h-2.5" /> ดึงเมื่อ {customer.reclaimed_at}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 text-slate-600 font-mono text-xs">{customer.phone}</td>
                                                                {viewMode === 'performance' && (
                                                                    <td className="px-4 py-3 text-slate-600">
                                                                        {customer.current_owner === 'กองกลาง (Pool)' ? (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                                                                                <Inbox className="w-3 h-3" /> กองกลาง
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-xs">{customer.current_owner}</span>
                                                                        )}
                                                                    </td>
                                                                )}
                                                            <td className="px-4 py-3 text-center">
                                                                {customer.has_called ? (
                                                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600 ring-2 ring-white shadow-sm" title="โทรแล้ว"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></span>
                                                                ) : (
                                                                    <span className="text-slate-300">-</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                {customer.has_appointment ? (
                                                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-600 ring-2 ring-white shadow-sm" title="มีนัดหมาย"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></span>
                                                                ) : (
                                                                    <span className="text-slate-300">-</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {drilldownData.length === 0 && (
                                                        <tr><td colSpan={viewMode === 'performance' ? 6 : 5} className="px-4 py-12 text-center text-slate-400 font-medium">ไม่พบรายชื่อลูกค้า</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Pagination Controls */}
                                        {totalPages > 1 && (
                                            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
                                                <div className="text-sm text-slate-500">
                                                    หน้า <span className="font-semibold text-slate-800">{currentPage}</span> จาก <span className="font-semibold text-slate-800">{totalPages}</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={() => handlePageChange(currentPage - 1)}
                                                        disabled={currentPage === 1}
                                                        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                    >
                                                        ก่อนหน้า
                                                    </button>
                                                    <button 
                                                        onClick={() => handlePageChange(currentPage + 1)}
                                                        disabled={currentPage === totalPages}
                                                        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                    >
                                                        ถัดไป
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `
                .custom-scrollbar::-webkit-scrollbar { height: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}} />
        </div>
    );
};

export default TelesaleCallstatsPage;
