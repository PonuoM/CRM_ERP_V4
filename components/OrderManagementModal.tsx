import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Order,
  OrderStatus,
  Customer,
  PaymentStatus,
  PaymentMethod,
  Address,
  Activity,
  ActivityType,
  User,
  UserRole,
  Product,
  Page,
  Platform,
  Promotion,
} from "../types";
import Modal from "./Modal";
import ProductSelectorModal from "./ProductSelectorModal";
import {
  User as UserIcon,
  Phone,
  MapPin,
  Package,
  CreditCard,
  Truck,
  Paperclip,
  CheckCircle,
  Image,
  Trash2,
  Eye,
  History,
  Repeat,
  XCircle,
  Calendar,
  Edit2,
  Save,
  X,
  CornerDownRight,
  ChevronDown,
  ChevronRight,
  Trash,
} from "lucide-react";
import {
  getPaymentStatusChip,
  getStatusChip,
  ORDER_STATUS_LABELS,
} from "./OrderTable";
import {
  createExportLog,
  createOrderSlip,
  deleteOrderSlip,
  listOrderSlips,
  updateOrderSlip,
  listPages,
  listPlatforms,
  listBankAccounts,
  listPromotions,
  apiFetch,
  patchOrder,
} from "../services/api";
import {
  toLocalDatetimeString,
  fromLocalDatetimeString,
} from "../utils/datetime";
import resolveApiBasePath from "../utils/apiBasePath";

interface OrderManagementModalProps {
  order: Order;

  customers: Customer[];

  activities: Activity[];

  onSave: (updatedOrder: Order) => void;

  onClose: () => void;

  currentUser?: User;
  users?: User[];
  onEditCustomer?: (customer: Customer) => void;
  products?: Product[];
}

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

const activityIconMap: Record<ActivityType, React.ElementType> = {
  [ActivityType.OrderStatusChanged]: Repeat,

  [ActivityType.OrderCancelled]: XCircle,

  [ActivityType.TrackingAdded]: Truck,

  [ActivityType.PaymentVerified]: CheckCircle,

  [ActivityType.OrderCreated]: Package,

  [ActivityType.OrderNoteAdded]: Paperclip,

  // Add other relevant types if needed

  [ActivityType.Assignment]: UserIcon,

  [ActivityType.GradeChange]: UserIcon,

  [ActivityType.StatusChange]: UserIcon,

  [ActivityType.AppointmentSet]: UserIcon,

  [ActivityType.CallLogged]: Phone,
};

const ActivityIcon: React.FC<{ type: ActivityType }> = ({ type }) => {
  const Icon = activityIconMap[type] || History;

  return (
    <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center">
      <Icon className="w-4 h-4 text-gray-500" />
    </div>
  );
};

