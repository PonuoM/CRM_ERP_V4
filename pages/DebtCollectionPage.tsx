import React, { useState, useEffect } from 'react';
import { User, Order, Customer, ModalType } from '../types';
import DebtCollectionModal from '../components/DebtCollectionModal';
import OrderDetailModal from '../components/OrderDetailModal';
import { DollarSign, FileText, Loader2, ChevronLeft, ChevronRight, Phone, CheckCircle, XCircle, AlertOctagon, Download, Filter, Clock } from 'lucide-react';
import { getDebtCollectionOrders, getDebtCollectionSummary, closeDebtCase, DebtCollectionSummary, getDebtCollectionHistory, updateDebtCollection, exportDebtCollection } from '../services/api';
import DateRangePicker from '../components/DateRangePicker';
import ExportTypeModal from '../components/ExportTypeModal';
import { downloadDataFile } from '../utils/exportUtils';

interface DebtCollectionPageProps {
  user: User;
  customers: Customer[];
  users: User[];
  openModal: (type: ModalType, data: Order) => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const DebtCollectionPage: React.FC<DebtCollectionPageProps> = ({ user, customers, openModal }) => {
  // State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalOrders, setTotalOrders] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(PAGE_SIZE_OPTIONS[0]); // Default 10
  const [totalPages, setTotalPages] = useState(1);

  // Summary State
  const [summaryStats, setSummaryStats] = useState<DebtCollectionSummary>({ orderCount: 0, totalDebt: 0 });
  const [trackers, setTrackers] = useState<{ id: number; name: string }[]>([]);

  // Tab State
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'commission'>('active');


  // Modal state
  const [trackModalOpen, setTrackModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailSelectedOrder, setDetailSelectedOrder] = useState<Order | null>(null);
  const [closingCase, setClosingCase] = useState(false);

  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDaysOverdue, setFilterDaysOverdue] = useState('');
  const [filterTrackingStatus, setFilterTrackingStatus] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterMissingReceivedDate, setFilterMissingReceivedDate] = useState(false);
  const [filterOver7Days, setFilterOver7Days] = useState(false);
  const [filterTrackerId, setFilterTrackerId] = useState('');

  // CSV Export State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState<'orders' | 'history' | 'commission'>('history');
  const [exportStatus, setExportStatus] = useState<string>('');
  const [showFormatModal, setShowFormatModal] = useState(false);

  // Commission State
  const [commissionHistory, setCommissionHistory] = useState<any[]>([]);
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [globalSmallRate, setGlobalSmallRate] = useState<number>(8.0);
  const [globalBigRate, setGlobalBigRate] = useState<number>(15.0);
  const [customSmallRates, setCustomSmallRates] = useState<Record<string, number>>({});
  const [customBigRates, setCustomBigRates] = useState<Record<string, number>>({});
  const [expandedTracker, setExpandedTracker] = useState<string | null>(null);
  const [detailPage, setDetailPage] = useState<number>(1);
  const [detailPageSize, setDetailPageSize] = useState<number>(10);

  useEffect(() => {
    setDetailPage(1);
  }, [expandedTracker]);

  const [commissionStartDate, setCommissionStartDate] = useState<string>('');
  const [commissionEndDate, setCommissionEndDate] = useState<string>('');

  // New Dynamic Commission States
  const [commissionMode, setCommissionMode] = useState<'by_product' | 'flat_rate'>('by_product');
  const [globalFlatRate, setGlobalFlatRate] = useState<number>(20.0);
  const [customFlatRates, setCustomFlatRates] = useState<Record<string, number>>({});
  const [globalRates, setGlobalRates] = useState<Record<string, number>>({
    'กระสอบเล็ก': 8.0,
    'กระสอบใหญ่': 15.0,
    'ชีวภัณฑ์': 5.0,
  });
  const [customRates, setCustomRates] = useState<Record<string, Record<string, number>>>({});
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['กระสอบเล็ก', 'กระสอบใหญ่']);
  const [selectedTrackingIds, setSelectedTrackingIds] = useState<Record<string, boolean>>({});

  // Initialize selected tracking IDs when history loads
  useEffect(() => {
    const initialSelected: Record<string, boolean> = {};
    commissionHistory.forEach((record) => {
      const amt = Number(record.amountCollected) || 0;
      if (amt > 0) {
        const name = record.trackerName || 'ไม่ระบุผู้ติดตาม';
        const key = `${name}_${record.orderId}`;
        initialSelected[key] = true;
      }
    });
    setSelectedTrackingIds(initialSelected);
  }, [commissionHistory]);

  // Scan unique product categories dynamically from history
  const allCategories = React.useMemo(() => {
    const categories = new Set<string>();
    categories.add('กระสอบเล็ก');
    categories.add('กระสอบใหญ่');
    
    commissionHistory.forEach((record) => {
      if (record.items && Array.isArray(record.items)) {
        record.items.forEach((item) => {
          if (item.category) {
            categories.add(item.category);
          }
        });
      }
    });
    return Array.from(categories);
  }, [commissionHistory]);

  // Fetch Summary Statistics (Global)
  const fetchSummary = async () => {
    if (!user?.companyId) return;
    try {
      const response = await getDebtCollectionSummary({
        // companyId: user.companyId, 
        status: activeTab // Filter summary by tab status
      });
      if (response.ok) {
        setSummaryStats({
          orderCount: response.orderCount || 0,
          totalDebt: response.totalDebt || 0
        });
        if ((response as any).trackers) {
          setTrackers((response as any).trackers);
        }
      }
    } catch (error) {
      console.error("Failed to fetch summary:", error);
    }
  };

  // Fetch Orders List (Paginated)
  const fetchOrders = async () => {
    if (!user?.companyId) return;

    setLoading(true);
    try {
      const response = await getDebtCollectionOrders({
        // companyId: user.companyId, // Filtered by user auth in API usually, or pass if needed
        page: currentPage,
        pageSize: itemsPerPage,
        status: activeTab, // Filter by tab status

        // Search filters
        // Identify if search term is name, phone, or order ID
        customerName: isNaN(Number(searchTerm)) && !searchTerm.startsWith('OD') ? searchTerm : undefined,
        customerPhone: !isNaN(Number(searchTerm)) && searchTerm.length > 5 ? searchTerm : undefined,
        orderId: searchTerm.startsWith('OD') || (!isNaN(Number(searchTerm)) && searchTerm.length <= 5) ? searchTerm : undefined,

        minDaysOverdue: filterDaysOverdue ? Number(filterDaysOverdue) : undefined,
        trackingStatus: filterTrackingStatus || undefined,
        startDate: filterStartDate || undefined,
        endDate: filterEndDate || undefined,
        missingReceivedDate: filterMissingReceivedDate ? '1' : undefined,
        over7Days: filterOver7Days ? '1' : undefined,
        trackerId: filterTrackerId || undefined
      });

      if (response.ok) {
        // Map API response to Order type (partial) for display
        // Note: The API returns formatted objects, we assume they align with what we need
        setOrders(response.orders || []);
        setTotalOrders(response.pagination?.total || 0);
        setTotalPages(response.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCommissionData = async () => {
    if (!user?.companyId) return;
    setCommissionLoading(true);
    try {
      const response = await exportDebtCollection({
        startDate: commissionStartDate,
        endDate: commissionEndDate,
        type: 'history',
        status: 'all'
      });
      if (response.ok && response.records) {
        setCommissionHistory(response.records);
      } else {
        setCommissionHistory([]);
      }
    } catch (error) {
      console.error("Failed to fetch commission data:", error);
      setCommissionHistory([]);
    } finally {
      setCommissionLoading(false);
    }
  };

  const groupedCommission = React.useMemo(() => {
    const groups: Record<string, {
      trackerName: string;
      chaseCount: number;
      receiptCount: number;
      totalCollected: number;
      categoryQuantities: Record<string, number>;
      details: any[];
    }> = {};

    // Group logs by Tracker -> OrderId first to combine multiple payments by the same tracker for the same order
    const trackerOrders: Record<string, Record<string, {
      orderId: string;
      customerName: string;
      customerPhone: string;
      orderDate: string;
      deliveryDate: string;
      totalAmount: number;
      trackerName: string;
      trackingDate: string;
      resultStatus: string;
      isComplete: number;
      note: string;
      trackerCollectedAmount: number;
      items: any[];
      smallBags: number;
      bigBags: number;
    }>> = {};

    const seenRecords = new Set<string>();

    commissionHistory.forEach((record) => {
      const name = record.trackerName || 'ไม่ระบุผู้ติดตาม';
      
      // De-duplicate exact same tracking logs (e.g. database duplicate rows)
      const logKey = `${record.orderId}_${record.trackingDate}_${record.amountCollected}_${name}`;
      if (seenRecords.has(logKey)) {
        return;
      }
      seenRecords.add(logKey);

      // Initialize tracker group if not exists
      if (!groups[name]) {
        groups[name] = {
          trackerName: name,
          chaseCount: 0,
          receiptCount: 0,
          totalCollected: 0,
          categoryQuantities: {},
          details: [],
        };
      }
      
      groups[name].chaseCount += 1;

      const amt = Number(record.amountCollected) || 0;
      if (amt > 0) {
        if (!trackerOrders[name]) {
          trackerOrders[name] = {};
        }

        const orderId = record.orderId;
        if (!trackerOrders[name][orderId]) {
          trackerOrders[name][orderId] = {
            orderId: record.orderId,
            customerName: record.customerName,
            customerPhone: record.customerPhone,
            orderDate: record.orderDate,
            deliveryDate: record.deliveryDate,
            totalAmount: Number(record.totalAmount) || 0,
            trackerName: name,
            trackingDate: record.trackingDate,
            resultStatus: record.resultStatus,
            isComplete: record.isComplete,
            note: record.note || '',
            trackerCollectedAmount: 0,
            items: record.items || [],
            smallBags: Number(record.smallBags) || 0,
            bigBags: Number(record.bigBags) || 0,
          };
        } else {
          // Combine notes if there are multiple collections
          if (record.note && !trackerOrders[name][orderId].note.includes(record.note)) {
            trackerOrders[name][orderId].note += (trackerOrders[name][orderId].note ? ' | ' : '') + record.note;
          }
          // Use the latest tracking date/status
          if (new Date(record.trackingDate) > new Date(trackerOrders[name][orderId].trackingDate)) {
            trackerOrders[name][orderId].trackingDate = record.trackingDate;
            trackerOrders[name][orderId].resultStatus = record.resultStatus;
            trackerOrders[name][orderId].isComplete = record.isComplete;
          }
        }

        // Sum the collected amount by this tracker for this order
        trackerOrders[name][orderId].trackerCollectedAmount += amt;
      }
    });

    // Now compute totals and prorated bags for grouped orders
    Object.entries(trackerOrders).forEach(([name, ordersMap]) => {
      Object.values(ordersMap).forEach((orderData) => {
        const key = `${name}_${orderData.orderId}`;
        const isSelected = selectedTrackingIds[key] !== false;

        const totalAmount = Number(orderData.totalAmount) || 1;
        // Safeguard: trackerAmt cannot exceed totalAmount
        const trackerAmt = Math.min(orderData.trackerCollectedAmount, totalAmount);
        const ratio = Math.min(1.0, trackerAmt / totalAmount);

        const recordBags: Record<string, number> = {};

        if (orderData.items && Array.isArray(orderData.items)) {
          orderData.items.forEach((item) => {
            const cat = item.category || 'อื่นๆ';
            if (selectedCategories.includes(cat)) {
              const proratedQty = (Number(item.quantity) || 0) * ratio;
              if (isSelected) {
                groups[name].categoryQuantities[cat] = (groups[name].categoryQuantities[cat] || 0) + proratedQty;
              }
              recordBags[cat] = proratedQty;
            }
          });
        } else {
          // Fallback to legacy fields
          const colSmall = (Number(orderData.smallBags) || 0) * ratio;
          const colBig = (Number(orderData.bigBags) || 0) * ratio;
          if (selectedCategories.includes('กระสอบเล็ก')) {
            if (isSelected) {
              groups[name].categoryQuantities['กระสอบเล็ก'] = (groups[name].categoryQuantities['กระสอบเล็ก'] || 0) + colSmall;
            }
            recordBags['กระสอบเล็ก'] = colSmall;
          }
          if (selectedCategories.includes('กระสอบใหญ่')) {
            if (isSelected) {
              groups[name].categoryQuantities['กระสอบใหญ่'] = (groups[name].categoryQuantities['กระสอบใหญ่'] || 0) + colBig;
            }
            recordBags['กระสอบใหญ่'] = colBig;
          }
        }

        if (isSelected) {
          groups[name].receiptCount += 1;
          groups[name].totalCollected += trackerAmt;
        }

        // Add grouped order to details
        groups[name].details.push({
          ...orderData,
          amountCollected: trackerAmt,
          recordBags,
          isSelected
        });
      });
    });

    let result = Object.values(groups);
    return result.sort((a, b) => b.totalCollected - a.totalCollected);
  }, [commissionHistory, selectedCategories, selectedTrackingIds]);

  const commissionTotals = React.useMemo(() => {
    let totalCollected = 0;
    let totalCommission = 0;
    let totalReceipts = 0;
    const categoryTotals: Record<string, number> = {};

    groupedCommission.forEach((group) => {
      totalCollected += group.totalCollected;
      totalReceipts += group.receiptCount;

      let commission = 0;
      if (commissionMode === 'by_product') {
        Object.entries(group.categoryQuantities).forEach(([cat, qty]) => {
          const rate = customRates[group.trackerName]?.[cat] !== undefined 
            ? customRates[group.trackerName][cat] 
            : (globalRates[cat] !== undefined ? globalRates[cat] : 0);
          commission += qty * rate;
          categoryTotals[cat] = (categoryTotals[cat] || 0) + qty;
        });
      } else {
        const rate = customFlatRates[group.trackerName] !== undefined 
          ? customFlatRates[group.trackerName] 
          : globalFlatRate;
        commission = group.receiptCount * rate;
      }
      totalCommission += commission;
    });

    return {
      totalCollected,
      totalCommission,
      totalReceipts,
      categoryTotals
    };
  }, [groupedCommission, commissionMode, globalRates, customRates, globalFlatRate, customFlatRates]);

  const handleExportCommission = () => {
    setExportType('commission');
    setShowFormatModal(true);
  };

  useEffect(() => {
    if (activeTab === 'commission') {
      fetchCommissionData();
    } else {
      fetchOrders();
      fetchSummary();
    }
  }, [
    user?.companyId,
    currentPage,
    itemsPerPage,
    activeTab,
    searchTerm,
    filterDaysOverdue,
    filterTrackingStatus,
    filterStartDate,
    filterEndDate,
    filterMissingReceivedDate,
    filterOver7Days,
    filterTrackerId,
    commissionStartDate,
    commissionEndDate
  ]);

  // Reset page when tab changes OR FILTER changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, filterDaysOverdue, filterTrackingStatus, filterStartDate, filterEndDate, filterMissingReceivedDate, filterOver7Days, filterTrackerId]);

  const handlePageChange = (page: number) => {
    const next = Math.min(Math.max(page, 1), totalPages);
    setCurrentPage(next);
  };

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  const handleViewDetail = (order: Order) => {
    setDetailSelectedOrder(order);
    setDetailModalOpen(true);
  };

  const handleTrackClick = (order: Order) => {
    setSelectedOrder(order);
    setTrackModalOpen(true);
  };

  const handleCloseCase = async (order: Order) => {
    if (!confirm(`ยืนยันการจบเคสสำหรับ Order ${order.id}?`)) {
      return;
    }

    setClosingCase(true);
    try {
      // User requested to set collected amount to 0 when closing via quick button
      const response = await closeDebtCase({
        order_id: order.id,
        user_id: user.id,
        amount_collected: 0,
        result_status: 3, // Collected All / Closed
        note: 'จบเคส - ปิดการติดตามหนี้ (ไม่ได้ยอดเพิ่ม)',
      });

      if (response.ok) {
        alert('จบเคสเรียบร้อยแล้ว');
        fetchOrders();
        fetchSummary(); // Refresh stats too
      } else {
        alert(response.error || 'เกิดข้อผิดพลาดในการจบเคส');
      }
    } catch (error: any) {
      alert(error.message || 'เกิดข้อผิดพลาดในการจบเคส');
    } finally {
      setClosingCase(false);
    }
  };

  const handleCancelCase = async (order: Order) => {
    if (!confirm(`ยืนยันการยกเลิกสถานะ "จบเคส" สำหรับ Order ${order.id}?`)) {
      return;
    }

    setClosingCase(true);
    try {
      // 1. Fetch history to find the closing record
      const historyResponse = await getDebtCollectionHistory({ order_id: order.id });

      if (!historyResponse.ok || !historyResponse.data) {
        throw new Error('ไม่สามารถดึงข้อมูลประวัติการติดตามได้');
      }

      const closingRecord = historyResponse.data.find(r => r.is_complete === 1);

      if (!closingRecord) {
        throw new Error('ไม่พบรายการที่ทำการจบเคส');
      }

      // 2. Update is_complete to 0
      const response = await updateDebtCollection(closingRecord.id, {
        is_complete: 0
      });

      if (response.ok) {
        alert('ยกเลิกการจบเคสเรียบร้อยแล้ว');
        fetchOrders();
        fetchSummary();
      } else {
        alert(response.error || 'เกิดข้อผิดพลาดในการยกเลิกจบเคส');
      }
    } catch (error: any) {
      alert(error.message || 'เกิดข้อผิดพลาดในการยกเลิกจบเคส');
    } finally {
      setClosingCase(false);
    }
  };

  const handleTrackSuccess = () => {
    fetchOrders();
    fetchSummary(); // Refresh stats too
  };

  const getPageNumbers = () => {
    const pages: Array<number | '...'> = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i += 1) {
        pages.push(i);
      }
    } else if (currentPage <= 3) {
      for (let i = 1; i <= 4; i += 1) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1);
      pages.push('...');
      for (let i = totalPages - 3; i <= totalPages; i += 1) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      pages.push('...');
      for (let i = currentPage - 1; i <= currentPage + 1; i += 1) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  };

  // CSV Export Handler
  const handlePrepareExport = () => {
    if (!exportStartDate || !exportEndDate) {
      alert('กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด');
      return;
    }
    if (!exportStatus) {
      alert('กรุณาเลือกสถานะเคส');
      return;
    }
    setShowExportModal(false);
    setShowFormatModal(true);
  };

  const executeExport = async (fileType: 'csv' | 'xlsx') => {
    setExporting(true);
    try {
      if (exportType === 'commission') {
        const headers = [
          'ผู้ติดตาม',
          'จำนวนครั้งที่ติดตาม',
          'จำนวนที่เก็บเงินได้',
          'ยอดเก็บเงินได้รวม (บาท)'
        ];
        
        if (commissionMode === 'by_product') {
          allCategories.filter(cat => selectedCategories.includes(cat)).forEach((cat) => {
            headers.push(`สินค้า ${cat} (หน่วย)`, `อัตราคอม ${cat} (บาท)`);
          });
        } else {
          headers.push('อัตราค่าคอมต่อบิล (บาท)');
        }
        headers.push('ค่าคอมมิชชันที่ได้รับ (บาท)');

        const rows = groupedCommission.map((g) => {
          const rowData: any[] = [
            g.trackerName,
            g.chaseCount,
            g.receiptCount,
            g.totalCollected,
          ];

          let comm = 0;
          if (commissionMode === 'by_product') {
            allCategories.filter(cat => selectedCategories.includes(cat)).forEach((cat) => {
              const qty = g.categoryQuantities[cat] || 0;
              const rate = customRates[g.trackerName]?.[cat] !== undefined 
                ? customRates[g.trackerName][cat] 
                : (globalRates[cat] !== undefined ? globalRates[cat] : 0);
              comm += qty * rate;
              rowData.push(qty.toFixed(2), rate);
            });
          } else {
            const rate = customFlatRates[g.trackerName] !== undefined 
              ? customFlatRates[g.trackerName] 
              : globalFlatRate;
            comm = g.receiptCount * rate;
            rowData.push(rate);
          }

          rowData.push(comm);
          return rowData;
        });
        downloadDataFile([headers, ...rows], `debt_commission_${commissionStartDate || 'all'}_${commissionEndDate || 'all'}`, fileType);
        setShowFormatModal(false);
      } else if (exportType === 'history') {
        // ===== Export: ประวัติการติดตาม =====
        const response = await exportDebtCollection({
          startDate: exportStartDate,
          endDate: exportEndDate,
          type: 'history',
          status: exportStatus
        });
        if (response.ok && response.records) {
          const records = response.records;
          const headers = ['Order ID', 'ชื่อลูกค้า', 'เบอร์โทร', 'วันที่ส่ง', 'วันที่รับของ', 'ยอดออเดอร์', 'ผู้ติดตาม', 'วันที่ติดตาม', 'วันที่ติดตามแรก', 'ห่างกี่วัน', 'ยอดเก็บได้', 'ผลการติดตาม', 'จบเคส', 'หมายเหตุ', 'ยอดเก็บรวม', 'ยอดคงเหลือ', 'สถานะออเดอร์', 'สถานะชำระ', 'จำนวนเงินในสลิป', 'ธนาคาร', 'เวลาโอน'];
          const rows = records.map((r: any) => [
            r.orderId,
            r.customerName,
            r.customerPhone || '',
            r.deliveryDate || '',
            r.customerReceivedDate || '',
            r.totalAmount,
            r.trackerName,
            r.trackingDate || '',
            r.firstTrackingDate || '',
            r.daysToFirstTracking ?? '',
            r.amountCollected,
            r.resultStatus,
            r.isComplete ? 'ใช่' : 'ไม่',
            r.note || '',
            r.totalCollected,
            r.remainingDebt,
            r.orderStatus,
            r.paymentStatus,
            r.slipAmounts || '',
            r.slipBanks || '',
            r.slipTransferDates || ''
          ]);

          downloadDataFile([headers, ...rows], `debt_tracking_history_${exportStartDate}_${exportEndDate}`, fileType);
        } else {
          alert('ไม่พบข้อมูล หรือเกิดข้อผิดพลาด');
        }
      } else {
        // ===== Export: ข้อมูลออเดอร์ =====
        const response = await getDebtCollectionOrders({
          status: exportStatus,
          startDate: exportStartDate,
          endDate: exportEndDate,
          pageSize: 9999,
          page: 1
        });
        if (response.ok && response.orders) {
          const orders = response.orders;
          const headers = ['Order ID', 'ชื่อลูกค้า', 'เบอร์โทร', 'วันที่สั่ง', 'วันที่ส่ง', 'ยอดรวม', 'ยอดเก็บแล้ว', 'ยอดคงเหลือ', 'วันค้าง', 'สถานะออเดอร์', 'สถานะชำระ', 'สถานะเคส', 'จำนวนติดตาม', 'ผู้ติดตามล่าสุด', 'วันรับเงิน', 'สินค้าที่ขาย', 'จำนวนสินค้า'];
          const rows: any[][] = [];
          orders.forEach((o: any) => {
            const items: { productName: string; quantity: number }[] = o.orderItems || [];
            const baseRow = [
              o.id,
              `${o.customerInfo?.firstName || ''} ${o.customerInfo?.lastName || ''}`.trim(),
              o.customerInfo?.phone || '',
              o.orderDate || '',
              o.deliveryDate || '',
              o.totalAmount,
              o.totalDebtCollected,
              o.remainingDebt,
              o.daysPassed,
              o.orderStatus,
              o.paymentStatus,
              o.debtStatus || '',
              o.trackingCount,
              o.lastTrackerName || '',
              o.slipPaymentDate || '',
            ];
            if (items.length === 0) {
              rows.push([...baseRow, '', '']);
            } else {
              items.forEach((item: any) => {
                rows.push([...baseRow, item.productName, item.quantity]);
              });
            }
          });

          downloadDataFile([headers, ...rows], `debt_collection_${activeTab}_${exportStartDate}_${exportEndDate}`, fileType);
        } else {
          alert('ไม่พบข้อมูล หรือเกิดข้อผิดพลาด');
        }
      }
      setShowFormatModal(false);
    } catch (err) {
      console.error('Export failed:', err);
      alert('เกิดข้อผิดพลาดในการดาวน์โหลด');
    } finally {
      setExporting(false);
    }
  };

  // Indices for display
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalOrders);
  const displayStart = totalOrders === 0 ? 0 : startIndex + 1;
  const displayEnd = totalOrders === 0 ? 0 : endIndex;

  // Render
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">ติดตามหนี้</h2>
        {activeTab === 'commission' ? (
          <button
            onClick={handleExportCommission}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            <Download size={16} />
            ดาวน์โหลดรายงานค่าคอม
          </button>
        ) : (
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            <Download size={16} />
            ดาวน์โหลดรายงาน
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('active')}
            className={`${activeTab === 'active'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
          >
            กำลังติดตาม
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`${activeTab === 'completed'
              ? 'border-green-500 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
          >
            จบเคสแล้ว / จ่ายครบ
          </button>
          <button
            onClick={() => setActiveTab('commission')}
            className={`${activeTab === 'commission'
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
          >
            คิดค่าคอม
          </button>
        </nav>
      </div>

      {/* Filters */}
      {activeTab === 'commission' ? (
        <div className="bg-white p-4 rounded-lg shadow-sm border mb-6 space-y-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="w-full md:w-60">
                <label className="block text-sm font-medium text-gray-700 mb-1 font-semibold">ช่วงวันที่ติดตาม</label>
                <DateRangePicker
                  value={{ start: commissionStartDate, end: commissionEndDate }}
                  onApply={(range) => {
                    setCommissionStartDate(range.start);
                    setCommissionEndDate(range.end);
                  }}
                />
              </div>

              {/* Select categories to calculate commission (Inline) */}
              {commissionMode === 'by_product' && (
                <div className="flex-1 w-full">
                  <label className="block text-sm font-medium text-gray-700 mb-1 font-semibold">เลือกสินค้าที่ต้องการคิดค่าคอมมิชชัน</label>
                  <div className="flex flex-wrap gap-2.5 min-h-[38px] items-center">
                    {allCategories.map((cat) => {
                      const isChecked = selectedCategories.includes(cat);
                      return (
                        <label key={cat} className={`flex items-center gap-2 cursor-pointer border rounded-lg px-3 py-1.5 transition-all text-xs font-medium ${
                          isChecked 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' 
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCategories(prev => [...prev, cat]);
                              } else {
                                setSelectedCategories(prev => prev.filter(c => c !== cat));
                              }
                            }}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>{cat}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="w-full md:w-72">
                <label className="block text-sm font-medium text-gray-700 mb-1 font-semibold">รูปแบบการคิดค่าคอมมิชชัน</label>
                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg border">
                  <button
                    onClick={() => setCommissionMode('by_product')}
                    className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
                      commissionMode === 'by_product'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    คิดตามจำนวนสินค้า
                  </button>
                  <button
                    onClick={() => setCommissionMode('flat_rate')}
                    className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
                      commissionMode === 'flat_rate'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    คิดเรทคงที่ต่อบิลสำเร็จ
                  </button>
                </div>
              </div>
            </div>

            {/* Rates Section */}
            <div className="pt-2 border-t border-gray-100">
              <span className="block text-sm font-semibold text-gray-700 mb-2">อัตราค่าคอมเริ่มต้น (Global Rates)</span>
              
              {commissionMode === 'by_product' ? (
                selectedCategories.length === 0 ? (
                  <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    ⚠️ กรุณาเลือกสินค้าอย่างน้อย 1 ประเภทด้านบน เพื่อเริ่มคำนวณและป้อนอัตราค่าคอมมิชชัน
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {allCategories.filter(cat => selectedCategories.includes(cat)).map((cat) => (
                      <div key={cat} className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1 truncate" title={cat}>คอม {cat} (บาท)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={globalRates[cat] !== undefined ? globalRates[cat] : 0}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0);
                            setGlobalRates(prev => ({ ...prev, [cat]: val }));
                            if (cat === 'กระสอบเล็ก') setGlobalSmallRate(val);
                            if (cat === 'กระสอบใหญ่') setGlobalBigRate(val);
                          }}
                          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="w-full md:w-64">
                  <label className="text-xs text-gray-500 mb-1">คอมคงที่ (บาทต่อรายการสำเร็จ)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={globalFlatRate}
                    onChange={(e) => setGlobalFlatRate(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t mt-2">
            <button
              onClick={() => {
                setCommissionStartDate('');
                setCommissionEndDate('');
                setCommissionMode('by_product');
                setSelectedCategories(['กระสอบเล็ก', 'กระสอบใหญ่']);
                setSelectedTrackingIds({});
                setGlobalFlatRate(20.0);
                setGlobalRates({
                  'กระสอบเล็ก': 8.0,
                  'กระสอบใหญ่': 15.0,
                  'ชีวภัณฑ์': 5.0,
                });
                setGlobalSmallRate(8.0);
                setGlobalBigRate(15.0);
                setCustomSmallRates({});
                setCustomBigRates({});
                setCustomRates({});
                setCustomFlatRates({});
              }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              ล้างตัวกรองและรีเซ็ตค่าคอม
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white p-4 rounded-lg shadow-sm border mb-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">ค้นหา</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="ชื่อลูกค้า, เบอร์โทร, Order ID"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="absolute left-3 top-2.5 text-gray-400">
                  <FileText size={16} />
                </div>
              </div>
            </div>

            {/* Date Range (Delivery Date) */}
            <div className="w-full md:w-auto flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">ช่วงวันที่ส่ง</label>
              <DateRangePicker
                value={{ start: filterStartDate, end: filterEndDate }}
                onApply={(range) => {
                  setFilterStartDate(range.start);
                  setFilterEndDate(range.end);
                }}
              />
            </div>

            {/* Days Overdue */}
            <div className="w-full md:w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">ค้างชำระ (วัน)</label>
              <select
                value={filterDaysOverdue}
                onChange={(e) => setFilterDaysOverdue(e.target.value)}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">ทั้งหมด</option>
                <option value="3">เกิน 3 วัน</option>
                <option value="7">เกิน 7 วัน</option>
                <option value="15">เกิน 15 วัน</option>
                <option value="30">เกิน 30 วัน</option>
              </select>
            </div>

            {/* Tracking Status */}
            <div className="w-full md:w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">สถานะการติดตาม</label>
              <select
                value={filterTrackingStatus}
                onChange={(e) => setFilterTrackingStatus(e.target.value)}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">ทั้งหมด</option>
                <option value="never">ยังไม่เคยติดตาม</option>
                <option value="tracked">ติดตามแล้ว</option>
              </select>
            </div>

            {/* ผู้ติดตาม */}
            <div className="w-full md:w-36">
              <label className="block text-sm font-medium text-gray-700 mb-1">ผู้ติดตาม</label>
              <select
                value={filterTrackerId}
                onChange={(e) => setFilterTrackerId(e.target.value)}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="">ทั้งหมด</option>
                {trackers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

          </div>

          {/* Row 2: Toggle filters */}
          <div className="flex flex-wrap items-center gap-3 mt-3">
            {/* Toggle: ยังไม่ใส่วันรับของ */}
            <label className="flex items-center gap-2 cursor-pointer bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 hover:bg-amber-100 transition-colors">
              <input
                type="checkbox"
                checked={filterMissingReceivedDate}
                onChange={(e) => setFilterMissingReceivedDate(e.target.checked)}
                className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm font-medium text-amber-800">📦 ยังไม่ใส่วันรับของ</span>
            </label>

            {/* Toggle: เกิน 7 วัน */}
            <label className="flex items-center gap-2 cursor-pointer bg-red-50 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-100 transition-colors">
              <input
                type="checkbox"
                checked={filterOver7Days}
                onChange={(e) => setFilterOver7Days(e.target.checked)}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm font-medium text-red-800">🔴 ติดตามช้าเกิน 7 วัน</span>
            </label>
          </div>

          <div className="flex justify-end pt-2 border-t mt-2">
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterDaysOverdue('');
                setFilterTrackingStatus('');
                setFilterStartDate('');
                setFilterEndDate('');
                setFilterMissingReceivedDate(false);
                setFilterOver7Days(false);
                setFilterTrackerId('');
              }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              ล้างตัวกรองทั้งหมด
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {activeTab === 'commission' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow-sm border border-green-200 p-6">
            <div className="flex items-center gap-4">
              <div className="bg-green-200 p-3 rounded-full">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">ยอดเก็บเงินได้รวม</p>
                <p className="text-2xl font-bold text-gray-900">
                  {commissionTotals.totalCollected.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg shadow-sm border border-indigo-200 p-6">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-200 p-3 rounded-full">
                <DollarSign className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">ค่าคอมมิชชันรวมทั้งหมด</p>
                <p className="text-2xl font-bold text-gray-900">
                  {commissionTotals.totalCommission.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-sm border border-blue-200 p-6">
            <div className="flex items-center gap-4">
              <div className="bg-blue-200 p-3 rounded-full">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1 font-semibold">
                  {commissionMode === 'by_product' ? 'จำนวนสินค้าที่เก็บเงินได้' : 'จำนวนบิลที่เก็บเงินได้'}
                </p>
                <div className="text-sm text-gray-900 flex flex-wrap gap-x-2 font-semibold">
                  {commissionMode === 'by_product' ? (
                    allCategories.filter(cat => selectedCategories.includes(cat)).map((cat) => {
                      const qty = commissionTotals.categoryTotals[cat] || 0;
                      if (qty === 0) return null;
                      return (
                        <span key={cat} className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                          {qty.toLocaleString('th-TH', { maximumFractionDigits: 1 })} {cat}
                        </span>
                      );
                    }).filter(Boolean)
                  ) : (
                    <span>{commissionTotals.totalReceipts} รายการสำเร็จ</span>
                  )}
                  {commissionMode === 'by_product' && Object.values(commissionTotals.categoryTotals).reduce((a, b) => a + b, 0) === 0 && '0 ชิ้น'}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  จากทั้งหมด {commissionTotals.totalReceipts} รายการเก็บเงินสำเร็จ
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg shadow-sm border border-red-200 p-6">
            <div className="flex items-center gap-4">
              <div className="bg-red-200 p-3 rounded-full">
                <DollarSign className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">ยอดค้างชำระทั้งหมด (ทั้งระบบ)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summaryStats.totalDebt.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} บาท
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-sm border border-blue-200 p-6">
            <div className="flex items-center gap-4">
              <div className="bg-blue-200 p-3 rounded-full">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">จำนวนคำสั่งซื้อ (ทั้งระบบ)</p>
                <p className="text-2xl font-bold text-gray-900">{summaryStats.orderCount} รายการ</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'commission' ? (
        commissionLoading && groupedCommission.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
            <p className="text-gray-500">กำลังโหลดข้อมูลและคำนวณค่าคอม...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={commissionHistory.length > 0 && commissionHistory.every(r => {
                            const name = r.trackerName || 'ไม่ระบุผู้ติดตาม';
                            return selectedTrackingIds[`${name}_${r.orderId}`] !== false;
                          })}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSelectedTrackingIds(prev => {
                              const next = { ...prev };
                              commissionHistory.forEach(r => {
                                const amt = Number(r.amountCollected) || 0;
                                if (amt > 0) {
                                  const name = r.trackerName || 'ไม่ระบุผู้ติดตาม';
                                  next[`${name}_${r.orderId}`] = checked;
                                }
                              });
                              return next;
                            });
                          }}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          title="เลือก/ยกเลิกทั้งหมด"
                        />
                        <span>เลือก</span>
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ผู้ติดตาม
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      จำนวนครั้งที่ติดตาม
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      จำนวนที่เก็บเงินได้
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ยอดเก็บเงินได้รวม
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {commissionMode === 'by_product' ? 'จำนวนสินค้าที่เก็บได้' : 'อัตราคอม'}
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-72">
                      {commissionMode === 'by_product' ? 'อัตราคอม (บาทต่อชิ้น)' : 'คอมคงที่'}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-indigo-600 uppercase tracking-wider">
                      ค่าคอมมิชชันที่ได้รับ
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {groupedCommission.map((group) => {
                    const isExpanded = expandedTracker === group.trackerName;

                    let commission = 0;
                    if (commissionMode === 'by_product') {
                      Object.entries(group.categoryQuantities).forEach(([cat, qty]) => {
                        const rate = customRates[group.trackerName]?.[cat] !== undefined 
                          ? customRates[group.trackerName][cat] 
                          : (globalRates[cat] !== undefined ? globalRates[cat] : 0);
                        commission += qty * rate;
                      });
                    } else {
                      const rate = customFlatRates[group.trackerName] !== undefined 
                        ? customFlatRates[group.trackerName] 
                        : globalFlatRate;
                      commission = group.receiptCount * rate;
                    }

                    return (
                      <React.Fragment key={group.trackerName}>
                        <tr className={`hover:bg-gray-50 transition-colors ${group.receiptCount === 0 ? 'bg-gray-50/50 opacity-60' : ''}`}>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium w-24">
                            <div className="flex items-center gap-2 justify-center">
                              <input
                                type="checkbox"
                                checked={group.details.length > 0 && group.details.every(d => selectedTrackingIds[`${group.trackerName}_${d.orderId}`] !== false)}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setSelectedTrackingIds(prev => {
                                    const next = { ...prev };
                                    group.details.forEach(d => {
                                      next[`${group.trackerName}_${d.orderId}`] = checked;
                                    });
                                    return next;
                                  });
                                }}
                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                title={`เลือก/ยกเลิกทั้งหมดของ ${group.trackerName}`}
                              />
                              <button
                                onClick={() => setExpandedTracker(isExpanded ? null : group.trackerName)}
                                className="text-indigo-600 hover:text-indigo-900 transition-colors p-1"
                                title="ดูรายละเอียดการเก็บเงิน"
                              >
                                {isExpanded ? '▼' : '►'}
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {group.trackerName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                            {group.chaseCount} ครั้ง
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                            {group.receiptCount} รายการ
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                            {group.totalCollected.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                            {commissionMode === 'by_product' ? (
                              <div className="flex flex-col gap-0.5 text-xs text-left max-w-xs mx-auto">
                                {allCategories.filter(cat => selectedCategories.includes(cat)).map((cat) => {
                                  const qty = group.categoryQuantities[cat] || 0;
                                  if (qty === 0) return null;
                                  return (
                                    <div key={cat} className="flex justify-between gap-2 border-b border-gray-50 pb-0.5">
                                      <span className="text-gray-500">{cat}:</span>
                                      <span className="font-semibold text-indigo-600">{qty.toLocaleString('th-TH', { maximumFractionDigits: 1 })}</span>
                                    </div>
                                  );
                                })}
                                {Object.values(group.categoryQuantities).reduce((a, b) => a + b, 0) === 0 && (
                                  <span className="text-gray-400 text-center block">-</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-500">เรทคงที่</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                            {commissionMode === 'by_product' ? (
                              selectedCategories.length === 0 ? (
                                <span className="text-gray-400 text-xs">-</span>
                              ) : (
                                <div className="flex flex-col gap-1 items-center justify-center max-h-32 overflow-y-auto p-1">
                                  {allCategories.filter(cat => selectedCategories.includes(cat)).map((cat) => {
                                    const qty = group.categoryQuantities[cat] || 0;
                                    const isDefault = ['กระสอบเล็ก', 'กระสอบใหญ่'].includes(cat);
                                    if (qty === 0 && !isDefault) return null;

                                    const rate = customRates[group.trackerName]?.[cat] !== undefined 
                                      ? customRates[group.trackerName][cat] 
                                      : (globalRates[cat] !== undefined ? globalRates[cat] : 0);

                                    return (
                                      <div key={cat} className="flex items-center gap-1">
                                        <span className="text-[10px] text-gray-500 w-16 truncate text-right" title={cat}>{cat}:</span>
                                        <input
                                          type="number"
                                          step="0.5"
                                          min="0"
                                          value={rate}
                                          onChange={(e) => {
                                            const val = Math.max(0, Number(e.target.value) || 0);
                                            setCustomRates(prev => {
                                              const next = { ...prev };
                                              if (!next[group.trackerName]) next[group.trackerName] = {};
                                              next[group.trackerName][cat] = val;
                                              return next;
                                            });
                                          }}
                                          className="w-16 text-center p-1 border rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-xs"
                                        />
                                        <span className="text-[10px] text-gray-400">฿</span>
                                      </div>
                                    );
                                  })}
                                {customRates[group.trackerName] && Object.keys(customRates[group.trackerName]).length > 0 && (
                                  <button
                                    onClick={() => {
                                      setCustomRates(prev => {
                                        const next = { ...prev };
                                        delete next[group.trackerName];
                                        return next;
                                      });
                                    }}
                                    className="text-[10px] text-red-500 hover:underline mt-1"
                                  >
                                    รีเซ็ตของคนนี้
                                  </button>
                                )}
                              </div>
                            ) ) : (
                              <div className="flex flex-col gap-1 items-center justify-center">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="1"
                                    min="0"
                                    value={customFlatRates[group.trackerName] !== undefined ? customFlatRates[group.trackerName] : globalFlatRate}
                                    onChange={(e) => {
                                      const val = Math.max(0, Number(e.target.value) || 0);
                                      setCustomFlatRates(prev => ({
                                        ...prev,
                                        [group.trackerName]: val
                                      }));
                                    }}
                                    className="w-20 text-center p-1.5 border rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-xs font-semibold"
                                  />
                                  <span className="text-xs text-gray-500">บาท / บิล</span>
                                </div>
                                {customFlatRates[group.trackerName] !== undefined && (
                                  <button
                                    onClick={() => {
                                      setCustomFlatRates(prev => {
                                        const next = { ...prev };
                                        delete next[group.trackerName];
                                        return next;
                                      });
                                    }}
                                    className="text-[10px] text-red-500 hover:underline mt-0.5"
                                  >
                                    รีเซ็ตของคนนี้
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-indigo-600">
                            {commission.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan={8} className="bg-indigo-50 bg-opacity-30 px-8 py-4">
                              <div className="bg-white rounded-lg shadow-inner border border-indigo-100 overflow-hidden">
                                <div className="p-3 bg-indigo-50 text-indigo-900 text-xs font-semibold uppercase tracking-wider border-b border-indigo-100">
                                  รายละเอียดรายการที่เก็บเงินได้ของ {group.trackerName}
                                </div>
                                {group.details.length === 0 ? (
                                  <div className="p-4 text-center text-gray-500 text-sm">
                                    ไม่มีรายการเก็บเงินได้ในช่วงเวลานี้
                                  </div>
                                ) : (
                                  <>
                                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                                      <thead className="bg-gray-50 text-xs text-gray-500">
                                        <tr>
                                          <th className="px-4 py-2 text-left font-medium w-10">
                                            <input
                                              type="checkbox"
                                              checked={group.details.length > 0 && group.details.every(d => selectedTrackingIds[`${group.trackerName}_${d.orderId}`] !== false)}
                                              onChange={(e) => {
                                                const checked = e.target.checked;
                                                setSelectedTrackingIds(prev => {
                                                  const next = { ...prev };
                                                  group.details.forEach(d => {
                                                    next[`${group.trackerName}_${d.orderId}`] = checked;
                                                  });
                                                  return next;
                                                });
                                              }}
                                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            />
                                          </th>
                                          <th className="px-4 py-2 text-left font-medium">Order ID</th>
                                          <th className="px-4 py-2 text-left font-medium">วันที่ตาม</th>
                                          <th className="px-4 py-2 text-left font-medium">ชื่อลูกค้า</th>
                                          <th className="px-4 py-2 text-right font-medium">ยอดเก็บได้</th>
                                          <th className="px-4 py-2 text-center font-medium">สินค้าที่เก็บได้</th>
                                          <th className="px-4 py-2 text-right font-medium text-indigo-600">ค่าคอมที่ได้รับ</th>
                                          <th className="px-4 py-2 text-center font-medium">ผลการติดตาม</th>
                                          <th className="px-4 py-2 text-left font-medium">หมายเหตุ</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-100">
                                        {group.details.slice((detailPage - 1) * detailPageSize, detailPage * detailPageSize).map((detail, idx) => {
                                          const isSelected = selectedTrackingIds[`${group.trackerName}_${detail.orderId}`] !== false;
                                          
                                          let potentialCommission = 0;
                                          if (commissionMode === 'by_product') {
                                            if (detail.recordBags) {
                                              Object.entries(detail.recordBags).forEach(([cat, qty]) => {
                                                const rate = customRates[group.trackerName]?.[cat] !== undefined 
                                                  ? customRates[group.trackerName][cat] 
                                                  : (globalRates[cat] !== undefined ? globalRates[cat] : 0);
                                                potentialCommission += (qty as number) * rate;
                                              });
                                            } else {
                                              const smallRate = customRates[group.trackerName]?.['กระสอบเล็ก'] !== undefined ? customRates[group.trackerName]['กระสอบเล็ก'] : (globalRates['กระสอบเล็ก'] || 8);
                                              const bigRate = customRates[group.trackerName]?.['กระสอบใหญ่'] !== undefined ? customRates[group.trackerName]['กระสอบใหญ่'] : (globalRates['กระสอบใหญ่'] || 15);
                                              potentialCommission = (detail.smallBags * smallRate) + (detail.bigBags * bigRate);
                                            }
                                          } else {
                                            const rate = customFlatRates[group.trackerName] !== undefined 
                                              ? customFlatRates[group.trackerName] 
                                              : globalFlatRate;
                                            potentialCommission = rate;
                                          }

                                          return (
                                            <tr key={`${detail.orderId}-${idx}`} className={`hover:bg-gray-50 transition-all ${isSelected ? '' : 'bg-gray-50/50 opacity-60'}`}>
                                              <td className="px-4 py-2 whitespace-nowrap">
                                                <input
                                                  type="checkbox"
                                                  checked={isSelected}
                                                  onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setSelectedTrackingIds(prev => ({
                                                      ...prev,
                                                      [`${group.trackerName}_${detail.orderId}`]: checked
                                                    }));
                                                  }}
                                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                />
                                              </td>
                                              <td className="px-4 py-2 font-medium">
                                                <button
                                                  onClick={() => handleViewDetail({ id: detail.orderId } as Order)}
                                                  className="text-blue-600 hover:underline"
                                                >
                                                  {detail.orderId}
                                                </button>
                                              </td>
                                              <td className="px-4 py-2 text-gray-600">
                                                {new Date(detail.trackingDate).toLocaleString('th-TH', {
                                                  day: 'numeric',
                                                  month: 'short',
                                                  year: '2-digit',
                                                  hour: '2-digit',
                                                  minute: '2-digit'
                                                })}
                                              </td>
                                              <td className="px-4 py-2 text-gray-900">{detail.customerName}</td>
                                              <td className={`px-4 py-2 text-right font-semibold ${isSelected ? 'text-green-600' : 'text-gray-400 line-through'}`}>
                                                {detail.amountCollected.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                                              </td>
                                              <td className={`px-4 py-2 text-center text-xs ${isSelected ? 'text-gray-600' : 'text-gray-400 line-through'}`}>
                                                {commissionMode === 'by_product' ? (
                                                  <div className="flex flex-col gap-0.5 items-center">
                                                    {allCategories.filter(cat => selectedCategories.includes(cat)).map((cat) => {
                                                      const qty = detail.recordBags?.[cat] || 0;
                                                      if (qty === 0) return null;
                                                      return (
                                                        <span key={cat} className="block text-[11px]">
                                                          {qty.toLocaleString('th-TH', { maximumFractionDigits: 1 })} {cat}
                                                        </span>
                                                      );
                                                    })}
                                                    {Object.values(detail.recordBags || {}).reduce((a: any, b: any) => a + b, 0) === 0 && '-'}
                                                  </div>
                                                ) : (
                                                  <span className="text-gray-500">เรทคงที่</span>
                                                )}
                                              </td>
                                              <td className={`px-4 py-2 text-right font-semibold ${isSelected ? 'text-indigo-600' : 'text-gray-400 line-through'}`}>
                                                {potentialCommission.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
                                              </td>
                                              <td className="px-4 py-2 text-center">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                  {detail.resultStatus}
                                                </span>
                                              </td>
                                              <td className="px-4 py-2 text-gray-500 truncate max-w-xs" title={detail.note}>
                                                {detail.note || '-'}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>

                                    {/* sub-table pagination controls */}
                                    {group.details.length > 0 && (
                                      <div className="flex flex-col sm:flex-row justify-between items-center px-4 py-2.5 border-t bg-gray-50 text-xs text-gray-600 font-medium gap-2">
                                        <div className="flex items-center gap-4">
                                          <div>
                                            แสดง {Math.min(group.details.length, (detailPage - 1) * detailPageSize + 1)} ถึง {Math.min(group.details.length, detailPage * detailPageSize)} จากทั้งหมด {group.details.length} รายการ
                                          </div>
                                          <div className="flex items-center gap-1.5">
                                            <span>แสดงหน้าละ:</span>
                                            <select
                                              value={detailPageSize}
                                              onChange={(e) => {
                                                setDetailPageSize(Number(e.target.value));
                                                setDetailPage(1);
                                              }}
                                              className="border border-gray-300 rounded px-1.5 py-0.5 bg-white text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                            >
                                              <option value={5}>5</option>
                                              <option value={10}>10</option>
                                              <option value={20}>20</option>
                                              <option value={50}>50</option>
                                              <option value={100}>100</option>
                                            </select>
                                            <span>รายการ</span>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() => setDetailPage(prev => Math.max(1, prev - 1))}
                                            disabled={detailPage === 1}
                                            className="p-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-500 transition-colors"
                                          >
                                            <ChevronLeft size={14} />
                                          </button>
                                          
                                          {Array.from({ length: Math.ceil(group.details.length / detailPageSize) }, (_, i) => i + 1).map(page => (
                                            <button
                                              key={`detail-page-${page}`}
                                              onClick={() => setDetailPage(page)}
                                              className={`px-2.5 py-1 rounded border text-xs font-semibold transition-colors ${detailPage === page
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                : 'border-gray-300 bg-white hover:bg-gray-50 text-gray-700'
                                              }`}
                                            >
                                              {page}
                                            </button>
                                          ))}

                                          <button
                                            onClick={() => setDetailPage(prev => Math.min(Math.ceil(group.details.length / detailPageSize), prev + 1))}
                                            disabled={detailPage === Math.ceil(group.details.length / detailPageSize)}
                                            className="p-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-500 transition-colors"
                                          >
                                            <ChevronRight size={14} />
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {groupedCommission.length === 0 && !commissionLoading && (
              <div className="text-center py-12 text-gray-500">
                <p>ไม่พบประวัติการติดตามหนี้เพื่อคำนวณค่าคอมในช่วงเวลาที่กำหนด</p>
              </div>
            )}
          </div>
        )
      ) : (
        loading && orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
            <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
          </div>
        ) : (
          <>
            {/* Pagination Controls - Top */}
            <div className="bg-white rounded-lg shadow-sm border p-4 mb-4">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>แสดง</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                    className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                  >
                    {PAGE_SIZE_OPTIONS.map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                  <span>รายการต่อหน้า</span>
                  <span className="ml-4">
                    แสดง {displayStart}-{displayEnd} จาก {totalOrders} รายการ
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  {getPageNumbers().map((page, idx) => (
                    page === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page as number)}
                        className={`px-3 py-1 rounded-md border text-sm font-medium ${currentPage === page
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 hover:bg-gray-50'
                          }`}
                      >
                        {page}
                      </button>
                    )
                  ))}

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Custom Orders Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ลูกค้า
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        เบอร์โทร
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        วันจัดส่ง
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        วันรับของ
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ยอด
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-orange-500 uppercase tracking-wider">
                        ยอดรอตรวจ
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        จำนวนครั้ง
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ติดตามล่าสุด
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ติดตาม
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {orders.map((order) => {
                      const customerInfo = (order as any).customerInfo;
                      const remainingDebt = (order as any).remainingDebt;
                      const totalAmount = order.totalAmount;
                      const collected = (order as any).totalDebtCollected;
                      const pendingSlipAmount = (order as any).pendingSlipAmount || 0;
                      const hasPendingSlips = (order as any).hasPendingSlips || false;
                      const isPendingFullyCovered = hasPendingSlips && remainingDebt <= 0;

                      return (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex flex-col items-start gap-1">
                              <button
                                onClick={() => handleViewDetail(order)}
                                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                              >
                                {order.id}
                              </button>
                              {(order as any).paymentStatus === 'BadDebt' || (order as any).orderStatus === 'BadDebt' || (order as any).order_status === 'BadDebt' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800">
                                  <AlertOctagon size={10} className="mr-1" />
                                  หนี้สูญ
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {customerInfo ? `${customerInfo.firstName} ${customerInfo.lastName}` : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {customerInfo?.phone ? (
                              <a href={`tel:${customerInfo.phone}`} className="flex items-center gap-1 text-blue-600 hover:text-blue-800">
                                <Phone size={14} />
                                {customerInfo.phone}
                              </a>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {(order as any).deliveryDate ? (
                              <div className="flex flex-col">
                                <span>{new Date((order as any).deliveryDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                                <span className="text-xs text-gray-500">ผ่านมา {(order as any).daysPassed} วัน</span>
                              </div>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {(order as any).customerReceivedDate ? (
                              <span>{new Date((order as any).customerReceivedDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                            ) : (
                              <span className="text-gray-300 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-gray-900">
                                {totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </span>
                              <span className="text-xs text-green-600">
                                ตามได้: {collected > 0 ? collected.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '-'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                            {hasPendingSlips ? (
                              <div className="flex flex-col items-end">
                                <span className="inline-flex items-center gap-1 text-orange-600 font-semibold">
                                  <Clock size={12} />
                                  {pendingSlipAmount.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </span>
                                <span className="text-[10px] text-orange-500">รอตรวจสอบ</span>
                              </div>
                            ) : (
                              <span className="text-gray-300 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-600">
                            {(order as any).trackingCount > 0 ? (
                              <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                {(order as any).trackingCount} ครั้ง
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {(order as any).lastTrackingDate ? (
                              <span>{new Date((order as any).lastTrackingDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <div className="flex flex-col items-center gap-1">
                              {isPendingFullyCovered && (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-600 text-[10px] font-medium rounded"
                                  title={`มีสลิปยอด ฿${pendingSlipAmount.toLocaleString()} รอการตรวจสอบ`}
                                >
                                  <Clock size={10} />
                                  มีการแนบสลิปนอกระบบติดตามหนี้ครบแล้ว
                                </span>
                              )}
                              <button
                                onClick={() => handleTrackClick(order)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors"
                              >
                                <FileText size={14} />
                                ติดตาม
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {orders.length === 0 && !loading && (
                <div className="text-center py-12 text-gray-500">
                  <p>ไม่พบข้อมูลรายการหนี้</p>
                </div>
              )}
            </div>

            {/* Pagination Controls - Bottom */}
            <div className="bg-white rounded-lg shadow-sm border p-4 mt-4">
              <div className="flex justify-center items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={18} />
                </button>

                {getPageNumbers().map((page, idx) => (
                  page === '...' ? (
                    <span key={`bottom-ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                  ) : (
                    <button
                      key={`bottom-${page}`}
                      onClick={() => handlePageChange(page as number)}
                      className={`px-3 py-1 rounded-md border text-sm font-medium ${currentPage === page
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                      {page}
                    </button>
                  )
                ))}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </>
        )
      )}

      {/* Debt Collection Modal */}
      {
        selectedOrder && trackModalOpen && (
          <DebtCollectionModal
            isOpen={trackModalOpen}
            onClose={() => {
              setTrackModalOpen(false);
              setSelectedOrder(null);
            }}
            order={selectedOrder}
            currentUser={user}
            onSuccess={handleTrackSuccess}
            isCompletedView={activeTab === 'completed'}
            onViewDetail={handleViewDetail}
          />
        )
      }

      {/* Order Detail Modal */}
      {
        detailSelectedOrder && detailModalOpen && (
          <OrderDetailModal
            isOpen={detailModalOpen}
            onClose={() => {
              setDetailModalOpen(false);
              setDetailSelectedOrder(null);
            }}
            orderId={detailSelectedOrder.id}
          />
        )
      }

      {/* CSV Export Modal */}
      {
        showExportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-bold text-gray-800 mb-4">ดาวน์โหลดรายงาน</h3>
              <div className="space-y-4">
                {/* Export Type Toggle */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ประเภทข้อมูล</label>
                  <div className="flex rounded-lg border overflow-hidden">
                    <button
                      onClick={() => setExportType('history')}
                      className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${exportType === 'history'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      📋 ประวัติการติดตาม
                    </button>
                    <button
                      onClick={() => setExportType('orders')}
                      className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${exportType === 'orders'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      📦 ข้อมูลออเดอร์
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {exportType === 'history'
                      ? 'แต่ละรายการติดตาม + ผู้ติดตาม + ยอดเก็บ (สำหรับคำนวณค่าคอม)'
                      : 'ข้อมูลสรุประดับออเดอร์ (ยอดรวม, ยอดค้าง)'}
                  </p>
                </div>

                {/* Status Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">สถานะเคส</label>
                  <select
                    value={exportStatus}
                    onChange={(e) => setExportStatus(e.target.value as 'active' | 'completed')}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="">-- เลือกสถานะ --</option>
                    <option value="all">ทั้งหมด</option>
                    <option value="active">กำลังติดตาม</option>
                    <option value="completed">จบเคสแล้ว</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    วันที่เริ่มต้น ({exportType === 'history' ? 'วันที่ติดตาม' : 'วันที่ส่ง'})
                  </label>
                  <input
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    วันที่สิ้นสุด ({exportType === 'history' ? 'วันที่ติดตาม' : 'วันที่ส่ง'})
                  </label>
                  <input
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={exporting}
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handlePrepareExport}
                  disabled={exporting || !exportStartDate || !exportEndDate || !exportStatus}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download size={16} />
                  ถัดไป
                </button>
              </div>
            </div>
          </div>
        )
      }

      <ExportTypeModal
        isOpen={showFormatModal}
        onClose={() => setShowFormatModal(false)}
        onConfirm={executeExport}
        isExporting={exporting}
      />
    </div >
  );
};

export default DebtCollectionPage;
