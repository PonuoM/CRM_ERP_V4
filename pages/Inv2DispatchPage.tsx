import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, Search, Loader2, AlertTriangle, CheckCircle2, FileSpreadsheet, Download, Trash2, ChevronDown, ChevronRight, Eye, X } from 'lucide-react';
import ExportTypeModal from '../components/ExportTypeModal';
import { downloadDataFile } from '../utils/exportUtils';
import { Warehouse, Product } from '../types';
import { inv2ImportDispatch, inv2ListDispatch, inv2DeleteDispatch, inv2GetDispatchBatch, listWarehouses, listProducts } from '../services/api';
import APP_BASE_PATH from '../appBasePath';
import UniversalDateRangePicker from '../components/UniversalDateRangePicker';

interface Inv2DispatchPageProps {
    companyId: number;
    userId: number;
}

interface ParsedRow {
    product_sku: string;
    product_name: string;
    variant_code: string;
    variant_name: string;
    internal_order_id: string;
    online_order_id: string;
    quantity: number;
    total_price: string;
    order_date: string;
    ship_date: string;
    order_status: string;
    platform: string;
    shop: string;
    warehouse_name: string;
    tracking_number: string;
    status: string;
    // Matched IDs
    product_id: number | null;
    warehouse_id: number | null;
    matched: boolean;
}

