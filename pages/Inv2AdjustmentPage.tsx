import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Plus, Search, X, Camera, Loader2, Trash2 } from 'lucide-react';
import { Warehouse, Product } from '../types';
import { inv2SaveAdjustment, inv2ListMovements, listWarehouses, listProducts } from '../services/api';

interface Inv2AdjustmentPageProps {
    companyId: number;
    userId: number;
}

interface AdjustItem {
    warehouse_id: number;
    product_id: number;
    variant?: string;
    lot_number?: string;
    adjust_type: 'add' | 'reduce';
    quantity: number;
    mfg_date?: string;
    exp_date?: string;
    unit_cost?: number;
    notes?: string;
}

const Inv2AdjustmentPage: React.FC<Inv2AdjustmentPageProps> = ({ companyId, userId }) => {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [recentAdj, setRecentAdj] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [formNotes, setFormNotes] = useState('');
    const [formImages, setFormImages] = useState<string[]>([]);
    const [formItems, setFormItems] = useState<AdjustItem[]>([]);
    const [saving, setSaving] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [whRes, pRes, mRes] = await Promise.all([
                listWarehouses(companyId),
                listProducts(companyId),
                inv2ListMovements({ company_id: companyId, reference_type: 'adjustment', pageSize: 30 }),
            ]);
            setWarehouses(Array.isArray(whRes) ? whRes : whRes?.data || []);
            setProducts(Array.isArray(pRes) ? pRes : pRes?.data || []);
            setRecentAdj(mRes?.data || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    }, [companyId]);

    useEffect(() => { loadData(); }, [loadData]);

    const openForm = () => {
        setFormNotes('');
        setFormImages([]);
        setFormItems([{
            warehouse_id: warehouses[0]?.id || 0, product_id: 0, variant: '', lot_number: '',
            adjust_type: 'add', quantity: 0, mfg_date: '', exp_date: '', notes: '',
        }]);
        setShowForm(true);
    };

    const addItem = () => {
        setFormItems([...formItems, {
            warehouse_id: warehouses[0]?.id || 0, product_id: 0, variant: '', lot_number: '',
            adjust_type: 'add', quantity: 0, mfg_date: '', exp_date: '', notes: '',
        }]);
    };

    const updateItem = (idx: number, field: string, value: any) => {
        setFormItems(formItems.map((item, i) => i === idx ? { ...item, [field]: value } : item));
    };

    const removeItem = (idx: number) => {
        setFormItems(formItems.filter((_, i) => i !== idx));
    };

    const handleSave = async () => {
        const valid = formItems.filter(i => i.warehouse_id && i.product_id && i.quantity > 0);
        if (valid.length === 0) return alert('เพิ่มรายการที่ถูกต้องอย่างน้อย 1 รายการ');

        setSaving(true);
        try {
            await inv2SaveAdjustment({
                user_id: userId, company_id: companyId,
                notes: formNotes || null, images: formImages, items: valid,
            });
            setShowForm(false);
            loadData();
        } catch (e: any) {
            alert('บันทึกไม่สำเร็จ: ' + (e?.message || ''));
        }
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

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
                        <Settings size={28} style={{ verticalAlign: 'middle', marginRight: '8px', color: '#8b5cf6' }} />
                        ปรับปรุงข้อมูลสต็อก
                    </h1>
                    <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: '14px' }}>แก้ไข/ปรับปรุงจำนวนสต็อกตามการตรวจนับจริง</p>
                </div>
                <button onClick={openForm} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(139,92,246,0.3)' }}>
                    <Plus size={18} /> ปรับปรุงใหม่
                </button>
            </div>

            {/* Form */}
            {showForm && (
                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '24px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#374151' }}>เพิ่ม/ลดสต็อก</h3>
                        <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={20} /></button>
                    </div>

                    {/* Items */}
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr 1fr 1fr 1fr 1fr auto', gap: '6px', marginBottom: '4px', padding: '0 4px' }}>
                            <span>คลัง</span><span>สินค้า</span><span>รุ่น</span><span>Lot</span><span>เพิ่ม/ลด</span><span>จำนวน</span><span>วันผลิต</span><span>หมดอายุ</span><span></span>
                        </div>
                        {formItems.map((item, idx) => (
                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr 1fr 1fr 1fr 1fr auto', gap: '6px', marginBottom: '8px', alignItems: 'center' }}>
                                <select value={item.warehouse_id} onChange={e => updateItem(idx, 'warehouse_id', Number(e.target.value))} style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px' }}>
                                    <option value={0}>คลัง</option>
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                                <select value={item.product_id} onChange={e => updateItem(idx, 'product_id', Number(e.target.value))} style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px' }}>
                                    <option value={0}>เลือกสินค้า</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                                <input placeholder="รุ่น" value={item.variant || ''} onChange={e => updateItem(idx, 'variant', e.target.value)} style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px' }} />
                                <input placeholder="Lot" value={item.lot_number || ''} onChange={e => updateItem(idx, 'lot_number', e.target.value)} style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px' }} />
                                <select value={item.adjust_type} onChange={e => updateItem(idx, 'adjust_type', e.target.value)} style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', background: item.adjust_type === 'add' ? '#f0fdf4' : '#fef2f2' }}>
                                    <option value="add">+ เพิ่ม</option>
                                    <option value="reduce">- ลด</option>
                                </select>
                                <input type="number" min={0} value={item.quantity || ''} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px' }} />
                                <input type="date" value={item.mfg_date || ''} onChange={e => updateItem(idx, 'mfg_date', e.target.value)} style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px' }} />
                                <input type="date" value={item.exp_date || ''} onChange={e => updateItem(idx, 'exp_date', e.target.value)} style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px' }} />
                                <button onClick={() => removeItem(idx)} style={{ padding: '8px', background: '#fee2e2', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14} /></button>
                            </div>
                        ))}
                        <button onClick={addItem} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 14px', background: '#ede9fe', color: '#7c3aed', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginTop: '8px' }}><Plus size={14} /> เพิ่มรายการ</button>
                    </div>

                    {/* Notes & Images */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '20px' }}>
                        <div>
                            <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>หมายเหตุ</label>
                            <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', resize: 'vertical' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px', display: 'block' }}>รูปภาพแนบ</label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {formImages.map((img, idx) => (
                                    <div key={idx} style={{ position: 'relative', width: '80px', height: '80px' }}>
                                        <img src={img.startsWith('data:') ? img : `/CRM_ERP_V4/api/${img}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                                        <button onClick={() => setFormImages(formImages.filter((_, i) => i !== idx))} style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                    </div>
                                ))}
                                <label style={{ width: '80px', height: '80px', border: '2px dashed #d1d5db', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9ca3af' }}>
                                    <Camera size={24} />
                                    <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: 'none' }} />
                                </label>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                        <button onClick={() => setShowForm(false)} style={{ padding: '10px 24px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>ยกเลิก</button>
                        <button onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', background: saving ? '#c4b5fd' : 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                            {saving ? <><Loader2 size={14} className="animate-spin" style={{ marginRight: '6px' }} />กำลังบันทึก...</> : 'บันทึกปรับปรุง'}
                        </button>
                    </div>
                </div>
            )}

            {/* Recent adjustments */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#374151', margin: 0 }}>ประวัติการปรับปรุงล่าสุด</h3>
                </div>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}><Loader2 className="animate-spin" size={24} /></div>
                ) : recentAdj.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>ยังไม่มีรายการปรับปรุง</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc' }}>
                                {['เลขเอกสาร', 'วัน/เวลา', 'ประเภท', 'คลัง', 'สินค้า', 'รุ่น', 'Lot', 'จำนวน', 'ผู้ทำ'].map(h => (
                                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {recentAdj.map(m => (
                                <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#8b5cf6', fontSize: '13px' }}>{m.reference_doc_number}</td>
                                    <td style={{ padding: '10px 14px', fontSize: '13px', color: '#374151' }}>{new Date(m.created_at).toLocaleString('th-TH')}</td>
                                    <td style={{ padding: '10px 14px' }}>
                                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: m.movement_type === 'ADJUST_IN' ? '#d1fae5' : '#fee2e2', color: m.movement_type === 'ADJUST_IN' ? '#059669' : '#dc2626' }}>
                                            {m.movement_type === 'ADJUST_IN' ? '+ เพิ่ม' : '- ลด'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 14px', fontSize: '13px' }}>{m.warehouse_name}</td>
                                    <td style={{ padding: '10px 14px', fontSize: '13px' }}>{m.product_name}</td>
                                    <td style={{ padding: '10px 14px', fontSize: '13px', color: '#6b7280' }}>{m.variant || '—'}</td>
                                    <td style={{ padding: '10px 14px', fontSize: '13px', color: '#6b7280' }}>{m.lot_number || '—'}</td>
                                    <td style={{ padding: '10px 14px', fontWeight: 600, color: m.movement_type === 'ADJUST_IN' ? '#059669' : '#dc2626' }}>
                                        {m.movement_type === 'ADJUST_IN' ? '+' : '-'}{m.quantity}
                                    </td>
                                    <td style={{ padding: '10px 14px', fontSize: '12px', color: '#6b7280' }}>{m.created_by_name}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default Inv2AdjustmentPage;
