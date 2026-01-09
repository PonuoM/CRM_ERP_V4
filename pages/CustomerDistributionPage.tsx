import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Customer,
  User,
  UserRole,
  CustomerGrade,
  CustomerLifecycleStatus,
  CustomerBehavioralStatus,
  Tag,
  TagType,
} from "../types";
import {
  Users,
  Check,
  AlertTriangle,
  Search,
  Info,
  ListChecks,
  History,
} from "lucide-react";
import resolveApiBasePath from "../utils/apiBasePath";
import {
  Award,
  PlayCircle,
  BarChart,
  UserCheck,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { listCustomersBySource, updateCustomer, getCustomerStats, listCustomers, getTelesaleUsers, bulkDistributeCustomers, unblockCustomerBlock } from "@/services/api";
import { calculateCustomerGrade } from "@/utils/customerGrade";
import { mapCustomerFromApi } from "@/utils/customerMapper";
import Spinner from "@/components/Spinner";

interface CustomerDistributionPageProps {
  allCustomers: Customer[];
  allUsers: User[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  currentUser?: { id: number; companyId: number };
}

type DistributionMode = "average" | "backlog" | "gradeA";
type CustomerType = "all" | "new" | "repeat" | "prospect";
type PreviewAssignments = Record<number, Customer[]>;
type SkippedCustomer = { customer: Customer; reason: string };

const DateFilterButton: React.FC<{
  label: string;
  value: string;
  activeValue: string;
  onClick: (value: string) => void;
}> = ({ label, value, activeValue, onClick }) => (
  <button
    onClick={() => onClick(value)}
    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeValue === value
      ? "bg-blue-600 text-white"
      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
  >
    {label}
  </button>
);

const gradeOrder = [
  CustomerGrade.A,
  CustomerGrade.B,
  CustomerGrade.C,
  CustomerGrade.D,
];

const toLifecycleStatus = (
  status: string | null | undefined,
): CustomerLifecycleStatus => {
  switch (status) {
    case CustomerLifecycleStatus.New:
    case CustomerLifecycleStatus.Old:
    case CustomerLifecycleStatus.FollowUp:
    case CustomerLifecycleStatus.Old3Months:
    case CustomerLifecycleStatus.DailyDistribution:
      return status;
    default:
      return CustomerLifecycleStatus.New;
  }
};

const toBehavioralStatus = (
  status: string | null | undefined,
): CustomerBehavioralStatus => {
  switch (status) {
    case CustomerBehavioralStatus.Hot:
    case CustomerBehavioralStatus.Warm:
    case CustomerBehavioralStatus.Cold:
    case CustomerBehavioralStatus.Frozen:
      return status;
    default:
      return CustomerBehavioralStatus.Cold;
  }
};

const toOptionalBoolean = (value: unknown): boolean | undefined => {
  if (value === null || typeof value === "undefined") {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === "") return undefined;
    if (trimmed === "1" || trimmed === "true") return true;
    if (trimmed === "0" || trimmed === "false") return false;
  }
  return undefined;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === null || typeof value === "undefined" || value === "") {
    return undefined;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const normalizeApiCustomer = (api: any): Customer => {
  const assignedTo =
    api?.assigned_to !== null && typeof api?.assigned_to !== "undefined"
      ? Number(api.assigned_to)
      : null;

  const address = {
    street: api?.street || "",
    subdistrict: api?.subdistrict || "",
    district: api?.district || "",
    province: api?.province || "",
    postalCode: api?.postal_code || "",
  };

  const tags: Tag[] = Array.isArray(api?.tags)
    ? api.tags
      .map((raw: any) => {
        const id = Number(raw?.id);
        const name = raw?.name ?? "";
        const type =
          raw?.type === TagType.System ? TagType.System : TagType.User;
        return Number.isFinite(id) && name ? { id, name, type } : undefined;
      })
      .filter((tag): tag is Tag => Boolean(tag))
    : [];

  const assignmentHistory = Array.isArray(api?.assignment_history)
    ? api.assignment_history
      .map((id: any) => Number(id))
      .filter((id: number) => Number.isFinite(id))
    : [];

  // Resolve customer ID: prefer customer_id (PK), fallback to id or pk
  const pk = api?.customer_id ?? api?.id ?? api?.pk ?? null;
  const refId =
    api?.customer_ref_id ??
    api?.customer_ref ??
    api?.customer_refid ??
    api?.customerId ??
    null;
  const resolvedId =
    pk != null ? String(pk) : refId != null ? String(refId) : "";

  return {
    id: resolvedId,
    pk: pk != null ? Number(pk) : undefined,
    customerId: refId ?? undefined,
    customerRefId: refId ?? undefined,
    firstName: api?.first_name ?? "",
    lastName: api?.last_name ?? "",
    phone: api?.phone ?? "",
    email: api?.email ?? undefined,
    address,
    province: address.province,
    companyId: Number(api?.company_id ?? 0),
    assignedTo,
    dateAssigned: api?.date_assigned ?? "",
    dateRegistered: api?.date_registered ?? undefined,
    followUpDate: api?.follow_up_date ?? undefined,
    ownershipExpires: api?.ownership_expires ?? "",
    lifecycleStatus: toLifecycleStatus(api?.lifecycle_status),
    behavioralStatus: toBehavioralStatus(api?.behavioral_status),
    grade: (() => {
      // Use grade from API if available, otherwise calculate from total_purchases
      const apiGrade = api?.grade;
      if (apiGrade) {
        // Normalize grade from API (handle "A+", "A", "B", "C", "D")
        const gradeStr = String(apiGrade).trim().toUpperCase();
        if (gradeStr === "A+" || gradeStr === "A_PLUS" || gradeStr === "A-PLUS") {
          return CustomerGrade.APlus;
        }
        if (gradeStr === "A") return CustomerGrade.A;
        if (gradeStr === "B") return CustomerGrade.B;
        if (gradeStr === "C") return CustomerGrade.C;
        if (gradeStr === "D") return CustomerGrade.D;
      }
      // Fallback: calculate from total_purchases if grade not provided
      return calculateCustomerGrade(Number(api?.total_purchases ?? 0));
    })(),
    tags,
    assignmentHistory,
    totalPurchases: Number(api?.total_purchases ?? 0),
    totalCalls: Number(api?.total_calls ?? 0),
    facebookName: api?.facebook_name ?? undefined,
    lineId: api?.line_id ?? undefined,
    doReason: api?.do_reason ?? undefined,
    lastCallNote: api?.last_call_note ?? undefined,
    hasSoldBefore: toOptionalBoolean(api?.has_sold_before),
    followUpCount: toOptionalNumber(api?.follow_up_count),
    lastFollowUpDate: api?.last_follow_up_date ?? undefined,
    lastSaleDate: api?.last_sale_date ?? undefined,
    isInWaitingBasket: Boolean(api?.is_in_waiting_basket ?? false),
    waitingBasketStartDate: api?.waiting_basket_start_date ?? undefined,
    isBlocked: Boolean(api?.is_blocked ?? false),
    firstOrderDate: api?.first_order_date ?? undefined,
    lastOrderDate: api?.last_order_date ?? undefined,
    orderCount: toOptionalNumber(api?.order_count),
    isNewCustomer: toOptionalBoolean(api?.is_new_customer),
    isRepeatCustomer: toOptionalBoolean(api?.is_repeat_customer),
  };
};

const CustomerDistributionPage: React.FC<CustomerDistributionPageProps> = ({
  allCustomers,
  allUsers,
  setCustomers,
  currentUser,
}) => {
  // Customer Stats from API
  const [customerStats, setCustomerStats] = useState<{
    totalCustomers: number;
    grades: Record<string, number>;
    baskets?: {
      waitingDistribute: number;
      waitingBasket: number;
      blocked: number;
    };
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Telesale User Stats from API
  const [telesaleStats, setTelesaleStats] = useState<any[]>([]);
  const [loadingTelesaleStats, setLoadingTelesaleStats] = useState(true);

  // Pool source toggle (all | new_sale | waiting_return | stock)
  const [poolSource, setPoolSource] = useState<
    "all" | "new_sale" | "waiting_return" | "stock"
  >("all");
  const [poolCustomers, setPoolCustomers] = useState<Customer[]>([]);
  const [loadingPool, setLoadingPool] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<DistributionMode>("average");
  const [targetStatus, setTargetStatus] = useState<CustomerLifecycleStatus>(
    CustomerLifecycleStatus.DailyDistribution,
  );
  const excludeGradeA = true;
  const [selectedAgentIds, setSelectedAgentIds] = useState<number[]>([]);
  const [distributionCount, setDistributionCount] = useState<string>("");
  const [distributionCountError, setDistributionCountError] =
    useState<string>("");
  // Customer type filtering
  const [customerType, setCustomerType] = useState<CustomerType>("all");

  const [activeDatePreset, setActiveDatePreset] = useState("all");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const [previewAssignments, setPreviewAssignments] =
    useState<PreviewAssignments>({});
  const [skippedCustomers, setSkippedCustomers] = useState<SkippedCustomer[]>(
    [],
  );
  const [showPreview, setShowPreview] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showSkippedModal, setShowSkippedModal] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [distributionResult, setDistributionResult] = useState<{
    success: number;
    skipped: number;
  } | null>(null);
  const [savingDistribution, setSavingDistribution] = useState(false);
  const [displayCount, setDisplayCount] = useState<number>(0);

  const telesaleAgents = useMemo(() => {
    return allUsers.filter(
      (u) => u.role === UserRole.Telesale || u.role === UserRole.Supervisor,
    );
  }, [allUsers]);

  const adminUserIds = useMemo(
    () => allUsers.filter((u) => u.role === UserRole.Admin || (u.role as any) === "Admin Page").map((u) => u.id),
    [allUsers],
  );

  // Load customers per selected pool source
  useEffect(() => {
    let mounted = true;
    if (poolSource === "all") {
      setPoolCustomers(allCustomers);
      return;
    }
    setLoadingPool(true);
    const startFetch = Date.now();
    // Note: company filter can be added if needed
    listCustomersBySource(poolSource)
      .then((response: any) => {
        if (!mounted) return;
        const rows = Array.isArray(response) ? response : (response?.data || []);
        const mapped = Array.isArray(rows)
          ? rows.map((row: any) => normalizeApiCustomer(row))
          : [];
        setPoolCustomers(mapped);
      })
      .catch(() => {
        if (mounted) setPoolCustomers([]);
      })
      .finally(() => {
        if (mounted) setLoadingPool(false);
      });
    return () => {
      mounted = false;
    };
  }, [poolSource, allCustomers]);

  // Fetch customer stats from API
  useEffect(() => {
    if (!currentUser?.companyId) {
      setLoadingStats(false);
      return;
    }

    let mounted = true;
    setLoadingStats(true);
    getCustomerStats(currentUser.companyId)
      .then((response) => {
        if (!mounted) return;
        if (response?.ok && response?.stats) {
          setCustomerStats(response.stats);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch customer stats:", err);
      })
      .finally(() => {
        if (mounted) setLoadingStats(false);
      });
    return () => {
      mounted = false;
    };
  }, [currentUser?.companyId]);

  // Fetch telesale user stats from API
  useEffect(() => {
    if (!currentUser?.companyId) {
      setLoadingTelesaleStats(false);
      return;
    }

    let mounted = true;
    setLoadingTelesaleStats(true);
    getTelesaleUsers(currentUser.companyId)
      .then((response) => {
        if (!mounted) return;
        if (response?.ok && response?.users) {
          setTelesaleStats(response.users);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch telesale stats:", err);
      })
      .finally(() => {
        if (mounted) setLoadingTelesaleStats(false);
      });
    return () => {
      mounted = false;
    };
  }, [currentUser?.companyId]);

  // Base dataset used throughout the page
  const dataCustomers: Customer[] =
    poolSource === "all" ? allCustomers : poolCustomers;

  // Basket summaries from API (fallback to client-side calculation if API data not available)
  const waitingBasketCount = customerStats?.baskets?.waitingBasket ?? dataCustomers.filter(
    (c) => (c as any).isInWaitingBasket && !(c as any).isBlocked,
  ).length;

  const toDistributeCount = customerStats?.baskets?.waitingDistribute ?? dataCustomers.filter(
    (c) =>
      c.assignedTo === null &&
      !(c as any).isBlocked &&
      !(c as any).isInWaitingBasket,
  ).length;

  const blockedCount = customerStats?.baskets?.blocked ?? dataCustomers.filter((c) => (c as any).isBlocked).length;

  const assignedCount = (customerStats?.totalCustomers ?? dataCustomers.length) - toDistributeCount - waitingBasketCount - blockedCount;

  const getAgentWorkloadByGrade = (agentId: number) => {
    const agentCustomers = dataCustomers.filter(
      (c) => c.assignedTo === agentId,
    );
    const gradeCounts = agentCustomers.reduce(
      (acc, customer) => {
        const grade = customer.grade;
        // Normalize APlus to A for display purposes
        const normalizedGrade = grade === CustomerGrade.APlus ? CustomerGrade.A : grade;
        acc[normalizedGrade] = (acc[normalizedGrade] || 0) + 1;
        return acc;
      },
      {} as Record<CustomerGrade, number>,
    );

    return {
      total: agentCustomers.length,
      [CustomerGrade.A]: (gradeCounts[CustomerGrade.A] || 0) + (gradeCounts[CustomerGrade.APlus] || 0),
      [CustomerGrade.B]: gradeCounts[CustomerGrade.B] || 0,
      [CustomerGrade.C]: gradeCounts[CustomerGrade.C] || 0,
      [CustomerGrade.D]: gradeCounts[CustomerGrade.D] || 0,
    };
  };

  const availableCustomers = useMemo(() => {
    let customers = dataCustomers.filter((c) => {
      const assignedId = c.assignedTo;
      // Consider both "Admin" from enum and "Admin Page" from DB
      const isAssignedToAdmin =
        typeof assignedId === "number" && adminUserIds.includes(assignedId);

      // For New Sale tab, we might show customers already assigned to Admin (for re-assignment)
      // but for Stock and Return, we usually want unassigned only.
      // However, the API already filters assignedTo IS NULL for those.
      const eligibleAssignment =
        assignedId === null || (poolSource === "new_sale" && isAssignedToAdmin);

      if (!eligibleAssignment) return false;
      if (Boolean((c as any).isBlocked)) return false;

      // Tab-specific waiting basket logic
      if (poolSource === "waiting_return") {
        return Boolean((c as any).isInWaitingBasket);
      } else if (poolSource === "all") {
        // For 'All', we follow the same logic as 'waitingDistribute' stat (usually excludes basket)
        return !Boolean((c as any).isInWaitingBasket);
      } else if (poolSource === "new_sale") {
        // For 'New Sale', allow basket (User Request)
        return true;
      } else {
        // For 'Stock', exclude basket
        return !Boolean((c as any).isInWaitingBasket);
      }
    });

    // กรองตามประเภทลูกค้า
    switch (customerType) {
      case "new":
        customers = customers.filter((c) => c.isNewCustomer === true);
        break;
      case "repeat":
        customers = customers.filter((c) => c.isRepeatCustomer === true);
        break;
      case "prospect":
        customers = customers.filter((c) => !c.firstOrderDate); // ลูกค้าที่ยังไม่เคยซื้อ
        break;
      case "all":
      default:
        // ไม่กรอง
        break;
    }

    // กรองตามช่วงเวลาการซื้อครั้งแรก (แทนการมอบหมาย)
    if (activeDatePreset !== "all" && customerType !== "prospect") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      customers = customers.filter((customer) => {
        // ใช้ firstOrderDate แทน dateAssigned
        const orderDate = customer.firstOrderDate
          ? new Date(customer.firstOrderDate)
          : null;
        if (!orderDate) return false; // ถ้าไม่มี firstOrderDate ให้ข้าม

        orderDate.setHours(0, 0, 0, 0);

        switch (activeDatePreset) {
          case "today":
            return orderDate.getTime() === today.getTime();
          case "3days":
            const threeDaysAgo = new Date(today);
            threeDaysAgo.setDate(today.getDate() - 2);
            return orderDate >= threeDaysAgo && orderDate <= today;
          case "7days":
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(today.getDate() - 6);
            return orderDate >= sevenDaysAgo && orderDate <= today;
          case "range":
            if (!dateRange.start || !dateRange.end) return true;
            const startDate = new Date(dateRange.start);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(dateRange.end);
            endDate.setHours(0, 0, 0, 0);
            return orderDate >= startDate && orderDate <= endDate;
          default:
            return true;
        }
      });
    }

    switch (activeTab) {
      case "average":
        if (excludeGradeA) {
          customers = customers.filter((c) => c.grade !== CustomerGrade.A);
        }
        break;
      case "gradeA":
        customers = customers.filter((c) => c.grade === CustomerGrade.A);
        break;
      case "backlog":
        // แจกย้อนหลัง - สามารถเพิ่ม logic พิเศษได้ที่นี่
        if (excludeGradeA) {
          customers = customers.filter((c) => c.grade !== CustomerGrade.A);
        }
        break;
    }
    return customers;
  }, [
    dataCustomers,
    activeTab,
    customerType,
    activeDatePreset,
    dateRange,
    poolSource,
    adminUserIds,
  ]);

  // Sync displayCount when loading finishes or source changes
  // Defined here so it can safely access availableCustomers
  useEffect(() => {
    if (!loadingPool && !loadingStats) {
      const actualCount = poolSource === "all"
        ? (customerStats?.baskets?.waitingDistribute ?? availableCustomers.length)
        : availableCustomers.length;
      setDisplayCount(actualCount);
    }
  }, [loadingPool, loadingStats, poolSource, customerStats, availableCustomers.length]);

  const handleDistributionCountChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const countStr = e.target.value;
    setDistributionCount(countStr);
    setShowPreview(false);
    setShowPreviewModal(false);

    if (countStr === "") {
      setDistributionCountError("");
      return;
    }

    const count = parseInt(countStr, 10);
    // Use API data if available, fallback to client-side calculation
    const actualAvailableCount = customerStats?.baskets?.waitingDistribute ?? availableCustomers.length;

    if (!isNaN(count) && count > actualAvailableCount) {
      setDistributionCountError(
        `จำนวนที่ต้องการแจก(${count.toLocaleString()}) มากกว่าลูกค้าที่พร้อมแจก(${actualAvailableCount.toLocaleString()})`,
      );
    } else {
      setDistributionCountError("");
    }
  };

  // Re-validate distribution count when API data loads
  useEffect(() => {
    if (distributionCount && customerStats?.baskets?.waitingDistribute) {
      const count = parseInt(distributionCount, 10);
      const actualAvailableCount = customerStats.baskets.waitingDistribute;

      if (!isNaN(count) && count > actualAvailableCount) {
        setDistributionCountError(
          `จำนวนที่ต้องการแจก(${count.toLocaleString()}) มากกว่าลูกค้าที่พร้อมแจก(${actualAvailableCount.toLocaleString()})`,
        );
      } else {
        setDistributionCountError("");
      }
    }
  }, [customerStats?.baskets?.waitingDistribute, distributionCount]);

  const handleAgentSelection = (agentId: number) => {
    setSelectedAgentIds((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId],
    );
    setShowPreview(false);
    setShowPreviewModal(false);
  };

  const handleSelectAllAgents = () => {
    if (selectedAgentIds.length === telesaleStats.length) {
      setSelectedAgentIds([]);
    } else {
      setSelectedAgentIds(telesaleStats.map((a) => a.id));
    }
    setShowPreview(false);
    setShowPreviewModal(false);
  };

  const handleGeneratePreview = () => {
    const count = parseInt(distributionCount, 10);
    if (isNaN(count) || count <= 0) {
      alert("กรุณาใส่จำนวนลูกค้าที่ต้องการแจกให้ถูกต้อง");
      return;
    }

    // Use API data for validation
    const actualAvailableCount = customerStats?.baskets?.waitingDistribute ?? availableCustomers.length;
    if (count > actualAvailableCount) {
      alert(`จำนวนที่ต้องการแจก(${count.toLocaleString()}) มากกว่าลูกค้าที่พร้อมแจก(${actualAvailableCount.toLocaleString()})`);
      return;
    }


    if (selectedAgentIds.length === 0) {
      alert("กรุณาเลือกพนักงานเป้าหมาย");
      return;
    }


    const selectedAgents = telesaleAgents.filter((a) =>
      selectedAgentIds.includes(a.id),
    );

    // Fetch real customers from API for preview
    const fetchPreviewCustomers = async () => {
      try {
        setLoadingPool(true);

        // Fetch customers from waiting basket (ready to distribute)
        const response = await listCustomers({
          companyId: currentUser.companyId,
          page: 1,
          pageSize: count, // Fetch exactly the number we need
          // Filter for customers ready to distribute
          assignedTo: null, // Not assigned
          // Note: API should filter out blocked and in_waiting_basket automatically
        });

        // Map API response to Customer objects
        const fetchedCustomers = (response?.data || []).map((c: any) => mapCustomerFromApi(c));

        if (fetchedCustomers.length === 0) {
          alert("ไม่พบลูกค้าที่พร้อมแจก กรุณาตรวจสอบอีกครั้ง");
          setLoadingPool(false);
          return;
        }

        // Shuffle for fairness
        const distributableCustomers = [...fetchedCustomers];
        distributableCustomers.sort(() => Math.random() - 0.5);

        const assignments: PreviewAssignments = {};
        selectedAgents.forEach((agent) => (assignments[agent.id] = []));
        const skipped: SkippedCustomer[] = [];
        const actualAssignmentCounts: Record<number, number> = {}; // Track actual counts
        selectedAgents.forEach((agent) => (actualAssignmentCounts[agent.id] = 0));

        let assignedCount = 0;
        const customerPool = new Set(distributableCustomers);

        while (assignedCount < count && customerPool.size > 0) {
          let assignedInThisLoop = false;
          for (const agent of selectedAgents) {
            if (assignedCount >= count) break;

            for (const customer of customerPool) {
              const hasHistory = customer.assignmentHistory?.includes(agent.id);
              if (!hasHistory) {
                // Track actual assignment count
                actualAssignmentCounts[agent.id]++;

                // Only add to preview if less than 10 items
                if (assignments[agent.id].length < 10) {
                  assignments[agent.id].push(customer);
                }

                customerPool.delete(customer);
                assignedCount++;
                assignedInThisLoop = true;
                break;
              }
            }
          }
          if (!assignedInThisLoop) {
            customerPool.forEach((c) =>
              skipped.push({
                customer: c,
                reason: "เคยอยู่กับพนักงานทุกคนที่เลือกแล้ว",
              }),
            );
            break;
          }
        }

        setPreviewAssignments(assignments);
        setSkippedCustomers(skipped);
        setShowPreview(true);
        setShowPreviewModal(true);
        setDistributionResult(null);
        setLoadingPool(false);
      } catch (error) {
        console.error("Failed to fetch preview customers:", error);
        alert("ไม่สามารถโหลดข้อมูลลูกค้าได้ กรุณาลองใหม่อีกครั้ง");
        setLoadingPool(false);
      }
    };

    fetchPreviewCustomers();
    return;
  };


  const handleExecuteDistribution = async () => {
    const actualCount = parseInt(distributionCount, 10);

    if (isNaN(actualCount) || actualCount <= 0) {
      alert("กรุณาใส่จำนวนลูกค้าที่ต้องการแจกให้ถูกต้อง");
      return;
    }

    if (selectedAgentIds.length === 0) {
      alert("กรุณาเลือกพนักงานเป้าหมาย");
      return;
    }

    if (
      !window.confirm(`ยืนยันการแจกลูกค้าจำนวน ${actualCount.toLocaleString()} รายการหรือไม่ ? `)
    ) {
      return;
    }

    setSavingDistribution(true);
    try {
      // Call bulk distribution API
      const response = await bulkDistributeCustomers({
        companyId: currentUser.companyId,
        count: actualCount,
        agentIds: selectedAgentIds,
        targetStatus,
        ownershipDays: 30,
        filters: {
          mode: poolSource,
          grade: activeTab === "gradeA" ? "A" : undefined,
        },
      });

      if (response?.ok) {
        // Show success message
        const { distributed, assignments, skipped } = response;
        let message = `แจกลูกค้าสำเร็จ ${distributed.toLocaleString()} รายการ\n\n`;

        // Show distribution per agent
        const selectedAgents = telesaleStats.filter((a) =>
          selectedAgentIds.includes(a.id),
        );
        selectedAgents.forEach((agent) => {
          const count = assignments[agent.id] || 0;
          message += `${agent.firstName} ${agent.lastName}: ${count.toLocaleString()} รายการ\n`;
        });

        if (skipped > 0) {
          message += `\nข้ามไป: ${skipped.toLocaleString()} รายการ`;
        }

        alert(message);

        // Reset form
        setDistributionResult({ success: distributed, skipped });
        setShowPreview(false);
        setShowPreviewModal(false);
        setPreviewAssignments({});
        setSkippedCustomers([]);
        setDistributionCount("");
        setSelectedAgentIds([]);

        // Refresh data
        try {
          // Set loading states
          setLoadingStats(true);
          setLoadingTelesaleStats(true);

          // Refresh customer stats
          const statsResponse = await getCustomerStats(currentUser.companyId);
          if (statsResponse?.ok && statsResponse?.stats) {
            setCustomerStats(statsResponse.stats);
          }

          // Refresh list if using specific source
          if (poolSource !== "all") {
            setLoadingPool(true);
            const poolRes = await listCustomersBySource(poolSource);
            const rows = Array.isArray(poolRes) ? poolRes : (poolRes?.data || []);
            const mapped = Array.isArray(rows)
              ? rows.map((row: any) => normalizeApiCustomer(row))
              : [];
            setPoolCustomers(mapped);
            setLoadingPool(false);
          }
          setLoadingStats(false);

          // Refresh telesale stats
          const telesaleResponse = await getTelesaleUsers(currentUser.companyId);
          if (telesaleResponse?.ok && telesaleResponse?.users) {
            setTelesaleStats(telesaleResponse.users);
          }
          setLoadingTelesaleStats(false);
        } catch (refreshError) {
          console.error("Failed to refresh stats:", refreshError);
          setLoadingStats(false);
          setLoadingTelesaleStats(false);
          // Don't show error to user, stats will refresh on next page load
        }

        // Stop loading after everything is done
        setSavingDistribution(false);
      } else {
        throw new Error(response?.error || "Distribution failed");
      }
    } catch (error) {
      console.error("Failed to distribute customers", error);
      alert("ไม่สามารถบันทึกการแจกลูกค้าได้ กรุณาลองใหม่อีกครั้ง");
      setSavingDistribution(false);
    }
  };
  const handleDatePresetClick = (preset: string) => {
    setActiveDatePreset(preset);
    setDateRange({ start: "", end: "" });
    setShowPreview(false);
    setShowPreviewModal(false);
  };

  const handleDateRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDateRange((prev) => {
      const newRange = { ...prev, [name]: value };
      if (newRange.start && newRange.end) {
        setActiveDatePreset("range");
      }
      return newRange;
    });
    setShowPreview(false);
    setShowPreviewModal(false);
  };

  const datePresets = [
    { label: "ทั้งหมด", value: "all" },
    { label: "วันนี้", value: "today" },
    { label: "3 วันล่าสุด", value: "3days" },
    { label: "7 วันล่าสุด", value: "7days" },
  ];

  // Preview Modal Component
  const PreviewModal: React.FC = () => {
    if (!showPreviewModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[95vh] overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-800 flex items-center">
                <Info className="mr-2 text-blue-600" size={24} />
                3. ตัวอย่างการแจก
              </h3>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            <div className="grid grid-cols-1 gap-6">
              <div>
                <h4 className="font-semibold mb-2">
                  รายชื่อที่จะถูกแจก ({distributionCount} รายชื่อ)
                </h4>
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                  <p className="text-sm text-blue-700">
                    <Info className="inline-block w-4 h-4 mr-1" />
                    แสดงตัวอย่างเพียง 10 รายชื่อแรกต่อพนักงาน การแจกจริงจะใช้จำนวน {distributionCount} รายชื่อตามที่กำหนด
                    {selectedAgentIds.length > 0 && (
                      <> (คนละประมาณ {Math.floor(parseInt(distributionCount, 10) / selectedAgentIds.length).toLocaleString()} รายชื่อ)</>
                    )}
                  </p>
                </div>
                <div className="space-y-4">
                  {Object.entries(previewAssignments as PreviewAssignments)
                    .filter(([agentId, customers]) => customers.length > 0)
                    .map(([agentId, customers]) => {
                      const agent = telesaleAgents.find(
                        (a) => a.id === parseInt(agentId),
                      );
                      // Calculate actual count per agent
                      const actualCountPerAgent = Math.floor(parseInt(distributionCount, 10) / selectedAgentIds.length);

                      return (
                        <div
                          key={agentId}
                          className="border rounded-lg p-4 bg-gray-50"
                        >
                          <h5 className="font-semibold text-lg mb-3 text-gray-700 flex items-center justify-between">
                            <span>
                              {agent?.firstName} {agent?.lastName}
                            </span>
                            <span className="text-sm font-normal text-blue-600">
                              ({actualCountPerAgent.toLocaleString()} รายชื่อ)
                            </span>
                          </h5>
                          <div className="max-h-64 overflow-y-auto pr-2">
                            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 pl-2">
                              {customers.map((c) => (
                                <li key={c.id} className="py-1">
                                  {`${c.firstName} ${c.lastName} `} ({c.phone})
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-yellow-700">
                  รายชื่อที่จะถูกข้าม ({skippedCustomers.length})
                </h4>
                {skippedCustomers.length > 0 ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => setShowSkippedModal(true)}
                      className="w-full bg-yellow-50 border border-yellow-200 rounded-lg p-4 hover:bg-yellow-100 transition-colors"
                    >
                      <p className="text-sm font-medium text-yellow-800">
                        ดูรายชื่อที่จะถูกข้าม ({skippedCustomers.length} รายการ)
                      </p>
                      <p className="text-xs text-yellow-600 mt-1">
                        คลิกเพื่อดูรายละเอียด
                      </p>
                    </button>
                    <div className="text-xs text-gray-500">
                      เหตุผลหลัก: ลูกค้าเคยอยู่กับพนักงานทุกคนที่เลือกแล้ว
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-800">
                      ไม่มีรายชื่อที่จะถูกข้าม
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-center">
              <button
                onClick={handleExecuteDistribution}
                disabled={savingDistribution}
                className="bg-green-100 text-green-700 font-semibold text-lg rounded-md py-3 px-8 flex items-center hover:bg-green-200 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-green-100"
              >
                {savingDistribution ? (
                  <>
                    <RefreshCw className="mr-2 animate-spin" size={20} />
                    กำลังแจกลูกค้า...
                  </>
                ) : (
                  <>
                    <PlayCircle className="mr-2" size={20} />
                    เริ่มแจกลูกค้า
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Skipped Customers Modal Component
  const SkippedCustomersModal: React.FC = () => {
    if (!showSkippedModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-800 flex items-center">
                <AlertTriangle className="mr-2 text-yellow-600" size={24} />
                รายชื่อที่จะถูกข้าม ({skippedCustomers.length} รายการ)
              </h3>
              <button
                onClick={() => setShowSkippedModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(80vh-200px)]">
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-4">
                ลูกค้าเหล่านี้จะถูกข้ามเนื่องจากเคยอยู่กับพนักงานทุกคนที่เลือกแล้ว
              </p>
            </div>

            <div className="space-y-3">
              {skippedCustomers.map(({ customer, reason }) => (
                <div
                  key={customer.id}
                  className="border rounded-lg p-3 bg-yellow-50 hover:bg-yellow-100 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">
                        {`${customer.firstName} ${customer.lastName} `}
                      </p>
                      <p className="text-sm text-gray-600">{customer.phone}</p>
                      {customer.email && (
                        <p className="text-sm text-gray-600">
                          {customer.email}
                        </p>
                      )}
                    </div>
                    <div className="ml-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-200 text-yellow-800">
                        {reason}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-end">
              <button
                onClick={() => setShowSkippedModal(false)}
                className="bg-gray-100 text-gray-700 font-medium text-sm rounded-md py-2 px-6 hover:bg-gray-200 transition-colors"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Blocked Customers Modal Component
  const BlockedCustomersModal: React.FC = () => {
    if (!showBlockedModal) return null;

    const [blockedCustomers, setBlockedCustomers] = useState<any[]>([]);
    const [loadingBlocked, setLoadingBlocked] = useState(false);
    const [unblockingIds, setUnblockingIds] = useState<Set<number>>(new Set());

    const refreshCustomerStats = async () => {
      if (!currentUser?.companyId) return;
      try {
        const statsResponse = await getCustomerStats(currentUser.companyId);
        if (statsResponse?.ok && statsResponse?.stats) {
          setCustomerStats(statsResponse.stats);
        }
      } catch (err) {
        console.error("Failed to refresh customer stats after unblock:", err);
      }
    };

    const fetchBlockedCustomers = async () => {
      setLoadingBlocked(true);
      try {
        const apiBase = resolveApiBasePath();
        const params = new URLSearchParams();
        if (currentUser?.companyId) {
          params.set("company_id", String(currentUser.companyId));
        }
        const url = `${apiBase}/get_blocked_customers.php${params.toString() ? `?${params.toString()}` : ""}`;
        const response = await fetch(url);
        const text = await response.text();
        let data: any = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          throw new Error(
            `Invalid JSON from blocked customers API: ${typeof text === "string" ? text.slice(0, 120) : ""} `,
          );
        }
        if (data?.success) {
          setBlockedCustomers(Array.isArray(data.data) ? data.data : []);
        } else {
          console.error("Blocked customers API error:", data?.error || data);
          setBlockedCustomers([]);
        }
      } catch (error) {
        console.error("Error fetching blocked customers:", error);
        setBlockedCustomers([]);
      } finally {
        setLoadingBlocked(false);
      }
    };

    const handleUnblock = async (blockId?: number) => {
      if (!blockId && blockId !== 0) return;
      if (!currentUser?.id) {
        alert("Missing user info for unblocking");
        return;
      }

      setUnblockingIds((prev) => {
        const next = new Set(prev);
        next.add(blockId);
        return next;
      });

      try {
        await unblockCustomerBlock(blockId, currentUser.id);
        await fetchBlockedCustomers();
        await refreshCustomerStats();
      } catch (error) {
        console.error("Failed to unblock customer:", error);
        alert("Unblock failed, please try again.");
      } finally {
        setUnblockingIds((prev) => {
          const next = new Set(prev);
          next.delete(blockId);
          return next;
        });
      }
    };

    useEffect(() => {
      if (showBlockedModal) {
        fetchBlockedCustomers();
      }
    }, [showBlockedModal, currentUser?.companyId]);

    if (!showBlockedModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[80vh] overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-800 flex items-center">
                <AlertTriangle className="mr-2 text-red-600" size={24} />
                รายชื่อลูกค้าที่ถูกบล็อค ({blockedCustomers.length} รายการ)
              </h3>
              <button
                onClick={() => setShowBlockedModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(80vh-200px)]">
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-4">
                รายชื่อลูกค้าที่ถูกระงับการแจกจ่ายชั่วคราว
              </p>
            </div>

            <div className="space-y-3">
              {loadingBlocked ? (
                <div className="flex justify-center py-8">
                  <Spinner size="lg" />
                </div>
              ) : blockedCustomers.length > 0 ? (
                <div className="overflow-x-auto">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                    <span>แสดง {blockedCustomers.length.toLocaleString()} รายการ</span>
                  </div>
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-gray-700">ลูกค้า</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-700">เบอร์โทร</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-700">สาเหตุ</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-700">วันที่บล็อค</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-700">ผู้บล็อค</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-700">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {blockedCustomers.map((customer) => {
                        const rawBlockId = customer.block_id ?? customer.id;
                        const blockId =
                          typeof rawBlockId === "string" ? Number(rawBlockId) : rawBlockId;
                        const hasBlockId =
                          blockId !== null &&
                          typeof blockId !== "undefined" &&
                          !Number.isNaN(Number(blockId));
                        const name = `${customer.fname || customer.first_name || ""} ${customer.lname || customer.last_name || ""} `.trim() || "ไม่ระบุชื่อ";
                        const blockedAt = customer.block_at
                          ? new Date(customer.block_at).toLocaleString("th-TH")
                          : "-";
                        const blocker = customer.blocker_nickname || customer.blocker_name || "-";
                        const reason = customer.reason || "ไม่ระบุสาเหตุ";

                        return (
                          <tr
                            key={
                              hasBlockId
                                ? `block - ${blockId} `
                                : `customer - ${customer.id ?? customer.customer_ref_id ?? customer.phone ?? Math.random()} `
                            }
                            className="hover:bg-red-50"
                          >
                            <td className="px-4 py-2 text-gray-900 font-medium">{name}</td>
                            <td className="px-4 py-2 text-gray-700">{customer.phone || "-"}</td>
                            <td className="px-4 py-2 text-gray-700">{reason}</td>
                            <td className="px-4 py-2 text-gray-700">{blockedAt}</td>
                            <td className="px-4 py-2 text-gray-700">{blocker}</td>
                            <td className="px-4 py-2 text-right">
                              <button
                                onClick={() => hasBlockId && handleUnblock(blockId)}
                                disabled={!hasBlockId || unblockingIds.has(blockId)}
                                className="bg-white border border-red-300 text-red-700 text-xs font-medium rounded-md px-3 py-1 hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                              >
                                {unblockingIds.has(blockId) ? "กำลังปลด..." : "ปลดบล็อค"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  ไม่มีลูกค้าที่ถูกบล็อคในขณะนี้
                </div>
              )}
            </div>
          </div>

          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-end">
              <button
                onClick={() => setShowBlockedModal(false)}
                className="bg-gray-100 text-gray-700 font-medium text-sm rounded-md py-2 px-6 hover:bg-gray-200 transition-colors"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  const renderTabContent = () => {
    return (
      <div className="space-y-6">
        {/* Customer Stats from API */}
        <div className="p-6 bg-white rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
            <BarChart className="mr-2" />
            สถิติลูกค้าทั้งหมด (จาก API)
          </h3>
          {loadingStats ? (
            <div className="flex justify-center items-center py-8">
              <Spinner size="lg" />
            </div>
          ) : customerStats ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-600 font-medium">ลูกค้าทั้งหมด</p>
                  <p className="text-2xl font-bold text-blue-700 mt-1">
                    {customerStats.totalCustomers.toLocaleString()}
                  </p>
                </div>
                {["A", "B", "C", "D"].map((grade) => (
                  <div
                    key={grade}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                  >
                    <p className="text-sm text-gray-600 font-medium">เกรด {grade}</p>
                    <p className="text-2xl font-bold text-gray-700 mt-1">
                      {(customerStats.grades[grade] ?? 0).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
              {/* Basket Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-600 font-medium">ตะกร้ารอแจก</p>
                  {loadingStats ? (
                    <div className="flex justify-center items-center h-10">
                      <Spinner size="sm" />
                    </div>
                  ) : (
                    <p className="text-2xl font-bold text-green-700 mt-1">
                      {customerStats.baskets?.waitingDistribute?.toLocaleString() || '0'}
                    </p>
                  )}
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-600 font-medium">ตะกร้าพักรายชื่อ</p>
                  {loadingStats ? (
                    <div className="flex justify-center items-center h-10">
                      <Spinner size="sm" />
                    </div>
                  ) : (
                    <p className="text-2xl font-bold text-yellow-700 mt-1">
                      {customerStats.baskets?.waitingBasket?.toLocaleString() || '0'}
                    </p>
                  )}
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-sm text-purple-600 font-medium">มีผู้ดูแล</p>
                  {loadingStats ? (
                    <div className="flex justify-center items-center h-10">
                      <Spinner size="sm" />
                    </div>
                  ) : (
                    <p className="text-2xl font-bold text-purple-700 mt-1">
                      {assignedCount.toLocaleString()}
                    </p>
                  )}
                </div>
                <div
                  onClick={() => setShowBlockedModal(true)}
                  className="bg-red-50 border border-red-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-all hover:bg-red-100 relative group"
                >
                  <div className="flex justify-between items-start">
                    <p className="text-sm text-red-600 font-medium">ตะกร้าบล็อค</p>
                    <Search size={16} className="text-red-400 group-hover:text-red-600 transition-colors" />
                  </div>
                  {loadingStats ? (
                    <div className="flex justify-center items-center h-10">
                      <Spinner size="sm" />
                    </div>
                  ) : (
                    <p className="text-2xl font-bold text-red-700 mt-1">
                      {customerStats.baskets?.blocked?.toLocaleString() || '0'}
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="text-gray-500 text-center py-4">ไม่สามารถโหลดข้อมูลสถิติได้</p>
          )}
        </div>

        <div className="p-6 bg-white rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
            <ListChecks className="mr-2" />
            1. ตั้งค่าการแจก
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                สถานะหลังแจก
              </label>
              <select
                value={targetStatus}
                onChange={(e) =>
                  setTargetStatus(e.target.value as CustomerLifecycleStatus)
                }
                className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                style={{ colorScheme: "light" }}
              >
                {Object.values(CustomerLifecycleStatus).map((s) => (
                  <option key={s} value={s} className="text-black">
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <div className="flex items-center p-2 border rounded-md h-10">
                <input
                  type="checkbox"
                  id="grade-a-mode"
                  checked={activeTab === "gradeA"}
                  onChange={(e) => {
                    const newTab = e.target.checked ? "gradeA" : "average";
                    setActiveTab(newTab);
                    setShowPreview(false);
                    setShowPreviewModal(false);
                  }}
                  className="h-4 w-4 rounded text-green-600 focus:ring-green-500 border-gray-300"
                />
                <label
                  htmlFor="grade-a-mode"
                  className="ml-2 text-sm text-gray-700"
                >
                  แจกเกรด A เท่านั้น
                </label>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block ml-1">
              แหล่งที่มาลูกค้า (Source)
            </label>
            <div className="bg-gray-100/80 p-1 rounded-xl inline-flex flex-wrap gap-1 border border-gray-200">
              {[
                { id: "stock", label: "สต็อกรอแจก", icon: <BarChart size={14} /> },
                { id: "new_sale", label: "เพิ่งขาย (Admin)", icon: <Award size={14} /> },
                { id: "waiting_return", label: "คืนจากตะกร้า", icon: <History size={14} /> },
                { id: "all", label: "ทั้งหมด", icon: <ListChecks size={14} /> },
              ].map((pool) => (
                <button
                  key={pool.id}
                  onClick={() => {
                    setPoolSource(pool.id as any);
                    setShowPreview(false);
                    setShowPreviewModal(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${poolSource === pool.id
                    ? "bg-white text-blue-600 shadow-sm border border-gray-200"
                    : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
                    }`}
                >
                  <span className={poolSource === pool.id ? "text-blue-500" : "text-gray-400"}>
                    {pool.icon}
                  </span>
                  <span className="whitespace-nowrap">{pool.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ส่วนเลือกประเภทลูกค้า */}
          {false && (
            <div className="mt-4 pt-4 border-t">
              <div className="mb-4"></div>
            </div>
          )}

          {false && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center mr-4">
                  <Calendar size={16} className="text-gray-500 mr-2" />
                  <span className="text-sm font-medium text-gray-700">
                    วันที่ลูกค้าซื้อครั้งแรก:
                  </span>
                </div>
                {datePresets.map((preset) => (
                  <DateFilterButton
                    key={preset.value}
                    label={preset.label}
                    value={preset.value}
                    activeValue={activeDatePreset}
                    onClick={handleDatePresetClick}
                  />
                ))}
                <div className="flex items-center gap-2 ml-auto">
                  <input
                    type="date"
                    name="start"
                    value={dateRange.start}
                    onChange={handleDateRangeChange}
                    className="p-1 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                    style={{ colorScheme: "light" }}
                  />
                  <span className="text-gray-500 text-sm">ถึง</span>
                  <input
                    type="date"
                    name="end"
                    value={dateRange.end}
                    onChange={handleDateRangeChange}
                    className="p-1 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                    style={{ colorScheme: "light" }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-white rounded-lg shadow-sm border">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                <UserCheck className="mr-2" />
                2. เลือกพนักงานเป้าหมาย
              </h3>
              <div className="mt-1 space-y-1">
                <div className="text-lg font-semibold text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2 inline-flex items-center gap-2 min-h-[56px] min-w-[200px] relative overflow-hidden">
                  <span>มีรายชื่อพร้อมแจก:</span>{" "}
                  <div className={`flex items-center gap-2 transition-all duration-150 ${loadingStats || loadingPool ? 'opacity-30 blur-[1px]' : 'opacity-100 blur-0'}`}>
                    <span className="text-3xl font-extrabold text-green-700">
                      {displayCount.toLocaleString()}
                    </span>{" "}
                    <span>รายการ</span>
                  </div>
                  {(loadingStats || loadingPool) && (
                    <div className="absolute inset-0 bg-green-50/10 animate-pulse pointer-events-none"></div>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  <div>
                    แหล่งข้อมูล:{" "}
                    {poolSource === "all"
                      ? "ทั้งหมด"
                      : poolSource === "new_sale"
                        ? "เพิ่งขาย (Admin)"
                        : poolSource === "waiting_return"
                          ? "คืนจากตะกร้า"
                          : "สต็อกรอแจก"}
                  </div>
                </div>
                {distributionCountError && (
                  <p className="text-sm text-red-600 mt-1">
                    {distributionCountError}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <label className="block text-sm font-medium text-gray-700 text-right">
                จำนวนลูกค้าที่ต้องการแจก
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={distributionCount}
                  onChange={handleDistributionCountChange}
                  className="w-44 md:w-48 p-2 border border-gray-300 rounded-md text-right bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                  placeholder="เช่น 100"
                  style={{ colorScheme: "light" }}
                />
                <button
                  onClick={handleGeneratePreview}
                  disabled={
                    !distributionCount ||
                    selectedAgentIds.length === 0 ||
                    !!distributionCountError ||
                    savingDistribution
                  }
                  className="bg-blue-100 text-blue-700 font-semibold text-sm rounded-md py-2 px-4 md:px-6 flex items-center hover:bg-blue-200 shadow-sm disabled:bg-gray-200 disabled:text-gray-500"
                >
                  <BarChart size={16} className="mr-2" />
                  ดูตัวอย่างก่อนแจก
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={
                        selectedAgentIds.length === telesaleStats.length &&
                        telesaleStats.length > 0
                      }
                      onChange={handleSelectAllAgents}
                      className="w-4 h-4 rounded text-green-600 focus:ring-green-500 border-gray-300"
                    />
                  </th>
                  <th className="px-6 py-3">พนักงาน</th>
                  <th className="px-6 py-3 text-center">ลูกค้าทั้งหมด</th>
                  {gradeOrder.map((grade, index) => (
                    <th key={`grade - header - ${grade} -${index} `} className="px-2 py-3 text-center">
                      {grade}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {loadingTelesaleStats ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center">
                      <div className="flex justify-center items-center">
                        <Spinner size="lg" />
                      </div>
                    </td>
                  </tr>
                ) : telesaleStats.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      ไม่พบพนักงาน Telesale
                    </td>
                  </tr>
                ) : (
                  telesaleStats.map((agent) => {
                    const gradeDistribution = agent.gradeDistribution || {};
                    return (
                      <tr
                        key={agent.id}
                        className={`border - b ${selectedAgentIds.includes(agent.id) ? "bg-green-50" : "hover:bg-gray-50"} `}
                      >
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={selectedAgentIds.includes(agent.id)}
                            onChange={() => handleAgentSelection(agent.id)}
                            className="w-4 h-4 rounded text-green-600 focus:ring-green-500 border-gray-300"
                          />
                        </td>
                        <td className="px-6 py-2 font-medium text-gray-800">{`${agent.firstName} ${agent.lastName} `}</td>
                        <td className="px-6 py-2 text-center font-bold">
                          {agent.totalCustomers}
                        </td>
                        {gradeOrder.map((grade, index) => (
                          <td key={`grade - ${agent.id} -${grade} -${index} `} className="px-2 py-2 text-center">
                            {gradeDistribution[grade] ?? 0}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div >
      </div >
    );
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">ระบบแจกลูกค้า</h2>
      {/* moved below into Step 1 card */}
      {false && (
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setPoolSource("all")}
            className={`px - 3 py - 1.5 text - xs rounded - md border ${poolSource === "all" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"} `}
          >
            ทั้งหมด
          </button>
          <button
            onClick={() => setPoolSource("new_sale")}
            className={`px - 3 py - 1.5 text - xs rounded - md border ${poolSource === "new_sale" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"} `}
          >
            เพิ่งขาย (Admin)
          </button>
          <button
            onClick={() => setPoolSource("waiting_return")}
            className={`px - 3 py - 1.5 text - xs rounded - md border ${poolSource === "waiting_return" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"} `}
          >
            คืนจากตะกร้า
          </button>
          <button
            onClick={() => setPoolSource("stock")}
            className={`px - 3 py - 1.5 text - xs rounded - md border ${poolSource === "stock" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"} `}
          >
            สต็อกรอแจก
          </button>
          {loadingPool && poolSource !== "all" && (
            <span className="text-xs text-gray-500 ml-2">กำลังโหลด...</span>
          )}
        </div>
      )}

      {distributionResult && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-4">
          <Check size={24} className="text-green-600" />
          <div>
            <p className="font-semibold text-green-800">
              แจกจ่ายรายชื่อสำเร็จ!
            </p>
            <p className="text-sm text-green-700">
              แจกสำเร็จ {distributionResult.success} รายการ, ข้าม{" "}
              {distributionResult.skipped} รายการ
            </p>
          </div>
        </div>
      )}



      {renderTabContent()}

      {/* Preview Modal */}
      <PreviewModal />

      {/* Skipped Customers Modal */}
      <SkippedCustomersModal />

      {/* Blocked Customers Modal */}
      <BlockedCustomersModal />
    </div>
  );
};

export default CustomerDistributionPage;
