import React, { useState, useEffect, useRef, useMemo } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  AlertCircle,
  CheckCircle,
  FileText,
  Package,
  User as UserIcon,
  MapPin,
  Calendar,
  CreditCard,
  Phone,
  Eye,
  CornerDownRight,
  Edit2,
  X,
} from "lucide-react";
import {
  uploadSlipImageFile,
  createOrderSlipWithPayment,
  apiFetch,
  updateOrderSlip,
} from "../services/api";
import resolveApiBasePath from "@/utils/apiBasePath";
import { processImage } from "@/utils/imageProcessing";
import Modal from "../components/Modal";
import { getPaymentStatusChip } from "../components/OrderTable";


const InfoCard: React.FC<{
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}> = ({ icon: Icon, title, children }) => (
  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
    <h3 className="text-md font-semibold text-gray-700 mb-3 flex items-center">
      <Icon className="w-5 h-5 mr-2 text-gray-400" />
      {title}
    </h3>
    {children}
  </div>
);

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
  slip_total: number;
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
  start_date: string;
  end_date: string;
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
  bank_account_id: string;
  transfer_date: string;
}

interface SlipItem {
  file: File;
  preview: string;
  amount: string;
}

interface SlipEntry {
  file: File | null;
  preview: string | null;
}

interface SlipHistory {
  id: number;
  order_id: string;
  amount: number;
  bank_account_id: number;
  bank_name: string;
  bank_number: string;
  transfer_date: string;
  url: string;
  created_at: string;
  updated_at: string;
}

