import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart3, Search, Loader2, Building2, ChevronDown, ChevronRight, Package } from 'lucide-react';
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
    const [expandedWarehouses, setExpandedWarehouses] = useState<Set<number>>(new Set());
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
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

    // Group: warehouse → product → variants/lots
    const grouped = useMemo(() => {
        const map: Record<number, { name: string; products: Record<number, { name: string; sku: string; unit: string; lots: Inv2Stock[] }> }> = {};
        stockData.forEach(s => {
            if (!map[s.warehouse_id]) map[s.warehouse_id] = { name: s.warehouse_name || '', products: {} };
            if (!map[s.warehouse_id].products[s.product_id]) {
                map[s.warehouse_id].products[s.product_id] = { name: s.product_name || '', sku: s.product_sku || '', unit: s.product_unit || '', lots: [] };
            }
            map[s.warehouse_id].products[s.product_id].lots.push(s);
        });
        return map;
    }, [stockData]);

    const toggleWarehouse = (wid: number) => {
        setExpandedWarehouses(prev => {
            const next = new Set(prev);
            next.has(wid) ? next.delete(wid) : next.add(wid);
            return next;
        });
    };

    const toggleProduct = (key: string) => {
        setExpandedProducts(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const isExpired = (d?: string) => d && new Date(d) < new Date();
    const isNearExpiry = (d?: string) => {
        if (!d) return false;
        const diff = (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        return diff > 0 && diff <= 30;
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
                    <BarChart3 size={28} style={{ verticalAlign: 'middle', marginRight: '8px', color: '#3b82f6' }} />
                    แสดงสต็อก
                </h1>
                <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: '14px' }}>สต็อกคงเหลือจากข้อมูลชุดใหม่ (V2)</p>
            </div>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderRadius: '12px', padding: '20px', border: '1px solid #bfdbfe' }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#3b82f6', textTransform: 'uppercase', margin: '0 0 4px' }}>รายการ</p>
                    <p style={{ fontSize: '28px', fontWeight: 700, color: '#1e40af', margin: 0 }}>{summary.total_items || 0}</p>
                </div>
                <div style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', borderRadius: '12px', padding: '20px', border: '1px solid #bbf7d0' }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#16a34a', textTransform: 'uppercase', margin: '0 0 4px' }}>จำนวนรวม</p>
                    <p style={{ fontSize: '28px', fontWeight: 700, color: '#15803d', margin: 0 }}>{(summary.total_quantity || 0).toLocaleString()}</p>
                </div>
                <div style={{ background: 'linear-gradient(135deg, #fdf4ff, #fae8ff)', borderRadius: '12px', padding: '20px', border: '1px solid #e9d5ff' }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#9333ea', textTransform: 'uppercase', margin: '0 0 4px' }}>มูลค่ารวม</p>
                    <p style={{ fontSize: '28px', fontWeight: 700, color: '#7e22ce', margin: 0 }}>฿{(summary.total_value || 0).toLocaleString()}</p>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 300px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input placeholder="ค้นหาสินค้า, SKU, รุ่น, Lot..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }} />
                </div>
                <select value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value ? Number(e.target.value) : '')} style={{ padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', minWidth: '160px' }}>
                    <option value="">ทุกคลัง</option>
                    {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: '#f3f4f6', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={hideZero} onChange={e => setHideZero(e.target.checked)} /> ซ่อนยอด 0
                </label>
            </div>

            {/* Stock tree view */}
            {loading ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}><Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 8px' }} /> กำลังโหลด...</div>
            ) : Object.keys(grouped).length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb' }}>ไม่พบข้อมูลสต็อก</div>
            ) : (
                Object.entries(grouped).map(([wid, wh]) => {
                    const whExpanded = expandedWarehouses.has(Number(wid)) || expandedWarehouses.size === 0;
                    const totalQty = Object.values(wh.products).reduce((sum, p) => sum + p.lots.reduce((s, l) => s + Number(l.quantity), 0), 0);

                    return (
                        <div key={wid} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '12px', overflow: 'hidden' }}>
                            {/* Warehouse header */}
                            <div onClick={() => toggleWarehouse(Number(wid))} style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', cursor: 'pointer', background: '#f8fafc', borderBottom: whExpanded ? '1px solid #e5e7eb' : 'none', gap: '10px' }}>
                                {whExpanded ? <ChevronDown size={18} color="#6b7280" /> : <ChevronRight size={18} color="#6b7280" />}
                                <Building2 size={20} color="#3b82f6" />
                                <span style={{ fontWeight: 700, fontSize: '16px', color: '#1a1a2e' }}>{wh.name}</span>
                                <span style={{ marginLeft: 'auto', fontSize: '14px', fontWeight: 600, color: '#3b82f6', background: '#eff6ff', padding: '4px 12px', borderRadius: '6px' }}>{totalQty.toLocaleString()} ชิ้น</span>
                            </div>

                            {whExpanded && Object.entries(wh.products).map(([pid, prod]) => {
                                const pKey = `${wid}-${pid}`;
                                const pExpanded = expandedProducts.has(pKey) || !expandedProducts.size;
                                const prodQty = prod.lots.reduce((s, l) => s + Number(l.quantity), 0);

                                return (
                                    <div key={pid}>
                                        <div onClick={() => toggleProduct(pKey)} style={{ display: 'flex', alignItems: 'center', padding: '12px 20px 12px 44px', cursor: 'pointer', gap: '8px', borderBottom: '1px solid #f3f4f6' }}>
                                            {pExpanded ? <ChevronDown size={16} color="#9ca3af" /> : <ChevronRight size={16} color="#9ca3af" />}
                                            <Package size={16} color="#6b7280" />
                                            <span style={{ fontWeight: 600, fontSize: '14px', color: '#374151' }}>{prod.name}</span>
                                            <span style={{ fontSize: '12px', color: '#9ca3af' }}>({prod.sku})</span>
                                            <span style={{ marginLeft: 'auto', fontSize: '13px', fontWeight: 600, color: '#374151' }}>{prodQty.toLocaleString()} {prod.unit}</span>
                                        </div>

                                        {pExpanded && (
                                            <div style={{ padding: '0 20px 12px 68px' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                                    <thead>
                                                        <tr style={{ color: '#9ca3af' }}>
                                                            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500 }}>รุ่น</th>
                                                            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500 }}>Lot</th>
                                                            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 500 }}>จำนวน</th>
                                                            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500 }}>วันผลิต</th>
                                                            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500 }}>วันหมดอายุ</th>
                                                            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 500 }}>ต้นทุน/หน่วย</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {prod.lots.map(lot => (
                                                            <tr key={lot.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                                                                <td style={{ padding: '8px', color: '#374151' }}>{lot.variant || '—'}</td>
                                                                <td style={{ padding: '8px', color: '#6b7280' }}>{lot.lot_number || '—'}</td>
                                                                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: Number(lot.quantity) < 0 ? '#dc2626' : '#374151' }}>{Number(lot.quantity).toLocaleString()}</td>
                                                                <td style={{ padding: '8px', color: '#6b7280' }}>{lot.mfg_date || '—'}</td>
                                                                <td style={{ padding: '8px' }}>
                                                                    {lot.exp_date ? (
                                                                        <span style={{ color: isExpired(lot.exp_date) ? '#dc2626' : isNearExpiry(lot.exp_date) ? '#d97706' : '#6b7280', fontWeight: isExpired(lot.exp_date) || isNearExpiry(lot.exp_date) ? 600 : 400 }}>
                                                                            {lot.exp_date} {isExpired(lot.exp_date) ? '⚠️' : isNearExpiry(lot.exp_date) ? '⏰' : ''}
                                                                        </span>
                                                                    ) : '—'}
                                                                </td>
                                                                <td style={{ padding: '8px', textAlign: 'right', color: '#6b7280' }}>{lot.unit_cost ? `฿${Number(lot.unit_cost).toLocaleString()}` : '—'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })
            )}
        </div>
    );
};

export default Inv2StockViewPage;
