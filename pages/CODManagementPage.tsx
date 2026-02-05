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
  // orders: Order[]; // Removed dependency
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
  amountPaid?: number;
  returnCondition?: "ชำรุด" | "ปกติ";
  manualStatus?: "ศูนย์หาย" | "ไม่สำเร็จ" | "หายศูนย์" | "";
  forceImport?: boolean; // NEW: Skip order update, just record for total matching
}

interface ExistingDocument {
  id: number;
  document_number: string;
  document_datetime: string;
  total_input_amount: number;
  total_order_amount: number;
  status: string;
  matched_statement_log_id: number | null;
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

  // NEW: Import mode and existing documents
  const [importMode, setImportMode] = useState<'new' | 'existing'>('new');
  const [existingDocuments, setExistingDocuments] = useState<ExistingDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [isLoadingExistingDocs, setIsLoadingExistingDocs] = useState(false);

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

  // NEW: Fetch existing pending documents for "add to existing" mode
  useEffect(() => {
    const fetchExistingDocs = async () => {
      if (!user?.companyId || importMode !== 'existing') return;
      try {
        setIsLoadingExistingDocs(true);
        const qs = new URLSearchParams({ companyId: String(user.companyId) });
        const data = await apiFetch(`cod_documents?${qs.toString()}`);
        if (Array.isArray(data)) {
          // Filter only pending documents (not yet matched with statement)
          const pendingDocs = data.filter((doc: ExistingDocument) =>
            !doc.matched_statement_log_id && doc.status !== 'verified'
          );
          setExistingDocuments(pendingDocs);
        }
      } catch (error) {
        console.error('Failed to load existing documents', error);
      } finally {
        setIsLoadingExistingDocs(false);
      }
    };
    fetchExistingDocs();
  }, [user?.companyId, importMode]);

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

  // NEW: Toggle force import for pending rows
  const handleToggleForceImport = (index: number) => {
    const newRows = [...rows];
    newRows[index].forceImport = !newRows[index].forceImport;
    setRows(newRows);
  };


  // Removed client-side trackingLookup to use Server-Side API

