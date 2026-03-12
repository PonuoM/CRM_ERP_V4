import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Package, Plus, Search, Eye, Trash2, X, Camera, Loader2, Save, ChevronDown } from 'lucide-react';
import { Warehouse, Product, Inv2StockOrder, Inv2StockOrderItem, Inv2SOStatus } from '../types';
import { inv2ListSO, inv2GetSO, inv2SaveSO, inv2DeleteSO, listWarehouses, listProducts } from '../services/api';

interface Inv2StockOrderPageProps { companyId: number; userId: number; }

const STATUS_COLORS: Record<Inv2SOStatus, string> = {
    Draft: 'bg-gray-100 text-gray-700', Ordered: 'bg-blue-100 text-blue-700',
    Partial: 'bg-yellow-100 text-yellow-700', Completed: 'bg-green-100 text-green-700',
    Cancelled: 'bg-red-100 text-red-700',
};
const STATUS_LABELS: Record<Inv2SOStatus, string> = {
    Draft: 'ร่าง', Ordered: 'สั่งแล้ว', Partial: 'รับบางส่วน', Completed: 'รับครบ', Cancelled: 'ยกเลิก',
};
const STATUS_DOT: Record<Inv2SOStatus, string> = {
    Draft: '#94a3b8', Ordered: '#3b82f6', Partial: '#f59e0b', Completed: '#22c55e', Cancelled: '#ef4444',
};

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
                                style={{ width: '100%', padding: '8px 12px', border: 'none', background: p.id === value ? '#eff6ff' : '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.1s' }}
                                onMouseEnter={e => { if (p.id !== value) e.currentTarget.style.background = '#f8fafc'; }}
                                onMouseLeave={e => { if (p.id !== value) e.currentTarget.style.background = '#fff'; }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: p.id === value ? '#3b82f6' : '#e2e8f0', flexShrink: 0 }} />
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

/* ═══════ Department ComboBox (ฝ่ายผลิต) ═══════ */
const DEPT_STORAGE_KEY = 'inv2_so_departments';

