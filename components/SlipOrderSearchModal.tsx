
import React, { useState, useEffect } from "react";
import { X, Search, Loader2 } from "lucide-react";
import { apiFetch } from "../services/api";
import { User } from "../types";
import resolveApiBasePath from "../utils/apiBasePath";
import DateRangePicker, { DateRange } from "./DateRangePicker";
import NumberRangePicker from "./NumberRangePicker";
import OrderDetailModal from "./OrderDetailModal";

interface SlipOrderSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectOrder: (orderId: string, orderAmount: number) => void;
    initialParams?: {
        date?: string;
        amount?: number;
        companyId: number;
    };
}

const SlipOrderSearchModal: React.FC<SlipOrderSearchModalProps> = ({
    isOpen,
    onClose,
    onSelectOrder,
    initialParams,
}) => {
    const [loading, setLoading] = useState(false);
    const [orders, setOrders] = useState<any[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    // Search Fields
    const [customerName, setCustomerName] = useState("");
    const [phone, setPhone] = useState("");

    // Amount Range
    const [amountRange, setAmountRange] = useState<{ min: string; max: string }>({ min: "", max: "" });

    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("all");

    const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && initialParams) {
            /*
      if (initialParams.date) {
        // User requested NOT to set default dates from statement
        // const dateStr = initialParams.date.split("T")[0];
        // setStartDate(dateStr);
        // setEndDate(dateStr);
      }
      */
            if (initialParams.amount) {
                // Pre-fill exact amount range
                setAmountRange({
                    min: initialParams.amount.toString(),
                    max: initialParams.amount.toString()
                });
            }
            // Trigger search immediately if params are present?
            // Maybe wait for user to confirm or adjust?
            // Let's trigger it.
            handleSearch(1);
        }
    }, [isOpen, initialParams]);

    const handleSearch = async (page: number = 1) => {
        if (!initialParams?.companyId) return;

        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append("company_id", initialParams.companyId.toString());
            params.append("page", page.toString());
            params.append("pageSize", pageSize.toString());

            if (customerName) params.append("customer_name", customerName);
            if (phone) params.append("phone", phone);

            // Send amount range
            if (amountRange.min) params.append("min_amount", amountRange.min);
            if (amountRange.max) params.append("max_amount", amountRange.max);

            if (startDate) params.append("start_date", startDate);
            if (endDate) params.append("end_date", endDate);
            // Check for "all" explicitly to match API behavior
            if (paymentMethod && paymentMethod !== 'all') params.append("payment_method", paymentMethod);
            else params.append("payment_method", "all");


            const apiBase = resolveApiBasePath();
            const res = await fetch(
                `${apiBase}/Slip_DB/get_transfer_orders.php?${params.toString()}`,
            );
            const data = await res.json();

            if (data.success) {
                setOrders(data.data);
                setTotalCount(data.totalCount);
                setCurrentPage(page);
            } else {
                setOrders([]);
                setTotalCount(0);
            }
        } catch (error) {
            console.error("Search failed", error);
        } finally {
            setLoading(false);
        }
    };

    const clearFilters = () => {
        setCustomerName("");
        setPhone("");
        setAmountRange({ min: "", max: "" });
        setStartDate("");
        setEndDate("");
        setPaymentMethod("all");
        setOrders([]);
        setTotalCount(0);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b">
                    <h2 className="text-xl font-semibold text-gray-800">
                        ค้นหาคำสั่งซื้อ (Search Orders)
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 focus:outline-none"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1">
                    {/* Search Form */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        {/* Customer Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                ชื่อลูกค้า
                            </label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border rounded-md text-sm"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder="ชื่อ หรือ นามสกุล"
                            />
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                เบอร์โทร
                            </label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border rounded-md text-sm"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="เบอร์โทรศัพท์"
                            />
                        </div>

                        {/* Payment Method */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                วิธีชำระ
                            </label>
                            <select
                                className="w-full px-3 py-2 border rounded-md text-sm"
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                            >
                                <option value="all">ทั้งหมด (All)</option>
                                <option value="Transfer">โอนเงิน (Transfer)</option>
                                <option value="cod">เก็บเงินปลายทาง (COD)</option>
                                <option value="PayAfter">รับสินค้าก่อน (PayAfter)</option>
                            </select>
                        </div>


                        {/* Date Range */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                ช่วงวันที่ (Date Range)
                            </label>
                            <div className="w-full">
                                <DateRangePicker
                                    value={{ start: startDate, end: endDate }}
                                    onApply={(range: DateRange) => {
                                        setStartDate(range.start);
                                        setEndDate(range.end);
                                    }}
                                />
                            </div>
                        </div>

                        {/* Amount Range */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                ช่วงจำนวนเงิน (Amount Range)
                            </label>
                            <NumberRangePicker
                                value={amountRange}
                                onChange={setAmountRange}
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-end justify-end gap-2">
                            <button
                                onClick={clearFilters}
                                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 text-sm h-[38px]"
                            >
                                ล้างค่า
                            </button>
                            <button
                                onClick={() => handleSearch(1)}
                                disabled={loading}
                                className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center text-sm h-[38px]"
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Search className="w-4 h-4 mr-2" />
                                )}
                                ค้นหา
                            </button>
                        </div>
                    </div>



                    {/* Results Table */}
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-700 font-semibold border-b">
                                <tr>
                                    <th className="px-4 py-3">Order ID</th>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Customer</th>
                                    <th className="px-4 py-3 text-right">Amount</th>
                                    <th className="px-4 py-3">Payment</th>
                                    <th className="px-4 py-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {orders.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                            {loading ? "กำลังค้นหา..." : "ไม่พบข้อมูล"}
                                        </td>
                                    </tr>
                                ) : (
                                    orders.map((order) => (
                                        <tr key={order.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 item-center">
                                                <button
                                                    onClick={() => setSelectedOrderForDetail(order.id)}
                                                    className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
                                                >
                                                    {order.id}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span>Order: {order.order_date.split(" ")[0]}</span>
                                                    {order.transfer_date ? (
                                                        <span className="text-xs text-green-600">
                                                            Transfer: {new Date(order.transfer_date).toLocaleDateString('th-TH')} {new Date(order.transfer_date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">-</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {order.first_name} {order.last_name}<br />
                                                <span className="text-gray-400 text-xs">{order.phone}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium">
                                                {new Intl.NumberFormat("th-TH", {
                                                    style: "currency",
                                                    currency: "THB",
                                                }).format(order.total_amount)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full w-fit ${order.payment_status_display === 'จ่ายแล้ว' ? 'bg-green-100 text-green-800' :
                                                        order.payment_status_display === 'จ่ายยังไม่ครบ' ? 'bg-yellow-100 text-yellow-800' :
                                                            'bg-red-100 text-red-800'
                                                        }`}>
                                                        {order.payment_status_display}
                                                    </span>
                                                    <span className="text-xs text-gray-500 mt-1">{order.payment_method}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => onSelectOrder(order.id, order.total_amount)}
                                                    className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700"
                                                >
                                                    เลือก
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalCount > pageSize && (
                        <div className="flex justify-between items-center mt-4">
                            <div className="text-sm text-gray-500">
                                แสดง {((currentPage - 1) * pageSize) + 1} ถึง {Math.min(currentPage * pageSize, totalCount)} จาก {totalCount} รายการ
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleSearch(currentPage - 1)}
                                    disabled={currentPage === 1 || loading}
                                    className="px-3 py-1 border rounded disabled:opacity-50"
                                >
                                    Previous
                                </button>
                                <span className="px-3 py-1 text-sm self-center">
                                    Page {currentPage}
                                </span>
                                <button
                                    onClick={() => handleSearch(currentPage + 1)}
                                    disabled={currentPage * pageSize >= totalCount || loading}
                                    className="px-3 py-1 border rounded disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Order Detail Modal */}
            <OrderDetailModal
                isOpen={!!selectedOrderForDetail}
                onClose={() => setSelectedOrderForDetail(null)}
                orderId={selectedOrderForDetail}
            />
        </div>
    );
};

export default SlipOrderSearchModal;
