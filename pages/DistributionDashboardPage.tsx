import React, { useState } from 'react';
import { useMovementDashboard } from '../hooks/useMovementDashboard';
import Chart from 'react-apexcharts';
import {
  Calendar, Users, ArrowDownRight, ArrowUpRight, Activity, Search, Server, User as UserIcon, Filter, AlertCircle, Eye, Download, FileSpreadsheet
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { th } from 'date-fns/locale';
import type { User } from '../types';
import MonthlySummaryTab from '../components/MonthlySummaryTab';
import TimeTravelTab from '../components/TimeTravelTab';

interface Props {
  currentUser?: User;
}

export default function DistributionDashboardPage({ currentUser }: Props) {
  const [activeTab, setActiveTab] = useState<'movement' | 'monthly' | 'timetravel'>('movement');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [agentId, setAgentId] = useState('');

  const { stats, ledger, chartData, loading, page, setPage, total, totalPages } = useMovementDashboard(
    currentUser?.companyId || 0,
    startDate,
    endDate,
    agentId
  );

  return (
    <div className="p-4 sm:p-6 w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="text-blue-600" />
            รายงานความเคลื่อนไหวการแจกงาน
          </h1>
          <p className="text-gray-500 mt-1">
            สรุปสถิติการได้รับและสูญเสียรายชื่อลูกค้า พร้อมสรุปยอดรายเดือน
          </p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('movement')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'movement' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            รายวัน (Movement)
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'monthly' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            สรุปรายเดือน (Monthly)
          </button>
          <button
            onClick={() => setActiveTab('timetravel')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'timetravel' ? 'bg-white shadow-sm text-purple-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            ย้อนเวลา (Time Travel)
          </button>
        </div>
      </div>

      {activeTab === 'monthly' ? (
        <MonthlySummaryTab companyId={currentUser?.companyId || 0} />
      ) : activeTab === 'timetravel' ? (
        <TimeTravelTab companyId={currentUser?.companyId || 0} />
      ) : (
        <>
          {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">ตั้งแต่วันที่</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">ถึงวันที่</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">รหัสพนักงาน (ID)</label>
            <input
              type="text"
              placeholder="เว้นว่างเพื่อดูทั้งหมด"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-none">
            <button
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2 font-medium"
              onClick={() => {
                setStartDate(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
                setEndDate(format(new Date(), 'yyyy-MM-dd'));
                setAgentId('');
              }}
            >
              <Filter size={18} /> รีเซ็ต
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">ได้รับเข้ารวม (ทั้งหมด)</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {chartData.summary.totalReceived.toLocaleString()} <span className="text-sm font-normal text-gray-500">ราย</span>
              </h3>
            </div>
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <ArrowDownRight size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">ถูกดึง/โอนออก (ทั้งหมด)</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {chartData.summary.totalLost.toLocaleString()} <span className="text-sm font-normal text-gray-500">ราย</span>
              </h3>
            </div>
            <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
              <ArrowUpRight size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">ได้รับจากแจกออโต้ (V2)</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {chartData.summary.autoReceived.toLocaleString()} <span className="text-sm font-normal text-gray-500">ราย</span>
              </h3>
            </div>
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Server size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">ดึงกลับด้วยออโต้ (V2)</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {chartData.summary.autoReclaimed.toLocaleString()} <span className="text-sm font-normal text-gray-500">ราย</span>
              </h3>
            </div>
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
              <Users size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-lg font-bold text-gray-900 mb-4">แนวโน้มการแจกงาน (รายวัน)</h3>
          <div className="h-[300px]">
            {loading ? (
              <div className="h-full flex items-center justify-center text-gray-400">กำลังโหลดข้อมูล...</div>
            ) : chartData.barChart.categories.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400">ไม่มีข้อมูลในช่วงเวลานี้</div>
            ) : (
              <Chart
                options={{
                  chart: {
                    type: 'bar',
                    stacked: true,
                    toolbar: { show: false },
                    fontFamily: 'Inter, sans-serif'
                  },
                  colors: ['#10b981', '#f43f5e'],
                  plotOptions: {
                    bar: {
                      borderRadius: 4,
                      columnWidth: '60%'
                    }
                  },
                  xaxis: {
                    categories: chartData.barChart.categories.map(d => format(new Date(d), 'd MMM', { locale: th })),
                    labels: {
                      style: { colors: '#64748b' }
                    }
                  },
                  yaxis: {
                    labels: {
                      formatter: (value) => Math.abs(value).toString(),
                      style: { colors: '#64748b' }
                    }
                  },
                  tooltip: {
                    y: {
                      formatter: (value) => Math.abs(value) + ' ราย'
                    }
                  },
                  legend: { position: 'top' },
                  dataLabels: { enabled: false }
                }}
                series={[{
                  name: 'ได้รับเข้า',
                  data: chartData.barChart.series[0].data
                }, {
                  name: 'ถูกดึง/โอนออก',
                  data: chartData.barChart.series[1].data.map(v => -v)
                }]}
                type="bar"
                height="100%"
              />
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-lg font-bold text-gray-900 mb-4">สัดส่วนตามแหล่งที่มา (Source)</h3>
          <div className="h-[300px] flex items-center justify-center">
            {loading ? (
              <div className="text-gray-400">กำลังโหลด...</div>
            ) : chartData.donutChart.series.length === 0 ? (
              <div className="text-gray-400">ไม่มีข้อมูล</div>
            ) : (
              <Chart
                options={{
                  chart: { type: 'donut', fontFamily: 'Inter, sans-serif' },
                  labels: chartData.donutChart.labels.map(l => 
                    l === 'distribution_v2' ? 'ระบบแจกงาน V2' :
                    l === 'index/customer_update' ? 'แก้ไข Manual' :
                    l === 'basket_routing_v2/assign_owner' ? 'ระบบ Routing' : l
                  ),
                  colors: ['#3b82f6', '#f59e0b', '#8b5cf6', '#10b981', '#64748b'],
                  plotOptions: {
                    pie: {
                      donut: { size: '65%' }
                    }
                  },
                  legend: { position: 'bottom' },
                  dataLabels: { enabled: false }
                }}
                series={chartData.donutChart.series}
                type="donut"
                width="100%"
                height="100%"
              />
            )}
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="text-gray-500" /> สมุดบัญชีรายชื่อ (Movement Ledger)
          </h3>
          <div className="text-sm text-gray-500">
            แสดงทั้งหมด {total.toLocaleString()} รายการ
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-100 text-gray-700 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">วันเวลา (Date)</th>
                <th className="px-4 py-3">ลูกค้า (Customer)</th>
                <th className="px-4 py-3">ความเคลื่อนไหว (Movement)</th>
                <th className="px-4 py-3">ช่องทาง (Source)</th>
                <th className="px-4 py-3">ทำรายการโดย (By)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
                      กำลังโหลดข้อมูล...
                    </div>
                  </td>
                </tr>
              ) : ledger.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400">ไม่มีความเคลื่อนไหวในช่วงเวลานี้</td>
                </tr>
              ) : (
                ledger.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{format(new Date(row.created_at), 'dd MMM yyyy', { locale: th })}</div>
                      <div className="text-xs text-gray-500">{format(new Date(row.created_at), 'HH:mm:ss')}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.first_name} {row.last_name}</div>
                      <div className="text-xs text-gray-500">{row.phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      {row.old_value && row.new_value ? (
                        <div className="flex items-center gap-2 text-indigo-600">
                          <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-xs">โอน (Transfer)</span>
                          <span className="text-gray-500 line-through text-xs">{row.old_agent_name || 'ID '+row.old_value}</span>
                          <span className="text-gray-400">→</span>
                          <span className="font-medium">{row.new_agent_name || 'ID '+row.new_value}</span>
                        </div>
                      ) : row.new_value ? (
                        <div className="flex items-center gap-2 text-emerald-600">
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-xs flex items-center gap-1"><ArrowDownRight size={12}/> รับเข้า</span>
                          <span className="text-gray-400 text-xs">จากส่วนกลาง</span>
                          <span className="text-gray-400">→</span>
                          <span className="font-medium">{row.new_agent_name || 'ID '+row.new_value}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-rose-600">
                          <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-xs flex items-center gap-1"><ArrowUpRight size={12}/> ดึงออก</span>
                          <span className="text-gray-500 line-through text-xs">{row.old_agent_name || 'ID '+row.old_value}</span>
                          <span className="text-gray-400">→</span>
                          <span className="text-gray-400 text-xs">คืนส่วนกลาง</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        row.api_source === 'distribution_v2' ? 'bg-blue-100 text-blue-700' :
                        row.api_source === 'index/customer_update' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {row.api_source || 'manual'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-600">
                          <UserIcon size={14} />
                        </div>
                        <span className="text-xs">{row.changed_by_name || 'System / ID '+row.changed_by}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
            <div className="text-sm text-gray-600">
              หน้า <span className="font-bold">{page}</span> จาก <span className="font-bold">{totalPages}</span>
            </div>
            <div className="flex gap-2">
              <button 
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 border border-gray-300 rounded bg-white text-gray-700 disabled:opacity-50 hover:bg-gray-50 transition-colors text-sm"
              >
                ก่อนหน้า
              </button>
              <button 
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 border border-gray-300 rounded bg-white text-gray-700 disabled:opacity-50 hover:bg-gray-50 transition-colors text-sm"
              >
                ถัดไป
              </button>
            </div>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}
