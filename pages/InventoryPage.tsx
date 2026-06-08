import React, { useState, useEffect, useMemo } from 'react';
import { Package, Search, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { fetchJstInventory } from '@/services/api';

interface InventoryItem {
  skuId: string;
  skuName: string;
  warehouseName: string;
  qty: number;
  availableQty: number;
  orderLock: number;
  pic: string;
  updatedAt: string;
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');

  const loadInventory = async (force: boolean = false) => {
    try {
      if (force) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const res = await fetchJstInventory(force);
      if (res && res.ok && res.data) {
        setInventory(res.data);
      } else {
        throw new Error(res?.message || 'Failed to fetch inventory');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลสต็อก');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadInventory(false);
  }, []);

  const warehouses = useMemo(() => {
    const whs = new Set<string>();
    inventory.forEach((item) => {
      if (item.warehouseName) {
        whs.add(item.warehouseName);
      }
    });
    return Array.from(whs).sort();
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const matchesSearch =
        item.skuId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.skuName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesWarehouse =
        selectedWarehouse === 'all' || item.warehouseName === selectedWarehouse;
      return matchesSearch && matchesWarehouse;
    });
  }, [inventory, searchTerm, selectedWarehouse]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="w-6 h-6 text-indigo-600" />
            คลังสินค้า (JST ERP)
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            ข้อมูลสต็อกสินค้าคงคลัง อัปเดตแบบเรียลไทม์จากระบบ JST ERP
          </p>
        </div>
        <button
          onClick={() => loadInventory(true)}
          disabled={loading || refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'กำลังอัปเดต...' : 'ดึงข้อมูลล่าสุด'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">ไม่สามารถเชื่อมต่อ JST ERP ได้</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-200px)] min-h-[500px]">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 bg-slate-50">
          <div className="relative flex-1 max-w-md">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหารหัส SKU หรือ ชื่อสินค้า..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="all">ทุกคลังสินค้า</option>
            {warehouses.map((wh) => (
              <option key={wh} value={wh}>
                {wh}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading && !inventory.length ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
              <p>กำลังโหลดข้อมูลสต็อก...</p>
            </div>
          ) : inventory.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Package className="w-12 h-12 mb-4 text-slate-300" />
              <p>ไม่พบข้อมูลสินค้าในระบบ JST</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-white sticky top-0 shadow-sm z-10">
                <tr>
                  <th className="py-3 px-4 text-sm font-semibold text-slate-600 border-b border-slate-200">
                    SKU / สินค้า
                  </th>
                  <th className="py-3 px-4 text-sm font-semibold text-slate-600 border-b border-slate-200">
                    คลังสินค้า
                  </th>
                  <th className="py-3 px-4 text-sm font-semibold text-slate-600 text-right border-b border-slate-200">
                    ทั้งหมด
                  </th>
                  <th className="py-3 px-4 text-sm font-semibold text-emerald-600 text-right border-b border-slate-200">
                    พร้อมขาย
                  </th>
                  <th className="py-3 px-4 text-sm font-semibold text-orange-600 text-right border-b border-slate-200">
                    จองแล้ว
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInventory.map((item, index) => (
                  <tr key={`${item.skuId}-${item.warehouseName}-${index}`} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {item.pic ? (
                          <img src={item.pic} alt={item.skuId} className="w-10 h-10 rounded object-cover border border-slate-200 bg-white" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center border border-slate-200">
                            <Package className="w-5 h-5 text-slate-400" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-slate-900">{item.skuId}</div>
                          <div className="text-xs text-slate-500 line-clamp-1">{item.skuName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">
                      {item.warehouseName}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-medium text-slate-700">{item.qty}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-bold ${item.availableQty > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {item.availableQty}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-medium text-orange-600">{item.orderLock}</span>
                    </td>
                  </tr>
                ))}
                {filteredInventory.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      ไม่พบสินค้าที่ตรงกับการค้นหา
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        <div className="bg-slate-50 p-3 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
          <span>แสดง {filteredInventory.length} รายการ (จากทั้งหมด {inventory.length} รายการ)</span>
          {inventory.length > 0 && (
            <span>อัปเดตล่าสุด: {new Date(inventory[0]?.updatedAt || Date.now()).toLocaleString('th-TH')}</span>
          )}
        </div>
      </div>
    </div>
  );
}
