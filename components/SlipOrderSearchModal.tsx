
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
        channel?: string;
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
    const [bankAccounts, setBankAccounts] = useState<any[]>([]);
    const [bankAccountId, setBankAccountId] = useState("all");

    useEffect(() => {
        if (isOpen && initialParams) {
            if (initialParams.amount) {
                // Pre-fill exact amount range
                setAmountRange({
                    min: initialParams.amount.toString(),
                    max: initialParams.amount.toString()
                });
            }

            // Fetch Bank Accounts
            const fetchBanks = async () => {
                try {
                    const apiBase = resolveApiBasePath();
                    const token = localStorage.getItem("authToken");
                    const headers: any = {};
                    if (token) headers["Authorization"] = `Bearer ${token}`;
                    const res = await fetch(`${apiBase}/Bank_DB/get_bank_accounts.php?company_id=${initialParams.companyId}`, { headers });
                    const data = await res.json();
                    if (data.success) {
                        setBankAccounts(data.data);
                    }
                } catch (err) {
                    console.error("Failed to fetch banks", err);
                }
            };
            fetchBanks();

            // Trigger search immediately
            handleSearch(1);
        }
    }, [isOpen, initialParams]);

    const handleSearch = async (page: number = 1) => {
        if (!initialParams?.companyId) return;

        setLoading(true);
        try {
            const params = new URLSearchParams();
            // Param mapping for list_company_slips.php
            // company_id is handled by session/auth in list_company_slips.php, but let's see if it needs it. 
            // Actually list_company_slips.php gets company_id from authenticated user session, not query param usually.
            // But let's check if the previous API used it. The previous one did.
            // list_company_slips.php: $company_id = $user['company_id']; -> It ignores the param and uses session!
            // BUT, for safety in this specific context (if user session matches), we can just call it.
            // Wait, does the internal API require auth token? Yes.
            // The frontend `apiFetch` or `fetch` with headers handles auth.

            params.append("page", page.toString());
            params.append("pageSize", pageSize.toString());

            if (customerName) params.append("search", customerName); // Changed to search
            // phone is not directly supported as separate param in list_company_slips, but 'search' covers phone too.
            // So we can append phone to search if customerName is empty, or combine them?
            // "search" in PHP covers: os.order_id, c.first_name, c.last_name, c.phone
            // So if user types in customerName input, it goes to 'search'.
            // If user types in phone input, we should ALSO put it in 'search' or handle it.
            // Since the UI has 2 separate fields but API has 1 'search', let's prioritize or combine.
            // For now, if phone is provided, use it as search if customerName is empty.
            if (!customerName && phone) {
                params.append("search", phone);
            } else if (customerName && phone) {
                // API only supports one search string usually. Let's just use customerName for now or concat?
                // list_company_slips checks: LIKE ? OR ... 
                // It doesn't support AND logic for separate fields easily without mod.
                // Let's us customerName as primary 'search'.
            }


            // Amount ranges - list_company_slips.php DOES NOT currently support min/max amount filtering in the code I viewed.
            // It filters by status, date, payment_method.
            // If amount filtering is critical, the backend might need simple update. 
            // For now, I will omit sending amount params if the backend doesn't read them, or send them just in case I missed it.
            // (The viewed code for list_company_slips.php did NOT have min_amount/max_amount checks).

            if (startDate) params.append("date_from", startDate);
            if (endDate) params.append("date_to", endDate);

            if (paymentMethod && paymentMethod !== 'all') params.append("payment_method", paymentMethod);
            if (bankAccountId && bankAccountId !== 'all') params.append("bank_account_id", bankAccountId);

            // Amount ranges
            if (amountRange.min) params.append("min_amount", amountRange.min);
            if (amountRange.max) params.append("max_amount", amountRange.max);

            // Filter out fully reconciled orders
            params.append("exclude_reconciled", "true");

            // Status filter? The modal doesn't have status filter UI, but maybe we want "verified" only? 
            // Or "pending"? The user said "show slipes". Usually 'pending' or 'all'? 
            // Let's default to 'all' or not send it (default in PHP is 'all').

            const apiBase = resolveApiBasePath();
            // Use apiFetch to ensure headers are sent (Authorization)
            // list_company_slips.php requires auth
            const token = localStorage.getItem("authToken");
            const headers: any = {};
            if (token) headers["Authorization"] = `Bearer ${token}`;

            const res = await fetch(
                `${apiBase}/Slip_DB/list_company_slips.php?${params.toString()}`,
                { headers }
            );
            const data = await res.json();

            if (data.success) {
                setOrders(data.data);
                // pagination in data.pagination
                if (data.pagination) {
                    setTotalCount(data.pagination.total);
                    setCurrentPage(data.pagination.page);
                } else {
                    setTotalCount(data.data.length);
                }
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
        setStartDate("");
        setEndDate("");
        setPaymentMethod("all");
        setBankAccountId("all");
        setOrders([]);
        setTotalCount(0);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b">
                    <h2 className="text-xl font-semibold text-gray-800">
                        ค้นหาข้อมูลสลิป (Search Slips)
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
                    {/* Statement Context Banner */}
                    {initialParams?.amount && (
                        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                            <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">📄 กำลังค้นหา Match สำหรับ Statement</div>
                            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                                <div>
                                    <span className="text-gray-500">ยอด: </span>
                                    <span className="font-bold text-gray-900">
                                        {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(initialParams.amount)}
                                    </span>
                                </div>
                                {initialParams.date && (
                                    <div>
                                        <span className="text-gray-500">วันเวลา: </span>
                                        <span className="font-medium text-gray-800">
                                            {new Date(initialParams.date).toLocaleString('th-TH')}
                                        </span>
                                    </div>
                                )}
                                {initialParams.channel && (
                                    <div>
                                        <span className="text-gray-500">ช่องทาง: </span>
                                        <span className="font-medium text-gray-800">{initialParams.channel}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {/* Search Form */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        {/* Search Term (Name/Phone/Order ID) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                ค้นหา (ชื่อ, เบอร์, Order ID)
                            </label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border rounded-md text-sm"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder="ระบุคำค้นหา..."
                            />
                        </div>

                        {/* Phone - Hidden or merged? Let's keep it but it acts as secondary search input if main is empty? 
                             Or maybe just remove it and tell user to use single search box?
                             Let's hide it for now to simplify, OR keep it and if filled, it overrides.
                         */}
                        {/* 
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                เบอร์โทร
                            </label>
                            <input
                                type="text" 
                                ...
                            />
                        </div>
                        */}

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




                        {/* Bank Account */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                ธนาคาร
                            </label>
                            <select
                                className="w-full px-3 py-2 border rounded-md text-sm"
                                value={bankAccountId}
                                onChange={(e) => setBankAccountId(e.target.value)}
                            >
                                <option value="all">ทั้งหมด (All)</option>
                                {bankAccounts.map((bank) => (
                                    <option key={bank.id} value={bank.id}>
                                        {bank.bank} {bank.bank_number} ({bank.display_name})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Amount Range */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                ช่วงราคา (Amount Range)
                            </label>
                            <NumberRangePicker
                                value={amountRange}
                                onChange={setAmountRange}
                                placeholder="ระบุช่วงราคา"
                            />
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

                        {/* Action Buttons */}
                        <div className="flex items-end justify-end gap-2 md:col-start-3">
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
                                    <th className="px-4 py-3">Slip Info</th>
                                    <th className="px-4 py-3">Order / Customer</th>
                                    <th className="px-4 py-3 text-right">Amount</th>
                                    <th className="px-4 py-3">Bank / Date</th>
                                    <th className="px-4 py-3 text-center">Status</th>
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
                                    orders.map((slip) => (
                                        <tr key={slip.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center space-x-3">
                                                    {(() => {
                                                        // Resolve the slip image URL properly
                                                        let imgUrl = '';
                                                        if (slip.url) {
                                                            if (slip.url.startsWith('http')) {
                                                                imgUrl = slip.url;
                                                            } else {
                                                                const apiBase = resolveApiBasePath().replace(/\/api$/, '');
                                                                const cleanPath = slip.url.startsWith('/') ? slip.url.slice(1) : slip.url;
                                                                imgUrl = `${apiBase}/${cleanPath}`;
                                                            }
                                                        }
                                                        return imgUrl ? (
                                                            <a href={imgUrl} target="_blank" rel="noopener noreferrer" className="block w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden border-2 border-blue-200 hover:border-blue-400 transition-colors shadow-sm">
                                                                <img
                                                                    src={imgUrl}
                                                                    alt="Slip"
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e) => {
                                                                        (e.target as HTMLImageElement).src = 'https://placehold.co/100?text=No+Img';
                                                                    }}
                                                                />
                                                            </a>
                                                        ) : (
                                                            <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-400 border">No Img</div>
                                                        );
                                                    })()}
                                                    <div>
                                                        <div className="font-medium text-gray-800">#{slip.id}</div>
                                                        <div className="text-xs text-gray-500">
                                                            {new Date(slip.uploaded_at).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => setSelectedOrderForDetail(slip.order_id)}
                                                    className="font-medium text-blue-600 hover:underline block"
                                                >
                                                    Order #{slip.order_id}
                                                </button>
                                                <div className="text-xs text-gray-600">
                                                    {slip.customer_name}<br />
                                                    {slip.customer_phone}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="font-medium text-gray-900">
                                                    {new Intl.NumberFormat("th-TH", {
                                                        style: "currency",
                                                        currency: "THB",
                                                    }).format(slip.amount || 0)}
                                                </div>
                                                {slip.order_total && (
                                                    <div className="text-xs text-gray-400">
                                                        Total: {new Intl.NumberFormat("th-TH").format(slip.order_total)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm text-gray-700">
                                                    {slip.bank_name ? `${slip.bank_name} ${slip.bank_number || ''}` : '-'}
                                                </div>
                                                {slip.transfer_date ? (
                                                    <div className="text-xs text-green-600">
                                                        {new Date(slip.transfer_date).toLocaleString('th-TH')}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium 
                                                    ${slip.status === 'verified' ? 'bg-green-100 text-green-800' :
                                                        slip.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                    {slip.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => onSelectOrder(slip.order_id, slip.amount || 0)}
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
