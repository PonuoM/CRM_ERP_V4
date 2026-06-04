import React, { useState, useEffect, useMemo } from 'react';
import { User, Order, UserRole, OrderStatus } from '../types';
import { getCancellationDashboardStats, acknowledgeCancellation, listOrders, getOrderCancellationsBatch } from '../services/api';
import DateRangePicker from '../components/DateRangePicker';
import { 
  BarChart3, Users, DollarSign, XCircle, AlertCircle, FileSpreadsheet, 
  ChevronDown, ChevronRight, CheckCircle2, PieChart as PieChartIcon
} from 'lucide-react';
import ReactApexChart from 'react-apexcharts';
import * as XLSX from 'xlsx';
import OrderTable from '../components/OrderTable';
import OrderDetailModal from '../components/OrderDetailModal';
import { useToast } from '../components/Toast';

interface CancellationDashboardPageProps {
  user: User;
}

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#8b5cf6', '#3b82f6', '#10b981', '#64748b'];

export default function CancellationDashboardPage({ user }: CancellationDashboardPageProps) {
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [stats, setStats] = useState<any[]>([]);
  const [reasons, setReasons] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  
  // Expanded user details
  const [expandedOrders, setExpandedOrders] = useState<any[]>([]);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const { error: toastError, success } = useToast();

  useEffect(() => {
    fetchStats();
  }, [dateRange]);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCancellationDashboardStats({
        dateStart: dateRange.start || undefined,
        dateEnd: dateRange.end || undefined
      });
      if (res && res.ok) {
        setStats(res.salespersonStats || []);
        setReasons(res.reasonsBreakdown || []);
      } else {
        setError(res?.error || 'Failed to load stats');
      }
    } catch (e: any) {
      setError(e.message || 'Error loading stats');
    } finally {
      setLoading(false);
    }
  };

  const loadExpandedOrders = async (userId: number) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
      return;
    }
    
    setExpandedUser(userId);
    setExpandedLoading(true);
    try {
      const res = await listOrders({
        companyId: user.companyId,
        creatorId: userId,
        orderStatus: OrderStatus.Cancelled,
        orderDateStart: dateRange.start || undefined,
        orderDateEnd: dateRange.end || undefined,
        pageSize: 500
      });
      
      if (res.ok && res.orders) {
        const orders = res.orders;
        const orderIds = orders.map((o: any) => o.id);
        
        let ackMap: Record<string, any> = {};
        if (orderIds.length > 0) {
          const ackRes = await getOrderCancellationsBatch(orderIds);
          if (ackRes && ackRes.data) {
            ackMap = ackRes.data;
          }
        }

        const enrichedOrders = orders.map((o: any) => ({
          ...o,
          orderDate: o.order_date || o.orderDate,
          totalAmount: o.total_amount ?? o.totalAmount ?? 0,
          customerInfo: {
            firstName: o.customer_first_name || o.recipient_first_name || (o.customerInfo && o.customerInfo.firstName) || '',
            lastName: o.customer_last_name || o.recipient_last_name || (o.customerInfo && o.customerInfo.lastName) || '',
          },
          is_acknowledged: ackMap[o.id]?.is_acknowledged ? 1 : 0
        }));
        
        setExpandedOrders(enrichedOrders);
      } else {
        setExpandedOrders([]);
      }
    } catch (e) {
      console.error(e);
      setExpandedOrders([]);
    } finally {
      setExpandedLoading(false);
    }
  };

  const handleAcknowledge = async (orderId: string) => {

    try {
      const res = await acknowledgeCancellation(orderId);
      if (res && res.ok) {
        // Update local state
        setExpandedOrders(prev => 
          prev.map(o => o.id === orderId ? { ...o, is_acknowledged: 1 } : o)
        );
        // Reduce unacknowledged_count in stats
        setStats(prev => 
          prev.map(s => 
            s.user_id === expandedUser && s.unacknowledged_count > 0
              ? { ...s, unacknowledged_count: s.unacknowledged_count - 1 }
              : s
          )
        );
        success('สำเร็จ', 'บันทึกการรับทราบเรียบร้อยแล้ว');
      } else {
        toastError('ข้อผิดพลาด', res?.message || 'Failed to acknowledge');
      }
    } catch (e: any) {
      toastError('ข้อผิดพลาด', e.message || 'Failed to acknowledge');
      console.error(e);
    }
  };

  const handleExport = () => {
    const dataToExport = stats.map(s => ({
      'รหัสพนักงาน': s.user_id,
      'ชื่อพนักงาน': s.name,
      'ออเดอร์ทั้งหมด': s.total_orders,
      'ออเดอร์ยกเลิก': s.cancelled_count,
      'อัตรายกเลิก (%)': s.cancellation_rate,
      'มูลค่าความเสียหาย': s.cancelled_value
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cancellation_Stats");
    XLSX.writeFile(wb, `Cancellation_Stats_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const totalCancelled = stats.reduce((sum, s) => sum + Number(s.cancelled_count), 0);
  const totalValue = stats.reduce((sum, s) => sum + Number(s.cancelled_value), 0);
  const avgRate = stats.length > 0 
    ? (stats.reduce((sum, s) => sum + Number(s.cancellation_rate), 0) / stats.length).toFixed(2)
    : 0;

  return (
    <div className="flex flex-col h-full bg-slate-50 font-sans animate-fade-in">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">แดชบอร์ดยกเลิก (Cancellation Dashboard)</h1>
            <p className="text-xs text-gray-500">ติดตามสถิติและเหตุผลการยกเลิกคำสั่งซื้อ</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-500 border-t-transparent mr-3"></div>
            กำลังโหลดข้อมูล...
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        ) : (
          <div className="space-y-6 max-w-7xl mx-auto">
            
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
                        <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider w-10"></th>
                        <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">พนักงาน</th>
                        <th className="px-6 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">ออเดอร์รวม</th>
                        <th className="px-6 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">ยอดที่ยกเลิก</th>
                        <th className="px-6 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">อัตรา (%)</th>
                        <th className="px-6 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">มูลค่าความเสียหาย</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {stats.map((row) => (
                        <React.Fragment key={row.user_id}>
                          <tr 
                            className={`hover:bg-gray-50 cursor-pointer transition-colors ${expandedUser === row.user_id ? 'bg-blue-50/50' : ''}`}
                            onClick={() => loadExpandedOrders(row.user_id)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-gray-400">
                              {expandedUser === row.user_id ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 flex items-center gap-2">
                              {row.name}
                              {(user.role === UserRole.Supervisor || user.role === UserRole.SuperAdmin || user.role === UserRole.AdminControl) && row.unacknowledged_count > 0 && (
                                <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  รอรับทราบ {row.unacknowledged_count}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600">{row.total_orders}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-red-600">{row.cancelled_count}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                row.cancellation_rate > 20 ? 'bg-red-100 text-red-800' :
                                row.cancellation_rate > 10 ? 'bg-orange-100 text-orange-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {row.cancellation_rate}%
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 font-mono">฿ {Number(row.cancelled_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                          {expandedUser === row.user_id && (
                            <tr>
                              <td colSpan={6} className="bg-gray-50 p-4 border-b border-gray-200">
                                {expandedLoading ? (
                                  <div className="py-8 text-center text-gray-500">กำลังโหลดออเดอร์...</div>
                                ) : (
                                  <div className="bg-white rounded shadow-sm border border-gray-200 p-4">
                                    <h4 className="font-semibold text-gray-700 mb-3 text-sm">รายการออเดอร์ที่ถูกยกเลิก</h4>
                                    {expandedOrders.length === 0 ? (
                                      <p className="text-gray-500 text-sm">ไม่พบออเดอร์</p>
                                    ) : (
                                      <div className="space-y-3">
                                        {expandedOrders.map(order => (
                                          <div key={order.id} className="flex flex-wrap items-center justify-between p-3 border border-gray-100 rounded-lg hover:border-blue-200 hover:bg-blue-50/30 transition-colors">
                                            <div className="flex flex-col gap-1">
                                              <div className="flex items-center gap-2">
                                                <span 
                                                  className="font-mono font-medium text-blue-700 cursor-pointer hover:underline"
                                                  onClick={() => setSelectedOrderId(order.id)}
                                                >
                                                  {order.id}
                                                </span>
                                                <span className="text-sm text-gray-500">{order.customerInfo?.firstName} {order.customerInfo?.lastName}</span>
                                              </div>
                                              <div className="text-xs text-gray-400">วันที่สั่งซื้อ: {order.orderDate ? new Date(order.orderDate).toLocaleDateString('th-TH') : '-'} • ยอด: ฿{(order.totalAmount || 0).toLocaleString()}</div>
                                            </div>
                                            <div>
                                              {(user.role === UserRole.Supervisor || user.role === UserRole.SuperAdmin || user.role === UserRole.AdminControl) ? (
                                                (order as any).is_acknowledged ? (
                                                  <span className="text-xs font-medium text-green-600 flex items-center gap-1">
                                                    <CheckCircle2 className="w-4 h-4" /> รับทราบแล้ว
                                                  </span>
                                                ) : (
                                                  <button
                                                    onClick={() => handleAcknowledge(order.id)}
                                                    className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-1"
                                                  >
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    กดรับทราบ
                                                  </button>
                                                )
                                              ) : (
                                                (order as any).is_acknowledged ? (
                                                  <span className="text-xs font-medium text-green-600 flex items-center gap-1">
                                                    <CheckCircle2 className="w-4 h-4" /> Supervisor รับทราบแล้ว
                                                  </span>
                                                ) : (
                                                  <span className="text-xs text-gray-400">รอรับทราบ</span>
                                                )
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                      {stats.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-gray-500">ไม่มีข้อมูลการยกเลิกในช่วงเวลานี้</td>
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
                <div className="p-6 flex-1 flex flex-col items-center justify-center">
                  {reasons.length > 0 ? (
                    <div className="w-full h-64">
                      <ReactApexChart 
                        options={{
                          chart: { type: 'donut', fontFamily: 'inherit' },
                          labels: reasons.map(r => r.label),
                          colors: COLORS,
                          legend: { position: 'bottom' },
                          tooltip: { y: { formatter: (val) => `${val} รายการ` } },
                          plotOptions: { pie: { donut: { size: '60%' } } },
                          dataLabels: { enabled: false }
                        }}
                        series={reasons.map(r => Number(r.count))}
                        type="donut"
                        height="100%"
                      />
                    </div>
                  ) : (
                    <div className="text-center text-gray-400 py-12">
                      <PieChartIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
                      ไม่มีข้อมูลสัดส่วน
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      <OrderDetailModal 
        isOpen={!!selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        orderId={selectedOrderId}
        companyId={user.companyId}
      />
    </div>
  );
}
