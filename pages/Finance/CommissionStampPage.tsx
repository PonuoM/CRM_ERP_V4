import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User } from '../../types';
import {
  Upload, Download, Trash2, ChevronDown, ChevronRight,
  CheckCircle, Clock, AlertCircle, FileText, RefreshCw,
  BarChart2, Calendar, Plus
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import resolveApiBasePath from '../../utils/apiBasePath';
import DateRangePicker, { DateRange } from '../../components/DateRangePicker';

interface CommissionStampPageProps {
  currentUser: User;
}

interface Batch {
  id: number;
  company_id: number;
  name: string;
  order_count: number;
  total_commission: number;
  created_by: number;
  created_at: string;
  note: string;
  first_name?: string;
  last_name?: string;
}

interface SummaryRow {
  period: string;
  calculated: number;
  pending: number;
  incomplete: number;
  total: number;
  total_commission: number;
}

interface SummaryTotals {
  calculated: number;
  pending: number;
  incomplete: number;
  total: number;
  total_commission: number;
}

interface BatchOrder {
  id: number;
  order_id: string;
  user_id: number | null;
  commission_amount: number | null;
  note: string | null;
  stamped_at: string;
  order_date?: string;
  total_amount?: number;
  payment_status?: string;
  order_status?: string;
  commission_user_first?: string;
  commission_user_last?: string;
  stamp_user_first?: string;
  stamp_user_last?: string;
}

// === Import Row Type ===
interface ImportRow {
  id: number;
  orderId: string;
  userId: string;
  amount: string;
  note: string;
}

const createEmptyRow = (id: number): ImportRow => ({
  id, orderId: '', userId: '', amount: '', note: '',
});

export default function CommissionStampPage({ currentUser }: CommissionStampPageProps) {
  // === State ===
  const [batchName, setBatchName] = useState('');
  const [batchNote, setBatchNote] = useState('');
  const [importRows, setImportRows] = useState<ImportRow[]>(Array.from({ length: 10 }, (_, i) => createEmptyRow(i + 1)));
  const [isStamping, setIsStamping] = useState(false);
  const [stampResult, setStampResult] = useState<any>(null);

  const [batches, setBatches] = useState<Batch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>([]);
  const [summaryTotals, setSummaryTotals] = useState<SummaryTotals>({ calculated: 0, pending: 0, incomplete: 0, total: 0, total_commission: 0 });
  const [loadingSummary, setLoadingSummary] = useState(false);

  const [groupBy, setGroupBy] = useState<'month' | 'week' | 'day'>('month');

  // Summary date range (default: 3 months ago → today)
  const [summaryRange, setSummaryRange] = useState<DateRange>(() => {
    const today = new Date();
    const m3 = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00`;
    const toISOEnd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T23:59:59`;
    return { start: toISO(m3), end: toISOEnd(today) };
  });

  // Export date range (separate, default same as summary)
  const [exportRange, setExportRange] = useState<DateRange>(() => {
    const today = new Date();
    const m3 = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00`;
    const toISOEnd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T23:59:59`;
    return { start: toISO(m3), end: toISOEnd(today) };
  });

  const [isExporting, setIsExporting] = useState(false);

  const [expandedBatch, setExpandedBatch] = useState<number | null>(null);
  const [batchOrders, setBatchOrders] = useState<BatchOrder[]>([]);
  const [loadingBatchOrders, setLoadingBatchOrders] = useState(false);

  const companyId = currentUser.companyId;

  // === Date Range Calculation ===
  const getDateParams = useCallback(() => {
    return {
      start_date: summaryRange.start.split('T')[0],
      end_date: summaryRange.end.split('T')[0],
    };
  }, [summaryRange]);

  const getExportDateParams = useCallback(() => {
    return {
      start_date: exportRange.start.split('T')[0],
      end_date: exportRange.end.split('T')[0],
    };
  }, [exportRange]);

  // === Loaders ===
  const loadBatches = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const res = await apiFetch(`Commission/get_stamp_batches.php?company_id=${companyId}`);
      if (res.ok) setBatches(res.data || []);
    } catch (e) { console.error(e); }
    setLoadingBatches(false);
  }, [companyId]);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const { start_date, end_date } = getDateParams();
      const res = await apiFetch(
        `Commission/get_commission_summary.php?company_id=${companyId}&group_by=${groupBy}&start_date=${start_date}&end_date=${end_date}`
      );
      if (res.ok) {
        setSummaryRows(res.data.rows || []);
        setSummaryTotals(res.data.totals || { calculated: 0, pending: 0, incomplete: 0, total: 0, total_commission: 0 });
      }
    } catch (e) { console.error(e); }
    setLoadingSummary(false);
  }, [companyId, groupBy, getDateParams]);

  const loadBatchOrders = useCallback(async (batchId: number) => {
    setLoadingBatchOrders(true);
    try {
      const res = await apiFetch(`Commission/get_stamp_batches.php?batch_id=${batchId}`);
      if (res.ok) setBatchOrders(res.data.orders || []);
    } catch (e) { console.error(e); }
    setLoadingBatchOrders(false);
  }, []);

  useEffect(() => { loadBatches(); }, [loadBatches]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  // === Import Row Handlers ===
  const handleRowChange = (index: number, field: keyof ImportRow, value: string) => {
    const newRows = [...importRows];
    (newRows[index] as any)[field] = value;
    setImportRows(newRows);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, rowIndex: number) => {
    const pasteData = e.clipboardData.getData('text');
    const pastedLines = pasteData.split('\n').filter(r => r.trim() !== '');
    if (pastedLines.length <= 1 && !pasteData.includes('\t') && !pasteData.includes(',')) return; // single cell paste, let default handle
    e.preventDefault();

    const newRows = [...importRows];
    pastedLines.forEach((line, i) => {
      const parts = line.split(/[\t,]/).map(p => p.trim());
      const currentIdx = rowIndex + i;
      const row: ImportRow = {
        id: currentIdx < newRows.length ? newRows[currentIdx].id : newRows.length + i + 1,
        orderId: parts[0] || '',
        userId: parts[1] || '',
        amount: parts[2] || '',
        note: parts.slice(3).join(', ').trim(),
      };
      if (currentIdx < newRows.length) {
        newRows[currentIdx] = row;
      } else {
        newRows.push(row);
      }
    });
    setImportRows(newRows);
  };

  const addRow = () => setImportRows([...importRows, createEmptyRow(importRows.length + 1)]);
  const removeRow = (index: number) => setImportRows(importRows.filter((_, i) => i !== index));

  // === Build orders payload from rows ===
  const filledRows = useMemo(() => importRows.filter(r => r.orderId.trim()), [importRows]);
  const parsedOrders = useMemo(() => filledRows.map(r => ({
    order_id: r.orderId.trim(),
    ...(r.userId.trim() && { user_id: parseInt(r.userId.trim()) }),
    ...(r.amount.trim() && { commission_amount: parseFloat(r.amount.trim()) }),
    ...(r.note.trim() && { note: r.note.trim() }),
  })), [filledRows]);

  // === Stamp ===
  const handleStamp = async () => {
    if (parsedOrders.length === 0) return;
    setIsStamping(true);
    setStampResult(null);
    try {
      const res = await apiFetch('Commission/stamp_orders.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          user_id: currentUser.id,
          batch_name: batchName || `Stamp ${new Date().toLocaleDateString('th-TH')}`,
          note: batchNote || undefined,
          orders: parsedOrders,
        }),
      });
      setStampResult(res);
      if (res.ok) {
        setImportRows(Array.from({ length: 10 }, (_, i) => createEmptyRow(i + 1)));
        setBatchName('');
        setBatchNote('');
        loadBatches();
        loadSummary();
      }
    } catch (e: any) {
      setStampResult({ ok: false, error: e.message });
    }
    setIsStamping(false);
  };

  // === Delete Batch ===
  const handleDeleteBatch = async (batchId: number) => {
    if (!confirm('ต้องการลบรอบ Stamp นี้ทั้งหมด?')) return;
    try {
      await apiFetch('Commission/unstamp_orders.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batchId }),
      });
      loadBatches();
      loadSummary();
      if (expandedBatch === batchId) {
        setExpandedBatch(null);
        setBatchOrders([]);
      }
    } catch (e) { console.error(e); }
  };

  // === Export ===
  const handleExport = async (status: string) => {
    setIsExporting(true);
    try {
      const { start_date, end_date } = getExportDateParams();
      const path = `Commission/export_commission_orders.php?company_id=${companyId}&status=${status}&start_date=${start_date}&end_date=${end_date}`;
      const baseUrl = resolveApiBasePath().replace(/\/$/, '');
      const token = localStorage.getItem('authToken') || '';
      const fullUrl = `${baseUrl}/${path}&token=${encodeURIComponent(token)}`;
      window.open(fullUrl, '_blank');
    } catch (e) { console.error(e); }
    setIsExporting(false);
  };

  // === Format Helpers ===
  const fmtNum = (n: number) => n.toLocaleString('th-TH');
  const fmtMoney = (n: number) => `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('th-TH-u-ca-gregory', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
  const fmtDateTime = (d: string) => d ? new Date(d).toLocaleString('th-TH-u-ca-gregory', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  // Week date range helper: "2026-W03" → "01/01/26 - 07/01/26"
  const getWeekDateRange = (period: string) => {
    const match = period.match(/(\d{4})-W(\d{2})/);
    if (!match) return period;
    const year = parseInt(match[1]);
    const week = parseInt(match[2]);
    // ISO week: week 1 contains the first Thursday of the year
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7; // Mon=1..Sun=7
    const mondayW1 = new Date(jan4);
    mondayW1.setDate(jan4.getDate() - dayOfWeek + 1);
    const monday = new Date(mondayW1);
    monday.setDate(mondayW1.getDate() + (week - 1) * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmtShort = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
    return `${fmtShort(monday)} - ${fmtShort(sunday)}`;
  };

  const getPeriodLabel = (period: string) => {
    if (groupBy === 'month') {
      const [y, m] = period.split('-');
      const months = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      return `${months[parseInt(m)]} ${y}`;
    }
    if (groupBy === 'week') return getWeekDateRange(period);
    return fmtDate(period);
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <BarChart2 className="w-6 h-6 text-emerald-600" />
              </div>
              Commission Stamp
            </h1>
            <p className="text-sm text-gray-500 mt-1">จัดการ Stamp ค่าคอม — Import / ดูสรุป / Export</p>
          </div>
          <button
            onClick={() => { loadBatches(); loadSummary(); }}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <span className="text-sm font-medium text-gray-600">ยังไม่สำเร็จ</span>
            </div>
            <div className="text-3xl font-bold text-red-600">{fmtNum(summaryTotals.incomplete)}</div>
            <p className="text-xs text-gray-400 mt-1">payment_status ≠ Approved</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <span className="text-sm font-medium text-gray-600">รอคิดค่าคอม</span>
            </div>
            <div className="text-3xl font-bold text-amber-600">{fmtNum(summaryTotals.pending)}</div>
            <p className="text-xs text-gray-400 mt-1">Approved แต่ยังไม่ stamp</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
              <span className="text-sm font-medium text-gray-600">คิดค่าคอมแล้ว</span>
            </div>
            <div className="text-3xl font-bold text-emerald-600">{fmtNum(summaryTotals.calculated)}</div>
            <p className="text-xs text-gray-400 mt-1">ค่าคอมรวม: {fmtMoney(summaryTotals.total_commission)}</p>
          </div>
        </div>

        {/* Import Section — Table-based */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Upload className="w-5 h-5 text-emerald-600" />
              <h2 className="font-semibold text-gray-800">Import & Stamp</h2>
              {filledRows.length > 0 && (
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                  {filledRows.length} รายการ
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleStamp}
                disabled={isStamping || parsedOrders.length === 0}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
              >
                {isStamping ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    กำลัง Stamp...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Stamp ({parsedOrders.length})
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Batch Name & Note */}
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600 whitespace-nowrap">ชื่อรอบ:</label>
                <input
                  type="text"
                  value={batchName}
                  onChange={e => setBatchName(e.target.value)}
                  placeholder="เช่น คิดค่าคอมเดือน ก.พ. 2569"
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600 whitespace-nowrap">หมายเหตุ:</label>
                <input
                  type="text"
                  value={batchNote}
                  onChange={e => setBatchNote(e.target.value)}
                  placeholder="(ไม่บังคับ)"
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Import Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase w-12">#</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Order ID *</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase w-28">User ID</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase w-32">ค่าคอม</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">หมายเหตุ</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase w-12"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {importRows.map((row, index) => (
                  <tr key={row.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-4 py-1.5 text-xs text-gray-400">{index + 1}</td>
                    <td className="px-4 py-1.5">
                      <input
                        type="text"
                        value={row.orderId}
                        onChange={e => handleRowChange(index, 'orderId', e.target.value)}
                        onPaste={e => handlePaste(e, index)}
                        data-index={index}
                        placeholder="e.g. 260101-00001abc"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm font-mono"
                      />
                    </td>
                    <td className="px-4 py-1.5">
                      <input
                        type="text"
                        value={row.userId}
                        onChange={e => handleRowChange(index, 'userId', e.target.value)}
                        placeholder="48"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm text-center"
                      />
                    </td>
                    <td className="px-4 py-1.5">
                      <input
                        type="text"
                        value={row.amount}
                        onChange={e => handleRowChange(index, 'amount', e.target.value)}
                        placeholder="1500"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm text-right"
                      />
                    </td>
                    <td className="px-4 py-1.5">
                      <input
                        type="text"
                        value={row.note}
                        onChange={e => handleRowChange(index, 'note', e.target.value)}
                        placeholder=""
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
                      />
                    </td>
                    <td className="px-4 py-1.5 text-right">
                      <button
                        onClick={() => removeRow(index)}
                        className="text-red-300 hover:text-red-500 transition-colors p-1"
                        title="ลบแถว"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Row + Info */}
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <button
              onClick={addRow}
              className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-800 font-medium text-sm px-3 py-1.5 rounded-md hover:bg-emerald-50 transition-colors"
            >
              <Plus size={16} />
              เพิ่มแถว
            </button>
            <div className="text-xs text-gray-400">
              รองรับ Copy & Paste จาก Excel (คอลัมน์ A: Order ID, B: User ID, C: ค่าคอม, D: หมายเหตุ)
            </div>
          </div>

          {/* Stamp Result */}
          {stampResult && (
            <div className={`mx-5 mb-4 p-3 rounded-lg text-sm ${stampResult.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {stampResult.ok ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>Stamp สำเร็จ! เพิ่ม {stampResult.data?.added} / แทนที่ {stampResult.data?.replaced} รายการ (Batch #{stampResult.data?.batch_id})</span>
                  {stampResult.data?.errors?.length > 0 && (
                    <span className="text-amber-600 ml-2">⚠ ไม่พบ: {stampResult.data.errors.join(', ')}</span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>Error: {stampResult.error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Date & Group Controls + Export */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-500" />
              <h2 className="font-semibold text-gray-800">สรุปตามช่วงเวลา</h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <DateRangePicker value={summaryRange} onApply={setSummaryRange} />
              {/* Group By */}
              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                {(['month', 'week', 'day'] as const).map(g => (
                  <button
                    key={g}
                    onClick={() => setGroupBy(g)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${groupBy === g ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    {g === 'month' ? 'เดือน' : g === 'week' ? 'สัปดาห์' : 'วัน'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Summary Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="px-5 py-3 text-left font-medium">ช่วงเวลา</th>
                  <th className="px-5 py-3 text-right font-medium">🔴 ยังไม่สำเร็จ</th>
                  <th className="px-5 py-3 text-right font-medium">🟡 รอคิดค่าคอม</th>
                  <th className="px-5 py-3 text-right font-medium">🟢 คิดแล้ว</th>
                  <th className="px-5 py-3 text-right font-medium">รวม</th>
                  <th className="px-5 py-3 text-right font-medium">ค่าคอมรวม</th>
                </tr>
              </thead>
              <tbody>
                {loadingSummary ? (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-500 border-t-transparent" />
                      กำลังโหลด...
                    </div>
                  </td></tr>
                ) : summaryRows.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">ไม่มีข้อมูลในช่วงเวลาที่เลือก</td></tr>
                ) : (
                  <>
                    {summaryRows.map(row => (
                      <tr key={row.period} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-800">{getPeriodLabel(row.period)}</td>
                        <td className="px-5 py-3 text-right text-red-600 font-medium">{fmtNum(row.incomplete)}</td>
                        <td className="px-5 py-3 text-right text-amber-600 font-medium">{fmtNum(row.pending)}</td>
                        <td className="px-5 py-3 text-right text-emerald-600 font-medium">{fmtNum(row.calculated)}</td>
                        <td className="px-5 py-3 text-right text-gray-700 font-semibold">{fmtNum(row.total)}</td>
                        <td className="px-5 py-3 text-right text-gray-600">{fmtMoney(row.total_commission)}</td>
                      </tr>
                    ))}
                    {/* Totals */}
                    <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                      <td className="px-5 py-3 text-gray-800">รวมทั้งหมด</td>
                      <td className="px-5 py-3 text-right text-red-700">{fmtNum(summaryTotals.incomplete)}</td>
                      <td className="px-5 py-3 text-right text-amber-700">{fmtNum(summaryTotals.pending)}</td>
                      <td className="px-5 py-3 text-right text-emerald-700">{fmtNum(summaryTotals.calculated)}</td>
                      <td className="px-5 py-3 text-right text-gray-900">{fmtNum(summaryTotals.total)}</td>
                      <td className="px-5 py-3 text-right text-gray-800">{fmtMoney(summaryTotals.total_commission)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Export Section */}
          <div className="px-5 py-4 border-t border-gray-100 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-gray-600 font-medium">Export CSV:</span>
              <DateRangePicker value={exportRange} onApply={setExportRange} />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { status: 'all', label: 'ทั้งหมด', color: 'gray' },
                { status: 'incomplete', label: 'ยังไม่สำเร็จ', color: 'red' },
                { status: 'pending', label: 'รอคิดค่าคอม', color: 'amber' },
                { status: 'calculated', label: 'คิดแล้ว', color: 'emerald' },
              ].map(({ status, label, color }) => (
                <button
                  key={status}
                  onClick={() => handleExport(status)}
                  disabled={isExporting}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors
                    ${color === 'gray' ? 'border-gray-300 text-gray-700 hover:bg-gray-50' :
                      color === 'red' ? 'border-red-200 text-red-700 hover:bg-red-50' :
                      color === 'amber' ? 'border-amber-200 text-amber-700 hover:bg-amber-50' :
                      'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}
                    disabled:opacity-50`}
                >
                  <Download className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Batch History */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <FileText className="w-5 h-5 text-gray-500" />
            <h2 className="font-semibold text-gray-800">ประวัติ Batch ({batches.length})</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {loadingBatches ? (
              <div className="px-5 py-8 text-center text-gray-400">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-500 border-t-transparent mx-auto mb-2" />
                กำลังโหลด...
              </div>
            ) : batches.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400">ยังไม่มี Batch</div>
            ) : (
              batches.map(batch => (
                <div key={batch.id}>
                  <div className="px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <button
                        onClick={() => {
                          if (expandedBatch === batch.id) {
                            setExpandedBatch(null);
                            setBatchOrders([]);
                          } else {
                            setExpandedBatch(batch.id);
                            loadBatchOrders(batch.id);
                          }
                        }}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                      >
                        {expandedBatch === batch.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      <div className="min-w-0">
                        <div className="font-medium text-gray-800 truncate">{batch.name}</div>
                        <div className="text-xs text-gray-500">
                          {fmtDateTime(batch.created_at)}
                          {batch.first_name && ` • โดย ${batch.first_name} ${batch.last_name || ''}`}
                          {batch.note && ` • ${batch.note}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-800">{fmtNum(batch.order_count)} รายการ</div>
                        {batch.total_commission > 0 && (
                          <div className="text-xs text-emerald-600">{fmtMoney(batch.total_commission)}</div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteBatch(batch.id)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="ลบ Batch"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Orders */}
                  {expandedBatch === batch.id && (
                    <div className="bg-gray-50 border-t border-gray-100">
                      {loadingBatchOrders ? (
                        <div className="px-5 py-4 text-center text-gray-400 text-sm">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-500 border-t-transparent mx-auto mb-1" />
                          กำลังโหลด...
                        </div>
                      ) : batchOrders.length === 0 ? (
                        <div className="px-5 py-4 text-center text-gray-400 text-sm">ไม่มีรายการ</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-100 text-gray-600">
                                <th className="px-4 py-2 text-left">Order ID</th>
                                <th className="px-4 py-2 text-left">วันที่สั่ง</th>
                                <th className="px-4 py-2 text-right">ยอดออเดอร์</th>
                                <th className="px-4 py-2 text-left">ผู้ได้รับค่าคอม</th>
                                <th className="px-4 py-2 text-right">ค่าคอม</th>
                                <th className="px-4 py-2 text-left">หมายเหตุ</th>
                                <th className="px-4 py-2 text-left">Stamp เมื่อ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {batchOrders.map(o => (
                                <tr key={o.id} className="border-t border-gray-100 hover:bg-white">
                                  <td className="px-4 py-2 font-mono">{o.order_id}</td>
                                  <td className="px-4 py-2">{fmtDate(o.order_date || '')}</td>
                                  <td className="px-4 py-2 text-right">{o.total_amount != null ? fmtMoney(o.total_amount) : '-'}</td>
                                  <td className="px-4 py-2">
                                    {o.user_id ? (
                                      <span className="text-gray-700">
                                        {o.commission_user_first || ''} {o.commission_user_last || ''}
                                        <span className="text-gray-400 ml-1">(ID:{o.user_id})</span>
                                      </span>
                                    ) : <span className="text-gray-400">-</span>}
                                  </td>
                                  <td className="px-4 py-2 text-right font-medium text-emerald-700">
                                    {o.commission_amount != null ? fmtMoney(o.commission_amount) : '-'}
                                  </td>
                                  <td className="px-4 py-2 text-gray-500">{o.note || '-'}</td>
                                  <td className="px-4 py-2 text-gray-500">{fmtDateTime(o.stamped_at)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
