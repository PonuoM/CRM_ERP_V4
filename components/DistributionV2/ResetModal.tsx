import React from 'react';
import { Loader2, Search, ChevronDown, Eye, RefreshCw } from 'lucide-react';
import { ResetCandidate } from '../../types/distribution';

interface ResetModalProps {
    isOpen: boolean;
    onClose: () => void;
    resetAgentDropdownOpen: boolean;
    setResetAgentDropdownOpen: (open: boolean) => void;
    resetTargetCount: string;
    setResetTargetCount: (count: string) => void;
    resetOptions: { assigned_count: number; customer_count: number }[];
    handleCheckCandidates: () => void;
    findingCandidates: boolean;
    resetSearchText: string;
    setResetSearchText: (text: string) => void;
    resetAgentFilter: number[];
    setResetAgentFilter: React.Dispatch<React.SetStateAction<number[]>>;
    resetAgentMode: 'any' | 'all';
    setResetAgentMode: (mode: 'any' | 'all') => void;
    resetAgentOptions: { id: number; first_name: string; last_name: string }[];
    resetCandidates: ResetCandidate[];
    resetTotal: number;
    toggleAllResetCandidates: () => void;
    allResetSelected: boolean;
    toggleResetCandidate: (id: number) => void;
    handleViewHistory: (c: ResetCandidate) => void;
    resetTotalPages: number;
    resetPage: number;
    changeResetPage: (page: number) => void;
    handleManualReset: (mode: 'all' | 'selected') => void;
    resetting: boolean;
}

const ResetModal: React.FC<ResetModalProps> = ({
    isOpen,
    onClose,
    resetAgentDropdownOpen,
    setResetAgentDropdownOpen,
    resetTargetCount,
    setResetTargetCount,
    resetOptions,
    handleCheckCandidates,
    findingCandidates,
    resetSearchText,
    setResetSearchText,
    resetAgentFilter,
    setResetAgentFilter,
    resetAgentMode,
    setResetAgentMode,
    resetAgentOptions,
    resetCandidates,
    resetTotal,
    toggleAllResetCandidates,
    allResetSelected,
    toggleResetCandidate,
    handleViewHistory,
    resetTotalPages,
    resetPage,
    changeResetPage,
    handleManualReset,
    resetting
}) => {
    if (!isOpen) return null;

    return (
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
                        onClick={onClose}
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
                            onClick={onClose}
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
    );
};

export default ResetModal;
