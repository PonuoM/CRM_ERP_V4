import React, { useState, useEffect } from 'react';
import { Loader2, Download, History, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import ExcelJS from 'exceljs';

interface DistributionReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    setMessage: (msg: { type: 'success' | 'error' | 'warning'; text: string } | null) => void;
}

interface CustomerDetail {
    id: number;
    code: string;
    name: string;
    phone: string;
}

interface AgentDetail {
    agent_id: number;
    agent_name: string;
    customers: CustomerDetail[];
}

interface AgentSnapshot {
    id: number;
    name: string;
    role: string;
    callMinutes: number;
    isActive: boolean;
}

interface DistributionSession {
    id: number;
    company_id: number;
    distribution_mode: string;
    source_basket?: string;
    total_customers: number;
    created_at: string;
    distributed_by_name: string;
    details: AgentDetail[];
    agent_snapshot?: AgentSnapshot[];
    session_status?: string;
}

const DistributionReportModal: React.FC<DistributionReportModalProps> = ({ isOpen, onClose, setMessage }) => {
    const [loading, setLoading] = useState(false);
    const [sessions, setSessions] = useState<DistributionSession[]>([]);
    const [expandedSessions, setExpandedSessions] = useState<Set<number>>(new Set());
    
    // Undo State
    const [undoTarget, setUndoTarget] = useState<number | null>(null);
    const [undoMode, setUndoMode] = useState<'safe' | 'force'>('safe');
    const [isUndoing, setIsUndoing] = useState(false);

    // Cleanup State
    const [showCleanup, setShowCleanup] = useState(false);
    const [cleanupMonths, setCleanupMonths] = useState(3);
    const [cleanupTargetCompany, setCleanupTargetCompany] = useState<string>('current');
    const [isCleaning, setIsCleaning] = useState(false);
    
    // Check if user is system admin
    const currentUserStr = localStorage.getItem('user');
    const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
    const isSystemAdmin = currentUser?.is_system == 1;
    const isSuperAdmin = currentUser?.role?.toLowerCase() === 'super_admin';

    const toggleExpand = (sessionId: number) => {
        setExpandedSessions(prev => {
            const next = new Set(prev);
            if (next.has(sessionId)) {
                next.delete(sessionId);
            } else {
                next.add(sessionId);
            }
            return next;
        });
    };

    const handleUndo = async () => {
        if (!undoTarget) return;
        
        setIsUndoing(true);
        try {
            const currentUserStr = localStorage.getItem('user');
            const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
            
            const res = await fetch('/api/Distribution/index.php?action=undo_distribution&companyId=1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: undoTarget,
                    mode: undoMode,
                    triggered_by: currentUser?.id
                })
            });
            const data = await res.json();
            
            if (data.ok) {
                setMessage({ type: 'success', text: `ดึงกลับสำเร็จ ${data.success_count} รายการ (ข้าม ${data.skipped_count} รายการ)` });
                setUndoTarget(null);
                fetchSessions(); // Refresh list
            } else {
                setMessage({ type: 'error', text: data.error || 'Undo failed' });
            }
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: 'Network error during undo' });
        } finally {
            setIsUndoing(false);
        }
    };

    const handleCleanup = async () => {
        setIsCleaning(true);
        try {
            const res = await fetch('/api/Distribution/index.php?action=cleanup_distribution_details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUser?.id,
                    target_company_id: cleanupTargetCompany === 'current' ? currentUser?.company_id : cleanupTargetCompany,
                    months_old: cleanupMonths
                })
            });
            const data = await res.json();
            
            if (data.ok) {
                setMessage({ type: 'success', text: `ลบประวัติสำเร็จ: ${data.message}` });
                setShowCleanup(false);
            } else {
                setMessage({ type: 'error', text: data.error || 'Cleanup failed' });
            }
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: 'Network error during cleanup' });
        } finally {
            setIsCleaning(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchSessions();
        }
    }, [isOpen]);

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/Distribution/index.php?action=get_sessions&companyId=1');
            const data = await res.json();
            if (data.ok) {
                setSessions(data.sessions);
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to load sessions' });
            }
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: 'Network error while loading sessions' });
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (minutesDecimal: number) => {
        const mins = Math.floor(minutesDecimal);
        const secs = Math.round((minutesDecimal - mins) * 60);
        return `${mins} นาที ${secs} วินาที`;
    };

    const handleExport = async (session: DistributionSession) => {
        const workbook = new ExcelJS.Workbook();
        
        // ==========================================
        // SHEET 1: Summary Snapshot
        // ==========================================
        const wsSummary = workbook.addWorksheet('Summary Snapshot');
        
        // Define Columns for Summary Sheet
        wsSummary.columns = [
            { key: 'no', width: 8 },           // A: ลำดับ
            { key: 'agentId', width: 12 },     // B: Agent ID
            { key: 'name', width: 25 },        // C: ชื่อพนักงาน
            { key: 'role', width: 20 },        // D: ตำแหน่ง
            { key: 'time', width: 20 },        // E: เวลาโทร
            { key: 'status', width: 15 },      // F: สถานะ
            { key: 'count', width: 20 },       // G: จำนวนที่ได้รับรายชื่อ
            { key: 'spacer', width: 5 },       // H: (Spacer)
            { key: 'met_criteria', width: 25 },// I: เข้าเกณฑ์
            { key: 'failed_criteria', width: 25} // J: ไม่เข้าเกณฑ์
        ];

        // Process Data
        const snapshot = session.agent_snapshot || [];
        const detailsMap = new Map<number, number>();
        session.details.forEach(d => detailsMap.set(d.agent_id, d.customers.length));

        const receivedAgents: any[] = [];
        const failedAgents: any[] = [];

        snapshot.forEach(agent => {
            const count = detailsMap.get(agent.id) || 0;
            if (count > 0) {
                receivedAgents.push({ ...agent, count });
            } else {
                failedAgents.push({ ...agent, count: 0 });
            }
        });

        // Top Main Table Header (ตารางหลัก)
        wsSummary.mergeCells('A1:G1');
        const mainTitle = wsSummary.getCell('A1');
        mainTitle.value = 'ตารางหลัก';
        mainTitle.alignment = { horizontal: 'center', vertical: 'middle' };
        mainTitle.font = { bold: true };

        // Criteria Headers
        wsSummary.getCell('I1').value = 'เข้าเกณฑ์';
        wsSummary.getCell('I1').alignment = { horizontal: 'center' };
        wsSummary.getCell('J1').value = 'ไม่เข้าเกณฑ์';
        wsSummary.getCell('J1').alignment = { horizontal: 'center' };

        // Column Headers (Row 2)
        const headers = ['ลำดับ', 'Agent ID', 'ชื่อพนักงาน', 'ตำแหน่ง', 'เวลาโทร', 'สถานะ', 'จำนวนที่ได้รับรายชื่อ'];
        headers.forEach((h, i) => {
            const cell = wsSummary.getCell(2, i + 1);
            cell.value = h;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        wsSummary.getCell('I2').value = 'ชื่อพนักงาน';
        wsSummary.getCell('I2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
        wsSummary.getCell('I2').font = { color: { argb: 'FFFFFFFF' }, bold: true };
        
        wsSummary.getCell('J2').value = 'ชื่อพนักงาน';
        wsSummary.getCell('J2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
        wsSummary.getCell('J2').font = { color: { argb: 'FFFFFFFF' }, bold: true };

        // Fill Data Rows
        let currentRow = 3;
        const maxDataRows = Math.max(receivedAgents.length + failedAgents.length + 2, Math.max(receivedAgents.length, failedAgents.length) + 5);

        // 1. Fill Received Agents
        receivedAgents.forEach((agent, idx) => {
            wsSummary.getCell(`A${currentRow}`).value = idx + 1;
            wsSummary.getCell(`B${currentRow}`).value = agent.id;
            wsSummary.getCell(`C${currentRow}`).value = agent.name;
            wsSummary.getCell(`D${currentRow}`).value = agent.role;
            wsSummary.getCell(`E${currentRow}`).value = formatTime(agent.callMinutes);
            wsSummary.getCell(`F${currentRow}`).value = 'ได้รับรายชื่อ';
            wsSummary.getCell(`G${currentRow}`).value = agent.count;
            currentRow++;
        });

        // 2. Add Gap
        currentRow++;

        // 3. Fill Failed Agents Table Header
        headers.forEach((h, i) => {
            const cell = wsSummary.getCell(currentRow, i + 1);
            cell.value = h;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        currentRow++;

        // 4. Fill Failed Agents
        let failedStartIdx = receivedAgents.length + 1;
        failedAgents.forEach((agent) => {
            wsSummary.getCell(`A${currentRow}`).value = failedStartIdx++;
            wsSummary.getCell(`B${currentRow}`).value = agent.id;
            wsSummary.getCell(`C${currentRow}`).value = agent.name;
            wsSummary.getCell(`D${currentRow}`).value = agent.role;
            wsSummary.getCell(`E${currentRow}`).value = formatTime(agent.callMinutes);
            wsSummary.getCell(`F${currentRow}`).value = 'หลุดเกณฑ์';
            wsSummary.getCell(`G${currentRow}`).value = 0;
            currentRow++;
        });

        // 5. Fill Right Side (Criteria Lists)
        let criteriaRow = 3;
        receivedAgents.forEach(agent => {
            wsSummary.getCell(`I${criteriaRow}`).value = agent.name;
            criteriaRow++;
        });

        criteriaRow = 3;
        failedAgents.forEach(agent => {
            wsSummary.getCell(`J${criteriaRow}`).value = agent.name;
            criteriaRow++;
        });

        // 6. Add Total Distributed Label
        // หาว่าตารางเข้าเกณฑ์/ไม่เข้าเกณฑ์ อันไหนยาวกว่ากัน แล้วบวก 2 แถว
        const maxCriteriaLength = Math.max(receivedAgents.length, failedAgents.length);
        const maxCriteriaRow = maxCriteriaLength > 0 ? 2 + maxCriteriaLength : 2; // header อยู่บรรทัด 2
        const totalRow = maxCriteriaRow + 2;
        
        wsSummary.getCell(`I${totalRow}`).value = 'รวมรายชื่อแจกทั้งหมด';
        wsSummary.getCell(`I${totalRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
        wsSummary.getCell(`I${totalRow}`).font = { color: { argb: 'FFFFFFFF' }, bold: true };
        
        wsSummary.getCell(`J${totalRow}`).value = session.total_customers;
        wsSummary.getCell(`J${totalRow}`).alignment = { horizontal: 'center' };
        wsSummary.getCell(`J${totalRow}`).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        // Apply borders to all filled cells in main tables
        for (let i = 2; i < currentRow; i++) {
            if (wsSummary.getCell(`A${i}`).value || wsSummary.getCell(`A${i}`).fill?.type) {
                ['A','B','C','D','E','F','G'].forEach(col => {
                    wsSummary.getCell(`${col}${i}`).border = {
                        top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}
                    };
                });
            }
        }

        // Apply borders to criteria tables
        for (let i = 2; i < Math.max(receivedAgents.length + 3, failedAgents.length + 3); i++) {
            if (wsSummary.getCell(`I${i}`).value || wsSummary.getCell(`I${i}`).fill?.type) {
                wsSummary.getCell(`I${i}`).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            }
            if (wsSummary.getCell(`J${i}`).value || wsSummary.getCell(`J${i}`).fill?.type) {
                wsSummary.getCell(`J${i}`).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            }
        }

        // ==========================================
        // SHEET 2: Customer Details
        // ==========================================
        const wsDetails = workbook.addWorksheet('Customer Details');
        
        wsDetails.columns = [
            { header: 'Session ID', key: 'session_id', width: 12 },
            { header: 'วันที่-เวลา', key: 'datetime', width: 20 },
            { header: 'ผู้แจก', key: 'distributed_by', width: 25 },
            { header: 'โหมด', key: 'mode', width: 15 },
            { header: 'ผู้รับ', key: 'agent_name', width: 25 },
            { header: 'รหัสลูกค้า', key: 'customer_code', width: 15 },
            { header: 'เบอร์โทรศัพท์', key: 'phone', width: 15 },
            { header: 'ชื่อลูกค้า', key: 'customer_name', width: 30 }
        ];

        wsDetails.getRow(1).font = { bold: true };
        wsDetails.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' }
        };

        const datetime = new Date(session.created_at).toLocaleString('th-TH');

        session.details.forEach(agent => {
            agent.customers.forEach(customer => {
                wsDetails.addRow({
                    session_id: session.id,
                    datetime: datetime,
                    distributed_by: session.distributed_by_name,
                    mode: session.distribution_mode,
                    agent_name: agent.agent_name,
                    customer_code: customer.code,
                    phone: customer.phone,
                    customer_name: customer.name
                });
            });
        });

        // Generate file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Distribution_Report_${session.id}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    if (!isOpen) return null;

    return (
        <>
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[85vh] flex flex-col animate-in fade-in duration-200">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <div className="flex items-center gap-2">
                        <History className="text-blue-500" />
                        <h3 className="text-xl font-bold text-gray-800">ประวัติการแจกงาน (Distribution Report)</h3>
                    </div>
                    <div className="flex items-center gap-4">
                        {isSystemAdmin && (
                            <button 
                                onClick={() => setShowCleanup(true)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded border border-red-200 text-sm font-medium transition-colors"
                            >
                                🧹 เคลียร์ประวัติเก่า
                            </button>
                        )}
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
                    {loading ? (
                        <div className="flex flex-col justify-center items-center h-48">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                            <span className="text-sm text-gray-500">กำลังโหลดประวัติ...</span>
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            ไม่มีประวัติการแจกงาน
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {sessions.map(session => {
                                const isExpanded = expandedSessions.has(session.id);
                                return (
                                <div key={session.id} className="bg-white border rounded-lg shadow-sm overflow-hidden">
                                    <div className="p-5 flex flex-wrap items-center justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="font-bold text-gray-800 flex items-center gap-2 flex-wrap">
                                                <span>Session #{session.id}</span>
                                                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                                    {session.distribution_mode}
                                                </span>
                                                {session.source_basket && (
                                                    <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200">
                                                        ตะกร้า: {session.source_basket}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-sm text-gray-500 mt-1">
                                                แจกเมื่อ: {new Date(session.created_at).toLocaleString('th-TH')} • โดย: {session.distributed_by_name || 'ระบบ'}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <div className="text-sm text-gray-500">รวมทั้งหมด</div>
                                                <div className="font-bold text-lg text-green-600">{session.total_customers} <span className="text-sm font-normal text-gray-500">รายการ</span></div>
                                            </div>
                                            {session.session_status !== 'undo_full' && (
                                                <button 
                                                    onClick={() => setUndoTarget(session.id)}
                                                    className="flex items-center gap-2 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-sm transition-colors shadow-sm"
                                                    title="ดึงรายชื่อกลับคืน (Undo)"
                                                >
                                                    ↩️ Undo
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => handleExport(session)}
                                                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors shadow-sm"
                                            >
                                                <Download className="w-4 h-4" />
                                                Export Excel
                                            </button>
                                            <button 
                                                onClick={() => toggleExpand(session.id)}
                                                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                                            >
                                                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {isExpanded && (
                                        <div className="border-t bg-gray-50 p-4">
                                            <div className="overflow-x-auto flex justify-center">
                                                <table className="w-full max-w-3xl text-sm text-left text-gray-600 bg-white rounded-lg overflow-hidden border">
                                                    <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b">
                                                        <tr>
                                                            <th className="px-4 py-3">Agent Name</th>
                                                            <th className="px-4 py-3 text-right">จำนวนลูกค้าที่ได้รับ</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {session.details.map((agent, idx) => (
                                                            <tr key={agent.agent_id} className={`border-b last:border-b-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                                                <td className="px-4 py-2 font-medium text-gray-800">
                                                                    {agent.agent_name}
                                                                </td>
                                                                <td className="px-4 py-2 text-right">
                                                                    <span className="font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                                                        {agent.customers.length} คน
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Undo Confirmation Modal */}
        {undoTarget && (
            <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">ยืนยันการดึงข้อมูลกลับ (Undo)</h3>
                    <p className="text-gray-600 mb-4 text-sm">
                        ต้องการดึงลูกค้าจากการแจกงานรอบที่ #{undoTarget} กลับคืนหรือไม่?
                    </p>

                    <div className="space-y-3 mb-6">
                        <label className={`block border rounded-lg p-3 cursor-pointer transition-all ${undoMode === 'safe' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                            <div className="flex items-start gap-3">
                                <input 
                                    type="radio" 
                                    name="undoMode" 
                                    value="safe" 
                                    checked={undoMode === 'safe'}
                                    onChange={() => setUndoMode('safe')}
                                    className="mt-1 w-4 h-4 text-blue-600"
                                />
                                <div>
                                    <div className="font-semibold text-gray-800">Safe Mode (ปลอดภัย)</div>
                                    <div className="text-xs text-gray-500 mt-1">ดึงกลับเฉพาะลูกค้าที่พนักงานยังไม่โทรติดต่อ หากโทรแล้วระบบจะปล่อยผ่าน</div>
                                </div>
                            </div>
                        </label>

                        <label className={`block border rounded-lg p-3 cursor-pointer transition-all ${undoMode === 'force' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                            <div className="flex items-start gap-3">
                                <input 
                                    type="radio" 
                                    name="undoMode" 
                                    value="force" 
                                    checked={undoMode === 'force'}
                                    onChange={() => setUndoMode('force')}
                                    className="mt-1 w-4 h-4 text-red-600"
                                />
                                <div>
                                    <div className="font-semibold text-red-700">Force Mode (บังคับ 100%)</div>
                                    <div className="text-xs text-red-500/80 mt-1">ดึงกลับทั้งหมดทุกรายชื่อแม้พนักงานจะทำงานไปแล้ว ใช้ในกรณีฉุกเฉินเท่านั้น!</div>
                                </div>
                            </div>
                        </label>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={() => setUndoTarget(null)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            disabled={isUndoing}
                        >
                            ยกเลิก
                        </button>
                        <button 
                            onClick={handleUndo}
                            disabled={isUndoing}
                            className={`px-4 py-2 rounded-lg text-white font-medium flex items-center gap-2 transition-colors ${undoMode === 'force' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} ${isUndoing ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isUndoing ? <Loader2 className="w-4 h-4 animate-spin" /> : '↩️ '}
                            ยืนยันดึงกลับ
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Cleanup Confirmation Modal */}
        {showCleanup && (
            <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xl">
                            🧹
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">ล้างประวัติการแจกงานเก่า</h3>
                    </div>
                    
                    <p className="text-gray-600 mb-6 text-sm">
                        เพื่อลดภาระของฐานข้อมูล ระบบจะทำการลบ <b>"รายละเอียดรายชื่อลูกค้า"</b> ที่เกิดจากการแจกงานในอดีต (ตารางสรุปจะยังอยู่)
                    </p>

                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ลบข้อมูลที่เก่ากว่า:</label>
                            <select 
                                value={cleanupMonths}
                                onChange={(e) => setCleanupMonths(Number(e.target.value))}
                                className="w-full border-gray-300 rounded-lg shadow-sm focus:border-red-500 focus:ring-red-500 p-2 border"
                            >
                                <option value={1}>1 เดือน</option>
                                <option value={3}>3 เดือน (แนะนำ)</option>
                                <option value={6}>6 เดือน</option>
                                <option value={12}>1 ปี</option>
                            </select>
                        </div>

                        {isSuperAdmin && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">เลือกบริษัท (Super Admin):</label>
                                <select 
                                    value={cleanupTargetCompany}
                                    onChange={(e) => setCleanupTargetCompany(e.target.value)}
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:border-red-500 focus:ring-red-500 p-2 border"
                                >
                                    <option value="current">เฉพาะบริษัทปัจจุบัน</option>
                                    <option value="all">ลบทุกบริษัท (All Companies)</option>
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-6">
                        <p className="text-xs text-red-600 font-medium text-center">
                            ⚠️ การดำเนินการนี้ไม่สามารถย้อนกลับได้
                        </p>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={() => setShowCleanup(false)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            disabled={isCleaning}
                        >
                            ยกเลิก
                        </button>
                        <button 
                            onClick={handleCleanup}
                            disabled={isCleaning}
                            className={`px-4 py-2 rounded-lg text-white font-medium flex items-center gap-2 transition-colors bg-red-600 hover:bg-red-700 ${isCleaning ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isCleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            ยืนยันการลบข้อมูล
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default DistributionReportModal;
