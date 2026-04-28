import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { User, Order, OrderStatus } from "../types";
import { listOrders, saveReturnOrders, getReturnOrders, getReturnStats, getOrder, revertReturnedOrder, exportReturnOrders, uploadReturnImage, getReturnImages, deleteReturnImage } from "../services/api";
import resolveApiBasePath from "../utils/apiBasePath";
import * as XLSX from "xlsx";
import {
  Camera,
  Search,
  Plus,
  Filter,
  RefreshCw,
  CheckCircle,
  X,
  Upload,
  Download,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Edit2,
  Trash2,
  FileText,
  AlertCircle,
  Clock,
  ThumbsUp,
  AlertTriangle,
  Copy,
  XCircle,
  ArrowLeftRight,
  RotateCcw,
} from "lucide-react";
import OrderDetailModal from "../components/OrderDetailModal";
import BulkReturnImport from "../components/BulkReturnImport";
import Spinner from "../components/Spinner";
import DateRangePicker, { DateRange } from "../components/DateRangePicker";
import ExportTypeModal from "../components/ExportTypeModal";
import { downloadDataFile } from "../utils/exportUtils";

interface ReturnManagementPageProps {
  user: User;
}

interface ImportRow {
  orderNumber: string;
  note?: string;
}

// Helper: Handle mixed API response cases (camelCase vs snake_case)
const getOrderAmount = (order: any): number => {
  return Number(order.totalAmount ?? order.total_amount ?? 0);
};

interface MatchResult {
  importRow: ImportRow;
  matchedOrder?: Order;
  matchedSubOrderId?: string | null;
  status:
  | "matched"
  | "unmatched_system"
  | "unmatched_file"
  | "amount_mismatch"
  | "already_verified";
  diff: number;
}

interface VerifiedOrder {
  id: number;
  sub_order_id: string;
  tracking_number: string;
  return_amount: number;
  status: string;
  note: string;
  created_at: string;
  // Extra fields joined
  total_amount?: number;
  order_date?: string;
  main_order_id?: string;
  updated_at?: string;
  total_boxes?: number;
  return_complete?: number;
  return_claim?: number;
  returned_by?: number;
  returned_by_name?: string;
}

