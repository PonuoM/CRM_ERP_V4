import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Search, Filter, Headphones, ChevronDown, CheckCircle2, XCircle, RotateCcw, Copy, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import UniversalDateRangePicker from '@/components/UniversalDateRangePicker';
import useTeamEmployeeFilter from '../hooks/useTeamEmployeeFilter';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import { apiFetch } from '@/services/api';
import { format } from 'date-fns';
import OrderDetailsModal from '@/components/ReturnedOrdersReport/OrderDetailsModal';

interface AudioLink {
  id: number;
  url: string;
  date?: string;
  notes?: string;
}

interface OrderItem {
  product_name: string;
  quantity: number;
  is_freebie: number;
}

interface OrderData {
  order_id: string;
  order_date: string;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  customer_address?: string;
  shipped_date?: string;
  total_amount: number;
  returned_amount?: number;
  payment_method: string;
  order_status: string;
  cancel_type: string;
  cancel_notes: string;
  admin_resolution_notes?: string;
  admin_resolution_completed: number;
  cancelled_at: string;
  returned_at: string;
  creator_name: string;
  audio_links: AudioLink[];
  items?: OrderItem[];
}

interface UserData {
  id: number;
  first_name: string;
  last_name: string;
  role: string;
  role_id: number;
  supervisor_id: number | null;
  computed_team?: string;
}

interface ReturnedOrdersReportPageProps {
  currentUser?: any;
  users?: any[];
}

