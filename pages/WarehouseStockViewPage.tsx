import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, PackagePlus } from 'lucide-react';
import { Warehouse, User, Product } from '@/types';
import { listWarehouseStocks, listWarehouses, listProducts } from '@/services/api';
import LotManagementModal from '@/components/LotManagementModal';

interface WarehouseStockViewPageProps {
  currentUser?: User;
  companyId?: number;
}

const WarehouseStockViewPage: React.FC<WarehouseStockViewPageProps> = ({ currentUser, companyId }) => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([] as any);
  const [warehouseId, setWarehouseId] = useState<number | ''>('');
  const [stocks, setStocks] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

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

  const filtered = useMemo(() => stocks.filter(s => {
    const p = products.find(pr => pr.id === Number(s.product_id ?? s.productId));
    const name = p ? `${p.sku} ${p.name}` : String(s.product_id ?? s.productId);
    const lot = String(s.lot_number ?? s.lotNumber ?? '');
    const hay = `${name} ${lot}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  }), [stocks, products, q]);

  // Group stocks by product to show one row per product (optional) or keep list?
  // User asked for "Create Lot". Usually created per product.
  // The current table lists STOCKS (which might be per lot).
  // If we want to "Create Lot", we usually do it for a product.
  // Let's add the button to the rows. If a row is a specific lot, we can still open the modal for that product.

  return (
    <div className="p-6 bg-[#F5F5F5] min-h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center"><Boxes className="h-5 w-5 mr-2" />Warehouse Stock</h2>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <select className="border rounded px-3 py-2" value={warehouseId} onChange={e => setWarehouseId(e.target.value ? Number(e.target.value) : '')}>
          <option value="">ทุกคลัง</option>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <input className="w-80 border rounded px-3 py-2" placeholder="ค้นหา SKU/ชื่อ/Lot" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      <div className="bg-white rounded-md shadow overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">คลัง</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">สินค้า</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Lot</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">คงเหลือ</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">จอง</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">พร้อมขาย</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">หมดอายุ</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 w-20">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td className="px-6 py-8" colSpan={8}>กำลังโหลด...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="px-6 py-8 text-gray-500" colSpan={8}>ไม่พบข้อมูล</td></tr>
            ) : filtered.map((s, idx) => {
              const w = warehouses.find(wh => wh.id === Number(s.warehouse_id ?? s.warehouseId));
              const p = products.find(pr => pr.id === Number(s.product_id ?? s.productId));
              return (
                <tr key={idx}>
                  <td className="px-6 py-2">{w?.name || s.warehouse_id}</td>
                  <td className="px-6 py-2">{p ? `${p.sku} - ${p.name}` : s.product_id}</td>
                  <td className="px-6 py-2">{s.lot_number ?? s.lotNumber ?? '-'}</td>
                  <td className="px-6 py-2 text-right">{s.quantity ?? s.quantity}</td>
                  <td className="px-6 py-2 text-right">{s.reserved_quantity ?? s.reservedQuantity ?? 0}</td>
                  <td className="px-6 py-2 text-right">{s.available_quantity ?? s.availableQuantity ?? ((Number(s.quantity || 0) - Number(s.reserved_quantity || 0)))}</td>
                  <td className="px-6 py-2">{s.expiry_date ?? s.expiryDate ?? '-'}</td>
                  <td className="px-6 py-2 text-center">
                    {p && (
                      <button
                        onClick={() => setSelectedProductForLot(p)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="จัดการ Lot"
                      >
                        <PackagePlus size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Lot Management Modal */}
      {selectedProductForLot && (
        <LotManagementModal
          product={selectedProductForLot}
          warehouses={warehouses}
          onClose={() => setSelectedProductForLot(null)}
          onSave={() => {
            loadStocks();
            // Optional: setSelectedProductForLot(null); // Keep open or close? Usually close if 'saved' implies done. 
            // The modal has its own close/save logic. 
            // If LotManagementModal calls onSave, it means lots were updated. We should refresh current view.
          }}
        />
      )}
    </div>
  );
};

export default WarehouseStockViewPage;
