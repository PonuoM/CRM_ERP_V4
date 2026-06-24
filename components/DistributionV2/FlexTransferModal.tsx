import React from 'react';
import { ArrowRightLeft, Plus, Trash2, Loader2, Check } from 'lucide-react';

interface FlexTransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    flexTransferMode: '1_to_many' | 'many_to_1';
    setFlexTransferMode: (val: '1_to_many' | 'many_to_1') => void;
    flex1toManySourceAgent: number | null;
    setFlex1toManySourceAgent: (val: number | null) => void;
    flex1toManyBasket: string;
    setFlex1toManyBasket: (val: string) => void;
    flex1toManyTotalTransferCount: string;
    setFlex1toManyTotalTransferCount: (val: string) => void;
    flex1toManyTargets: Record<number, string>;
    setFlex1toManyTargets: React.Dispatch<React.SetStateAction<Record<number, string>>>;
    flex1toManyCheckedTargets: number[];
    setFlex1toManyCheckedTargets: React.Dispatch<React.SetStateAction<number[]>>;
    flexManyto1TargetAgent: number | null;
    setFlexManyto1TargetAgent: (val: number | null) => void;
    flexManyto1Sources: any[];
    setFlexManyto1Sources: React.Dispatch<React.SetStateAction<any[]>>;
    agents: any[];
    dashboardBaskets: any[];
    handleDistributeEvenly: () => void;
    handleExecuteFlexTransfer: () => void;
    flexTransferring: boolean;
}

const FlexTransferModal: React.FC<FlexTransferModalProps> = ({
    isOpen,
    onClose,
    flexTransferMode,
    setFlexTransferMode,
    flex1toManySourceAgent,
    setFlex1toManySourceAgent,
    flex1toManyBasket,
    setFlex1toManyBasket,
    flex1toManyTotalTransferCount,
    setFlex1toManyTotalTransferCount,
    flex1toManyTargets,
    setFlex1toManyTargets,
    flex1toManyCheckedTargets,
    setFlex1toManyCheckedTargets,
    flexManyto1TargetAgent,
    setFlexManyto1TargetAgent,
    flexManyto1Sources,
    setFlexManyto1Sources,
    agents,
    dashboardBaskets,
    handleDistributeEvenly,
    handleExecuteFlexTransfer,
    flexTransferring
}) => {
    if (!isOpen) return null;

    return (
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
                        onClick={onClose}
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
                        onClick={onClose}
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
    );
};

export default FlexTransferModal;
