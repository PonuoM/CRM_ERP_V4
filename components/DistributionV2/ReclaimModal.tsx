import React from 'react';
import { Loader2 } from 'lucide-react';

interface ReclaimModalProps {
    isOpen: boolean;
    reclaimingAgent: any; // Type it better if possible, but any is fine for now
    onClose: () => void;
    dashboardBaskets: any[];
    selectedBaskets: string[];
    setSelectedBaskets: React.Dispatch<React.SetStateAction<string[]>>;
    loadingReclaimPreviews: boolean;
    reclaimPreviewNoCallNoAppt: Record<string, number>;
    reclaimPreviewCalledNoAppt: Record<string, number>;
    reclaimPreviewCalledWithAppt: Record<string, number>;
    bulkActionType: 'transfer' | 'reclaim' | null;
    setBulkActionType: (val: 'transfer' | 'reclaim' | null) => void;
    bulkFilterType: 'all' | 'no_call_no_appt' | 'called_no_appt' | 'called_with_appt';
    setBulkFilterType: (val: 'all' | 'no_call_no_appt' | 'called_no_appt' | 'called_with_appt') => void;
    bulkTargetSupervisorFilter: number | '';
    setBulkTargetSupervisorFilter: (val: number | '') => void;
    availableSupervisors: any[];
    bulkTargetAgents: number[];
    setBulkTargetAgents: React.Dispatch<React.SetStateAction<number[]>>;
    agents: any[];
    bulkLimit: string;
    setBulkLimit: (val: string) => void;
    handleExecuteBulkAction: () => void;
    reclaiming: boolean;
    transferring: boolean;
}

const ReclaimModal: React.FC<ReclaimModalProps> = ({
    isOpen,
    reclaimingAgent,
    onClose,
    dashboardBaskets,
    selectedBaskets,
    setSelectedBaskets,
    loadingReclaimPreviews,
    reclaimPreviewNoCallNoAppt,
    reclaimPreviewCalledNoAppt,
    reclaimPreviewCalledWithAppt,
    bulkActionType,
    setBulkActionType,
    bulkFilterType,
    setBulkFilterType,
    bulkTargetSupervisorFilter,
    setBulkTargetSupervisorFilter,
    availableSupervisors,
    bulkTargetAgents,
    setBulkTargetAgents,
    agents,
    bulkLimit,
    setBulkLimit,
    handleExecuteBulkAction,
    reclaiming,
    transferring
}) => {
    if (!isOpen || !reclaimingAgent) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-50 rounded-2xl p-0 w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
                
                {/* Modal Header */}
                <div className="px-6 py-4 bg-white border-b flex items-center justify-between shadow-sm z-10">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">โอน / ดึงคืนลูกค้า (แบบกลุ่ม)</h3>
                        <p className="text-sm text-gray-500">จัดการลูกค้าของ {reclaimingAgent.firstName} {reclaimingAgent.lastName}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:bg-gray-100 p-2 rounded-full transition-colors">
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
                                    onChange={(e) => {
                                        const val = e.target.value as 'transfer' | 'reclaim' | '';
                                        setBulkActionType(val || null);
                                    }}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                                >
                                    <option value="">-- เลือกการกระทำ --</option>
                                    <option value="transfer">➡️ โอนให้ Telesale อื่น</option>
                                    <option value="reclaim">🔄 ดึงคืนเข้าถังกลาง</option>
                                </select>
                            </div>

                            {/* Filter Type Dropdown */}
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">เงื่อนไขรายชื่อ</label>
                                <select
                                    value={bulkFilterType}
                                    onChange={(e) => setBulkFilterType(e.target.value as any)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                                >
                                    <option value="all">ดึง/โอน ทั้งหมดในถัง</option>
                                    <option value="no_call_no_appt">📅 เฉพาะไม่มีการโทร</option>
                                    <option value="called_no_appt">📞 เฉพาะโทรแล้วไม่นัด</option>
                                    <option value="called_with_appt">✅ เฉพาะโทรและนัด</option>
                                </select>
                            </div>

                            {/* Target Agent (Only for Transfer) */}
                            {bulkActionType === 'transfer' && (
                                <div className="flex-1 animate-in fade-in slide-in-from-right-4 duration-200">
                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">พนักงานปลายทาง</label>
                                    <div className="mb-2">
                                        <select
                                            value={bulkTargetSupervisorFilter || ''}
                                            onChange={(e) => setBulkTargetSupervisorFilter(e.target.value ? Number(e.target.value) : '')}
                                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-blue-500 focus:border-blue-500 bg-white"
                                        >
                                            <option value="">-- ทุกทีม --</option>
                                            {availableSupervisors.map(sup => (
                                                <option key={sup.id} value={sup.id}>
                                                    {sup.name.startsWith('Supervisor ID:') ? sup.name.replace('Supervisor ID:', 'ทีม ID:') : `ทีม: ${sup.name}`}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="relative border border-gray-300 rounded-lg bg-white max-h-[140px] overflow-y-auto">
                                        <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-3 py-1.5 flex justify-between items-center z-10">
                                            <span className="text-xs font-medium text-gray-500">เลือกผู้รับโอน</span>
                                            <button 
                                                type="button" 
                                                className="text-xs text-blue-600 hover:underline"
                                                onClick={() => setBulkTargetAgents([])}
                                            >
                                                ล้างการเลือก
                                            </button>
                                        </div>
                                        {agents.filter(a => a.id !== reclaimingAgent.id && a.role !== 'admin' && a.role !== 'manager' && (!bulkTargetSupervisorFilter || a.supervisorId === bulkTargetSupervisorFilter)).map(agent => {
                                            const isSelected = bulkTargetAgents.includes(agent.id);
                                            return (
                                                <label key={agent.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm border-b border-gray-50 last:border-0">
                                                    <input 
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setBulkTargetAgents(prev => [...prev, agent.id]);
                                                            } else {
                                                                setBulkTargetAgents(prev => prev.filter(id => id !== agent.id));
                                                            }
                                                        }}
                                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                                                    />
                                                    <div className="flex flex-col">
                                                        <span>{agent.firstName} {agent.lastName}</span>
                                                        {agent.supervisorId && !bulkTargetSupervisorFilter && (
                                                            <span className="text-[10px] text-gray-400">
                                                                [ทีม: {agents.find(a => a.id === agent.supervisorId)?.firstName || 'ไม่ระบุ'}]
                                                            </span>
                                                        )}
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
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
                                    onClick={onClose}
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
                                        (bulkActionType === 'transfer' && bulkTargetAgents.length === 0) ||
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
    );
};

export default ReclaimModal;
