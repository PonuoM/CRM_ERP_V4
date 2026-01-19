import React, { useState, useEffect, useRef } from 'react';
import { User, Order, OrderStatus } from '../types';
import { listOrders, saveReturnOrders, getReturnOrders } from '../services/api';
import * as XLSX from 'xlsx';
import { Search, Upload, RefreshCw, FileText, CheckCircle, AlertCircle, XCircle, ArrowLeftRight, Download, Clipboard, X } from 'lucide-react';
import OrderDetailModal from '../components/OrderDetailModal';

interface ReturnManagementPageProps {
    user: User;
}

interface ImportRow {
    orderNumber: string;
    amount: number;
    note?: string;
}

// Helper: Handle mixed API response cases (camelCase vs snake_case)
const getOrderAmount = (order: any): number => {
    return Number(order.totalAmount ?? order.total_amount ?? 0);
};

interface MatchResult {
    importRow: ImportRow;
    matchedOrder?: Order;
    status: 'matched' | 'unmatched_system' | 'unmatched_file' | 'amount_mismatch';
    diff: number;
}

interface VerifiedOrder {
    id: number;
    order_id: string;
    return_amount: number;
    note: string;
    created_at: string;
    // Joined fields
    order_date?: string;
    total_amount?: string; // API returns string usually
    customer_id?: string;
}

