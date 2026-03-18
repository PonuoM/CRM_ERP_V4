import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, Search, Loader2 } from 'lucide-react';
import { Inv2Stock } from '../types';
import { inv2ListStock, listWarehouses } from '../services/api';

interface Inv2StockViewPageProps {
    companyId: number;
}

const Inv2StockViewPage: React.FC<Inv2StockViewPageProps> = ({ companyId }) => {
    const [stockData, setStockData] = useState<Inv2Stock[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [warehouseFilter, setWarehouseFilter] = useState<number | ''>('');
    const [hideZero, setHideZero] = useState(true);
    const [summary, setSummary] = useState<any>({});

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [stockRes, whRes] = await Promise.all([
                inv2ListStock({
                    company_id: companyId,
                    warehouse_id: warehouseFilter || undefined,
                    search: search || undefined,
                    hide_zero: hideZero,
                }),
                listWarehouses(companyId),
            ]);
            setStockData(stockRes?.data || []);
            setSummary(stockRes?.summary || {});
            setWarehouses(Array.isArray(whRes) ? whRes : whRes?.data || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    }, [companyId, warehouseFilter, search, hideZero]);

    useEffect(() => { loadData(); }, [loadData]);

    const isExpired = (d?: string) => d && new Date(d) < new Date();
    const isNearExpiry = (d?: string) => {
        if (!d) return false;
        const diff = (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        return diff > 0 && diff <= 30;
    };

    return (
        <div style={{ padding: '24px' }}>
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
                    <BarChart3 size={28} style={{ verticalAlign: 'middle', marginRight: '8px', color: '#3b82f6' }} />
                    แสดงสต็อก
                </h1>
                <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: '14px' }}>สต็อกคงเหลือจากข้อมูลชุดใหม่ (V2)</p>
            </div>

            {/* Compact Summary */}
            <div style={{ display: 'flex', gap: '24px', marginBottom: '16px', fontSize: '13px', color: '#6b7280', flexWrap: 'wrap' }}>
                <span><strong style={{ color: '#1e40af' }}>{summary.total_items || 0}</strong> รายการ</span>
                <span>จำนวนรวม <strong style={{ color: '#15803d' }}>{(summary.total_quantity || 0).toLocaleString()}</strong></span>
                <span>มูลค่า <strong style={{ color: '#7e22ce' }}>฿{(summary.total_value || 0).toLocaleString()}</strong></span>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 300px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input placeholder="ค้นหาสินค้า, SKU, Lot..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }} />
                </div>
                <select value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value ? Number(e.target.value) : '')} style={{ padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', minWidth: '160px' }}>
                    <option value="">ทุกคลัง</option>
                    {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: '#f3f4f6', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={hideZero} onChange={e => setHideZero(e.target.checked)} /> ซ่อนยอด 0
                </label>
            </div>

            {/* Stock Table */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}><Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 8px' }} /> กำลังโหลด...</div>
                ) : stockData.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>ไม่พบข้อมูลสต็อก</div>
                ) : (() => {
                    // Group data by warehouse for separator rows
                    const colCount = 10;
                    const headers = ['#', 'รหัสสินค้า', 'ชื่อสินค้า', 'Lot', 'จำนวน', 'หน่วย', 'ต้นทุน/หน่วย', 'มูลค่า', 'วันผลิต', 'วันหมดอายุ'];
                    let lastWarehouse = '';
                    let rowNum = 0;

                    return (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc' }}>
                                        {headers.map(h => (
                                            <th key={h} style={{ padding: '12px 14px', textAlign: h === 'จำนวน' || h === 'ต้นทุน/หน่วย' || h === 'มูลค่า' ? 'right' : 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', borderBottom: '2px solid #e5e7eb', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {stockData.map((s, idx) => {
                                        const qty = Number(s.quantity);
                                        const cost = s.unit_cost ? Number(s.unit_cost) : 0;
                                        const value = qty * cost;
                                        const showWarehouseHeader = s.warehouse_name !== lastWarehouse;
                                        if (showWarehouseHeader) { lastWarehouse = s.warehouse_name || ''; rowNum = 0; }
                                        rowNum++;
                                        const whQty = showWarehouseHeader ? stockData.filter(x => x.warehouse_name === s.warehouse_name).reduce((sum, x) => sum + Number(x.quantity), 0) : 0;

                                        return (
                                            <React.Fragment key={s.id}>
                                                {showWarehouseHeader && (
                                                    <tr>
                                                        <td colSpan={colCount} style={{ padding: '10px 14px', background: 'linear-gradient(90deg, #eff6ff, #f8fafc)', fontWeight: 700, fontSize: '14px', color: '#1e40af', borderTop: idx > 0 ? '2px solid #bfdbfe' : 'none', borderBottom: '1px solid #dbeafe' }}>
                                                            🏭 {s.warehouse_name} <span style={{ fontWeight: 400, fontSize: '12px', color: '#6b7280', marginLeft: '12px' }}>{stockData.filter(x => x.warehouse_name === s.warehouse_name).length} รายการ · รวม {whQty.toLocaleString()}</span>
                                                        </td>
                                                    </tr>
                                                )}
                                                <tr style={{ borderBottom: '1px solid #f3f4f6', background: rowNum % 2 === 0 ? '#fafbfc' : '#fff' }} onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')} onMouseLeave={e => (e.currentTarget.style.background = rowNum % 2 === 0 ? '#fafbfc' : '#fff')}>
                                                    <td style={{ padding: '8px 14px', color: '#9ca3af', fontWeight: 600, fontSize: '12px' }}>{rowNum}</td>
                                                    <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontWeight: 600, fontSize: '12px', color: '#1e293b' }}>{s.product_sku || '—'}</td>
                                                    <td style={{ padding: '8px 14px', color: '#374151', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.product_name || '—'}</td>

                                                    <td style={{ padding: '8px 14px', color: '#6b7280', fontSize: '12px' }}>{s.lot_number || '—'}</td>
                                                    <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, fontSize: '14px', color: qty < 0 ? '#dc2626' : qty === 0 ? '#9ca3af' : '#10b981' }}>{qty.toLocaleString()}</td>
                                                    <td style={{ padding: '8px 14px', color: '#9ca3af', fontSize: '12px' }}>{s.product_unit || '—'}</td>
                                                    <td style={{ padding: '8px 14px', textAlign: 'right', color: '#6b7280' }}>{cost ? `฿${cost.toLocaleString()}` : '—'}</td>
                                                    <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: value ? '#7e22ce' : '#d1d5db' }}>{value ? `฿${value.toLocaleString()}` : '—'}</td>
                                                    <td style={{ padding: '8px 14px', color: '#6b7280', fontSize: '12px', whiteSpace: 'nowrap' }}>{s.mfg_date || '—'}</td>
                                                    <td style={{ padding: '8px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                                        {s.exp_date ? (
                                                            <span style={{ color: isExpired(s.exp_date) ? '#dc2626' : isNearExpiry(s.exp_date) ? '#d97706' : '#6b7280', fontWeight: isExpired(s.exp_date) || isNearExpiry(s.exp_date) ? 600 : 400 }}>
                                                                {s.exp_date} {isExpired(s.exp_date) ? '⚠️' : isNearExpiry(s.exp_date) ? '⏰' : ''}
                                                            </span>
                                                        ) : '—'}
                                                    </td>
                                                </tr>
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr style={{ background: '#f0f9ff', borderTop: '2px solid #bfdbfe' }}>
                                        <td colSpan={5} style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#1e40af', fontSize: '13px' }}>รวมทั้งหมด</td>
                                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#1e40af', fontSize: '15px' }}>{stockData.reduce((s, i) => s + Number(i.quantity), 0).toLocaleString()}</td>
                                        <td></td>
                                        <td></td>
                                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#7e22ce', fontSize: '13px' }}>฿{stockData.reduce((s, i) => s + Number(i.quantity) * (i.unit_cost ? Number(i.unit_cost) : 0), 0).toLocaleString()}</td>
                                        <td colSpan={2}></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
};

export default Inv2StockViewPage;