const ReturnedOrdersReportPage: React.FC<ReturnedOrdersReportPageProps> = ({ currentUser, users = [] }) => {
  const toast = useToast();
  
  // State
  const [activeTab, setActiveTab] = useState<'Returned' | 'Cancelled'>('Returned');
  const [orderDateRange, setOrderDateRange] = useState({
    start: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [orderStartTime, setOrderStartTime] = useState('');
  const [orderEndTime, setOrderEndTime] = useState('');

  const [actionDateRange, setActionDateRange] = useState({
    start: '',
    end: ''
  });
  const [data, setData] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof OrderData, direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: keyof OrderData) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    let sortableItems = [...data];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key] ?? '';
        let bValue = b[sortConfig.key] ?? '';
        
        if (sortConfig.key === 'total_amount') {
           aValue = parseFloat(aValue as string || '0');
           bValue = parseFloat(bValue as string || '0');
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [data, sortConfig]);

  const renderSortIcon = (key: keyof OrderData) => {
    if (!sortConfig || sortConfig.key !== key) {
        return <ArrowUpDown className="w-3.5 h-3.5 inline ml-1 opacity-40 group-hover:opacity-100 transition-opacity" />;
    }
    if (sortConfig.direction === 'asc') {
        return <ArrowUp className="w-3.5 h-3.5 inline ml-1 text-blue-600" />;
    }
    return <ArrowDown className="w-3.5 h-3.5 inline ml-1 text-blue-600" />;
  };
  const [processingAudio, setProcessingAudio] = useState<string | null>(null);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderData | null>(null);

  // Users Data
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const { availableTeams, filteredUsers: filteredUserDropdown } = useTeamEmployeeFilter(users, selectedTeam);

  // Filters
  const [resolutionFilter, setResolutionFilter] = useState<'All' | 'Completed' | 'Pending'>('All');
  const [audioStatus, setAudioStatus] = useState<'All' | 'has_audio' | 'no_audio'>('All');
  const [reasonKeyword, setReasonKeyword] = useState<string>('');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      let query = `returned_orders_report?status_type=${activeTab}&resolution_status=${resolutionFilter}`;
      if (orderDateRange.start && orderDateRange.end) {
        query += `&order_start_date=${orderDateRange.start}&order_end_date=${orderDateRange.end}`;
      }
      if (orderStartTime && orderEndTime) {
        query += `&order_start_time=${orderStartTime}&order_end_time=${orderEndTime}`;
      }
      if (actionDateRange.start && actionDateRange.end) {
        query += `&action_start_date=${actionDateRange.start}&action_end_date=${actionDateRange.end}`;
      }
      if (selectedUsers.length > 0) {
        query += `&user_id=${selectedUsers.join(',')}`;
      }
      if (audioStatus !== 'All') {
        query += `&audio_status=${audioStatus}`;
      }
      if (reasonKeyword) {
        query += `&reason_keyword=${encodeURIComponent(reasonKeyword)}`;
      }
      if (searchKeyword) {
        query += `&search_keyword=${encodeURIComponent(searchKeyword)}`;
      }
      
      const json = await apiFetch(query);
      
      if (json && json.ok) {
        setData(json.data);
      } else {
        toast.error('ข้อผิดพลาด', json?.message || 'ไม่สามารถดึงข้อมูลได้');
      }
    } catch (err: any) {
      toast.error('ข้อผิดพลาด', err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, resolutionFilter, audioStatus]);

  const handleToggleCompleted = async (orderId: string, currentStatus: number) => {
    try {
      const newStatus = currentStatus === 1 ? 0 : 1;
      const json = await apiFetch('returned_orders_report/toggle-completed', {
        method: 'POST',
        body: JSON.stringify({ order_id: orderId, is_completed: newStatus })
      });
      
      if (json && json.ok) {
        toast.success('สำเร็จ', 'อัปเดตสถานะเรียบร้อยแล้ว');
        fetchData(true);
      } else {
        toast.error('ข้อผิดพลาด', json?.message || 'ไม่สามารถอัปเดตสถานะได้');
      }
    } catch (err: any) {
      toast.error('ข้อผิดพลาด', err.message);
    }
  };

  const getOrderStatusThai = (status: string) => {
    const statusMap: Record<string, string> = {
      'AwaitingVerification': 'รอตรวจสอบสลิป',
      'BadDebt': 'หนี้สูญ',
      'Cancelled': 'ยกเลิกแล้ว',
      'Confirmed': 'ยืนยันแล้ว',
      'Delivered': 'จัดส่งสำเร็จ',
      'Pending': 'รอดำเนินการ',
      'Picking': 'กำลังจัดสินค้า',
      'PreApproved': 'รออนุมัติ',
      'Preparing': 'กำลังเตรียมจัดส่ง',
      'Returned': 'ตีกลับ',
      'Shipping': 'กำลังจัดส่ง'
    };
    return statusMap[status] || status;
  };

  const handleCopyOrderData = (order: OrderData) => {
    let text = `[รายละเอียดออเดอร์]\n`;
    text += `รหัส: ${order.order_id}\n`;
    text += `สถานะปัจจุบัน: ${getOrderStatusThai(order.order_status)}\n`;
    text += `ยอดทั้งออเดอร์: ฿${parseFloat(order.total_amount as any || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}\n`;
    text += `ยอดตีกลับ: ฿${parseFloat(order.returned_amount as any || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}\n`;
    text += `วันที่สั่ง: ${order.order_date?.substring(0, 10) || '-'}\n`;
    text += `วันที่ส่ง: ${order.shipped_date?.substring(0, 10) || '-'}\n`;
    text += `ที่อยู่: ${order.customer_address || '-'}\n\n`;

    if (order.items && order.items.length > 0) {
      text += `[รายการสินค้า]\n`;
      order.items.forEach(item => {
        text += `- ${item.product_name} (x${item.quantity}) ${item.is_freebie ? '[ของแถม]' : ''}\n`;
      });
      text += `\n`;
    }

    text += `[ลูกค้า]\n`;
    text += `ชื่อ: ${order.customer_name}\n`;
    text += `เบอร์: ${order.customer_phone}\n\n`;

    text += `[เหตุผลยกเลิก/ตีกลับ]\n`;
    text += `ประเภท: ${order.cancel_type || '-'}\n`;
    text += `หมายเหตุ: ${order.cancel_notes || '-'}\n\n`;

    if (order.admin_resolution_notes) {
      text += `[สรุปออเดอร์]\n${order.admin_resolution_notes}\n\n`;
    }

    if (order.audio_links && order.audio_links.length > 0) {
      text += `[ไฟล์เสียง]\n`;
      order.audio_links.forEach((link, idx) => {
        text += `${idx + 1}. ${link.url}\n`;
        if (link.date) {
          text += `   เวลาโทร: ${link.date}\n`;
        }
        if (link.notes) {
          text += `   สรุป: ${link.notes}\n`;
        }
      });
      text += `\n`;
    }

    navigator.clipboard.writeText(text.trim()).then(() => {
      toast.success('สำเร็จ', 'คัดลอกข้อมูลออเดอร์แล้ว');
    }).catch(() => {
      toast.error('ข้อผิดพลาด', 'ไม่สามารถคัดลอกข้อมูลได้');
    });
  };

  const handleAutoMatch = async (orderId: string) => {
    try {
      setProcessingAudio(orderId);
      const json = await apiFetch('returned_orders_report/auto-match', {
        method: 'POST',
        body: JSON.stringify({ order_id: orderId })
      });
      
      if (json && json.ok) {
        toast.success('สำเร็จ', json.message || 'จับคู่ไฟล์เสียงสำเร็จ');
        fetchData(true); // refresh to show new audio silently
      } else {
        toast.error('ข้อผิดพลาด', json?.message);
      }
    } catch (err: any) {
      toast.error('ข้อผิดพลาด', err.message);
    } finally {
      setProcessingAudio(null);
    }
  };

  const handleOpenDetails = (order: OrderData) => {
    setSelectedOrder(order);
    setIsDetailsModalOpen(true);
  };

  const submitDetails = async (payload: any) => {
    try {
      const json = await apiFetch('returned_orders_report/update-details', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      if (json && json.ok) {
        toast.success('สำเร็จ', 'บันทึกข้อมูลเรียบร้อยแล้ว');
        fetchData(true);
      } else {
        toast.error('ข้อผิดพลาด', json?.message);
      }
    } catch (err: any) {
      toast.error('ข้อผิดพลาด', err.message);
    }
  };

  // Summary calc
  const totalOrders = data.length;
  const totalAmount = data.reduce((sum, item) => sum + parseFloat(item.total_amount as any || 0), 0);
  const totalReturnedAmount = data.reduce((sum, item) => sum + parseFloat(item.returned_amount as any || 0), 0);

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
        <header className="flex justify-between items-center p-4 bg-white border-b shadow-sm">
          <h1 className="text-2xl font-semibold">รายงานออเดอร์ตีกลับและยกเลิก</h1>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="flex border-b">
              <button
                className={`flex-1 py-4 text-center font-medium ${activeTab === 'Returned' ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50/30' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('Returned')}
              >
                ออเดอร์ตีกลับ (Returned)
              </button>
              <button
                className={`flex-1 py-4 text-center font-medium ${activeTab === 'Cancelled' ? 'border-b-2 border-red-500 text-red-600 bg-red-50/30' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('Cancelled')}
              >
                ออเดอร์ยกเลิก (Cancelled)
              </button>
            </div>

            <div className="p-6">
              {/* Filters */}
              <div className="flex flex-col gap-4 mb-6 bg-gray-50 p-5 rounded-lg border border-gray-200 shadow-sm">
                
                {/* Top Row: Date Ranges */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Order Date Range & Time Window */}
                  <div className="flex flex-col gap-2 p-4 bg-white border border-gray-200 rounded-md shadow-sm">
                    <label className="text-sm font-semibold text-gray-700 border-b pb-2">วันที่สร้างคำสั่งซื้อ (Order Date)</label>
                    <div className="z-20">
                      <UniversalDateRangePicker 
                        value={orderDateRange}
                        allowAllTime={false}
                        onChange={(range) => setOrderDateRange(range)}
                      />
                    </div>
                    <div className="flex flex-col gap-1 mt-1">
                      <label className="text-[10px] text-gray-500">กรองเฉพาะช่วงเวลาของแต่ละวัน</label>
                      <div className="flex items-center gap-2">
                        <input type="time" value={orderStartTime} onChange={e => setOrderStartTime(e.target.value)} className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none" />
                        <span className="text-gray-400 text-xs">ถึง</span>
                        <input type="time" value={orderEndTime} onChange={e => setOrderEndTime(e.target.value)} className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none" />
                      </div>
                    </div>
                    <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded-sm mt-1">ระบบจะดึงข้อมูลเฉพาะช่วงเวลาที่เลือกในทุกๆ วัน</span>
                  </div>

                  {/* Action Details: Date Range & Audio Status */}
                  <div className="flex flex-col gap-2 p-4 bg-white border border-gray-200 rounded-md shadow-sm">
                    <label className="text-sm font-semibold text-gray-700 border-b pb-2">ข้อมูลการตีกลับ/ยกเลิก (Action Details)</label>
                    <div className="z-10 mt-1">
                      <UniversalDateRangePicker 
                        value={actionDateRange}
                        allowAllTime={true}
                        placeholder="วันที่ลงสถานะ (ระบุหรือไม่ระบุก็ได้)..."
                        onChange={(range) => setActionDateRange(range)}
                      />
                    </div>
                    <div className="flex flex-col gap-1 mt-1 z-0">
                      <label className="text-[10px] text-gray-500">สถานะไฟล์เสียง</label>
                      <select
                        value={audioStatus}
                        onChange={e => setAudioStatus(e.target.value as any)}
                        className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                      >
                        <option value="All">สถานะไฟล์เสียงทั้งหมด</option>
                        <option value="has_audio">มีไฟล์เสียงแล้ว</option>
                        <option value="no_audio">ยังไม่มีไฟล์เสียง</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Status, User ID, and Search */}
                <div className="flex flex-wrap items-end justify-between pt-3 border-t border-gray-200 mt-2 gap-4">
                  
                  <div className="flex flex-wrap items-end gap-3 w-full xl:w-auto flex-1">
                    
                    {/* Reason Search */}
                    <div className="flex flex-col gap-1.5 w-full sm:w-[220px]">
                      <label className="text-sm font-medium text-gray-700">ค้นหาสาเหตุ/หมายเหตุ</label>
                      <input 
                        type="text" 
                        value={reasonKeyword} 
                        onChange={e => setReasonKeyword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && fetchData()}
                        placeholder="พิมพ์สาเหตุ..."
                        className="border border-gray-300 rounded-md px-3 h-[38px] text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      />
                    </div>

                    {/* Customer Search */}
                    <div className="flex flex-col gap-1.5 w-full sm:w-[220px]">
                      <label className="text-sm font-medium text-gray-700">ค้นหาลูกค้า/รหัสออเดอร์</label>
                      <input 
                        type="text" 
                        value={searchKeyword} 
                        onChange={e => setSearchKeyword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && fetchData()}
                        placeholder="เบอร์โทร, ชื่อ, รหัส..."
                        className="border border-gray-300 rounded-md px-3 h-[38px] text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      />
                    </div>

                    {/* Resolution Status */}
                    <div className="flex flex-col gap-1.5 w-full sm:w-[180px]">
                      <label className="text-sm font-medium text-gray-700">สถานะการจัดการ</label>
                      <select
                        value={resolutionFilter}
                        onChange={e => setResolutionFilter(e.target.value as any)}
                        className="border border-gray-300 rounded-md px-3 h-[38px] text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      >
                        <option value="All">ทั้งหมด</option>
                        <option value="Pending">รอดำเนินการ</option>
                        <option value="Completed">จัดการเรียบร้อยแล้ว</option>
                      </select>
                    </div>

                    {/* Team Dropdown */}
                    <div className="flex flex-col gap-1.5 w-full sm:w-[150px]">
                      <label className="text-sm font-medium text-gray-700">ทีมขาย</label>
                      <select
                          value={selectedTeam}
                          onChange={(e) => { setSelectedTeam(e.target.value); setSelectedUsers([]); }}
                          className="border border-gray-300 rounded-md px-3 h-[38px] text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      >
                          <option value="all">ทุกทีม</option>
                          {availableTeams.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                      </select>
                    </div>

                    {/* Employee Dropdown */}
                    <div className="flex flex-col gap-1.5 w-full sm:w-[180px]">
                      <label className="text-sm font-medium text-gray-700">รายชื่อพนักงาน</label>
                      <div className="relative">
                          <button
                              onClick={() => setShowUserDropdown(!showUserDropdown)}
                              className="border border-gray-300 rounded-md px-3 h-[38px] text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white w-full text-left flex justify-between items-center"
                          >
                              <span className="truncate max-w-[130px]">
                                  {selectedUsers.length === 0 
                                      ? "พนักงานทุกคน" 
                                      : `เลือกแล้ว ${selectedUsers.length} คน`}
                              </span>
                              <span className="text-gray-400 text-xs">▼</span>
                          </button>
                          {showUserDropdown && (
                              <>
                                  <div className="fixed inset-0 z-40" onClick={() => setShowUserDropdown(false)}></div>
                                  <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                                      <div 
                                          className="px-3 py-2 border-b border-gray-100 hover:bg-gray-50 cursor-pointer text-sm"
                                          onClick={() => setSelectedUsers([])}
                                      >
                                          <label className="flex items-center gap-2 cursor-pointer w-full">
                                              <input 
                                                  type="checkbox" 
                                                  checked={selectedUsers.length === 0} 
                                                  readOnly 
                                                  className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                              />
                                              <span>พนักงานทุกคน (All)</span>
                                          </label>
                                      </div>
                                      {filteredUserDropdown.map(u => (
                                          <div 
                                              key={u.id}
                                              className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                                              onClick={() => {
                                                  const idStr = u.id.toString();
                                                  if (selectedUsers.includes(idStr)) {
                                                      setSelectedUsers(prev => prev.filter(id => id !== idStr));
                                                  } else {
                                                      setSelectedUsers(prev => [...prev, idStr]);
                                                  }
                                              }}
                                          >
                                              <label className="flex items-center gap-2 cursor-pointer w-full">
                                                  <input 
                                                      type="checkbox" 
                                                      checked={selectedUsers.includes(u.id.toString())} 
                                                      readOnly 
                                                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                  />
                                                  <span>{u.firstName} {u.lastName}</span>
                                              </label>
                                          </div>
                                      ))}
                                  </div>
                              </>
                          )}
                      </div>
                    </div>
                  </div>

                  {/* Search Button */}
                  <button
                    onClick={fetchData}
                    className="bg-gray-800 text-white px-8 h-[38px] rounded-md hover:bg-gray-700 transition font-medium flex items-center justify-center gap-2 shadow-sm w-full sm:w-auto"
                    disabled={loading}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    {loading ? 'กำลังค้นหา...' : 'ค้นหาข้อมูล'}
                  </button>
                </div>
              </div>
              {/* User Warning for All dates */}
              {!orderDateRange.start && (
                <div className="bg-yellow-50 text-yellow-800 px-4 py-2 rounded-md mb-4 text-sm flex items-start gap-2 border border-yellow-200">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  <span><strong>คำเตือน:</strong> การค้นหาแบบ "ทั้งหมด" (ไม่ระบุวันที่) จะถูกจำกัดการแสดงผลเพียง <strong>500 รายการล่าสุด</strong> เพื่อป้องกันเซิร์ฟเวอร์ทำงานหนัก หากต้องการดูออเดอร์เก่าๆ หรือทั้งหมดจริงๆ กรุณาระบุช่วงวันที่ครับ</span>
                </div>
              )}

              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-white border rounded-lg p-4 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">รวมออเดอร์{activeTab === 'Returned' ? 'ตีกลับ' : 'ยกเลิก'}</p>
                    <p className="text-3xl font-bold text-gray-800">{totalOrders}</p>
                  </div>
                  <div className={`p-3 rounded-full ${activeTab === 'Returned' ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'}`}>
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  </div>
                </div>
                <div className="bg-white border rounded-lg p-4 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">ยอดเงินรวมทั้งออเดอร์</p>
                    <p className="text-3xl font-bold text-gray-700">฿{totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                  </div>
                  <div className="p-3 rounded-full bg-gray-100 text-gray-600">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </div>
                </div>
                <div className="bg-white border rounded-lg p-4 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">ยอดตีกลับรวม</p>
                    <p className="text-3xl font-bold text-red-600">฿{totalReturnedAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                  </div>
                  <div className="p-3 rounded-full bg-red-100 text-red-600">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"></path></svg>
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto border rounded-lg shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors" onClick={() => handleSort('order_id')}>
                        รหัสออเดอร์ {renderSortIcon('order_id')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors" onClick={() => handleSort('order_date')}>
                        วันที่ {renderSortIcon('order_date')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors" onClick={() => handleSort('customer_name')}>
                        ลูกค้า {renderSortIcon('customer_name')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors" onClick={() => handleSort('total_amount')}>
                        ยอดทั้งออเดอร์ {renderSortIcon('total_amount')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors" onClick={() => handleSort('returned_amount')}>
                        ยอดตีกลับ {renderSortIcon('returned_amount')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100 transition-colors" onClick={() => handleSort('cancel_type')}>
                        เหตุผล {renderSortIcon('cancel_type')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">สรุปออเดอร์</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ไฟล์เสียง</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">กำลังโหลดข้อมูล...</td>
                      </tr>
                    ) : sortedData.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">ไม่พบข้อมูลในช่วงเวลานี้</td>
                      </tr>
                    ) : (
                      sortedData.map((order, idx) => {
                        const isCompleted = order.admin_resolution_completed === 1;
                        return (
                        <tr key={`${order.order_id}-${idx}`} className={`hover:bg-gray-50 transition-colors ${isCompleted ? 'bg-gray-100 opacity-60' : 'bg-white'}`}>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`font-mono text-sm ${isCompleted ? 'text-gray-500' : 'text-blue-600'}`}>{order.order_id}</span>
                            <div className="text-xs text-gray-500 mt-1">{order.creator_name}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            <div><span className="font-medium text-gray-700">วันที่สั่งซื้อ:</span> {order.order_date?.substring(0,10)}</div>
                            {activeTab === 'Returned' && order.returned_at && (
                              <div className="text-orange-600 mt-1"><span className="font-medium">ตีกลับ:</span> {order.returned_at?.substring(0,10)}</div>
                            )}
                            {activeTab === 'Cancelled' && order.cancelled_at && (
                              <div className="text-red-600 mt-1"><span className="font-medium">ยกเลิก:</span> {order.cancelled_at?.substring(0,10)}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">{order.customer_name}</div>
                            <div className="text-sm text-gray-500">{order.customer_phone}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                            ฿{parseFloat(order.total_amount as any || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                            <div className="text-xs font-normal text-gray-500 mt-1">{order.payment_method}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600 font-medium">
                            ฿{parseFloat(order.returned_amount as any || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="font-medium text-gray-800">{order.cancel_type || '-'}</div>
                            <div className="text-gray-500 text-xs mt-1 max-w-xs truncate" title={order.cancel_notes}>{order.cancel_notes}</div>
                          </td>
                          <td className="px-4 py-3 text-sm max-w-[200px]">
                            <div className="flex justify-between items-start gap-2 group">
                              <div className="text-gray-600 text-xs whitespace-pre-wrap line-clamp-3" title={order.admin_resolution_notes}>
                                {order.admin_resolution_notes || <span className="text-gray-400 italic">ไม่มีสรุป</span>}
                              </div>
                              <button onClick={() => handleOpenDetails(order)} className="text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" title="จัดการรายละเอียด">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {order.audio_links && order.audio_links.length > 0 ? (
                              <div className="flex flex-col gap-3">
                                {order.audio_links.map((link, i) => (
                                  <div key={i} className="flex flex-col gap-1 border-b border-gray-100 pb-2 last:border-0 last:pb-0 group/audio">
                                    <div className="flex justify-between items-start gap-2">
                                      <a 
                                        href={link.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 hover:underline text-sm flex items-center gap-1"
                                        title="ฟังไฟล์เสียงบน Google Drive"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                        ไฟล์เสียงที่ {i + 1}
                                      </a>
                                      {link.id && (
                                        <button onClick={() => handleOpenDetails(order)} className="text-gray-400 hover:text-blue-600 opacity-0 group-hover/audio:opacity-100 transition-opacity flex-shrink-0" title="จัดการรายละเอียด">
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                        </button>
                                      )}
                                    </div>
                                    {link.date && (
                                      <div className="text-xs text-gray-500 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                        </svg>
                                        {(() => {
                                          try {
                                            const d = new Date(link.date.replace(' ', 'T'));
                                            return isNaN(d.getTime()) ? link.date : format(d, 'dd/MM/yyyy HH:mm');
                                          } catch {
                                            return link.date;
                                          }
                                        })()}
                                      </div>
                                    )}
                                    {link.notes && <div className="text-xs text-gray-500 bg-gray-50 p-1 rounded italic">{link.notes}</div>}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 italic">ไม่มีไฟล์เสียง</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                            <div className="flex flex-col gap-2 items-center">
                              <button 
                                onClick={() => handleAutoMatch(order.order_id)}
                                disabled={processingAudio === order.order_id}
                                className="text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1 rounded w-full flex justify-center items-center gap-1 disabled:opacity-50"
                              >
                                {processingAudio === order.order_id ? 'กำลังจับคู่...' : 'จับคู่อัตโนมัติ'}
                              </button>
                              <button 
                                onClick={() => handleOpenDetails(order)}
                                disabled={processingAudio === order.order_id}
                                className="text-gray-600 hover:text-gray-900 bg-gray-100 px-3 py-1 rounded w-full text-xs disabled:opacity-50 flex items-center justify-center gap-1"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                จัดการรายละเอียด
                              </button>
                              
                              <button 
                                onClick={() => handleCopyOrderData(order)}
                                className="text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1 rounded w-full text-xs flex items-center justify-center gap-1 border border-blue-100 transition-colors"
                                title="คัดลอกข้อมูลทั้งหมดของออเดอร์นี้"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                คัดลอกข้อมูล
                              </button>
                              
                              <button
                                onClick={() => handleToggleCompleted(order.order_id, order.admin_resolution_completed)}
                                className={`mt-2 flex items-center justify-center gap-1 w-full px-3 py-1.5 rounded text-xs font-medium transition-colors border ${
                                  order.admin_resolution_completed === 1
                                    ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                {order.admin_resolution_completed === 1 ? (
                                  <>
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                    สรุปแล้ว
                                  </>
                                ) : (
                                  'ทำเครื่องหมายว่าเสร็จ'
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )})
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <OrderDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          onSubmit={submitDetails}
          orderData={selectedOrder}
        />
    </div>
  );
};

export default ReturnedOrdersReportPage;
