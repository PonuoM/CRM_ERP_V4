import React, { useMemo, useState, useEffect } from 'react';
import { Order, Customer, CallHistory, User, UserRole } from '@/types';
import { Calendar, Download, RefreshCcw, MessageSquare, MessageCircle, Phone, UserPlus, ShoppingCart, Settings, X, Save, Plus, Search, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import StatCard from '@/components/StatCard_EngagementPage';
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
  const [rangeDays, setRangeDays] = useState<number | string>(7);
  const [isEnvSidebarOpen, setIsEnvSidebarOpen] = useState<boolean>(false);
  const [envVariables, setEnvVariables] = useState<EnvVariable[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [newEnvVar, setNewEnvVar] = useState<EnvVariable>({
    key: 'ACCESS_TOKEN_PANCAKE_',
    value: ''
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [pages, setPages] = useState<Array<{id: number, name: string, page_id: string}>>([]);
  const [selectedPage, setSelectedPage] = useState<string>('');
  const [pageStatsData, setPageStatsData] = useState<any[]>([]);
  const [prevPageStatsData, setPrevPageStatsData] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [usePageStats, setUsePageStats] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'hourly' | 'daily'>('daily');
  const [pageSearchTerm, setPageSearchTerm] = useState<string>('');
  const [isSelectOpen, setIsSelectOpen] = useState<boolean>(false);
  const [useCustomDateRange, setUseCustomDateRange] = useState<boolean>(false);
  const [customDateRange, setCustomDateRange] = useState<string>('');
  const [isRangePopoverOpen, setIsRangePopoverOpen] = useState<boolean>(false);
  const [rangeTempStart, setRangeTempStart] = useState<Date | null>(null);
  const [rangeTempEnd, setRangeTempEnd] = useState<Date | null>(null);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

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
          setPages(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Error fetching pages:', error);
      }
    };

    fetchPages();
  }, []);

  const customersById = useMemo(() => {
    const map: Record<string, Customer> = {};
    customers.forEach(c => { map[c.id] = c; });
    return map;
  }, [customers]);

  const startDate = useMemo(() => {
    if (useCustomDateRange && customDateRange) {
      // Parse the date range string "YYYY-MM-DDTHH:mm - YYYY-MM-DDTHH:mm"
      const [startPart] = customDateRange.split(' - ');
      if (startPart) {
        const d = new Date(startPart);
        d.setHours(0,0,0,0);
        return d;
      }
    }
    
    const d = new Date();
    d.setHours(0,0,0,0);
    
    if (typeof rangeDays === 'number') {
      d.setDate(d.getDate() - (rangeDays - 1));
    } else {
      switch (rangeDays) {
        case 'thisWeek':
          // Start of current week (Sunday)
          const dayOfWeek = d.getDay();
          d.setDate(d.getDate() - dayOfWeek);
          break;
        case 'lastWeek':
          // Start of last week (Sunday) - exactly 7 days of last week only
          const currentDayOfWeek = d.getDay();
          const daysBackToLastWeekStart = currentDayOfWeek + 7;
          d.setDate(d.getDate() - daysBackToLastWeekStart);
          break;
        case 'thisMonth':
          // Start of current month
          d.setDate(1);
          break;
        case 'lastMonth':
          // Start of last month - only days from last month
          d.setMonth(d.getMonth() - 1, 1);
          break;
      }
    }
    
    return d;
  }, [rangeDays, useCustomDateRange, customDateRange]);

  const endDate = useMemo(() => {
    if (useCustomDateRange && customDateRange) {
      // Parse the date range string "YYYY-MM-DDTHH:mm - YYYY-MM-DDTHH:mm"
      const [, endPart] = customDateRange.split(' - ');
      if (endPart) {
        const d = new Date(endPart);
        d.setHours(23,59,59,999);
        return d;
      }
    }
    
    return new Date();
  }, [useCustomDateRange, customDateRange]);

  const days: string[] = useMemo(() => {
    const res: string[] = [];
    const d = new Date(startDate);
    const end = new Date(endDate);
    
    // Calculate days from start to end date
    while (d <= end) {
      res.push(fmtDate(d));
      d.setDate(d.getDate() + 1);
    }
    
    return res;
  }, [startDate, endDate]);

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
    // If we have page stats data from API, use those totals instead
    if (usePageStats && pageStatsData.length > 0) {
      const totalsData = {
        newCustomers: pageStatsData.reduce((sum, item) => sum + item.new_customer_count, 0),
        totalPhones: pageStatsData.reduce((sum, item) => sum + item.uniq_phone_number_count, 0),
        newPhones: pageStatsData.reduce((sum, item) => sum + item.phone_number_count, 0),
        totalComments: pageStatsData.reduce((sum, item) => sum + item.customer_comment_count, 0),
        totalChats: pageStatsData.reduce((sum, item) => sum + item.customer_inbox_count, 0),
        totalPageComments: pageStatsData.reduce((sum, item) => sum + item.page_comment_count, 0),
        totalPageChats: pageStatsData.reduce((sum, item) => sum + item.page_inbox_count, 0),
        newChats: pageStatsData.reduce((sum, item) => sum + item.new_inbox_count, 0),
        chatsFromOldCustomers: pageStatsData.reduce((sum, item) => sum + item.inbox_interactive_count, 0),
        webLoggedIn: pageStatsData.reduce((sum, item) => sum + item.today_uniq_website_referral, 0),
        webGuest: pageStatsData.reduce((sum, item) => sum + item.today_website_guest_referral, 0),
        ordersCount: pageStatsData.reduce((sum, item) => sum + (item.order_count || 0), 0)
      };
      return totalsData;
    }
    
    // Otherwise use the mock data totals
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
  }, [daily, usePageStats, pageStatsData]);

  const prevPeriodTotals = useMemo(() => {
    // If we have page stats data from API, use those totals instead
    if (usePageStats && prevPageStatsData.length > 0) {
      const prevTotalsData = {
        newCustomersPrev: prevPageStatsData.reduce((sum, item) => sum + item.new_customer_count, 0),
        totalPhonesPrev: prevPageStatsData.reduce((sum, item) => sum + item.uniq_phone_number_count, 0),
        newPhonesPrev: prevPageStatsData.reduce((sum, item) => sum + item.phone_number_count, 0),
        totalCommentsPrev: prevPageStatsData.reduce((sum, item) => sum + item.customer_comment_count, 0),
        totalChatsPrev: prevPageStatsData.reduce((sum, item) => sum + item.customer_inbox_count, 0),
        totalPageCommentsPrev: prevPageStatsData.reduce((sum, item) => sum + item.page_comment_count, 0),
        totalPageChatsPrev: prevPageStatsData.reduce((sum, item) => sum + item.page_inbox_count, 0),
        newChatsPrev: prevPageStatsData.reduce((sum, item) => sum + item.new_inbox_count, 0),
        chatsFromOldCustomersPrev: prevPageStatsData.reduce((sum, item) => sum + item.inbox_interactive_count, 0),
        webLoggedInPrev: prevPageStatsData.reduce((sum, item) => sum + item.today_uniq_website_referral, 0),
        webGuestPrev: prevPageStatsData.reduce((sum, item) => sum + item.today_website_guest_referral, 0),
        ordersPrev: prevPageStatsData.reduce((sum, item) => sum + (item.order_count || 0), 0)
      };
      return prevTotalsData;
    }
    
    // Previous N days period for trend
    const endPrev = new Date(startDate);
    endPrev.setDate(endPrev.getDate() - 1);
    const startPrev = new Date(endPrev);
    
    let daysToSubtract: number;
    if (typeof rangeDays === 'number') {
      daysToSubtract = rangeDays - 1;
    } else {
      switch (rangeDays) {
        case 'thisWeek':
          daysToSubtract = 7; // Previous week
          break;
        case 'lastWeek':
          daysToSubtract = 7; // Week before last week
          break;
        case 'thisMonth':
          daysToSubtract = 30; // Approximate previous month
          break;
        case 'lastMonth':
          daysToSubtract = 30; // Month before last month
          break;
        default:
          daysToSubtract = 7;
      }
    }
    
    startPrev.setDate(startPrev.getDate() - daysToSubtract);
    const inPrevRange = (iso: string) => iso >= fmtDate(startPrev) && iso <= fmtDate(endPrev);
    const newCustomersPrev = customers.filter(c => c.dateRegistered && inPrevRange(c.dateRegistered.slice(0,10))).length;
    const ordersPrev = orders.filter(o => inPrevRange(o.orderDate.slice(0,10))).length;
    const callsPrev = calls.filter(cl => inPrevRange(cl.date.slice(0,10))).length;
    return { newCustomersPrev, ordersPrev, callsPrev };
  }, [customers, orders, calls, startDate, rangeDays, usePageStats, prevPageStatsData]);

  const pctChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };

  // Prepare chart data based on whether we're using page stats or mock data
  const chartData = useMemo(() => {
    if (usePageStats && pageStatsData.length > 0) {
      // Process data from API
      let processedData = [];
      
      if (viewMode === 'daily') {
        // Aggregate data by day
        const dailyMap = new Map();
        
        pageStatsData.forEach(item => {
          const date = new Date(item.hour);
          const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          
          if (!dailyMap.has(dateKey)) {
            dailyMap.set(dateKey, {
              date: dateKey,
              totalComments: 0,
              totalChats: 0
            });
          }
          
          const dayData = dailyMap.get(dateKey);
          dayData.totalComments += item.customer_comment_count;
          dayData.totalChats += item.customer_inbox_count;
        });
        
        processedData = Array.from(dailyMap.values()).sort((a, b) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
      } else {
        // Use hourly data
        processedData = pageStatsData.map(item => {
          const date = new Date(item.hour);
          return {
            date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`,
            totalComments: item.customer_comment_count,
            totalChats: item.customer_inbox_count
          };
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }
      
      return {
        labels: processedData.map(d => d.date.slice(5)),
        series: [
          { name: 'จำนวนคอมเม้น', color: '#3B82F6', data: processedData.map(d => ({ label: d.date.slice(5), value: d.totalComments })) },
          { name: 'จำนวนข้อความ', color: '#10B981', data: processedData.map(d => ({ label: d.date.slice(5), value: d.totalChats })) }
        ]
      };
    } else {
      // Use mock data
      return {
        labels: daily.map(d => d.date.slice(5)),
        series: [
          { name: 'จำนวนคอมเม้น', color: '#3B82F6', data: daily.map(d => ({ label: d.date.slice(5), value: d.totalComments })) },
          { name: 'จำนวนข้อความ', color: '#10B981', data: daily.map(d => ({ label: d.date.slice(5), value: d.totalChats })) }
        ]
      };
    }
  }, [daily, usePageStats, pageStatsData, viewMode]);

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

  // Helper function for retrying API requests
  const fetchWithRetry = async (url: string, options: RequestInit, maxRetries: number = 3, delay: number = 1000): Promise<Response> => {
    let lastError: Error | null = null;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, options);
        
        // Check for server internal error
        if (response.status === 500) {
          const errorText = await response.text();
          if (errorText.includes('Server internal error')) {
            throw new Error('Server internal error');
          }
        }
        
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // If it's not a server internal error or we've reached max retries, don't retry
        if (!lastError.message.includes('Server internal error') || i === maxRetries - 1) {
          throw lastError;
        }
        
        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
    
    throw lastError || new Error('Unknown error');
  };

  // Fetch page stats from Pages.fm API
  const fetchPageStats = async () => {
    if (!selectedPage || !currentUser) {
      alert('กรุณาเลือกเพจ');
      return;
    }

    setIsSearching(true);
    try {
      // First, get the access token from env variables
      const envResponse = await fetchWithRetry('api/Page_DB/env_manager.php', { method: 'GET' });
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
      const tokenResponse = await fetchWithRetry(
        `https://pages.fm/api/v1/pages/${selectedPage}/generate_page_access_token?access_token=${encodeURIComponent(accessToken)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      if (!tokenResponse.ok) {
        throw new Error('ไม่สามารถสร้าง page access token ได้');
      }
      const tokenData = await tokenResponse.json();
      
      if (!tokenData.success || !tokenData.page_access_token) {
        throw new Error('ไม่สามารถสร้าง page access token ได้: ' + (tokenData.message || 'Unknown error'));
      }

      // Calculate timestamps using local timezone
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to midnight today in local timezone
      
      let untilDate: Date;
      let sinceDate: Date;
      
      if (useCustomDateRange && customDateRange) {
        const [, endPart] = customDateRange.split(' - ');
        if (endPart) {
          untilDate = new Date(endPart);
          untilDate.setHours(23, 59, 59, 999);
        }
        const [startPart] = customDateRange.split(' - ');
        if (startPart) {
          sinceDate = new Date(startPart);
          sinceDate.setHours(0, 0, 0, 0);
        }
      } else if (typeof rangeDays === 'number' || rangeDays === 'thisWeek' || rangeDays === 'thisMonth') {
        // For numeric ranges, thisWeek, and thisMonth, use current time
        untilDate = now;
        sinceDate = new Date(today);
        if (typeof rangeDays === 'number') {
          sinceDate.setDate(sinceDate.getDate() - (rangeDays - 1));
        } else if (rangeDays === 'thisWeek') {
          sinceDate.setDate(sinceDate.getDate() - new Date().getDay()); // Days since Sunday
        } else if (rangeDays === 'thisMonth') {
          sinceDate = new Date(today.getFullYear(), today.getMonth(), 1); // First day of current month
        }
      } else {
        switch (rangeDays) {
          case 'lastWeek':
            // End of last week (Saturday)
            const lastWeekEnd = new Date(today);
            const currentDayOfWeek = new Date().getDay();
            lastWeekEnd.setDate(lastWeekEnd.getDate() - currentDayOfWeek - 1); // Go back to last week's Saturday
            lastWeekEnd.setHours(23, 59, 59, 999); // End of the day
            untilDate = lastWeekEnd;
            // Start of last week (Sunday)
            const lastWeekStart = new Date(today);
            lastWeekStart.setDate(lastWeekStart.getDate() - currentDayOfWeek - 7); // Go back to last week's Sunday
            sinceDate = lastWeekStart;
            break;
          case 'lastMonth':
            // Last day of last month
            const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0); // Last day of previous month
            lastMonthEnd.setHours(23, 59, 59, 999); // End of the day
            untilDate = lastMonthEnd;
            // First day of last month
            sinceDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            break;
          default:
            untilDate = now;
            sinceDate = new Date(today);
            sinceDate.setDate(sinceDate.getDate() - 7);
        }
      }
      
      const until = Math.floor(untilDate.getTime() / 1000); // Current timestamp in seconds
      const since = Math.floor(sinceDate.getTime() / 1000); // Convert to unix timestamp

      // Calculate previous period dates for comparison
      const prevPeriodDays = typeof rangeDays === 'number' ? rangeDays : 7;
      const prevEndDate = new Date(sinceDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);
      prevEndDate.setHours(23, 59, 59, 999);
      
      const prevStartDate = new Date(prevEndDate);
      prevStartDate.setDate(prevStartDate.getDate() - (prevPeriodDays - 1));
      prevStartDate.setHours(0, 0, 0, 0);
      
      const prevUntil = Math.floor(prevEndDate.getTime() / 1000);
      const prevSince = Math.floor(prevStartDate.getTime() / 1000);

      // Fetch page statistics with select_fields parameter
      const selectFields = ["new_customer_count","phone_number_count","uniq_phone_number_count","customer_comment_count","customer_inbox_count","page_comment_count","page_inbox_count","new_inbox_count","inbox_interactive_count","today_uniq_website_referral","today_website_guest_referral","order_count","order_count_per_new_cus","order_count_per_phone","new_phone_count_per_new_customer_count"];
      
      // Fetch current period data
      const statsResponse = await fetch(`https://pages.fm/api/public_api/v1/pages/${selectedPage}/statistics/pages?since=${since}&until=${until}&page_access_token=${tokenData.page_access_token}&page_id=${selectedPage}&select_fields=${encodeURIComponent(JSON.stringify(selectFields))}`);

      if (!statsResponse.ok) {
        throw new Error('ไม่สามารถดึงข้อมูลสถิติได้');
      }
      const statsData = await statsResponse.json();
      
      if (statsData.success && statsData.data) {
        // Sort data from newest to oldest
        const sortedData = [...statsData.data].sort((a, b) =>
          new Date(b.hour).getTime() - new Date(a.hour).getTime()
        );
        setPageStatsData(sortedData);
        setUsePageStats(true);
        
        // Fetch previous period data for comparison
        try {
          const prevStatsResponse = await fetch(`https://pages.fm/api/public_api/v1/pages/${selectedPage}/statistics/pages?since=${prevSince}&until=${prevUntil}&page_access_token=${tokenData.page_access_token}&page_id=${selectedPage}&select_fields=${encodeURIComponent(JSON.stringify(selectFields))}`);
          
          if (prevStatsResponse.ok) {
            const prevStatsData = await prevStatsResponse.json();
            if (prevStatsData.success && prevStatsData.data) {
              const prevSortedData = [...prevStatsData.data].sort((a, b) =>
                new Date(b.hour).getTime() - new Date(a.hour).getTime()
              );
              setPrevPageStatsData(prevSortedData);
            }
          }
        } catch (error) {
          console.error('Error fetching previous period stats:', error);
          // Don't throw an error here, we can continue without previous period data
        }
      } else {
        throw new Error('ไม่สามารถดึงข้อมูลสถิติได้: ' + (statsData.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error fetching page stats:', error);
      alert('เกิดข้อผิดพลาด: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="p-6">
      {/* Controls */}
      <div className="bg-white border rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <select
              value={useCustomDateRange ? 'custom' : rangeDays}
              onChange={e => {
                const value = e.target.value;
                if (value === 'custom') {
                  setUseCustomDateRange(true);
                  // Set default date range for custom selection
                  const today = new Date();
                  const lastWeek = new Date(today);
                  lastWeek.setDate(today.getDate() - 7);
                  
                  // Format as YYYY-MM-DDTHH:mm - YYYY-MM-DDTHH:mm
                  const formatDateTime = (date: Date) => {
                    const y = date.getFullYear();
                    const m = String(date.getMonth() + 1).padStart(2, '0');
                    const d = String(date.getDate()).padStart(2, '0');
                    const h = String(date.getHours()).padStart(2, '0');
                    const min = String(date.getMinutes()).padStart(2, '0');
                    return `${y}-${m}-${d}T${h}:${min}`;
                  };
                  
                  setCustomDateRange(`${formatDateTime(lastWeek)} - ${formatDateTime(today)}`);
                } else {
                  setUseCustomDateRange(false);
                  setRangeDays(value === 'thisWeek' || value === 'lastWeek' || value === 'thisMonth' || value === 'lastMonth' ? value : Number(value));
                }
              }}
              className="border rounded-md px-3 py-2 text-sm"
            >
              <option value={7}>7 วันย้อนหลัง</option>
              <option value={30}>30 วันย้อนหลัง</option>
              <option value={90}>90 วันย้อนหลัง</option>
              <option value="thisWeek">สัปดาห์นี้</option>
              <option value="lastWeek">สัปดาห์ที่แล้ว</option>
              <option value="thisMonth">เดือนนี้</option>
              <option value="lastMonth">เดือนที่แล้ว</option>
              <option value="custom">เลือกช่วงวันที่</option>
            </select>
            {useCustomDateRange && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    // Initialize temp dates from current range or defaults
                    const [sRaw, eRaw] = (customDateRange || '').split(' - ');
                    const s = sRaw ? new Date(sRaw) : new Date(startDate);
                    const e = eRaw ? new Date(eRaw) : new Date(endDate);
                    setRangeTempStart(new Date(s.getFullYear(), s.getMonth(), s.getDate()));
                    setRangeTempEnd(new Date(e.getFullYear(), e.getMonth(), e.getDate()));
                    setVisibleMonth(new Date(e.getFullYear(), e.getMonth(), 1));
                    setIsRangePopoverOpen(v => !v);
                  }}
                  className="border rounded-md px-3 py-2 text-sm flex items-center gap-2 bg-white"
                >
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700">
                    {(() => {
                      const [sRaw, eRaw] = (customDateRange || '').split(' - ');
                      const s = sRaw ? new Date(sRaw) : startDate;
                      const e = eRaw ? new Date(eRaw) : endDate;
                      return `${s.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} - ${e.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
                    })()}
                  </span>
                </button>

                {isRangePopoverOpen && (
                  <div className="absolute z-50 mt-2 bg-white rounded-lg shadow-lg border p-4 w-[700px]">
                    <div className="flex items-center justify-between mb-3">
                      <button className="p-1 rounded hover:bg-gray-100" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth()-1, 1))}><ChevronLeft className="w-4 h-4" /></button>
                      <div className="text-sm text-gray-600">Select date range</div>
                      <button className="p-1 rounded hover:bg-gray-100" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth()+1, 1))}><ChevronRight className="w-4 h-4" /></button>
                    </div>

                    <div className="flex gap-4">
                      {(() => {
                        const renderMonth = (monthStart: Date) => {
                          const firstDay = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
                          const startWeekDay = firstDay.getDay();
                          const gridStart = new Date(firstDay);
                          gridStart.setDate(firstDay.getDate() - startWeekDay);
                          const days: Date[] = [];
                          for (let i = 0; i < 42; i++) {
                            const d = new Date(gridStart);
                            d.setDate(gridStart.getDate() + i);
                            days.push(d);
                          }
                          const monthLabel = firstDay.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
                          const weekDays = ['Su','Mo','Tu','We','Th','Fr','Sa'];
                          const isSameDay = (a: Date, b: Date) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
                          const inBetween = (d: Date, s: Date|null, e: Date|null) => s && e ? d.getTime()>=s.getTime() && d.getTime()<=e.getTime() : false;
                          return (
                            <div className="w-[320px]">
                              <div className="text-sm font-medium text-gray-700 text-center mb-2">{monthLabel}</div>
                              <div className="grid grid-cols-7 gap-1 text-[12px] text-gray-500 mb-1">
                                {weekDays.map(d => <div key={d} className="text-center py-1">{d}</div>)}
                              </div>
                              <div className="grid grid-cols-7 gap-1">
                                {days.map((d, idx) => {
                                  const isCurrMonth = d.getMonth() === monthStart.getMonth();
                                  const selectedStart = rangeTempStart && isSameDay(d, rangeTempStart);
                                  const selectedEnd = rangeTempEnd && isSameDay(d, rangeTempEnd);
                                  const between = inBetween(d, rangeTempStart, rangeTempEnd) && !selectedStart && !selectedEnd;
                                  const base = `text-sm text-center py-1.5 rounded cursor-pointer select-none`;
                                  const tone = selectedStart || selectedEnd
                                    ? 'bg-blue-600 text-white'
                                    : between
                                      ? 'bg-blue-100 text-blue-700'
                                      : isCurrMonth
                                        ? 'text-gray-900 hover:bg-gray-100'
                                        : 'text-gray-400 hover:bg-gray-100';
                                  return (
                                    <div
                                      key={idx}
                                      className={`${base} ${tone}`}
                                      onClick={() => {
                                        const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                                        if (!rangeTempStart || (rangeTempStart && rangeTempEnd)) {
                                          setRangeTempStart(day);
                                          setRangeTempEnd(null);
                                          return;
                                        }
                                        if (day.getTime() < rangeTempStart.getTime()) {
                                          setRangeTempEnd(rangeTempStart);
                                          setRangeTempStart(day);
                                        } else {
                                          setRangeTempEnd(day);
                                        }
                                      }}
                                    >
                                      {d.getDate()}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        };
                        return (
                          <>
                            {renderMonth(new Date(visibleMonth))}
                            {renderMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth()+1, 1))}
                          </>
                        );
                      })()}
                    </div>

                    <div className="flex items-center justify-between mt-4 text-xs text-gray-600">
                      <div>
                        <span className="mr-2">Start: {rangeTempStart ? rangeTempStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}</span>
                        <span>End: {rangeTempEnd ? rangeTempEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="px-3 py-1.5 border rounded-md hover:bg-gray-50" onClick={() => { setRangeTempStart(null); setRangeTempEnd(null); }}>Clear</button>
                        <button
                          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                          disabled={!rangeTempStart && !rangeTempEnd}
                          onClick={() => {
                            const s = rangeTempStart ? new Date(rangeTempStart) : new Date(startDate);
                            const e = rangeTempEnd ? new Date(rangeTempEnd) : (rangeTempStart ? new Date(rangeTempStart) : new Date(endDate));
                            s.setHours(0,0,0,0);
                            e.setHours(23,59,59,999);
                            setCustomDateRange(`${s.toISOString()} - ${e.toISOString()}`);
                            setIsRangePopoverOpen(false);
                          }}
                        >Apply</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="relative">
              <input
                type="text"
                placeholder="เลือกหรือค้นหาเพจ..."
                value={pageSearchTerm}
                onChange={(e) => setPageSearchTerm(e.target.value)}
                onFocus={() => setIsSelectOpen(true)}
                onBlur={() => setTimeout(() => setIsSelectOpen(false), 200)}
                className="border rounded-md px-3 py-2 pr-8 text-sm w-96"
              />
              <button
                onClick={() => setIsSelectOpen(!isSelectOpen)}
                className="absolute right-2 top-2.5 text-gray-500 hover:text-gray-700"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${isSelectOpen ? 'rotate-180' : ''}`} />
              </button>
              {pageSearchTerm && (
                <button
                  onClick={() => setPageSearchTerm('')}
                  className="absolute right-8 top-2.5 text-gray-500 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {isSelectOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {pages
                    .filter(page => pageSearchTerm === '' || page.name.toLowerCase().includes(pageSearchTerm.toLowerCase()))
                    .map((page) => (
                      <div
                        key={page.id}
                        onMouseDown={() => {
                          setSelectedPage(page.page_id || page.id.toString());
                          setPageSearchTerm(page.name);
                          setNewEnvVar({
                            ...newEnvVar,
                            key: `ACCESS_TOKEN_PANCAKE_${page.page_id || page.id.toString()}`
                          });
                          setIsSelectOpen(false);
                        }}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                      >
                        {page.name}
                      </div>
                    ))
                  }
                  {pages.filter(page => pageSearchTerm === '' || page.name.toLowerCase().includes(pageSearchTerm.toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-gray-500 text-sm">
                      ไม่พบเพจที่ตรงกัน
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRangeDays(rangeDays)}
              className={`border rounded-md px-3 py-2 text-sm flex items-center gap-1 ${usePageStats ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={usePageStats}
            >
              <RefreshCcw className="w-4 h-4"/> รีเฟรช
            </button>
            <button
              onClick={exportCSV}
              className={`border rounded-md px-3 py-2 text-sm flex items-center gap-1 ${usePageStats ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={usePageStats}
            >
              <Download className="w-4 h-4"/> ดาวน์โหลด CSV
            </button>
            <button
              onClick={fetchPageStats}
              className="border rounded-md px-3 py-2 text-sm flex items-center gap-1 bg-blue-600 text-white hover:bg-blue-700"
              disabled={isSearching || !selectedPage}
            >
              <Search className="w-4 h-4"/> {isSearching ? 'กำลังค้นหา...' : 'ค้นหา'}
            </button>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="mb-6">
        <MultiLineChart title="ภาพรวมของหน้า" series={chartData.series} yLabel="จำนวน" xLabelEvery={(typeof rangeDays === 'number' && rangeDays >= 60) || rangeDays === 'thisMonth' || rangeDays === 'lastMonth' ? 4 : 1} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Create tooltip text for previous period date range */}
        {(() => {
          const prevPeriodStart = new Date(startDate);
          const prevPeriodEnd = new Date(startDate);
          let daysToSubtract: number;
          
          if (typeof rangeDays === 'number') {
            daysToSubtract = rangeDays;
          } else {
            switch (rangeDays) {
              case 'thisWeek':
                daysToSubtract = 7;
                break;
              case 'lastWeek':
                daysToSubtract = 7;
                break;
              case 'thisMonth':
                daysToSubtract = 30;
                break;
              case 'lastMonth':
                daysToSubtract = 30;
                break;
              default:
                daysToSubtract = 7;
            }
          }
          
          if (useCustomDateRange && customDateRange) {
            const [sRaw] = customDateRange.split(' - ');
            if (sRaw) {
              const start = new Date(sRaw);
              const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              prevPeriodEnd.setDate(start.getDate() - 1);
              prevPeriodEnd.setHours(23, 59, 59, 999);
              prevPeriodStart.setDate(prevPeriodEnd.getDate() - days + 1);
              prevPeriodStart.setHours(0, 0, 0, 0);
            }
          } else {
            prevPeriodStart.setDate(prevPeriodStart.getDate() - daysToSubtract);
            prevPeriodEnd.setDate(prevPeriodEnd.getDate() - 1);
            prevPeriodStart.setHours(0, 0, 0, 0);
            prevPeriodEnd.setHours(23, 59, 59, 999);
          }
          
          const formatDate = (date: Date) => {
            const d = date.getDate();
            const m = date.getMonth() + 1;
            const y = date.getFullYear();
            return `${d}/${m}/${y}`;
          };
          
          const prevPeriodText = `เปรียบเทียบกับช่วง ${formatDate(prevPeriodStart)} - ${formatDate(prevPeriodEnd)}`;
          
          return (
            <>
              <StatCard
                title="เบอร์โทรใหม่"
                value={totals.newPhones.toString()}
                subtext={`${pctChange(totals.newPhones, prevPeriodTotals.newPhonesPrev || prevPeriodTotals.newCustomersPrev).toFixed(1)}% ช่วงก่อนหน้า`}
                icon={Phone}
                titleText={prevPeriodText}
              />
              <StatCard
                title="จำนวนแชท"
                value={totals.totalChats.toString()}
                subtext={`${pctChange(totals.totalChats, prevPeriodTotals.totalChatsPrev || prevPeriodTotals.callsPrev).toFixed(1)}% ช่วงก่อนหน้า`}
                icon={MessageSquare}
                titleText={prevPeriodText}
              />
              <StatCard
                title="ลูกค้าใหม่"
                value={totals.newCustomers.toString()}
                subtext={`${pctChange(totals.newCustomers, prevPeriodTotals.newCustomersPrev).toFixed(1)}% ช่วงก่อนหน้า`}
                icon={UserPlus}
                titleText={prevPeriodText}
              />
              <StatCard
                title="ยอดออเดอร์"
                value={totals.ordersCount.toString()}
                subtext={`${pctChange(totals.ordersCount, prevPeriodTotals.ordersPrev).toFixed(1)}% ช่วงก่อนหน้า`}
                icon={ShoppingCart}
                titleText={prevPeriodText}
              />
            </>
          );
        })()}
      </div>

      {/* Table */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 overflow-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <h3 className="text-md font-semibold text-gray-700">
              รายละเอียดสถิติ {usePageStats && selectedPage ? `(เพจ: ${pages.find(p => (p.page_id || p.id.toString()) === selectedPage)?.name})` : ''}
            </h3>
            {usePageStats && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">มุมมอง:</span>
                <button
                  onClick={() => setViewMode('daily')}
                  className={`px-3 py-1 text-sm rounded-md ${viewMode === 'daily' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  รายวัน
                </button>
                <button
                  onClick={() => setViewMode('hourly')}
                  className={`px-3 py-1 text-sm rounded-md ${viewMode === 'hourly' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  รายชั่วโมง
                </button>
              </div>
            )}
          </div>
          <div className="text-xs text-gray-500">
            {usePageStats ? 'ข้อมูลจาก Pages.fm API' : 'สถิติต่อวัน'}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1800px] w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th className="px-3 py-2 text-left whitespace-nowrap min-w-[150px]">เวลา</th>
                <th className="px-3 py-2 text-right whitespace-nowrap min-w-[100px]">ลูกค้าใหม่</th>
                <th className="px-3 py-2 text-right whitespace-nowrap min-w-[120px]">เบอร์โทรศัพท์ทั้งหมด</th>
                <th className="px-3 py-2 text-right whitespace-nowrap min-w-[100px]">เบอร์โทรใหม่</th>
                <th className="px-3 py-2 text-right whitespace-nowrap min-w-[130px]">คอมเม้นจากลูกค้าทั้งหมด</th>
                <th className="px-3 py-2 text-right whitespace-nowrap min-w-[130px]">แชทจากลูกค้าทั้งหมด</th>
                <th className="px-3 py-2 text-right whitespace-nowrap min-w-[130px]">ความคิดเห็นจากเพจทั้งหมด</th>
                <th className="px-3 py-2 text-right whitespace-nowrap min-w-[120px]">แชทจากเพจทั้งหมด</th>
                <th className="px-3 py-2 text-right whitespace-nowrap min-w-[100px]">แชทใหม่</th>
                <th className="px-3 py-2 text-right whitespace-nowrap min-w-[120px]">แชทจากลูกค้าเก่า</th>
                <th className="px-3 py-2 text-right whitespace-nowrap min-w-[140px]">ลูกค้าจากเว็บไซต์ (เข้าสู่ระบบ)</th>
                <th className="px-3 py-2 text-right whitespace-nowrap min-w-[150px]">ลูกค้าจากเว็บไซต์ (ไม่ได้เข้าสู่ระบบ)</th>
                <th className="px-3 py-2 text-right whitespace-nowrap min-w-[100px]">ยอดออเดอร์</th>
                <th className="px-3 py-2 text-right whitespace-nowrap min-w-[120px]">% สั่งซื้อ ต่อลูกค้าใหม่</th>
                <th className="px-3 py-2 text-right whitespace-nowrap min-w-[130px]">% สั่งซื้อ ต่อเบอร์โทรศัพท์</th>
                <th className="px-3 py-2 text-right whitespace-nowrap min-w-[140px]">สัดส่วนเบอร์โทรใหม่/ลูกค้าใหม่</th>
              </tr>
            </thead>
            <tbody>
              {usePageStats && pageStatsData.length > 0 ? (
                (() => {
                  // Process data based on view mode
                  let displayData = [];
                  
                  if (viewMode === 'daily') {
                    // Aggregate data by day
                    const dailyMap = new Map();
                    
                    pageStatsData.forEach(item => {
                      const date = new Date(item.hour);
                      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                      
                      if (!dailyMap.has(dateKey)) {
                        dailyMap.set(dateKey, {
                          date: dateKey,
                          new_customer_count: 0,
                          uniq_phone_number_count: 0,
                          phone_number_count: 0,
                          customer_comment_count: 0,
                          customer_inbox_count: 0,
                          page_comment_count: 0,
                          page_inbox_count: 0,
                          new_inbox_count: 0,
                          inbox_interactive_count: 0,
                          today_uniq_website_referral: 0,
                          today_website_guest_referral: 0,
                          order_count: 0
                        });
                      }
                      
                      const dayData = dailyMap.get(dateKey);
                      dayData.new_customer_count += item.new_customer_count;
                      dayData.uniq_phone_number_count += item.uniq_phone_number_count;
                      dayData.phone_number_count += item.phone_number_count;
                      dayData.customer_comment_count += item.customer_comment_count;
                      dayData.customer_inbox_count += item.customer_inbox_count;
                      dayData.page_comment_count += item.page_comment_count;
                      dayData.page_inbox_count += item.page_inbox_count;
                      dayData.new_inbox_count += item.new_inbox_count;
                      dayData.inbox_interactive_count += item.inbox_interactive_count;
                      dayData.today_uniq_website_referral += item.today_uniq_website_referral;
                      dayData.today_website_guest_referral += item.today_website_guest_referral;
                      dayData.order_count += item.order_count || 0;
                    });
                    
                    displayData = Array.from(dailyMap.values()).sort((a, b) =>
                      new Date(b.date).getTime() - new Date(a.date).getTime()
                    );
                  } else {
                    // Use hourly data
                    displayData = pageStatsData;
                  }
                  
                  return displayData.map((item, index) => {
                    let formattedDate;
                    
                    if (viewMode === 'daily') {
                      formattedDate = item.date;
                    } else {
                      // Convert hour string to date format
                      const date = new Date(item.hour);
                      formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
                    }
                    
                    return (
                      <tr key={index} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{formattedDate}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{item.new_customer_count}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{item.uniq_phone_number_count}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{item.phone_number_count}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{item.customer_comment_count}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{item.customer_inbox_count}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{item.page_comment_count}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{item.page_inbox_count}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{item.new_inbox_count}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{item.inbox_interactive_count}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{item.today_uniq_website_referral}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{item.today_website_guest_referral}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{item.order_count || 0}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {item.new_customer_count > 0
                            ? ((item.order_count || 0) / item.new_customer_count * 100).toFixed(2) + '%'
                            : '-'
                          }
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {item.uniq_phone_number_count > 0
                            ? ((item.order_count || 0) / item.uniq_phone_number_count * 100).toFixed(2) + '%'
                            : '-'
                          }
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {item.new_customer_count > 0
                            ? ((item.uniq_phone_number_count || 0) / item.new_customer_count * 100).toFixed(2) + '%'
                            : '-'
                          }
                        </td>
                      </tr>
                    );
                  });
                })()
              ) : (
                daily.map(r => (
                  <tr key={r.date} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{r.date}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{r.newCustomers}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{r.totalPhones}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{r.newPhones}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{r.totalComments}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{r.totalChats}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{r.totalPageComments}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{r.totalPageChats}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{r.newChats}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{r.chatsFromOldCustomers}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{r.webLoggedIn}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{r.webGuest}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{r.ordersCount}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{r.pctPurchasePerNewCustomer.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{r.pctPurchasePerPhone.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{r.ratioNewPhonesToNewCustomers.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 font-semibold bg-gray-50">
                <td className="px-3 py-2 whitespace-nowrap">รวม</td>
                {usePageStats && pageStatsData.length > 0 ? (
                  (() => {
                    // Calculate totals based on view mode
                    let totalsData;
                    
                    if (viewMode === 'daily') {
                      // Use the same aggregated data as in the table body
                      const dailyMap = new Map();
                      
                      pageStatsData.forEach(item => {
                        const date = new Date(item.hour);
                        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                        
                        if (!dailyMap.has(dateKey)) {
                          dailyMap.set(dateKey, {
                            new_customer_count: 0,
                            uniq_phone_number_count: 0,
                            phone_number_count: 0,
                            customer_comment_count: 0,
                            customer_inbox_count: 0,
                            page_comment_count: 0,
                            page_inbox_count: 0,
                            new_inbox_count: 0,
                            inbox_interactive_count: 0,
                            today_uniq_website_referral: 0,
                            today_website_guest_referral: 0,
                            order_count: 0
                          });
                        }
                        
                        const dayData = dailyMap.get(dateKey);
                        dayData.new_customer_count += item.new_customer_count;
                        dayData.uniq_phone_number_count += item.uniq_phone_number_count;
                        dayData.phone_number_count += item.phone_number_count;
                        dayData.customer_comment_count += item.customer_comment_count;
                        dayData.customer_inbox_count += item.customer_inbox_count;
                        dayData.page_comment_count += item.page_comment_count;
                        dayData.page_inbox_count += item.page_inbox_count;
                        dayData.new_inbox_count += item.new_inbox_count;
                        dayData.inbox_interactive_count += item.inbox_interactive_count;
                        dayData.today_uniq_website_referral += item.today_uniq_website_referral;
                        dayData.today_website_guest_referral += item.today_website_guest_referral;
                        dayData.order_count += item.order_count || 0;
                      });
                      
                      const dailyData = Array.from(dailyMap.values());
                      totalsData = {
                        totalNewCustomers: dailyData.reduce((sum, item) => sum + item.new_customer_count, 0),
                        totalPhones: dailyData.reduce((sum, item) => sum + item.uniq_phone_number_count, 0),
                        totalNewPhones: dailyData.reduce((sum, item) => sum + item.phone_number_count, 0),
                        totalComments: dailyData.reduce((sum, item) => sum + item.customer_comment_count, 0),
                        totalChats: dailyData.reduce((sum, item) => sum + item.customer_inbox_count, 0),
                        totalPageComments: dailyData.reduce((sum, item) => sum + item.page_comment_count, 0),
                        totalPageChats: dailyData.reduce((sum, item) => sum + item.page_inbox_count, 0),
                        totalNewChats: dailyData.reduce((sum, item) => sum + item.new_inbox_count, 0),
                        totalChatsFromOldCustomers: dailyData.reduce((sum, item) => sum + item.inbox_interactive_count, 0),
                        totalWebLoggedIn: dailyData.reduce((sum, item) => sum + item.today_uniq_website_referral, 0),
                        totalWebGuest: dailyData.reduce((sum, item) => sum + item.today_website_guest_referral, 0),
                        totalOrders: dailyData.reduce((sum, item) => sum + (item.order_count || 0), 0)
                      };
                    } else {
                      // Use hourly data
                      totalsData = {
                        totalNewCustomers: pageStatsData.reduce((sum, item) => sum + item.new_customer_count, 0),
                        totalPhones: pageStatsData.reduce((sum, item) => sum + item.uniq_phone_number_count, 0),
                        totalNewPhones: pageStatsData.reduce((sum, item) => sum + item.phone_number_count, 0),
                        totalComments: pageStatsData.reduce((sum, item) => sum + item.customer_comment_count, 0),
                        totalChats: pageStatsData.reduce((sum, item) => sum + item.customer_inbox_count, 0),
                        totalPageComments: pageStatsData.reduce((sum, item) => sum + item.page_comment_count, 0),
                        totalPageChats: pageStatsData.reduce((sum, item) => sum + item.page_inbox_count, 0),
                        totalNewChats: pageStatsData.reduce((sum, item) => sum + item.new_inbox_count, 0),
                        totalChatsFromOldCustomers: pageStatsData.reduce((sum, item) => sum + item.inbox_interactive_count, 0),
                        totalWebLoggedIn: pageStatsData.reduce((sum, item) => sum + item.today_uniq_website_referral, 0),
                        totalWebGuest: pageStatsData.reduce((sum, item) => sum + item.today_website_guest_referral, 0),
                        totalOrders: pageStatsData.reduce((sum, item) => sum + (item.order_count || 0), 0)
                      };
                    }
                    
                    return (
                      <>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{totalsData.totalNewCustomers}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{totalsData.totalPhones}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{totalsData.totalNewPhones}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{totalsData.totalComments}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{totalsData.totalChats}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{totalsData.totalPageComments}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{totalsData.totalPageChats}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{totalsData.totalNewChats}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{totalsData.totalChatsFromOldCustomers}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{totalsData.totalWebLoggedIn}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{totalsData.totalWebGuest}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{totalsData.totalOrders}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {totalsData.totalNewCustomers > 0
                            ? (totalsData.totalOrders / totalsData.totalNewCustomers * 100).toFixed(2) + '%'
                            : '-'
                          }
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {totalsData.totalPhones > 0
                            ? (totalsData.totalOrders / totalsData.totalPhones * 100).toFixed(2) + '%'
                            : '-'
                          }
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {totalsData.totalNewCustomers > 0
                            ? (totalsData.totalPhones / totalsData.totalNewCustomers * 100).toFixed(2) + '%'
                            : '-'
                          }
                        </td>
                      </>
                    );
                  })()
                ) : (
                  <>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{totals.newCustomers}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{totals.totalPhones}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{totals.newPhones}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{totals.totalComments}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{totals.totalChats}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{totals.totalPageComments}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{totals.totalPageChats}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{totals.newChats}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{totals.chatsFromOldCustomers}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{totals.webLoggedIn}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{totals.webGuest}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{totals.ordersCount}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap"></td>
                    <td className="px-3 py-2 text-right whitespace-nowrap"></td>
                    <td className="px-3 py-2 text-right whitespace-nowrap"></td>
                  </>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
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

export default PageStatsPage;