  const handleValidate = async () => {
    // 1. Collect all tracking numbers to validate
    const rowsToValidate = rows.map((row, index) => ({ row, index })).filter(({ row }) => row.trackingNumber.trim());

    if (rowsToValidate.length === 0) {
      alert("กรุณากรอก Tracking Number");
      return;
    }

    setIsSubmitting(true);
    try {
      // 2. Prepare payload
      const items = rowsToValidate.map(({ row }) => ({
        trackingNumber: row.trackingNumber.trim()
      }));

      // 3. Call API to validate against orders
      const response = await apiFetch('validate_cod_tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });

      const results: any[] = response.results || [];
      const resultMap = new Map<string, any>(); // normalized -> result

      results.forEach(res => {
        const normalized = normalizeTrackingNumber(res.trackingNumber);
        if (normalized) resultMap.set(normalized, res);
      });

      // NEW: Check cod_records for already imported tracking numbers
      const alreadyImportedMap = new Map<string, { cod_amount: number; status: string }>();
      if (user?.companyId) {
        try {
          await Promise.all(
            items.map(async (item) => {
              const normalized = normalizeTrackingNumber(item.trackingNumber);
              const qs = new URLSearchParams({
                companyId: String(user.companyId),
                trackingNumber: normalized,
              });
              const existingRecords = await apiFetch(`cod_records?${qs.toString()}`);
              if (Array.isArray(existingRecords) && existingRecords.length > 0) {
                const record = existingRecords.find(
                  (r: any) => normalizeTrackingNumber(r?.tracking_number || "") === normalized
                );
                if (record) {
                  alreadyImportedMap.set(normalized, {
                    cod_amount: parseFloat(record.cod_amount) || 0,
                    status: record.status || 'unknown'
                  });
                }
              }
            })
          );
        } catch (err) {
          console.warn("Failed to check existing cod_records", err);
        }
      }

      // 4. Update rows
      const validatedRows = [...rows];

      // We iterate ORIGINAL rows to preserve order
      rows.forEach((row, index) => {
        const trimmedTracking = row.trackingNumber.trim();
        if (!trimmedTracking) {
          // Skip empty
          return;
        }

        const normalized = normalizeTrackingNumber(trimmedTracking);
        const apiResult = resultMap.get(normalized);
        const alreadyImported = alreadyImportedMap.get(normalized);

        const codAmountValue = parseAmount(row.codAmount);
        // If amount is invalid in input
        const isAmountValid = Number.isFinite(codAmountValue) && codAmountValue >= 0;

        // NEW: Check if already imported to cod_records
        if (alreadyImported) {
          const importedAmount = alreadyImported.cod_amount;
          const importStatus = alreadyImported.status === 'forced' ? '(ข้าม)' : '';
          validatedRows[index] = {
            ...row,
            status: 'matched' as ValidationStatus,
            message: `ซ้ำแล้ว ฿${importedAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}${importStatus}`,
            orderId: apiResult?.orderId,
            orderAmount: apiResult?.expectedAmount || importedAmount,
            difference: 0,
            amountPaid: importedAmount, // Mark as already paid to skip during import
          };
          return;
        }

        if (!apiResult || apiResult.status === 'pending') {
          // Not found in DB
          validatedRows[index] = {
            ...row,
            status: 'pending' as ValidationStatus,
            message: 'ไม่พบ Tracking',
            difference: undefined,
            orderId: undefined,
            orderAmount: undefined
          };
        } else {
          // Found in DB
          const expected = apiResult.expectedAmount;
          const difference = isAmountValid ? codAmountValue - expected : 0;
          const amountMatch = isAmountValid && Math.abs(difference) < 0.01; // float epsilon

          // Check if already paid
          // The API returns amountDetails? We added amountPaid.
          const isPaid = (apiResult.amountPaid || 0) > 0;
          let status: ValidationStatus = amountMatch ? 'matched' : 'unmatched';
          let message = amountMatch ? 'ตรงกัน' : `ส่วนต่าง: ${difference > 0 ? '+' : ''}฿${Math.abs(difference).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;

          if (isPaid) {
            // Warn if paid?
            message += ` (จ่ายแล้ว: ฿${apiResult.amountPaid})`;
            // Maybe change status or keep matched but warn?
            // Usually we don't block validation but handleImport checks it.
          }

          if (!isAmountValid) {
            status = 'pending';
            message = 'ระบุยอดเงินไม่ถูกต้อง';
          }

          validatedRows[index] = {
            ...row,
            status,
            message,
            orderId: apiResult.orderId,
            orderAmount: expected,
            difference: isAmountValid ? difference : undefined,
            amountPaid: apiResult.amountPaid,
            // Preserving other fields
          };
        }
      });

      setRows(validatedRows);
      setIsVerified(true);

    } catch (error) {
      console.error("Validation failed", error);
      alert("เกิดข้อผิดพลาดในการตรวจสอบข้อมูล");
    } finally {
      setIsSubmitting(false);
    }
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
    // NEW: Include forceImport rows (pending status with forceImport checked)
    const readyRows = rows.filter(
      (row) => row.status === "matched" || row.status === "unmatched" ||
        (row.status === "pending" && row.forceImport)
    );
    if (readyRows.length === 0) {
      alert("ไม่มีรายการที่พร้อมนำเข้า (สถานะ matched, unmatched หรือติ๊กข้าม)");
      return;
    }

    // Validation based on import mode
    if (importMode === 'new') {
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
    } else {
      // existing mode
      if (!selectedDocumentId) {
        alert("กรุณาเลือกเอกสารที่ต้องการเพิ่มรายการ");
        return;
      }
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

    // For non-forceImport rows, skip if already paid
    const finalRowsToImport = rowsToImport.filter(row => {
      if (row.forceImport) return true; // Always include force import
      if (!row.orderId) return true;
      // Use amountPaid from validation result
      if ((row.amountPaid || 0) > 0) {
        console.warn(`Skipping order ${row.orderId} because it already has amountPaid: ${row.amountPaid}`);
        return false;
      }
      return true;
    });

    if (finalRowsToImport.length === 0) {
      alert("ไม่มีรายการที่จะนำเข้า (tracking อาจซ้ำ หรือออเดอร์มีการจ่ายเงินแล้ว)");
      return;
    }

    // Count forced imports
    const forcedCount = finalRowsToImport.filter(r => r.forceImport).length;

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

    const targetDocName = importMode === 'new'
      ? documentNumber
      : existingDocuments.find(d => d.id === selectedDocumentId)?.document_number || String(selectedDocumentId);

    const confirmMessage = [
      importMode === 'new'
        ? `ยืนยันสร้างเอกสาร COD ใหม่ (${documentNumber})?`
        : `ยืนยันเพิ่ม ${finalRowsToImport.length} รายการในเอกสาร ${targetDocName}?`,
      skipMessages.length > 0 ? `ข้าม: ${skipMessages.join(" / ")}` : "",
      `ยอดรวมนำเข้า: ฿${totalInputAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`,
      forcedCount > 0 ? `⚠️ รายการติ๊กข้าม (ไม่อัพเดท Order): ${forcedCount} รายการ` : "",
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
      if (importMode === 'new') {
        // POST - Create new document
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
              order_id: row.forceImport ? null : (row.orderId || null),
              difference: row.difference ?? codAmount - orderAmount,
              status: row.forceImport ? 'forced' : row.status,
              force_import: row.forceImport || false,
            })),
          }),
        });
      } else {
        // PATCH - Add to existing document
        await apiFetch(`cod_documents/${selectedDocumentId}`, {
          method: "PATCH",
          body: JSON.stringify({
            created_by: user.id,
            items: payloadRows.map(({ row, codAmount, orderAmount }) => ({
              tracking_number: row.trackingNumber.trim(),
              cod_amount: codAmount,
              order_amount: orderAmount,
              order_id: row.forceImport ? null : (row.orderId || null),
              difference: row.difference ?? codAmount - orderAmount,
              status: row.forceImport ? 'forced' : row.status,
              force_import: row.forceImport || false,
            })),
          }),
        });
      }

      // Update orders - only for non-forceImport rows
      const totalsByOrder = new Map<
        string,
        { totalPaid: number; totalExpected: number }
      >();

      payloadRows.forEach(({ row, codAmount, orderAmount }) => {
        if (row.forceImport) return; // Skip order update for forced imports
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
      const forcedSummary = forcedCount > 0 ? `\n⚠️ ${forcedCount} รายการติ๊กข้าม (ไม่อัพเดท Order)` : '';
      const successMessage = summaryLines.length
        ? `นำเข้า${importMode === 'new' ? 'เอกสาร ' + documentNumber : 'รายการเพิ่มเติม'} สำเร็จ (รวม ${finalRowsToImport.length} รายการ)\n${summaryLines.join("\n")}${forcedSummary}`
        : `นำเข้า${importMode === 'new' ? 'เอกสาร ' + documentNumber : 'รายการเพิ่มเติม'} สำเร็จ (รวม ${finalRowsToImport.length} รายการ)${forcedSummary}`;
      alert(successMessage);
      setRows(Array.from({ length: 15 }, (_, i) => createEmptyRow(i + 1)));
      setIsVerified(false);
      setDocumentNumber("");
      setDocumentTime(getCurrentTime());
      setSelectedDocumentId(null);
      setImportMode('new');
    } catch (error: any) {
      console.error("COD import failed", error);
      if (error?.data?.error === 'DOCUMENT_ALREADY_VERIFIED') {
        alert("ไม่สามารถแก้ไขเอกสารที่จับคู่กับ Statement แล้ว");
      } else {
        alert("เกิดข้อผิดพลาดในการนำเข้า COD กรุณาลองใหม่");
      }
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
        {/* NEW: Import Mode Selection */}
        <div className="mb-4 pb-4 border-b border-gray-200">
          <label className="block text-sm font-semibold text-gray-700 mb-2">โหมดนำเข้า</label>
          <div className="flex gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="importMode"
                value="new"
                checked={importMode === 'new'}
                onChange={() => {
                  setImportMode('new');
                  setSelectedDocumentId(null);
                }}
                className="mr-2"
              />
              <span className="text-sm">สร้างเอกสารใหม่</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="importMode"
                value="existing"
                checked={importMode === 'existing'}
                onChange={() => setImportMode('existing')}
                className="mr-2"
              />
              <span className="text-sm">เพิ่มในเอกสารเดิม</span>
            </label>
          </div>
        </div>

        {/* Existing document selector - show when mode is 'existing' */}
        {importMode === 'existing' && (
          <div className="mb-4 pb-4 border-b border-gray-200">
            <label className="block text-sm font-semibold text-gray-700 mb-1">เลือกเอกสาร (ที่ยังไม่จับคู่กับ Statement)</label>
            <select
              value={selectedDocumentId || ''}
              onChange={(e) => setSelectedDocumentId(e.target.value ? Number(e.target.value) : null)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoadingExistingDocs}
            >
              <option value="">-- เลือกเอกสาร --</option>
              {existingDocuments.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.document_number} (฿{doc.total_input_amount?.toLocaleString('th-TH', { minimumFractionDigits: 2 })})
                </option>
              ))}
            </select>
            {isLoadingExistingDocs && <p className="text-xs text-gray-500 mt-1">กำลังโหลดเอกสาร...</p>}
            {!isLoadingExistingDocs && existingDocuments.length === 0 && (
              <p className="text-xs text-orange-600 mt-1">ไม่พบเอกสารที่ยังไม่จับคู่กับ Statement</p>
            )}
          </div>
        )}

        {/* Document fields - only show for 'new' mode */}
        {importMode === 'new' && (
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
        )}

        {/* Summary for existing mode */}
        {importMode === 'existing' && (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">ยอดรวมที่จะเพิ่ม</p>
            <div className="mt-1 text-sm text-gray-700">ยอดนำเข้า: ฿{totalInputAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</div>
            <div className="text-sm text-gray-700">ยอดออเดอร์ตรง: ฿{totalMatchedOrderAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</div>
          </div>
        )}
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
                isSubmitting ||
                // For 'new' mode: require document details
                (importMode === 'new' && (
                  !documentNumber.trim() ||
                  !documentDate ||
                  !documentTime ||
                  !bankAccountId
                )) ||
                // For 'existing' mode: require selected document
                (importMode === 'existing' && !selectedDocumentId) ||
                // Require at least one importable row (matched, unmatched, or pending+forceImport)
                (validCount + unmatchedCount + rows.filter(r => r.status === 'pending' && r.forceImport).length === 0)
              }
              className="bg-blue-100 text-blue-700 font-semibold text-sm rounded-md py-2 px-4 flex items-center hover:bg-blue-200 shadow-sm disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              <UploadCloud size={16} className="mr-2" />
              {isSubmitting
                ? "กำลังนำเข้า..."
                : importMode === 'new'
                  ? `สร้างเอกสารใหม่ (${validCount + unmatchedCount + rows.filter(r => r.status === 'pending' && r.forceImport).length})`
                  : `เพิ่มในเอกสาร (${validCount + unmatchedCount + rows.filter(r => r.status === 'pending' && r.forceImport).length})`
              }
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
              <th className="px-2 py-3 w-16 text-center" title="ติ๊กเพื่อนำเข้าโดยไม่อัพเดท Order">ข้าม</th>
              <th className="px-2 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {rows.map((row, index) => (
              <tr key={row.id} className={`border-b ${row.status === 'matched' ? 'bg-green-50' : row.status === 'unmatched' ? 'bg-yellow-50' : row.status === 'pending' ? 'bg-orange-50' : row.status === 'returned' ? 'bg-red-50' : ''} ${row.forceImport ? 'ring-2 ring-purple-300' : ''}`}>
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
                {/* NEW: Force import checkbox for pending/unmatched rows */}
                <td className="px-2 py-1 text-center">
                  {(row.status === 'pending' || row.status === 'unmatched') && row.trackingNumber.trim() ? (
                    <label className="cursor-pointer" title="นำเข้าโดยไม่อัพเดท Order (เพื่อให้ยอดรวมตรงกับ Statement)">
                      <input
                        type="checkbox"
                        checked={row.forceImport || false}
                        onChange={() => handleToggleForceImport(index)}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                      />
                    </label>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
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
