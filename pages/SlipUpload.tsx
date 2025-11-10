import React, { useState, useEffect } from "react";
import { AlertCircle, CheckCircle, FileText } from "lucide-react";

interface Order {
  id: number;
  order_date: string;
  delivery_date: string;
  total_amount: number;
  first_name: string;
  last_name: string;
  phone: string;
  full_name: string;
  payment_status: string;
}

interface PaginationInfo {
  totalCount: number;
  currentPage: number;
  pageSize: number;
  maxPage: number;
}

interface FilterOptions {
  order_id: string;
  customer_name: string;
  phone: string;
  sale_month: string;
  sale_year: string;
}

interface BankAccount {
  id: number;
  bank: string;
  bank_number: string;
  is_active: boolean;
  display_name: string;
  created_at: string;
  updated_at: string;
}

interface SlipFormData {
  order_id: string;
  amount: string;
  bank_account_id: string;
  transfer_date: string;
}

const SlipUpload: React.FC = () => {
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo>({
    totalCount: 0,
    currentPage: 1,
    pageSize: 10,
    maxPage: 1,
  });
  const [filters, setFilters] = useState<FilterOptions>({
    order_id: "",
    customer_name: "",
    phone: "",
    sale_month: "",
    sale_year: "",
  });

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loadingBankAccounts, setLoadingBankAccounts] = useState(false);
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [slipFormData, setSlipFormData] = useState<SlipFormData>({
    order_id: "",
    amount: "",
    bank_account_id: "",
    transfer_date: "",
  });
  const [uploadingSlip, setUploadingSlip] = useState(false);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const fetchBankAccounts = async () => {
    setLoadingBankAccounts(true);
    try {
      const sessionUser = localStorage.getItem("sessionUser");
      if (!sessionUser) {
        showMessage("error", "ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่");
        setLoadingBankAccounts(false);
        return;
      }

      const user = JSON.parse(sessionUser);
      const companyId = user.company_id;

      if (!companyId) {
        showMessage("error", "ไม่พบข้อมูลบริษัท กรุณาติดต่อผู้ดูแลระบบ");
        setLoadingBankAccounts(false);
        return;
      }

      const response = await fetch(
        `/api/Bank_DB/get_bank_accounts.php?company_id=${companyId}`,
      );
      const data = await response.json();

      if (data.success) {
        setBankAccounts(data.data);
      } else {
        showMessage(
          "error",
          data.message || "ไม่สามารถดึงข้อมูลบัญชีธนาคารได้",
        );
      }
    } catch (error) {
      console.error("Error fetching bank accounts:", error);
      showMessage("error", "เกิดข้อผิดพลาดในการดึงข้อมูลบัญชีธนาคาร");
    } finally {
      setLoadingBankAccounts(false);
    }
  };

  const handleAddSlip = (order: Order) => {
    setSelectedOrder(order);
    setSlipFormData({
      order_id: order.id.toString(),
      amount: order.total_amount.toString(),
      bank_account_id: "",
      transfer_date: "",
    });
    setShowSlipModal(true);
    if (bankAccounts.length === 0) {
      fetchBankAccounts();
    }
  };

  const handleSlipFormChange = (field: keyof SlipFormData, value: string) => {
    setSlipFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSlipSubmit = async () => {
    if (
      !slipFormData.amount ||
      !slipFormData.bank_account_id ||
      !slipFormData.transfer_date
    ) {
      showMessage("error", "กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    setUploadingSlip(true);
    try {
      const sessionUser = localStorage.getItem("sessionUser");
      if (!sessionUser) {
        showMessage("error", "ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่");
        setUploadingSlip(false);
        return;
      }

      const user = JSON.parse(sessionUser);
      const companyId = user.company_id;

      // Insert the order slip record directly
      const slipData = {
        order_id: slipFormData.order_id,
        amount: parseInt(slipFormData.amount),
        bank_account_id: parseInt(slipFormData.bank_account_id),
        transfer_date: slipFormData.transfer_date,
        company_id: companyId,
      };

      const insertResponse = await fetch("/api/Slip_DB/insert_order_slip.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(slipData),
      });

      const insertResult = await insertResponse.json();

      if (insertResult.success) {
        showMessage("success", "บันทึกข้อมูลสลิปเรียบร้อยแล้ว");
        setShowSlipModal(false);
        fetchOrders(); // Refresh the orders list
      } else {
        showMessage(
          "error",
          insertResult.message || "ไม่สามารถบันทึกข้อมูลสลิปได้",
        );
      }
    } catch (error) {
      console.error("Error submitting slip:", error);
      showMessage("error", "เกิดข้อผิดพลาดในการบันทึกข้อมูลสลิป");
    } finally {
      setUploadingSlip(false);
    }
  };

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      // Get company_id from localStorage
      const sessionUser = localStorage.getItem("sessionUser");
      if (!sessionUser) {
        showMessage("error", "ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่");
        setLoadingOrders(false);
        return;
      }

      const user = JSON.parse(sessionUser);
      const companyId = user.company_id;

      if (!companyId) {
        showMessage("error", "ไม่พบข้อมูลบริษัท กรุณาติดต่อผู้ดูแลระบบ");
        setLoadingOrders(false);
        return;
      }

      // Build query string with filters
      const queryParams = new URLSearchParams({
        company_id: companyId.toString(),
        page: pagination.currentPage.toString(),
        pageSize: pagination.pageSize.toString(),
      });

      // Add filters to query if they have values
      if (filters.order_id) queryParams.append("order_id", filters.order_id);
      if (filters.customer_name)
        queryParams.append("customer_name", filters.customer_name);
      if (filters.phone) queryParams.append("phone", filters.phone);
      if (filters.sale_month)
        queryParams.append("sale_month", filters.sale_month);
      if (filters.sale_year) queryParams.append("sale_year", filters.sale_year);

      const response = await fetch(
        `/api/Slip_DB/get_transfer_orders.php?${queryParams.toString()}`,
      );
      const data = await response.json();

      if (data.success) {
        setOrders(data.data);
        setPagination({
          totalCount: data.totalCount,
          currentPage: data.currentPage,
          pageSize: data.pageSize,
          maxPage: data.maxPage,
        });

        // Reset to first page if filters change and currentPage > maxPage
        if (data.currentPage > data.maxPage && data.maxPage > 0) {
          setPagination((prev) => ({ ...prev, currentPage: 1 }));
          fetchOrders();
          return;
        }
        if (data.count === 0) {
          showMessage(
            "error",
            "ไม่พบรายการคำสั่งซื้อที่ต้องชำระเงินผ่านการโอน",
          );
        }
      } else {
        showMessage("error", data.message || "ไม่สามารถดึงข้อมูลคำสั่งซื้อได้");
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
      showMessage("error", "เกิดข้อผิดพลาดในการดึงข้อมูลคำสั่งซื้อ");
    } finally {
      setLoadingOrders(false);
    }
  };

  // Fetch bank accounts on component mount
  useEffect(() => {
    fetchBankAccounts();
  }, []);

  // Fetch orders on component mount and when pagination or filters change
  useEffect(() => {
    fetchOrders();
  }, [pagination.currentPage, pagination.pageSize, filters]); // Re-fetch when pagination or filters change

  const handleFilterChange = (field: keyof FilterOptions, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({
      order_id: "",
      customer_name: "",
      phone: "",
      sale_month: "",
      sale_year: "",
    });
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  };

  const applyFilters = () => {
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.maxPage) {
      setPagination((prev) => ({ ...prev, currentPage: newPage }));
    }
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPagination((prev) => ({
      ...prev,
      pageSize: newPageSize,
      currentPage: 1, // Reset to first page when changing page size
    }));
  };

  const renderPagination = () => {
    const { currentPage, pageSize, totalCount, maxPage } = pagination;
    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalCount);

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t border-gray-200">
        {/* Page info */}
        <div className="text-sm text-gray-700">
          แสดง {startItem}-{endItem} จากทั้งหมด{" "}
          {totalCount.toLocaleString("th-TH")} รายการ
        </div>

        {/* Page size selector */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-700">แสดง:</span>
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <span className="text-gray-700">รายการ</span>
        </div>

        {/* Pagination buttons */}
        <div className="flex items-center gap-1">
          {/* First page */}
          <button
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            หน้าแรก
          </button>

          {/* Previous page */}
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ก่อนหน้า
          </button>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {(() => {
              const pages = [];
              const maxVisible = 5;
              let startPage = Math.max(
                1,
                currentPage - Math.floor(maxVisible / 2),
              );
              let endPage = Math.min(maxPage, startPage + maxVisible - 1);

              if (endPage - startPage + 1 < maxVisible) {
                startPage = Math.max(1, endPage - maxVisible + 1);
              }

              for (let i = startPage; i <= endPage; i++) {
                pages.push(
                  <button
                    key={i}
                    onClick={() => handlePageChange(i)}
                    className={`px-3 py-1 text-sm border rounded ${
                      i === currentPage
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {i}
                  </button>,
                );
              }
              return pages;
            })()}
          </div>

          {/* Next page */}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === maxPage}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ถัดไป
          </button>

          {/* Last page */}
          <button
            onClick={() => handlePageChange(maxPage)}
            disabled={currentPage === maxPage}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            หน้าสุดท้าย
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-lg">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              รายการคำสั่งซื้อที่ต้องชำระเงินผ่านการโอน
            </h1>
            <p className="text-gray-600">
              แสดงรายการคำสั่งซื้อที่ต้องชำระเงินผ่านการโอนเงิน
            </p>
          </div>
        </div>
      </div>

      {/* Alert Message */}
      {message && (
        <div
          className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${
            message.type === "success"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          {message.text}
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        {/* Orders Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              รายการคำสั่งซื้อที่ต้องชำระเงินผ่านการโอน
            </h2>
            <button
              onClick={fetchOrders}
              disabled={loadingOrders}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {loadingOrders ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  กำลังโหลด...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  รีเฟรชข้อมูล
                </>
              )}
            </button>
          </div>

          {/* Filters Section */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-4">
              ค้นหาข้อมูล
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {/* Order ID Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  รหัสคำสั่งซื้อ
                </label>
                <input
                  type="text"
                  value={filters.order_id}
                  onChange={(e) =>
                    handleFilterChange("order_id", e.target.value)
                  }
                  placeholder="รหัสคำสั่งซื้อ"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Customer Name Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  ชื่อลูกค้า
                </label>
                <input
                  type="text"
                  value={filters.customer_name}
                  onChange={(e) =>
                    handleFilterChange("customer_name", e.target.value)
                  }
                  placeholder="ชื่อลูกค้า"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Phone Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  เบอร์โทร
                </label>
                <input
                  type="text"
                  value={filters.phone}
                  onChange={(e) => handleFilterChange("phone", e.target.value)}
                  placeholder="เบอร์โทร"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Sale Month Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  เดือนที่ขาย
                </label>
                <select
                  value={filters.sale_month}
                  onChange={(e) =>
                    handleFilterChange("sale_month", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">เลือกเดือน</option>
                  <option value="1">มกราคม</option>
                  <option value="2">กุมภาพันธ์</option>
                  <option value="3">มีนาคม</option>
                  <option value="4">เมษายน</option>
                  <option value="5">พฤษภาคม</option>
                  <option value="6">มิถุนายน</option>
                  <option value="7">กรกฎาคม</option>
                  <option value="8">สิงหาคม</option>
                  <option value="9">กันยายน</option>
                  <option value="10">ตุลาคม</option>
                  <option value="11">พฤศจิกายน</option>
                  <option value="12">ธันวาคม</option>
                </select>
              </div>

              {/* Sale Year Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  ปีที่ขาย
                </label>
                <select
                  value={filters.sale_year}
                  onChange={(e) =>
                    handleFilterChange("sale_year", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">เลือกปี</option>
                  {(() => {
                    const currentYear = new Date().getFullYear();
                    const years = [];
                    for (
                      let year = currentYear;
                      year >= currentYear - 5;
                      year--
                    ) {
                      years.push(
                        <option key={year} value={year}>
                          {year + 543} {/* Thai Buddhist year */}
                        </option>,
                      );
                    }
                    return years;
                  })()}
                </select>
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={applyFilters}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
              >
                <CheckCircle className="w-4 h-4" />
                ค้นหา
              </button>
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm"
              >
                <AlertCircle className="w-4 h-4" />
                ล้างตัวกรอง
              </button>
            </div>
          </div>

          {loadingOrders && orders.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-900">
                      วันที่สั่งซื้อ
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">
                      วันที่ส่ง
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">
                      รหัสคำสั่งซื้อ
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">
                      ชื่อลูกค้า
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">
                      เบอร์โทร
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-900">
                      ยอดเงิน
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">
                      สถานะ
                    </th>
                    <th className="text-center py-3 px-4 font-medium text-gray-900">
                      เพิ่มสลิป
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {order.order_date
                          ? new Date(order.order_date).toLocaleDateString(
                              "th-TH",
                            )
                          : "-"}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {order.delivery_date
                          ? new Date(order.delivery_date).toLocaleDateString(
                              "th-TH",
                            )
                          : "-"}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">
                        #{order.id}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {order.full_name || "-"}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {order.phone || "-"}
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-medium text-gray-900">
                        ฿
                        {order.total_amount.toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            order.payment_status === "จ่ายแล้ว"
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {order.payment_status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-center">
                        {order.payment_status === "ค้างจ่าย" ? (
                          <button
                            onClick={() => handleAddSlip(order)}
                            className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                          >
                            เพิ่มสลิป
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                ไม่พบรายการคำสั่งซื้อที่ต้องชำระเงินผ่านการโอน
              </p>
            </div>
          )}

          {/* Pagination */}
          {orders.length > 0 && renderPagination()}
        </div>
      </div>

      {/* Add Slip Modal */}
      {showSlipModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                เพิ่มสลิปการโอนเงิน
              </h3>

              <div className="space-y-4">
                {/* Order Info */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">
                    รหัสคำสั่งซื้อ:{" "}
                    <span className="font-medium text-gray-900">
                      #{selectedOrder.id}
                    </span>
                  </p>
                  <p className="text-sm text-gray-600">
                    ยอดเงิน:{" "}
                    <span className="font-medium text-gray-900">
                      ฿
                      {selectedOrder.total_amount.toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </p>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    จำนวนเงินที่โอน *
                  </label>
                  <input
                    type="number"
                    value={slipFormData.amount}
                    onChange={(e) =>
                      handleSlipFormChange("amount", e.target.value)
                    }
                    placeholder="กรอกจำนวนเงินที่โอน"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Bank Account */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    บัญชีธนาคารที่รับเงินโอน *
                  </label>
                  {loadingBankAccounts ? (
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm">
                      กำลังโหลดข้อมูลบัญชี...
                    </div>
                  ) : bankAccounts.length > 0 ? (
                    <select
                      value={slipFormData.bank_account_id}
                      onChange={(e) =>
                        handleSlipFormChange("bank_account_id", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">เลือกบัญชีธนาคาร</option>
                      {bankAccounts.map((bank) => (
                        <option key={bank.id} value={bank.id}>
                          {bank.display_name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm text-red-600">
                      ไม่พบบัญชีธนาคาร
                    </div>
                  )}
                </div>

                {/* Transfer Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    วันที่โอนเงิน *
                  </label>
                  <input
                    type="datetime-local"
                    value={slipFormData.transfer_date}
                    onChange={(e) =>
                      handleSlipFormChange("transfer_date", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowSlipModal(false)}
                  disabled={uploadingSlip}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSlipSubmit}
                  disabled={uploadingSlip}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingSlip ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block mr-2" />
                      กำลังบันทึก...
                    </>
                  ) : (
                    "บันทึกสลิป"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlipUpload;
