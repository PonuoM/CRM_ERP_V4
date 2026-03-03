import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowDownToLine, Plus, Search, X, Camera, Loader2, Save, ChevronDown } from 'lucide-react';
import { Warehouse, Product, Inv2StockOrder, Inv2ReceiveDocument } from '../types';
import { inv2ListReceive, inv2SaveReceive, inv2ListSO, inv2GetSO, listWarehouses, listProducts } from '../services/api';

interface Inv2ReceivePageProps { companyId: number; userId: number; }

interface ReceiveFormItem {
    so_item_id?: number;
    product_id: number;
    product_name?: string;
    variant?: string;
    lot_number?: string;
    quantity: number;
    max_quantity?: number;
    unit_cost?: number;
    mfg_date?: string;
    exp_date?: string;
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
                    {selected ? `${selected.name} (${selected.sku})` : '— เลือกสินค้า —'}
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
                                style={{ width: '100%', padding: '8px 12px', border: 'none', background: p.id === value ? '#ecfdf5' : '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.1s' }}
                                onMouseEnter={e => { if (p.id !== value) e.currentTarget.style.background = '#f8fafc'; }}
                                onMouseLeave={e => { if (p.id !== value) e.currentTarget.style.background = '#fff'; }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: p.id === value ? '#10b981' : '#e2e8f0', flexShrink: 0 }} />
                                <div>
                                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{p.name}</div>
                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{p.sku}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const Inv2ReceivePage: React.FC<Inv2ReceivePageProps> = ({ companyId, userId }) => {
    const [documents, setDocuments] = useState<Inv2ReceiveDocument[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);

    const [soList, setSoList] = useState<Inv2StockOrder[]>([]);
    const [selectedSOId, setSelectedSOId] = useState<number | null>(null);
    const [formWarehouse, setFormWarehouse] = useState<number>(0);
    const [formReceiveDate, setFormReceiveDate] = useState(new Date().toISOString().slice(0, 10));
    const [formNotes, setFormNotes] = useState('');
    const [formImages, setFormImages] = useState<string[]>([]);
    const [formItems, setFormItems] = useState<ReceiveFormItem[]>([]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [rcvRes, whRes, pRes] = await Promise.all([
                inv2ListReceive({ company_id: companyId, search: search || undefined }),
                listWarehouses(companyId), listProducts(companyId),
            ]);
            setDocuments(rcvRes?.data || []);
            setWarehouses(Array.isArray(whRes) ? whRes : whRes?.data || []);
            setProducts(Array.isArray(pRes) ? pRes : pRes?.data || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    }, [companyId, search]);

    useEffect(() => { loadData(); }, [loadData]);

    const openCreateModal = async () => {
        setSelectedSOId(null); setFormWarehouse(warehouses[0]?.id || 0);
        setFormReceiveDate(new Date().toISOString().slice(0, 10));
        setFormNotes(''); setFormImages([]); setFormItems([]);
        try {
            const res = await inv2ListSO({ company_id: companyId, pageSize: 100 });
            setSoList((res?.data || []).filter((s: Inv2StockOrder) => !['Completed', 'Cancelled'].includes(s.status)));
        } catch { setSoList([]); }
        setShowModal(true);
    };

    const handleSelectSO = async (soId: number) => {
        setSelectedSOId(soId);
        try {
            const res = await inv2GetSO(soId);
            if (res?.success && res.data) {
                setFormWarehouse(res.data.header.warehouse_id);
                setFormItems(res.data.items
                    .filter((i: any) => (i.remaining_quantity || 0) > 0)
                    .map((i: any) => ({
                        so_item_id: i.id, product_id: i.product_id,
                        product_name: i.product_name || products.find(p => p.id === i.product_id)?.name || '',
                        variant: i.variant || '', lot_number: '', quantity: i.remaining_quantity || 0,
                        max_quantity: i.remaining_quantity || 0,
                        unit_cost: i.unit_cost ? Number(i.unit_cost) : undefined,
                        mfg_date: '', exp_date: '', notes: '',
                    })));
            }
        } catch { }
    };

    const addManualItem = () => setFormItems([...formItems, { product_id: 0, variant: '', lot_number: '', quantity: 0, unit_cost: undefined, mfg_date: '', exp_date: '', notes: '' }]);
    const updateItem = (idx: number, field: string, value: any) => setFormItems(formItems.map((item, i) => i === idx ? { ...item, [field]: value } : item));
    const removeItem = (idx: number) => setFormItems(formItems.filter((_, i) => i !== idx));

    const handleSave = async () => {
        if (!formWarehouse) return alert('เลือกคลังสินค้า');
        const validItems = formItems.filter(i => i.product_id && i.quantity > 0);
        if (validItems.length === 0) return alert('เพิ่มรายการอย่างน้อย 1 รายการ');
        setSaving(true);
        try {
            await inv2SaveReceive({ stock_order_id: selectedSOId || null, warehouse_id: formWarehouse, receive_date: formReceiveDate, notes: formNotes || null, images: formImages, items: validItems, user_id: userId, company_id: companyId });
            setShowModal(false); loadData();
        } catch (e: any) { alert('บันทึกไม่สำเร็จ: ' + (e?.message || '')); }
        setSaving(false);
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

    const totalQty = formItems.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
    const selectedSO = soList.find(s => s.id === selectedSOId);

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Page Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
                        <ArrowDownToLine size={28} style={{ verticalAlign: 'middle', marginRight: '8px', color: '#10b981' }} />รับสินค้าเข้า
                    </h1>
                    <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: '14px' }}>รับสินค้าเข้าคลังจาก SO หรือรับตรง</p>
                </div>
                <button onClick={openCreateModal} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.3)' }}>
                    <Plus size={18} /> รับเข้าใหม่
                </button>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '20px', maxWidth: '400px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input placeholder="ค้นหาเลขเอกสาร, SO..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }} />
            </div>

            {/* List Table */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}><Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 8px' }} /> กำลังโหลด...</div>
                ) : documents.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>ไม่พบรายการรับเข้า</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr style={{ background: '#f8fafc' }}>
                            {['เลขที่เอกสาร', 'อ้างอิง SO', 'คลัง', 'วันที่รับ', 'รายการ', 'จำนวน', 'ผู้ทำรายการ', 'หมายเหตุ'].map(h => (
                                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase' }}>{h}</th>
                            ))}
                        </tr></thead>
                        <tbody>
                            {documents.map(doc => (
                                <tr key={doc.id} style={{ borderBottom: '1px solid #f3f4f6' }} onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1a1a2e', fontSize: '14px' }}>{doc.doc_number}</td>
                                    <td style={{ padding: '12px 16px', fontSize: '13px', color: doc.so_number ? '#6366f1' : '#9ca3af' }}>{doc.so_number || '—'}</td>
                                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#374151' }}>{doc.warehouse_name}</td>
                                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#374151' }}>{doc.receive_date}</td>
                                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>{doc.item_count || 0}</td>
                                    <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: '#10b981' }}>{doc.total_quantity || 0}</td>
                                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{doc.created_by_name || '—'}</td>
                                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#9ca3af', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.notes || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ═══════ Modern ERP Document Modal ═══════ */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
                    <div style={{ background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '1100px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>

                        {/* ── Header Bar ── */}
                        <div style={{ background: 'linear-gradient(135deg, #047857 0%, #10b981 50%, #34d399 100%)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <ArrowDownToLine size={18} color="#fff" />
                                </div>
                                <div>
                                    <div style={{ color: '#fff', fontSize: '15px', fontWeight: 700, letterSpacing: '0.02em' }}>รับสินค้าเข้าใหม่</div>
                                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px' }}>Receive Document</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {selectedSO && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.15)', borderRadius: '20px', padding: '5px 14px 5px 10px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fbbf24', boxShadow: '0 0 6px #fbbf24' }} />
                                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>อ้างอิง: {selectedSO.so_number}</span>
                                    </div>
                                )}
                                <button onClick={() => setShowModal(false)} style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(239,68,68,0.8)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* ── Scrollable Body ── */}
                        <div style={{ flex: 1, overflow: 'auto' }}>

                            {/* ── SO Reference Selector ── */}
                            <div style={{ padding: '16px 20px', background: '#f0fdf4', borderBottom: '1px solid #d1fae5' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#166534', whiteSpace: 'nowrap' }}>อ้างอิง SO:</span>
                                    <select value={selectedSOId || ''} onChange={e => e.target.value ? handleSelectSO(Number(e.target.value)) : setSelectedSOId(null)} style={{ ...selectStyle, borderColor: '#86efac', flex: 1, maxWidth: '500px' }}>
                                        <option value="">— ไม่อ้างอิง SO (รับตรง) —</option>
                                        {soList.map(so => (
                                            <option key={so.id} value={so.id}>{so.so_number} — {so.warehouse_name} ({so.status === 'Partial' ? 'รับบางส่วน' : 'สั่งแล้ว'})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* ── Form Grid ── */}
                            <div style={{ padding: '20px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 140px 1fr', gap: '0', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                                    {/* Row 1 */}
                                    <div style={{ padding: '10px 14px', background: '#ecfdf5', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#047857', display: 'flex', alignItems: 'center' }}>เลขที่เอกสาร</div>
                                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', display: 'flex', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 700, color: '#10b981', fontSize: '14px' }}>(Auto)</span>
                                    </div>
                                    <div style={{ padding: '10px 14px', background: '#ecfdf5', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#047857', display: 'flex', alignItems: 'center' }}>คลังสินค้า</div>
                                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0' }}>
                                        <select value={formWarehouse} onChange={e => setFormWarehouse(Number(e.target.value))} style={selectStyle}>
                                            <option value={0}>— เลือกคลัง —</option>
                                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                        </select>
                                    </div>
                                    {/* Row 2 */}
                                    <div style={{ padding: '10px 14px', background: '#ecfdf5', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#047857', display: 'flex', alignItems: 'center' }}>วันที่รับ</div>
                                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                                        <input type="date" value={formReceiveDate} onChange={e => setFormReceiveDate(e.target.value)} style={inputStyle} />
                                    </div>
                                    <div style={{ padding: '10px 14px', background: '#ecfdf5', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#047857', display: 'flex', alignItems: 'center' }}>อ้างอิง SO</div>
                                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: selectedSO ? '#6366f1' : '#94a3b8' }}>{selectedSO?.so_number || 'ไม่มี'}</span>
                                    </div>
                                    {/* Row 3 */}
                                    <div style={{ padding: '10px 14px', background: '#ecfdf5', borderRight: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#047857', display: 'flex', alignItems: 'center' }}>หมายเหตุ</div>
                                    <div style={{ padding: '10px 14px', gridColumn: 'span 3' }}>
                                        <input value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="—" style={inputStyle} />
                                    </div>
                                </div>
                            </div>

                            {/* ── Line Items Toolbar ── */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                                <button onClick={addManualItem} style={{ padding: '6px 14px', fontSize: '12px', background: '#fff', border: '1.5px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', color: '#334155', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
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
                                                { label: 'No.', w: '40px', align: 'center' as const },
                                                { label: 'สินค้า', w: '22%' },
                                                { label: 'รุ่น' },
                                                { label: 'Lot' },
                                                { label: 'จำนวน', align: 'right' as const },
                                                { label: 'Max', w: '60px', align: 'right' as const },
                                                { label: 'วันผลิต' },
                                                { label: 'วันหมดอายุ' },
                                                { label: '', w: '40px', align: 'center' as const },
                                            ].map((col, i) => (
                                                <th key={i} style={{ padding: '10px 10px', textAlign: col.align || 'left', fontSize: '11px', fontWeight: 700, color: '#64748b', background: '#f1f5f9', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.04em', ...(col.w ? { width: col.w } : {}) }}>{col.label}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formItems.length === 0 ? (
                                            <tr><td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>เลือก SO ด้านบนเพื่อดึงรายการ หรือเพิ่มรายการเอง</td></tr>
                                        ) : formItems.map((item, idx) => (
                                            <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                                                <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: '12px', color: '#94a3b8', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>{idx + 1}</td>
                                                <td style={{ padding: '8px 6px', borderBottom: '1px solid #f1f5f9' }}>
                                                    {item.product_name && item.so_item_id ? (
                                                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>{item.product_name}</span>
                                                    ) : (
                                                        <ProductSearch products={products} value={item.product_id} onChange={id => updateItem(idx, 'product_id', id)} />
                                                    )}
                                                </td>
                                                <td style={{ padding: '8px 6px', borderBottom: '1px solid #f1f5f9' }}>
                                                    <input value={item.variant || ''} onChange={e => updateItem(idx, 'variant', e.target.value)} placeholder="—" style={{ ...inputStyle, fontSize: '12px', padding: '5px 8px' }} />
                                                </td>
                                                <td style={{ padding: '8px 6px', borderBottom: '1px solid #f1f5f9' }}>
                                                    <input value={item.lot_number || ''} onChange={e => updateItem(idx, 'lot_number', e.target.value)} placeholder="—" style={{ ...inputStyle, fontSize: '12px', padding: '5px 8px' }} />
                                                </td>
                                                <td style={{ padding: '8px 6px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                                                    <input type="number" min={0} max={item.max_quantity || undefined} value={item.quantity || ''} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} style={{ ...inputStyle, fontSize: '12px', padding: '5px 8px', width: '80px', textAlign: 'right' }} />
                                                </td>
                                                <td style={{ padding: '8px 6px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: item.max_quantity ? '#10b981' : '#cbd5e1' }}>{item.max_quantity || '—'}</td>
                                                <td style={{ padding: '8px 6px', borderBottom: '1px solid #f1f5f9' }}>
                                                    <input type="date" value={item.mfg_date || ''} onChange={e => updateItem(idx, 'mfg_date', e.target.value)} style={{ ...inputStyle, fontSize: '12px', padding: '5px 8px' }} />
                                                </td>
                                                <td style={{ padding: '8px 6px', borderBottom: '1px solid #f1f5f9' }}>
                                                    <input type="date" value={item.exp_date || ''} onChange={e => updateItem(idx, 'exp_date', e.target.value)} style={{ ...inputStyle, fontSize: '12px', padding: '5px 8px' }} />
                                                </td>
                                                <td style={{ padding: '8px 6px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>
                                                    <button onClick={() => removeItem(idx)} style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#fef2f2', border: '1px solid #fecaca', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>✕</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    {formItems.length > 0 && (
                                        <tfoot>
                                            <tr style={{ background: 'linear-gradient(90deg, #ecfdf5, #f0fdf4)' }}>
                                                <td colSpan={4} style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700, color: '#047857', fontSize: '13px', borderTop: '2px solid #a7f3d0' }}>จำนวนรวม</td>
                                                <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700, color: '#047857', fontSize: '14px', borderTop: '2px solid #a7f3d0' }}>{totalQty.toLocaleString()}</td>
                                                <td colSpan={4} style={{ padding: '12px', borderTop: '2px solid #a7f3d0' }}></td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>

                            {/* ── Attachments (inline) ── */}
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

                        {/* ── Bottom Bar with Save ── */}
                        <div style={{ padding: '12px 20px', background: 'linear-gradient(180deg, #f8fafc, #f1f5f9)', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>📄 เอกสารรับเข้าใหม่</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                                    {formItems.filter(i => i.product_id).length} รายการ &nbsp;|&nbsp; รวม {totalQty.toLocaleString()} ชิ้น
                                </span>
                                <button onClick={() => setShowModal(false)} style={{ padding: '8px 20px', background: '#fff', color: '#64748b', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>ยกเลิก</button>
                                <button onClick={handleSave} disabled={saving} style={{ padding: '8px 24px', background: saving ? '#6ee7b7' : 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    {saving ? 'กำลังบันทึก...' : 'บันทึกรับเข้า'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inv2ReceivePage;
