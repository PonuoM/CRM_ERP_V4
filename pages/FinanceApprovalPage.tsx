import React, { useState, useMemo } from "react";
import { User, Order, PaymentMethod, PaymentStatus, OrderStatus } from "../types";
import { CheckCircle, XCircle, FileText, Search, Filter } from "lucide-react";
import OrderTable from "../components/OrderTable";
import { patchOrder } from "../services/api";

interface FinanceApprovalPageProps {
  user: User;
  orders: Order[];
  customers: any[];
  users: User[];
  openModal: (type: any, data: Order) => void;
}

const FinanceApprovalPage: React.FC<FinanceApprovalPageProps> = ({
  user,
  orders,
  customers,
  users,
  openModal,
}) => {
  const [activeTab, setActiveTab] = useState<"slips" | "transfers" | "payafter">("slips");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<PaymentStatus | "">("");

  // Filter orders based on tab and payment method
  const filteredOrders = useMemo(() => {
    let filtered = orders;

    // Filter by tab (payment method)
    if (activeTab === "slips") {
      // Orders with slips that need approval (Verified status)
      filtered = filtered.filter(
        (o) =>
          o.paymentMethod === PaymentMethod.Transfer &&
          (o.paymentStatus === PaymentStatus.Verified ||
            o.paymentStatus === PaymentStatus.PreApproved)
      );
    } else if (activeTab === "transfers") {
      // Transfer orders that need final approval (PreApproved status)
      filtered = filtered.filter(
        (o) =>
          o.paymentMethod === PaymentMethod.Transfer &&
          o.paymentStatus === PaymentStatus.PreApproved
      );
    } else if (activeTab === "payafter") {
      // PayAfter orders that need approval
      filtered = filtered.filter(
        (o) =>
          o.paymentMethod === PaymentMethod.PayAfter &&
          (o.paymentStatus === PaymentStatus.PreApproved ||
            o.orderStatus === OrderStatus.Delivered)
      );
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.id.toLowerCase().includes(term) ||
          customers
            .find((c) => c.id === o.customerId)
            ?.firstName?.toLowerCase()
            .includes(term) ||
          customers
            .find((c) => c.id === o.customerId)
            ?.lastName?.toLowerCase()
            .includes(term)
      );
    }

    // Filter by payment status
    if (filterPaymentStatus) {
      filtered = filtered.filter((o) => o.paymentStatus === filterPaymentStatus);
    }

    return filtered;
  }, [orders, activeTab, searchTerm, filterPaymentStatus, customers]);

  const handleApproveSlips = async () => {
    if (selectedIds.length === 0) return;

    if (
      !window.confirm(
        `คุณต้องการ Approve สลิปของออเดอร์ ${selectedIds.length} รายการใช่หรือไม่?`
      )
    ) {
      return;
    }

    try {
      const updates = selectedIds.map((id) => ({
        id,
        paymentStatus: PaymentStatus.PreApproved,
      }));

      await Promise.all(
        updates.map((update) =>
          patchOrder(update.id, {
            paymentStatus: update.paymentStatus,
          })
        )
      );

      alert(`Approve สลิปเรียบร้อยแล้ว ${selectedIds.length} รายการ`);
      setSelectedIds([]);
      // Refresh page or update orders
      window.location.reload();
    } catch (error) {
      console.error("Error approving slips:", error);
      alert("เกิดข้อผิดพลาดในการ Approve สลิป");
    }
  };

  const handleApproveTransfers = async () => {
    if (selectedIds.length === 0) return;

    if (
      !window.confirm(
        `คุณต้องการ Approve เงินโอนของออเดอร์ ${selectedIds.length} รายการใช่หรือไม่? ระบบจะตรวจสอบว่ามีเงินโอนเข้าจริง`
      )
    ) {
      return;
    }

    try {
      const updates = selectedIds.map((id) => ({
        id,
        paymentStatus: PaymentStatus.Approved,
        orderStatus: OrderStatus.Preparing, // เปลี่ยนสถานะเป็นกำลังจัดเตรียม
      }));

      await Promise.all(
        updates.map((update) =>
          patchOrder(update.id, {
            paymentStatus: update.paymentStatus,
            orderStatus: update.orderStatus,
          })
        )
      );

      alert(`Approve เงินโอนเรียบร้อยแล้ว ${selectedIds.length} รายการ`);
      setSelectedIds([]);
      window.location.reload();
    } catch (error) {
      console.error("Error approving transfers:", error);
      alert("เกิดข้อผิดพลาดในการ Approve เงินโอน");
    }
  };

  const handleApprovePayAfter = async () => {
    if (selectedIds.length === 0) return;

    if (
      !window.confirm(
        `คุณต้องการ Approve รับสินค้าก่อนของออเดอร์ ${selectedIds.length} รายการใช่หรือไม่? ระบบจะตรวจสอบว่ามีเงินโอนเข้าจริง`
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
          })
        )
      );

      alert(`Approve รับสินค้าก่อนเรียบร้อยแล้ว ${selectedIds.length} รายการ`);
      setSelectedIds([]);
      window.location.reload();
    } catch (error) {
      console.error("Error approving pay after:", error);
      alert("เกิดข้อผิดพลาดในการ Approve รับสินค้าก่อน");
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Finance Approval</h2>
          <p className="text-gray-600">ตรวจสอบและ Approve การชำระเงิน</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "slips" && (
            <button
              onClick={handleApproveSlips}
              disabled={selectedIds.length === 0}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle size={16} className="mr-2" />
              Approve สลิป ({selectedIds.length})
            </button>
          )}
          {activeTab === "transfers" && (
            <button
              onClick={handleApproveTransfers}
              disabled={selectedIds.length === 0}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle size={16} className="mr-2" />
              Approve เงินโอน ({selectedIds.length})
            </button>
          )}
          {activeTab === "payafter" && (
            <button
              onClick={handleApprovePayAfter}
              disabled={selectedIds.length === 0}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle size={16} className="mr-2" />
              Approve รับสินค้าก่อน ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => {
            setActiveTab("slips");
            setSelectedIds([]);
          }}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "slips"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <FileText size={16} />
          <span>Approve สลิป</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs ${
              activeTab === "slips"
                ? "bg-blue-100 text-blue-600"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {
              orders.filter(
                (o) =>
                  o.paymentMethod === PaymentMethod.Transfer &&
                  (o.paymentStatus === PaymentStatus.Verified ||
                    o.paymentStatus === PaymentStatus.PreApproved)
              ).length
            }
          </span>
        </button>
        <button
          onClick={() => {
            setActiveTab("transfers");
            setSelectedIds([]);
          }}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "transfers"
              ? "border-b-2 border-green-600 text-green-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <CheckCircle size={16} />
          <span>Approve เงินโอน</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs ${
              activeTab === "transfers"
                ? "bg-green-100 text-green-600"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {
              orders.filter(
                (o) =>
                  o.paymentMethod === PaymentMethod.Transfer &&
                  o.paymentStatus === PaymentStatus.PreApproved
              ).length
            }
          </span>
        </button>
        <button
          onClick={() => {
            setActiveTab("payafter");
            setSelectedIds([]);
          }}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "payafter"
              ? "border-b-2 border-purple-600 text-purple-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <FileText size={16} />
          <span>Approve รับสินค้าก่อน</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs ${
              activeTab === "payafter"
                ? "bg-purple-100 text-purple-600"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {
              orders.filter(
                (o) =>
                  o.paymentMethod === PaymentMethod.PayAfter &&
                  (o.paymentStatus === PaymentStatus.PreApproved ||
                    o.orderStatus === OrderStatus.Delivered)
              ).length
            }
          </span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="ค้นหาด้วยเลขออเดอร์หรือชื่อลูกค้า..."
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
                setFilterPaymentStatus(e.target.value as PaymentStatus | "")
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">สถานะการชำระทั้งหมด</option>
              <option value={PaymentStatus.Verified}>Verified</option>
              <option value={PaymentStatus.PreApproved}>Pre Approved</option>
              <option value={PaymentStatus.Approved}>Approved</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow">
        <OrderTable
          orders={filteredOrders}
          customers={customers}
          openModal={openModal}
          users={users}
          selectable={true}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      </div>
    </div>
  );
};

export default FinanceApprovalPage;

