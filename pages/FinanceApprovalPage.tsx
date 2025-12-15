import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  User,
  Order,
  PaymentMethod,
  PaymentStatus,
  OrderStatus,
} from "../types";
import {
  CheckCircle,
  XCircle,
  FileText,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Info,
} from "lucide-react";
import OrderTable from "../components/OrderTable";
import { apiFetch, patchOrder } from "../services/api";
import usePersistentState from "../utils/usePersistentState";
import resolveApiBasePath from "@/utils/apiBasePath";
import Modal from "@/components/Modal";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100, 500];
const AUTO_MATCH_AMOUNT_DIFF = 1; // THB
const AUTO_MATCH_TIME_SEC = 180; // 3 minutes
const CANDIDATE_TIME_SEC = 1800; // 30 minutes window for suggestions
const CANDIDATE_AMOUNT_DIFF = 500; // THB tolerance for suggestions

interface FinanceApprovalPageProps {
  user: User;
  orders: Order[];
  customers: any[];
  users: User[];
  openModal: (type: any, data: Order) => void;
}

interface BankAccount {
  id: number;
  bank?: string;
  bank_number?: string;
  display_name: string;
}

interface StatementLog {
  id: number;
  transfer_at: string;
  amount: number;
  bank_account_id: number | null;
  bank_display_name?: string | null;
  channel?: string | null;
  description?: string | null;
}

interface OrderSlipMatch {
  amount: number | null;
  transfer_date: string | null;
  bank_account_id: number | null;
}

interface ReconcileOrder {
  id: string;
  total_amount: number;
  amount_paid: number;
  reconciled_amount?: number;
  payment_status?: string;
  payment_method?: string;
  transfer_date?: string | null;
  slip_transfer_date?: string | null;
  bank_account_id?: number | null;
  slip_bank_account_id?: number | null;
  order_status?: string;
  order_date?: string;
  delivery_date?: string;
  sales_channel?: string;
  notes?: string;
  customer_name?: string;
  customer_phone?: string;
  seller_name?: string;
  slip_total?: number;
  recipient_first_name?: string;
  recipient_last_name?: string;
  slips?: OrderSlipMatch[];
}

interface StatementRowState {
  statement: StatementLog;
  confirmedAmount: number;
  checked: boolean;
  selectedOrderId: string;
  autoMatched: boolean;
  suggestedScore: number;
}

interface CodRecord {
  id: number;
  document_id: number;
  tracking_number: string;
  order_id?: string | null;
  cod_amount: number;
  order_amount: number;
  status: string;
}

interface CodDocument {
  id: number;
  document_number: string;
  document_datetime: string;
  bank_account_id: number | null;
  bank?: string | null;
  bank_number?: string | null;
  total_input_amount: number;
  total_order_amount: number;
  status?: string | null;
  matched_statement_log_id?: number | null;
  verified_at?: string | null;
  verified_by?: number | null;
  notes?: string | null;
}

interface StatementCandidate {
  statement: StatementLog;
  amountDiff: number;
  timeDiff: number;
  level: "exact" | "close" | "suggestion";
  score: number;
}