const getRelativeTime = (timestamp: string) => {
  const now = new Date();
  const past = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return `${diffInSeconds} วินาทีที่แล้ว`;
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} นาทีที่แล้ว`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} ชั่วโมงที่แล้ว`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays} วันที่แล้ว`;
};

const formatISODate = (date: Date) => date.toISOString().slice(0, 10);

const computeOrderTotal = (order: Order) => {
  // Filter out freebie items before calculating total
  const nonFreebieItems = (order.items || []).filter((item: any) => {
    const isFreebie = item.isFreebie || item.is_freebie;
    return !isFreebie;
  });

  const itemsTotal = nonFreebieItems.reduce((sum, item) => {
    const net =
      (item as any).netTotal ??
      item.pricePerUnit * item.quantity - (item.discount || 0);

    return sum + (Number.isFinite(net) ? net : 0);
  }, 0);

  const shipping = Number(order.shippingCost || 0);

  const billDiscount = Number(order.billDiscount || 0);

  return Math.max(0, itemsTotal - billDiscount + shipping);
};

const normalizeDateInputValue = (value?: string | null) => {
  if (!value) return "";

  const trimmed = String(value).trim();

  if (!trimmed) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const direct = new Date(trimmed);

  if (!Number.isNaN(direct.getTime())) {
    return formatISODate(
      new Date(
        Date.UTC(direct.getFullYear(), direct.getMonth(), direct.getDate()),
      ),
    );
  }

  const parts = trimmed.split(/[\\/-]/);

  if (parts.length === 3) {
    const [d, m, y] = parts.map((p) => Number(p));

    if (!Number.isNaN(d) && !Number.isNaN(m) && !Number.isNaN(y)) {
      const rebuilt = new Date(Date.UTC(y, m - 1, d));

      if (!Number.isNaN(rebuilt.getTime())) return formatISODate(rebuilt);
    }
  }

  return "";
};

const OrderManagementModal: React.FC<OrderManagementModalProps> = ({
  order,
  customers = [],
  activities = [],
  onSave,
  onClose,
  currentUser,
  users: propUsers = [],
  onEditCustomer,
  products = [],
  backdropClassName,
}) => {
  const [currentOrder, setCurrentOrder] = useState<Order>(order);

  const [isEditing, setIsEditing] = useState(false);

  const [provinces, setProvinces] = useState<any[]>([]);

  const [districts, setDistricts] = useState<any[]>([]);

  const [subDistricts, setSubDistricts] = useState<any[]>([]);

  const [selectedProvince, setSelectedProvince] = useState<number | null>(null);

  const [selectedDistrict, setSelectedDistrict] = useState<number | null>(null);

  const [selectedSubDistrict, setSelectedSubDistrict] = useState<number | null>(
    null,
  );

  const [provinceSearchTerm, setProvinceSearchTerm] = useState("");

  const [districtSearchTerm, setDistrictSearchTerm] = useState("");

  const [subDistrictSearchTerm, setSubDistrictSearchTerm] = useState("");

  const [showProvinceDropdown, setShowProvinceDropdown] = useState(false);

  const [showDistrictDropdown, setShowDistrictDropdown] = useState(false);

  const [showSubDistrictDropdown, setShowSubDistrictDropdown] = useState(false);

  // Product Selector Modal states
  const [productSelectorOpen, setProductSelectorOpen] = useState(false);
  const [selectorTab, setSelectorTab] = useState<"products" | "promotions">(
    "products",
  );
  const [selectorSearchTerm, setSelectorSearchTerm] = useState("");
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [expandedPromotions, setExpandedPromotions] = useState<Set<number>>(
    new Set(),
  );

  // Prevent duplicate fetches for the same order
  const lastFetchedOrderId = useRef<number | null>(null);

  const updateShippingAddress = (patch: Partial<Address>) => {
    setCurrentOrder((prev) => ({
      ...prev,

      shippingAddress: {
        ...prev.shippingAddress,

        ...patch,
      },
    }));
  };

  const filteredProvinces = useMemo(() => {
    const term = provinceSearchTerm.trim().toLowerCase();

    if (!term) return provinces;

    return provinces.filter((p) =>
      (p.name_th || "").toLowerCase().includes(term),
    );
  }, [provinces, provinceSearchTerm]);

  const filteredDistricts = useMemo(() => {
    const term = districtSearchTerm.trim().toLowerCase();

    if (!term) return districts;

    return districts.filter((d) =>
      (d.name_th || "").toLowerCase().includes(term),
    );
  }, [districts, districtSearchTerm]);

  const filteredSubDistricts = useMemo(() => {
    const term = subDistrictSearchTerm.trim().toLowerCase();

    if (!term) return subDistricts;

    return subDistricts.filter(
      (sd) =>
        (sd.name_th || "").toLowerCase().includes(term) ||
        (sd.zip_code || "").toLowerCase().includes(term),
    );
  }, [subDistricts, subDistrictSearchTerm]);

  // Load address data on mount
  useEffect(() => {
    const loadProvinces = async () => {
      try {
        const response = await fetch(
          `${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=provinces`,
        );
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setProvinces(data.data || []);
          }
        }
      } catch (error) {
        console.error("Error loading provinces:", error);
      }
    };
    loadProvinces();
  }, []);

  // Load districts when province selected
  useEffect(() => {
    if (selectedProvince) {
      fetch(
        `${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=districts&id=${selectedProvince}`,
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.success) setDistricts(data.data || []);
        })
        .catch((err) => console.error(err));
    } else {
      setDistricts([]);
    }
  }, [selectedProvince]);

  // Load subdistricts when district selected
  useEffect(() => {
    if (selectedDistrict) {
      fetch(
        `${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=sub_districts&id=${selectedDistrict}`,
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.success) setSubDistricts(data.data || []);
        })
        .catch((err) => console.error(err));
    } else {
      setSubDistricts([]);
    }
  }, [selectedDistrict]);

  // Initialize selections from current order address
  useEffect(() => {
    const addr = currentOrder.shippingAddress || {};

    // 1. Set text inputs
    setProvinceSearchTerm(addr.province || "");
    setDistrictSearchTerm(addr.district || "");
    setSubDistrictSearchTerm(addr.subdistrict || "");

    // 2. Try to match IDs if provinces loaded
    if (provinces.length > 0 && addr.province) {
      const province = provinces.find((p) => p.name_th === addr.province);
      if (province) {
        setSelectedProvince(province.id);
        // Districts will load via effect
      }
    }
  }, [currentOrder.shippingAddress?.province, provinces.length]); // Re-run when provinces load or addr changes

  // 3. Try to match District ID when Districts loaded
  useEffect(() => {
    const addr = currentOrder.shippingAddress || {};
    if (selectedProvince && districts.length > 0 && addr.district) {
      const district = districts.find((d) => d.name_th === addr.district);
      if (district) {
        setSelectedDistrict(district.id);
      }
    }
  }, [
    districts.length,
    selectedProvince,
    currentOrder.shippingAddress?.district,
  ]);

  // 4. Try to match Subdistrict ID when Subdistricts loaded
  useEffect(() => {
    const addr = currentOrder.shippingAddress || {};
    if (selectedDistrict && subDistricts.length > 0 && addr.subdistrict) {
      const sub = subDistricts.find((s) => s.name_th === addr.subdistrict);
      if (sub) {
        setSelectedSubDistrict(sub.id);
      }
    }
  }, [
    subDistricts.length,
    selectedDistrict,
    currentOrder.shippingAddress?.subdistrict,
  ]);

  const sanitizeAddressPart = (value?: string | null) => {
    if (!value) return "";

    const trimmed = value.trim();

    const lower = trimmed.toLowerCase();

    if (!trimmed || lower === "undefined" || lower === "null") {
      return "";
    }

    return trimmed;
  };

  const mergeAddressPart = (incoming: any, previous?: string | null) => {
    const incomingString =
      typeof incoming === "string"
        ? incoming
        : incoming == null
          ? ""
          : String(incoming);

    const cleanedIncoming = sanitizeAddressPart(incomingString);

    if (cleanedIncoming) return cleanedIncoming;

    return sanitizeAddressPart(previous ?? "");
  };

  // ตรวจสอบว่า order เสร็จสิ้นแล้วหรือไม่ (ไม่สามารถแก้ไขได้)
  const isOrderCompleted = currentOrder.orderStatus === OrderStatus.Delivered;

  const canVerifySlip =
    currentUser?.role === UserRole.Backoffice ||
    currentUser?.role === UserRole.Admin ||
    currentUser?.role === UserRole.SuperAdmin;
  const canEditPayAfterSlips =
    currentOrder?.paymentMethod === PaymentMethod.PayAfter;
  const canEditSlips =
    !isOrderCompleted && (canVerifySlip || canEditPayAfterSlips);

  const initialSlips = Array.isArray((order as any).slips)
    ? (order as any).slips.map((s: any) => ({
      id: Number(s.id),

      url: String(s.url),

      uploadedBy:
        typeof s.uploadedBy !== "undefined"
          ? Number(s.uploadedBy)
          : typeof s.uploaded_by !== "undefined"
            ? Number(s.uploaded_by)
            : undefined,

      uploadedByName:
        s.uploadedByName ?? s.uploaded_by_name ?? s.upload_by_name,

      createdAt: s.createdAt ?? s.created_at,

      amount: typeof s.amount !== "undefined" ? Number(s.amount) : undefined,

      bankAccountId:
        typeof s.bank_account_id !== "undefined"
          ? Number(s.bank_account_id)
          : typeof s.bankAccountId !== "undefined"
            ? Number(s.bankAccountId)
            : undefined,

      transferDate: s.transfer_date ?? s.transferDate,
    }))
    : [];

  const [slipPreview, setSlipPreview] = useState<string | null>(
    order.slipUrl || (initialSlips[0]?.url ?? null),
  );

  const [users, setUsers] = useState<User[]>(propUsers);
  const [pages, setPages] = useState<Page[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [slips, setSlips] =
    useState<
      {
        id: number;
        url: string;
        uploadedBy?: number;
        uploadedByName?: string;
        createdAt?: string;
        amount?: number;
        bankAccountId?: number;
        transferDate?: string;
      }[]
    >(initialSlips);

  const [lightboxSlip, setLightboxSlip] = useState<{
    id?: number;
    url: string;
    uploadedBy?: number;
    uploadedByName?: string;
    createdAt?: string;
    amount?: number;
    bankAccountId?: number;
    transferDate?: string;
  } | null>(null);

  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  const resolveUploaderName = (
    uploadedBy?: number,
    uploadedByName?: string,
  ) => {
    if (uploadedByName) return uploadedByName;

    if (!uploadedBy) return undefined;

    const u = users.find((user) => user.id === uploadedBy);

    return u ? `${u.firstName} ${u.lastName} ` : undefined;
  };

  const resolveBankName = (bankAccountId?: number) => {
    if (!bankAccountId) return undefined;

    const acc = bankAccounts.find(
      (ba) => Number(ba.id) === Number(bankAccountId),
    );

    if (!acc) return `ID: ${bankAccountId} `;

    const bank = acc.bank ?? acc.name ?? "";

    const number = acc.bank_number ?? acc.account_number ?? "";

    return `${bank} ${number} `.trim() || `ID: ${bankAccountId} `;
  };

  const formatSlipDateTime = (value?: string) => {
    if (!value) return undefined;

    const dt = new Date(value);

    if (Number.isNaN(dt.getTime())) return value;

    return dt.toLocaleString("th-TH", {
      year: "numeric",

      month: "2-digit",

      day: "2-digit",

      hour: "2-digit",

      minute: "2-digit",
    });
  };

  const deliveryWindow = useMemo(() => {
    const now = new Date();

    const todayUtc = new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
    );

    const maxUtc = new Date(
      Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth() + 1, 7),
    );

    return {
      min: todayUtc,

      max: maxUtc,

      minIso: formatISODate(todayUtc),

      maxIso: formatISODate(maxUtc),
    };
  }, []);

  const deliveryDateInputValue = useMemo(
    () =>
      normalizeDateInputValue(currentOrder.deliveryDate || order.deliveryDate),

    [currentOrder.deliveryDate, order.deliveryDate],
  );

  useEffect(() => {
    const nextSlips = Array.isArray((order as any).slips)
      ? (order as any).slips.map((s: any) => ({
        id: Number(s.id),

        url: String(s.url),

        uploadedBy:
          typeof s.uploadedBy !== "undefined"
            ? Number(s.uploadedBy)
            : typeof s.uploaded_by !== "undefined"
              ? Number(s.uploaded_by)
              : undefined,

        uploadedByName:
          s.uploadedByName ?? s.uploaded_by_name ?? s.upload_by_name,

        createdAt: s.createdAt ?? s.created_at,

        amount:
          typeof s.amount !== "undefined" ? Number(s.amount) : undefined,

        bankAccountId:
          typeof s.bank_account_id !== "undefined"
            ? Number(s.bank_account_id)
            : typeof s.bankAccountId !== "undefined"
              ? Number(s.bankAccountId)
              : undefined,

        transferDate: s.transfer_date ?? s.transferDate,
      }))
      : [];

    const normalizedDelivery = normalizeDateInputValue(order.deliveryDate);

    const hydrated = {
      ...order,

      deliveryDate: normalizedDelivery || order.deliveryDate,
    };

    const computedTotal = computeOrderTotal(hydrated as Order);

    setCurrentOrder({
      ...hydrated,

      totalAmount: Number.isFinite(computedTotal)
        ? computedTotal
        : hydrated.totalAmount,
    });

    setSlips(nextSlips);

    setSlipPreview(order.slipUrl || (nextSlips[0]?.url ?? null));
  }, [order]);

  const isModifiable = useMemo(() => {
    return [OrderStatus.Pending, OrderStatus.AwaitingVerification].includes(
      currentOrder.orderStatus,
    );
  }, [currentOrder.orderStatus]);

  const showInputs = isModifiable && isEditing;

  const sortedItemsWithIndex = useMemo(() => {
    const items = currentOrder.items || [];
    // Map items to include their original index
    const itemsWithIndex = items.map((item, index) => ({ item, index }));

    // Group children by parentItemId
    const childrenMap = new Map<number, typeof itemsWithIndex>();
    itemsWithIndex.forEach((entry) => {
      const parentId = (entry.item as any).parentItemId;
      if (parentId) {
        if (!childrenMap.has(parentId)) {
          childrenMap.set(parentId, []);
        }
        childrenMap.get(parentId)?.push(entry);
      }
    });

    const sorted: typeof itemsWithIndex = [];
    const processedChildren = new Set<number>();

    // Iterate through items to build sorted list
    itemsWithIndex.forEach((entry) => {
      // If it's a child, skip (will be added after parent)
      if ((entry.item as any).parentItemId) return;

      // Add parent/regular item
      sorted.push(entry);

      // Check if this item is a parent and add its children immediately after
      const itemId = entry.item.id;
      if (childrenMap.has(itemId)) {
        const children = childrenMap.get(itemId) || [];
        children.forEach((child) => {
          sorted.push(child);
          processedChildren.add(child.index);
        });
      }
    });

    return sorted;
  }, [currentOrder.items]);

  const handleAddItem = () => {
    if (!currentUser) return;

    // Open product selector modal instead of adding empty item
    setProductSelectorOpen(true);
    setSelectorTab("products");
    setSelectorSearchTerm("");
  };

  const closeProductSelector = () => {
    setProductSelectorOpen(false);
    setSelectorSearchTerm("");
  };

  const handleSelectProduct = (productId: number) => {
    if (!currentUser) return;

    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const newItem = {
      id: Date.now(),
      productId: product.id,
      productName: product.name,
      quantity: 1,
      pricePerUnit: product.price,
      discount: 0,
      isFreebie: false,
      boxNumber: 1,
      creatorId: currentUser.id,
    };

    setCurrentOrder((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));

    closeProductSelector();
  };

  const handleSelectPromotion = (promotionId: number | string) => {
    if (!currentUser) return;

    const promotion = promotions.find((p) => p.id === Number(promotionId));
    if (!promotion || !promotion.items || promotion.items.length === 0) return;

    // Calculate total price from non-freebie items
    const totalPrice = promotion.items.reduce((sum: number, item: any) => {
      const isFreebie = item.isFreebie || item.is_freebie;
      if (isFreebie) return sum;
      const priceOverride = item.priceOverride ?? item.price_override;
      return sum + (priceOverride ? Number(priceOverride) : 0);
    }, 0);

    // Create parent promotion item
    const parentItemId = Date.now();
    const parentItem = {
      id: parentItemId,
      productId: 0, // No specific product for parent
      productName:
        promotion.name || promotion.sku || `โปรโมชั่น #${promotion.id}`,
      quantity: 1,
      pricePerUnit: totalPrice, // Total price from children
      discount: 0,
      isFreebie: false,
      boxNumber: 1,
      creatorId: currentUser.id,
      promotionId: promotion.id,
      isPromotionParent: true, // Flag to identify parent items
    };

    // Create child items for each product in promotion
    const childItems = promotion.items.map((item: any, index: number) => ({
      id: Date.now() + index + 1,
      productId: item.productId || item.product_id,
      productName: item.product_name || item.product?.name || item.sku || "",
      quantity: item.quantity || 1,
      originalQuantity: item.quantity || 1, // Store original quantity for multiplication
      pricePerUnit: item.product_price ? Number(item.product_price) : 0, // Use product_price for unit price
      discount: 0,
      isFreebie: item.isFreebie || item.is_freebie || false,
      boxNumber: 1,
      creatorId: currentUser.id,
      promotionId: promotion.id,
      parentItemId: parentItemId, // Link to parent
    }));

    setCurrentOrder((prev) => ({
      ...prev,
      items: [...prev.items, parentItem, ...childItems],
    }));

    closeProductSelector();
  };

  const handleRemoveItem = (itemToRemove: any) => {
    // Find the actual index in the unsorted currentOrder.items array
    const actualIndex = currentOrder.items.findIndex((item) => {
      // Match by unique combination of boxNumber and productId
      const sameBox =
        (item.boxNumber || (item as any).box_number) ===
        (itemToRemove.boxNumber || (itemToRemove as any).box_number);
      const sameProduct = item.productId === itemToRemove.productId;
      return sameBox && sameProduct;
    });

    if (actualIndex === -1) {
      console.error("Item to remove not found in currentOrder.items");
      return;
    }

    setCurrentOrder((prev) => {
      const newItems = [...prev.items];
      newItems.splice(actualIndex, 1);

      let newBoxes = prev.boxes || [];
      // If the removed item had a box number, checks if any other items remain in that box
      if (itemToRemove && itemToRemove.boxNumber) {
        const hasItemsInBox = newItems.some(
          (i) => i.boxNumber === itemToRemove.boxNumber,
        );
        if (!hasItemsInBox) {
          // No items left in this box, remove it
          newBoxes = newBoxes.filter(
            (b) => b.boxNumber !== itemToRemove.boxNumber,
          );
        }
      }

      // Recalculate COD total if needed
      let newCodAmount = prev.codAmount;
      if (prev.paymentMethod === PaymentMethod.COD) {
        newCodAmount = newBoxes.reduce(
          (sum, b) => sum + (b.collectionAmount ?? b.codAmount ?? 0),
          0,
        );
      }

      return {
        ...prev,
        items: newItems,
        boxes: newBoxes,
        codAmount: newCodAmount,
      };
    });
  };

  const handleCodBoxCountChange = (count: number) => {
    const newCount = Math.max(1, count);
    setCurrentOrder((prev) => {
      let boxes = [...(prev.boxes || [])];
      if (newCount > boxes.length) {
        // Add boxes
        for (let i = boxes.length + 1; i <= newCount; i++) {
          boxes.push({
            boxNumber: i,
            codAmount: 0,
            collectionAmount: 0,
          });
        }
      } else if (newCount < boxes.length) {
        // Remove boxes
        boxes = boxes.filter((b) => b.boxNumber <= newCount);
      }

      // Recalc total
      const codTotal =
        prev.paymentMethod === PaymentMethod.COD
          ? boxes.reduce(
            (sum, b) => sum + (b.collectionAmount ?? b.codAmount ?? 0),
            0,
          )
          : prev.codAmount;

      return { ...prev, boxes, codAmount: codTotal };
    });
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setCurrentOrder((prev) => {
      const newItems = [...prev.items];

      newItems[index] = { ...newItems[index], [field]: value };

      return { ...prev, items: newItems };
    });
  };

  const handleProductChange = (index: number, productId: number) => {
    const product = products.find((p) => p.id === productId);

    if (product) {
      setCurrentOrder((prev) => {
        const newItems = [...prev.items];
        newItems[index] = {
          ...newItems[index],
          productId: product.id,
          productName: product.name,
          pricePerUnit: product.price,
        };
        return { ...prev, items: newItems };
      });
    } else {
      handleItemChange(index, "productId", productId);
    }
  };

  // Fetch bank accounts for display

  useEffect(() => {
    if (!currentUser?.companyId) return;

    let cancelled = false;

    (async () => {
      try {
        const accounts = await listBankAccounts(currentUser.companyId, true);

        if (!cancelled) {
          setBankAccounts(accounts || []);
        }
      } catch (e) {
        console.error("Failed to load bank accounts", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.companyId]);

  // Fetch platforms and pages
  useEffect(() => {
    if (!currentUser?.companyId) return;

    let cancelled = false;

    const fetchData = async () => {
      try {
        const [platformsData, pagesData] = await Promise.all([
          listPlatforms(currentUser.companyId, true, currentUser.role),
          listPages(currentUser.companyId),
        ]);

        if (!cancelled) {
          if (Array.isArray(platformsData)) {
            setPlatforms(platformsData);
          } else if (platformsData && Array.isArray(platformsData.rows)) {
            setPlatforms(platformsData.rows);
          }

          if (Array.isArray(pagesData)) {
            setPages(pagesData);
          } else if (pagesData && Array.isArray(pagesData.rows)) {
            setPages(pagesData.rows);
          }
        }
      } catch (error) {
        console.error("Error loading platforms/pages:", error);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.companyId]);

  // Fetch promotions for product selector
  useEffect(() => {
    if (!currentUser?.companyId) return;

    const fetchPromotions = async () => {
      try {
        const response = await listPromotions(currentUser.companyId);
        if (Array.isArray(response)) {
          setPromotions(response);
        }
      } catch (error) {
        console.error("Error fetching promotions:", error);
      }
    };

    fetchPromotions();
  }, [currentUser?.companyId]);

  // Fetch full order details if minimal data is passed in

  useEffect(() => {
    let cancelled = false;

    const needsItems = !order.items || order.items.length === 0;

    const needsBoxes =
      !Array.isArray((order as any).boxes) ||
      (order as any).boxes.length === 0 ||
      (Array.isArray((order as any).boxes) &&
        (order as any).boxes.every(
          (b: any) =>
            Number(
              b.collectionAmount ??
              b.codAmount ??
              b.cod_amount ??
              b.collection_amount ??
              0,
            ) === 0,
        ));

    const needsSlip = typeof order.slipUrl === "undefined";

    // Guard against duplicate requests for the same order ID
    if (!needsItems && !needsBoxes && !needsSlip) return;
    if (lastFetchedOrderId.current === order.id) return;

    lastFetchedOrderId.current = order.id;

    (async () => {
      try {
        const r: any = await apiFetch(`orders/${encodeURIComponent(order.id)}`);

        if (cancelled) return;

        const trackingDetails = Array.isArray(r.trackingDetails)
          ? r.trackingDetails
          : Array.isArray(r.tracking_details)
            ? r.tracking_details
            : [];

        setCurrentOrder((prev) => ({
          ...prev,

          slipUrl: r.slip_url ?? prev.slipUrl,

          amountPaid:
            typeof r.amount_paid !== "undefined"
              ? Number(r.amount_paid)
              : prev.amountPaid,

          codAmount:
            typeof r.cod_amount !== "undefined"
              ? Number(r.cod_amount)
              : (prev as any).codAmount,

          bankAccountId:
            typeof r.bank_account_id !== "undefined"
              ? Number(r.bank_account_id)
              : prev.bankAccountId,

          transferDate: r.transfer_date ?? prev.transferDate,

          shippingAddress: {
            recipientFirstName: mergeAddressPart(
              r.recipient_first_name,
              prev.shippingAddress?.recipientFirstName,
            ),

            recipientLastName: mergeAddressPart(
              r.recipient_last_name,
              prev.shippingAddress?.recipientLastName,
            ),

            street: mergeAddressPart(r.street, prev.shippingAddress?.street),

            subdistrict: mergeAddressPart(
              r.subdistrict,
              prev.shippingAddress?.subdistrict,
            ),

            district: mergeAddressPart(
              r.district,
              prev.shippingAddress?.district,
            ),

            province: mergeAddressPart(
              r.province,
              prev.shippingAddress?.province,
            ),

            postalCode: mergeAddressPart(
              r.postal_code,
              prev.shippingAddress?.postalCode,
            ),
          },

          items: Array.isArray(r.items)
            ? r.items.map((it: any, i: number) => ({
              id: Number(it.id ?? i + 1),

              productId:
                typeof it.product_id !== "undefined" && it.product_id !== null
                  ? Number(it.product_id)
                  : undefined,

              productName: String(it.product_name ?? ""),

              quantity: Number(it.quantity ?? 0),

              pricePerUnit: Number(it.price_per_unit ?? 0),

              discount: Number(it.discount ?? 0),

              isFreebie: !!(it.is_freebie ?? 0),

              boxNumber: Number(it.box_number ?? 0),

              creatorId:
                typeof it.creator_id !== "undefined" && it.creator_id !== null
                  ? Number(it.creator_id)
                  : undefined,
            }))
            : prev.items,

          boxes: Array.isArray(r.boxes)
            ? r.boxes.map((b: any) => {
              const boxNum = Number(b.box_number ?? 0);

              const trackingForBox = trackingDetails.find((t: any) => {
                if (
                  typeof t.box_number !== "undefined" &&
                  t.box_number !== null
                ) {
                  return Number(t.box_number) === boxNum;
                }

                return false;
              });

              return {
                boxNumber: boxNum,

                codAmount: Number(b.cod_amount ?? b.collection_amount ?? 0),

                collectionAmount: Number(
                  b.collection_amount ?? b.cod_amount ?? 0,
                ),

                collectedAmount: Number(b.collected_amount ?? 0),

                waivedAmount: Number(b.waived_amount ?? 0),

                paymentMethod: b.payment_method ?? prev.paymentMethod,

                status: b.status ?? undefined,

                subOrderId: b.sub_order_id ?? undefined,

                trackingNumber: trackingForBox
                  ? String(
                    trackingForBox.tracking_number ??
                    trackingForBox.trackingNumber ??
                    "",
                  )
                  : undefined,
              };
            })
            : (prev as any).boxes,

          trackingNumbers: Array.isArray(r.trackingNumbers)
            ? r.trackingNumbers
            : typeof r.tracking_numbers === "string"
              ? String(r.tracking_numbers).split(",").filter(Boolean)
              : prev.trackingNumbers,
        }));

        if (Array.isArray(r.slips)) {
          try {
            const nextSlips = r.slips.map((s: any) => ({
              id: Number(s.id),

              url: String(s.url),

              uploadedBy:
                typeof s.uploadedBy !== "undefined"
                  ? Number(s.uploadedBy)
                  : typeof s.uploaded_by !== "undefined"
                    ? Number(s.uploaded_by)
                    : undefined,

              uploadedByName:
                s.uploadedByName ?? s.uploaded_by_name ?? s.upload_by_name,

              createdAt: s.createdAt ?? s.created_at,

              amount:
                typeof s.amount !== "undefined" ? Number(s.amount) : undefined,

              bankAccountId:
                typeof s.bank_account_id !== "undefined"
                  ? Number(s.bank_account_id)
                  : typeof s.bankAccountId !== "undefined"
                    ? Number(s.bankAccountId)
                    : undefined,

              transferDate: s.transfer_date ?? s.transferDate,
            }));

            setSlips(nextSlips);

            if (!currentOrder.slipUrl && !slipPreview && nextSlips.length > 0) {
              setSlipPreview(nextSlips[0].url);
            }
          } catch {
            /* ignore */
          }
        }
      } catch (e) {
        console.error("Failed loading order details", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [order]);

  // Ensure slip history is available even when the minimal order payload already has a slipUrl

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res: any = await listOrderSlips(order.id);

        if (cancelled) return;

        const fetched = Array.isArray(res)
          ? res
          : Array.isArray(res?.rows)
            ? res.rows
            : [];

        if (Array.isArray(fetched) && fetched.length > 0) {
          const normalized = fetched

            .map((s: any) => ({
              id: Number(s.id),

              url: String(s.url),

              uploadedBy:
                typeof s.uploadedBy !== "undefined"
                  ? Number(s.uploadedBy)
                  : typeof s.uploaded_by !== "undefined"
                    ? Number(s.uploaded_by)
                    : undefined,

              uploadedByName:
                s.uploadedByName ?? s.uploaded_by_name ?? s.upload_by_name,

              createdAt: s.createdAt ?? s.created_at,

              amount:
                typeof s.amount !== "undefined" ? Number(s.amount) : undefined,

              bankAccountId:
                typeof s.bank_account_id !== "undefined"
                  ? Number(s.bank_account_id)
                  : typeof s.bankAccountId !== "undefined"
                    ? Number(s.bankAccountId)
                    : undefined,

              transferDate: s.transfer_date ?? s.transferDate,
            }))

            .filter((slip) => slip.id && slip.url);

          if (normalized.length > 0) {
            setSlips((prev) => {
              const byId: Record<number, (typeof normalized)[number]> = {};

              normalized.forEach((slip) => {
                byId[slip.id] = slip;
              });

              const merged = prev.map((slip) => {
                const enriched = byId[slip.id];

                if (enriched) {
                  return {
                    ...slip,

                    ...enriched,

                    uploadedBy: enriched.uploadedBy ?? slip.uploadedBy,

                    uploadedByName:
                      enriched.uploadedByName ?? slip.uploadedByName,

                    createdAt: enriched.createdAt ?? slip.createdAt,
                  };
                }

                return slip;
              });

              // add new ones not previously in list
              normalized.forEach((slip) => {
                if (
                  !merged.some((s) => s.id === slip.id || s.url === slip.url)
                ) {
                  merged.push(slip);
                }
              });

              return merged;
            });
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error loading slips:", error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [order.id]);

  const customer = useMemo(() => {
    return customers.find((c) => {
      if (c.pk && typeof order.customerId === "number") {
        return c.pk === order.customerId;
      }

      return (
        String(c.id) === String(order.customerId) ||
        String(c.pk) === String(order.customerId)
      );
    });
  }, [customers, order.customerId]);

  const orderActivities = useMemo(() => {
    return activities

      .filter((a) => a.description.includes(order.id))

      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
  }, [activities, order.id]);

  const slipUploadInputId = useMemo(
    () => `slip - upload - ${order.id} `,
    [order.id],
  );

  const handleFieldChange = (field: keyof Order, value: any) => {
    setCurrentOrder((prev) => ({ ...prev, [field]: value }));
  };

  const openSlipViewer = (slip: {
    id?: number;
    url: string;
    uploadedBy?: number;
    uploadedByName?: string;
    createdAt?: string;
    amount?: number;
    bankAccountId?: number;
    transferDate?: string;
  }) => {
    setLightboxSlip(slip);
  };

  const handleDeliveryDateChange = (raw: string) => {
    const normalized = normalizeDateInputValue(raw);

    if (!normalized) {
      handleFieldChange("deliveryDate", "");

      return;
    }

    const selected = new Date(`${normalized} T00:00:00Z`);

    if (selected < deliveryWindow.min || selected > deliveryWindow.max) {
      alert(
        `วันที่จัดส่งต้องไม่ต่ำกว่าวันนี้ และต้องไม่เกินวันที่ ${deliveryWindow.maxIso.split("-").reverse().join("/")} `,
      );

      return;
    }

    handleFieldChange("deliveryDate", normalized);
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `${resolveApiBasePath()} /Address_DB/get_address_data.php ? endpoint = provinces`,
        );

        if (!res.ok) return;

        const data = await res.json();

        if (data?.success) setProvinces(data.data || []);
      } catch (e) {
        console.error("load provinces failed", e);
      }
    })();
  }, []);

  useEffect(() => {
    if (selectedProvince) {
      (async () => {
        try {
          const res = await fetch(
            `${resolveApiBasePath()} /Address_DB/get_address_data.php ? endpoint = districts & id=${selectedProvince} `,
          );

          if (!res.ok) return;

          const data = await res.json();

          if (data?.success) setDistricts(data.data || []);
        } catch (e) {
          console.error("load districts failed", e);
        }
      })();
    } else {
      setDistricts([]);

      setSelectedDistrict(null);

      setSubDistricts([]);

      setSelectedSubDistrict(null);
    }
  }, [selectedProvince]);

  useEffect(() => {
    if (selectedDistrict) {
      (async () => {
        try {
          const res = await fetch(
            `${resolveApiBasePath()} /Address_DB/get_address_data.php ? endpoint = sub_districts & id=${selectedDistrict} `,
          );

          if (!res.ok) return;

          const data = await res.json();

          if (data?.success) setSubDistricts(data.data || []);
        } catch (e) {
          console.error("load subdistricts failed", e);
        }
      })();
    } else {
      setSubDistricts([]);

      setSelectedSubDistrict(null);
    }
  }, [selectedDistrict]);

  useEffect(() => {
    // Hydrate selection from existing address once provinces are loaded

    if (!provinces.length) return;

    const address = currentOrder.shippingAddress || {};

    if (!selectedProvince && address.province) {
      const matchProv = provinces.find(
        (p) => (p.name_th || "").trim() === (address.province || "").trim(),
      );

      if (matchProv) {
        setSelectedProvince(matchProv.id);

        setProvinceSearchTerm(matchProv.name_th);
      }
    }
  }, [provinces, currentOrder.shippingAddress, selectedProvince]);

  useEffect(() => {
    // Hydrate district when options loaded

    if (!districts.length) return;

    const address = currentOrder.shippingAddress || {};

    if (!selectedDistrict && address.district) {
      const match = districts.find(
        (d) => (d.name_th || "").trim() === (address.district || "").trim(),
      );

      if (match) {
        setSelectedDistrict(match.id);

        setDistrictSearchTerm(match.name_th);
      }
    }
  }, [districts, currentOrder.shippingAddress, selectedDistrict]);

  useEffect(() => {
    // Hydrate subdistrict when options loaded

    if (!subDistricts.length) return;

    const address = currentOrder.shippingAddress || {};

    if (!selectedSubDistrict && address.subdistrict) {
      const match = subDistricts.find(
        (sd) =>
          (sd.name_th || "").trim() === (address.subdistrict || "").trim(),
      );

      if (match) {
        setSelectedSubDistrict(match.id);

        setSubDistrictSearchTerm(match.name_th);

        setCurrentOrder((prev) => ({
          ...prev,

          shippingAddress: {
            ...prev.shippingAddress,

            subdistrict: match.name_th || "",

            postalCode:
              match.zip_code || prev.shippingAddress?.postalCode || "",
          },
        }));
      }
    }
  }, [subDistricts, currentOrder.shippingAddress, selectedSubDistrict]);

  useEffect(() => {
    if (!currentOrder.items || currentOrder.items.length === 0) return;

    const computedTotal = calculateOrderTotal(
      currentOrder.items,
      currentOrder.shippingCost,
      currentOrder.billDiscount,
    );

    if (
      Number.isFinite(computedTotal) &&
      Math.abs(computedTotal - (currentOrder.totalAmount ?? 0)) > 0.009
    ) {
      setCurrentOrder((prev) => ({ ...prev, totalAmount: computedTotal }));
    }
  }, [
    currentOrder.items,
    currentOrder.shippingCost,
    currentOrder.billDiscount,
  ]);

  const handleSelectProvince = (province: any) => {
    setSelectedProvince(province.id);

    setProvinceSearchTerm(province.name_th);

    setSelectedDistrict(null);

    setDistrictSearchTerm("");

    setSelectedSubDistrict(null);

    setSubDistrictSearchTerm("");

    updateShippingAddress({
      province: province.name_th || "",

      district: "",

      subdistrict: "",

      postalCode: "",
    });
  };

  const handleSelectDistrict = (district: any) => {
    setSelectedDistrict(district.id);

    setDistrictSearchTerm(district.name_th);

    setSelectedSubDistrict(null);

    setSubDistrictSearchTerm("");

    updateShippingAddress({
      district: district.name_th || "",

      subdistrict: "",

      postalCode: "",
    });
  };

  const handleSelectSubDistrict = (sub: any) => {
    setSelectedSubDistrict(sub.id);

    setSubDistrictSearchTerm(sub.name_th);

    const parentDistrict = districts.find((d) => d.id === sub.district_id);

    const parentProvince = provinces.find(
      (p) => p.id === parentDistrict?.province_id,
    );

    updateShippingAddress({
      subdistrict: sub.name_th || "",

      district:
        parentDistrict?.name_th || currentOrder.shippingAddress?.district || "",

      province:
        parentProvince?.name_th || currentOrder.shippingAddress?.province || "",

      postalCode:
        sub.zip_code || currentOrder.shippingAddress?.postalCode || "",
    });
  };

  const handleSlipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.currentTarget as HTMLInputElement | null;

    const files = inputEl?.files ? Array.from(inputEl.files) : [];

    if (!files || files.length === 0) return;

    for (const file of files) {
      await new Promise<void>((resolve) => {
        const reader = new FileReader();

        reader.onloadend = async () => {
          const dataUrl = reader.result as string;

          try {
            const res = await createOrderSlip(currentOrder.id, dataUrl, {
              uploadedBy: currentUser?.id,

              uploadedByName: currentUser
                ? `${currentUser.firstName} ${currentUser.lastName} `
                : undefined,

              bankAccountId: currentOrder.bankAccountId
                ? Number(currentOrder.bankAccountId)
                : undefined,

              transferDate: new Date().toISOString(),

              amount: Number(
                calculatedTotals.totalAmount || currentOrder.amountPaid || 0,
              ),
            });

            if (res && res.id && res.url) {
              const uploaded = {
                id: Number(res.id),

                url: String(res.url),

                amount:
                  typeof (res as any).amount !== "undefined"
                    ? Number((res as any).amount)
                    : Number(
                      calculatedTotals.totalAmount ||
                      currentOrder.amountPaid ||
                      0,
                    ),

                bankAccountId:
                  typeof (res as any).bank_account_id !== "undefined"
                    ? Number((res as any).bank_account_id)
                    : typeof (res as any).bankAccountId !== "undefined"
                      ? Number((res as any).bankAccountId)
                      : currentOrder.bankAccountId
                        ? Number(currentOrder.bankAccountId)
                        : undefined,

                transferDate:
                  (res as any).transfer_date ??
                  (res as any).transferDate ??
                  new Date().toISOString(),

                uploadedBy:
                  typeof res.uploadedBy !== "undefined"
                    ? Number(res.uploadedBy)
                    : typeof res.uploaded_by !== "undefined"
                      ? Number(res.uploaded_by)
                      : typeof res.upload_by !== "undefined"
                        ? Number(res.upload_by)
                        : currentUser?.id,

                uploadedByName:
                  res.uploadedByName ??
                  res.uploaded_by_name ??
                  res.upload_by_name ??
                  (currentUser
                    ? `${currentUser.firstName} ${currentUser.lastName} `
                    : undefined),

                createdAt:
                  res.createdAt ?? res.created_at ?? new Date().toISOString(),
              };

              setSlips((prev) => [uploaded, ...prev]);

              setSlipPreview((prev) => prev ?? uploaded.url);
            }
          } catch (err) {
            console.error("upload slip", err);
          }

          resolve();
        };

        reader.readAsDataURL(file);
      });
    }

    if (inputEl) inputEl.value = "";

    handleFieldChange("paymentStatus", PaymentStatus.PendingVerification);
  };

  const removeSlip = () => {
    setSlipPreview(null);

    handleFieldChange("slipUrl", undefined);

    handleFieldChange("paymentStatus", PaymentStatus.Unpaid);
  };

  const handleDeleteSlip = async (slipId?: number, slipUrl?: string) => {
    const confirmDelete = window.confirm("ต้องการลบสลิปนี้หรือไม่?");

    if (!confirmDelete) return;

    if (!slipId) {
      removeSlip();

      setLightboxSlip(null);

      return;
    }

    try {
      await deleteOrderSlip(slipId);

      setSlips((prev) => {
        const next = prev.filter((s) => s.id !== slipId);

        const nextPreview = next[0]?.url ?? null;

        setSlipPreview((prevPreview) => {
          if (!prevPreview) return nextPreview;

          if (slipUrl && prevPreview === slipUrl) return nextPreview;

          return prevPreview;
        });

        return next;
      });
    } catch (e) {
      console.error("delete slip", e);
    }

    setLightboxSlip(null);
  };

  const hasTransferSlip = Boolean(
    slipPreview || currentOrder.slipUrl || slips.length > 0,
  );

  // [PREVENTION] Lock editing if order is processed (Preparing or higher) or Verified
  // RESTRICTION: Applies to Admin, Telesale, Supervisor.
  // EXEMPTION: Backoffice, Finance, AdminControl, SuperAdmin can still edit.
  const isLocked = useMemo(() => {
    // If user role is privileged, do not lock
    if (
      currentUser &&
      [
        UserRole.Backoffice,
        UserRole.Finance,
        UserRole.AdminControl,
        UserRole.SuperAdmin,
      ].includes(currentUser.role)
    ) {
      return false;
    }

    const lockedStatuses = [
      OrderStatus.Preparing,
      OrderStatus.Picking,
      OrderStatus.Shipping,
      OrderStatus.Delivered,
      OrderStatus.Returned,
      OrderStatus.Confirmed, // User said "After pulling data", Confirmed often means ready to pull. Including it for safety.
    ];
    const lockedPaymentStatuses = [
      PaymentStatus.Verified,
      PaymentStatus.Approved,
      PaymentStatus.Paid,
      PaymentStatus.PreApproved,
    ];

    return (
      lockedStatuses.includes(currentOrder.orderStatus) ||
      lockedPaymentStatuses.includes(currentOrder.paymentStatus)
    );
  }, [currentOrder.orderStatus, currentOrder.paymentStatus, currentUser]);


  const handleAcceptSlip = async () => {
    const totalAmount = Number(calculatedTotals.totalAmount || 0);

    // Calculate sum only from checked slips
    const checkedSlips = slips.filter((s: any) => s.checked);
    const slipSum = checkedSlips.reduce(
      (sum, s) => sum + (Number((s as any).amount) || 0),
      0,
    );

    if (checkedSlips.length === 0) {
      alert("กรุณาเลือกสลิปที่ต้องการยืนยันอย่างน้อย 1 รายการ");
      return;
    }

    const slipsWithMeta = checkedSlips.filter(
      (s: any) => s.amount || s.bankAccountId || s.transferDate,
    );
    const missingMeta = slipsWithMeta.some(
      (s: any) => !s.amount || !s.bankAccountId || !s.transferDate,
    );

    if (missingMeta) {
      alert("ข้อมูลสลิปไม่ครบถ้วน (จำนวนเงิน, ธนาคาร, หรือวันที่โอน)");
      return;
    }

    const basePaidAmount =
      currentOrder.amountPaid && currentOrder.amountPaid > 0
        ? currentOrder.amountPaid
        : 0;

    const paidAmount =
      slipSum > 0
        ? Math.max(basePaidAmount, slipSum)
        : Math.max(basePaidAmount, totalAmount);

    if (paidAmount <= 0) {
      alert("ยอดชำระต้องมากกว่า 0");
      return;
    }

    // **NEW: Update slip details in database**
    try {
      for (const slip of checkedSlips) {
        if (
          slip.id &&
          (slip.amount || slip.bankAccountId || slip.transferDate)
        ) {
          await updateOrderSlip(slip.id, {
            amount: slip.amount ? Number(slip.amount) : undefined,
            bankAccountId: slip.bankAccountId
              ? Number(slip.bankAccountId)
              : undefined,
            transferDate: slip.transferDate
              ? fromLocalDatetimeString(slip.transferDate)
              : undefined,
            url: slip.url,
            updatedBy: currentUser?.id,
            companyId: currentOrder.companyId,
          });
        }
      }
    } catch (error) {
      console.error("Failed to update slip details:", error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูลสลิป");
      return;
    }

    // สำหรับ Backoffice: อัปเดตสถานะเป็น Verified แทน Paid
    // สำหรับ Telesale: อัปเดตสถานะเป็น Paid ตามเดิม
    const newPaymentStatus = PaymentStatus.Verified;

    // เพิ่มข้อมูลผู้ตรวจสอบและเวลา
    const verificationInfo = {
      verifiedBy: currentUser?.id,
      verifiedByName: `${currentUser?.firstName} ${currentUser?.lastName} `,
      verifiedAt: new Date().toISOString(),
    };

    const updated: Order = {
      ...currentOrder,
      totalAmount: calculatedTotals.totalAmount,
      amountPaid: paidAmount,
      paymentStatus: newPaymentStatus,
      verificationInfo: verificationInfo,
    };

    setCurrentOrder(updated);
    onSave(updated);
  };

  const handleCancelVerification = async () => {
    if (!confirm("ต้องการยกเลิกการยืนยันสลิปใช่หรือไม่?")) return;

    try {
      await patchOrder(currentOrder.id, {
        paymentStatus: PaymentStatus.PendingVerification,
        amountPaid: null,
      });

      const updated = {
        ...currentOrder,
        paymentStatus: PaymentStatus.PendingVerification,
        amountPaid: null as any,
      };

      setCurrentOrder(updated);
      onSave(updated); // Notify parent to refresh
    } catch (error) {
      console.error("Failed to cancel verification:", error);
      alert("เกิดข้อผิดพลาดในการยกเลิกการยืนยันสลิป");
    }
  };


    let newPaymentStatus = currentOrder.paymentStatus;

    if (newAmount === 0) {
      newPaymentStatus = PaymentStatus.Unpaid;
    } else if (newAmount < calculatedTotals.totalAmount) {
      newPaymentStatus = PaymentStatus.PendingVerification; // partial
    } else {
      newPaymentStatus = PaymentStatus.Verified; // paid or overpaid (Verified)
    }

    setCurrentOrder((prev) => ({
      ...prev,
      amountPaid: newAmount,
      paymentStatus: newPaymentStatus,
    }));
  };

  const handleBoxFieldChange = (
    boxNumber: number,
    field: "collectionAmount" | "collectedAmount" | "waivedAmount",
    value: number,
  ) => {
    const safe = Number.isFinite(value) ? Math.max(0, value) : 0;

    setCurrentOrder((prev) => {
      const boxes = (prev.boxes || []).map((box) => {
        if (box.boxNumber === boxNumber) {
          return { ...box, [field]: safe };
        }

        return box;
      });

      const codTotal =
        prev.paymentMethod === PaymentMethod.COD
          ? boxes.reduce(
            (sum, b) => sum + (b.collectionAmount ?? b.codAmount ?? 0),
            0,
          )
          : prev.codAmount;

      return { ...prev, boxes, codAmount: codTotal };
    });
  };

  const handleBoxTrackingChange = (boxNumber: number, value: string) => {
    setCurrentOrder((prev) => {
      const boxes = (prev.boxes || []).map((box) => {
        if (box.boxNumber === boxNumber) {
          return { ...box, trackingNumber: value };
        }
        return box;
      });
      return { ...prev, boxes };
    });
  };

  // Removed manual confirm button: payment status derives from amountPaid

  const calculateOrderTotal = (
    items: any[],
    shippingCost: number,
    billDiscount: number,
  ) => {
    const goodsSum = items.reduce(
      (acc, item) =>
        acc +
        (item.isFreebie ? 0 : (item.quantity || 0) * (item.pricePerUnit || 0)),
      0,
    );
    const itemsDiscount = items.reduce(
      (acc, item) => acc + (item.isFreebie ? 0 : item.discount || 0),
      0,
    );
    const subTotal = goodsSum - itemsDiscount;
    const billDiscountAmount = (subTotal * (billDiscount || 0)) / 100;
    return subTotal + (shippingCost || 0) - billDiscountAmount;
  };

  const handleSave = async () => {
    if (!currentUser) return;

    // Validate COD if applicable
    if (currentOrder.paymentMethod === PaymentMethod.COD) {
      const codTotal =
        currentOrder.boxes?.reduce(
          (sum, b) => sum + (b.collectionAmount ?? b.codAmount ?? 0),
          0,
        ) || 0;
      const orderTotal = calculateOrderTotal(
        currentOrder.items,
        currentOrder.shippingCost,
        currentOrder.billDiscount,
      );

      // [PREVENTION] AwaitingVerification requires Amount Paid > 0
      if (currentOrder.orderStatus === OrderStatus.AwaitingVerification) {
        const checkAmount = Number(currentOrder.amountPaid || 0);
        if (checkAmount <= 0) {
          alert("กรุณาระบุยอดชำระเงิน (Amount Paid) ก่อนบันทึกสถานะรอตรวจสอบจากบัญชี");
          return;
        }
      }

      // [PREVENTION] PreApproved requires PaymentStatus != Unpaid
      if (
        currentOrder.orderStatus === OrderStatus.PreApproved &&
        currentOrder.paymentStatus === PaymentStatus.Unpaid
      ) {
        alert(
          "ไม่สามารถกำหนดสถานะเป็น PreApproved ได้ เนื่องจากสถานะการชำระเงินยังเป็น Unpaid",
        );
        return;
      }

      if (Math.abs(codTotal - orderTotal) > 0.1) {
        // Floating point tolerance
        alert(
          `ไม่สามารถบันทึกได้: ยอดเก็บเงินปลายทางรวม (${codTotal.toLocaleString()}) ไม่ตรงกับยอดรวมออเดอร์ (${orderTotal.toLocaleString()})\nกรุณาแก้ไขยอดเก็บเงินในแต่ละกล่องให้ถูกต้อง`,
        );
        return;
      }
    }

    // Validate box numbers are sequential (no gaps)
    const nonChildItems = currentOrder.items.filter(
      (item: any) => !item.parentItemId,
    );
    console.log("DEBUG handleSave Items:", currentOrder.items);
    console.log("DEBUG handleSave nonChildItems:", nonChildItems);
    const boxNumbers: number[] = nonChildItems.map(
      (item) => Number(item.boxNumber || (item as any).box_number) || 1,
    );
    console.log("DEBUG handleSave boxNumbers:", boxNumbers);
    const uniqueBoxes: number[] = [...new Set(boxNumbers)].sort(
      (a, b) => a - b,
    );

    // Check if box numbers are sequential starting from 1 (no gaps allowed)
    for (let i = 0; i < uniqueBoxes.length; i++) {
      // ... validation ...
    }

    // Create boxes array based on items (exclude child items and freebies from amount calculation)
    const boxes = uniqueBoxes.map((boxNum) => {
      // Get items in this box (exclude child items for amount calculation)
      const boxItems = currentOrder.items.filter((item: any) => {
        const itemBoxNumber = Number(item.boxNumber || item.box_number) || 1;
        return itemBoxNumber === boxNum && !item.parentItemId;
      });

      // Calculate box amount (exclude freebies)
      const boxAmount = boxItems.reduce((sum, item) => {
        const isFreebie = item.isFreebie || (item as any).is_freebie;
        if (isFreebie) return sum;
        const itemTotal =
          (item.pricePerUnit || 0) * (item.quantity || 0) -
          (item.discount || 0);
        return sum + itemTotal;
      }, 0);

      return {
        boxNumber: boxNum,
        collectionAmount: boxAmount,
        collectedAmount: 0,
        waivedAmount: 0,
      };
    });

    // Persist slip metadata edits (bank/date/amount) for Transfer/PayAfter
    if (
      (currentOrder.paymentMethod === PaymentMethod.Transfer ||
        currentOrder.paymentMethod === PaymentMethod.PayAfter) &&
      slips.length > 0
    ) {
      slips.forEach((slip: any) => {
        if (!slip.id) return;
        updateOrderSlip(slip.id, {
          amount:
            typeof slip.amount === "number" && !Number.isNaN(slip.amount)
              ? slip.amount
              : undefined,
          bankAccountId: slip.bankAccountId
            ? Number(slip.bankAccountId)
            : undefined,
          transferDate: slip.transferDate
            ? fromLocalDatetimeString(slip.transferDate)
            : undefined,
        }).catch((err) => {
          console.error("update slip meta", err);
        });
      });
    }

    const updatedOrder = {
      ...currentOrder,
      totalAmount: calculatedTotals.totalAmount,
      updatedBy: currentUser.id,
      boxes: boxes, // Add generated boxes array
    };

    setCurrentOrder(updatedOrder);

    onSave(updatedOrder);
    setIsEditing(false);
  };

  const formatAddress = (address?: Address | null) => {
    const sanitize = (value?: string | null) => {
      if (!value) return "";

      const trimmed = value.trim();

      const lower = trimmed.toLowerCase();

      if (!trimmed || lower === "undefined" || lower === "null") {
        return "";
      }

      return trimmed;
    };

    const recipientFirst = sanitize(address?.recipientFirstName);

    const recipientLast = sanitize(address?.recipientLastName);

    const street = sanitize(address?.street);

    const subdistrict = sanitize(address?.subdistrict);

    const district = sanitize(address?.district);

    const province = sanitize(address?.province);

    const postalCode = sanitize(address?.postalCode);

    const parts: string[] = [];

    if (recipientFirst || recipientLast)
      parts.push(
        `Recipient: ${[recipientFirst, recipientLast].filter(Boolean).join(" ").trim()} `,
      );

    if (street) parts.push(street);

    if (subdistrict) parts.push(subdistrict);

    if (district) parts.push(district);

    if (province) parts.push(province);

    if (postalCode) parts.push(postalCode);

    return parts.length > 0 ? parts.join(", ") : "-";
  };

  // Totals derived from items minus discounts plus shipping

  const calculatedTotals = useMemo(() => {
    // Filter out freebie items AND child items before calculating totals
    const nonFreebieItems = currentOrder.items.filter((item: any) => {
      const isFreebie = item.isFreebie || item.is_freebie;
      const isChild = item.parentItemId; // Child items should not be counted
      return !isFreebie && !isChild;
    });

    const itemsSubtotal = nonFreebieItems.reduce((sum, item) => {
      const itemTotal = item.pricePerUnit * item.quantity - item.discount;

      return sum + itemTotal;
    }, 0);

    const itemsDiscount = nonFreebieItems.reduce(
      (sum, item) => sum + item.discount,
      0,
    );

    const shippingCost = currentOrder.shippingCost || 0;

    const billDiscount = currentOrder.billDiscount || 0;

    const totalAmount = itemsSubtotal - billDiscount + shippingCost;

    return {
      itemsSubtotal,

      itemsDiscount,

      billDiscount,

      shippingCost,

      totalAmount,
    };
  }, [
    currentOrder.items,
    currentOrder.shippingCost,
    currentOrder.billDiscount,
  ]);



  const handleDuplicateItem = (item: any, count: number) => {
    if (count <= 0) return;

    const currentItems = currentOrder.items || [];
    const newItems: any[] = [];
    let nextId = Date.now() + Math.floor(Math.random() * 100000); // Ensure unique ID

    for (let i = 0; i < count; i++) {
      // Clone parent/single item
      nextId += 1;
      const newRootId = nextId;
      const clonedRoot = {
        ...item,
        id: newRootId,
      };
      newItems.push(clonedRoot);

      // Clone children if it's a promotion parent
      if (item.isPromotionParent) {
        const children = currentItems.filter(
          (it: any) => it.parentItemId === item.id,
        );
        children.forEach((child: any) => {
          nextId += 1;
          newItems.push({
            ...child,
            id: nextId,
            parentItemId: newRootId,
          });
        });
      }
    }

    // Find insertion index
    const index = currentItems.findIndex((it: any) => it.id === item.id);
    let insertIndex = index + 1;
    if (item.isPromotionParent) {
      for (let j = index + 1; j < currentItems.length; j++) {
        if ((currentItems[j] as any).parentItemId === item.id) {
          insertIndex = j + 1;
        } else {
          break;
        }
      }
    }

    const updatedItems = [...currentItems];
    updatedItems.splice(insertIndex, 0, ...newItems);
    setCurrentOrder((prev) => ({ ...prev, items: updatedItems }));
  };

  return (
    <>
      <Modal
        title={`จัดการออเดอร์: ${order.id} `}
        onClose={onClose}
        size="xl"
        backdropClassName={backdropClassName}
      >
        <div className="space-y-4 text-sm">
          {isModifiable && (
            <div className="flex justify-end mb-2">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Edit2 size={14} className="mr-1.5" />
                  แก้ไขออเดอร์
                </button>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setIsEditing(false);

                      setCurrentOrder(order); // Reset changes
                    }}
                    className="flex items-center px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300 transition-colors"
                  >
                    <X size={14} className="mr-1.5" />
                    ยกเลิกการแก้ไข
                  </button>

                  <button
                    onClick={() => {
                      handleSave();
                    }}
                    className="flex items-center px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                  >
                    <Save size={14} className="mr-1.5" />
                    บันทึกการแก้ไข
                  </button>
                </div>
              )}
            </div>
          )}

          <InfoCard icon={Calendar} title="รายละเอียดคำสั่งซื้อ">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-gray-500">วันที่สั่งซื้อ</p>

                <p className="font-medium text-gray-800">
                  {currentOrder.orderDate
                    ? new Date(currentOrder.orderDate).toLocaleString("th-TH")
                    : "-"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">วันที่จัดส่ง</p>

                {showInputs ? (
                  <input
                    type="date"
                    value={deliveryDateInputValue}
                    min={deliveryWindow.minIso}
                    max={deliveryWindow.maxIso}
                    onChange={(e) => handleDeliveryDateChange(e.target.value)}
                    className="w-full p-1 text-sm border rounded"
                  />
                ) : (
                  <p className="font-medium text-gray-800">
                    {currentOrder.deliveryDate
                      ? new Date(currentOrder.deliveryDate).toLocaleDateString(
                        "th-TH",
                      )
                      : "-"}
                  </p>
                )}
              </div>

              <div>
                {/* Platform/Channel Selector */}
                <p className="text-xs text-gray-500">ช่องทางการขาย</p>
                {showInputs ? (
                  <select
                    value={currentOrder.salesChannel || ""}
                    onChange={(e) => {
                      const channel = e.target.value || undefined;
                      setCurrentOrder((prev) => ({
                        ...prev,
                        salesChannel: channel,
                        salesChannelPageId: undefined, // Clear page when channel changes
                      }));
                    }}
                    className="w-full p-1 text-sm border rounded"
                  >
                    <option value="">-- เลือกช่องทาง --</option>
                    {platforms.map((platform) => (
                      <option key={platform.id} value={platform.name}>
                        {platform.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="font-medium text-gray-800">
                    {currentOrder.salesChannel || "-"}
                  </p>
                )}
              </div>

              <div>
                {/* Page Selector */}
                {(() => {
                  const selectedPlatform = platforms.find(
                    (p) =>
                      p.name.toLowerCase() ===
                      (currentOrder.salesChannel || "").toLowerCase(),
                  );

                  // Don't show page selector for 'โทร' platform in edit mode
                  if (selectedPlatform && selectedPlatform.name === "โทร") {
                    return showInputs ? null : (
                      <p className="font-medium text-gray-800">-</p>
                    );
                  }

                  // Filter pages based on selected platform
                  let filtered: Page[] = [];
                  if (selectedPlatform) {
                    const hasShowPagesFrom =
                      selectedPlatform.showPagesFrom &&
                      selectedPlatform.showPagesFrom.trim() !== "";
                    const platformToMatch = hasShowPagesFrom
                      ? selectedPlatform.showPagesFrom.toLowerCase()
                      : selectedPlatform.name.toLowerCase();

                    filtered = pages.filter((p) => {
                      if (!p.active) return false;
                      const pagePlatform = (p.platform || "").toLowerCase();
                      return pagePlatform === platformToMatch;
                    });
                  }

                  // Always show page selector (disabled if no platform selected)
                  return (
                    <>
                      <p className="text-xs text-gray-500">เพจ</p>
                      {showInputs ? (
                        <select
                          value={currentOrder.salesChannelPageId || ""}
                          onChange={(e) => {
                            const pid = e.target.value
                              ? Number(e.target.value)
                              : undefined;
                            setCurrentOrder((prev) => ({
                              ...prev,
                              salesChannelPageId: pid,
                            }));
                          }}
                          disabled={!currentOrder.salesChannel}
                          className="w-full p-1 text-sm border rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          <option value="">-- เลือกเพจ --</option>
                          {filtered.map((page) => (
                            <option key={page.id} value={page.id}>
                              {page.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="font-medium text-gray-800">
                          {(() => {
                            const page = pages.find(
                              (p) => p.id === currentOrder.salesChannelPageId,
                            );
                            return page
                              ? page.name
                              : currentOrder.salesChannelPageId || "-";
                          })()}
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </InfoCard>

          <InfoCard icon={UserIcon} title="ข้อมูลลูกค้า">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-800 text-base">
                    {customer
                      ? `${customer.firstName} ${customer.lastName} `
                      : "ไม่พบข้อมูล"}
                  </p>

                  {showInputs && customer && onEditCustomer && (
                    <button
                      onClick={() => onEditCustomer(customer)}
                      className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100"
                    >
                      แก้ไขลูกค้า
                    </button>
                  )}
                </div>

                <p className="text-gray-600 flex items-center mt-2">
                  <Phone size={14} className="mr-2" />
                  {customer?.phone || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">ที่อยู่จัดส่ง</p>

                {showInputs ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        placeholder="ชื่อผู้รับ"
                        value={
                          currentOrder.shippingAddress?.recipientFirstName || ""
                        }
                        disabled={isLocked}
                        onChange={(e) =>
                          updateShippingAddress({
                            recipientFirstName: e.target.value,
                          })
                        }
                        className={`w-full p-2 text-sm border rounded ${isLocked ? "bg-gray-100 cursor-not-allowed" : ""}`}
                      />

                      <input
                        placeholder="นามสกุลผู้รับ"
                        value={
                          currentOrder.shippingAddress?.recipientLastName || ""
                        }
                        disabled={isLocked}
                        onChange={(e) =>
                          updateShippingAddress({
                            recipientLastName: e.target.value,
                          })
                        }
                        className={`w-full p-2 text-sm border rounded ${isLocked ? "bg-gray-100 cursor-not-allowed" : ""}`}
                      />
                    </div>

                    <input
                      placeholder="ที่อยู่ (บ้านเลขที่ ซอย ถนน)"
                      value={currentOrder.shippingAddress?.street || ""}
                      disabled={isLocked}
                      onChange={(e) =>
                        updateShippingAddress({ street: e.target.value })
                      }
                      className={`w-full p-2 text-sm border rounded ${isLocked ? "bg-gray-100 cursor-not-allowed" : ""}`}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="relative">
                        <input
                          placeholder="จังหวัด"
                          value={
                            provinceSearchTerm ||
                            currentOrder.shippingAddress?.province ||
                            ""
                          }
                          disabled={isLocked}
                          onChange={(e) => {
                            const val = e.target.value;

                            setProvinceSearchTerm(val);

                            setShowProvinceDropdown(true);

                            if (!val) {
                              setSelectedProvince(null);

                              setSelectedDistrict(null);

                              setSelectedSubDistrict(null);

                              updateShippingAddress({
                                province: "",
                                district: "",
                                subdistrict: "",
                                postalCode: "",
                              });
                            }
                          }}
                          onFocus={() => !isLocked && setShowProvinceDropdown(true)}
                          className={`w-full p-2 text-sm border rounded ${isLocked ? "bg-gray-100 cursor-not-allowed" : ""}`}
                        />

                        {showProvinceDropdown && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded shadow max-h-56 overflow-auto">
                            {filteredProvinces.map((province: any) => (
                              <button
                                type="button"
                                key={province.id}
                                className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  handleSelectProvince(province);

                                  setShowProvinceDropdown(false);
                                }}
                              >
                                {province.name_th}
                              </button>
                            ))}

                            {filteredProvinces.length === 0 && (
                              <div className="px-3 py-2 text-sm text-gray-500">
                                ไม่พบจังหวัด
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="relative">
                        <input
                          placeholder="อำเภอ/เขต"
                          value={
                            districtSearchTerm ||
                            currentOrder.shippingAddress?.district ||
                            ""
                          }
                          onChange={(e) => {
                            const val = e.target.value;

                            setDistrictSearchTerm(val);

                            setShowDistrictDropdown(true);

                            if (!val) {
                              setSelectedDistrict(null);

                              setSelectedSubDistrict(null);

                              updateShippingAddress({
                                district: "",
                                subdistrict: "",
                                postalCode: "",
                              });
                            }
                          }}
                          onFocus={() => !isLocked && setShowDistrictDropdown(true)}
                          disabled={!selectedProvince || isLocked}
                          className={`w-full p-2 text-sm border rounded disabled:bg-gray-100 ${isLocked ? "cursor-not-allowed" : ""}`}
                        />

                        {showDistrictDropdown && selectedProvince && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded shadow max-h-56 overflow-auto">
                            {filteredDistricts.map((district: any) => (
                              <button
                                type="button"
                                key={district.id}
                                className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  handleSelectDistrict(district);

                                  setShowDistrictDropdown(false);
                                }}
                              >
                                {district.name_th}
                              </button>
                            ))}

                            {filteredDistricts.length === 0 && (
                              <div className="px-3 py-2 text-sm text-gray-500">
                                ไม่พบอำเภอ/เขต
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="relative">
                        <input
                          placeholder="ตำบล/แขวง"
                          value={
                            subDistrictSearchTerm ||
                            currentOrder.shippingAddress?.subdistrict ||
                            ""
                          }
                          onChange={(e) => {
                            const val = e.target.value;

                            setSubDistrictSearchTerm(val);

                            setShowSubDistrictDropdown(true);

                            if (!val) {
                              setSelectedSubDistrict(null);

                              updateShippingAddress({
                                subdistrict: "",
                                postalCode: "",
                              });
                            }
                          }}
                          onFocus={() => !isLocked && setShowSubDistrictDropdown(true)}
                          disabled={!selectedDistrict || isLocked}
                          className={`w-full p-2 text-sm border rounded disabled:bg-gray-100 ${isLocked ? "cursor-not-allowed" : ""}`}
                        />

                        {showSubDistrictDropdown && selectedDistrict && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded shadow max-h-56 overflow-auto">
                            {filteredSubDistricts.map((sub: any) => (
                              <button
                                type="button"
                                key={sub.id}
                                className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  handleSelectSubDistrict(sub);

                                  setShowSubDistrictDropdown(false);
                                }}
                              >
                                {sub.name_th} ({sub.zip_code})
                              </button>
                            ))}

                            {filteredSubDistricts.length === 0 && (
                              <div className="px-3 py-2 text-sm text-gray-500">
                                ไม่พบตำบล/แขวง
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <input
                        placeholder="รหัสไปรษณีย์"
                        value={currentOrder.shippingAddress?.postalCode || ""}
                        readOnly
                        className="w-full p-2 text-sm border rounded bg-gray-50"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-700 flex items-start">
                    <MapPin size={14} className="mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">
                      {formatAddress(currentOrder.shippingAddress)}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </InfoCard>

          <InfoCard icon={Package} title="รายการสินค้า">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                      ลำดับ
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                      Sku
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                      ชื่อรายการ
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">
                      จำนวน
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">
                      ราคาต่อหน่วย
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">
                      ส่วนลด
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">
                      รวม
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700"></th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">
                      กล่องที่
                    </th>
                    {showInputs && (
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">
                        แถม
                      </th>
                    )}
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                      ผู้ขาย
                    </th>
                    {showInputs && (
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">
                        จัดการ
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {(() => {
                    let rowNumber = 0; // Counter for non-child items only
                    return sortedItemsWithIndex.map(({ item, index }) => {
                      // Increment row number only for non-child items
                      if (!(item as any).parentItemId) {
                        rowNumber++;
                      }
                      const displayRowNumber = (item as any).parentItemId
                        ? ""
                        : rowNumber;

                      // Check if this child should be hidden
                      const isChild = !!(item as any).parentItemId;
                      const parentId = (item as any).parentItemId;
                      const isExpanded = parentId
                        ? expandedPromotions.has(parentId)
                        : true;

                      // Skip rendering if this is a collapsed child
                      if (isChild && !isExpanded) {
                        return null;
                      }

                      const itemCreator = item.creatorId
                        ? users.find((u) => {
                          const userId =
                            typeof u.id === "number" ? u.id : Number(u.id);

                          const creatorId =
                            typeof item.creatorId === "number"
                              ? item.creatorId
                              : Number(item.creatorId);

                          return userId === creatorId;
                        })
                        : null;

                      const isFreebie =
                        (item as any).isFreebie || (item as any).is_freebie;
                      const itemTotal = isFreebie
                        ? 0
                        : item.pricePerUnit * item.quantity - item.discount;

                      // Check if current user is the creator of this item

                      const isCreator =
                        currentUser && item.creatorId === currentUser.id;

                      const canEditItem = showInputs && isCreator;

                      return (
                        <tr key={item.id} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2 text-xs text-gray-600 font-mono text-center">
                            {displayRowNumber}
                          </td>

                          <td className="px-3 py-2 text-xs text-gray-600 font-mono">
                            {(item as any).isPromotionParent
                              ? // Show promotion SKU for parent
                              promotions.find(
                                (p) => p.id === item.promotionId,
                              )?.sku || "-"
                              : // Show product SKU for both child and regular items
                              item.productId
                                ? products.find((p) => p.id === item.productId)
                                  ?.sku || "-"
                                : "-"}
                          </td>

                          <td className="px-3 py-2 text-sm text-gray-800">
                            <div className="flex items-center gap-2">
                              {(item as any).isPromotionParent && (
                                <button
                                  onClick={() => {
                                    const itemId = item.id;
                                    setExpandedPromotions((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(itemId)) {
                                        next.delete(itemId);
                                      } else {
                                        next.add(itemId);
                                      }
                                      return next;
                                    });
                                  }}
                                  className="text-gray-500 hover:text-gray-700 flex-shrink-0"
                                >
                                  {expandedPromotions.has(item.id) ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                              {(item as any).parentItemId && (
                                <CornerDownRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              )}
                              <span
                                className={
                                  (item as any).isPromotionParent
                                    ? "font-semibold text-blue-700"
                                    : ""
                                }
                              >
                                {item.productName}
                              </span>
                            </div>
                          </td>

                          <td className="px-3 py-2 text-center text-xs text-gray-700">
                            {canEditItem && !(item as any).parentItemId ? (
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => {
                                  const newQuantity = Math.max(
                                    1,
                                    Number(e.target.value),
                                  );
                                  handleItemChange(
                                    index,
                                    "quantity",
                                    newQuantity,
                                  );

                                  // If this is a promotion parent, update all children quantities
                                  if ((item as any).isPromotionParent) {
                                    const parentId = item.id;
                                    setCurrentOrder((prev) => ({
                                      ...prev,
                                      items: prev.items.map((i) =>
                                        (i as any).parentItemId === parentId
                                          ? {
                                            ...i,
                                            quantity:
                                              ((i as any).originalQuantity ||
                                                1) * newQuantity,
                                          }
                                          : i,
                                      ),
                                    }));
                                  }
                                }}
                                className="w-16 border rounded px-1 text-center"
                              />
                            ) : (item as any).parentItemId ? (
                              // For children, show calculated quantity (originalQuantity × parent quantity)
                              (() => {
                                const parent = currentOrder.items.find(
                                  (p) => p.id === (item as any).parentItemId,
                                );
                                const parentQty = parent?.quantity || 1;
                                const originalQty =
                                  (item as any).originalQuantity ||
                                  item.quantity;
                                return originalQty * parentQty;
                              })()
                            ) : (
                              item.quantity
                            )}{" "}
                          </td>

                          <td className="px-3 py-2 text-right text-xs text-gray-700">
                            {(item as any).parentItemId ? (
                              ""
                            ) : canEditItem ? (
                              <input
                                type="number"
                                value={item.pricePerUnit}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "pricePerUnit",
                                    Number(e.target.value),
                                  )
                                }
                                className="w-20 border rounded px-1 text-right"
                              />
                            ) : (
                              `฿${isFreebie ? 0 : Number(item.pricePerUnit ?? 0).toLocaleString()} `
                            )}
                          </td>

                          <td className="px-3 py-2 text-right text-xs text-red-600">
                            {(item as any).parentItemId ? (
                              ""
                            ) : canEditItem ? (
                              <input
                                type="number"
                                value={item.discount}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "discount",
                                    Number(e.target.value),
                                  )
                                }
                                className="w-20 border rounded px-1 text-right text-red-600"
                              />
                            ) : (
                              `-฿${Number(item.discount ?? 0).toLocaleString()} `
                            )}
                          </td>

                          <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">
                            {(item as any).parentItemId
                              ? ""
                              : isFreebie
                                ? "฿0"
                                : `฿${itemTotal.toLocaleString()}`}
                          </td>

                          <td className="px-3 py-2 text-center">
                            {isFreebie && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                แถม
                              </span>
                            )}
                          </td>

                          <td className="px-3 py-2 text-center text-xs text-gray-700">
                            {(item as any).parentItemId ? (
                              ""
                            ) : canEditItem ? (
                              <select
                                value={item.boxNumber || 1}
                                onChange={(e) => {
                                  const newBoxNumber = Number(e.target.value);
                                  // Update parent box number
                                  handleItemChange(
                                    index,
                                    "boxNumber",
                                    newBoxNumber,
                                  );

                                  // Update all children's box numbers
                                  if ((item as any).isPromotionParent) {
                                    const parentId = item.id;
                                    setCurrentOrder((prev) => ({
                                      ...prev,
                                      items: prev.items.map((i) =>
                                        (i as any).parentItemId === parentId
                                          ? { ...i, boxNumber: newBoxNumber }
                                          : i,
                                      ),
                                    }));
                                  }
                                }}
                                className="w-16 border rounded px-1 text-center"
                              >
                                {(() => {
                                  // Get all unique box numbers currently in use (from non-child items)
                                  const nonChildItems =
                                    currentOrder.items.filter(
                                      (it: any) => !it.parentItemId,
                                    );
                                  const boxNumbers: number[] =
                                    nonChildItems.map(
                                      (it) => Number(it.boxNumber) || 1,
                                    );
                                  const usedBoxes: number[] = [
                                    ...new Set(boxNumbers),
                                  ].sort((a, b) => a - b);
                                  const maxUsedBox =
                                    usedBoxes.length > 0
                                      ? Math.max(...usedBoxes)
                                      : 1;

                                  // Allow selecting existing boxes + one new box (maxUsedBox + 1)
                                  // But don't exceed total number of items
                                  const maxAllowed = Math.min(
                                    maxUsedBox + 1,
                                    nonChildItems.length,
                                  );

                                  return Array.from(
                                    { length: maxAllowed },
                                    (_, i) => i + 1,
                                  ).map((num) => (
                                    <option key={num} value={num}>
                                      {num}
                                    </option>
                                  ));
                                })()}
                              </select>
                            ) : (
                              item.boxNumber || 1
                            )}
                          </td>

                          {showInputs && (
                            <td className="px-3 py-2 text-center">
                              {(item as any).parentItemId ? (
                                ""
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={isFreebie}
                                  onChange={(e) =>
                                    handleItemChange(
                                      index,
                                      "isFreebie",
                                      e.target.checked,
                                    )
                                  }
                                  className="cursor-pointer"
                                />
                              )}
                            </td>
                          )}

                          <td className="px-3 py-2 text-xs text-gray-600">
                            {(item as any).parentItemId
                              ? ""
                              : itemCreator
                                ? `${itemCreator.firstName} ${itemCreator.lastName} `
                                : "-"}
                          </td>

                          {showInputs && (
                            <td className="px-3 py-2 text-center">
                              {canEditItem && (
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => {
                                      const input = window.prompt(
                                        "ระบุจำนวนที่ต้องการคัดลอก (จำนวนแถว)",
                                        "1",
                                      );
                                      if (input !== null) {
                                        const count = parseInt(input, 10);
                                        if (!isNaN(count) && count > 0) {
                                          handleDuplicateItem(item, count);
                                        }
                                      }
                                    }}
                                    className="text-blue-500 hover:text-blue-700"
                                    title="คัดลอก"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="14"
                                      height="14"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <rect
                                        width="14"
                                        height="14"
                                        x="8"
                                        y="8"
                                        rx="2"
                                        ry="2"
                                      />
                                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleRemoveItem(item)}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    });
                  })()}
                </tbody>

                <tfoot className="bg-gray-50">
                  {showInputs && (
                    <tr>
                      <td colSpan={9} className="px-3 py-2 text-center">
                        <button
                          onClick={handleAddItem}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center justify-center w-full"
                        >
                          + เพิ่มสินค้า
                        </button>
                      </td>
                    </tr>
                  )}

                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-xs text-gray-600">
                      รวมรายการ
                    </td>

                    <td
                      colSpan={1}
                      className="px-3 py-2 text-right text-xs font-medium text-gray-900"
                    >
                      ฿{calculatedTotals.itemsSubtotal.toLocaleString()}
                    </td>

                    <td className="px-3 py-2 text-right text-xs text-red-600">
                      -฿{calculatedTotals.itemsDiscount.toLocaleString()}
                    </td>

                    <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">
                      ฿{calculatedTotals.itemsSubtotal.toLocaleString()}
                    </td>

                    <td colSpan={showInputs ? 2 : 1}></td>
                  </tr>

                  <tr>
                    <td colSpan={5} className="px-3 py-2 text-xs text-gray-600">
                      ส่วนลดทั้งออเดอร์
                    </td>

                    <td
                      colSpan={showInputs ? 3 : 2}
                      className="px-3 py-2 text-right text-xs text-red-600"
                    >
                      -฿{calculatedTotals.billDiscount.toLocaleString()}
                    </td>
                  </tr>

                  <tr>
                    <td colSpan={5} className="px-3 py-2 text-xs text-gray-600">
                      ค่าส่ง
                    </td>

                    <td
                      colSpan={showInputs ? 3 : 2}
                      className="px-3 py-2 text-right text-xs font-medium text-gray-900"
                    >
                      ฿{calculatedTotals.shippingCost.toLocaleString()}
                    </td>
                  </tr>

                  <tr className="border-t-2">
                    <td
                      colSpan={5}
                      className="px-3 py-2 text-sm font-bold text-gray-800"
                    >
                      ยอดสุทธิ
                    </td>

                    <td
                      colSpan={showInputs ? 3 : 2}
                      className="px-3 py-2 text-right text-base font-bold text-gray-900"
                    >
                      ฿{calculatedTotals.totalAmount.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </InfoCard>

          {(currentOrder.paymentMethod === PaymentMethod.Transfer ||
            currentOrder.paymentMethod === PaymentMethod.PayAfter ||
            currentOrder.paymentMethod === PaymentMethod.COD) && (
              <InfoCard icon={CreditCard} title="การชำระเงิน">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-gray-600">
                    วิธีชำระ: {currentOrder.paymentMethod}
                  </span>

                  {getPaymentStatusChip(
                    currentOrder.paymentStatus,
                    currentOrder.paymentMethod,
                    currentOrder.amountPaid,
                    calculatedTotals.totalAmount,
                  )}
                </div>


                  <span
                    className={`px - 2 py - 0.5 rounded - full ${derivedAmountStatus === "Paid" ? "bg-green-100 text-green-700" : derivedAmountStatus === "Unpaid" ? "bg-gray-100 text-gray-700" : derivedAmountStatus === "Partial" ? "bg-yellow-100 text-yellow-700" : "bg-purple-100 text-purple-700"} `}
                  >
                    {derivedAmountStatus === "Paid"
                      ? "ชำระแล้ว"
                      : derivedAmountStatus === "Unpaid"
                        ? "ยังไม่ชำระ"
                        : derivedAmountStatus === "Partial"
                          ? "ชำระบางส่วน"
                          : "ชำระเกิน"}
                  </span>
                </div>

                {(currentOrder.paymentMethod === PaymentMethod.Transfer ||
                  currentOrder.paymentMethod === PaymentMethod.COD) && (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          จำนวนเงินที่ได้รับ
                        </label>

                        <input
                          type="number"
                          inputMode="decimal"
                          value={currentOrder.amountPaid ?? ""}
                          disabled={isLocked}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) =>
                            handleAmountPaidChange(Number(e.target.value))
                          }
                          className={`w-full p-2 border rounded-md ${isLocked ? "bg-gray-100 cursor-not-allowed" : ""}`}
                        />
                      </div>

                      <div className="flex justify-between font-semibold">
                        <span className="text-gray-600">คงเหลือ</span>

                        <span
                          className={`${remainingBalance < 0 ? "text-purple-600" : remainingBalance > 0 ? "text-red-600" : "text-green-600"} `}
                        >
                          {remainingBalance === 0
                            ? "0"
                            : remainingBalance > 0
                              ? ` - ${remainingBalance.toLocaleString()} `
                              : ` + ${Math.abs(remainingBalance).toLocaleString()} `}
                        </span>
                      </div>
                    </div>
                  )}

                {(currentOrder.paymentMethod === PaymentMethod.Transfer ||
                  currentOrder.paymentMethod === PaymentMethod.PayAfter ||
                  currentOrder.paymentMethod === PaymentMethod.COD) && (
                    <>
                      <div className="space-y-4 mt-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            หลักฐานการชำระเงิน / สลิป
                          </label>

                          {slips.length > 0 ? (
                            <div className="overflow-x-auto border rounded-lg">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th
                                      scope="col"
                                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                      ลำดับ
                                    </th>
                                    <th
                                      scope="col"
                                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                      ธนาคาร
                                    </th>
                                    <th
                                      scope="col"
                                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                      วัน-เวลา
                                    </th>
                                    <th
                                      scope="col"
                                      className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                      จำนวนเงิน
                                    </th>
                                    <th
                                      scope="col"
                                      className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                      รูปภาพ
                                    </th>
                                    {canVerifySlip && (
                                      <th
                                        scope="col"
                                        className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                                      >
                                        ตรวจสอบ
                                      </th>
                                    )}
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {slips.map((slip, index) => {
                                    const bankLabel = resolveBankName(
                                      slip.bankAccountId,
                                    );
                                    const transferLabel = formatSlipDateTime(
                                      slip.transferDate,
                                    );
                                    const isComplete = !!(
                                      slip.amount &&
                                      slip.bankAccountId &&
                                      slip.transferDate
                                    );
                                    const isSlipLocked = [
                                      PaymentStatus.Verified,
                                      PaymentStatus.PreApproved,
                                      PaymentStatus.Approved,
                                      PaymentStatus.Paid,
                                    ].includes(currentOrder.paymentStatus);

                                    const isChecked =
                                      !!(slip as any).checked || isSlipLocked;

                                    return (
                                      <tr
                                        key={slip.id}
                                        className={isChecked ? "bg-green-50" : ""}
                                      >
                                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                          {index + 1}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                          {canEditSlips && !isSlipLocked && !isLocked ? (
                                            <select
                                              value={slip.bankAccountId || ""}
                                              onChange={async (e) => {
                                                const nextBankId =
                                                  e.target.value === ""
                                                    ? undefined
                                                    : Number(e.target.value);
                                                setSlips((prev) =>
                                                  prev.map((s) =>
                                                    s.id === slip.id
                                                      ? {
                                                        ...s,
                                                        bankAccountId: nextBankId,
                                                      }
                                                      : s,
                                                  ),
                                                );
                                                try {
                                                  // Auto-save change to database
                                                  await updateOrderSlip(slip.id, {
                                                    bankAccountId: nextBankId,
                                                    companyId:
                                                      currentOrder.companyId,
                                                  });
                                                } catch (error) {
                                                  console.error(
                                                    "Failed to update slip bank account:",
                                                    error,
                                                  );
                                                }
                                              }}
                                              className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                            >
                                              <option value="">เลือกธนาคาร</option>
                                              {bankAccounts.map((ba) => (
                                                <option key={ba.id} value={ba.id}>
                                                  {ba.bank} {ba.bank_number}
                                                </option>
                                              ))}
                                            </select>
                                          ) : (
                                            <span>{bankLabel || "-"}</span>
                                          )}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                          {canEditSlips && !isSlipLocked && !isLocked ? (
                                            <input
                                              type="datetime-local"
                                              value={toLocalDatetimeString(
                                                slip.transferDate,
                                              )}
                                              onChange={(e) => {
                                                const nextDate = e.target.value
                                                  ? fromLocalDatetimeString(
                                                    e.target.value,
                                                  )
                                                  : undefined;
                                                setSlips((prev) =>
                                                  prev.map((s) =>
                                                    s.id === slip.id
                                                      ? {
                                                        ...s,
                                                        transferDate: nextDate,
                                                      }
                                                      : s,
                                                  ),
                                                );
                                              }}
                                              className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                            />
                                          ) : (
                                            <span>{transferLabel || "-"}</span>
                                          )}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap text-sm text-right">
                                          {canEditSlips && !isSlipLocked && !isLocked ? (
                                            <input
                                              type="number"
                                              step="0.01"
                                              min="0"
                                              value={
                                                typeof slip.amount === "number" &&
                                                  !Number.isNaN(slip.amount)
                                                  ? slip.amount
                                                  : ""
                                              }
                                              onChange={(e) => {
                                                const nextAmount =
                                                  e.target.value === ""
                                                    ? undefined
                                                    : Number(e.target.value);
                                                setSlips((prev) =>
                                                  prev.map((s) =>
                                                    s.id === slip.id
                                                      ? { ...s, amount: nextAmount }
                                                      : s,
                                                  ),
                                                );
                                              }}
                                              className="w-24 text-right border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                            />
                                          ) : (
                                            <span className="text-gray-900 font-medium">
                                              {typeof slip.amount === "number"
                                                ? slip.amount.toLocaleString(
                                                  undefined,
                                                  {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                  },
                                                )
                                                : "-"}
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap text-center">
                                          <button
                                            onClick={() =>
                                              openSlipViewer({
                                                ...slip,
                                                uploadedByName: resolveUploaderName(
                                                  slip.uploadedBy,
                                                  slip.uploadedByName,
                                                ),
                                              })
                                            }
                                            className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                                            title="View Slip"
                                          >
                                            <Eye size={16} />
                                          </button>
                                          {(() => {
                                            const isConfirmed = [
                                              PaymentStatus.Verified,
                                              PaymentStatus.PreApproved,
                                              PaymentStatus.Approved,
                                              PaymentStatus.Paid,
                                            ].includes(currentOrder.paymentStatus);
                                            if (!isOrderCompleted && !isConfirmed && !isLocked) {
                                              return (
                                                <button
                                                  onClick={() =>
                                                    handleDeleteSlip(
                                                      slip.id,
                                                      slip.url,
                                                    )
                                                  }
                                                  className="text-red-600 hover:text-red-900 inline-flex items-center ml-2"
                                                  title="Delete Slip"
                                                >
                                                  <Trash size={16} />
                                                </button>
                                              );
                                            }
                                            return null;
                                          })()}
                                        </td>
                                        {canVerifySlip && (
                                          <td className="px-3 py-2 whitespace-nowrap text-center">
                                            {isSlipLocked ? (
                                              // สลิปถูกตรวจสอบแล้ว - แสดงติ๊กถูก
                                              <div className="flex items-center justify-center">
                                                <CheckCircle className="w-5 h-5 text-green-600" />
                                              </div>
                                            ) : isOrderCompleted ? (
                                              // Order เสร็จสิ้นแล้ว - แสดงติ๊กถูก (ไม่สามารถแก้ไขได้)
                                              <div className="flex items-center justify-center">
                                                <CheckCircle className="w-5 h-5 text-gray-400" />
                                              </div>
                                            ) : (
                                              // สลิปยังไม่ถูกตรวจสอบ - แสดง checkbox
                                              <input
                                                type="checkbox"
                                                checked={isChecked}
                                                disabled={!isComplete || isLocked}
                                                onChange={(e) => {
                                                  if (!isComplete) return;
                                                  const checked = e.target.checked;
                                                  setSlips((prev) =>
                                                    prev.map((s) =>
                                                      s.id === slip.id
                                                        ? { ...s, checked }
                                                        : s,
                                                    ),
                                                  );
                                                }}
                                                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded cursor-pointer"
                                              />
                                            )}
                                          </td>
                                        )}
                                      </tr>
                                    );
                                  })}
                                  {/* Summary Row */}
                                  <tr className="bg-gray-50 font-medium">
                                    <td
                                      colSpan={3}
                                      className="px-3 py-2 text-right text-sm text-gray-700"
                                    >
                                      รวมยอดที่เลือก:
                                    </td>
                                    <td className="px-3 py-2 text-right text-sm text-blue-700">
                                      {slips
                                        .filter((s: any) => s.checked)
                                        .reduce(
                                          (sum, s) => sum + (Number(s.amount) || 0),
                                          0,
                                        )
                                        .toLocaleString(undefined, {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                    </td>
                                    <td colSpan={canVerifySlip ? 2 : 1}></td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                              <p className="text-gray-500 text-sm">
                                ยังไม่มีหลักฐานการชำระเงิน
                              </p>
                            </div>
                          )}

                          {!isLocked && (
                            <div className="mt-3 flex justify-end">
                              <div className="flex items-center space-x-2">
                                <label
                                  htmlFor={slipUploadInputId}
                                  className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                  <Image size={16} className="mr-2" />
                                  อัปโหลดสลิปเพิ่มเติม
                                </label>
                                <input
                                  id={slipUploadInputId}
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  onChange={handleSlipUpload}
                                  className="hidden"
                                  disabled={isLocked}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Validation Summary */}
                        {canVerifySlip && slips.length > 0 && (
                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-gray-600">
                                ยอดออเดอร์ทั้งหมด:
                              </span>
                              <span className="text-sm font-bold text-gray-900">
                                ฿{calculatedTotals.totalAmount.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-gray-600">
                                ยอดสลิปที่ตรวจสอบแล้ว:
                              </span>
                              <span className="text-sm font-bold text-green-600">
                                ฿
                                {(Number(currentOrder.amountPaid) || 0).toLocaleString()}
                              </span>
                            </div>
                            <div className="border-t border-gray-200 my-2 pt-2 flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-900">
                                ส่วนต่าง:
                              </span>
                              {(() => {
                                const checkedTotal = slips
                                  .filter((s: any) => s.checked)
                                  .reduce(
                                    (sum, s) => sum + (Number(s.amount) || 0),
                                    0,
                                  );
                                const diff =
                                  checkedTotal - calculatedTotals.totalAmount;
                                return (
                                  <span
                                    className={`text - sm font - bold ${diff < 0 ? "text-red-600" : diff > 0 ? "text-blue-600" : "text-green-600"} `}
                                  >
                                    {diff > 0 ? "+" : ""}
                                    {diff.toLocaleString()}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </div>

                      {canVerifySlip &&
                        (currentOrder.paymentMethod === PaymentMethod.Transfer ||
                          currentOrder.paymentMethod === PaymentMethod.PayAfter) &&
                        hasTransferSlip &&
                        !isOrderCompleted && (
                          <div className="flex justify-end mt-4">
                            {(() => {
                              const isConfirmed = [
                                PaymentStatus.Verified,
                                PaymentStatus.PreApproved,
                                PaymentStatus.Approved,
                                PaymentStatus.Paid,
                              ].includes(currentOrder.paymentStatus);

                              const allSlipsComplete = slips.every(
                                (s: any) =>
                                  s.amount && s.bankAccountId && s.transferDate,
                              );
                              const hasCheckedSlips = slips.some(
                                (s: any) => s.checked,
                              );
                              const canConfirm =
                                allSlipsComplete && hasCheckedSlips;

                              return (
                                <button
                                  onClick={handleAcceptSlip}
                                  disabled={isConfirmed || !canConfirm || isLocked}
                                  className={`group relative inline-flex items-center justify-center px-8 py-3 border-2 border-white/20 overflow-hidden rounded-xl text-white shadow-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2
                                  ${isConfirmed || canConfirm
                                      ? "bg-gradient-to-br from-emerald-500 to-green-600 shadow-green-500/40"
                                      : "bg-gray-400 shadow-none opacity-50"
                                    }
                                  ${!isConfirmed && canConfirm
                                      ? "hover:to-green-700 hover:shadow-green-500/60 hover:-translate-y-0.5 cursor-pointer"
                                      : "cursor-not-allowed"
                                    }`}
                                >
                                  <CheckCircle size={20} className="mr-2" />
                                  <span className="font-bold">
                                    {isConfirmed
                                      ? "ยืนยันเรียบร้อย"
                                      : `ยืนยันสลิป (${slips.filter((s: any) => s.checked).length})`}
                                  </span>
                                </button>
                              );
                            })()}
                            {/* Cancel Verification Button */}
                            {currentOrder.paymentStatus ===
                              PaymentStatus.Verified &&
                              currentOrder.orderStatus === OrderStatus.Pending && (
                                <button
                                  onClick={handleCancelVerification}
                                  disabled={isLocked}
                                  className="ml-3 inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                >
                                  <XCircle size={16} className="mr-2" />
                                  ยกเลิกยืนยันสลิป
                                </button>
                              )}
                          </div>
                        )}






                      {/* แสดงข้อมูลธนาคารและเวลาโอน (ถ้ามี) */}

                          {slips.length > 0 ? (
                            <div className="flex flex-wrap gap-3 mb-2">
                              {slips.map((slip) => {
                                const uploadedByName = resolveUploaderName(
                                  slip.uploadedBy,
                                  slip.uploadedByName,
                                );

                                const bankLabel = resolveBankName(
                                  slip.bankAccountId,
                                );

                                const transferLabel = formatSlipDateTime(
                                  slip.transferDate,
                                );

                                const amountLabel =
                                  typeof slip.amount === "number"
                                    ? slip.amount.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })
                                    : undefined;

                                return (
                                  <div
                                    key={slip.id}
                                    className="relative w-40 border rounded-md p-2 group bg-white shadow-sm"
                                  >
                                    <div className="h-32 w-full relative">
                                      <img
                                        onClick={() =>
                                          openSlipViewer({
                                            ...slip,
                                            uploadedByName,
                                          })
                                        }
                                        src={slip.url}
                                        alt="Slip preview"
                                        className="w-full h-full object-contain cursor-pointer"
                                      />

                                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                                        <button
                                          onClick={() =>
                                            openSlipViewer({
                                              ...slip,
                                              uploadedByName,
                                            })
                                          }
                                          className="p-2 bg-white/90 rounded-full text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity flex items-center"
                                        >
                                          <Eye size={16} className="mr-1" /> ดู
                                        </button>
                                      </div>
                                    </div>

                                    <div className="mt-1 text-[11px] text-gray-700 leading-tight space-y-0.5">
                                      {amountLabel && <div>฿{amountLabel}</div>}
                                      {bankLabel && <div>{bankLabel}</div>}
                                      {transferLabel && (
                                        <div>{transferLabel}</div>
                                      )}
                                    </div>
                                    {canVerifySlip && (
                                      <div className="mt-2 text-[11px] space-y-1">
                                        <label className="block text-gray-600">
                                          จำนวนเงินสลิป (ยืนยัน)
                                        </label>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={
                                            typeof slip.amount === "number" &&
                                              !Number.isNaN(slip.amount)
                                              ? slip.amount
                                              : ""
                                          }
                                          onChange={(e) => {
                                            const nextAmount =
                                              e.target.value === ""
                                                ? undefined
                                                : Number(e.target.value);
                                            setSlips((prev) =>
                                              prev.map((s) =>
                                                s.id === slip.id
                                                  ? { ...s, amount: nextAmount }
                                                  : s,
                                              ),
                                            );
                                          }}
                                          className="w-full border rounded px-2 py-1"
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 mb-2">
                              ยังไม่มีหลักฐานการชำระเงิน
                            </p>
                          )}

                          <div className="flex items-center space-x-2">
                            <label
                              htmlFor={`${slipUploadInputId} -payafter`}
                              className={`cursor - pointer w - full text - center py - 2 px - 4 bg - white border border - gray - 300 rounded - lg text - gray - 600 flex items - center justify - center ${currentOrder.paymentStatus === PaymentStatus.Paid
                                ? "opacity-50 cursor-not-allowed"
                                : "hover:bg-gray-50"
                                } `}
                            >
                              <Image size={16} className="mr-2" />
                              อัปโหลดสลิป
                            </label>

                            <input
                              id={`${slipUploadInputId} -payafter`}
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={handleSlipUpload}
                              disabled={
                                currentOrder.paymentStatus === PaymentStatus.Paid || isLocked
                              }
                              className="hidden"
                            />
                          </div>
                        </div>

                        {/* แสดงข้อมูลธนาคารและเวลาโอน (ถ้ามี) */}

                        {(currentOrder.bankAccountId ||
                          currentOrder.transferDate) && (
                            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                              <h4 className="text-sm font-medium text-blue-800 mb-2">
                                ข้อมูลการโอนเงิน
                              </h4>

                              <div className="text-xs text-blue-700 space-y-1">
                                {currentOrder.bankAccountId &&
                                  (() => {
                                    const bankAccount = bankAccounts.find(
                                      (ba) => ba.id === currentOrder.bankAccountId,
                                    );

                                    return (
                                      <p>
                                        ธนาคาร:{" "}
                                        {bankAccount
                                          ? `${bankAccount.bank} ${bankAccount.bank_number} `
                                          : `ID: ${currentOrder.bankAccountId} `}
                                      </p>
                                    );
                                  })()}

                                {currentOrder.transferDate && (
                                  <p>
                                    เวลาโอน:{" "}
                                    {new Date(
                                      currentOrder.transferDate,
                                    ).toLocaleString("th-TH", {
                                      year: "numeric",

                                      month: "2-digit",

                                      day: "2-digit",

                                      hour: "2-digit",

                                      minute: "2-digit",
                                    })}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                        {/* แสดงข้อมูลการตรวจสอบสลิป (ถ้ามี) */}

                        {currentOrder.verificationInfo && (
                          <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
                            <h4 className="text-sm font-medium text-green-800 mb-2">
                              ข้อมูลการตรวจสอบสลิป
                            </h4>

                            <div className="text-xs text-blue-700 space-y-1">
                              {currentOrder.bankAccountId &&
                                (() => {
                                  const bankAccount = bankAccounts.find(
                                    (ba) => ba.id === currentOrder.bankAccountId,
                                  );

                                  return (
                                    <p>
                                      ธนาคาร:{" "}
                                      {bankAccount
                                        ? `${bankAccount.bank} ${bankAccount.bank_number} `
                                        : `ID: ${currentOrder.bankAccountId} `}
                                    </p>
                                  );
                                })()}

                              {currentOrder.transferDate && (
                                <p>
                                  เวลาโอน:{" "}
                                  {new Date(
                                    currentOrder.transferDate,
                                  ).toLocaleString("th-TH", {
                                    year: "numeric",

                                    month: "2-digit",

                                    day: "2-digit",

                                    hour: "2-digit",

                                    minute: "2-digit",
                                  })}
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                      {/* แสดงข้อมูลการตรวจสอบสลิป (ถ้ามี) */}



                    </>
                  )}

                {/* แสดงสลิปที่อัปโหลดสำหรับ payment methods อื่นๆ (ที่ไม่ใช่ Transfer หรือ PayAfter) */}

                {slips.length > 0 &&
                  currentOrder.paymentMethod !== PaymentMethod.Transfer &&
                  currentOrder.paymentMethod !== PaymentMethod.PayAfter && (
                    <div className="mt-2">
                      <h4 className="text-xs font-medium text-gray-500 mb-1">
                        สลิปที่อัปโหลด
                      </h4>

                      <div className="flex flex-wrap gap-3">
                        {slips.map((slip) => {
                          const uploadedByName = resolveUploaderName(
                            slip.uploadedBy,
                            slip.uploadedByName,
                          );

                          return (
                            <div
                              key={slip.id}
                              className="relative w-24 h-24 border rounded-md overflow-hidden group"
                            >
                              <img
                                onClick={() =>
                                  openSlipViewer({ ...slip, uploadedByName })
                                }
                                src={slip.url}
                                alt="Slip"
                                className="w-full h-full object-cover cursor-pointer"
                              />

                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                                <button
                                  onClick={() =>
                                    openSlipViewer({ ...slip, uploadedByName })
                                  }
                                  className="p-1.5 bg-white/90 rounded-full text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity flex items-center"
                                >
                                  <Eye size={14} className="mr-1" /> ดู
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
              </InfoCard>
            )}

          {currentOrder.paymentMethod === PaymentMethod.COD &&
            currentOrder.boxes &&
            currentOrder.boxes.length > 0 && (
              <div className="border rounded-xl p-4 shadow-sm mb-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-gray-800">
                    ยอด COD ต่อกล่อง
                  </h3>
                  {showInputs && (
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-600">จำนวนกล่อง:</span>
                      <input
                        type="number"
                        min="1"
                        value={
                          currentOrder.boxes ? currentOrder.boxes.length : 1
                        }
                        onChange={(e) =>
                          handleCodBoxCountChange(Number(e.target.value))
                        }
                        className="w-16 p-1 text-xs border rounded text-center"
                      />
                    </div>
                  )}
                </div>

                {/* COD Validation Summary - Show when payment method is COD */}
                {currentOrder.paymentMethod === PaymentMethod.COD && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
                    <div className="flex justify-between items-center text-sm mb-1">
                      <span className="text-gray-600">ยอดรวมออเดอร์:</span>
                      <span className="font-medium text-gray-900">
                        ฿{calculatedTotals.totalAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm mb-1">
                      <span className="text-gray-600">
                        ยอดเก็บเงินรวมทุกกล่อง:
                      </span>
                      <span className="font-medium text-blue-600">
                        ฿
                        {currentOrder.boxes
                          .reduce(
                            (sum, b) =>
                              sum + (b.collectionAmount ?? b.codAmount ?? 0),
                            0,
                          )
                          .toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-200 mt-2">
                      <span className="font-medium text-gray-700">
                        ส่วนต่าง:
                      </span>
                      {(() => {
                        const boxTotal = currentOrder.boxes.reduce(
                          (sum, b) =>
                            sum + (b.collectionAmount ?? b.codAmount ?? 0),
                          0,
                        );
                        const diff = boxTotal - calculatedTotals.totalAmount;
                        const isMatch = Math.abs(diff) < 0.01;

                        return (
                          <span
                            className={`font-bold ${isMatch ? "text-green-600" : "text-red-600"}`}
                          >
                            {isMatch
                              ? "ครบถ้วน (0.00)"
                              : `${diff > 0 ? "+" : ""}${diff.toLocaleString()} (ยอดไม่ตรง)`}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs text-gray-700">
                    <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">
                          กล่อง / Tracking
                        </th>

                        <th className="px-3 py-2 text-right font-semibold">
                          ยอดเก็บเงิน
                        </th>

                        <th className="px-3 py-2 text-right font-semibold">
                          เก็บแล้ว
                        </th>

                        <th className="px-3 py-2 text-right font-semibold">
                          ยกเลิก/ยก
                        </th>

                        <th className="px-3 py-2 text-right font-semibold">
                          คงเหลือ
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100">
                      {currentOrder.boxes.map((box, idx) => {
                        const collection =
                          box.collectionAmount ?? box.codAmount ?? 0;

                        const paidRaw = box.collectedAmount ?? 0;

                        const waived = box.waivedAmount ?? 0;

                        const hasAnyCollected = currentOrder.boxes.some(
                          (b) => (b.collectedAmount ?? 0) > 0,
                        );

                        let paid = paidRaw;

                        if (
                          !hasAnyCollected &&
                          (currentOrder.amountPaid ?? 0) > 0
                        ) {
                          const totalCollection = currentOrder.boxes.reduce(
                            (sum, b) =>
                              sum + (b.collectionAmount ?? b.codAmount ?? 0),
                            0,
                          );

                          const weight =
                            totalCollection > 0
                              ? collection / totalCollection
                              : 1 / Math.max(1, currentOrder.boxes.length);

                          paid = Math.min(
                            collection,
                            (currentOrder.amountPaid ?? 0) * weight,
                          );
                        }

                        const remaining = Math.max(
                          0,
                          collection - paid - waived,
                        );

                        const rowBg = idx % 2 === 0 ? "bg-white" : "bg-gray-50";

                        return (
                          <tr key={box.boxNumber} className={rowBg}>
                            <td className="px-3 py-2 font-medium text-gray-800">
                              <div className="flex flex-col leading-tight">
                                <span>กล่อง {box.boxNumber}</span>

                                {box.trackingNumber ? (
                                  <span className="text-[11px] text-gray-500">
                                    Tracking: {box.trackingNumber}
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            <td className="px-3 py-2 text-right">
                              {showInputs && !isLocked ? (
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={collection}
                                  onChange={(e) =>
                                    handleBoxFieldChange(
                                      box.boxNumber,
                                      "collectionAmount",
                                      Number(e.target.value),
                                    )
                                  }
                                  className="w-full text-right border border-gray-200 rounded px-2 py-1"
                                />
                              ) : (
                                <span>฿{collection.toLocaleString()}</span>
                              )}
                            </td>

                            <td className="px-3 py-2 text-right">
                              {showInputs && !isLocked ? (
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={paid}
                                  onChange={(e) =>
                                    handleBoxFieldChange(
                                      box.boxNumber,
                                      "collectedAmount",
                                      Number(e.target.value),
                                    )
                                  }
                                  className="w-full text-right border border-gray-200 rounded px-2 py-1"
                                />
                              ) : (
                                <span>฿{paid.toLocaleString()}</span>
                              )}
                            </td>

                            <td className="px-3 py-2 text-right text-red-600">
                              {showInputs && !isLocked ? (
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={waived}
                                  onChange={(e) =>
                                    handleBoxFieldChange(
                                      box.boxNumber,
                                      "waivedAmount",
                                      Number(e.target.value),
                                    )
                                  }
                                  className="w-full text-right border border-gray-200 rounded px-2 py-1"
                                />
                              ) : (
                                <span>-฿{waived.toLocaleString()}</span>
                              )}
                            </td>

                            <td className="px-3 py-2 text-right font-semibold text-gray-900">
                              ฿{remaining.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>

                    <tfoot className="bg-gray-50">
                      <tr>
                        <td className="px-3 py-2 text-sm font-semibold text-gray-800">
                          รวม ({currentOrder.boxes.length} กล่อง)
                        </td>

                        <td className="px-3 py-2 text-right text-sm font-semibold text-gray-900">
                          ฿{calculatedTotals.totalAmount.toLocaleString()}
                        </td>

                        <td className="px-3 py-2 text-right text-sm font-semibold text-gray-900">
                          ฿
                          {(() => {
                            const hasAnyCollected = currentOrder.boxes.some(
                              (b) => (b.collectedAmount ?? 0) > 0,
                            );

                            if (hasAnyCollected) {
                              // If any box has collectedAmount, sum them up
                              return currentOrder.boxes.reduce(
                                (sum, b) => sum + (b.collectedAmount ?? 0),
                                0,
                              );
                            } else if ((currentOrder.amountPaid ?? 0) > 0) {
                              // If no collectedAmount but amountPaid exists, use amountPaid
                              return currentOrder.amountPaid ?? 0;
                            }
                            return 0;
                          })().toLocaleString()}
                        </td>

                        <td className="px-3 py-2 text-right text-sm font-semibold text-red-600">
                          -฿
                          {currentOrder.boxes
                            .reduce((sum, b) => sum + (b.waivedAmount ?? 0), 0)
                            .toLocaleString()}
                        </td>

                        <td className="px-3 py-2 text-right text-sm font-bold text-gray-900">
                          ฿
                          {(() => {
                            const hasAnyCollected = currentOrder.boxes.some(
                              (b) => (b.collectedAmount ?? 0) > 0,
                            );
                            let totalCollected = 0;

                            if (hasAnyCollected) {
                              totalCollected = currentOrder.boxes.reduce(
                                (sum, b) => sum + (b.collectedAmount ?? 0),
                                0,
                              );
                            } else if ((currentOrder.amountPaid ?? 0) > 0) {
                              totalCollected = currentOrder.amountPaid ?? 0;
                            }

                            const totalWaived = currentOrder.boxes.reduce(
                              (sum, b) => sum + (b.waivedAmount ?? 0),
                              0,
                            );
                            return Math.max(
                              0,
                              calculatedTotals.totalAmount -
                              totalCollected -
                              totalWaived,
                            );
                          })().toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}


          {(currentOrder.paymentMethod === PaymentMethod.Transfer ||
            currentOrder.paymentMethod === PaymentMethod.PayAfter) &&
            currentOrder.boxes &&
            currentOrder.boxes.length > 0 && (
              <InfoCard icon={Truck} title="Tracking รายกล่อง">
                <div className="flex flex-wrap gap-2">
                  {currentOrder.boxes.map((box) => {
                    const hasTracking = !!box.trackingNumber;
                    return (
                      <div
                        key={box.boxNumber}
                        className={`flex items-center px-2 py-1 rounded text-xs border ${hasTracking
                          ? "bg-green-50 border-green-200 text-green-700"
                          : "bg-gray-50 border-gray-200 text-gray-500"
                          }`}
                      >
                        <span className="font-medium mr-2">
                          กล่อง {box.boxNumber}:
                        </span>
                        <span>
                          {hasTracking ? box.trackingNumber : "ยังไม่มี"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </InfoCard>
            )}

          <InfoCard icon={Truck} title="การจัดส่ง">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  สถานะออเดอร์
                </label>

                <select
                  value={currentOrder.orderStatus}
                  onChange={(e) =>
                    handleFieldChange(
                      "orderStatus",
                      e.target.value as OrderStatus,
                    )
                  }
                  disabled={isLocked}
                  className={`w-full p-2 border border-gray-300 rounded-md shadow-sm ${isLocked ? "bg-gray-100 cursor-not-allowed" : ""}`}
                >
                  {Object.values(OrderStatus)

                    .filter((status) => {
                      if (showInputs) {
                        // If modifiable, only allow keeping current status or cancelling
                        // and exclude 'Completed' status
                        return (
                          status === currentOrder.orderStatus ||
                          status === OrderStatus.Cancelled
                        );
                      }

                      return true;
                    })

                    .map((status) => (
                      <option key={status} value={status}>
                        {ORDER_STATUS_LABELS[status] ?? status}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  เลข Tracking (คั่นด้วย ,)
                </label>

                <input
                  type="text"
                  value={currentOrder.trackingNumbers.join(", ")}
                  onChange={(e) => {
                    const parts = e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean);

                    const deduped = Array.from(new Set(parts));

                    handleFieldChange("trackingNumbers", deduped);
                  }}
                  disabled={isLocked}
                  className={`w-full p-2 border border-gray-300 rounded-md shadow-sm ${isLocked ? "bg-gray-100 cursor-not-allowed" : ""}`}
                  placeholder="TH123, TH456"
                />
              </div>
            </div>
          </InfoCard>

          <InfoCard icon={History} title="ประวัติออเดอร์">
            <div className="space-y-4 max-h-40 overflow-y-auto pr-2">
              {orderActivities.length > 0 ? (
                orderActivities.map((activity) => (
                  <div key={activity.id} className="flex">
                    <div className="flex-shrink-0 w-8 text-center pt-0.5">
                      <ActivityIcon type={activity.type} />
                    </div>

                    <div className="ml-2">
                      <p className="text-xs text-gray-700">
                        {activity.description}
                      </p>

                      <p className="text-xs text-gray-400 mt-0.5">
                        {activity.actorName} •{" "}
                        {getRelativeTime(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">
                  ไม่มีประวัติการเปลี่ยนแปลง
                </p>
              )}
            </div>
          </InfoCard>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              ยกเลิก
            </button>

            {!isOrderCompleted && (
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-100 text-blue-700 font-semibold rounded-lg hover:bg-blue-200"
              >
                บันทึกการเปลี่ยนแปลง
              </button>
            )}
          </div>
        </div>

        {lightboxSlip && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-4 md:p-6 relative">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  สลิปการชำระเงิน
                </h3>

                <button
                  onClick={() => setLightboxSlip(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-center bg-gray-50 rounded-md p-2 border">
                  <img
                    src={lightboxSlip.url}
                    alt="Slip"
                    className="max-h-[70vh] object-contain rounded"
                  />
                </div>

                <div className="space-y-2 text-sm text-gray-700">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-gray-500">ผู้อัพโหลด</span>

                    <span className="font-medium">
                      {resolveUploaderName(
                        lightboxSlip.uploadedBy,
                        lightboxSlip.uploadedByName,
                      ) ?? "ไม่ทราบ"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-gray-500">เวลาอัพโหลด</span>

                    <span className="font-medium">
                      {lightboxSlip.createdAt
                        ? new Date(lightboxSlip.createdAt).toLocaleString(
                          "th-TH",
                        )
                        : "-"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-gray-500">จำนวนเงิน</span>

                    <span className="font-medium">
                      {typeof lightboxSlip.amount === "number"
                        ? `฿${lightboxSlip.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} `
                        : "-"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-gray-500">ธนาคาร</span>

                    <span className="font-medium">
                      {resolveBankName(lightboxSlip.bankAccountId) ?? "-"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">วัน-เวลา</span>

                    <span className="font-medium">
                      {formatSlipDateTime(lightboxSlip.transferDate) ?? "-"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => setLightboxSlip(null)}
                  className="px-4 py-2 rounded-md border text-gray-700 hover:bg-gray-50"
                >
                  ปิด
                </button>

                <button
                  onClick={() =>
                    handleDeleteSlip(lightboxSlip.id, lightboxSlip.url)
                  }
                  className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!lightboxSlip.id && !slipPreview}
                >
                  ลบ
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal >

      {/* Product Selector Modal */}
      < ProductSelectorModal
        isOpen={productSelectorOpen}
        onClose={closeProductSelector}
        tab={selectorTab}
        onTabChange={setSelectorTab}
        products={products}
        promotions={promotions}
        searchTerm={selectorSearchTerm}
        onSearchChange={setSelectorSearchTerm}
        onSelectProduct={handleSelectProduct}
        onSelectPromotion={handleSelectPromotion}
      />
    </>
  );
};

export default OrderManagementModal;
