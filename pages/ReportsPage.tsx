import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  Package,
  TrendingUp,
  DollarSign,
  Users,
  ShoppingCart,
  Download,
  Calendar,
  Filter,
  ChevronDown,
  BarChart3,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  ExternalLink,
  Headphones
} from 'lucide-react';
import { Order, Customer, Product, WarehouseStock, StockMovement, PaymentMethod, PaymentStatus, OrderStatus, User, Page } from '../types';
import { calculateCustomerGrade } from '@/utils/customerGrade';
import { apiFetch } from '../services/api';
import resolveApiBasePath from '../utils/apiBasePath';
import APP_BASE_PATH from '../appBasePath';
import DateRangePicker, { DateRange } from '../components/DateRangePicker';
import ExportTypeModal from '../components/ExportTypeModal';
import { downloadDataFile } from '../utils/exportUtils';

const getCustomerDisplayName = (customer: Customer): string => {
  const first = (customer.firstName || '').trim();
  const last = (customer.lastName || '').trim();
  const fullName = [first, last].filter(Boolean).join(' ');
  if (fullName) return fullName;
  if (customer.facebookName) return customer.facebookName;
  if (customer.lineId) return customer.lineId;
  if (customer.phone) return customer.phone;
  return customer.id;
};

interface ReportsPageProps {
  orders?: Order[];
  customers?: Customer[];
  products?: Product[];
  warehouseStock?: WarehouseStock[];
  stockMovements?: StockMovement[];
  productLots?: any[];
  currentUser?: User;
  users?: User[];
  pages?: Page[];
}

type ReportType = 'stock' | 'lot-stock' | 'customers' | 'orders-raw' | 'return-summary' | 'commission' | 'call-history';

interface ReportCard {
  id: ReportType;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  disabled?: boolean;
  comingSoon?: string;
}

const reportCards: ReportCard[] = [
  {
    id: 'orders-raw',
    title: 'รายงานออเดอร์แบบละเอียด',
    description: 'รายงานออเดอร์แบบ Raw Data แสดงทุกรายการสินค้า พร้อมสถานะการดำเนินการ',
    icon: FileSpreadsheet,
    color: 'bg-indigo-500',
    disabled: false
  },
  {
    id: 'stock',
    title: 'รายงานสต๊อคคงเหลือ',
    description: 'รายงานสินค้าคงคลังรวมทุกคลังสินค้า พร้อมมูลค่าสต๊อค',
    icon: Package,
    color: 'bg-gray-400',
    disabled: true,
    comingSoon: 'ใช้งานได้ในอนาคต'
  },
  {
    id: 'lot-stock',
    title: 'รายงานสต๊อคคงคลัง-Lot',
    description: 'รายงานสต๊อคแยกตาม Lot พร้อมวันหมดอายุและราคาต้นทุน',
    icon: TrendingUp,
    color: 'bg-gray-400',
    disabled: true,
    comingSoon: 'ใช้งานได้ในอนาคต'
  },
  {
    id: 'customers',
    title: 'รายงานลูกค้า',
    description: 'รายงานข้อมูลลูกค้า พฤติกรรมการซื้อ และมูลค่าการซื้อ',
    icon: Users,
    color: 'bg-gray-400',
    disabled: true,
    comingSoon: 'ใช้งานได้ในอนาคต'
  },
  {
    id: 'return-summary',
    title: 'รายงานตีกลับเข้าคลัง',
    description: 'สรุปข้อมูลออเดอร์ตีกลับ จำนวนกล่อง สภาพสินค้า และสถานะการจัดการ',
    icon: RotateCcw,
    color: 'bg-orange-500',
    disabled: false
  },
  {
    id: 'commission',
    title: 'รายงานคอมมิชชั่น',
    description: 'สรุปสถานะค่าคอมมิชชั่นแยกตามช่วงเวลา พร้อม Export CSV ตามสถานะ',
    icon: DollarSign,
    color: 'bg-emerald-500',
    disabled: false
  },
  {
    id: 'call-history',
    title: 'บันทึกการโทร',
    description: 'รายงานบันทึกการโทรติดต่อลูกค้าจากระบบโทรศัพท์ แยกตามองค์กร',
    icon: Headphones,
    color: 'bg-blue-500',
    disabled: false
  }
];

