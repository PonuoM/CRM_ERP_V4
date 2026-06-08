import React, { useState, useEffect, useMemo } from 'react';
import { Package, Search, RefreshCw, AlertCircle, Loader2, Settings } from 'lucide-react';
import { fetchJstInventory } from '@/services/api';
import CompanySettingsPage from './CompanySettingsPage';

import Chart from 'react-apexcharts';

interface InventoryItem {
  skuId: string;
  skuName: string;
  warehouseName: string;
  qty: number;
  availableQty: number;
  orderLock: number;
  pic: string;
  updatedAt: string;
  defectiveQty: number;
  inQty: number;
  purchaseQty: number;
  returnQty: number;
  brandName: string;
  supplierName: string;
  daySale3: number;
  daySale7: number;
  daySale15: number;
  daySale30: number;
  daySale60: number;
  daySale90: number;
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'inventory' | 'settings'>('inventory');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const sessionUserStr = localStorage.getItem("sessionUser");
  const sessionUser = sessionUserStr ? JSON.parse(sessionUserStr) : null;
  const canViewSettings = sessionUser?.role === "Super Admin" || sessionUser?.role === "Developer" || sessionUser?.is_system === 1;

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
    if (activeTab === 'inventory') {
      loadInventory(false);
    }
  }, [activeTab]);

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
            สินค้าคงคลัง JST
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            ข้อมูลสต็อกสินค้าคงคลัง อัปเดตแบบเรียลไทม์จากระบบ JST ERP
          </p>
        </div>
        {activeTab === 'inventory' && (
          <button
            onClick={() => loadInventory(true)}
            disabled={loading || refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'กำลังอัปเดต...' : 'ดึงข้อมูลล่าสุด'}
          </button>
        )}
      </div>

      {canViewSettings && (
        <div className="border-b border-slate-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('inventory')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'inventory'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Package className="w-4 h-4" />
              ตารางแสดงจำนวน
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'settings'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Settings className="w-4 h-4" />
              ตั้งค่าบริษัท
            </button>
          </nav>
        </div>
      )}

      {activeTab === 'settings' ? (
        <div className="-mx-6">
          <CompanySettingsPage />
        </div>
      ) : (
        <>
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
                    {filteredInventory.map((item, index) => {
                      const rowId = `${item.skuId}-${item.warehouseName}-${index}`;
                      const isExpanded = expandedRows.has(rowId);
                      return (
                        <React.Fragment key={rowId}>
                          <tr 
                            onClick={() => toggleRow(rowId)}
                            className="hover:bg-slate-50 cursor-pointer transition-colors"
                          >
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
                                  {item.brandName && (
                                    <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                                      {item.brandName}
                                    </span>
                                  )}
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
                          {isExpanded && (
                            <tr>
                              <td colSpan={5} className="bg-slate-50 p-4 border-b border-slate-200 shadow-inner">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {/* Stock Breakdown */}
                                  <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                                    <h4 className="text-sm font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">รายละเอียดสต็อกเบื้องลึก</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <p className="text-xs text-slate-500">พร้อมขาย (Available)</p>
                                        <p className="text-lg font-bold text-emerald-600">{item.availableQty}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-slate-500">จองแล้ว (Order Locked)</p>
                                        <p className="text-lg font-bold text-orange-600">{item.orderLock}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-slate-500">ของเสีย/มีตำหนิ (Defective)</p>
                                        <p className="text-lg font-bold text-red-600">{item.defectiveQty}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-slate-500">ของตีกลับ (Return)</p>
                                        <p className="text-lg font-bold text-amber-600">{item.returnQty}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-slate-500">กำลังรับเข้า (In Qty)</p>
                                        <p className="text-lg font-bold text-blue-600">{item.inQty}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-slate-500">กำลังสั่งซื้อ (Purchasing)</p>
                                        <p className="text-lg font-bold text-indigo-600">{item.purchaseQty}</p>
                                      </div>
                                    </div>
                                    {item.supplierName && (
                                      <div className="mt-4 pt-3 border-t border-slate-100">
                                        <p className="text-xs text-slate-500">ซัพพลายเออร์ (Supplier)</p>
                                        <p className="text-sm font-medium text-slate-800 line-clamp-1">{item.supplierName}</p>
                                      </div>
                                    )}
                                  </div>

                                  {/* Sales Performance Chart */}
                                  <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                                    <h4 className="text-sm font-semibold text-slate-800 mb-2 border-b border-slate-100 pb-2">ยอดขายสะสมย้อนหลัง (ชิ้น)</h4>
                                    <Chart
                                      options={{
                                        chart: { type: 'bar', toolbar: { show: false }, height: 200, parentHeightOffset: 0 },
                                        plotOptions: { bar: { borderRadius: 4, horizontal: false, columnWidth: '50%' } },
                                        dataLabels: { enabled: true, style: { fontSize: '10px' } },
                                        xaxis: { categories: ['3 วัน', '7 วัน', '15 วัน', '30 วัน', '60 วัน', '90 วัน'] },
                                        colors: ['#4f46e5'],
                                        grid: { strokeDashArray: 4 },
                                      }}
                                      series={[{
                                        name: 'ยอดขายสะสม (ชิ้น)',
                                        data: [item.daySale3, item.daySale7, item.daySale15, item.daySale30, item.daySale60, item.daySale90]
                                      }]}
                                      type="bar"
                                      height={200}
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
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
        </>
      )}
    </div>
  );
}
