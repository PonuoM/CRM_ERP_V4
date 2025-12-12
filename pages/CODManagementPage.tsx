import React, { useEffect, useMemo, useState } from "react";
import {
  User,
  Order,
  PaymentStatus,
} from "../types";
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Search,
  Download,
  UploadCloud,
  Plus,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { patchOrder, apiFetch } from "../services/api";

interface CODManagementPageProps {
  user: User;
  orders: Order[];
  customers: any[];
  users: User[];
  onOrdersPaidUpdate?: (
    updates: Record<
      string,
      {
        amountPaid: number;
        paymentStatus: PaymentStatus;
      }
    >,
  ) => void;
}

interface CODRecord {
  id?: number;
  trackingNumber: string;
  codAmount: number;
  orderId?: string;
  orderAmount?: number;
  difference?: number;
  status?: "matched" | "unmatched" | "returned" | "pending" | "unchecked";
  returnCondition?: "ชำรุด" | "ปกติ";
  manualStatus?: "ศูนย์หาย" | "ไม่สำเร็จ" | "หายศูนย์" | "";
  message?: string;
}

type ValidationStatus = 'matched' | 'unmatched' | 'returned' | 'pending' | 'unchecked';

interface RowData {
  id: number;
  trackingNumber: string;
  codAmount: string;
  status: ValidationStatus;
  message: string;
  orderId?: string;
  orderAmount?: number;
  difference?: number;
  returnCondition?: "ชำรุด" | "ปกติ";
  manualStatus?: "ศูนย์หาย" | "ไม่สำเร็จ" | "หายศูนย์" | "";
}

interface BankAccount {
  id: number;
  bank: string;
  bank_number: string;
  is_active?: boolean;
}

const createEmptyRow = (id: number): RowData => ({
  id,
  trackingNumber: '',
  codAmount: '',
  status: 'unchecked',
  message: '',
});

const normalizeTrackingNumber = (value: string) =>
  value.replace(/\s+/g, "").toLowerCase();

const parseAmount = (value: string) =>
  parseFloat(value.replace(/[^\d.-]/g, "")) || 0;

const getTodayDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const getCurrentTime = () => {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const formatCurrency = (amount: number) =>
  `฿${amount.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getBaseOrderId = (orderId?: string) => {
  if (!orderId) {
    return undefined;
  }
  const match = orderId.match(/^(.+)-(\d+)$/);
  return match ? match[1] : orderId;
};

const CODManagementPage: React.FC<CODManagementPageProps> = ({
  user,
  orders,
  customers,
  users,
  onOrdersPaidUpdate,
}) => {
  const [rows, setRows] = useState<RowData[]>(Array.from({ length: 15 }, (_, i) => createEmptyRow(i + 1)));
  const [isVerified, setIsVerified] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showReturnedOnly, setShowReturnedOnly] = useState(false);

  const [documentNumber, setDocumentNumber] = useState("");
  const [documentDate, setDocumentDate] = useState(getTodayDate());
  const [documentTime, setDocumentTime] = useState(getCurrentTime());
  const [bankAccountId, setBankAccountId] = useState<number | "">("");
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchBanks = async () => {
      if (!user?.companyId) return;
      try {
        setIsLoadingBanks(true);
        const qs = new URLSearchParams({ companyId: String(user.companyId), active: 'true' });
        const data = await apiFetch(`bank_accounts?${qs.toString()}`);
        if (Array.isArray(data)) {
          setBankAccounts(data as BankAccount[]);
          if (!bankAccountId && data.length > 0) {
            setBankAccountId(data[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load bank accounts', error);
      } finally {
        setIsLoadingBanks(false);
      }
    };
    fetchBanks();
  }, [user?.companyId]);

  const handleInputChange = (index: number, field: 'trackingNumber' | 'codAmount', value: string) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    // Reset status on change
    newRows[index].status = 'unchecked';
    newRows[index].message = '';
    setRows(newRows);
    setIsVerified(false);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');
    const pastedRows = pasteData.split('\n').filter(r => r.trim() !== '');

    if (pastedRows.length === 0) return;

    const target = e.target as HTMLInputElement;
    const rowIndex = parseInt(target.dataset.index || '0', 10);

    const newRows = [...rows];
    pastedRows.forEach((pastedRow, i) => {
      const [trackingNumber, codAmount] = pastedRow.split(/[\t,]/); // Split by tab or comma
      const currentRowIndex = rowIndex + i;
      if (currentRowIndex < newRows.length) {
        newRows[currentRowIndex] = {
          ...newRows[currentRowIndex],
          trackingNumber: trackingNumber?.trim() || '',
          codAmount: codAmount?.trim() || '',
          status: 'unchecked',
          message: ''
        };
      } else {
        newRows.push({
          ...createEmptyRow(newRows.length + 1),
          trackingNumber: trackingNumber?.trim() || '',
          codAmount: codAmount?.trim() || '',
        });
      }
    });

    setRows(newRows);
    setIsVerified(false);
  };

  const addRow = () => {
    setRows([...rows, createEmptyRow(rows.length + 1)]);
  };

  const removeRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index).map((row, i) => ({ ...row, id: i + 1 })));
  };

  const trackingLookup = useMemo(() => {
    const map = new Map<string, { orderId: string; parentOrderId: string; boxNumber?: number; expectedAmount: number }>();
    // New: Store all sub-orders grouped by parent order
    const parentOrderSubOrders = new Map<string, Array<{ orderId: string; expectedAmount: number; trackingNumber: string }>>();

    orders.forEach((order) => {
      const details = (order as any).trackingDetails ?? (order as any).tracking_details ?? [];
      const boxes = (order as any).boxes ?? [];

      // Create map of sub_order_id -> cod_amount from order_boxes
      // This ensures we get the correct COD amount per box
      const subOrderIdToAmountMap = new Map<string, number>();
      const boxNumberToAmountMap = new Map<number, number>();
      const boxNumberToSubOrderIdMap = new Map<number, string>();
      boxes.forEach((b: any) => {
        const subOrderId = b.sub_order_id ?? b.subOrderId;
        const boxNumRaw = b.boxNumber ?? b.box_number;
        const boxNum = boxNumRaw !== undefined && boxNumRaw !== null ? Number(boxNumRaw) : NaN;
        const amt = parseFloat(String(b.codAmount ?? b.cod_amount ?? b.collectionAmount ?? b.collection_amount ?? 0));
        const codAmount = Number.isFinite(amt) ? amt : 0;

        if (subOrderId && subOrderId !== '') {
          subOrderIdToAmountMap.set(String(subOrderId), codAmount);
        }
        if (!Number.isNaN(boxNum)) {
          boxNumberToAmountMap.set(boxNum, codAmount);
          if (subOrderId && subOrderId !== '') {
            boxNumberToSubOrderIdMap.set(boxNum, String(subOrderId));
          }
        }
      });

      const fallbackAmount =
        typeof order.codAmount === 'number'
          ? order.codAmount
          : typeof order.totalAmount === 'number'
            ? order.totalAmount
            : 0;

      details.forEach((detail: any) => {
        const tn = detail.tracking_number ?? detail.trackingNumber ?? '';
        const normalized = normalizeTrackingNumber(String(tn));
        if (!normalized) return;
        if (map.has(normalized)) return;

        const boxNumber = detail.box_number ?? detail.boxNumber;
        const boxNum = boxNumber !== undefined && boxNumber !== null ? Number(boxNumber) : undefined;
        const detailOrderId = detail.order_id ?? detail.orderId;
        const parentOrderId = detail.parent_order_id ?? detail.parentOrderId ?? order.id;
        const resolvedSubOrderId =
          (detailOrderId && subOrderIdToAmountMap.has(detailOrderId) ? detailOrderId : undefined) ??
          (boxNum !== undefined ? boxNumberToSubOrderIdMap.get(boxNum) : undefined) ??
          (detailOrderId ?? undefined);

        // Priority: Use sub_order_id from order_boxes, then box_number, then fallback
        let expectedAmount = fallbackAmount;

        // First try: Use sub_order_id to find COD amount from order_boxes
        if (resolvedSubOrderId && subOrderIdToAmountMap.has(resolvedSubOrderId)) {
          expectedAmount = subOrderIdToAmountMap.get(resolvedSubOrderId) || 0;
        }
        // Second try: Use box_number to find COD amount from order_boxes
        else if (boxNum !== undefined && boxNumberToAmountMap.has(boxNum)) {
          expectedAmount = boxNumberToAmountMap.get(boxNum) || 0;
        }

        map.set(normalized, {
          orderId: resolvedSubOrderId ?? parentOrderId ?? order.id, // Prefer sub order id from order_boxes
          parentOrderId,
          boxNumber: boxNum,
          expectedAmount,
        });

        // Group sub-orders by parent order
        if (!parentOrderSubOrders.has(parentOrderId)) {
          parentOrderSubOrders.set(parentOrderId, []);
        }
        parentOrderSubOrders.get(parentOrderId)!.push({
          orderId: resolvedSubOrderId ?? parentOrderId ?? order.id,
          expectedAmount,
          trackingNumber: normalized,
        });
      });

      if (details.length === 0 && Array.isArray(order.trackingNumbers)) {
        order.trackingNumbers.forEach((tn) => {
          const normalized = normalizeTrackingNumber(String(tn));
          if (!normalized || map.has(normalized)) return;
          map.set(normalized, {
            orderId: order.id,
            parentOrderId: order.id,
            boxNumber: undefined,
            expectedAmount: fallbackAmount || 0,
          });

          if (!parentOrderSubOrders.has(order.id)) {
            parentOrderSubOrders.set(order.id, []);
          }
          parentOrderSubOrders.get(order.id)!.push({
            orderId: order.id,
            expectedAmount: fallbackAmount || 0,
            trackingNumber: normalized,
          });
        });
      }
    });
    return { map, parentOrderSubOrders };
  }, [orders]);

  const handleValidate = () => {
    // First pass: identify all rows and group by parent order
    const rowsByParentOrder = new Map<string, Array<{ row: RowData; index: number; codAmount: number; normalized: string }>>();
    const unmatchedRows: Array<{ row: RowData; index: number }> = [];

    rows.forEach((row, index) => {
      const trimmedTracking = row.trackingNumber.trim();
      if (!trimmedTracking && !row.codAmount.trim()) {
        return; // Skip empty rows
      }
      if (!trimmedTracking || !row.codAmount.trim()) {
        unmatchedRows.push({ row, index });
        return;
      }

      const codAmountValue = parseAmount(row.codAmount);
      if (!codAmountValue || codAmountValue <= 0) {
        unmatchedRows.push({ row, index });
        return;
      }

      const normalized = normalizeTrackingNumber(trimmedTracking);
      const matched = normalized ? trackingLookup.map.get(normalized) : undefined;

      if (matched && matched.parentOrderId) {
        if (!rowsByParentOrder.has(matched.parentOrderId)) {
          rowsByParentOrder.set(matched.parentOrderId, []);
        }
        rowsByParentOrder.get(matched.parentOrderId)!.push({
          row,
          index,
          codAmount: codAmountValue,
          normalized,
        });
      } else {
        unmatchedRows.push({ row, index });
      }
    });

    // Second pass: For each parent order, find optimal matching
    const validatedRows = [...rows];

    // Handle unmatched rows first
    unmatchedRows.forEach(({ row, index }) => {
      const trimmedTracking = row.trackingNumber.trim();
      const codAmountValue = parseAmount(row.codAmount);

      if (!trimmedTracking && !row.codAmount.trim()) {
        validatedRows[index] = { ...row, status: 'unchecked' as ValidationStatus, message: '' };
      } else if (!trimmedTracking || !row.codAmount.trim()) {
        validatedRows[index] = { ...row, status: 'pending' as ValidationStatus, message: 'กรอกข้อมูลไม่ครบ' };
      } else if (!codAmountValue || codAmountValue <= 0) {
        validatedRows[index] = { ...row, status: 'pending' as ValidationStatus, message: 'จำนวนเงินไม่ถูกต้อง' };
      } else {
        validatedRows[index] = { ...row, trackingNumber: trimmedTracking, codAmount: row.codAmount, status: 'pending' as ValidationStatus, message: 'ไม่พบ Tracking' };
      }
    });

    // Handle matched rows with closest matching
    rowsByParentOrder.forEach((groupRows, parentOrderId) => {
      const subOrders = trackingLookup.parentOrderSubOrders.get(parentOrderId) || [];

      // Create a list of available sub-orders (can be matched multiple times if needed)
      const availableSubOrders = [...subOrders];
      const usedSubOrders = new Set<string>();

      // Sort rows by COD amount for greedy matching
      const sortedRows = [...groupRows].sort((a, b) => a.codAmount - b.codAmount);

      // For each row, find the closest matching sub-order
      sortedRows.forEach(({ row, index, codAmount, normalized }) => {
        // Find closest match among unused sub-orders first, then used ones
        let bestMatch: typeof subOrders[0] | undefined;
        let bestDiff = Infinity;

        availableSubOrders.forEach((subOrder) => {
          const diff = Math.abs(codAmount - subOrder.expectedAmount);
          const isUsed = usedSubOrders.has(subOrder.trackingNumber);

          // Prefer unused sub-orders, but allow reuse if necessary
          if (diff < bestDiff || (diff === bestDiff && !isUsed)) {
            bestMatch = subOrder;
            bestDiff = diff;
          }
        });

        if (bestMatch) {
          const orderCodAmount = bestMatch.expectedAmount || 0;
          const difference = codAmount - orderCodAmount;

          validatedRows[index] = {
            ...row,
            trackingNumber: row.trackingNumber.trim(),
            codAmount: row.codAmount,
            orderId: bestMatch.orderId,
            orderAmount: orderCodAmount,
            difference: difference,
            status: difference === 0 ? ('matched' as ValidationStatus) : ('unmatched' as ValidationStatus),
            message:
              difference === 0
                ? 'ตรงกัน'
                : `ส่วนต่าง: ${difference > 0 ? '+' : ''}฿${Math.abs(difference).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
          };

          // Mark this sub-order as used
          usedSubOrders.add(bestMatch.trackingNumber);
        } else {
          // Fallback if no match found
          validatedRows[index] = {
            ...row,
            trackingNumber: row.trackingNumber.trim(),
            codAmount: row.codAmount,
            status: 'pending' as ValidationStatus,
            message: 'ไม่พบ Sub-order ที่ตรงกัน'
          };
        }
      });
    });

    setRows(validatedRows);
    setIsVerified(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());
      if (lines.length < 2) {
        alert("ไฟล์ไม่มีข้อมูล");
        return;
      }

      // Skip header if exists
      const dataLines = lines.slice(1);
      const newRows: RowData[] = [];

      dataLines.forEach((line, i) => {
        const [trackingNumber, codAmount] = line.split(/[\t,]/).map(c => c.trim().replace(/^"|"$/g, ""));
        if (trackingNumber && codAmount) {
          newRows.push({
            ...createEmptyRow(i + 1),
            trackingNumber: trackingNumber,
            codAmount: codAmount,
          });
        }
      });

      if (newRows.length > 0) {
        setRows([...newRows, ...Array.from({ length: Math.max(0, 15 - newRows.length) }, (_, i) => createEmptyRow(newRows.length + i + 1))]);
      }
    } catch (error) {
      console.error("Error parsing CSV:", error);
      alert("เกิดข้อผิดพลาดในการอ่านไฟล์");
    }
  };

  const handleMarkReturned = (row: RowData, condition: "ชำรุด" | "ปกติ") => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? { ...r, status: "returned" as ValidationStatus, returnCondition: condition, message: `ตีกลับ (${condition})` }
          : r
      )
    );
  };

  const handleSetManualStatus = (row: RowData, status: "ศูนย์หาย" | "ไม่สำเร็จ" | "หายศูนย์") => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? { ...r, manualStatus: status }
          : r
      )
    );
  };

  const handleApproveReturned = async (row: RowData) => {
    if (!row.orderId) return;

    try {
      await patchOrder(row.orderId, {
        orderStatus: "Returned",
        notes: `COD ตีกลับ - สภาพ: ${row.returnCondition || "ไม่ระบุ"}`,
      });

      alert("Approve ออเดอร์ที่ตีกลับเรียบร้อยแล้ว");
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? { ...r, status: "matched" as ValidationStatus, message: "Approve แล้ว" }
            : r
        )
      );
    } catch (error) {
      console.error("Error approving returned order:", error);
      alert("เกิดข้อผิดพลาดในการ Approve");
    }
  };

  const handleApproveManualStatus = async (row: RowData) => {
    if (!row.orderId) return;

    try {
      await patchOrder(row.orderId, {
        orderStatus: "Cancelled",
        notes: `COD ${row.manualStatus}`,
      });

      alert("Approve ออเดอร์เรียบร้อยแล้ว");
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? { ...r, status: "matched" as ValidationStatus, message: "Approve แล้ว" }
            : r
        )
      );
    } catch (error) {
      console.error("Error approving manual status:", error);
      alert("เกิดข้อผิดพลาดในการ Approve");
    }
  };


  const handleImport = async () => {
    const readyRows = rows.filter(
      (row) => row.status === "matched" || row.status === "unmatched",
    );
    if (readyRows.length === 0) {
      alert("ไม่มีรายการที่พร้อมนำเข้า (สถานะ matched หรือ unmatched)");
      return;
    }

    if (!documentNumber.trim()) {
      alert("กรุณากรอกเลขที่เอกสาร");
      return;
    }
    if (!documentDate || !documentTime) {
      alert("กรุณากรอกวันที่และเวลาเอกสาร");
      return;
    }
    if (!bankAccountId) {
      alert("กรุณาเลือกบัญชีธนาคาร");
      return;
    }

    const uniqueRowsByTracking = new Map<string, RowData>();
    const duplicateRowsInUpload: string[] = [];
    readyRows.forEach((row) => {
      const normalized = normalizeTrackingNumber(row.trackingNumber);
      if (!normalized) return;
      if (uniqueRowsByTracking.has(normalized)) {
        duplicateRowsInUpload.push(row.trackingNumber.trim());
        return;
      }
      uniqueRowsByTracking.set(normalized, row);
    });

    if (uniqueRowsByTracking.size === 0) {
      alert("ไม่มีข้อมูล COD ที่จะนำเข้า");
      return;
    }

    if (!user?.companyId) {
      alert("ไม่สามารถระบุบริษัทสำหรับนำเข้า COD");
      return;
    }

    const normalizedTrackingList = Array.from(uniqueRowsByTracking.keys());
    const existingTrackingNumbers = new Set<string>();

    try {
      await Promise.all(
        normalizedTrackingList.map(async (normalizedTracking) => {
          const qs = new URLSearchParams({
            companyId: String(user.companyId),
            trackingNumber: normalizedTracking,
          });
          const existingRecords = await apiFetch(`cod_records?${qs.toString()}`);
          if (
            Array.isArray(existingRecords) &&
            existingRecords.some(
              (record: any) =>
                normalizeTrackingNumber(record?.tracking_number || "") === normalizedTracking,
            )
          ) {
            existingTrackingNumbers.add(normalizedTracking);
          }
        }),
      );
    } catch (error) {
      console.error("COD duplicate lookup failed", error);
      alert("เกิดข้อผิดพลาดในการตรวจสอบ COD ซ้ำ กรุณาลองใหม่");
      return;
    }

    const rowsToImport = normalizedTrackingList
      .filter((normalized) => !existingTrackingNumbers.has(normalized))
      .map((normalized) => uniqueRowsByTracking.get(normalized)!)
      .filter(Boolean);

    const finalRowsToImport = rowsToImport.filter(row => {
      if (!row.orderId) return true;
      const baseId = getBaseOrderId(row.orderId);
      const order = orders.find(o => o.id === baseId);
      if (order && (order.amountPaid || 0) > 0) {
        console.warn(`Skipping order ${order.id} because it already has amountPaid: ${order.amountPaid}`);
        return false;
      }
      return true;
    });

    if (finalRowsToImport.length === 0) {
      alert("ไม่มีรายการที่จะนำเข้า (tracking อาจซ้ำ หรือออเดอร์มีการจ่ายเงินแล้ว)");
      return;
    }

    const skipMessages: string[] = [];
    if (duplicateRowsInUpload.length > 0) {
      skipMessages.push(`${duplicateRowsInUpload.length} รายการซ้ำในไฟล์อัปโหลด`);
    }
    if (existingTrackingNumbers.size > 0) {
      skipMessages.push(`${existingTrackingNumbers.size} รายการมีอยู่แล้ว`);
    }
    if (rowsToImport.length > finalRowsToImport.length) {
      skipMessages.push(`${rowsToImport.length - finalRowsToImport.length} รายการถูกข้าม (จ่ายแล้ว)`);
    }

    const confirmMessage = [
      `ยืนยันนำเข้า COD จำนวน ${finalRowsToImport.length} รายการ สำหรับเอกสาร ${documentNumber}?`,
      skipMessages.length > 0 ? `ข้าม: ${skipMessages.join(" / ")}` : "",
      `ยอดรวมนำเข้า: ฿${totalInputAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`,
      `ยอดรวมออเดอร์ที่ตรง: ฿${totalMatchedOrderAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`,
    ]
      .filter(Boolean)
      .join("\n");

    if (!window.confirm(confirmMessage)) {
      return;
    }

    const payloadRows = finalRowsToImport.map((row) => ({
      row,
      codAmount: parseAmount(row.codAmount),
      orderAmount: row.orderAmount ?? 0,
    }));

    setIsSubmitting(true);
    const documentDateTime = `${documentDate} ${documentTime || "00:00"}:00`;

    try {
      await apiFetch("cod_documents", {
        method: "POST",
        body: JSON.stringify({
          document_number: documentNumber.trim(),
          document_datetime: documentDateTime,
          bank_account_id: bankAccountId === "" ? null : bankAccountId,
          company_id: user.companyId,
          created_by: user.id,
          total_input_amount: totalInputAmount,
          total_order_amount: totalMatchedOrderAmount,
          items: payloadRows.map(({ row, codAmount, orderAmount }) => ({
            tracking_number: row.trackingNumber.trim(),
            cod_amount: codAmount,
            order_amount: orderAmount,
            order_id: row.orderId || null,
            difference: row.difference ?? codAmount - orderAmount,
            status: row.status,
          })),
        }),
      });

      const totalsByOrder = new Map<
        string,
        { totalPaid: number; totalExpected: number }
      >();

      payloadRows.forEach(({ row, codAmount, orderAmount }) => {
        const baseId = getBaseOrderId(row.orderId);
        if (!baseId) return;
        const agg =
          totalsByOrder.get(baseId) ?? { totalPaid: 0, totalExpected: 0 };
        agg.totalPaid += codAmount;
        agg.totalExpected += orderAmount;
        totalsByOrder.set(baseId, agg);
      });

      const orderUpdates: Record<
        string,
        { amountPaid: number; paymentStatus: PaymentStatus }
      > = {};

      if (totalsByOrder.size > 0) {
        await Promise.all(
          Array.from(totalsByOrder.entries()).map(([orderId, totals]) => {
            const roundedPaid = Math.round(totals.totalPaid * 100) / 100;
            const roundedExpected =
              Math.round((totals.totalExpected || 0) * 100) / 100;
            const nextStatus =
              roundedPaid > 0
                ? PaymentStatus.PreApproved
                : PaymentStatus.PendingVerification;

            const updatePayload: any = {
              amountPaid: roundedPaid,
              paymentStatus: nextStatus,
            };

            if (nextStatus === PaymentStatus.PreApproved) {
              updatePayload.orderStatus = 'PreApproved';
            }

            orderUpdates[orderId] = {
              amountPaid: roundedPaid,
              paymentStatus: nextStatus,
            };
            return patchOrder(orderId, updatePayload);
          }),
        );
        if (Object.keys(orderUpdates).length > 0) {
          onOrdersPaidUpdate?.(orderUpdates);
        }
      }

      const summaryLines = Array.from(totalsByOrder.entries()).map(
        ([orderId, totals]) =>
          `${orderId}: จ่าย ${formatCurrency(totals.totalPaid)} / ${formatCurrency(
            totals.totalExpected,
          )}`,
      );
      const successMessage = summaryLines.length
        ? `นำเข้าเอกสาร ${documentNumber} สำเร็จ (รวม ${finalRowsToImport.length} รายการ)\n${summaryLines.join("\n")}`
        : `นำเข้าเอกสาร ${documentNumber} สำเร็จ (รวม ${finalRowsToImport.length} รายการ)`;
      alert(successMessage);
      setRows(Array.from({ length: 15 }, (_, i) => createEmptyRow(i + 1)));
      setIsVerified(false);
      setDocumentNumber("");
      setDocumentTime(getCurrentTime());
    } catch (error) {
      console.error("COD import failed", error);
      alert("เกิดข้อผิดพลาดในการนำเข้า COD กรุณาลองใหม่");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter records
  const filteredRows = useMemo(() => {
    let filtered = rows.filter(r => r.trackingNumber.trim() || r.codAmount.trim());

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.trackingNumber.toLowerCase().includes(term) ||
          r.orderId?.toLowerCase().includes(term)
      );
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter((r) => r.status === filterStatus);
    }

    if (showReturnedOnly) {
      filtered = filtered.filter((r) => r.status === "returned");
    }

    return filtered;
  }, [rows, searchTerm, filterStatus, showReturnedOnly]);

  const { totalInputAmount, totalMatchedOrderAmount } = useMemo(() => {
    return rows.reduce((acc, r) => {
      const input = parseAmount(r.codAmount);
      if (input > 0) {
        acc.totalInputAmount += input;
      }
      if (r.orderAmount !== undefined && r.orderAmount !== null) {
        acc.totalMatchedOrderAmount += Number(r.orderAmount) || 0;
      }
      return acc;
    }, { totalInputAmount: 0, totalMatchedOrderAmount: 0 });
  }, [rows]);

  // Statistics
  const { validCount, unmatchedCount, pendingCount, returnedCount } = useMemo(() => {
    return rows.reduce((acc, r) => {
      if (r.status === 'matched') acc.validCount++;
      if (r.status === 'unmatched') acc.unmatchedCount++;
      if (r.status === 'pending') acc.pendingCount++;
      if (r.status === 'returned') acc.returnedCount++;
      return acc;
    }, { validCount: 0, unmatchedCount: 0, pendingCount: 0, returnedCount: 0 });
  }, [rows]);

  const getStatusIndicator = (status: ValidationStatus, message: string) => {
    switch (status) {
      case 'matched':
        return <div className="flex items-center text-green-600"><CheckCircle size={14} className="mr-1.5" /> {message}</div>;
      case 'unmatched':
        return <div className="flex items-center text-yellow-600"><AlertTriangle size={14} className="mr-1.5" /> {message}</div>;
      case 'returned':
        return <div className="flex items-center text-red-600"><XCircle size={14} className="mr-1.5" /> {message}</div>;
      case 'pending':
        return <div className="flex items-center text-orange-600"><AlertTriangle size={14} className="mr-1.5" /> {message}</div>;
      default:
        return <span className="text-gray-400">-</span>;
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">จัดการ COD</h2>
      <p className="text-gray-600 mb-6">คัดลอกข้อมูลจากไฟล์ Excel/CSV (2 คอลัมน์: Tracking Number, COD Amount) แล้ววางลงในตารางด้านล่าง</p>

      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">เลขที่เอกสาร</label>
            <input
              type="text"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="เช่น JAT25-11-2025-1556"
            />
            <p className="text-xs text-gray-500 mt-1">แนะนำ: ชื่อขนส่ง+วันที่+เวลา</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">วันที่เอกสาร</label>
              <input
                type="date"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">เวลา</label>
              <input
                type="time"
                value={documentTime}
                onChange={(e) => setDocumentTime(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">บัญชีธนาคาร</label>
            <select
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value ? Number(e.target.value) : "")}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoadingBanks}
            >
              <option value="">-- เลือก --</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {`${b.bank} - ${b.bank_number}`}
                </option>
              ))}
            </select>
            {isLoadingBanks && <p className="text-xs text-gray-500 mt-1">กำลังโหลดบัญชี...</p>}
            {!isLoadingBanks && bankAccounts.length === 0 && (
              <p className="text-xs text-orange-600 mt-1">ไม่พบบัญชีที่ใช้งาน</p>
            )}
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">ยอดรวม</p>
            <div className="mt-1 text-sm text-gray-700">ยอดนำเข้า: ฿{totalInputAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</div>
            <div className="text-sm text-gray-700">ยอดออเดอร์ตรง: ฿{totalMatchedOrderAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="flex justify-between items-center">
          {isVerified ? (
            <div className="flex items-center space-x-4 text-sm">
              <span className="flex items-center text-green-600 font-medium"><CheckCircle size={16} className="mr-2" />ตรงกัน: {validCount}</span>
              <span className="flex items-center text-yellow-600"><AlertTriangle size={16} className="mr-2" />ไม่ตรงกัน: {unmatchedCount}</span>
              <span className="flex items-center text-orange-600"><AlertTriangle size={16} className="mr-2" />รอตรวจสอบ: {pendingCount}</span>
              <span className="flex items-center text-red-600"><XCircle size={16} className="mr-2" />ตีกลับ: {returnedCount}</span>
            </div>
          ) : (
            <p className="text-sm text-gray-500">วางข้อมูลแล้วกด "ตรวจสอบข้อมูล" เพื่อดำเนินการต่อ</p>
          )}
          <div className="flex items-center space-x-2">
            <label className="cursor-pointer">
              <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50">
                <Upload size={16} />
                <span>อัปโหลดไฟล์</span>
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <button onClick={handleValidate} className="bg-white border border-gray-300 text-gray-700 text-sm rounded-md py-2 px-3 hover:bg-gray-50">ตรวจสอบข้อมูล</button>
            <button
              onClick={handleImport}
              disabled={
                !isVerified ||
                validCount + unmatchedCount === 0 ||
                isSubmitting ||
                !documentNumber.trim() ||
                !documentDate ||
                !documentTime ||
                !bankAccountId
              }
              className="bg-blue-100 text-blue-700 font-semibold text-sm rounded-md py-2 px-4 flex items-center hover:bg-blue-200 shadow-sm disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              <UploadCloud size={16} className="mr-2" />
              {isSubmitting ? "กำลังนำเข้า..." : `นำเข้าข้อมูล (${validCount + unmatchedCount})`}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-auto max-h-[calc(100vh-20rem)]">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
            <tr>
              <th className="px-2 py-3 w-12 text-center">#</th>
              <th className="px-6 py-3">เลข Tracking</th>
              <th className="px-6 py-3">COD Amount</th>
              <th className="px-6 py-3">Order ID</th>
              <th className="px-6 py-3 text-right">COD จากออเดอร์</th>
              <th className="px-6 py-3 text-right">ส่วนต่าง</th>
              <th className="px-6 py-3">สถานะ</th>
              <th className="px-2 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {rows.map((row, index) => (
              <tr key={row.id} className={`border-b ${row.status === 'matched' ? 'bg-green-50' : row.status === 'unmatched' ? 'bg-yellow-50' : row.status === 'pending' ? 'bg-orange-50' : row.status === 'returned' ? 'bg-red-50' : ''}`}>
                <td className="px-2 py-1 text-center text-gray-400">{index + 1}</td>
                <td className="px-6 py-1">
                  <input
                    type="text"
                    data-index={index}
                    value={row.trackingNumber}
                    onChange={(e) => handleInputChange(index, 'trackingNumber', e.target.value)}
                    onPaste={handlePaste}
                    className="w-full p-1 bg-transparent border-none focus:ring-0 focus:outline-none"
                    placeholder="TH123..."
                  />
                </td>
                <td className="px-6 py-1">
                  <input
                    type="text"
                    data-index={index}
                    value={row.codAmount}
                    onChange={(e) => handleInputChange(index, 'codAmount', e.target.value)}
                    onPaste={handlePaste}
                    className="w-full p-1 bg-transparent border-none focus:ring-0 focus:outline-none text-right"
                    placeholder="0.00"
                  />
                </td>
                <td className="px-6 py-1 text-sm">
                  {row.orderId ? (
                    <span className="text-blue-600">{row.orderId}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-1 text-sm text-right">
                  {row.orderAmount !== undefined && row.orderAmount !== null ? (
                    <span>฿{row.orderAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-1 text-sm text-right">
                  {row.difference !== undefined ? (
                    <span className={row.difference === 0 ? "text-green-600" : row.difference > 0 ? "text-orange-600" : "text-red-600"}>
                      {row.difference > 0 ? "+" : ""}฿{Math.abs(row.difference).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-1 text-xs font-medium">
                  {getStatusIndicator(row.status, row.message)}
                </td>
                <td className="px-2 py-1 text-center">
                  <button onClick={() => removeRow(index)} className="text-gray-400 hover:text-red-500 p-1">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-2">
          <button onClick={addRow} className="w-full text-sm flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 py-1.5 rounded-md">
            <Plus size={16} className="mr-1" /> เพิ่มแถว
          </button>
        </div>
      </div>

      {/* Action buttons for matched/unmatched rows */}
      {isVerified && filteredRows.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow mt-4">
          <div className="flex items-center gap-2 flex-wrap">
            {filteredRows.filter(r => r.status === 'unmatched').map((row) => (
              <div key={row.id} className="flex items-center gap-2 p-2 border rounded">
                <span className="text-sm">{row.trackingNumber}</span>
                <button
                  onClick={() => handleMarkReturned(row, "ชำรุด")}
                  className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                >
                  ตีกลับ (ชำรุด)
                </button>
                <button
                  onClick={() => handleMarkReturned(row, "ปกติ")}
                  className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200"
                >
                  ตีกลับ (ปกติ)
                </button>
                {row.status === "returned" && (
                  <button
                    onClick={() => handleApproveReturned(row)}
                    className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                  >
                    Approve
                  </button>
                )}
                {!row.orderId && (
                  <>
                    <select
                      value={row.manualStatus || ""}
                      onChange={(e) =>
                        handleSetManualStatus(
                          row,
                          e.target.value as "ศูนย์หาย" | "ไม่สำเร็จ" | "หายศูนย์"
                        )
                      }
                      className="px-2 py-1 border border-gray-300 rounded text-xs"
                    >
                      <option value="">เลือกสถานะ</option>
                      <option value="ศูนย์หาย">ศูนย์หาย</option>
                      <option value="ไม่สำเร็จ">ไม่สำเร็จ</option>
                      <option value="หายศูนย์">หายศูนย์</option>
                    </select>
                    {row.manualStatus && (
                      <button
                        onClick={() => handleApproveManualStatus(row)}
                        className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                      >
                        Approve
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CODManagementPage;
