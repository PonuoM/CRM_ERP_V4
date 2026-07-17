import React, { useState, useEffect } from 'react';
import AutocompleteInput from './AutocompleteInput';
import { Loader2, Download, History, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import ExcelJS from 'exceljs';
import { apiFetch } from '../../services/api';

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
    min_call_minutes?: number | null;
    total_customers: number;
    created_at: string;
    distributed_by_name: string;
    details: AgentDetail[];
    agent_snapshot?: AgentSnapshot[];
    session_status?: string;
    company_name?: string;
    session_tag?: string;
}

const DistributionReportModal: React.FC<DistributionReportModalProps> = ({ isOpen, onClose, setMessage }) => {
    const [loading, setLoading] = useState(false);
    const [sessions, setSessions] = useState<DistributionSession[]>([]);
    const [expandedSessions, setExpandedSessions] = useState<Set<number>>(new Set());
    
    // Check if user is system admin
    const currentUserStr = localStorage.getItem('user');
    const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
    const isSystemAdmin = currentUser?.is_system == 1;
    const isSuperAdmin = currentUser?.role?.toLowerCase() === 'super_admin';

    const [selectedCompany, setSelectedCompany] = useState<string>(isSuperAdmin ? 'all' : (currentUser?.company_id || '1'));
    const [companies, setCompanies] = useState<any[]>([]);
    
    const [batchStartDate, setBatchStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [batchEndDate, setBatchEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [batchType, setBatchType] = useState<string>('all');
    const [batchExportMode, setBatchExportMode] = useState<'customer' | 'user' | 'session' | 'agent_overall' | 'basket_overall' | 'daily_summary'>('customer');
    const [isBatchExporting, setIsBatchExporting] = useState(false);
    
    
    const [filterBasket, setFilterBasket] = useState<string>('all');
    const [filterTag, setFilterTag] = useState<string>('all');
    const [baskets, setBaskets] = useState<any[]>([]);
    const [tags, setTags] = useState<string[]>([]);
// Undo State
    const [undoTarget, setUndoTarget] = useState<number | null>(null);
    const [undoMode, setUndoMode] = useState<'safe' | 'force'>('safe');
    const [isUndoing, setIsUndoing] = useState(false);

    // Cleanup State
    const [showCleanup, setShowCleanup] = useState(false);
    const [cleanupMonths, setCleanupMonths] = useState(3);
    const [cleanupTargetCompany, setCleanupTargetCompany] = useState<string>('current');
    const [isCleaning, setIsCleaning] = useState(false);
    
    // Tag Edit State
    const [editingTagSessionId, setEditingTagSessionId] = useState<number | null>(null);
    const [editTagValue, setEditTagValue] = useState<string>('');

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
            
            const data = await apiFetch(`Distribution/index.php?action=undo_distribution&companyId=${currentUser?.company_id || 1}`, {
                method: 'POST',
                body: JSON.stringify({
                    session_id: undoTarget,
                    mode: undoMode,
                    triggered_by: currentUser?.id
                })
            });
            
            if (data.ok) {
                setMessage({ type: 'success', text: `ดึงกลับสำเร็จ ${data.success_count} รายการ (ข้าม ${data.skipped_count} รายการ) กำลังรีเฟรช...` });
                setUndoTarget(null);
                setTimeout(() => window.location.reload(), 1500); // Refresh the entire page
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

    const handleSaveSessionTag = async (sessionId: number, overrideTagValue?: string) => {
        try {
            const valueToSave = overrideTagValue !== undefined ? overrideTagValue : editTagValue;
            const currentUserStr = localStorage.getItem('user');
            const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
            
            const data = await apiFetch(`Distribution/index.php?action=update_session_tag&companyId=${currentUser?.company_id || 1}`, {
                method: 'POST',
                body: JSON.stringify({
                    session_id: sessionId,
                    session_tag: valueToSave
                })
            });
            
            if (data.ok) {
                setMessage({ type: 'success', text: 'อัปเดต Session Tag เรียบร้อย' });
                // Update local state
                setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, session_tag: valueToSave } : s));
                setEditingTagSessionId(null);
                // Refresh tag options for datalist
                fetchOptions();
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to update session tag' });
            }
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: 'Network error during update' });
        }
    };

    const handleBatchExport = async () => {
        setIsBatchExporting(true);
        try {
            const data = await apiFetch(`Distribution/index.php?action=batch_export&companyId=${selectedCompany}&startDate=${batchStartDate}&endDate=${batchEndDate}&type=${batchType}&basket_key=${filterBasket}&session_tag=${filterTag}`);
            if (data.ok && data.data && data.data.length > 0) {
                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet('Batch Export');

                if (batchExportMode === 'session') {
                    let headers = ['รอบแจก (Session ID)', 'เวลา', 'รูปแบบ (Mode)', 'ผู้ดำเนินการ', 'ตะกร้าต้นทาง (Source Basket)', 'Session Tag', 'จำนวนลูกค้าทั้งหมด (Count)', 'จำนวนพนักงานที่รับงาน (Agents)'];
                    if (isSuperAdmin) headers.unshift('บริษัท (Company)');
                    worksheet.addRow(headers);
                    const map = new Map();
                    data.data.forEach((row: any) => {
                        const key = `${row.session_id}_${row.previous_basket_key}`;
                        if (!map.has(key)) map.set(key, { ...row, count: 0, agentIds: new Set() });
                        map.get(key).count += 1;
                        if (row.agent_id) map.get(key).agentIds.add(row.agent_id);
                    });
                    Array.from(map.values()).forEach((row: any) => {
                        let isReclaimOrTransfer = row.distribution_mode?.includes('Reclaim') || row.distribution_mode?.includes('Transfer');
                        let modeText = isReclaimOrTransfer ? `ดึงคืน (${row.distribution_mode})` : `แจก (${row.distribution_mode})`;
                        if (row.distribution_mode === 'Performance') modeText += ` (>= ${row.min_call_minutes} นาที)`;
                        let basketText = row.previous_basket_name ? `${row.previous_basket_name} (${row.previous_basket_key})` : (row.previous_basket_key || '-');
                        let rowData = [ `Session #${row.session_id}`, row.created_at, modeText, `${row.distributed_by_first || ''} ${row.distributed_by_last || 'System'}`, basketText, row.session_tag || '-', row.count, row.agentIds ? row.agentIds.size : 0 ];
                        if (isSuperAdmin) rowData.unshift(row.company_name || '-');
                        worksheet.addRow(rowData).font = { size: 10 };
                    });
                } else if (batchExportMode === 'user') {
                    let headers = ['รอบแจก (Session ID)', 'เวลา', 'รูปแบบ (Mode)', 'ผู้ดำเนินการ', 'Agent ID', 'Agent Name', 'ตะกร้าต้นทาง (Source Basket)', 'จำนวนลูกค้าที่ได้รับ (Count)'];
                    if (isSuperAdmin) headers.unshift('บริษัท (Company)');
                    worksheet.addRow(headers);
                    const map = new Map();
                    data.data.forEach((row: any) => {
                        const key = `${row.session_id}_${row.agent_id}_${row.previous_basket_key}`;
                        if (!map.has(key)) map.set(key, { ...row, count: 0 });
                        map.get(key).count += 1;
                    });
                    Array.from(map.values()).forEach((row: any) => {
                        let isReclaimOrTransfer = row.distribution_mode?.includes('Reclaim') || row.distribution_mode?.includes('Transfer');
                        let modeText = isReclaimOrTransfer ? `ดึงคืน (${row.distribution_mode})` : `แจก (${row.distribution_mode})`;
                        if (row.distribution_mode === 'Performance') modeText += ` (>= ${row.min_call_minutes} นาที)`;
                        let basketText = row.previous_basket_name ? `${row.previous_basket_name} (${row.previous_basket_key})` : (row.previous_basket_key || '-');
                        let rowData = [ `Session #${row.session_id}`, row.created_at, modeText, `${row.distributed_by_first || ''} ${row.distributed_by_last || 'System'}`, row.agent_id || '-', `${row.agent_first || ''} ${row.agent_last || ''}`, basketText, row.count ];
                        if (isSuperAdmin) rowData.unshift(row.company_name || '-');
                        worksheet.addRow(rowData).font = { size: 10 };
                    });
                } else if (batchExportMode === 'agent_overall') {
                    let headers = ['Agent ID', 'Agent Name', 'จำนวนลูกค้าที่ได้รับทั้งหมดตลอดช่วงเวลา (Total Count)'];
                    if (isSuperAdmin) headers.unshift('บริษัท (Company)');
                    worksheet.addRow(headers);
                    const map = new Map();
                    data.data.forEach((row: any) => {
                        if (!row.agent_id) return;
                        const key = `${row.agent_id}`;
                        if (!map.has(key)) map.set(key, { agent_id: row.agent_id, agent_first: row.agent_first, agent_last: row.agent_last, company_name: row.company_name, count: 0 });
                        map.get(key).count += 1;
                    });
                    Array.from(map.values()).forEach((row: any) => {
                        let rowData = [ row.agent_id, `${row.agent_first || ''} ${row.agent_last || ''}`, row.count ];
                        if (isSuperAdmin) rowData.unshift(row.company_name || '-');
                        worksheet.addRow(rowData).font = { size: 10 };
                    });
                } else if (batchExportMode === 'basket_overall') {
                    let headers = ['รหัสตะกร้าต้นทาง (Basket Key)', 'ชื่อตะกร้าต้นทาง (Basket Name)', 'จำนวนลูกค้าที่ถูกแจกออกไปทั้งหมด (Total Count)'];
                    if (isSuperAdmin) headers.unshift('บริษัท (Company)');
                    worksheet.addRow(headers);
                    const map = new Map();
                    data.data.forEach((row: any) => {
                        const key = `${row.previous_basket_key}`;
                        if (!map.has(key)) map.set(key, { key: row.previous_basket_key, name: row.previous_basket_name, company_name: row.company_name, count: 0 });
                        map.get(key).count += 1;
                    });
                    Array.from(map.values()).forEach((row: any) => {
                        let rowData = [ row.key || '-', row.name || '-', row.count ];
                        if (isSuperAdmin) rowData.unshift(row.company_name || '-');
                        worksheet.addRow(rowData).font = { size: 10 };
                    });
                } else if (batchExportMode === 'daily_summary') {
                    let headers = ['วันที่ (Date)', 'จำนวนรอบการแจก (Total Sessions)', 'จำนวนพนักงานที่รับงานรวม (Agents Involved)', 'จำนวนลูกค้าที่ถูกแจกทั้งหมด (Total Customers)'];
                    if (isSuperAdmin) headers.unshift('บริษัท (Company)');
                    worksheet.addRow(headers);
                    const map = new Map();
                    data.data.forEach((row: any) => {
                        const date = row.created_at ? row.created_at.split(' ')[0] : 'Unknown Date';
                        if (!map.has(date)) map.set(date, { date: date, company_name: row.company_name, sessionIds: new Set(), agentIds: new Set(), count: 0 });
                        map.get(date).sessionIds.add(row.session_id);
                        if (row.agent_id) map.get(date).agentIds.add(row.agent_id);
                        map.get(date).count += 1;
                    });
                    Array.from(map.values()).forEach((row: any) => {
                        let rowData = [ row.date, row.sessionIds.size, row.agentIds.size, row.count ];
                        if (isSuperAdmin) rowData.unshift(row.company_name || '-');
                        worksheet.addRow(rowData).font = { size: 10 };
                    });
                } else {
                    // Customer Level
                    let headers = ['รอบแจก (Session ID)', 'เวลา', 'รูปแบบ (Mode)', 'ผู้ดำเนินการ', 'Agent ID', 'Agent Name', 'รหัสลูกค้า', 'ชื่อ-นามสกุลลูกค้า', 'เบอร์โทรศัพท์', 'ตะกร้าต้นทาง (Source Basket)', 'Session Tag'];
                    if (isSuperAdmin) headers.unshift('บริษัท (Company)');
                    worksheet.addRow(headers);
                    data.data.forEach((row: any) => {
                        let isReclaimOrTransfer = row.distribution_mode?.includes('Reclaim') || row.distribution_mode?.includes('Transfer');
                        let modeText = isReclaimOrTransfer ? `ดึงคืน (${row.distribution_mode})` : `แจก (${row.distribution_mode})`;
                        if (row.distribution_mode === 'Performance') modeText += ` (>= ${row.min_call_minutes} นาที)`;
                        let basketText = row.previous_basket_name ? `${row.previous_basket_name} (${row.previous_basket_key})` : (row.previous_basket_key || '-');
                        let rowData = [ `Session #${row.session_id}`, row.created_at, modeText, `${row.distributed_by_first || ''} ${row.distributed_by_last || 'System'}`, row.agent_id || '-', `${row.agent_first || ''} ${row.agent_last || ''}`, row.customer_code || '-', row.customer_name || '-', row.customer_phone || '-', basketText, row.session_tag || '-' ];
                        if (isSuperAdmin) rowData.unshift(row.company_name || '-');
                        worksheet.addRow(rowData).font = { size: 10 };
                    });
                }

                const buffer = await workbook.xlsx.writeBuffer();
                const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = window.URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = `Distribution_BatchExport_${batchExportMode}_${batchStartDate}_to_${batchEndDate}.xlsx`;
                anchor.click();
                window.URL.revokeObjectURL(url);
                
                setMessage({ type: 'success', text: `ดาวน์โหลดข้อมูลสำเร็จ (${data.data.length} รายการ)` });
            } else {
                setMessage({ type: 'error', text: data.error || 'ไม่พบข้อมูลในช่วงเวลาที่เลือก' });
            }
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: 'Network error during batch export' });
        } finally {
            setIsBatchExporting(false);
        }
    };

    const handleCleanup = async () => {
        setIsCleaning(true);
        try {
            const data = await apiFetch('Distribution/index.php?action=cleanup_distribution_details', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: currentUser?.id,
                    target_company_id: cleanupTargetCompany === 'current' ? currentUser?.company_id : cleanupTargetCompany,
                    months_old: cleanupMonths
                })
            });
            
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
            if (isSuperAdmin && companies.length === 0) {
                fetchCompanies();
            }
        fetchOptions();
        }
    }, [isOpen, selectedCompany, batchStartDate, batchEndDate, batchType, filterBasket, filterTag]);

    const fetchOptions = async () => {
        try {
            const tagData = await apiFetch(`Distribution/index.php?action=get_session_tags&companyId=${selectedCompany}`);
            if (tagData.ok) setTags(tagData.tags || []);
            
            const basketData = await apiFetch(`Distribution/index.php?action=get_basket_options&companyId=${selectedCompany}`);
            if (basketData.ok) setBaskets(basketData.baskets || []);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchCompanies = async () => {
        try {
            const data = await apiFetch('index.php?action=companies');
            if (data && Array.isArray(data)) {
                setCompanies(data);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const data = await apiFetch(`Distribution/index.php?action=get_sessions&companyId=${selectedCompany}&startDate=${batchStartDate}&endDate=${batchEndDate}&type=${batchType}&basket_key=${filterBasket}&session_tag=${filterTag}`);
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
        const isCriteriaApplied = session.min_call_minutes !== null && session.min_call_minutes !== undefined;
        const failStatusText = isCriteriaApplied ? 'หลุดเกณฑ์' : 'ไม่ได้รับรายชื่อ';

        const detailsMap = new Map<number, number>();
        session.details.forEach(d => detailsMap.set(d.agent_id, d.customers.length));

        const receivedAgents: any[] = [];
        const failedAgents: any[] = [];

        snapshot.forEach(agent => {
            const count = detailsMap.get(agent.id) || 0;
            if (count > 0) {
                receivedAgents.push({ ...agent, count });
            } else if (agent.isActive !== false) {
                // Ignore agents who are explicitly inactive AND got 0 customers to keep the report clean
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
            wsSummary.getCell(`F${currentRow}`).value = failStatusText;
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

        if (isCriteriaApplied) {
            wsSummary.getCell(`I${totalRow + 2}`).value = 'เกณฑ์เวลาโทรขั้นต่ำ';
            wsSummary.getCell(`I${totalRow + 2}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
            wsSummary.getCell(`I${totalRow + 2}`).font = { color: { argb: 'FFFFFFFF' }, bold: true };
            
            wsSummary.getCell(`J${totalRow + 2}`).value = `${session.min_call_minutes} นาที`;
            wsSummary.getCell(`J${totalRow + 2}`).alignment = { horizontal: 'center' };
            wsSummary.getCell(`J${totalRow + 2}`).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        }

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

    const resetFilters = () => {
        setBatchStartDate('');
        setBatchEndDate('');
        setBatchType('all');
        setFilterBasket('all');
        setFilterTag('all');
        if (isSuperAdmin) {
            setSelectedCompany('all');
        }
    };

    if (!isOpen) return null;

    return (
        <>
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[85vh] flex flex-col animate-in fade-in duration-200">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <div className="flex items-center gap-2">
                        <History className="text-blue-500" />
                        <h3 className="text-xl font-bold text-gray-800">ประวัติการแจกงานและดึงคืน (Distribution & Reclaim Report)</h3>
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

                {/* Filter Grid UI */}
                <div className="px-6 py-4 border-b bg-white">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-base font-semibold text-blue-800">ตัวกรอง / ดาวน์โหลด (Filter / Batch)</span>
                        {isSuperAdmin && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-700">เลือกบริษัท:</span>
                                <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="p-1.5 border rounded text-sm w-48 bg-gray-50">
                                    <option value="all">ทุกบริษัท (All)</option>
                                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-gray-500 font-medium">วันที่เริ่มต้น</span>
                            <input type="date" className="p-1.5 border rounded text-sm bg-gray-50" value={batchStartDate} onChange={(e) => setBatchStartDate(e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-gray-500 font-medium">วันที่สิ้นสุด</span>
                            <input type="date" className="p-1.5 border rounded text-sm bg-gray-50" value={batchEndDate} onChange={(e) => setBatchEndDate(e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-gray-500 font-medium">ประเภท</span>
                            <select className="p-1.5 border rounded text-sm bg-gray-50" value={batchType} onChange={(e) => setBatchType(e.target.value)}>
                                <option value="all">ทุกประเภท</option>
                                <option value="distribution">แจกจ่ายลูกค้า</option>
                                <option value="reclaim">ดึงคืน / โอนย้าย</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-gray-500 font-medium">ตะกร้าต้นทาง</span>
                            <select className="p-1.5 border rounded text-sm bg-gray-50" value={filterBasket} onChange={(e) => setFilterBasket(e.target.value)}>
                                <option value="all">ทุกตะกร้า</option>
                                {baskets.map(b => <option key={b.id} value={b.basket_key}>{b.basket_name} ({b.basket_key})</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-gray-500 font-medium">Session Tag</span>
                            <select className="p-1.5 border rounded text-sm bg-gray-50" value={filterTag} onChange={(e) => setFilterTag(e.target.value)}>
                                <option value="all">ทุกแท็ก</option>
                                {tags.map((t, idx) => <option key={idx} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-4 justify-end">
                        <button onClick={resetFilters} className="px-4 py-1.5 rounded text-sm text-gray-700 bg-gray-200 hover:bg-gray-300 flex items-center transition-colors">
                            รีเซ็ตตัวกรอง
                        </button>
                        <select className="p-1.5 border rounded text-sm w-64 bg-blue-50 text-blue-800" value={batchExportMode} onChange={(e) => setBatchExportMode(e.target.value as any)}>
                            <option value="customer">1. Customer level (รายชื่อลูกค้า)</option>
                            <option value="user">2. User level (พนักงานรายรอบ)</option>
                            <option value="session">3. Session level (ภาพรวมรอบแจก)</option>
                            <option value="agent_overall">4. Agent Overall (สรุปยอดพนักงาน)</option>
                            <option value="basket_overall">5. Source Basket (สรุปตามตะกร้า)</option>
                            <option value="daily_summary">6. Daily Summary (สรุปยอดรายวัน)</option>
                        </select>
                        <button onClick={handleBatchExport} disabled={isBatchExporting} className={`px-4 py-1.5 rounded text-sm text-white flex items-center ${isBatchExporting ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}>
                            {isBatchExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />} ส่งออกไฟล์
                        </button>
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
                                <div key={session.id} className="bg-white border rounded-lg shadow-sm mb-4">
                                    <div className="p-5 flex flex-wrap items-center justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="font-bold text-gray-800 flex items-center gap-2 flex-wrap">
                                                <span>Session #{session.id}</span>
                                                {isSuperAdmin && session.company_name && selectedCompany === 'all' && (
                                                    <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                                                        🏢 {session.company_name}
                                                    </span>
                                                )}
                                                {(() => {
                                                      const isReclaim = session.distribution_mode?.includes('Reclaim') || session.distribution_mode?.includes('Transfer');
                                                      const tagText = isReclaim ? `ดึงคืน (${session.distribution_mode})` : `แจก (${session.distribution_mode})`;
                                                      const tagColor = isReclaim ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200';
                                                      return (
                                                          <span className={`text-xs px-2 py-0.5 rounded-full border ${tagColor}`}>
                                                              {tagText}
                                                          </span>
                                                      );
                                                  })()}
                                                {session.source_basket && (
                                                    <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200">
                                                        ตะกร้า: {session.source_basket}
                                                    </span>
                                                )}
                                                {session.min_call_minutes !== null && session.min_call_minutes !== undefined && (
                                                    <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full border border-orange-200">
                                                        เกณฑ์: ≥{session.min_call_minutes} นาที
                                                    </span>
                                                )}
                                                
                                                {/* Session Tag Inline Edit */}
                                                {editingTagSessionId === session.id ? (
                                                    <div className="flex items-center gap-2 ml-2">
                                                        <AutocompleteInput
                                                              value={editTagValue}
                                                              onChange={setEditTagValue}
                                                              options={tags}
                                                              className="min-w-[200px]"
                                                              autoFocus
                                                          />
                                                        <button 
                                                            onClick={() => handleSaveSessionTag(session.id)}
                                                            className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded hover:bg-blue-700"
                                                        >
                                                            บันทึก
                                                        </button>
                                                        <button 
                                                            onClick={() => setEditingTagSessionId(null)}
                                                            className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded hover:bg-gray-300"
                                                        >
                                                            ยกเลิก
                                                        </button>
                                                        {session.session_tag && (
                                                            <button 
                                                                onClick={() => { setEditTagValue(''); handleSaveSessionTag(session.id, ''); }}
                                                                className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded hover:bg-red-200"
                                                            >
                                                                ลบแท็ก
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 ml-2 group cursor-pointer" onClick={() => {
                                                        setEditingTagSessionId(session.id);
                                                        setEditTagValue(session.session_tag || '');
                                                    }}>
                                                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full border border-gray-200 flex items-center gap-1">
                                                            {session.session_tag ? `Tag: ${session.session_tag}` : 'ไม่มี Tag'}
                                                        </span>
                                                        <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            (คลิกเพื่อแก้ไข)
                                                        </span>
                                                    </div>
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
                                        <div className="border-t bg-gray-50 p-4 rounded-b-lg">
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