const Inv2DispatchPage: React.FC<Inv2DispatchPageProps> = ({ companyId, userId }) => {
    const [batches, setBatches] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Import state
    const [showImport, setShowImport] = useState(false);
    const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
    const [importFilename, setImportFilename] = useState('');
    const [importNotes, setImportNotes] = useState('');
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<any>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    // Detail state
    const [expandedBatch, setExpandedBatch] = useState<number | null>(null);
    const [batchDetail, setBatchDetail] = useState<any>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Delete state
    const [deletingBatch, setDeletingBatch] = useState<number | null>(null);

    // Export state
    const [exportDateRange, setExportDateRange] = useState<{ start: string; end: string }>({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [isExportTypeModalOpen, setIsExportTypeModalOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [dRes, whRes, pRes] = await Promise.all([
                inv2ListDispatch({ company_id: companyId, search: search || undefined }),
                listWarehouses(companyId),
                listProducts(companyId),
            ]);
            setBatches(dRes?.data || []);
            setWarehouses(Array.isArray(whRes) ? whRes : whRes?.data || []);
            setProducts(Array.isArray(pRes) ? pRes : pRes?.data || []);
        } catch (e) { console.error('Load error:', e); }
        setLoading(false);
    }, [companyId, search]);

    useEffect(() => { loadData(); }, [loadData]);

    // ── CSV Parser ──
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportFilename(file.name);

        const reader = new FileReader();
        reader.onload = () => {
            const text = reader.result as string;
            // Remove BOM if present
            const cleanText = text.replace(/^\uFEFF/, '');
            const lines = cleanText.split(/\r?\n/).filter(l => l.trim());
            if (lines.length < 2) return alert('ไฟล์ต้องมีอย่างน้อย header + 1 row');

            // Parse header — handle possible hidden chars
            const headers = lines[0].split(',').map(h => h.trim().replace(/\u200B/g, '').replace(/"/g, ''));

            const rows: ParsedRow[] = [];
            for (let i = 1; i < lines.length; i++) {
                // Simple CSV parse (handles quoted commas if needed)
                const cols = csvParseLine(lines[i]);
                const getCol = (name: string) => {
                    const idx = headers.findIndex(h => h === name || h.includes(name));
                    return idx >= 0 ? (cols[idx] || '').trim() : '';
                };

                const productSku = getCol('รหัสสินค้า');
                const productName = getCol('ชื่อสินค้า');
                
                // Fix parseFloat truncating at comma (e.g. "1,500" -> 1)
                const rawQty = getCol('จำนวนสินค้าที่ส่งจริง') || getCol('จำนวน');
                const qty = parseFloat(rawQty.replace(/,/g, '')) || 0;
                
                const rawPrice = getCol('ราคาสินค้าทั้งหมด');
                const totalPriceCleaned = rawPrice.replace(/,/g, '');

                const warehouseName = getCol('คลังส่งสินค้า');

                // Match product by SKU
                const product = products.find(p => p.sku === productSku);
                // Match warehouse by name (partial match)
                const warehouse = warehouses.find(w => warehouseName && w.name.includes(warehouseName));

                rows.push({
                    product_sku: productSku,
                    product_name: productName,
                    variant_code: getCol('รหัสรูปแบบ'),
                    variant_name: getCol('รูปแบบสินค้า'),
                    internal_order_id: getCol('หมายเลขออเดอร์ภายใน'),
                    online_order_id: getCol('หมายเลขคำสั่งซื้อออนไลน์'),
                    quantity: qty,
                    total_price: totalPriceCleaned,
                    order_date: getCol('วันที่สั่งซื้อ'),
                    ship_date: getCol('วันที่จัดส่ง'),
                    order_status: getCol('สถานะคำสั่งซื้อ'),
                    platform: getCol('แพลตฟอร์ม'),
                    shop: getCol('ร้านค้า'),
                    warehouse_name: warehouseName,
                    tracking_number: getCol('หมายเลขพัสดุ'),
                    status: getCol('สถานะ'),
                    product_id: product?.id ?? null,
                    warehouse_id: warehouse?.id ?? null,
                    matched: !!(product && warehouse),
                });
            }

            setParsedRows(rows);
            setImportResult(null);
        };
        reader.readAsText(file, 'UTF-8');
        setShowImport(true);
        // Reset file input
        if (fileRef.current) fileRef.current.value = '';
    };

    // Simple CSV line parser that handles quoted fields
    const csvParseLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuote = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') { inQuote = !inQuote; continue; }
            if (c === ',' && !inQuote) { result.push(current.trim()); current = ''; continue; }
            current += c;
        }
        result.push(current.trim());
        return result;
    };

    // ── Import ──
    const handleImport = async () => {
        if (parsedRows.length === 0) return alert('ไม่มีรายการที่จะ import');
        setImporting(true);
        try {
            const result = await inv2ImportDispatch({
                user_id: userId,
                company_id: companyId,
                filename: importFilename,
                notes: importNotes || undefined,
                rows: parsedRows.map(r => ({
                    product_sku: r.product_sku,
                    product_name: r.product_name,
                    variant_code: r.variant_code,
                    variant_name: r.variant_name,
                    internal_order_id: r.internal_order_id,
                    online_order_id: r.online_order_id,
                    quantity: r.quantity,
                    total_price: r.total_price,
                    order_date: r.order_date,
                    ship_date: r.ship_date,
                    order_status: r.order_status,
                    platform: r.platform,
                    shop: r.shop,
                    warehouse_name: r.warehouse_name,
                    tracking_number: r.tracking_number,
                    status: r.status,
                    product_id: r.product_id,
                    warehouse_id: r.warehouse_id,
                })),
            } as any);
            setImportResult(result);
            if (result?.success) {
                loadData();
                // Clear form after success
                setParsedRows([]);
                setImportNotes('');
                setImportFilename('');
                setShowImport(false);
                setImportResult(null);
            }
        } catch (e: any) {
            setImportResult({ success: false, error: e?.message || 'เกิดข้อผิดพลาด' });
        }
        setImporting(false);
    };

    // ── Batch detail ──
    const toggleBatchDetail = async (batchId: number) => {
        if (expandedBatch === batchId) { setExpandedBatch(null); setBatchDetail(null); return; }
        setExpandedBatch(batchId);
        setLoadingDetail(true);
        try {
            const res = await inv2GetDispatchBatch(batchId);
            setBatchDetail(res?.data || null);
        } catch { setBatchDetail(null); }
        setLoadingDetail(false);
    };

    // ── Batch delete ──
    const handleDeleteBatch = async (batchId: number, batchDocNumber: string) => {
        if (!confirm(`ลบ Batch ${batchDocNumber} ?\n\nยอด stock ที่เคยหักจะถูกคืนกลับทั้งหมด`)) return;
        setDeletingBatch(batchId);
        try {
            const res = await inv2DeleteDispatch(batchId);
            if (res?.success) {
                alert(`ลบสำเร็จ — คืนยอด ${res.reversed_quantity} หน่วย`);
                if (expandedBatch === batchId) { setExpandedBatch(null); setBatchDetail(null); }
                loadData();
            } else {
                alert('ลบไม่สำเร็จ: ' + (res?.error || ''));
            }
        } catch (e: any) { alert('เกิดข้อผิดพลาด: ' + (e?.message || '')); }
        setDeletingBatch(null);
    };

    // ── Template download ──
    const downloadTemplate = () => {
        window.open(`${APP_BASE_PATH}api/inv2/dispatch_template.php`, '_blank');
    };

    // ── Export CSV/Excel ──
    const handleExport = () => {
        if (!exportDateRange.start || !exportDateRange.end) {
            alert('กรุณาเลือกช่วงวันที่ให้ครบถ้วน');
            return;
        }
        setIsExportTypeModalOpen(true);
    };

    const executeExport = async (type: 'csv' | 'xlsx') => {
        let startStr = exportDateRange.start;
        let endStr = exportDateRange.end;
        
        setIsExporting(true);
        try {
            const url = `${APP_BASE_PATH}api/inv2/export_dispatch_items.php?company_id=${companyId}&start_date=${startStr}&end_date=${endStr}&format=json`;
            const response = await fetch(url);
            const result = await response.json();
            
            if (result.success && result.data) {
                const headers = [
                    'หมายเลข Batch (อ้างอิง)', 'เวลาที่ Import', 'รหัสสินค้า', 'ชื่อสินค้า', 
                    'รหัสรูปแบบ', 'รูปแบบสินค้า', 'หมายเลขออเดอร์ภายใน', 'หมายเลขคำสั่งซื้อออนไลน์', 
                    'จำนวน', 'ราคาสินค้าทั้งหมด', 'วันที่สั่งซื้อ', 'วันที่จัดส่ง', 'สถานะคำสั่งซื้อ', 
                    'แพลตฟอร์ม', 'ร้านค้า', 'คลังส่งสินค้า', 'หมายเลขพัสดุ', 'สถานะ', 'สถานะหักคลัง'
                ];
                
                const rows = result.data.map((r: any) => [
                    r.batch_doc_number, r.batch_created_at, r.product_sku, r.product_name,
                    r.variant_code, r.variant_name, r.internal_order_id, r.online_order_id,
                    r.quantity, r.total_price, r.order_date, r.ship_date, r.order_status,
                    r.platform, r.shop, r.warehouse_name, r.tracking_number, r.status, r.stock_deducted
                ]);
                
                downloadDataFile([headers, ...rows], `dispatch_export_${startStr}_to_${endStr}`, type);
            } else {
                alert('ไม่สามารถดึงข้อมูลได้: ' + (result.error || 'Unknown error'));
            }
        } catch (e: any) {
            alert('เกิดข้อผิดพลาดในการดึงข้อมูล: ' + e.message);
        } finally {
            setIsExporting(false);
            setIsExportTypeModalOpen(false);
        }
    };

    const matchedCount = parsedRows.filter(r => r.matched).length;
    const withQtyCount = parsedRows.filter(r => r.quantity > 0 && r.matched).length;

    const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', fontSize: '13px', border: '1.5px solid #e2e8f0', borderRadius: '8px', outline: 'none', transition: 'border-color 0.2s' };

    return (
        <div style={{ padding: '24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
                        <Upload size={28} style={{ verticalAlign: 'middle', marginRight: '8px', color: '#f59e0b' }} />
                        จ่ายออก (Dispatch)
                    </h1>
                    <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: '14px' }}>Import ข้อมูลจ่ายออกจาก CSV — Auto FIFO หัก Stock</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <UniversalDateRangePicker
                        value={exportDateRange}
                        onChange={setExportDateRange}
                        buttonStyle={{
                            background: '#fff',
                            border: '1.5px solid #d1d5db',
                            borderRadius: '10px',
                            color: '#374151',
                            padding: '10px 18px',
                            fontSize: '13px',
                            fontWeight: 600,
                            boxShadow: 'none'
                        }}
                    />
                    <button onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(59,130,246,0.3)' }}>
                        <Download size={16} /> ส่งออกข้อมูล
                    </button>
                    &nbsp;&nbsp;&nbsp;
                    <button onClick={downloadTemplate} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', background: '#fff', color: '#374151', border: '1.5px solid #d1d5db', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                        <Download size={16} /> ดาวน์โหลด Template
                    </button>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(245,158,11,0.3)' }}>
                        <FileSpreadsheet size={18} /> Import CSV
                        <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileChange} style={{ display: 'none' }} />
                    </label>
                </div>
            </div>

            {/* Import Preview */}
            {showImport && (
                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #fde68a', marginBottom: '24px', boxShadow: '0 4px 20px rgba(245,158,11,0.08)' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#92400e', margin: 0 }}>
                            <FileSpreadsheet size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                            Preview — {importFilename}
                        </h3>
                        <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                            <span style={{ padding: '4px 10px', borderRadius: '20px', background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>{parsedRows.length} แถว</span>
                            <span style={{ padding: '4px 10px', borderRadius: '20px', background: matchedCount === parsedRows.length ? '#dcfce7' : '#fef2f2', color: matchedCount === parsedRows.length ? '#166534' : '#dc2626', fontWeight: 600 }}>{matchedCount} จับคู่ได้</span>
                            <span style={{ padding: '4px 10px', borderRadius: '20px', background: '#dbeafe', color: '#1d4ed8', fontWeight: 600 }}>{withQtyCount} หัก stock</span>
                        </div>
                    </div>

                    {parsedRows.length > 0 && (
                        <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '1200px' }}>
                                <thead>
                                    <tr style={{ background: '#fffbeb', position: 'sticky', top: 0, zIndex: 1 }}>
                                        {['#', 'รหัส', 'ชื่อสินค้า', 'รูปแบบ', 'Order', 'จำนวน', 'ราคา', 'คลัง', 'แพลตฟอร์ม', 'ร้านค้า', 'สถานะ', 'Tracking', 'จับคู่'].map(h => (
                                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #fde68a', color: '#92400e', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {parsedRows.map((row, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #fef3c7', background: !row.matched ? '#fef2f2' : row.quantity <= 0 ? '#f8fafc' : '#fff' }}>
                                            <td style={{ padding: '6px 10px', color: '#9ca3af' }}>{idx + 1}</td>
                                            <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: '11px', fontWeight: 600 }}>{row.product_sku}</td>
                                            <td style={{ padding: '6px 10px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.product_name}</td>
                                            <td style={{ padding: '6px 10px', color: '#6b7280' }}>{row.variant_name || row.variant_code || '—'}</td>
                                            <td style={{ padding: '6px 10px', color: '#6366f1', fontSize: '11px' }}>{row.internal_order_id || '—'}</td>
                                            <td style={{ padding: '6px 10px', fontWeight: 700, color: row.quantity > 0 ? '#d97706' : '#9ca3af' }}>{row.quantity}</td>
                                            <td style={{ padding: '6px 10px', color: '#6b7280' }}>{row.total_price || '—'}</td>
                                            <td style={{ padding: '6px 10px', fontSize: '11px', color: row.warehouse_id ? '#166534' : '#dc2626', fontWeight: row.warehouse_id ? 400 : 600 }}>{row.warehouse_name || '—'}</td>
                                            <td style={{ padding: '6px 10px', color: '#6b7280' }}>{row.platform || '—'}</td>
                                            <td style={{ padding: '6px 10px', color: '#6b7280', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.shop || '—'}</td>
                                            <td style={{ padding: '6px 10px' }}>
                                                <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, background: row.order_status === 'จัดส่งแล้ว' ? '#dcfce7' : row.order_status === 'ยกเลิกแล้ว' ? '#fef2f2' : '#f3f4f6', color: row.order_status === 'จัดส่งแล้ว' ? '#166534' : row.order_status === 'ยกเลิกแล้ว' ? '#dc2626' : '#6b7280' }}>
                                                    {row.order_status || '—'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: '10px', color: '#6b7280' }}>{row.tracking_number || '—'}</td>
                                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                                {row.matched ? <CheckCircle2 size={14} style={{ color: '#22c55e' }} /> : <AlertTriangle size={14} style={{ color: '#f59e0b' }} />}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div style={{ padding: '16px 20px', borderTop: '1px solid #fef3c7' }}>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>หมายเหตุ (Batch)</label>
                            <input value={importNotes} onChange={e => setImportNotes(e.target.value)} placeholder="หมายเหตุสำหรับ batch นี้" style={inputStyle} />
                        </div>

                        {importResult && (
                            <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '12px', background: importResult.success ? '#f0fdf4' : '#fef2f2', border: `1px solid ${importResult.success ? '#bbf7d0' : '#fecaca'}` }}>
                                {importResult.success ? (
                                    <div>
                                        <p style={{ color: '#166534', fontWeight: 600, margin: '0 0 4px' }}><CheckCircle2 size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />Import สำเร็จ — {importResult.batch_doc_number}</p>
                                        <p style={{ color: '#166534', fontSize: '13px', margin: 0 }}>ทั้งหมด {importResult.total_rows} แถว, หัก stock {importResult.processed} รายการ</p>
                                        {importResult.errors?.length > 0 && (
                                            <div style={{ marginTop: '8px' }}>
                                                {importResult.errors.map((err: string, i: number) => (
                                                    <p key={i} style={{ color: '#dc2626', fontSize: '12px', margin: '2px 0' }}><AlertTriangle size={12} style={{ verticalAlign: 'middle' }} /> {err}</p>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p style={{ color: '#dc2626', fontWeight: 600, margin: 0 }}><AlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> {importResult.error}</p>
                                )}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button onClick={() => { setShowImport(false); setParsedRows([]); setImportResult(null); }} style={{ padding: '10px 24px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>ยกเลิก</button>
                            <button onClick={handleImport} disabled={importing || parsedRows.length === 0} style={{ padding: '10px 24px', background: importing ? '#fcd34d' : 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: importing ? 'not-allowed' : 'pointer' }}>
                                {importing ? <><Loader2 size={14} className="animate-spin" style={{ marginRight: '6px' }} />กำลัง Import...</> : `ยืนยัน Import (${withQtyCount} รายการหัก stock)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Search */}
            <div style={{ marginBottom: '20px', position: 'relative', maxWidth: '400px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา batch, ชื่อไฟล์..." style={{ ...inputStyle, paddingLeft: '36px' }} />
            </div>

            {/* Batch List */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#374151', margin: 0 }}>ประวัติ Import ({batches.length})</h3>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}><Loader2 className="animate-spin" size={24} style={{ margin: '0 auto 8px' }} /></div>
                ) : batches.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>ยังไม่มีรายการ Import</div>
                ) : (
                    <div>
                        {batches.map((b) => (
                            <div key={b.id}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', transition: 'background 0.1s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#fefce8'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                                    <div onClick={() => toggleBatchDetail(b.id)} style={{ display: 'flex', alignItems: 'center', flex: 1, padding: '14px 16px', gap: '16px' }}>
                                        {expandedBatch === b.id ? <ChevronDown size={16} style={{ color: '#d97706', flexShrink: 0 }} /> : <ChevronRight size={16} style={{ color: '#9ca3af', flexShrink: 0 }} />}
                                        <div style={{ minWidth: '140px' }}>
                                            <div style={{ fontWeight: 700, color: '#d97706', fontSize: '14px' }}>{b.batch_doc_number}</div>
                                            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{new Date(b.created_at).toLocaleString('th-TH')}</div>
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#6b7280', minWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            📄 {b.filename || '—'}
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px', fontSize: '13px' }}>
                                            <span title="แถวทั้งหมด" style={{ color: '#6b7280' }}>{b.total_rows} แถว</span>
                                            <span title="หัก stock แล้ว" style={{ color: '#22c55e', fontWeight: 600 }}>{b.processed_rows || 0} สำเร็จ</span>
                                            <span title="จำนวนรวม" style={{ color: '#ef4444', fontWeight: 700 }}>-{parseFloat(b.total_quantity || 0).toLocaleString()}</span>
                                        </div>
                                        <div style={{ flex: 1 }} />
                                        <div style={{ fontSize: '12px', color: '#9ca3af' }}>{b.created_by_name || '—'}</div>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteBatch(b.id, b.batch_doc_number); }}
                                        disabled={deletingBatch === b.id}
                                        style={{ padding: '10px 14px', background: 'none', border: 'none', cursor: deletingBatch === b.id ? 'not-allowed' : 'pointer', color: '#ef4444', opacity: deletingBatch === b.id ? 0.4 : 0.6, transition: 'opacity 0.2s' }}
                                        onMouseEnter={e => { if (deletingBatch !== b.id) (e.target as HTMLElement).style.opacity = '1'; }}
                                        onMouseLeave={e => { (e.target as HTMLElement).style.opacity = '0.6'; }}
                                        title="ลบ batch (คืนยอด stock)">
                                        {deletingBatch === b.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                    </button>
                                </div>

                                {/* Expanded detail */}
                                {expandedBatch === b.id && (
                                    <div style={{ background: '#fefce8', borderBottom: '1px solid #fde68a' }}>
                                        {loadingDetail ? (
                                            <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}><Loader2 className="animate-spin" size={20} /></div>
                                        ) : batchDetail?.items ? (
                                            <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', minWidth: '1100px' }}>
                                                    <thead>
                                                        <tr style={{ background: '#fef9c3', position: 'sticky', top: 0, zIndex: 1 }}>
                                                            {['#', 'รหัส', 'ชื่อสินค้า', 'รูปแบบ', 'Order', 'จำนวน', 'ราคา', 'คลัง', 'แพลตฟอร์ม', 'ร้านค้า', 'สถานะ', 'Tracking', 'หัก Stock'].map(h => (
                                                                <th key={h} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #fde68a', color: '#78350f', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {batchDetail.items.map((item: any, idx: number) => (
                                                            <tr key={idx} style={{ borderBottom: '1px solid #fef3c7', background: item.stock_deducted === '1' || item.stock_deducted === 1 ? '#fff' : '#fef2f2' }}>
                                                                <td style={{ padding: '5px 8px', color: '#9ca3af' }}>{idx + 1}</td>
                                                                <td style={{ padding: '5px 8px', fontFamily: 'monospace', fontWeight: 600, fontSize: '10px' }}>{item.product_sku}</td>
                                                                <td style={{ padding: '5px 8px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product_name}</td>
                                                                <td style={{ padding: '5px 8px', color: '#6b7280' }}>{item.variant_name || item.variant_code || '—'}</td>
                                                                <td style={{ padding: '5px 8px', color: '#6366f1', fontSize: '10px' }}>{item.internal_order_id || '—'}</td>
                                                                <td style={{ padding: '5px 8px', fontWeight: 700, color: '#d97706' }}>{parseFloat(item.quantity).toLocaleString()}</td>
                                                                <td style={{ padding: '5px 8px', color: '#6b7280' }}>{item.total_price || '—'}</td>
                                                                <td style={{ padding: '5px 8px', fontSize: '10px' }}>{item.warehouse_name || '—'}</td>
                                                                <td style={{ padding: '5px 8px', color: '#6b7280' }}>{item.platform || '—'}</td>
                                                                <td style={{ padding: '5px 8px', color: '#6b7280', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.shop || '—'}</td>
                                                                <td style={{ padding: '5px 8px' }}>
                                                                    <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 600, background: item.order_status === 'จัดส่งแล้ว' ? '#dcfce7' : item.order_status === 'ยกเลิกแล้ว' ? '#fef2f2' : '#f3f4f6', color: item.order_status === 'จัดส่งแล้ว' ? '#166534' : item.order_status === 'ยกเลิกแล้ว' ? '#dc2626' : '#6b7280' }}>
                                                                        {item.order_status || '—'}
                                                                    </span>
                                                                </td>
                                                                <td style={{ padding: '5px 8px', fontFamily: 'monospace', fontSize: '9px', color: '#6b7280' }}>{item.tracking_number || '—'}</td>
                                                                <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                                                                    {(item.stock_deducted === '1' || item.stock_deducted === 1) ? <CheckCircle2 size={12} style={{ color: '#22c55e' }} /> : <span style={{ color: '#9ca3af', fontSize: '10px' }}>—</span>}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>ไม่พบข้อมูล</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Export Format Modal */}
            <ExportTypeModal
                isOpen={isExportTypeModalOpen}
                onClose={() => !isExporting && setIsExportTypeModalOpen(false)}
                onConfirm={executeExport}
                isExporting={isExporting}
            />
        </div>
    );
};

export default Inv2DispatchPage;
