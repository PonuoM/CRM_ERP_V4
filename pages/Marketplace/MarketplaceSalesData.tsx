import React, { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../../services/api";
import { Plus, Search, Edit, Trash, Upload, Download } from "lucide-react";
import { useToast } from "../../components/Toast";

interface SalesDataProps {
  companyId: number;
  currentUser: any;
  activeStores: any[];
  // Props for Import functionality passed from parent to reuse existing logic if needed
  csvFile: File | null;
  jstFile: File | null;
  csvPreview: any[];
  csvImporting: boolean;
  jstImporting: boolean;
  csvResult: any;
  handleCsvSelect: (e: any) => void;
  handleCsvImport: () => void;
  handleJstSelect: (e: any) => void;
  handleJstImport: () => void;
  importBatches: any[];
  viewBatchId: number | null;
  setViewBatchId: (id: number | null) => void;
  batchOrders: any[];
  batchSummary: any;
  handleDeleteBatch: (b: any) => void;
  downloadTemplate: () => void;
}

export default function MarketplaceSalesData({ 
  companyId, currentUser, activeStores,
  csvFile, jstFile, csvPreview, csvImporting, jstImporting, csvResult,
  handleCsvSelect, handleCsvImport, handleJstSelect, handleJstImport,
  importBatches, viewBatchId, setViewBatchId, batchOrders, batchSummary, handleDeleteBatch, downloadTemplate
}: SalesDataProps) {
    const toast = useToast();

  const [activeSubTab, setActiveSubTab] = useState<"list" | "import">("list");
  
  // Data Table State
  const [sales, setSales] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const limit = 50;

  // Filters
  const [search, setSearch] = useState("");
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [filterPlatform, setFilterPlatform] = useState("");
  const [filterStore, setFilterStore] = useState("");

  const loadSales = useCallback(async () => {
    if (activeSubTab !== "list") return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        company_id: String(companyId),
        limit: String(limit),
        offset: String(page * limit),
        month_year: filterMonth,
        platform: filterPlatform,
        store_id: filterStore,
        search: search
      });
      const json = await apiFetch(`Marketplace/sales_orders_crud.php?${params.toString()}`);
      if (json && json.success) {
        setSales(json.data || []);
        setTotal(json.total || 0);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [companyId, page, filterMonth, filterPlatform, filterStore, search, activeSubTab]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  // Handle Search input with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0);
      loadSales();
    }, 500);
    return () => clearTimeout(timer);
  }, [search, loadSales]);

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    order_date: new Date().toISOString().slice(0, 16),
    order_id: "",
    product_name: "",
    sku: "",
    quantity: 1,
    unit_price: 0,
    net_price: 0,
    status: "Completed",
    reason: "",
    platform: "",
    store_id: ""
  });

  const openAddModal = () => {
    setEditId(null);
    setForm({
      order_date: new Date().toISOString().slice(0, 16),
      order_id: "",
      product_name: "",
      sku: "",
      quantity: 1,
      unit_price: 0,
      net_price: 0,
      status: "Completed",
      reason: "",
      platform: "",
      store_id: ""
    });
    setShowModal(true);
  };

  const openEditModal = (sale: any) => {
    setEditId(sale.id);
    setForm({
      order_date: sale.order_date ? new Date(sale.order_date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
      order_id: sale.order_id || "",
      product_name: sale.product_name || "",
      sku: sale.sku || "",
      quantity: sale.quantity || 1,
      unit_price: sale.unit_price || 0,
      net_price: sale.net_price || 0,
      status: sale.status || "Completed",
      reason: sale.reason || "",
      platform: sale.platform || "",
      store_id: sale.store_id || ""
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        ...form,
        company_id: companyId,
        id: editId
      };
      const res = await apiFetch(`Marketplace/sales_orders_crud.php`, {
        method: editId ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      if (res.success) {
        setShowModal(false);
        loadSales();
      } else {
        toast.warning(res.error || "Error");
      }
    } catch (e: any) {
      toast.warning(e.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?")) return;
    try {
      const res = await apiFetch(`Marketplace/sales_orders_crud.php`, {
        method: "DELETE",
        body: JSON.stringify({ id, company_id: companyId })
      });
      if (res.success) {
        loadSales();
      } else {
        toast.warning(res.error || "Error");
      }
    } catch (e: any) {
      toast.warning(e.message);
    }
  };

  const PLATFORMS = ["Shopee", "Lazada", "TikTok Shop", "LINE MyShop", "Facebook Shop", "อื่นๆ"];
  const STATUSES = ["Pending", "Completed", "Cancelled", "Returned", "ยกเลิกแล้ว", "ตีกลับ"];

  return (
    <div className="bg-white rounded-lg shadow min-h-[500px]">
      <div className="border-b px-5 py-4 flex gap-4">
        <button 
          onClick={() => setActiveSubTab("list")} 
          className={`font-semibold text-sm pb-2 border-b-2 ${activeSubTab === "list" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          รายการยอดขาย (Sales Data)
        </button>
        <button 
          onClick={() => setActiveSubTab("import")} 
          className={`font-semibold text-sm pb-2 border-b-2 ${activeSubTab === "import" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          นำเข้าไฟล์ยอดขาย (Batch Import)
        </button>
      </div>

      <div className="p-5">
        {activeSubTab === "list" && (
          <div>
            <div className="flex flex-wrap items-end justify-between mb-4 gap-4">
              <div className="flex gap-3 flex-wrap">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">ค้นหา (Order ID, สินค้า)</label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2 text-gray-400" size={16} />
                    <input type="text" className="border rounded-md pl-8 pr-3 py-1.5 text-sm w-48" placeholder="ค้นหา..." value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">เดือน/ปี</label>
                  <input type="month" className="border rounded-md px-3 py-1.5 text-sm" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">แพลตฟอร์ม</label>
                  <select className="border rounded-md px-3 py-1.5 text-sm w-32" value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}>
                    <option value="">ทั้งหมด</option>
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">ร้านค้า</label>
                  <select className="border rounded-md px-3 py-1.5 text-sm w-40" value={filterStore} onChange={e => setFilterStore(e.target.value)}>
                    <option value="">ทั้งหมด</option>
                    {activeStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={openAddModal} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 text-sm">
                <Plus size={16} /> เพิ่มรายการขาย
              </button>
            </div>

            <div className="overflow-x-auto border rounded">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-2">วันที่</th>
                    <th className="px-3 py-2">Order ID</th>
                    <th className="px-3 py-2">ร้านค้า</th>
                    <th className="px-3 py-2">สินค้า / SKU</th>
                    <th className="px-3 py-2 text-right">จำนวน</th>
                    <th className="px-3 py-2 text-right">ยอดสุทธิ</th>
                    <th className="px-3 py-2 text-center">สถานะ</th>
                    <th className="px-3 py-2 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="text-center py-8 text-gray-500">กำลังโหลด...</td></tr>
                  ) : sales.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-8 text-gray-500">ไม่มีข้อมูล</td></tr>
                  ) : (
                    sales.map(s => (
                      <tr key={s.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 text-xs text-gray-500">{new Date(s.order_date).toLocaleString('th-TH')}</td>
                        <td className="px-3 py-2 font-mono text-xs">{s.order_id}</td>
                        <td className="px-3 py-2 text-xs">
                          {s.store_name}
                          <div className="text-[10px] text-gray-400">{s.platform}</div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="truncate max-w-[200px]" title={s.product_name}>{s.product_name}</div>
                          <div className="text-xs text-gray-500 font-mono">{s.sku}</div>
                        </td>
                        <td className="px-3 py-2 text-right">{s.quantity}</td>
                        <td className="px-3 py-2 text-right font-semibold text-blue-600">{Number(s.net_price).toLocaleString()}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${(s.status||'').includes('ยกเลิก') || (s.status||'').includes('Cancel') ? 'bg-red-100 text-red-700' : (s.status||'').includes('ตีกลับ') || (s.status||'').includes('Return') ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => openEditModal(s)} className="text-blue-500 hover:text-blue-700 mr-2"><Edit size={14}/></button>
                          <button onClick={() => handleDelete(s.id)} className="text-red-500 hover:text-red-700"><Trash size={14}/></button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {total > limit && (
              <div className="flex justify-between items-center mt-4">
                <span className="text-sm text-gray-600">แสดง {page * limit + 1} - {Math.min((page + 1) * limit, total)} จากทั้งหมด {total} รายการ</span>
                <div className="flex gap-2">
                  <button disabled={page === 0} onClick={() => setPage(page-1)} className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 text-sm">ก่อนหน้า</button>
                  <button disabled={(page+1)*limit >= total} onClick={() => setPage(page+1)} className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 text-sm">ถัดไป</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeSubTab === "import" && (
          <div>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">นำเข้ายอดขาย Batch (CSV / JST)</h2>
                <button onClick={downloadTemplate} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm flex items-center gap-2">
                    <Download size={16} /> ดาวน์โหลด Template CSV
                </button>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow-sm border p-5">
                  <h3 className="font-semibold text-gray-700 mb-4 border-b pb-2">นำเข้าไฟล์ JST (Excel)</h3>
                  <div className="flex items-center gap-4 mb-2">
                      <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-green-50 hover:bg-green-100 border border-green-300 rounded-md text-sm font-medium text-green-700 transition-colors">
                          <Upload size={16} /> เลือกไฟล์ JST
                          <input type="file" accept=".xlsx,.xls" onChange={handleJstSelect} className="hidden" />
                      </label>
                      {jstFile && <span className="text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded border border-green-200 truncate max-w-[200px]">{jstFile.name}</span>}
                  </div>
                  <p className="text-xs text-gray-500 mb-4">รองรับไฟล์จากระบบจัดการออเดอร์ JST ERP (.xlsx)</p>
                  <button
                      onClick={handleJstImport}
                      disabled={!jstFile || jstImporting || csvImporting}
                      className="w-full px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 text-sm flex justify-center items-center gap-2"
                  >
                      {jstImporting ? "กำลังนำเข้า..." : "📤 เริ่มนำเข้า JST"}
                  </button>
              </div>

              <div className="bg-white rounded-lg shadow-sm border p-5">
                  <h3 className="font-semibold text-gray-700 mb-4 border-b pb-2">นำเข้าไฟล์ CSV ทั่วไป</h3>
                  <div className="flex items-center gap-4 mb-2">
                      <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded-md text-sm font-medium text-blue-700 transition-colors">
                          <Upload size={16} /> เลือกไฟล์ CSV
                          <input type="file" accept=".csv" onChange={handleCsvSelect} className="hidden" />
                      </label>
                      {csvFile && <span className="text-sm text-blue-700 bg-blue-50 px-3 py-1.5 rounded border border-blue-200 truncate max-w-[200px]">{csvFile.name}</span>}
                  </div>
                  <p className="text-xs text-gray-500 mb-4">รองรับไฟล์จาก Template ของระบบ (.csv)</p>
                  <button
                      onClick={handleCsvImport}
                      disabled={!csvFile || csvImporting || jstImporting}
                      className="w-full px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 text-sm flex justify-center items-center gap-2"
                  >
                      {csvImporting ? "กำลังนำเข้า..." : "📤 เริ่มนำเข้า CSV"}
                  </button>
              </div>
            </div>

            {/* Result Area */}
            {csvResult && (
                <div className={`p-4 rounded-md text-sm mb-6 ${csvResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {csvResult.success ? (
                        <div>
                            <p className="text-lg">✅ นำเข้าสำเร็จ — <b>{csvResult.imported_rows}</b> รายการ
                                {csvResult.skipped_rows > 0 && <span className="text-amber-600"> (ข้าม {csvResult.skipped_rows} รายการ)</span>}</p>
                            {csvResult.created_stores?.length > 0 && (
                                <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200 text-blue-700">
                                    <p className="font-medium">🏪 สร้างร้านค้าใหม่อัตโนมัติ {csvResult.created_stores.length} ร้าน:</p>
                                    <ul className="list-disc list-inside mt-1 grid grid-cols-2 gap-1">
                                        {csvResult.created_stores.map((s: any, i: number) => (
                                            <li key={i}>{s.name} ({s.platform})</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div>
                            <p className="font-bold mb-2">❌ เกิดข้อผิดพลาด: {csvResult.error}</p>
                            {csvResult.unknown_products?.length > 0 && (
                                <div className="mt-3">
                                    <p className="text-sm font-medium mb-2">รหัสสินค้าที่ไม่พบในระบบ:</p>
                                    <div className="space-y-1.5 max-h-40 overflow-y-auto bg-white p-2 border rounded">
                                        {csvResult.unknown_products.map((item: any, i: number) => (
                                            <div key={i} className="flex items-start gap-2 bg-red-50 rounded px-3 py-1.5 text-xs border border-red-100">
                                                <span className="font-mono font-bold text-red-700 whitespace-nowrap">{item.sku}</span>
                                                <span className="text-gray-500">— บรรทัดที่ {item.line_display} ({item.count} แถว)</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Import History Table (from old code) */}
            <div className="bg-white rounded-lg shadow border">
                <div className="px-4 py-3 border-b bg-gray-50">
                    <h3 className="font-semibold text-sm text-gray-700">ประวัติการนำเข้า (Batch History)</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100 border-b">
                            <tr>
                                <th className="px-3 py-2 text-left">วันที่</th>
                                <th className="px-3 py-2 text-left">ไฟล์</th>
                                <th className="px-3 py-2 text-right">นำเข้า</th>
                                <th className="px-3 py-2 text-right">ข้าม</th>
                                <th className="px-3 py-2 text-left">ผู้นำเข้า</th>
                                <th className="px-3 py-2 text-center">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {importBatches.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-6 text-gray-400">ยังไม่มีข้อมูลการนำเข้า</td></tr>
                            ) : importBatches.map((b: any) => (
                                <tr key={b.id} className="border-b hover:bg-gray-50">
                                    <td className="px-3 py-2 text-xs text-gray-500">{new Date(b.created_at).toLocaleString('th-TH')}</td>
                                    <td className="px-3 py-2 text-xs font-medium">{b.filename}</td>
                                    <td className="px-3 py-2 text-right font-semibold text-green-600">{b.imported_rows}</td>
                                    <td className="px-3 py-2 text-right text-amber-600">{b.skipped_rows || 0}</td>
                                    <td className="px-3 py-2 text-xs text-gray-600">{b.first_name} {b.last_name || ''}</td>
                                    <td className="px-3 py-2 text-center">
                                        <button onClick={() => setViewBatchId(viewBatchId === b.id ? null : b.id)} className="text-blue-600 hover:text-blue-800 text-xs mr-3 font-medium">
                                            {viewBatchId === b.id ? 'ซ่อนรายการ' : 'ดูรายการ'}
                                        </button>
                                        <button onClick={() => handleDeleteBatch(b)} className="text-red-500 hover:text-red-700 text-xs font-medium">ลบ</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Batch Detail */}
                {viewBatchId && (
                    <div className="px-4 py-4 border-t-2 border-blue-200 bg-blue-50/30">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-blue-800">รายการใน Batch #{viewBatchId}</h4>
                            {batchSummary && (
                                <div className="flex gap-4 text-xs bg-white px-3 py-1.5 rounded shadow-sm border border-blue-100">
                                    <span>ยอดรวม: <b className="text-green-700 text-sm">{Number(batchSummary.sum_sales || 0).toLocaleString()}</b> ฿</span>
                                    <span>ออเดอร์: <b>{batchSummary.unique_orders}</b></span>
                                    <span>จัดส่ง: <b className="text-blue-600">{batchSummary.shipped_count}</b></span>
                                    <span>ยกเลิก: <b className="text-red-600">{batchSummary.cancelled_count}</b></span>
                                </div>
                            )}
                        </div>
                        <div className="overflow-x-auto max-h-96 overflow-y-auto border border-blue-100 rounded">
                            <table className="w-full text-xs bg-white">
                                <thead className="bg-blue-100/50 sticky top-0 shadow-sm text-gray-700">
                                    <tr>
                                        <th className="px-3 py-2 text-left">รหัส</th>
                                        <th className="px-3 py-2 text-left">สินค้า</th>
                                        <th className="px-3 py-2 text-right">จำนวน</th>
                                        <th className="px-3 py-2 text-right">ราคา</th>
                                        <th className="px-3 py-2 text-left">วันสั่ง</th>
                                        <th className="px-3 py-2 text-left">สถานะ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {batchOrders.map((o: any) => (
                                        <tr key={o.id} className={`border-b ${o.order_status === 'ยกเลิกแล้ว' ? 'bg-red-50 text-red-500' : ''}`}>
                                            <td className="px-3 py-2 font-mono">{o.product_code}</td>
                                            <td className="px-3 py-2 max-w-[200px] truncate">{o.product_name}</td>
                                            <td className="px-3 py-2 text-right font-medium">{o.quantity}</td>
                                            <td className="px-3 py-2 text-right text-blue-600 font-medium">{Number(o.total_price).toLocaleString()}</td>
                                            <td className="px-3 py-2 text-gray-500">{o.order_date || '-'}</td>
                                            <td className="px-3 py-2">
                                                <span className={`px-2 py-0.5 rounded text-xs ${o.order_status === 'จัดส่งแล้ว' ? 'bg-green-100 text-green-700' : o.order_status === 'ยกเลิกแล้ว' ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>
                                                    {o.order_status || o.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
          </div>
        )}

      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 my-8">
            <h3 className="text-lg font-bold mb-4">{editId ? "แก้ไขรายการขาย" : "เพิ่มรายการขายด้วยมือ"}</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">วันที่สั่งซื้อ *</label>
                <input type="datetime-local" className="w-full border rounded-md p-2 text-sm" value={form.order_date} onChange={e => setForm({...form, order_date: e.target.value})} />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order ID</label>
                <input type="text" className="w-full border rounded-md p-2 text-sm font-mono" value={form.order_id} onChange={e => setForm({...form, order_id: e.target.value})} />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ *</label>
                <select className="w-full border rounded-md p-2 text-sm" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">แพลตฟอร์ม *</label>
                <select className="w-full border rounded-md p-2 text-sm" value={form.platform} onChange={e => setForm({...form, platform: e.target.value})}>
                  <option value="">เลือก...</option>
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ร้านค้า (ตัวเลือก)</label>
                <select className="w-full border rounded-md p-2 text-sm" value={form.store_id} onChange={e => setForm({...form, store_id: e.target.value})}>
                  <option value="">เลือก...</option>
                  {activeStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อสินค้า</label>
                <input type="text" className="w-full border rounded-md p-2 text-sm" value={form.product_name} onChange={e => setForm({...form, product_name: e.target.value})} />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                <input type="text" className="w-full border rounded-md p-2 text-sm font-mono" value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">จำนวน</label>
                <input type="number" min="1" className="w-full border rounded-md p-2 text-sm" value={form.quantity} onChange={e => setForm({...form, quantity: parseInt(e.target.value)||1})} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ราคาต่อชิ้น (Unit Price)</label>
                <input type="number" step="0.01" className="w-full border rounded-md p-2 text-sm" value={form.unit_price} onChange={e => setForm({...form, unit_price: parseFloat(e.target.value)||0})} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ยอดสุทธิ (Net Price) *</label>
                <input type="number" step="0.01" className="w-full border rounded-md p-2 text-sm text-blue-700 font-semibold" value={form.net_price} onChange={e => setForm({...form, net_price: parseFloat(e.target.value)||0})} />
              </div>

              {((form.status||'').includes('ยกเลิก') || (form.status||'').includes('Cancel') || (form.status||'').includes('ตีกลับ') || (form.status||'').includes('Return')) && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">เหตุผล (ถ้ามี)</label>
                  <input type="text" className="w-full border rounded-md p-2 text-sm" value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} placeholder="เช่น ติดต่อลูกค้าไม่ได้" />
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50">ยกเลิก</button>
              <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 flex items-center gap-2">
                บันทึกข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
