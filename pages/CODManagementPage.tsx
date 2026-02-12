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
  Loader2,
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
  boxExpectedAmount?: number; // Full box total when multiple trackings share same box
  multiTracking?: boolean; // Flag: this tracking shares a box with other trackings
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
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [showSuccessPopup, setShowSuccessPopup] = useState<{ message: string } | null>(null);

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

  // Check-all toggle for forceImport — only affects filtered rows
  const handleToggleForceImportAll = () => {
    const visibleRows = filterStatus !== 'all' ? filteredRows : rows;
    const eligibleIds = new Set(
      visibleRows
        .filter(r => (r.status === 'pending' || r.status === 'unmatched') && r.trackingNumber.trim())
        .map(r => r.id)
    );
    const allChecked = eligibleIds.size > 0 && [...eligibleIds].every(id => rows.find(r => r.id === id)?.forceImport);
    setRows(rows.map(r => {
      if (eligibleIds.has(r.id)) {
        return { ...r, forceImport: !allChecked };
      }
      return r;
    }));
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
      const alreadyImportedMap = new Map<string, { cod_amount: number; status: string; document_id: number | null; document_number: string | null }>();
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
                    status: record.status || 'unknown',
                    document_id: record.document_id ? parseInt(record.document_id) : null,
                    document_number: record.document_number || null,
                  });
                }
              }
            })
          );
        } catch (err) {
          console.warn("Failed to check existing cod_records", err);
        }
      }

      // Determine "current" document id for comparison
      const currentDocId = importMode === 'existing' && selectedDocumentId ? Number(selectedDocumentId) : null;

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
          const importStatus = alreadyImported.status === 'forced' ? ' (ข้าม)' : '';
          const docId = alreadyImported.document_id;
          const docName = alreadyImported.document_number || (docId ? `#${docId}` : '');
          const isOtherDoc = !!(docId && (importMode === 'new' || (currentDocId && docId !== currentDocId)));
          const docLabel = docName ? ` [เอกสาร ${docName}]` : '';

          // Calculate actual remaining difference
          // Combine ALL payment sources: boxCollected (order_boxes), importedAmount (cod_records), totalSlipAmount (order_slips)
          const expectedAmount = apiResult?.expectedAmount || 0;
          const boxCollected = apiResult?.boxCollectedAmount || 0;
          const totalSlipAmount = apiResult?.totalSlipAmount || 0;
          const userEnteredAmount = parseFloat(String(row.codAmount)) || 0;
          // effectiveCollected = best COD data + slip data
          const codCollected = Math.max(boxCollected, importedAmount);
          const effectiveCollected = codCollected + totalSlipAmount;
          const remaining = expectedAmount > 0 ? Math.max(0, expectedAmount - effectiveCollected) : 0;
          // After this import: how much will still be missing?
          const remainingAfterImport = Math.max(0, remaining - userEnteredAmount);
          const isFullyCollected = expectedAmount > 0 && remaining < 0.01;
          const willBeFullyCollected = expectedAmount > 0 && remainingAfterImport < 0.01;

          let statusMessage = '';
          const slipNote = totalSlipAmount > 0 ? ` + สลิป ฿${totalSlipAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}` : '';
          if (isOtherDoc) {
            if (isFullyCollected) {
              statusMessage = `มีในเอกสารอื่น ${docName} (฿${importedAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}) (เก็บครบ)${importStatus}`;
            } else if (remaining > 0) {
              statusMessage = `มีในเอกสารอื่น ${docName} (฿${importedAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })})${importStatus} — ยังค้าง ฿${remaining.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
            } else {
              statusMessage = `มีในเอกสารอื่น ${docName} (฿${importedAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })})${importStatus}`;
            }
          } else if (isFullyCollected) {
            statusMessage = `ซ้ำแล้ว ฿${importedAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}${importStatus} (เก็บครบ${slipNote})${docLabel}`;
          } else if (remaining > 0 && expectedAmount > 0) {
            statusMessage = `ซ้ำแล้ว ฿${importedAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}${importStatus}${slipNote} — ยังค้าง ฿${remaining.toLocaleString('th-TH', { minimumFractionDigits: 2 })}${docLabel}`;
          } else {
            statusMessage = `ซ้ำแล้ว ฿${importedAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}${importStatus}${docLabel}`;
          }

          // For isOtherDoc: if fully collected → 'returned' (block), if remaining → 'matched' (auto-import + update order)
          const resolvedStatus: ValidationStatus = isOtherDoc
            ? (isFullyCollected ? 'returned' : 'matched')
            : 'matched';

          validatedRows[index] = {
            ...row,
            status: resolvedStatus,
            message: statusMessage,
            orderId: apiResult?.orderId,
            orderAmount: expectedAmount || importedAmount,
            difference: willBeFullyCollected ? 0 : (expectedAmount > 0 ? -(remainingAfterImport) : 0),
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
          const isMultiTracking = apiResult.multipleTrackingsInBox === true;

          if (isMultiTracking) {
            // Multi-tracking box: defer validation to group-sum pass below
            validatedRows[index] = {
              ...row,
              status: 'pending' as ValidationStatus, // will be updated in group-sum pass
              message: '',
              orderId: apiResult.orderId,
              orderAmount: codAmountValue, // user's input for cod_records
              boxExpectedAmount: expected, // full box total
              multiTracking: true,
              difference: undefined,
              amountPaid: apiResult.amountPaid,
            };
          } else {
            // Single tracking: exact match
            const difference = isAmountValid ? codAmountValue - expected : 0;
            const amountMatch = isAmountValid && Math.abs(difference) < 0.01;

            const isPaid = (apiResult.amountPaid || 0) > 0;
            let status: ValidationStatus = amountMatch ? 'matched' : 'unmatched';
            let message = amountMatch ? 'ตรงกัน' : `ส่วนต่าง: ${difference > 0 ? '+' : ''}฿${Math.abs(difference).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;

            if (isPaid) {
              message += ` (จ่ายแล้ว: ฿${apiResult.amountPaid})`;
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
            };
          }
        }
      });

      // === Second pass: group-sum validation for multi-tracking boxes ===
      // Group multi-tracking rows by orderId, sum their cod_amounts, compare vs box total
      const multiTrackingGroups = new Map<string, number[]>(); // orderId -> [row indices]
      validatedRows.forEach((r, idx) => {
        if (r.multiTracking && r.orderId) {
          const existing = multiTrackingGroups.get(r.orderId) || [];
          existing.push(idx);
          multiTrackingGroups.set(r.orderId, existing);
        }
      });

      multiTrackingGroups.forEach((indices, orderId) => {
        const boxTotal = validatedRows[indices[0]].boxExpectedAmount || 0;
        const sumCod = indices.reduce((sum, idx) => {
          return sum + parseAmount(validatedRows[idx].codAmount);
        }, 0);
        const groupDiff = sumCod - boxTotal;
        const groupMatch = Math.abs(groupDiff) < 0.01;

        indices.forEach((idx) => {
          const r = validatedRows[idx];
          const codVal = parseAmount(r.codAmount);
          const isValid = Number.isFinite(codVal) && codVal >= 0;

          let status: ValidationStatus = groupMatch ? 'matched' : 'unmatched';
          let message = groupMatch
            ? `ตรงกัน (รวม ${indices.length} tracking = ฿${sumCod.toLocaleString('th-TH', { minimumFractionDigits: 2 })} / กล่อง ฿${boxTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })})`
            : `ไม่ตรง: รวม ${indices.length} tracking = ฿${sumCod.toLocaleString('th-TH', { minimumFractionDigits: 2 })} vs กล่อง ฿${boxTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} (ต่าง ${groupDiff > 0 ? '+' : ''}฿${Math.abs(groupDiff).toLocaleString('th-TH', { minimumFractionDigits: 2 })})`;

          if (!isValid) {
            status = 'pending';
            message = 'ระบุยอดเงินไม่ถูกต้อง';
          }

          validatedRows[idx] = {
            ...r,
            status,
            message,
            difference: isValid ? groupDiff : undefined,
          };
        });
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

    // All unique rows go to import (backend will upsert if tracking already exists)
    const finalRowsToImport = Array.from(uniqueRowsByTracking.values());

    if (finalRowsToImport.length === 0) {
      alert("ไม่มีรายการที่จะนำเข้า");
      return;
    }

    // Count forced imports
    const forcedCount = finalRowsToImport.filter(r => r.forceImport).length;

    const skipMessages: string[] = [];
    if (duplicateRowsInUpload.length > 0) {
      skipMessages.push(`${duplicateRowsInUpload.length} รายการซ้ำในไฟล์อัปโหลด`);
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
    setImportProgress({ current: 0, total: finalRowsToImport.length });
    const documentDateTime = `${documentDate} ${documentTime || "00:00"}:00`;

    try {
      let importResponse: any = null;
      if (importMode === 'new') {
        // POST - Create new document
        importResponse = await apiFetch("cod_documents", {
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
              order_id: row.forceImport && !row.orderId ? null : (row.orderId || null),
              difference: row.difference ?? codAmount - orderAmount,
              status: row.forceImport && !row.orderId ? 'forced' : row.status,
              force_import: row.forceImport || (row.amountPaid > 0 && !!row.orderId),
            })),
          }),
        });
      } else {
        // PATCH - Add to existing document
        importResponse = await apiFetch(`cod_documents/${selectedDocumentId}`, {
          method: "PATCH",
          body: JSON.stringify({
            created_by: user.id,
            items: payloadRows.map(({ row, codAmount, orderAmount }) => ({
              tracking_number: row.trackingNumber.trim(),
              cod_amount: codAmount,
              order_amount: orderAmount,
              order_id: row.forceImport && !row.orderId ? null : (row.orderId || null),
              difference: row.difference ?? codAmount - orderAmount,
              status: row.forceImport && !row.orderId ? 'forced' : row.status,
              force_import: row.forceImport || (row.amountPaid > 0 && !!row.orderId),
            })),
          }),
        });
      }

      // Collect skipped items (tracking exists in another document)
      const skippedByBackend: { tracking_number: string; existing_document_id: number }[] = importResponse?.skipped || [];

      // Update orders - query SUM of cod_amount from cod_records for each order
      const uniqueOrderIds = new Set<string>();
      payloadRows.forEach(({ row }) => {
        if (row.forceImport && !row.orderId) return; // Skip only truly unmatched forced rows
        const baseId = getBaseOrderId(row.orderId);
        if (baseId) uniqueOrderIds.add(baseId);
      });

      const orderUpdates: Record<
        string,
        { amountPaid: number; paymentStatus: PaymentStatus }
      > = {};

      // Update progress: document created/updated
      setImportProgress({ current: 1, total: finalRowsToImport.length });

      if (uniqueOrderIds.size > 0) {
        const orderIdArray = Array.from(uniqueOrderIds);
        let completedOrders = 0;
        // Process orders sequentially for progress tracking
        for (const orderId of orderIdArray) {
          // Query all cod_records for this order and SUM cod_amount
          const qs = new URLSearchParams({
            companyId: String(user.companyId),
            orderId: orderId,
          });
          const records = await apiFetch(`cod_records?${qs.toString()}`);
          const totalPaid = Array.isArray(records)
            ? records.reduce((sum: number, r: any) => sum + (parseFloat(r.cod_amount) || 0), 0)
            : 0;

          const roundedPaid = Math.round(totalPaid * 100) / 100;
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
          await patchOrder(orderId, updatePayload);
          completedOrders++;
          setImportProgress({ current: 1 + completedOrders, total: finalRowsToImport.length });
        }
        if (Object.keys(orderUpdates).length > 0) {
          onOrdersPaidUpdate?.(orderUpdates);
        }
      }

      const totalOrders = Object.keys(orderUpdates).length;
      const totalAmount = Object.values(orderUpdates).reduce((sum, u) => sum + u.amountPaid, 0);
      const forcedSummary = forcedCount > 0 ? `\n⚠️ ${forcedCount} รายการติ๊กข้าม (ไม่อัพเดท Order)` : '';
      const skippedSummary = skippedByBackend.length > 0
        ? `\n❌ ${skippedByBackend.length} รายการข้ามเพราะมีในเอกสารอื่น`
        : '';
      const importedCount = finalRowsToImport.length - skippedByBackend.length;
      const successMessage = `นำเข้า${importMode === 'new' ? 'เอกสาร ' + documentNumber : 'รายการเพิ่มเติม'} สำเร็จ\n\n📦 ${importedCount} รายการ (จาก ${finalRowsToImport.length})\n🧾 ${totalOrders} ออเดอร์\n💰 ยอดรวม ${formatCurrency(totalAmount)}${forcedSummary}${skippedSummary}`;
      setShowSuccessPopup({ message: successMessage });
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
      setImportProgress(null);
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
    // For multi-tracking boxes, use boxExpectedAmount once per unique orderId
    const countedBoxes = new Set<string>();
    return rows.reduce((acc, r) => {
      const input = parseAmount(r.codAmount);
      if (input > 0) {
        acc.totalInputAmount += input;
      }
      if (r.multiTracking && r.boxExpectedAmount && r.orderId) {
        // Multi-tracking: count box total once per unique orderId
        if (!countedBoxes.has(r.orderId)) {
          countedBoxes.add(r.orderId);
          acc.totalMatchedOrderAmount += r.boxExpectedAmount;
        }
      } else if (r.orderAmount !== undefined && r.orderAmount !== null) {
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
            <div className="flex items-center space-x-1 text-sm">
              <button
                onClick={() => setFilterStatus(filterStatus === 'matched' ? 'all' : 'matched')}
                className={`flex items-center px-2.5 py-1 rounded-full cursor-pointer transition-all ${filterStatus === 'matched' ? 'bg-green-600 text-white shadow-sm' : 'text-green-600 hover:bg-green-50'
                  } font-medium`}
              ><CheckCircle size={16} className="mr-1.5" />ตรงกัน: {validCount}</button>
              <button
                onClick={() => setFilterStatus(filterStatus === 'unmatched' ? 'all' : 'unmatched')}
                className={`flex items-center px-2.5 py-1 rounded-full cursor-pointer transition-all ${filterStatus === 'unmatched' ? 'bg-yellow-500 text-white shadow-sm' : 'text-yellow-600 hover:bg-yellow-50'
                  }`}
              ><AlertTriangle size={16} className="mr-1.5" />ไม่ตรงกัน: {unmatchedCount}</button>
              <button
                onClick={() => setFilterStatus(filterStatus === 'pending' ? 'all' : 'pending')}
                className={`flex items-center px-2.5 py-1 rounded-full cursor-pointer transition-all ${filterStatus === 'pending' ? 'bg-orange-500 text-white shadow-sm' : 'text-orange-600 hover:bg-orange-50'
                  }`}
              ><AlertTriangle size={16} className="mr-1.5" />รอตรวจสอบ: {pendingCount}</button>
              <button
                onClick={() => setFilterStatus(filterStatus === 'returned' ? 'all' : 'returned')}
                className={`flex items-center px-2.5 py-1 rounded-full cursor-pointer transition-all ${filterStatus === 'returned' ? 'bg-red-500 text-white shadow-sm' : 'text-red-600 hover:bg-red-50'
                  }`}
              ><XCircle size={16} className="mr-1.5" />ตีกลับ: {returnedCount}</button>
              {filterStatus !== 'all' && (
                <button
                  onClick={() => setFilterStatus('all')}
                  className="flex items-center px-2.5 py-1 rounded-full text-gray-500 hover:bg-gray-100 text-xs ml-1"
                >✕ ล้างตัวกรอง</button>
              )}
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
            <button
              onClick={handleValidate}
              disabled={isSubmitting}
              className="bg-white border border-gray-300 text-gray-700 text-sm rounded-md py-2 px-3 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <><Loader2 size={14} className="animate-spin" />กำลังตรวจสอบ...</>
              ) : (
                'ตรวจสอบข้อมูล'
              )}
            </button>
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
              {isSubmitting && importProgress
                ? `กำลังนำเข้า ${importProgress.current} / ${importProgress.total}...`
                : isSubmitting
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
              <th className="px-2 py-3 w-16 text-center" title="ติ๊กเพื่อนำเข้าโดยไม่อัพเดท Order">
                <div className="flex flex-col items-center gap-0.5">
                  <span>ข้าม</span>
                  {isVerified && (() => {
                    const visibleRows = filterStatus !== 'all' ? filteredRows : rows;
                    const eligible = visibleRows.filter(r => (r.status === 'pending' || r.status === 'unmatched') && r.trackingNumber.trim());
                    if (eligible.length === 0) return null;
                    return (
                      <input
                        type="checkbox"
                        checked={eligible.every(r => r.forceImport)}
                        onChange={handleToggleForceImportAll}
                        className="w-3.5 h-3.5 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                        title="เลือกทั้งหมด / ยกเลิกทั้งหมด"
                      />
                    );
                  })()}
                </div>
              </th>
              <th className="px-2 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {(filterStatus !== 'all' ? filteredRows : rows).map((row) => {
              const index = rows.findIndex(r => r.id === row.id);
              return (
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
              );
            })}
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

      {/* Success Popup */}
      {showSuccessPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle size={40} className="text-green-600" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-3">นำเข้าสำเร็จ!</h3>
            <p className="text-sm text-gray-600 whitespace-pre-line mb-6">{showSuccessPopup.message}</p>
            <button
              onClick={() => setShowSuccessPopup(null)}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-2.5 rounded-lg transition-colors"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CODManagementPage;
