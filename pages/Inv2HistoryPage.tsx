import React, { useState, useEffect, useCallback } from 'react';
import { History, Search, Loader2, ArrowDownToLine, ArrowUpFromLine, ChevronDown } from 'lucide-react';
import { Inv2Movement } from '../types';
import { inv2ListMovements, listWarehouses } from '../services/api';

interface Inv2HistoryPageProps {
    companyId: number;
}

const TYPE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
    IN: { bg: '#d1fae5', color: '#059669', label: 'รับเข้า' },
    OUT: { bg: '#fee2e2', color: '#dc2626', label: 'จ่ายออก' },
    ADJUST_IN: { bg: '#e0e7ff', color: '#4f46e5', label: 'ปรับเพิ่ม' },
    ADJUST_OUT: { bg: '#fef3c7', color: '#d97706', label: 'ปรับลด' },
};

const REF_LABELS: Record<string, string> = {
    receive: 'รับเข้า',
    dispatch: 'จ่ายออก',
    adjustment: 'ปรับปรุง',
};

const Inv2HistoryPage: React.FC<Inv2HistoryPageProps> = ({ companyId }) => {
    const [movements, setMovements] = useState<Inv2Movement[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [refFilter, setRefFilter] = useState('');
    const [warehouseFilter, setWarehouseFilter] = useState<number | ''>('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState<any>({});

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [mRes, whRes] = await Promise.all([
                inv2ListMovements({
                    company_id: companyId,
                    movement_type: typeFilter || undefined,
                    reference_type: refFilter || undefined,
                    warehouse_id: warehouseFilter || undefined,
                    search: search || undefined,
                    start_date: startDate || undefined,
                    end_date: endDate || undefined,
                    page, pageSize: 50,
                }),
                listWarehouses(companyId),
            ]);
            setMovements(mRes?.data || []);
            setPagination(mRes?.pagination || {});
            setWarehouses(Array.isArray(whRes) ? whRes : whRes?.data || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    }, [companyId, typeFilter, refFilter, warehouseFilter, search, startDate, endDate, page]);

    useEffect(() => { loadData(); }, [loadData]);

    return (
        <div style={{ padding: '24px' }}>
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
                    <History size={28} style={{ verticalAlign: 'middle', marginRight: '8px', color: '#6366f1' }} />
                    ประวัติทั้งหมด
                </h1>
                <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: '14px' }}>Movement history — รับเข้า, จ่ายออก, ปรับปรุง</p>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 250px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input placeholder="ค้นหา..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }} />
                </div>
                <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }} style={{ padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px' }}>
                    <option value="">ทุกประเภท</option>
                    {Object.entries(TYPE_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select value={refFilter} onChange={e => { setRefFilter(e.target.value); setPage(1); }} style={{ padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px' }}>
                    <option value="">ทุกแหล่ง</option>
                    {Object.entries(REF_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={warehouseFilter} onChange={e => { setWarehouseFilter(e.target.value ? Number(e.target.value) : ''); setPage(1); }} style={{ padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px' }}>
                    <option value="">ทุกคลัง</option>
                    {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }} style={{ padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px' }} />
                <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }} style={{ padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px' }} />
            </div>

            {/* Table */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}><Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 8px' }} /></div>
                ) : movements.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>ไม่พบรายการ</div>
                ) : (
                    <>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc' }}>
                                        {['วัน/เวลา', 'ประเภท', 'เลขเอกสาร', 'เลขออเดอร์', 'คลัง', 'สินค้า', 'รุ่น', 'Lot', 'จำนวน', 'ผู้ทำ', 'หมายเหตุ'].map(h => (
                                            <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {movements.map(m => {
                                        const ts = TYPE_STYLES[m.movement_type] || { bg: '#f3f4f6', color: '#374151', label: m.movement_type };
                                        const isIn = m.movement_type === 'IN' || m.movement_type === 'ADJUST_IN';
                                        return (
                                            <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }} onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                                <td style={{ padding: '10px 12px', fontSize: '12px', color: '#374151', whiteSpace: 'nowrap' }}>{new Date(m.created_at).toLocaleString('th-TH')}</td>
                                                <td style={{ padding: '10px 12px' }}>
                                                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: ts.bg, color: ts.color }}>{ts.label}</span>
                                                </td>
                                                <td style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#6366f1' }}>{m.reference_doc_number || '—'}</td>
                                                <td style={{ padding: '10px 12px', fontSize: '12px', color: m.reference_order_id ? '#059669' : '#d1d5db' }}>{m.reference_order_id || '—'}</td>
                                                <td style={{ padding: '10px 12px', fontSize: '12px', color: '#374151' }}>{m.warehouse_name}</td>
                                                <td style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#374151' }}>{m.product_name}</td>
                                                <td style={{ padding: '10px 12px', fontSize: '12px', color: '#6b7280' }}>{m.variant || '—'}</td>
                                                <td style={{ padding: '10px 12px', fontSize: '12px', color: '#6b7280' }}>{m.lot_number || '—'}</td>
                                                <td style={{ padding: '10px 12px', fontWeight: 700, color: isIn ? '#059669' : '#dc2626', fontSize: '13px' }}>
                                                    {isIn ? '+' : '-'}{Number(m.quantity).toLocaleString()}
                                                </td>
                                                <td style={{ padding: '10px 12px', fontSize: '11px', color: '#6b7280' }}>{m.created_by_name}</td>
                                                <td style={{ padding: '10px 12px', fontSize: '11px', color: '#9ca3af', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.notes || '—'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {pagination.totalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '16px', borderTop: '1px solid #e5e7eb' }}>
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', cursor: page <= 1 ? 'not-allowed' : 'pointer', background: '#fff', color: page <= 1 ? '#d1d5db' : '#374151' }}>ก่อนหน้า</button>
                                <span style={{ fontSize: '13px', color: '#6b7280' }}>หน้า {pagination.page} / {pagination.totalPages} ({pagination.total} รายการ)</span>
                                <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages} style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', cursor: page >= pagination.totalPages ? 'not-allowed' : 'pointer', background: '#fff', color: page >= pagination.totalPages ? '#d1d5db' : '#374151' }}>ถัดไป</button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default Inv2HistoryPage;
