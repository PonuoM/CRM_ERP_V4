import React, { useState, useEffect, useRef } from "react";
import { User, Order, OrderStatus } from "../types";
import { listOrders, saveReturnOrders, getReturnOrders } from "../services/api";
import * as XLSX from "xlsx";
import {
  Search,
  Upload,
  RefreshCw,
  FileText,
  CheckCircle,
  AlertCircle,
  XCircle,
  ArrowLeftRight,
  Download,
  Clipboard,
  X,
  Copy,
  Clock,
} from "lucide-react";
import OrderDetailModal from "../components/OrderDetailModal";

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
    "pending" | "checking" | "verified"
  >("pending");
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
    "returning" | "returned" | null
  >(null);
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
    status: "pending" | "returned" | "returning" | "delivered" | "delivering" | "other";
    collectedAmount?: number;
    note: string;
    items: any[];
  }
  const [manageRows, setManageRows] = useState<ManageRow[]>([]);

  // Update preview when content changes
  useEffect(() => {
    if (!pasteContent) {
      setPreviewRows([]);
      return;
    }
    const rows = pasteContent
      .trim()
      .split(/\r?\n/)
      .map((row) => row.split("\t"));
    setPreviewRows(rows);
  }, [pasteContent]);

  // Auto-focus on open
  useEffect(() => {
    if (isPasteModalOpen) {
      // Slight delay to allow render
      setTimeout(() => pasteInputRef.current?.focus(), 100);
    }
  }, [isPasteModalOpen]);

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
          };
        }
        return row;
      });

      setManageRows(mergedRows);
    }
  }, [managingOrder, verifiedOrders]);

  useEffect(() => {
    fetchOrders();
    fetchVerifiedOrders(); // Always fetch to support filtering logic in Pending tab
  }, [user.companyId, activeTab]);

  const fetchVerifiedOrders = async () => {
    try {
      const res = await getReturnOrders();
      if (res && res.status === "success") {
        setVerifiedOrders(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch verified orders", err);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let mode = "pending";
      if (activeTab === "checking") mode = "partial";
      if (activeTab === "verified") mode = "verified";

      const res = await listOrders({
        companyId: user.companyId,
        orderStatus: OrderStatus.Returned,
        returnMode: mode,
        pageSize: 1000,
      });
      if (res.ok) {
        setOrders(Array.isArray(res.orders) ? res.orders : []);
      }
    } catch (err) {
      console.error("Failed to fetch returned orders", err);
    } finally {
      setLoading(false);
    }
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
      const rawNote = cols[1] ? cols[1].trim() : "";

      if (rawOrder) {
        parsed.push({
          orderNumber: rawOrder,
          note: rawNote,
        });
      }
    });

    if (parsed.length > 0) {
      setImportedData(parsed);
      performMatching(parsed, orders, verifiedOrders);
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
        status: r.status, // Send status 'returned' or 'delivered'
        collected_amount: r.collectedAmount || 0,
        note: r.note || "",
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
      const parts = v.sub_order_id.split("-");
      const mainOrderId =
        parts.length > 1 ? parts.slice(0, -1).join("-") : v.sub_order_id;

      // First, try to find the order by the main order ID
      const res = await listOrders({
        companyId: user.companyId,
        orderId: mainOrderId,
        pageSize: 1,
      });

      if (res.ok && res.orders.length > 0) {
        setManagingOrder(res.orders[0]);
      } else {
        // If not found by main order ID, try with tracking number if available
        if (v.tracking_number) {
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

    processImportFile(file, targetStatus);

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

      performMatching(parsed, uniqueOrders, verifiedOrders);
      setMode("verify");
      setLoading(false);
    };
    reader.readAsBinaryString(file);
  };

  const performMatching = (
    imported: ImportRow[],
    systemOrders: Order[],
    verifiedList: VerifiedOrder[],
  ) => {
    const results: MatchResult[] = [];
    const matchedOrderIds = new Set<string>();

    imported.forEach((row) => {
      // Find by Tracking Number OR Order ID
      // Find by Tracking Number OR Order ID
      const matched = systemOrders.find((o) => {
        // 1. Check Arrays (trackingNumbers)
        if (
          Array.isArray(o.trackingNumbers) &&
          o.trackingNumbers.some((t) => t.includes(row.orderNumber))
        )
          return true;

        // 2. Check Order ID
        if (o.id === row.orderNumber) return true;

        // 3. Check trackingDetails (Handle both camelCase and snake_case)
        if (Array.isArray(o.trackingDetails)) {
          const found = o.trackingDetails.some((t: any) => {
            const tNum = t.trackingNumber || t.tracking_number;
            return tNum && tNum.includes(row.orderNumber);
          });
          if (found) return true;
        }

        // 4. Check tracking_numbers string (snake_case from API)
        const tStr = (o as any).tracking_numbers;
        if (typeof tStr === 'string' && tStr.includes(row.orderNumber)) {
          return true;
        }

        return false;
      });

      if (matched) {
        // Determine Sub Order ID
        let subOrderId = null;
        // Case 1: Matched by Tracking Number
        if (Array.isArray(matched.trackingDetails)) {
          const detail = matched.trackingDetails.find((d: any) => {
            const tNum = d.trackingNumber || d.tracking_number;
            return tNum === row.orderNumber;
          });
          if (detail && detail.order_id) {
            subOrderId = detail.order_id;
          }
        }
        // Case 2: Matched by Sub Order ID directly (if input matches an item's order_id)
        if (!subOrderId && Array.isArray(matched.items)) {
          const item = matched.items.find(
            (i) => i.order_id === row.orderNumber,
          );
          if (item) {
            subOrderId = item.order_id;
          }
        }

        matchedOrderIds.add(matched.id);
        // Defensive: Handle missing totalAmount and snake_case
        // Defensive: Handle missing totalAmount and snake_case
        // const sysAmount = getOrderAmount(matched);
        // const diff = Math.abs(sysAmount - row.amount); // No amount check anymore
        results.push({
          importRow: row,
          matchedOrder: matched,
          matchedSubOrderId: subOrderId,
          status: "matched", // Always match if ID found
          diff: 0,
        });
      } else {
        // Check if it's already verified
        const alreadyVerified = verifiedList.find(
          (v) =>
            v.tracking_number === row.orderNumber ||
            v.sub_order_id === row.orderNumber ||
            v.sub_order_id?.startsWith(row.orderNumber + "-"),
        );

        if (alreadyVerified) {
          results.push({
            importRow: row,
            matchedSubOrderId: alreadyVerified.sub_order_id,
            status: "already_verified",
            diff: 0, // Assume 0 or calculate if verified amount differs? Assume 0 for status check.
          });
        } else {
          results.push({
            importRow: row,
            status: "unmatched_file",
            diff: 0,
          });
        }
      }
    });

    // Optionally: Find system orders NOT in file?
    // "unmatched_system" logic if needed. User focused on verifying the file content.
    // I will include them? Maybe confusing if file is partial.
    // I'll stick to File-centric view for now as requested ("ตรวจสอบว่าคำสั่งซื้อนี้ถูกตีกลับจริง").

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
    // Group verified orders by Order ID (extracted from sub_order_id prefix)
    const grouped = verifiedOrders.reduce(
      (acc, v) => {
        // Extract order ID from sub_order_id by taking the prefix before the last "-"
        // This assumes sub_order_id format like "ORD123-1", "ORD123-2" where "ORD123" is the order ID
        const parts = v.sub_order_id.split("-");
        const orderId =
          parts.length > 1 ? parts.slice(0, -1).join("-") : v.sub_order_id;

        // Find the matching parent order
        const parent = orders.find((o) => o.id === orderId);
        const key = orderId;

        if (!acc[key]) {
          acc[key] = {
            displayId: key,
            parentOrder: parent,
            items: [] as typeof verifiedOrders,
          };
        }
        acc[key].items.push(v);
        return acc;
      },
      {} as Record<
        string,
        { displayId: string; parentOrder?: Order; items: typeof verifiedOrders }
      >,
    );

    const sortedGroups = Object.values(grouped).sort((a, b) => {
      const maxA = Math.max(
        ...a.items.map((i) => new Date(i.created_at).getTime()),
      );
      const maxB = Math.max(
        ...b.items.map((i) => new Date(i.created_at).getTime()),
      );
      return maxB - maxA;
    });

    return (
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                รหัสออเดอร์
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                เลขพัสดุ & สถานะ
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                หมายเหตุ
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                วันที่ตรวจสอบ
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                จัดการ
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedGroups.map((group) => {
              const { displayId, parentOrder, items } = group;
              // Only show if parentOrder exists (meaning it matches the current filter/tab)
              if (!parentOrder) return null;

              // Representative item (first one) for shared data if needed
              const rep = items[0];

              return (
                <tr key={displayId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 align-top">
                    <div className="flex items-center gap-2">
                      <span
                        className="cursor-pointer hover:underline"
                        onClick={() => setSelectedOrderId(displayId)}
                      >
                        {displayId}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(displayId);
                        }}
                        className="text-gray-400 hover:text-gray-600"
                        title="Copy Order ID"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                    {/* Optional: Show count of returned items */}
                    <div className="text-xs text-gray-400 mt-1">
                      {items.length} รายการ
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-top">
                    <div className="flex flex-col gap-1">
                      {(() => {
                        // Display each sub order ID with its status
                        return items.map((v, i) => (
                          <div
                            key={i}
                            className="flex flex-col border-b last:border-0 pb-1 last:pb-0"
                          >
                            <span className="font-medium">
                              {v.tracking_number || v.sub_order_id}
                            </span>
                            <span className="text-xs text-gray-500">
                              Sub Order: {v.sub_order_id}
                            </span>
                            <span
                              className={`text-xs ${v.status === "returning"
                                ? "text-orange-600"
                                : v.status === "returned"
                                  ? "text-red-600"
                                  : v.status === "delivering"
                                    ? "text-blue-600"
                                    : v.status === "delivered"
                                      ? "text-green-600"
                                      : "text-gray-500"
                                }`}
                            >
                              (
                              {v.status === "returning"
                                ? "ตีกลับ"
                                : v.status === "returned"
                                  ? "เข้าคลังแล้ว"
                                  : v.status === "delivering"
                                    ? "อยู่ระหว่างจัดส่ง"
                                    : v.status === "delivered"
                                      ? "จัดส่งสำเร็จ"
                                      : v.status}
                              )
                            </span>
                          </div>
                        ));
                      })()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 align-top">
                    {items
                      .map((i) => i.note)
                      .filter((n) => n)
                      .map((n, idx) => (
                        <div key={idx} className="block text-xs mb-1 last:mb-0">
                          - {n}
                        </div>
                      ))}
                    {items.every((i) => !i.note) && "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500 align-top">
                    {new Date(rep.created_at).toLocaleDateString("th-TH")}
                    <div className="text-xs text-gray-400">
                      {new Date(rep.created_at).toLocaleTimeString("th-TH", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium align-top">
                    <button
                      onClick={() => handleManageVerified(rep)}
                      className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1 rounded border border-indigo-200"
                    >
                      จัดการ
                    </button>
                  </td>
                </tr>
              );
            })}
            {verifiedOrders.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  ไม่พบรายการที่ตรวจสอบแล้ว
                </td>
              </tr>
            )}
          </tbody>
        </table>
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

      {/* Tabs Row - Moved Here */}
      {mode === "list" && (
        <div className="mb-6">
          <div className="inline-flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab("pending")}
              className={`flex items-center gap-2 px-6 py-3 border-b-2 font-medium text-sm transition-colors ${activeTab === "pending"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
            >
              <Clock size={18} />
              ยังไม่ตรวจสอบ (Pending)
            </button>
            <button
              onClick={() => setActiveTab("checking")}
              className={`flex items-center gap-2 px-6 py-3 border-b-2 font-medium text-sm transition-colors ${activeTab === "checking"
                ? "border-yellow-500 text-yellow-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
            >
              <AlertCircle size={18} />
              อยู่ระหว่างตรวจสอบ (Checking)
            </button>
            <button
              onClick={() => setActiveTab("verified")}
              className={`flex items-center gap-2 px-6 py-3 border-b-2 font-medium text-sm transition-colors ${activeTab === "verified"
                ? "border-green-600 text-green-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
            >    ตรวจสอบแล้ว (Verified)
            </button>
          </div>
        </div>
      )}

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
              <button
                onClick={() => {
                  setImportTargetStatus("returning");
                  setIsImportStatusModalOpen(false);
                  setTimeout(() => fileInputRef.current?.click(), 100);
                }}
                className="w-full py-3 bg-orange-100 text-orange-800 rounded-lg hover:bg-orange-200 font-medium flex items-center justify-center gap-2"
              >
                <RefreshCw size={18} /> Import ตีกลับ (Returning)
              </button>
              <button
                onClick={() => {
                  setImportTargetStatus("returned");
                  setIsImportStatusModalOpen(false);
                  setTimeout(() => fileInputRef.current?.click(), 100);
                }}
                className="w-full py-3 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 font-medium flex items-center justify-center gap-2"
              >
                <CheckCircle size={18} /> Import เข้าคลังแล้ว (Returned)
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === "verify" && importedData.length > 0 ? (
        <VerificationList />
      ) : activeTab === "verified" ? (
        <VerifiedListTable />
      ) : (
        <SystemList />
      )}

      {/* Paste Modal */}
      {isPasteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <Clipboard size={20} className="text-indigo-600" />
                วางข้อมูลจาก Excel
              </h3>
              <button
                onClick={() => setIsPasteModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 flex-1 flex flex-col overflow-hidden relative">
              {/* Instructions */}
              <p className="text-sm text-gray-600 mb-2">
                คัดลอกข้อมูลจาก Excel (คอลัมน์ A: Order/Tracking ID, คอลัมน์ B:
                ยอดเงิน) แล้วกด <b>Ctrl+V</b>
              </p>

              {/* Hidden Textarea for Paste Capture */}
              <textarea
                ref={pasteInputRef}
                className="opacity-0 absolute top-0 left-0 w-full h-full -z-10"
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
                autoFocus
              ></textarea>

              {/* Excel-like Grid View */}
              <div
                className="flex-1 border border-gray-300 rounded-lg overflow-auto bg-gray-50 relative cursor-text"
                onClick={() => pasteInputRef.current?.focus()}
              >
                {previewRows.length > 0 ? (
                  <table className="border-collapse w-full min-w-[500px]">
                    <thead>
                      <tr>
                        <th className="w-10 bg-gray-100 border-r border-b border-gray-300"></th>
                        <th className="bg-gray-100 border-r border-b border-gray-300 px-2 py-1 text-xs font-semibold text-gray-500 w-1/2">
                          A (เลขพัสดุ / รหัสออเดอร์)
                        </th>
                        <th className="bg-gray-100 border-b border-gray-300 px-2 py-1 text-xs font-semibold text-gray-500 w-1/2">
                          B (หมายเหตุ)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, rIdx) => (
                        <tr key={rIdx} className="bg-white">
                          <td className="bg-gray-50 border-r border-b border-gray-300 text-center text-xs text-gray-500 font-mono w-10 sticky left-0">
                            {rIdx + 1}
                          </td>
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className="border-r border-b border-gray-200 px-2 py-1 text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]"
                            >
                              {cell}
                            </td>
                          ))}
                          {row.length < 2 &&
                            Array.from({ length: 2 - row.length }).map(
                              (_, i) => (
                                <td
                                  key={`empty - ${i} `}
                                  className="border-r border-b border-gray-200 px-2 py-1 text-sm bg-gray-50/20"
                                ></td>
                              ),
                            )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <div className="grid grid-cols-4 gap-0.5 opacity-50 mb-4 p-4 border border-dashed border-gray-300 rounded bg-white">
                      <div className="w-8 h-4 bg-gray-200"></div>
                      <div className="w-8 h-4 bg-gray-200"></div>
                      <div className="w-8 h-4 bg-gray-200"></div>
                      <div className="w-8 h-4 bg-gray-200"></div>
                      <div className="w-8 h-4 bg-gray-200"></div>
                      <div className="w-8 h-4 bg-blue-100"></div>
                      <div className="w-8 h-4 bg-blue-100"></div>
                      <div className="w-8 h-4 bg-gray-200"></div>
                      <div className="w-8 h-4 bg-gray-200"></div>
                      <div className="w-8 h-4 bg-blue-100"></div>
                      <div className="w-8 h-4 bg-blue-100"></div>
                      <div className="w-8 h-4 bg-gray-200"></div>
                      <div className="w-8 h-4 bg-gray-200"></div>
                      <div className="w-8 h-4 bg-gray-200"></div>
                      <div className="w-8 h-4 bg-gray-200"></div>
                      <div className="w-8 h-4 bg-gray-200"></div>
                    </div>
                    <p>คลิกที่นี่แล้วกด Ctrl+V เพื่อวางข้อมูล</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setIsPasteModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-100"
              >
                ยกเลิก
              </button>
              <button
                onClick={handlePasteVerification}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
              >
                ตรวจสอบข้อมูล
              </button>
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
                  {manageRows.map((row, idx) => (
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
                            <span className="text-gray-600">รอดำเนินการ</span>
                          </label>
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
                            <span className="text-orange-700">
                              ตีกลับ
                            </span>
                          </label>
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
                          {row.status === "delivered" && (
                            <div className="ml-6 mt-1 flex items-center gap-2">
                              <span className="text-xs text-gray-500">
                                ยอดที่เก็บได้:
                              </span>
                              <input
                                type="number"
                                value={row.collectedAmount || ""}
                                onChange={(e) => {
                                  const newRows = [...manageRows];
                                  newRows[idx].collectedAmount = parseFloat(
                                    e.target.value,
                                  );
                                  setManageRows(newRows);
                                }}
                                className="w-24 px-2 py-1 text-sm border border-green-300 rounded focus:ring-green-500 focus:border-green-500"
                                placeholder="บาท"
                              />
                            </div>
                          )}
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={"status-" + idx}
                              checked={row.status === "other"}
                              onChange={() => {
                                const newRows = [...manageRows];
                                newRows[idx].status = "other";
                                setManageRows(newRows);
                              }}
                              className="text-gray-600 focus:ring-gray-500"
                            />
                            <span className="text-gray-700">
                              อื่นๆ (Others)
                            </span>
                          </label>

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
                  ))}
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
          </div>
        </div>
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
