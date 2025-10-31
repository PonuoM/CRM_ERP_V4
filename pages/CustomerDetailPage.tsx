import React, { useEffect, useMemo, useState } from "react";
import {
  Customer,
  Order,
  CallHistory,
  Appointment,
  ModalType,
  User,
  Tag,
  TagType,
  CustomerLog,
  LineItem,
} from "../types";
// FIX: Add 'X', 'Repeat', 'Paperclip' icons to the import from 'lucide-react'.
import {
  ArrowLeft,
  Phone,
  Edit,
  MessageSquare,
  ShoppingCart,
  Check,
  Flame,
  Tag as TagIcon,
  Plus,
  Calendar,
  Briefcase,
  Facebook,
  MoreHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { getStatusChip, getPaymentStatusChip } from "../components/OrderTable";
import {
  createCustomerBlock,
  listCustomerLogs,
  getOrder,
} from "../services/api";
import {
  actionLabels,
  parseCustomerLogRow,
  summarizeCustomerLogChanges,
} from "../utils/customerLogs";

interface CustomerDetailPageProps {
  customer: Customer;
  orders: Order[];
  callHistory: CallHistory[];
  appointments: Appointment[];
  user: User;
  allUsers: User[];
  systemTags: Tag[];
  onClose: () => void;
  openModal: (type: ModalType, data?: any) => void;
  onAddTag: (customerId: string, tag: Tag) => void;
  onRemoveTag: (customerId: string, tagId: number) => void;
  onCreateUserTag: (tagName: string) => Tag | null;
  onCompleteAppointment?: (appointmentId: number) => void;
  ownerName?: string;
  onStartCreateOrder?: (customer: Customer) => void;
}

type ActiveTab = "calls" | "appointments" | "orders";

const InfoItem: React.FC<{
  label: string;
  value?: string | number;
  children?: React.ReactNode;
}> = ({ label, value, children }) => (
  <div>
    <p className="text-xs text-gray-500">{label}</p>
    {value ? (
      <p className="text-sm font-medium text-gray-800 truncate">{value}</p>
    ) : (
      children
    )}
  </div>
);

const CustomerDetailPage: React.FC<CustomerDetailPageProps> = (props) => {
  const {
    customer,
    orders,
    callHistory,
    appointments,
    user,
    allUsers,
    systemTags,
    onClose,
    openModal,
    onAddTag,
    onRemoveTag,
    onCreateUserTag,
    onStartCreateOrder,
  } = props;
  const [activeTab, setActiveTab] = useState<ActiveTab>("calls");
  const [newTagName, setNewTagName] = useState("");
  const [activityLogs, setActivityLogs] = useState<CustomerLog[]>([]);
  const [activityLogsLoading, setActivityLogsLoading] = useState(false);
  const [activityLogsError, setActivityLogsError] = useState<string | null>(
    null,
  );

  const [callHistoryPage, setCallHistoryPage] = useState(1);
  const [appointmentsPage, setAppointmentsPage] = useState(1);
  const [ordersPage, setOrdersPage] = useState(1);
  const ITEMS_PER_PAGE = 8;
  const [orderDetails, setOrderDetails] = useState<
    Record<string, { items: LineItem[]; loading: boolean; error?: string }>
  >({});
  const [expandedOrderIds, setExpandedOrderIds] = useState<string[]>([]);

  const usersById = useMemo(() => {
    const map = new Map<number, User>();
    allUsers.forEach((userItem) => {
      map.set(userItem.id, userItem);
    });
    return map;
  }, [allUsers]);

  const formatCurrency = (value: number) =>
    `฿${Number(value || 0).toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const calculateLineNet = (item: LineItem) => {
    const hasParent =
      typeof item.parentItemId !== "undefined" && item.parentItemId !== null;
    if (hasParent || item.isFreebie) {
      return 0;
    }
    const quantity = Number(item.quantity ?? 0);
    const price = Number(item.pricePerUnit ?? 0);
    const discount = Number(item.discount ?? 0);
    if (quantity <= 0 || price <= 0) return 0;
    const base = quantity * price - discount;
    return base > 0 ? base : 0;
  };

  // ฟังก์ชันสำหรับนับจำนวนโปรโมชั่นในออเดอร์
  const countPromotions = (items: LineItem[]): number => {
    return items.filter((item) => item.isPromotionParent).length;
  };

  const mapApiOrderItems = (items: any[]): LineItem[] => {
    if (!Array.isArray(items)) return [];

    const mappedItems = items.map((it: any, index: number) => ({
      id: Number(it.id ?? index + 1),
      productName: String(
        it.product_name ?? it.productName ?? `สินค้า ${index + 1}`,
      ),
      quantity: Number(it.quantity ?? 0),
      pricePerUnit: Number(it.price_per_unit ?? it.pricePerUnit ?? 0),
      discount: Number(it.discount ?? 0),
      isFreebie: Boolean(it.is_freebie ?? it.isFreebie ?? 0),
      boxNumber: Number(it.box_number ?? it.boxNumber ?? 0),
      productId:
        typeof it.product_id !== "undefined" && it.product_id !== null
          ? Number(it.product_id)
          : undefined,
      promotionId:
        typeof it.promotion_id !== "undefined" && it.promotion_id !== null
          ? Number(it.promotion_id)
          : undefined,
      parentItemId:
        typeof it.parent_item_id !== "undefined" && it.parent_item_id !== null
          ? Number(it.parent_item_id)
          : undefined,
      isPromotionParent: Boolean(
        it.is_promotion_parent ?? it.isPromotionParent ?? 0,
      ),
    }));

    // Sort items: promotion parents first, then their children, then regular items
    const sortedItems: LineItem[] = [];
    const processedItemIds = new Set<number>();

    // ค้นหาสินค้าหลักของโปรโมชั่นทั้งหมด
    const promotionParents = mappedItems.filter(
      (item) => item.isPromotionParent,
    );

    // เรียงลำดับสินค้าหลักของโปรโมชั่นตาม ID
    promotionParents.sort((a, b) => a.id - b.id);

    // สำหรับแต่ละสินค้าหลักของโปรโมชั่น เพิ่มสินค้าหลักแล้วตามด้วยสินค้าลูกทั้งหมด
    promotionParents.forEach((parent) => {
      // เพิ่มสินค้าหลักของโปรโมชั่น
      sortedItems.push(parent);
      processedItemIds.add(parent.id);

      // ค้นหาสินค้าลูกทั้งหมดของสินค้าหลักนี้ (ใช้ parentItemId)
      const children = mappedItems
        .filter(
          (child) =>
            child.parentItemId === parent.id &&
            !child.isPromotionParent &&
            child.id !== parent.id,
        )
        .sort((a, b) => a.id - b.id); // เรียงลำดับสินค้าลูกตาม ID

      // เพิ่มสินค้าลูกทั้งหมดต่อจากสินค้าหลักทันที
      children.forEach((child) => {
        sortedItems.push(child);
        processedItemIds.add(child.id);
      });
    });

    // เพิ่มสินค้าทั่วไปที่ไม่ใช่ส่วนของโปรโมชั่น
    const regularItems = mappedItems
      .filter((item) => !item.isPromotionParent && !item.parentItemId)
      .sort((a, b) => a.id - b.id);

    regularItems.forEach((item) => {
      if (!processedItemIds.has(item.id)) {
        sortedItems.push(item);
        processedItemIds.add(item.id);
      }
    });

    // จัดการกับสินค้าลูกที่ไม่มีสินค้าหลัก (กรณีข้อมูลไม่สมบูรณ์)
    const orphanedChildren = mappedItems
      .filter((item) => item.parentItemId && !processedItemIds.has(item.id))
      .sort((a, b) => a.id - b.id);

    sortedItems.push(...orphanedChildren);

    return sortedItems;
  };

  const handleToggleOrderDetails = (orderId: string) => {
    const wasExpanded = expandedOrderIds.includes(orderId);
    setExpandedOrderIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId],
    );

    if (wasExpanded) {
      return;
    }

    const current = orderDetails[orderId];
    if (current?.loading) {
      return;
    }
    if (current && current.items.length > 0 && !current.error) {
      return;
    }

    setOrderDetails((prev) => ({
      ...prev,
      [orderId]: {
        items: current?.items ?? [],
        loading: true,
        error: undefined,
      },
    }));

    getOrder(orderId)
      .then((response: any) => {
        const mappedItems = mapApiOrderItems(response?.items ?? []);
        setOrderDetails((prev) => ({
          ...prev,
          [orderId]: {
            items: mappedItems,
            loading: false,
            error: undefined,
          },
        }));
      })
      .catch((error) => {
        console.error("Failed to load order details", error);
        setOrderDetails((prev) => ({
          ...prev,
          [orderId]: {
            items: [],
            loading: false,
            error: "ไม่สามารถโหลดรายละเอียดสินค้าได้",
          },
        }));
      });
  };

  const getRemainingTime = (expiryDate: string) => {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diff = expiry.getTime() - now.getTime();
    if (diff <= 0) return { text: "หมดอายุ", color: "text-red-500" };
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return {
      text: `${days} วัน`,
      color: days < 7 ? "text-orange-500" : "text-gray-600",
    };
  };

  const formatAddress = (address: Customer["address"]) => {
    if (!address || !address.street) return "-";
    return `${address.street}, ต.${address.subdistrict}, อ.${address.district}, จ.${address.province} ${address.postalCode}`;
  };

  const handleAddTag = () => {
    if (!newTagName.trim()) return;

    if (
      customer.tags.some(
        (t) => t.name.toLowerCase() === newTagName.trim().toLowerCase(),
      )
    ) {
      setNewTagName("");
      return;
    }

    const allAvailableTags = [...systemTags, ...user.customTags];
    const existingTag = allAvailableTags.find(
      (t) => t.name.toLowerCase() === newTagName.trim().toLowerCase(),
    );

    if (existingTag) {
      onAddTag(customer.id, existingTag);
    } else {
      const newTag = onCreateUserTag(newTagName.trim());
      if (newTag) {
        onAddTag(customer.id, newTag);
      }
    }
    setNewTagName("");
  };

  const getRelativeTime = (timestamp: string) => {
    const now = new Date();
    const past = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds} วินาทีที่แล้ว`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} นาทีที่แล้ว`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} ชั่วโมงที่แล้ว`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} วันที่แล้ว`;
  };

  useEffect(() => {
    let cancelled = false;
    setActivityLogsLoading(true);
    setActivityLogsError(null);

    listCustomerLogs(customer.id, { limit: 50 })
      .then((rows) => {
        if (cancelled) return;
        const normalized = Array.isArray(rows)
          ? rows.map((row: any) => parseCustomerLogRow(row))
          : [];
        setActivityLogs(normalized);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Failed to load customer logs", error);
        setActivityLogs([]);
        setActivityLogsError("ไม่สามารถโหลดกิจกรรมล่าสุดได้");
      })
      .finally(() => {
        if (!cancelled) {
          setActivityLogsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [customer.id]);

  const actionIcons: Record<CustomerLog["actionType"], React.ElementType> = {
    create: Plus,
    update: Edit,
    delete: Trash2,
  };

  const ActivityIcon = ({ action }: { action: CustomerLog["actionType"] }) => {
    const Icon = actionIcons[action] || MoreHorizontal;
    return <Icon className="w-4 h-4 text-gray-500" />;
  };

  const logEntries = useMemo(
    () =>
      activityLogs
        .map((log) => ({
          log,
          summaries: summarizeCustomerLogChanges(log, usersById),
        }))
        .filter((entry) => entry.summaries.length > 0),
    [activityLogs, usersById],
  );

  const recentLogEntries = useMemo(() => logEntries.slice(0, 5), [logEntries]);

  const Paginator: React.FC<{
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  }> = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex justify-end items-center mt-4 text-xs">
        <span className="text-gray-600">
          หน้า {currentPage} / {totalPages}
        </span>
        <div className="flex ml-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-2 py-1 border bg-white rounded-l-md disabled:opacity-50 hover:bg-gray-50"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-2 py-1 border bg-white rounded-r-md disabled:opacity-50 hover:bg-gray-50"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    );
  };

  const totalCallPages = Math.ceil(callHistory.length / ITEMS_PER_PAGE);
  const paginatedCallHistory = callHistory.slice(
    (callHistoryPage - 1) * ITEMS_PER_PAGE,
    callHistoryPage * ITEMS_PER_PAGE,
  );

  const totalAppointmentPages = Math.ceil(appointments.length / ITEMS_PER_PAGE);
  const paginatedAppointments = appointments.slice(
    (appointmentsPage - 1) * ITEMS_PER_PAGE,
    appointmentsPage * ITEMS_PER_PAGE,
  );

  const totalOrderPages = Math.ceil(orders.length / ITEMS_PER_PAGE);
  const paginatedOrders = orders.slice(
    (ordersPage - 1) * ITEMS_PER_PAGE,
    ordersPage * ITEMS_PER_PAGE,
  );

  // Filter appointments to show only future follow-ups that are not completed
  const upcomingFollowUps = appointments
    .filter((appointment) => {
      const appointmentDate = new Date(appointment.date);
      const now = new Date();
      return appointmentDate > now && appointment.status !== "เสร็จสิ้น";
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <header className="flex justify-between items-center mb-6">
        <button
          onClick={onClose}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={20} className="mr-2" />
          <span className="font-semibold text-lg">กลับ</span>
        </button>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => openModal("logCall", customer)}
            className="bg-green-100 text-green-700 py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center hover:bg-green-200"
          >
            <Phone size={16} className="mr-2" />
            บันทึกการโทร
          </button>
          <button
            onClick={() => openModal("addAppointment", customer)}
            className="bg-cyan-100 text-cyan-700 py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center hover:bg-cyan-200"
          >
            <Calendar size={16} className="mr-2" />
            นัดหมาย
          </button>
          <button
            onClick={() => {
              if (onStartCreateOrder) {
                onStartCreateOrder(customer);
              } else {
                openModal("createOrder", { customer });
              }
            }}
            className="bg-amber-100 text-amber-700 py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center hover:bg-amber-200"
          >
            <ShoppingCart size={16} className="mr-2" />
            สร้างคำสั่งซื้อ
          </button>
          <button
            onClick={() => openModal("editCustomer", customer)}
            className="bg-slate-700 text-white py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center hover:bg-slate-800"
          >
            <Edit size={16} className="mr-2" />
            แก้ไข
          </button>
          <button
            onClick={async () => {
              if ((customer as any).isBlocked) return;
              const ok = window.confirm(
                "คุณแน่ใจหรือไม่ว่าต้องการบล็อคลูกค้ารายนี้?",
              );
              if (!ok) return;
              const reason =
                window.prompt(
                  "กรุณาระบุเหตุผลในการบล็อค (อย่างน้อย 5 ตัวอักษร)",
                ) || "";
              if (!reason || reason.trim().length < 5) {
                alert("กรุณากรอกเหตุผลอย่างน้อย 5 ตัวอักษร");
                return;
              }
              try {
                await (
                  await import("../services/api")
                ).createCustomerBlock({
                  customerId: customer.id,
                  reason: reason.trim(),
                  blockedBy: user.id,
                });
                alert("บล็อคลูกค้าเรียบร้อย");
                window.location.reload();
              } catch (e) {
                console.error("block customer failed", e);
                alert("บล็อคลูกค้าไม่สำเร็จ");
              }
            }}
            className={`py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center ${(customer as any).isBlocked ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-red-100 text-red-700 hover:bg-red-200"}`}
          >
            <ShieldAlert size={16} className="mr-2" /> บล็อค
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex justify-between items-start">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                ข้อมูลลูกค้า
              </h2>
              {customer.behavioralStatus === "Hot" && (
                <span className="bg-red-100 text-red-700 text-xs font-semibold px-3 py-1 rounded-full flex items-center">
                  <Flame size={14} className="mr-1.5" />
                  Hot
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
              <InfoItem label="รหัสลูกค้า" value={customer.id} />
              <InfoItem
                label="ชื่อ-นามสกุล"
                value={`${customer.firstName} ${customer.lastName}`}
              />
              <InfoItem label="เบอร์โทร" value={customer.phone} />
              <InfoItem label="อีเมล" value={customer.email || "-"} />
              <InfoItem label="Facebook">
                <div className="flex items-center space-x-2">
                  <Facebook size={16} className="text-blue-600" />
                  <p className="text-sm font-medium text-gray-800">
                    {customer.facebookName || "-"}
                  </p>
                </div>
              </InfoItem>
              <InfoItem label="LINE ID">
                <div className="flex items-center space-x-2">
                  <MessageSquare size={16} className="text-green-500" />
                  <p className="text-sm font-medium text-gray-800">
                    {customer.lineId || "-"}
                  </p>
                </div>
              </InfoItem>
              <InfoItem
                label="ที่อยู่"
                value={formatAddress(customer.address)}
              />
              <InfoItem label="จังหวัด" value={customer.province} />
              <div className="md:col-span-3 border-t my-2"></div>
              <InfoItem label="เกรดลูกค้า" value={customer.grade} />
              <InfoItem
                label="ยอดซื้อรวม"
                value={`฿${customer.totalPurchases.toLocaleString()}`}
              />
              <InfoItem
                label="จำนวนครั้งที่ซื้อ"
                value={`${orders.length} ครั้ง`}
              />
              <InfoItem
                label="จำนวนครั้งที่ติดต่อ"
                value={`${customer.totalCalls} ครั้ง`}
              />
              <InfoItem label="ผู้ดูแล">
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-800 mr-2">
                    {props.ownerName ||
                      (customer.assignedTo ? `ID ${customer.assignedTo}` : "-")}
                  </span>
                  <button className="text-xs text-blue-600 hover:underline">
                    (เปลี่ยนผู้ดูแล)
                  </button>
                </div>
              </InfoItem>
              <InfoItem
                label="วันที่ลงทะเบียน"
                value={
                  customer.dateRegistered
                    ? new Date(customer.dateRegistered).toLocaleString("th-TH")
                    : "-"
                }
              />
              <InfoItem label="ติดตามถัดไป">
                {upcomingFollowUps.length > 0 ? (
                  <span className="font-semibold text-red-600 px-2 py-1 bg-red-50 rounded-md">
                    {new Date(upcomingFollowUps[0].date).toLocaleString(
                      "th-TH",
                    )}
                  </span>
                ) : (
                  "-"
                )}
              </InfoItem>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border">
            <div className="border-b px-4">
              <nav className="flex space-x-4 -mb-px">
                <button
                  onClick={() => setActiveTab("calls")}
                  className={`py-3 px-1 text-sm font-medium ${activeTab === "calls" ? "border-b-2 border-green-600 text-green-600" : "border-transparent text-gray-600 hover:text-gray-700"}`}
                >
                  <Phone size={16} className="inline mr-2" />
                  ประวัติการโทร
                </button>
                <button
                  onClick={() => setActiveTab("appointments")}
                  className={`py-3 px-1 text-sm font-medium ${activeTab === "appointments" ? "border-b-2 border-green-600 text-green-600" : "border-transparent text-gray-600 hover:text-gray-700"}`}
                >
                  <Calendar size={16} className="inline mr-2" />
                  รายการนัดหมาย
                </button>
                <button
                  onClick={() => setActiveTab("orders")}
                  className={`py-3 px-1 text-sm font-medium ${activeTab === "orders" ? "border-b-2 border-green-600 text-green-600" : "border-transparent text-gray-600 hover:text-gray-700"}`}
                >
                  <ShoppingCart size={16} className="inline mr-2" />
                  ประวัติคำสั่งซื้อ
                </button>
              </nav>
            </div>
            <div className="p-4">
              <div className="overflow-x-auto">
                {activeTab === "calls" && (
                  <>
                    <table className="w-full text-xs text-left">
                      <thead className="text-gray-500">
                        <tr>
                          <th className="py-2 px-2">วันที่</th>
                          <th className="py-2 px-2">ผู้โทร</th>
                          <th className="py-2 px-2">สถานะ</th>
                          <th className="py-2 px-2">ผลการโทร</th>
                          <th className="py-2 px-2">พืช/พันธุ์</th>
                          <th className="py-2 px-2">ขนาดสวน</th>
                          <th className="py-2 px-2">หมายเหตุ</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-700">
                        {paginatedCallHistory.map((c) => (
                          <tr key={c.id} className="border-b last:border-0">
                            <td className="py-2 px-2">
                              {new Date(c.date).toLocaleString("th-TH")}
                            </td>
                            <td className="py-2 px-2">{c.caller}</td>
                            <td className="py-2 px-2">
                              <span
                                className={`px-2 py-0.5 rounded-full ${c.status === "รับสาย" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
                              >
                                {c.status}
                              </span>
                            </td>
                            <td className="py-2 px-2">{c.result}</td>
                            <td className="py-2 px-2">{c.cropType || "-"}</td>
                            <td className="py-2 px-2">{c.areaSize || "-"}</td>
                            <td className="py-2 px-2">{c.notes || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <Paginator
                      currentPage={callHistoryPage}
                      totalPages={totalCallPages}
                      onPageChange={setCallHistoryPage}
                    />
                  </>
                )}
                {activeTab === "appointments" && (
                  <>
                    <table className="w-full text-xs text-left">
                      <thead className="text-gray-500">
                        <tr>
                          <th className="py-2 px-2">วันที่นัดหมาย</th>
                          <th className="py-2 px-2">หัวข้อ</th>
                          <th className="py-2 px-2">สถานะ</th>
                          <th className="py-2 px-2">หมายเหตุ</th>
                          <th className="py-2 px-2">การดำเนินการ</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-700">
                        {paginatedAppointments.map((a) => (
                          <tr key={a.id} className="border-b last:border-0">
                            <td className="py-2 px-2">
                              {new Date(a.date).toLocaleString("th-TH")}
                            </td>
                            <td className="py-2 px-2">{a.title}</td>
                            <td className="py-2 px-2">
                              <span
                                className={`px-2 py-0.5 rounded-full ${a.status === "เสร็จสิ้น" ? "bg-gray-100 text-gray-700" : "bg-yellow-100 text-yellow-700"}`}
                              >
                                {a.status}
                              </span>
                            </td>
                            <td className="py-2 px-2">{a.notes || "-"}</td>
                            <td className="py-2 px-2">
                              {a.status === "เสร็จสิ้น" ? (
                                <Check
                                  size={16}
                                  className="text-green-600 inline mr-2"
                                />
                              ) : (
                                props.onCompleteAppointment && (
                                  <button
                                    onClick={() =>
                                      props.onCompleteAppointment!(a.id)
                                    }
                                    className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
                                  >
                                    ทำเครื่องหมายเสร็จ
                                  </button>
                                )
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <Paginator
                      currentPage={appointmentsPage}
                      totalPages={totalAppointmentPages}
                      onPageChange={setAppointmentsPage}
                    />
                  </>
                )}
                {activeTab === "orders" && (
                  <>
                    <table className="w-full text-xs text-left">
                      <thead className="text-gray-500">
                        <tr>
                          <th className="py-2 px-2">OrderID</th>
                          <th className="py-2 px-2">วันที่สั่ง</th>
                          <th className="py-2 px-2">ผู้ขาย</th>
                          <th className="py-2 px-2 text-right">ยอดรวม</th>
                          <th className="py-2 px-2">ชำระเงิน</th>
                          <th className="py-2 px-2">สถานะ</th>
                          <th className="py-2 px-2">รายละเอียดสินค้า</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-700">
                        {paginatedOrders.map((o) => {
                          const seller = o.creatorId
                            ? usersById.get(o.creatorId)
                            : undefined;
                          const sellerName = seller
                            ? `${seller.firstName} ${seller.lastName}`
                            : o.creatorId
                              ? `ID ${o.creatorId}`
                              : "ไม่ระบุ";
                          const detail = orderDetails[o.id];
                          const isExpanded = expandedOrderIds.includes(o.id);
                          const items = detail?.items ?? [];
                          const itemCount = items.length;
                          const loading = detail?.loading;
                          const error = detail?.error;
                          return (
                            <React.Fragment key={o.id}>
                              <tr className="border-b last:border-0">
                                <td className="py-2 px-2 font-mono">{o.id}</td>
                                <td className="py-2 px-2">
                                  {new Date(o.orderDate).toLocaleDateString(
                                    "th-TH",
                                  )}
                                </td>
                                <td className="py-2 px-2">{sellerName}</td>
                                <td className="py-2 px-2 text-right">
                                  {formatCurrency(o.totalAmount)}
                                </td>
                                <td className="py-2 px-2">
                                  {getPaymentStatusChip(
                                    o.paymentStatus,
                                    o.paymentMethod,
                                  )}
                                </td>
                                <td className="py-2 px-2">
                                  {getStatusChip(o.orderStatus)}
                                </td>
                                <td className="py-2 px-2">
                                  <button
                                    onClick={() =>
                                      handleToggleOrderDetails(o.id)
                                    }
                                    className="inline-flex items-center text-xs text-blue-600 hover:underline"
                                  >
                                    {isExpanded ? (
                                      <ChevronUp size={14} className="mr-1" />
                                    ) : (
                                      <ChevronDown size={14} className="mr-1" />
                                    )}
                                    {isExpanded ? "ซ่อนสินค้า" : "ดูสินค้า"}
                                    {itemCount > 0 && !loading
                                      ? ` (${itemCount})`
                                      : ""}
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-gray-50">
                                  <td colSpan={7} className="px-4 py-3">
                                    {loading ? (
                                      <div className="text-xs text-gray-500">
                                        กำลังโหลดรายละเอียดสินค้า...
                                      </div>
                                    ) : error ? (
                                      <div className="text-xs text-red-600">
                                        {error}
                                      </div>
                                    ) : items.length === 0 ? (
                                      <div className="text-xs text-gray-500">
                                        ไม่พบรายการสินค้า
                                      </div>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-xs text-left">
                                          <thead className="text-gray-500 bg-white">
                                            <tr>
                                              <th className="px-3 py-2">
                                                สินค้า
                                              </th>
                                              <th className="px-3 py-2 text-right">
                                                จำนวน
                                              </th>
                                              <th className="px-3 py-2 text-right">
                                                ราคาต่อหน่วย
                                              </th>
                                              <th className="px-3 py-2 text-right">
                                                ส่วนลด
                                              </th>
                                              <th className="px-3 py-2 text-right">
                                                ยอดสุทธิ
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody className="text-gray-700">
                                            {items.map((item, index) => {
                                              const isChild =
                                                item.parentItemId != null &&
                                                !item.isPromotionParent;
                                              const isFreebie = Boolean(
                                                item.isFreebie,
                                              );

                                              const net =
                                                calculateLineNet(item);

                                              // Check if this is the last item in a promotion group
                                              const isLastInPromotion =
                                                item.isPromotionParent &&
                                                (() => {
                                                  const nextItem =
                                                    items[index + 1];
                                                  return (
                                                    !nextItem ||
                                                    nextItem.parentItemId !==
                                                      item.id
                                                  );
                                                })();

                                              // Check if this is a promotion subtotal row (last child or last parent without children)
                                              const isPromotionSubtotal =
                                                (isChild &&
                                                  (() => {
                                                    const nextItem =
                                                      items[index + 1];
                                                    return (
                                                      !nextItem ||
                                                      nextItem.parentItemId !==
                                                        item.parentItemId
                                                    );
                                                  })()) ||
                                                isLastInPromotion;

                                              return (
                                                <tr
                                                  key={item.id}
                                                  className={`border-b last:border-0 ${item.isPromotionParent || isChild ? "bg-orange-50" : ""}`}
                                                >
                                                  <td
                                                    className={`px-3 ${isPromotionSubtotal ? "py-4" : "py-2"}`}
                                                  >
                                                    <span className="font-medium text-gray-800">
                                                      {isChild ? "- " : ""}
                                                      {item.productName ||
                                                        `สินค้า ${item.id}`}
                                                    </span>
                                                    {item.isPromotionParent && (
                                                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px]">
                                                        ชุดโปรโมชั่น
                                                      </span>
                                                    )}
                                                    {isFreebie && (
                                                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px]">
                                                        ของแถม
                                                      </span>
                                                    )}
                                                  </td>
                                                  <td
                                                    className={`px-3 ${isPromotionSubtotal ? "py-4" : "py-2"} text-right`}
                                                  >
                                                    {item.quantity.toLocaleString(
                                                      "th-TH",
                                                    )}
                                                  </td>
                                                  <td
                                                    className={`px-3 ${isPromotionSubtotal ? "py-4" : "py-2"} text-right`}
                                                  >
                                                    {isFreebie
                                                      ? "—"
                                                      : formatCurrency(
                                                          item.pricePerUnit,
                                                        )}
                                                  </td>
                                                  <td
                                                    className={`px-3 ${isPromotionSubtotal ? "py-4" : "py-2"} text-right`}
                                                  >
                                                    {isFreebie
                                                      ? "—"
                                                      : formatCurrency(
                                                          item.discount,
                                                        )}
                                                  </td>
                                                  <td
                                                    className={`px-3 ${isPromotionSubtotal ? "py-4" : "py-2"} text-right font-medium text-gray-800`}
                                                  >
                                                    {isChild ? (
                                                      <div>
                                                        {formatCurrency(net)}
                                                        <div className="text-[10px] text-gray-500 italic">
                                                          รวมในชุด
                                                        </div>
                                                      </div>
                                                    ) : isFreebie ? (
                                                      <span className="text-[10px] text-gray-500 italic">
                                                        ของแถม
                                                      </span>
                                                    ) : (
                                                      <div>
                                                        {formatCurrency(net)}
                                                        {isPromotionSubtotal &&
                                                          item.isPromotionParent && (
                                                            <div className="text-xs text-orange-600 font-semibold mt-1">
                                                              ยอดรวมชุดโปรโมชั่น
                                                            </div>
                                                          )}
                                                      </div>
                                                    )}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                            <tr className="bg-white">
                                              <td
                                                colSpan={4}
                                                className="px-3 py-2 text-right font-semibold text-gray-700"
                                              >
                                                ยอดรวมสินค้า
                                              </td>
                                              <td className="px-3 py-2 text-right font-semibold text-gray-900">
                                                {formatCurrency(
                                                  items.reduce((sum, item) => {
                                                    // เพิ่มเฉพาะ promotion parent และ regular items (ไม่รวมสินค้าลูกใน promotion)
                                                    if (
                                                      item.isPromotionParent ||
                                                      (!item.isPromotionParent &&
                                                        !item.promotionId)
                                                    ) {
                                                      return (
                                                        sum +
                                                        calculateLineNet(item)
                                                      );
                                                    }
                                                    return sum;
                                                  }, 0),
                                                )}
                                              </td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                    <Paginator
                      currentPage={ordersPage}
                      totalPages={totalOrderPages}
                      onPageChange={setOrdersPage}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="font-semibold mb-4 text-gray-700">สถิติสรุป</h3>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {orders.length}
                </p>
                <p className="text-xs text-gray-500">คำสั่งซื้อ</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  ฿{customer.totalPurchases.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">ยอดซื้อรวม</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {customer.totalCalls}
                </p>
                <p className="text-xs text-gray-500">การโทร</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {appointments.length}
                </p>
                <p className="text-xs text-gray-500">นัดหมาย</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {logEntries.length}
                </p>
                <p className="text-xs text-gray-500">กิจกรรม</p>
              </div>
              <div>
                <p
                  className={`text-2xl font-bold ${getRemainingTime(customer.ownershipExpires).color}`}
                >
                  {getRemainingTime(customer.ownershipExpires).text}
                </p>
                <p className="text-xs text-gray-500">เวลาคงเหลือ</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <h3 className="font-semibold mb-2 text-gray-700">TAG</h3>
            <div className="flex flex-wrap gap-2 mb-2 min-h-[24px]">
              {customer.tags.map((tag) => (
                <span
                  key={tag.id}
                  className={`flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${tag.type === TagType.System ? "bg-purple-100 text-purple-800" : "bg-green-100 text-green-800"}`}
                >
                  {tag.name}
                  <button
                    onClick={() => onRemoveTag(customer.id, tag.id)}
                    className="ml-1.5 opacity-70 hover:opacity-100"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex space-x-2">
              <input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                type="text"
                placeholder="เพิ่ม Tag ใหม่..."
                className="flex-grow border rounded-md px-2 py-1 text-sm w-full"
              />
              <button
                onClick={handleAddTag}
                className="bg-gray-800 text-white px-3 rounded-md text-sm font-semibold hover:bg-gray-900"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <h3 className="font-semibold mb-2 text-gray-700">กิจกรรมล่าสุด</h3>
            {activityLogsLoading && (
              <div className="text-sm text-gray-500">กำลังโหลดกิจกรรม...</div>
            )}
            {!activityLogsLoading && activityLogsError && (
              <div className="text-sm text-red-600">{activityLogsError}</div>
            )}
            {!activityLogsLoading &&
              !activityLogsError &&
              recentLogEntries.length === 0 && (
                <div className="text-sm text-gray-500">ยังไม่มีกิจกรรม</div>
              )}
            {!activityLogsLoading &&
              !activityLogsError &&
              recentLogEntries.length > 0 && (
                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                  <table className="w-full text-xs text-left border border-gray-100 rounded-md overflow-hidden">
                    <thead className="bg-gray-50 text-gray-600 uppercase text-[11px]">
                      <tr>
                        <th className="px-3 py-2">เวลา</th>
                        <th className="px-3 py-2">กิจกรรม</th>
                        <th className="px-3 py-2">รายละเอียด</th>
                        <th className="px-3 py-2">ผู้ทำ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {recentLogEntries.map(({ log, summaries }) => {
                        return (
                          <tr key={log.id} className="align-top">
                            <td className="px-3 py-3 whitespace-nowrap text-[11px] text-gray-500">
                              <div className="font-medium text-gray-700">
                                {new Date(log.createdAt).toLocaleString(
                                  "th-TH",
                                  { dateStyle: "medium", timeStyle: "short" },
                                )}
                              </div>
                              <div>{getRelativeTime(log.createdAt)}</div>
                            </td>
                            <td className="px-3 py-3 text-gray-700">
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center">
                                  <ActivityIcon action={log.actionType} />
                                </div>
                                <span className="font-semibold text-gray-800">
                                  {actionLabels[log.actionType] ??
                                    log.actionType}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-gray-600">
                              <div className="space-y-1">
                                {summaries.map((line, idx) => (
                                  <div
                                    key={`${log.id}-summary-${idx}`}
                                    className="flex text-[11px] leading-snug"
                                  >
                                    <span className="mr-1 text-gray-400">
                                      •
                                    </span>
                                    <span>{line}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-gray-600 whitespace-nowrap text-[11px]">
                              {log.createdByName ? log.createdByName : "ระบบ"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            {logEntries.length > 5 &&
              !activityLogsLoading &&
              !activityLogsError && (
                <div className="mt-3 text-center">
                  <button
                    onClick={() =>
                      openModal("viewAllActivities", {
                        customer,
                        logs: logEntries.map((entry) => entry.log),
                      })
                    }
                    className="text-xs text-blue-600 font-semibold hover:underline"
                  >
                    ดูเพิ่มเติม
                  </button>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDetailPage;