const ReportsPage: React.FC<ReportsPageProps> = ({
  orders: propOrders = [],
  customers = [],
  products = [],
  warehouseStock = [],
  stockMovements = [],
  productLots = [],
  currentUser,
  users = [],
  pages = []
}) => {
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'year' | 'this-month' | 'last-month' | 'custom'>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [fetchedOrders, setFetchedOrders] = useState<Order[]>([]);
  const [fetchedCustomers, setFetchedCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [returnSummary, setReturnSummary] = useState<{
    totalOrders: number;
    allOrders: number;
    totalBoxes: number;
    returning: number;
    returned: number;
    good: number;
    damaged: number;
    lost: number;
  } | null>(null);
  const [isReturnLoading, setIsReturnLoading] = useState(false);
  // Map: "orderId-boxNumber" => return_status (e.g. 'good', 'damaged', 'lost', null)
  const [orderBoxesMap, setOrderBoxesMap] = useState<Record<string, string | null>>({});
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);

  // Commission report state
  interface CommSummaryRow { period: string; incomplete: number; pending: number; calculated: number; total: number; total_commission: number; }
  const [commSummaryRows, setCommSummaryRows] = useState<CommSummaryRow[]>([]);
  const [commGroupBy, setCommGroupBy] = useState<'month' | 'week' | 'day'>('month');
  const [isCommLoading, setIsCommLoading] = useState(false);
  const [isCommExporting, setIsCommExporting] = useState(false);
  const [commExportStatus, setCommExportStatus] = useState<string | null>(null);
  const [isCommExportModalOpen, setIsCommExportModalOpen] = useState(false);
  const now = new Date();
  const defaultCommStart = `${now.getFullYear()}-01-01T00:00`;
  const defaultCommEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T23:59`;
  const [commSummaryRange, setCommSummaryRange] = useState<DateRange>({ start: defaultCommStart, end: defaultCommEnd });
  const [commExportRange, setCommExportRange] = useState<DateRange>({ start: defaultCommStart, end: defaultCommEnd });

  // Call history export state
  const [isCallHistoryExporting, setIsCallHistoryExporting] = useState(false);
  const [callHistoryPreviewRows, setCallHistoryPreviewRows] = useState<any[]>([]);
  const [isCallHistoryPreviewLoading, setIsCallHistoryPreviewLoading] = useState(false);

  // Calculate date range for filtering
  const getDateRange = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let filterStartDate = new Date(today);
    let filterEndDate = new Date(today);
    filterEndDate.setHours(23, 59, 59, 999);

    switch (dateRange) {
      case 'today':
        break;
      case 'week':
        filterStartDate.setDate(today.getDate() - 7);
        break;
      case 'month':
        filterStartDate.setMonth(today.getMonth() - 1);
        break;
      case 'this-month':
        // เดือนนี้: วันที่ 1 ของเดือนปัจจุบัน ถึง วันนี้
        filterStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'last-month':
        // เดือนที่แล้ว: วันที่ 1 ถึง วันสุดท้ายของเดือนที่แล้ว
        filterStartDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        filterEndDate = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
        break;
      case 'year':
        filterStartDate.setFullYear(today.getFullYear() - 1);
        break;
      case 'custom':
        if (startDate) filterStartDate = new Date(startDate);
        if (endDate) {
          filterEndDate = new Date(endDate);
          filterEndDate.setHours(23, 59, 59, 999);
        }
        break;
    }
    return { filterStartDate, filterEndDate };
  };

  // Fetch orders when props are empty or when date range changes
  useEffect(() => {
    // If we have prop orders, filter them by date and use
    if (propOrders.length > 0) {
      const { filterStartDate, filterEndDate } = getDateRange();
      const filtered = propOrders.filter(order => {
        if (!order.orderDate) return false;
        const orderDate = new Date(order.orderDate);
        return orderDate >= filterStartDate && orderDate <= filterEndDate;
      });
      setFetchedOrders(filtered);
      setFetchedCustomers(customers);
      return;
    }

    // Fetch from API whenever date range changes
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const isSuperAdmin = currentUser && String(currentUser.role).toLowerCase() === 'superadmin';
        const companyFilter = currentUser && !isSuperAdmin && currentUser.companyId
          ? `&companyId=${currentUser.companyId}`
          : '';

        // Fetch with current date range
        const { filterStartDate, filterEndDate } = getDateRange();
        // Use local date format to avoid timezone issues (toISOString converts to UTC, shifts dates back in UTC+7)
        const formatLocalDate = (d: Date) => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        const startDateStr = formatLocalDate(filterStartDate);
        const endDateStr = formatLocalDate(filterEndDate);

        // Fetch orders with date filter (pageSize needed since backend defaults to 50)
        const ordersResponse = await apiFetch(`orders?pageSize=15000&orderDateStart=${startDateStr}&orderDateEnd=${endDateStr}${companyFilter}`);
        const ordersData = Array.isArray(ordersResponse)
          ? ordersResponse
          : (ordersResponse?.orders || ordersResponse?.data || []);

        const mappedOrders: Order[] = ordersData
          .filter((r: any) => !/-\d+$/.test(String(r.id || "")))
          .map((r: any) => ({
            id: String(r.id),
            orderNumber: r.order_number || r.id,
            customerId: r.customer_id,
            companyId: r.company_id,
            creatorId: r.creator_id,
            orderDate: r.order_date || '',
            deliveryDate: r.delivery_date || '',
            shippingAddress: {
              recipientFirstName: r.recipient_first_name || '',
              recipientLastName: r.recipient_last_name || '',
              street: r.street || '',
              subdistrict: r.subdistrict || '',
              district: r.district || '',
              province: r.province || '',
              postalCode: r.postal_code || '',
            },
            items: Array.isArray(r.items) ? r.items.map((it: any) => ({
              id: it.id,
              productId: it.product_id,
              productName: it.product_name || '',
              quantity: it.quantity || 0,
              pricePerUnit: it.price_per_unit || 0,
              discount: it.discount || 0,
              netTotal: Number(it.net_total) || 0,
              isFreebie: !!it.is_freebie,
              boxNumber: it.box_number || 1,
              basketKeyAtSale: it.basket_key_at_sale || null,
              productCategory: it.product_category || null,
              productReportCategory: it.product_report_category || null,
              creatorId: it.creator_id || null,
            })) : [],
            shippingCost: Number(r.shipping_cost) || 0,
            billDiscount: Number(r.bill_discount) || 0,
            totalAmount: Number(r.total_amount) || 0,
            paymentMethod: r.payment_method as PaymentMethod,
            paymentStatus: (r.payment_status || 'Unpaid') as PaymentStatus,
            orderStatus: (r.order_status || 'Pending') as OrderStatus,
            trackingNumbers: r.tracking_numbers
              ? String(r.tracking_numbers).split(',').filter(Boolean)
              : [],
            slipUrl: r.slip_url,
            slips: Array.isArray(r.slips) ? r.slips : [],
            notes: r.notes,
            salesChannel: r.sales_channel,
            salesChannelPageId: r.sales_channel_page_id,
            customerType: r.customer_type,
            customerPhone: r.customer_phone || r.phone || '',
            airportDeliveryDate: r.airport_delivery_date || '',
            amountPaid: Number(r.amount_paid) || 0,
            paymentReceivedDate: r.payment_received_date || '',
          }));

        console.log('📊 Reports fetch:', startDateStr, '→', endDateStr, '=', mappedOrders.length, 'orders');

        setFetchedOrders(mappedOrders);

        // Fetch order_boxes for returned orders (to get return_status per box)
        try {
          const returnedOrderIds = mappedOrders
            .filter(o => o.orderStatus === 'Returned')
            .map(o => o.id);
          if (returnedOrderIds.length > 0) {
            // Batch fetch in chunks of 100
            const boxMap: Record<string, string | null> = {};
            for (let i = 0; i < returnedOrderIds.length; i += 100) {
              const chunk = returnedOrderIds.slice(i, i + 100);
              const idsParam = chunk.join(',');
              const boxRes = await apiFetch(`Orders/get_order_boxes.php?order_ids=${encodeURIComponent(idsParam)}`);
              const boxes = boxRes?.boxes || boxRes?.data || [];
              boxes.forEach((b: any) => {
                const key = `${b.order_id}-${b.box_number}`;
                boxMap[key] = b.return_status || null;
              });
            }
            setOrderBoxesMap(boxMap);
          } else {
            setOrderBoxesMap({});
          }
        } catch (err) {
          console.warn('Could not fetch order boxes for return status:', err);
          setOrderBoxesMap({});
        }

        // Fetch customers for display (phone, customer type)
        try {
          const customersResponse = await apiFetch(`customers?pageSize=5000${companyFilter}`);
          const customersData = Array.isArray(customersResponse)
            ? customersResponse
            : (customersResponse?.customers || customersResponse?.data || []);

          const mappedCustomers: Customer[] = customersData.map((c: any) => ({
            id: String(c.id),
            pk: c.id,
            firstName: c.first_name || '',
            lastName: c.last_name || '',
            phone: c.phone || '',
            lifecycleStatus: c.lifecycle_status || '',
            address: c.address ? {
              street: c.address.street || '',
              subdistrict: c.address.subdistrict || '',
              district: c.address.district || '',
              province: c.address.province || '',
              postalCode: c.address.postal_code || '',
            } : undefined,
          }));

          setFetchedCustomers(mappedCustomers);
        } catch (error) {
          console.warn('Could not fetch customers:', error);
          setFetchedCustomers(customers);
        }
      } catch (error) {
        console.error('Failed to fetch orders:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propOrders, currentUser, dateRange, startDate, endDate]); // Re-fetch when date range changes

  // Fetch return summary when return-summary report is selected
  useEffect(() => {
    if (selectedReport !== 'return-summary') return;

    const fetchReturnSummary = async () => {
      setIsReturnLoading(true);
      try {
        const { filterStartDate, filterEndDate } = getDateRange();
        // Use local date format to avoid timezone issues (toISOString converts to UTC, shifts dates back in UTC+7)
        const formatLocalDate = (d: Date) => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        const startDateStr = formatLocalDate(filterStartDate);
        const endDateStr = formatLocalDate(filterEndDate);
        const isSuperAdmin = currentUser && String(currentUser.role).toLowerCase() === 'superadmin';
        const companyFilter = currentUser && !isSuperAdmin && currentUser.companyId
          ? `&companyId=${currentUser.companyId}` : '';

        const response = await apiFetch(
          `Orders/get_return_summary.php?date_from=${startDateStr}&date_to=${endDateStr}${companyFilter}`
        );
        if (response?.success && response?.summary) {
          setReturnSummary(response.summary);
        } else {
          setReturnSummary(null);
        }
      } catch (error) {
        console.error('Failed to fetch return summary:', error);
        setReturnSummary(null);
      } finally {
        setIsReturnLoading(false);
      }
    };

    fetchReturnSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReport, dateRange, startDate, endDate, currentUser]);

  // Fetch commission summary when commission report is selected
  useEffect(() => {
    if (selectedReport !== 'commission') return;
    const fetchCommSummary = async () => {
      setIsCommLoading(true);
      try {
        const companyId = currentUser?.companyId || 1;
        const sd = commSummaryRange.start.split('T')[0];
        const ed = commSummaryRange.end.split('T')[0];
        const res = await apiFetch(`Commission/get_commission_summary.php?company_id=${companyId}&group_by=${commGroupBy}&start_date=${sd}&end_date=${ed}`);
        // Handle multiple response formats: {ok, data: [...]} or {ok, data: {rows: [...]}} or direct array
        const rawData = res?.data;
        const rows = Array.isArray(rawData) ? rawData
          : Array.isArray(rawData?.rows) ? rawData.rows
          : Array.isArray(res) ? res
          : null;
        if (rows && rows.length > 0) {
          setCommSummaryRows(rows.map((r: any) => ({
            period: r.period,
            incomplete: Number(r.incomplete) || 0,
            pending: Number(r.pending) || 0,
            calculated: Number(r.calculated) || 0,
            total: Number(r.total) || 0,
            total_commission: Number(r.total_commission) || 0,
          })));
        } else {
          console.warn('[CommReport] No rows found in response:', res);
          setCommSummaryRows([]);
        }
      } catch (e) {
        console.error('Failed to fetch commission summary:', e);
        setCommSummaryRows([]);
      } finally {
        setIsCommLoading(false);
      }
    };
    fetchCommSummary();
  }, [selectedReport, commGroupBy, commSummaryRange, currentUser]);

  // Fetch Call History preview
  useEffect(() => {
    if (selectedReport !== 'call-history') return;
    const fetchCallHistoryPreview = async () => {
      setIsCallHistoryPreviewLoading(true);
      try {
        const companyId = currentUser?.companyId || 1;
        const { filterStartDate, filterEndDate } = getDateRange();
        const formatLocalDate = (d: Date) => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        const sd = formatLocalDate(filterStartDate);
        const ed = formatLocalDate(filterEndDate);
        const path = `Reports/export_call_history.php?company_id=${companyId}&start_date=${sd}&end_date=${ed}&format=preview`;
        const res = await apiFetch(path);
        
        if (res && res.data) {
          setCallHistoryPreviewRows(res.data);
        } else {
          setCallHistoryPreviewRows([]);
        }
      } catch (e) {
        console.error('Failed to fetch call history preview:', e);
        setCallHistoryPreviewRows([]);
      } finally {
        setIsCallHistoryPreviewLoading(false);
      }
    };
    fetchCallHistoryPreview();
  }, [selectedReport, dateRange, startDate, endDate, currentUser]);

  // Commission export handler
  const handleCommExportClick = (status: string) => {
    setCommExportStatus(status);
    setIsCommExportModalOpen(true);
  };

  const executeCommExport = async (fileType: 'csv' | 'xlsx') => {
    if (!commExportStatus) return;
    setIsCommExporting(true);
    try {
      const companyId = currentUser?.companyId || 1;
      const sd = commExportRange.start.split('T')[0];
      const ed = commExportRange.end.split('T')[0];
      const path = `Commission/export_commission_orders.php?company_id=${companyId}&status=${commExportStatus}&start_date=${sd}&end_date=${ed}&format=json`;
      const baseUrl = resolveApiBasePath().replace(/\/$/, '');
      const token = localStorage.getItem('authToken') || '';
      
      const response = await fetch(`${baseUrl}/${path}&token=${encodeURIComponent(token)}`);
      if (!response.ok) throw new Error('Network response was not ok');
      const result = await response.json();
      
      if (result.ok && result.data && result.data.length > 0) {
        const statusLabel = commExportStatus === 'all' ? 'all' : commExportStatus;
        const filename = `commission_orders_${statusLabel}_${new Date().toISOString().split('T')[0]}`;
        downloadDataFile(result.data, filename, fileType);
      } else {
        alert(result.error || "ไม่มีข้อมูลสำหรับส่งออก");
      }
    } catch (e) { 
      console.error(e); 
      alert("เกิดข้อผิดพลาดในการส่งออกข้อมูล");
    } finally {
      setIsCommExporting(false);
      setIsCommExportModalOpen(false);
    }
  };

  // Call History export handler
  const [isCallHistoryExportModalOpen, setIsCallHistoryExportModalOpen] = useState(false);
  const handleCallHistoryExportClick = () => {
    setIsCallHistoryExportModalOpen(true);
  };

  const executeCallHistoryExport = async (fileType: 'csv' | 'xlsx') => {
    setIsCallHistoryExporting(true);
    try {
      const companyId = currentUser?.companyId || 1;
      const { filterStartDate, filterEndDate } = getDateRange();
      const formatLocalDate = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      const sd = formatLocalDate(filterStartDate);
      const ed = formatLocalDate(filterEndDate);
      const path = `Reports/export_call_history.php?company_id=${companyId}&start_date=${sd}&end_date=${ed}&format=json`;
      const baseUrl = resolveApiBasePath().replace(/\/$/, '');
      const token = localStorage.getItem('authToken') || '';
      
      const response = await fetch(`${baseUrl}/${path}&token=${encodeURIComponent(token)}`);
      if (!response.ok) throw new Error('Network response was not ok');
      const result = await response.json();
      
      if (result.ok && result.data && result.data.length > 0) {
        const filename = `call_history_${new Date().toISOString().split('T')[0]}`;
        downloadDataFile(result.data, filename, fileType);
      } else {
        alert(result.error || "ไม่มีข้อมูลสำหรับส่งออก");
      }
    } catch (e) { 
      console.error(e); 
      alert("เกิดข้อผิดพลาดในการส่งออกข้อมูล");
    } finally {
      setIsCallHistoryExporting(false);
      setIsCallHistoryExportModalOpen(false);
    }
  };

  // Commission period label helper
  const getCommPeriodLabel = (period: string) => {
    if (commGroupBy === 'month') {
      const [y, m] = period.split('-');
      const months = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      return `${months[parseInt(m)]} ${y}`;
    }
    if (commGroupBy === 'week') {
      const match = period.match(/(\d{4})-W(\d{2})/);
      if (!match) return period;
      const year = parseInt(match[1]);
      const week = parseInt(match[2]);
      const jan4 = new Date(year, 0, 4);
      const dow = jan4.getDay() || 7;
      const mondayW1 = new Date(jan4);
      mondayW1.setDate(jan4.getDate() - dow + 1);
      const monday = new Date(mondayW1);
      monday.setDate(mondayW1.getDate() + (week - 1) * 7);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const pad = (n: number) => String(n).padStart(2, '0');
      const fs = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
      return `${fs(monday)} - ${fs(sunday)}`;
    }
    return period ? new Date(period).toLocaleDateString('th-TH-u-ca-gregory', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
  };

  // State for department filter
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [isTruncated, setIsTruncated] = useState(false);

  // State for order status filter (multi-select)
  const [selectedOrderStatuses, setSelectedOrderStatuses] = useState<string[]>([]);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  // Available order statuses
  const orderStatusOptions = [
    { value: 'Pending', label: 'รอดำเนินการ' },
    { value: 'Confirmed', label: 'ยืนยันแล้ว' },
    { value: 'Picking', label: 'กำลังจัดเตรียม' },
    { value: 'Shipping', label: 'กำลังจัดส่ง' },
    { value: 'Delivered', label: 'จัดส่งสำเร็จ' },
    { value: 'Cancelled', label: 'ยกเลิก' },
    { value: 'Returned', label: 'ตีกลับ' }
  ];

  // Get available departments from current orders (only departments with orders)
  const availableDepartments = useMemo(() => {
    const deptSet = new Set<string>();
    fetchedOrders.forEach(order => {
      const creator = users.find(u => u.id === order.creatorId);
      if (creator?.role) {
        deptSet.add(creator.role);
      }
    });
    return Array.from(deptSet).sort();
  }, [fetchedOrders, users]);

  // Toggle department selection
  const toggleDepartment = (dept: string) => {
    setSelectedDepartments(prev => {
      if (prev.includes(dept)) {
        return prev.filter(d => d !== dept);
      } else {
        return [...prev, dept];
      }
    });
  };

  // Select/deselect all departments
  const selectAllDepartments = () => {
    if (selectedDepartments.length === availableDepartments.length) {
      setSelectedDepartments([]); // Deselect all
    } else {
      setSelectedDepartments([...availableDepartments]); // Select all
    }
  };

  // Filter orders by selected departments and order statuses
  const orders = useMemo(() => {
    let filtered = fetchedOrders;

    // Filter by department
    if (selectedDepartments.length > 0) {
      filtered = filtered.filter(order => {
        const creator = users.find(u => u.id === order.creatorId);
        return creator?.role && selectedDepartments.includes(creator.role);
      });
    }

    // Filter by order status
    if (selectedOrderStatuses.length > 0) {
      filtered = filtered.filter(order =>
        selectedOrderStatuses.includes(order.orderStatus || 'Pending')
      );
    }

    return filtered;
  }, [fetchedOrders, selectedDepartments, selectedOrderStatuses, users]);

  const allCustomers = fetchedCustomers.length > 0 ? fetchedCustomers : customers;

  // คำนวณข้อมูลสำหรับแต่ละรายงาน
  const reportData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let filterStartDate = new Date(today);
    let filterEndDate = new Date(today);
    filterEndDate.setHours(23, 59, 59, 999);

    switch (dateRange) {
      case 'today':
        break;
      case 'week':
        filterStartDate.setDate(today.getDate() - 7);
        break;
      case 'month':
        filterStartDate.setMonth(today.getMonth() - 1);
        break;
      case 'this-month':
        // เดือนนี้: วันที่ 1 ของเดือนปัจจุบัน ถึง วันนี้
        filterStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'last-month':
        // เดือนที่แล้ว: วันที่ 1 ถึง วันสุดท้ายของเดือนที่แล้ว
        filterStartDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        filterEndDate = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
        break;
      case 'year':
        filterStartDate.setFullYear(today.getFullYear() - 1);
        break;
      case 'custom':
        if (startDate) filterStartDate = new Date(startDate);
        if (endDate) {
          filterEndDate = new Date(endDate);
          filterEndDate.setHours(23, 59, 59, 999);
        }
        break;
    }

    // ฟิลเตอร์ออเดอร์ตามวันที่
    const filteredOrders = orders.filter(order => {
      const orderDate = new Date(order.orderDate);
      return orderDate >= filterStartDate && orderDate <= filterEndDate;
    });

    // รายงานสต๊อคคงเหลือ
    const stockReport = warehouseStock.map(stock => {
      const product = products.find(p => p.id === stock.productId);
      return {
        productId: stock.productId,
        productName: product?.name || 'N/A',
        productCode: product?.code || 'N/A',
        warehouseId: stock.warehouseId,
        quantity: stock.quantity,
        reservedQuantity: stock.reservedQuantity,
        availableQuantity: stock.availableQuantity,
        sellingPrice: stock.sellingPrice || 0,
        totalValue: (stock.sellingPrice || 0) * stock.quantity,
        lotNumber: stock.lotNumber,
        expiryDate: stock.expiryDate
      };
    });

    // รายงานสต๊อคคงคลัง-Lot (แยกตาม Lot)
    const lotStockReport = productLots.map(lot => {
      return {
        'คลังสินค้า': lot.warehouseName || 'N/A',
        'รหัสสินค้า': lot.productCode || 'N/A',
        'ชื่อสินค้า': lot.productName || 'N/A',
        'หมายเลข Lot': lot.lotNumber || 'N/A',
        'วันที่รับเข้า': lot.purchaseDate ? new Date(lot.purchaseDate).toLocaleDateString('th-TH-u-ca-gregory') : '-',
        'วันหมดอายุ': lot.expiryDate ? new Date(lot.expiryDate).toLocaleDateString('th-TH-u-ca-gregory') : '-',
        'จำนวนที่รับ': lot.quantityReceived || 0,
        'จำนวนคงเหลือ': lot.quantityRemaining || 0,
        'ราคาต้นทุน/หน่วย': `฿${(lot.unitCost || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
        'มูลค่ารวม': `฿${((lot.quantityRemaining || 0) * (lot.unitCost || 0)).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
        'สถานะ': lot.status || 'N/A',
        'Invoice': lot.supplierInvoice || '-',
        'หมายเหตุ': lot.notes || '-'
      };
    });

    // รายงานออเดอร์แบบละเอียด (Raw Data - Order Items Level)
    const ordersRawReport: any[] = [];
    filteredOrders.forEach(order => {
      // Match customer by pk (customer_id) or id (string)
      const customer = allCustomers.find(c => {
        if (c.pk && typeof order.customerId === 'number') {
          return c.pk === order.customerId;
        }
        return String(c.id) === String(order.customerId) ||
          String(c.pk) === String(order.customerId);
      });

      // ฟังก์ชันช่วยดึงข้อมูล - ใช้ข้อมูลจาก order.shippingAddress ก่อน แล้วค่อย fallback ไป order.customerInfo แล้วค่อย customer
      const getCustomerName = () => {
        // Try from customer first
        if (customer) {
          const fullName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
          if (fullName) return fullName;
        }
        // Fallback to order.customerInfo
        if (order.customerInfo) {
          const fullName = `${order.customerInfo.firstName || ''} ${order.customerInfo.lastName || ''}`.trim();
          if (fullName) return fullName;
        }
        // Fallback to shippingAddress recipient
        if (order.shippingAddress?.recipientFirstName || order.shippingAddress?.recipientLastName) {
          return `${order.shippingAddress.recipientFirstName || ''} ${order.shippingAddress.recipientLastName || ''}`.trim() || '-';
        }
        return '-';
      };

      const getAddress = () => {
        return order.shippingAddress?.street ||
          customer?.address?.street ||
          '-';
      };

      const getSubdistrict = () => {
        return order.shippingAddress?.subdistrict ||
          customer?.address?.subdistrict ||
          '-';
      };

      const getDistrict = () => {
        return order.shippingAddress?.district ||
          customer?.address?.district ||
          '-';
      };

      const getProvince = () => {
        return order.shippingAddress?.province ||
          customer?.address?.province ||
          customer?.province ||
          '-';
      };

      const getPostalCode = () => {
        return order.shippingAddress?.postalCode ||
          customer?.address?.postalCode ||
          '-';
      };

      const getTrackingNumber = () => {
        if (order.trackingNumbers && order.trackingNumbers.length > 0) {
          return order.trackingNumbers.join(', ');
        }
        return '-';
      };

      const getRegion = (province: string): string => {
        const regionMap: { [key: string]: string } = {
          // ภาคกลาง (Central)
          'กรุงเทพมหานคร': 'ภาคกลาง',
          'นนทบุรี': 'ภาคกลาง',
          'ปทุมธานี': 'ภาคกลาง',
          'สมุทรปราการ': 'ภาคกลาง',
          'สมุทรสาคร': 'ภาคกลาง',
          'นครปฐม': 'ภาคกลาง',
          'อยุธยา': 'ภาคกลาง',
          'พระนครศรีอยุธยา': 'ภาคกลาง',
          'อ่างทอง': 'ภาคกลาง',
          'ลพบุรี': 'ภาคกลาง',
          'สิงห์บุรี': 'ภาคกลาง',
          'ชัยนาท': 'ภาคกลาง',
          'สระบุรี': 'ภาคกลาง',
          'นครนายก': 'ภาคกลาง',
          'สุพรรณบุรี': 'ภาคกลาง',
          'สมุทรสงคราม': 'ภาคกลาง',

          // ภาคเหนือ (North)
          'เชียงใหม่': 'ภาคเหนือ',
          'เชียงราย': 'ภาคเหนือ',
          'ลำปาง': 'ภาคเหนือ',
          'ลำพูน': 'ภาคเหนือ',
          'แม่ฮ่องสอน': 'ภาคเหนือ',
          'แพร่': 'ภาคเหนือ',
          'น่าน': 'ภาคเหนือ',
          'พะเยา': 'ภาคเหนือ',
          'อุตรดิตถ์': 'ภาคเหนือ',
          'ตาก': 'ภาคเหนือ',
          'สุโขทัย': 'ภาคเหนือ',
          'พิษณุโลก': 'ภาคเหนือ',
          'พิจิตร': 'ภาคเหนือ',
          'กำแพงเพชร': 'ภาคเหนือ',
          'เพชรบูรณ์': 'ภาคเหนือ',
          'นครสวรรค์': 'ภาคเหนือ',
          'อุทัยธานี': 'ภาคเหนือ',

          // ภาคตะวันออกเฉียงเหนือ (Northeast/Isan)
          'ขอนแก่น': 'ภาคตะวันออกเฉียงเหนือ',
          'อุดรธานี': 'ภาคตะวันออกเฉียงเหนือ',
          'นครราชสีมา': 'ภาคตะวันออกเฉียงเหนือ',
          'อุบลราชธานี': 'ภาคตะวันออกเฉียงเหนือ',
          'ศรีสะเกษ': 'ภาคตะวันออกเฉียงเหนือ',
          'สุรินทร์': 'ภาคตะวันออกเฉียงเหนือ',
          'บุรีรัมย์': 'ภาคตะวันออกเฉียงเหนือ',
          'ร้อยเอ็ด': 'ภาคตะวันออกเฉียงเหนือ',
          'มหาสารคาม': 'ภาคตะวันออกเฉียงเหนือ',
          'กาฬสินธุ์': 'ภาคตะวันออกเฉียงเหนือ',
          'สกลนคร': 'ภาคตะวันออกเฉียงเหนือ',
          'นครพนม': 'ภาคตะวันออกเฉียงเหนือ',
          'มุกดาหาร': 'ภาคตะวันออกเฉียงเหนือ',
          'เลย': 'ภาคตะวันออกเฉียงเหนือ',
          'หนองคาย': 'ภาคตะวันออกเฉียงเหนือ',
          'หนองบัวลำภู': 'ภาคตะวันออกเฉียงเหนือ',
          'ยโสธร': 'ภาคตะวันออกเฉียงเหนือ',
          'อำนาจเจริญ': 'ภาคตะวันออกเฉียงเหนือ',
          'ชัยภูมิ': 'ภาคตะวันออกเฉียงเหนือ',
          'บึงกาฬ': 'ภาคตะวันออกเฉียงเหนือ',

          // ภาคตะวันออก (East)
          'ชลบุรี': 'ภาคตะวันออก',
          'ระยอง': 'ภาคตะวันออก',
          'จันทบุรี': 'ภาคตะวันออก',
          'ตราด': 'ภาคตะวันออก',
          'ปราจีนบุรี': 'ภาคตะวันออก',
          'สระแก้ว': 'ภาคตะวันออก',
          'ฉะเชิงเทรา': 'ภาคตะวันออก',

          // ภาคตะวันตก (West)
          'ราชบุรี': 'ภาคตะวันตก',
          'กาญจนบุรี': 'ภาคตะวันตก',
          'เพชรบุรี': 'ภาคตะวันตก',
          'ประจวบคีรีขันธ์': 'ภาคตะวันตก',

          // ภาคใต้ (South)
          'ภูเก็ต': 'ภาคใต้',
          'สุราษฎร์ธานี': 'ภาคใต้',
          'กระบี่': 'ภาคใต้',
          'นครศรีธรรมราช': 'ภาคใต้',
          'สงขลา': 'ภาคใต้',
          'ตรัง': 'ภาคใต้',
          'พัทลุง': 'ภาคใต้',
          'สตูล': 'ภาคใต้',
          'ชุมพร': 'ภาคใต้',
          'ระนอง': 'ภาคใต้',
          'พังงา': 'ภาคใต้',
          'ปัตตานี': 'ภาคใต้',
          'ยะลา': 'ภาคใต้',
          'นราธิวาส': 'ภาคใต้',
        };
        return regionMap[province] || 'ไม่ทราบภาค';
      };

      const getOrderStatusThai = (status: string, orderId?: string, boxNumber?: number): string => {
        const statusMap: { [key: string]: string } = {
          'Pending': 'รอดำเนินการ',
          'Confirmed': 'ยืนยันแล้ว',
          'Picking': 'กำลังจัดเตรียม',
          'Preparing': 'กำลังจัดเตรียมสินค้า',
          'Shipping': 'กำลังจัดส่ง',
          'Delivered': 'จัดส่งสำเร็จ',
          'Cancelled': 'ยกเลิก',
          'Returned': 'ตีกลับ',
          'Claiming': 'รอเคลม',
          'BadDebt': 'หนี้สูญ',
          'PreApproved': 'รออนุมัติ'
        };
        const base = statusMap[status] || status;

        // Enrich with box return_status for returned orders
        if (status === 'Returned' && orderId && boxNumber !== undefined) {
          const key = `${orderId}-${boxNumber}`;
          const returnStatus = orderBoxesMap[key];
          const returnStatusThai: { [key: string]: string } = {
            returning: 'กำลังตีกลับ',
            returned: 'สภาพดี',
            good: 'สภาพดี',
            damaged: 'ชำรุด',
            lost: 'ตีกลับสูญหาย'
          };
          const statusText = returnStatus
            ? (returnStatusThai[returnStatus] || returnStatus)
            : 'ไม่ถูกตีกลับ';
          return `ตีกลับ (กล่อง ${boxNumber} : ${statusText})`;
        }

        return base;
      };

      // Helper functions for new columns
      const getSeller = (itemCreatorId?: number) => {
        const creatorId = itemCreatorId ?? order.creatorId;
        const creator = users.find(u => u.id === creatorId);
        if (creator) {
          return `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.username || '-';
        }
        return '-';
      };

      const getSellerRole = (itemCreatorId?: number) => {
        const creatorId = itemCreatorId ?? order.creatorId;
        const creator = users.find(u => u.id === creatorId);
        return creator?.role || '-';
      };

      const getDeliveryDate = () => {
        if (order.deliveryDate) {
          return new Date(order.deliveryDate).toLocaleDateString('th-TH-u-ca-gregory');
        }
        return '-';
      };

      const getSalesChannel = () => {
        return order.salesChannel || '-';
      };

      const getPageName = () => {
        if (order.salesChannelPageId) {
          const page = pages.find(p => p.id === order.salesChannelPageId);
          return page?.name || '-';
        }
        return '-';
      };

      const getPaymentMethodThai = () => {
        const methodMap: { [key: string]: string } = {
          'COD': 'เก็บเงินปลายทาง',
          'Transfer': 'โอนเงิน',
          'PayAfter': 'จ่ายทีหลัง',
          'Claim': 'เคลม',
          'FreeGift': 'ของแถม'
        };
        return methodMap[order.paymentMethod] || order.paymentMethod || '-';
      };

      const getCustomerPhone = () => {
        // ใช้ customerPhone จาก order ก่อน (ที่ API ส่งมาจาก customer join)
        return (order as any).customerPhone || customer?.phone || order.customerInfo?.phone || order.shippingAddress?.phone || '-';
      };

      const getAirportDeliveryDate = () => {
        const airportDate = (order as any).airportDeliveryDate;
        if (airportDate) {
          return new Date(airportDate).toLocaleDateString('th-TH-u-ca-gregory');
        }
        return '-';
      };

      const getCustomerType = () => {
        // Get the customer type value
        let customerType = order.customerType || customer?.lifecycleStatus || '-';

        // Translate to Thai
        const customerTypeTranslations: { [key: string]: string } = {
          'New Customer': 'ลูกค้าใหม่',
          'Reorder Customer': 'ลูกค้ารีออเดอร์',
          'Reorder': 'ลูกค้ารีออเดอร์'
        };

        return customerTypeTranslations[customerType] || customerType;
      };

      const getPaymentComparisonStatus = () => {
        const paid = (order as any).amountPaid || 0;
        const total = order.totalAmount || 0;
        if (total === 0) return 'ไม่มียอด';
        if (paid === 0) return 'ค้าง';
        if (paid === total) return 'ตรง';
        if (paid < total) return 'ขาด';
        return 'เกิน';
      };

      if (order.items && order.items.length > 0) {
        // มี items - แสดงแต่ละรายการ
        order.items.forEach(item => {
          // Promotion handling: parent row shows 0, child rows show promo price_override amounts
          const isPromoParent = !!(item as any).isPromotionParent;
          const isPromoChild = !!(item as any).parentItemId;
          const qty = item.quantity || 0;
          const netTotal = (item as any).netTotal || 0;
          const retailPrice = item.pricePerUnit || 0;

          // Calculate effective discount and item total based on item type
          let effectiveDiscount: number;
          let itemTotal: number;

          if (isPromoParent) {
            effectiveDiscount = 0;
            itemTotal = 0;
          } else if (isPromoChild) {
            // net_total = price_override from promotion_items table
            const retailTotal = qty * retailPrice;
            effectiveDiscount = retailTotal - netTotal;
            itemTotal = netTotal;
          } else if (item.isFreebie) {
            effectiveDiscount = item.discount || 0;
            itemTotal = 0;
          } else {
            effectiveDiscount = item.discount || 0;
            const calculatedTotal = (retailPrice * qty) - effectiveDiscount;
            itemTotal = calculatedTotal > 0 ? calculatedTotal : netTotal;
          }

          // กำหนด รหัสสินค้า/โปร
          let productCode = '-';
          if (item.isPromotionParent) {
            // รายการแม่ของโปรโมชั่น - แสดงรหัสโปรโมชั่น
            productCode = item.promotionId ? `PROMO-${String(item.promotionId).padStart(3, '0')}` : '-';
          } else if (item.promotionId) {
            // รายการย่อยของโปรโมชั่น (สินค้าในชุด/ของแถม) - แสดงรหัสโปรโมชั่น
            productCode = `PROMO-${String(item.promotionId).padStart(3, '0')}`;
          } else if ((item as any).productSku) {
            // สินค้าเดี่ยวที่มี SKU
            productCode = (item as any).productSku;
          } else if (item.productId) {
            // Fallback: หา product จาก products array
            const product = products.find(p => p.id === item.productId);
            productCode = product?.sku || '-';
          }

          // ดึง category จาก item (API ส่งมาจาก products table โดยตรง รวม inactive)
          const productForCategory = products.find(p => p.id === item.productId);
          const productCategory = (item as any).productCategory || productForCategory?.category || '-';
          const productReportCategory = (item as any).productReportCategory || (productForCategory as any)?.report_category || '-';

          // กำหนดชื่อสินค้าและชื่อโปร
          let productName = item.productName || '-';
          let promoName = '-';

          if (item.isPromotionParent) {
            // รายการแม่ของโปรโมชั่น - ชื่อโปรเป็นชื่อสินค้า
            promoName = item.productName || '-';
            productName = `📦 ${item.productName}` || '-';
          } else if (item.promotionId && item.parentItemId) {
            // รายการย่อยของโปรโมชั่น - หาชื่อโปรจาก parent
            const parentItem = order.items.find(i => i.id === item.parentItemId);
            promoName = parentItem?.productName || '-';
            // เพิ่ม (ของแถม) ถ้าเป็น freebie
            productName = item.isFreebie ? `${item.productName} (ของแถม)` : item.productName;
          }

          ordersRawReport.push({
            'วันที่สั่งซื้อ': new Date(order.orderDate).toLocaleDateString('th-TH-u-ca-gregory'),
            'เลขคำสั่งซื้อ': order.id,
            'user_id': item.creatorId ?? order.creatorId ?? '',
            'ผู้ขาย': getSeller(item.creatorId),
            'แผนก': getSellerRole(item.creatorId),
            'ชื่อลูกค้า': getCustomerName(),
            'เบอร์โทรลูกค้า': getCustomerPhone(),
            'ประเภทลูกค้า': getCustomerType(),
            'วันที่จัดส่ง': getDeliveryDate(),
            'ช่องทางสั่งซื้อ': getSalesChannel(),
            'เพจ': getPageName(),
            'ช่องทางการชำระ': getPaymentMethodThai(),
            'ที่อยู่': getAddress(),
            'ตำบล': getSubdistrict(),
            'อำเภอ': getDistrict(),
            'จังหวัด': getProvince(),
            'รหัสไปรษณีย์': getPostalCode(),
            'ภาค': getRegion(getProvince()),
            'รหัสสินค้า/โปร': productCode,
            'สินค้า': productName,
            'ประเภทสินค้า': productCategory,
            'ประเภทสินค้า (รีพอร์ต)': productReportCategory,
            'ชื่อโปร': promoName,
            'ของแถม': item.isFreebie ? 'ใช่' : 'ไม่',
            'จำนวน (ชิ้น)': item.quantity || 0,
            'ราคาต่อหน่วย': `฿${(isPromoParent ? 0 : retailPrice).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            'ส่วนลด': `฿${effectiveDiscount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            'ยอดรวมรายการ': (item.isFreebie || isPromoParent) ? 0 : `฿${itemTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            'ค่าจัดส่ง (ต่อบิล)': `฿${(order.shippingCost || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            'ส่วนลดท้ายบิล': `฿${(order.billDiscount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            'ยอดรวมทั้งบิล': `฿${(order.totalAmount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            'หมายเลขกล่อง': String(item.boxNumber || 1),
            'หมายเลขติดตาม': getTrackingNumber(),
            'วันที่จัดส่ง Airport': getAirportDeliveryDate(),
            'สถานะจาก Airport': (order as any).airportDeliveryStatus || '-',
            'สถานะออเดอร์': getOrderStatusThai(order.orderStatus || '', order.id, item.boxNumber || 1),
            'สถานะการชำระเงิน': getPaymentComparisonStatus(),
            'สถานะสลิป': (order.slips && order.slips.length > 0) ? `อัปโหลดแล้ว (${order.slips.length})` : (order.slipUrl ? 'อัปโหลดแล้ว' : 'ยังไม่อัปโหลด'),
            'วันที่รับเงิน': (order as any).paymentReceivedDate ? new Date((order as any).paymentReceivedDate).toLocaleDateString('th-TH-u-ca-gregory') : '-',
            'ตะกร้าขาย': (item as any).basketKeyAtSale || '-'
          });
        });
      } else {
        // ไม่มี items - แสดงแถวเดียวจากออเดอร์หลัก
        ordersRawReport.push({
          'วันที่สั่งซื้อ': new Date(order.orderDate).toLocaleDateString('th-TH-u-ca-gregory'),
          'เลขคำสั่งซื้อ': order.id,
          'user_id': order.creatorId ?? '',
          'ผู้ขาย': getSeller(),
          'แผนก': getSellerRole(),
          'ชื่อลูกค้า': getCustomerName(),
          'เบอร์โทรลูกค้า': getCustomerPhone(),
          'ประเภทลูกค้า': getCustomerType(),
          'วันที่จัดส่ง': getDeliveryDate(),
          'ช่องทางสั่งซื้อ': getSalesChannel(),
          'เพจ': getPageName(),
          'ช่องทางการชำระ': getPaymentMethodThai(),
          'ที่อยู่': getAddress(),
          'ตำบล': getSubdistrict(),
          'อำเภอ': getDistrict(),
          'จังหวัด': getProvince(),
          'รหัสไปรษณีย์': getPostalCode(),
          'ภาค': getRegion(getProvince()),
          'รหัสสินค้า/โปร': '-',
          'สินค้า': '-',
          'ประเภทสินค้า': '-',
          'ประเภทสินค้า (รีพอร์ต)': '-',
          'ชื่อโปร': '-',
          'ของแถม': 'ไม่',
          'จำนวน (ชิ้น)': 0,
          'ราคาต่อหน่วย': `฿0.00`,
          'ส่วนลด': `฿0.00`,
          'ยอดรวมรายการ': `฿${(order.totalAmount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          'ค่าจัดส่ง (ต่อบิล)': `฿${(order.shippingCost || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          'ส่วนลดท้ายบิล': `฿${(order.billDiscount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          'ยอดรวมทั้งบิล': `฿${(order.totalAmount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          'หมายเลขกล่อง': '0',
          'หมายเลขติดตาม': getTrackingNumber(),
          'วันที่จัดส่ง Airport': getAirportDeliveryDate(),
          'สถานะจาก Airport': (order as any).airportDeliveryStatus || '-',
          'สถานะออเดอร์': getOrderStatusThai(order.orderStatus || ''),
          'สถานะการชำระเงิน': getPaymentComparisonStatus(),
          'สถานะสลิป': (order.slips && order.slips.length > 0) ? `อัปโหลดแล้ว (${order.slips.length})` : (order.slipUrl ? 'อัปโหลดแล้ว' : 'ยังไม่อัปโหลด'),
          'วันที่รับเงิน': (order as any).paymentReceivedDate ? new Date((order as any).paymentReceivedDate).toLocaleDateString('th-TH-u-ca-gregory') : '-',
          'ตะกร้าขาย': '-'
        });
      }
    });

    // รายงานลูกค้า
    const customersWithOrders = allCustomers.map(customer => {
      const customerOrders = filteredOrders
        .filter(o => o.customerId === customer.id)
        .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());

      const totalSpent = customerOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      const lastOrder = customerOrders.length > 0
        ? customerOrders[customerOrders.length - 1].orderDate
        : null;
      const grade = calculateCustomerGrade(totalSpent);

      return {
        'ชื่อลูกค้า': getCustomerDisplayName(customer),
        'เบอร์โทร': customer.phone || '-',
        'จำนวนออเดอร์': customerOrders.length,
        'ยอดซื้อรวม (บาท)': `฿${totalSpent.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        'วันที่ออเดอร์ล่าสุด': lastOrder ? new Date(lastOrder).toLocaleDateString('th-TH-u-ca-gregory') : '-',
        'เกรดลูกค้า': grade,
        'สถานะลูกค้า': customer.lifecycleStatus || '-'
      };
    }).filter(c => c['จำนวนออเดอร์'] > 0);

    return {
      ordersRaw: ordersRawReport,
      stock: stockReport,
      lotStock: lotStockReport,
      customers: customersWithOrders
    };
  }, [orders, allCustomers, products, warehouseStock, stockMovements, productLots, dateRange, startDate, endDate, orderBoxesMap]);

  // (local downloadCSV removed, using downloadDataFile instead)

  const handleExportClick = () => {
    if (!selectedReport) return;
    setIsExportModalOpen(true);
  };

  const executeExport = async (type: 'csv' | 'xlsx') => {
    if (!selectedReport) return;
    setIsExportModalOpen(false);

    // For return-summary, fetch CSV from export_return_orders API
    if (selectedReport === 'return-summary') {
      setIsExporting(true);
      try {
        const { filterStartDate, filterEndDate } = getDateRange();
        const startDateStr = filterStartDate.toISOString().split('T')[0];
        const endDateStr = filterEndDate.toISOString().split('T')[0];
        const isSuperAdmin = currentUser && String(currentUser.role).toLowerCase() === 'superadmin';
        const companyFilter = currentUser && !isSuperAdmin && currentUser.companyId
          ? `&companyId=${currentUser.companyId}` : '';

        const response = await apiFetch(
          `Orders/export_return_orders.php?date_from=${startDateStr}&date_to=${endDateStr}${companyFilter}`
        );
        const rows = response?.data || [];

        if (rows.length === 0) {
          alert('ไม่มีข้อมูลตีกลับในช่วงวันที่ที่เลือก');
          return;
        }

        const statusThai: { [key: string]: string } = {
          returning: 'กำลังตีกลับ', returned: 'สภาพดี',
          good: 'สภาพดี', damaged: 'ชำรุด', lost: 'ตีกลับสูญหาย'
        };

        // Group rows by order_id + box_number to determine first-row-of-group
        let lastGroupKey = '';
        const csvRows = rows.map((r: any) => {
          const groupKey = `${r.order_id}-${r.box_number}`;
          const isFirstRow = groupKey !== lastGroupKey;
          lastGroupKey = groupKey;

          // Item-level seller (from order_items.creator_id)
          const itemSeller = (r.item_creator_first_name || r.item_creator_last_name)
            ? `${r.item_creator_first_name || ''} ${r.item_creator_last_name || ''}`.trim()
            : `${r.seller_first_name || ''} ${r.seller_last_name || ''}`.trim() || '-';

          return {
            'Order ID': isFirstRow ? (r.order_id || '') : '',
            'Sub Order ID': isFirstRow ? (r.sub_order_id || '') : '',
            'วันที่สั่งซื้อ': isFirstRow ? (r.order_date ? new Date(r.order_date).toLocaleDateString('th-TH-u-ca-gregory') : '-') : '',
            'ชื่อลูกค้า': isFirstRow ? (`${r.customer_first_name || ''} ${r.customer_last_name || ''}`.trim() || '-') : '',
            'เบอร์โทร': isFirstRow ? (r.customer_phone || '-') : '',
            'ที่อยู่': isFirstRow ? (r.shipping_street || '-') : '',
            'แขวง/ตำบล': isFirstRow ? (r.shipping_subdistrict || '-') : '',
            'เขต/อำเภอ': isFirstRow ? (r.shipping_district || '-') : '',
            'จังหวัด': isFirstRow ? (r.shipping_province || '-') : '',
            'รหัสไปรษณีย์': isFirstRow ? (r.shipping_postal_code || '-') : '',
            'Tracking No.': isFirstRow ? (r.tracking_number || '-') : '',
            'สถานะตีกลับ': statusThai[r.return_status] || r.return_status || '-',
            'หมายเหตุ': isFirstRow ? (r.return_note || '-') : '',
            'ยืนยันจบเคส': isFirstRow ? (Number(r.return_complete) === 1 ? 'จบเคส' : '-') : '',
            'ค่าเคลม': isFirstRow ? (r.return_claim != null && Number(r.return_claim) > 0 ? Number(r.return_claim) : '-') : '',
            'ราคากล่อง': isFirstRow ? (r.cod_amount || 0) : '',
            'ยอดเก็บได้': isFirstRow ? (r.collection_amount || 0) : '',
            'ชื่อสินค้า': r.item_product_name || '-',
            'จำนวน': r.item_quantity || 0,
            'ผู้ขาย': itemSeller,
            'วันที่บันทึก': isFirstRow ? (r.return_created_at ? new Date(r.return_created_at).toLocaleDateString('th-TH-u-ca-gregory') : '-') : '',
            'ช่องทางชำระ': isFirstRow ? (r.payment_method || '-') : '',
          };
        });

        downloadDataFile(csvRows, `return-report_${startDateStr}_${endDateStr}`, type);
      } catch (error) {
        console.error('Failed to export return data:', error);
        alert('ไม่สามารถดาวน์โหลดรายงานได้ กรุณาลองใหม่');
      } finally {
        setIsExporting(false);
      }
      return;
    }

    // For orders-raw, fetch data from API with date filter
    if (selectedReport === 'orders-raw') {
      setIsExporting(true);
      try {
        // Calculate date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let filterStartDate = new Date(today);
        let filterEndDate = new Date(today);
        filterEndDate.setHours(23, 59, 59, 999);

        switch (dateRange) {
          case 'today':
            break;
          case 'week':
            filterStartDate.setDate(today.getDate() - 7);
            break;
          case 'month':
            filterStartDate.setMonth(today.getMonth() - 1);
            break;
          case 'this-month':
            filterStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
            break;
          case 'last-month':
            filterStartDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            filterEndDate = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
            break;
          case 'year':
            filterStartDate.setFullYear(today.getFullYear() - 1);
            break;
          case 'custom':
            if (startDate) filterStartDate = new Date(startDate);
            if (endDate) {
              filterEndDate = new Date(endDate);
              filterEndDate.setHours(23, 59, 59, 999);
            }
            break;
        }

        // Build API query with date filter
        const isSuperAdmin = currentUser && String(currentUser.role).toLowerCase() === 'superadmin';
        const companyFilter = currentUser && !isSuperAdmin && currentUser.companyId
          ? `&companyId=${currentUser.companyId}`
          : '';
        // Use local date format to avoid timezone issues (toISOString converts to UTC)
        const formatLocalDate = (d: Date) => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        const startDateStr = formatLocalDate(filterStartDate);
        const endDateStr = formatLocalDate(filterEndDate);


        // Fetch orders with date filter (pageSize=15000 to match main fetch, avoid pagination truncation)
        const ordersResponse = await apiFetch(`orders?pageSize=15000${companyFilter}&orderDateStart=${startDateStr}&orderDateEnd=${endDateStr}`);
        const ordersData = Array.isArray(ordersResponse)
          ? ordersResponse
          : (ordersResponse?.orders || ordersResponse?.data || []);

        // Fetch customers for matching (smaller request)
        let customersData: any[] = [];
        try {
          const customersResponse = await apiFetch(`customers?pageSize=5000${companyFilter}`);
          customersData = Array.isArray(customersResponse)
            ? customersResponse
            : (customersResponse?.customers || customersResponse?.data || []);
        } catch {
          console.warn('Could not fetch customers for export');
        }

        // Fetch order_boxes for returned orders (to get return_status per box)
        const exportBoxMap: Record<string, string | null> = {};
        try {
          const returnedIds = ordersData
            .filter((r: any) => !/-\d+$/.test(String(r.id || "")) && r.order_status === 'Returned')
            .map((r: any) => r.id);
          if (returnedIds.length > 0) {
            for (let i = 0; i < returnedIds.length; i += 100) {
              const chunk = returnedIds.slice(i, i + 100);
              const idsParam = chunk.join(',');
              const boxRes = await apiFetch(`Orders/get_order_boxes.php?order_ids=${encodeURIComponent(idsParam)}`);
              const boxes = boxRes?.boxes || boxRes?.data || [];
              boxes.forEach((b: any) => {
                exportBoxMap[`${b.order_id}-${b.box_number}`] = b.return_status || null;
              });
            }
          }
        } catch (err) {
          console.warn('Could not fetch order boxes for export:', err);
        }

        // Helper function to get region from province
        const getRegionFromProvince = (province: string): string => {
          const regionMap: { [key: string]: string } = {
            'กรุงเทพมหานคร': 'ภาคกลาง',
            'นนทบุรี': 'ภาคกลาง',
            'ปทุมธานี': 'ภาคกลาง',
            'สมุทรปราการ': 'ภาคกลาง',
            'สมุทรสาคร': 'ภาคกลาง',
            'นครปฐม': 'ภาคกลาง',
            'อยุธยา': 'ภาคกลาง',
            'พระนครศรีอยุธยา': 'ภาคกลาง',
            'อ่างทอง': 'ภาคกลาง',
            'ลพบุรี': 'ภาคกลาง',
            'สิงห์บุรี': 'ภาคกลาง',
            'ชัยนาท': 'ภาคกลาง',
            'สระบุรี': 'ภาคกลาง',
            'นครนายก': 'ภาคกลาง',
            'ราชบุรี': 'ภาคตะวันตก',
            'กาญจนบุรี': 'ภาคตะวันตก',
            'สุพรรณบุรี': 'ภาคกลาง',
            'สมุทรสงคราม': 'ภาคกลาง',
            'เพชรบุรี': 'ภาคตะวันตก',
            'ประจวบคีรีขันธ์': 'ภาคตะวันตก',
            'เชียงใหม่': 'ภาคเหนือ',
            'เชียงราย': 'ภาคเหนือ',
            'ลำปาง': 'ภาคเหนือ',
            'ลำพูน': 'ภาคเหนือ',
            'แม่ฮ่องสอน': 'ภาคเหนือ',
            'แพร่': 'ภาคเหนือ',
            'น่าน': 'ภาคเหนือ',
            'พะเยา': 'ภาคเหนือ',
            'อุตรดิตถ์': 'ภาคเหนือ',
            'ตาก': 'ภาคเหนือ',
            'สุโขทัย': 'ภาคเหนือ',
            'พิษณุโลก': 'ภาคเหนือ',
            'พิจิตร': 'ภาคเหนือ',
            'กำแพงเพชร': 'ภาคเหนือ',
            'เพชรบูรณ์': 'ภาคเหนือ',
            'นครสวรรค์': 'ภาคเหนือ',
            'อุทัยธานี': 'ภาคเหนือ',
            'ขอนแก่น': 'ภาคอีสาน',
            'อุดรธานี': 'ภาคอีสาน',
            'นครราชสีมา': 'ภาคอีสาน',
            'อุบลราชธานี': 'ภาคอีสาน',
            'ศรีสะเกษ': 'ภาคอีสาน',
            'สุรินทร์': 'ภาคอีสาน',
            'บุรีรัมย์': 'ภาคอีสาน',
            'ร้อยเอ็ด': 'ภาคอีสาน',
            'มหาสารคาม': 'ภาคอีสาน',
            'กาฬสินธุ์': 'ภาคอีสาน',
            'สกลนคร': 'ภาคอีสาน',
            'นครพนม': 'ภาคอีสาน',
            'มุกดาหาร': 'ภาคอีสาน',
            'เลย': 'ภาคอีสาน',
            'หนองคาย': 'ภาคอีสาน',
            'หนองบัวลำภู': 'ภาคอีสาน',
            'ยโสธร': 'ภาคอีสาน',
            'อำนาจเจริญ': 'ภาคอีสาน',
            'ชัยภูมิ': 'ภาคอีสาน',
            'บึงกาฬ': 'ภาคอีสาน',
            'ชลบุรี': 'ภาคตะวันออก',
            'ระยอง': 'ภาคตะวันออก',
            'จันทบุรี': 'ภาคตะวันออก',
            'ตราด': 'ภาคตะวันออก',
            'ปราจีนบุรี': 'ภาคตะวันออก',
            'สระแก้ว': 'ภาคตะวันออก',
            'ฉะเชิงเทรา': 'ภาคตะวันออก',
            'ภูเก็ต': 'ภาคใต้',
            'สุราษฎร์ธานี': 'ภาคใต้',
            'กระบี่': 'ภาคใต้',
            'นครศรีธรรมราช': 'ภาคใต้',
            'สงขลา': 'ภาคใต้',
            'ตรัง': 'ภาคใต้',
            'พัทลุง': 'ภาคใต้',
            'สตูล': 'ภาคใต้',
            'ชุมพร': 'ภาคใต้',
            'ระนอง': 'ภาคใต้',
            'พังงา': 'ภาคใต้',
            'ปัตตานี': 'ภาคใต้',
            'ยะลา': 'ภาคใต้',
            'นราธิวาส': 'ภาคใต้',
          };
          return regionMap[province] || 'ไม่ทราบภาค';
        };

        // Build export data
        const exportRows: any[] = [];
        ordersData
          .filter((r: any) => !/-\d+$/.test(String(r.id || "")))
          .filter((order: any) => {
            // Apply department filter if selected
            if (selectedDepartments.length === 0 || selectedDepartments.length === availableDepartments.length) {
              return true; // No filter = include all
            }
            const creator = users.find(u => u.id === order.creator_id);
            return creator?.role && selectedDepartments.includes(creator.role);
          })
          .forEach((order: any) => {
            const customer = customersData.find((c: any) =>
              String(c.customer_id) === String(order.customer_id) ||
              String(c.id) === String(order.customer_id)
            );
            const orderCreator = users.find(u => u.id === order.creator_id);
            const page = pages.find(p => p.id === order.sales_channel_page_id);

            const customerName = customer
              ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
              : (order.recipient_first_name || order.recipient_last_name
                ? `${order.recipient_first_name || ''} ${order.recipient_last_name || ''}`.trim()
                : '-');
            const customerPhone = order.customer_phone || order.phone || customer?.phone || '-';

            // Determine region from province
            const province = order.province || customer?.province || '';
            const region = getRegionFromProvince(province);

            const items = Array.isArray(order.items) && order.items.length > 0 ? order.items : [{}];

            items.forEach((item: any, itemIndex: number) => {
              // Show order-level fields only on first item row
              const isFirstItem = itemIndex === 0;

              // Promotion handling: parent row shows 0, child rows show actual promo-split amounts
              const isPromoParent = !!item.is_promotion_parent;
              const isPromoChild = !!item.parent_item_id;

              // For Claim or Gift orders, set discount = qty * price so item total = 0
              const isClaimOrGift = order.payment_status === 'Claim' || order.payment_status === 'Gift';
              const originalPrice = Number(item.price_per_unit) || 0;
              const originalDiscount = Number(item.discount) || 0;
              const qty = Number(item.quantity) || 0;
              const netTotal = Number(item.net_total) || 0;

              // For promo child items: net_total = price_override from promotion_items table
              // Calculate promo discount = (retail price × qty) - price_override
              // This shows how much the customer saved from the promo
              let effectiveDiscount: number;
              let itemTotal: number;

              if (isPromoParent) {
                // Promo parent row = 0 for everything (actual amounts are in child rows)
                effectiveDiscount = 0;
                itemTotal = 0;
              } else if (isPromoChild) {
                // Promo child: use net_total as ยอดรวม (= price_override from promotion_items)
                // Discount = retail total - promo price
                const retailTotal = qty * originalPrice;
                effectiveDiscount = retailTotal - netTotal;
                itemTotal = netTotal;
              } else if (isClaimOrGift) {
                effectiveDiscount = qty * originalPrice;
                itemTotal = 0;
              } else {
                effectiveDiscount = originalDiscount;
                // EXTERNAL orders have price_per_unit=0, use net_total as fallback
                const calculatedTotal = (qty * originalPrice) - effectiveDiscount;
                itemTotal = calculatedTotal > 0 ? calculatedTotal : netTotal;
              }

              // Helper function to translate customer type to Thai
              const getCustomerTypeThai = (customerType: string) => {
                const translations: { [key: string]: string } = {
                  'New Customer': 'ลูกค้าใหม่',
                  'Reorder Customer': 'ลูกค้ารีออเดอร์',
                  'Reorder': 'ลูกค้ารีออเดอร์'
                };
                return translations[customerType] || customerType || '-';
              };

              // Helper function to get product/promo code
              const getProductCode = (item: any) => {
                if (item.is_promotion_parent) {
                  return item.promotion_id ? `PROMO-${String(item.promotion_id).padStart(3, '0')}` : '-';
                } else if (item.promotion_id) {
                  return `PROMO-${String(item.promotion_id).padStart(3, '0')}`;
                } else if (item.product_sku) {
                  return item.product_sku;
                } else if (item.product_id) {
                  const product = products.find(p => p.id === item.product_id);
                  return product?.sku || '-';
                }
                return '-';
              };

              // Helper function to get promo name
              const getPromoName = (item: any, allItems: any[]) => {
                if (item.is_promotion_parent) {
                  return item.product_name || '-';
                } else if (item.promotion_id && item.parent_item_id) {
                  const parentItem = allItems.find(i => i.id === item.parent_item_id);
                  return parentItem?.product_name || '-';
                }
                return '-';
              };

              // Helper function to get tracking number for a specific box
              const getTrackingForBox = (order: any, boxNumber: number) => {
                if (order.tracking_numbers) {
                  const trackings = order.tracking_numbers.split(',');
                  // For now, return all tracking numbers (could be enhanced to match by box)
                  return trackings.join(', ') || '-';
                }
                return '-';
              };

              // Helper function to get slip status
              const getSlipStatus = (order: any) => {
                if (order.slips && order.slips.length > 0) {
                  return `อัปโหลดแล้ว (${order.slips.length})`;
                } else if (order.slip_url) {
                  return 'อัปโหลดแล้ว';
                }
                return 'ยังไม่อัปโหลด';
              };

              // Helper function to translate order status
              const getOrderStatusThai = (status: string, orderId?: string, boxNum?: number) => {
                const statusMap: { [key: string]: string } = {
                  'Pending': 'รอดำเนินการ',
                  'Confirmed': 'ยืนยันแล้ว',
                  'Picking': 'กำลังจัดเตรียม',
                  'Preparing': 'กำลังจัดเตรียมสินค้า',
                  'Shipping': 'กำลังจัดส่ง',
                  'Delivered': 'จัดส่งสำเร็จ',
                  'Cancelled': 'ยกเลิก',
                  'Returned': 'ตีกลับ',
                  'Claiming': 'รอเคลม',
                  'BadDebt': 'หนี้สูญ',
                  'PreApproved': 'รออนุมัติ'
                };
                const base = statusMap[status] || status;
                if (status === 'Returned' && orderId && boxNum !== undefined) {
                  const key = `${orderId}-${boxNum}`;
                  const rs = exportBoxMap[key];
                  const rsThai: { [k: string]: string } = {
                    returning: 'กำลังตีกลับ', returned: 'สภาพดี',
                    good: 'สภาพดี', damaged: 'ชำรุด', lost: 'ตีกลับสูญหาย'
                  };
                  const text = rs ? (rsThai[rs] || rs) : 'ไม่ถูกตีกลับ';
                  return `ตีกลับ (กล่อง ${boxNum} : ${text})`;
                }
                return base;
              };

              // Get product name with freebie indicator
              let productName = item.product_name || '-';
              if (item.is_promotion_parent) {
                productName = `📦 ${item.product_name}` || '-';
              } else if (item.is_freebie) {
                productName = `${item.product_name} (ของแถม)`;
              }

              exportRows.push({
                'วันที่สั่งซื้อ': order.order_date ? new Date(order.order_date).toLocaleDateString('th-TH-u-ca-gregory') : '-',
                'เลขคำสั่งซื้อ': order.id || '-',
                'user_id': item.creator_id ?? order.creator_id ?? '',
                'ผู้ขาย': (() => { const c = users.find(u => u.id === (item.creator_id ?? order.creator_id)); return c ? `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.username : '-'; })(),
                'แผนก': (() => { const c = users.find(u => u.id === (item.creator_id ?? order.creator_id)); return c?.role || '-'; })(),
                'ชื่อลูกค้า': customerName,
                'เบอร์โทรลูกค้า': customerPhone,
                'ประเภทลูกค้า': getCustomerTypeThai(order.customer_type || customer?.lifecycleStatus),
                'วันที่จัดส่ง': order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('th-TH-u-ca-gregory') : '-',
                'ช่องทางสั่งซื้อ': order.sales_channel || '-',
                'เพจ': page?.name || '-',
                'ช่องทางการชำระ': order.payment_method || '-',
                'ที่อยู่': order.street || '-',
                'ตำบล': order.subdistrict || '-',
                'อำเภอ': order.district || '-',
                'จังหวัด': order.province || '-',
                'รหัสไปรษณีย์': order.postal_code || '-',
                'ภาค': region,
                'รหัสสินค้า/โปร': getProductCode(item),
                'สินค้า': productName,
                'ประเภทสินค้า': item.product_category || (() => { const p = products.find((pr: any) => pr.id === item.product_id); return p?.category || '-'; })(),
                'ประเภทสินค้า (รีพอร์ต)': item.product_report_category || (() => { const p = products.find((pr: any) => pr.id === item.product_id); return (p as any)?.report_category || '-'; })(),
                'ชื่อโปร': getPromoName(item, order.items || []),
                'ของแถม': item.is_freebie ? 'ใช่' : 'ไม่',
                'จำนวน (ชิ้น)': qty,
                'ราคาต่อหน่วย': isPromoParent ? 0 : originalPrice,
                'ส่วนลด': effectiveDiscount,
                'ยอดรวมรายการ': (item.is_freebie || isPromoParent) ? 0 : itemTotal,
                'ค่าจัดส่ง (ต่อบิล)': isFirstItem ? (Number(order.shipping_cost) || 0) : 0,
                'ส่วนลดท้ายบิล': isFirstItem ? (Number(order.bill_discount) || 0) : 0,
                'ยอดรวมทั้งบิล': isFirstItem ? (Number(order.total_amount) || 0) : 0,
                'หมายเลขกล่อง': String(item.box_number || 1),
                'หมายเลขติดตาม': getTrackingForBox(order, item.box_number),
                'วันที่จัดส่ง Airport': order.airport_delivery_date ? new Date(order.airport_delivery_date).toLocaleDateString('th-TH-u-ca-gregory') : '-',
                'สถานะจาก Airport': order.airport_delivery_status || '-',
                'สถานะออเดอร์': getOrderStatusThai(order.order_status || '', order.id, item.box_number || 1),
                'สถานะการชำระเงิน': (() => {
                  const paid = Number(order.amount_paid) || 0;
                  const total = Number(order.total_amount) || 0;
                  if (total === 0) return 'ไม่มียอด';
                  if (paid === 0) return 'ค้าง';
                  if (paid === total) return 'ตรง';
                  if (paid < total) return 'ขาด';
                  return 'เกิน';
                })(),
                'สถานะสลิป': getSlipStatus(order),
                'วันที่รับเงิน': order.payment_received_date ? new Date(order.payment_received_date).toLocaleDateString('th-TH-u-ca-gregory') : '-',
                'ตะกร้าขาย': item.basket_key_at_sale || '-'
              });
            });
          });

        const filename = `orders-raw_${startDateStr}_${endDateStr}`;
        downloadDataFile(exportRows, filename, type);
      } catch (error) {
        console.error('Failed to export orders:', error);
        alert('ไม่สามารถดาวน์โหลดรายงานได้ กรุณาลองใหม่');
      } finally {
        setIsExporting(false);
      }
      return;
    }

    // For other reports, use pre-loaded data
    const exportData: { [key: string]: { data: any[], filename: string } } = {
      stock: {
        data: reportData.stock,
        filename: 'รายงานสต๊อคคงเหลือ'
      },
      'lot-stock': {
        data: reportData.lotStock,
        filename: `lot-stock_${new Date().toISOString().split('T')[0]}`
      },
      customers: {
        data: reportData.customers,
        filename: 'รายงานลูกค้า'
      }
    };

    const { data, filename } = exportData[selectedReport];
    downloadDataFile(data, filename, type);
  };

  // ตรวจสอบว่ารายงานมีข้อมูลหรือไม่
  const isReportDataAvailable = (reportType: ReportType): boolean => {
    switch (reportType) {
      case 'orders-raw':
        return true; // Always available — data fetched on demand during export
      case 'stock':
        return warehouseStock.length > 0;
      case 'lot-stock':
        return productLots.length > 0;
      case 'customers':
        return customers.length > 0;
      case 'return-summary':
        return true; // Always available — data fetched on demand
      case 'commission':
        return true; // Always available — data fetched on demand
      case 'call-history':
        return true; // Always available — data fetched on demand
      default:
        return false;
    }
  };

  const renderReportContent = () => {
    // Show loading spinner while fetching data (skip for reports with own loading states)
    if (isLoading && selectedReport !== 'commission' && selectedReport !== 'return-summary') {
      return (
        <div className="text-center py-20">
          <Loader2 className="w-12 h-12 text-indigo-500 mx-auto mb-4 animate-spin" />
          <p className="text-gray-500 text-lg">กำลังโหลดข้อมูล...</p>
        </div>
      );
    }

    if (!selectedReport) {
      return (
        <div className="text-center py-20">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">เลือกรายงานที่ต้องการดูจากด้านบน</p>
        </div>
      );
    }

    // แสดงข้อความถ้าไม่มีข้อมูล
    if (!isReportDataAvailable(selectedReport)) {
      const dataSourceMessages: { [key: string]: string } = {
        'orders-raw': 'ยังไม่มีออเดอร์ในระบบ กรุณาสร้างออเดอร์ที่เมนู "สร้างออเดอร์"',
        stock: 'ระบบยังไม่มีข้อมูลสต๊อคคงเหลือในฐานข้อมูล กรุณาเพิ่มข้อมูลที่เมนู "จัดการสินค้าคงคลัง"',
        'lot-stock': 'ระบบยังไม่มีข้อมูล Product Lots ในฐานข้อมูล กรุณารับสินค้าเข้าคลังที่เมนู "รับสินค้าเข้าคลัง"',
        customers: 'ยังไม่มีข้อมูลลูกค้าที่มีออเดอร์ในช่วงเวลาที่เลือก'
      };

      return (
        <div className="text-center py-20">
          <FileSpreadsheet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg font-medium mb-2">ไม่มีข้อมูลสำหรับรายงานนี้</p>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            {dataSourceMessages[selectedReport]}
          </p>
        </div>
      );
    }

    const renderTable = (data: any[], title: string, maxPreviewRows: number = 10) => {
      if (data.length === 0) {
        return (
          <div className="text-center py-10 text-gray-500">
            <FileSpreadsheet className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p>ไม่พบข้อมูลสำหรับช่วงเวลาที่เลือก</p>
          </div>
        );
      }

      const headers = Object.keys(data[0]);
      const previewData = data.slice(0, maxPreviewRows);
      const hasMore = data.length > maxPreviewRows;

      return (
        <div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  {headers.map(header => (
                    <th
                      key={header}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {previewData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {idx + 1}
                    </td>
                    {headers.map(header => {
                      let content = row[header] ?? '-';
                      let className = "px-6 py-4 whitespace-nowrap text-sm text-gray-900";

                      // จัดรูปแบบตามประเภทข้อมูล
                      if (typeof row[header] === 'number' && header.toLowerCase().includes('amount')) {
                        content = `฿${row[header].toLocaleString()}`;
                      } else if (header === 'สถานะออเดอร์') {
                        // แสดงสถานะด้วยสี
                        const statusColors: { [key: string]: string } = {
                          'รอดำเนินการ': 'bg-yellow-100 text-yellow-800',
                          'ยืนยันแล้ว': 'bg-blue-100 text-blue-800',
                          'กำลังจัดเตรียม': 'bg-purple-100 text-purple-800',
                          'กำลังจัดส่ง': 'bg-indigo-100 text-indigo-800',
                          'จัดส่งสำเร็จ': 'bg-green-100 text-green-800',
                          'ยกเลิก': 'bg-red-100 text-red-800',
                          'ตีกลับ': 'bg-orange-100 text-orange-800'
                        };
                        const statusColor = statusColors[content] || 'bg-gray-100 text-gray-800';
                        return (
                          <td key={header} className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                              {content}
                            </span>
                          </td>
                        );
                      }

                      return (
                        <td key={header} className={className}>
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    แสดงเพียง {maxPreviewRows} รายการแรก จากทั้งหมด {data.length.toLocaleString()} รายการ
                  </p>
                  <p className="text-xs text-blue-700">
                    กรุณาคลิก "ดาวน์โหลด CSV" เพื่อดูข้อมูลทั้งหมด
                  </p>
                </div>
              </div>
              <button
                onClick={handleExportClick}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                ดาวน์โหลดทั้งหมด
              </button>
            </div>
          )}
        </div>
      );
    };

    switch (selectedReport) {
      case 'orders-raw':
        return (
          <div>
            <h3 className="text-xl font-semibold mb-4">รายงานออเดอร์แบบละเอียด (Raw Data)</h3>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-indigo-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">จำนวนออเดอร์</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {orders.filter(o => {
                    const orderDate = new Date(o.orderDate);
                    let filterStartDate = new Date();
                    filterStartDate.setHours(0, 0, 0, 0);
                    let filterEndDate = new Date();
                    filterEndDate.setHours(23, 59, 59, 999);

                    switch (dateRange) {
                      case 'today':
                        break;
                      case 'week':
                        filterStartDate.setDate(filterStartDate.getDate() - 7);
                        break;
                      case 'month':
                        filterStartDate.setMonth(filterStartDate.getMonth() - 1);
                        break;
                      case 'this-month':
                        filterStartDate = new Date(filterStartDate.getFullYear(), filterStartDate.getMonth(), 1);
                        break;
                      case 'last-month':
                        filterStartDate = new Date(filterStartDate.getFullYear(), filterStartDate.getMonth() - 1, 1);
                        filterEndDate = new Date(filterEndDate.getFullYear(), filterEndDate.getMonth(), 0, 23, 59, 59, 999);
                        break;
                      case 'year':
                        filterStartDate.setFullYear(filterStartDate.getFullYear() - 1);
                        break;
                      case 'custom':
                        if (startDate) filterStartDate = new Date(startDate);
                        if (endDate) {
                          filterEndDate = new Date(endDate);
                          filterEndDate.setHours(23, 59, 59, 999);
                        }
                        break;
                    }
                    return orderDate >= filterStartDate && orderDate <= filterEndDate;
                  }).length}
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">จำนวนรายการสินค้า</p>
                <p className="text-2xl font-bold text-green-600">
                  {reportData.ordersRaw.length}
                </p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">มูลค่ารวม</p>
                <p className="text-2xl font-bold text-blue-600">
                  ฿{orders.filter(o => {
                    const orderDate = new Date(o.orderDate);
                    let filterStartDate = new Date();
                    filterStartDate.setHours(0, 0, 0, 0);
                    let filterEndDate = new Date();
                    filterEndDate.setHours(23, 59, 59, 999);

                    switch (dateRange) {
                      case 'today':
                        break;
                      case 'week':
                        filterStartDate.setDate(filterStartDate.getDate() - 7);
                        break;
                      case 'month':
                        filterStartDate.setMonth(filterStartDate.getMonth() - 1);
                        break;
                      case 'this-month':
                        filterStartDate = new Date(filterStartDate.getFullYear(), filterStartDate.getMonth(), 1);
                        break;
                      case 'last-month':
                        filterStartDate = new Date(filterStartDate.getFullYear(), filterStartDate.getMonth() - 1, 1);
                        filterEndDate = new Date(filterEndDate.getFullYear(), filterEndDate.getMonth(), 0, 23, 59, 59, 999);
                        break;
                      case 'year':
                        filterStartDate.setFullYear(filterStartDate.getFullYear() - 1);
                        break;
                      case 'custom':
                        if (startDate) filterStartDate = new Date(startDate);
                        if (endDate) {
                          filterEndDate = new Date(endDate);
                          filterEndDate.setHours(23, 59, 59, 999);
                        }
                        break;
                    }
                    return orderDate >= filterStartDate && orderDate <= filterEndDate && o.orderStatus !== 'Cancelled';
                  }).reduce((sum, o) => sum + o.totalAmount, 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">ยอดยกเลิก</p>
                <p className="text-2xl font-bold text-red-600">
                  ฿{orders.filter(o => {
                    const orderDate = new Date(o.orderDate);
                    let filterStartDate = new Date();
                    filterStartDate.setHours(0, 0, 0, 0);
                    let filterEndDate = new Date();
                    filterEndDate.setHours(23, 59, 59, 999);

                    switch (dateRange) {
                      case 'today':
                        break;
                      case 'week':
                        filterStartDate.setDate(filterStartDate.getDate() - 7);
                        break;
                      case 'month':
                        filterStartDate.setMonth(filterStartDate.getMonth() - 1);
                        break;
                      case 'this-month':
                        filterStartDate = new Date(filterStartDate.getFullYear(), filterStartDate.getMonth(), 1);
                        break;
                      case 'last-month':
                        filterStartDate = new Date(filterStartDate.getFullYear(), filterStartDate.getMonth() - 1, 1);
                        filterEndDate = new Date(filterEndDate.getFullYear(), filterEndDate.getMonth(), 0, 23, 59, 59, 999);
                        break;
                      case 'year':
                        filterStartDate.setFullYear(filterStartDate.getFullYear() - 1);
                        break;
                      case 'custom':
                        if (startDate) filterStartDate = new Date(startDate);
                        if (endDate) {
                          filterEndDate = new Date(endDate);
                          filterEndDate.setHours(23, 59, 59, 999);
                        }
                        break;
                    }
                    return orderDate >= filterStartDate && orderDate <= filterEndDate && o.orderStatus === 'Cancelled';
                  }).reduce((sum, o) => sum + o.totalAmount, 0).toLocaleString()}
                </p>
              </div>
            </div>
            {renderTable(reportData.ordersRaw, 'รายการออเดอร์แบบละเอียด')}
          </div>
        );

      case 'stock':
        return (
          <div>
            <h3 className="text-xl font-semibold mb-4">รายงานสต๊อคคงเหลือ</h3>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">รายการสินค้าทั้งหมด</p>
                <p className="text-2xl font-bold text-blue-600">{reportData.stock.length}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">มูลค่าสต๊อครวม</p>
                <p className="text-2xl font-bold text-green-600">
                  ฿{reportData.stock.reduce((sum, s) => sum + s.totalValue, 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">จำนวนรวมทั้งหมด</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {reportData.stock.reduce((sum, s) => sum + s.quantity, 0).toLocaleString()}
                </p>
              </div>
            </div>
            {renderTable(reportData.stock, 'สต๊อคคงเหลือ')}
          </div>
        );

      case 'lot-stock':
        const totalLots = reportData.lotStock.length;
        const activeLots = productLots.filter(l => l.status === 'Active').length;
        const expiredLots = productLots.filter(l => l.status === 'Expired').length;
        const depletedLots = productLots.filter(l => l.status === 'Depleted').length;
        const totalValue = productLots.reduce((sum, l) => sum + ((l.quantityRemaining || 0) * (l.unitCost || 0)), 0);
        const totalQuantity = productLots.reduce((sum, l) => sum + (l.quantityRemaining || 0), 0);

        return (
          <div>
            <h3 className="text-xl font-semibold mb-4">รายงานสต๊อคคงคลัง-Lot</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Lot ทั้งหมด</p>
                <p className="text-2xl font-bold text-blue-600">{totalLots}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">{activeLots}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Expired</p>
                <p className="text-2xl font-bold text-red-600">{expiredLots}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Depleted</p>
                <p className="text-2xl font-bold text-gray-600">{depletedLots}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">จำนวนคงเหลือรวม</p>
                <p className="text-2xl font-bold text-purple-600">{totalQuantity.toLocaleString()}</p>
              </div>
              <div className="bg-indigo-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">มูลค่ารวม</p>
                <p className="text-2xl font-bold text-indigo-600">฿{totalValue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
            {renderTable(reportData.lotStock, 'สต๊อคแยกตาม Lot')}
          </div>
        );

      case 'customers':
        return (
          <div>
            <h3 className="text-xl font-semibold mb-4">รายงานลูกค้า</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-pink-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">ลูกค้าที่มีออเดอร์</p>
                <p className="text-2xl font-bold text-pink-600">{reportData.customers.length}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">มูลค่าซื้อรวม</p>
                <p className="text-2xl font-bold text-purple-600">
                  ฿{reportData.customers.reduce((sum, c) => sum + c.totalSpent, 0).toLocaleString()}
                </p>
              </div>
            </div>
            {renderTable(reportData.customers, 'ลูกค้า')}
          </div>
        );

      case 'return-summary':
        return (
          <div>
            <h3 className="text-xl font-semibold mb-4">รายงานตีกลับเข้าคลัง</h3>
            {isReturnLoading ? (
              <div className="text-center py-10">
                <Loader2 className="w-10 h-10 text-orange-500 mx-auto mb-3 animate-spin" />
                <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
              </div>
            ) : returnSummary ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <p className="text-sm text-gray-600">ออเดอร์ทั้งหมด</p>
                    <p className="text-2xl font-bold text-blue-600">{returnSummary.allOrders.toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <p className="text-sm text-gray-600">ออเดอร์ตีกลับ (Returned)</p>
                    <p className="text-2xl font-bold text-gray-800">{returnSummary.totalOrders.toLocaleString()}</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                    <p className="text-sm text-gray-600">% ตีกลับ</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {returnSummary.allOrders > 0
                        ? ((returnSummary.totalOrders / returnSummary.allOrders) * 100).toFixed(2)
                        : '0.00'}%
                    </p>
                  </div>
                  <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                    <p className="text-sm text-gray-600">จำนวนกล่องทั้งหมด</p>
                    <p className="text-2xl font-bold text-indigo-600">{returnSummary.totalBoxes.toLocaleString()}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                    <p className="text-sm text-gray-600">กำลังตีกลับ</p>
                    <p className="text-2xl font-bold text-orange-600">{returnSummary.returning.toLocaleString()}</p>
                  </div>
                  <div className="bg-cyan-50 p-4 rounded-lg border border-cyan-100">
                    <p className="text-sm text-gray-600">เข้าคลัง (รวม)</p>
                    <p className="text-2xl font-bold text-cyan-600">{(returnSummary.good + returnSummary.damaged).toLocaleString()}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                    <p className="text-sm text-gray-600">เข้าคลัง — สภาพดี</p>
                    <p className="text-2xl font-bold text-green-600">{returnSummary.good.toLocaleString()}</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                    <p className="text-sm text-gray-600">เข้าคลัง — ชำรุด</p>
                    <p className="text-2xl font-bold text-red-600">{returnSummary.damaged.toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <p className="text-sm text-gray-600">สูญหาย</p>
                    <p className="text-2xl font-bold text-gray-600">{returnSummary.lost.toLocaleString()}</p>
                  </div>
                </div>
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Download className="w-5 h-5 text-orange-600" />
                    <p className="text-sm font-medium text-orange-900">
                      ดาวน์โหลด CSV รายละเอียดข้อมูลตีกลับทั้งหมด
                    </p>
                  </div>
                  <button
                    onClick={handleExportClick}
                    disabled={isExporting}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50"
                  >
                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {isExporting ? 'กำลังดาวน์โหลด...' : 'ดาวน์โหลด CSV'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-10">
                <RotateCcw className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">เลือกช่วงวันที่แล้วรอสักครู่...</p>
              </div>
            )}
          </div>
        );

      case 'call-history':
        return (
          <div>
            <h3 className="text-xl font-semibold mb-4">รายงานบันทึกการโทร</h3>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <Headphones className="w-5 h-5 text-gray-500" />
                  <h2 className="font-semibold text-gray-800">ส่งออกข้อมูลบันทึกการโทร</h2>
                </div>
              </div>
              <div className="px-5 py-4 space-y-3">
                <div className="flex items-center gap-3 flex-wrap mt-2">
                  <button
                    onClick={() => executeCallHistoryExport('csv')}
                    disabled={isCallHistoryExporting}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-50"
                  >
                    {isCallHistoryExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    ดาวน์โหลดข้อมูล (CSV)
                  </button>
                  <button
                    onClick={() => executeCallHistoryExport('xlsx')}
                    disabled={isCallHistoryExporting}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-50"
                  >
                    {isCallHistoryExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    ดาวน์โหลดข้อมูล (Excel)
                  </button>
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              {isCallHistoryPreviewLoading ? (
                <div className="text-center py-10">
                  <Loader2 className="w-8 h-8 text-blue-500 mx-auto mb-3 animate-spin" />
                  <p className="text-gray-500">กำลังโหลดตัวอย่างข้อมูล...</p>
                </div>
              ) : (
                renderTable(callHistoryPreviewRows, 'ตัวอย่างบันทึกการโทร', 15)
              )}
            </div>
          </div>
        );

      case 'commission':
        const commFmtNum = (n: number) => n.toLocaleString('th-TH');
        const commFmtMoney = (n: number) => `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
        const commTotals = commSummaryRows.reduce((acc, r) => ({
          incomplete: acc.incomplete + r.incomplete,
          pending: acc.pending + r.pending,
          calculated: acc.calculated + r.calculated,
          total: acc.total + r.total,
          total_commission: acc.total_commission + r.total_commission,
        }), { incomplete: 0, pending: 0, calculated: 0, total: 0, total_commission: 0 });

        return (
          <div>
            {/* Link to Commission Stamp page */}
            <div className="mb-4 flex justify-end">
              <button
                onClick={() => { window.location.href = `${APP_BASE_PATH || '/'}?page=Commission+Stamp`; }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium"
              >
                <DollarSign className="w-4 h-4" />
                ไปหน้าจัดการค่าคอมมิชชัน
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-500" />
                  <h2 className="font-semibold text-gray-800">สรุปตามช่วงเวลา</h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <DateRangePicker value={commSummaryRange} onApply={setCommSummaryRange} />
                  <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                    {(['month', 'week', 'day'] as const).map(g => (
                      <button
                        key={g}
                        onClick={() => setCommGroupBy(g)}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${commGroupBy === g ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
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
                    {isCommLoading ? (
                      <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          กำลังโหลด...
                        </div>
                      </td></tr>
                    ) : commSummaryRows.length === 0 ? (
                      <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">ไม่มีข้อมูลในช่วงเวลาที่เลือก</td></tr>
                    ) : (
                      <>
                        {commSummaryRows.map(row => (
                          <tr key={row.period} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-5 py-3 font-medium text-gray-800">{getCommPeriodLabel(row.period)}</td>
                            <td className="px-5 py-3 text-right text-red-600 font-medium">{commFmtNum(row.incomplete)}</td>
                            <td className="px-5 py-3 text-right text-amber-600 font-medium">{commFmtNum(row.pending)}</td>
                            <td className="px-5 py-3 text-right text-emerald-600 font-medium">{commFmtNum(row.calculated)}</td>
                            <td className="px-5 py-3 text-right text-gray-700 font-semibold">{commFmtNum(row.total)}</td>
                            <td className="px-5 py-3 text-right text-gray-600">{commFmtMoney(row.total_commission)}</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                          <td className="px-5 py-3 text-gray-800">รวมทั้งหมด</td>
                          <td className="px-5 py-3 text-right text-red-700">{commFmtNum(commTotals.incomplete)}</td>
                          <td className="px-5 py-3 text-right text-amber-700">{commFmtNum(commTotals.pending)}</td>
                          <td className="px-5 py-3 text-right text-emerald-700">{commFmtNum(commTotals.calculated)}</td>
                          <td className="px-5 py-3 text-right text-gray-800">{commFmtNum(commTotals.total)}</td>
                          <td className="px-5 py-3 text-right text-gray-800">{commFmtMoney(commTotals.total_commission)}</td>
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
                  <DateRangePicker value={commExportRange} onApply={setCommExportRange} />
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
                      onClick={() => handleCommExportClick(status)}
                      disabled={isCommExporting}
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
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">รายงาน</h1>
          <p className="text-gray-600 mt-1">จัดการและดาวน์โหลดรายงานต่างๆ ของระบบ</p>
        </div>
        <BarChart3 className="w-12 h-12 text-indigo-500" />
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {reportCards.map(card => {
          const Icon = card.icon;
          const isSelected = selectedReport === card.id;
          const hasData = isReportDataAvailable(card.id);
          const isDisabled = card.disabled;

          return (
            <button
              key={card.id}
              onClick={() => !isDisabled && setSelectedReport(card.id)}
              disabled={isDisabled}
              className={`p-4 rounded-lg border-2 transition-all text-left relative ${isDisabled
                ? 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-70'
                : isSelected
                  ? 'border-indigo-500 bg-indigo-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow'
                }`}
            >
              {/* Status Badge */}
              <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium ${isDisabled
                ? 'bg-gray-200 text-gray-500'
                : hasData
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
                }`}>
                {isDisabled ? card.comingSoon : (hasData ? 'มีข้อมูล' : 'ไม่มีข้อมูล')}
              </div>

              <div className={`w-12 h-12 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h3 className={`font-semibold mb-1 pr-16 ${isDisabled ? 'text-gray-500' : 'text-gray-800'}`}>{card.title}</h3>
              <p className={`text-xs ${isDisabled ? 'text-gray-400' : 'text-gray-600'}`}>{card.description}</p>
            </button>
          );
        })}
      </div>

      {/* Filters (hide for commission — has its own date range picker) */}
      {selectedReport && selectedReport !== 'commission' && (
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">ช่วงเวลา:</span>
            </div>

            <div className="flex gap-2">
              {[
                { value: 'today', label: 'วันนี้' },
                { value: 'week', label: '7 วัน' },
                { value: 'month', label: '30 วัน' },
                { value: 'this-month', label: 'เดือนนี้' },
                { value: 'last-month', label: 'เดือนที่แล้ว' },
                { value: 'custom', label: 'กำหนดเอง' }
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => setDateRange(option.value as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateRange === option.value
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {dateRange === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    // Auto-adjust end date to max 30 days
                    if (e.target.value && endDate) {
                      const start = new Date(e.target.value);
                      const end = new Date(endDate);
                      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                      if (diffDays > 31) {
                        const newEnd = new Date(start);
                        newEnd.setDate(newEnd.getDate() + 31);
                        setEndDate(newEnd.toISOString().split('T')[0]);
                      }
                    }
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <span className="text-gray-500">ถึง</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    const newEnd = e.target.value;
                    if (startDate && newEnd) {
                      const start = new Date(startDate);
                      const end = new Date(newEnd);
                      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                      if (diffDays > 31) {
                        alert('สามารถเลือกได้สูงสุด 31 วันเท่านั้น');
                        const maxEnd = new Date(start);
                        maxEnd.setDate(maxEnd.getDate() + 31);
                        setEndDate(maxEnd.toISOString().split('T')[0]);
                        return;
                      }
                    }
                    setEndDate(newEnd);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <span className="text-xs text-gray-400">(สูงสุด 31 วัน)</span>
              </div>
            )}

            {/* Order Status Filter */}
            <div className="relative">
              <button
                onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                สถานะออเดอร์
                {selectedOrderStatuses.length > 0 && (
                  <span className="bg-indigo-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {selectedOrderStatuses.length}
                  </span>
                )}
                <ChevronDown className="w-4 h-4" />
              </button>
              {isStatusDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px]">
                  <div className="p-2 border-b">
                    <button
                      onClick={() => {
                        if (selectedOrderStatuses.length === orderStatusOptions.length) {
                          setSelectedOrderStatuses([]);
                        } else {
                          setSelectedOrderStatuses(orderStatusOptions.map(o => o.value));
                        }
                      }}
                      className="text-sm text-indigo-600 hover:underline"
                    >
                      {selectedOrderStatuses.length === orderStatusOptions.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                    {orderStatusOptions.map(option => (
                      <label key={option.value} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedOrderStatuses.includes(option.value)}
                          onChange={() => {
                            setSelectedOrderStatuses(prev =>
                              prev.includes(option.value)
                                ? prev.filter(s => s !== option.value)
                                : [...prev, option.value]
                            );
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">{option.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="p-2 border-t">
                    <button
                      onClick={() => setIsStatusDropdownOpen(false)}
                      className="w-full px-3 py-1.5 bg-indigo-500 text-white rounded text-sm hover:bg-indigo-600"
                    >
                      ปิด
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Department Filter Dropdown */}
          {selectedReport === 'orders-raw' && availableDepartments.length > 0 && (
            <div className="flex items-center gap-4 flex-wrap mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">แผนก:</span>
              </div>

              <div className="relative">
                <button
                  onClick={() => setIsDeptDropdownOpen(!isDeptDropdownOpen)}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  {selectedDepartments.length === 0
                    ? 'ทั้งหมด'
                    : selectedDepartments.length === availableDepartments.length
                      ? 'ทั้งหมด'
                      : `${selectedDepartments.length} แผนก`}
                  <ChevronDown className={`w-4 h-4 transition-transform ${isDeptDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isDeptDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px]">
                    {/* Select All */}
                    <label className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100">
                      <input
                        type="checkbox"
                        checked={selectedDepartments.length === 0 || selectedDepartments.length === availableDepartments.length}
                        onChange={selectAllDepartments}
                        className="w-4 h-4 text-indigo-500 rounded"
                      />
                      <span className="text-sm font-medium">ทั้งหมด</span>
                    </label>

                    {/* Department options */}
                    {availableDepartments.map(dept => (
                      <label
                        key={dept}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedDepartments.includes(dept)}
                          onChange={() => toggleDepartment(dept)}
                          className="w-4 h-4 text-indigo-500 rounded"
                        />
                        <span className="text-sm">{dept}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {selectedDepartments.length > 0 && selectedDepartments.length < availableDepartments.length && (
                <span className="text-sm text-gray-500">
                  แสดง {orders.length} จาก {fetchedOrders.length} ออเดอร์
                </span>
              )}
            </div>
          )}

          {/* Truncation warning */}
          {fetchedOrders.length >= 15000 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
              ⚠️ ข้อมูลอาจถูกตัด (แสดง 15,000 รายการ) - ลองเลือกช่วงเวลาที่สั้นลงหรือใช้ตัวกรองแผนก
            </div>
          )}
        </div>
      )}

      {/* Report Content */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        {renderReportContent()}
      </div>
      <ExportTypeModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onConfirm={executeExport}
        isExporting={isExporting}
      />
      <ExportTypeModal
        isOpen={isCommExportModalOpen}
        onClose={() => setIsCommExportModalOpen(false)}
        onConfirm={executeCommExport}
        isExporting={isCommExporting}
      />
    </div>
  );
};

export default ReportsPage;
