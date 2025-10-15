import React, { useMemo, useState, useEffect } from 'react';
import { Order, Customer, CallHistory, User } from '@/types';
import { Calendar, Download, RefreshCcw, MessageSquare, MessageCircle, Phone, UserPlus, ShoppingCart, Settings, X, Save, Plus } from 'lucide-react';
import StatCard from '@/components/StatCard';
import MultiLineChart from '@/components/MultiLineChart';

interface PageStatsPageProps {
  orders?: Order[];
  customers?: Customer[];
  calls?: CallHistory[];
}

interface EnvVariable {
  id?: number;
  key: string;
  value: string;
  created_at?: string;
  updated_at?: string;
}

type DailyRow = {
  date: string; // YYYY-MM-DD
  newCustomers: number;
  totalPhones: number;
  newPhones: number;
  totalComments: number; // placeholder
  totalChats: number; // calls used as proxy
  totalPageComments: number; // placeholder
  totalPageChats: number; // placeholder
  newChats: number; // calls from new customers that day
  chatsFromOldCustomers: number; // calls from existing customers that day
  webLoggedIn: number; // placeholder
  webGuest: number; // placeholder
  ordersCount: number;
  pctPurchasePerNewCustomer: number; // 0..100
  pctPurchasePerPhone: number; // 0..100
  ratioNewPhonesToNewCustomers: number; // 0..1
};

function fmtDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const PageStatsPage: React.FC<PageStatsPageProps> = ({ orders = [], customers = [], calls = [] }) => {
  const [rangeDays, setRangeDays] = useState<number>(90);
  const [isEnvSidebarOpen, setIsEnvSidebarOpen] = useState<boolean>(false);
  const [envVariables, setEnvVariables] = useState<EnvVariable[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [newEnvVar, setNewEnvVar] = useState<EnvVariable>({
    key: 'ACCESS_TOKEN_PANCAKE_',
    value: ''
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Get current user from localStorage
  useEffect(() => {
    try {
      const sessionData = localStorage.getItem('sessionUser');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        if (session) {
          setCurrentUser(session);
          setNewEnvVar({
            key: `ACCESS_TOKEN_PANCAKE_${session.company_id}`,
            value: ''
          });
        }
      }
    } catch (error) {
      console.error('Error getting user from localStorage:', error);
    }
  }, []);

  const customersById = useMemo(() => {
    const map: Record<string, Customer> = {};
    customers.forEach(c => { map[c.id] = c; });
    return map;
  }, [customers]);

  const startDate = useMemo(() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() - (rangeDays - 1));
    return d;
  }, [rangeDays]);

  const days: string[] = useMemo(() => {
    const res: string[] = [];
    const d = new Date(startDate);
    for (let i = 0; i < rangeDays; i++) {
      res.push(fmtDate(d));
      d.setDate(d.getDate() + 1);
    }
    return res;
  }, [startDate, rangeDays]);

  const daily: DailyRow[] = useMemo(() => {
    const rows: DailyRow[] = [];
    for (const day of days) {
      const newCust = customers.filter(c => c.dateRegistered && c.dateRegistered.slice(0, 10) === day);
      const ordersOfDay = orders.filter(o => o.orderDate.slice(0, 10) === day);

      const custIdsWithOrders = new Set(ordersOfDay.map(o => o.customerId));
      const phonesEngaged = new Set<string>();
      for (const cid of custIdsWithOrders) {
        const c = customersById[cid];
        if (c?.phone) phonesEngaged.add(c.phone);
      }
      for (const c of newCust) { if (c.phone) phonesEngaged.add(c.phone); }

      const callsOfDay = calls.filter(cl => cl.date.slice(0, 10) === day);
      const newChats = callsOfDay.filter(cl => {
        const cu = customersById[cl.customerId];
        return cu?.dateRegistered?.slice(0,10) === day;
      });

      const row: DailyRow = {
        date: day,
        newCustomers: newCust.length,
        totalPhones: phonesEngaged.size,
        newPhones: newCust.length, // approximation: every new customer provides a new phone
        totalComments: 0, // no source yet
        totalChats: callsOfDay.length,
        totalPageComments: 0,
        totalPageChats: 0,
        newChats: newChats.length,
        chatsFromOldCustomers: Math.max(0, callsOfDay.length - newChats.length),
        webLoggedIn: 0,
        webGuest: 0,
        ordersCount: ordersOfDay.length,
        pctPurchasePerNewCustomer: newCust.length > 0 ? (ordersOfDay.filter(o => newCust.some(c => c.id === o.customerId)).length / newCust.length) * 100 : 0,
        pctPurchasePerPhone: phonesEngaged.size > 0 ? (ordersOfDay.length / phonesEngaged.size) * 100 : 0,
        ratioNewPhonesToNewCustomers: newCust.length > 0 ? newCust.length / newCust.length : 0,
      };
      rows.push(row);
    }
    return rows;
  }, [customers, orders, calls, customersById, days]);

  const totals = useMemo(() => {
    return daily.reduce((acc, r) => {
      acc.newCustomers += r.newCustomers;
      acc.totalPhones += r.totalPhones;
      acc.newPhones += r.newPhones;
      acc.totalComments += r.totalComments;
      acc.totalChats += r.totalChats;
      acc.totalPageComments += r.totalPageComments;
      acc.totalPageChats += r.totalPageChats;
      acc.newChats += r.newChats;
      acc.chatsFromOldCustomers += r.chatsFromOldCustomers;
      acc.webLoggedIn += r.webLoggedIn;
      acc.webGuest += r.webGuest;
      acc.ordersCount += r.ordersCount;
      return acc;
    }, {
      newCustomers: 0, totalPhones: 0, newPhones: 0, totalComments: 0, totalChats: 0,
      totalPageComments: 0, totalPageChats: 0, newChats: 0, chatsFromOldCustomers: 0,
      webLoggedIn: 0, webGuest: 0, ordersCount: 0
    } as any);
  }, [daily]);

  const prevPeriodTotals = useMemo(() => {
    // Previous N days period for trend
    const endPrev = new Date(startDate);
    endPrev.setDate(endPrev.getDate() - 1);
    const startPrev = new Date(endPrev);
    startPrev.setDate(startPrev.getDate() - (rangeDays - 1));
    const inPrevRange = (iso: string) => iso >= fmtDate(startPrev) && iso <= fmtDate(endPrev);
    const newCustomersPrev = customers.filter(c => c.dateRegistered && inPrevRange(c.dateRegistered.slice(0,10))).length;
    const ordersPrev = orders.filter(o => inPrevRange(o.orderDate.slice(0,10))).length;
    const callsPrev = calls.filter(cl => inPrevRange(cl.date.slice(0,10))).length;
    return { newCustomersPrev, ordersPrev, callsPrev };
  }, [customers, orders, calls, startDate, rangeDays]);

  const pctChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };

  const chartLabels = useMemo(() => daily.map(d => d.date.slice(5)), [daily]);
  const chartSeries = useMemo(() => [
    { name: 'จำนวนคอมเม้น', color: '#3B82F6', data: daily.map(d => ({ label: d.date.slice(5), value: d.totalComments })) },
    { name: 'จำนวนข้อความ', color: '#10B981', data: daily.map(d => ({ label: d.date.slice(5), value: d.totalChats })) },
  ], [daily]);

  const exportCSV = () => {
    const headers = [
      'เวลา','ลูกค้าใหม่','เบอร์โทรศัพท์ทั้งหมด','เบอร์โทรใหม่','คอมเม้นจากลูกค้าทั้งหมด','แชทจากลูกค้าทั้งหมด','ความคิดเห็นจากเพจทั้งหมด','แชทจากเพจทั้งหมด','แชทใหม่','แชทจากลูกค้าเก่า','ลูกค้าจากเว็บไซต์ (เข้าสู่ระบบ)','ลูกค้าจากเว็บไซต์ (ไม่ได้เข้าสู่ระบบ)','ยอดออเดอร์','เปอร์เซ็นต์การสั่งซื้อต่อลูกค้าใหม่','เปอร์เซ็นต์การสั่งซื้อต่อเบอร์โทรศัพท์','สัดส่วนเบอร์โทรศัพท์ใหม่ ต่อ ลูกค้าใหม่'
    ];
    const rows = daily.map(r => [
      r.date, r.newCustomers, r.totalPhones, r.newPhones, r.totalComments, r.totalChats, r.totalPageComments, r.totalPageChats, r.newChats, r.chatsFromOldCustomers, r.webLoggedIn, r.webGuest, r.ordersCount, r.pctPurchasePerNewCustomer.toFixed(2), r.pctPurchasePerPhone.toFixed(2), r.ratioNewPhonesToNewCustomers.toFixed(2)
    ]);
    rows.push([
      'รวม', totals.newCustomers, totals.totalPhones, totals.newPhones, totals.totalComments, totals.totalChats, totals.totalPageComments, totals.totalPageChats, totals.newChats, totals.chatsFromOldCustomers, totals.webLoggedIn, totals.webGuest, totals.ordersCount, '', '', ''
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `page-stats-${fmtDate(startDate)}-to-${fmtDate(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Fetch env variables
  useEffect(() => {
    const fetchEnvVariables = async () => {
      try {
        const response = await fetch('api/Page_DB/env_manager.php');
        if (response.ok) {
          const data = await response.json();
          setEnvVariables(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Error fetching env variables:', error);
      }
    };

    if (isEnvSidebarOpen) {
      fetchEnvVariables();
    }
  }, [isEnvSidebarOpen]);

  // Save env variable
  const saveEnvVariable = async (envVar: EnvVariable) => {
    if (!envVar.key.trim() || !envVar.value.trim()) {
      alert('กรุณาระบุ key และ value');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('api/Page_DB/env_manager.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: envVar.key,
          value: envVar.value
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Refresh env variables
          const fetchResponse = await fetch('api/Page_DB/env_manager.php');
          if (fetchResponse.ok) {
            const data = await fetchResponse.json();
            setEnvVariables(Array.isArray(data) ? data : []);
          }
          // Reset new env var
          setNewEnvVar({
            key: currentUser ? `ACCESS_TOKEN_PANCAKE_${currentUser.companyId}` : 'ACCESS_TOKEN_PANCAKE_',
            value: ''
          });
          alert('บันทึกสำเร็จ');
        } else {
          alert('เกิดข้อผิดพลาด: ' + (result.error || 'Unknown error'));
        }
      } else {
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
      }
    } catch (error) {
      console.error('Error saving env variable:', error);
      alert('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete env variable
  const deleteEnvVariable = async (key: string) => {
    if (!confirm(`คุณต้องการลบตัวแปร ${key} หรือไม่?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`api/Page_DB/env_manager.php?key=${encodeURIComponent(key)}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Refresh env variables
          const fetchResponse = await fetch('api/Page_DB/env_manager.php');
          if (fetchResponse.ok) {
            const data = await fetchResponse.json();
            setEnvVariables(Array.isArray(data) ? data : []);
          }
          alert('ลบสำเร็จ');
        } else {
          alert('เกิดข้อผิดพลาด: ' + (result.error || 'Unknown error'));
        }
      } else {
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
      }
    } catch (error) {
      console.error('Error deleting env variable:', error);
      alert('เกิดข้อผิดพลาดในการลบ');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6">
      {/* Controls */}
      <div className="bg-white border rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <select value={rangeDays} onChange={e => setRangeDays(Number(e.target.value))} className="border rounded-md px-3 py-2 text-sm">
              <option value={7}>7 วันย้อนหลัง</option>
              <option value={30}>30 วันย้อนหลัง</option>
              <option value={90}>90 วันย้อนหลัง</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setRangeDays(rangeDays)} className="border rounded-md px-3 py-2 text-sm flex items-center gap-1"><RefreshCcw className="w-4 h-4"/> รีเฟรช</button>
            <button onClick={exportCSV} className="border rounded-md px-3 py-2 text-sm flex items-center gap-1"><Download className="w-4 h-4"/> ดาวน์โหลด CSV</button>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="mb-6">
        <MultiLineChart title="ภาพรวมของหน้า" series={chartSeries} yLabel="จำนวน" xLabelEvery={rangeDays >= 60 ? 4 : 1} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard title="เบอร์โทรใหม่" value={totals.newPhones.toString()} subtext={`${pctChange(totals.newPhones, prevPeriodTotals.newCustomersPrev).toFixed(1)}% ช่วงก่อนหน้า`} icon={Phone} />
        <StatCard title="จำนวนแชท" value={totals.totalChats.toString()} subtext={`${pctChange(totals.totalChats, prevPeriodTotals.callsPrev).toFixed(1)}% ช่วงก่อนหน้า`} icon={MessageSquare} />
        <StatCard title="ลูกค้าใหม่" value={totals.newCustomers.toString()} subtext={`${pctChange(totals.newCustomers, prevPeriodTotals.newCustomersPrev).toFixed(1)}% ช่วงก่อนหน้า`} icon={UserPlus} />
        <StatCard title="ยอดออเดอร์" value={totals.ordersCount.toString()} subtext={`${pctChange(totals.ordersCount, prevPeriodTotals.ordersPrev).toFixed(1)}% ช่วงก่อนหน้า`} icon={ShoppingCart} />
      </div>

      {/* Table */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 overflow-auto">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-md font-semibold text-gray-700">รายละเอียดสถิติ</h3>
          <div className="text-xs text-gray-500">สถิติต่อวัน</div>
        </div>
        <div className="w-full overflow-auto">
          <table className="min-w-[1200px] w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th className="px-3 py-2 text-left">เวลา</th>
                <th className="px-3 py-2 text-right">ลูกค้าใหม่</th>
                <th className="px-3 py-2 text-right">เบอร์โทรศัพท์ทั้งหมด</th>
                <th className="px-3 py-2 text-right">เบอร์โทรใหม่</th>
                <th className="px-3 py-2 text-right">คอมเม้นจากลูกค้าทั้งหมด</th>
                <th className="px-3 py-2 text-right">แชทจากลูกค้าทั้งหมด</th>
                <th className="px-3 py-2 text-right">ความคิดเห็นจากเพจทั้งหมด</th>
                <th className="px-3 py-2 text-right">แชทจากเพจทั้งหมด</th>
                <th className="px-3 py-2 text-right">แชทใหม่</th>
                <th className="px-3 py-2 text-right">แชทจากลูกค้าเก่า</th>
                <th className="px-3 py-2 text-right">ลูกค้าจากเว็บไซต์ (เข้าสู่ระบบ)</th>
                <th className="px-3 py-2 text-right">ลูกค้าจากเว็บไซต์ (ไม่ได้เข้าสู่ระบบ)</th>
                <th className="px-3 py-2 text-right">ยอดออเดอร์</th>
                <th className="px-3 py-2 text-right">% สั่งซื้อ ต่อลูกค้าใหม่</th>
                <th className="px-3 py-2 text-right">% สั่งซื้อ ต่อเบอร์โทรศัพท์</th>
                <th className="px-3 py-2 text-right">สัดส่วนเบอร์โทรใหม่/ลูกค้าใหม่</th>
              </tr>
            </thead>
            <tbody>
              {daily.map(r => (
                <tr key={r.date} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-700">{r.date}</td>
                  <td className="px-3 py-2 text-right">{r.newCustomers}</td>
                  <td className="px-3 py-2 text-right">{r.totalPhones}</td>
                  <td className="px-3 py-2 text-right">{r.newPhones}</td>
                  <td className="px-3 py-2 text-right">{r.totalComments}</td>
                  <td className="px-3 py-2 text-right">{r.totalChats}</td>
                  <td className="px-3 py-2 text-right">{r.totalPageComments}</td>
                  <td className="px-3 py-2 text-right">{r.totalPageChats}</td>
                  <td className="px-3 py-2 text-right">{r.newChats}</td>
                  <td className="px-3 py-2 text-right">{r.chatsFromOldCustomers}</td>
                  <td className="px-3 py-2 text-right">{r.webLoggedIn}</td>
                  <td className="px-3 py-2 text-right">{r.webGuest}</td>
                  <td className="px-3 py-2 text-right">{r.ordersCount}</td>
                  <td className="px-3 py-2 text-right">{r.pctPurchasePerNewCustomer.toFixed(2)}%</td>
                  <td className="px-3 py-2 text-right">{r.pctPurchasePerPhone.toFixed(2)}%</td>
                  <td className="px-3 py-2 text-right">{r.ratioNewPhonesToNewCustomers.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 font-semibold bg-gray-50">
                <td className="px-3 py-2">รวม</td>
                <td className="px-3 py-2 text-right">{totals.newCustomers}</td>
                <td className="px-3 py-2 text-right">{totals.totalPhones}</td>
                <td className="px-3 py-2 text-right">{totals.newPhones}</td>
                <td className="px-3 py-2 text-right">{totals.totalComments}</td>
                <td className="px-3 py-2 text-right">{totals.totalChats}</td>
                <td className="px-3 py-2 text-right">{totals.totalPageComments}</td>
                <td className="px-3 py-2 text-right">{totals.totalPageChats}</td>
                <td className="px-3 py-2 text-right">{totals.newChats}</td>
                <td className="px-3 py-2 text-right">{totals.chatsFromOldCustomers}</td>
                <td className="px-3 py-2 text-right">{totals.webLoggedIn}</td>
                <td className="px-3 py-2 text-right">{totals.webGuest}</td>
                <td className="px-3 py-2 text-right">{totals.ordersCount}</td>
                <td className="px-3 py-2 text-right"></td>
                <td className="px-3 py-2 text-right"></td>
                <td className="px-3 py-2 text-right"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Floating button for env management */}
      <button
        onClick={() => setIsEnvSidebarOpen(true)}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg z-40 flex items-center justify-center transition-all duration-200 hover:scale-110"
        title="จัดการตัวแปรสภาพแวดล้อม"
      >
        <Settings className="w-6 h-6" />
      </button>

      {/* Off-canvas sidebar for env management */}
      <div className={`fixed top-0 right-0 h-full w-96 bg-white shadow-xl transform transition-transform duration-300 z-50 ${
        isEnvSidebarOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-xl font-semibold">จัดการตัวแปรสภาพแวดล้อม</h2>
            <button
              onClick={() => setIsEnvSidebarOpen(false)}
              className="p-1 rounded-full hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {/* Add new env variable */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-md font-medium mb-3">เพิ่มตัวแปรใหม่</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Key</label>
                    <input
                      type="text"
                      value={newEnvVar.key}
                      onChange={(e) => setNewEnvVar({ ...newEnvVar, key: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="ACCESS_TOKEN_PANCAKE_1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                    <textarea
                      value={newEnvVar.value}
                      onChange={(e) => setNewEnvVar({ ...newEnvVar, value: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="ค่าของตัวแปร"
                      rows={3}
                    />
                  </div>
                  <button
                    onClick={() => saveEnvVariable(newEnvVar)}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {isLoading ? 'กำลังบันทึก...' : 'บันทึก'}
                  </button>
                </div>
              </div>

              {/* List existing env variables */}
              <div>
                <h3 className="text-md font-medium mb-3">ตัวแปรที่มีอยู่</h3>
                {envVariables.length === 0 ? (
                  <p className="text-gray-500 text-sm">ไม่มีตัวแปร</p>
                ) : (
                  <div className="space-y-2">
                    {envVariables.map((envVar) => (
                      <div key={envVar.id || envVar.key} className="bg-white border border-gray-200 rounded-lg p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 mr-2">
                            <div className="font-medium text-sm text-gray-900">{envVar.key}</div>
                            <div className="text-sm text-gray-600 mt-1 break-all">{envVar.value}</div>
                            {envVar.updated_at && (
                              <div className="text-xs text-gray-400 mt-1">
                                อัพเดต: {new Date(envVar.updated_at).toLocaleString('th-TH')}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => deleteEnvVariable(envVar.key)}
                            disabled={isLoading}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                            title="ลบตัวแปร"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay for sidebar */}
      {isEnvSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsEnvSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default PageStatsPage;
