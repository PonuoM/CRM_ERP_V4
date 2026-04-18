import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Database, Link as LinkIcon, Plus, Trash2, Loader2, Save } from 'lucide-react';
import { inv2ListWarehouseMappings, inv2SaveWarehouseMapping, listWarehouses } from '../services/api';
import resolveApiBasePath from "@/utils/apiBasePath";

interface Mapping {
    id: number;
    dispatch_warehouse_name: string;
    main_warehouse_id: number;
    main_warehouse_name: string;
}

interface Inv2WarehouseMappingPageProps {
    companyId: number;
}

const Inv2WarehouseMappingPage: React.FC<Inv2WarehouseMappingPageProps> = ({ companyId }) => {
    const [mappings, setMappings] = useState<Mapping[]>([]);
    const [unmappedNames, setUnmappedNames] = useState<string[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // New Mapping Form
    const [newDispatchName, setNewDispatchName] = useState('');
    const [newMainWhId, setNewMainWhId] = useState<number>(0);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [mapRes, whRes] = await Promise.all([
                inv2ListWarehouseMappings(companyId),
                listWarehouses(companyId)
            ]);
            setMappings(mapRes?.mappings || []);
            setUnmappedNames(mapRes?.unmapped || []);
            setWarehouses(Array.isArray(whRes) ? whRes : whRes?.data || []);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    }, [companyId]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleSaveMapping = async (dispatchName: string, mainWhId: number) => {
        if (!dispatchName || !mainWhId) return alert('กรุณาระบุชื่อคลังจ่ายและเลือกคลังหลักให้ครบ');
        setSaving(true);
        try {
            const res = await inv2SaveWarehouseMapping({
                action: 'save',
                company_id: companyId,
                dispatch_warehouse_name: dispatchName,
                main_warehouse_id: mainWhId
            });
            if (res?.success) {
                try {
                    // Try to retroactively deduct pending items for this mapping
                    // Try to retroactively deduct pending items for this mapping
                    const basePath = resolveApiBasePath();
                    await fetch(`${basePath}/inv2/reprocess_pending_dispatch.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ company_id: companyId, dispatch_warehouse_name: dispatchName })
                    });
                } catch (err) {
                    console.error("Failed to reprocess pending dispatch items", err);
                }
                
                setNewDispatchName('');
                setNewMainWhId(0);
                loadData();
            } else {
                alert(res?.error || 'เกิดข้อผิดพลาดในการบันทึก');
            }
        } catch (e) {
            console.error(e);
            alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        }
        setSaving(false);
    };

    const handleDeleteMapping = async (id: number) => {
        if (!confirm('ยืนยันลบการผูกคลังคู่นี้? คำสั่งจ่ายหลังจากนี้อาจหาคลังตัดไม่ได้')) return;
        setSaving(true);
        try {
            const res = await inv2SaveWarehouseMapping({
                action: 'delete',
                company_id: companyId,
                id
            });
            if (res?.success) {
                loadData();
            } else {
                alert(res?.error || 'ลบไม่สำเร็จ');
            }
        } catch (e) {
            console.error(e);
        }
        setSaving(false);
    };

    // Group mappings by main warehouse
    const groupedMappings = useMemo(() => {
        const groups: Record<number, Mapping[]> = {};
        mappings.forEach(m => {
            if (!groups[m.main_warehouse_id]) groups[m.main_warehouse_id] = [];
            groups[m.main_warehouse_id].push(m);
        });
        return groups;
    }, [mappings]);

    return (
        <div style={{ padding: '24px', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <LinkIcon size={28} style={{ marginRight: '12px', color: '#10b981' }} />
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: 0 }}>ตั้งค่าผูกคลังสินค้า (Warehouse Mapping)</h1>
            </div>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '32px' }}>
                ระบุชื่อคลังจ่ายของระบบขนส่ง/แพลตฟอร์ม แล้วผูกเข้ากับคลังหลัก (รับเข้า) ของเราเพื่อให้ระบบสามารถตัดสต็อกอัตโนมัติได้อย่างแม่นยำ
            </p>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px' }}><Loader2 size={32} className="animate-spin text-gray-400 mx-auto" /></div>
            ) : (
                <div style={{ display: 'flex', gap: '24px', flexDirection: 'column' }}>
                    
                    {/* Top Section: Side-by-Side (Auto-Discover & Manual) */}
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'stretch', flexWrap: 'wrap' }}>
                        
                        {/* Auto-Discovered Unmapped Warehouses */}
                        {unmappedNames.length > 0 && (
                            <div style={{ flex: '2 1 500px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#b45309', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    ⚠️ พบชื่อคลังจ่ายใหม่ที่ยังไม่ได้ผูก ({unmappedNames.length} รายการ)
                                </h3>
                                <div style={{ flex: 1, overflowY: 'auto', maxHeight: '350px', paddingRight: '8px' }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                        {unmappedNames.map(name => (
                                            <div key={name} style={{ background: '#fff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                                <span style={{ fontWeight: 600, color: '#92400e', fontSize: '13px' }}>{name}</span>
                                                <span style={{ color: '#d97706' }}>{'->'}</span>
                                                <select 
                                                    onChange={(e) => {
                                                        if (e.target.value) handleSaveMapping(name, Number(e.target.value));
                                                    }}
                                                    disabled={saving}
                                                    style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px' }}
                                                >
                                                    <option value="">เลือกคลังหลักเพื่อผูกทันที...</option>
                                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Manual Create Mapping */}
                        <div style={{ flex: '1 1 300px', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: '300px' }}>
                            <div style={{ background: '#f8fafc', padding: '16px 20px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#1e293b' }}>
                                + สร้างการผูกคลังใหม่ (Manual Mapping)
                            </div>
                            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '8px' }}>พิมพ์ชื่อคลังจ่าย หรือ เลือกจากประวัติที่พบ</label>
                                    <input 
                                        list="dispatch-names-list"
                                        type="text"
                                        value={newDispatchName}
                                        onChange={e => setNewDispatchName(e.target.value)}
                                        placeholder="เช่น Center - กาญจนบุรี หรือกดเลือก"
                                        style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', background: '#fff' }}
                                    />
                                    <datalist id="dispatch-names-list">
                                        {unmappedNames.map(name => <option key={name} value={name}>{name}</option>)}
                                    </datalist>
                                </div>
                                <div style={{ color: '#9ca3af', textAlign: 'center', padding: '4px 0' }}>{'↓'}</div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '8px' }}>เลือกคลังหลัก (รับเข้า)</label>
                                    <select 
                                        value={newMainWhId}
                                        onChange={e => setNewMainWhId(Number(e.target.value))}
                                        style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', background: '#fff' }}
                                    >
                                        <option value={0}>-- เลือกคลังหลัก --</option>
                                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                </div>
                                <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                                    <button 
                                        onClick={() => handleSaveMapping(newDispatchName, newMainWhId)}
                                        disabled={saving || !newDispatchName || !newMainWhId}
                                        style={{ width: '100%', justifyContent: 'center', background: '#4f46e5', color: '#fff', padding: '12px 24px', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: saving || !newDispatchName || !newMainWhId ? 'not-allowed' : 'pointer', opacity: saving || !newDispatchName || !newMainWhId ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                        <Save size={18} /> บันทึกการผูก
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Mappings List (Grid) */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                        <div style={{ background: '#f8fafc', padding: '16px 20px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#1e293b' }}>
                            ตารางผูกคลังปัจจุบัน (Current Mappings)
                        </div>
                        {mappings.length === 0 ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>ยังไม่มีการผูกคลังใดๆ</div>
                        ) : (
                            <div style={{ 
                                padding: '24px', 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
                                gap: '24px' 
                            }}>
                                {warehouses.map(wh => {
                                    const mps = groupedMappings[wh.id] || [];
                                    if (mps.length === 0) return null;
                                    return (
                                        <div key={wh.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                                            <div style={{ background: '#eff6ff', padding: '14px 16px', borderBottom: '1px solid #e2e8f0', fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                                                <Database size={16} />
                                                คลังหลัก: {wh.name}
                                            </div>
                                            <div style={{ padding: '12px 16px' }}>
                                                {mps.map(m => (
                                                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px dashed #e2e8f0' }}>
                                                        <span style={{ background: '#f1f5f9', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', color: '#334155', fontWeight: 600 }}>
                                                            {m.dispatch_warehouse_name}
                                                        </span>
                                                        <button 
                                                            onClick={() => handleDeleteMapping(m.id)} 
                                                            disabled={saving} 
                                                            style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', cursor: 'pointer', padding: '6px 8px', borderRadius: '6px', display: 'inline-flex', transition: 'background 0.2s' }} 
                                                            onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                                                            onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}
                                                            title="ลบการผูก"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                                {/* Hidden last border hack */}
                                                <div style={{ height: '4px', background: '#fff', marginTop: '-1px', position: 'relative', zIndex: 2 }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inv2WarehouseMappingPage;
