import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Search,
  Filter,
  Download,
  Eye,
  Calendar,
  CheckCircle,
  X,
  AlertCircle,
  Image,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import resolveApiBasePath from "@/utils/apiBasePath";
import OrderDetailModal from "@/components/OrderDetailModal";

interface PaymentSlip {
  id: string;
  name: string;
  url?: string;
  uploadedAt: string;
  status: "pending" | "verified" | "rejected" | "preapproved" | "approved";
  uploadedBy?: string;
  customerName?: string;
  customerPhone?: string;
  amount?: number;
  orderTotal?: number;
  notes?: string;
  orderId?: string;
  bankName?: string;
  bankNumber?: string;
  transferDate?: string;
  fileExists?: boolean;
  originalUrl?: string;
  paymentMethod?: string;
}

interface OrderSlipGroup {
  orderId: string;
  customerName?: string;
  amount?: number;
  orderTotal?: number;
  slips: PaymentSlip[];
  latestUpload: string;
  status: "pending" | "verified" | "rejected" | "preapproved" | "approved";
  paymentMethod?: string;
}

const SlipAll: React.FC = () => {
  const apiBase = resolveApiBasePath();
  const toAbsoluteApiUrl = (u: string | undefined | null) => {
    if (!u) return u as any;
    const s = String(u);
    // Already absolute URL
    if (
      s.startsWith("http://") ||
      s.startsWith("https://") ||
      s.startsWith("//")
    ) {
      return s;
    }

    // Normalize base (e.g. '/mini_erp/api')
    const base = apiBase.replace(/\/$/, "");

    // If value starts with 'api/' or '/api/', ensure it is rooted under apiBase
    if (s.startsWith("api/") || s.startsWith("/api/")) {
      const trimmed = s.replace(/^\/?api/, ""); // remove leading 'api' or '/api'
      const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
      return `${base}${path}`;
    }

    // If value points to uploads without explicit '/api', prefix with apiBase
    if (s.startsWith("uploads/") || s.startsWith("/uploads/")) {
      const path = s.startsWith("/") ? s : `/${s}`;
      return `${base}${path}`;
    }

    // Fallback: treat as already rooted path relative to current origin
    return s.startsWith("/") ? s : `/${s}`;
  };
  const [slips, setSlips] = useState<PaymentSlip[]>([]);
  const [orderGroups, setOrderGroups] = useState<OrderSlipGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "preapproved" | "approved" | "rejected"
  >("all");
  const [dateFilter, setDateFilter] = useState<
    "all" | "today" | "week" | "month"
  >("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<OrderSlipGroup | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [viewingOrderId, setViewingOrderId] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const loadSlips = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sessionUser = localStorage.getItem("sessionUser");
      if (!sessionUser) {
        throw new Error("ไม่พบข้อมูลผู้ใช้ในระบบ");
      }
      const parsed = JSON.parse(sessionUser);
      const companyId = parsed?.company_id;
      if (!companyId) {
        throw new Error("ไม่พบรหัสบริษัทของผู้ใช้");
      }

      const params = new URLSearchParams({
        company_id: String(companyId),
        page: String(currentPage),
        pageSize: String(pageSize),
      });

      // Add user info for role-based filtering
      if (parsed.role && parsed.role !== "Backoffice" && parsed.role !== "Finance") {
        if (parsed.id) {
          params.append("user_id", String(parsed.id));
        }
        params.append("role", parsed.role);
        if (parsed.team_id) {
          params.append("team_id", String(parsed.team_id));
        }
      }

      // Append filters to API request for server-side filtering
      if (searchTerm) params.append("search", searchTerm);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (dateFilter !== "all") params.append("date_range", dateFilter);
      if (paymentMethodFilter !== "all") params.append("payment_method", paymentMethodFilter);

      const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
      const headers: any = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(
        `${apiBase}/Slip_DB/list_company_slips.php?${params.toString()}`,
        { headers }
      );
      if (!response.ok) {
        throw new Error(`โหลดข้อมูลล้มเหลว (${response.status})`);
      }
      const data = await response.json();
      if (!data?.success) {
        throw new Error(data?.message || "ไม่สามารถโหลดข้อมูลสลิป");
      }

      if (data.pagination) {
        setTotalPages(data.pagination.totalPages);
        setTotalItems(data.pagination.total);
      }

      const normalized: PaymentSlip[] = Array.isArray(data.data)
        ? data.data.map((item: any) => {
          const apiUrl =
            typeof item.url === "string" && item.url.length > 0
              ? item.url
              : undefined;
          const fallbackName = item.file_name
            ? String(item.file_name)
            : apiUrl
              ? apiUrl.split("/").pop() || `slip_${item.id}`
              : `slip_${item.id}`;
          const statusValue =
            item.status === "verified" || item.status === "rejected" || item.status === "preapproved" || item.status === "approved"
              ? item.status
              : "pending";
          const fileExists = Boolean(
            item.file_exists ?? item.fileExists ?? apiUrl,
          );
          return {
            id: String(item.id),
            name: fallbackName,
            url: fileExists ? apiUrl : undefined,
            uploadedAt:
              item.uploaded_at || item.created_at || new Date().toISOString(),
            status: statusValue,
            uploadedBy: item.uploaded_by || undefined,
            customerName: item.customer_name || undefined,
            customerPhone: item.customer_phone || undefined,
            amount:
              typeof item.amount === "number"
                ? item.amount
                : item.amount
                  ? Number(item.amount)
                  : undefined,
            orderTotal:
              typeof item.order_total === "number"
                ? item.order_total
                : item.order_total
                  ? Number(item.order_total)
                  : undefined,
            notes: item.notes || undefined,
            orderId: item.order_id ? String(item.order_id) : undefined,
            bankName: item.bank_name || undefined,
            bankNumber: item.bank_number || undefined,
            transferDate: item.transfer_date || undefined,
            fileExists,
            originalUrl: item.original_url || apiUrl,
            paymentMethod: item.payment_method || undefined,
          };
        })
        : [];

      setSlips(normalized);

      // Group slips by orderId
      const groups: { [key: string]: OrderSlipGroup } = {};
      const unlinkedSlips: PaymentSlip[] = [];

      normalized.forEach(slip => {
        if (slip.orderId) {
          if (!groups[slip.orderId]) {
            groups[slip.orderId] = {
              orderId: slip.orderId,
              customerName: slip.customerName,
              amount: slip.amount || slip.orderTotal, // Use slip amount or order total
              orderTotal: slip.orderTotal,
              slips: [],
              latestUpload: slip.uploadedAt,
              status: slip.status,
              paymentMethod: slip.paymentMethod,
            };
          }
          groups[slip.orderId].slips.push(slip);

          // Update group info if needed (e.g., latest upload time)
          if (new Date(slip.uploadedAt) > new Date(groups[slip.orderId].latestUpload)) {
            groups[slip.orderId].latestUpload = slip.uploadedAt;
          }

          // Update status logic: if any is pending, group is pending. If all verified, verified.
          // This is a simple aggregation, adjust as per business rules.
          if (groups[slip.orderId].status !== 'pending' && slip.status === 'pending') {
            groups[slip.orderId].status = 'pending';
          }
        } else {
          unlinkedSlips.push(slip);
        }
      });

      // Convert groups map to array and sort by latest upload
      const groupArray = Object.values(groups).sort((a, b) =>
        new Date(b.latestUpload).getTime() - new Date(a.latestUpload).getTime()
      );

      // For unlinked slips, we can treat them as individual groups or handle separately.
      // For now, let's add them as individual groups with a unique ID or just display them.
      // To keep it simple and consistent with the request "show orders with slips", 
      // we might focus on grouped orders. But to not lose data, let's add unlinked ones too.
      unlinkedSlips.forEach(slip => {
        groupArray.push({
          orderId: `unlinked-${slip.id}`,
          customerName: slip.customerName || 'ไม่ระบุลูกค้า',
          amount: slip.amount,
          orderTotal: slip.orderTotal,
          slips: [slip],
          latestUpload: slip.uploadedAt,
          status: slip.status,
          paymentMethod: slip.paymentMethod,
        });
      });

      // Re-sort to include unlinked slips in the timeline
      groupArray.sort((a, b) =>
        new Date(b.latestUpload).getTime() - new Date(a.latestUpload).getTime()
      );

      setOrderGroups(groupArray);

    } catch (err) {
      console.error("Failed to load slips:", err);
      setError(
        err instanceof Error
          ? err.message
          : "เกิดข้อผิดพลาดระหว่างโหลดข้อมูลสลิป",
      );
      setSlips([]);
      setOrderGroups([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchTerm, statusFilter, dateFilter, paymentMethodFilter]); // Added dependencies

  useEffect(() => {
    loadSlips();

    // Fetch payment methods
    const fetchPaymentMethods = async () => {
      try {
        const sessionUser = localStorage.getItem("sessionUser");
        if (sessionUser) {
          const parsed = JSON.parse(sessionUser);
          if (parsed.company_id) {
            const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
            const headers: any = {};
            if (token) headers["Authorization"] = `Bearer ${token}`;

            const res = await fetch(
              `${apiBase}/Slip_DB/get_payment_methods.php?company_id=${parsed.company_id}`,
              { headers }
            );
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
              setPaymentMethods(data.data);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch payment methods:", err);
      }
    };
    fetchPaymentMethods();
  }, [loadSlips]);

  // Client-side filtering is replaced by Server-side filtering in loadSlips
  const filteredGroups = orderGroups;

  const getStatusIcon = (status: PaymentSlip["status"]) => {
    switch (status) {
      case "approved":
      case "verified":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "rejected":
        return <X className="w-5 h-5 text-red-600" />;
      case "preapproved":
        return <AlertCircle className="w-5 h-5 text-blue-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusText = (status: PaymentSlip["status"]) => {
    switch (status) {
      case "approved":
      case "verified":
        return "ยืนยันแล้ว";
      case "rejected":
        return "ยกเลิก";
      case "preapproved":
        return "รอตรวจสอบจากบัญชี";
      default:
        return "รอตรวจสอบ";
    }
  };

  const getStatusColor = (status: PaymentSlip["status"]) => {
    switch (status) {
      case "approved":
      case "verified":
        return "bg-green-100 text-green-800 border-green-200";
      case "rejected":
        return "bg-red-100 text-red-800 border-red-200";
      case "preapproved":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handlePreview = (group: OrderSlipGroup) => {
    setSelectedGroup(group);
    setCurrentImageIndex(0);
    setShowPreview(true);
  };

  const handleNextImage = () => {
    if (selectedGroup && currentImageIndex < selectedGroup.slips.length - 1) {
      setCurrentImageIndex(prev => prev + 1);
    }
  };

  const handlePrevImage = () => {
    if (selectedGroup && currentImageIndex > 0) {
      setCurrentImageIndex(prev => prev - 1);
    }
  };

  const handleExport = () => {
    // Simulate export functionality
    const csvContent = [
      [
        "Order ID",
        "ชื่อไฟล์",
        "สถานะ",
        "ลูกค้า",
        "จำนวนเงิน",
        "วันที่อัปโหลด",
        "ผู้อัปโหลด",
      ],
      ...filteredGroups.flatMap(group => group.slips.map((slip) => [
        slip.orderId || "-",
        slip.name,
        getStatusText(slip.status),
        slip.customerName || "",
        slip.amount || "",
        formatDate(slip.uploadedAt),
        slip.uploadedBy || "",
      ])),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `payment_slips_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">สลิปทั้งหมด</h1>
              <p className="text-gray-600">
                ดูและจัดการสลิปการโอนเงินทั้งหมดในระบบ
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadSlips}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              รีเฟรช
            </button>
            <button
              onClick={handleExport}
              disabled={filteredGroups.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="w-4 h-4" />
              ส่งออก
            </button>
          </div>
        </div>
      </div>
      {error && (
        <div className="mb-6 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="ค้นหาตามชื่อไฟล์, ลูกค้า, ผู้อัปโหลด..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">สถานะทั้งหมด</option>
              <option value="pending">รอตรวจสอบ</option>
              <option value="preapproved">รอตรวจสอบจากบัญชี</option>
              <option value="approved">ยืนยันแล้ว</option>
              <option value="rejected">ยกเลิก</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">ทุกช่วงเวลา</option>
              <option value="today">วันนี้</option>
              <option value="week">7 วันล่าสุด</option>
              <option value="month">30 วันล่าสุด</option>
            </select>
          </div>

          {/* Payment Method Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">ทุกช่องทางชำระ</option>
              {paymentMethods.map(method => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600 flex justify-between items-center">
          <div>
            พบ {totalItems} รายการ (หน้า {currentPage} จาก {totalPages})
          </div>
        </div>
      </div>

      {/* Slips List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-2" />
            <span className="text-gray-600">กำลังโหลดข้อมูล...</span>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">ไม่พบข้อมูลสลิป</p>
            <p className="text-sm text-gray-500 mt-2">
              ลองปรับเปลี่ยนเงื่อนไขการค้นหา
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    รายการคำสั่งซื้อ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ลูกค้า
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ช่องทางชำระ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    จำนวนเงิน
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    จำนวนรูป
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    สถานะ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    วันที่อัปโหลดล่าสุด
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    การจัดการ
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredGroups.map((group) => (
                  <tr key={group.orderId} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 border border-gray-200 rounded-lg overflow-hidden flex items-center justify-center bg-gray-50 relative">
                          {group.slips[0]?.url ? (
                            <img
                              src={toAbsoluteApiUrl(group.slips[0].url)}
                              alt="Slip preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-[10px] text-gray-500 text-center px-1 leading-tight">
                              ไม่มีไฟล์
                            </span>
                          )}
                          {group.slips.length > 1 && (
                            <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center text-white text-xs font-bold">
                              +{group.slips.length - 1}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {group.orderId.startsWith('unlinked') ? (
                              'ไม่มี Order ID'
                            ) : (
                              <button
                                onClick={() => setViewingOrderId(group.orderId)}
                                className="text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                #{group.orderId}
                              </button>
                            )}
                          </div>
                          {group.slips.length > 1 && (
                            <div className="text-xs text-gray-500">
                              {group.slips.length} รูปภาพ
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {group.customerName || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {group.paymentMethod || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {group.amount
                          ? `฿${group.amount.toLocaleString()}`
                          : group.orderTotal
                            ? `฿${group.orderTotal.toLocaleString()}`
                            : "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {group.slips.length}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(group.status)}
                        <span
                          className={`text-sm px-2 py-1 rounded-full ${getStatusColor(group.status)}`}
                        >
                          {getStatusText(group.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {formatDate(group.latestUpload)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handlePreview(group)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        ดูรายละเอียด
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      <div className="mt-4 flex items-center justify-between bg-white px-4 py-3 border border-gray-200 rounded-lg shadow-sm">
        <div className="flex-1 flex justify-between sm:hidden">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
          >
            ก่อนหน้า
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
          >
            ถัดไป
          </button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              แสดง <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> ถึง <span className="font-medium">{Math.min(currentPage * pageSize, totalItems)}</span> จาก <span className="font-medium">{totalItems}</span> รายการ
            </p>
          </div>
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
              >
                <span className="sr-only">ก่อนหน้า</span>
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>

              <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                หน้า {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
              >
                <span className="sr-only">ถัดไป</span>
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  รายละเอียดสลิป - {selectedGroup.orderId.startsWith('unlinked') ? 'ไม่มี Order ID' : `#${selectedGroup.orderId}`}
                </h2>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Image Gallery */}
                <div className="lg:col-span-2">
                  <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-[4/3] flex items-center justify-center mb-4">
                    {selectedGroup.slips[currentImageIndex]?.url ? (
                      <img
                        src={toAbsoluteApiUrl(selectedGroup.slips[currentImageIndex].url)}
                        alt={`Slip ${currentImageIndex + 1}`}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center text-gray-400">
                        <Image className="w-12 h-12 mb-2" />
                        <span>ไม่พบรูปภาพ</span>
                      </div>
                    )}

                    {/* Navigation Buttons */}
                    {selectedGroup.slips.length > 1 && (
                      <>
                        <button
                          onClick={handlePrevImage}
                          disabled={currentImageIndex === 0}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                          <ChevronLeft className="w-6 h-6" />
                        </button>
                        <button
                          onClick={handleNextImage}
                          disabled={currentImageIndex === selectedGroup.slips.length - 1}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                          <ChevronRight className="w-6 h-6" />
                        </button>
                      </>
                    )}

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
                      {currentImageIndex + 1} / {selectedGroup.slips.length}
                    </div>
                  </div>

                  {/* Thumbnails */}
                  {selectedGroup.slips.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {selectedGroup.slips.map((slip, index) => (
                        <button
                          key={slip.id}
                          onClick={() => setCurrentImageIndex(index)}
                          className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${currentImageIndex === index ? "border-blue-500 ring-2 ring-blue-200" : "border-transparent opacity-70 hover:opacity-100"
                            }`}
                        >
                          {slip.url ? (
                            <img
                              src={toAbsoluteApiUrl(slip.url)}
                              alt={`Thumbnail ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                              <Image className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Details Side Panel */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      ข้อมูลสลิปปัจจุบัน
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          ชื่อไฟล์
                        </label>
                        <p className="text-gray-900 break-all">
                          {selectedGroup.slips[currentImageIndex]?.name}
                        </p>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          จำนวนเงิน
                        </label>
                        <p className="text-lg font-semibold text-gray-900">
                          {selectedGroup.slips[currentImageIndex]?.amount
                            ? `฿${selectedGroup.slips[currentImageIndex].amount?.toLocaleString()}`
                            : "-"}
                        </p>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          วันที่โอน
                        </label>
                        <p className="text-gray-900">
                          {selectedGroup.slips[currentImageIndex]?.transferDate
                            ? formatDate(selectedGroup.slips[currentImageIndex].transferDate!)
                            : "-"}
                        </p>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          ธนาคาร
                        </label>
                        <p className="text-gray-900">
                          {selectedGroup.slips[currentImageIndex]?.bankName || "-"}
                          {selectedGroup.slips[currentImageIndex]?.bankNumber && ` (${selectedGroup.slips[currentImageIndex].bankNumber})`}
                        </p>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          สถานะ
                        </label>
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusIcon(selectedGroup.slips[currentImageIndex]?.status)}
                          <span
                            className={`text-sm px-2 py-1 rounded-full ${getStatusColor(selectedGroup.slips[currentImageIndex]?.status)}`}
                          >
                            {getStatusText(selectedGroup.slips[currentImageIndex]?.status)}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          ผู้อัปโหลด
                        </label>
                        <p className="text-gray-900">
                          {selectedGroup.slips[currentImageIndex]?.uploadedBy || "-"}
                        </p>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          วันที่อัปโหลด
                        </label>
                        <p className="text-gray-900">
                          {formatDate(selectedGroup.slips[currentImageIndex]?.uploadedAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      ข้อมูลคำสั่งซื้อ
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          ชื่อลูกค้า
                        </label>
                        <p className="text-gray-900">
                          {selectedGroup.customerName || "-"}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          ยอดรวมคำสั่งซื้อ
                        </label>
                        <p className="text-gray-900 font-medium">
                          {selectedGroup.orderTotal ? `฿${selectedGroup.orderTotal.toLocaleString()}` : "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewingOrderId && (
        <OrderDetailModal
          isOpen={!!viewingOrderId}
          orderId={viewingOrderId}
          onClose={() => setViewingOrderId(null)}
        />
      )}
    </div>
  );
};

export default SlipAll;
