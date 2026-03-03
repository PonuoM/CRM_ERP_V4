import React, { useState, useEffect, useCallback } from 'react';
import { Upload, Search, Loader2, AlertTriangle, CheckCircle2, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { Warehouse, Product } from '../types';
import { inv2ImportDispatch, inv2ListDispatch, listWarehouses, listProducts } from '../services/api';

interface Inv2DispatchPageProps {
    companyId: number;
    userId: number;
}

interface ParsedRow {
    warehouse_id: number;
    warehouse_name?: string;
    product_id: number;
    product_name?: string;
    variant?: string;
    quantity: number;
    reference_order_id?: string;
    notes?: string;
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
    const [importNotes, setImportNotes] = useState('');
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<any>(null);

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
        } catch (e) {
            console.error('Load error:', e);
        }
        setLoading(false);
    }, [companyId, search]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const text = reader.result as string;
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length < 2) return alert('ไฟล์ต้องมีอย่างน้อย header + 1 row');

            // Parse header
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));

            const rows: ParsedRow[] = [];
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
                const getCol = (name: string) => {
                    const idx = headers.indexOf(name);
                    return idx >= 0 ? cols[idx] : '';
                };

                // Try to match product by sku or name
                const productSku = getCol('product_sku') || getCol('sku') || getCol('รหัสสินค้า');
                const productName = getCol('product_name') || getCol('สินค้า') || getCol('name');
                const product = products.find(p => (productSku && p.sku === productSku) || (productName && p.name === productName));

                // Try to match warehouse by name or id
                const whName = getCol('warehouse') || getCol('warehouse_name') || getCol('คลัง');
                const whId = getCol('warehouse_id');
                const warehouse = warehouses.find(w => (whId && w.id === Number(whId)) || (whName && w.name.includes(whName)));

                const qty = Number(getCol('quantity') || getCol('จำนวน') || getCol('qty') || 0);

                if (product && warehouse && qty > 0) {
                    rows.push({
                        warehouse_id: warehouse.id,
                        warehouse_name: warehouse.name,
                        product_id: product.id,
                        product_name: product.name,
                        variant: getCol('variant') || getCol('รุ่น') || undefined,
                        quantity: qty,
                        reference_order_id: getCol('order_id') || getCol('เลขออเดอร์') || getCol('reference_order_id') || undefined,
                        notes: getCol('notes') || getCol('หมายเหตุ') || undefined,
                    });
                }
            }

            setParsedRows(rows);
            setImportResult(null);
        };
        reader.readAsText(file, 'UTF-8');
        setShowImport(true);
    };

    const handleImport = async () => {
        if (parsedRows.length === 0) return alert('ไม่มีรายการที่จะ import');
        setImporting(true);
        try {
            const result = await inv2ImportDispatch({
                user_id: userId,
                company_id: companyId,
                notes: importNotes || undefined,
                rows: parsedRows.map(r => ({
                    warehouse_id: r.warehouse_id,
                    product_id: r.product_id,
                    variant: r.variant,
                    quantity: r.quantity,
                    reference_order_id: r.reference_order_id,
                    notes: r.notes,
                })),
            });
            setImportResult(result);
            if (result?.success) loadData();
        } catch (e: any) {
            setImportResult({ success: false, error: e?.message || 'เกิดข้อผิดพลาด' });
        }
        setImporting(false);
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
                        <Upload size={28} style={{ verticalAlign: 'middle', marginRight: '8px', color: '#f59e0b' }} />
                        จ่ายออก (Dispatch)
                    </h1>
                    <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: '14px' }}>Import ข้อมูลจ่ายออกจากคลังภายนอก — Auto FIFO</p>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(245,158,11,0.3)' }}>
                    <FileSpreadsheet size={18} /> Import CSV
                    <input type="file" accept=".csv,.txt" onChange={handleFileChange} style={{ display: 'none' }} />
                </label>
            </div>

            {/* Import Preview */}
            {showImport && (
                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #fde68a', marginBottom: '24px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#92400e', marginBottom: '12px' }}>
                        <FileSpreadsheet size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                        Preview — {parsedRows.length} รายการ
                    </h3>

                    {parsedRows.length > 0 && (
                        <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ background: '#fffbeb' }}>
                                        {['#', 'คลัง', 'สินค้า', 'รุ่น', 'จำนวน', 'เลขออเดอร์', 'หมายเหตุ'].map(h => (
                                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #fde68a', color: '#92400e', fontWeight: 600 }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {parsedRows.map((row, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #fef3c7' }}>
                                            <td style={{ padding: '8px 12px', color: '#6b7280' }}>{idx + 1}</td>
                                            <td style={{ padding: '8px 12px' }}>{row.warehouse_name}</td>
                                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{row.product_name}</td>
                                            <td style={{ padding: '8px 12px', color: '#6b7280' }}>{row.variant || '—'}</td>
                                            <td style={{ padding: '8px 12px', fontWeight: 600, color: '#d97706' }}>{row.quantity}</td>
                                            <td style={{ padding: '8px 12px', color: '#6366f1', fontSize: '12px' }}>{row.reference_order_id || '—'}</td>
                                            <td style={{ padding: '8px 12px', color: '#9ca3af' }}>{row.notes || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>หมายเหตุ (Batch)</label>
                        <input value={importNotes} onChange={e => setImportNotes(e.target.value)} placeholder="หมายเหตุสำหรับ batch นี้" style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }} />
                    </div>

                    {importResult && (
                        <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '12px', background: importResult.success ? '#f0fdf4' : '#fef2f2', border: `1px solid ${importResult.success ? '#bbf7d0' : '#fecaca'}` }}>
                            {importResult.success ? (
                                <div>
                                    <p style={{ color: '#166534', fontWeight: 600 }}><CheckCircle2 size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Import สำเร็จ — {importResult.batch_doc_number}</p>
                                    <p style={{ color: '#166534', fontSize: '13px' }}>ดำเนินการ {importResult.processed} รายการ</p>
                                    {importResult.errors?.length > 0 && (
                                        <div style={{ marginTop: '8px' }}>
                                            {importResult.errors.map((err: string, i: number) => (
                                                <p key={i} style={{ color: '#dc2626', fontSize: '12px' }}><AlertTriangle size={12} style={{ verticalAlign: 'middle' }} /> {err}</p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p style={{ color: '#dc2626', fontWeight: 600 }}><AlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> {importResult.error}</p>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button onClick={() => { setShowImport(false); setParsedRows([]); setImportResult(null); }} style={{ padding: '10px 24px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>ยกเลิก</button>
                        <button onClick={handleImport} disabled={importing || parsedRows.length === 0} style={{ padding: '10px 24px', background: importing ? '#fcd34d' : 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: importing ? 'not-allowed' : 'pointer' }}>
                            {importing ? <><Loader2 size={14} className="animate-spin" style={{ marginRight: '6px' }} />กำลัง Import...</> : `ยืนยัน Import (${parsedRows.length} รายการ)`}
                        </button>
                    </div>
                </div>
            )}

            {/* CSV format hint */}
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
                <p style={{ fontSize: '13px', color: '#92400e', fontWeight: 600, margin: '0 0 4px' }}>รูปแบบ CSV ที่รองรับ:</p>
                <code style={{ fontSize: '12px', color: '#78350f', background: '#fef3c7', padding: '4px 8px', borderRadius: '4px' }}>warehouse_id, product_sku, variant, quantity, reference_order_id, notes</code>
                <p style={{ fontSize: '11px', color: '#92400e', margin: '6px 0 0' }}>หรือใช้ชื่อคอลัมน์ภาษาไทย: คลัง, รหัสสินค้า, รุ่น, จำนวน, เลขออเดอร์, หมายเหตุ</p>
            </div>

            {/* History */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#374151', margin: 0 }}>ประวัติ Import</h3>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}><Loader2 className="animate-spin" size={24} style={{ margin: '0 auto 8px' }} /></div>
                ) : batches.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>ยังไม่มีรายการ Import</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc' }}>
                                {['เลขที่ Batch', 'วัน/เวลา', 'Movement', 'จำนวนรวม', 'สินค้า', 'คลัง', 'ผู้ทำรายการ'].map(h => (
                                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {batches.map((b, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#d97706', fontSize: '14px' }}>{b.batch_doc_number}</td>
                                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>{new Date(b.dispatch_date).toLocaleString('th-TH')}</td>
                                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>{b.movement_count}</td>
                                    <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: '#ef4444' }}>-{b.total_quantity}</td>
                                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>{b.product_count}</td>
                                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>{b.warehouse_count}</td>
                                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{b.created_by_name}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default Inv2DispatchPage;