const DepartmentComboBox: React.FC<{
    value: string;
    onChange: (val: string) => void;
}> = ({ value, onChange }) => {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    // Load saved departments from localStorage
    const getSavedDepts = (): string[] => {
        try {
            const raw = localStorage.getItem(DEPT_STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    };

    const saveDept = (dept: string) => {
        if (!dept.trim()) return;
        const existing = getSavedDepts();
        if (!existing.includes(dept.trim())) {
            const updated = [dept.trim(), ...existing].slice(0, 50);
            localStorage.setItem(DEPT_STORAGE_KEY, JSON.stringify(updated));
        }
    };

    useEffect(() => {
        const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const savedDepts = getSavedDepts();
    const filtered = q ? savedDepts.filter(d => d.toLowerCase().includes(q.toLowerCase())) : savedDepts;

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <input
                value={value || ''}
                onChange={e => { onChange(e.target.value); setQ(e.target.value); }}
                onFocus={() => setOpen(true)}
                onBlur={() => {
                    // Save department value when field loses focus
                    if (value?.trim()) saveDept(value.trim());
                }}
                placeholder="พิมพ์หรือเลือก..."
                style={{ ...inputStyle, fontSize: '12px', padding: '5px 8px' }}
            />
            {open && filtered.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#fff', borderRadius: '8px', border: '1.5px solid #e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, maxHeight: '160px', overflow: 'auto' }}>
                    {filtered.map((d, i) => (
                        <button key={i} type="button"
                            onMouseDown={e => { e.preventDefault(); onChange(d); setOpen(false); }}
                            style={{ width: '100%', padding: '6px 12px', border: 'none', background: d === value ? '#eff6ff' : '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '12px', color: '#334155', transition: 'background 0.1s' }}
                            onMouseEnter={e => { if (d !== value) e.currentTarget.style.background = '#f8fafc'; }}
                            onMouseLeave={e => { if (d !== value) e.currentTarget.style.background = '#fff'; }}>
                            {d}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const Inv2StockOrderPage: React.FC<Inv2StockOrderPageProps> = ({ companyId, userId }) => {
    const [orders, setOrders] = useState<Inv2StockOrder[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingOrder, setEditingOrder] = useState<any>(null);
    const [saving, setSaving] = useState(false);

    const [formSONumber, setFormSONumber] = useState('');
    const [formWarehouse, setFormWarehouse] = useState<number>(0);
    const [formOrderDate, setFormOrderDate] = useState(new Date().toISOString().slice(0, 10));
    const [formExpectedDate, setFormExpectedDate] = useState('');
    const [formStatus, setFormStatus] = useState<Inv2SOStatus>('Ordered');
    const [formNotes, setFormNotes] = useState('');
    const [formImages, setFormImages] = useState<string[]>([]);
    const [formItems, setFormItems] = useState<Inv2StockOrderItem[]>([]);
    // New fields
    const [formSourceLocation, setFormSourceLocation] = useState('');
    const [formCustomerVendor, setFormCustomerVendor] = useState('');
    const [formDeliveryLocation, setFormDeliveryLocation] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [soRes, whRes, pRes] = await Promise.all([
                inv2ListSO({ company_id: companyId, search: search || undefined }),
                listWarehouses(companyId), listProducts(companyId),
            ]);
            setOrders(soRes?.data || []);
            setWarehouses(Array.isArray(whRes) ? whRes : whRes?.data || []);
            setProducts(Array.isArray(pRes) ? pRes : pRes?.data || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    }, [companyId, search]);

    useEffect(() => { loadData(); }, [loadData]);

    const filteredOrders = statusFilter ? orders.filter(o => o.status === statusFilter) : orders;

    const openCreateModal = () => {
        setEditingOrder(null); setFormSONumber(''); setFormWarehouse(warehouses[0]?.id || 0);
        setFormOrderDate(new Date().toISOString().slice(0, 10)); setFormExpectedDate('');
        setFormStatus('Ordered'); setFormNotes(''); setFormImages([]);
        setFormSourceLocation(''); setFormCustomerVendor(''); setFormDeliveryLocation('');
        setFormItems([{ product_id: 0, variant: '', quantity: 0, received_quantity: 0, unit_cost: undefined, notes: '', department: '', delivery_date: '' }]);
        setShowModal(true);
    };

    const openEditModal = async (so: Inv2StockOrder) => {
        try {
            const res = await inv2GetSO(so.id);
            if (res?.success && res.data) {
                const h = res.data.header;
                setEditingOrder(h); setFormSONumber(h.so_number || ''); setFormWarehouse(h.warehouse_id);
                setFormOrderDate(h.order_date); setFormExpectedDate(h.expected_date || '');
                setFormStatus(h.status); setFormNotes(h.notes || ''); setFormImages(h.images || []);
                setFormSourceLocation(h.source_location || '');
                setFormCustomerVendor(h.customer_vendor || '');
                setFormDeliveryLocation(h.delivery_location || '');
                setFormItems(res.data.items.length > 0 ? res.data.items : [{ product_id: 0, variant: '', quantity: 0, received_quantity: 0, unit_cost: undefined, notes: '', department: '', delivery_date: '' }]);
                setShowModal(true);
            }
        } catch { alert('โหลดข้อมูล SO ไม่สำเร็จ'); }
    };

    const handleSave = async () => {
        const validItems = formItems.filter(i => i.product_id && i.quantity > 0);
        if (validItems.length === 0) return alert('เพิ่มรายการสินค้าอย่างน้อย 1 รายการ');
        setSaving(true);
        try {
            await inv2SaveSO({
                id: editingOrder?.id || undefined,
                so_number: formSONumber || undefined,
                warehouse_id: formWarehouse || warehouses[0]?.id || 0,
                order_date: formOrderDate,
                expected_date: formExpectedDate || null,
                status: formStatus,
                notes: formNotes || null,
                images: formImages,
                items: validItems,
                user_id: userId,
                company_id: companyId,
                source_location: formSourceLocation || null,
                customer_vendor: formCustomerVendor || null,
                delivery_location: formDeliveryLocation || null,
            });
            setShowModal(false); loadData();
        } catch (e: any) { alert('บันทึกไม่สำเร็จ: ' + (e?.message || '')); }
        setSaving(false);
    };

    const handleDelete = async (so: Inv2StockOrder) => {
        if (!confirm(`ลบ SO ${so.so_number}?`)) return;
        try { await inv2DeleteSO(so.id); loadData(); } catch (e: any) { alert('ลบไม่ได้: ' + (e?.data?.error || e?.message || '')); }
    };

    const addItem = () => setFormItems([...formItems, { product_id: 0, variant: '', quantity: 0, received_quantity: 0, unit_cost: undefined, notes: '', department: '', delivery_date: formExpectedDate || '' }]);
    const removeItem = (idx: number) => setFormItems(formItems.filter((_, i) => i !== idx));
    const updateItem = (idx: number, field: string, value: any) => setFormItems(formItems.map((item, i) => i === idx ? { ...item, [field]: value } : item));

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

    return (
        <div style={{ padding: '24px' }}>
            {/* Page Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
                        <Package size={28} style={{ verticalAlign: 'middle', marginRight: '8px', color: '#6366f1' }} />คำสั่งซื้อสินค้า (SO)
                    </h1>
                    <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: '14px' }}>จัดการคำสั่งซื้อสินค้าเข้าคลัง</p>
                </div>
                <button onClick={openCreateModal} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}>
                    <Plus size={18} /> สร้าง SO ใหม่
                </button>
            </div>

            {/* Status Tabs */}
            <div style={{ display: 'flex', gap: '0', marginBottom: '16px', background: '#f1f5f9', borderRadius: '10px', padding: '4px', overflow: 'hidden' }}>
                {([
                    { key: '', label: 'ทั้งหมด', color: '#6b7280' },
                    { key: 'Ordered', label: 'รอรับเข้า', color: '#3b82f6' },
                    { key: 'Partial', label: 'รับบางส่วน', color: '#f59e0b' },
                    { key: 'Completed', label: 'รับครบแล้ว', color: '#22c55e' },
                ] as const).map(tab => {
                    const isActive = statusFilter === tab.key;
                    const count = tab.key ? orders.filter(o => o.status === tab.key).length : orders.length;
                    return (
                        <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
                            style={{ flex: 1, padding: '10px 16px', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                background: isActive ? '#fff' : 'transparent',
                                color: isActive ? tab.color || '#374151' : '#94a3b8',
                                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            }}>
                            {isActive && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: tab.color }}></span>}
                            {tab.label}
                            <span style={{ padding: '1px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, background: isActive ? `${tab.color}18` : '#e2e8f0', color: isActive ? tab.color : '#94a3b8' }}>{count}</span>
                        </button>
                    );
                })}
            </div>

            {/* Search */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <div style={{ position: 'relative', flex: '1 1 300px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input placeholder="ค้นหา SO..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }} />
                </div>
            </div>

            {/* List Table */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}><Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 8px' }} /> กำลังโหลด...</div>
                ) : filteredOrders.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>ไม่พบรายการ SO</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr style={{ background: '#f8fafc' }}>
                            {['เลขที่ SO', 'จากสถานที่ผลิต', 'ลูกค้า/ผู้ขาย', 'วันที่สั่ง', 'วันที่ส่งมอบ', 'สถานะ', 'รายการ', ''].map(h => (
                                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase' }}>{h}</th>
                            ))}
                        </tr></thead>
                        <tbody>
                            {filteredOrders.map(so => (
                                <tr key={so.id} style={{ borderBottom: '1px solid #f3f4f6' }} onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1a1a2e', fontSize: '14px' }}>{so.so_number}</td>
                                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#374151' }}>{so.source_location || '—'}</td>
                                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#374151' }}>{so.customer_vendor || '—'}</td>
                                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#374151' }}>{so.order_date}</td>
                                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>{so.expected_date || '—'}</td>
                                    <td style={{ padding: '12px 16px' }}><span className={STATUS_COLORS[so.status]} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>{STATUS_LABELS[so.status]}</span></td>
                                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6b7280' }}>{so.item_count || 0} รายการ</td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => openEditModal(so)} style={{ padding: '6px', background: '#ede9fe', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#7c3aed' }}><Eye size={16} /></button>
                                            <button onClick={() => handleDelete(so)} style={{ padding: '6px', background: '#fee2e2', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ═══════ Modern ERP Document Modal (Single Page) ═══════ */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
                    <div style={{ background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '1060px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>

                        {/* ── Header Bar ── */}
                        <div style={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #6366f1 100%)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Package size={18} color="#fff" />
                                </div>
                                <div>
                                    <div style={{ color: '#fff', fontSize: '15px', fontWeight: 700, letterSpacing: '0.02em' }}>
                                        {editingOrder ? editingOrder.so_number : 'สร้างคำสั่งซื้อใหม่'}
                                    </div>
                                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px' }}>Stock Order Document</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {/* Status pill */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.15)', borderRadius: '20px', padding: '5px 14px 5px 10px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: STATUS_DOT[formStatus], boxShadow: `0 0 6px ${STATUS_DOT[formStatus]}` }} />
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>{STATUS_LABELS[formStatus]}</span>
                                </div>
                                {/* Close */}
                                <button onClick={() => setShowModal(false)} style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(239,68,68,0.8)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* ── Scrollable Body (single page — no tabs) ── */}
                        <div style={{ flex: 1, overflow: 'auto' }}>

                            {/* ── Form Grid ── */}
                            <div style={{ padding: '20px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 140px 1fr', gap: '0', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                                    {/* Row 1 */}
                                    <div style={{ padding: '10px 14px', background: '#f0f9ff', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#1e40af', display: 'flex', alignItems: 'center' }}>เลขที่ SO</div>
                                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                                        <input value={formSONumber} onChange={e => setFormSONumber(e.target.value)} placeholder="Auto (ถ้าไม่ระบุ)" style={inputStyle} />
                                    </div>
                                    <div style={{ padding: '10px 14px', background: '#f0f9ff', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#1e40af', display: 'flex', alignItems: 'center' }}>จากสถานที่ผลิต</div>
                                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0' }}>
                                        <input value={formSourceLocation} onChange={e => setFormSourceLocation(e.target.value)} placeholder="ระบุสถานที่ผลิต" style={inputStyle} />
                                    </div>
                                    {/* Row 2 */}
                                    <div style={{ padding: '10px 14px', background: '#f0f9ff', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#1e40af', display: 'flex', alignItems: 'center' }}>ลูกค้า/ผู้ขาย</div>
                                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                                        <input value={formCustomerVendor} onChange={e => setFormCustomerVendor(e.target.value)} placeholder="ระบุลูกค้าหรือผู้ขาย" style={inputStyle} />
                                    </div>
                                    <div style={{ padding: '10px 14px', background: '#f0f9ff', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#1e40af', display: 'flex', alignItems: 'center' }}>วันที่สั่ง</div>
                                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0' }}>
                                        <input type="date" value={formOrderDate} onChange={e => setFormOrderDate(e.target.value)} style={inputStyle} />
                                    </div>
                                    {/* Row 3 */}
                                    <div style={{ padding: '10px 14px', background: '#f0f9ff', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#1e40af', display: 'flex', alignItems: 'center' }}>วันที่ส่งมอบ</div>
                                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                                        <input type="date" value={formExpectedDate} onChange={e => setFormExpectedDate(e.target.value)} style={inputStyle} />
                                    </div>
                                    <div style={{ padding: '10px 14px', background: '#f0f9ff', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#1e40af', display: 'flex', alignItems: 'center' }}>สถานที่จัดส่ง</div>
                                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0' }}>
                                        <input value={formDeliveryLocation} onChange={e => setFormDeliveryLocation(e.target.value)} placeholder="ระบุสถานที่จัดส่ง" style={inputStyle} />
                                    </div>
                                    {/* Row 4 */}
                                    <div style={{ padding: '10px 14px', background: '#f0f9ff', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#1e40af', display: 'flex', alignItems: 'center' }}>คลังสินค้า</div>
                                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                                        <select value={formWarehouse} onChange={e => setFormWarehouse(Number(e.target.value))} style={selectStyle}>
                                            <option value={0}>— เลือกคลัง —</option>
                                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                        </select>
                                    </div>
                                    <div style={{ padding: '10px 14px', background: '#f0f9ff', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#1e40af', display: 'flex', alignItems: 'center' }}>สถานะ</div>
                                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: STATUS_DOT[formStatus] }} />
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>{STATUS_LABELS[formStatus]}</span>
                                    </div>
                                    {/* Row 5 */}
                                    <div style={{ padding: '10px 14px', background: '#f0f9ff', borderRight: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#1e40af', display: 'flex', alignItems: 'center' }}>หมายเหตุ</div>
                                    <div style={{ padding: '10px 14px' }} className="col-span-3">
                                        <input value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="—" style={inputStyle} />
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
                                                { label: 'ชื่อสินค้า', w: '20%' },
                                                { label: 'จำนวน', w: '80px', align: 'right' as const },
                                                { label: 'ฝ่ายผลิต', w: '18%' },
                                                { label: 'วันที่ส่งมอบ', w: '130px' },
                                                { label: 'หมายเหตุ' },
                                                { label: '', w: '40px', align: 'center' as const },
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
                                                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', fontSize: '12px', color: '#334155' }}>
                                                        {selectedProduct ? selectedProduct.name : <span style={{ color: '#94a3b8' }}>—</span>}
                                                    </td>
                                                    <td style={{ padding: '8px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                                                        <input type="number" min={0} value={item.quantity || ''} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} style={{ ...inputStyle, fontSize: '12px', padding: '5px 8px', width: '80px', textAlign: 'right' }} />
                                                    </td>
                                                    <td style={{ padding: '8px 8px', borderBottom: '1px solid #f1f5f9' }}>
                                                        <DepartmentComboBox value={item.department || ''} onChange={val => updateItem(idx, 'department', val)} />
                                                    </td>
                                                    <td style={{ padding: '8px 8px', borderBottom: '1px solid #f1f5f9' }}>
                                                        <input type="date" value={item.delivery_date || formExpectedDate || ''} onChange={e => updateItem(idx, 'delivery_date', e.target.value)} style={{ ...inputStyle, fontSize: '12px', padding: '5px 8px' }} />
                                                    </td>
                                                    <td style={{ padding: '8px 8px', borderBottom: '1px solid #f1f5f9' }}>
                                                        <input value={item.notes || ''} onChange={e => updateItem(idx, 'notes', e.target.value)} placeholder="—" style={{ ...inputStyle, fontSize: '12px', padding: '5px 8px' }} />
                                                    </td>
                                                    <td style={{ padding: '8px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>
                                                        <button onClick={() => removeItem(idx)} style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#fef2f2', border: '1px solid #fecaca', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>✕</button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ background: 'linear-gradient(90deg, #f0f9ff, #eff6ff)' }}>
                                            <td colSpan={3} style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#1e40af', fontSize: '13px', borderTop: '2px solid #bfdbfe' }}>จำนวนรวม</td>
                                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#1e40af', fontSize: '14px', borderTop: '2px solid #bfdbfe' }}>{totalQty.toLocaleString('th-TH')}</td>
                                            <td colSpan={4} style={{ padding: '12px', borderTop: '2px solid #bfdbfe' }}></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* ── Attachments (inline, no tab) ── */}
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
                            <span style={{ fontSize: '12px', color: '#64748b' }}>{editingOrder ? `สร้างเมื่อ: ${editingOrder.created_at}` : '📄 เอกสารใหม่'}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                                    {formItems.filter(i => i.product_id).length} รายการ &nbsp;|&nbsp; {totalQty.toLocaleString()} ชิ้น
                                </span>
                                <button onClick={() => setShowModal(false)} style={{ padding: '8px 20px', background: '#fff', color: '#64748b', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>ยกเลิก</button>
                                <button onClick={handleSave} disabled={saving} style={{ padding: '8px 24px', background: saving ? '#93c5fd' : 'linear-gradient(135deg, #3b82f6, #6366f1)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inv2StockOrderPage;
