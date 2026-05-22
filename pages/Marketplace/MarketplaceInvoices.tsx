import React, { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../../services/api";
import { Upload, FileText, CheckCircle, XCircle, Link as LinkIcon, Download, List } from "lucide-react";
import { useToast } from "../../components/Toast";

interface InvoicesProps {
  companyId: number;
  currentUser: any;
  activeStores: any[];
}

export default function MarketplaceInvoices({ companyId, currentUser, activeStores }: InvoicesProps) {
    const toast = useToast();
  const [activeTab, setActiveTab] = useState<'list' | 'import'>('list');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Filters for list
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [filterPlatform, setFilterPlatform] = useState("");
  const [filterStore, setFilterStore] = useState("");

  // Upload Form (Manual)
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState({
    month_year: new Date().toISOString().slice(0, 7),
    platform: "",
    store_id: "",
    total_sales: "",
    actual_amount: "",
    invoice_url: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; text: string } | null>(null);

  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<any>(null);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        company_id: String(companyId),
        month_year: filterMonth,
        platform: filterPlatform,
        store_id: filterStore
      });
      const json = await apiFetch(`Marketplace/invoices_list.php?${params.toString()}`);
      if (json && json.success) setInvoices(json.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [companyId, filterMonth, filterPlatform, filterStore]);

  useEffect(() => {
    if (activeTab === 'list') {
      loadInvoices();
    }
  }, [activeTab, loadInvoices]);

  const handleUpload = async () => {
    if (!form.platform || !form.month_year) {
      toast.warning("กรุณาระบุเดือนปีและแพลตฟอร์ม");
      return;
    }
    setUploading(true);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append("company_id", String(companyId));
      formData.append("employee_id", String(currentUser?.id || ""));
      formData.append("month_year", form.month_year);
      formData.append("platform", form.platform);
      if (form.store_id) formData.append("store_id", form.store_id);
      formData.append("total_sales", form.total_sales);
      formData.append("actual_amount", form.actual_amount);
      if (form.invoice_url) formData.append("invoice_url", form.invoice_url);
      if (file) formData.append("invoice_file", file);

      const res = await apiFetch(`Marketplace/invoices_upload.php`, {
        method: 'POST',
        body: formData
      });

      if (res.success) {
        setUploadResult({ success: true, text: "บันทึกข้อมูลสำเร็จ" });
        setTimeout(() => {
            setShowUpload(false);
            setForm({ ...form, total_sales: "", actual_amount: "", invoice_url: "" });
            setFile(null);
            loadInvoices();
            setUploadResult(null);
        }, 1500);
      } else {
        setUploadResult({ success: false, text: res.error || "เกิดข้อผิดพลาด" });
      }
    } catch (e: any) {
      setUploadResult({ success: false, text: e.message || "Error" });
    }
    setUploading(false);
  };

  const handleCsvImport = async () => {
    if (!csvFile) return;
    setCsvImporting(true);
    setCsvResult(null);
    try {
        const formData = new FormData();
        formData.append('csv_file', csvFile);
        formData.append('company_id', String(companyId));
        formData.append('user_id', String(currentUser?.id));

        const res = await fetch(`${window.location.origin}${(window as any).__APP_BASE || '/beta_test/'}api/Marketplace/invoices_csv_import.php`, {
            method: 'POST', body: formData
        });
        const json = await res.json();
        setCsvResult(json);
        if (json && json.success) { 
            setCsvFile(null); 
            // Switch back to list after 2 seconds
            setTimeout(() => {
                setActiveTab('list');
                setCsvResult(null);
            }, 2000);
        }
    } catch (e: any) {
        setCsvResult({ success: false, error: e?.message || 'Error' });
    } finally { 
        setCsvImporting(false); 
    }
  };

  const downloadTemplate = () => {
    window.open(`${window.location.origin}${(window as any).__APP_BASE || '/beta_test/'}api/Marketplace/invoices_csv_template.php`, '_blank');
  };

  const PLATFORMS = ["Shopee", "Lazada", "TikTok Shop", "LINE MyShop", "Facebook Shop", "อื่นๆ"];

  return (
    <div className="bg-white rounded-lg shadow min-h-[500px]">
      <div className="px-5 py-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">จัดการใบเสร็จ (Invoices/Remittance)</h2>
          <p className="text-xs text-gray-500">เก็บข้อมูลยอดเงินที่ได้รับจริงจากแพลตฟอร์ม หรือนำเข้าด้วยไฟล์ CSV</p>
        </div>
        <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 rounded-md flex items-center gap-2 text-sm transition-colors ${activeTab === 'list' ? 'bg-white border shadow-sm text-gray-800' : 'text-gray-600 hover:bg-gray-200'}`}
            >
              <List size={16} /> รายการใบเสร็จ
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`px-4 py-2 rounded-md flex items-center gap-2 text-sm transition-colors ${activeTab === 'import' ? 'bg-white border shadow-sm text-gray-800' : 'text-gray-600 hover:bg-gray-200'}`}
            >
              <Upload size={16} /> นำเข้าไฟล์ (Bulk Import)
            </button>
        </div>
      </div>

      {activeTab === 'list' && (
        <div className="p-5">
            <div className="flex justify-between items-end mb-6">
                <div className="flex gap-4">
                    <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">เดือน/ปี</label>
                    <input type="month" className="border rounded-md px-3 py-1.5 text-sm" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
                    </div>
                    <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">แพลตฟอร์ม</label>
                    <select className="border rounded-md px-3 py-1.5 text-sm w-40" value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}>
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
                <button
                    onClick={() => setShowUpload(true)}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 text-sm shadow-sm"
                >
                    <Upload size={16} /> เพิ่มสลิป 1 รายการ
                </button>
            </div>

            <div className="overflow-x-auto rounded border">
                <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b">
                    <tr>
                    <th className="px-4 py-3">เดือน/ปี</th>
                    <th className="px-4 py-3">พนักงาน</th>
                    <th className="px-4 py-3">แพลตฟอร์ม</th>
                    <th className="px-4 py-3">ร้านค้า</th>
                    <th className="px-4 py-3 text-right">ยอดที่เก็บได้</th>
                    <th className="px-4 py-3 text-right">ยอดรับจริง</th>
                    <th className="px-4 py-3 text-center">สลิป / อ้างอิง</th>
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                    <tr><td colSpan={7} className="text-center py-8 text-gray-500">กำลังโหลด...</td></tr>
                    ) : invoices.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-gray-500">ไม่มีข้อมูลใบเสร็จในเดือนนี้</td></tr>
                    ) : (
                    invoices.map((inv) => (
                        <tr key={inv.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{inv.month_year}</td>
                        <td className="px-4 py-3 text-gray-600">{inv.employee_first_name} {inv.employee_last_name}</td>
                        <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-gray-100 rounded text-xs border">{inv.platform}</span>
                        </td>
                        <td className="px-4 py-3">{inv.store_name || "-"}</td>
                        <td className="px-4 py-3 text-right font-semibold text-blue-600">{Number(inv.total_sales_amount).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-semibold text-green-600">{Number(inv.actual_amount).toLocaleString()}</td>
                        <td className="px-4 py-3 text-center">
                            {inv.file_path ? (
                                inv.file_path.startsWith('http') ? (
                                    <a href={inv.file_path} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 flex justify-center items-center gap-1">
                                        <LinkIcon size={16} /> ดูลิงก์
                                    </a>
                                ) : (
                                    <a href={`/${inv.file_path}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 flex justify-center items-center gap-1">
                                        <FileText size={16} /> ดูไฟล์
                                    </a>
                                )
                            ) : (
                            <span className="text-gray-400">-</span>
                            )}
                        </td>
                        </tr>
                    ))
                    )}
                </tbody>
                </table>
            </div>
        </div>
      )}

      {activeTab === 'import' && (
        <div className="p-5 max-w-3xl mx-auto py-10">
            <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
                <Upload className="mx-auto text-blue-500 mb-4" size={48} />
                <h3 className="text-lg font-medium text-gray-900 mb-2">นำเข้าข้อมูล Invoices/Remittance (CSV)</h3>
                <p className="text-sm text-gray-500 mb-6">ดาวน์โหลด Template จัดเตรียมข้อมูลให้ถูกต้อง และอัปโหลดไฟล์เข้าระบบเพื่อบันทึกข้อมูลทีละหลายรายการ</p>
                
                <div className="flex flex-col sm:flex-row justify-center gap-4 items-center">
                    <button onClick={downloadTemplate} className="px-4 py-2 border border-blue-600 text-blue-600 hover:bg-blue-50 rounded-md flex items-center gap-2 text-sm font-medium">
                        <Download size={16} /> โหลด Template
                    </button>
                    
                    <div className="relative">
                        <input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center gap-2 text-sm font-medium hover:bg-blue-700">
                            {csvFile ? csvFile.name : "เลือกไฟล์ CSV"}
                        </button>
                    </div>
                </div>
            </div>

            {csvFile && (
                <div className="mt-6 flex justify-end">
                    <button onClick={handleCsvImport} disabled={csvImporting} className="px-6 py-2.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 font-medium flex items-center gap-2">
                        {csvImporting ? "กำลังนำเข้า..." : "ยืนยันการนำเข้าข้อมูล"}
                    </button>
                </div>
            )}

            {csvResult && (
                <div className={`mt-6 p-4 rounded-md border ${csvResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    <div className="flex items-start gap-3">
                        {csvResult.success ? <CheckCircle className="text-green-600 mt-0.5" /> : <XCircle className="text-red-600 mt-0.5" />}
                        <div>
                            <h4 className="font-bold">{csvResult.success ? "นำเข้าสำเร็จ" : "นำเข้าล้มเหลว"}</h4>
                            {csvResult.success ? (
                                <p className="text-sm mt-1">เพิ่มข้อมูล Invoices ทั้งหมด {csvResult.imported_rows} รายการเรียบร้อยแล้ว</p>
                            ) : (
                                <p className="text-sm mt-1">{csvResult.error}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
      )}

      {showUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">นำเข้าข้อมูลยอดเงิน (Remittance)</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">เดือน/ปี *</label>
                  <input type="month" className="w-full border rounded-md p-2 text-sm" value={form.month_year} onChange={e => setForm({...form, month_year: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">แพลตฟอร์ม *</label>
                  <select className="w-full border rounded-md p-2 text-sm" value={form.platform} onChange={e => setForm({...form, platform: e.target.value})}>
                    <option value="">เลือก...</option>
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ร้านค้า (ตัวเลือก)</label>
                <select className="w-full border rounded-md p-2 text-sm" value={form.store_id} onChange={e => setForm({...form, store_id: e.target.value})}>
                  <option value="">(ไม่ระบุร้านค้ารวมทั้งแพลตฟอร์ม)</option>
                  {activeStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ยอดรวมที่เก็บได้ (฿)</label>
                  <input type="number" step="0.01" className="w-full border rounded-md p-2 text-sm text-right" placeholder="0.00" value={form.total_sales} onChange={e => setForm({...form, total_sales: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ยอดเงินรับจริง (฿)</label>
                  <input type="number" step="0.01" className="w-full border rounded-md p-2 text-sm text-right" placeholder="0.00" value={form.actual_amount} onChange={e => setForm({...form, actual_amount: e.target.value})} />
                </div>
              </div>

              <div className="p-3 bg-gray-50 border rounded-md">
                <label className="block text-sm font-medium text-gray-700 mb-2 border-b pb-1">หลักฐานสลิป (เลือกแนบไฟล์ หรือ วางลิงก์)</label>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">1. อัปโหลดไฟล์รูปภาพ (PDF, JPG, PNG)</label>
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="w-full border rounded-md p-1.5 text-sm bg-white" onChange={e => {
                            setFile(e.target.files?.[0] || null);
                            if (e.target.files?.[0]) setForm({...form, invoice_url: ""}); // Clear URL if file selected
                        }} />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 border-t"></div>
                        <span className="text-xs text-gray-400 font-medium">หรือ</span>
                        <div className="flex-1 border-t"></div>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">2. วางลิงก์รูปภาพ (URL)</label>
                        <input type="text" placeholder="https://..." className="w-full border rounded-md p-2 text-sm" value={form.invoice_url} onChange={e => {
                            setForm({...form, invoice_url: e.target.value});
                            if (e.target.value) setFile(null); // Clear file if URL provided
                        }} />
                    </div>
                </div>
              </div>
            </div>

            {uploadResult && (
              <div className={`mt-4 p-3 rounded-md flex items-center gap-2 text-sm ${uploadResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {uploadResult.success ? <CheckCircle size={16}/> : <XCircle size={16}/>}
                {uploadResult.text}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowUpload(false)} className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50">ยกเลิก</button>
              <button onClick={handleUpload} disabled={uploading} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2">
                {uploading ? 'กำลังบันทึก...' : <><Upload size={16}/> บันทึก</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
