import React, { useState, useEffect, useCallback, useMemo } from "react";
import { apiFetch } from "../../services/api";
import ReactApexChart from "react-apexcharts";
import { Calendar, Download, TrendingUp, TrendingDown, DollarSign, Package, XCircle, RefreshCw, CheckCircle } from "lucide-react";

interface DashboardProps {
  companyId: number;
  activeStores: any[];
}

export default function MarketplaceDashboard({ companyId, activeStores }: DashboardProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  // Filters
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [storeFilter, setStoreFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        company_id: String(companyId),
        date_from: dateFrom,
        date_to: dateTo,
        store_id: storeFilter,
        platform: platformFilter
      });
      const json = await apiFetch(`Marketplace/dashboard_advanced.php?${params.toString()}`);
      if (json && json.success) {
        setData(json);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [companyId, dateFrom, dateTo, storeFilter, platformFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const kpi = data?.kpis || {};
  const fmt = (v: number) => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  const pctAds = kpi.net_sales > 0 ? (kpi.ads_spend / kpi.net_sales) * 100 : 0;
  const roas = kpi.ads_spend > 0 ? kpi.net_sales / kpi.ads_spend : 0;

  // Chart Options
  const chartOptions: any = useMemo(() => ({
    chart: { type: 'area', height: 350, toolbar: { show: false } },
    colors: ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#9333ea'],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2 },
    xaxis: { categories: data?.chart_data?.map((d: any) => d.month) || [] },
    tooltip: { y: { formatter: (val: number) => "฿ " + val.toLocaleString() } },
    legend: { position: 'top' }
  }), [data]);

  const chartSeries = useMemo(() => {
    if (!data?.chart_data) return [];
    return [
      { name: 'ยอดขายสุทธิ', data: data.chart_data.map((d: any) => d.net_sales) },
      { name: 'ยอดรับจริง (Invoices)', data: data.chart_data.map((d: any) => 0) }, // Invoices missing from chart right now
      { name: 'ค่าโฆษณา', data: data.chart_data.map((d: any) => d.ads_spend) },
      { name: 'ยอดยกเลิก', data: data.chart_data.map((d: any) => d.canceled) },
      { name: 'ยอดตีกลับ', data: data.chart_data.map((d: any) => d.returned) }
    ];
  }, [data]);

  const platformPieOptions: any = useMemo(() => ({
    chart: { type: 'pie' },
    labels: data?.platform_summary?.map((d: any) => d.platform || 'Unknown') || [],
    legend: { position: 'bottom' },
    tooltip: { y: { formatter: (val: number) => "฿ " + val.toLocaleString() } }
  }), [data]);

  const platformPieSeries = useMemo(() => {
    return data?.platform_summary?.map((d: any) => Number(d.total_sales)) || [];
  }, [data]);

  const PLATFORMS = ["Shopee", "Lazada", "TikTok Shop", "LINE MyShop", "Facebook Shop", "อื่นๆ"];

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">วันที่เริ่มต้น</label>
          <input type="date" className="border rounded-md px-3 py-1.5 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ถึงวันที่</label>
          <input type="date" className="border rounded-md px-3 py-1.5 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">แพลตฟอร์ม</label>
          <select className="border rounded-md px-3 py-1.5 text-sm w-32" value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}>
            <option value="all">ทั้งหมด</option>
            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ร้านค้า</label>
          <select className="border rounded-md px-3 py-1.5 text-sm w-40" value={storeFilter} onChange={e => setStoreFilter(e.target.value)}>
            <option value="all">ทั้งหมด</option>
            {activeStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <button onClick={loadData} disabled={loading} className="px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm h-[34px] flex items-center shadow-sm">
          {loading ? "กำลังโหลด..." : "ค้นหา"}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">ยอดขายสุทธิ (Net Sales)</p>
              <h3 className="text-2xl font-bold text-gray-800">{fmt(kpi.net_sales)} <span className="text-sm font-normal text-gray-500">฿</span></h3>
            </div>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><TrendingUp size={20} /></div>
          </div>
          <div className="mt-2 text-xs text-gray-400">จากยอดรวม {fmt(kpi.total_sales)}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">ยอดยกเลิก / ตีกลับ</p>
              <h3 className="text-2xl font-bold text-gray-800">{fmt(kpi.canceled + kpi.returned)} <span className="text-sm font-normal text-gray-500">฿</span></h3>
            </div>
            <div className="p-2 bg-red-50 text-red-600 rounded-lg"><TrendingDown size={20} /></div>
          </div>
          <div className="mt-2 text-xs text-gray-400 flex justify-between">
            <span className="text-red-500">ยกเลิก: {fmt(kpi.canceled)}</span>
            <span className="text-amber-500">ตีกลับ: {fmt(kpi.returned)}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">ค่าโฆษณา (Ads Spend)</p>
              <h3 className="text-2xl font-bold text-gray-800">{fmt(kpi.ads_spend)} <span className="text-sm font-normal text-gray-500">฿</span></h3>
            </div>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><DollarSign size={20} /></div>
          </div>
          <div className="mt-2 text-xs text-gray-400 flex justify-between font-medium">
            <span className="text-blue-600">%Ads: {pctAds.toFixed(2)}%</span>
            <span className="text-green-600">ROAS: {roas.toFixed(2)}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">ยอดรับจริง (Actual Amount)</p>
              <h3 className="text-2xl font-bold text-green-700">{fmt(kpi.actual_amount)} <span className="text-sm font-normal text-gray-500">฿</span></h3>
            </div>
            <div className="p-2 bg-green-50 text-green-600 rounded-lg"><CheckCircle size={20} /></div>
          </div>
          <div className="mt-2 text-xs text-gray-400">
            ยอดที่แพลตฟอร์มแจ้ง: {fmt(kpi.invoice_sales)}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-lg shadow p-5">
          <h3 className="text-base font-semibold text-gray-800 mb-4">แนวโน้มยอดขาย (Trend)</h3>
          {data?.chart_data?.length > 0 ? (
            <ReactApexChart options={chartOptions} series={chartSeries} type="area" height={300} />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">ไม่พบข้อมูล</div>
          )}
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-base font-semibold text-gray-800 mb-4">สัดส่วนยอดขายต่อแพลตฟอร์ม</h3>
          {data?.platform_summary?.length > 0 ? (
            <ReactApexChart options={platformPieOptions} series={platformPieSeries} type="pie" height={300} />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">ไม่พบข้อมูล</div>
          )}
        </div>
      </div>

      {/* Top 5 Tables */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-base font-semibold text-gray-800 border-b pb-2 mb-3 flex items-center gap-2">
            <Package size={18} className="text-blue-500"/> สินค้าขายดี 5 อันดับแรก
          </h3>
          <div className="space-y-3">
            {data?.top_products?.length > 0 ? data.top_products.map((p: any, i: number) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <div className="truncate pr-2 w-[70%]">
                  <span className="font-medium text-gray-700">{p.product_name || p.sku}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-blue-600">{Number(p.total_qty).toLocaleString()} ชิ้น</div>
                </div>
              </div>
            )) : <p className="text-center text-sm text-gray-400 py-4">ไม่พบข้อมูล</p>}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-base font-semibold text-gray-800 border-b pb-2 mb-3 flex items-center gap-2">
            <XCircle size={18} className="text-red-500"/> สาเหตุการยกเลิก 5 อันดับแรก
          </h3>
          <div className="space-y-3">
            {data?.top_cancel_reasons?.length > 0 ? data.top_cancel_reasons.map((p: any, i: number) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <div className="truncate pr-2 w-[70%]">
                  <span className="font-medium text-gray-700">{p.reason}</span>
                </div>
                <div className="font-semibold text-red-500">{Number(p.count).toLocaleString()} รายการ</div>
              </div>
            )) : <p className="text-center text-sm text-gray-400 py-4">ไม่พบข้อมูล</p>}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-base font-semibold text-gray-800 border-b pb-2 mb-3 flex items-center gap-2">
            <RefreshCw size={18} className="text-amber-500"/> สาเหตุการตีกลับ 5 อันดับแรก
          </h3>
          <div className="space-y-3">
            {data?.top_return_reasons?.length > 0 ? data.top_return_reasons.map((p: any, i: number) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <div className="truncate pr-2 w-[70%]">
                  <span className="font-medium text-gray-700">{p.reason}</span>
                </div>
                <div className="font-semibold text-amber-500">{Number(p.count).toLocaleString()} รายการ</div>
              </div>
            )) : <p className="text-center text-sm text-gray-400 py-4">ไม่พบข้อมูล</p>}
          </div>
        </div>
      </div>

      {/* Store Summary Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-4 border-b bg-gray-50 flex justify-between items-center">
            <h3 className="text-base font-semibold text-gray-800">สรุปยอดขายแยกตามร้านค้าและแพลตฟอร์ม</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white border-b text-gray-600">
              <tr>
                <th className="px-5 py-3">ร้านค้า</th>
                <th className="px-5 py-3">แพลตฟอร์ม</th>
                <th className="px-5 py-3 text-right">ยอดขายสุทธิ</th>
              </tr>
            </thead>
            <tbody>
              {data?.store_summary?.length > 0 ? data.store_summary.map((s: any, i: number) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-800">{s.store_name || '-'}</td>
                  <td className="px-5 py-3 text-gray-600">{s.platform || '-'}</td>
                  <td className="px-5 py-3 text-right font-semibold text-blue-600">{fmt(s.total_sales)}</td>
                </tr>
              )) : (
                <tr><td colSpan={3} className="text-center py-6 text-gray-400">ไม่พบข้อมูล</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
