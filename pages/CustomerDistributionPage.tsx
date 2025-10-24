


import React, { useState, useMemo, useEffect } from 'react';
import { Customer, User, UserRole, CustomerGrade, CustomerLifecycleStatus } from '../types';
import { Users, Check, AlertTriangle, Info, ListChecks, History, Award, PlayCircle, BarChart, UserCheck, RefreshCw, Calendar } from 'lucide-react';
import { listCustomersBySource } from '@/services/api';

interface CustomerDistributionPageProps {
    allCustomers: Customer[];
    allUsers: User[];
    setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
}

type DistributionMode = 'average' | 'backlog' | 'gradeA';
type CustomerType = 'all' | 'new' | 'repeat' | 'prospect';
type PreviewAssignments = Record<number, Customer[]>;
type SkippedCustomer = { customer: Customer, reason: string };

const DateFilterButton: React.FC<{label: string, value: string, activeValue: string, onClick: (value: string) => void}> = ({ label, value, activeValue, onClick }) => (
    <button 
        onClick={() => onClick(value)}
        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeValue === value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
    >
        {label}
    </button>
);

const gradeOrder = [CustomerGrade.APlus, CustomerGrade.A, CustomerGrade.B, CustomerGrade.C, CustomerGrade.D];


const CustomerDistributionPage: React.FC<CustomerDistributionPageProps> = ({ allCustomers, allUsers, setCustomers }) => {
    // Pool source toggle (all | new_sale | waiting_return | stock)
    const [poolSource, setPoolSource] = useState<'all' | 'new_sale' | 'waiting_return' | 'stock'>('all');
    const [poolCustomers, setPoolCustomers] = useState<Customer[]>([]);
    const [loadingPool, setLoadingPool] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<DistributionMode>('average');
    const [targetStatus, setTargetStatus] = useState<CustomerLifecycleStatus>(CustomerLifecycleStatus.DailyDistribution);
    const [excludeGradeAPlus, setExcludeGradeAPlus] = useState(true);
    const [selectedAgentIds, setSelectedAgentIds] = useState<number[]>([]);
    const [distributionCount, setDistributionCount] = useState<string>('');
    const [distributionCountError, setDistributionCountError] = useState<string>('');
    // Customer type filtering is removed; default to 'all' to satisfy references in logic
    const customerType = 'all';
    
    const [activeDatePreset, setActiveDatePreset] = useState('all');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    const [previewAssignments, setPreviewAssignments] = useState<PreviewAssignments>({});
    const [skippedCustomers, setSkippedCustomers] = useState<SkippedCustomer[]>([]);
    const [showPreview, setShowPreview] = useState(false);
    const [distributionResult, setDistributionResult] = useState<{ success: number, skipped: number } | null>(null);

    const telesaleAgents = useMemo(() => {
        return allUsers.filter(u => u.role === UserRole.Telesale || u.role === UserRole.Supervisor);
    }, [allUsers]);

    // Load customers per selected pool source
    useEffect(() => {
        let mounted = true;
        if (poolSource === 'all') {
            setPoolCustomers(allCustomers);
            return;
        }
        setLoadingPool(true);
        // Note: company filter can be added if needed
        listCustomersBySource(poolSource)
            .then((rows: any[]) => { if (mounted) setPoolCustomers(rows as Customer[]); })
            .catch(() => { if (mounted) setPoolCustomers([]); })
            .finally(() => { if (mounted) setLoadingPool(false); });
        return () => { mounted = false; };
    }, [poolSource, allCustomers]);

    // Base dataset used throughout the page
    const dataCustomers: Customer[] = poolSource === 'all' ? allCustomers : poolCustomers;

    // Basket summaries
    const waitingBasketCount = useMemo(() => dataCustomers.filter(c => (c as any).isInWaitingBasket && !(c as any).isBlocked).length, [dataCustomers]);
    const toDistributeCount = useMemo(() => dataCustomers.filter(c => c.assignedTo === null && !(c as any).isBlocked && !(c as any).isInWaitingBasket).length, [dataCustomers]);
    const blockedCount = useMemo(() => dataCustomers.filter(c => (c as any).isBlocked).length, [dataCustomers]);

    const getAgentWorkloadByGrade = (agentId: number) => {
        const agentCustomers = dataCustomers.filter(c => c.assignedTo === agentId);
        const gradeCounts = agentCustomers.reduce((acc, customer) => {
            acc[customer.grade] = (acc[customer.grade] || 0) + 1;
            return acc;
        }, {} as Record<CustomerGrade, number>);
        
        return {
            total: agentCustomers.length,
            [CustomerGrade.APlus]: gradeCounts[CustomerGrade.APlus] || 0,
            [CustomerGrade.A]: gradeCounts[CustomerGrade.A] || 0,
            [CustomerGrade.B]: gradeCounts[CustomerGrade.B] || 0,
            [CustomerGrade.C]: gradeCounts[CustomerGrade.C] || 0,
            [CustomerGrade.D]: gradeCounts[CustomerGrade.D] || 0,
        };
    };

    const availableCustomers = useMemo(() => {
        let customers = dataCustomers.filter(c => c.assignedTo === null && !(c as any).isBlocked && !(c as any).isInWaitingBasket);
        
        // กรองตามประเภทลูกค้า
        switch (customerType) {
            case 'new':
                customers = customers.filter(c => c.isNewCustomer === true);
                break;
            case 'repeat':
                customers = customers.filter(c => c.isRepeatCustomer === true);
                break;
            case 'prospect':
                customers = customers.filter(c => !c.firstOrderDate); // ลูกค้าที่ยังไม่เคยซื้อ
                break;
            case 'all':
            default:
                // ไม่กรอง
                break;
        }
        
        // กรองตามช่วงเวลาการซื้อครั้งแรก (แทนการมอบหมาย)
        if (activeDatePreset !== 'all' && customerType !== 'prospect') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            customers = customers.filter(customer => {
                // ใช้ firstOrderDate แทน dateAssigned
                const orderDate = customer.firstOrderDate ? new Date(customer.firstOrderDate) : null;
                if (!orderDate) return false; // ถ้าไม่มี firstOrderDate ให้ข้าม
                
                orderDate.setHours(0, 0, 0, 0);

                switch (activeDatePreset) {
                    case 'today':
                        return orderDate.getTime() === today.getTime();
                    case '3days':
                        const threeDaysAgo = new Date(today);
                        threeDaysAgo.setDate(today.getDate() - 2);
                        return orderDate >= threeDaysAgo && orderDate <= today;
                    case '7days':
                        const sevenDaysAgo = new Date(today);
                        sevenDaysAgo.setDate(today.getDate() - 6);
                        return orderDate >= sevenDaysAgo && orderDate <= today;
                    case 'range':
                        if (!dateRange.start || !dateRange.end) return true;
                        const startDate = new Date(dateRange.start);
                        startDate.setHours(0, 0, 0, 0);
                        const endDate = new Date(dateRange.end);
                        endDate.setHours(0, 0, 0, 0);
                        return orderDate >= startDate && orderDate <= endDate;
                    default:
                        return true;
                }
            });
        }

        switch (activeTab) {
            case 'average':
            case 'backlog':
                if (excludeGradeAPlus) {
                    customers = customers.filter(c => c.grade !== CustomerGrade.A && c.grade !== CustomerGrade.APlus);
                }
                break;
            case 'gradeA':
                customers = customers.filter(c => c.grade === CustomerGrade.A || c.grade === CustomerGrade.APlus);
                break;
        }
        return customers;
    }, [dataCustomers, activeTab, customerType, excludeGradeAPlus, activeDatePreset, dateRange]);

    const handleDistributionCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const countStr = e.target.value;
        setDistributionCount(countStr);
        setShowPreview(false);

        if (countStr === '') {
            setDistributionCountError('');
            return;
        }

        const count = parseInt(countStr, 10);
        if (!isNaN(count) && count > availableCustomers.length) {
            setDistributionCountError(`จำนวนที่ต้องการแจก (${count}) มากกว่าลูกค้าที่พร้อมแจก (${availableCustomers.length})`);
        } else {
            setDistributionCountError('');
        }
    };


    const handleAgentSelection = (agentId: number) => {
        setSelectedAgentIds(prev =>
            prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]
        );
        setShowPreview(false);
    };

    const handleSelectAllAgents = () => {
        if (selectedAgentIds.length === telesaleAgents.length) {
            setSelectedAgentIds([]);
        } else {
            setSelectedAgentIds(telesaleAgents.map(a => a.id));
        }
        setShowPreview(false);
    };
    
    const handleGeneratePreview = () => {
        const count = parseInt(distributionCount, 10);
        if (isNaN(count) || count <= 0) {
            alert('กรุณาใส่จำนวนลูกค้าที่ต้องการแจกให้ถูกต้อง');
            return;
        }
        if (count > availableCustomers.length) {
            // This case should be prevented by disabled button, but as a safeguard.
            return;
        }
        if (selectedAgentIds.length === 0) {
            alert('กรุณาเลือกพนักงานเป้าหมาย');
            return;
        }

        const selectedAgents = telesaleAgents.filter(a => selectedAgentIds.includes(a.id));
        let distributableCustomers = [...availableCustomers];
        
        // Shuffle for fairness
        distributableCustomers.sort(() => Math.random() - 0.5);

        const assignments: PreviewAssignments = {};
        selectedAgents.forEach(agent => assignments[agent.id] = []);
        const skipped: SkippedCustomer[] = [];
        
        let assignedCount = 0;
        const customerPool = new Set(distributableCustomers);
        
        while(assignedCount < count && customerPool.size > 0) {
            let assignedInThisLoop = false;
            for (const agent of selectedAgents) {
                if (assignedCount >= count) break;
                
                for (const customer of customerPool) {
                    const hasHistory = customer.assignmentHistory?.includes(agent.id);
                    if (!hasHistory) {
                        assignments[agent.id].push(customer);
                        customerPool.delete(customer);
                        assignedCount++;
                        assignedInThisLoop = true;
                        break;
                    }
                }
            }
             if(!assignedInThisLoop) {
                customerPool.forEach(c => skipped.push({customer: c, reason: 'เคยอยู่กับพนักงานทุกคนที่เลือกแล้ว'}));
                break;
            }
        }

        setPreviewAssignments(assignments);
        setSkippedCustomers(skipped);
        setShowPreview(true);
        setDistributionResult(null);
    };

    const handleExecuteDistribution = () => {
        const totalToAssign = Object.values(previewAssignments).flat().length;
        if (totalToAssign === 0) {
            alert('ไม่มีรายชื่อสำหรับแจกจ่าย');
            return;
        }

        if (window.confirm(`ยืนยันการแจกจ่ายรายชื่อ ${totalToAssign} รายการ?`)) {
            const ninetyDaysFromNow = new Date();
            ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

            setCustomers(prevCustomers => {
                return prevCustomers.map(customer => {
                    for (const agentIdStr in previewAssignments) {
                        const agentId = parseInt(agentIdStr, 10);
                        const assignedCustomers = previewAssignments[agentId];
                        if (assignedCustomers.some(c => c.id === customer.id)) {
                            return {
                                ...customer,
                                assignedTo: agentId,
                                lifecycleStatus: targetStatus,
                                dateAssigned: new Date().toISOString(),
                                ownershipExpires: ninetyDaysFromNow.toISOString(),
                                assignmentHistory: [...(customer.assignmentHistory || []), agentId],
                            };
                        }
                    }
                    return customer;
                });
            });

            setDistributionResult({ success: totalToAssign, skipped: skippedCustomers.length });
            // Reset UI
            setShowPreview(false);
            setPreviewAssignments({});
            setSkippedCustomers([]);
            setDistributionCount('');
            setSelectedAgentIds([]);
        }
    };

    const handleDatePresetClick = (preset: string) => {
        setActiveDatePreset(preset);
        setDateRange({ start: '', end: '' });
        setShowPreview(false);
    };
    
    const handleDateRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setDateRange(prev => {
            const newRange = { ...prev, [name]: value };
            if (newRange.start && newRange.end) {
                setActiveDatePreset('range');
            }
            return newRange;
        });
        setShowPreview(false);
    };

    const datePresets = [
        { label: 'ทั้งหมด', value: 'all' },
        { label: 'วันนี้', value: 'today' },
        { label: '3 วันล่าสุด', value: '3days' },
        { label: '7 วันล่าสุด', value: '7days' },
    ];


    const renderTabContent = () => {
        const tabConfig = {
            average: { title: 'แจกแบบเฉลี่ย (รายวัน)', icon: ListChecks },
            backlog: { title: 'แจกย้อนหลัง', icon: History },
            gradeA: { title: 'แจกเกรด A/A+', icon: Award },
        };
        const { title, icon: Icon } = tabConfig[activeTab];

        return (
            <div className="space-y-6">
                <div className="p-6 bg-white rounded-lg shadow-sm border">
                    <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center"><Icon className="mr-2" />1. ตั้งค่าการแจก</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">สถานะหลังแจก</label>
                            <select 
                                value={targetStatus} 
                                onChange={e => setTargetStatus(e.target.value as CustomerLifecycleStatus)} 
                                className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                style={{ colorScheme: 'light' }}
                            >
                                {Object.values(CustomerLifecycleStatus).map(s => <option key={s} value={s} className="text-black">{s}</option>)}
                            </select>
                        </div>
                         {activeTab !== 'gradeA' && (
                            <div className="flex items-end">
                                <div className="flex items-center p-2 border rounded-md h-10">
                                    <input type="checkbox" id="exclude-grade-a" checked={excludeGradeAPlus} onChange={e => setExcludeGradeAPlus(e.target.checked)} className="h-4 w-4 rounded text-green-600 focus:ring-green-500" />
                                    <label htmlFor="exclude-grade-a" className="ml-2 text-sm text-gray-700">ยกเว้นเกรด A/A+</label>
                                </div>
                            </div>
                         )}
                    </div>

                    <div className="mt-4">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setPoolSource('all')} className={`px-3 py-1.5 text-xs rounded-md border ${poolSource==='all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}>ทั้งหมด</button>
                            <button onClick={() => setPoolSource('new_sale')} className={`px-3 py-1.5 text-xs rounded-md border ${poolSource==='new_sale' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}>เพิ่งขาย (Admin)</button>
                            <button onClick={() => setPoolSource('waiting_return')} className={`px-3 py-1.5 text-xs rounded-md border ${poolSource==='waiting_return' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}>คืนจากตะกร้า</button>
                            <button onClick={() => setPoolSource('stock')} className={`px-3 py-1.5 text-xs rounded-md border ${poolSource==='stock' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}>สต็อกรอแจก</button>
                            {loadingPool && poolSource !== 'all' && (<span className="text-xs text-gray-500 ml-2">กำลังโหลด...</span>)}
                        </div>
                    </div>

                    {/* ส่วนเลือกประเภทลูกค้า */}
                    {false && (
                    <div className="mt-4 pt-4 border-t">
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">ประเภทลูกค้า</label>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setCustomerType('all')}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                        customerType === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    ทั้งหมด
                                </button>
                                <button
                                    onClick={() => setCustomerType('new')}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                        customerType === 'new' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    ลูกค้าใหม่ (ซื้อครั้งแรก)
                                </button>
                                <button
                                    onClick={() => setCustomerType('repeat')}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                        customerType === 'repeat' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    ลูกค้ากลับมา (ซื้อซ้ำ)
                                </button>
                                <button
                                    onClick={() => setCustomerType('prospect')}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                        customerType === 'prospect' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    ลูกค้าที่ยังไม่ซื้อ
                                </button>
                            </div>
                        </div>
                    </div>
                    )}
                    
                    {false && (
                    <div className="mt-4 pt-4 border-t">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center mr-4">
                                <Calendar size={16} className="text-gray-500 mr-2"/>
                                <span className="text-sm font-medium text-gray-700">วันที่ลูกค้าซื้อครั้งแรก:</span>
                            </div>
                            {datePresets.map(preset => (
                                <DateFilterButton 
                                    key={preset.value}
                                    label={preset.label}
                                    value={preset.value}
                                    activeValue={activeDatePreset}
                                    onClick={handleDatePresetClick}
                                />
                            ))}
                            <div className="flex items-center gap-2 ml-auto">
                                <input 
                                    type="date" 
                                    name="start"
                                    value={dateRange.start}
                                    onChange={handleDateRangeChange}
                                    className="p-1 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                    style={{ colorScheme: 'light' }}
                                />
                                <span className="text-gray-500 text-sm">ถึง</span>
                                <input 
                                    type="date" 
                                    name="end"
                                    value={dateRange.end}
                                    onChange={handleDateRangeChange}
                                    className="p-1 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                    style={{ colorScheme: 'light' }}
                                />
                            </div>
                        </div>
                    </div>
                    )}
                </div>

                <div className="p-6 bg-white rounded-lg shadow-sm border">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-700 flex items-center"><UserCheck className="mr-2" />2. เลือกพนักงานเป้าหมาย</h3>
                            <p className="text-sm text-gray-500 mt-1">มีรายชื่อพร้อมแจก: <span className="font-bold text-green-600">{availableCustomers.length}</span> รายการ</p>
                            {distributionCountError && (
                                <p className="text-sm text-red-600 mt-1">{distributionCountError}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 text-right">จำนวนลูกค้าที่ต้องการแจก</label>
                            <input 
                                type="number" 
                                value={distributionCount} 
                                onChange={handleDistributionCountChange}
                                className="w-48 p-2 border border-gray-300 rounded-md text-right bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500" 
                                placeholder="เช่น 100" 
                                style={{ colorScheme: 'light' }}
                            />
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                                <tr>
                                    <th className="px-4 py-3">
                                        <input 
                                            type="checkbox"
                                            checked={selectedAgentIds.length === telesaleAgents.length && telesaleAgents.length > 0}
                                            onChange={handleSelectAllAgents}
                                            className="w-4 h-4 rounded text-green-600 focus:ring-green-500 border-gray-300"
                                        />
                                    </th>
                                    <th className="px-6 py-3">พนักงาน</th>
                                    <th className="px-6 py-3 text-center">ลูกค้าทั้งหมด</th>
                                    {gradeOrder.map(grade => (
                                        <th key={grade} className="px-2 py-3 text-center">{grade}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="text-gray-700">
                                {telesaleAgents.map(agent => {
                                    const workload = getAgentWorkloadByGrade(agent.id);
                                    return (
                                        <tr 
                                            key={agent.id} 
                                            className={`border-b ${selectedAgentIds.includes(agent.id) ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                                        >
                                            <td className="px-4 py-2">
                                                <input 
                                                    type="checkbox"
                                                    checked={selectedAgentIds.includes(agent.id)}
                                                    onChange={() => handleAgentSelection(agent.id)}
                                                    className="w-4 h-4 rounded text-green-600 focus:ring-green-500 border-gray-300"
                                                />
                                            </td>
                                            {/* FIX: Replaced non-existent 'name' property with 'firstName' and 'lastName' for the user object. */}
                                            <td className="px-6 py-2 font-medium text-gray-800">{`${agent.firstName} ${agent.lastName}`}</td>
                                            <td className="px-6 py-2 text-center font-bold">{workload.total}</td>
                                            {gradeOrder.map(grade => (
                                                <td key={grade} className="px-2 py-2 text-center">{workload[grade]}</td>
                                            ))}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex justify-center">
                     <button onClick={handleGeneratePreview} disabled={!distributionCount || selectedAgentIds.length === 0 || !!distributionCountError} className="bg-blue-100 text-blue-700 font-semibold text-sm rounded-md py-2 px-6 flex items-center hover:bg-blue-200 shadow-sm disabled:bg-gray-200 disabled:text-gray-500">
                        <BarChart size={16} className="mr-2"/>
                        ดูตัวอย่างก่อนแจก
                    </button>
                </div>

                {showPreview && (
                    <div className="p-6 bg-white rounded-lg shadow-sm border">
                        <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center"><Info className="mr-2" />3. ตัวอย่างการแจก</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="font-semibold mb-2">รายชื่อที่จะถูกแจก ({Object.values(previewAssignments).flat().length})</h4>
                                <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                                    {Object.entries(previewAssignments).map(([agentId, customers]) => {
                                        const agent = telesaleAgents.find(a => a.id === parseInt(agentId));
                                        return customers.length > 0 && (
                                            <div key={agentId}>
                                                {/* FIX: Replaced non-existent 'name' property with 'firstName' and 'lastName' for the user object. */}
                                                <p className="font-medium text-gray-800 mb-1">{agent ? `${agent.firstName} ${agent.lastName}` : ''} <span className="font-normal text-gray-500">({customers.length} รายชื่อ)</span></p>
                                                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 pl-2">
                                                    {/* FIX: Replaced non-existent 'name' property with 'firstName' and 'lastName' for the customer object. */}
                                                    {customers.map(c => <li key={c.id}>{`${c.firstName} ${c.lastName}`} ({c.phone})</li>)}
                                                </ul>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                             <div>
                                <h4 className="font-semibold mb-2 text-yellow-700">รายชื่อที่จะถูกข้าม ({skippedCustomers.length})</h4>
                                 <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                                      {skippedCustomers.slice(0,10).map(({customer, reason}) => (
                                         <p key={customer.id} className="text-sm text-gray-600">
                                            {/* FIX: Replaced non-existent 'name' property with 'firstName' and 'lastName' for the customer object. */}
                                            <span className="font-medium">{`${customer.firstName} ${customer.lastName}`}</span> - <span className="text-yellow-600 text-xs">{reason}</span>
                                        </p>
                                     ))}
                                     {skippedCustomers.length > 10 && <p className="text-xs text-gray-500">...และอีก {skippedCustomers.length - 10} รายการ</p>}
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-center mt-6">
                             <button onClick={handleExecuteDistribution} className="bg-green-100 text-green-700 font-semibold text-lg rounded-md py-3 px-8 flex items-center hover:bg-green-200 shadow-sm">
                                <PlayCircle size={20} className="mr-2"/>
                                ยืนยันการแจก
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">ระบบแจกลูกค้า</h2>
            {/* moved below into Step 1 card */}{false && (
            <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setPoolSource('all')} className={`px-3 py-1.5 text-xs rounded-md border ${poolSource==='all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}>ทั้งหมด</button>
                <button onClick={() => setPoolSource('new_sale')} className={`px-3 py-1.5 text-xs rounded-md border ${poolSource==='new_sale' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}>เพิ่งขาย (Admin)</button>
                <button onClick={() => setPoolSource('waiting_return')} className={`px-3 py-1.5 text-xs rounded-md border ${poolSource==='waiting_return' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}>คืนจากตะกร้า</button>
                <button onClick={() => setPoolSource('stock')} className={`px-3 py-1.5 text-xs rounded-md border ${poolSource==='stock' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}>สต็อกรอแจก</button>
                {loadingPool && poolSource !== 'all' && (<span className="text-xs text-gray-500 ml-2">กำลังโหลด...</span>)}
            </div>)}

            {distributionResult && (
                 <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-4">
                    <Check size={24} className="text-green-600" />
                    <div>
                        <p className="font-semibold text-green-800">แจกจ่ายรายชื่อสำเร็จ!</p>
                        <p className="text-sm text-green-700">แจกสำเร็จ {distributionResult.success} รายการ, ข้าม {distributionResult.skipped} รายการ</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                <div className="p-3 rounded-md border bg-white">
                    <p className="text-xs text-gray-500 mb-1">ตะกร้ารอแจก</p>
                    <p className="text-xl font-bold text-blue-600">{toDistributeCount}</p>
                </div>
                <div className="p-3 rounded-md border bg-white">
                    <p className="text-xs text-gray-500 mb-1">ตะกร้าพักรายชื่อ</p>
                    <p className="text-xl font-bold text-amber-600">{waitingBasketCount}</p>
                </div>
                <div className="p-3 rounded-md border bg-white">
                    <p className="text-xs text-gray-500 mb-1">ตะกร้าบล็อค</p>
                    <p className="text-xl font-bold text-red-600">{blockedCount}</p>
                </div>
            </div>

            <div className="flex border-b border-gray-200 mb-6">
                <button onClick={() => setActiveTab('average')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'average' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                    <ListChecks size={16} /><span>แจกแบบเฉลี่ย (รายวัน)</span>
                </button>
                 <button onClick={() => setActiveTab('backlog')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'backlog' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                    <History size={16} /><span>แจกย้อนหลัง</span>
                </button>
                 <button onClick={() => setActiveTab('gradeA')} className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'gradeA' ? 'border-b-2 border-red-600 text-red-600' : 'text-gray-500 hover:text-gray-700'}`}>
                    <Award size={16} /><span>แจกเกรด A/A+</span>
                </button>
            </div>
            
            {renderTabContent()}
        </div>
    );
};

export default CustomerDistributionPage;
