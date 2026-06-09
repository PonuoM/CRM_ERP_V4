import React, { useState, useEffect, useMemo } from 'react';
import { Package, Search, RefreshCw, AlertCircle, Loader2, Settings, Download, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { fetchJstInventory } from '@/services/api';
import CompanySettingsPage from './CompanySettingsPage';
import * as XLSX from 'xlsx';

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

interface GroupedInventoryItem {
  skuId: string;
  skuName: string;
  pic: string;
  brandName: string;
  qty: number;
  availableQty: number;
  orderLock: number;
  defectiveQty: number;
  inQty: number;
  purchaseQty: number;
  returnQty: number;
  daySale3: number;
  daySale7: number;
  daySale15: number;
  daySale30: number;
  daySale60: number;
  daySale90: number;
  warehouses: InventoryItem[];
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'inventory' | 'inventory_grouped' | 'settings'>('inventory');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof InventoryItem, direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: keyof InventoryItem) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

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
    if (activeTab === 'inventory' || activeTab === 'inventory_grouped') {
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
    let result = inventory.filter((item) => {
      const matchesSearch =
        item.skuId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.skuName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesWarehouse =
        selectedWarehouse === 'all' || item.warehouseName === selectedWarehouse;
      const matchesLowStock = !showLowStockOnly || item.availableQty < 10;
      return matchesSearch && matchesWarehouse && matchesLowStock;
    });

    if (sortConfig !== null) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [inventory, searchTerm, selectedWarehouse, showLowStockOnly, sortConfig]);

  const groupedInventory = useMemo(() => {
    const groupMap = new Map<string, GroupedInventoryItem>();

    filteredInventory.forEach((item) => {
      if (!groupMap.has(item.skuId)) {
        groupMap.set(item.skuId, {
          skuId: item.skuId,
          skuName: item.skuName,
          pic: item.pic,
          brandName: item.brandName,
          qty: 0,
          availableQty: 0,
          orderLock: 0,
          defectiveQty: 0,
          inQty: 0,
          purchaseQty: 0,
          returnQty: 0,
          daySale3: 0,
          daySale7: 0,
          daySale15: 0,
          daySale30: 0,
          daySale60: 0,
          daySale90: 0,
          warehouses: []
        });
      }

      const group = groupMap.get(item.skuId)!;
      group.qty += item.qty || 0;
      group.availableQty += item.availableQty || 0;
      group.orderLock += item.orderLock || 0;
      group.defectiveQty += item.defectiveQty || 0;
      group.inQty += item.inQty || 0;
      group.purchaseQty += item.purchaseQty || 0;
      group.returnQty += item.returnQty || 0;
      
      // Assume sales are the same for the SKU across warehouses in JST ERP? 
      // JST ERP usually returns total sales per SKU or per Warehouse-SKU?
      // Typically we sum them up or just take the max if it's already SKU-level. Let's sum them up to be safe if it's per warehouse.
      group.daySale3 += item.daySale3 || 0;
      group.daySale7 += item.daySale7 || 0;
      group.daySale15 += item.daySale15 || 0;
      group.daySale30 += item.daySale30 || 0;
      group.daySale60 += item.daySale60 || 0;
      group.daySale90 += item.daySale90 || 0;

      group.warehouses.push(item);
    });

    const result = Array.from(groupMap.values());
    
    // Use the same sort config
    if (sortConfig !== null) {
      result.sort((a, b) => {
        // @ts-ignore
        const aVal = a[sortConfig.key];
        // @ts-ignore
        const bVal = b[sortConfig.key];
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [filteredInventory, sortConfig]);

  const handleExportExcel = () => {
    const dataToExport = activeTab === 'inventory_grouped' ? groupedInventory : filteredInventory;
    if (dataToExport.length === 0) return;

    const exportData = dataToExport.map(item => {
      if (activeTab === 'inventory_grouped') {
        const groupedItem = item as GroupedInventoryItem;
        return {
          'SKU ID': groupedItem.skuId,
          'ชื่อสินค้า': groupedItem.skuName,
          'รวมทุกคลัง': groupedItem.warehouses.map(w => w.warehouseName).join(', '),
          'ทั้งหมด': groupedItem.qty,
          'พร้อมขาย': groupedItem.availableQty,
          'จองแล้ว': groupedItem.orderLock,
          'ของเสีย/มีตำหนิ': groupedItem.defectiveQty,
          'กำลังรับเข้า': groupedItem.inQty,
          'ของตีกลับ': groupedItem.returnQty,
          'กำลังสั่งซื้อ': groupedItem.purchaseQty,
          'แบรนด์': groupedItem.brandName,
          'ยอดขายย้อนหลัง 3 วัน': groupedItem.daySale3,
          'ยอดขายย้อนหลัง 7 วัน': groupedItem.daySale7,
          'ยอดขายย้อนหลัง 15 วัน': groupedItem.daySale15,
          'ยอดขายย้อนหลัง 30 วัน': groupedItem.daySale30,
          'ยอดขายย้อนหลัง 60 วัน': groupedItem.daySale60,
          'ยอดขายย้อนหลัง 90 วัน': groupedItem.daySale90,
        };
      } else {
        const singleItem = item as InventoryItem;
        return {
          'SKU ID': singleItem.skuId,
          'ชื่อสินค้า': singleItem.skuName,
          'คลังสินค้า': singleItem.warehouseName,
          'ทั้งหมด': singleItem.qty,
          'พร้อมขาย': singleItem.availableQty,
          'จองแล้ว': singleItem.orderLock,
          'ของเสีย/มีตำหนิ': singleItem.defectiveQty,
          'กำลังรับเข้า': singleItem.inQty,
          'ของตีกลับ': singleItem.returnQty,
          'กำลังสั่งซื้อ': singleItem.purchaseQty,
          'แบรนด์': singleItem.brandName,
          'ซัพพลายเออร์': singleItem.supplierName,
          'ยอดขายย้อนหลัง 3 วัน': singleItem.daySale3,
          'ยอดขายย้อนหลัง 7 วัน': singleItem.daySale7,
          'ยอดขายย้อนหลัง 15 วัน': singleItem.daySale15,
          'ยอดขายย้อนหลัง 30 วัน': singleItem.daySale30,
          'ยอดขายย้อนหลัง 60 วัน': singleItem.daySale60,
          'ยอดขายย้อนหลัง 90 วัน': singleItem.daySale90,
          'อัปเดตล่าสุด': new Date(singleItem.updatedAt).toLocaleString('th-TH')
        };
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');
    XLSX.writeFile(workbook, `JST_Inventory_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

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
        {activeTab !== 'settings' && (
          <div className="flex gap-2">
            <button
              onClick={handleExportExcel}
              disabled={activeTab === 'inventory_grouped' ? groupedInventory.length === 0 : filteredInventory.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">ดาวน์โหลดรายงาน</span>
            </button>
            <button
              onClick={() => loadInventory(true)}
              disabled={loading || refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'กำลังอัปเดต...' : 'ดึงข้อมูลล่าสุด'}
            </button>
          </div>
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
              แยกตามคลัง
            </button>
            <button
              onClick={() => setActiveTab('inventory_grouped')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'inventory_grouped'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Package className="w-4 h-4" />
              รวมทุกคลัง
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
              
              <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors">
                <input 
                  type="checkbox" 
                  className="rounded border-slate-300 text-red-500 focus:ring-red-500 w-4 h-4"
                  checked={showLowStockOnly}
                  onChange={(e) => setShowLowStockOnly(e.target.checked)}
                />
                <span className="text-sm font-medium text-slate-700">เฉพาะสินค้าพร้อมขาย {'< 10'} ชิ้น</span>
              </label>
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
                      <th onClick={() => handleSort('skuId')} className="py-3 px-4 text-sm font-semibold text-slate-600 border-b border-slate-200 cursor-pointer hover:bg-slate-50">
                        <div className="flex items-center gap-1">SKU / สินค้า {sortConfig?.key === 'skuId' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>) : <ArrowUpDown className="w-3 h-3 text-slate-300"/>}</div>
                      </th>
                      <th onClick={() => handleSort('warehouseName')} className="py-3 px-4 text-sm font-semibold text-slate-600 border-b border-slate-200 cursor-pointer hover:bg-slate-50">
                        <div className="flex items-center gap-1">คลังสินค้า {sortConfig?.key === 'warehouseName' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>) : <ArrowUpDown className="w-3 h-3 text-slate-300"/>}</div>
                      </th>
                      <th onClick={() => handleSort('qty')} className="py-3 px-4 text-sm font-semibold text-slate-600 border-b border-slate-200 cursor-pointer hover:bg-slate-50">
                        <div className="flex items-center justify-end gap-1">ทั้งหมด {sortConfig?.key === 'qty' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>) : <ArrowUpDown className="w-3 h-3 text-slate-300"/>}</div>
                      </th>
                      <th onClick={() => handleSort('availableQty')} className="py-3 px-4 text-sm font-semibold text-emerald-600 border-b border-slate-200 cursor-pointer hover:bg-emerald-50">
                        <div className="flex items-center justify-end gap-1">พร้อมขาย {sortConfig?.key === 'availableQty' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>) : <ArrowUpDown className="w-3 h-3 text-emerald-300"/>}</div>
                      </th>
                      <th onClick={() => handleSort('orderLock')} className="py-3 px-4 text-sm font-semibold text-orange-600 border-b border-slate-200 cursor-pointer hover:bg-orange-50">
                        <div className="flex items-center justify-end gap-1">จองแล้ว {sortConfig?.key === 'orderLock' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>) : <ArrowUpDown className="w-3 h-3 text-orange-300"/>}</div>
                      </th>
                      <th onClick={() => handleSort('daySale7')} className="py-3 px-4 text-sm font-semibold text-indigo-600 border-b border-slate-200 cursor-pointer hover:bg-indigo-50">
                        <div className="flex items-center justify-end gap-1" title="ยอดขายสะสมย้อนหลัง 7 วัน">ยอดขาย(7D) {sortConfig?.key === 'daySale7' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>) : <ArrowUpDown className="w-3 h-3 text-indigo-300"/>}</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeTab === 'inventory' ? filteredInventory.map((item, index) => {
                      const rowId = `single-${item.skuId}-${item.warehouseName}-${index}`;
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
                            <td className="py-3 px-4 text-right">
                              <span className="font-medium text-indigo-600">{item.daySale7}</span>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={6} className="bg-slate-50 p-4 border-b border-slate-200 shadow-inner">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {/* Stock Breakdown */}
                                  <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 min-w-0">
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
                                  <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 min-w-0 overflow-hidden">
                                    <h4 className="text-sm font-semibold text-slate-800 mb-2 border-b border-slate-100 pb-2">ยอดขายสะสมย้อนหลัง (ชิ้น)</h4>
                                    <div className="w-full relative">
                                      <Chart
                                        options={{
                                          chart: { type: 'bar', toolbar: { show: false }, height: 200, parentHeightOffset: 0, width: '100%' },
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
                                        width="100%"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                    : groupedInventory.map((group, index) => {
                        const rowId = `group-${group.skuId}-${index}`;
                        const isExpanded = expandedRows.has(rowId);
                        return (
                          <React.Fragment key={rowId}>
                            <tr 
                              onClick={() => toggleRow(rowId)}
                              className="hover:bg-slate-50 cursor-pointer transition-colors bg-indigo-50/30"
                            >
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  {group.pic ? (
                                    <img src={group.pic} alt={group.skuId} className="w-10 h-10 rounded object-cover border border-slate-200 bg-white" />
                                  ) : (
                                    <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center border border-slate-200">
                                      <Package className="w-5 h-5 text-slate-400" />
                                    </div>
                                  )}
                                  <div>
                                    <div className="font-medium text-slate-900">{group.skuId}</div>
                                    <div className="text-xs text-slate-500 line-clamp-1">{group.skuName}</div>
                                    {group.brandName && (
                                      <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                                        {group.brandName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-600">
                                รวมทุกคลัง ({group.warehouses.length})
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className="font-medium text-slate-700">{group.qty}</span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className={`font-bold ${group.availableQty > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {group.availableQty}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className="font-medium text-orange-600">{group.orderLock}</span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className="font-medium text-indigo-600">{group.daySale7}</span>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={6} className="bg-slate-50 p-4 border-b border-slate-200 shadow-inner">
                                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="p-3 bg-slate-100 border-b border-slate-200">
                                      <h4 className="text-sm font-semibold text-slate-800">สถิติแจกแจงตามคลังสินค้า</h4>
                                    </div>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-left text-sm border-collapse">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                          <tr>
                                            <th className="py-2 px-4 font-semibold text-slate-600">คลังสินค้า</th>
                                            <th className="py-2 px-4 font-semibold text-slate-600 text-right">ทั้งหมด</th>
                                            <th className="py-2 px-4 font-semibold text-emerald-600 text-right">พร้อมขาย</th>
                                            <th className="py-2 px-4 font-semibold text-orange-600 text-right">จองแล้ว</th>
                                            <th className="py-2 px-4 font-semibold text-red-600 text-right">มีตำหนิ</th>
                                            <th className="py-2 px-4 font-semibold text-amber-600 text-right">ตีกลับ</th>
                                            <th className="py-2 px-4 font-semibold text-blue-600 text-right">กำลังรับเข้า</th>
                                            <th className="py-2 px-4 font-semibold text-indigo-600 text-right">กำลังสั่งซื้อ</th>
                                            <th className="py-2 px-4 font-semibold text-slate-600 text-right">ขาย (7D)</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {group.warehouses.map((whItem, wIndex) => (
                                            <tr key={wIndex} className="hover:bg-slate-50">
                                              <td className="py-2 px-4 font-medium text-slate-700">{whItem.warehouseName}</td>
                                              <td className="py-2 px-4 text-right">{whItem.qty}</td>
                                              <td className="py-2 px-4 text-right font-medium text-emerald-600">{whItem.availableQty}</td>
                                              <td className="py-2 px-4 text-right text-orange-600">{whItem.orderLock}</td>
                                              <td className="py-2 px-4 text-right text-red-600">{whItem.defectiveQty}</td>
                                              <td className="py-2 px-4 text-right text-amber-600">{whItem.returnQty}</td>
                                              <td className="py-2 px-4 text-right text-blue-600">{whItem.inQty}</td>
                                              <td className="py-2 px-4 text-right text-indigo-600">{whItem.purchaseQty}</td>
                                              <td className="py-2 px-4 text-right text-slate-600">{whItem.daySale7}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    {(activeTab === 'inventory' ? filteredInventory : groupedInventory).length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          ไม่พบสินค้าที่ตรงกับการค้นหา
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
            <div className="bg-slate-50 p-3 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
              <span>แสดง {(activeTab === 'inventory' ? filteredInventory : groupedInventory).length} รายการ (จากทั้งหมด {activeTab === 'inventory' ? inventory.length : new Set(inventory.map(i => i.skuId)).size} รายการ)</span>
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
