import React from 'react';
import { BarChart3, Users, DollarSign, XCircle, Calendar, PieChart as PieChartIcon } from 'lucide-react';
import ReactApexChart from 'react-apexcharts';

export interface CancellationStat {
  user_id: number;
  name: string;
  total_orders: number;
  cancelled_count: number;
  cancelled_value: number;
  cancellation_rate: number;
  unacknowledged_count: number;
}

export interface TimelineItem {
  date_val: string;
  cancelled_count: number;
  cancelled_value: number;
}

export interface CancellationReason {
  label: string;
  count: number;
}

export interface TimelineData {
  daily: TimelineItem[];
  monthly: TimelineItem[];
  yearly: TimelineItem[];
}

interface CancellationStatsTabProps {
  stats: CancellationStat[];
  timeline: TimelineData;
  timelineMode: 'daily' | 'monthly' | 'yearly';
  setTimelineMode: (mode: 'daily' | 'monthly' | 'yearly') => void;
  reasons: CancellationReason[];
}

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#8b5cf6', '#3b82f6', '#10b981', '#64748b'];

export default function CancellationStatsTab({ stats, timeline, timelineMode, setTimelineMode, reasons }: CancellationStatsTabProps) {
  
  const { totalCancelled, totalValue, avgRate } = React.useMemo(() => {
    const tCancelled = stats.reduce((sum, s) => sum + Number(s.cancelled_count), 0);
    const tValue = stats.reduce((sum, s) => sum + Number(s.cancelled_value), 0);
    const aRate = stats.length > 0 
      ? (stats.reduce((sum, s) => sum + Number(s.cancellation_rate), 0) / stats.length).toFixed(2)
      : 0;
    return { totalCancelled: tCancelled, totalValue: tValue, avgRate: aRate };
  }, [stats]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600 flex-shrink-0">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">ออเดอร์ยกเลิกทั้งหมด</p>
            <h3 className="text-2xl font-bold text-gray-900">{totalCancelled.toLocaleString()} <span className="text-sm font-normal text-gray-500">รายการ</span></h3>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 flex-shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">อัตรายกเลิกเฉลี่ย</p>
            <h3 className="text-2xl font-bold text-gray-900">{avgRate}%</h3>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600 flex-shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">มูลค่าความเสียหายรวม</p>
            <h3 className="text-2xl font-bold text-gray-900">฿ {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          </div>
        </div>
      </div>

      {/* Timeline Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-500" />
            สถิติการยกเลิกตามช่วงเวลา
          </h2>
          <div className="flex bg-gray-200 p-1 rounded-lg">
            <button 
              onClick={() => setTimelineMode('daily')}
              className={`px-4 py-1 text-sm font-medium rounded-md transition-colors ${timelineMode === 'daily' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >รายวัน</button>
            <button 
              onClick={() => setTimelineMode('monthly')}
              className={`px-4 py-1 text-sm font-medium rounded-md transition-colors ${timelineMode === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >รายเดือน</button>
            <button 
              onClick={() => setTimelineMode('yearly')}
              className={`px-4 py-1 text-sm font-medium rounded-md transition-colors ${timelineMode === 'yearly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >รายปี</button>
          </div>
        </div>
        
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                  {timelineMode === 'daily' ? 'วันที่' : timelineMode === 'monthly' ? 'เดือน' : 'ปี'}
                </th>
                <th className="px-6 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">ออเดอร์ที่ยกเลิก</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">มูลค่าความเสียหาย (บาท)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {timeline[timelineMode]?.length > 0 ? (
                timeline[timelineMode].map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 whitespace-nowrap font-medium text-gray-900">
                      {timelineMode === 'daily' 
                        ? new Date(item.date_val).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
                        : timelineMode === 'monthly'
                        ? new Date(item.date_val + '-01').toLocaleDateString('th-TH', { year: 'numeric', month: 'long' })
                        : item.date_val
                      }
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-right font-bold text-red-600">{item.cancelled_count}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-right text-gray-600 font-mono">
                      ฿ {Number(item.cancelled_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-500">ไม่มีข้อมูลในช่วงเวลานี้</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-500" />
              สถิติรายพนักงาน
            </h2>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">พนักงาน</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">ออเดอร์รวม</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">ยอดที่ยกเลิก</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">อัตรายกเลิก</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">มูลค่าความเสียหาย</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.map((s, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                          {s.name.charAt(0)}
                        </div>
                        <div className="font-medium text-gray-900">{s.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-500">{s.total_orders}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-red-100 text-red-800">
                        {s.cancelled_count}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${s.cancellation_rate > 10 ? 'bg-red-500' : s.cancellation_rate > 5 ? 'bg-orange-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(100, s.cancellation_rate)}%` }}
                          ></div>
                        </div>
                        <span className={`font-medium ${s.cancellation_rate > 10 ? 'text-red-600' : s.cancellation_rate > 5 ? 'text-orange-600' : 'text-green-600'}`}>
                          {s.cancellation_rate}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-900 font-medium">
                      ฿ {Number(s.cancelled_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
                {stats.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      ไม่พบข้อมูลในช่วงเวลานี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col sticky top-6 self-start">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-gray-500" />
              สัดส่วนเหตุผลการยกเลิก
            </h2>
          </div>
          <div className="p-6 flex-1 flex flex-col justify-center">
            {reasons.length > 0 ? (
              <ReactApexChart 
                options={{
                  chart: { type: 'donut' },
                  labels: reasons.map(r => r.label),
                  colors: COLORS,
                  legend: { position: 'bottom' },
                  dataLabels: { enabled: true, formatter: (val) => `${Number(val).toFixed(1)}%` },
                  plotOptions: {
                    pie: {
                      donut: {
                        size: '65%',
                        labels: {
                          show: true,
                          name: { show: true },
                          value: { show: true, formatter: (val) => `${val} รายการ` },
                          total: { show: true, showAlways: true, label: 'ทั้งหมด', formatter: (w) => `${w.globals.seriesTotals.reduce((a:any,b:any)=>a+b,0)} รายการ` }
                        }
                      }
                    }
                  }
                }}
                series={reasons.map(r => Number(r.count))}
                type="donut"
                height={350}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <PieChartIcon className="w-12 h-12 mb-2 opacity-50" />
                <p>ไม่มีข้อมูลสัดส่วน</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
