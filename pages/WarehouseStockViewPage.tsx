import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, PackagePlus, ChevronDown, ChevronRight, Search, Warehouse as WarehouseIcon } from 'lucide-react';
import { Warehouse, User, Product } from '@/types';
import { listWarehouseStocks, listWarehouses, listProducts } from '@/services/api';
import LotManagementModal from '@/components/LotManagementModal';

interface WarehouseStockViewPageProps {
  currentUser?: User;
  companyId?: number;
}

interface GroupedProductStock {
  productId: number;
  sku: string;
  name: string;
  totalQty: number;
  totalReserved: number;
  totalAvailable: number;
  lots: any[];
}

interface GroupedWarehouseStock {
  warehouseId: number;
  warehouseName: string;
  products: GroupedProductStock[];
}

const WarehouseStockViewPage: React.FC<WarehouseStockViewPageProps> = ({ currentUser, companyId }) => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([] as any);
  const [warehouseId, setWarehouseId] = useState<number | ''>('');
  const [stocks, setStocks] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});

  // Modal State
  const [selectedProductForLot, setSelectedProductForLot] = useState<Product | null>(null);

  const effectiveCompanyId = companyId ?? currentUser?.companyId ?? 1;

  const loadWarehouses = async () => {
    const [whs, prods] = await Promise.all([
      listWarehouses(effectiveCompanyId),
      listProducts(),
    ]);
    setWarehouses(whs as any);
    setProducts(prods);
  };

  const loadStocks = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (warehouseId) params.warehouseId = warehouseId;
      const rows = await listWarehouseStocks(params);
      setStocks(rows);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadWarehouses(); }, [effectiveCompanyId]);
  useEffect(() => { loadStocks(); }, [warehouseId]);

  const toggleExpand = (key: string) => {
    setExpandedProducts(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const groupedStocks = useMemo(() => {
    const groups: Record<number, GroupedWarehouseStock> = {};

    stocks.forEach(s => {
      const wId = Number(s.warehouse_id ?? s.warehouseId);
      const pId = Number(s.product_id ?? s.productId);
      const p = products.find(pr => pr.id === pId);
      const w = warehouses.find(wh => wh.id === wId);

      // Filter logic
      const productName = p ? `${p.sku} ${p.name}` : String(pId);
      const lot = String(s.lot_number ?? s.lotNumber ?? '');
      const searchHaystack = `${productName} ${lot}`.toLowerCase();
      if (q && !searchHaystack.includes(q.toLowerCase())) {
        return;
      }

      if (!groups[wId]) {
        groups[wId] = {
          warehouseId: wId,
          warehouseName: w?.name || `Warehouse ${wId}`,
          products: []
        };
      }

      let prodGroup = groups[wId].products.find(pg => pg.productId === pId);
      if (!prodGroup) {
        prodGroup = {
          productId: pId,
          sku: p?.sku || '',
          name: p?.name || `Product ${pId}`,
          totalQty: 0,
          totalReserved: 0,
          totalAvailable: 0,
          lots: []
        };
        groups[wId].products.push(prodGroup);
      }

      const qty = Number(s.quantity ?? 0);
      const reserved = Number(s.reserved_quantity ?? s.reservedQuantity ?? 0);
      const available = Number(s.available_quantity ?? s.availableQuantity ?? (qty - reserved));

      prodGroup.totalQty += qty;
      prodGroup.totalReserved += reserved;
      prodGroup.totalAvailable += available;
      prodGroup.lots.push({
        ...s,
        quantity: qty,
        reserved_quantity: reserved,
        available_quantity: available
      });
    });

    return Object.values(groups).sort((a, b) => a.warehouseName.localeCompare(b.warehouseName));
  }, [stocks, products, warehouses, q]);

  return (
    <div className="p-6 bg-[#F5F5F5] min-h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Boxes className="h-6 w-6 text-indigo-600" />
          Warehouse Stock
        </h2>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-wrap items-center gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="ค้นหา SKU, ชื่อสินค้า, หรือ Lot Number..."
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="w-full sm:w-auto">
          <select
            className="w-full sm:w-48 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
            value={warehouseId}
            onChange={e => setWarehouseId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">ทุกคลังสินค้า</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-6">
        {loading ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
          </div>
        ) : groupedStocks.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <p className="text-gray-500 text-lg">ไม่พบข้อมูลสินค้าในคลัง</p>
          </div>
        ) : (
          groupedStocks.map(group => (
            <div key={group.warehouseId} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <WarehouseIcon className="h-5 w-5 text-gray-500" />
                  {group.warehouseName}
                </h3>
                <span className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">
                  {group.products.length} รายการ
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-white border-b border-gray-100">
                      <th className="px-6 py-3 text-left w-10"></th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-600">สินค้า (SKU) / Lot</th>
                      <th className="px-6 py-3 text-right font-semibold text-gray-600">รับเข้า</th>
                      <th className="px-6 py-3 text-right font-semibold text-gray-600">ขาย</th>
                      <th className="px-6 py-3 text-right font-semibold text-gray-600">คงเหลือ</th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-600">วันหมดอายุ</th>
                      <th className="px-6 py-3 text-center font-semibold text-gray-600">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {group.products.map(prod => {
                      const expandKey = `${group.warehouseId}-${prod.productId}`;
                      const isExpanded = expandedProducts[expandKey];
                      const productObj = products.find(p => p.id === prod.productId);

                      return (
                        <React.Fragment key={prod.productId}>
                          {/* Product Main Row */}
                          <tr
                            className={`transition-colors cursor-pointer border-l-4 ${isExpanded ? 'bg-indigo-50 border-indigo-500' : 'hover:bg-gray-50 border-transparent'}`}
                            onClick={() => toggleExpand(expandKey)}
                          >
                            <td className="px-6 py-4 text-center">
                              {isExpanded ? <ChevronDown className="h-4 w-4 text-indigo-600" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                            </td>
                            <td className="px-6 py-4 font-medium text-gray-800">
                              <div className="flex flex-col">
                                <span className={`text-base ${isExpanded ? 'text-indigo-900 font-semibold' : ''}`}>{prod.name}</span>
                                <span className="text-xs text-gray-500">{prod.sku}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-gray-700 font-semibold">{prod.totalQty.toLocaleString()}</td>
                            <td className="px-6 py-4 text-right font-mono text-amber-600">{prod.totalReserved.toLocaleString()}</td>
                            <td className="px-6 py-4 text-right font-mono text-green-600 font-bold">{prod.totalAvailable.toLocaleString()}</td>
                            <td className="px-6 py-4 text-gray-400">-</td>
                            <td className="px-6 py-4 text-center" onClick={e => e.stopPropagation()}>
                              {productObj && (
                                <button
                                  onClick={() => setSelectedProductForLot(productObj)}
                                  className={`p-1.5 rounded-full transition-colors ${isExpanded ? 'bg-white text-indigo-600 shadow-sm' : 'text-indigo-600 hover:bg-indigo-50'}`}
                                  title="จัดการ Lot"
                                >
                                  <PackagePlus size={18} />
                                </button>
                              )}
                            </td>
                          </tr>

                          {/* Expanded Lot Rows (Flattened) */}
                          {isExpanded && prod.lots.map((lot, idx) => (
                            <tr key={`${prod.productId}-lot-${idx}`} className="bg-gray-50 hover:bg-gray-100 transition-colors border-l-4 border-indigo-500">
                              <td className="px-6 py-3"></td>
                              <td className="px-6 py-3 relative">
                                <div className="flex items-center pl-4 ml-1">
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 mr-2"></div>
                                  <span className="text-sm text-gray-700 font-medium">{lot.lot_number ?? lot.lotNumber ?? '-'}</span>
                                  {lot.received_date && (
                                    <span className="ml-2 text-xs text-gray-400">(รับเข้า: {lot.received_date})</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-3 text-right text-sm text-gray-600">{Number(lot.quantity || 0).toLocaleString()}</td>
                              <td className="px-6 py-3 text-right text-sm text-amber-600">{Number(lot.reserved_quantity || 0).toLocaleString()}</td>
                              <td className="px-6 py-3 text-right text-sm text-green-600 font-bold">{Number(lot.available_quantity || 0).toLocaleString()}</td>
                              <td className="px-6 py-3 text-sm text-gray-500">{lot.expiry_date ?? lot.expiryDate ?? '-'}</td>
                              <td className="px-6 py-3"></td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Lot Management Modal */}
      {selectedProductForLot && (
        <LotManagementModal
          product={selectedProductForLot}
          warehouses={warehouses}
          onClose={() => setSelectedProductForLot(null)}
          onSave={() => {
            loadStocks();
            // We usually keep the modal open or close depending on UX preference.
            // But since onSave triggers "refresh", we can assume user might want to see result.
            // If the modal handles multi-add/edit, maybe keep open?
            // For now, let's close it to be safe or follow previous pattern.
            // The previous code had comment: // Optional: setSelectedProductForLot(null); 
            // I'll leave it open if the user wants to add more, checking current UX pattern.
            // Actually, typically modals close on save unless it's a "Save & Add Another" type.
            // LotManagementModal likely has its own internal state management.
            // Let's close it for now as safe default.
            setSelectedProductForLot(null);
          }}
        />
      )}
    </div>
  );
};

export default WarehouseStockViewPage;
