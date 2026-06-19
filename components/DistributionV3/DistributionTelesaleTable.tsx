import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Eye, Loader2 } from 'lucide-react';
import { AgentWithBaskets, BasketConfig } from '../../types/distribution';
import { apiFetch } from '../../services/api';

interface DistributionTelesaleTableProps {
    agents: AgentWithBaskets[];
    setAgents: React.Dispatch<React.SetStateAction<AgentWithBaskets[]>>;
    selectedAgents: number[];
    setSelectedAgents: React.Dispatch<React.SetStateAction<number[]>>;
    totalToDistribute: string;
    dashboardBaskets: BasketConfig[];
    availableCount: number;
    handlePreparePreview: () => void;
    openReclaimModal: (agent: any) => void;
    setMessage: (msg: any) => void;
    currentUser: any;
}

const DistributionTelesaleTable: React.FC<DistributionTelesaleTableProps> = ({
    agents,
    setAgents,
    selectedAgents,
    setSelectedAgents,
    totalToDistribute,
    dashboardBaskets,
    availableCount,
    handlePreparePreview,
    openReclaimModal,
    setMessage,
    currentUser
}) => {
    const [agentSearch, setAgentSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('');
    const [companyFilter, setCompanyFilter] = useState<number | ''>('');
    
    const [callDataSource, setCallDataSource] = useState<'db' | 'realtime'>('db');
    const [callFilterStartDate, setCallFilterStartDate] = useState<string>(() => {
        const d = new Date();
        return d.toISOString().split('T')[0];
    });
    const [callFilterEndDate, setCallFilterEndDate] = useState<string>(() => {
        const d = new Date();
        return d.toISOString().split('T')[0];
    });
    const [callThresholdMinutes, setCallThresholdMinutes] = useState<string>('100');
    const [loadingCallMinutes, setLoadingCallMinutes] = useState(false);

    const selectAllRef = useRef<HTMLInputElement>(null);

    const roles = Array.from(new Set(agents.map(a => a.role))).filter(Boolean);
    const companies = Array.from(new Set(agents.map(a => a.companyId))).filter(Boolean);

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
    }, [agents.length, callFilterStartDate, callFilterEndDate, currentUser?.companyId, callDataSource, setAgents, setMessage]);

    useEffect(() => {
        if (agents.length > 0) {
            fetchCallMinutes();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [callFilterStartDate, callFilterEndDate, agents.length, callDataSource]);

    const filteredAgents = useMemo(() => {
        return agents.filter(agent => {
            const matchSearch = (agent.firstName + ' ' + agent.lastName).toLowerCase().includes(agentSearch.toLowerCase());
            const matchRole = !roleFilter || agent.role === roleFilter;
            const matchCompany = !companyFilter || agent.companyId === companyFilter;
            
            let matchThreshold = true;
            if (callThresholdMinutes) {
                const threshold = parseInt(callThresholdMinutes);
                if (!isNaN(threshold)) {
                    const agentMinutes = agent.callMinutes || 0;
                    matchThreshold = agentMinutes >= threshold;
                }
            }
            return matchSearch && matchRole && matchCompany && matchThreshold && agent.isActive;
        });
    }, [agents, agentSearch, roleFilter, companyFilter, callThresholdMinutes]);

    const handleSelectAllClick = () => {
        if (selectedAgents.length === filteredAgents.length) {
            setSelectedAgents([]);
        } else {
            setSelectedAgents(filteredAgents.map(a => a.id));
        }
    };

    const handleAgentToggle = (id: number) => {
        setSelectedAgents(prev => 
            prev.includes(id) ? prev.filter(aid => aid !== id) : [...prev, id]
        );
    };

    useEffect(() => {
        if (selectAllRef.current) {
            if (selectedAgents.length > 0 && selectedAgents.length < filteredAgents.length) {
                selectAllRef.current.indeterminate = true;
            } else {
                selectAllRef.current.indeterminate = false;
            }
        }
    }, [selectedAgents, filteredAgents]);

    return (
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
                    <div className="text-sm font-medium text-gray-600">
                        ยอดที่ตั้งไว้: {totalToDistribute || 0}
                    </div>
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

            <div className="mb-4 bg-orange-50 border border-orange-100 rounded-lg p-4 flex flex-wrap items-end gap-4 shadow-sm">
                <div>
                    <label className="block text-xs font-semibold text-orange-800 mb-1">แหล่งข้อมูลเวลาโทร</label>
                    <select
                        value={callDataSource}
                        onChange={(e) => {
                            const val = e.target.value as 'db' | 'realtime';
                            setCallDataSource(val);
                            if (val === 'realtime') {
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
                                    const adjustedStart = new Date(eDate);
                                    adjustedStart.setDate(eDate.getDate() - 3);
                                    setCallFilterStartDate(adjustedStart.toISOString().split('T')[0]);
                                }
                            }
                            setCallFilterEndDate(newEnd);
                        }}
                        className="border border-orange-200 rounded p-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-orange-800 mb-1">แสดงพนักงานที่โทรเกิน (นาที)</label>
                    <input
                        type="number"
                        value={callThresholdMinutes}
                        onChange={(e) => setCallThresholdMinutes(e.target.value)}
                        className="border border-orange-200 rounded p-2 text-sm focus:ring-orange-500 focus:border-orange-500 w-32"
                        placeholder="ตย. 100"
                    />
                </div>
                <div className="flex-1 text-right">
                    <button
                        onClick={fetchCallMinutes}
                        className="px-3 py-2 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 text-sm font-medium inline-flex items-center gap-2"
                        disabled={loadingCallMinutes}
                    >
                        {loadingCallMinutes && <Loader2 size={14} className="animate-spin" />}
                        โหลดข้อมูลเวลาโทรใหม่
                    </button>
                </div>
            </div>

            <div className="flex gap-4 mb-4">
                <input
                    type="text"
                    placeholder="ค้นหาชื่อพนักงาน..."
                    className="border rounded p-2 w-64"
                    value={agentSearch}
                    onChange={(e) => setAgentSearch(e.target.value)}
                />
                <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="border rounded p-2"
                >
                    <option value="">ทุกตำแหน่ง</option>
                    {roles.map(role => (
                        <option key={role} value={role as string}>{role}</option>
                    ))}
                </select>
                <select
                    value={companyFilter}
                    onChange={(e) => setCompanyFilter(e.target.value ? parseInt(e.target.value) : '')}
                    className="border rounded p-2"
                >
                    <option value="">ทุกบริษัท</option>
                    {companies.map(cid => (
                        <option key={cid} value={cid as number}>Company {cid}</option>
                    ))}
                </select>
            </div>

            {filteredAgents.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border rounded-lg bg-gray-50">
                    ไม่พบพนักงานที่ตรงกับเงื่อนไขที่กำหนด
                </div>
            ) : (
                <div className="overflow-auto max-h-[500px] border rounded-lg">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="text-left p-3">
                                    <input
                                        type="checkbox"
                                        ref={selectAllRef}
                                        checked={selectedAgents.length === filteredAgents.length && filteredAgents.length > 0}
                                        onChange={handleSelectAllClick}
                                        className="w-4 h-4 rounded text-blue-600"
                                    />
                                </th>
                                <th className="text-left p-3 font-semibold">พนักงาน</th>
                                <th className="text-left p-3 font-semibold">ตำแหน่ง</th>
                                <th className="text-left p-3 font-semibold">เวลาโทร (ช่วงเวลาที่เลือก)</th>
                                <th className="text-center p-3 font-semibold">ดึงคืน</th>
                                <th className="text-center p-3 font-semibold border-x bg-gray-200">ลูกค้าในมือ</th>
                                {dashboardBaskets.map(basket => (
                                    <th key={basket.basket_key} className="text-center p-3 text-xs font-medium text-gray-600 bg-gray-50 whitespace-nowrap">
                                        <div className="truncate max-w-[100px] mx-auto" title={basket.basket_name}>
                                            {basket.basket_name}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAgents.map(agent => {
                                const isChecked = selectedAgents.includes(agent.id);
                                return (
                                    <tr 
                                        key={agent.id} 
                                        className={`border-t hover:bg-gray-50 transition-colors cursor-pointer ${isChecked ? 'bg-blue-50/30' : ''}`}
                                        onClick={() => handleAgentToggle(agent.id)}
                                    >
                                        <td className="p-3">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => {}} // handled by tr click
                                                className="w-4 h-4 rounded text-blue-600"
                                            />
                                        </td>
                                        <td className="p-3">
                                            <div className="font-medium text-gray-800">{agent.firstName} {agent.lastName}</div>
                                            <div className="text-xs text-gray-500">ID: {agent.id}</div>
                                        </td>
                                        <td className="p-3">
                                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                                                {agent.role}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            {loadingCallMinutes ? (
                                                <div className="w-16 h-4 bg-gray-200 animate-pulse rounded"></div>
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
        </div>
    );
};

export default DistributionTelesaleTable;