const formatCurrency = (value: number) =>
  `THB ${value.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("th-TH") : "-";

const formatTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleTimeString("th-TH", {
      hour12: false,
    })
    : "-";

const formatDocumentDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
    })
    : "-";

const secondsDiff = (a: string, b?: string | null) => {
  if (!b) return Number.MAX_SAFE_INTEGER;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return Number.MAX_SAFE_INTEGER;
  return Math.abs(ta - tb) / 1000;
};

const FinanceApprovalPage: React.FC<FinanceApprovalPageProps> = ({
  user,
  orders,
  customers,
  users,
  openModal,
}) => {
  const apiBase = useMemo(() => resolveApiBasePath(), []);
  const today = useMemo(() => new Date(), []);
  const defaultDate = useMemo(
    () => today.toISOString().slice(0, 10),
    [today],
  );

  const [activeTab, setActiveTab] = useState<
    "slips" | "transfers" | "payafter"
  >("slips");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<
    PaymentStatus | ""
  >("");
  const [itemsPerPage, setItemsPerPage] = usePersistentState<number>(
    "financeApproval:itemsPerPage",
    PAGE_SIZE_OPTIONS[1],
  );
  const [currentPage, setCurrentPage] = usePersistentState<number>(
    "financeApproval:currentPage",
    1,
  );

  // Statement reconciliation state
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [filters, setFilters] = useState<{
    bankAccountId: string;
    startDate: string;
    endDate: string;
  }>({
    bankAccountId: "",
    startDate: defaultDate,
    endDate: defaultDate,
  });
  const [statementRows, setStatementRows] = useState<StatementRowState[]>([]);
  const [availableOrders, setAvailableOrders] = useState<ReconcileOrder[]>([]);
  const [loadingStatements, setLoadingStatements] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<
    | {
      type: "success" | "error";
      text: string;
    }
    | null
  >(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [codStatusMessage, setCodStatusMessage] = useState<
    | {
      type: "success" | "error";
      text: string;
    }
    | null
  >(null);
  const [codDocuments, setCodDocuments] = useState<CodDocument[]>([]);
  const [codDocLoading, setCodDocLoading] = useState(false);
  const [codDocError, setCodDocError] = useState<string | null>(null);
  const [savingCod, setSavingCod] = useState(false);
  const [codDocumentOrders, setCodDocumentOrders] = useState<CodRecord[]>([]);
  const [selectedCodDocId, setSelectedCodDocId] = useState<string>("");
  const [selectedCodDocument, setSelectedCodDocument] =
    useState<CodDocument | null>(null);
  const [statementCandidates, setStatementCandidates] = useState<
    StatementCandidate[]
  >([]);
  const [selectedStatementCandidate, setSelectedStatementCandidate] =
    useState<StatementCandidate | null>(null);
  const [detailContext, setDetailContext] = useState<{
    orderId: string;
    statementId?: number;
  } | null>(null);

  const fullOrdersMap = useMemo(() => {
    const map = new Map<string, Order>();
    orders.forEach((o) => map.set(o.id, o));
    return map;
  }, [orders]);

  const customerMap = useMemo(() => {
    const map = new Map<string | number, any>();
    customers.forEach((c: any) => {
      if (c.id !== undefined) map.set(c.id, c);
      if (c.pk !== undefined) map.set(c.pk, c);
      if (c.customerId !== undefined) map.set(c.customerId, c);
    });
    return map;
  }, [customers]);

  const userMap = useMemo(() => {
    const map = new Map<number, User>();
    users.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);

  const codOrdersWithDetails = useMemo(() => {
    return codDocumentOrders.map((record) => {
      const order =
        record.order_id && fullOrdersMap.has(record.order_id)
          ? fullOrdersMap.get(record.order_id)
          : undefined;
      let customerName = "-";
      if (order) {
        const customer =
          typeof order.customerId !== "undefined"
            ? customerMap.get(order.customerId)
            : null;
        if (customer) {
          customerName = `${customer.firstName || ""} ${customer.lastName || ""
            }`.trim();
        } else if (order.customer_name) {
          customerName = order.customer_name;
        }
      }
      if (!order && record.order_id) {
        customerName = record.order_id;
      }
      return {
        record,
        order,
        customerName: customerName || "-",
        difference: record.cod_amount - record.order_amount,
      };
    });
  }, [codDocumentOrders, customerMap, fullOrdersMap]);

  const normalizeOrders = useCallback((rawOrders: any[]): ReconcileOrder[] => {
    return (rawOrders || []).map((o) => ({
      id: String(o.id),
      total_amount: Number(o.total_amount ?? o.totalAmount ?? 0),
      amount_paid: Number(
        o.amount_paid ?? o.amountPaid ?? o.slip_total ?? o.slipTotal ?? 0,
      ),
      reconciled_amount: Number(
        o.reconciled_amount ?? o.reconciledAmount ?? o.amount_paid ?? 0,
      ),
      payment_status: o.payment_status ?? o.paymentStatus,
      payment_method: o.payment_method ?? o.paymentMethod,
      transfer_date: o.transfer_date ?? o.transferDate ?? null,
      slip_transfer_date: o.slip_transfer_date ?? o.slipTransferDate ?? null,
      bank_account_id:
        o.bank_account_id !== undefined && o.bank_account_id !== null
          ? Number(o.bank_account_id)
          : null,
      slip_bank_account_id:
        o.slip_bank_account_id !== undefined &&
          o.slip_bank_account_id !== null
          ? Number(o.slip_bank_account_id)
          : null,
      order_status: o.order_status ?? o.orderStatus,
      order_date: o.order_date ?? o.orderDate,
      delivery_date: o.delivery_date ?? o.deliveryDate,
      sales_channel: o.sales_channel ?? o.salesChannel,
      notes: o.notes,
      customer_name: o.customer_name ?? o.customerName,
      customer_phone: o.customer_phone ?? o.customerPhone,
      seller_name: o.seller_name ?? o.sellerName,
      slip_total: Number(o.slip_total ?? o.slipTotal ?? 0),
      recipient_first_name: o.recipient_first_name ?? o.recipientFirstName,
      recipient_last_name: o.recipient_last_name ?? o.recipientLastName,
      slips: Array.isArray(o.slips)
        ? o.slips.map((s: any) => ({
          amount:
            s.amount !== undefined && s.amount !== null
              ? Number(s.amount)
              : null,
          transfer_date: s.transfer_date ?? null,
          bank_account_id:
            s.bank_account_id !== undefined && s.bank_account_id !== null
              ? Number(s.bank_account_id)
              : null,
        }))
        : undefined,
    }));
  }, []);

  const buildCandidates = useCallback(
    (
      statement: StatementLog,
      ordersForMatch: ReconcileOrder[],
      used: Set<string>,
    ) => {
      return ordersForMatch
        .map((o) => {
          const bases: {
            amount: number;
            transferDate: string | null;
            bankId: number | null;
          }[] = [];

          (o.slips || []).forEach((s) => {
            bases.push({
              amount:
                s.amount !== null && s.amount !== undefined ? s.amount : 0,
              transferDate: s.transfer_date,
              bankId:
                s.bank_account_id !== null && s.bank_account_id !== undefined
                  ? s.bank_account_id
                  : null,
            });
          });

          const fallbackAmount =
            o.slip_total && o.slip_total > 0
              ? o.slip_total
              : o.amount_paid && o.amount_paid > 0
                ? o.amount_paid
                : o.total_amount;
          const fallbackTransferDate =
            o.slip_transfer_date && o.slip_transfer_date !== "null"
              ? o.slip_transfer_date
              : o.transfer_date;
          const fallbackBankId =
            o.bank_account_id ?? o.slip_bank_account_id ?? null;
          bases.push({
            amount: fallbackAmount,
            transferDate: fallbackTransferDate ?? null,
            bankId: fallbackBankId,
          });

          const best = bases.reduce<{
            amountDiff: number;
            timeDiff: number;
            bankPenalty: number;
            alreadyUsed: number;
            score: number;
          } | null>((acc, basis) => {
            const amountDiff = Math.abs(basis.amount - statement.amount);
            const timeDiff = secondsDiff(
              statement.transfer_at,
              basis.transferDate,
            );
            const bankPenalty =
              statement.bank_account_id &&
                basis.bankId &&
                statement.bank_account_id !== basis.bankId
                ? 1
                : 0;
            const alreadyUsed = used.has(o.id) ? 1 : 0;
            const score =
              amountDiff * 100 +
              Math.min(timeDiff, CANDIDATE_TIME_SEC) +
              bankPenalty * 10000 +
              alreadyUsed * 5000;
            if (!acc || score < acc.score) {
              return { amountDiff, timeDiff, bankPenalty, alreadyUsed, score };
            }
            return acc;
          }, null);

          return {
            order: o,
            amountDiff: best?.amountDiff ?? Number.MAX_SAFE_INTEGER,
            timeDiff: best?.timeDiff ?? Number.MAX_SAFE_INTEGER,
            score: best?.score ?? Number.MAX_SAFE_INTEGER,
            bankPenalty: best?.bankPenalty ?? 0,
            alreadyUsed: best?.alreadyUsed ?? 0,
          };
        })
        .filter(
          (c) =>
            (c.amountDiff <= CANDIDATE_AMOUNT_DIFF &&
              c.timeDiff <= CANDIDATE_TIME_SEC) ||
            c.order.slip_transfer_date === null ||
            c.order.transfer_date === null,
        )
        .sort((a, b) => a.score - b.score);
    },
    [],
  );

  const autoMatchRows = useCallback(
    (statements: StatementLog[], ordersForMatch: ReconcileOrder[]) => {
      return statements.map((s) => {
        const exactCandidate = ordersForMatch.find((o) => {
          const bankId = o.bank_account_id ?? o.slip_bank_account_id ?? null;
          // Prefer slip-level exact match
          if (o.slips && o.slips.length > 0) {
            const slipMatch = o.slips.find((slip) => {
              if (slip.amount === null || slip.transfer_date === null) {
                return false;
              }
              const bankMatch =
                s.bank_account_id !== null &&
                slip.bank_account_id !== null &&
                s.bank_account_id === slip.bank_account_id;
              const timeMatch =
                secondsDiff(s.transfer_at, slip.transfer_date) === 0;
              const amountMatch = Math.abs(slip.amount - s.amount) === 0;
              return bankMatch && timeMatch && amountMatch;
            });
            if (slipMatch) {
              return true;
            }
          }
          const matchAmount =
            o.slip_total && o.slip_total > 0
              ? o.slip_total
              : o.amount_paid && o.amount_paid > 0
                ? o.amount_paid
                : o.total_amount;
          const matchTransferDate =
            o.slip_transfer_date && o.slip_transfer_date !== "null"
              ? o.slip_transfer_date
              : o.transfer_date;
          const bankMatch =
            s.bank_account_id !== null &&
            bankId !== null &&
            s.bank_account_id === bankId;
          const timeMatch =
            !!matchTransferDate &&
            secondsDiff(s.transfer_at, matchTransferDate) === 0;
          const amountMatch = Math.abs(matchAmount - s.amount) === 0;
          return bankMatch && timeMatch && amountMatch;
        });

        const best = buildCandidates(s, ordersForMatch, new Set())[0];
        const selectedOrderId = exactCandidate?.id ?? "";
        const autoMatched = !!selectedOrderId;
        return {
          statement: s,
          confirmedAmount: s.amount,
          checked: autoMatched,
          selectedOrderId,
          autoMatched,
          suggestedScore: best?.score ?? Number.MAX_SAFE_INTEGER,
        };
      });
    },
    [buildCandidates],
  );

  const buildStatementCandidates = useCallback(
    (statements: StatementLog[], doc: CodDocument | null) => {
      if (!doc) return [];
      const targetAmount = Number(doc.total_input_amount ?? 0);
      const referenceTime = doc.document_datetime;
      return statements
        .map((statement) => {
          const amountDiff = Math.abs(statement.amount - targetAmount);
          const timeDiff = referenceTime
            ? secondsDiff(statement.transfer_at, referenceTime)
            : Number.MAX_SAFE_INTEGER;
          const level =
            amountDiff <= 1 && timeDiff <= 300
              ? "exact"
              : amountDiff <= 50 || timeDiff <= 1200
                ? "close"
                : "suggestion";
          const score = amountDiff * 100 + Math.min(timeDiff, 3600);
          return {
            statement,
            amountDiff,
            timeDiff,
            level,
            score,
          } as StatementCandidate;
        })
        .sort((a, b) => a.score - b.score);
    },
    [],
  );

  const fetchStatementsForDoc = useCallback(
    async (doc: CodDocument | null) => {
      if (!doc || !doc.document_datetime) {
        setStatementCandidates([]);
        setSelectedStatementCandidate(null);
        return;
      }
      setCodDocError(null);
      const docDate = new Date(doc.document_datetime);
      const start = new Date(docDate);
      start.setDate(start.getDate() - 1);
      const end = new Date(docDate);
      end.setDate(end.getDate() + 1);
      const startDate = start.toISOString().slice(0, 10);
      const endDate = end.toISOString().slice(0, 10);
      const bankFilter =
        doc.bank_account_id !== null && doc.bank_account_id !== undefined
          ? `&bank_account_id=${doc.bank_account_id}`
          : "";
      try {
        const res = await fetch(
          `${apiBase}/Statement_DB/reconcile_list.php?company_id=${user.companyId}&start_date=${encodeURIComponent(
            startDate,
          )}&end_date=${encodeURIComponent(endDate)}${bankFilter}`,
        );
        const data = await res.json();
        if (!data?.ok) {
          throw new Error(data?.error || "ไม่สามารถดึงรายการ statement ได้");
        }
        const statements: StatementLog[] = Array.isArray(data.statements)
          ? data.statements.map((s: any) => ({
            id: Number(s.id),
            transfer_at: s.transfer_at,
            amount: Number(s.amount),
            bank_account_id:
              s.bank_account_id !== undefined && s.bank_account_id !== null
                ? Number(s.bank_account_id)
                : null,
            bank_display_name: s.bank_display_name,
            channel: s.channel,
            description: s.description,
          }))
          : [];
        const candidates = buildStatementCandidates(statements, doc);
        setStatementCandidates(candidates);
        const preselected = doc.matched_statement_log_id
          ? candidates.find(
            (c) => c.statement.id === doc.matched_statement_log_id,
          ) ?? candidates[0] ?? null
          : candidates[0] ?? null;
        setSelectedStatementCandidate(preselected);
      } catch (err: any) {
        setCodDocError(
          err?.message || "เกิดข้อผิดพลาดระหว่างดึงรายการ statement",
        ); setStatementCandidates([]);
        setSelectedStatementCandidate(null);
      }
    },
    [apiBase, buildStatementCandidates, user.companyId],
  );

  const loadCodDocuments = useCallback(async () => {
    setCodDocError(null);
    setCodDocLoading(true);
    try {
      const docs = await apiFetch(
        `cod_documents?companyId=${user.companyId}`,
      );
      if (!Array.isArray(docs)) {
        throw new Error("ไม่พบข้อมูลเอกสาร COD");
      }
      // Filter only documents that are not verified
      const unverifiedDocs = docs.filter(
        (doc: any) => !doc.status || doc.status === "pending" || doc.status === "unmatched"
      );
      setCodDocuments(
        unverifiedDocs.map((doc: any) => ({
          id: Number(doc.id),
          document_number: doc.document_number,
          document_datetime: doc.document_datetime,
          bank_account_id:
            doc.bank_account_id !== undefined && doc.bank_account_id !== null
              ? Number(doc.bank_account_id)
              : null,
          bank: doc.bank ?? null,
          bank_number: doc.bank_number ?? null,
          total_input_amount: Number(doc.total_input_amount ?? 0),
          total_order_amount: Number(doc.total_order_amount ?? 0),
          status: doc.status ?? null,
          matched_statement_log_id:
            doc.matched_statement_log_id !== undefined &&
              doc.matched_statement_log_id !== null
              ? Number(doc.matched_statement_log_id)
              : null,
          verified_at: doc.verified_at ?? null,
          verified_by:
            doc.verified_by !== undefined && doc.verified_by !== null
              ? Number(doc.verified_by)
              : null,
          notes: doc.notes ?? null,
        })),
      );
    } catch (err: any) {
      setCodDocError(err?.message || "ไม่สามารถดึงเอกสาร COD ได้");
    } finally {
      setCodDocLoading(false);
    }
  }, [user.companyId]);

  const loadCodDocumentDetails = useCallback(
    async (docId: number | null) => {
      setSelectedStatementCandidate(null);
      if (!docId) {
        setSelectedCodDocument(null);
        setCodDocumentOrders([]); setStatementCandidates([]);
        return;
      }
      setCodDocError(null);
      setCodDocLoading(true);
      try {
        const doc = await apiFetch(
          `cod_documents/${encodeURIComponent(String(docId))}?companyId=${user.companyId}&includeItems=true`,
        );
        const normalized: CodDocument = {
          id: Number(doc.id),
          document_number: doc.document_number,
          document_datetime: doc.document_datetime,
          bank_account_id:
            doc.bank_account_id !== undefined && doc.bank_account_id !== null
              ? Number(doc.bank_account_id)
              : null,
          bank: doc.bank ?? null,
          bank_number: doc.bank_number ?? null,
          total_input_amount: Number(doc.total_input_amount ?? 0),
          total_order_amount: Number(doc.total_order_amount ?? 0),
          status: doc.status ?? null,
          matched_statement_log_id:
            doc.matched_statement_log_id !== undefined &&
              doc.matched_statement_log_id !== null
              ? Number(doc.matched_statement_log_id)
              : null,
          verified_at: doc.verified_at ?? null,
          verified_by:
            doc.verified_by !== undefined && doc.verified_by !== null
              ? Number(doc.verified_by)
              : null,
          notes: doc.notes ?? null,
        };
        setSelectedCodDocument(normalized);
        const items: CodRecord[] = Array.isArray(doc.items)
          ? doc.items.map((item: any) => ({
            id: Number(item.id),
            document_id: Number(item.document_id),
            tracking_number: item.tracking_number ?? "",
            order_id: item.order_id ?? null,
            cod_amount: Number(item.cod_amount ?? 0),
            order_amount: Number(item.order_amount ?? 0),
            status: item.status ?? "pending",
          }))
          : [];
        setCodDocumentOrders(items);
        await fetchStatementsForDoc(normalized);
      } catch (err: any) {
        setCodDocError(err?.message || "ไม่สามารถดึงรายละเอียดเอกสาร COD ได้");
        setSelectedCodDocument(null);
        setCodDocumentOrders([]); setStatementCandidates([]);
        setSelectedStatementCandidate(null);
      } finally {
        setCodDocLoading(false);
      }
    },
    [fetchStatementsForDoc, user.companyId],
  );

  const fetchBankAccounts = useCallback(async () => {
    try {
      const res = await fetch(
        `${apiBase}/Bank_DB/get_bank_accounts.php?company_id=${user.companyId}`,
      );
      const data = await res.json();
      if (data?.success && Array.isArray(data.data)) {
        setBankAccounts(data.data);
        if (!filters.bankAccountId && data.data.length > 0) {
          setFilters((prev) => ({
            ...prev,
            bankAccountId: String(data.data[0].id),
          }));
        }
      }
    } catch {
      // ignore and leave list empty
    }
  }, [apiBase, user.companyId, filters.bankAccountId]);

  useEffect(() => {
    fetchBankAccounts();
  }, [fetchBankAccounts]);

  useEffect(() => {
    if (activeTab === "transfers") {
      loadCodDocuments();
    }
  }, [activeTab, loadCodDocuments]);

  useEffect(() => {
    if (activeTab !== "transfers") {
      setSelectedCodDocId("");
      setSelectedCodDocument(null);
      setCodDocumentOrders([]); setStatementCandidates([]);
      setSelectedStatementCandidate(null);
      setCodStatusMessage(null);
    }
  }, [activeTab]);

  const fetchStatements = useCallback(async () => {
    if (!filters.bankAccountId) {
      setStatusMessage({
        type: "error",
        text: "กรุณาเลือกบัญชีธนาคารก่อนดึงข้อมูล",
      });
      return;
    }
    setLoadingStatements(true);
    setStatusMessage(null);
    try {
      const url = `${apiBase}/Statement_DB/reconcile_list.php?company_id=${user.companyId}&start_date=${encodeURIComponent(
        filters.startDate,
      )}&end_date=${encodeURIComponent(
        filters.endDate,
      )}&bank_account_id=${encodeURIComponent(filters.bankAccountId)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data?.ok) {
        throw new Error(data?.error || "ไม่สามารถดึงข้อมูลได้");
      }
      const statements: StatementLog[] = Array.isArray(data.statements)
        ? data.statements.map((s: any) => ({
          id: Number(s.id),
          transfer_at: s.transfer_at,
          amount: Number(s.amount),
          bank_account_id:
            s.bank_account_id !== undefined && s.bank_account_id !== null
              ? Number(s.bank_account_id)
              : null,
          bank_display_name: s.bank_display_name,
          channel: s.channel,
          description: s.description,
        }))
        : [];
      const normalizedOrders = normalizeOrders(data.orders || []);
      setAvailableOrders(normalizedOrders);
      setStatementRows(autoMatchRows(statements, normalizedOrders));
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err?.message || "เกิดข้อผิดพลาดระหว่างดึงข้อมูล",
      });
    } finally {
      setLoadingStatements(false);
    }
  }, [
    apiBase,
    autoMatchRows,
    filters.bankAccountId,
    filters.endDate,
    filters.startDate,
    normalizeOrders,
    user.companyId,
  ]);

  const updateRow = useCallback(
    (
      statementId: number,
      updater: (row: StatementRowState) => StatementRowState,
    ) => {
      setStatementRows((prev) =>
        prev.map((row) =>
          row.statement.id === statementId ? updater(row) : row,
        ),
      );
    },
    [],
  );

  const handleOrderSelect = (statementId: number, orderId: string) => {
    updateRow(statementId, (row) => ({
      ...row,
      selectedOrderId: orderId,
      checked: orderId ? row.checked : false,
    }));
  };

  const handleCodDocumentChange = (value: string) => {
    setSelectedCodDocId(value);
    const docId = value ? Number(value) : null;
    loadCodDocumentDetails(docId);
    setCodStatusMessage(null);
  };


  const handleConfirmCodMatch = async () => {
    if (!selectedCodDocument || !selectedStatementCandidate) {
      return;
    }
    setSavingCod(true);
    setCodStatusMessage(null);
    try {
      const res = await fetch(
        `${apiBase}/Statement_DB/cod_reconcile_save.php`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company_id: user.companyId,
            user_id: user.id,
            cod_document_id: selectedCodDocument.id,
            statement_log_id: selectedStatementCandidate.statement.id,
          }),
        },
      );

      // Check if response is ok
      if (!res.ok) {
        const text = await res.text();
        console.error("API Error Response:", text);
        // Try to parse as JSON if possible
        let errorMsg = `HTTP ${res.status}: Server error`;
        try {
          const errorData = JSON.parse(text);
          errorMsg = errorData.error || errorData.message || errorMsg;
          if (errorData.file) {
            errorMsg += ` (${errorData.file}:${errorData.line || ""})`;
          }
        } catch {
          // If not JSON, use text directly
          if (text && text.length > 0) {
            errorMsg = `HTTP ${res.status}: ${text.substring(0, 200)}`;
          }
        }
        throw new Error(errorMsg);
      }

      // Get response text first to check if it's valid JSON
      const text = await res.text();
      if (!text || text.trim() === "") {
        throw new Error("Empty response from server");
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error("Failed to parse JSON:", text);
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
      }

      if (!data?.ok) {
        throw new Error(data?.error || "ไม่สามารถบันทึกการตรวจสอบ COD ได้");
      }

      // Show success popup
      const successMessage = `บันทึกสำเร็จ!\n\nเอกสาร: ${selectedCodDocument.document_number}\nจับคู่กับ Statement #${selectedStatementCandidate.statement.id}\nเลขที่เอกสาร: ${data.document_no || "-"}`;
      alert(successMessage);

      // Reload page to clear old data but stay on Finance Approval page
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set("page", "Finance Approval");
      window.location.href = currentUrl.toString();
    } catch (err: any) {
      console.error("Error saving COD reconciliation:", err);
      setCodStatusMessage({
        type: "error",
        text:
          err?.message ||
          "ไม่สามารถบันทึกการตรวจสอบ COD ได้ กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setSavingCod(false);
    }
  };

  // Existing order table logic for other tabs
  const filteredOrders = useMemo(() => {
    if (activeTab === "slips") return [];
    let filtered = orders;
    if (activeTab === "transfers") {
      filtered = filtered.filter(
        (o) =>
          o.paymentMethod === PaymentMethod.Transfer &&
          o.paymentStatus === PaymentStatus.PreApproved,
      );
    } else if (activeTab === "payafter") {
      filtered = filtered.filter(
        (o) =>
          o.paymentMethod === PaymentMethod.PayAfter &&
          (o.paymentStatus === PaymentStatus.PreApproved ||
            o.orderStatus === OrderStatus.Delivered),
      );
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((o) => {
        const customer =
          customers.find((c: any) => {
            if (c.pk && typeof o.customerId === "number") {
              return c.pk === o.customerId;
            }
            return (
              String(c.id) === String(o.customerId) ||
              String(c.pk) === String(o.customerId)
            );
          }) || {};
        return (
          o.id.toLowerCase().includes(term) ||
          `${customer.firstName || ""} ${customer.lastName || ""}`
            .toLowerCase()
            .includes(term)
        );
      });
    }

    if (filterPaymentStatus) {
      filtered = filtered.filter((o) => o.paymentStatus === filterPaymentStatus);
    }
    return filtered;
  }, [activeTab, customers, filterPaymentStatus, orders, searchTerm]);

  const safeItemsPerPage =
    itemsPerPage && itemsPerPage > 0 ? itemsPerPage : PAGE_SIZE_OPTIONS[1];
  const totalItems = activeTab === "slips" ? 0 : filteredOrders.length;
  const totalPages = activeTab === "slips"
    ? 1
    : Math.max(1, Math.ceil(totalItems / safeItemsPerPage));
  const effectivePage =
    activeTab === "slips"
      ? 1
      : Math.min(Math.max(currentPage, 1), totalPages);
  const startIndex = (effectivePage - 1) * safeItemsPerPage;
  const endIndex = startIndex + safeItemsPerPage;
  const paginatedOrders =
    activeTab === "slips"
      ? []
      : filteredOrders.slice(startIndex, endIndex);
  const displayStart = totalItems === 0 ? 0 : startIndex + 1;
  const displayEnd = Math.min(endIndex, totalItems);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, filterPaymentStatus, setCurrentPage]);

  const handleApprovePayAfter = async () => {
    if (selectedIds.length === 0) return;

    if (
      !window.confirm(
        `Confirm Approve PayAfter for ${selectedIds.length} selected orders?`,
      )
    ) {
      return;
    }

    try {
      const updates = selectedIds.map((id) => ({
        id,
        paymentStatus: PaymentStatus.Approved,
      }));

      await Promise.all(
        updates.map((update) =>
          patchOrder(update.id, {
            paymentStatus: update.paymentStatus,
          }),
        ),
      );

      alert(`Approve completed for ${selectedIds.length} orders`);
      setSelectedIds([]);
      window.location.reload();
    } catch (error) {
      console.error("Error approving pay after:", error);
      alert("Unable to approve, please try again");
    }
  };


  const findCustomerForOrder = (order: Order) => {
    if (!order) return null;
    return customers.find((c: any) => {
      if (c.pk && typeof order.customerId === "number") {
        return c.pk === order.customerId;
      }
      return (
        String(c.id) === String(order.customerId) ||
        String(c.pk) === String(order.customerId)
      );
    });
  };

  const getOutstanding = (
    orderId: string,
    confirmed: number,
    statementId?: number,
  ) => {
    const order =
      availableOrders.find((o) => o.id === orderId) ||
      fullOrdersMap.get(orderId);
    if (!order) return 0;
    const paid =
      (order as ReconcileOrder).reconciled_amount ??
      order.amount_paid ??
      0;
    const otherAllocated = statementRows
      .filter(
        (r) =>
          r.checked &&
          r.selectedOrderId === orderId &&
          r.statement.id !== statementId,
      )
      .reduce((sum, r) => sum + r.confirmedAmount, 0);
    const remaining = order.total_amount - (paid + otherAllocated + confirmed);
    return remaining;
  };

  const handleAmountChange = (statementId: number, value: string) => {
    const parsed = Number(value);
    updateRow(statementId, (row) => ({
      ...row,
      confirmedAmount: Number.isFinite(parsed) ? parsed : row.confirmedAmount,
    }));
  };

  const handleToggleCheck = (statementId: number, checked: boolean) => {
    updateRow(statementId, (row) => ({
      ...row,
      checked: checked && !!row.selectedOrderId,
    }));
  };

  const handleSaveReconcile = async () => {
    const items = statementRows
      .filter((r) => r.checked && r.selectedOrderId)
      .map((r) => ({
        statement_id: r.statement.id,
        order_id: r.selectedOrderId,
        confirmed_amount: r.confirmedAmount,
        auto_matched: r.autoMatched,
      }));
    if (items.length === 0) {
      setStatusMessage({
        type: "error",
        text: "Please select at least 1 checked row to save.",
      });
      return;
    }
    setSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch(
        `${apiBase}/Statement_DB/reconcile_save.php`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company_id: user.companyId,
            user_id: user.id,
            bank_account_id: Number(filters.bankAccountId),
            start_date: filters.startDate,
            end_date: filters.endDate,
            items,
          }),
        },
      );
      const data = await res.json();
      if (!data?.ok) {
        throw new Error(data?.error || "Unable to save reconciliation");
      }
      setStatusMessage({
        type: "success",
        text: `บันทึกสำเร็จ เลขที่เอกสาร ${data.document_no || "-"}`,
      });
      await fetchStatements();
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err?.message || "เกิดข้อผิดพลาดระหว่างบันทึกข้อมูล",
      });
    } finally {
      setSaving(false);
    }
  };


  const renderSlipTab = () => {
    const checkedCount = statementRows.filter(
      (r) => r.checked && r.selectedOrderId,
    ).length;

    return (
      <div className="space-y-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                บัญชีธนาคาร
              </label>
              <select
                value={filters.bankAccountId}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    bankAccountId: e.target.value,
                  }))
                }
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- เลือกบัญชีธนาคาร --</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.display_name || `${b.bank} - ${b.bank_number}`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                ตั้งแต่วันที่
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, startDate: e.target.value }))
                }
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                ถึงวันที่
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, endDate: e.target.value }))
                }
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchStatements}
                disabled={loadingStatements}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              >
                {loadingStatements ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    กำลังดึงข้อมูล
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    ดึงข้อมูล
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setStatementRows([]);
                  setAvailableOrders([]);
                }}
                className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 border border-gray-300"
              >
                เคลียร์รายการ
              </button>
            </div>
          </div>
          {statusMessage && (
            <div
              className={`mt-3 px-3 py-2 rounded-md text-sm ${statusMessage.type === "error"
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-green-50 text-green-700 border border-green-200"
                }`}
            >
              {statusMessage.text}
            </div>
          )}
          <div className="mt-3 text-sm text-gray-600 flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>รายการสเตทเมนต์ที่พบ: {statementRows.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>ติ๊กตรวจสอบแล้ว: {checkedCount}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-700">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">ธนาคาร</th>
                  <th className="px-4 py-3">วันที่โอน</th>
                  <th className="px-4 py-3">เวลา</th>
                  <th className="px-4 py-3 text-right">ยอดโอน</th>
                  <th className="px-4 py-3 text-right">ยอดรับจริง</th>
                  <th className="px-4 py-3 text-center">เช็คยอด</th>
                  <th className="px-4 py-3">Orders_no</th>
                  <th className="px-4 py-3 text-right">ยอดสุทธิ</th>
                  <th className="px-4 py-3 text-right">จ่ายแล้ว</th>
                  <th className="px-4 py-3 text-right">ค้างจ่าย</th>
                  <th className="px-4 py-3 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {statementRows.map((row) => {
                  const candidates = buildCandidates(
                    row.statement,
                    availableOrders,
                    new Set(),
                  ).slice(0, 12);
                  const selectedOrder =
                    availableOrders.find(
                      (o) => o.id === row.selectedOrderId,
                    ) || fullOrdersMap.get(row.selectedOrderId);
                  const selectedMatchAmount = selectedOrder
                    ? selectedOrder.slip_total &&
                      selectedOrder.slip_total > 0
                      ? selectedOrder.slip_total
                      : selectedOrder.total_amount
                    : null;
                  const outstanding = getOutstanding(
                    row.selectedOrderId,
                    row.confirmedAmount,
                    row.statement.id,
                  );
                  return (
                    <tr
                      key={row.statement.id}
                      className="border-b last:border-b-0 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">
                            {row.statement.bank_display_name ||
                              (row.statement.bank_account_id
                                ? `บัญชี ${row.statement.bank_account_id}`
                                : "-")}
                          </span>
                          {row.statement.channel && (
                            <span className="text-xs text-gray-500">
                              {row.statement.channel}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {formatDate(row.statement.transfer_at)}
                      </td>
                      <td className="px-4 py-3">
                        {formatTime(row.statement.transfer_at)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {formatCurrency(row.statement.amount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={row.confirmedAmount}
                          onChange={(e) =>
                            handleAmountChange(
                              row.statement.id,
                              e.target.value,
                            )
                          }
                          className="w-28 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-blue-600 rounded"
                          checked={row.checked}
                          disabled={!row.selectedOrderId}
                          onChange={(e) =>
                            handleToggleCheck(
                              row.statement.id,
                              e.target.checked,
                            )
                          }
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <input
                            list={`order-options-${row.statement.id}`}
                            value={row.selectedOrderId}
                            onChange={(e) =>
                              handleOrderSelect(
                                row.statement.id,
                                e.target.value,
                              )
                            }
                            placeholder="พิมพ์หรือเลือกออเดอร์"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                          <datalist id={`order-options-${row.statement.id}`}>
                            {candidates.map((c) => (
                              <option
                                key={c.order.id}
                                value={c.order.id}
                              >{`${c.order.id} | ${formatCurrency(
                                c.order.slip_total && c.order.slip_total > 0
                                  ? c.order.slip_total
                                  : c.order.total_amount,
                              )} | ${c.order.customer_name || "-"
                                }`}</option>
                            ))}
                          </datalist>
                          {row.autoMatched && (
                            <div className="text-xs text-green-600 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              จับคู่อัตโนมัติ
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {selectedOrder
                          ? formatCurrency(
                            selectedMatchAmount ?? selectedOrder.total_amount,
                          )
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {selectedOrder
                          ? formatCurrency(
                            (selectedOrder as ReconcileOrder)
                              .reconciled_amount ??
                            selectedOrder.amount_paid,
                          )
                          : "-"}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${outstanding > 0
                            ? "text-red-600"
                            : outstanding < 0
                              ? "text-purple-600"
                              : "text-green-600"
                          }`}
                      >
                        {selectedOrder
                          ? formatCurrency(outstanding)
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-center space-y-1">
                        <button
                          onClick={() =>
                            row.selectedOrderId &&
                            setDetailContext({
                              orderId: row.selectedOrderId,
                              statementId: row.statement.id,
                            })
                          }
                          disabled={!row.selectedOrderId}
                          className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Info className="w-4 h-4 mr-1" />
                          รายละเอียด
                        </button>
                        {row.selectedOrderId && (
                          <button
                            onClick={() => {
                              const order = fullOrdersMap.get(
                                row.selectedOrderId,
                              );
                              if (order) {
                                openModal("manageOrder", order);
                              }
                            }}
                            className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-md text-blue-600 hover:underline"
                          >
                            จัดการ
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {statementRows.length === 0 && !loadingStatements && (
                  <tr>
                    <td
                      colSpan={11}
                      className="text-center text-gray-500 py-6"
                    >
                      ยังไม่มีรายการสเตทเมนต์ในช่วงที่เลือก
                    </td>
                  </tr>
                )}
                {loadingStatements && (
                  <tr>
                    <td
                      colSpan={11}
                      className="text-center text-gray-500 py-6"
                    >
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderCodTab = () => {
    const doc = selectedCodDocument;
    const levelBadges: Record<StatementCandidate["level"], string> = {
      exact: "bg-green-100 text-green-700",
      close: "bg-yellow-100 text-yellow-800",
      suggestion: "bg-blue-100 text-blue-800",
    };

    return (
      <div className="space-y-4">
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-4">
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium text-gray-700">
                เอกสาร COD ที่ยังไม่ถูก Approve
              </label>
              <select
                value={selectedCodDocId}
                onChange={(e) => handleCodDocumentChange(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">-- เลือกเลขเอกสาร COD --</option>
                {codDocuments.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.document_number} | {formatCurrency(doc.total_input_amount)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 text-xs text-gray-500">
              <p>จำนวนรับ</p>
              <p className="text-gray-900 font-medium">
                {codDocuments.length} รายการ
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">อัปเดตล่าสุด</span>
              <button
                onClick={loadCodDocuments}
                disabled={codDocLoading}
                className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {codDocLoading ? "กำลังโหลด..." : "รีเฟรช"}
              </button>
            </div>
          </div>
          {codDocError && (
            <div className="mx-4 mb-3 mt-1 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
              {codDocError}
            </div>
          )}
        </div>
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="grid gap-4 p-4 md:grid-cols-2 md:divide-x md:divide-gray-200">
            <div className="space-y-3 border border-gray-100 rounded-lg p-3 md:border-0 md:pr-6">
              <p className="text-sm font-semibold text-gray-700">
                สรุปเอกสาร COD
              </p>
              {doc ? (
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span className="text-xs font-light">เลขที่เอกสาร</span>
                    <span className="text-gray-900">
                      {doc.document_number}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-light">วันที่/เวลา</span>
                    <span className="text-gray-900">
                      {formatDocumentDateTime(doc.document_datetime)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-light">ธนาคาร</span>
                    <span className="text-gray-900">
                      {doc.bank
                        ? `${doc.bank} ${doc.bank_number ? `(${doc.bank_number})` : ""
                        }`
                        : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-light">ยอด COD</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(doc.total_input_amount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-light">ยอด Order</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(doc.total_order_amount)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  เลือกเอกสาร COD เพื่อดูรายละเอียด
                </p>
              )}
            </div>
            <div className="space-y-3 border border-gray-100 rounded-lg p-3 md:border-0 md:pl-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">
                  Statement ที่พบบัญชีเดียวกัน
                </p>
                {selectedStatementCandidate && statementCandidates.length > 1 && (
                  <button
                    onClick={() => {
                      setSelectedStatementCandidate(null);
                      setCodStatusMessage(null);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    เลือก Statement อื่น
                  </button>
                )}
              </div>
              {codStatusMessage && (
                <div
                  className={`rounded-md border px-3 py-2 text-xs mb-3 ${codStatusMessage.type === "success"
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-red-200 bg-red-50 text-red-700"
                    }`}
                >
                  {codStatusMessage.text}
                </div>
              )}
              {selectedStatementCandidate ? (
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span className="text-xs font-light">ธนาคาร</span>
                    <span className="text-gray-900">
                      {selectedStatementCandidate.statement.bank_display_name ||
                        `Bank ${selectedStatementCandidate.statement.bank_account_id || "-"}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-light">วันที่/เวลา</span>
                    <span className="text-gray-900">
                      {formatDocumentDateTime(
                        selectedStatementCandidate.statement.transfer_at,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-light">ยอดโอน</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(selectedStatementCandidate.statement.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-light">เงินต่าง</span>
                    <span
                      className={`font-medium ${selectedStatementCandidate.amountDiff === 0
                          ? "text-green-600"
                          : "text-orange-600"
                        }`}
                    >
                      {formatCurrency(selectedStatementCandidate.amountDiff)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-light">ระดับความตรงกัน</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${levelBadges[selectedStatementCandidate.level]
                        }`}
                    >
                      {selectedStatementCandidate.level === "exact"
                        ? "ตรงกัน"
                        : selectedStatementCandidate.level === "close"
                          ? "ใกล้เคียง"
                          : "แนะนำ"}
                    </span>
                  </div>
                </div>
              ) : statementCandidates.length === 0 ? (
                <p className="text-xs text-gray-500">
                  ยังไม่มี statement ที่ตรงกัน ลองเปลี่ยนช่วงวันหรือบัญชี
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 mb-2">
                    พบ {statementCandidates.length} รายการ:
                  </p>
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {statementCandidates.map((candidate) => (
                      <div
                        key={candidate.statement.id}
                        className={`rounded-lg border px-3 py-2 text-xs transition cursor-pointer ${selectedStatementCandidate?.statement.id ===
                            candidate.statement.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                          }`}
                        onClick={() => {
                          setSelectedStatementCandidate(candidate);
                          setCodStatusMessage(null);
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-gray-900">
                            {candidate.statement.bank_display_name ||
                              `Bank ${candidate.statement.bank_account_id || "-"}`}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${levelBadges[candidate.level]}`}
                          >
                            {candidate.level === "exact"
                              ? "ตรงกัน"
                              : candidate.level === "close"
                                ? "ใกล้เคียง"
                                : "แนะนำ"}
                          </span>
                        </div>
                        <div className="text-gray-600 text-[11px]">
                          {formatDocumentDateTime(candidate.statement.transfer_at)}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1">
                          <span>
                            {formatCurrency(candidate.statement.amount)}
                          </span>
                          <span>
                            ต่าง {formatCurrency(candidate.amountDiff)} ·{" "}
                            {Math.round(candidate.timeDiff)} วินาที
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border shadow-sm">
          <div className="px-4 py-3 border-b">
            <p className="text-sm font-medium text-gray-900">รายการในเอกสาร</p>
            <p className="text-xs text-gray-500">
              แสดง COD record ที่อยู่ในเอกสารที่เลือกไว้
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-700">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2 text-right">COD</th>
                  <th className="px-3 py-2 text-right">Order Amount</th>
                  <th className="px-3 py-2 text-right">Difference</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {codOrdersWithDetails.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-5 text-center text-gray-500"
                    >
                      เลือกเอกสาร COD เพื่อดูรายการ
                    </td>
                  </tr>
                )}
                {codOrdersWithDetails.map(({ record, customerName }) => (
                  <tr key={record.id} className="border-t last:border-b">
                    <td className="px-3 py-2 text-sm font-medium text-gray-900">
                      {record.order_id || "-"}
                    </td>
                    <td className="px-3 py-2 text-sm">{customerName}</td>
                    <td className="px-3 py-2 text-right">
                      {formatCurrency(record.cod_amount)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatCurrency(record.order_amount)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-medium ${record.cod_amount - record.order_amount > 0
                          ? "text-red-600"
                          : record.cod_amount - record.order_amount < 0
                            ? "text-purple-600"
                            : "text-green-600"
                        }`}
                    >
                      {formatCurrency(record.cod_amount - record.order_amount)}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                        {record.status || "pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (!statusMessage || statusMessage.type !== "success") {
      setToastVisible(false);
      return undefined;
    }

    setToastVisible(true);
    const timer = setTimeout(() => {
      setToastVisible(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  const detailOrder =
    detailContext &&
    (fullOrdersMap.get(detailContext.orderId) ||
      availableOrders.find((o) => o.id === detailContext.orderId));
  const detailStatement = detailContext
    ? statementRows.find((r) => r.statement.id === detailContext.statementId)
    : null;
  const detailCustomer =
    detailOrder && "customerId" in detailOrder
      ? findCustomerForOrder(detailOrder as Order)
      : null;
  const detailSeller =
    detailOrder && "creatorId" in detailOrder
      ? userMap.get((detailOrder as Order).creatorId)
      : null;

  return (
    <>
      {toastVisible && statusMessage && (
        <div
          className="fixed top-6 right-6 z-50 flex items-center gap-3 rounded-md border border-green-200 bg-white px-4 py-3 text-sm font-medium text-green-800 shadow-lg"
          role="status"
          aria-live="polite"
        >
          <CheckCircle size={18} className="text-green-600" />
          <span>{statusMessage.text}</span>
        </div>
      )}
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Finance Approval</h2>
            <p className="text-gray-600">
              ตรวจสอบและจับคู่รายการโอนจาก statement กับออเดอร์ พร้อมบันทึกเอกสารอ้างอิง
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "slips" ? (
              <button
                onClick={handleSaveReconcile}
                disabled={
                  saving ||
                  statementRows.filter(
                    (r) => r.checked && r.selectedOrderId,
                  ).length === 0
                }
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} className="mr-2" />
                    บันทึกการตรวจสอบ
                  </>
                )}
              </button>
            ) : null}
            {activeTab === "transfers" && (
              <button
                onClick={handleConfirmCodMatch}
                disabled={!selectedCodDocument || !selectedStatementCandidate || savingCod}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingCod ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} className="mr-2" />
                    บันทึกตรวจสอบ COD
                  </>
                )}
              </button>
            )}
            {activeTab === "payafter" && (
              <button
                onClick={handleApprovePayAfter}
                disabled={selectedIds.length === 0}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle size={16} className="mr-2" />
                Approve PayAfter ({selectedIds.length})
              </button>
            )}
          </div>
        </div>

        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => {
              setActiveTab("slips");
              setSelectedIds([]);
            }}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === "slips"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
              }`}
          >
            <FileText size={16} />
            <span>Approve สลิป</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${activeTab === "slips"
                  ? "bg-blue-100 text-blue-600"
                  : "bg-gray-100 text-gray-600"
                }`}
            >
              {statementRows.length}
            </span>
          </button>
          <button
            onClick={() => {
              setActiveTab("transfers");
              setSelectedIds([]);
            }}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === "transfers"
                ? "border-b-2 border-green-600 text-green-600"
                : "text-gray-500 hover:text-gray-700"
              }`}
          >
            <CheckCircle size={16} />
            <span>Approve COD</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${activeTab === "transfers"
                  ? "bg-green-100 text-green-600"
                  : "bg-gray-100 text-gray-600"
                }`}
            >
              {
                orders.filter(
                  (o) =>
                    o.paymentMethod === PaymentMethod.Transfer &&
                    o.paymentStatus === PaymentStatus.PreApproved,
                ).length
              }
            </span>
          </button>
          <button
            onClick={() => {
              setActiveTab("payafter");
              setSelectedIds([]);
            }}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === "payafter"
                ? "border-b-2 border-purple-600 text-purple-600"
                : "text-gray-500 hover:text-gray-700"
              }`}
          >
            <FileText size={16} />
            <span>Approve PayAfter</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${activeTab === "payafter"
                  ? "bg-purple-100 text-purple-600"
                  : "bg-gray-100 text-gray-600"
                }`}
            >
              {
                orders.filter(
                  (o) =>
                    o.paymentMethod === PaymentMethod.PayAfter &&
                    (o.paymentStatus === PaymentStatus.PreApproved ||
                      o.orderStatus === OrderStatus.Delivered),
                ).length
              }
            </span>
          </button>
        </div>

        {activeTab === "slips" ? (
          renderSlipTab()
        ) : activeTab === "transfers" ? (
          renderCodTab()
        ) : (
          <>
            <div className="bg-white p-4 rounded-lg shadow-sm border mb-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="ค้นหาออเดอร์หรือชื่อลูกค้า..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="w-48">
                  <select
                    value={filterPaymentStatus}
                    onChange={(e) =>
                      setFilterPaymentStatus(
                        e.target.value as PaymentStatus | "",
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">สถานะการชำระเงินทั้งหมด</option>
                    <option value={PaymentStatus.Verified}>Verified</option>
                    <option value={PaymentStatus.PreApproved}>Pre Approved</option>
                    <option value={PaymentStatus.Approved}>Approved</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700 whitespace-nowrap">
                    แสดงต่อหน้า:
                  </label>
                  <select
                    value={safeItemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size} รายการ
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow">
              <OrderTable
                orders={paginatedOrders}
                customers={customers}
                openModal={openModal}
                users={users}
                selectable={true}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                allOrders={orders}
              />

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                  <div className="text-sm text-gray-700">
                    แสดง {displayStart} - {displayEnd} จาก {totalItems} รายการ
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={effectivePage === 1}
                      className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm text-gray-700">
                      Page {effectivePage} of {totalPages}
                    </span>
                    <button
                      onClick={() =>
                        setCurrentPage((prev) =>
                          Math.min(totalPages, prev + 1),
                        )
                      }
                      disabled={effectivePage === totalPages}
                      className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {detailContext && detailOrder && (
          <Modal
            title={`Order details ${detailContext.orderId}`}
            onClose={() => setDetailContext(null)}
            size="xl"
          >
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-gray-500 text-xs">Seller</p>
                  <p className="font-medium text-gray-900">
                    {detailSeller
                      ? `${detailSeller.firstName} ${detailSeller.lastName}`
                      : (detailOrder as any).seller_name || "-"}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-gray-500 text-xs">Sale date</p>
                  <p className="font-medium text-gray-900">
                    {formatDate(
                      (detailOrder as any).orderDate ||
                      (detailOrder as any).order_date,
                    )}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-gray-500 text-xs">Delivery date</p>
                  <p className="font-medium text-gray-900">
                    {formatDate(
                      (detailOrder as any).deliveryDate ||
                      (detailOrder as any).delivery_date,
                    )}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-gray-500 text-xs">Tracking No</p>
                  <p className="font-medium text-gray-900">
                    {(detailOrder as Order).trackingNumbers
                      ? (detailOrder as Order).trackingNumbers.join(", ")
                      : "-"}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-gray-500 text-xs">Customer type</p>
                  <p className="font-medium text-gray-900">
                    {detailCustomer?.lifecycleStatus || "-"}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-gray-500 text-xs">Channel</p>
                  <p className="font-medium text-gray-900">
                    {(detailOrder as any).salesChannel ||
                      (detailOrder as any).sales_channel ||
                      "-"}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-gray-500 text-xs">Customer name</p>
                  <p className="font-medium text-gray-900">
                    {detailCustomer
                      ? `${detailCustomer.firstName} ${detailCustomer.lastName}`
                      : (detailOrder as any).customer_name || "-"}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-gray-500 text-xs">Phone</p>
                  <p className="font-medium text-gray-900">
                    {detailCustomer?.phone ||
                      (detailOrder as any).customer_phone ||
                      "-"}
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-gray-500 text-xs mb-1">Notes</p>
                <p className="text-gray-900">
                  {(detailOrder as any).notes || "-"}
                </p>
              </div>

              <div>
                <p className="text-gray-700 font-medium mb-2">Items</p>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 text-gray-600">
                      <tr>
                        <th className="px-3 py-2 text-left">Item</th>
                        <th className="px-3 py-2 text-center">Qty</th>
                        <th className="px-3 py-2 text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detailOrder as Order).items?.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-3 py-2">{item.productName}</td>
                          <td className="px-3 py-2 text-center">
                            {item.quantity}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatCurrency(
                              item.pricePerUnit * item.quantity -
                              (item.discount || 0),
                            )}
                          </td>
                        </tr>
                      )) || (
                          <tr>
                            <td
                              colSpan={3}
                              className="px-3 py-2 text-center text-gray-500"
                            >
                              No items found
                            </td>
                          </tr>
                        )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-gray-500 text-xs">Amount received</p>
                  <p className="font-medium text-gray-900">
                    {formatCurrency(
                      detailStatement?.confirmedAmount ||
                      (detailOrder as any).amount_paid ||
                      0,
                    )}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-gray-500 text-xs">Proof of transfer</p>
                  {(detailOrder as Order).slips &&
                    (detailOrder as Order).slips!.length > 0 ? (
                    <div className="flex gap-2 flex-wrap mt-2">
                      {(detailOrder as Order).slips!.map((slip) => (
                        <a
                          key={slip.id}
                          href={slip.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 underline text-xs"
                        >
                          Slip #{slip.id}
                        </a>
                      ))}
                    </div>
                  ) : (detailOrder as any).slipUrl ? (
                    <a
                      href={(detailOrder as any).slipUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline text-xs"
                    >
                      Open slip
                    </a>
                  ) : (
                    <p className="text-gray-700">-</p>
                  )}
                </div>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </>
  );
};

export default FinanceApprovalPage;

