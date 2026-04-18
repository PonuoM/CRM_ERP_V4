import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BarChart3, Search, Loader2, Download, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { inv2ListStock, listWarehouses } from '../services/api';

export interface Inv2Stock {
    id: number;
    warehouse_id: number;
    product_id: number;
    variant: string;
    lot_number: string;
    quantity: number | string;
    dispatched_quantity?: number | string;
    mfg_date: string;
    exp_date: string;
    unit_cost: number | string;
    warehouse_name: string;
    product_name: string;
    product_sku: string;
    product_unit: string;
}

interface Inv2StockViewPageProps {
    companyId: number;
}

const MultiSelectDropdown = ({ 
    options, 
    selected, 
    onChange, 
    placeholder 
}: { 
    options: { value: number | string, label: string }[], 
    selected: (number | string)[], 
    onChange: (val: (number | string)[]) => void,
    placeholder: string
}) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        const handleClickOutside = (event: any) => {
            if (ref.current && !ref.current.contains(event.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [ref]);

    const toggle = (val: number | string) => {
        if (selected.includes(val)) onChange(selected.filter(v => v !== val));
        else onChange([...selected, val]);
    };

    const selectAll = () => {
        if (selected.length === options.length) onChange([]);
        else onChange(options.map(o => o.value));
    };

    return (
        <div ref={ref} style={{ position: 'relative', minWidth: '220px', flex: '1 1 200px' }}>
            <div 
                onClick={() => setOpen(!open)}
                style={{ padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', background: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
                <span style={{ color: selected.length ? '#111827' : '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selected.length === 0 ? placeholder : selected.length === options.length ? 'เลือกทั้งหมด' : `เลือกแล้ว ${selected.length} รายการ`}
                </span>
                <ChevronDown size={16} color="#9ca3af" />
            </div>
            {open && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', zIndex: 50, maxHeight: '300px', overflowY: 'auto' }}>
                    <div onClick={selectAll} style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#4f46e5', position: 'sticky', top: 0, background: '#fff' }}>
                        {selected.length === options.length ? 'ล้างการเลือก' : 'เลือกทั้งหมด'}
                    </div>
                    {options.map(opt => (
                        <div key={opt.value} onClick={() => toggle(opt.value)} style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #f9fafb' }}>
                            <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: '1px solid #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', background: selected.includes(opt.value) ? '#4f46e5' : '#fff', flexShrink: 0 }}>
                                {selected.includes(opt.value) && <Check size={12} color="#fff" />}
                            </div>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</span>
                        </div>
                    ))}
                    {options.length === 0 && <div style={{ padding: '12px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>ไม่มีตัวเลือก</div>}
                </div>
            )}
        </div>
    );
};

const Inv2StockViewPage: React.FC<Inv2StockViewPageProps> = ({ companyId }) => {
    const [allStockData, setAllStockData] = useState<Inv2Stock[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [search, setSearch] = useState('');
    const [warehouseFilters, setWarehouseFilters] = useState<number[]>([]);
    const [productFilters, setProductFilters] = useState<number[]>([]);
    const [hideZero, setHideZero] = useState(true);
    
    // Expand/Collapse state (key: whId-prodId)
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch ALL stock for local fast-filtering
            const [stockRes, whRes] = await Promise.all([
                inv2ListStock({
                    company_id: companyId,
                    hide_zero: hideZero,
                }),
                listWarehouses(companyId),
            ]);
            setAllStockData(stockRes?.data || []);
            setWarehouses(Array.isArray(whRes) ? whRes : whRes?.data || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    }, [companyId, hideZero]);

    useEffect(() => { loadData(); }, [loadData]);

    const whOptions = useMemo(() => warehouses.map(w => ({ value: w.id, label: w.name })), [warehouses]);
    
    const availableProducts = useMemo(() => {
        const filteredByWh = warehouseFilters.length > 0 
            ? allStockData.filter(s => warehouseFilters.includes(s.warehouse_id)) 
            : allStockData;
            
        const map = new Map<number, string>();
        filteredByWh.forEach(s => map.set(s.product_id, s.product_name));
        return Array.from(map.entries())
            .map(([value, label]) => ({ value, label }))
            .sort((a,b) => a.label.localeCompare(b.label));
    }, [allStockData, warehouseFilters]);

    const stockData = useMemo(() => {
        return allStockData.filter(s => {
            if (warehouseFilters.length > 0 && !warehouseFilters.includes(s.warehouse_id)) return false;
            if (productFilters.length > 0 && !productFilters.includes(s.product_id)) return false;
            if (search) {
                const q = search.toLowerCase();
                return (s.product_name || '').toLowerCase().includes(q) || 
                       (s.product_sku || '').toLowerCase().includes(q) || 
                       (s.lot_number || '').toLowerCase().includes(q);
            }
            return true;
        });
    }, [allStockData, warehouseFilters, productFilters, search]);

    const groupedStock = useMemo(() => {
        const res: Record<number, Record<number, Inv2Stock[]>> = {};
        stockData.forEach(s => {
            if (!res[s.warehouse_id]) res[s.warehouse_id] = {};
            if (!res[s.warehouse_id][s.product_id]) res[s.warehouse_id][s.product_id] = [];
            res[s.warehouse_id][s.product_id].push(s);
        });
        return res;
    }, [stockData]);

    // Summary calculations based on currently visible stockData
    const dynamicSummary = useMemo(() => {
        return {
            totalItems: stockData.length, // Lots roughly
            totalQty: stockData.reduce((s, i) => s + Number(i.quantity), 0),
            totalDispatch: stockData.reduce((s, i) => s + (Number(i.dispatched_quantity) || 0), 0),
            totalValue: stockData.reduce((s, i) => s + (Number(i.quantity) * (Number(i.unit_cost) || 0)), 0),
        };
    }, [stockData]);

    const toggleExpand = (key: string) => {
        setExpandedProducts(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const isExpired = (d?: string) => d && new Date(d) < new Date();
    const isNearExpiry = (d?: string) => {
        if (!d) return false;
        const diff = (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        return diff > 0 && diff <= 30;
    };

    const handleExportCSV = () => {
        const headers = ['คลังสินค้า', 'รหัสสินค้า', 'ชื่อสินค้า', 'Variant', 'Lot Number', 'วันที่ผลิต', 'วันหมดอายุ', 'จำนวนคงเหลือ', 'จ่ายออก', 'หน่วย', 'ต้นทุน/หน่วย', 'มูลค่ารวม'];
        let csvContent = '\uFEFF';
        csvContent += headers.map(h => `"${h}"`).join(',') + '\n';
        
        stockData.forEach(s => {
            const qty = Number(s.quantity) || 0;
            const dispatched = Number(s.dispatched_quantity) || 0;
            const cost = Number(s.unit_cost) || 0;
            const value = qty * cost;
            
            const row = [
                `"${s.warehouse_name || ''}"`,
                `"${s.product_sku || ''}"`,
                `"${s.product_name || ''}"`,
                `"${s.variant || ''}"`,
                `"${s.lot_number || ''}"`,
                `"${s.mfg_date || ''}"`,
                `"${s.exp_date || ''}"`,
                qty,
                dispatched,
                `"${s.product_unit || ''}"`,
                cost,
                value
            ];
            csvContent += row.join(',') + '\n';
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Stock_V2_Export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const colCount = 11;

    return (
        <div style={{ padding: '24px' }}>
            {/* Header Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a2e', margin: 0, display: 'flex', alignItems: 'center' }}>
                        <BarChart3 size={28} style={{ marginRight: '8px', color: '#3b82f6' }} />
                        แสดงสต็อก
                    </h1>
                    <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: '14px' }}>สต็อกคงเหลือจากข้อมูลชุดใหม่ (V2)</p>
                </div>
                <button onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <Download size={18} />
                    ดาวน์โหลด CSV
                </button>
            </div>

            {/* Compact Summary */}
            <div style={{ display: 'flex', gap: '24px', marginBottom: '16px', fontSize: '13px', color: '#6b7280', flexWrap: 'wrap' }}>
                <span><strong style={{ color: '#1e40af' }}>{dynamicSummary.totalItems}</strong> ล็อตรายการ</span>
                <span>จำนวนคงเหลือรวม <strong style={{ color: '#15803d' }}>{dynamicSummary.totalQty.toLocaleString()}</strong></span>
                <span>จ่ายออกรวม <strong style={{ color: '#ea580c' }}>{dynamicSummary.totalDispatch.toLocaleString()}</strong></span>
                <span>มูลค่ารวม <strong style={{ color: '#7e22ce' }}>฿{dynamicSummary.totalValue.toLocaleString()}</strong></span>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 200px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input placeholder="ค้นหาสินค้า, SKU, Lot..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }} />
                </div>
                <MultiSelectDropdown 
                    options={whOptions} 
                    selected={warehouseFilters} 
                    onChange={v => setWarehouseFilters(v as number[])} 
                    placeholder="ทุกคลังสินค้า" 
                />
                <MultiSelectDropdown 
                    options={availableProducts} 
                    selected={productFilters} 
                    onChange={v => setProductFilters(v as number[])} 
                    placeholder="ทุกสินค้า" 
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: '#f3f4f6', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={hideZero} onChange={e => setHideZero(e.target.checked)} /> ซ่อนยอด 0
                </label>
            </div>

            {/* Stock Table (Grouped by Product) */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}><Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 8px' }} /> กำลังโหลด...</div>
                ) : stockData.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>ไม่พบข้อมูลสต็อกที่ตรงกับเงื่อนไข</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc' }}>
                                    <th style={{ width: '40px', padding: '12px 14px' }}></th>
                                    <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>รหัสสินค้า</th>
                                    <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>ชื่อสินค้า</th>
                                    <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>ข้อมูล Lot</th>
                                    <th style={{ padding: '12px 14px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>จำนวนคงเหลือ</th>
                                    <th style={{ padding: '12px 14px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>จ่ายออก</th>
                                    <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>หน่วย</th>
                                    <th style={{ padding: '12px 14px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>ต้นทุน/หน่วย</th>
                                    <th style={{ padding: '12px 14px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>มูลค่ารวม</th>
                                    <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>วันผลิต</th>
                                    <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>วันหมดอายุ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.keys(groupedStock).map(whIdStr => {
                                    const whId = Number(whIdStr);
                                    const whName = warehouses.find(w => w.id === whId)?.name || 'Unknown Warehouse';
                                    const whProducts = groupedStock[whId];
                                    const whLots = Object.values(whProducts).flat();
                                    const whQty = whLots.reduce((s, x) => s + Number(x.quantity), 0);

                                    return (
                                        <React.Fragment key={whId}>
                                            <tr>
                                                <td colSpan={colCount} style={{ padding: '10px 14px', background: 'linear-gradient(90deg, #eff6ff, #f8fafc)', fontWeight: 700, fontSize: '14px', color: '#1e40af', borderTop: '2px solid #bfdbfe', borderBottom: '1px solid #dbeafe' }}>
                                                    🏭 {whName} <span style={{ fontWeight: 400, fontSize: '12px', color: '#6b7280', marginLeft: '12px' }}>{Object.keys(whProducts).length} สินค้า · รวม {whQty.toLocaleString()} ชิ้น</span>
                                                </td>
                                            </tr>
                                            {Object.keys(whProducts).map(prodIdStr => {
                                                const prodId = Number(prodIdStr);
                                                const lots = whProducts[prodId];
                                                const prodName = lots[0].product_name;
                                                const prodSku = lots[0].product_sku;
                                                const prodUnit = lots[0].product_unit;
                                                const expKey = `${whId}-${prodId}`;
                                                const isExpanded = expandedProducts.has(expKey);

                                                const pQty = lots.reduce((s, x) => s + Number(x.quantity), 0);
                                                const pDispatched = lots.reduce((s, x) => s + (Number(x.dispatched_quantity) || 0), 0);
                                                const pValue = lots.reduce((s, x) => s + (Number(x.quantity) * (Number(x.unit_cost) || 0)), 0);

                                                return (
                                                    <React.Fragment key={expKey}>
                                                        {/* Product Main Row */}
                                                        <tr style={{ background: '#fff', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }} onClick={() => toggleExpand(expKey)} onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')} onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                                                            <td style={{ padding: '10px 14px', color: '#6b7280', textAlign: 'center' }}>
                                                                {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                                            </td>
                                                            <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600, color: '#1e293b' }}>{prodSku || '—'}</td>
                                                            <td style={{ padding: '10px 14px', color: '#374151', fontWeight: 600, maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prodName || '—'}</td>
                                                            <td style={{ padding: '10px 14px', color: '#6b7280', fontSize: '12px' }}>
                                                                <span style={{ background: '#e0e7ff', color: '#4f46e5', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>{lots.length} Lots</span>
                                                            </td>
                                                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: '14px', color: pQty < 0 ? '#dc2626' : pQty === 0 ? '#9ca3af' : '#10b981' }}>{pQty.toLocaleString()}</td>
                                                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#ea580c' }}>{pDispatched > 0 ? pDispatched.toLocaleString() : '-'}</td>
                                                            <td style={{ padding: '10px 14px', color: '#9ca3af' }}>{prodUnit || '—'}</td>
                                                            <td style={{ padding: '10px 14px', textAlign: 'right', color: '#9ca3af' }}>-</td>
                                                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: pValue ? '#7e22ce' : '#d1d5db' }}>{pValue ? `฿${pValue.toLocaleString()}` : '-'}</td>
                                                            <td style={{ padding: '10px 14px', color: '#9ca3af' }}>-</td>
                                                            <td style={{ padding: '10px 14px', color: '#9ca3af' }}>-</td>
                                                        </tr>
                                                        
                                                        {/* Lot Detailed Rows */}
                                                        {isExpanded && lots.map((lot, idx) => {
                                                            const qty = Number(lot.quantity);
                                                            const cost = lot.unit_cost ? Number(lot.unit_cost) : 0;
                                                            const value = qty * cost;
                                                            const disp = Number(lot.dispatched_quantity) || 0;

                                                            return (
                                                                <tr key={lot.id} style={{ background: '#fafbfc', borderBottom: idx === lots.length - 1 ? '1px solid #e5e7eb' : '1px solid #f1f5f9' }}>
                                                                    <td></td>
                                                                    <td></td>
                                                                    <td style={{ padding: '8px 14px', color: '#9ca3af', textAlign: 'right' }}>↳ รายละเอียด:</td>
                                                                    <td style={{ padding: '8px 14px', color: '#1e40af', fontWeight: 600 }}>{lot.lot_number || '—'}</td>
                                                                    <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: qty < 0 ? '#dc2626' : '#10b981' }}>{qty.toLocaleString()}</td>
                                                                    <td style={{ padding: '8px 14px', textAlign: 'right', color: '#ea580c' }}>{disp > 0 ? disp.toLocaleString() : '-'}</td>
                                                                    <td style={{ padding: '8px 14px', color: '#9ca3af' }}>{lot.product_unit || '—'}</td>
                                                                    <td style={{ padding: '8px 14px', textAlign: 'right', color: '#6b7280' }}>{cost ? `฿${cost.toLocaleString()}` : '—'}</td>
                                                                    <td style={{ padding: '8px 14px', textAlign: 'right', color: value ? '#7e22ce' : '#d1d5db' }}>{value ? `฿${value.toLocaleString()}` : '—'}</td>
                                                                    <td style={{ padding: '8px 14px', color: '#6b7280' }}>{lot.mfg_date || '—'}</td>
                                                                    <td style={{ padding: '8px 14px' }}>
                                                                        {lot.exp_date ? (
                                                                            <span style={{ color: isExpired(lot.exp_date) ? '#dc2626' : isNearExpiry(lot.exp_date) ? '#d97706' : '#6b7280', fontWeight: isExpired(lot.exp_date) || isNearExpiry(lot.exp_date) ? 600 : 400 }}>
                                                                                {lot.exp_date} {isExpired(lot.exp_date) ? '⚠️' : isNearExpiry(lot.exp_date) ? '⏰' : ''}
                                                                            </span>
                                                                        ) : '—'}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr style={{ background: '#f0f9ff', borderTop: '2px solid #bfdbfe' }}>
                                    <td colSpan={4} style={{ padding: '14px', textAlign: 'right', fontWeight: 700, color: '#1e40af', fontSize: '14px' }}>รวมทั้งหมดตามฟิลเตอร์</td>
                                    <td style={{ padding: '14px', textAlign: 'right', fontWeight: 800, color: '#15803d', fontSize: '15px' }}>{dynamicSummary.totalQty.toLocaleString()}</td>
                                    <td style={{ padding: '14px', textAlign: 'right', fontWeight: 800, color: '#ea580c', fontSize: '15px' }}>{dynamicSummary.totalDispatch.toLocaleString()}</td>
                                    <td colSpan={2}></td>
                                    <td style={{ padding: '14px', textAlign: 'right', fontWeight: 800, color: '#7e22ce', fontSize: '14px' }}>฿{dynamicSummary.totalValue.toLocaleString()}</td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Inv2StockViewPage;
