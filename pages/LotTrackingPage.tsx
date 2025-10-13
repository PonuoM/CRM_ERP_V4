import React, { useEffect, useMemo, useState } from 'react';
import { Layers, AlertCircle } from 'lucide-react';
import { User, Warehouse } from '@/types';
import { listProductLots, listWarehouses, listProducts, listStockMovements } from '@/services/api';

interface LotTrackingPageProps {
  currentUser?: User;
  companyId?: number;
}

const LotTrackingPage: React.FC<LotTrackingPageProps> = ({ currentUser, companyId }) => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([] as any);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouseId, setWarehouseId] = useState<number | ''>('');
  const [productId, setProductId] = useState<number | ''>('');
  const [lotQuery, setLotQuery] = useState('');
  const [lots, setLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLot, setSelectedLot] = useState<string | null>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const effectiveCompanyId = companyId ?? currentUser?.companyId ?? 1;

  const loadMeta = async () => {
    try {
      const [whs, prods] = await Promise.all([
        listWarehouses(effectiveCompanyId),
        listProducts(),
      ]);
      setWarehouses(whs as any);
      setProducts(prods);
    } catch (err) {
      console.error('Error loading metadata:', err);
      setError('ไม่สามารถโหลดข้อมูลพื้นฐานได้');
    }
  };

  const loadLots = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (warehouseId) params.warehouseId = warehouseId;
      if (productId) params.productId = productId;
      if (lotQuery) params.lotNumber = lotQuery;
      
      console.log('Loading lots with params:', params);
      const rows = await listProductLots(params);
      console.log('Lots loaded:', rows);
      
      setLots(rows || []);
      
      // ถ้าไม่มีข้อมูลและไม่ได้กรอง แสดงข้อความแนะนำ
      if (!rows || rows.length === 0) {
        if (!warehouseId && !productId && !lotQuery) {
          setError('ไม่พบข้อมูล Lot ในระบบ กรุณาตรวจสอบว่าได้รับสินค้าเข้าคลังแล้วหรือไม่');
        }
      }
    } catch (err) {
      console.error('Error loading lots:', err);
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล Lot');
      setLots([]);
    } finally { 
      setLoading(false); 
    }
  };

  const loadMovements = async (lotNumber: string) => {
    try {
      const rows = await listStockMovements({ lotNumber });
      setMovements(rows || []);
    } catch (err) {
      console.error('Error loading movements:', err);
      setMovements([]);
    }
  };

  useEffect(() => { loadMeta(); }, [effectiveCompanyId]);
  useEffect(() => { loadLots(); }, [warehouseId, productId, lotQuery]);

  const filtered = useMemo(() => lots, [lots]);

  // ฟังก์ชันสำหรับหาชื่อคลังสินค้า
  const getWarehouseName = (warehouseId: number) => {
    const warehouse = warehouses.find(w => w.id === warehouseId);
    return warehouse ? warehouse.name : `คลัง ${warehouseId}`;
  };

  // ฟังก์ชันสำหรับหาชื่อสินค้า
  const getProductName = (productId: number) => {
    const product = products.find(p => p.id === productId);
    return product ? `${product.sku} - ${product.name}` : `สินค้า ID: ${productId}`;
  };

  return (
    <div className="p-6 bg-[#F5F5F5] min-h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center"><Layers className="h-5 w-5 mr-2"/>Lot Tracking</h2>
      </div>
      
      {error && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex items-center gap-3 mb-4">
        <select className="border rounded px-3 py-2" value={warehouseId} onChange={e => setWarehouseId(e.target.value ? Number(e.target.value) : '')}>
          <option value="">ทุกคลัง</option>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select className="border rounded px-3 py-2" value={productId} onChange={e => setProductId(e.target.value ? Number(e.target.value) : '')}>
          <option value="">ทุกสินค้า</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
        </select>
        <input className="w-80 border rounded px-3 py-2" placeholder="ค้นหา Lot Number" value={lotQuery} onChange={e => setLotQuery(e.target.value)} />
        <button 
          onClick={loadLots}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          ค้นหา
        </button>
      </div>

      <div className="bg-white rounded-md shadow overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Lot</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">สินค้า</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">คลัง</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">รับเข้า</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">คงเหลือ</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">หมดอายุ</th>
              <th className="px-6 py-3"/>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td className="px-6 py-8" colSpan={7}>กำลังโหลด...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="px-6 py-8 text-gray-500" colSpan={7}>
                {warehouseId || productId || lotQuery ? 'ไม่พบข้อมูลตามเงื่อนไขที่ค้นหา' : 'ไม่พบข้อมูล Lot ในระบบ'}
              </td></tr>
            ) : filtered.map((l: any, idx: number) => (
              <tr key={idx}>
                <td className="px-6 py-2">{l.lot_number}</td>
                <td className="px-6 py-2">{getProductName(l.product_id)}</td>
                <td className="px-6 py-2">{getWarehouseName(l.warehouse_id)}</td>
                <td className="px-6 py-2 text-right">{Number(l.quantity_received).toFixed(2)}</td>
                <td className="px-6 py-2 text-right">{Number(l.quantity_remaining).toFixed(2)}</td>
                <td className="px-6 py-2">{l.expiry_date ?? '-'}</td>
                <td className="px-6 py-2 text-right">
                  <button className="text-sm text-blue-600" onClick={async () => { setSelectedLot(l.lot_number); await loadMovements(l.lot_number); }}>Movement</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedLot && (
        <div className="bg-white rounded-md shadow p-4 mt-4">
          <div className="font-medium text-gray-700 mb-2">ประวัติการเคลื่อนไหว Lot: {selectedLot}</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left py-1">เวลา</th>
                <th className="text-left py-1">ประเภท</th>
                <th className="text-right py-1">จำนวน</th>
                <th className="text-left py-1">อ้างอิง</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr><td className="py-2 text-gray-500" colSpan={4}>ไม่มีข้อมูล</td></tr>
              ) : movements.map((m: any, i: number) => (
                <tr key={i}>
                  <td className="py-1">{m.created_at}</td>
                  <td className="py-1">{m.movement_type}</td>
                  <td className="py-1 text-right">{m.quantity}</td>
                  <td className="py-1">{m.reference_type} {m.reference_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LotTrackingPage;