const ReturnManagementPage: React.FC<ReturnManagementPageProps> = ({
  user,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"list" | "verify">("list");
  const [importedData, setImportedData] = useState<ImportRow[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  // Tabs state
  const [activeTab, setActiveTab] = useState<
    "pending" | "returning" | "good" | "damaged" | "lost" | "delivered"
  >("returning");
  const [verifiedOrders, setVerifiedOrders] = useState<VerifiedOrder[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Order Detail Modal State
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Paste Modal State
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteContent, setPasteContent] = useState("");
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const pasteInputRef = useRef<HTMLTextAreaElement>(null);

  // Import Status Selection
  const [importTargetStatus, setImportTargetStatus] = useState<
    "returning"
  >("returning");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isImportStatusModalOpen, setIsImportStatusModalOpen] = useState(false);

  // Search State
  const [searchTracking, setSearchTracking] = useState("");
  const [searchOrderId, setSearchOrderId] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState(false);

  // Manage Modal State
  const [showExportPopup, setShowExportPopup] = useState(false);
  const [managingOrder, setManagingOrder] = useState<Order | null>(null);
  interface ManageRow {
    trackingNumber: string;

    subOrderId: string | null;
    status: "pending" | "returning" | "delivered" | "delivering" | "other" | "lost" | "good" | "damaged";
    collectedAmount?: number;
    note: string;
    items: any[];
    originalStatus: string; // Track initial status for constraints
    returnComplete?: boolean;
    returnClaim?: number;
    boxPrice?: number;
  }
  const [manageRows, setManageRows] = useState<ManageRow[]>([]);

  // State for Revert Returned Order Modal
  const [isRevertModalOpen, setIsRevertModalOpen] = useState(false);
  const [revertOrderId, setRevertOrderId] = useState<string>("");
  const [revertNewStatus, setRevertNewStatus] = useState<string>("Shipping");
  const [revertLoading, setRevertLoading] = useState(false);

  const revertStatusOptions = [
    { value: 'Pending', label: 'รอดำเนินการ' },
    { value: 'AwaitingVerification', label: 'รอตรวจสอบ' },
    { value: 'Confirmed', label: 'ยืนยันแล้ว' },
    { value: 'Preparing', label: 'กำลังจัดเตรียม' },
    { value: 'Picking', label: 'กำลังหยิบสินค้า' },
    { value: 'Shipping', label: 'กำลังจัดส่ง' },
    { value: 'PreApproved', label: 'รอตรวจสอบจากบัญชี' },
    { value: 'Delivered', label: 'ส่งสำเร็จ' },
    { value: 'Cancelled', label: 'ยกเลิก' },
    { value: 'Claiming', label: 'เคลม' },
    { value: 'BadDebt', label: 'หนี้เสีย' },
  ];

  // State for Bulk Import Modal
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkImportMode, setBulkImportMode] = useState<"returning" | "good" | "damaged" | "lost">("returning");

  // Pagination State
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    hasMore: false,
  });

  // Filter Date Ranges
  const [orderDateRange, setOrderDateRange] = useState<DateRange>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1); start.setHours(0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); end.setHours(23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
  });
  const [returnDateRange, setReturnDateRange] = useState<DateRange>({ start: '', end: '' });
  const [orderDateShowAll, setOrderDateShowAll] = useState(false);
  const [returnDateShowAll, setReturnDateShowAll] = useState(true);

  // Export State
  const [exportDateRange, setExportDateRange] = useState<DateRange>(() => {
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const start = new Date(); start.setDate(start.getDate() - 30); start.setHours(0, 0, 0, 0);
    return { start: start.toISOString(), end: end.toISOString() };
  });
  const [exporting, setExporting] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Advanced Filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advFilters, setAdvFilters] = useState({
    caseStatus: '' as '' | 'closed' | 'open',
    hasClaim: '' as '' | 'yes' | 'no',
    claimMin: '',
    claimMax: '',
    amountMin: '',
    amountMax: '',
    hasImage: '' as '' | 'yes' | 'no',
    hasNote: '' as '' | 'yes' | 'no',
  });
  const activeFilterCount = Object.values(advFilters).filter(v => v !== '').length;

  // Tab counts from stats API (fetched once)
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({});
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (managingOrder) {
      const rows: ManageRow[] = [];

      // Logic to extract tracking numbers and sub_order_ids

      // Normalize data sources handling both camelCase and snake_case
      const trackingDetails =
        managingOrder.trackingDetails ||
        (managingOrder as any).tracking_details;
      const trackingNumbersArr =
        managingOrder.trackingNumbers ||
        (Array.isArray((managingOrder as any).tracking_numbers)
          ? (managingOrder as any).tracking_numbers
          : []);
      const trackingNumbersStr =
        typeof (managingOrder as any).tracking_numbers === "string"
          ? (managingOrder as any).tracking_numbers
          : "";

      if (Array.isArray(trackingDetails) && trackingDetails.length > 0) {
        trackingDetails.forEach((d: any) => {
          const tNum = d.trackingNumber || d.tracking_number;
          if (tNum) {
            const sId =
              d.sub_order_id || d.subOrderId || d.order_id || d.orderId || null;
            // Filter items by subOrderId/Box
            let relevantItems: any[] = [];
            if (
              sId &&
              managingOrder.items &&
              Array.isArray(managingOrder.items)
            ) {
              // Extract box number from subOrderId (Pattern: {MainID}-{BoxNum})
              // e.g. 241225-0001-1 => Box 1
              const parts = sId.split("-");
              const boxNumStr = parts[parts.length - 1];
              const boxNum = parseInt(boxNumStr);

              if (!isNaN(boxNum)) {
                relevantItems = managingOrder.items.filter(
                  (i: any) => i.box_number == boxNum || i.boxNumber == boxNum,
                );
              } else {
                // Fallback: if no box suffix, maybe it's the main order (Box 1 default?)
                // Or just show all? Better safe than empty.
                // If subOrderId == mainID, it means Box 1 usually.
                if (sId === managingOrder.id) {
                  relevantItems = managingOrder.items.filter(
                    (i: any) => !i.box_number || i.box_number == 1,
                  );
                }
              }
            }

            rows.push({
              trackingNumber: tNum,
              subOrderId: sId,
              status: "pending",
              collectedAmount: 0,
              note: "",
              originalStatus: "pending",
              items: relevantItems,
            });
          }
        });
      }
      // Priority 2: Tracking Numbers Array (Simple list)
      else if (
        Array.isArray(trackingNumbersArr) &&
        trackingNumbersArr.length > 0
      ) {
        trackingNumbersArr.forEach((t) => {
          if (t) {
            rows.push({
              trackingNumber: t,
              subOrderId: null,
              status: "pending",
              collectedAmount: 0,
              note: "",
              originalStatus: "pending",
              items: [], // Cannot determine specific items without subOrderId mapping
            });
          }
        });
      }
      // Priority 3: Tracking Numbers String (Comma separated)
      else if (trackingNumbersStr) {
        const parts = trackingNumbersStr.split(",");
        parts.forEach((t) => {
          if (t.trim()) {
            rows.push({
              trackingNumber: t.trim(),
              subOrderId: null,
              status: "pending",
              collectedAmount: 0,
              note: "",
              originalStatus: "pending",
              items: [],
            });
          }
        });
      }

      // Remove duplicates based on tracking number if any
      const uniqueRows = rows.filter(
        (v, i, a) =>
          a.findIndex((t) => t.trackingNumber === v.trackingNumber) === i,
      );

      // Pre-fill with Verified Data
      const mergedRows = uniqueRows.map((row) => {
        const verified = verifiedOrders.find(
          (v) =>
            (row.subOrderId && v.sub_order_id === row.subOrderId) ||
            (v.tracking_number && v.tracking_number === row.trackingNumber) ||
            v.sub_order_id === row.trackingNumber, // Fallback for old data where sub_order_id = tracking
        );

        if (verified) {
          return {
            ...row,
            status: verified.status as any,
            note: verified.note || "",
            originalStatus: verified.status as any,
            returnComplete: Number(verified.return_complete) === 1,
            returnClaim: verified.return_claim != null ? Number(verified.return_claim) : undefined,
            boxPrice: verified.return_amount != null ? Number(verified.return_amount) : undefined,
          };
        }

        // Fallback: check boxes data from the order for return_status
        const boxes = (managingOrder as any).boxes || [];
        const matchedBox = boxes.find((b: any) =>
          (row.subOrderId && b.sub_order_id === row.subOrderId) ||
          (row.subOrderId && `${(managingOrder as any).id}-${b.box_number}` === row.subOrderId)
        );
        if (matchedBox && matchedBox.return_status) {
          return {
            ...row,
            status: matchedBox.return_status as any,
            note: matchedBox.return_note || "",
            originalStatus: matchedBox.return_status as any,
            returnComplete: Number(matchedBox.return_complete) === 1,
            returnClaim: matchedBox.return_claim != null ? Number(matchedBox.return_claim) : undefined,
            boxPrice: matchedBox.cod_amount != null ? Number(matchedBox.cod_amount) : undefined,
          };
        }

        return {
          ...row,
          originalStatus: "pending", // If not found in verifiedOrders or boxes, treat as pending
        };
      });

      setManageRows(mergedRows);
    }
  }, [managingOrder, verifiedOrders]);

  useEffect(() => {
    // Reset to page 1 when tab or date range changes, then fetch
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [activeTab, orderDateRange, returnDateRange, orderDateShowAll, returnDateShowAll]);

  useEffect(() => {
    fetchVerifiedOrders();
  }, [user.companyId, activeTab, pagination.page, pagination.limit, filterSearch, orderDateRange, returnDateRange, orderDateShowAll, returnDateShowAll, advFilters]);

  // Fetch stats once on mount + when tab data changes (after save/revert)
  const fetchReturnStats = async () => {
    try {
      setStatsLoading(true);
      const res = await getReturnStats({
        companyId: user.companyId,
        orderDateFrom: !orderDateShowAll && orderDateRange.start ? orderDateRange.start.split('T')[0] : undefined,
        orderDateTo: !orderDateShowAll && orderDateRange.end ? orderDateRange.end.split('T')[0] : undefined,
        returnDateFrom: !returnDateShowAll && returnDateRange.start ? returnDateRange.start.split('T')[0] : undefined,
        returnDateTo: !returnDateShowAll && returnDateRange.end ? returnDateRange.end.split('T')[0] : undefined,
      });
      if (res && res.status === 'success' && res.counts) {
        setTabCounts(res.counts);
      }
    } catch (err) {
      console.error('Failed to fetch return stats', err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchReturnStats();
  }, [user.companyId, orderDateRange, returnDateRange, orderDateShowAll, returnDateShowAll]);

  const fetchVerifiedOrders = async () => {
    try {
      setLoading(true);

      const res = await getReturnOrders({
        status: activeTab,
        page: pagination.page,
        limit: pagination.limit,
        companyId: user.companyId,
        search: filterSearch || undefined,
        orderDateFrom: !orderDateShowAll && orderDateRange.start ? orderDateRange.start.split('T')[0] : undefined,
        orderDateTo: !orderDateShowAll && orderDateRange.end ? orderDateRange.end.split('T')[0] : undefined,
        returnDateFrom: !returnDateShowAll && returnDateRange.start ? returnDateRange.start.split('T')[0] : undefined,
        returnDateTo: !returnDateShowAll && returnDateRange.end ? returnDateRange.end.split('T')[0] : undefined,
        // Advanced filters
        caseStatus: advFilters.caseStatus || undefined,
        hasClaim: advFilters.hasClaim || undefined,
        claimMin: advFilters.claimMin || undefined,
        claimMax: advFilters.claimMax || undefined,
        amountMin: advFilters.amountMin || undefined,
        amountMax: advFilters.amountMax || undefined,
        hasImage: advFilters.hasImage || undefined,
        hasNote: advFilters.hasNote || undefined,
      });

      if (res && res.status === "success") {
        setVerifiedOrders(res.data);
        if (res.pagination) {
          setPagination(prev => ({
            ...prev,
            hasMore: res.pagination.hasMore ?? false,
          }));
        }
      }
    } catch (err) {
      console.error("Failed to fetch verified orders", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    // Legacy fetch for Pending/Checking logic (kept as is)
  };

  const handleSearchByTracking = async () => {
    if (!searchTracking.trim()) {
      alert("กรุณาระบุเลขพัสดุ (Tracking No.)");
      return;
    }

    setLoading(true);
    try {
      const res = await listOrders({
        companyId: user.companyId,
        trackingNumber: searchTracking.trim(),
        pageSize: 1,
      });

      if (res.ok && res.orders.length > 0) {
        const foundOrder = res.orders[0];
        setManagingOrder(foundOrder);
        setSearchTracking(""); // Clear search after found
      } else {
        alert("ไม่พบคำสั่งซื้อที่มีเลขพัสดุนี้");
      }
    } catch (err) {
      console.error("Search failed", err);
      alert("เกิดข้อผิดพลาดในการค้นหา");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchByOrderId = async () => {
    if (!searchOrderId.trim()) {
      alert("กรุณาระบุเลข Order ID");
      return;
    }
    setLoading(true);
    try {
      const res = await listOrders({
        companyId: user.companyId,
        orderId: searchOrderId.trim(),
        pageSize: 1,
      });
      if (res.ok && res.orders.length > 0) {
        setManagingOrder(res.orders[0]);
        setSearchOrderId("");
      } else {
        alert("ไม่พบคำสั่งซื้อที่มี Order ID นี้");
      }
    } catch (err) {
      console.error("Search failed", err);
      alert("เกิดข้อผิดพลาดในการค้นหา");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const headers = [["Tracking Number", "Note (Optional)"]];
    const ws = XLSX.utils.aoa_to_sheet(headers);

    // Add some example data? No, keep it clean.
    // Set col width
    ws["!cols"] = [{ wch: 20 }, { wch: 30 }];

    XLSX.utils.book_append_sheet(wb, ws, "ReturnTemplate");
    XLSX.writeFile(wb, "Return_Verification_Template.xlsx");
  };

  const handlePasteVerification = () => {
    if (!pasteContent.trim()) return;

    // Parse tab-separated values (Excel copy)
    const rows = pasteContent.trim().split(/\r?\n/);
    const parsed: ImportRow[] = [];

    rows.forEach((rowStr) => {
      const cols = rowStr.split("\t");
      if (cols.length < 2) return; // Skip invalid lines

      const rawOrder = cols[0].trim();
      // Skip amount column (previously index 1), note is now index 1 or 2 depending on if user kept column B or not?
      // User said "remove amount from template", so template is now [Tracking, Note].
      // But user also said "paste Excel", users might still paste 3 columns if they use old template?
      // To be safe: If 2 columns -> Tracking, Note. If 3 columns -> Tracking, Amount(ignored), Note?
      // The prompt says "remove column amount from template... import system don't need to store amount".
      // Assuming user uses NEW template: Column A = Tracking, Column B = Note.
      const rawNote = cols[1] ? cols[1].at(0) === '=' ? cols[1].trim().substring(1) : cols[1].trim() : ""; // Handle Excel formula paste

      if (rawOrder) {
        parsed.push({
          orderNumber: rawOrder,
          note: rawNote,
        });
      }
    });

    if (parsed.length > 0) {
      setImportedData(parsed);
      performMatching(parsed, orders, verifiedOrders, importTargetStatus || "returning");
      setMode("verify");
      setIsPasteModalOpen(false);
      setPasteContent("");
    } else {
      alert(
        "ไม่พบข้อมูลที่ถูกต้อง กรุณาตรวจสอบรูปแบบข้อมูล (Tracking Number [Tab] Note)",
      );
    }
  };

  const handleManageSave = async () => {
    if (!managingOrder) return;

    // Filter for actions
    // Allow sending 'pending' to clear status
    const actionRows = manageRows;

    if (actionRows.length === 0) {
      alert("กรุณาเลือกสถานะอย่างน้อย 1 รายการ");
      return;
    }

    // Open Confirmation Modal instead of window.confirm
    setIsConfirmSaveOpen(true);
  };

  const executeSave = async () => {
    // Re-filter to get action rows (as closure might be stale, but state should be fresh)
    const actionRows = manageRows;

    setLoading(true);
    try {
      // Prepare payload for all actioned items
      // Prepare payload for all actioned items
      const payload = actionRows.map((r) => ({
        sub_order_id: r.subOrderId || managingOrder?.id || "", // Fallback to main ID if sub is missing
        status: r.status || "returning", // Use row status directly (Manual Manage Mode)
        collected_amount: r.collectedAmount || 0,
        note: r.note || "",
        tracking_number: r.trackingNumber, // Essential for new flow
        return_complete: r.returnComplete ? 1 : 0,
        return_claim: r.returnClaim ?? null,
      }));

      const res = await saveReturnOrders(payload, user.id);
      if (res && res.status === "success") {
        // Check if there are errors despite "success" status
        if (res.errors && res.errors.length > 0 && res.updatedCount === 0) {
          alert("ไม่สามารถอัปเดตได้:\n" + res.errors.join("\n"));
        } else if (res.errors && res.errors.length > 0) {
          alert(`บันทึกสำเร็จ ${res.updatedCount} รายการ\nแต่มีข้อผิดพลาด:\n` + res.errors.join("\n"));
          setManagingOrder(null);
          setIsConfirmSaveOpen(false);
          fetchOrders();
          fetchVerifiedOrders();
          fetchReturnStats();
        } else {
          alert(`บันทึกข้อมูลเรียบร้อย (${res.updatedCount} รายการ)`);
          setManagingOrder(null);
          setIsConfirmSaveOpen(false);
          fetchOrders();
          fetchVerifiedOrders();
          fetchReturnStats();
        }
      } else {
        alert("เกิดข้อผิดพลาด: " + (res?.message || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  const handleManageVerified = async (v: VerifiedOrder) => {
    setLoading(true);
    try {
      // Extract Main Order ID
      // Format 1: 241225-0001 (Main)
      // Format 2: 241225-0001-1 (Sub/Box)
      // Logic: Extract the main order ID from sub_order_id by removing the last part
      const subOrderId = v.sub_order_id || "";
      const parts = subOrderId.split("-");
      // Check if last part looks like a box number (numeric)
      const lastPart = parts[parts.length - 1];
      const isBoxNumber = /^\d+$/.test(lastPart) && parts.length > 2;
      const mainOrderId = isBoxNumber
        ? parts.slice(0, -1).join("-")
        : subOrderId;

      // Use getOrder for single order lookup (path-based: /orders/{id})
      const res = await getOrder(mainOrderId);

      if (res && res.ok && res.order) {
        setManagingOrder(res.order);
      } else if (v.tracking_number) {
        // Fallback: try with tracking number if not found by ID
        const res2 = await listOrders({
          companyId: user.companyId,
          trackingNumber: v.tracking_number,
          pageSize: 1,
        });
        if (res2.ok && res2.orders.length > 0) {
          setManagingOrder(res2.orders[0]);
        } else {
          alert("ไม่พบข้อมูลคำสั่งซื้อในระบบ");
        }
      } else {
        alert("ไม่พบข้อมูลคำสั่งซื้อในระบบ");
      }
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการดึงข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // If no status selected, default to 'returning'
    const targetStatus = importTargetStatus || "returning";

    processImportFile(file, targetStatus as "returning");

    // Reset input
    e.target.value = "";
  };

  const processImportFile = (file: File, status: "returning") => {
    // setImportTargetStatus(status); // Already set before file select
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (data.length < 2) return;

      const headerRow = data[0] as string[];
      let orderIdx = -1;
      let noteIdx = -1;

      headerRow.forEach((h, i) => {
        const lower = String(h).toLowerCase();
        // Priority: Tracking Number
        if (lower.includes("tracking")) {
          orderIdx = i;
        }
        // Fallback: Order ID/Number Check
        else if (
          orderIdx === -1 && (
            lower.includes("order") ||
            lower.includes("id") ||
            lower.includes("หมายเลข"))
        )
          orderIdx = i;

        if (
          lower.includes("note") ||
          lower.includes("remark") ||
          lower.includes("หมายเหตุ")
        )
          noteIdx = i;
      });

      if (orderIdx === -1) {
        orderIdx = 0;
        if (data[0].length > 1) noteIdx = 1;
      }

      const parsed: ImportRow[] = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;
        const rawOrder = row[orderIdx];
        const rawNote = noteIdx !== -1 ? row[noteIdx] : "";

        if (rawOrder) {
          parsed.push({
            orderNumber: String(rawOrder).trim(),
            note: rawNote ? String(rawNote).trim() : "",
          });
        }
      }

      setImportedData(parsed);
      setLoading(true);

      // Fetch matching orders from API
      let fetchedOrders: Order[] = [];
      const trackingList = parsed.map((p) => p.orderNumber).filter(Boolean);

      // Chunking to avoid URL length issues (50 per chunk)
      const chunks = [];
      for (let i = 0; i < trackingList.length; i += 50) {
        chunks.push(trackingList.slice(i, i + 50));
      }

      try {
        for (const chunk of chunks) {
          if (chunk.length === 0) continue;
          const res = await listOrders({
            companyId: user.companyId,
            trackingNumber: chunk.join(","),
            pageSize: 1000,
          });
          if (res.ok && res.orders) {
            fetchedOrders = [...fetchedOrders, ...res.orders];
          }
        }
      } catch (err) {
        console.error("Failed to fetch import orders", err);
      }

      // Merge fetched orders with existing system orders
      const allOrders = [...fetchedOrders, ...orders];
      // Deduplicate by ID
      const uniqueOrders = Array.from(
        new Map(allOrders.map((o) => [o.id, o])).values(),
      );

      performMatching(parsed, uniqueOrders, verifiedOrders, status);
      setMode("verify");
      setLoading(false);
    };
    reader.readAsBinaryString(file);
  };

  const performMatching = (
    imported: ImportRow[],
    systemOrders: Order[],
    verifiedList: VerifiedOrder[],
    targetStatus: "returning"
  ) => {
    const results: MatchResult[] = [];
    const matchedOrderIds = new Set<string>();

    imported.forEach((row) => {
      // Find matches in System Orders (for Tracking/ID validation)
      const matched = systemOrders.find((o) => {
        // ... (Logic same as before, check tracking/ID)
        if (o.id === row.orderNumber) return true;
        if (Array.isArray(o.trackingNumbers) && o.trackingNumbers.some(t => t.includes(row.orderNumber))) return true;
        const rawT = (o as any).tracking_numbers;
        if (typeof rawT === 'string' && rawT.includes(row.orderNumber)) return true;
        if (Array.isArray(o.trackingDetails)) {
          return o.trackingDetails.some((d: any) =>
            (d.trackingNumber?.includes(row.orderNumber)) || (d.tracking_number?.includes(row.orderNumber))
          );
        }
        return false;
      });

      // Find Existing Return Record (in order_returns)
      const existingReturn = verifiedList.find(v =>
        v.tracking_number === row.orderNumber ||
        v.sub_order_id === row.orderNumber ||
        v.sub_order_id?.startsWith(row.orderNumber + "-")
      );

      // Branch Logic based on Target Status
      if (targetStatus === 'returning') {
        // Rule: Must match System Order AND NOT exist in Returns (or exist but be cancelled/reset?)
        // Requirement: "ต้องไม่มีข้อมูลใน order_returns"

        if (existingReturn) {
          results.push({
            importRow: row,
            matchedSubOrderId: existingReturn.sub_order_id,
            status: "already_verified", // Interpret as "Already in Returns"
            diff: 0
          });
        } else if (matched) {
          // Valid New Return
          // Resolve SubOrder
          let subOrderId = matched.id; // Default
          // Try to find specific sub order from tracking
          // ... (Keep existing resolution logic)
          if (Array.isArray(matched.trackingDetails)) {
            const detail = matched.trackingDetails.find((d: any) => (d.trackingNumber || d.tracking_number) === row.orderNumber);
            if (detail && detail.order_id) subOrderId = detail.order_id;
          }

          results.push({
            importRow: row,
            matchedOrder: matched,
            matchedSubOrderId: subOrderId,
            status: "matched", // Ready to Return
            diff: 0
          });
        } else {
          results.push({
            importRow: row,
            status: "unmatched_system",
            diff: 0
          });
        }

      }
    });

    setMatchResults(results);
  };

  const SystemList = () => (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              รหัสออเดอร์
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              เลขพัสดุ
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              ยอดเงิน
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              วันที่สั่งซื้อ
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              จัดการ
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {orders.map((order) => (
            <tr key={order.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                <div className="flex items-center gap-2">
                  <span
                    className="cursor-pointer hover:underline"
                    onClick={() => setSelectedOrderId(order.id)}
                  >
                    {order.id}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(order.id);
                      // You might want a toast here
                    }}
                    className="text-gray-400 hover:text-gray-600"
                    title="Copy Order ID"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {(() => {
                  // Use tracking_numbers string from API or trackingNumbers array if mapped
                  const rawTracking =
                    (order as any).tracking_numbers || order.trackingNumbers;
                  if (typeof rawTracking === "string") {
                    return rawTracking.split(",").map(
                      (
                        t: string, // Explicitly type 't' as string
                      ) => <div key={t}>{t}</div>,
                    );
                  }
                  if (Array.isArray(rawTracking)) {
                    return rawTracking.map((t) => <div key={t}>{t}</div>);
                  }
                  return "-";
                })()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                {getOrderAmount(order).toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(
                  order.orderDate || (order as any).order_date,
                ).toLocaleDateString("th-TH")}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                <button
                  onClick={() => {
                    setManagingOrder(order);
                  }}
                  className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1 rounded border border-indigo-200"
                >
                  จัดการ
                </button>
              </td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                ไม่พบรายการสินค้าตีกลับ (หรือตรวจสอบครบแล้ว)
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const handleSaveResults = async (results: MatchResult[]) => {
    if (!confirm(`ต้องการบันทึกข้อมูลจำนวน ${results.length} รายการ ? `))
      return;

    const payload = results.map((r) => ({
      sub_order_id:
        r.matchedSubOrderId ||
        (r.matchedOrder ? r.matchedOrder.id : r.importRow.orderNumber),
      return_amount: 0,
      status: importTargetStatus || "returning", // Use selected import status
      note: r.importRow.note || "",
    }));

    try {
      setLoading(true);
      const res = await saveReturnOrders(payload, user.id);
      if (res && res.status === "success") {
        alert(`บันทึกข้อมูลเรียบร้อยแล้ว(${res.message})`);
        setMode("list");
        fetchVerifiedOrders(); // Refresh verified list
        fetchReturnStats(); // Refresh tab counts
        fetchOrders(); // Refresh pending list (though we filter logic client side)
      } else {
        alert("เกิดข้อผิดพลาด: " + (res?.message || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setLoading(false);
    }
  };

  const VerificationList = () => (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
        <h3 className="font-medium text-gray-700">
          ผลการตรวจสอบ ({matchResults.length} รายการ)
        </h3>
        <div className="flex gap-2 text-sm">
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle size={14} /> ตรงกัน (
            {matchResults.filter((r) => r.status === "matched").length})
          </span>
          <span className="flex items-center gap-1 text-blue-600">
            <CheckCircle size={14} /> ตรวจสอบแล้ว (
            {matchResults.filter((r) => r.status === "already_verified").length}
            )
          </span>
          <span className="flex items-center gap-1 text-yellow-600">
            <AlertCircle size={14} /> ยอดไม่ตรง (
            {matchResults.filter((r) => r.status === "amount_mismatch").length})
          </span>
          <span className="flex items-center gap-1 text-red-600">
            <XCircle size={14} /> ไม่พบในระบบ (
            {matchResults.filter((r) => r.status === "unmatched_file").length})
          </span>
        </div>
      </div>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              เลขพัสดุที่นำเข้า
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              ออเดอร์ในระบบ
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              หมายเหตุ
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              สถานะ
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {matchResults.map((res, idx) => (
            <tr
              key={idx}
              className={`hover: bg - gray - 50 ${res.status === "unmatched_file" ? "bg-red-50" : res.status === "amount_mismatch" ? "bg-yellow-50" : ""} `}
            >
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {res.importRow.orderNumber}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                {res.matchedOrder ? (
                  <div
                    className="flex flex-col cursor-pointer hover:underline"
                    onClick={() => setSelectedOrderId(res.matchedOrder!.id)}
                  >
                    <span>{res.matchedOrder.id}</span>
                    {res.matchedSubOrderId && (
                      <span className="text-xs text-gray-500 font-mono">
                        ({res.matchedSubOrderId})
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      {res.matchedOrder.customerInfo?.firstName}
                    </span>
                  </div>
                ) : (
                  "-"
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {res.importRow.note || "-"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-center">
                {res.status === "matched" && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    ตรวจสอบแล้ว
                  </span>
                )}
                {res.status === "already_verified" && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    มีในระบบแล้ว
                  </span>
                )}
                {res.status === "amount_mismatch" && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                    ยอดไม่ตรง
                  </span>
                )}
                {res.status === "unmatched_file" && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                    ไม่พบในระบบ
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-4 bg-gray-50 border-t flex justify-end">
        <button
          onClick={() => handleSaveResults(matchResults)}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium flex items-center gap-2"
        >
          <CheckCircle size={16} /> บันทึกผลการตรวจสอบ
        </button>
      </div>
    </div>
  );

  const handleRevertOrder = async () => {
    if (!revertOrderId || !revertNewStatus) return;
    setRevertLoading(true);
    try {
      const res = await revertReturnedOrder(revertOrderId, revertNewStatus);
      if (res && res.status === 'success') {
        alert(`สำเร็จ: ${res.message}`);
        setIsRevertModalOpen(false);
        setRevertOrderId("");
        fetchVerifiedOrders();
        fetchReturnStats();
      } else {
        alert(`ผิดพลาด: ${res?.message || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setRevertLoading(false);
    }
  };

  // Checkbox selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  const handleBulkCaseClosed = async () => {
    if (selectedIds.size === 0) return;
    const selected = verifiedOrders.filter(v => selectedIds.has(v.id));
    if (!confirm(`ยืนยันจบเคส ${selected.length} รายการ?`)) return;
    setBulkSaving(true);
    try {
      const payload = selected.map(v => ({
        sub_order_id: v.sub_order_id || v.main_order_id || "",
        status: v.status || "good",
        collected_amount: 0,
        note: v.note || "",
        tracking_number: v.tracking_number,
        return_complete: 1,
        return_claim: v.return_claim ?? null,
      }));
      const res = await saveReturnOrders(payload, user.id);
      if (res && res.status === "success") {
        alert(`จบเคสสำเร็จ ${res.updatedCount || selected.length} รายการ`);
        setSelectedIds(new Set());
        fetchVerifiedOrders();
        fetchReturnStats();
      } else {
        alert("เกิดข้อผิดพลาด: " + (res?.message || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setBulkSaving(false);
    }
  };

  // ─── ReturnImageGallery: inline component for each card ───
  const ReturnImageGallery = ({ subOrderId }: { subOrderId: string }) => {
    const [images, setImages] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);
    const [lightbox, setLightbox] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    // Resolve image URL: DB stores relative path like /CRM_ERP_V4/api/uploads/returns/...
    // On Vite dev server we need the full Apache URL
    const resolveImgUrl = (url: string) => {
      if (!url) return '';
      // If already absolute URL, return as-is
      if (url.startsWith('http://') || url.startsWith('https://')) return url;
      // Extract just the filename from the stored URL
      const filename = url.split('/').pop() || '';
      // Use the API base path to construct the full URL
      const apiBase = resolveApiBasePath().replace(/\/$/, '');
      return `${apiBase}/uploads/returns/${filename}`;
    };

    useEffect(() => {
      if (subOrderId) {
        getReturnImages(subOrderId).then((res: any) => {
          if (res?.status === 'success') setImages(res.images || []);
        }).catch(() => {});
      }
    }, [subOrderId]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const res = await uploadReturnImage(subOrderId, file);
        if (res?.success && res.image) {
          setImages(prev => [res.image, ...prev]);
        } else {
          alert(res?.message || 'อัปโหลดไม่สำเร็จ');
        }
      } catch {
        alert('เกิดข้อผิดพลาดในการอัปโหลด');
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    };

    const handleDelete = async (id: number) => {
      if (!confirm('ลบรูปนี้?')) return;
      try {
        const res = await deleteReturnImage(id);
        if (res?.success) {
          setImages(prev => prev.filter(img => img.id !== id));
        }
      } catch {
        alert('ลบไม่สำเร็จ');
      }
    };

    return (
      <div className="mt-2 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-2 mb-1.5">
          <Camera size={13} className="text-gray-400" />
          <span className="text-[11px] text-gray-500 font-medium">รูปพัสดุ ({images.length})</span>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="px-2 py-0.5 bg-sky-50 text-sky-600 border border-sky-200 rounded text-[10px] font-medium hover:bg-sky-100 disabled:opacity-50 transition-colors"
          >
            {uploading ? '⏳' : '📷 อัปโหลด'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        </div>
        {images.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {images.map((img: any) => {
              const fullUrl = resolveImgUrl(img.url);
              return (
                <div key={img.id} className="relative group">
                  <img
                    src={fullUrl}
                    alt=""
                    className="w-14 h-14 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setLightbox(fullUrl)}
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDelete(img.id); }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >×</button>
                </div>
              );
            })}
          </div>
        )}
        {lightbox && (
          <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center" onClick={() => setLightbox(null)}>
            <img src={lightbox} alt="" className="max-w-[90vw] max-h-[90vh] rounded-xl shadow-2xl" />
            <button className="absolute top-4 right-4 text-white text-2xl font-bold hover:text-gray-300" onClick={() => setLightbox(null)}>✕</button>
          </div>
        )}
      </div>
    );
  };

  const VerifiedListTable = () => {
    const isGoodTab = activeTab === "good";

    // Flatten all items and sort by updated_at desc
    const allItems = [...verifiedOrders].sort((a, b) => {
      return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
    });

    const allIds = allItems.map(i => i.id);
    const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
    const someSelected = allIds.some(id => selectedIds.has(id));

    const toggleAll = () => {
      if (allSelected) {
        setSelectedIds(new Set());
      } else {
        setSelectedIds(new Set(allIds));
      }
    };

    const toggleOne = (id: number) => {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };

    return (
      <div className="space-y-3">
        {/* Pagination + Bulk Action Bar */}
        <div className="flex justify-between items-center bg-white px-4 py-2.5 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              หน้า <span className="font-semibold text-gray-800">{pagination.page}</span>
              {filterSearch && <span className="ml-1 text-sky-600">(ค้นหา: {filterSearch})</span>}
            </span>
            {isGoodTab && selectedIds.size > 0 && (
              <div className="flex items-center gap-2 ml-2 pl-3 border-l border-gray-200">
                <span className="text-sm font-medium text-sky-700">เลือก {selectedIds.size} รายการ</span>
                <button
                  onClick={handleBulkCaseClosed}
                  disabled={bulkSaving}
                  className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-semibold hover:bg-emerald-600 flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                >
                  <CheckCircle size={13} />
                  {bulkSaving ? 'กำลังบันทึก...' : 'ยืนยันจบเคส'}
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="px-2 py-1.5 text-gray-500 hover:text-gray-700 rounded-lg text-xs transition-colors"
                >
                  ยกเลิก
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={pagination.limit}
              onChange={(e) => setPagination(prev => ({ ...prev, limit: Number(e.target.value), page: 1 }))}
              className="px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 focus:ring-2 focus:ring-sky-500 focus:border-transparent cursor-pointer"
            >
              {[50, 100, 200, 500, 1000, 2000].map(size => (
                <option key={size} value={size}>{size} / หน้า</option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page === 1}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="px-3 py-1 bg-sky-50 text-sky-700 rounded-lg text-sm font-semibold min-w-[60px] text-center">
                {pagination.page}
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={!pagination.hasMore}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Single Flat Table */}
        {allItems.length > 0 ? (
          <div className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200">
                  {isGoodTab && (
                    <th className="px-3 py-2.5 text-center w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                        onChange={toggleAll}
                        className="w-4 h-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Order ID</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tracking No.</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Sub Order</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">ราคากล่อง</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">สถานะ</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">รายละเอียด</th>
                  <th className="px-4 py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">วันที่อัปเดต</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">ผู้อัปเดต</th>
                  <th className="px-4 py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allItems.map((item) => {
                  const isChecked = selectedIds.has(item.id);
                  return (
                    <tr key={`${item.id}-${item.tracking_number}`} className={`transition-colors ${isChecked ? 'bg-sky-50/60' : 'hover:bg-gray-50/60'}`}>
                      {isGoodTab && (
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleOne(item.id)}
                            className="w-4 h-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span
                          className="font-semibold text-sky-700 cursor-pointer hover:text-sky-900 text-sm transition-colors"
                          onClick={() => setSelectedOrderId(item.main_order_id || item.sub_order_id)}
                        >
                          #{item.main_order_id || '-'}
                        </span>
                        {item.order_date && (
                          <div className="text-[10px] text-gray-400">{new Date(item.order_date).toLocaleDateString('th-TH')}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-sm">
                        <span className="font-mono font-medium text-gray-800">{item.tracking_number}</span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-500 font-mono">
                        {item.sub_order_id || "-"}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-right text-sm">
                        {item.return_amount != null && Number(item.return_amount) > 0 ? (
                          <span className="font-semibold text-gray-800">฿{Number(item.return_amount).toLocaleString()}</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-lg ${item.status.toLowerCase() === 'returning' ? 'bg-orange-100 text-orange-800' :
                          item.status.toLowerCase() === 'good' ? 'bg-emerald-100 text-emerald-800' :
                            item.status.toLowerCase() === 'damaged' ? 'bg-rose-100 text-rose-800' :
                              item.status.toLowerCase() === 'lost' ? 'bg-gray-200 text-gray-700' :
                                'bg-gray-100 text-gray-700'
                          }`}>
                          {(() => {
                            const s = item.status.toLowerCase();
                            switch (s) {
                              case 'returning': return '🚚 กำลังตีกลับ';
                              case 'good': return '✅ สภาพดี';
                              case 'damaged': return '⚠️ เสียหาย';
                              case 'lost': return '❌ สูญหาย';
                              case 'pending': return '⏳ รอดำเนินการ';
                              default: return item.status;
                            }
                          })()}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {Number(item.return_complete) === 1 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800">✅ จบเคส</span>
                          )}
                          {item.return_claim != null && Number(item.return_claim) > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 text-amber-800">💰 เคลม ฿{Number(item.return_claim).toLocaleString()}</span>
                          )}
                          {item.note && <span className="text-gray-600 text-xs">📝 {item.note}</span>}
                          {!item.note && !Number(item.return_complete) && !(item.return_claim != null && Number(item.return_claim) > 0) && <span className="text-gray-300 text-xs">-</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-center text-xs text-gray-500">
                        {new Date(item.updated_at || item.created_at).toLocaleString('th-TH')}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-600">
                        {(item as any).returned_by_name && (item as any).returned_by_name.trim() ? (item as any).returned_by_name.trim() : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleManageVerified(item)}
                          className="px-3 py-1.5 bg-sky-50 text-sky-700 rounded-lg text-xs font-semibold hover:bg-sky-100 border border-sky-200 transition-colors"
                        >
                          ตรวจสอบ
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="text-5xl mb-4">📦</div>
            <p className="text-gray-500 font-medium">ไม่พบข้อมูลรายการตีกลับ</p>
            <p className="text-gray-400 text-sm mt-1">ลองปรับตัวกรองวันที่หรือเปลี่ยนแท็บ</p>
          </div>
        )}
      </div>
    );
  };

  const executeExport = async (type: 'csv' | 'xlsx') => {
    setExporting(true);
    setIsExportModalOpen(false);
    setShowExportPopup(false);
    try {
      const dateFrom = exportDateRange.start.split('T')[0];
      const dateTo = exportDateRange.end.split('T')[0];
      const res = await exportReturnOrders({
        date_from: dateFrom,
        date_to: dateTo,
        companyId: user.companyId,
      });
      if (res?.success && Array.isArray(res.data)) {
        if (res.data.length === 0) {
          alert('ไม่พบข้อมูลในช่วงวันที่ที่เลือก');
          return;
        }
        const statusMap: Record<string, string> = {
          returning: 'กำลังตีกลับ',
          returned: 'สภาพดี',
          good: 'สภาพดี',
          damaged: 'ชำรุด',
          lost: 'ตีกลับสูญหาย',
          pending: 'รอการดำเนินการ',
          delivered: 'ส่งสำเร็จ',
        };
        const headers = [
          'Order ID', 'Sub Order ID', 'วันที่สั่งซื้อ',
          'ชื่อลูกค้า', 'เบอร์โทร',
          'ที่อยู่', 'แขวง/ตำบล', 'เขต/อำเภอ', 'จังหวัด', 'รหัสไปรษณีย์',
          'Tracking No.', 'สถานะตีกลับ', 'หมายเหตุ',
          'ยืนยันจบเคส', 'ค่าเคลม',
          'ราคากล่อง', 'ยอดเก็บได้',
          'ชื่อสินค้า', 'จำนวน', 'ผู้ขาย',
          'วันที่บันทึก', 'ช่องทางชำระ', 'ผู้อัปเดต',
        ];
        let lastGroupKey = '';
        const rows = res.data.map((r: any) => {
          const groupKey = `${r.order_id}-${r.box_number}`;
          const isFirstRow = groupKey !== lastGroupKey;
          lastGroupKey = groupKey;

          const customerName = `${r.customer_first_name || ''} ${r.customer_last_name || ''}`.trim() || '-';
          const itemSeller = (r.item_creator_first_name || r.item_creator_last_name)
            ? `${r.item_creator_first_name || ''} ${r.item_creator_last_name || ''}`.trim()
            : `${r.seller_first_name || ''} ${r.seller_last_name || ''}`.trim() || '-';

          return [
            isFirstRow ? (r.order_id || '') : '',
            isFirstRow ? (r.sub_order_id || '') : '',
            isFirstRow ? (r.order_date ? new Date(r.order_date).toLocaleDateString('th-TH') : '-') : '',
            isFirstRow ? customerName : '',
            isFirstRow ? (r.customer_phone || '-') : '',
            isFirstRow ? (r.shipping_street || '-') : '',
            isFirstRow ? (r.shipping_subdistrict || '-') : '',
            isFirstRow ? (r.shipping_district || '-') : '',
            isFirstRow ? (r.shipping_province || '-') : '',
            isFirstRow ? (r.shipping_postal_code || '-') : '',
            isFirstRow ? (r.tracking_number || '-') : '',
            statusMap[r.return_status?.toLowerCase()] || r.return_status || '-',
            isFirstRow ? (r.return_note || '-') : '',
            isFirstRow ? (Number(r.return_complete) === 1 ? 'จบเคส' : '-') : '',
            isFirstRow ? (r.return_claim != null && Number(r.return_claim) > 0 ? Number(r.return_claim) : '-') : '',
            isFirstRow ? (r.cod_amount ?? 0) : '',
            isFirstRow ? (r.collection_amount ?? 0) : '',
            r.item_product_name || '-',
            r.item_quantity || 0,
            itemSeller,
            isFirstRow ? (r.return_created_at ? new Date(r.return_created_at).toLocaleString('th-TH') : '-') : '',
            isFirstRow ? (r.payment_method || '-') : '',
            isFirstRow ? (r.returned_by_name && r.returned_by_name.trim() ? r.returned_by_name.trim() : '-') : '',
          ];
        });
        
        const finalData = [headers, ...rows];
        downloadDataFile(finalData, `return_orders_${dateFrom}_${dateTo}`, type);
      } else {
        alert('เกิดข้อผิดพลาดในการดึงข้อมูล');
      }
    } catch (err) {
      console.error('Export error:', err);
      alert('เกิดข้อผิดพลาดในการ Export');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <div className="p-1.5 bg-sky-100 rounded-lg">
                <ArrowLeftRight size={20} className="text-sky-600" />
              </div>
              จัดการสินค้าตีกลับ
            </h2>
            <p className="text-gray-400 text-xs mt-0.5 ml-10">Return Management — ตรวจสอบและจัดการพัสดุตีกลับ</p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="relative">
              <input
                type="text"
                placeholder="ค้นหา Tracking No..."
                className="pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-sky-500 focus:border-transparent w-52 transition-all focus:bg-white"
                value={searchTracking}
                onChange={(e) => setSearchTracking(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchByTracking()}
              />
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="ค้นหา Order ID..."
                className="pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-sky-500 focus:border-transparent w-48 transition-all focus:bg-white"
                value={searchOrderId}
                onChange={(e) => setSearchOrderId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchByOrderId()}
              />
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
            <button
              onClick={() => { if (searchTracking.trim()) handleSearchByTracking(); else if (searchOrderId.trim()) handleSearchByOrderId(); }}
              disabled={loading}
              className="p-2 bg-sky-500 text-white rounded-xl hover:bg-sky-400 disabled:opacity-50 transition-colors shadow-sm"
            >
              <Search size={16} />
            </button>
            <div className="w-px h-8 bg-gray-200 mx-1" />
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              onClick={() => setIsImportStatusModalOpen(true)}
              className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-400 flex items-center gap-2 transition-colors shadow-sm"
            >
              <Upload size={15} /> Import
            </button>
            <div className="relative">
              <button
                onClick={() => setShowExportPopup(!showExportPopup)}
                disabled={exporting}
                className="px-4 py-2 bg-sky-600 text-white rounded-xl text-sm font-medium hover:bg-sky-500 flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50"
              >
                <Download size={15} />
                {exporting ? 'Exporting...' : 'Export'}
              </button>
              {showExportPopup && (
                <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50 w-[380px]">
                  <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">เลือกช่วงเวลา Export</p>
                  <div className="mb-3">
                    <DateRangePicker
                      value={exportDateRange}
                      onApply={(range) => setExportDateRange(range)}
                    />
                  </div>
                  <button
                    onClick={() => setIsExportModalOpen(true)}
                    disabled={exporting}
                    className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                  >
                    <Download size={14} />
                    {exporting ? 'Exporting...' : 'Export'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      {mode === "list" && (
        <div>
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
            {[
              { id: "pending", label: "รอดำเนินการ", icon: "⏳", bg: "bg-gray-100", activeBg: "bg-gray-600", text: "text-gray-700", badge: "bg-gray-200 text-gray-700" },
              { id: "returning", label: "กำลังตีกลับ", icon: "🚚", bg: "bg-gray-100", activeBg: "bg-orange-500", text: "text-orange-700", badge: "bg-orange-200 text-orange-800" },
              { id: "good", label: "เข้าคลัง (สภาพดี)", icon: "✅", bg: "bg-gray-100", activeBg: "bg-emerald-500", text: "text-emerald-700", badge: "bg-emerald-200 text-emerald-800" },
              { id: "damaged", label: "เข้าคลัง (เสียหาย)", icon: "⚠️", bg: "bg-gray-100", activeBg: "bg-rose-500", text: "text-rose-700", badge: "bg-rose-200 text-rose-800" },
              { id: "lost", label: "สูญหาย", icon: "❌", bg: "bg-gray-100", activeBg: "bg-gray-600", text: "text-gray-700", badge: "bg-gray-300 text-gray-700" },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`px-4 py-2.5 font-medium text-sm rounded-lg focus:outline-none whitespace-nowrap flex items-center gap-2 transition-all duration-200 ${activeTab === tab.id
                  ? `${tab.activeBg} text-white shadow-md scale-[1.02]`
                  : `${tab.bg} ${tab.text} hover:bg-gray-200`
                  }`}
                onClick={() => setActiveTab(tab.id as any)}
              >
                <span className="text-sm">{tab.icon}</span>
                <span>{tab.label}</span>
                {statsLoading ? (
                  <span className="inline-block w-4 h-4">
                    <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </span>
                ) : tabCounts[tab.id] !== undefined ? (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${activeTab === tab.id
                    ? 'bg-white/30 text-white'
                    : tab.badge
                    }`}>
                    {tabCounts[tab.id].toLocaleString()}
                  </span>
                ) : null}
              </button>
            ))}
            <div className="flex-1 min-w-[20px]"></div>
            {/* Filter Search */}
            <div className="p-1 flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="ค้นหาเลขออเดอร์ / เบอร์โทร..."
                  className="pl-8 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent w-56 shadow-sm transition-all"
                  value={filterSearch}
                  onChange={(e) => {
                    setFilterSearch(e.target.value);
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  onKeyDown={(e) => e.key === "Enter" && fetchVerifiedOrders()}
                />
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                {filterSearch && (
                  <button
                    onClick={() => {
                      setFilterSearch("");
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Date Range Filters */}
      {mode === "list" && (
        <div className="flex flex-wrap items-center gap-4 bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">📅 วันสั่งซื้อ</span>
            <div className="min-w-[260px]">
              <DateRangePicker
                value={orderDateRange}
                onApply={(range) => { setOrderDateRange(range); setOrderDateShowAll(false); }}
              />
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={orderDateShowAll}
                onChange={(e) => setOrderDateShowAll(e.target.checked)}
                className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="text-xs text-gray-500">ทั้งหมด</span>
            </label>
          </div>
          <div className="w-px h-6 bg-gray-200 mx-1" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">📋 วันลงตีกลับ</span>
            <div className="min-w-[260px]">
              <DateRangePicker
                value={returnDateRange}
                onApply={(range) => { setReturnDateRange(range); setReturnDateShowAll(false); }}
              />
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={returnDateShowAll}
                onChange={(e) => setReturnDateShowAll(e.target.checked)}
                className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="text-xs text-gray-500">ทั้งหมด</span>
            </label>
          </div>
        </div>
      )}

      {/* Advanced Filters Toggle + Panel */}
      {mode === "list" && (
        <div>
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              showAdvancedFilters || activeFilterCount > 0
                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            <Filter size={13} />
            ตัวกรองเพิ่มเติม
            {activeFilterCount > 0 && (
              <span className="bg-sky-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{activeFilterCount}</span>
            )}
            <ChevronDown size={13} className={`transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
          </button>
          {showAdvancedFilters && (
            <div className="mt-2 bg-white/80 backdrop-blur-sm rounded-xl px-4 py-3 border border-gray-200 shadow-sm">
              <div className="flex flex-wrap items-end gap-3">
                {/* Case Status */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">สถานะเคส</label>
                  <select
                    value={advFilters.caseStatus}
                    onChange={(e) => { setAdvFilters(prev => ({ ...prev, caseStatus: e.target.value as any })); setPagination(prev => ({ ...prev, page: 1 })); }}
                    className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 focus:ring-2 focus:ring-sky-500 focus:border-transparent cursor-pointer min-w-[120px]"
                  >
                    <option value="">ทั้งหมด</option>
                    <option value="open">🔓 ยังไม่จบเคส</option>
                    <option value="closed">✅ จบเคสแล้ว</option>
                  </select>
                </div>
                {/* Has Claim */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">การเคลม</label>
                  <select
                    value={advFilters.hasClaim}
                    onChange={(e) => { setAdvFilters(prev => ({ ...prev, hasClaim: e.target.value as any })); setPagination(prev => ({ ...prev, page: 1 })); }}
                    className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 focus:ring-2 focus:ring-sky-500 focus:border-transparent cursor-pointer min-w-[120px]"
                  >
                    <option value="">ทั้งหมด</option>
                    <option value="yes">💰 มีเคลม</option>
                    <option value="no">ไม่มีเคลม</option>
                  </select>
                </div>
                {/* Claim Range */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">ยอดเคลม (฿)</label>
                  <div className="flex items-center gap-1">
                    <input type="number" min="0" placeholder="ต่ำสุด" value={advFilters.claimMin} onChange={(e) => setAdvFilters(prev => ({ ...prev, claimMin: e.target.value }))} className="w-20 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-sky-500" />
                    <span className="text-gray-300 text-xs">—</span>
                    <input type="number" min="0" placeholder="สูงสุด" value={advFilters.claimMax} onChange={(e) => setAdvFilters(prev => ({ ...prev, claimMax: e.target.value }))} className="w-20 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-sky-500" />
                  </div>
                </div>
                {/* Amount Range */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">ราคากล่อง (฿)</label>
                  <div className="flex items-center gap-1">
                    <input type="number" min="0" placeholder="ต่ำสุด" value={advFilters.amountMin} onChange={(e) => setAdvFilters(prev => ({ ...prev, amountMin: e.target.value }))} className="w-20 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-sky-500" />
                    <span className="text-gray-300 text-xs">—</span>
                    <input type="number" min="0" placeholder="สูงสุด" value={advFilters.amountMax} onChange={(e) => setAdvFilters(prev => ({ ...prev, amountMax: e.target.value }))} className="w-20 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-sky-500" />
                  </div>
                </div>
                {/* Has Image */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">รูปภาพ</label>
                  <select
                    value={advFilters.hasImage}
                    onChange={(e) => { setAdvFilters(prev => ({ ...prev, hasImage: e.target.value as any })); setPagination(prev => ({ ...prev, page: 1 })); }}
                    className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 focus:ring-2 focus:ring-sky-500 focus:border-transparent cursor-pointer min-w-[100px]"
                  >
                    <option value="">ทั้งหมด</option>
                    <option value="yes">📷 มีรูป</option>
                    <option value="no">ไม่มีรูป</option>
                  </select>
                </div>
                {/* Has Note */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">หมายเหตุ</label>
                  <select
                    value={advFilters.hasNote}
                    onChange={(e) => { setAdvFilters(prev => ({ ...prev, hasNote: e.target.value as any })); setPagination(prev => ({ ...prev, page: 1 })); }}
                    className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 focus:ring-2 focus:ring-sky-500 focus:border-transparent cursor-pointer min-w-[100px]"
                  >
                    <option value="">ทั้งหมด</option>
                    <option value="yes">📝 มีหมายเหตุ</option>
                    <option value="no">ไม่มีหมายเหตุ</option>
                  </select>
                </div>
                {/* Apply & Clear */}
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => { setPagination(prev => ({ ...prev, page: 1 })); }}
                    className="px-3 py-1.5 bg-sky-500 text-white rounded-lg text-xs font-medium hover:bg-sky-600 transition-colors shadow-sm"
                  >
                    🔍 กรอง
                  </button>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={() => { setAdvFilters({ caseStatus: '', hasClaim: '', claimMin: '', claimMax: '', amountMin: '', amountMax: '', hasImage: '', hasNote: '' }); setPagination(prev => ({ ...prev, page: 1 })); }}
                      className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
                    >
                      ✕ ล้างตัวกรอง
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div>
        {loading ? (
          <div className="bg-white shadow rounded-lg p-12 flex flex-col items-center justify-center gap-4">
            <Spinner size="lg" />
            <span className="text-gray-500 font-medium">กำลังโหลดข้อมูล...</span>
          </div>
        ) : mode === "verify" ? (
          <VerificationList />
        ) : (
          <VerifiedListTable />
        )}
      </div>

      {/* Import Status Modal */}
      {isImportStatusModalOpen && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9990] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800">เลือกประเภทการนำเข้า</h3>
              <button
                onClick={() => {
                  setIsImportStatusModalOpen(false);
                  setPendingFile(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-3">
              <p className="text-sm text-gray-600 mb-2">
                กรุณาเลือกสถานะสำหรับรายการที่นำเข้า:
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setBulkImportMode("returning");
                    setIsImportStatusModalOpen(false);
                    setIsBulkImportOpen(true);
                  }}
                  className="w-full py-3 bg-orange-100 text-orange-800 rounded-lg hover:bg-orange-200 font-medium flex items-center justify-center gap-2"
                >
                  <RefreshCw size={18} /> Import ตีกลับ (Returning)
                </button>

                <button
                  onClick={() => {
                    setBulkImportMode("good");
                    setIsImportStatusModalOpen(false);
                    setIsBulkImportOpen(true);
                  }}
                  className="w-full py-3 bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 font-medium flex items-center justify-center gap-2"
                >
                  <ThumbsUp size={18} /> Import เข้าคลัง (สภาพดี)
                </button>
                <button
                  onClick={() => {
                    setBulkImportMode("damaged");
                    setIsImportStatusModalOpen(false);
                    setIsBulkImportOpen(true);
                  }}
                  className="w-full py-3 bg-rose-100 text-rose-800 rounded-lg hover:bg-rose-200 font-medium flex items-center justify-center gap-2"
                >
                  <AlertTriangle size={18} /> Import เข้าคลัง (เสียหาย)
                </button>
                <button
                  onClick={() => {
                    setBulkImportMode("lost");
                    setIsImportStatusModalOpen(false);
                    setIsBulkImportOpen(true);
                  }}
                  className="w-full py-3 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 font-medium flex items-center justify-center gap-2"
                >
                  <X size={18} /> Import สูญหาย (Lost)
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Bulk Import Modal */}
      {isBulkImportOpen && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9990] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
            <div className="flex justify-end items-center px-4 py-2 border-b border-gray-100 bg-gray-50 rounded-t-2xl shrink-0">
              <button
                onClick={() => setIsBulkImportOpen(false)}
                className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <BulkReturnImport
                key={bulkImportMode}
                mode={bulkImportMode}
                onImport={async (items) => {
                  try {
                    await saveReturnOrders(items, user.id);
                    alert("Import Successful!");
                    setIsBulkImportOpen(false);

                    // Refresh lists
                    fetchVerifiedOrders();
                  } catch (err) {
                    console.error(err);
                    alert("Import failed");
                  }
                }}
              />
            </div>
          </div>
        </div>
      , document.body)}



      {/* Order Detail Modal */}
      <OrderDetailModal
        isOpen={!!selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        orderId={selectedOrderId}
      />
      {managingOrder && createPortal(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9990] p-4">
          <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-white border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-800 text-lg">จัดการสินค้าตีกลับ</h3>
                <p className="text-xs text-gray-400 mt-0.5">แยกราย Sub Order ID</p>
              </div>
              <button
                onClick={() => setManagingOrder(null)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            {/* Order Info Bar */}
            <div className="px-6 py-3 bg-white border-b border-gray-100">
              <div className="flex flex-wrap items-center gap-3">
                <span className="bg-sky-50 text-sky-700 px-3 py-1.5 rounded-lg text-sm font-semibold">Order #{managingOrder.id}</span>
                <span className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium">รวม ฿{getOrderAmount(managingOrder).toLocaleString()}</span>
                {(() => {
                  const uniqueSubOrderIds = [
                    ...new Set(
                      manageRows.map((r) => r.subOrderId).filter((id) => id),
                    ),
                  ];
                  if (uniqueSubOrderIds.length > 1) {
                    return (
                      <span className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-mono">
                        {uniqueSubOrderIds.length} Sub Orders
                      </span>
                    );
                  }
                  return null;
                })()}
                <span className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium">📦 {manageRows.length} รายการ</span>
              </div>
            </div>

            {/* Card-based Items */}
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {manageRows.map((row, idx) => {
                const orderStatus = (managingOrder as any)?.orderStatus || (managingOrder as any)?.order_status || '';
                const isOrderReturned = orderStatus.toLowerCase() === 'returned';

                // Determine card accent color based on status
                const statusAccent = row.status === 'returning' ? 'border-l-orange-400'
                  : row.status === 'good' ? 'border-l-emerald-400'
                    : row.status === 'damaged' ? 'border-l-rose-400'
                      : row.status === 'lost' ? 'border-l-gray-400'
                        : row.status === 'delivered' ? 'border-l-blue-400'
                          : 'border-l-gray-200';

                return (
                  <div key={idx} className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden border-l-4 ${statusAccent} transition-all duration-200 hover:shadow-md`}>
                    <div className="p-4">
                      {/* Top row: Tracking info */}
                      <div className="flex items-start gap-4 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono font-bold text-gray-800 text-sm">{row.trackingNumber}</span>
                            {row.subOrderId && (
                              <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[10px] font-mono">{row.subOrderId}</span>
                            )}
                            {row.boxPrice != null && row.boxPrice > 0 && (
                              <span className="bg-sky-50 text-sky-700 px-2 py-0.5 rounded-md text-[11px] font-semibold">฿{row.boxPrice.toLocaleString()}</span>
                            )}
                            {row.returnComplete && (
                              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md text-[11px] font-semibold">✅ จบเคส</span>
                            )}
                            {row.returnClaim != null && row.returnClaim > 0 && (
                              <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md text-[11px] font-semibold">💰 เคลม ฿{row.returnClaim.toLocaleString()}</span>
                            )}
                          </div>
                          {/* Products */}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {row.items && row.items.length > 0 ? (
                              row.items.map((item: any, i: number) => (
                                <span key={i} className="inline-flex items-center bg-gray-50 border border-gray-100 rounded-md px-2 py-0.5 text-[11px] text-gray-600">
                                  {item.name || item.productName || item.product_name || 'Unknown'}
                                  <span className="text-gray-400 ml-1">x{item.quantity || 1}</span>
                                </span>
                              ))
                            ) : (
                              <span className="text-gray-300 text-xs italic">ไม่มีรายการสินค้า</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status Selection - Pill Buttons */}
                      <div className="border-t border-gray-100 pt-3">
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {/* Pending */}
                          <button
                            type="button"
                            disabled={isOrderReturned}
                            onClick={() => {
                              const newRows = [...manageRows];
                              newRows[idx].status = "pending";
                              setManageRows(newRows);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${row.status === 'pending'
                              ? 'bg-gray-700 text-white border-gray-700 shadow-sm'
                              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                              } ${isOrderReturned ? 'opacity-30 cursor-not-allowed' : ''}`}
                          >
                            ⏳ รอดำเนินการ
                          </button>
                          {/* Returning */}
                          <button
                            type="button"
                            onClick={() => {
                              const newRows = [...manageRows];
                              newRows[idx].status = "returning";
                              setManageRows(newRows);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${row.status === 'returning'
                              ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                              : 'bg-white text-orange-600 border-orange-200 hover:bg-orange-50'
                              }`}
                          >
                            🚚 กำลังตีกลับ
                          </button>
                          {/* Good */}
                          <button
                            type="button"
                            onClick={() => {
                              const newRows = [...manageRows];
                              newRows[idx].status = "good";
                              setManageRows(newRows);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${row.status === 'good'
                              ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                              : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                              }`}
                          >
                            ✅ สภาพดี
                          </button>
                          {/* Damaged */}
                          <button
                            type="button"
                            onClick={() => {
                              const newRows = [...manageRows];
                              newRows[idx].status = "damaged";
                              setManageRows(newRows);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${row.status === 'damaged'
                              ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                              : 'bg-white text-rose-600 border-rose-200 hover:bg-rose-50'
                              }`}
                          >
                            ⚠️ เสียหาย
                          </button>
                          {/* Lost */}
                          <button
                            type="button"
                            onClick={() => {
                              const newRows = [...manageRows];
                              newRows[idx].status = "lost";
                              setManageRows(newRows);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${row.status === 'lost'
                              ? 'bg-gray-600 text-white border-gray-600 shadow-sm'
                              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                              }`}
                          >
                            ❌ สูญหาย
                          </button>
                          {/* Delivered */}
                          <button
                            type="button"
                            disabled={isOrderReturned}
                            onClick={() => {
                              const newRows = [...manageRows];
                              newRows[idx].status = "delivered";
                              setManageRows(newRows);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${row.status === 'delivered'
                              ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                              : 'bg-white text-blue-500 border-blue-200 hover:bg-blue-50'
                              } ${isOrderReturned ? 'opacity-30 cursor-not-allowed' : ''}`}
                          >
                            📦 ส่งสำเร็จ
                          </button>
                        </div>

                        {/* Sub-options for specific statuses */}
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {row.status === "good" && (
                            <label className="flex items-center gap-2 cursor-pointer bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                              <input
                                type="checkbox"
                                checked={!!row.returnComplete}
                                onChange={(e) => {
                                  const newRows = [...manageRows];
                                  newRows[idx].returnComplete = e.target.checked;
                                  setManageRows(newRows);
                                }}
                                className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="text-emerald-700 text-xs font-medium">✅ ยืนยันจบเคส</span>
                            </label>
                          )}
                          {(row.status === "damaged" || row.status === "lost") && (
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${row.status === 'damaged' ? 'bg-rose-50 border-rose-200' : 'bg-gray-50 border-gray-200'}`}>
                              <span className={`text-xs font-medium ${row.status === 'damaged' ? 'text-rose-700' : 'text-gray-700'}`}>💰 เคลม:</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.returnClaim ?? ''}
                                onChange={(e) => {
                                  const newRows = [...manageRows];
                                  newRows[idx].returnClaim = e.target.value ? parseFloat(e.target.value) : undefined;
                                  setManageRows(newRows);
                                }}
                                placeholder="จำนวนเงิน"
                                className={`w-28 px-2 py-1 text-sm border rounded-lg focus:ring-2 ${row.status === 'damaged' ? 'border-rose-300 focus:ring-rose-500' : 'border-gray-300 focus:ring-gray-500'}`}
                              />
                              <span className="text-gray-400 text-xs">บาท</span>
                            </div>
                          )}
                          {/* Note input */}
                          <div className="flex-1 min-w-[200px]">
                            <input
                              type="text"
                              value={row.note}
                              onChange={(e) => {
                                const newRows = [...manageRows];
                                newRows[idx].note = e.target.value;
                                setManageRows(newRows);
                              }}
                              placeholder="เพิ่มหมายเหตุ..."
                              className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent focus:bg-white transition-all"
                              disabled={row.status === "pending"}
                            />
                          </div>
                        </div>

                        {/* 📷 Image Upload Section */}
                        {row.subOrderId && (
                          <ReturnImageGallery subOrderId={row.subOrderId} />
                        )}
                        {isOrderReturned && (row.status === 'pending' || row.status === 'delivered') && (
                          <p className="text-[11px] text-rose-500 mt-1.5 flex items-center gap-1">
                            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-rose-100 text-rose-600 text-[9px] font-bold">!</span>
                            Order นี้ตีกลับครบทุกกล่องแล้ว กรุณาใช้ปุ่ม &quot;ยกเลิกตีกลับ&quot; แทน
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-white border-t border-gray-200 flex justify-between items-center">
              <span className="text-xs text-gray-400">
                {manageRows.filter(r => r.status !== 'pending').length} / {manageRows.length} รายการมีการเปลี่ยนแปลง
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => setManagingOrder(null)}
                  className="px-5 py-2 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleManageSave}
                  disabled={loading}
                  className="px-5 py-2 bg-sky-600 text-white rounded-xl text-sm font-semibold hover:bg-sky-700 focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
                >
                  {loading && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  )}
                  {loading ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Confirmation Modal */}
      {
        isConfirmSaveOpen && createPortal(
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9990] p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-800">ยืนยันการบันทึก</h3>
                <button
                  onClick={() => setIsConfirmSaveOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6">
                <p className="text-gray-700 text-center mb-4">
                  คุณต้องการบันทึกข้อมูล{" "}
                  <span className="font-bold text-indigo-600">
                    {manageRows.filter((r) => r.status !== "pending").length}
                  </span>{" "}
                  รายการ ใช่หรือไม่?
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setIsConfirmSaveOpen(false)}
                    className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-100"
                    disabled={loading}
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={executeSave}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 flex items-center gap-2"
                    disabled={loading}
                  >
                    {loading && (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    )}
                    ยืนยัน
                  </button>
                </div>
              </div>
            </div>
          </div>
        , document.body)
      }
      {/* Revert Returned Order Modal */}
      {isRevertModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9990] flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b bg-amber-50 rounded-t-xl">
              <h3 className="text-lg font-semibold text-amber-800 flex items-center gap-2">
                <RotateCcw size={20} />
                ยกเลิกสถานะตีกลับ
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order ID</label>
                <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-mono text-gray-800">{revertOrderId}</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  <strong>⚠️ คำเตือน:</strong> การยกเลิกจะ <strong>ล้างสถานะการตีกลับทุกกล่อง</strong> ของ Order นี้
                  และเปลี่ยนสถานะ Order ไปเป็นสถานะที่เลือก
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เปลี่ยนสถานะ Order เป็น</label>
                <select
                  value={revertNewStatus}
                  onChange={(e) => setRevertNewStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500"
                >
                  {revertStatusOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label} ({opt.value})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3">
              <button
                onClick={() => setIsRevertModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-100"
                disabled={revertLoading}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleRevertOrder}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium disabled:opacity-50 flex items-center gap-2"
                disabled={revertLoading}
              >
                {revertLoading && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                ยืนยันยกเลิกตีกลับ
              </button>
            </div>
          </div>
        </div>
      , document.body)}
      {/* Order Detail Modal */}
      <OrderDetailModal
        isOpen={!!selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        orderId={selectedOrderId}
      />

      {/* Export Type Modal */}
      <ExportTypeModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onConfirm={executeExport}
        isExporting={exporting}
      />
    </div>
  );
};

export default ReturnManagementPage;