const OrderDetailsModal: React.FC<{ orderId: number; onClose: () => void }> = ({
  orderId,
  onClose,
}) => {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const r: any = await apiFetch(`orders/${orderId}`);
        // Map response to match structure used in OrderManagementModal
        const mappedOrder = {
          ...r,
          id: r.id,
          orderDate: r.order_date,
          deliveryDate: r.delivery_date,
          salesChannel: r.sales_channel,
          totalAmount: Number(r.total_amount || 0),
          amountPaid: Number(r.amount_paid || 0),
          paymentMethod: r.payment_method,
          paymentStatus: r.payment_status,
          shippingCost: Number(r.shipping_cost || 0),
          billDiscount: Number(r.bill_discount || 0),
          slipUrl: r.slip_url,
          shippingAddress: {
            recipientFirstName: r.recipient_first_name,
            recipientLastName: r.recipient_last_name,
            street: r.street,
            subdistrict: r.subdistrict,
            district: r.district,
            province: r.province,
            postalCode: r.postal_code,
          },
          items: [], // Will be set below
        };

        const rawItems = Array.isArray(r.items)
          ? r.items.map((it: any) => ({
            id: it.id,
            productId: it.product_id,
            productName: it.product_name,
            quantity: Number(it.quantity || 0),
            // If parent_item_id exists OR is_freebie is true, set price and discount to 0
            pricePerUnit:
              it.parent_item_id || it.is_freebie
                ? 0
                : Number(it.price_per_unit || 0),
            discount:
              it.parent_item_id || it.is_freebie
                ? 0
                : Number(it.discount || 0),
            creatorId: it.creator_id,
            parentItemId: it.parent_item_id,
            isFreebie: it.is_freebie,
          }))
          : [];

        // Sort items: Parents first, then their children
        const sortedItems: any[] = [];
        const parentItems = rawItems.filter((i: any) => !i.parentItemId);
        const childItems = rawItems.filter((i: any) => i.parentItemId);

        parentItems.forEach((parent: any) => {
          sortedItems.push(parent);
          // Find children for this parent
          const children = childItems.filter(
            (child: any) => child.parentItemId === parent.id,
          );
          sortedItems.push(...children);
        });

        // Add any orphans (items with parentItemId but parent not found in list)
        const processedIds = new Set(sortedItems.map((i) => i.id));
        const orphans = rawItems.filter((i: any) => !processedIds.has(i.id));
        sortedItems.push(...orphans);

        mappedOrder.items = sortedItems;

        setOrder(mappedOrder);
      } catch (error) {
        console.error("Failed to fetch order details", error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId]);

  if (loading)
    return (
      <Modal title="กำลังโหลด..." onClose={onClose}>
        <div className="p-8 text-center">กำลังโหลดข้อมูล...</div>
      </Modal>
    );
  if (!order)
    return (
      <Modal title="ไม่พบข้อมูล" onClose={onClose}>
        <div className="p-8 text-center text-red-500">
          ไม่พบข้อมูลคำสั่งซื้อ
        </div>
      </Modal>
    );

  const formatAddress = (address: any) => {
    const parts = [
      address.street,
      address.subdistrict,
      address.district,
      address.province,
      address.postalCode,
    ].filter(Boolean);
    return parts.join(" ");
  };

  const calculatedTotals = {
    itemsSubtotal: order.items.reduce(
      (sum: number, item: any) =>
        sum + (item.pricePerUnit * item.quantity - item.discount),
      0,
    ),
    itemsDiscount: order.items.reduce(
      (sum: number, item: any) => sum + item.discount,
      0,
    ),
    shippingCost: order.shippingCost,
    billDiscount: order.billDiscount,
    totalAmount: order.totalAmount,
  };

  return (
    <Modal title={`รายละเอียดออเดอร์: ${order.id}`} onClose={onClose} size="xl">
      <div className="space-y-4 text-sm">
        <InfoCard icon={Calendar} title="รายละเอียดคำสั่งซื้อ">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-gray-500">วันที่สั่งซื้อ</p>
              <p className="font-medium text-gray-800">
                {order.orderDate
                  ? new Date(order.orderDate).toLocaleString("th-TH")
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">วันที่จัดส่ง</p>
              <p className="font-medium text-gray-800">
                {order.deliveryDate
                  ? new Date(order.deliveryDate).toLocaleDateString("th-TH")
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">ช่องทางการขาย</p>
              <p className="font-medium text-gray-800">
                {order.salesChannel || "-"}
              </p>
            </div>
          </div>
        </InfoCard>

        <InfoCard icon={UserIcon} title="ข้อมูลลูกค้า">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="font-semibold text-gray-800 text-base">
                {order.shippingAddress.recipientFirstName}{" "}
                {order.shippingAddress.recipientLastName}
              </p>
              {/* Note: Customer phone might not be in shippingAddress, checking root order object if available or fallback */}
              {/* The API usually returns customer info at root or we use what we have */}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">ที่อยู่จัดส่ง</p>
              <p className="text-gray-700 flex items-start">
                <MapPin size={14} className="mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-sm">
                  {formatAddress(order.shippingAddress)}
                </span>
              </p>
            </div>
          </div>
        </InfoCard>

        <InfoCard icon={Package} title="รายการสินค้า">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                    สินค้า
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">
                    จำนวน
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">
                    ราคา/หน่วย
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">
                    ส่วนลด
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">
                    รวม
                  </th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item: any, index: number) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-800">
                      <div className="flex items-center">
                        {item.parentItemId && (
                          <CornerDownRight className="w-4 h-4 text-gray-400 mr-2 ml-2" />
                        )}
                        {item.productName}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-gray-700">
                      {item.quantity}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-gray-700">
                      ฿{item.pricePerUnit.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-red-600">
                      -฿{item.discount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">
                      ฿
                      {(
                        item.pricePerUnit * item.quantity -
                        item.discount
                      ).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-xs text-gray-600">
                    รวมรายการ
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-red-600">
                    -฿{calculatedTotals.itemsDiscount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">
                    ฿{calculatedTotals.itemsSubtotal.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-xs text-gray-600">
                    ส่วนลดทั้งออเดอร์
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-red-600">
                    -฿{calculatedTotals.billDiscount.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-xs text-gray-600">
                    ค่าส่ง
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-medium text-gray-900">
                    ฿{calculatedTotals.shippingCost.toLocaleString()}
                  </td>
                </tr>
                <tr className="border-t-2">
                  <td
                    colSpan={4}
                    className="px-3 py-2 text-sm font-bold text-gray-800"
                  >
                    ยอดสุทธิ
                  </td>
                  <td className="px-3 py-2 text-right text-base font-bold text-gray-900">
                    ฿{calculatedTotals.totalAmount.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </InfoCard>

        <InfoCard icon={CreditCard} title="การชำระเงิน">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium text-gray-600">
              วิธีชำระ: {order.paymentMethod}
            </span>
            {getPaymentStatusChip(
              order.paymentStatus,
              order.paymentMethod,
              order.amountPaid,
              order.totalAmount,
            )}
          </div>
          {order.slipUrl && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-1">หลักฐานการชำระเงิน</p>
              <div className="relative w-32 h-32 border rounded-md p-1">
                <img
                  src={order.slipUrl}
                  alt="Slip"
                  className="w-full h-full object-contain"
                />
                <a
                  href={order.slipUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-20 transition-all text-transparent hover:text-white"
                >
                  <Eye size={20} />
                </a>
              </div>
            </div>
          )}
        </InfoCard>
      </div>
    </Modal>
  );
};

const SlipUpload: React.FC = () => {
  const apiBase = useMemo(() => resolveApiBasePath(), []);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [slipStatusFilter, setSlipStatusFilter] = useState<
    "no_slip" | "partial" | "all"
  >("no_slip");
  const [activeTab, setActiveTab] = useState<"PayAfter" | "Transfer" | "COD">("PayAfter");
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo>({
    totalCount: 0,
    currentPage: 1,
    pageSize: 10,
    maxPage: 1,
  });

  // Input filters - what user is typing (not applied until search button clicked)
  const [inputFilters, setInputFilters] = useState<FilterOptions>(() => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      order_id: "",
      customer_name: "",
      phone: "",
      start_date: firstDayOfMonth.toISOString().split("T")[0],
      end_date: now.toISOString().split("T")[0],
    };
  });

  // Active filters - what's actually being used for search
  const [activeFilters, setActiveFilters] = useState<FilterOptions>(() => {
    const now = new Date();
    return {
      order_id: "",
      customer_name: "",
      phone: "",
      sale_month: (now.getMonth() + 1).toString(),
      sale_year: now.getFullYear().toString(),
    };
  });

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loadingBankAccounts, setLoadingBankAccounts] = useState(false);
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [slipFormData, setSlipFormData] = useState<SlipFormData>({
    order_id: "",
    bank_account_id: "",
    transfer_date: "",
  });
  const [slipEntry, setSlipEntry] = useState<SlipEntry>({
    file: null,
    preview: null,
  });
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [slipItems, setSlipItems] = useState<SlipItem[]>([]);
  const [slipHistory, setSlipHistory] = useState<SlipHistory[]>([]);
  const [loadingSlipHistory, setLoadingSlipHistory] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [viewingOrderId, setViewingOrderId] = useState<number | null>(null);

  // Edit Slip State
  const [editingSlip, setEditingSlip] = useState<SlipHistory | null>(null);
  const [editFormData, setEditFormData] = useState<{
    amount: string;
    bank_account_id: string;
    transfer_date: string;
    newFile: File | null;
    newPreview: string | null;
  } | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

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

      const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
      const headers: any = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(
        `${apiBase}/Bank_DB/get_bank_accounts.php?company_id=${companyId}`,
        { headers }
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
      bank_account_id: "",
      transfer_date: "",
    });
    setShowSlipModal(true);
    fetchSlipHistory(order.id.toString());
    if (bankAccounts.length === 0) {
      fetchBankAccounts();
    }
    // Reset images
    setSlipItems([]);
  };

  const handleSlipFormChange = (field: keyof SlipFormData, value: string) => {
    setSlipFormData((prev) => ({ ...prev, [field]: value }));
  };

  const fetchSlipHistory = async (orderId: string) => {
    setLoadingSlipHistory(true);
    try {
      const sessionUser = localStorage.getItem("sessionUser");
      if (!sessionUser) {
        showMessage("error", "ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่");
        setLoadingSlipHistory(false);
        return;
      }

      const user = JSON.parse(sessionUser);
      const companyId = user.company_id;

      const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
      const headers: any = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(
        `${apiBase}/Slip_DB/get_slip_history.php?order_id=${orderId}&company_id=${companyId}`,
        { headers }
      );
      const data = await response.json();

      if (data.success) {
        setSlipHistory(data.data);
      } else {
        showMessage(
          "error",
          data.message || "ไม่สามารถดึงข้อมูลประวัติสลิปได้",
        );
        setSlipHistory([]);
      }
    } catch (error) {
      console.error("Error fetching slip history:", error);
      showMessage("error", "เกิดข้อผิดพลาดในการดึงข้อมูลประวัติสลิป");
      setSlipHistory([]);
    } finally {
      setLoadingSlipHistory(false);
    }
  };

  const handleChooseImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (
    e,
  ) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files) as File[];
      const newSlipItems: SlipItem[] = [];

      for (const file of newFiles) {
        try {
          // Process image (resize + convert to WebP)
          const processedFile = await processImage(file);
          const processedUrl = URL.createObjectURL(processedFile);

          // Determine default amount
          // If it's the very first item being added (and list was empty), suggest remaining amount
          // Otherwise 0
          let defaultAmount = "0";
          if (
            slipItems.length === 0 &&
            newSlipItems.length === 0 &&
            selectedOrder
          ) {
            const remaining =
              selectedOrder.total_amount - selectedOrder.slip_total;
            defaultAmount = remaining > 0 ? remaining.toString() : "0";
          }

          newSlipItems.push({
            file: processedFile,
            preview: processedUrl,
            amount: defaultAmount,
          });
        } catch (error) {
          console.error("Error processing image:", error);
          showMessage("error", `ไม่สามารถประมวลผลรูปภาพ ${file.name} ได้`);
          // Fallback to original
          newSlipItems.push({
            file: file,
            preview: URL.createObjectURL(file),
            amount: "0",
          });
        }
      }
      setSlipItems((prev) => [...prev, ...newSlipItems]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setSlipItems((prev) => {
      const itemToRemove = prev[index];
      URL.revokeObjectURL(itemToRemove.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleAmountChange = (index: number, value: string) => {
    setSlipItems((prev) => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], amount: value };
      return newItems;
    });
  };

  const uploadSlipImage = async (
    orderId: string,
    file: File,
  ): Promise<string | null> => {
    try {
      setUploadingImage(true);
      const result = await uploadSlipImageFile(orderId, file);
      if (!result.success) {
        showMessage("error", result.message || "อัปโหลดรูปสลิปไม่สำเร็จ");
        return null;
      }
      return result.url || null;
    } catch (err) {
      console.error("Upload slip image error", err);
      showMessage("error", "เกิดข้อผิดพลาดระหว่างอัปโหลดรูปสลิป");
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSlipSubmit = async () => {
    if (
      !slipFormData.bank_account_id ||
      !slipFormData.transfer_date ||
      slipItems.length === 0
    ) {
      showMessage("error", "กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    // Validate amounts
    const hasInvalidAmount = slipItems.some(
      (item) =>
        !item.amount ||
        isNaN(parseFloat(item.amount)) ||
        parseFloat(item.amount) < 0,
    );
    if (hasInvalidAmount) {
      showMessage("error", "กรุณาระบุจำนวนเงินให้ถูกต้อง");
      return;
    }

    setUploadingSlip(true);
    try {
      const sessionUser = localStorage.getItem("sessionUser");
      if (!sessionUser) {
        showMessage("error", "ไม่พบ session ผู้ใช้ กรุณาล็อกอินใหม่");
        setUploadingSlip(false);
        return;
      }

      const user = JSON.parse(sessionUser);
      const companyId = user.company_id;

      let successCount = 0;

      // Upload and create slip for each image
      for (let i = 0; i < slipItems.length; i++) {
        const item = slipItems[i];
        const slipUrl = await uploadSlipImage(slipFormData.order_id, item.file);

        if (slipUrl) {
          const insertResult = await createOrderSlipWithPayment({
            orderId: slipFormData.order_id,
            amount: parseFloat(item.amount),
            bankAccountId: parseInt(slipFormData.bank_account_id),
            transferDate: slipFormData.transfer_date,
            url: slipUrl,
            companyId: companyId,
            uploadBy: user.id,
            uploadByName:
              user.first_name && user.last_name
                ? `${user.first_name} ${user.last_name}`
                : user.full_name || undefined,
          });

          if (insertResult.success) {
            successCount++;
          }
        }
      }

      if (successCount > 0) {
        showMessage(
          "success",
          `บันทึกข้อมูลสลิปเรียบร้อยแล้ว (${successCount}/${slipItems.length} รูป)`,
        );
        setShowSlipModal(false);
        setSlipFormData((prev) => ({
          ...prev,
          amount: "",
          bank_account_id: "",
          transfer_date: "",
        }));
        setSlipItems([]);
        fetchOrders();
      } else {
        showMessage("error", "??????????????????????");
      }
    } catch (error) {
      console.error("Error submitting slip:", error);
      showMessage("error", "????????????????????????????");
    } finally {
      setUploadingSlip(false);
    }
  };

  const handleEditClick = (slip: SlipHistory) => {
    setEditingSlip(slip);
    setEditFormData({
      amount: slip.amount.toString(),
      bank_account_id: slip.bank_account_id.toString(),
      transfer_date: slip.transfer_date,
      newFile: null,
      newPreview: null,
    });
  };

  const handleEditFileChange: React.ChangeEventHandler<
    HTMLInputElement
  > = async (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      try {
        const processedFile = await processImage(file);
        const processedUrl = URL.createObjectURL(processedFile);
        setEditFormData((prev) =>
          prev
            ? { ...prev, newFile: processedFile, newPreview: processedUrl }
            : null,
        );
      } catch (error) {
        console.error("Error processing image:", error);
        showMessage("error", `ไม่สามารถประมวลผลรูปภาพได้`);
      }
    }
    if (editFileInputRef.current) {
      editFileInputRef.current.value = "";
    }
  };

  const handleUpdateSlip = async () => {
    if (!editingSlip || !editFormData) return;

    if (
      !editFormData.amount ||
      !editFormData.bank_account_id ||
      !editFormData.transfer_date
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

      let newUrl = undefined;
      if (editFormData.newFile) {
        const uploadedUrl = await uploadSlipImage(
          editingSlip.order_id,
          editFormData.newFile,
        );
        if (uploadedUrl) {
          newUrl = uploadedUrl;
        } else {
          setUploadingSlip(false);
          return; // Upload failed
        }
      }

      const result = await updateOrderSlip({
        id: editingSlip.id,
        amount: parseFloat(editFormData.amount),
        bankAccountId: parseInt(editFormData.bank_account_id),
        transferDate: editFormData.transfer_date,
        url: newUrl,
        companyId: companyId,
        updatedBy: user.id,
      });

      if (result.success) {
        showMessage("success", "แก้ไขข้อมูลสลิปเรียบร้อยแล้ว");
        setEditingSlip(null);
        setEditFormData(null);
        fetchSlipHistory(editingSlip.order_id);
        fetchOrders(); // Refresh orders to update totals if amount changed
      } else {
        showMessage("error", result.message || "ไม่สามารถแก้ไขข้อมูลสลิปได้");
      }
    } catch (error) {
      console.error("Error updating slip:", error);
      showMessage("error", "เกิดข้อผิดพลาดในการแก้ไขข้อมูลสลิป");
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

      // Payment method: Use activeTab
      queryParams.append("payment_method", activeTab);

      // Role-based filtering removed as per request
      /*
      if (user.role && user.role !== "Backoffice" && user.role !== "Finance") {
        if (user.id) {
          queryParams.append("user_id", user.id.toString());
        }
        queryParams.append("role", user.role);
        if (user.team_id) {
          queryParams.append("team_id", user.team_id.toString());
        }
      }
      */

      // Add active filters to query if they have values
      if (activeFilters.order_id)
        queryParams.append("order_id", activeFilters.order_id);
      if (activeFilters.customer_name)
        queryParams.append("customer_name", activeFilters.customer_name);
      if (activeFilters.phone) queryParams.append("phone", activeFilters.phone);
      if (activeFilters.start_date)
        queryParams.append("start_date", activeFilters.start_date);
      if (activeFilters.end_date)
        queryParams.append("end_date", activeFilters.end_date);

      const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
      const headers: any = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(
        `${apiBase}/Slip_DB/get_transfer_orders.php?${queryParams.toString()}`,
        { headers }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Fetched orders data:", data);

      if (data.success) {
        setOrders(data.data || []);
        setPagination({
          totalCount: data.totalCount || 0,
          currentPage: data.currentPage || 1,
          pageSize: data.pageSize || 10,
          maxPage: data.maxPage || 1,
        });

        // Reset to first page if filters change and currentPage > maxPage
        if (data.currentPage > data.maxPage && data.maxPage > 0) {
          setPagination((prev) => ({ ...prev, currentPage: 1 }));
          fetchOrders();
          return;
        }

        // Only show error message if there are no orders AND it's not a filter result
        if (
          (data.count === 0 || (data.data || []).length === 0) &&
          !activeFilters.order_id &&
          !activeFilters.customer_name &&
          !activeFilters.phone &&
          !activeFilters.start_date &&
          !activeFilters.end_date
        ) {
          // Don't show error, just show empty state - this is normal if no unpaid orders
        }
      } else {
        console.error("API error:", data);
        showMessage("error", data.message || "ไม่สามารถดึงข้อมูลคำสั่งซื้อได้");
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
      showMessage("error", "เกิดข้อผิดพลาดในการดึงข้อมูลคำสั่งซื้อ");
    } finally {
      setLoadingOrders(false);
    }
  };

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch bank accounts on component mount
  useEffect(() => {
    fetchBankAccounts();
  }, []);

  // Fetch orders on component mount and when pagination or activeFilters change
  useEffect(() => {
    fetchOrders();
  }, [pagination.currentPage, pagination.pageSize, activeFilters, activeTab]); // Re-fetch when pagination, activeFilters or activeTab change

  const handleFilterChange = (field: keyof FilterOptions, value: string) => {
    const newFilters = { ...inputFilters, [field]: value };
    setInputFilters(newFilters);

    // Clear existing timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (field === "start_date" || field === "end_date") {
      // Immediate update for date filters
      setActiveFilters(newFilters);
      setPagination((prev) => ({ ...prev, currentPage: 1 }));
      fetchOrders();
    } else {
      // Debounce for text inputs (500ms)
      debounceRef.current = setTimeout(() => {
        setActiveFilters(newFilters);
        setPagination((prev) => ({ ...prev, currentPage: 1 }));
      }, 500);
    }
  };

  const clearFilters = () => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultFilters = {
      order_id: "",
      customer_name: "",
      phone: "",
      start_date: firstDayOfMonth.toISOString().split("T")[0],
      end_date: now.toISOString().split("T")[0],
    };
    setInputFilters(defaultFilters);
    setActiveFilters(defaultFilters);
    setPagination((prev) => ({ ...prev, currentPage: 1 }));

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
  };

  const filteredOrders = useMemo(() => {
    if (slipStatusFilter === "all") return orders;
    return orders.filter((order) => {
      const slipTotal = order.slip_total || 0;
      if (slipStatusFilter === "no_slip") {
        return slipTotal <= 0;
      }
      if (slipStatusFilter === "partial") {
        return slipTotal > 0 && slipTotal + 0.009 < order.total_amount;
      }
      return true;
    });
  }, [orders, slipStatusFilter]);

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
                    className={`px-3 py-1 text-sm border rounded ${i === currentPage
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
              อัปโหลดสลิปโอนเงิน
            </h1>
            <p className="text-gray-600">
              จัดการสลิปการโอนเงินสำหรับคำสั่งซื้อ
            </p>
          </div>
        </div>
      </div>

      {/* Alert Message */}
      {message && (
        <div
          className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${message.type === "success"
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

      <div className="w-full">
        {/* Tabs */}
        <div className="flex space-x-1 mb-4 border-b border-gray-200">
          <button
            onClick={() => { setActiveTab("PayAfter"); setPagination(prev => ({ ...prev, currentPage: 1 })); }}
            className={`px-6 py-2 text-sm font-medium transition-colors relative ${activeTab === "PayAfter"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
              }`}
          >
            PayAfter (ชำระทีหลัง)
          </button>
          <button
            onClick={() => { setActiveTab("Transfer"); setPagination(prev => ({ ...prev, currentPage: 1 })); }}
            className={`px-6 py-2 text-sm font-medium transition-colors relative ${activeTab === "Transfer"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
              }`}
          >
            Transfer (โอนเงิน)
          </button>
          <button
            onClick={() => { setActiveTab("COD"); setPagination(prev => ({ ...prev, currentPage: 1 })); }}
            className={`px-6 py-2 text-sm font-medium transition-colors relative ${activeTab === "COD"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
              }`}
          >
            COD (เก็บเงินปลายทาง)
          </button>
        </div>
        {/* Orders Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              รายการคำสั่งซื้อ ({activeTab})
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {/* Order ID Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  รหัสคำสั่งซื้อ
                </label>
                <input
                  type="text"
                  value={inputFilters.order_id}
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
                  value={inputFilters.customer_name}
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
                  value={inputFilters.phone}
                  onChange={(e) => handleFilterChange("phone", e.target.value)}
                  placeholder="เบอร์โทร"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Date Range Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  วันที่เริ่มต้น
                </label>
                <input
                  type="date"
                  value={inputFilters.start_date}
                  onChange={(e) =>
                    handleFilterChange("start_date", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  วันที่สิ้นสุด
                </label>
                <input
                  type="date"
                  value={inputFilters.end_date}
                  onChange={(e) =>
                    handleFilterChange("end_date", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Slip status filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  สถานะสลิป
                </label>
                <select
                  value={slipStatusFilter}
                  onChange={(e) => setSlipStatusFilter(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="no_slip">ยังไม่มีสลิป</option>
                  <option value="partial">มีสลิปแต่ไม่ครบยอด</option>
                  <option value="all">ทั้งหมด</option>
                </select>
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex items-center gap-2 mt-4">
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
          ) : filteredOrders.length > 0 ? (
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
                  {filteredOrders.map((order) => (
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
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${order.payment_status === "จ่ายแล้ว"
                            ? "bg-green-100 text-green-800"
                            : order.payment_status === "จ่ายยังไม่ครบ"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-yellow-100 text-yellow-800"
                            }`}
                        >
                          {order.payment_status}
                        </span>
                        {order.slip_total > 0 && (
                          <div className="text-xs text-gray-600 mt-1">
                            ชำระแล้ว: ฿
                            {order.slip_total.toLocaleString("th-TH", {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-center">
                        <button
                          onClick={() => setViewingOrderId(order.id)}
                          className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded hover:bg-gray-200 transition-colors mr-2"
                        >
                          รายละเอียด
                        </button>
                        <button
                          onClick={() => handleAddSlip(order)}
                          className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                        >
                          เพิ่มสลิป
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">ไม่พบรายการคำสั่งซื้อ</p>
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
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${!slipFormData.bank_account_id
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                        }`}
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

                {/* Transfer Date and Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      วันที่โอนเงิน *
                    </label>
                    <DatePicker
                      selected={slipFormData.transfer_date ? new Date(slipFormData.transfer_date) : null}
                      onChange={(date: Date | null) => {
                        if (date) {
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          const time = slipFormData.transfer_date.split('T')[1] || '00:00';
                          handleSlipFormChange("transfer_date", `${year}-${month}-${day}T${time}`);
                        }
                      }}
                      dateFormat="dd/MM/yyyy"
                      placeholderText="วว/ดด/ปปปป"
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${!slipFormData.transfer_date
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                        }`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      เวลา (24 ชม.) *
                    </label>
                    <input
                      type="time"
                      value={slipFormData.transfer_date.split('T')[1]?.substring(0, 5) || ''}
                      onChange={(e) => {
                        const date = slipFormData.transfer_date.split('T')[0] || new Date().toISOString().split('T')[0];
                        handleSlipFormChange("transfer_date", `${date}T${e.target.value}`);
                      }}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${!slipFormData.transfer_date
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                        }`}
                    />
                  </div>
                </div>

                {/* Slip Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    อัปโหลดรูปสลิปโอนเงิน *
                    {slipItems.length === 0 && (
                      <span className="text-red-500 text-xs ml-2">
                        จำเป็นต้องเลือกรูปภาพ
                      </span>
                    )}
                  </label>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      <button
                        type="button"
                        onClick={handleChooseImageClick}
                        disabled={uploadingImage || uploadingSlip}
                        className="px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        เลือกรูปภาพ (เลือกได้หลายรูป)
                      </button>
                      <span className="text-xs text-gray-500">
                        เลือกแล้ว {slipItems.length} รูป
                      </span>
                    </div>

                    {/* Image Previews Grid */}
                    {slipItems.length > 0 && (
                      <div className="grid grid-cols-1 gap-4 mt-2">
                        {slipItems.map((item, index) => (
                          <div
                            key={index}
                            className="flex gap-3 p-3 border rounded-lg bg-gray-50"
                          >
                            <div className="relative w-20 h-20 flex-shrink-0">
                              <img
                                src={item.preview}
                                alt={`Slip preview ${index + 1}`}
                                className="w-full h-full object-cover rounded-md border border-gray-200"
                              />
                            </div>
                            <div className="flex-1 flex flex-col justify-between">
                              <div className="flex justify-between items-start">
                                <div className="text-xs text-gray-500 truncate max-w-[150px]">
                                  {item.file.name}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeImage(index)}
                                  className="text-red-500 hover:text-red-700 p-1"
                                  title="ลบรูปภาพ"
                                >
                                  <AlertCircle className="w-4 h-4" />
                                </button>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  จำนวนเงิน
                                </label>
                                <input
                                  type="number"
                                  value={item.amount}
                                  onChange={(e) =>
                                    handleAmountChange(index, e.target.value)
                                  }
                                  placeholder="0.00"
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Slip History Section */}
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    ประวัติการอัปโหลดสลิป
                  </h4>
                  {loadingSlipHistory ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : slipHistory.length > 0 ? (
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {slipHistory.map((slip) => (
                        <div
                          key={slip.id}
                          className="bg-gray-50 p-3 rounded-lg border border-gray-200"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-900">
                              ฿
                              {slip.amount.toLocaleString("th-TH", {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(slip.created_at).toLocaleDateString(
                                "th-TH",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600 mb-2">
                            <div>
                              บัญชี: {slip.bank_name} - {slip.bank_number}
                            </div>
                            <div>
                              วันที่โอน:{" "}
                              {new Date(slip.transfer_date).toLocaleString(
                                "th-TH",
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditClick(slip)}
                              className="text-xs text-orange-600 hover:text-orange-800 flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3" />
                              แก้ไข
                            </button>
                            <span className="text-xs text-gray-400">|</span>
                            <a
                              href={(() => {
                                if (!slip.url) return "#";
                                if (slip.url.startsWith("api/"))
                                  return "/" + slip.url;
                                if (
                                  slip.url.startsWith("/") ||
                                  slip.url.startsWith("http://") ||
                                  slip.url.startsWith("https://")
                                )
                                  return slip.url;
                                return "/" + slip.url;
                              })()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-800 underline"
                            >
                              ดูรูปสลิป
                            </a>
                            <span className="text-xs text-gray-400">|</span>
                            <img
                              src={(() => {
                                if (!slip.url) return "";
                                if (slip.url.startsWith("api/"))
                                  return "/" + slip.url;
                                if (
                                  slip.url.startsWith("/") ||
                                  slip.url.startsWith("http://") ||
                                  slip.url.startsWith("https://")
                                )
                                  return slip.url;
                                return "/" + slip.url;
                              })()}
                              alt="สลิปการโอนเงิน"
                              className="w-12 h-12 object-cover rounded border border-gray-200 cursor-pointer hover:border-blue-400 transition-colors"
                              onClick={() => {
                                const url = slip.url;
                                const normalizedUrl = url.startsWith("api/")
                                  ? "/" + url
                                  : url.startsWith("/") ||
                                    url.startsWith("http://") ||
                                    url.startsWith("https://")
                                    ? url
                                    : "/" + url;
                                window.open(normalizedUrl, "_blank");
                              }}
                              onError={(e) => {
                                console.error(
                                  "Failed to load slip image:",
                                  slip.url,
                                );
                                e.currentTarget.style.display = "none";
                                e.currentTarget.nextElementSibling?.removeProperty(
                                  "display",
                                );
                              }}
                            />
                            <span
                              style={{
                                display: "none",
                                color: "#ef4444",
                                fontSize: "0.75rem",
                              }}
                            >
                              ไม่สามารถโหลดรูป
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-sm text-gray-500">
                      ยังไม่มีประวัติการอัปโหลดสลิป
                    </div>
                  )}
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
                    disabled={uploadingSlip || uploadingImage}
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
        </div>
      )}

      {viewingOrderId && (
        <OrderDetailsModal
          orderId={viewingOrderId}
          onClose={() => setViewingOrderId(null)}
        />
      )}

      {/* Edit Slip Modal */}
      {editingSlip && editFormData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl max-w-sm w-full">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">แก้ไขสลิป</h3>
              <button
                onClick={() => setEditingSlip(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  จำนวนเงิน
                </label>
                <input
                  type="number"
                  value={editFormData.amount}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, amount: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Bank Account */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  บัญชีธนาคาร
                </label>
                <select
                  value={editFormData.bank_account_id}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      bank_account_id: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">เลือกบัญชี</option>
                  {bankAccounts.map((bank) => (
                    <option key={bank.id} value={bank.id}>
                      {bank.display_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Transfer Date and Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    วันที่โอน
                  </label>
                  <DatePicker
                    selected={editFormData.transfer_date ? new Date(editFormData.transfer_date) : null}
                    onChange={(date: Date | null) => {
                      if (date) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        const time = editFormData.transfer_date.split('T')[1] || '00:00';
                        setEditFormData({
                          ...editFormData,
                          transfer_date: `${year}-${month}-${day}T${time}`,
                        });
                      }
                    }}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="วว/ดด/ปปปป"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    เวลา (24 ชม.)
                  </label>
                  <input
                    type="time"
                    value={editFormData.transfer_date.split('T')[1]?.substring(0, 5) || ''}
                    onChange={(e) => {
                      const date = editFormData.transfer_date.split('T')[0] || new Date().toISOString().split('T')[0];
                      setEditFormData({
                        ...editFormData,
                        transfer_date: `${date}T${e.target.value}`,
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  รูปสลิป
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative w-20 h-20 border rounded-lg overflow-hidden bg-gray-50">
                    <img
                      src={
                        editFormData.newPreview ||
                        (() => {
                          const url = editingSlip.url;
                          if (!url) return "";
                          if (url.startsWith("api/")) return "/" + url;
                          if (url.startsWith("/") || url.startsWith("http"))
                            return url;
                          return "/" + url;
                        })()
                      }
                      alt="Slip preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <input
                      ref={editFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleEditFileChange}
                    />
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      className="px-3 py-1 text-sm bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
                    >
                      เปลี่ยนรูป
                    </button>
                    {editFormData.newFile && (
                      <p className="text-xs text-green-600 mt-1">
                        เลือกรูปใหม่แล้ว
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end gap-2">
              <button
                onClick={() => setEditingSlip(null)}
                disabled={uploadingSlip}
                className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-md"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleUpdateSlip}
                disabled={uploadingSlip}
                className="px-3 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
              >
                {uploadingSlip ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlipUpload;
