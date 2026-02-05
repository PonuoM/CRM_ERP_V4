import React, { useState, useEffect, useRef } from "react";
import { User, Order, OrderStatus } from "../types";
import { listOrders, saveReturnOrders, getReturnOrders, getOrder } from "../services/api";
import * as XLSX from "xlsx";
import {
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
} from "lucide-react";
import OrderDetailModal from "../components/OrderDetailModal";
import BulkReturnImport from "../components/BulkReturnImport";
import Spinner from "../components/Spinner";

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
    "pending" | "returning" | "returned" | "good" | "damaged" | "lost" | "delivered"
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
    "returning" | "returned"
  >("returning");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isImportStatusModalOpen, setIsImportStatusModalOpen] = useState(false);

  // Search State
  const [searchTracking, setSearchTracking] = useState("");
  const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState(false);

  // Manage Modal State
  const [managingOrder, setManagingOrder] = useState<Order | null>(null);
  interface ManageRow {
    trackingNumber: string;

    subOrderId: string | null;
    status: "pending" | "returned" | "returning" | "delivered" | "delivering" | "other" | "lost" | "good" | "damaged";
    collectedAmount?: number;
    note: string;
    items: any[];
    originalStatus: string; // Track initial status for constraints
  }
  const [manageRows, setManageRows] = useState<ManageRow[]>([]);

  // State for Bulk Import Modal
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkImportMode, setBulkImportMode] = useState<"returning" | "returned" | "good" | "damaged" | "lost">("returning");

  // Pagination State
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1
  });

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
            originalStatus: verified.status as any, // Store the status from DB
          };
        }
        return {
          ...row,
          originalStatus: "pending", // If not found in verifiedOrders, treat as pending
        };
      });

      setManageRows(mergedRows);
    }
  }, [managingOrder, verifiedOrders]);

  useEffect(() => {
    // Reset to page 1 when tab changes, then fetch
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [activeTab]);

  useEffect(() => {
    fetchVerifiedOrders();
  }, [user.companyId, activeTab, pagination.page]);

  const fetchVerifiedOrders = async () => {
    try {
      setLoading(true);

      const res = await getReturnOrders({
        status: activeTab,
        page: pagination.page,
        limit: pagination.limit,
        companyId: user.companyId
      });

      if (res && res.status === "success") {
        setVerifiedOrders(res.data);
        if (res.pagination) {
          setPagination(prev => ({
            ...prev,
            total: res.pagination.total,
            totalPages: res.pagination.totalPages
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
      performMatching(parsed, orders, verifiedOrders, importTargetStatus || "returned");
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
        status: r.status || "returned", // Use row status directly (Manual Manage Mode)
        collected_amount: r.collectedAmount || 0,
        note: r.note || "",
        tracking_number: r.trackingNumber // Essential for new flow
      }));

      const res = await saveReturnOrders(payload);
      if (res && res.status === "success") {
        alert(`บันทึกข้อมูลเรียบร้อย(${res.message})`);
        setManagingOrder(null);
        setIsConfirmSaveOpen(false); // Close modal
        fetchOrders();
        fetchVerifiedOrders();
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

    // If no status selected, default to 'returned' or handle error (Should not happen with new flow)
    const targetStatus = importTargetStatus || "returned";

    processImportFile(file, targetStatus as "returning" | "returned");

    // Reset input
    e.target.value = "";
  };

  const processImportFile = (file: File, status: "returning" | "returned") => {
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
    targetStatus: "returning" | "returned"
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

      } else if (targetStatus === 'returned') {
        // Rule: Must EXIST in Returns AND Status == 'returning'
        if (!existingReturn) {
          results.push({
            importRow: row,
            status: "unmatched_file", // "Not found in Returns"
            diff: 0
          });
        } else {
          if (existingReturn.status === 'returning') {
            results.push({
              importRow: row,
              matchedSubOrderId: existingReturn.sub_order_id,
              status: "matched", // Ready to Complete
              diff: 0
            });
          } else {
            // Status mismatch (e.g. already returned)
            results.push({
              importRow: row,
              matchedSubOrderId: existingReturn.sub_order_id,
              status: "already_verified", // "Wrong Status"
              diff: 0
            });
          }
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
      status: importTargetStatus || "returned", // Use selected import status
      note: r.importRow.note || "",
    }));

    try {
      setLoading(true);
      const res = await saveReturnOrders(payload);
      if (res && res.status === "success") {
        alert(`บันทึกข้อมูลเรียบร้อยแล้ว(${res.message})`);
        setMode("list");
        fetchVerifiedOrders(); // Refresh verified list
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
                    Verified
                  </span>
                )}
                {res.status === "already_verified" && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    Already Verified
                  </span>
                )}
                {res.status === "amount_mismatch" && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                    Amount Diff
                  </span>
                )}
                {res.status === "unmatched_file" && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                    Not Found
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

  const VerifiedListTable = () => {
    // Filter client-side REMOVED -> Now handled by API
    // const filteredItems = verifiedOrders.filter(...) 

    // Group strictly by main_order_id
    const grouped = verifiedOrders.reduce(
      (acc, v) => {
        // Use main_order_id directly. If missing, treat as orphan (use tracking number as key)
        const key = v.main_order_id || v.tracking_number;

        if (!acc[key]) {
          acc[key] = {
            displayId: key,
            items: [],
            totalAmount: v.total_amount || 0,
            orderDate: v.order_date || "",
          };
        }
        acc[key].items.push(v);
        return acc;
      },
      {} as Record<
        string,
        { displayId: string; items: typeof verifiedOrders; totalAmount: number; orderDate: string }
      >,
    );

    const sortedGroups = Object.values(grouped).sort((a, b) => {
      // Sort by latest item in group
      const maxA = Math.max(...a.items.map((i) => new Date(i.updated_at || i.created_at).getTime()));
      const maxB = Math.max(...b.items.map((i) => new Date(i.updated_at || i.created_at).getTime()));
      return maxB - maxA;
    });

    return (
      <div className="space-y-4">
        {/* Pagination Controls */}
        <div className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border mb-4">
          <span className="text-sm text-gray-600">
            แสดง {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} จาก {pagination.total} รายการ
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={pagination.page === 1}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="px-3 py-1 bg-gray-100 rounded text-sm font-medium">
              หน้า {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.min(pagination.totalPages, prev.page + 1) }))}
              disabled={pagination.page >= pagination.totalPages}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {sortedGroups.map((group) => (
          <div key={group.displayId} className="bg-white shadow rounded-lg overflow-hidden border">
            <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center">
              <div>
                <span className="font-semibold text-gray-700">Order: {group.displayId}</span>
                {group.orderDate && <span className="text-xs text-gray-500 ml-2">({new Date(group.orderDate).toLocaleDateString('th-TH')})</span>}
              </div>
              <div className="text-sm text-gray-600">
                <span className="mr-4">{group.items.length} รายการ</span>
                <span>ยอดบิล: {group.totalAmount.toLocaleString()}</span>
              </div>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tracking No.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sub Order ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    สถานะ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    หมายเหตุ
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    วันที่อัปเดต
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {group.items.map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.tracking_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.sub_order_id || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.status.toLowerCase() === 'returning' ? 'bg-orange-100 text-orange-800' :
                        item.status.toLowerCase() === 'returned' ? 'bg-blue-100 text-blue-800' :
                          item.status.toLowerCase() === 'good' ? 'bg-green-100 text-green-800' :
                            item.status.toLowerCase() === 'damaged' ? 'bg-red-100 text-red-800' :
                              item.status.toLowerCase() === 'lost' ? 'bg-gray-100 text-gray-800' :
                                'bg-gray-100 text-gray-800'
                        }`}>
                        {(() => {
                          const s = item.status.toLowerCase();
                          switch (s) {
                            case 'returning': return 'กำลังตีกลับ';
                            case 'returned': return 'เข้าคลัง';
                            case 'good': return 'สภาพดี';
                            case 'damaged': return 'ชำรุด';
                            case 'lost': return 'สูญหาย';
                            case 'pending': return 'รอการดำเนินการ';
                            default: return item.status;
                          }
                        })()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.note || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                      {new Date(item.updated_at || item.created_at).toLocaleString('th-TH')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <button
                        onClick={() => handleManageVerified(item)} // This uses item, assuming handleManageVerified takes VerifiedOrder
                        className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1 rounded"
                      >
                        ตรวจสอบ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {sortedGroups.length === 0 && (
          <div className="text-center py-10 text-gray-500 bg-white rounded-lg shadow">ไม่พบข้อมูล</div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <ArrowLeftRight className="text-blue-600" />
          จัดการสินค้าตีกลับ (Return Management)
        </h2>
        <div className="flex gap-2">
          <div className="flex gap-2 mr-2">
            <input
              type="text"
              placeholder="ค้นหา Tracking No..."
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 w-48"
              value={searchTracking}
              onChange={(e) => setSearchTracking(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchByTracking()}
            />
            <button
              onClick={handleSearchByTracking}
              disabled={loading}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50"
            >
              <Search size={16} />
            </button>
          </div>
          <button
            onClick={handleDownloadTemplate}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <Download size={16} /> Template
          </button>

          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => setIsImportStatusModalOpen(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2"
          >
            <Upload size={16} /> Import ไฟล์
          </button>
        </div>
      </div>

      {/* Loading Overlay */}
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center gap-4 min-w-[300px] px-8">
            <Spinner size="lg" />
            <span className="text-gray-700 font-medium">กำลังโหลดข้อมูล...</span>
          </div>
        </div>
      )}

      {/* Tabs Row - Moved Here */}
      {mode === "list" && (
        <div className="mb-6">
          <div className="flex border-b overflow-x-auto">
            {[
              { id: "pending", label: "รอการดำเนินการ (Pending)", color: "gray" },
              { id: "returning", label: "กำลังตีกลับ (Returning)", color: "orange" },
              { id: "returned", label: "เข้าคลัง (Returned)", color: "blue" },
              { id: "good", label: "สภาพดี (Good)", color: "green" },
              { id: "damaged", label: "ชำรุด (Damaged)", color: "red" },
              { id: "lost", label: "สูญหาย (Lost)", color: "gray" },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`px-4 py-2 font-medium text-sm focus:outline-none whitespace-nowrap ${activeTab === tab.id
                  ? `border-b-2 border-${tab.color}-500 text-${tab.color}-600`
                  : "text-gray-500 hover:text-gray-700"
                  }`}
                onClick={() => setActiveTab(tab.id as any)}
              >
                {tab.label}
              </button>
            ))}
            <div className="flex-1 min-w-[20px]"></div>
            {/* Search Box */}
            <div className="p-2">
            </div>
          </div>
        </div>
      )}

      {/* Verified List Content */}
      <div className="mt-6">
        {mode === "verify" ? (
          <VerificationList />
        ) : (
          <VerifiedListTable />
        )}
      </div>

      {/* Import Status Modal */}
      {isImportStatusModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
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
                    setBulkImportMode("returned");
                    setIsImportStatusModalOpen(false);
                    setIsBulkImportOpen(true);
                  }}
                  className="w-full py-3 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 font-medium flex items-center justify-center gap-2"
                >
                  <CheckCircle size={18} /> Import เข้าคลังแล้ว (Returned)
                </button>
                <button
                  onClick={() => {
                    setBulkImportMode("good");
                    setIsImportStatusModalOpen(false);
                    setIsBulkImportOpen(true);
                  }}
                  className="w-full py-3 bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 font-medium flex items-center justify-center gap-2"
                >
                  <ThumbsUp size={18} /> Import สภาพดี (Good)
                </button>
                <button
                  onClick={() => {
                    setBulkImportMode("damaged");
                    setIsImportStatusModalOpen(false);
                    setIsBulkImportOpen(true);
                  }}
                  className="w-full py-3 bg-rose-100 text-rose-800 rounded-lg hover:bg-rose-200 font-medium flex items-center justify-center gap-2"
                >
                  <AlertTriangle size={18} /> Import เสียหาย (Damaged)
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
      )}

      {/* Bulk Import Modal */}
      {isBulkImportOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden relative">
            <button
              onClick={() => setIsBulkImportOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
            >
              <X size={24} />
            </button>
            <div className="flex-1 overflow-hidden p-1">
              <BulkReturnImport
                key={bulkImportMode}
                mode={bulkImportMode}
                onImport={async (items) => {
                  try {
                    await saveReturnOrders(items);
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
      )}



      {/* Order Detail Modal */}
      <OrderDetailModal
        isOpen={!!selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        orderId={selectedOrderId}
      />
      {/* Manage Modal */}
      {managingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800">
                จัดการสินค้าตีกลับ (แยกราย Sub Order ID)
              </h3>
              <button
                onClick={() => setManagingOrder(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 border-b bg-blue-50 text-sm text-blue-800">
              Order ID: <b>{managingOrder.id}</b> | รวม{" "}
              {getOrderAmount(managingOrder).toLocaleString()} บาท
              {(() => {
                // Count unique sub order IDs for this order
                const uniqueSubOrderIds = [
                  ...new Set(
                    manageRows.map((r) => r.subOrderId).filter((id) => id),
                  ),
                ];
                if (uniqueSubOrderIds.length > 1) {
                  return (
                    <div className="mt-1 text-xs">
                      Sub Orders:{" "}
                      {uniqueSubOrderIds.map((id, idx) => (
                        <span key={id}>
                          {idx > 0 && ", "}
                          <span className="font-mono">{id}</span>
                        </span>
                      ))}
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            <div className="p-0 overflow-auto flex-1">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      เลขพัสดุ
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      รหัสย่อย
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      รายการสินค้า
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      สถานะ
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      หมายเหตุ
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {manageRows.map((row, idx) => {
                    // Manual override: No rules. Always allow changing status.
                    return (
                      <tr
                        key={idx}
                        className={
                          row.status === "returned"
                            ? "bg-red-50"
                            : row.status === "delivered"
                              ? "bg-green-50"
                              : row.status === "returning"
                                ? "bg-orange-50"
                                : row.status === "delivering"
                                  ? "bg-blue-50"
                                  : row.status === "good"
                                    ? "bg-green-100"
                                    : row.status === "damaged"
                                      ? "bg-red-100"
                                      : row.status === "lost"
                                        ? "bg-gray-200"
                                        : ""
                        }
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {row.trackingNumber}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                          {row.subOrderId || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {row.items && row.items.length > 0 ? (
                            <ul className="list-disc list-inside text-xs">
                              {row.items.map((item: any, i: number) => (
                                <li
                                  key={i}
                                  className="whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]"
                                >
                                  {item.name ||
                                    item.productName ||
                                    item.product_name ||
                                    "Unknown Product"}
                                  <span className="text-gray-500 ml-1">
                                    x{item.quantity || 1}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-gray-400 italic text-xs">
                              - No items -
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex flex-col gap-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={"status-" + idx}
                                checked={row.status === "pending"}
                                onChange={() => {
                                  const newRows = [...manageRows];
                                  newRows[idx].status = "pending";
                                  setManageRows(newRows);
                                }}
                                className="text-gray-600 focus:ring-gray-500"
                              />
                              <span className="text-gray-600">
                                รอดำเนินการ
                              </span>
                            </label>
                            {/* Returning Status */}
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={"status-" + idx}
                                checked={row.status === "returning"}
                                onChange={() => {
                                  const newRows = [...manageRows];
                                  newRows[idx].status = "returning";
                                  setManageRows(newRows);
                                }}
                                className="text-orange-600 focus:ring-orange-500"
                              />
                              <span className="text-orange-700">กำลังตีกลับ</span>
                            </label>

                            {/* Returned Status Group */}
                            <div className="flex flex-col">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={"status-" + idx}
                                  checked={row.status === "returned"}
                                  onChange={() => {
                                    const newRows = [...manageRows];
                                    newRows[idx].status = "returned";
                                    setManageRows(newRows);
                                  }}
                                  className="text-red-600 focus:ring-red-500"
                                />
                                <span className="text-red-700">
                                  รับของคืนแล้ว (เข้าคลัง)
                                </span>
                              </label>

                              {/* Sub-options for Returned */}
                              <div className="ml-6 flex flex-col gap-1 mt-1 border-l-2 border-gray-200 pl-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={"status-" + idx}
                                    checked={row.status === "good"}
                                    onChange={() => {
                                      const newRows = [...manageRows];
                                      newRows[idx].status = "good";
                                      setManageRows(newRows);
                                    }}
                                    className="text-emerald-600 focus:ring-emerald-500"
                                  />
                                  <span className="text-emerald-700 text-sm">
                                    สภาพดี (Good)
                                  </span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={"status-" + idx}
                                    checked={row.status === "damaged"}
                                    onChange={() => {
                                      const newRows = [...manageRows];
                                      newRows[idx].status = "damaged";
                                      setManageRows(newRows);
                                    }}
                                    className="text-rose-600 focus:ring-rose-500"
                                  />
                                  <span className="text-rose-700 text-sm">
                                    เสียหาย (Damaged)
                                  </span>
                                </label>
                              </div>
                            </div>

                            {/* Lost Status */}
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={"status-" + idx}
                                checked={row.status === "lost"}
                                onChange={() => {
                                  const newRows = [...manageRows];
                                  newRows[idx].status = "lost";
                                  setManageRows(newRows);
                                }}
                                className="text-gray-600 focus:ring-gray-500"
                              />
                              <span className="text-gray-700">
                                สูญหาย (Lost)
                              </span>
                            </label>



                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={"status-" + idx}
                                checked={row.status === "delivered"}
                                onChange={() => {
                                  const newRows = [...manageRows];
                                  newRows[idx].status = "delivered";
                                  setManageRows(newRows);
                                }}
                                className="text-green-600 focus:ring-green-500"
                              />
                              <span className="text-green-700">
                                ส่งสำเร็จ (Delivered)
                              </span>
                            </label>

                            <div className="border-t my-1"></div>


                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm align-top">
                          <input
                            type="text"
                            value={row.note}
                            onChange={(e) => {
                              const newRows = [...manageRows];
                              newRows[idx].note = e.target.value;
                              setManageRows(newRows);
                            }}
                            placeholder="เพิ่มหมายเหตุ..."
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                            disabled={row.status === "pending"}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setManagingOrder(null)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleManageSave}
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
              </button>
            </div>
          </div >
        </div >
      )}

      {/* Confirmation Modal */}
      {
        isConfirmSaveOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
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
        )
      }
    </div >
  );
};

export default ReturnManagementPage;
