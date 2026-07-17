import React from 'react';
import SessionTagSelect from './SessionTagSelect';
import { Loader2, Check, Scale, Zap, TrendingUp, Minus } from 'lucide-react';

interface PreviewModalProps {
    showPreview: boolean;
    setShowPreview: (val: boolean) => void;
    distributionMode: 'equal' | 'load_balance' | 'performance';
    setDistributionMode: (val: 'equal' | 'load_balance' | 'performance') => void;
    distributeRemainder: boolean;
    setDistributeRemainder: (val: boolean) => void;
    previewWarning: string | null;
    preview: any[];
    distributing: boolean;
    handleExecuteDistribution: () => void;
    sessionTag: number | '';
    setSessionTag: (val: number | '') => void;
    sessionTagsList: any[];
}

const PreviewModal: React.FC<PreviewModalProps> = ({
    showPreview,
    setShowPreview,
    distributionMode,
    setDistributionMode,
    distributeRemainder,
    setDistributeRemainder,
    previewWarning,
    preview,
    distributing,
    handleExecuteDistribution,
    sessionTag,
    setSessionTag,
    sessionTagsList
}) => {
    if (!showPreview) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-auto">
                <h3 className="text-xl font-bold mb-4">Preview การแจกงาน</h3>

                {/* Distribution Modes */}
                <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">เลือกนโยบายการแจก (Distribution Mode)</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                        {/* Equal Mode */}
                        <div 
                            onClick={() => setDistributionMode('equal')}
                            className={`border rounded-xl p-3 cursor-pointer transition-all ${distributionMode === 'equal' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <Scale className={distributionMode === 'equal' ? 'text-blue-600' : 'text-gray-500'} size={18} />
                                <span className="font-semibold text-sm text-gray-800">Equal (เท่ากันทุกคน)</span>
                            </div>
                            <p className="text-xs text-gray-500 mb-2 leading-tight">ทำยังไง: นำรายชื่อหารจำนวนคนตรงๆ ทุกคนได้เท่ากัน</p>
                        </div>
                        
                        {/* Load Balance Mode */}
                        <div 
                            onClick={() => setDistributionMode('load_balance')}
                            className={`border rounded-xl p-3 cursor-pointer transition-all ${distributionMode === 'load_balance' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <Zap className={distributionMode === 'load_balance' ? 'text-blue-600' : 'text-gray-500'} size={18} />
                                <span className="font-semibold text-sm text-gray-800">Load Balance</span>
                            </div>
                            <p className="text-xs text-gray-500 mb-2 leading-tight">ทำยังไง: ดูยอดลูกค้าปัจจุบัน ใครถือน้อยจะได้เยอะเพื่อบาลานซ์</p>
                        </div>

                        {/* Performance Mode */}
                        <div 
                            onClick={() => setDistributionMode('performance')}
                            className={`border rounded-xl p-3 cursor-pointer transition-all ${distributionMode === 'performance' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <TrendingUp className={distributionMode === 'performance' ? 'text-blue-600' : 'text-gray-500'} size={18} />
                                <span className="font-semibold text-sm text-gray-800">Performance (ความขยัน)</span>
                            </div>
                            <p className="text-xs text-gray-500 mb-2 leading-tight">ทำยังไง: อิงยอด 'เวลาโทร' คนโทรเยอะจะได้สัดส่วนลูกค้าเยอะ</p>
                        </div>
                    </div>

                    {distributionMode === 'equal' && (
                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer w-fit">
                            <input 
                                type="checkbox" 
                                checked={distributeRemainder}
                                onChange={(e) => setDistributeRemainder(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>กระจายเศษรายชื่อที่หารไม่ลงตัวให้พนักงาน (คนแรกๆ จะได้ +1)</span>
                        </label>
                    )}
                </div>

                {previewWarning && (
                    <div className="mb-6 p-4 bg-orange-50 border border-orange-200 text-orange-800 rounded-xl text-sm">
                        {previewWarning}
                    </div>
                )}


                {/* Session Tag */}
                <div className="mb-6 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">ป้ายกำกับเซสชั่น (Session Tag) (ไม่บังคับ)</label>
                    <SessionTagSelect
                        value={sessionTag}
                        onChange={setSessionTag}
                        options={sessionTagsList}
                        className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-2">พิมพ์เพื่อเพิ่ม Tag ใหม่ หรือเลือกจาก Tag เดิมที่เคยใช้ เพื่อช่วยให้ค้นหาง่ายขึ้นตอนดึงรายงาน</p>
                </div>

                {/* Summary Dashboard */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
                        <div>
                            <div className="text-blue-600 font-semibold text-2xl">{preview.filter(p => p.customers.length > 0).length} คน</div>
                            <div className="text-sm text-blue-800">พนักงานที่ได้รับการแจก</div>
                        </div>
                        <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center text-blue-600">
                            <Check size={20} />
                        </div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                        <div>
                            <div className="text-gray-600 font-semibold text-2xl">{preview.filter(p => p.customers.length === 0).length} คน</div>
                            <div className="text-sm text-gray-500">พนักงานที่ไม่ได้การแจก (ได้ 0 คน)</div>
                        </div>
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500">
                            <Minus size={20} />
                        </div>
                    </div>
                </div>

                <div className="space-y-4 mb-6">
                    {preview.filter(item => item.customers.length > 0).map(item => (
                        <div key={item.agentId} className="border border-blue-200 bg-blue-50/30 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-blue-900">{item.agentName}</span>
                                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">{item.customers.length} รายชื่อ</span>
                            </div>
                            <div className="text-sm text-gray-600">
                                {item.customers.slice(0, 5).map((c: any) => `${c.firstName} ${c.lastName}`).join(', ')}
                                {item.customers.length > 5 && <span className="text-gray-400"> และอีก {item.customers.length - 5} คน</span>}
                            </div>
                        </div>
                    ))}

                    {/* Agents who received 0 */}
                    {preview.filter(item => item.customers.length === 0).length > 0 && (
                        <>
                            <h4 className="text-sm font-semibold text-gray-500 mt-6 mb-2">พนักงานที่ไม่ได้รับการแจกรายชื่อในรอบนี้:</h4>
                            <div className="flex flex-wrap gap-2">
                                {preview.filter(item => item.customers.length === 0).map(item => (
                                    <div key={item.agentId} className="border border-gray-200 bg-gray-50 text-gray-500 px-3 py-1.5 rounded-lg text-sm flex items-center gap-2">
                                        {item.agentName} <span className="bg-gray-200 text-gray-500 text-xs px-1.5 py-0.5 rounded">0</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
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
    );
};

export default PreviewModal;
