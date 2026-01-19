import React, { useState, useEffect, useRef } from 'react';
import { User, Order, OrderStatus } from '../types';
import { listOrders } from '../services/api';
import * as XLSX from 'xlsx';
import { Search, Upload, RefreshCw, FileText, CheckCircle, AlertCircle, XCircle, ArrowLeftRight } from 'lucide-react';

interface ReturnManagementPageProps {
    user: User;
}

interface ImportRow {
    orderNumber: string;
    amount: number;
}

interface MatchResult {
    importRow: ImportRow;
    matchedOrder?: Order;
    status: 'matched' | 'unmatched_system' | 'unmatched_file' | 'amount_mismatch';
    diff: number;
}

const ReturnManagementPage: React.FC<ReturnManagementPageProps> = ({ user }) => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'list' | 'verify'>('list');
    const [importedData, setImportedData] = useState<ImportRow[]>([]);
    const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchOrders();
    }, [user.companyId]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await listOrders({
                companyId: user.companyId,
                orderStatus: OrderStatus.Returned,
                pageSize: 1000 // Construct a reasonable limit or pagination
            });
            if (res.ok) {
                setOrders(res.orders);
            }
        } catch (err) {
            console.error("Failed to fetch returned orders", err);
        } finally {
            setLoading(false);
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

            // Attempt to find headers
            // Assume header row contains "Order Number" or similar
            // Or just assume column positions if fixed? 
            // User request: "มีระบุ หมายเลขคำสั่งซื้อ , ยอดเงิน"
            // Let's try to detect columns by name "Order Number", "Amount" or "Tracking Number"

            if (data.length < 2) return;

            const headerRow = data[0] as string[];
            let orderIdx = -1;
            let amountIdx = -1;

            headerRow.forEach((h, i) => {
                const lower = String(h).toLowerCase();
                if (lower.includes('order') || lower.includes('id') || lower.includes('หมายเลข') || lower.includes('tracking')) orderIdx = i;
                if (lower.includes('amount') || lower.includes('price') || lower.includes('ยอด')) amountIdx = i;
            });

            if (orderIdx === -1 || amountIdx === -1) {
                // Fallback: Use col 0 and 1
                orderIdx = 0;
                amountIdx = 1;
            }

            const parsed: ImportRow[] = [];
            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                if (!row || row.length === 0) continue;
                const rawOrder = row[orderIdx];
                const rawAmount = row[amountIdx];

                if (rawOrder) {
                    parsed.push({
                        orderNumber: String(rawOrder).trim(),
                        amount: Number(rawAmount || 0)
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
                (o.trackingNumbers && o.trackingNumbers.some(t => t.includes(row.orderNumber))) ||
                o.id === row.orderNumber ||
                // Also check trackingDetails
                (o.trackingDetails && o.trackingDetails.some(t => t.trackingNumber?.includes(row.orderNumber)))
            );

            if (matched) {
                matchedOrderIds.add(matched.id);
                const diff = Math.abs(matched.totalAmount - row.amount);
                results.push({
                    importRow: row,
                    matchedOrder: matched,
                    status: diff < 1 ? 'matched' : 'amount_mismatch',
                    diff: matched.totalAmount - row.amount // Positive = System > Import
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
                    {orders.map(order => (
                        <tr key={order.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">{order.id}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {order.customerInfo?.firstName} {order.customerInfo?.lastName}
                                <div className="text-xs text-gray-500">{order.customerInfo?.phone}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {order.trackingNumbers?.map(t => (
                                    <div key={t}>{t}</div>
                                ))}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                                {order.totalAmount.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(order.orderDate).toLocaleDateString('th-TH')}
                            </td>
                        </tr>
                    ))}
                    {orders.length === 0 && (
                        <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500">ไม่พบรายการสินค้าตีกลับ</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );

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
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">File Amount</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">System Amount</th>
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
                                    <div className="flex flex-col">
                                        <span>{res.matchedOrder.id}</span>
                                        <span className="text-xs text-gray-500">{res.matchedOrder.customerInfo?.firstName}</span>
                                    </div>
                                ) : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{res.importRow.amount.toLocaleString()}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                {res.matchedOrder ? res.matchedOrder.totalAmount.toLocaleString() : '-'}
                            </td>
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
                        onClick={() => { setMode('list'); fetchOrders(); }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border flex items-center gap-2 ${mode === 'list' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-300 text-gray-700'}`}
                    >
                        <FileText size={16} /> รายการตีกลับ
                    </button>
                    <div className="h-8 w-px bg-gray-300 mx-2 self-center"></div>
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
                        <Upload size={16} /> Import ตรวจสอบ
                    </button>
                </div>
            </div>

            {mode === 'verify' && importedData.length > 0 ? (
                <VerificationList />
            ) : (
                <SystemList />
            )}
        </div>
    );
};

export default ReturnManagementPage;