const ReturnManagementPage: React.FC<ReturnManagementPageProps> = ({ user }) => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'list' | 'verify'>('list');
    const [importedData, setImportedData] = useState<ImportRow[]>([]);
    const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
    // Tabs state
    const [activeTab, setActiveTab] = useState<'pending' | 'verified'>('pending');
    const [verifiedOrders, setVerifiedOrders] = useState<VerifiedOrder[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Order Detail Modal State
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

    // Paste Modal State
    const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
    const [pasteContent, setPasteContent] = useState('');
    const [previewRows, setPreviewRows] = useState<string[][]>([]);
    const pasteInputRef = useRef<HTMLTextAreaElement>(null);

    // Update preview when content changes
    useEffect(() => {
        if (!pasteContent) {
            setPreviewRows([]);
            return;
        }
        const rows = pasteContent.trim().split(/\r?\n/).map(row => row.split('\t'));
        setPreviewRows(rows);
    }, [pasteContent]);

    // Auto-focus on open
    useEffect(() => {
        if (isPasteModalOpen) {
            // Slight delay to allow render
            setTimeout(() => pasteInputRef.current?.focus(), 100);
        }
    }, [isPasteModalOpen]);

    useEffect(() => {
        fetchOrders(); // Always fetch pending orders to match
        if (activeTab === 'verified') {
            fetchVerifiedOrders();
        }
    }, [user.companyId, activeTab]);

    const fetchVerifiedOrders = async () => {
        try {
            const res = await getReturnOrders();
            if (res && res.status === 'success') {
                setVerifiedOrders(res.data);
            }
        } catch (err) {
            console.error("Failed to fetch verified orders", err);
        }
    };

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await listOrders({
                companyId: user.companyId,
                orderStatus: OrderStatus.Returned,
                pageSize: 1000 // Construct a reasonable limit or pagination
            });
            if (res.ok) {
                // Defensive: Ensure orders is an array
                setOrders(Array.isArray(res.orders) ? res.orders : []);
            }
        } catch (err) {
            console.error("Failed to fetch returned orders", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadTemplate = () => {
        const wb = XLSX.utils.book_new();
        const headers = [['Order Number', 'Amount', 'Note (Optional)']];
        const ws = XLSX.utils.aoa_to_sheet(headers);

        // Add some example data? No, keep it clean.
        // Set col width
        ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 30 }];

        XLSX.utils.book_append_sheet(wb, ws, "ReturnTemplate");
        XLSX.writeFile(wb, "Return_Verification_Template.xlsx");
    };

    const handlePasteVerification = () => {
        if (!pasteContent.trim()) return;

        // Parse tab-separated values (Excel copy)
        const rows = pasteContent.trim().split(/\r?\n/);
        const parsed: ImportRow[] = [];

        rows.forEach(rowStr => {
            const cols = rowStr.split('\t');
            if (cols.length < 2) return; // Skip invalid lines

            const rawOrder = cols[0].trim();
            const rawAmount = cols[1].replace(/,/g, '').trim();
            const rawNote = cols[2] ? cols[2].trim() : '';

            if (rawOrder) {
                const amount = parseFloat(rawAmount);
                if (!isNaN(amount)) {
                    parsed.push({
                        orderNumber: rawOrder,
                        amount: amount,
                        note: rawNote
                    });
                }
            }
        });

        if (parsed.length > 0) {
            setImportedData(parsed);
            performMatching(parsed, orders);
            setMode('verify');
            setIsPasteModalOpen(false);
            setPasteContent('');
        } else {
            alert('ไม่พบข้อมูลที่ถูกต้อง กรุณาตรวจสอบรูปแบบข้อมูล (Order ID [Tab] Amount)');
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

            if (data.length < 2) return;

            const headerRow = data[0] as string[];
            let orderIdx = -1;
            let amountIdx = -1;
            let noteIdx = -1;

            headerRow.forEach((h, i) => {
                const lower = String(h).toLowerCase();
                if (lower.includes('order') || lower.includes('id') || lower.includes('หมายเลข') || lower.includes('tracking')) orderIdx = i;
                if (lower.includes('amount') || lower.includes('price') || lower.includes('ยอด')) amountIdx = i;
                if (lower.includes('note') || lower.includes('remark') || lower.includes('หมายเหตุ')) noteIdx = i;
            });

            if (orderIdx === -1 || amountIdx === -1) {
                // Fallback: Use col 0 and 1
                orderIdx = 0;
                amountIdx = 1;
                // If col 2 exists, use it as note
                if (data[0].length > 2) noteIdx = 2;
            }

            const parsed: ImportRow[] = [];
            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                if (!row || row.length === 0) continue;
                const rawOrder = row[orderIdx];
                const rawAmount = row[amountIdx];
                const rawNote = noteIdx !== -1 ? row[noteIdx] : '';

                if (rawOrder) {
                    parsed.push({
                        orderNumber: String(rawOrder).trim(),
                        amount: Number(rawAmount || 0),
                        note: rawNote ? String(rawNote).trim() : ''
                    });
                }
            }

            setImportedData(parsed);
            performMatching(parsed, orders);
            setMode('verify');
        };
        reader.readAsBinaryString(file);
        // Reset input
        e.target.value = '';
    };

    const performMatching = (imported: ImportRow[], systemOrders: Order[]) => {
        const results: MatchResult[] = [];
        const matchedOrderIds = new Set<string>();

        imported.forEach(row => {
            // Find by Tracking Number OR Order ID
            const matched = systemOrders.find(o =>
                (Array.isArray(o.trackingNumbers) && o.trackingNumbers.some(t => t.includes(row.orderNumber))) ||
                o.id === row.orderNumber ||
                // Also check trackingDetails
                (Array.isArray(o.trackingDetails) && o.trackingDetails.some(t => t.trackingNumber?.includes(row.orderNumber)))
            );

            if (matched) {
                matchedOrderIds.add(matched.id);
                // Defensive: Handle missing totalAmount and snake_case
                const sysAmount = getOrderAmount(matched);
                const diff = Math.abs(sysAmount - row.amount);
                results.push({
                    importRow: row,
                    matchedOrder: matched,
                    status: diff < 1 ? 'matched' : 'amount_mismatch',
                    diff: sysAmount - row.amount // Positive = System > Import
                });
            } else {
                results.push({
                    importRow: row,
                    status: 'unmatched_file',
                    diff: 0
                });
            }
        });

        // Optionally: Find system orders NOT in file?
        // "unmatched_system" logic if needed. User focused on verifying the file content.
        // I will include them? Maybe confusing if file is partial.
        // I'll stick to File-centric view for now as requested ("ตรวจสอบว่าคำสั่งซื้อนี้ถูกตีกลับจริง").

        setMatchResults(results);
    };

    const SystemList = () => (
        <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tracking</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {orders.filter(o => !verifiedOrders.some(v => v.order_id === o.id)).map(order => (
                        <tr key={order.id} className="hover:bg-gray-50">
                            <td
                                className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 cursor-pointer hover:underline"
                                onClick={() => setSelectedOrderId(order.id)}
                            >
                                {order.id}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {order.customerInfo?.firstName} {order.customerInfo?.lastName}
                                <div className="text-xs text-gray-500">{order.customerInfo?.phone}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {(Array.isArray(order.trackingNumbers) ? order.trackingNumbers : []).map(t => (
                                    <div key={t}>{t}</div>
                                ))}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                                {getOrderAmount(order).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(order.orderDate).toLocaleDateString('th-TH')}
                            </td>
                        </tr>
                    ))}
                    {orders.filter(o => !verifiedOrders.some(v => v.order_id === o.id)).length === 0 && (
                        <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500">ไม่พบรายการสินค้าตีกลับ (หรือตรวจสอบครบแล้ว)</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );

    const handleSaveResults = async (results: MatchResult[]) => {
        if (!confirm(`ต้องการบันทึกข้อมูลจำนวน ${results.length} รายการ?`)) return;

        const payload = results.map(r => ({
            order_id: r.importRow.orderNumber,
            return_amount: r.importRow.amount,
            note: r.importRow.note || ''
        }));

        try {
            setLoading(true);
            const res = await saveReturnOrders(payload);
            if (res && res.status === 'success') {
                alert(`บันทึกข้อมูลเรียบร้อยแล้ว (${res.message})`);
                setMode('list');
                fetchVerifiedOrders(); // Refresh verified list
                fetchOrders(); // Refresh pending list (though we filter logic client side)
            } else {
                alert('เกิดข้อผิดพลาด: ' + (res?.message || 'Unknown error'));
            }
        } catch (err) {
            console.error(err);
            alert('เกิดข้อผิดพลาดในการบันทึก');
        } finally {
            setLoading(false);
        }
    };

    const VerificationList = () => (
        <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                <h3 className="font-medium text-gray-700">ผลการตรวจสอบ ({matchResults.length} รายการ)</h3>
                <div className="flex gap-2 text-sm">
                    <span className="flex items-center gap-1 text-green-600"><CheckCircle size={14} /> ตรงกัน ({matchResults.filter(r => r.status === 'matched').length})</span>
                    <span className="flex items-center gap-1 text-yellow-600"><AlertCircle size={14} /> ยอดไม่ตรง ({matchResults.filter(r => r.status === 'amount_mismatch').length})</span>
                    <span className="flex items-center gap-1 text-red-600"><XCircle size={14} /> ไม่พบในระบบ ({matchResults.filter(r => r.status === 'unmatched_file').length})</span>
                </div>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File Order/Tracking</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">System Order</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Note</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Diff</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {matchResults.map((res, idx) => (
                        <tr key={idx} className={`hover:bg-gray-50 ${res.status === 'unmatched_file' ? 'bg-red-50' : res.status === 'amount_mismatch' ? 'bg-yellow-50' : ''}`}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{res.importRow.orderNumber}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                                {res.matchedOrder ? (
                                    <div
                                        className="flex flex-col cursor-pointer hover:underline"
                                        onClick={() => setSelectedOrderId(res.matchedOrder!.id)}
                                    >
                                        <span>{res.matchedOrder.id}</span>
                                        <span className="text-xs text-gray-500">{res.matchedOrder.customerInfo?.firstName}</span>
                                    </div>
                                ) : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                <div>{res.importRow.amount.toLocaleString()} <span className="text-xs text-gray-500">(File)</span></div>
                                <div className="text-gray-400 text-xs">{res.matchedOrder ? getOrderAmount(res.matchedOrder).toLocaleString() : '-'} (Sys)</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{res.importRow.note || '-'}</td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${res.diff !== 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                {res.diff !== 0 ? (res.diff > 0 ? `+${res.diff.toLocaleString()}` : res.diff.toLocaleString()) : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                {res.status === 'matched' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Verified</span>}
                                {res.status === 'amount_mismatch' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">Amount Diff</span>}
                                {res.status === 'unmatched_file' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Not Found</span>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="p-4 bg-gray-50 border-t flex justify-end">
                <button
                    onClick={() => handleSaveResults(matchResults)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium flex items-center gap-2"
                >
                    <CheckCircle size={16} /> บันทึกผลการตรวจสอบ
                </button>
            </div>
        </div>
    );

    const VerifiedListTable = () => (
        <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Verified Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Note</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Verified At</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {verifiedOrders.map(v => (
                        <tr key={v.id} className="hover:bg-gray-50">
                            <td
                                className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 cursor-pointer hover:underline"
                                onClick={() => setSelectedOrderId(v.order_id)}
                            >
                                {v.order_id}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {Number(v.return_amount).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {v.note || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                                {new Date(v.created_at).toLocaleString('th-TH')}
                            </td>
                        </tr>
                    ))}
                    {verifiedOrders.length === 0 && (
                        <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">ไม่พบรายการที่ตรวจสอบแล้ว</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <ArrowLeftRight className="text-blue-600" />
                    จัดการสินค้าตีกลับ (Return Management)
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={handleDownloadTemplate}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                        <Download size={16} /> Template
                    </button>
                    <button
                        onClick={() => { setMode('list'); fetchOrders(); }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border flex items-center gap-2 ${mode === 'list' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-300 text-gray-700'}`}
                    >
                        <FileText size={16} /> รายการตีกลับ
                    </button>
                    <div className="h-8 w-px bg-gray-300 mx-2 self-center"></div>

                    {/* Tabs */}
                    {mode === 'list' && (
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button
                                onClick={() => setActiveTab('pending')}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium ${activeTab === 'pending' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                ยังไม่ตรวจสอบ (Pending)
                            </button>
                            <button
                                onClick={() => setActiveTab('verified')}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium ${activeTab === 'verified' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                ตรวจสอบแล้ว (Verified)
                            </button>
                        </div>
                    )}

                    <div className="h-8 w-px bg-gray-300 mx-2 self-center"></div>

                    <button
                        onClick={() => setIsPasteModalOpen(true)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2"
                    >
                        <Clipboard size={16} /> วางข้อมูล (Excel)
                    </button>
                    <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileUpload}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2"
                    >
                        <Upload size={16} /> Import ไฟล์
                    </button>
                </div>
            </div>

            {mode === 'verify' && importedData.length > 0 ? (
                <VerificationList />
            ) : activeTab === 'verified' ? (
                <VerifiedListTable />
            ) : (
                <SystemList />
            )}

            {/* Paste Modal */}
            {isPasteModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                <Clipboard size={20} className="text-indigo-600" />
                                วางข้อมูลจาก Excel
                            </h3>
                            <button onClick={() => setIsPasteModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 flex-1 flex flex-col overflow-hidden relative">
                            {/* Instructions */}
                            <p className="text-sm text-gray-600 mb-2">
                                คัดลอกข้อมูลจาก Excel (คอลัมน์ A: Order/Tracking ID, คอลัมน์ B: ยอดเงิน) แล้วกด <b>Ctrl+V</b>
                            </p>

                            {/* Hidden Textarea for Paste Capture */}
                            <textarea
                                ref={pasteInputRef}
                                className="opacity-0 absolute top-0 left-0 w-full h-full -z-10"
                                value={pasteContent}
                                onChange={(e) => setPasteContent(e.target.value)}
                                autoFocus
                            ></textarea>

                            {/* Excel-like Grid View */}
                            <div
                                className="flex-1 border border-gray-300 rounded-lg overflow-auto bg-gray-50 relative cursor-text"
                                onClick={() => pasteInputRef.current?.focus()}
                            >
                                {previewRows.length > 0 ? (
                                    <table className="border-collapse w-full min-w-[500px]">
                                        <thead>
                                            <tr>
                                                <th className="w-10 bg-gray-100 border-r border-b border-gray-300"></th>
                                                <th className="bg-gray-100 border-r border-b border-gray-300 px-2 py-1 text-xs font-semibold text-gray-500 w-1/3">A (Tracking / Order ID)</th>
                                                <th className="bg-gray-100 border-r border-b border-gray-300 px-2 py-1 text-xs font-semibold text-gray-500 w-1/3">B (Amount)</th>
                                                <th className="bg-gray-100 border-b border-gray-300 px-2 py-1 text-xs font-semibold text-gray-500 w-1/3">C (Note)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewRows.map((row, rIdx) => (
                                                <tr key={rIdx} className="bg-white">
                                                    <td className="bg-gray-50 border-r border-b border-gray-300 text-center text-xs text-gray-500 font-mono w-10 sticky left-0">{rIdx + 1}</td>
                                                    {row.map((cell, cIdx) => (
                                                        <td key={cIdx} className="border-r border-b border-gray-200 px-2 py-1 text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                                                            {cell}
                                                        </td>
                                                    ))}
                                                    {row.length < 2 && Array.from({ length: 2 - row.length }).map((_, i) => (
                                                        <td key={`empty-${i}`} className="border-r border-b border-gray-200 px-2 py-1 text-sm bg-gray-50/20"></td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                        <div className="grid grid-cols-4 gap-0.5 opacity-50 mb-4 p-4 border border-dashed border-gray-300 rounded bg-white">
                                            <div className="w-8 h-4 bg-gray-200"></div><div className="w-8 h-4 bg-gray-200"></div><div className="w-8 h-4 bg-gray-200"></div><div className="w-8 h-4 bg-gray-200"></div>
                                            <div className="w-8 h-4 bg-gray-200"></div><div className="w-8 h-4 bg-blue-100"></div><div className="w-8 h-4 bg-blue-100"></div><div className="w-8 h-4 bg-gray-200"></div>
                                            <div className="w-8 h-4 bg-gray-200"></div><div className="w-8 h-4 bg-blue-100"></div><div className="w-8 h-4 bg-blue-100"></div><div className="w-8 h-4 bg-gray-200"></div>
                                            <div className="w-8 h-4 bg-gray-200"></div><div className="w-8 h-4 bg-gray-200"></div><div className="w-8 h-4 bg-gray-200"></div><div className="w-8 h-4 bg-gray-200"></div>
                                        </div>
                                        <p>คลิกที่นี่แล้วกด Ctrl+V เพื่อวางข้อมูล</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer Buttons */}
                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                            <button
                                onClick={() => setIsPasteModalOpen(false)}
                                className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-100"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handlePasteVerification}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                            >
                                ตรวจสอบข้อมูล
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Order Detail Modal */}
            <OrderDetailModal
                isOpen={!!selectedOrderId}
                onClose={() => setSelectedOrderId(null)}
                orderId={selectedOrderId}
            />
        </div>
    );
};

export default ReturnManagementPage;
