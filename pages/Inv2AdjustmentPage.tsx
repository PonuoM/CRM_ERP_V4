import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Settings, Plus, Search, X, Camera, Loader2, Save, ChevronDown, Eye, Trash2 } from 'lucide-react';
import { Warehouse, Product } from '../types';
import { inv2SaveAdjustment, inv2ListMovements, listWarehouses, listProducts, apiFetch } from '../services/api';

interface Inv2AdjustmentPageProps {
    companyId: number;
    userId: number;
}

interface AdjustItem {
    warehouse_id: number;
    product_id: number;
    product_name?: string;
    product_sku?: string;
    lot_number?: string;
    adjust_type: 'add' | 'reduce';
    quantity: number;
    notes?: string;
}

const inputStyle: React.CSSProperties = { padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', background: '#fff', outline: 'none', transition: 'border-color 0.2s', width: '100%' };
const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'auto' as any };

/* ═══════ Searchable Product Dropdown ═══════ */
const ProductSearch: React.FC<{
    products: Product[];
    value: number;
    onChange: (id: number) => void;
}> = ({ products, value, onChange }) => {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const ref = useRef<HTMLDivElement>(null);
    const selected = products.find(p => p.id === value);

    useEffect(() => {
        const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filtered = products.filter(p => {
        if (!q) return true;
        const s = q.toLowerCase();
        return p.name.toLowerCase().includes(s) || (p.sku || '').toLowerCase().includes(s);
    });

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button type="button" onClick={() => { setOpen(!open); setQ(''); }}
                style={{ width: '100%', padding: '5px 8px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', textAlign: 'left', color: selected ? '#1e293b' : '#94a3b8', minHeight: '30px' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {selected ? `${selected.sku || '—'}` : '— เลือกสินค้า —'}
                </span>
                <ChevronDown size={14} style={{ flexShrink: 0, color: '#94a3b8', transform: open ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }} />
            </button>
            {open && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#fff', borderRadius: '10px', border: '1.5px solid #e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, overflow: 'hidden', maxHeight: '240px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={14} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาสินค้า..." style={{ width: '100%', padding: '6px 8px 6px 28px', border: '1.5px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', outline: 'none' }} />
                        </div>
                    </div>
                    <div style={{ overflow: 'auto', flex: 1 }}>
                        {filtered.length === 0 ? (
                            <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>ไม่พบสินค้า</div>
                        ) : filtered.map(p => (
                            <button key={p.id} type="button" onClick={() => { onChange(p.id); setOpen(false); }}
                                style={{ width: '100%', padding: '8px 12px', border: 'none', background: p.id === value ? '#f5f3ff' : '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.1s' }}
                                onMouseEnter={e => { if (p.id !== value) e.currentTarget.style.background = '#f8fafc'; }}
                                onMouseLeave={e => { if (p.id !== value) e.currentTarget.style.background = '#fff'; }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: p.id === value ? '#8b5cf6' : '#e2e8f0', flexShrink: 0 }} />
                                <div>
                                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{p.sku}</div>
                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{p.name}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

/* ═══════ Group movements by doc_number ═══════ */
interface AdjustDoc {
    doc_number: string;
    created_at: string;
    warehouse_name: string;
    created_by_name: string;
    notes: string;
    items: any[];
}

function groupByDoc(movements: any[]): AdjustDoc[] {
    const map = new Map<string, AdjustDoc>();
    for (const m of movements) {
        const key = m.reference_doc_number;
        if (!map.has(key)) {
            map.set(key, {
                doc_number: key,
                created_at: m.created_at,
                warehouse_name: m.warehouse_name,
                created_by_name: m.created_by_name,
                notes: m.notes || '',
                items: [],
            });
        }
        map.get(key)!.items.push(m);
    }
    return Array.from(map.values());
}

const Inv2AdjustmentPage: React.FC<Inv2AdjustmentPageProps> = ({ companyId, userId }) => {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [recentAdj, setRecentAdj] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal & Form state
    const [showModal, setShowModal] = useState(false);
    const [formWarehouse, setFormWarehouse] = useState<number>(0);
    const [formNotes, setFormNotes] = useState('');
    const [formImages, setFormImages] = useState<string[]>([]);
    const [formItems, setFormItems] = useState<AdjustItem[]>([]);
    const [saving, setSaving] = useState(false);
    const [stockData, setStockData] = useState<any[]>([]);

    // View detail modal
    const [viewDoc, setViewDoc] = useState<AdjustDoc | null>(null);

    // Deleting state
    const [deleting, setDeleting] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [whRes, pRes, mRes] = await Promise.all([
                listWarehouses(companyId),
                listProducts(companyId),
                inv2ListMovements({ company_id: companyId, reference_type: 'adjustment', pageSize: 200 }),
            ]);
            setWarehouses(Array.isArray(whRes) ? whRes : whRes?.data || []);
            setProducts(Array.isArray(pRes) ? pRes : pRes?.data || []);
            setRecentAdj(mRes?.data || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    }, [companyId]);

    useEffect(() => { loadData(); }, [loadData]);

    const openCreateModal = async () => {
        const defaultWh = warehouses[0]?.id || 0;
        setFormWarehouse(defaultWh);
        setFormNotes('');
        setFormImages([]);
        setFormItems([{
            warehouse_id: defaultWh, product_id: 0, lot_number: '',
            adjust_type: 'add', quantity: 0, notes: '',
        }]);
        setShowModal(true);
        try {
            const res = await apiFetch(`inv2/stock_view.php?company_id=${companyId}`);
            setStockData(res?.data || []);
        } catch { setStockData([]); }
    };

    const addItem = () => setFormItems([...formItems, {
        warehouse_id: formWarehouse, product_id: 0, lot_number: '',
        adjust_type: 'add', quantity: 0, notes: '',
    }]);
    const removeItem = (idx: number) => setFormItems(formItems.filter((_, i) => i !== idx));
    const updateItem = (idx: number, field: string, value: any) => {
        setFormItems(formItems.map((item, i) => {
            if (i !== idx) return item;
            const updated = { ...item, [field]: value };
            if (field === 'product_id') {
                const p = products.find(pr => pr.id === value);
                updated.product_name = p?.name || '';
                updated.product_sku = p?.sku || '';
                const stockMatch = stockData.find(s => s.warehouse_id == formWarehouse && s.product_id == value && s.lot_number);
                updated.lot_number = stockMatch?.lot_number || '';
            }
            return updated;
        }));
    };

    const handleSave = async () => {
        if (!formWarehouse) return alert('เลือกคลังสินค้า');
        const itemsWithWarehouse = formItems.map(i => {
            const { product_name, product_sku, ...rest } = i;
            return { ...rest, warehouse_id: formWarehouse };
        });
        const valid = itemsWithWarehouse.filter(i => i.warehouse_id && i.product_id && i.quantity > 0);
        if (valid.length === 0) return alert('เพิ่มรายการที่ถูกต้องอย่างน้อย 1 รายการ');

        setSaving(true);
        try {
            await inv2SaveAdjustment({
                user_id: userId, company_id: companyId,
                notes: formNotes || null, images: formImages, items: valid,
            });
            setShowModal(false);
            loadData();
        } catch (e: any) {
            alert('บันทึกไม่สำเร็จ: ' + (e?.message || ''));
        }
        setSaving(false);
    };

    const handleDelete = async (docNumber: string) => {
        if (!confirm(`ยืนยันลบเอกสาร ${docNumber}?\nระบบจะหักคืนยอด stock อัตโนมัติ`)) return;
        setDeleting(docNumber);
        try {
            const res = await apiFetch('inv2/adjust_delete.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ doc_number: docNumber }),
            });
            if (res?.success) {
                loadData();
            } else {
                alert('ลบไม่สำเร็จ: ' + (res?.error || ''));
            }
        } catch (e: any) {
            alert('ลบไม่สำเร็จ: ' + (e?.message || ''));
        }
        setDeleting('');
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = () => { if (reader.result) setFormImages(prev => [...prev, reader.result as string]); };
            reader.readAsDataURL(file);
        });
    };

    const totalAddQty = formItems.filter(i => i.adjust_type === 'add').reduce((s, i) => s + (Number(i.quantity) || 0), 0);
    const totalReduceQty = formItems.filter(i => i.adjust_type === 'reduce').reduce((s, i) => s + (Number(i.quantity) || 0), 0);

    // Group movements into documents
    const adjDocs = groupByDoc(recentAdj);

    return (
        <div style={{ padding: '24px' }}>
            {/* Page Header — matches V2 style */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
                        <Settings size={28} style={{ verticalAlign: 'middle', marginRight: '8px', color: '#8b5cf6' }} />
                        ปรับปรุงข้อมูลสต็อก
                    </h1>
                    <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: '14px' }}>แก้ไข/ปรับปรุงจำนวนสต็อกตามการตรวจนับจริง</p>
                </div>
                <button onClick={openCreateModal} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(139,92,246,0.3)' }}>
                    <Plus size={18} /> ปรับปรุงใหม่
                </button>
            </div>

            {/* Compact Summary */}
            <div style={{ display: 'flex', gap: '24px', marginBottom: '16px', fontSize: '13px', color: '#6b7280', flexWrap: 'wrap' }}>
                <span><strong style={{ color: '#7c3aed' }}>{adjDocs.length}</strong> เอกสาร</span>
                <span>รวม <strong style={{ color: '#374151' }}>{recentAdj.length}</strong> รายการเคลื่อนไหว</span>
            </div>

            {/* Recent adjustments table — grouped by document */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}><Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 8px' }} /> กำลังโหลด...</div>
                ) : adjDocs.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>ยังไม่มีรายการปรับปรุง</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc' }}>
                                    {['เลขเอกสาร', 'วัน/เวลา', 'คลัง', 'รายการ', 'เพิ่ม', 'ลด', 'ผู้ทำ', 'หมายเหตุ', 'จัดการ'].map(h => (
                                        <th key={h} style={{ padding: '12px 14px', textAlign: h === 'เพิ่ม' || h === 'ลด' ? 'right' : 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', borderBottom: '2px solid #e5e7eb', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {adjDocs.map((doc, idx) => {
                                    const totalIn = doc.items.filter(m => m.movement_type === 'ADJUST_IN').reduce((s: number, m: any) => s + Number(m.quantity), 0);
                                    const totalOut = doc.items.filter(m => m.movement_type === 'ADJUST_OUT').reduce((s: number, m: any) => s + Number(m.quantity), 0);
                                    return (
                                        <tr key={doc.doc_number} style={{ borderBottom: '1px solid #f3f4f6' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                                            onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                            <td style={{ padding: '12px 14px', fontWeight: 600, color: '#8b5cf6', fontSize: '13px' }}>{doc.doc_number}</td>
                                            <td style={{ padding: '12px 14px', fontSize: '12px', color: '#374151', whiteSpace: 'nowrap' }}>{new Date(doc.created_at).toLocaleString('th-TH')}</td>
                                            <td style={{ padding: '12px 14px', fontSize: '12px', color: '#374151' }}>{doc.warehouse_name}</td>
                                            <td style={{ padding: '12px 14px', fontSize: '12px', color: '#6b7280' }}>{doc.items.length} รายการ</td>
                                            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: totalIn > 0 ? '#16a34a' : '#d1d5db', fontSize: '13px' }}>
                                                {totalIn > 0 ? `+${totalIn.toLocaleString()}` : '—'}
                                            </td>
                                            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: totalOut > 0 ? '#dc2626' : '#d1d5db', fontSize: '13px' }}>
                                                {totalOut > 0 ? `-${totalOut.toLocaleString()}` : '—'}
                                            </td>
                                            <td style={{ padding: '12px 14px', fontSize: '12px', color: '#6b7280' }}>{doc.created_by_name}</td>
                                            <td style={{ padding: '12px 14px', fontSize: '12px', color: '#9ca3af', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.notes || '—'}</td>
                                            <td style={{ padding: '12px 14px' }}>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button onClick={() => setViewDoc(doc)} title="ดูรายละเอียด"
                                                        style={{ width: '30px', height: '30px', borderRadius: '6px', background: '#f0f9ff', border: '1px solid #bae6fd', cursor: 'pointer', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Eye size={14} />
                                                    </button>
                                                    <button onClick={() => handleDelete(doc.doc_number)} title="ลบเอกสาร"
                                                        disabled={deleting === doc.doc_number}
                                                        style={{ width: '30px', height: '30px', borderRadius: '6px', background: '#fef2f2', border: '1px solid #fecaca', cursor: deleting === doc.doc_number ? 'not-allowed' : 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        {deleting === doc.doc_number ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ═══════ View Detail Modal ═══════ */}
            {viewDoc && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '900px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
                        {/* Header */}
                        <div style={{ background: 'linear-gradient(135deg, #6d28d9 0%, #8b5cf6 50%, #a78bfa 100%)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Eye size={18} color="#fff" />
                                <div>
                                    <div style={{ color: '#fff', fontSize: '15px', fontWeight: 700 }}>รายละเอียดเอกสาร {viewDoc.doc_number}</div>
                                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px' }}>{new Date(viewDoc.created_at).toLocaleString('th-TH')} · {viewDoc.warehouse_name}</div>
                                </div>
                            </div>
                            <button onClick={() => setViewDoc(null)} style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={16} />
                            </button>
                        </div>
                        {/* Body */}
                        <div style={{ flex: 1, overflow: 'auto', padding: '0' }}>
                            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '24px', fontSize: '13px', color: '#6b7280' }}>
                                <span>ผู้ทำ: <strong style={{ color: '#374151' }}>{viewDoc.created_by_name}</strong></span>
                                {viewDoc.notes && <span>หมายเหตุ: <strong style={{ color: '#374151' }}>{viewDoc.notes}</strong></span>}
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc' }}>
                                        {['#', 'รหัสสินค้า', 'ชื่อสินค้า', 'Lot', 'ประเภท', 'จำนวน'].map(h => (
                                            <th key={h} style={{ padding: '10px 14px', textAlign: h === 'จำนวน' ? 'right' : 'left', fontSize: '11px', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {viewDoc.items.map((m: any, idx: number) => {
                                        const isIn = m.movement_type === 'ADJUST_IN';
                                        return (
                                            <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                <td style={{ padding: '10px 14px', color: '#9ca3af', fontSize: '12px', fontWeight: 600 }}>{idx + 1}</td>
                                                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600, fontSize: '12px', color: '#1e293b' }}>{m.product_sku || '—'}</td>
                                                <td style={{ padding: '10px 14px', color: '#374151' }}>{m.product_name}</td>
                                                <td style={{ padding: '10px 14px', color: '#6b7280', fontSize: '12px' }}>{m.lot_number || '—'}</td>
                                                <td style={{ padding: '10px 14px' }}>
                                                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: isIn ? '#d1fae5' : '#fee2e2', color: isIn ? '#059669' : '#dc2626' }}>
                                                        {isIn ? '+ เพิ่ม' : '- ลด'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: isIn ? '#059669' : '#dc2626', fontSize: '14px' }}>
                                                    {isIn ? '+' : '-'}{Number(m.quantity).toLocaleString()}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {/* Footer */}
                        <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: '#6b7280' }}>{viewDoc.items.length} รายการ</span>
                            <button onClick={() => setViewDoc(null)} style={{ padding: '8px 20px', background: '#fff', color: '#64748b', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>ปิด</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════ Create Adjustment Modal ═══════ */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
                    <div style={{ background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '1200px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>

                        {/* ── Header Bar ── */}
                        <div style={{ background: 'linear-gradient(135deg, #6d28d9 0%, #8b5cf6 50%, #a78bfa 100%)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Settings size={18} color="#fff" />
                                </div>
                                <div>
                                    <div style={{ color: '#fff', fontSize: '15px', fontWeight: 700, letterSpacing: '0.02em' }}>
                                        ปรับปรุงสต็อกใหม่
                                    </div>
                                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px' }}>Stock Adjustment Document</div>
                                </div>
                            </div>
                            <button onClick={() => setShowModal(false)} style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(239,68,68,0.8)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={16} />
                            </button>
                        </div>

                        {/* ── Scrollable Body ── */}
                        <div style={{ flex: 1, overflow: 'auto' }}>

                            {/* ── Form Grid ── */}
                            <div style={{ padding: '20px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 140px 1fr', gap: '0', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                                    <div style={{ padding: '10px 14px', background: '#f5f3ff', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#6d28d9', display: 'flex', alignItems: 'center' }}>คลังสินค้า</div>
                                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                                        <select value={formWarehouse} onChange={e => setFormWarehouse(Number(e.target.value))} style={selectStyle}>
                                            <option value={0}>— เลือกคลัง —</option>
                                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                        </select>
                                    </div>
                                    <div style={{ padding: '10px 14px', background: '#f5f3ff', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#6d28d9', display: 'flex', alignItems: 'center' }}>วันที่</div>
                                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', fontSize: '13px', color: '#374151' }}>
                                        {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                                    </div>
                                    <div style={{ padding: '10px 14px', background: '#f5f3ff', borderRight: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#6d28d9', display: 'flex', alignItems: 'center' }}>หมายเหตุ</div>
                                    <div style={{ padding: '10px 14px', gridColumn: 'span 3' }}>
                                        <input value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="ระบุหมายเหตุ (ถ้ามี)" style={inputStyle} />
                                    </div>
                                </div>
                            </div>

                            {/* ── Line Items Toolbar ── */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                                <button onClick={addItem} style={{ padding: '6px 14px', fontSize: '12px', background: '#fff', border: '1.5px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', color: '#334155', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <Plus size={13} /> เพิ่มรายการ
                                </button>
                                <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: 'auto' }}>{formItems.filter(i => i.product_id).length} รายการ</span>
                            </div>

                            {/* ── Line Items Table ── */}
                            <div style={{ padding: '0 20px' }}>
                                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, background: '#fff' }}>
                                    <thead>
                                        <tr>
                                            {[
                                                { label: 'No.', w: '44px', align: 'center' as const },
                                                { label: 'รหัสสินค้า', w: '22%' },
                                                { label: 'ชื่อสินค้า', w: '28%' },
                                                { label: 'Lot', w: '130px' },
                                                { label: 'เพิ่ม/ลด', w: '100px', align: 'center' as const },
                                                { label: 'จำนวน', w: '90px', align: 'right' as const },
                                                { label: 'หมายเหตุ' },
                                                { label: '', w: '44px', align: 'center' as const },
                                            ].map((col, i) => (
                                                <th key={i} style={{ padding: '10px 12px', textAlign: col.align || 'left', fontSize: '11px', fontWeight: 700, color: '#64748b', background: '#f1f5f9', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.04em', ...(col.w ? { width: col.w } : {}) }}>{col.label}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formItems.map((item, idx) => {
                                            const selectedProduct = products.find(p => p.id === item.product_id);
                                            return (
                                            <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                                                <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', color: '#94a3b8', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>{idx + 1}</td>
                                                <td style={{ padding: '8px 8px', borderBottom: '1px solid #f1f5f9' }}>
                                                    <ProductSearch products={products} value={item.product_id} onChange={id => updateItem(idx, 'product_id', id)} />
                                                </td>
                                                <td style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', fontSize: '13px', color: '#334155' }}>
                                                    {item.product_name || selectedProduct?.name || <span style={{ color: '#94a3b8' }}>—</span>}
                                                </td>
                                                <td style={{ padding: '8px 8px', borderBottom: '1px solid #f1f5f9', fontSize: '13px', color: item.lot_number ? '#334155' : '#94a3b8' }}>
                                                    {item.lot_number || '—'}
                                                </td>
                                                <td style={{ padding: '8px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>
                                                    <select value={item.adjust_type} onChange={e => updateItem(idx, 'adjust_type', e.target.value)} style={{ ...selectStyle, fontSize: '12px', padding: '5px 8px', background: item.adjust_type === 'add' ? '#f0fdf4' : '#fef2f2', color: item.adjust_type === 'add' ? '#16a34a' : '#dc2626', fontWeight: 600, textAlign: 'center' }}>
                                                        <option value="add">+ เพิ่ม</option>
                                                        <option value="reduce">- ลด</option>
                                                    </select>
                                                </td>
                                                <td style={{ padding: '8px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                                                    <input type="number" min={0} value={item.quantity || ''} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} style={{ ...inputStyle, fontSize: '13px', padding: '6px 10px', width: '90px', textAlign: 'right' }} />
                                                </td>
                                                <td style={{ padding: '8px 8px', borderBottom: '1px solid #f1f5f9' }}>
                                                    <input value={item.notes || ''} onChange={e => updateItem(idx, 'notes', e.target.value)} placeholder="—" style={{ ...inputStyle, fontSize: '13px', padding: '6px 10px' }} />
                                                </td>
                                                <td style={{ padding: '8px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>
                                                    <button onClick={() => removeItem(idx)} style={{ width: '26px', height: '26px', borderRadius: '6px', background: '#fef2f2', border: '1px solid #fecaca', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>✕</button>
                                                </td>
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ background: 'linear-gradient(90deg, #f5f3ff, #ede9fe)' }}>
                                            <td colSpan={5} style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#6d28d9', fontSize: '13px', borderTop: '2px solid #c4b5fd' }}>จำนวนรวม</td>
                                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, fontSize: '14px', borderTop: '2px solid #c4b5fd' }}>
                                                {totalAddQty > 0 && <span style={{ color: '#16a34a' }}>+{totalAddQty.toLocaleString()}</span>}
                                                {totalAddQty > 0 && totalReduceQty > 0 && <span style={{ color: '#94a3b8', margin: '0 4px' }}>/</span>}
                                                {totalReduceQty > 0 && <span style={{ color: '#dc2626' }}>-{totalReduceQty.toLocaleString()}</span>}
                                                {totalAddQty === 0 && totalReduceQty === 0 && <span style={{ color: '#94a3b8' }}>0</span>}
                                            </td>
                                            <td colSpan={2} style={{ padding: '12px', borderTop: '2px solid #c4b5fd' }}></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* ── Attachments ── */}
                            <div style={{ padding: '20px', borderTop: '1px solid #e2e8f0', marginTop: '8px' }}>
                                <p style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '12px' }}>📎 รูปภาพแนบ</p>
                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                    {formImages.map((img, idx) => (
                                        <div key={idx} style={{ position: 'relative', width: '90px', height: '90px', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                                            <img src={img.startsWith('data:') ? img : `/CRM_ERP_V4/api/${img}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            <button onClick={() => setFormImages(formImages.filter((_, i) => i !== idx))} style={{ position: 'absolute', top: '4px', right: '4px', width: '20px', height: '20px', background: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                        </div>
                                    ))}
                                    <label style={{ width: '90px', height: '90px', border: '2px dashed #cbd5e1', borderRadius: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94a3b8', gap: '4px', background: '#fafbfc' }}>
                                        <Camera size={22} /><span style={{ fontSize: '10px', fontWeight: 600 }}>เพิ่มรูป</span>
                                        <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: 'none' }} />
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* ── Bottom Bar with Save Button ── */}
                        <div style={{ padding: '12px 20px', background: 'linear-gradient(180deg, #f8fafc, #f1f5f9)', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>📄 เอกสารปรับปรุงใหม่</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                                    {formItems.filter(i => i.product_id).length} รายการ
                                    {totalAddQty > 0 && <>&nbsp;|&nbsp; <span style={{ color: '#16a34a' }}>+{totalAddQty.toLocaleString()}</span></>}
                                    {totalReduceQty > 0 && <>&nbsp;|&nbsp; <span style={{ color: '#dc2626' }}>-{totalReduceQty.toLocaleString()}</span></>}
                                </span>
                                <button onClick={() => setShowModal(false)} style={{ padding: '8px 20px', background: '#fff', color: '#64748b', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>ยกเลิก</button>
                                <button onClick={handleSave} disabled={saving} style={{ padding: '8px 24px', background: saving ? '#c4b5fd' : 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    {saving ? 'กำลังบันทึก...' : 'บันทึกปรับปรุง'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inv2AdjustmentPage;
