import React, { useState, useEffect, useMemo } from 'react';
import { Package, Search, RefreshCw, AlertCircle, Loader2, Settings, Download, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
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
  warehouses?: InventoryItem[]; // for grouped data
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [limit, setLimit] = useState(50);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<{time: string | null, source: string}>({time: null, source: 'Unknown'});
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'inventory' | 'inventory_grouped' | 'settings'>('inventory_grouped');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'sku_id', direction: 'asc' });

  // List of warehouses should ideally come from backend, but since we don't have a specific endpoint, 
  // we could hardcode standard ones or leave it as a simple string input. For now, let's keep basic standard ones or 'all'.
  // We'll provide a fixed list since we can't extract them from all pages without loading them all.
  const predefinedWarehouses = ['คลังสินค้าหลัก', 'คลังสินค้าสำรอง', 'คลังสินค้าออนไลน์'];

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
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
  const canViewSettings = Number(sessionUser?.is_system) === 1;

  const loadInventory = async (force: boolean = false) => {
    try {
      if (force) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      const res = await fetchJstInventory({
        forceRefresh: force,
        page: currentPage,
        limit,
        search: searchTerm,
        warehouse: selectedWarehouse,
        low_stock: showLowStockOnly,
        sort_key: sortConfig.key,
        sort_dir: sortConfig.direction,
        grouped: activeTab === 'inventory_grouped'
      });
      
      if (res && res.ok && res.data) {
        setInventory(res.data);
        setTotalRecords(res.total);
        setCurrentPage(res.page);
        setLastPage(res.last_page);
        if (res.sync_info) setSyncInfo(res.sync_info);
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
  }, [activeTab, currentPage, limit, selectedWarehouse, showLowStockOnly, sortConfig]);

  // Debounced search
  useEffect(() => {
    if (activeTab === 'settings') return;
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      loadInventory(false);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleExportExcel = async () => {
    if (inventory.length === 0) return;
    
    setExporting(true);
    try {
      const res = await fetchJstInventory({
        export: true,
        search: searchTerm,
        warehouse: selectedWarehouse,
        low_stock: showLowStockOnly,
        sort_key: sortConfig.key,
        sort_dir: sortConfig.direction,
        grouped: activeTab === 'inventory_grouped'
      });
      
      if (!res || !res.ok || !res.data) throw new Error('Failed to fetch export data');
      
      const dataToExport = res.data;
      
      const exportData = dataToExport.map((item: any) => {
        if (activeTab === 'inventory_grouped') {
          return {
            'SKU ID': item.skuId,
            'ชื่อสินค้า': item.skuName,
            'รายสินค้า': item.warehouses?.map((w: any) => w.warehouseName).join(', ') || '',
            'ทั้งหมด': item.qty,
            'พร้อมขาย': item.availableQty,
            'จองแล้ว': item.orderLock,
            'ของเสีย/มีตำหนิ': item.defectiveQty,
            'กำลังรับเข้า': item.inQty,
            'ของตีกลับ': item.returnQty,
            'กำลังสั่งซื้อ': item.purchaseQty,
            'แบรนด์': item.brandName,
            'ยอดขายย้อนหลัง 7 วัน': item.daySale7,
          };
        } else {
          return {
            'SKU ID': item.skuId,
            'ชื่อสินค้า': item.skuName,
            'คลังสินค้า': item.warehouseName,
            'ทั้งหมด': item.qty,
            'พร้อมขาย': item.availableQty,
            'จองแล้ว': item.orderLock,
            'ของเสีย/มีตำหนิ': item.defectiveQty,
            'กำลังรับเข้า': item.inQty,
            'ของตีกลับ': item.returnQty,
            'กำลังสั่งซื้อ': item.purchaseQty,
            'แบรนด์': item.brandName,
            'ซัพพลายเออร์': item.supplierName,
            'ยอดขายย้อนหลัง 3 วัน': item.daySale3,
            'ยอดขายย้อนหลัง 7 วัน': item.daySale7,
            'ยอดขายย้อนหลัง 15 วัน': item.daySale15,
            'ยอดขายย้อนหลัง 30 วัน': item.daySale30,
            'ยอดขายย้อนหลัง 60 วัน': item.daySale60,
            'ยอดขายย้อนหลัง 90 วัน': item.daySale90,
            'อัปเดตล่าสุด': new Date(item.updatedAt).toLocaleString('th-TH')
          };
        }
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');
      XLSX.writeFile(workbook, `JST_Inventory_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (error) {
      console.error(error);
      alert('เกิดข้อผิดพลาดในการดาวน์โหลดรายงาน');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 w-full space-y-6">
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
              disabled={exporting || inventory.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span className="hidden sm:inline">{exporting ? 'กำลังประมวลผล...' : 'ดาวน์โหลดรายงาน'}</span>
            </button>
            <button
              onClick={() => { setCurrentPage(1); loadInventory(true); }}
              disabled={loading || refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'กำลังอัปเดต...' : 'ดึงข้อมูลล่าสุด'}
            </button>
          </div>
        )}
      </div>

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => { setActiveTab('inventory_grouped'); setCurrentPage(1); }}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'inventory_grouped'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Package className="w-4 h-4" />
              รายสินค้า
            </button>
            <button
              onClick={() => { setActiveTab('inventory'); setCurrentPage(1); }}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'inventory'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Package className="w-4 h-4" />
              แยกตามคลัง
            </button>
          {canViewSettings && (
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
          )}
        </nav>
      </div>

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
                <p className="font-semibold">เกิดข้อผิดพลาด</p>
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
              <div className="flex items-center gap-2 flex-1 sm:flex-none">
                <select
                  value={selectedWarehouse}
                  onChange={(e) => { setSelectedWarehouse(e.target.value); setCurrentPage(1); }}
                  className="px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white flex-1"
                >
                  <option value="all">ทุกคลังสินค้า</option>
                  {predefinedWarehouses.map((wh) => (
                    <option key={wh} value={wh}>{wh}</option>
                  ))}
                </select>
                <select
                  value={limit}
                  onChange={(e) => { setLimit(Number(e.target.value)); setCurrentPage(1); }}
                  className="px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              
              <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors">
                <input 
                  type="checkbox" 
                  className="rounded border-slate-300 text-red-500 focus:ring-red-500 w-4 h-4"
                  checked={showLowStockOnly}
                  onChange={(e) => { setShowLowStockOnly(e.target.checked); setCurrentPage(1); }}
                />
                <span className="text-sm font-medium text-slate-700">เฉพาะสินค้าพร้อมขาย {'< 10'} ชิ้น</span>
              </label>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              {loading && !refreshing && inventory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
                  <p>กำลังโหลดข้อมูลสต็อก...</p>
                </div>
              ) : inventory.length === 0 && !error ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <Package className="w-12 h-12 mb-4 text-slate-300" />
                  <p>ไม่พบข้อมูลสินค้าที่ตรงเงื่อนไข</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse relative">
                  <thead className="bg-white sticky top-0 shadow-sm z-10">
                    <tr>
                      <th onClick={() => handleSort('sku_id')} className="py-3 px-4 text-sm font-semibold text-slate-600 border-b border-slate-200 cursor-pointer hover:bg-slate-50">
                        <div className="flex items-center gap-1">SKU / สินค้า {sortConfig?.key === 'sku_id' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>) : <ArrowUpDown className="w-3 h-3 text-slate-300"/>}</div>
                      </th>
                      <th onClick={() => activeTab === 'inventory' ? handleSort('warehouse_name') : null} className={`py-3 px-4 text-sm font-semibold text-slate-600 border-b border-slate-200 ${activeTab === 'inventory' ? 'cursor-pointer hover:bg-slate-50' : ''}`}>
                        <div className="flex items-center gap-1">{activeTab === 'inventory_grouped' ? 'คลังสินค้า' : 'คลังสินค้า'} {activeTab === 'inventory' && (sortConfig?.key === 'warehouse_name' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>) : <ArrowUpDown className="w-3 h-3 text-slate-300"/>)}</div>
                      </th>
                      <th onClick={() => handleSort('qty')} className="py-3 px-4 text-sm font-semibold text-slate-600 border-b border-slate-200 cursor-pointer hover:bg-slate-50">
                        <div className="flex items-center justify-end gap-1">ทั้งหมด {sortConfig?.key === 'qty' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>) : <ArrowUpDown className="w-3 h-3 text-slate-300"/>}</div>
                      </th>
                      <th onClick={() => handleSort('available_qty')} className="py-3 px-4 text-sm font-semibold text-emerald-600 border-b border-slate-200 cursor-pointer hover:bg-emerald-50">
                        <div className="flex items-center justify-end gap-1">พร้อมขาย {sortConfig?.key === 'available_qty' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>) : <ArrowUpDown className="w-3 h-3 text-emerald-300"/>}</div>
                      </th>
                      <th onClick={() => handleSort('order_lock')} className="py-3 px-4 text-sm font-semibold text-orange-600 border-b border-slate-200 cursor-pointer hover:bg-orange-50">
                        <div className="flex items-center justify-end gap-1">จองแล้ว {sortConfig?.key === 'order_lock' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>) : <ArrowUpDown className="w-3 h-3 text-orange-300"/>}</div>
                      </th>
                      <th onClick={() => handleSort('day_sale_7')} className="py-3 px-4 text-sm font-semibold text-indigo-600 border-b border-slate-200 cursor-pointer hover:bg-indigo-50">
                        <div className="flex items-center justify-end gap-1" title="ยอดขายสะสมย้อนหลัง 7 วัน">ยอดขาย(7D) {sortConfig?.key === 'day_sale_7' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>) : <ArrowUpDown className="w-3 h-3 text-indigo-300"/>}</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y divide-slate-100 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                    {inventory.map((item, index) => {
                      const rowId = `${item.skuId}-${index}`;
                      const isExpanded = expandedRows.has(rowId);
                      return (
                        <React.Fragment key={rowId}>
                          <tr 
                            onClick={() => toggleRow(rowId)}
                            className={`hover:bg-slate-50 cursor-pointer transition-colors ${activeTab === 'inventory_grouped' ? 'bg-indigo-50/30' : ''}`}
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
                              {activeTab === 'inventory_grouped' 
                                ? `รายสินค้า (${item.warehouses?.length || 0} คลัง)`
                                : item.warehouseName}
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
                          
                          {/* Expanded Content */}
                          {isExpanded && activeTab === 'inventory_grouped' && item.warehouses && (
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
                                        {item.warehouses.map((whItem, wIndex) => (
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
                          
                          {isExpanded && activeTab === 'inventory' && (
                            <tr>
                              <td colSpan={6} className="bg-slate-50 p-4 border-b border-slate-200 shadow-inner">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 min-w-0">
                                    <h4 className="text-sm font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">รายละเอียดสต็อกเบื้องลึก</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div><p className="text-xs text-slate-500">พร้อมขาย</p><p className="text-lg font-bold text-emerald-600">{item.availableQty}</p></div>
                                      <div><p className="text-xs text-slate-500">จองแล้ว</p><p className="text-lg font-bold text-orange-600">{item.orderLock}</p></div>
                                      <div><p className="text-xs text-slate-500">ของเสีย/มีตำหนิ</p><p className="text-lg font-bold text-red-600">{item.defectiveQty}</p></div>
                                      <div><p className="text-xs text-slate-500">ของตีกลับ</p><p className="text-lg font-bold text-amber-600">{item.returnQty}</p></div>
                                      <div><p className="text-xs text-slate-500">กำลังรับเข้า</p><p className="text-lg font-bold text-blue-600">{item.inQty}</p></div>
                                      <div><p className="text-xs text-slate-500">กำลังสั่งซื้อ</p><p className="text-lg font-bold text-indigo-600">{item.purchaseQty}</p></div>
                                    </div>
                                    {item.supplierName && (
                                      <div className="mt-4 pt-3 border-t border-slate-100">
                                        <p className="text-xs text-slate-500">ซัพพลายเออร์</p>
                                        <p className="text-sm font-medium text-slate-800 line-clamp-1">{item.supplierName}</p>
                                      </div>
                                    )}
                                  </div>
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
                    })}
                  </tbody>
                </table>
              )}
            </div>
            
            {/* Pagination Controls */}
            <div className="bg-white p-3 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-sm text-slate-600">
                แสดงผล {inventory.length > 0 ? (currentPage - 1) * limit + 1 : 0} - {Math.min(currentPage * limit, totalRecords)} จากทั้งหมด <span className="font-bold">{totalRecords}</span> รายการ
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || loading}
                  className="p-2 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                <div className="text-sm font-medium px-2">
                  หน้า {currentPage} / {lastPage}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(lastPage, p + 1))}
                  disabled={currentPage === lastPage || loading || lastPage === 0}
                  className="p-2 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            </div>
            
            {/* Last Updated Footer */}
            <div className="bg-slate-50 p-2 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
              <div>
                {syncInfo.time ? (
                  <span>ดึงข้อมูลล่าสุด: {new Date(syncInfo.time).toLocaleString('th-TH')} ({syncInfo.source === 'Cron' ? 'อัปเดตอัตโนมัติ' : 'ผู้ใช้งานกดอัปเดต'})</span>
                ) : (
                  inventory.length > 0 && inventory[0].updatedAt && (
                    <span>ดึงข้อมูลล่าสุด: {new Date(inventory[0].updatedAt).toLocaleString('th-TH')}</span>
                  )
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
