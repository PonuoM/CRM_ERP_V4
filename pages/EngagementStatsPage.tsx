import React, { useMemo, useState, useEffect } from 'react';
import { Order, Customer, CallHistory, Page, User, UserRole } from '@/types';
import ReactApexChart from 'react-apexcharts';
import { Users as UsersIcon, Phone, ShoppingCart, Activity, ChevronDown, X, Search, Settings, Save } from 'lucide-react';
import StatCard from '@/components/StatCard';
import DateRangePicker, { DateRange } from '@/components/DateRangePicker';

interface EngagementStatsPageProps {
  orders?: Order[];
  customers?: Customer[];
  calls?: CallHistory[];
  pages?: Page[];
  users?: User[];
}

interface EnvVariable {
  id?: number;
  key: string;
  value: string;
  created_at?: string;
  updated_at?: string;
}

function fmtDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const EngagementStatsPage: React.FC<EngagementStatsPageProps> = ({ orders = [], customers = [], calls = [], pages = [], users = [] }) => {
  const [range, setRange] = useState<DateRange>(() => {
    const end = new Date();
    end.setSeconds(59,0);
    const start = new Date(end);
    start.setDate(start.getDate() - 89);
    start.setHours(0,0,0,0);
    return { start: start.toISOString(), end: end.toISOString() };
  });
  const [activeTab, setActiveTab] = useState<'time' | 'user' | 'page'>('time');
  const [pageSearchTerm, setPageSearchTerm] = useState<string>('');
  const [isSelectOpen, setIsSelectOpen] = useState<boolean>(false);
  const [pageSelectError, setPageSelectError] = useState<string>('');
  const [allPages, setAllPages] = useState<Array<{id: number, name: string, page_id: string}>>([]);
  const [isEnvSidebarOpen, setIsEnvSidebarOpen] = useState<boolean>(false);
  const [envVariables, setEnvVariables] = useState<EnvVariable[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [newEnvVar, setNewEnvVar] = useState<EnvVariable>({
    key: 'ACCESS_TOKEN_PANCAKE_',
    value: ''
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [engagementData, setEngagementData] = useState<any>(null);
  const [useEngagementData, setUseEngagementData] = useState<boolean>(false);

  const customerById = useMemo(() => {
    const map: Record<string, Customer> = {};
    customers.forEach(c => { map[c.id] = c });
    return map;
  }, [customers]);

  const startDate = useMemo(() => new Date(range.start), [range.start]);
  const endDate = useMemo(() => new Date(range.end), [range.end]);
  const activePages = useMemo(() => allPages.filter(p => pages.some(p2 => p2.id === p.id && p2.active)), [allPages, pages]);
  const [selectedPageId, setSelectedPageId] = useState<number | 'all'>('all');

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

  // Fetch pages for filter dropdown
  useEffect(() => {
    const fetchPages = async () => {
      try {
        const response = await fetch('api/index.php/pages');
        if (response.ok) {
          const data = await response.json();
          setAllPages(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Error fetching pages:', error);
      }
    };

    fetchPages();
  }, []);

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

  const inRange = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= startDate.getTime() && t <= endDate.getTime();
  };

  const callsInRange = useMemo(() => calls.filter(c => inRange(c.date)), [calls, range.start, range.end]);
  const ordersInRange = useMemo(() => orders.filter(o => inRange(o.orderDate)), [orders, range.start, range.end]);
  // Page-filtered orders (used by time/user tabs only)
  const ordersInRangeForTable = useMemo(() => {
    if (selectedPageId === 'all') return ordersInRange;
    const pageName = allPages.find(p => (p.page_id || p.id) === selectedPageId)?.name;
    return ordersInRange.filter(o => (typeof o.salesChannelPageId !== 'undefined' && o.salesChannelPageId === selectedPageId) || (pageName && o.salesChannel === pageName));
  }, [ordersInRange, selectedPageId, allPages]);

  const talkedCalls = useMemo(() => callsInRange.filter(c => (c.duration ?? 0) >= 40).length, [callsInRange]);
  const totalCalls = callsInRange.length;
  const talkRate = totalCalls > 0 ? (talkedCalls / totalCalls) * 100 : 0;

  const totalOrders = ordersInRange.length;
  const ordersFromNewCustomers = useMemo(() => ordersInRange.filter(o => {
    const cust = customerById[o.customerId];
    if (!cust?.dateRegistered) return false;
    // Treat order as from new customer if the customer's registered date is within range
    return inRange(cust.dateRegistered);
  }).length, [ordersInRange, customerById, range.start, range.end]);

  // Daily rows
  const days: string[] = useMemo(() => {
    const res: string[] = [];
    const d = new Date(startDate);
    while (d.getTime() <= endDate.getTime()) { res.push(fmtDate(d)); d.setDate(d.getDate()+1); }
    return res;
  }, [startDate, endDate]);

  const rows = useMemo(() => days.map(day => {
    const dayCalls = callsInRange.filter(c => c.date.slice(0,10) === day);
    const talked = dayCalls.filter(c => (c.duration ?? 0) >= 40).length;
    const dayOrders = ordersInRangeForTable.filter(o => o.orderDate.slice(0,10) === day);
    const dayOrdersNew = dayOrders.filter(o => {
      const cu = customerById[o.customerId];
      return cu?.dateRegistered?.slice(0,10) === day;
    }).length;
    const newInteract = dayCalls.filter(c => {
      const cu = customerById[c.customerId];
      return cu?.dateRegistered?.slice(0,10) === day;
    }).length;
    const oldInteract = Math.max(0, dayCalls.length - newInteract);
    return {
      date: day,
      newInteract, oldInteract, totalInteract: dayCalls.length, talked,
      totalOrders: dayOrders.length, ordersFromNew: dayOrdersNew,
      pctOrderPerInteract: dayCalls.length > 0 ? (dayOrders.length / dayCalls.length) * 100 : 0,
      pctOrderPerNew: newInteract > 0 ? (dayOrdersNew / newInteract) * 100 : 0,
    };
  }), [days, callsInRange, ordersInRangeForTable, customerById]);

  const sum = useMemo(() => rows.reduce((a, r) => ({
    newInteract: a.newInteract + r.newInteract,
    oldInteract: a.oldInteract + r.oldInteract,
    totalInteract: a.totalInteract + r.totalInteract,
    talked: a.talked + r.talked,
    totalOrders: a.totalOrders + r.totalOrders,
    ordersFromNew: a.ordersFromNew + r.ordersFromNew,
  }), { newInteract: 0, oldInteract: 0, totalInteract: 0, talked: 0, totalOrders: 0, ordersFromNew: 0 }), [rows]);

  // Chart options (semi gauge)
  const makeSemiGauge = (valuePct: number, color: string) => ({
    series: [Math.max(0, Math.min(100, Number(valuePct.toFixed(2))))],
    options: {
      chart: { type: 'radialBar', toolbar: { show: false } },
      plotOptions: {
        radialBar: {
          startAngle: -90,
          endAngle: 90,
          hollow: { size: '60%' },
          track: { background: '#F3F4F6' },
          dataLabels: {
            name: { show: false },
            value: { offsetY: -2, fontSize: '20px', formatter: (v: any) => `${v}%` }
          }
        }
      },
      colors: [color],
      labels: ['Percent'],
    } as any
  });

  const talkGauge = makeSemiGauge(talkRate, '#34D399');
  const orderRate = makeSemiGauge(totalCalls > 0 ? (totalOrders / totalCalls) * 100 : 0, '#3B82F6');
  
  // Aggregations for tabs (per user, per page)
  const activeAdminUsers = useMemo(() => {
    return users.filter(u => u.role === UserRole.Admin && ((u as any).status ? String((u as any).status).toLowerCase() === 'active' : true));
  }, [users]);
  const displayNameById: Record<number, string> = useMemo(() => {
    const m: Record<number, string> = {};
    activeAdminUsers.forEach(u => { m[u.id] = `${u.firstName} ${u.lastName}`.trim(); });
    return m;
  }, [activeAdminUsers]);
  
  type Agg = { newInteract: number; oldInteract: number; totalInteract: number; talked: number; totalOrders: number; ordersFromNew: number };
  const userAgg: Record<string, Agg> = useMemo(() => {
    const agg: Record<string, Agg> = {};
    const add = (k: string) => (agg[k] = agg[k] || { newInteract: 0, oldInteract: 0, totalInteract: 0, talked: 0, totalOrders: 0, ordersFromNew: 0 });
    // Calls by caller
    for (const c of callsInRange) {
      const key = c.caller || 'ไม่ระบุ';
      const a = add(key);
      const isNew = (() => { const cu = customerById[c.customerId]; return !!(cu?.dateRegistered && inRange(cu.dateRegistered)); })();
      a.totalInteract += 1; if (isNew) a.newInteract += 1; else a.oldInteract += 1; if ((c.duration ?? 0) >= 40) a.talked += 1;
    }
    // Orders by creatorId mapped to user name (page-filtered)
    for (const o of ordersInRangeForTable) {
      const key = displayNameById[o.creatorId] || 'ไม่ระบุ';
      const a = add(key);
      a.totalOrders += 1;
      const isNew = (() => { const cu = customers.find(c => c.id === o.customerId); return !!(cu?.dateRegistered && inRange(cu.dateRegistered)); })();
      if (isNew) a.ordersFromNew += 1;
    }
    return agg;
  }, [callsInRange, ordersInRangeForTable, displayNameById, customers, customerById]);
  
  const pageAgg: Record<string, Agg> = useMemo(() => {
    const agg: Record<string, Agg> = {};
    const add = (k: string) => (agg[k] = agg[k] || { newInteract: 0, oldInteract: 0, totalInteract: 0, talked: 0, totalOrders: 0, ordersFromNew: 0 });
    // No call -> page linkage in current schema; keep 0 for interactions
    for (const o of ordersInRange) {
      const name = (o.salesChannelPageId && allPages.find(p => (p.page_id || p.id) === o.salesChannelPageId)?.name) || o.salesChannel || 'ไม่ระบุ';
      const a = add(name);
      a.totalOrders += 1;
      const isNew = (() => { const cu = customers.find(c => c.id === o.customerId); return !!(cu?.dateRegistered && inRange(cu.dateRegistered)); })();
      if (isNew) a.ordersFromNew += 1;
    }
    return agg;
  }, [ordersInRange, allPages, customers]);

  // Fetch engagement data from Pages.fm API
  const fetchEngagementData = async () => {
    if (!selectedPageId || selectedPageId === 'all' || !currentUser) {
      alert('กรุณาเลือกเพจ');
      return;
    }

    setIsSearching(true);
    try {
      // First, get the access token from env variables
      const envResponse = await fetch('api/Page_DB/env_manager.php');
      if (!envResponse.ok) {
        throw new Error('ไม่สามารถดึงข้อมูล env ได้');
      }
      const envData = await envResponse.json();
      const accessTokenKey = `ACCESS_TOKEN_PANCAKE_${currentUser.company_id}`;
      const accessToken = envData.find((env: any) => env.key === accessTokenKey)?.value;

      if (!accessToken) {
        alert(`ไม่พบ ACCESS_TOKEN สำหรับ ${accessTokenKey}`);
        return;
      }

      // Generate page access token
      const tokenResponse = await fetch(`https://pages.fm/api/v1/pages/${selectedPageId}/generate_page_access_token?access_token=${encodeURIComponent(accessToken)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!tokenResponse.ok) {
        throw new Error('ไม่สามารถสร้าง page access token ได้');
      }
      const tokenData = await tokenResponse.json();
      
      if (!tokenData.success || !tokenData.page_access_token) {
        throw new Error('ไม่สามารถสร้าง page access token ได้: ' + (tokenData.message || 'Unknown error'));
      }

      // Format date range for API (DD/MM/YYYY HH:mm:ss - DD/MM/YYYY HH:mm:ss)
      const formatDateForAPI = (date: Date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
      };

      const formattedStartDate = formatDateForAPI(startDate);
      const formattedEndDate = formatDateForAPI(endDate);
      const dateRange = `${formattedStartDate} - ${formattedEndDate}`;

      // Fetch engagement statistics
      const engagementResponse = await fetch(
        `https://pages.fm/api/public_api/v1/pages/${selectedPageId}/statistics/customer_engagements?page_access_token=${tokenData.page_access_token}&page_id=${selectedPageId}&date_range=${encodeURIComponent(dateRange)}`
      );

      if (!engagementResponse.ok) {
        throw new Error('ไม่สามารถดึงข้อมูล engagement ได้');
      }
      const engagementResult = await engagementResponse.json();
      
      if (engagementResult.success && engagementResult.data) {
        setEngagementData(engagementResult);
        setUseEngagementData(true);
      } else {
        throw new Error('ไม่สามารถดึงข้อมูล engagement ได้: ' + (engagementResult.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error fetching engagement data:', error);
      alert('เกิดข้อผิดพลาด: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-800">สถิติการมีส่วนร่วม</h2>
        <DateRangePicker value={range} onApply={setRange} />
        {/* Page Selection */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">เลือกเพจ:</span>
          <div className="relative">
            <input
              type="text"
              placeholder="เลือกหรือค้นหาเพจ..."
              value={pageSearchTerm}
              onChange={(e) => setPageSearchTerm(e.target.value)}
              onFocus={() => setIsSelectOpen(true)}
              onBlur={() => setTimeout(() => setIsSelectOpen(false), 200)}
              className="border rounded-md px-3 py-1.5 pr-8 text-sm w-64"
            />
            <button
              onClick={() => setIsSelectOpen(!isSelectOpen)}
              className="absolute right-2 top-1.5 text-gray-500 hover:text-gray-700"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${isSelectOpen ? 'rotate-180' : ''}`} />
            </button>
            {pageSearchTerm && (
              <button
                onClick={() => {
                  setPageSearchTerm('');
                  setSelectedPageId('all');
                }}
                className="absolute right-8 top-1.5 text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {isSelectOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {pageSearchTerm === '' && (
                  <div
                    onMouseDown={() => {
                      setSelectedPageId('all');
                      setPageSearchTerm('ทุกเพจ');
                      setIsSelectOpen(false);
                    }}
                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                  >
                    ทุกเพจ
                  </div>
                )}
                {allPages
                  .filter(page => pageSearchTerm === '' || page.name.toLowerCase().includes(pageSearchTerm.toLowerCase()))
                  .map((page) => (
                    <div
                      key={page.page_id || page.id}
                      onMouseDown={() => {
                        setSelectedPageId(page.page_id || page.id);
                        setPageSearchTerm(page.name);
                        setIsSelectOpen(false);
                        // Clear any error when a page is selected
                        if (pageSelectError) {
                          setPageSelectError('');
                        }
                      }}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                    >
                      {page.name}
                    </div>
                  ))
                }
                {allPages.filter(page => pageSearchTerm === '' || page.name.toLowerCase().includes(pageSearchTerm.toLowerCase())).length === 0 && (
                  <div className="px-3 py-2 text-gray-500 text-sm">
                    ไม่พบเพจที่ตรงกัน
                  </div>
                )}
              </div>
            )}
            {pageSelectError && (
              <div className="text-red-500 text-xs mt-1">
                กรุณาเลือกเพจ
              </div>
            )}
          </div>
        </div>
        <button
          onClick={fetchEngagementData}
          className="border rounded-md px-3 py-1.5 text-sm flex items-center gap-1 bg-blue-600 text-white hover:bg-blue-700"
          disabled={isSearching || selectedPageId === 'all'}
        >
          <Search className="w-4 h-4"/> {isSearching ? 'กำลังค้นหา...' : 'ค้นหา'}
        </button>
      </div>

      {/* Top gauges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-5 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-700">ปฏิสัมพันธ์กับลูกค้า</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            {useEngagementData && engagementData && engagementData.data ? (
              (() => {
                const series = engagementData.data.series || [];
                const totalSeries = series.find((s: any) => s.name === 'total') || { data: [] };
                const newCustomerRepliedSeries = series.find((s: any) => s.name === 'new_customer_replied') || { data: [] };
                
                const totalEngagement = totalSeries.data.reduce((sum: number, val: number) => sum + val, 0);
                const totalNewCustomerReplied = newCustomerRepliedSeries.data.reduce((sum: number, val: number) => sum + val, 0);
                const totalOldCustomerReplied = totalEngagement - totalNewCustomerReplied;
                
                // Create new gauge options for engagement data
                const engagementGauge = makeSemiGauge(
                  totalEngagement > 0 ? (totalNewCustomerReplied / totalEngagement) * 100 : 0,
                  '#34D399'
                );
                
                return (
                  <>
                    <ReactApexChart options={engagementGauge.options} series={engagementGauge.series} type="radialBar" height={220} />
                    <div className="grid grid-cols-2 gap-3">
                      <StatCard title="การติดต่อทั้งหมด" value={String(totalEngagement)} subtext="รวมทุกช่องทาง" icon={Activity} />
                      <StatCard title="การติดต่อใหม่" value={String(totalNewCustomerReplied)} subtext="ลูกค้าใหม่" icon={UsersIcon} />
                      <StatCard title="การติดต่อเดิม" value={String(totalOldCustomerReplied)} subtext="ลูกค้าเก่า" icon={UsersIcon} />
                      <StatCard title="% ติดต่อใหม่" value={`${totalEngagement > 0 ? ((totalNewCustomerReplied / totalEngagement) * 100).toFixed(1) : 0}%`} subtext="ของทั้งหมด" icon={UsersIcon} />
                    </div>
                  </>
                );
              })()
            ) : (
              <>
                <ReactApexChart options={talkGauge.options} series={talkGauge.series} type="radialBar" height={220} />
                <div className="grid grid-cols-2 gap-3">
                  <StatCard title="ข้อมูลเข้าทั้งหมด" value={String(totalCalls)} subtext="รวมทุกช่องทาง" icon={Activity} />
                  <StatCard title="การติดต่อใหม่" value={String(sum.newInteract)} subtext="ลูกค้าใหม่" icon={UsersIcon} />
                  <StatCard title="การติดต่อเดิม" value={String(sum.oldInteract)} subtext="ลูกค้าเก่า" icon={UsersIcon} />
                  <StatCard title="ได้คุย (>=40s)" value={String(talkedCalls)} subtext={`${talkRate.toFixed(1)}% ของทั้งหมด`} icon={Phone} />
                </div>
              </>
            )}
          </div>
        </div>
        <div className="bg-white p-5 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-700">สั่งซื้อ</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            {useEngagementData && engagementData && engagementData.data ? (
              (() => {
                const series = engagementData.data.series || [];
                const totalSeries = series.find((s: any) => s.name === 'total') || { data: [] };
                const orderCountSeries = series.find((s: any) => s.name === 'order_count') || { data: [] };
                const oldOrderCountSeries = series.find((s: any) => s.name === 'old_order_count') || { data: [] };
                const newCustomerRepliedSeries = series.find((s: any) => s.name === 'new_customer_replied') || { data: [] };
                
                const totalEngagement = totalSeries.data.reduce((sum: number, val: number) => sum + val, 0);
                const totalOrders = orderCountSeries.data.reduce((sum: number, val: number) => sum + val, 0);
                const totalOldOrders = oldOrderCountSeries.data.reduce((sum: number, val: number) => sum + val, 0);
                const totalNewOrders = totalOrders - totalOldOrders;
                const totalNewCustomerReplied = newCustomerRepliedSeries.data.reduce((sum: number, val: number) => sum + val, 0);
                
                // Create new gauge options for order data
                const orderGauge = makeSemiGauge(
                  totalEngagement > 0 ? (totalOrders / totalEngagement) * 100 : 0,
                  '#3B82F6'
                );
                
                return (
                  <>
                    <ReactApexChart options={orderGauge.options} series={orderGauge.series} type="radialBar" height={220} />
                    <div className="grid grid-cols-2 gap-3">
                      <StatCard title="ยอดออเดอร์" value={String(totalOrders)} subtext="ทั้งหมด" icon={ShoppingCart} />
                      <StatCard title="ออเดอร์ลูกค้าใหม่" value={String(totalNewOrders)} subtext="ในช่วงเวลา" icon={ShoppingCart} />
                      <StatCard title="อัตราการสั่งซื้อ" value={`${totalEngagement > 0 ? ((totalOrders / totalEngagement) * 100).toFixed(2) : 0}%`} subtext="ต่อการติดต่อทั้งหมด" icon={ShoppingCart} />
                      <StatCard title="% ซื้อต่อลูกค้าใหม่" value={`${totalNewCustomerReplied > 0 ? ((totalNewOrders / totalNewCustomerReplied) * 100).toFixed(2) : 0}%`} subtext="ต่อลูกค้าใหม่" icon={ShoppingCart} />
                    </div>
                  </>
                );
              })()
            ) : (
              <>
                <ReactApexChart options={orderRate.options} series={orderRate.series} type="radialBar" height={220} />
                <div className="grid grid-cols-2 gap-3">
                  <StatCard title="ยอดออเดอร์" value={String(totalOrders)} subtext="ทั้งหมด" icon={ShoppingCart} />
                  <StatCard title="ออเดอร์ลูกค้าใหม่" value={String(ordersFromNewCustomers)} subtext="ในช่วงเวลา" icon={ShoppingCart} />
                  <StatCard title="อัตราการสั่งซื้อ" value={`${(totalCalls>0?(totalOrders/totalCalls)*100:0).toFixed(2)}%`} subtext="ต่อการติดต่อทั้งหมด" icon={ShoppingCart} />
                  <StatCard title="% ซื้อต่อลูกค้าใหม่" value={`${(sum.newInteract>0?(ordersFromNewCustomers/sum.newInteract)*100:0).toFixed(2)}%`} subtext="ต่อลูกค้าใหม่" icon={ShoppingCart} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white p-5 rounded-lg border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm">
            <button onClick={() => setActiveTab('time')} className={`px-3 py-1.5 rounded-md ${activeTab==='time'?'bg-green-600 text-white':'bg-gray-100 text-gray-600'}`}>ตามเวลา</button>
            <button onClick={() => setActiveTab('user')} className={`px-3 py-1.5 rounded-md ${activeTab==='user'?'bg-green-600 text-white':'bg-gray-100 text-gray-600'}`}>ตามพนักงาน</button>
            <button onClick={() => setActiveTab('page')} className={`px-3 py-1.5 rounded-md ${activeTab==='page'?'bg-green-600 text-white':'bg-gray-100 text-gray-600'}`}>ตามเพจ</button>
            <div className="text-sm text-gray-500">
              กำลังแสดงข้อมูล: {selectedPageId === 'all' ? 'ทุกเพจ' : pageSearchTerm || 'ทุกเพจ'}
            </div>
            {useEngagementData && (
              <div className="text-sm text-blue-600">
                ข้อมูลจาก Pages.fm API
              </div>
            )}
          </div>
        </div>
        {activeTab === 'time' && (
        <div className="overflow-auto">
          <table className="min-w-[1200px] w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th className="px-3 py-2 text-left">เวลา</th>
                <th className="px-3 py-2 text-center" colSpan={4}>ปฏิสัมพันธ์กับลูกค้า</th>
                <th className="px-3 py-2 text-center" colSpan={4}>สร้างคำสั่งซื้อ</th>
              </tr>
              <tr className="bg-gray-50 text-gray-600">
                <th className="px-3 py-2 text-left"> </th>
                <th className="px-3 py-2 text-right">ลูกค้าใหม่</th>
                <th className="px-3 py-2 text-right">ลูกค้าเก่า</th>
                <th className="px-3 py-2 text-right">รวม</th>
                <th className="px-3 py-2 text-right">ได้คุย</th>
                <th className="px-3 py-2 text-right">ยอดออเดอร์</th>
                <th className="px-3 py-2 text-right">ออเดอร์ลูกค้าใหม่</th>
                <th className="px-3 py-2 text-right">% สั่งซื้อ/ติดต่อ</th>
                <th className="px-3 py-2 text-right">% สั่งซื้อ/ลูกค้าใหม่</th>
              </tr>
            </thead>
            <tbody>
              {useEngagementData && engagementData && engagementData.data ? (
                (() => {
                  const categories = engagementData.data.categories || [];
                  const series = engagementData.data.series || [];
                  
                  // Find the series we need
                  const inboxSeries = series.find((s: any) => s.name === 'inbox') || { data: [] };
                  const commentSeries = series.find((s: any) => s.name === 'comment') || { data: [] };
                  const totalSeries = series.find((s: any) => s.name === 'total') || { data: [] };
                  const newCustomerRepliedSeries = series.find((s: any) => s.name === 'new_customer_replied') || { data: [] };
                  const orderCountSeries = series.find((s: any) => s.name === 'order_count') || { data: [] };
                  const oldOrderCountSeries = series.find((s: any) => s.name === 'old_order_count') || { data: [] };
                  
                  return categories.map((date: string, index: number) => {
                    const inbox = inboxSeries.data[index] || 0;
                    const comment = commentSeries.data[index] || 0;
                    const total = totalSeries.data[index] || 0;
                    const newCustomerReplied = newCustomerRepliedSeries.data[index] || 0;
                    const orderCount = orderCountSeries.data[index] || 0;
                    const oldOrderCount = oldOrderCountSeries.data[index] || 0;
                    
                    const oldCustomerReplied = total - newCustomerReplied;
                    const newOrderCount = orderCount - oldOrderCount;
                    
                    return (
                      <tr key={date} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-gray-700">{date}</td>
                        <td className="px-3 py-2 text-right">{newCustomerReplied}</td>
                        <td className="px-3 py-2 text-right">{oldCustomerReplied}</td>
                        <td className="px-3 py-2 text-right">{total}</td>
                        <td className="px-3 py-2 text-right">{total}</td>
                        <td className="px-3 py-2 text-right">{orderCount}</td>
                        <td className="px-3 py-2 text-right">{newOrderCount}</td>
                        <td className="px-3 py-2 text-right">{total > 0 ? ((orderCount / total) * 100).toFixed(2) : 0}%</td>
                        <td className="px-3 py-2 text-right">{newCustomerReplied > 0 ? ((newOrderCount / newCustomerReplied) * 100).toFixed(2) : 0}%</td>
                      </tr>
                    );
                  });
                })()
              ) : (
                rows.map(r => (
                  <tr key={r.date} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-700">{r.date}</td>
                    <td className="px-3 py-2 text-right">{r.newInteract}</td>
                    <td className="px-3 py-2 text-right">{r.oldInteract}</td>
                    <td className="px-3 py-2 text-right">{r.totalInteract}</td>
                    <td className="px-3 py-2 text-right">{r.talked}</td>
                    <td className="px-3 py-2 text-right">{r.totalOrders}</td>
                    <td className="px-3 py-2 text-right">{r.ordersFromNew}</td>
                    <td className="px-3 py-2 text-right">{r.pctOrderPerInteract.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right">{r.pctOrderPerNew.toFixed(2)}%</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 font-semibold bg-gray-50">
                <td className="px-3 py-2">รวม</td>
                {useEngagementData && engagementData && engagementData.data ? (
                  (() => {
                    const series = engagementData.data.series || [];
                    const totalSeries = series.find((s: any) => s.name === 'total') || { data: [] };
                    const newCustomerRepliedSeries = series.find((s: any) => s.name === 'new_customer_replied') || { data: [] };
                    const orderCountSeries = series.find((s: any) => s.name === 'order_count') || { data: [] };
                    const oldOrderCountSeries = series.find((s: any) => s.name === 'old_order_count') || { data: [] };
                    
                    const totalEngagement = totalSeries.data.reduce((sum: number, val: number) => sum + val, 0);
                    const totalNewCustomerReplied = newCustomerRepliedSeries.data.reduce((sum: number, val: number) => sum + val, 0);
                    const totalOrders = orderCountSeries.data.reduce((sum: number, val: number) => sum + val, 0);
                    const totalOldOrders = oldOrderCountSeries.data.reduce((sum: number, val: number) => sum + val, 0);
                    const totalNewOrders = totalOrders - totalOldOrders;
                    const totalOldCustomerReplied = totalEngagement - totalNewCustomerReplied;
                    
                    return (
                      <>
                        <td className="px-3 py-2 text-right">{totalNewCustomerReplied}</td>
                        <td className="px-3 py-2 text-right">{totalOldCustomerReplied}</td>
                        <td className="px-3 py-2 text-right">{totalEngagement}</td>
                        <td className="px-3 py-2 text-right">{totalEngagement}</td>
                        <td className="px-3 py-2 text-right">{totalOrders}</td>
                        <td className="px-3 py-2 text-right">{totalNewOrders}</td>
                        <td className="px-3 py-2 text-right">{totalEngagement > 0 ? ((totalOrders / totalEngagement) * 100).toFixed(2) : 0}%</td>
                        <td className="px-3 py-2 text-right">{totalNewCustomerReplied > 0 ? ((totalNewOrders / totalNewCustomerReplied) * 100).toFixed(2) : 0}%</td>
                      </>
                    );
                  })()
                ) : (
                  <>
                    <td className="px-3 py-2 text-right">{sum.newInteract}</td>
                    <td className="px-3 py-2 text-right">{sum.oldInteract}</td>
                    <td className="px-3 py-2 text-right">{sum.totalInteract}</td>
                    <td className="px-3 py-2 text-right">{sum.talked}</td>
                    <td className="px-3 py-2 text-right">{sum.totalOrders}</td>
                    <td className="px-3 py-2 text-right">{sum.ordersFromNew}</td>
                    <td className="px-3 py-2 text-right">{(sum.totalInteract>0?(sum.totalOrders/sum.totalInteract)*100:0).toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right">{(sum.newInteract>0?(sum.ordersFromNew/sum.newInteract)*100:0).toFixed(2)}%</td>
                  </>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
        )}

        {activeTab === 'user' && (
          <div className="overflow-auto">
            <table className="min-w-[1200px] w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="px-3 py-2 text-left">ผู้ใช้</th>
                  <th className="px-3 py-2 text-center" colSpan={4}>ปฏิสัมพันธ์กับลูกค้า</th>
                  <th className="px-3 py-2 text-center" colSpan={4}>สร้างคำสั่งซื้อ</th>
                </tr>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="px-3 py-2 text-left"></th>
                  <th className="px-3 py-2 text-right">ลูกค้าใหม่</th>
                  <th className="px-3 py-2 text-right">ลูกค้าเก่า</th>
                  <th className="px-3 py-2 text-right">รวม</th>
                  <th className="px-3 py-2 text-right">ได้คุย</th>
                  <th className="px-3 py-2 text-right">ยอดออเดอร์</th>
                  <th className="px-3 py-2 text-right">ออเดอร์ลูกค้าใหม่</th>
                  <th className="px-3 py-2 text-right">% สั่งซื้อ/ติดต่อ</th>
                  <th className="px-3 py-2 text-right">% สั่งซื้อ/ลูกค้าใหม่</th>
                </tr>
              </thead>
              <tbody>
                {useEngagementData && engagementData && engagementData.users_engagements ? (
                  engagementData.users_engagements.map((user: any) => {
                    const totalEngagement = user.total_engagement || 0;
                    const newCustomerReplied = user.new_customer_replied_count || 0;
                    const oldCustomerReplied = totalEngagement - newCustomerReplied;
                    const totalOrders = user.order_count || 0;
                    const oldOrders = user.old_order_count || 0;
                    const newOrders = totalOrders - oldOrders;
                    
                    return (
                      <tr key={user.user_id} className="border-t border-gray-100">
                        <td className="px-3 py-2">{user.name}</td>
                        <td className="px-3 py-2 text-right">{newCustomerReplied}</td>
                        <td className="px-3 py-2 text-right">{oldCustomerReplied}</td>
                        <td className="px-3 py-2 text-right">{totalEngagement}</td>
                        <td className="px-3 py-2 text-right">{totalEngagement}</td>
                        <td className="px-3 py-2 text-right">{totalOrders}</td>
                        <td className="px-3 py-2 text-right">{newOrders}</td>
                        <td className="px-3 py-2 text-right">{totalEngagement > 0 ? ((totalOrders / totalEngagement) * 100).toFixed(2) : 0}%</td>
                        <td className="px-3 py-2 text-right">{newCustomerReplied > 0 ? ((newOrders / newCustomerReplied) * 100).toFixed(2) : 0}%</td>
                      </tr>
                    );
                  })
                ) : (
                  activeAdminUsers.map(u => {
                    const name = `${u.firstName} ${u.lastName}`.trim();
                    const v = (userAgg as any)[name] || { newInteract: 0, oldInteract: 0, totalInteract: 0, talked: 0, totalOrders: 0, ordersFromNew: 0 };
                    return (
                      <tr key={name} className="border-t border-gray-100">
                        <td className="px-3 py-2">{name}</td>
                        <td className="px-3 py-2 text-right">{v.newInteract}</td>
                        <td className="px-3 py-2 text-right">{v.oldInteract}</td>
                        <td className="px-3 py-2 text-right">{v.totalInteract}</td>
                        <td className="px-3 py-2 text-right">{v.talked}</td>
                        <td className="px-3 py-2 text-right">{v.totalOrders}</td>
                        <td className="px-3 py-2 text-right">{v.ordersFromNew}</td>
                        <td className="px-3 py-2 text-right">{(v.totalInteract>0?(v.totalOrders/v.totalInteract)*100:0).toFixed(2)}%</td>
                        <td className="px-3 py-2 text-right">{(v.newInteract>0?(v.ordersFromNew/v.newInteract)*100:0).toFixed(2)}%</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'page' && (
          <div className="overflow-auto">
            <table className="min-w-[1200px] w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="px-3 py-2 text-left">เพจ/ช่องทาง</th>
                  <th className="px-3 py-2 text-center" colSpan={4}>ปฏิสัมพันธ์กับลูกค้า</th>
                  <th className="px-3 py-2 text-center" colSpan={4}>สร้างคำสั่งซื้อ</th>
                </tr>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="px-3 py-2 text-left"></th>
                  <th className="px-3 py-2 text-right">ลูกค้าใหม่</th>
                  <th className="px-3 py-2 text-right">ลูกค้าเก่า</th>
                  <th className="px-3 py-2 text-right">รวม</th>
                  <th className="px-3 py-2 text-right">ได้คุย</th>
                  <th className="px-3 py-2 text-right">ยอดออเดอร์</th>
                  <th className="px-3 py-2 text-right">ออเดอร์ลูกค้าใหม่</th>
                  <th className="px-3 py-2 text-right">% สั่งซื้อ/ติดต่อ</th>
                  <th className="px-3 py-2 text-right">% สั่งซื้อ/ลูกค้าใหม่</th>
                </tr>
              </thead>
              <tbody>
                {allPages.filter(p => pages.some(p2 => p2.id === p.id && p2.active)).map(p => {
                  const name = p.name;
                  const v = (pageAgg as any)[name] || { newInteract: 0, oldInteract: 0, totalInteract: 0, talked: 0, totalOrders: 0, ordersFromNew: 0 };
                  return (
                    <tr key={p.page_id || p.id} className="border-t border-gray-100">
                      <td className="px-3 py-2">{name}</td>
                      <td className="px-3 py-2 text-right">{v.newInteract}</td>
                      <td className="px-3 py-2 text-right">{v.oldInteract}</td>
                      <td className="px-3 py-2 text-right">{v.totalInteract}</td>
                      <td className="px-3 py-2 text-right">{v.talked}</td>
                      <td className="px-3 py-2 text-right">{v.totalOrders}</td>
                      <td className="px-3 py-2 text-right">{v.ordersFromNew}</td>
                      <td className="px-3 py-2 text-right">{(v.totalInteract>0?(v.totalOrders/v.totalInteract)*100:0).toFixed(2)}%</td>
                      <td className="px-3 py-2 text-right">{(v.newInteract>0?(v.ordersFromNew/v.newInteract)*100:0).toFixed(2)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating button for env management - Only for Super Admin and Admin Control */}
      {currentUser && (currentUser.role === UserRole.SuperAdmin || currentUser.role === UserRole.AdminControl) && (
        <button
          onClick={() => setIsEnvSidebarOpen(true)}
          className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg z-40 flex items-center justify-center transition-all duration-200 hover:scale-110"
          title="จัดการตัวแปรสภาพแวดล้อม"
        >
          <Settings className="w-6 h-6" />
        </button>
      )}

      {/* Off-canvas sidebar for env management - Only for Super Admin and Admin Control */}
      {currentUser && (currentUser.role === UserRole.SuperAdmin || currentUser.role === UserRole.AdminControl) && (
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
      )}

      {/* Overlay for sidebar - Only for Super Admin and Admin Control */}
      {currentUser && (currentUser.role === UserRole.SuperAdmin || currentUser.role === UserRole.AdminControl) && isEnvSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsEnvSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default EngagementStatsPage;
