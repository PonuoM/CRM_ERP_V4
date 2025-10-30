import React, { useState, useMemo, useEffect } from "react";
import {
  Customer,
  User,
  UserRole,
  CustomerGrade,
  CustomerLifecycleStatus,
} from "../types";
import {
  Users,
  Check,
  AlertTriangle,
  Info,
  ListChecks,
  History,
  Award,
  PlayCircle,
  BarChart,
  UserCheck,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { listCustomersBySource, updateCustomer } from "@/services/api";

interface CustomerDistributionPageProps {
  allCustomers: Customer[];
  allUsers: User[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
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
    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
      activeValue === value
        ? "bg-blue-600 text-white"
        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
    }`}
  >
    {label}
  </button>
);

const gradeOrder = [
  CustomerGrade.APlus,
  CustomerGrade.A,
  CustomerGrade.B,
  CustomerGrade.C,
  CustomerGrade.D,
];

const CustomerDistributionPage: React.FC<CustomerDistributionPageProps> = ({
  allCustomers,
  allUsers,
  setCustomers,
}) => {
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
  const [excludeGradeAPlus, setExcludeGradeAPlus] = useState(true);
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
  const [distributionResult, setDistributionResult] = useState<{
    success: number;
    skipped: number;
  } | null>(null);
  const [savingDistribution, setSavingDistribution] = useState(false);

  const telesaleAgents = useMemo(() => {
    return allUsers.filter(
      (u) => u.role === UserRole.Telesale || u.role === UserRole.Supervisor,
    );
  }, [allUsers]);

  // Load customers per selected pool source
  useEffect(() => {
    let mounted = true;
    if (poolSource === "all") {
      setPoolCustomers(allCustomers);
      return;
    }
    setLoadingPool(true);
    // Note: company filter can be added if needed
    listCustomersBySource(poolSource)
      .then((rows: any[]) => {
        if (mounted) setPoolCustomers(rows as Customer[]);
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

  // Base dataset used throughout the page
  const dataCustomers: Customer[] =
    poolSource === "all" ? allCustomers : poolCustomers;

  // Basket summaries
  const waitingBasketCount = useMemo(
    () =>
      dataCustomers.filter(
        (c) => (c as any).isInWaitingBasket && !(c as any).isBlocked,
      ).length,
    [dataCustomers],
  );
  const toDistributeCount = useMemo(
    () =>
      dataCustomers.filter(
        (c) =>
          c.assignedTo === null &&
          !(c as any).isBlocked &&
          !(c as any).isInWaitingBasket,
      ).length,
    [dataCustomers],
  );
  const blockedCount = useMemo(
    () => dataCustomers.filter((c) => (c as any).isBlocked).length,
    [dataCustomers],
  );

  const getAgentWorkloadByGrade = (agentId: number) => {
    const agentCustomers = dataCustomers.filter(
      (c) => c.assignedTo === agentId,
    );
    const gradeCounts = agentCustomers.reduce(
      (acc, customer) => {
        acc[customer.grade] = (acc[customer.grade] || 0) + 1;
        return acc;
      },
      {} as Record<CustomerGrade, number>,
    );

    return {
      total: agentCustomers.length,
      [CustomerGrade.APlus]: gradeCounts[CustomerGrade.APlus] || 0,
      [CustomerGrade.A]: gradeCounts[CustomerGrade.A] || 0,
      [CustomerGrade.B]: gradeCounts[CustomerGrade.B] || 0,
      [CustomerGrade.C]: gradeCounts[CustomerGrade.C] || 0,
      [CustomerGrade.D]: gradeCounts[CustomerGrade.D] || 0,
    };
  };

  const availableCustomers = useMemo(() => {
    let customers = dataCustomers.filter(
      (c) =>
        c.assignedTo === null &&
        !(c as any).isBlocked &&
        !(c as any).isInWaitingBasket,
    );

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
        if (excludeGradeAPlus) {
          customers = customers.filter(
            (c) =>
              c.grade !== CustomerGrade.A && c.grade !== CustomerGrade.APlus,
          );
        }
        break;
      case "gradeA":
        customers = customers.filter(
          (c) => c.grade === CustomerGrade.A || c.grade === CustomerGrade.APlus,
        );
        break;
      case "backlog":
        // แจกย้อนหลัง - สามารถเพิ่ม logic พิเศษได้ที่นี่
        if (excludeGradeAPlus) {
          customers = customers.filter(
            (c) =>
              c.grade !== CustomerGrade.A && c.grade !== CustomerGrade.APlus,
          );
        }
        break;
    }
    return customers;
  }, [
    dataCustomers,
    activeTab,
    customerType,
    excludeGradeAPlus,
    activeDatePreset,
    dateRange,
  ]);

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
    if (!isNaN(count) && count > availableCustomers.length) {
      setDistributionCountError(
        `จำนวนที่ต้องการแจก (${count}) มากกว่าลูกค้าที่พร้อมแจก (${availableCustomers.length})`,
      );
    } else {
      setDistributionCountError("");
    }
  };

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
    if (selectedAgentIds.length === telesaleAgents.length) {
      setSelectedAgentIds([]);
    } else {
      setSelectedAgentIds(telesaleAgents.map((a) => a.id));
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
    if (count > availableCustomers.length) {
      // This case should be prevented by disabled button, but as a safeguard.
      return;
    }
    if (selectedAgentIds.length === 0) {
      alert("กรุณาเลือกพนักงานเป้าหมาย");
      return;
    }

    const selectedAgents = telesaleAgents.filter((a) =>
      selectedAgentIds.includes(a.id),
    );
    let distributableCustomers = [...availableCustomers];

    // Shuffle for fairness
    distributableCustomers.sort(() => Math.random() - 0.5);

    const assignments: PreviewAssignments = {};
    selectedAgents.forEach((agent) => (assignments[agent.id] = []));
    const skipped: SkippedCustomer[] = [];

    let assignedCount = 0;
    const customerPool = new Set(distributableCustomers);

    while (assignedCount < count && customerPool.size > 0) {
      let assignedInThisLoop = false;
      for (const agent of selectedAgents) {
        if (assignedCount >= count) break;

        for (const customer of customerPool) {
          const hasHistory = customer.assignmentHistory?.includes(agent.id);
          if (!hasHistory) {
            assignments[agent.id].push(customer);
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
  };

  const handleExecuteDistribution = async () => {
    const totalToAssign = Object.values(
      previewAssignments as PreviewAssignments,
    ).flat().length;
    if (totalToAssign === 0) {
      alert("กรุณาสร้างรายการที่ต้องการแจกก่อน");
      return;
    }

    if (
      !window.confirm(`ยืนยันการแจกลูกค้าจำนวน ${totalToAssign} รายการหรือไม่?`)
    ) {
      return;
    }

    const now = new Date();
    const assignmentTimestamp = now.toISOString();
    const ownershipDeadline = new Date(now.getTime());
    ownershipDeadline.setDate(ownershipDeadline.getDate() + 90);
    const ownershipExpires = ownershipDeadline.toISOString();

    const updatePromises: Promise<unknown>[] = [];
    for (const agentIdStr in previewAssignments as PreviewAssignments) {
      const agentId = parseInt(agentIdStr, 10);
      const customers = (previewAssignments as PreviewAssignments)[agentId];
      if (!Array.isArray(customers)) continue;
      customers.forEach((customer) => {
        updatePromises.push(
          updateCustomer(String(customer.id), {
            assignedTo: agentId,
            lifecycleStatus: targetStatus,
            dateAssigned: assignmentTimestamp,
            ownershipExpires,
            is_in_waiting_basket: 0,
            is_blocked: 0,
          }),
        );
      });
    }

    if (updatePromises.length === 0) {
      alert("ไม่พบลูกค้าที่ต้องการแจก กรุณาตรวจสอบอีกครั้ง");
      return;
    }

    setSavingDistribution(true);
    try {
      await Promise.all(updatePromises);

      const applyAssignments = (customers: Customer[]) => {
        return customers.map((customer) => {
          for (const agentIdStr in previewAssignments) {
            const agentId = parseInt(agentIdStr, 10);
            const assignedCustomers = previewAssignments[agentId];
            if (
              Array.isArray(assignedCustomers) &&
              assignedCustomers.some((c) => c.id === customer.id)
            ) {
              return {
                ...customer,
                assignedTo: agentId,
                lifecycleStatus: targetStatus,
                dateAssigned: assignmentTimestamp,
                ownershipExpires,
                assignmentHistory: [
                  ...(customer.assignmentHistory || []),
                  agentId,
                ],
              };
            }
          }
          return customer;
        });
      };

      setCustomers((prevCustomers) => applyAssignments(prevCustomers));
      setPoolCustomers((prev) => (prev.length ? applyAssignments(prev) : prev));

      const skippedCount = skippedCustomers.length;
      setDistributionResult({ success: totalToAssign, skipped: skippedCount });
      setShowPreview(false);
      setShowPreviewModal(false);
      setPreviewAssignments({});
      setSkippedCustomers([]);
      setDistributionCount("");
      setSelectedAgentIds([]);
    } catch (error) {
      console.error("Failed to distribute customers", error);
      alert("ไม่สามารถบันทึกการแจกลูกค้าได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
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
                  รายชื่อที่จะถูกแจก (
                  {
                    Object.values(
                      previewAssignments as PreviewAssignments,
                    ).flat().length
                  }
                  )
                </h4>
                <div className="space-y-4">
                  {Object.entries(previewAssignments as PreviewAssignments).map(
                    ([agentId, customers]) => {
                      const agent = telesaleAgents.find(
                        (a) => a.id === parseInt(agentId),
                      );
                      return (
                        customers.length > 0 && (
                          <div
                            key={agentId}
                            className="border rounded-lg p-4 bg-gray-50"
                          >
                            <p className="font-medium text-gray-800 mb-3">
                              {agent
                                ? `${agent.firstName} ${agent.lastName}`
                                : ""}{" "}
                              <span className="font-normal text-gray-500">
                                ({customers.length} รายชื่อ)
                              </span>
                            </p>
                            <div className="max-h-64 overflow-y-auto pr-2">
                              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 pl-2">
                                {customers.map((c) => (
                                  <li key={c.id} className="py-1">
                                    {`${c.firstName} ${c.lastName}`} ({c.phone})
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )
                      );
                    },
                  )}
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
                <PlayCircle size={20} className="mr-2" />
                {savingDistribution ? "กำลังบันทึก..." : "เริ่มแจกลูกค้า"}
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
                        {`${customer.firstName} ${customer.lastName}`}
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

  const renderTabContent = () => {
    return (
      <div className="space-y-6">
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
                  className="h-4 w-4 rounded text-green-600 focus:ring-green-500"
                />
                <label
                  htmlFor="grade-a-mode"
                  className="ml-2 text-sm text-gray-700"
                >
                  แจกเกรด A/A+ เท่านั้น
                </label>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setPoolSource("all");
                  setShowPreview(false);
                  setShowPreviewModal(false);
                }}
                className={`px-3 py-1.5 text-xs rounded-md border ${poolSource === "all" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"}`}
              >
                ทั้งหมด
              </button>
              <button
                onClick={() => {
                  setPoolSource("new_sale");
                  setShowPreview(false);
                  setShowPreviewModal(false);
                }}
                className={`px-3 py-1.5 text-xs rounded-md border ${poolSource === "new_sale" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"}`}
              >
                เพิ่งขาย (Admin)
              </button>
              <button
                onClick={() => {
                  setPoolSource("waiting_return");
                  setShowPreview(false);
                  setShowPreviewModal(false);
                }}
                className={`px-3 py-1.5 text-xs rounded-md border ${poolSource === "waiting_return" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"}`}
              >
                คืนจากตะกร้า
              </button>
              <button
                onClick={() => {
                  setPoolSource("stock");
                  setShowPreview(false);
                  setShowPreviewModal(false);
                }}
                className={`px-3 py-1.5 text-xs rounded-md border ${poolSource === "stock" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"}`}
              >
                สต็อกรอแจก
              </button>
              {loadingPool && poolSource !== "all" && (
                <span className="text-xs text-gray-500 ml-2">กำลังโหลด...</span>
              )}
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
              <h3 className="text-lg font-semibold text-gray-700 flex items-center">
                <UserCheck className="mr-2" />
                2. เลือกพนักงานเป้าหมาย
              </h3>
              <div className="mt-1 space-y-1">
                <p className="text-sm text-gray-500">
                  มีรายชื่อพร้อมแจก:{" "}
                  <span className="font-bold text-green-600">
                    {availableCustomers.length}
                  </span>{" "}
                  รายการ
                </p>
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
                  <div>
                    โหมดการแจก:{" "}
                    {activeTab === "gradeA"
                      ? "เกรด A/A+ เท่านั้น"
                      : "แจกแบบเฉลี่ย (รายวัน)"}
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
                        selectedAgentIds.length === telesaleAgents.length &&
                        telesaleAgents.length > 0
                      }
                      onChange={handleSelectAllAgents}
                      className="w-4 h-4 rounded text-green-600 focus:ring-green-500 border-gray-300"
                    />
                  </th>
                  <th className="px-6 py-3">พนักงาน</th>
                  <th className="px-6 py-3 text-center">ลูกค้าทั้งหมด</th>
                  {gradeOrder.map((grade) => (
                    <th key={grade} className="px-2 py-3 text-center">
                      {grade}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {telesaleAgents.map((agent) => {
                  const workload = getAgentWorkloadByGrade(agent.id);
                  return (
                    <tr
                      key={agent.id}
                      className={`border-b ${selectedAgentIds.includes(agent.id) ? "bg-green-50" : "hover:bg-gray-50"}`}
                    >
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={selectedAgentIds.includes(agent.id)}
                          onChange={() => handleAgentSelection(agent.id)}
                          className="w-4 h-4 rounded text-green-600 focus:ring-green-500 border-gray-300"
                        />
                      </td>
                      {/* FIX: Replaced non-existent 'name' property with 'firstName' and 'lastName' for the user object. */}
                      <td className="px-6 py-2 font-medium text-gray-800">{`${agent.firstName} ${agent.lastName}`}</td>
                      <td className="px-6 py-2 text-center font-bold">
                        {workload.total}
                      </td>
                      {gradeOrder.map((grade) => (
                        <td key={grade} className="px-2 py-2 text-center">
                          {workload[grade]}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
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
            className={`px-3 py-1.5 text-xs rounded-md border ${poolSource === "all" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"}`}
          >
            ทั้งหมด
          </button>
          <button
            onClick={() => setPoolSource("new_sale")}
            className={`px-3 py-1.5 text-xs rounded-md border ${poolSource === "new_sale" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"}`}
          >
            เพิ่งขาย (Admin)
          </button>
          <button
            onClick={() => setPoolSource("waiting_return")}
            className={`px-3 py-1.5 text-xs rounded-md border ${poolSource === "waiting_return" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"}`}
          >
            คืนจากตะกร้า
          </button>
          <button
            onClick={() => setPoolSource("stock")}
            className={`px-3 py-1.5 text-xs rounded-md border ${poolSource === "stock" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"}`}
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="p-3 rounded-md border bg-white">
          <p className="text-xs text-gray-500 mb-1">ตะกร้ารอแจก</p>
          <p className="text-xl font-bold text-blue-600">{toDistributeCount}</p>
        </div>
        <div className="p-3 rounded-md border bg-white">
          <p className="text-xs text-gray-500 mb-1">ตะกร้าพักรายชื่อ</p>
          <p className="text-xl font-bold text-amber-600">
            {waitingBasketCount}
          </p>
        </div>
        <div className="p-3 rounded-md border bg-white">
          <p className="text-xs text-gray-500 mb-1">ตะกร้าบล็อค</p>
          <p className="text-xl font-bold text-red-600">{blockedCount}</p>
        </div>
      </div>

      {renderTabContent()}

      {/* Preview Modal */}
      <PreviewModal />

      {/* Skipped Customers Modal */}
      <SkippedCustomersModal />
    </div>
  );
};

export default CustomerDistributionPage;
