import React, { useState, useMemo, useEffect } from "react";
import {
  Customer,
  Order,
  LineItem,
  PaymentMethod,
  PaymentStatus,
  OrderStatus,
  Product,
  Promotion,
  Page,
  CodBox,
  Address,
  CustomerLifecycleStatus,
  CustomerBehavioralStatus,
  CustomerGrade,
  Warehouse,
  User,
} from "../types";

import { useRef, useCallback } from "react";

import {
  updateCustomer,
  listBankAccounts,
  getUpsellOrders,
  addUpsellItems,
  createOrderSlip,
  listOrderSlips,
} from "../services/api";
import { formatThaiDateTime } from "../utils/time";

import resolveApiBasePath from "../utils/apiBasePath";

const emptyAddress: Address = {
  recipientFirstName: "",

  recipientLastName: "",

  street: "",

  subdistrict: "",

  district: "",

  province: "",

  postalCode: "",
};

interface TransferSlipUpload {
  id: number;
  name: string;
  dataUrl: string;
  bankAccountId?: number | null;
  transferDate?: string;
  amount?: number | null;
}

interface UpsellSlip {
  id?: number;
  url: string;
  uploadedBy?: number | null;
  uploadedByName?: string | null;
  createdAt?: string;
  amount?: number | null;
  transferDate?: string | null;
}

const SHIPPING_PROVIDERS = [
  "J&T Express",
  "Flash Express",
  "Kerry Express",
  "Aiport Logistic",
];

const sanitizeAddressValue = (value?: string | null): string => {
  if (value == null) return "";

  const trimmed = value.trim();

  if (!trimmed) return "";

  const lower = trimmed.toLowerCase();

  if (lower === "undefined" || lower === "null") {
    return "";
  }

  return trimmed;
};

const normalizeAddress = (address?: Partial<Address> | null): Address => ({
  recipientFirstName: sanitizeAddressValue(address?.recipientFirstName ?? null),

  recipientLastName: sanitizeAddressValue(address?.recipientLastName ?? null),

  street: sanitizeAddressValue(address?.street ?? null),

  subdistrict: sanitizeAddressValue(address?.subdistrict ?? null),

  district: sanitizeAddressValue(address?.district ?? null),

  province: sanitizeAddressValue(address?.province ?? null),

  postalCode: sanitizeAddressValue(address?.postalCode ?? null),
});

const sanitizeSavedAddress = (addr: any) => ({
  ...addr,

  address: sanitizeAddressValue(addr?.address ?? null),

  recipient_first_name: sanitizeAddressValue(
    addr?.recipient_first_name ?? null,
  ),

  recipient_last_name: sanitizeAddressValue(addr?.recipient_last_name ?? null),

  recipientFirstName: sanitizeAddressValue(addr?.recipient_first_name ?? null),

  recipientLastName: sanitizeAddressValue(addr?.recipient_last_name ?? null),

  sub_district: sanitizeAddressValue(addr?.sub_district ?? null),

  district: sanitizeAddressValue(addr?.district ?? null),

  province: sanitizeAddressValue(addr?.province ?? null),

  zip_code: sanitizeAddressValue(addr?.zip_code ?? null),
});

interface CreateOrderPageProps {
  customers: Customer[];

  products: Product[];

  promotions: Promotion[];

  pages?: Page[];

  platforms?: any[];

  warehouses?: Warehouse[];

  currentUser: User;

  users: User[];

  onSave: (payload: {
    order: Partial<Omit<Order, "id" | "orderDate" | "companyId" | "creatorId">>;

    newCustomer?: Omit<
      Customer,
      | "id"
      | "companyId"
      | "totalPurchases"
      | "totalCalls"
      | "tags"
      | "assignmentHistory"
    >;

    customerUpdate?: Partial<
      Pick<Customer, "address" | "facebookName" | "lineId">
    >;

    updateCustomerInfo?: {
      firstName?: string;

      lastName?: string;

      phone?: string;

      backupPhone?: string | null;
    };

    newCustomerAddress?: {
      customer_id: string | number;

      address: string;

      province: string;

      district: string;

      sub_district: string;

      zip_code: string;
    };

    updateCustomerAddress?: boolean;

    updateCustomerSocials?: boolean;

    slipUploads?: string[];
  }) => Promise<string | undefined>;

  onCancel: () => void;

  initialData?: { customer: Customer; upsell?: boolean };

  onUpsellSuccess?: () => void;
}

type ValidationField =
  | "customerSelector"
  | "shippingAddress"
  | "deliveryDate"
  | "items"
  | "paymentMethod"
  | "transferSlips"
  | "salesChannel"
  | "salesChannelPage"
  | "cod"
  | "newCustomerFirstName"
  | "newCustomerPhone"
  | "editedCustomerPhone"
  | "editedCustomerBackupPhone";

// Order Summary Component

const OrderSummary: React.FC<{
  orderData: Partial<Order>;
  onUpdateOrder: (field: keyof Order, value: any) => void;
}> = ({ orderData, onUpdateOrder }) => {
  const visibleItems = useMemo(
    () => (orderData.items || []).filter((it) => !it.parentItemId),

    [orderData.items],
  );

  const goodsSum = useMemo(() => {
    return visibleItems.reduce(
      (acc, item) =>
        acc +
        (item.isFreebie ? 0 : (item.quantity || 0) * (item.pricePerUnit || 0)),

      0,
    );
  }, [visibleItems]);

  const itemsDiscount = useMemo(() => {
    return visibleItems.reduce(
      (acc, item) => acc + (item.isFreebie ? 0 : item.discount || 0),

      0,
    );
  }, [visibleItems]);

  const subTotal = useMemo(
    () => goodsSum - itemsDiscount,

    [goodsSum, itemsDiscount],
  );

  const billDiscountPercent = Number(orderData.billDiscount || 0);

  const billDiscountAmount = (subTotal * billDiscountPercent) / 100;

  const totalAmount = useMemo(
    () => subTotal + (orderData.shippingCost || 0) - billDiscountAmount,

    [subTotal, orderData.shippingCost, billDiscountAmount],
  );

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4 sticky top-6">
      <h3 className="font-semibold text-base mb-3 pb-2 border-b text-[#0e141b]">
        สรุปคำสั่งซื้อ
      </h3>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between text-[#4e7397]">
          <span>ยอดรวมสินค้า</span>

          <span className="text-[#0e141b] font-medium">
            ฿{goodsSum.toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between text-[#4e7397]">
          <span>ส่วนลดรายการสินค้า</span>

          <span className="text-red-600 font-medium">
            -฿{itemsDiscount.toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between items-center text-[#4e7397]">
          <span>ค่าขนส่ง</span>
          <input
            type="number"
            value={orderData.shippingCost || 0}
            onChange={(e) =>
              onUpdateOrder("shippingCost", Number(e.target.value))
            }
            onFocus={(e) => e.target.select()}
            className="w-24 p-1 text-right border border-gray-300 rounded text-sm text-[#0e141b] focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-between items-center text-[#4e7397]">
          <span>ส่วนลดท้ายบิล (%)</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              (-฿{billDiscountAmount.toFixed(2)})
            </span>
            <input
              type="number"
              value={orderData.billDiscount || 0}
              onChange={(e) =>
                onUpdateOrder("billDiscount", Number(e.target.value))
              }
              onFocus={(e) => e.target.select()}
              className="w-24 p-1 text-right border border-gray-300 rounded text-sm text-red-600 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-between font-bold text-base border-t pt-3 mt-3">
          <span className="text-[#0e141b]">ยอดสุทธิ</span>

          <span className="text-green-600">฿{totalAmount.toFixed(2)}</span>
        </div>
      </div>

      {visibleItems.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <h4 className="font-medium text-xs mb-2 text-[#0e141b]">
            รายการสินค้า ({visibleItems.length})
          </h4>

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {visibleItems.map((item, idx) => (
              <div
                key={item.id}
                className="text-xs p-2 bg-white rounded border"
              >
                <div className="font-medium text-[#0e141b]">
                  {item.productName || "(ไม่ระบุ)"}
                </div>

                <div className="text-[#4e7397] mt-1">
                  {item.quantity} × ฿{item.pricePerUnit.toFixed(2)}
                  {item.discount > 0 && <span> - ฿{item.discount}</span>}
                  {item.isFreebie && (
                    <span className="ml-2 text-green-600">(ของแถม)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const CreateOrderPage: React.FC<CreateOrderPageProps> = ({
  customers,

  products,

  promotions,

  pages: rawPages = [],

  platforms = [],

  warehouses = [],

  currentUser,

  users,

  onSave,

  onCancel,

  onSuccess,

  initialData,

  onUpsellSuccess,
}) => {
  const pages = useMemo(() => {
    return [...(rawPages || [])].sort((a, b) =>
      a.name.localeCompare(b.name, "th"),
    );
  }, [rawPages]);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    initialData?.customer ?? null,
  );

  const [isCreatingNewCustomer, setIsCreatingNewCustomer] = useState(false);

  const [customerStatus, setCustomerStatus] = useState("");
  const customerStatusRef = useRef<HTMLSelectElement>(null);
  const postalCodeInputRef = useRef<HTMLInputElement>(null);

  const isUpsellMode = initialData?.upsell === true;

  const [upsellOrders, setUpsellOrders] = useState<Order[]>([]);

  const [selectedUpsellOrder, setSelectedUpsellOrder] = useState<Order | null>(
    null,
  );

  const [upsellLoading, setUpsellLoading] = useState(false);

  const [upsellSaving, setUpsellSaving] = useState(false);

  const [upsellError, setUpsellError] = useState<string | null>(null);

  const [upsellItems, setUpsellItems] = useState<LineItem[]>([]);

  const [showUpsellSuccessModal, setShowUpsellSuccessModal] = useState(false);

  const [upsellBoxes, setUpsellBoxes] = useState<CodBox[]>([]);
  const [numUpsellBoxes, setNumUpsellBoxes] = useState(1);
  const [upsellProductSelectorOpen, setUpsellProductSelectorOpen] =
    useState(false);
  const [upsellEditingItemId, setUpsellEditingItemId] = useState<number | null>(
    null,
  );
  const [upsellSelectorTab, setUpsellSelectorTab] = useState<
    "products" | "promotions"
  >("products");
  const [upsellSelectorSearchTerm, setUpsellSelectorSearchTerm] = useState("");
  const [upsellSlips, setUpsellSlips] = useState<UpsellSlip[]>([]);
  const [upsellSlipLoading, setUpsellSlipLoading] = useState(false);
  const [upsellSlipError, setUpsellSlipError] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<number | null>(null);

  const [selectedSubDistrict, setSelectedSubDistrict] = useState<number | null>(
    null,
  );

  const [selectedProvince, setSelectedProvince] = useState<number | null>(null);

  const [selectedGeography, setSelectedGeography] = useState<number | null>(
    null,
  );

  const [geographies, setGeographies] = useState<any[]>([]);

  const [provinces, setProvinces] = useState<any[]>([]);

  const [districts, setDistricts] = useState<any[]>([]);

  const [subDistricts, setSubDistricts] = useState<any[]>([]);

  const [addressLoading, setAddressLoading] = useState(false);

  // Search state for address dropdowns

  const [provinceSearchTerm, setProvinceSearchTerm] = useState("");

  const [districtSearchTerm, setDistrictSearchTerm] = useState("");

  const [subDistrictSearchTerm, setSubDistrictSearchTerm] = useState("");

  const [showProvinceDropdown, setShowProvinceDropdown] = useState(false);

  const [showDistrictDropdown, setShowDistrictDropdown] = useState(false);

  const [showSubDistrictDropdown, setShowSubDistrictDropdown] = useState(false);

  const [postalCodeResults, setPostalCodeResults] = useState<any[]>([]);

  const [showPostalCodeDropdown, setShowPostalCodeDropdown] = useState(false);

  const [newCustomerFirstName, setNewCustomerFirstName] = useState("");

  const [newCustomerLastName, setNewCustomerLastName] = useState("");

  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  const [newCustomerBackupPhone, setNewCustomerBackupPhone] = useState("");

  const [newCustomerType, setNewCustomerType] = useState("New Customer");

  const [newCustomerPhoneError, setNewCustomerPhoneError] = useState("");

  const [newCustomerBackupPhoneError, setNewCustomerBackupPhoneError] =
    useState("");

  const [editedCustomerFirstName, setEditedCustomerFirstName] = useState(
    initialData?.customer?.firstName || "",
  );

  const [editedCustomerLastName, setEditedCustomerLastName] = useState(
    initialData?.customer?.lastName || "",
  );

  const [editedCustomerPhone, setEditedCustomerPhone] = useState(
    initialData?.customer?.phone || "",
  );

  const [editedCustomerBackupPhone, setEditedCustomerBackupPhone] = useState(
    initialData?.customer?.backupPhone || "",
  );

  const [editedCustomerType, setEditedCustomerType] = useState(
    initialData?.customer?.customerType || "New Customer",
  );

  const [editedCustomerPhoneError, setEditedCustomerPhoneError] = useState("");

  const [editedCustomerBackupPhoneError, setEditedCustomerBackupPhoneError] =
    useState("");

  const [orderData, setOrderData] = useState<Partial<Order>>({
    items: [
      {
        id: Date.now(),

        productName: "",

        quantity: 1,

        pricePerUnit: 0,

        discount: 0,

        isFreebie: false,

        boxNumber: 1,
      },
    ],

    shippingCost: 0,

    billDiscount: 0,

    deliveryDate: new Date(Date.now() + 864e5).toISOString().split("T")[0],

    customerId: initialData?.customer?.id,

    boxes: [{ boxNumber: 1, codAmount: 0 }],
  });

  const [transferSlipUploads, setTransferSlipUploads] = useState<
    TransferSlipUpload[]
  >([]);

  const upsellUsersById = useMemo(
    () => new Map(users.map((u) => [u.id, u])),
    [users],
  );

  const normalizeUpsellSlip = useCallback(
    (raw: any): UpsellSlip => ({
      id: raw?.id ? Number(raw.id) : undefined,
      url: raw?.url ?? "",
      uploadedBy: (() => {
        const val =
          raw?.uploadedBy ??
          raw?.uploaded_by ??
          raw?.upload_by ??
          raw?.uploadBy ??
          raw?.upload_by_id;
        const num = val == null ? undefined : Number(val);
        return Number.isFinite(num) ? num : undefined;
      })(),
      uploadedByName:
        raw?.uploadedByName ??
        raw?.uploaded_by_name ??
        raw?.upload_by_name ??
        null,
      createdAt: raw?.createdAt ?? raw?.created_at,
      amount:
        typeof raw?.amount !== "undefined" && raw?.amount !== null
          ? Number(raw.amount)
          : undefined,
      transferDate: raw?.transferDate ?? raw?.transfer_date ?? null,
    }),
    [],
  );

  const upsellSlipInputId = useMemo(
    () =>
      selectedUpsellOrder
        ? `upsell-slip-${selectedUpsellOrder.id}`
        : "upsell-slip",
    [selectedUpsellOrder?.id],
  );

  const normalizeUpsellItems = (
    items: any[] | undefined | null,
  ): LineItem[] => {
    if (!Array.isArray(items)) return [];

    return items.map((it: any, idx: number) => ({
      id: Number(it.id ?? idx + 1),

      productId:
        typeof it.product_id !== "undefined" && it.product_id !== null
          ? Number(it.product_id)
          : typeof it.productId !== "undefined" && it.productId !== null
            ? Number(it.productId)
            : undefined,

      productName:
        it.product_name ??
        it.productName ??
        it.product?.name ??
        (it.product_id ? `Product ID: ${it.product_id}` : `สินค้า ${idx + 1}`),

      quantity: Number(it.quantity ?? 0),

      pricePerUnit: Number(
        it.price_per_unit ?? it.pricePerUnit ?? it.unit_price ?? it.price ?? 0,
      ),

      discount: Number(it.discount ?? it.discount_amount ?? 0),

      isFreebie: Boolean(it.is_freebie ?? it.isFreebie ?? false),

      boxNumber: Number(it.box_number ?? it.boxNumber ?? 1),

      promotionId:
        typeof it.promotion_id !== "undefined" && it.promotion_id !== null
          ? Number(it.promotion_id)
          : undefined,

      parentItemId:
        typeof it.parent_item_id !== "undefined" && it.parent_item_id !== null
          ? Number(it.parent_item_id)
          : undefined,

      isPromotionParent: Boolean(
        it.is_promotion_parent ?? it.isPromotionParent ?? false,
      ),

      sku: it.sku ?? it.product_sku ?? it.product?.sku ?? "-",

      // Add creator_id from order_items

      creatorId:
        typeof it.creator_id !== "undefined" && it.creator_id !== null
          ? Number(it.creator_id)
          : typeof it.creatorId !== "undefined" && it.creatorId !== null
            ? Number(it.creatorId)
            : undefined,
    }));
  };

  const normalizePaymentMethod = (pm: any): PaymentMethod | undefined => {
    if (
      pm === PaymentMethod.COD ||
      pm === PaymentMethod.Transfer ||
      pm === PaymentMethod.PayAfter
    ) {
      return pm as PaymentMethod;
    }

    const val = String(pm ?? "").toLowerCase();

    if (["cod", "c.o.d", "cash_on_delivery", "cashondelivery"].includes(val)) {
      return PaymentMethod.COD;
    }

    if (
      [
        "transfer",
        "bank_transfer",
        "banktransfer",
        "โอน",
        "transferbank",
      ].includes(val)
    ) {
      return PaymentMethod.Transfer;
    }

    if (
      ["payafter", "pay_after", "pay-after", "ผ่อนชำระ", "ผ่อน"].includes(val)
    ) {
      return PaymentMethod.PayAfter;
    }

    return undefined;
  };

  const normalizeUpsellOrders = (list: any[]): Order[] => {
    return (Array.isArray(list) ? list : []).map((raw, idx) => ({
      ...(raw as Order),

      id: raw.id ?? raw.order_id ?? raw.orderId ?? String(idx + 1),

      orderDate:
        raw.orderDate ?? raw.order_date ?? raw.created_at ?? raw.createdAt,

      deliveryDate: raw.deliveryDate ?? raw.delivery_date,

      paymentMethod: normalizePaymentMethod(
        raw.paymentMethod ?? raw.payment_method,
      ),

      orderStatus: raw.orderStatus ?? raw.order_status,

      salesChannel: raw.salesChannel ?? raw.sales_channel,

      trackingNumbers: raw.trackingNumbers ?? raw.tracking_numbers ?? [],

      shippingAddress: raw.shippingAddress ??
        raw.shipping_address ?? {
        recipientFirstName:
          raw.recipientFirstName ?? raw.recipient_first_name,

        recipientLastName: raw.recipientLastName ?? raw.recipient_last_name,

        street: raw.street,

        subdistrict: raw.subdistrict,

        district: raw.district,

        province: raw.province,

        postalCode: raw.postalCode ?? raw.postal_code,
      },

      creatorId: raw.creatorId ?? raw.creator_id ?? raw.seller_id ?? null,

      totalAmount: Number(
        raw.totalAmount ??
        raw.total_amount ??
        raw.net_total ??
        raw.summary_total ??
        0,
      ),

      items: normalizeUpsellItems(
        raw.items ?? raw.order_items ?? raw.orderItems,
      ),
    }));
  };

  useEffect(() => {
    if (!isUpsellMode) return;
    const customerId =
      initialData?.customer?.id || initialData?.customer?.customerId;

    if (!customerId) {
      setUpsellError("ไม่พบข้อมูลลูกค้าที่ต้องการอัปเซล");

      return;
    }

    let cancelled = false;

    setUpsellLoading(true);

    setUpsellError(null);

    getUpsellOrders(customerId, currentUser?.id)
      .then((list: any) => {
        if (cancelled) return;

        const normalized = normalizeUpsellOrders(list);

        setUpsellOrders(normalized);

        setSelectedUpsellOrder(normalized[0] ?? null);
      })

      .catch((err: any) => {
        if (cancelled) return;

        setUpsellError(
          err?.message || "โหลดออเดอร์ที่เข้าเงื่อนไขอัปเซลไม่สำเร็จ",
        );
      })

      .finally(() => {
        if (cancelled) return;

        setUpsellLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    isUpsellMode,
    initialData?.customer?.id,
    initialData?.customer?.customerId,
    initialData?.customer?.customerRefId,
    currentUser?.id,
  ]);

  useEffect(() => {
    const pm = selectedUpsellOrder
      ? normalizePaymentMethod(
        selectedUpsellOrder.paymentMethod ??
        (selectedUpsellOrder as any).payment_method,
      )
      : undefined;

    if (!selectedUpsellOrder || pm !== PaymentMethod.Transfer) {
      setUpsellSlips([]);
      setUpsellSlipError(null);
      setUpsellSlipLoading(false);
      return;
    }

    let cancelled = false;
    setUpsellSlipLoading(true);
    setUpsellSlipError(null);
    listOrderSlips(String(selectedUpsellOrder.id))
      .then((list: any[]) => {
        if (cancelled) return;
        const normalized = (list || [])
          .map((item) => normalizeUpsellSlip(item))
          .filter((s) => s.url);
        setUpsellSlips(normalized);
      })
      .catch((err: any) => {
        if (cancelled) return;
        console.error("load upsell slips", err);
        setUpsellSlipError(err?.message || "โหลดสลิปไม่สำเร็จ");
      })
      .finally(() => {
        if (cancelled) return;
        setUpsellSlipLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [normalizeUpsellSlip, selectedUpsellOrder]);

  const isUpsellTransferPayment = useMemo(() => {
    if (!selectedUpsellOrder) return false;
    const pm = normalizePaymentMethod(
      selectedUpsellOrder.paymentMethod ??
      (selectedUpsellOrder as any).payment_method,
    );
    return pm === PaymentMethod.Transfer;
  }, [selectedUpsellOrder]);

  const handleUpsellAddNewItem = () => {
    setUpsellItems((prev) => [
      ...prev,

      {
        id: Date.now(),

        productId: null,

        productName: "",

        quantity: 1,

        pricePerUnit: 0,

        discount: 0,

        isFreebie: false,

        boxNumber: 1,
      },
    ]);
  };

  const handleUpsellRemoveItem = (id: number) => {
    setUpsellItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpsellUpdateItem = (
    id: number,

    field: keyof LineItem,

    value: any,
  ) => {
    setUpsellItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const updatedItem = { ...item, [field]: value };

        // ถ้าแก้ไขส่วนลด → คำนวณยอดรวมใหม่

        if (field === "discount") {
          const discount = Math.max(
            0,
            Math.min(
              Number(value) || 0,
              (updatedItem.pricePerUnit || 0) * (updatedItem.quantity || 0),
            ),
          );

          const newTotal =
            (updatedItem.pricePerUnit || 0) * (updatedItem.quantity || 0) -
            discount;

          (updatedItem as any).line_total = Math.max(0, newTotal);

          updatedItem.discount = discount;
        }

        // ถ้าแก้ไขยอดรวม → คำนวณส่วนลดใหม่
        else if (
          (field as string) === "line_total" ||
          (field as string) === "total"
        ) {
          const baseTotal =
            (updatedItem.pricePerUnit || 0) * (updatedItem.quantity || 0);

          const newTotal = Math.max(0, Math.min(Number(value) || 0, baseTotal));

          const newDiscount = Math.max(0, baseTotal - newTotal);

          updatedItem.discount = newDiscount;

          (updatedItem as any).line_total = newTotal;
        }

        // ถ้าแก้ไขจำนวนหรือราคาต่อหน่วย → คำนวณยอดรวมใหม่
        else if (field === "quantity" || field === "pricePerUnit") {
          const baseTotal =
            (updatedItem.pricePerUnit || 0) * (updatedItem.quantity || 0);

          const currentDiscount = updatedItem.discount || 0;

          const newTotal = Math.max(0, baseTotal - currentDiscount);

          (updatedItem as any).line_total = newTotal;
        }

        return updatedItem;
      }),
    );
  };

  const handleUpsellProductSelect = (itemId: number, productId: number) => {
    const product = products.find((p) => Number(p.id) === Number(productId));

    if (!product) return;

    setUpsellItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;

        const baseTotal = Number(product.price || 0) * (item.quantity || 1);

        const currentDiscount = item.discount || 0;

        const newTotal = Math.max(0, baseTotal - currentDiscount);

        return {
          ...item,

          productId: product.id,

          productName: product.name,

          pricePerUnit: Number(product.price || 0),

          line_total: newTotal,
        };
      }),
    );
  };

  const handleUpsellAddProductById = (productId: number) => {
    const p = productsSafe.find((pr) => pr.id === productId);

    if (!p) return;

    if (upsellEditingItemId !== null) {
      setUpsellItems((prev) =>
        prev.map((item) => {
          if (item.id !== upsellEditingItemId) return item;

          const baseTotal = p.price * (item.quantity || 1);

          const currentDiscount = item.discount || 0;

          const newTotal = Math.max(0, baseTotal - currentDiscount);

          return {
            ...item,

            productId: p.id,

            productName: p.name,

            pricePerUnit: p.price,

            line_total: newTotal,
          };
        }),
      );
    } else {
      const newId = Date.now() + Math.floor(Math.random() * 1000);

      const newItem: LineItem = {
        id: newId,

        productName: p.name,

        quantity: 1,

        pricePerUnit: p.price,

        discount: 0,

        isFreebie: false,

        boxNumber: 1,

        productId: p.id,

        isPromotionParent: false,
      };

      (newItem as any).line_total = p.price;

      setUpsellItems((prev) => [...prev, newItem]);
    }

    setUpsellProductSelectorOpen(false);

    setUpsellEditingItemId(null);
  };

  const handleUpsellAddPromotionById = (promoId: number | string) => {
    const promo = promotionsSafe.find((p) => String(p.id) === String(promoId));
    if (!promo) return;

    const promotionItems = promo.items || [];

    const promotionName = promo.name || "โปรโมชั่น";

    const newItemsToAdd: LineItem[] = [];

    // Parent item

    const parentId = Date.now() + Math.floor(Math.random() * 1000);

    const parentItem: LineItem = {
      id: parentId,

      productName: `📦 ${promotionName}`,

      quantity: 1,

      pricePerUnit: 0,

      discount: 0,

      isFreebie: false,

      boxNumber: 1,

      productId: undefined,

      promotionId: promo.id,

      parentItemId: undefined,

      isPromotionParent: true,
    };

    newItemsToAdd.push(parentItem);

    let totalPromotionPrice = 0;

    for (const part of promotionItems) {
      const prod =
        productsSafe.find(
          (pr) => pr.id === (part.productId ?? part.product_id),
        ) ||
        productsSafe.find(
          (pr) =>
            pr.sku === (part.product?.sku || part.sku || part.product_sku),
        );

      if (!prod) continue;

      const qty = Number(part.quantity || 1);

      const isFreeFlag = !!part.isFreebie || !!part.is_freebie;

      const itemPrice = isFreeFlag
        ? 0
        : part.price_override !== null && part.price_override !== undefined
          ? Number(part.price_override)
          : prod.price;

      const newId = Date.now() + Math.floor(Math.random() * 1000);

      const productLineItem: LineItem = {
        id: newId,

        productName: `${prod.name}${isFreeFlag ? " (ของแถม)" : ""}`,

        quantity: qty,

        pricePerUnit: itemPrice,

        discount: 0,

        isFreebie: isFreeFlag,

        boxNumber: 1,

        productId: prod.id,

        promotionId: promo.id,

        parentItemId: parentId,

        isPromotionParent: false,
      };

      newItemsToAdd.push(productLineItem);

      if (!isFreeFlag) {
        totalPromotionPrice += itemPrice * qty;
      }
    }

    parentItem.pricePerUnit = totalPromotionPrice;

    if (upsellEditingItemId !== null) {
      setUpsellItems((prev) => {
        const filtered = prev.filter((it) => it.id !== upsellEditingItemId);

        return [...filtered, ...newItemsToAdd];
      });
    } else {
      setUpsellItems((prev) => [...prev, ...newItemsToAdd]);
    }

    setUpsellProductSelectorOpen(false);
    setUpsellEditingItemId(null);
  };

  const handleUpsellSlipUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (!files || !selectedUpsellOrder) return;

    const normalizedPayment = normalizePaymentMethod(
      selectedUpsellOrder.paymentMethod ??
      (selectedUpsellOrder as any).payment_method,
    );
    if (normalizedPayment !== PaymentMethod.Transfer) {
      event.target.value = "";
      return;
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    const ALLOWED_FILE_TYPES = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    const validFiles = Array.from(files).filter((file) => {
      const isAllowed = ALLOWED_FILE_TYPES.includes(file.type);
      const isSizeOk = file.size <= MAX_FILE_SIZE;
      if (!isAllowed) {
        alert(
          `ไม่สามารถแนบไฟล์ "${file.name}" ได้ (รองรับ: JPG, PNG, GIF, WebP เท่านั้น)`,
        );
      } else if (!isSizeOk) {
        alert(`ไม่สามารถแนบไฟล์ "${file.name}" ได้ เนื่องจากขนาดไฟล์เกิน 10MB`);
      }
      return isAllowed && isSizeOk;
    });

    if (validFiles.length === 0) {
      event.target.value = "";
      return;
    }

    setUpsellSlipLoading(true);
    setUpsellSlipError(null);
    try {
      for (const file of validFiles) {
        const dataUrl = await readFileAsDataUrl(file);
        const res = await createOrderSlip(
          String(selectedUpsellOrder.id),
          dataUrl,
          {
            uploadedBy: currentUser?.id,
            uploadedByName: currentUser
              ? `${currentUser.firstName} ${currentUser.lastName}`
              : undefined,
          },
        );
        const normalized = normalizeUpsellSlip({
          ...(res || {}),
          url: res?.url ?? res?.slipUrl ?? "",
        });
        if (normalized.url) {
          setUpsellSlips((prev) => [normalized, ...prev]);
        }
      }
    } catch (error: any) {
      console.error("Upload upsell slip failed:", error);
      setUpsellSlipError(error?.message || "อัปโหลดสลิปไม่สำเร็จ");
    } finally {
      setUpsellSlipLoading(false);
      event.target.value = "";
    }
  };

  const resolveUpsellSlipUploaderName = (slip: UpsellSlip) => {
    if (slip.uploadedByName) return slip.uploadedByName;
    if (slip.uploadedBy) {
      const uploader = upsellUsersById.get(Number(slip.uploadedBy));
      if (uploader) {
        const first =
          (uploader as any).firstName || (uploader as any).first_name || "";
        const last =
          (uploader as any).lastName || (uploader as any).last_name || "";
        return `${first} ${last}`.trim() || `ID ${slip.uploadedBy}`;
      }
      return `ID ${slip.uploadedBy}`;
    }
    return "ไม่ระบุ";
  };

  const calculateUpsellItemTotal = (item: LineItem) => {
    if (item.isFreebie) return 0;
    const explicitTotal =
      (item as any).line_total ??
      (item as any).net_total ??
      (item as any).total ??
      null;

    const qty = Number(item.quantity ?? 0);

    const price = Number(item.pricePerUnit ?? 0);

    const discount = Number(item.discount ?? 0);

    const computed = qty * price - discount;

    if (
      explicitTotal != null &&
      !Number.isNaN(Number(explicitTotal)) &&
      Number(explicitTotal) > 0 &&
      computed === 0
    ) {
      return Number(explicitTotal);
    }

    return computed;
  };

  const calculateUpsellNewItemsTotal = () =>
    upsellItems

      .filter((item) => !item.parentItemId)

      .reduce((sum, item) => sum + calculateUpsellItemTotal(item), 0);

  const getUpsellOrderTotal = (order: Order) => {
    // Always calculate from items to ensure accuracy (includes all upsell items)

    const items = Array.isArray(order.items) ? order.items : [];

    const calculatedTotal = items.reduce(
      (sum, item) => sum + calculateUpsellItemTotal(item as LineItem),

      0,
    );

    // Return calculated total (more accurate than totalAmount which might be outdated)

    return calculatedTotal;
  };

  // Get max box number from original order items

  const getMaxOriginalBoxNumber = () => {
    if (!selectedUpsellOrder?.items) return 0;

    const boxNumbers = selectedUpsellOrder.items.map(
      (item: any) => Number(item.boxNumber) || 1,
    );

    if (boxNumbers.length === 0) return 0;

    return Math.max(...boxNumbers);
  };

  // Calculate COD totals for upsell

  const upsellNewItemsTotal = useMemo(
    () => calculateUpsellNewItemsTotal(),
    [upsellItems],
  );

  const upsellCodTotal = useMemo(() => {
    return upsellBoxes.reduce((sum, box) => sum + (box.codAmount || 0), 0);
  }, [upsellBoxes]);

  const upsellCodRemaining = upsellNewItemsTotal - upsellCodTotal;

  const isUpsellCodValid = Math.abs(upsellCodRemaining) < 0.01;

  // Store previous upsellBoxes to preserve codAmount

  const prevUpsellBoxesRef = useRef<CodBox[]>([]);

  // Update upsell boxes when numUpsellBoxes changes

  useEffect(() => {
    if (
      !isUpsellMode ||
      selectedUpsellOrder?.paymentMethod !== PaymentMethod.COD
    ) {
      if (upsellBoxes.length > 0) {
        setUpsellBoxes([]);

        prevUpsellBoxesRef.current = [];
      }

      return;
    }

    const maxOriginalBox = getMaxOriginalBoxNumber();

    // Always create boxes from 1 to numUpsellBoxes (preserve existing codAmount)

    const newBoxes: CodBox[] = [];

    for (let i = 1; i <= numUpsellBoxes; i++) {
      const actualBoxNumber = maxOriginalBox + i;

      // Try to preserve existing codAmount from previous boxes

      const existingBox = prevUpsellBoxesRef.current.find(
        (b) => b.boxNumber === actualBoxNumber,
      );

      newBoxes.push({
        boxNumber: actualBoxNumber,

        codAmount: existingBox?.codAmount || 0,
      });
    }

    // Only update if boxes changed (compare by boxNumber only, not codAmount)

    const currentBoxNumbers = new Set(upsellBoxes.map((b) => b.boxNumber));

    const newBoxNumbers = new Set(newBoxes.map((b) => b.boxNumber));

    const boxesChanged =
      currentBoxNumbers.size !== newBoxNumbers.size ||
      !Array.from(currentBoxNumbers).every((n: number) => newBoxNumbers.has(n));

    if (boxesChanged) {
      setUpsellBoxes(newBoxes);

      prevUpsellBoxesRef.current = newBoxes;
    } else {
      // Update ref even if boxes didn't change (to preserve codAmount from user input)

      prevUpsellBoxesRef.current = upsellBoxes;
    }
  }, [
    numUpsellBoxes,
    selectedUpsellOrder?.id,
    selectedUpsellOrder?.paymentMethod,
    isUpsellMode,
  ]);

  // Update ref when upsellBoxes changes (from user input)

  useEffect(() => {
    if (upsellBoxes.length > 0) {
      prevUpsellBoxesRef.current = upsellBoxes;
    }
  }, [upsellBoxes]);

  const handleUpsellCodBoxAmountChange = (index: number, amount: number) => {
    const updatedBoxes = [...upsellBoxes];

    updatedBoxes[index].codAmount = amount;

    setUpsellBoxes(updatedBoxes);
  };

  const divideUpsellCodEqually = () => {
    if (numUpsellBoxes <= 0 || upsellNewItemsTotal <= 0) return;

    const amountPerBox = upsellNewItemsTotal / numUpsellBoxes;

    const newBoxes: CodBox[] = [];

    const maxOriginalBox = getMaxOriginalBoxNumber();

    let distributedAmount = 0;

    for (let i = 0; i < numUpsellBoxes - 1; i++) {
      const roundedAmount = Math.floor(amountPerBox * 100) / 100;

      newBoxes.push({
        boxNumber: maxOriginalBox + i + 1,

        codAmount: roundedAmount,
      });

      distributedAmount += roundedAmount;
    }

    newBoxes.push({
      boxNumber: maxOriginalBox + numUpsellBoxes,

      codAmount: parseFloat(
        (upsellNewItemsTotal - distributedAmount).toFixed(2),
      ),
    });

    setUpsellBoxes(newBoxes);
  };

  const handleUpsellSave = async () => {
    if (!selectedUpsellOrder) {
      setUpsellError("กรุณาเลือกออเดอร์ที่ต้องการอัปเซล");

      return;
    }

    if (upsellItems.length === 0) {
      setUpsellError("กรุณาเพิ่มรายการใหม่ก่อนบันทึก");

      return;
    }

    const invalidItems = upsellItems.filter(
      (item) =>
        !item.isPromotionParent && (!item.productId || !item.productName),
    );

    if (invalidItems.length > 0) {
      setUpsellError("กรุณาเลือกสินค้าให้ครบทุกแถว");

      return;
    }

    try {
      // Validate COD boxes if payment method is COD

      if (selectedUpsellOrder.paymentMethod === PaymentMethod.COD) {
        // Check if all items have box number assigned

        const itemsWithoutBox = upsellItems.filter(
          (item) =>
            !item.isFreebie &&
            !item.parentItemId &&
            (!item.boxNumber ||
              item.boxNumber < 1 ||
              item.boxNumber > numUpsellBoxes),
        );

        if (itemsWithoutBox.length > 0) {
          setUpsellError("กรุณาเลือกกล่องให้ครบทุกรายการสินค้า");

          return;
        }

        // Get boxes that actually have items (don't require all boxes from 1 to numUpsellBoxes)

        const uniqueBoxes = new Set<number>();

        upsellItems.forEach((item) => {
          if (
            !item.isFreebie &&
            !item.parentItemId &&
            item.boxNumber &&
            item.boxNumber >= 1 &&
            item.boxNumber <= numUpsellBoxes
          ) {
            uniqueBoxes.add(item.boxNumber);
          }
        });

        // Validate COD amounts - only check boxes that have items

        if (!isUpsellCodValid) {
          setUpsellError(
            `ยอด COD ในแต่ละกล่องรวมกันต้องเท่ากับยอดเพิ่มใหม่ (${upsellNewItemsTotal.toFixed(2)} บาท)`,
          );

          return;
        }
        await Promise.all(
          upsellSlips.map((slip) => {
            if (slip.id) {
              return updateOrderSlip({
                id: slip.id,
                amount:
                  typeof slip.amount === "number" ? slip.amount : undefined,
                transferDate: slip.transferDate ?? undefined,
                updatedBy: currentUser.id,
              });
            }
            return Promise.resolve();
          }),
        );
      }

      const itemsToAdd = upsellItems.map((item) => ({
        productId: item.productId,

        productName: item.productName,

        quantity: item.quantity,

        pricePerUnit: item.pricePerUnit,

        discount: item.discount || 0,

        isFreebie: item.isFreebie || false,

        boxNumber: item.boxNumber || 1,

        promotionId: item.promotionId || null,

        parentItemId: item.parentItemId || null,

        isPromotionParent: item.isPromotionParent || false,
      }));

      await addUpsellItems(selectedUpsellOrder.id, currentUser.id, itemsToAdd);

      // Show success modal

      setShowUpsellSuccessModal(true);
    } catch (err: any) {
      setUpsellError(err?.message || "บันทึกเพิ่มสินค้าไม่สำเร็จ");
    } finally {
      setUpsellSaving(false);
    }
  };

  // Bank account state

  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  const [selectedBankAccountId, setSelectedBankAccountId] = useState<
    number | null
  >(null);

  const [transferDate, setTransferDate] = useState<string>("");

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result as string);

      reader.onerror = () =>
        reject(reader.error || new Error("Failed to read file"));

      reader.readAsDataURL(file);
    });

  const handleTransferSlipUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;

    if (!files) return;

    // Define file constraints

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

    const ALLOWED_FILE_TYPES = [
      "image/jpeg",

      "image/jpg",

      "image/png",

      "image/gif",

      "image/webp",
    ];

    const imageFiles = Array.from(files).filter((file: File) => {
      // Check file type

      const isAllowedType = ALLOWED_FILE_TYPES.includes(file.type);

      // Check file size

      const isValidSize = file.size <= MAX_FILE_SIZE;

      if (!isAllowedType) {
        alert(
          `ไม่สามารถแนบไฟล์ "${file.name}" ได้ เนื่องจากไม่รองรับประเภทไฟล์นี้ (รองรับ: JPG, PNG, GIF, WebP เท่านั้น)`,
        );

        return false;
      }

      if (!isValidSize) {
        alert(`ไม่สามารถแนบไฟล์ "${file.name}" ได้ เนื่องจากขนาดไฟล์เกิน 10MB`);

        return false;
      }

      return isAllowedType && isValidSize;
    });

    if (imageFiles.length === 0) {
      event.target.value = "";

      return;
    }

    try {
      const defaultBankId =
        selectedBankAccountId != null && selectedBankAccountId !== 0
          ? selectedBankAccountId
          : (bankAccounts[0]?.id ?? null);
      const defaultTransferDate =
        transferDate && transferDate.trim() !== ""
          ? transferDate
          : new Date().toISOString().slice(0, 16);
      const uploads = await Promise.all(
        imageFiles.map(async (file: File) => {
          const dataUrl = await readFileAsDataUrl(file);
          return {
            id: Date.now() + Math.floor(Math.random() * 1000),
            name: file.name,
            dataUrl,
            bankAccountId: defaultBankId ?? undefined,
            transferDate: defaultTransferDate,
            amount: null,
          };
        }),
      );
      setTransferSlipUploads((prev) => [...prev, ...uploads]);
      clearValidationErrorFor("transferSlips");

      updateOrderData("paymentStatus", PaymentStatus.PendingVerification);
    } catch (error) {
      console.error("Failed to load payment slip:", error);

      alert("Failed to load payment slip file.");
    } finally {
      event.target.value = "";
    }
  };

  const removeTransferSlip = (id: number) => {
    setTransferSlipUploads((prev) => {
      const next = prev.filter((slip) => slip.id !== id);

      if (next.length === 0) {
        updateOrderData("paymentStatus", PaymentStatus.Unpaid);
      }

      return next;
    });
  };

  const [searchTerm, setSearchTerm] = useState("");

  const [numBoxes, setNumBoxes] = useState(1);

  // Product selector modal state

  const [productSelectorOpen, setProductSelectorOpen] = useState(false);

  const [selectorTab, setSelectorTab] = useState<"products" | "promotions">(
    "products",
  );

  const [selectorSearchTerm, setSelectorSearchTerm] = useState("");

  const [leftFilter, setLeftFilter] = useState<number | null>(null);

  // track item ids with locked price (selected from product list)

  const [lockedItemIds, setLockedItemIds] = useState<number[]>([]);

  // track which item is being edited (when clicking "เลือก" button in a row)

  const [editingItemId, setEditingItemId] = useState<number | null>(null);

  const [facebookName, setFacebookName] = useState("");

  const [lineId, setLineId] = useState("");

  const [salesChannel, setSalesChannel] = useState("");

  const [salesChannelPageId, setSalesChannelPageId] = useState<number | null>(
    null,
  );

  const [useProfileAddress, setUseProfileAddress] = useState(true);

  const [shippingAddress, setShippingAddress] = useState<Address>(emptyAddress);

  const [saveNewAddress, setSaveNewAddress] = useState(false);

  const [warehouseId, setWarehouseId] = useState<number | null>(null);

  const [profileAddressModified, setProfileAddressModified] = useState(false);

  const [validationError, setValidationError] =
    useState<ValidationField | null>(null);

  const customerSearchInputRef = useRef<HTMLInputElement | null>(null);

  const newCustomerFirstNameRef = useRef<HTMLInputElement | null>(null);

  const newCustomerPhoneRef = useRef<HTMLInputElement | null>(null);

  const shippingAddressSectionRef = useRef<HTMLDivElement | null>(null);

  const deliveryDateRef = useRef<HTMLInputElement | null>(null);

  const itemsSectionRef = useRef<HTMLDivElement | null>(null);

  const paymentMethodRef = useRef<HTMLSelectElement | null>(null);

  const transferSlipSectionRef = useRef<HTMLDivElement | null>(null);

  const salesChannelRef = useRef<HTMLSelectElement | null>(null);

  const salesChannelPageRef = useRef<HTMLSelectElement | null>(null);

  const codSectionRef = useRef<HTMLDivElement | null>(null);

  const editedCustomerPhoneRef = useRef<HTMLInputElement | null>(null);

  const editedCustomerBackupPhoneRef = useRef<HTMLInputElement | null>(null);

  const fieldRefs: Record<ValidationField, React.MutableRefObject<any>> = {
    customerSelector: customerSearchInputRef,

    shippingAddress: shippingAddressSectionRef,

    deliveryDate: deliveryDateRef,

    items: itemsSectionRef,

    paymentMethod: paymentMethodRef,

    transferSlips: transferSlipSectionRef,

    salesChannel: salesChannelRef,

    salesChannelPage: salesChannelPageRef,

    cod: codSectionRef,

    newCustomerFirstName: newCustomerFirstNameRef,

    newCustomerPhone: newCustomerPhoneRef,

    editedCustomerPhone: editedCustomerPhoneRef,

    editedCustomerBackupPhone: editedCustomerBackupPhoneRef,
  };

  const highlightField = (field: ValidationField) => {
    setValidationError(field);

    const target = fieldRefs[field]?.current as HTMLElement | null;

    if (target) {
      const maybeFocusable = target as unknown as { focus?: () => void };

      if (typeof maybeFocusable.focus === "function") {
        maybeFocusable.focus();
      } else {
        const fallback = target.querySelector<HTMLElement>(
          "input, select, textarea, button",
        );

        if (fallback && typeof fallback.focus === "function") {
          fallback.focus();
        }
      }

      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const clearValidationErrorFor = (...fields: ValidationField[]) => {
    if (validationError && fields.includes(validationError)) {
      setValidationError(null);
    }
  };

  useEffect(() => {
    const highlightClasses = ["ring-2", "ring-red-300", "border-red-500"];

    (
      Object.entries(fieldRefs) as [
        ValidationField,

        React.MutableRefObject<any>,
      ][]
    ).forEach(([key, ref]) => {
      const el = ref.current as HTMLElement | null;

      if (!el) return;

      highlightClasses.forEach((cls) => el.classList.remove(cls));

      if (validationError === key) {
        highlightClasses.forEach((cls) => el.classList.add(cls));
      }
    });
  }, [validationError]);

  // Address options for the dropdown

  const [addressOptions, setAddressOptions] = useState<any[]>([]);

  const [selectedAddressOption, setSelectedAddressOption] =
    useState<string>("profile"); // Default to profile address

  const [updateProfileAddress, setUpdateProfileAddress] = useState(false); // For the new checkbox

  const [loadingCustomerData, setLoadingCustomerData] = useState(false); // Loading state for fetching fresh customer data

  // สรุปยอด: สินค้ารวม, ส่วนลดตามรายการ, ส่วนลดท้ายบิลเป็น %

  const goodsSum = useMemo(
    () =>
      (orderData.items || [])

        .filter((it) => !it.parentItemId)

        .reduce(
          (acc, item) =>
            acc +
            (item.isFreebie
              ? 0
              : (item.quantity || 0) * (item.pricePerUnit || 0)),

          0,
        ),

    [orderData.items],
  );

  const itemsDiscount = useMemo(
    () =>
      (orderData.items || [])

        .filter((it) => !it.parentItemId)

        .reduce(
          (acc, item) => acc + (item.isFreebie ? 0 : item.discount || 0),

          0,
        ),

    [orderData.items],
  );

  const subTotal = useMemo(
    () => goodsSum - itemsDiscount,

    [goodsSum, itemsDiscount],
  );

  const billDiscountPercent = useMemo(
    () => Number(orderData.billDiscount || 0),

    [orderData.billDiscount],
  );

  const billDiscountAmount = useMemo(
    () => (subTotal * billDiscountPercent) / 100,

    [subTotal, billDiscountPercent],
  );

  const totalAmount = useMemo(
    () => subTotal + (orderData.shippingCost || 0) - billDiscountAmount,

    [subTotal, orderData.shippingCost, billDiscountAmount],
  );

  // Fetch bank accounts on mount

  useEffect(() => {
    const fetchBankAccounts = async () => {
      try {
        const sessionUser = localStorage.getItem("sessionUser");

        if (sessionUser) {
          const user = JSON.parse(sessionUser);

          const companyId = user.company_id;

          if (companyId) {
            const data = await listBankAccounts(companyId, true);

            setBankAccounts(Array.isArray(data) ? data : []);
          }
        }
      } catch (error) {
        console.error("Error fetching bank accounts:", error);
      }
    };

    fetchBankAccounts();
  }, []);

  useEffect(() => {
    if (
      orderData.paymentMethod !== PaymentMethod.Transfer &&
      transferSlipUploads.length > 0
    ) {
      setTransferSlipUploads([]);

      updateOrderData("paymentStatus", PaymentStatus.Unpaid);
    }

    if (orderData.paymentMethod !== PaymentMethod.Transfer) {
      clearValidationErrorFor("transferSlips");

      setSelectedBankAccountId(null);

      setTransferDate("");
    }

    if (orderData.paymentMethod !== PaymentMethod.COD) {
      clearValidationErrorFor("cod");
    }
  }, [orderData.paymentMethod, transferSlipUploads.length, validationError]);

  useEffect(() => {
    const province = (shippingAddress.province || "").trim();

    if (!province) {
      setWarehouseId(null);

      return;
    }

    console.log("🏪 Looking for warehouse for province:", province);

    console.log("🏪 Available warehouses:", warehouses);

    // First try to find a warehouse that specifically handles this province

    let matched = (warehouses || []).find((w) => {
      const list = Array.isArray(w.responsibleProvinces)
        ? w.responsibleProvinces
        : [];

      const isMatch = w.isActive && list.includes(province);

      if (isMatch) {
        console.log(
          "🏪 Found specific warehouse:",

          w.name,

          "responsible for:",

          list,
        );
      }

      return isMatch;
    });

    // If no specific warehouse found, fall back to "everywhere" warehouse

    if (!matched) {
      console.log(
        "🏪 No specific warehouse found, looking for 'everywhere' warehouse",
      );

      matched = (warehouses || []).find((w) => {
        const list = Array.isArray(w.responsibleProvinces)
          ? w.responsibleProvinces
          : [];

        const isMatch = w.isActive && list.includes("everywhere");

        if (isMatch) {
          console.log("🏪 Found 'everywhere' warehouse:", w.name);
        }

        return isMatch;
      });
    }

    if (matched) {
      console.log("🏪 Selected warehouse:", matched.name, "ID:", matched.id);
    } else {
      console.log("🏪 No warehouse found for province:", province);
    }

    setWarehouseId(matched ? matched.id : null);
  }, [shippingAddress.province, warehouses]);

  // Load address data on component mount

  useEffect(() => {
    loadAddressData();
  }, []);

  // Function to load address data from API

  const loadAddressData = async () => {
    setAddressLoading(true);

    try {
      // Load geographies

      const geoResponse = await fetch(
        `${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=geographies`,
      );

      if (geoResponse.ok) {
        const geoData = await geoResponse.json();

        if (geoData.success) setGeographies(geoData.data || []);
      }

      // Load all provinces

      const provResponse = await fetch(
        `${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=provinces`,
      );

      if (provResponse.ok) {
        const provData = await provResponse.json();

        if (provData.success) setProvinces(provData.data || []);
      }
    } catch (error) {
      console.error("Error loading address data:", error);
    } finally {
      setAddressLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedCustomer) return;

    setIsCreatingNewCustomer(false);

    setEditedCustomerFirstName(selectedCustomer.firstName || "");

    setEditedCustomerLastName(selectedCustomer.lastName || "");

    setEditedCustomerPhone(selectedCustomer.phone || "");

    setEditedCustomerBackupPhone(selectedCustomer.backupPhone || "");

    setEditedCustomerPhoneError("");

    setEditedCustomerBackupPhoneError("");

    setNewCustomerPhoneError("");

    setNewCustomerBackupPhoneError("");

    setFacebookName(selectedCustomer.facebookName || "");

    setLineId(selectedCustomer.lineId || "");
  }, [selectedCustomer]);

  // Load districts when province is selected

  useEffect(() => {
    if (selectedProvince) {
      fetch(
        `${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=districts&id=${selectedProvince}`,
      )
        .then((response) => response.json())

        .then((data) => {
          if (data.success) setDistricts(data.data || []);
        })

        .catch((error) => console.error("Error loading districts:", error));
    } else {
      setDistricts([]);

      setSubDistricts([]);

      setSelectedDistrict(null);

      setSelectedSubDistrict(null);
    }
  }, [selectedProvince]);

  // Load sub-districts when district is selected

  useEffect(() => {
    if (selectedDistrict) {
      fetch(
        `${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=sub_districts&id=${selectedDistrict}`,
      )
        .then((response) => response.json())

        .then((data) => {
          if (data.success) setSubDistricts(data.data || []);
        })

        .catch((error) => console.error("Error loading sub-districts:", error));
    } else {
      setSubDistricts([]);

      setSelectedSubDistrict(null);
    }
  }, [selectedDistrict]);

  // Restore focus to postal code input when results are loaded
  useEffect(() => {
    if (showPostalCodeDropdown && postalCodeResults.length > 0) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        postalCodeInputRef.current?.focus();
      });
    }
  }, [showPostalCodeDropdown, postalCodeResults.length]);

  // Update shipping address when sub-district is selected or when subdistricts data is loaded

  useEffect(() => {
    if (selectedSubDistrict && subDistricts.length > 0) {
      const subDistrict = subDistricts.find(
        (sd) => sd.id === selectedSubDistrict,
      );

      console.log(
        "🔍 Subdistrict mapping - selectedSubDistrict:",

        selectedSubDistrict,
      );

      console.log("🔍 Subdistrict mapping - found subDistrict:", subDistrict);

      if (subDistrict) {
        const district = districts.find(
          (d) => d.id === subDistrict.district_id,
        );

        const province = provinces.find((p) => p.id === district?.province_id);

        console.log("🔍 Subdistrict mapping - district:", district);

        console.log("🔍 Subdistrict mapping - province:", province);

        console.log("🔍 Subdistrict mapping - zip_code:", subDistrict.zip_code);

        setShippingAddress((prev) => ({
          ...prev,

          subdistrict: subDistrict.name_th || "",

          district: district?.name_th || "",

          province: province?.name_th || "",

          postalCode: subDistrict.zip_code || prev.postalCode || "",
        }));
      } else {
        console.warn("⚠️ Subdistrict not found in subDistricts array");
      }
    }
  }, [selectedSubDistrict, subDistricts, districts, provinces]);

  // Additional effect to handle shipping address update when subdistricts data changes

  useEffect(() => {
    if (selectedSubDistrict && subDistricts.length > 0) {
      const subDistrict = subDistricts.find(
        (sd) => sd.id === selectedSubDistrict,
      );

      console.log("🔄 Subdistricts data changed - updating address");

      console.log("🔄 Selected subDistrict ID:", selectedSubDistrict);

      console.log("🔄 Found subDistrict:", subDistrict);

      if (subDistrict) {
        const district = districts.find(
          (d) => d.id === subDistrict.district_id,
        );

        const province = provinces.find((p) => p.id === district?.province_id);

        console.log(
          "🔄 Updating shipping address with zip code:",

          subDistrict.zip_code,
        );

        setShippingAddress((prev) => ({
          ...prev,

          subdistrict: subDistrict.name_th || "",

          district: district?.name_th || "",

          province: province?.name_th || "",

          postalCode: subDistrict.zip_code || prev.postalCode || "",
        }));
      } else {
        console.warn(
          "⚠️ Could not find subDistrict with ID:",

          selectedSubDistrict,
        );

        console.warn(
          "⚠️ Available subDistricts:",

          subDistricts.map((sd) => ({ id: sd.id, name: sd.name_th })),
        );
      }
    }
  }, [subDistricts]);

  // Effect to ensure shipping address is updated when all address components are available

  useEffect(() => {
    if (selectedSubDistrict && selectedDistrict && selectedProvince) {
      const subDistrict = subDistricts.find(
        (sd) => sd.id === selectedSubDistrict,
      );

      const district = districts.find((d) => d.id === selectedDistrict);

      const province = provinces.find((p) => p.id === selectedProvince);

      if (subDistrict && district && province) {
        console.log("🔄 Final address update - all components available");

        setShippingAddress((prev) => ({
          ...prev,

          subdistrict: subDistrict.name_th || "",

          district: district.name_th || "",

          province: province.name_th || "",

          postalCode: subDistrict.zip_code || prev.postalCode || "",
        }));
      }
    }
  }, [
    selectedSubDistrict,

    selectedDistrict,

    selectedProvince,

    subDistricts,

    districts,

    provinces,
  ]);

  // Initialize address selections from existing address

  useEffect(() => {
    if (shippingAddress.province && provinces.length > 0) {
      // Find province by name

      const province = provinces.find(
        (p) => p.name_th === shippingAddress.province,
      );

      if (province) {
        setSelectedProvince(province.id);

        setSelectedGeography(province.geography_id);
      }
    }
  }, [shippingAddress.province, provinces, useProfileAddress]);

  // Initialize district when districts are loaded

  useEffect(() => {
    if (shippingAddress.district && selectedProvince && districts.length > 0) {
      const district = districts.find(
        (d) => d.name_th === shippingAddress.district,
      );

      if (district) {
        setSelectedDistrict(district.id);
      }
    }
  }, [
    shippingAddress.district,

    selectedProvince,

    districts,

    useProfileAddress,
  ]);

  // Initialize sub-district when sub-districts are loaded

  useEffect(() => {
    if (
      shippingAddress.subdistrict &&
      selectedDistrict &&
      subDistricts.length > 0
    ) {
      const subDistrict = subDistricts.find(
        (sd) => sd.name_th === shippingAddress.subdistrict,
      );

      if (subDistrict) {
        setSelectedSubDistrict(subDistrict.id);
      }
    }
  }, [
    shippingAddress.subdistrict,

    selectedDistrict,

    subDistricts,

    useProfileAddress,
  ]);

  // Load customer addresses when a customer is selected

  useEffect(() => {
    const candidateIds = [
      selectedCustomer?.pk,

      selectedCustomer?.id,

      selectedCustomer?.customerRefId,

      selectedCustomer?.customerId,
    ];

    const customerIdParam = candidateIds.find(
      (v) =>
        v !== null &&
        typeof v !== "undefined" &&
        String(v) !== "0" &&
        String(v) !== "",
    );

    if (selectedCustomer && customerIdParam !== undefined) {
      console.log("Loading addresses for customer ID:", customerIdParam);

      // Load customer addresses from the database

      fetch(
        `${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=customer_addresses&id=${encodeURIComponent(customerIdParam)}`,
      )
        .then((response) => response.json())

        .then((data) => {
          console.log("Customer addresses loaded:", data);

          if (data.success) {
            const normalizedAddresses = Array.isArray(data.data)
              ? data.data.map(sanitizeSavedAddress)
              : [];

            setAddressOptions(normalizedAddresses);
          } else {
            console.error("Failed to load customer addresses:", data.message);
          }
        })

        .catch((error) =>
          console.error("Error loading customer addresses:", error),
        );
    } else {
      setAddressOptions([]);
    }
  }, [selectedCustomer]);

  // Filtered lists for search

  // If postal code is entered, filter by postal code results

  const filteredProvinces = useMemo(() => {
    // If postal code search has results, only show provinces from those results

    if (postalCodeResults.length > 0) {
      const allowedProvinceIds = new Set(
        postalCodeResults.map((r) => r.province_id),
      );

      // If provinces are not loaded yet, return empty array (will trigger warning)

      if (provinces.length === 0) {
        return [];
      }

      const filtered = provinces.filter((p) => allowedProvinceIds.has(p.id));

      if (!provinceSearchTerm) return filtered;

      const searchFiltered = filtered.filter(
        (p) =>
          p.name_th.toLowerCase().includes(provinceSearchTerm.toLowerCase()) ||
          p.name_en.toLowerCase().includes(provinceSearchTerm.toLowerCase()),
      );

      return searchFiltered;
    }

    // Normal search

    if (!provinceSearchTerm) return provinces;

    return provinces.filter(
      (p) =>
        p.name_th.toLowerCase().includes(provinceSearchTerm.toLowerCase()) ||
        p.name_en.toLowerCase().includes(provinceSearchTerm.toLowerCase()),
    );
  }, [provinces, provinceSearchTerm, postalCodeResults]);

  const filteredDistricts = useMemo(() => {
    // If postal code search has results, only show districts from those results

    if (postalCodeResults.length > 0) {
      const allowedDistrictIds = new Set(
        postalCodeResults.map((r) => r.district_id),
      );

      const filtered = districts.filter((d) => allowedDistrictIds.has(d.id));

      if (!districtSearchTerm) return filtered;

      return filtered.filter(
        (d) =>
          d.name_th.toLowerCase().includes(districtSearchTerm.toLowerCase()) ||
          d.name_en.toLowerCase().includes(districtSearchTerm.toLowerCase()),
      );
    }

    // Normal search

    if (!districtSearchTerm) return districts;

    return districts.filter(
      (d) =>
        d.name_th.toLowerCase().includes(districtSearchTerm.toLowerCase()) ||
        d.name_en.toLowerCase().includes(districtSearchTerm.toLowerCase()),
    );
  }, [districts, districtSearchTerm, postalCodeResults]);

  const filteredSubDistricts = useMemo(() => {
    // If postal code search has results, only show subdistricts from those results

    if (postalCodeResults.length > 0) {
      const postalCode = shippingAddress.postalCode;

      const filtered = subDistricts.filter((sd) => sd.zip_code === postalCode);

      if (!subDistrictSearchTerm) return filtered;

      return filtered.filter(
        (sd) =>
          sd.name_th

            .toLowerCase()

            .includes(subDistrictSearchTerm.toLowerCase()) ||
          sd.name_en

            .toLowerCase()

            .includes(subDistrictSearchTerm.toLowerCase()) ||
          sd.zip_code.includes(subDistrictSearchTerm),
      );
    }

    // Normal search

    if (!subDistrictSearchTerm) return subDistricts;

    return subDistricts.filter(
      (sd) =>
        sd.name_th

          .toLowerCase()

          .includes(subDistrictSearchTerm.toLowerCase()) ||
        sd.name_en

          .toLowerCase()

          .includes(subDistrictSearchTerm.toLowerCase()) ||
        sd.zip_code.includes(subDistrictSearchTerm),
    );
  }, [
    subDistricts,

    subDistrictSearchTerm,

    postalCodeResults,

    shippingAddress.postalCode,
  ]);

  const codTotal = useMemo(() => {
    return (
      orderData.boxes?.reduce((sum, box) => sum + (box.codAmount || 0), 0) || 0
    );
  }, [orderData.boxes]);

  const isCodValid = useMemo(() => {
    if (orderData.paymentMethod !== PaymentMethod.COD) return true;

    return codTotal.toFixed(2) === totalAmount.toFixed(2) && totalAmount > 0;
  }, [orderData.paymentMethod, totalAmount, codTotal]);

  const codRemaining = useMemo(() => {
    const totalRounded = Number(totalAmount.toFixed(2));

    const codRounded = Number(codTotal.toFixed(2));

    return Number((totalRounded - codRounded).toFixed(2));
  }, [totalAmount, codTotal]);

  // Search results

  const searchResults = useMemo(() => {
    if (!searchTerm || isCreatingNewCustomer) return [];

    const lowerSearchTerm = searchTerm.toLowerCase();

    return customers.filter(
      (c) =>
        `${c.firstName} ${c.lastName}`

          .toLowerCase()

          .includes(lowerSearchTerm) || c.phone.includes(searchTerm),
    );
  }, [searchTerm, customers, isCreatingNewCustomer]);

  // Handler for address option selection

  const handleAddressOptionChange = (option: string) => {
    setSelectedAddressOption(option);

    if (option === "profile" && selectedCustomer?.address) {
      // Use profile address

      setUseProfileAddress(true);

      setShippingAddress(normalizeAddress(selectedCustomer.address));

      setProfileAddressModified(false); // Reset modification flag when switching to profile

      // Find and set the IDs for the profile address

      if (selectedCustomer.address.province && provinces.length > 0) {
        const province = provinces.find(
          (p) => p.name_th === selectedCustomer.address.province,
        );

        if (province) {
          setSelectedProvince(province.id);

          setSelectedGeography(province.geography_id);

          // Load districts for this province if not already loaded

          if (
            districts.length === 0 ||
            districts[0].province_id !== province.id
          ) {
            fetch(
              `${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=districts&id=${province.id}`,
            )
              .then((response) => response.json())

              .then((data) => {
                if (data.success) {
                  setDistricts(data.data || []);

                  // Find and set district ID

                  if (selectedCustomer.address.district) {
                    const district = (data.data || []).find(
                      (d) => d.name_th === selectedCustomer.address.district,
                    );

                    if (district) {
                      setSelectedDistrict(district.id);

                      // Load sub-districts for this district

                      fetch(
                        `${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=sub_districts&id=${district.id}`,
                      )
                        .then((response) => response.json())

                        .then((data) => {
                          if (data.success) {
                            setSubDistricts(data.data || []);

                            // Find and set sub-district ID

                            if (selectedCustomer.address.subdistrict) {
                              const subDistrict = (data.data || []).find(
                                (sd) =>
                                  sd.name_th ===
                                  selectedCustomer.address.subdistrict,
                              );

                              console.log(
                                "👤 Customer address - looking for subdistrict:",

                                selectedCustomer.address.subdistrict,
                              );

                              console.log(
                                "👤 Customer address - found subDistrict:",

                                subDistrict,
                              );

                              if (subDistrict) {
                                console.log(
                                  "👤 Setting selectedSubDistrict to:",

                                  subDistrict.id,
                                );

                                setSelectedSubDistrict(subDistrict.id);
                              } else {
                                console.warn(
                                  "⚠️ Could not find subdistrict for customer address",
                                );

                                console.warn(
                                  "⚠️ Available subdistricts:",

                                  (data.data || []).map((sd) => ({
                                    id: sd.id,

                                    name: sd.name_th,
                                  })),
                                );
                              }
                            }
                          }
                        })

                        .catch((error) =>
                          console.error("Error loading sub-districts:", error),
                        );
                    }
                  }
                }
              })

              .catch((error) =>
                console.error("Error loading districts:", error),
              );
          } else {
            // Districts already loaded, find district ID

            const district = districts.find(
              (d) => d.name_th === selectedCustomer.address.district,
            );

            if (district) {
              setSelectedDistrict(district.id);

              // Find sub-district ID

              if (selectedCustomer.address.subdistrict) {
                const subDistrict = subDistricts.find(
                  (sd) => sd.name_th === selectedCustomer.address.subdistrict,
                );

                if (subDistrict) {
                  setSelectedSubDistrict(subDistrict.id);
                }
              }
            }
          }
        }
      }

      // Reset search terms and close dropdowns

      setProvinceSearchTerm("");

      setDistrictSearchTerm("");

      setSubDistrictSearchTerm("");

      setShowProvinceDropdown(false);

      setShowDistrictDropdown(false);

      setShowSubDistrictDropdown(false);
    } else if (option === "new") {
      // Create new address

      setUseProfileAddress(false);

      setShippingAddress(emptyAddress);

      setUpdateProfileAddress(false); // Reset checkbox state

      setProfileAddressModified(false); // Reset modification flag

      // Reset address selections when switching to custom address

      setSelectedProvince(null);

      setSelectedDistrict(null);

      setSelectedSubDistrict(null);

      // Reset search terms and close dropdowns

      setProvinceSearchTerm("");

      setDistrictSearchTerm("");

      setSubDistrictSearchTerm("");

      setShowProvinceDropdown(false);

      setShowDistrictDropdown(false);

      setShowSubDistrictDropdown(false);
    } else {
      // Use existing customer address

      setUseProfileAddress(false);

      setProfileAddressModified(false); // Reset modification flag

      const address = addressOptions.find((a) => a.id === parseInt(option));

      if (address) {
        setShippingAddress({
          recipientFirstName: sanitizeAddressValue(
            address.recipient_first_name ?? address.recipientFirstName,
          ),

          recipientLastName: sanitizeAddressValue(
            address.recipient_last_name ?? address.recipientLastName,
          ),

          street: sanitizeAddressValue(address.address),

          subdistrict: sanitizeAddressValue(address.sub_district),

          district: sanitizeAddressValue(address.district),

          province: sanitizeAddressValue(address.province),

          postalCode: sanitizeAddressValue(address.zip_code),
        });

        // Reset address selections

        setSelectedProvince(null);

        setSelectedDistrict(null);

        setSelectedSubDistrict(null);

        // Reset search terms and close dropdowns

        setProvinceSearchTerm("");

        setDistrictSearchTerm("");

        setSubDistrictSearchTerm("");

        setShowProvinceDropdown(false);

        setShowDistrictDropdown(false);

        setShowSubDistrictDropdown(false);
      }
    }
  };

  // Handler for deleting an address

  const handleDeleteAddress = async (addressId: number) => {
    if (!window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบที่อยู่นี้?")) {
      return;
    }

    try {
      const response = await fetch(
        `${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=delete_customer_address`,

        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({ id: addressId }),
        },
      );

      const result = await response.json();

      if (result.success) {
        // Remove the address from the local state

        setAddressOptions((prev) =>
          prev.filter((addr) => addr.id !== addressId),
        );

        // If the deleted address was selected, switch to profile address

        if (selectedAddressOption === addressId.toString()) {
          setSelectedAddressOption("profile");

          handleAddressOptionChange("profile");
        }

        // Show success message

        alert("ลบที่อยู่เรียบร้อยแล้ว");
      } else {
        alert("ไม่สามารถลบที่อยู่ได้: " + (result.message || "เกิดข้อผิดพลาด"));
      }
    } catch (error) {
      console.error("Error deleting address:", error);

      alert("เกิดข้อผิดพลาดในการลบที่อยู่");
    }
  };

  // Handler for setting an address as primary

  const handleSetPrimaryAddress = async (addressId: number) => {
    if (
      !window.confirm("คุณแน่ใจหรือไม่ว่าต้องการตั้งที่อยู่นี้เป็นที่อยู่หลัก?")
    ) {
      return;
    }

    try {
      // Get the address to be set as primary

      const newPrimaryAddress = addressOptions.find((a) => a.id === addressId);

      if (!newPrimaryAddress) {
        alert("ไม่พบข้อมูลที่อยู่ที่เลือก");

        return;
      }

      // Get the current customer address (if exists)

      const currentCustomerAddress = selectedCustomer?.address;

      // Prepare the payload for the API call

      const payload = {
        customerId: selectedCustomer?.id,

        newPrimaryAddressId: addressId,

        oldPrimaryAddress: currentCustomerAddress
          ? {
            address: currentCustomerAddress.street || "",

            sub_district: currentCustomerAddress.subdistrict || "",

            district: currentCustomerAddress.district || "",

            province: currentCustomerAddress.province || "",

            zip_code: currentCustomerAddress.postalCode || "",
          }
          : null,
      };

      const response = await fetch(
        `${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=set_primary_address`,

        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify(payload),
        },
      );

      const result = await response.json();

      if (result.success) {
        // Update the customer's address in the local state

        if (selectedCustomer) {
          setSelectedCustomer({
            ...selectedCustomer,

            address: {
              recipientFirstName: sanitizeAddressValue(
                newPrimaryAddress.recipient_first_name ??
                newPrimaryAddress.recipientFirstName,
              ),

              recipientLastName: sanitizeAddressValue(
                newPrimaryAddress.recipient_last_name ??
                newPrimaryAddress.recipientLastName,
              ),

              street: sanitizeAddressValue(newPrimaryAddress.address),

              subdistrict: sanitizeAddressValue(newPrimaryAddress.sub_district),

              district: sanitizeAddressValue(newPrimaryAddress.district),

              province: sanitizeAddressValue(newPrimaryAddress.province),

              postalCode: sanitizeAddressValue(newPrimaryAddress.zip_code),
            },
          });
        }

        setShippingAddress(
          normalizeAddress({
            recipientFirstName:
              newPrimaryAddress.recipient_first_name ??
              newPrimaryAddress.recipientFirstName,

            recipientLastName:
              newPrimaryAddress.recipient_last_name ??
              newPrimaryAddress.recipientLastName,

            street: newPrimaryAddress.address,

            subdistrict: newPrimaryAddress.sub_district,

            district: newPrimaryAddress.district,

            province: newPrimaryAddress.province,

            postalCode: newPrimaryAddress.zip_code,
          }),
        );

        setSelectedAddressOption("profile");

        setUseProfileAddress(true);

        setProfileAddressModified(false);

        // Update the address options to reflect the changes

        if (currentCustomerAddress) {
          // Add the old primary address to the address options

          setAddressOptions((prev) => [
            ...prev,

            {
              id: result.oldAddressId || Date.now(), // Use returned ID or generate temp one

              address: sanitizeAddressValue(currentCustomerAddress.street),

              recipient_first_name: sanitizeAddressValue(
                currentCustomerAddress.recipientFirstName,
              ),

              recipient_last_name: sanitizeAddressValue(
                currentCustomerAddress.recipientLastName,
              ),

              sub_district: sanitizeAddressValue(
                currentCustomerAddress.subdistrict,
              ),

              district: sanitizeAddressValue(currentCustomerAddress.district),

              province: sanitizeAddressValue(currentCustomerAddress.province),

              zip_code: sanitizeAddressValue(currentCustomerAddress.postalCode),
            },
          ]);
        }

        // Remove the newly set primary address from the address options

        setAddressOptions((prev) =>
          prev.filter((addr) => addr.id !== addressId),
        );

        // Switch to profile address option since it's now the primary

        setSelectedAddressOption("profile");

        handleAddressOptionChange("profile");

        // Show success message

        alert("ตั้งค่าที่อยู่หลักเรียบร้อยแล้ว");
      } else {
        alert(
          "ไม่สามารถตั้งค่าที่อยู่หลักได้: " +
          (result.message || "เกิดข้อผิดพลาด"),
        );
      }
    } catch (error) {
      console.error("Error setting primary address:", error);

      alert("เกิดข้อผิดพลาดในการตั้งค่าที่อยู่หลัก");
    }
  };

  useEffect(() => {
    if (initialData?.customer) {
      handleSelectCustomer(initialData.customer);
    }
  }, [initialData]);

  // หมายเหตุ: ทุกวิธีการชำระเงินต้องระบุจำนวนกล่อง (COD เท่านั้นที่ต้องกรอกยอด COD ต่อกล่อง)

  useEffect(() => {
    const newBoxes: CodBox[] = Array.from({ length: numBoxes }, (_, i) => ({
      boxNumber: i + 1,

      codAmount: orderData.boxes?.[i]?.codAmount || 0,
    }));

    updateOrderData("boxes", newBoxes);
  }, [numBoxes]);

  // Close dropdowns when clicking outside

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;

      // Check if click is outside any of the dropdown containers

      if (!target.closest(".province-dropdown-container")) {
        setShowProvinceDropdown(false);
      }

      if (!target.closest(".district-dropdown-container")) {
        setShowDistrictDropdown(false);
      }

      if (!target.closest(".subdistrict-dropdown-container")) {
        setShowSubDistrictDropdown(false);
      }

      if (!target.closest(".postal-code-dropdown-container")) {
        setShowPostalCodeDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // ปรับ boxNumber ของแต่ละรายการสินค้าให้อยู่ในช่วง 1..numBoxes เมื่อจำนวนกล่องเปลี่ยน

  // เมื่อลดจำนวนกล่อง สินค้าที่อยู่ในกล่องที่ถูกลบจะย้ายไปกล่องสุดท้าย (กล่อง numBoxes)

  useEffect(() => {
    if (!orderData.items) return;

    const updatedItems = orderData.items.map((it) => {
      const currentBoxNumber = it.boxNumber || 1;

      // ถ้า boxNumber เกิน numBoxes (ลดจำนวนกล่อง) ให้ย้ายไปกล่องสุดท้าย

      if (currentBoxNumber > numBoxes) {
        return {
          ...it,

          boxNumber: numBoxes,
        };
      }

      // ถ้า boxNumber อยู่ในช่วงที่ถูกต้อง ให้คงเดิม

      return {
        ...it,

        boxNumber: Math.min(Math.max(currentBoxNumber, 1), numBoxes),
      };
    });

    const changed =
      JSON.stringify(updatedItems) !== JSON.stringify(orderData.items);

    if (changed) updateOrderData("items", updatedItems);
  }, [numBoxes]);

  // Helper function to map API response (snake_case) to frontend format (camelCase)

  const mapCustomerData = (apiData: any): Customer => {
    const pk =
      apiData.customer_id ??
      apiData.pk ??
      apiData.id ??
      apiData.customerId ??
      null;

    const refId =
      apiData.customer_ref_id ??
      apiData.customer_ref ??
      apiData.customer_refid ??
      apiData.customerRefId ??
      apiData.customerId ??
      null;

    const resolvedId =
      pk != null ? String(pk) : refId != null ? String(refId) : "";

    const firstName = apiData.first_name ?? apiData.firstName ?? "";

    const lastName = apiData.last_name ?? apiData.lastName ?? "";

    const phone = apiData.phone ?? apiData.phone_number ?? "";

    const backupPhone =
      apiData.backup_phone ??
      apiData.backupPhone ??
      apiData.secondary_phone ??
      "";

    return {
      ...apiData,

      id: resolvedId,

      pk: typeof pk === "number" ? pk : pk ? Number(pk) : undefined,

      customerId: refId ?? apiData.customerId,

      customerRefId: refId ?? apiData.customerRefId,

      firstName,

      lastName,

      phone,

      backupPhone,

      email: apiData.email ?? apiData.email_address,

      province: sanitizeAddressValue(apiData.province),

      companyId: apiData.company_id ?? apiData.companyId,

      assignedTo: apiData.assigned_to ?? apiData.assignedTo,

      dateAssigned: apiData.date_assigned ?? apiData.dateAssigned,

      dateRegistered: apiData.date_registered ?? apiData.dateRegistered,

      followUpDate: apiData.follow_up_date ?? apiData.followUpDate,

      ownershipExpires: apiData.ownership_expires ?? apiData.ownershipExpires,

      lifecycleStatus: apiData.lifecycle_status ?? apiData.lifecycleStatus,

      behavioralStatus: apiData.behavioral_status ?? apiData.behavioralStatus,

      grade: apiData.grade,

      totalPurchases: parseFloat(
        apiData.total_purchases ?? apiData.totalPurchases ?? 0,
      ),

      totalCalls: parseInt(apiData.total_calls ?? apiData.totalCalls ?? 0),

      facebookName: apiData.facebook_name ?? apiData.facebookName,

      lineId: apiData.line_id ?? apiData.lineId,

      street: sanitizeAddressValue(apiData.street),

      subdistrict: sanitizeAddressValue(apiData.subdistrict),

      district: sanitizeAddressValue(apiData.district),

      postalCode: sanitizeAddressValue(
        apiData.postal_code ?? apiData.postalCode,
      ),

      hasSoldBefore: Boolean(apiData.has_sold_before ?? apiData.hasSoldBefore),

      followUpCount: apiData.follow_up_count ?? apiData.followUpCount,

      lastFollowUpDate: apiData.last_follow_up_date ?? apiData.lastFollowUpDate,

      lastSaleDate: apiData.last_sale_date ?? apiData.lastSaleDate,

      isInWaitingBasket: Boolean(
        apiData.is_in_waiting_basket ?? apiData.isInWaitingBasket,
      ),

      waitingBasketStartDate:
        apiData.waiting_basket_start_date ?? apiData.waitingBasketStartDate,

      followupBonusRemaining:
        apiData.followup_bonus_remaining ?? apiData.followupBonusRemaining,

      address: {
        recipientFirstName: sanitizeAddressValue(
          apiData.recipient_first_name ??
          apiData.recipientFirstName ??
          firstName,
        ),

        recipientLastName: sanitizeAddressValue(
          apiData.recipient_last_name ?? apiData.recipientLastName ?? lastName,
        ),

        street: sanitizeAddressValue(apiData.street),

        subdistrict: sanitizeAddressValue(apiData.subdistrict),

        district: sanitizeAddressValue(apiData.district),

        province: sanitizeAddressValue(apiData.province),

        postalCode: sanitizeAddressValue(
          apiData.postal_code ?? apiData.postalCode,
        ),
      },
    };
  };

  // Helper function to set customer data consistently

  const setCustomerData = (customerData: Customer) => {
    setSelectedCustomer(customerData);

    setOrderData((prev) => ({ ...prev, customerId: customerData.id }));

    setSearchTerm(`${customerData.firstName} ${customerData.lastName}`);

    setFacebookName(customerData.facebookName || "");

    setLineId(customerData.lineId || "");
  };

  const handleSelectCustomer = async (customer: Customer) => {
    clearValidationErrorFor("customerSelector");

    setLoadingCustomerData(true);

    try {
      // Fetch fresh customer data from database
      const token = localStorage.getItem("authToken");
      const headers: any = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(
        `${resolveApiBasePath().replace(/\/$/, "")}/index.php/customers/${encodeURIComponent(customer.id)}`,
        { headers },
      );

      if (response.ok) {
        const freshCustomerData = await response.json();

        if (freshCustomerData && !freshCustomerData.error) {
          // Map snake_case fields from API to camelCase for frontend

          const mappedCustomerData = mapCustomerData(freshCustomerData);

          setCustomerData(mappedCustomerData);

          // Initialize edited customer fields with current values

          setEditedCustomerFirstName(mappedCustomerData.firstName || "");

          setEditedCustomerLastName(mappedCustomerData.lastName || "");

          setEditedCustomerPhone(mappedCustomerData.phone || "");

          setEditedCustomerBackupPhone(mappedCustomerData.backupPhone || "");

          setEditedCustomerPhoneError("");

          setEditedCustomerBackupPhoneError("");
        } else {
          // Fallback to original customer data if fetch fails

          setCustomerData(customer);

          setEditedCustomerFirstName(customer.firstName || "");

          setEditedCustomerLastName(customer.lastName || "");

          setEditedCustomerPhone(customer.phone || "");

          setEditedCustomerBackupPhone(customer.backupPhone || "");

          setEditedCustomerPhoneError("");

          setEditedCustomerBackupPhoneError("");
        }
      } else {
        // Fallback to original customer data if API call fails

        setCustomerData(customer);

        setEditedCustomerFirstName(customer.firstName || "");

        setEditedCustomerLastName(customer.lastName || "");

        setEditedCustomerPhone(customer.phone || "");

        setEditedCustomerBackupPhone(customer.backupPhone || "");

        setEditedCustomerPhoneError("");

        setEditedCustomerBackupPhoneError("");
      }
    } catch (error) {
      console.error("Error fetching fresh customer data:", error);

      // Fallback to original customer data if fetch fails

      setCustomerData(customer);

      setEditedCustomerFirstName(customer.firstName || "");

      setEditedCustomerLastName(customer.lastName || "");

      setEditedCustomerPhone(customer.phone || "");

      setEditedCustomerBackupPhone(customer.backupPhone || "");

      setEditedCustomerPhoneError("");

      setEditedCustomerBackupPhoneError("");
    } finally {
      setLoadingCustomerData(false);
    }

    setIsCreatingNewCustomer(false);

    // Reset address selections

    setSelectedProvince(null);

    setSelectedDistrict(null);

    setSelectedSubDistrict(null);

    // Reset search terms and close dropdowns

    setProvinceSearchTerm("");

    setDistrictSearchTerm("");

    setSubDistrictSearchTerm("");

    setShowProvinceDropdown(false);

    setShowDistrictDropdown(false);

    setShowSubDistrictDropdown(false);

    if (customer.address) {
      setUseProfileAddress(true);

      const normalized = normalizeAddress(customer.address);

      const fallbackFirst = sanitizeAddressValue(customer.firstName || "");

      const fallbackLast = sanitizeAddressValue(customer.lastName || "");

      setShippingAddress({
        ...normalized,

        recipientFirstName:
          normalized.recipientFirstName || fallbackFirst || "",

        recipientLastName: normalized.recipientLastName || fallbackLast || "",
      });
    } else {
      setUseProfileAddress(false);

      setShippingAddress({
        ...emptyAddress,

        recipientFirstName: sanitizeAddressValue(customer.firstName || ""),

        recipientLastName: sanitizeAddressValue(customer.lastName || ""),
      });
    }
  };

  const startCreatingNewCustomer = () => {
    clearValidationErrorFor("customerSelector");

    setIsCreatingNewCustomer(true);

    setSelectedCustomer(null);

    setOrderData((prev) => ({ ...prev, customerId: undefined }));

    // Reset edited customer fields

    setEditedCustomerFirstName("");

    setEditedCustomerLastName("");

    setEditedCustomerPhone("");

    setEditedCustomerPhoneError("");

    setEditedCustomerBackupPhone("");

    setEditedCustomerBackupPhoneError("");

    // Reset address selections

    setSelectedProvince(null);

    setSelectedDistrict(null);

    setSelectedSubDistrict(null);

    // Reset search terms and close dropdowns

    setProvinceSearchTerm("");

    setDistrictSearchTerm("");

    setSubDistrictSearchTerm("");

    setShowProvinceDropdown(false);

    setShowDistrictDropdown(false);

    setShowSubDistrictDropdown(false);

    let derivedFirstName = "";

    let derivedLastName = "";

    if (/^0[0-9]{9}$/.test(searchTerm)) {
      setNewCustomerPhone(searchTerm);

      setNewCustomerFirstName("");

      setNewCustomerLastName("");

      setNewCustomerPhoneError("");

      setNewCustomerBackupPhone("");

      setNewCustomerBackupPhoneError("");
    } else {
      const nameParts = searchTerm.split(" ").filter((p) => p);

      derivedFirstName = nameParts.shift() || "";

      derivedLastName = nameParts.join(" ");

      setNewCustomerFirstName(derivedFirstName);

      setNewCustomerLastName(derivedLastName);

      setNewCustomerPhone("");

      setNewCustomerPhoneError("");

      setNewCustomerBackupPhone("");

      setNewCustomerBackupPhoneError("");
    }

    setFacebookName("");

    setLineId("");

    setShippingAddress({
      ...emptyAddress,

      recipientFirstName: sanitizeAddressValue(derivedFirstName),

      recipientLastName: sanitizeAddressValue(derivedLastName),
    });

    setUseProfileAddress(false);
  };

  const updateOrderData = (field: keyof Order, value: any) => {
    if (field === "paymentMethod") {
      clearValidationErrorFor("paymentMethod", "transferSlips", "cod");
    } else if (field === "deliveryDate") {
      clearValidationErrorFor("deliveryDate");
    } else if (field === "items") {
      clearValidationErrorFor("items");
    } else if (field === "boxes") {
      clearValidationErrorFor("cod");
    }

    setOrderData((prev) => ({ ...prev, [field]: value }));
  };

  const handleShippingAddressChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    clearValidationErrorFor("shippingAddress");

    const { name, value } = e.target;

    setShippingAddress((prev) => ({
      ...prev,

      [name]: value,
    }));

    // Set modification flag if profile address is selected

    if (selectedAddressOption === "profile") {
      setProfileAddressModified(true);
    }

    // If postal code is entered and has 5 digits, search for address

    if (name === "postalCode") {
      // Only allow numbers

      const numericValue = value.replace(/[^0-9]/g, "");

      if (numericValue !== value) {
        setShippingAddress((prev) => ({
          ...prev,

          postalCode: numericValue,
        }));

        return;
      }

      if (numericValue.length >= 3) {
        setAddressLoading(true);

        // Ensure provinces are loaded first

        let provincesPromise = Promise.resolve(provinces);

        if (provinces.length === 0) {
          console.log("⏳ Provinces not loaded, loading now...");

          provincesPromise = fetch(
            `${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=provinces`,
          )
            .then((res) => res.json())

            .then((provinceData) => {
              if (provinceData.success) {
                console.log(
                  "✅ Provinces loaded:",

                  provinceData.data?.length || 0,
                );

                setProvinces(provinceData.data || []);

                return provinceData.data || [];
              }

              return [];
            });
        }

        // Search for postal code

        const searchPromise = fetch(
          `${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=search&search=${numericValue}`,
        ).then((res) => res.json());

        // Wait for both to complete

        Promise.all([provincesPromise, searchPromise])

          .then(([loadedProvinces, data]) => {
            console.log("🔍 Postal code search result:", data);

            if (data.success && data.data && data.data.length > 0) {
              const results = data.data;

              console.log("📮 Found results:", results);

              setPostalCodeResults(results);

              setShowPostalCodeDropdown(true);

              // Get unique province IDs from results

              const provinceIds = [
                ...new Set(results.map((r: any) => r.province_id)),
              ];

              console.log("📍 Province IDs from results:", provinceIds);

              // Always show dropdown first, then try auto-fill if only one result

              // If multiple results, user must select from dropdown

              if (results.length === 1) {
                const result = results[0];

                console.log(
                  "✅ Only one result, attempting auto-fill:",

                  result,
                );

                // Use loaded provinces (from Promise.all)

                const province = Array.isArray(loadedProvinces)
                  ? loadedProvinces.find(
                    (p: any) => p.id === result.province_id,
                  )
                  : provinces.find((p) => p.id === result.province_id);

                if (province) {
                  console.log("✅ Province found, auto-filling...");

                  setSelectedProvince(province.id);

                  setSelectedGeography(province.geography_id);

                  setProvinceSearchTerm(province.name_th);

                  setShowProvinceDropdown(false);

                  // Load districts for this province

                  fetch(
                    `${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=districts&id=${province.id}`,
                  )
                    .then((res) => res.json())

                    .then((districtData) => {
                      if (districtData.success) {
                        setDistricts(districtData.data || []);

                        // Find and set district

                        const district = districtData.data.find(
                          (d: any) => d.id === result.district_id,
                        );

                        if (district) {
                          setSelectedDistrict(district.id);

                          setDistrictSearchTerm(district.name_th);

                          setShowDistrictDropdown(false);

                          // Load subdistricts for this district

                          return fetch(
                            `${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=sub_districts&id=${district.id}`,
                          ).then((res) => res.json());
                        }
                      }

                      setAddressLoading(false);

                      return { success: false, data: [] };
                    })

                    .then((subDistrictData) => {
                      if (subDistrictData.success) {
                        setSubDistricts(subDistrictData.data || []);

                        // Find and set subdistrict

                        const subDistrict = subDistrictData.data.find(
                          (sd: any) =>
                            sd.id === result.id && sd.zip_code === numericValue,
                        );

                        if (subDistrict) {
                          setSelectedSubDistrict(subDistrict.id);

                          setSubDistrictSearchTerm(subDistrict.name_th);

                          setShowSubDistrictDropdown(false);

                          setShippingAddress((prev) => ({
                            ...prev,

                            province: result.province || prev.province,

                            district: result.district || prev.district,

                            subdistrict:
                              result.sub_district || prev.subdistrict,

                            postalCode: result.zip_code || prev.postalCode,
                          }));
                        }
                      }

                      setAddressLoading(false);
                    })

                    .catch((error) => {
                      console.error("Error loading address data:", error);

                      setAddressLoading(false);
                    });
                } else {
                  // Province not found in loaded provinces, try to load it

                  console.log(
                    "⚠️ Province not found in loaded provinces, loading all provinces...",
                  );

                  setAddressLoading(true);

                  fetch(
                    `${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=provinces`,
                  )
                    .then((res) => res.json())

                    .then((provinceData) => {
                      if (provinceData.success) {
                        setProvinces(provinceData.data || []);

                        const province = provinceData.data.find(
                          (p: any) => p.id === result.province_id,
                        );

                        if (province) {
                          console.log("✅ Province loaded, auto-filling...");

                          setSelectedProvince(province.id);

                          setSelectedGeography(province.geography_id);

                          setProvinceSearchTerm(province.name_th);

                          setShowProvinceDropdown(false);

                          // Continue with loading districts

                          return fetch(
                            `${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=districts&id=${province.id}`,

                            `${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=districts&id=${province.id}`,
                          ).then((res) => res.json());
                        }
                      }

                      setAddressLoading(false);

                      return { success: false, data: [] };
                    })

                    .then((districtData) => {
                      if (districtData && districtData.success) {
                        setDistricts(districtData.data || []);

                        const result = results[0];

                        const district = districtData.data.find(
                          (d: any) => d.id === result.district_id,
                        );

                        if (district) {
                          setSelectedDistrict(district.id);

                          setDistrictSearchTerm(district.name_th);

                          setShowDistrictDropdown(false);

                          // Load subdistricts

                          return fetch(
                            `${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=sub_districts&id=${district.id}`,
                          ).then((res) => res.json());
                        }
                      }

                      setAddressLoading(false);

                      return { success: false, data: [] };
                    })

                    .then((subDistrictData) => {
                      if (subDistrictData && subDistrictData.success) {
                        setSubDistricts(subDistrictData.data || []);

                        const result = results[0];

                        const subDistrict = subDistrictData.data.find(
                          (sd: any) =>
                            sd.id === result.id && sd.zip_code === numericValue,
                        );

                        if (subDistrict) {
                          setSelectedSubDistrict(subDistrict.id);

                          setSubDistrictSearchTerm(subDistrict.name_th);

                          setShowSubDistrictDropdown(false);

                          setShippingAddress((prev) => ({
                            ...prev,

                            province: result.province || prev.province,

                            district: result.district || prev.district,

                            subdistrict:
                              result.sub_district || prev.subdistrict,

                            postalCode: result.zip_code || prev.postalCode,
                          }));

                          console.log("✅ Auto-fill completed!");
                        }
                      }

                      setAddressLoading(false);
                    })

                    .catch((error) => {
                      console.error("❌ Error loading address data:", error);

                      setAddressLoading(false);
                    });
                }
              } else {
                // Multiple results - show dropdown for user to select

                console.log(
                  `📋 Multiple results found (${results.length}), showing dropdown`,
                );

                setAddressLoading(false);
              }
            } else {
              setPostalCodeResults([]);

              setShowPostalCodeDropdown(false);

              setAddressLoading(false);
            }
          })

          .catch((error) => {
            console.error("Error searching postal code:", error);

            setAddressLoading(false);

            setPostalCodeResults([]);

            setShowPostalCodeDropdown(false);
          });
      } else {
        // Clear results if postal code is not complete

        if (numericValue.length < 5) {
          setPostalCodeResults([]);

          setShowPostalCodeDropdown(false);

          // Clear selections if postal code is deleted

          if (numericValue.length === 0) {
            setSelectedProvince(null);

            setSelectedDistrict(null);

            setSelectedSubDistrict(null);

            setShippingAddress((prev) => ({
              ...prev,

              province: "",

              district: "",

              subdistrict: "",

              postalCode: "",
            }));
          }
        }
      }
    }
  };

  const handleNewCustomerPhoneChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    clearValidationErrorFor("newCustomerPhone");

    const value = e.target.value.replace(/[^0-9]/g, "");

    if (value.length > 10) return;

    setNewCustomerPhone(value);

    if (value.length === 0) {
      setNewCustomerPhoneError("กรุณากรอกเบอร์โทรศัพท์");
    } else if (value.length !== 10) {
      setNewCustomerPhoneError("เบอร์โทรต้องมี 10 หลัก");
    } else if (value[0] !== "0") {
      setNewCustomerPhoneError("เบอร์โทรต้องขึ้นต้นด้วย 0");
    } else {
      setNewCustomerPhoneError("");
    }
  };

  const validateOptionalPhone = (
    value: string,

    setError: (msg: string) => void,
  ) => {
    if (!value) {
      setError("");

      return;
    }

    if (value.length !== 10) {
      setError("เบอร์โทรต้องมี 10 หลัก");
    } else if (value[0] !== "0") {
      setError("เบอร์โทรต้องขึ้นต้นด้วย 0");
    } else {
      setError("");
    }
  };

  const handleNewCustomerBackupPhoneChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.value.replace(/[^0-9]/g, "");

    if (value.length > 10) return;

    setNewCustomerBackupPhone(value);

    validateOptionalPhone(value, setNewCustomerBackupPhoneError);
  };

  // Handler for editing existing customer phone

  const handleEditedCustomerPhoneChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.value.replace(/[^0-9]/g, "");

    if (value.length > 10) return;

    setEditedCustomerPhone(value);

    if (value.length === 0) {
      setEditedCustomerPhoneError("");
    } else if (value.length !== 10) {
      setEditedCustomerPhoneError("เบอร์โทรต้องมี 10 หลัก");
    } else if (value[0] !== "0") {
      setEditedCustomerPhoneError("เบอร์โทรต้องขึ้นต้นด้วย 0");
    } else {
      setEditedCustomerPhoneError("");
    }
  };

  const handleEditedCustomerBackupPhoneChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.value.replace(/[^0-9]/g, "");

    if (value.length > 10) return;

    setEditedCustomerBackupPhone(value);

    validateOptionalPhone(value, setEditedCustomerBackupPhoneError);
  };

  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  const handleSave = async () => {
    const isAddressIncomplete = Object.entries(shippingAddress).some(
      ([key, val]) =>
        key !== "recipientLastName" && (val as string).trim() === "",
    );

    if (isAddressIncomplete) {
      highlightField("shippingAddress");

      alert("กรุณากรอกที่อยู่จัดส่งให้ครบถ้วน");

      return;
    }

    // Validate Customer Status
    if (!customerStatus) {
      alert("กรุณาเลือกสถานะลูกค้า");
      customerStatusRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      customerStatusRef.current?.focus();
      return;
    }

    if (!orderData.deliveryDate) {
      highlightField("deliveryDate");

      alert("กรุณาเลือกวันที่จัดส่ง");

      return;
    }

    // ตรวจสอบวันที่จัดส่งต้องไม่เกินวันที่ 7 ของเดือนถัดไป

    const getMaxDeliveryDate = (): string => {
      const now = new Date();

      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 7);

      return nextMonth.toISOString().split("T")[0];
    };

    const maxDeliveryDate = getMaxDeliveryDate();

    if (orderData.deliveryDate > maxDeliveryDate) {
      highlightField("deliveryDate");

      const maxDate = new Date(maxDeliveryDate);

      const maxDateStr = `${maxDate.getDate()}/${maxDate.getMonth() + 1}/${maxDate.getFullYear()}`;

      alert(
        `วันที่จัดส่งต้องไม่เกินวันที่ 7 ของเดือนถัดไป (สูงสุด ${maxDateStr})`,
      );

      return;
    }

    if (
      !orderData.items ||
      orderData.items.length === 0 ||
      orderData.items.every((i) => !i.productName)
    ) {
      highlightField("items");

      alert("กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ");

      return;
    }

    if (!orderData.paymentMethod) {
      highlightField("paymentMethod");
      alert("กรุณาเลือกวิธีการชำระเงิน");
      return;
    }
    if (orderData.paymentMethod === PaymentMethod.Transfer) {
      if (transferSlipUploads.length === 0) {
        highlightField("transferSlips");
        alert("กรุณาอัปโหลดสลิปการโอนอย่างน้อย 1 รูป");
        return;
      }
      const slipsMissingMeta = transferSlipUploads.some(
        (s) =>
          !s.bankAccountId ||
          !s.transferDate ||
          typeof s.amount !== "number" ||
          Number(s.amount) <= 0,
      );
      if (slipsMissingMeta) {
        alert("กรุณาระบุธนาคารและวันเวลาโอนให้ครบทุกสลิป");
        return;
      }
    }
    if (!salesChannel) {
      highlightField("salesChannel");

      alert("กรุณาเลือกช่องทางการสั่งซื้อ");

      return;
    }

    const selectedPlatform = platforms.find((p) => p.name === salesChannel);

    // Check if platform requires page selection

    // - Platform name is not "โทร"

    // - Platform has showPagesFrom set (or uses its own pages by default)

    const hasShowPagesFrom =
      selectedPlatform?.showPagesFrom &&
      selectedPlatform.showPagesFrom.trim() !== "";

    const usesOwnPages =
      !selectedPlatform?.showPagesFrom || selectedPlatform.showPagesFrom === "";

    const shouldHavePage =
      selectedPlatform &&
      selectedPlatform.name !== "โทร" &&
      (hasShowPagesFrom || usesOwnPages);

    if (shouldHavePage && !salesChannelPageId) {
      highlightField("salesChannelPage");

      alert("กรุณาเลือกเพจของช่องทางการสั่งซื้อ");

      return;
    }

    if (orderData.paymentMethod === PaymentMethod.COD && !isCodValid) {
      highlightField("cod");

      alert("ยอด COD ในแต่ละกล่องรวมกันไม่เท่ากับยอดสุทธิ");

      return;
    }

    // ตรวจสอบจำนวนกล่องสำหรับ COD

    if (orderData.paymentMethod === PaymentMethod.COD) {
      const parentItems = (orderData.items || []).filter(
        (it) => !it.parentItemId,
      );

      const maxBoxes = parentItems.length || 1;

      if (numBoxes > maxBoxes) {
        highlightField("cod");

        alert(
          `จำนวนกล่อง (${numBoxes}) ต้องไม่เกินจำนวนรายการสินค้า (${maxBoxes} รายการ)`,
        );

        return;
      }

      // ตรวจสอบว่าทุกกล่องมีสินค้าอย่างน้อย 1 รายการ

      const boxesWithItems = new Set<number>();

      parentItems.forEach((item) => {
        if (
          item.boxNumber &&
          item.boxNumber >= 1 &&
          item.boxNumber <= numBoxes
        ) {
          boxesWithItems.add(item.boxNumber);
        }
      });

      // ตรวจสอบว่าทุกกล่องตั้งแต่ 1 ถึง numBoxes มีสินค้า

      for (let boxNum = 1; boxNum <= numBoxes; boxNum++) {
        if (!boxesWithItems.has(boxNum)) {
          highlightField("cod");

          alert(
            `กล่องที่ ${boxNum} ไม่มีสินค้า กรุณาเพิ่มสินค้าในกล่องนี้หรือลดจำนวนกล่อง`,
          );

          return;
        }
      }
    }

    // Ensure boxNumber & quantities of promotion children follow their promotion parent
    const normalizedItems = (orderData.items || []).map((item) => {
      if (!item.parentItemId) {
        return item;
      }

      const parent = (orderData.items || []).find(
        (p) => p.id === item.parentItemId && p.isPromotionParent,
      );
      if (!parent) {
        return item;
      }

      const parentBox = parent.boxNumber || 1;
      const parentQty = parent.quantity || 1;

      const patched: LineItem = { ...item };

      // Force child boxNumber to match parent
      patched.boxNumber = parentBox;

      // Scale child quantity by parent quantity (e.g. promo x2)
      patched.quantity = (item.quantity || 0) * parentQty;

      return patched;
    });

    const finalOrderData: Partial<Order> = {
      ...orderData,
      items: normalizedItems,

      shippingAddress,

      totalAmount,

      paymentStatus:
        typeof orderData.paymentStatus !== "undefined"
          ? orderData.paymentStatus
          : orderData.paymentMethod === PaymentMethod.Transfer &&
            transferSlipUploads.length > 0
            ? PaymentStatus.PendingVerification
            : PaymentStatus.Unpaid,

      orderStatus: OrderStatus.Pending,

      salesChannel: salesChannel,

      // @ts-ignore - backend supports this field; added in schema

      salesChannelPageId: (() => {
        const selectedPlatform = platforms.find((p) => p.name === salesChannel);

        if (!selectedPlatform || selectedPlatform.name === "โทร")
          return undefined;

        const hasShowPagesFrom =
          selectedPlatform?.showPagesFrom &&
          selectedPlatform.showPagesFrom.trim() !== "";

        const usesOwnPages =
          !selectedPlatform?.showPagesFrom ||
          selectedPlatform.showPagesFrom === "";

        // Only set pageId if platform should have pages (has showPagesFrom or uses own pages)

        return hasShowPagesFrom || usesOwnPages
          ? salesChannelPageId || undefined
          : undefined;
      })(),

      warehouseId: warehouseId || undefined,
      customerStatus: customerStatus,
    };

    const payload: Parameters<typeof onSave>[0] = { order: finalOrderData };

    if (transferSlipUploads.length > 0) {
      (payload as any).slipUploads = transferSlipUploads.map((slip) => ({
        dataUrl: slip.dataUrl,
        bankAccountId: slip.bankAccountId,
        transferDate: slip.transferDate,
        amount: slip.amount,
      }));
    }

    // Add bank account and transfer date for transfer payment
    if (orderData.paymentMethod === PaymentMethod.Transfer) {
      const firstSlip = transferSlipUploads[0];
      if (firstSlip?.bankAccountId) {
        (payload as any).bankAccountId = firstSlip.bankAccountId;
      } else if (selectedBankAccountId) {
        (payload as any).bankAccountId = selectedBankAccountId;
      }
      if (firstSlip?.transferDate) {
        (payload as any).transferDate = firstSlip.transferDate;
      } else if (transferDate) {
        (payload as any).transferDate = transferDate;
      }
    }

    if (isCreatingNewCustomer) {
      if (!newCustomerFirstName.trim() || !newCustomerPhone.trim()) {
        highlightField("newCustomerFirstName");

        alert("กรุณากรอกชื่อและเบอร์โทรศัพท์สำหรับลูกค้าใหม่");

        return;
      }

      if (newCustomerPhoneError) {
        highlightField("newCustomerPhone");

        alert(`เบอร์โทรศัพท์ไม่ถูกต้อง: ${newCustomerPhoneError}`);

        return;
      }

      if (newCustomerBackupPhoneError) {
        alert(`เบอร์สำรองไม่ถูกต้อง: ${newCustomerBackupPhoneError}`);

        return;
      }

      (payload as any).newCustomer = {
        firstName: newCustomerFirstName,

        lastName: newCustomerLastName,

        phone: newCustomerPhone,

        backupPhone: newCustomerBackupPhone || undefined,

        facebookName: facebookName,

        lineId: lineId,

        address: normalizeAddress(shippingAddress),

        province: sanitizeAddressValue(shippingAddress.province),

        assignedTo: null,

        dateAssigned: new Date().toISOString(),

        ownershipExpires: new Date(
          new Date().setDate(new Date().getDate() + 90),
        ).toISOString(),

        lifecycleStatus: CustomerLifecycleStatus.New,

        behavioralStatus: CustomerBehavioralStatus.Warm,

        grade: CustomerGrade.D,
      };
    } else {
      if (!selectedCustomer) {
        highlightField("customerSelector");

        alert("กรุณาเลือกลูกค้า");

        return;
      }

      // Validate edited phone if it's changed

      if (editedCustomerPhoneError) {
        highlightField("editedCustomerPhone");

        alert(`เบอร์โทรศัพท์ไม่ถูกต้อง: ${editedCustomerPhoneError}`);

        return;
      }

      if (editedCustomerBackupPhoneError) {
        alert(`เบอร์สำรองไม่ถูกต้อง: ${editedCustomerBackupPhoneError}`);

        return;
      }

      const hasSocialsChanged =
        facebookName !== (selectedCustomer?.facebookName || "") ||
        lineId !== (selectedCustomer?.lineId || "");

      if (hasSocialsChanged) {
        // Social media changes will be handled via the new API endpoint

        (payload as any).updateCustomerSocials = true;
      }

      // Check if customer name or phone has been changed

      const hasNameChanged =
        editedCustomerFirstName.trim() !==
        (selectedCustomer?.firstName || "").trim() ||
        editedCustomerLastName.trim() !==
        (selectedCustomer?.lastName || "").trim();

      const hasPhoneChanged =
        editedCustomerPhone.trim() !== (selectedCustomer?.phone || "").trim();

      const hasBackupPhoneChanged =
        editedCustomerBackupPhone.trim() !==
        (selectedCustomer?.backupPhone || "").trim();

      const hasCustomerTypeChanged =
        editedCustomerType !==
        (selectedCustomer?.customerType || "New Customer");

      if (
        hasNameChanged ||
        hasPhoneChanged ||
        hasBackupPhoneChanged ||
        hasCustomerTypeChanged
      ) {
        (payload as any).updateCustomerInfo = {
          firstName: editedCustomerFirstName.trim(),

          lastName: editedCustomerLastName.trim(),

          phone: editedCustomerPhone.trim(),

          backupPhone: editedCustomerBackupPhone.trim() || null,
        };
      }

      // Handle address saving

      if (selectedAddressOption === "new") {
        if (updateProfileAddress) {
          // Update profile address in customers table via new API

          // This will be handled after the order is saved

          (payload as any).updateCustomerAddress = true;
        } else {
          // Save new address to customer_address table

          (payload as any).newCustomerAddress = {
            customer_id: selectedCustomer.id,

            recipient_first_name: sanitizeAddressValue(
              shippingAddress.recipientFirstName,
            ),

            recipient_last_name: sanitizeAddressValue(
              shippingAddress.recipientLastName,
            ),

            address: sanitizeAddressValue(shippingAddress.street),

            province: sanitizeAddressValue(shippingAddress.province),

            district: sanitizeAddressValue(shippingAddress.district),

            sub_district: sanitizeAddressValue(shippingAddress.subdistrict),

            zip_code: sanitizeAddressValue(shippingAddress.postalCode),
          };
        }
      } else if (selectedAddressOption === "profile") {
        // Always update profile address when selected, even if not modified

        // This allows editing the primary address directly

        (payload as any).updateCustomerAddress = true;
      }
    }

    // Add customerType to payload (moved from customer payload to order payload)
    (payload as any).customerType = isCreatingNewCustomer
      ? newCustomerType
      : editedCustomerType;

    let savedOrderId: string | undefined;

    try {
      savedOrderId = await onSave(payload);
    } catch (error) {
      console.error("create order failed", error);

      alert("เกิดข้อผิดพลาดในการบันทึกคำสั่งซื้อ กรุณาลองใหม่อีกครั้ง");

      return;
    }

    if (!savedOrderId) {
      return;
    }

    // Handle customer address update if checkbox is checked

    // Primary address (profile address) uses recipient_first_name and recipient_last_name from customers table

    // Additional addresses use recipient_first_name and recipient_last_name from customer_address table

    if ((payload as any).updateCustomerAddress && selectedCustomer) {
      try {
        const updateData = {
          customer_id: selectedCustomer.id,

          // Include recipient name for primary address in customers table

          recipient_first_name: sanitizeAddressValue(
            shippingAddress.recipientFirstName,
          ),

          recipient_last_name: sanitizeAddressValue(
            shippingAddress.recipientLastName,
          ),

          street: sanitizeAddressValue(shippingAddress.street),

          subdistrict: sanitizeAddressValue(shippingAddress.subdistrict),

          district: sanitizeAddressValue(shippingAddress.district),

          province: sanitizeAddressValue(shippingAddress.province),

          postal_code: sanitizeAddressValue(shippingAddress.postalCode),
        };

        const response = await fetch(
          `${resolveApiBasePath()}/Address_DB/update_customer_address.php`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(updateData),
          },
        );

        const result = await response.json();

        if (result.success) {
          console.log("Customer address updated successfully:", result.data);

          // Update the selectedCustomer state with the latest data from database

          // Primary address (profile address) uses recipient_first_name and recipient_last_name from customers table

          // Additional addresses use recipient_first_name and recipient_last_name from customer_address table

          if (result.data && selectedCustomer) {
            const updatedCustomer = {
              ...selectedCustomer,

              address: {
                // Get recipient name from customers table (primary address)

                recipientFirstName:
                  sanitizeAddressValue(result.data.recipient_first_name) ||
                  shippingAddress.recipientFirstName ||
                  selectedCustomer.address?.recipientFirstName,

                recipientLastName:
                  sanitizeAddressValue(result.data.recipient_last_name) ||
                  shippingAddress.recipientLastName ||
                  selectedCustomer.address?.recipientLastName,

                street:
                  sanitizeAddressValue(result.data.street) ||
                  sanitizeAddressValue(selectedCustomer.address?.street),

                subdistrict:
                  sanitizeAddressValue(result.data.subdistrict) ||
                  sanitizeAddressValue(selectedCustomer.address?.subdistrict),

                district:
                  sanitizeAddressValue(result.data.district) ||
                  sanitizeAddressValue(selectedCustomer.address?.district),

                province:
                  sanitizeAddressValue(result.data.province) ||
                  sanitizeAddressValue(selectedCustomer.address?.province),

                postalCode:
                  sanitizeAddressValue(result.data.postal_code) ||
                  sanitizeAddressValue(selectedCustomer.address?.postalCode),
              },
            };

            setSelectedCustomer(updatedCustomer);
          }
        } else {
          console.error("Failed to update customer address:", result.message);

          alert("ไม่สามารถอัพเดตที่อยู่หลักได้: " + result.message);
        }
      } catch (error) {
        console.error("Error updating customer address:", error);

        alert("เกิดข้อผิดพลาดในการอัพเดตที่อยู่หลัก");
      }
    }

    // Handle customer social media update if changed

    if ((payload as any).updateCustomerSocials && selectedCustomer) {
      try {
        const updateData = {
          customer_id: selectedCustomer.id,

          facebook_name: facebookName,

          line_id: lineId,
        };

        const response = await fetch(
          `${resolveApiBasePath()}/Address_DB/update_customer_address.php`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(updateData),
          },
        );

        const result = await response.json();

        if (result.success) {
          console.log(
            "Customer social media updated successfully:",

            result.data,
          );

          // Update the selectedCustomer state with the latest social media data from database

          if (result.data && selectedCustomer) {
            const updatedCustomer = {
              ...selectedCustomer,

              facebookName:
                result.data.facebook_name || selectedCustomer.facebookName,

              lineId: result.data.line_id || selectedCustomer.lineId,
            };

            setSelectedCustomer(updatedCustomer);
          }
        } else {
          console.error(
            "Failed to update customer social media:",

            result.message,
          );

          alert("ไม่สามารถอัพเดตข้อมูลโซเชียลมีเดียได้: " + result.message);
        }
      } catch (error) {
        console.error("Error updating customer social media:", error);

        alert("เกิดข้อผิดพลาดในการอัพเดตข้อมูลโซเชียลมีเดีย");
      }
    }

    // Note: updateCustomerInfo is now handled in App.tsx handleCreateOrder

    // No need to handle it here since it's sent in the payload

    // If we need to save a new customer address (not updating the profile), make a separate API call

    if (
      selectedAddressOption === "new" &&
      !updateProfileAddress &&
      (payload as any).newCustomerAddress
    ) {
      console.log("Selected customer ID:", selectedCustomer?.id);

      console.log(
        "Saving new customer address:",

        (payload as any).newCustomerAddress,
      );

      fetch(
        `${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=save_customer_address`,

        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify((payload as any).newCustomerAddress),
        },
      )
        .then((response) => response.json())

        .then((data) => {
          console.log("Customer address save response:", data);

          if (!data.success) {
            console.error("Error saving customer address:", data.message);

            alert("เกิดข้อผิดพลาดในการบันทึกที่อยู่: " + data.message);
          } else {
            console.log(
              "Customer address saved successfully with ID:",

              data.id,
            );
          }
        })

        .catch((error) => {
          console.error("Error saving customer address:", error);

          alert("เกิดข้อผิดพลาดในการบันทึกที่อยู่: " + error.message);
        });
    }

    setCreatedOrderId(savedOrderId ?? null);

    setShowSuccessModal(true);
  };

  const handleCodBoxAmountChange = (index: number, amount: number) => {
    clearValidationErrorFor("cod");

    const updatedBoxes = [...(orderData.boxes || [])];

    updatedBoxes[index].codAmount = amount;

    updateOrderData("boxes", updatedBoxes);
  };

  const divideCodEqually = () => {
    if (numBoxes <= 0 || totalAmount <= 0) return;

    clearValidationErrorFor("cod");

    const amountPerBox = totalAmount / numBoxes;

    const newBoxes = Array.from({ length: numBoxes }, (_, i) => ({
      boxNumber: i + 1,

      codAmount: 0,
    }));

    let distributedAmount = 0;

    for (let i = 0; i < numBoxes - 1; i++) {
      const roundedAmount = Math.floor(amountPerBox * 100) / 100;

      newBoxes[i].codAmount = roundedAmount;

      distributedAmount += roundedAmount;
    }

    newBoxes[numBoxes - 1].codAmount = parseFloat(
      (totalAmount - distributedAmount).toFixed(2),
    );

    updateOrderData("boxes", newBoxes);
  };

  // --- Product selection helpers ---

  const openProductSelector = (
    tab: "products" | "promotions" = "products",

    itemId?: number | null,
  ) => {
    setSelectorTab(tab);

    setEditingItemId(itemId || null); // ถ้ามี itemId แสดงว่ากำลังแก้ไขรายการเดิม

    setProductSelectorOpen(true);
  };

  const closeProductSelector = () => {
    setProductSelectorOpen(false);

    setEditingItemId(null); // เคลียร์ editingItemId เมื่อปิด modal
  };

  // Use real data from props (no client-side hardcode). If backend hasn't returned yet use empty arrays until loaded.

  const productsSafe = Array.isArray(products) ? products : [];

  const promotionsSafe = Array.isArray(promotions) ? promotions : [];

  // Utilities สำหรับความปลอดภัยกับข้อมูลจาก API

  const toNumber = (v: any, fallback = 0): number => {
    if (v === null || v === undefined) return fallback;

    const n = Number(v);

    return Number.isFinite(n) ? n : fallback;
  };

  const clampQuantity = (value: any): number => {
    const parsed = Math.floor(Number(value) || 0);

    return parsed > 0 ? parsed : 1;
  };

  const toBool = (v: any): boolean => {
    if (typeof v === "boolean") return v;

    if (typeof v === "number") return v !== 0;

    if (typeof v === "string") {
      const s = v.trim().toLowerCase();

      if (s === "0" || s === "false" || s === "") return false;

      if (s === "1" || s === "true") return true;

      const n = Number(s);

      if (Number.isFinite(n)) return n !== 0;

      return true;
    }

    return false;
  };

  // คำนวณราคารวมของโปรโมชั่นจากราคา/ชิ้น (price_override) x จำนวน โดยไม่คิดของแถม

  const calcPromotionTotal = (promo: Promotion) => {
    const items = Array.isArray(promo?.items) ? promo.items : [];

    let total = 0;

    for (const part of items as any[]) {
      const prod =
        productsSafe.find(
          (pr) => pr.id === (part.productId ?? part.product_id),
        ) ||
        productsSafe.find(
          (pr) =>
            pr.sku === (part.product?.sku || part.sku || part.product_sku),
        );

      const qty = toNumber(part.quantity, 1);

      const isFree = toBool(part.isFreebie) || toBool(part.is_freebie);

      // ลำดับการเลือกใช้ราคา: ราคา override ต่อชิ้น -> ราคา product ที่มาจาก API join (product_price) -> ราคาสินค้าที่โหลดในหน้าจอ

      const price = isFree
        ? 0
        : toNumber(
          (part as any).price_override ??
          (part as any).priceOverride ??
          (part as any).product_price,

          prod?.price ?? 0,
        );

      total += price * qty;
    }

    return total;
  };

  // ราคาชุดทั้งหมด (รวมทุกชิ้น ไม่หักของแถม)

  const calcPromotionSetPrice = (promo: Promotion) => {
    const items = Array.isArray(promo?.items) ? promo.items : [];

    let sum = 0;

    for (const part of items as any[]) {
      const prod =
        productsSafe.find(
          (pr) => pr.id === (part.productId ?? part.product_id),
        ) ||
        productsSafe.find(
          (pr) =>
            pr.sku === (part.product?.sku || part.sku || part.product_sku),
        );

      const qty = toNumber(part.quantity, 1);

      const isFree =
        toBool((part as any).isFreebie) || toBool((part as any).is_freebie);

      if (isFree) {
        // ของแถม ไม่นับราคาในราคารวมของชุด

        continue;
      }

      const override = toNumber(
        (part as any).price_override ?? (part as any).priceOverride,

        NaN,
      );

      const joinedPrice = toNumber((part as any).product_price, NaN);

      const basePrice = toNumber(prod?.price, 0);

      // ตรวจสอบ price_override:

      // - ถ้า override >= basePrice (หรือไม่มี basePriceชัดเจน) และมีจำนวน > 1

      //   ให้ตรวจสอบว่าเป็น "ราคารวมของกลุ่มนี้" (ไม่คูณ qty)

      // - มิฉะนั้น ใช้เป็น "ราคาต่อชิ้น" แล้วคูณด้วย qty

      if (Number.isFinite(override)) {
        const comparator =
          basePrice > 0
            ? basePrice
            : Number.isFinite(joinedPrice)
              ? joinedPrice
              : 0;

        if (qty > 1 && comparator > 0 && override >= comparator) {
          sum += override; // ราคาทั้งกลุ่ม
        } else {
          sum += override * qty; // ราคาต่อชิ้น
        }
      } else {
        // ไม่มี override -> ใช้ราคาสินค้า (joinedPrice หรือ basePrice) x qty

        const unit = Number.isFinite(joinedPrice) ? joinedPrice : basePrice;

        sum += unit * qty;
      }
    }

    return sum;
  };

  // ถ้ามีแถวว่าง ให้แทนที่แถวว่างแรกด้วยรายการใหม่ มิฉะนั้นให้ต่อท้าย

  const replaceEmptyRowOrAppend = (newItem: LineItem) => {
    const items = orderData.items || [];

    const emptyIndex = items.findIndex(
      (it) => !it.productName || String(it.productName).trim() === "",
    );

    if (emptyIndex !== -1) {
      const existingId = items[emptyIndex].id;

      const merged = { ...newItem, id: existingId };

      const next = items.map((it, i) => (i === emptyIndex ? merged : it));

      updateOrderData("items", next);

      setLockedItemIds((prev) =>
        prev.includes(existingId) ? prev : [...prev, existingId],
      );
    } else {
      updateOrderData("items", [...items, newItem]);

      setLockedItemIds((prev) =>
        prev.includes(newItem.id) ? prev : [...prev, newItem.id],
      );
    }
  };

  // ใช้ฟังก์ชันด้านบนเพื่อเพิ่มโปรโมชั่นเข้ารายการ ด้วยราคาที่ถูกต้อง

  const addPromotionByIdFixed = (promoId: number | string) => {
    const promo = promotionsSafe.find((p) => String(p.id) === String(promoId));

    if (!promo) return;

    // Create separate line items for each product in the promotion

    const promotionItems = promo.items || [];

    const promotionName = promo.name || "โปรโมชั่น";

    // Track all new items to add

    const newItemsToAdd: LineItem[] = [];

    const newLockedIds: number[] = [];

    // Create parent item (promotion header)

    const parentId = Date.now() + Math.floor(Math.random() * 1000);

    const parentItem: LineItem = {
      id: parentId,

      productName: `📦 ${promotionName}`,

      quantity: 1, // 1 set of promotion

      pricePerUnit: 0, // Will be calculated from child items

      discount: 0,

      isFreebie: false,

      boxNumber: 1,

      productId: undefined, // No specific product for parent

      promotionId: promo.id,

      parentItemId: undefined, // Parent has no parent

      isPromotionParent: true,
    };

    // รวมราคาชุดจากชิ้นย่อยที่ต้องจ่าย แล้วค่อยตั้งราคาให้ parent

    // so totals won't double-count. We'll also replace an empty row with this parent.

    let totalSetPrice = 0;

    for (const part of promotionItems) {
      // part may contain productId and joined product info

      const prod =
        productsSafe.find(
          (pr) => pr.id === (part.productId ?? part.product_id),
        ) ||
        productsSafe.find(
          (pr) =>
            pr.sku === (part.product?.sku || part.sku || part.product_sku),
        );

      if (!prod) continue;

      const qty = Number(part.quantity || 1);

      const isFreeFlag = !!part.isFreebie || !!part.is_freebie;

      // IMPORTANT: Always use price_override for promotion items if available

      // If price_override is null or 0 and item is not a freebie, use the regular product price

      const itemPrice = isFreeFlag
        ? 0
        : part.price_override !== null && part.price_override !== undefined
          ? Number(part.price_override)
          : prod.price;

      // Create a separate line item for each product in the promotion

      const newId = Date.now() + Math.floor(Math.random() * 1000);

      const productLineItem: LineItem = {
        id: newId,

        productName: `${prod.name}${isFreeFlag ? " (ของแถม)" : ""}`,

        quantity: qty,

        pricePerUnit: itemPrice,

        discount: 0,

        isFreebie: isFreeFlag,

        boxNumber: 1,

        productId: prod.id,

        promotionId: promo.id,

        parentItemId: parentId, // Link to parent

        isPromotionParent: false,
      };

      newItemsToAdd.push(productLineItem);

      newLockedIds.push(newId);

      if (!isFreeFlag) {
        totalSetPrice += itemPrice * qty;
      }

      // Totals are taken from child items; parent stays 0
    }

    // ตั้งราคารวมของชุดไว้ที่ parent

    parentItem.pricePerUnit = calcPromotionSetPrice(promo);

    const existing = orderData.items || [];

    let updatedChildItems: LineItem[] = [];

    // ถ้ามี editingItemId แสดงว่ากำลังแก้ไขรายการเดิม

    if (editingItemId !== null) {
      // ลบรายการเดิมและรายการย่อย (children) ทั้งหมด

      const filtered = existing.filter(
        (it) => it.id !== editingItemId && it.parentItemId !== editingItemId,
      );

      // ใช้ ID เดิมของรายการที่กำลังแก้ไข

      const existingId = editingItemId;

      parentItem.id = existingId;

      const actualParentId = existingId;

      newLockedIds.push(existingId);

      // Update child items to use the correct parent ID

      updatedChildItems = newItemsToAdd.map((item) => ({
        ...item,

        parentItemId: actualParentId,
      }));

      const next = [
        { ...parentItem, id: existingId },

        ...filtered,

        ...updatedChildItems,
      ];

      updateOrderData("items", next);
    } else {
      // ถ้าไม่มี editingItemId แสดงว่าเป็นการเพิ่มรายการใหม่

      const emptyIndex = existing.findIndex(
        (it) => !it.productName || String(it.productName).trim() === "",
      );

      let next: LineItem[];

      let actualParentId = parentId; // Default to new parent ID

      if (emptyIndex !== -1) {
        next = existing.slice();

        // preserve the existing id for stability when replacing the empty row

        const existingId = next[emptyIndex].id;

        next[emptyIndex] = { ...parentItem, id: existingId };

        actualParentId = existingId; // Use existing ID as actual parent ID

        newLockedIds.push(existingId);
      } else {
        next = [...existing, parentItem];

        newLockedIds.push(parentId);
      }

      // Update child items to use the correct parent ID

      updatedChildItems = newItemsToAdd.map((item) => ({
        ...item,

        parentItemId: actualParentId,
      }));

      next = [...next, ...updatedChildItems];

      updateOrderData("items", next);
    }

    setLockedItemIds((prev) => [
      ...prev,

      ...newLockedIds,

      ...updatedChildItems.map((i) => i.id),
    ]);

    closeProductSelector();
  };

  const addProductById = (productId: number) => {
    const p = productsSafe.find((pr) => pr.id === productId);

    if (!p) return;

    // ถ้ามี editingItemId แสดงว่ากำลังแก้ไขรายการเดิม

    if (editingItemId !== null) {
      updateOrderData(
        "items",

        orderData.items?.map((it) =>
          it.id === editingItemId
            ? {
              ...it,

              productName: p.name,

              productId: p.id,

              pricePerUnit: p.price,

              quantity: it.quantity || 1, // เก็บจำนวนเดิม

              discount: it.discount || 0, // เก็บส่วนลดเดิม

              boxNumber: it.boxNumber || 1, // เก็บกล่องเดิม

              isFreebie: it.isFreebie || false, // เก็บสถานะของแถมเดิม

              isPromotionParent: false, // เคลียร์ promotion parent status

              promotionId: undefined, // เคลียร์ promotionId

              parentItemId: undefined, // เคลียร์ parentItemId
            }
            : it,
        ),
      );
    } else {
      // ถ้าไม่มี editingItemId แสดงว่าเป็นการเพิ่มรายการใหม่

      const newId = Date.now() + Math.floor(Math.random() * 1000);

      const newItem: LineItem = {
        id: newId,

        productName: p.name,

        quantity: 1,

        pricePerUnit: p.price,

        discount: 0,

        isFreebie: false,

        boxNumber: 1,

        productId: p.id,

        isPromotionParent: false,
      };

      replaceEmptyRowOrAppend(newItem);
    }

    closeProductSelector();
  };

  const addPromotionById = (promoId: number | string) => {
    const promo = promotionsSafe.find((p) => String(p.id) === String(promoId));

    if (!promo) return;

    // Create separate line items for each product in the promotion

    const promotionItems = promo.items || [];

    const promotionName = promo.name || "โปรโมชั่น";

    // Track all new items to add

    const newItemsToAdd: LineItem[] = [];

    const newLockedIds: number[] = [];

    // Create parent item (promotion header)

    const parentId = Date.now() + Math.floor(Math.random() * 1000);

    const parentItem: LineItem = {
      id: parentId,

      productName: `📦 ${promotionName}`,

      quantity: 1, // 1 set of promotion

      pricePerUnit: 0, // Will be calculated from child items

      discount: 0,

      isFreebie: false,

      boxNumber: 1,

      productId: undefined, // No specific product for parent

      promotionId: promo.id,

      parentItemId: undefined, // Parent has no parent

      isPromotionParent: true,
    };

    newItemsToAdd.push(parentItem);

    newLockedIds.push(parentId);

    // Calculate total price for parent item

    let totalPromotionPrice = 0;

    for (const part of promotionItems) {
      // part may contain productId and joined product info

      const prod =
        productsSafe.find(
          (pr) => pr.id === (part.productId ?? part.product_id),
        ) ||
        productsSafe.find(
          (pr) =>
            pr.sku === (part.product?.sku || part.sku || part.product_sku),
        );

      if (!prod) continue;

      const qty = Number(part.quantity || 1);

      const isFreeFlag = !!part.isFreebie || !!part.is_freebie;

      // IMPORTANT: Always use price_override for promotion items if available

      // If price_override is null or 0 and item is not a freebie, use the regular product price

      const itemPrice = isFreeFlag
        ? 0
        : part.price_override !== null && part.price_override !== undefined
          ? Number(part.price_override)
          : prod.price;

      // Create a separate line item for each product in the promotion

      const newId = Date.now() + Math.floor(Math.random() * 1000);

      const productLineItem: LineItem = {
        id: newId,

        productName: `${prod.name}${isFreeFlag ? " (ของแถม)" : ""}`,

        quantity: qty,

        pricePerUnit: itemPrice,

        discount: 0,

        isFreebie: isFreeFlag,

        boxNumber: 1,

        productId: prod.id,

        promotionId: promo.id,

        parentItemId: parentId, // Link to parent

        isPromotionParent: false,
      };

      newItemsToAdd.push(productLineItem);

      newLockedIds.push(newId);

      // Add to total price (only non-freebie items)

      if (!isFreeFlag) {
        totalPromotionPrice += itemPrice * qty;
      }
    }

    // Update parent item with total price

    parentItem.pricePerUnit = totalPromotionPrice;

    // ถ้ามี editingItemId แสดงว่ากำลังแก้ไขรายการเดิม

    if (editingItemId !== null) {
      // ลบรายการเดิมและรายการย่อย (children) ทั้งหมด

      const existing = orderData.items || [];

      const filtered = existing.filter(
        (it) => it.id !== editingItemId && it.parentItemId !== editingItemId,
      );

      // แทนที่ด้วยโปรโมชั่นใหม่

      updateOrderData("items", [...filtered, parentItem, ...newItemsToAdd]);
    } else {
      // ถ้าไม่มี editingItemId แสดงว่าเป็นการเพิ่มรายการใหม่

      updateOrderData("items", [
        ...(orderData.items || []),

        parentItem,

        ...newItemsToAdd,
      ]);
    }

    setLockedItemIds((prev) => [...prev, ...newLockedIds]);

    closeProductSelector();
  };

  const formatCurrency = (value: number) =>
    `฿${Number(value || 0).toLocaleString("th-TH")}`;

  const renderUpsellView = () => {
    const TH = {
      title:
        "\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32 (Upsell)",

      customer: "\u0e25\u0e39\u0e01\u0e04\u0e49\u0e32",

      back: "\u0e22\u0e49\u0e2d\u0e19\u0e01\u0e25\u0e31\u0e1a",

      selectOrderLabel:
        "\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23\u0e4c\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e2d\u0e31\u0e1b\u0e40\u0e0b\u0e25",

      selectOrderOption:
        "\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23",

      orderPrefix: "\u0e2d\u0e2d\u0e40\u0e14\u0e2d\u0e23",

      loading: "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14...",

      existingTitle:
        "\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e40\u0e14\u0e34\u0e21",

      creatorLabel: "\u0e1c\u0e39\u0e49\u0e2a\u0e23\u0e49\u0e32\u0e07",

      creatorUnknown:
        "\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e1c\u0e39\u0e49\u0e2a\u0e23\u0e49\u0e32\u0e07",

      existingTotal:
        "\u0e22\u0e2d\u0e14\u0e23\u0e27\u0e21\u0e40\u0e14\u0e34\u0e21",

      colProduct: "\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32",

      colQty: "\u0e08\u0e33\u0e19\u0e27\u0e19",

      colUnitPrice: "\u0e23\u0e32\u0e04\u0e32/\u0e2b\u0e19\u0e48\u0e27\u0e22",

      colDiscount: "\u0e2a\u0e48\u0e27\u0e19\u0e25\u0e14",

      colNet: "\u0e2a\u0e38\u0e17\u0e18\u0e34",

      freebie: "\u0e02\u0e2d\u0e07\u0e41\u0e16\u0e21",

      addTitle:
        "\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e43\u0e2b\u0e21\u0e48",

      addButton:
        "\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32",

      addRowLabel:
        "+ \u0e40\u0e1e\u0e34\u0e48\u0e21\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32",

      selectProductButton:
        "\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32",

      selectPromotionButton:
        "\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e42\u0e1b\u0e23\u0e42\u0e21\u0e0a\u0e31\u0e19/\u0e40\u0e0a\u0e47\u0e15\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32",

      emptyText:
        "\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e43\u0e2b\u0e21\u0e48 \u0e01\u0e14 \u201c\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u201d \u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e40\u0e23\u0e34\u0e48\u0e21\u0e15\u0e49\u0e19",

      name: "\u0e0a\u0e37\u0e48\u0e2d\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32",

      select: "\u0e40\u0e25\u0e37\u0e2d\u0e01",

      remove: "\u0e25\u0e1a",

      qty: "\u0e08\u0e33\u0e19\u0e27\u0e19",

      unitPrice: "\u0e23\u0e32\u0e04\u0e32/\u0e2b\u0e19\u0e48\u0e27\u0e22",

      discount: "\u0e2a\u0e48\u0e27\u0e19\u0e25\u0e14",

      total: "\u0e22\u0e2d\u0e14\u0e23\u0e27\u0e21",

      box: "\u0e01\u0e25\u0e48\u0e2d\u0e07",

      freebieLabel: "\u0e41\u0e16\u0e21",

      addTotal:
        "\u0e22\u0e2d\u0e14\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e43\u0e2b\u0e21\u0e48\u0e23\u0e27\u0e21",

      cancel: "\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01",

      save: "\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32",

      saving:
        "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01...",
    };

    const resolvePaymentMethodLabel = (pm: any) => {
      const normalized = normalizePaymentMethod(pm);

      if (normalized === PaymentMethod.COD) return "เก็บเงินปลายทาง (COD)";

      if (normalized === PaymentMethod.Transfer) return "โอนเงิน";

      if (normalized === PaymentMethod.PayAfter) return "จ่ายหลังรับสินค้า";

      if (pm) return String(pm);

      return "-";
    };

    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="w-full mx-auto flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-[#0e141b]">{TH.title}</h1>

              <p className="text-[#4e7397]">
                {TH.customer}: {initialData?.customer?.firstName}{" "}
                {initialData?.customer?.lastName} (
                {initialData?.customer?.phone})
              </p>

              {selectedUpsellOrder && (
                <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">วันที่สั่งซื้อ:</span>

                    <span className="ml-2 font-medium text-gray-800">
                      {selectedUpsellOrder.orderDate
                        ? formatThaiDateTime(selectedUpsellOrder.orderDate)
                        : "-"}
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-500">วันที่จัดส่ง:</span>

                    <span className="ml-2 font-medium text-gray-800">
                      {selectedUpsellOrder.deliveryDate
                        ? (() => {
                          try {
                            return new Date(
                              selectedUpsellOrder.deliveryDate,
                            ).toLocaleDateString("th-TH");
                          } catch {
                            return "-";
                          }
                        })()
                        : "-"}
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-500">ช่องทางการขาย:</span>

                    <span className="ml-2 font-medium text-gray-800">
                      {selectedUpsellOrder.salesChannel || "-"}
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-500">ช่องทางการชำระ:</span>

                    <span className="ml-2 font-medium text-gray-800">
                      {resolvePaymentMethodLabel(
                        selectedUpsellOrder.paymentMethod ??
                        (selectedUpsellOrder as any).payment_method,
                      )}
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-500">สถานะ:</span>

                    <span className="ml-2 font-medium text-gray-800">
                      {selectedUpsellOrder.orderStatus || "-"}
                    </span>
                  </div>
                </div>
              )}

              {selectedUpsellOrder?.shippingAddress && (
                <div className="mt-2 text-sm">
                  <span className="text-gray-500">ที่อยู่การจัดส่ง:</span>

                  <span className="ml-2 text-gray-800">
                    {[
                      selectedUpsellOrder.shippingAddress.street,

                      selectedUpsellOrder.shippingAddress.subdistrict,

                      selectedUpsellOrder.shippingAddress.district,

                      selectedUpsellOrder.shippingAddress.province,

                      selectedUpsellOrder.shippingAddress.postalCode,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 ml-4"
            >
              {TH.back}
            </button>
          </div>
        </div>

        <div className="w-full mx-auto p-6 space-y-6">
          {upsellError && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
              {upsellError}
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm border p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {TH.selectOrderLabel}
            </label>

            <select
              value={selectedUpsellOrder?.id || ""}
              onChange={(e) => {
                const order = upsellOrders.find(
                  (o) => String(o.id) === String(e.target.value),
                );

                setSelectedUpsellOrder(order || null);

                setUpsellItems([]);

                setUpsellError(null);

                setUpsellBoxes([]);

                setNumUpsellBoxes(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={upsellLoading}
            >
              <option value="">-- {TH.selectOrderOption} --</option>

              {upsellOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  {TH.orderPrefix} {order.id} -{" "}
                  {formatThaiDateTime(order.orderDate)} -{" "}
                  {formatCurrency(getUpsellOrderTotal(order))}
                </option>
              ))}
            </select>
          </div>

          {upsellLoading && (
            <div className="text-center text-sm text-gray-500">
              {TH.loading}
            </div>
          )}

          {selectedUpsellOrder && (
            <>
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">
                      {TH.existingTitle}
                    </h2>

                    <p className="text-sm text-gray-600">
                      {TH.creatorLabel}:{" "}
                      {(() => {
                        const creator = upsellUsersById.get(
                          Number(selectedUpsellOrder.creatorId),
                        );

                        return creator
                          ? `${creator.firstName} ${creator.lastName}`
                          : selectedUpsellOrder.creatorId
                            ? `ID ${selectedUpsellOrder.creatorId}`
                            : TH.creatorUnknown;
                      })()}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-gray-500">{TH.existingTotal}</p>

                    <p className="text-xl font-bold text-gray-900">
                      {formatCurrency(getUpsellOrderTotal(selectedUpsellOrder))}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">รหัสสินค้า</th>

                        <th className="px-4 py-2 text-left">{TH.colProduct}</th>

                        <th className="px-4 py-2 text-right">{TH.colQty}</th>

                        <th className="px-4 py-2 text-right">
                          {TH.colUnitPrice}
                        </th>

                        <th className="px-4 py-2 text-right">
                          {TH.colDiscount}
                        </th>

                        <th className="px-4 py-2 text-right">{TH.colNet}</th>

                        <th className="px-4 py-2 text-right">กล่องที่</th>

                        <th className="px-4 py-2 text-left">ชื่อผู้ขาย</th>
                      </tr>
                    </thead>

                    <tbody>
                      {(selectedUpsellOrder.items || []).map((item) => {
                        const lineTotal = calculateUpsellItemTotal(
                          item as LineItem,
                        );

                        return (
                          <tr key={item.id} className="border-b last:border-0">
                            <td className="px-4 py-2">
                              {(item as any).sku ||
                                (item as any).productSku ||
                                "-"}
                            </td>

                            <td className="px-4 py-2">
                              {item.productName ||
                                `Product ID: ${item.productId}`}

                              {item.productName ||
                                `Product ID: ${item.productId} `}
                            </td>

                            <td className="px-4 py-2 text-right">
                              {item.quantity}
                            </td>

                            <td className="px-4 py-2 text-right">
                              {formatCurrency(Number(item.pricePerUnit ?? 0))}
                            </td>

                            <td className="px-4 py-2 text-right">
                              {formatCurrency(Number(item.discount ?? 0))}
                            </td>

                            <td className="px-4 py-2 text-right font-semibold">
                              {item.isFreebie
                                ? TH.freebie
                                : formatCurrency(lineTotal)}
                            </td>

                            <td className="px-4 py-2 text-right">
                              {item.boxNumber || 1}
                            </td>

                            <td className="px-4 py-2">
                              {(() => {
                                // Use item's creator_id if available, otherwise fallback to order's creatorId

                                const itemCreatorId =
                                  (item as any).creatorId ||
                                  (item as any).creator_id;

                                const creatorId = itemCreatorId
                                  ? Number(itemCreatorId)
                                  : Number(selectedUpsellOrder.creatorId);

                                const creator = upsellUsersById.get(creatorId);

                                return creator
                                  ? `${creator.firstName} ${creator.lastName}`
                                  : "-";

                                return creator
                                  ? `${creator.firstName} ${creator.lastName} `
                                  : "-";
                              })()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {isUpsellTransferPayment && (
                <div className="bg-white rounded-lg shadow-sm border p-6 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">
                        หลักฐานการโอน
                      </h3>
                      <p className="text-sm text-gray-600">
                        อัปโหลดสลิปการโอนสำหรับคำสั่งซื้อเดิม (Transfer)
                      </p>
                    </div>
                    {upsellSlipLoading && (
                      <span className="text-sm text-gray-500">
                        กำลังโหลด...
                      </span>
                    )}
                  </div>
                  {upsellSlipError && (
                    <div className="text-sm text-red-600">
                      {upsellSlipError}
                    </div>
                  )}
                  {upsellSlips.length > 0 ? (
                    <div className="flex flex-wrap gap-4">
                      {upsellSlips.map((slip) => (
                        <div
                          key={slip.id || slip.url}
                          className="flex flex-col gap-2 p-3 border rounded-md bg-slate-50 w-56"
                        >
                          <div className="w-full h-40 bg-white border rounded-md relative">
                            <img
                              src={slip.url}
                              alt="Transfer slip"
                              className="w-full h-full object-contain rounded"
                            />
                            <div className="absolute inset-x-1 bottom-1 bg-black/60 text-white text-[10px] px-1 py-0.5 rounded text-center truncate">
                              {resolveUpsellSlipUploaderName(slip)}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">
                                วันที่โอน
                              </label>
                              <input
                                type="datetime-local"
                                value={slip.transferDate || ""}
                                onChange={(e) => {
                                  const value = e.target.value || "";
                                  setUpsellSlips((prev) =>
                                    prev.map((s) =>
                                      (s.id && slip.id && s.id === slip.id) ||
                                        (!s.id && !slip.id && s.url === slip.url)
                                        ? { ...s, transferDate: value }
                                        : s,
                                    ),
                                  );
                                }}
                                className="w-full border rounded px-2 py-1 text-xs bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">
                                จำนวนเงิน
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={
                                  typeof slip.amount === "number" &&
                                    !Number.isNaN(slip.amount)
                                    ? slip.amount
                                    : ""
                                }
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const nextAmount =
                                    raw === "" ? null : Number(raw);
                                  setUpsellSlips((prev) =>
                                    prev.map((s) =>
                                      (s.id && slip.id && s.id === slip.id) ||
                                        (!s.id && !slip.id && s.url === slip.url)
                                        ? { ...s, amount: nextAmount }
                                        : s,
                                    ),
                                  );
                                }}
                                className="w-full border rounded px-2 py-1 text-xs bg-white"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      ยังไม่มีหลักฐานการโอน
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor={upsellSlipInputId}
                      className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50"
                    >
                      อัปโหลดสลิปเพิ่มเติม
                    </label>
                    <input
                      id={upsellSlipInputId}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleUpsellSlipUpload}
                      disabled={upsellSlipLoading}
                    />
                  </div>
                </div>
              )}

              <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-800">
                    {TH.addTitle}
                  </h2>
                  <button
                    onClick={handleUpsellAddNewItem}
                    className="px-3 py-2 bg-green-600 text-white rounded-md text-sm font-semibold hover:bg-green-700"
                  >
                    + {TH.addButton}
                  </button>
                </div>

                {/* Product Selection Tabs */}

                <div className="mb-4 border-b border-gray-200">
                  <ul className="flex -mb-px text-sm font-medium text-center">
                    <li className="mr-2">
                      <button
                        onClick={() => setUpsellSelectorTab("products")}
                        className={`inline-block py-2 px-4 border-b-2 rounded-t-lg ${upsellSelectorTab === "products"
                          ? "text-blue-600 border-blue-600"
                          : "text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300"
                          }`}
                      >
                        สินค้าปกติ
                      </button>
                    </li>

                    <li className="mr-2">
                      <button
                        onClick={() => setUpsellSelectorTab("promotions")}
                        className={`inline-block py-2 px-4 border-b-2 rounded-t-lg ${upsellSelectorTab === "promotions"
                          ? "text-blue-600 border-blue-600"
                          : "text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300"
                          }`}
                      >
                        โปรโมชั่น/เซ็ตสินค้า
                      </button>
                    </li>
                  </ul>
                </div>

                {upsellItems.length === 0 && (
                  <p className="text-sm text-gray-500">{TH.emptyText}</p>
                )}

                {upsellItems.length > 0 && (
                  <div className="space-y-3">
                    {upsellItems

                      .filter((item) => !item.parentItemId)

                      .map((item) => {
                        const product = products.find(
                          (p) => Number(p.id) === Number(item.productId),
                        );

                        const lineTotal = calculateUpsellItemTotal(item);

                        return (
                          <div
                            key={item.id}
                            className="grid gap-2 items-start p-3 border border-gray-200 rounded-md bg-slate-50"
                            style={{
                              gridTemplateColumns: "repeat(16, minmax(0, 1fr))",
                            }}
                          >
                            <div className="col-span-2">
                              <label className="text-xs text-[#4e7397] mb-1 block">
                                SKU
                              </label>

                              <input
                                type="text"
                                value={product?.sku || ""}
                                placeholder="SKU"
                                readOnly
                                disabled
                                className="w-full p-2 border border-gray-300 rounded-md bg-slate-100 text-[#0e141b] text-sm"
                              />
                            </div>

                            <div className="col-span-3">
                              <label className="text-xs text-[#4e7397] mb-1 block">
                                {TH.name}

                                {selectedUpsellOrder?.paymentMethod ===
                                  PaymentMethod.COD &&
                                  item.boxNumber && (
                                    <span className="ml-2 text-blue-600 font-semibold">
                                      (กล่องที่ {item.boxNumber})
                                    </span>
                                  )}
                              </label>

                              <input
                                type="text"
                                value={item.productName || ""}
                                placeholder="ชื่อสินค้า"
                                onChange={(e) =>
                                  handleUpsellUpdateItem(
                                    item.id,

                                    "productName",

                                    e.target.value,
                                  )
                                }
                                className="w-full p-2 border border-gray-300 rounded-md bg-white text-[#0e141b] text-sm"
                              />
                            </div>

                            <div className="col-span-1 flex items-end h-full">
                              <button
                                type="button"
                                onClick={() => {
                                  setUpsellEditingItemId(item.id);

                                  setUpsellProductSelectorOpen(true);
                                }}
                                className="w-full px-2 py-2 bg-white border rounded text-sm whitespace-nowrap"
                              >
                                {TH.select}
                              </button>
                            </div>

                            <div className="col-span-2">
                              <label className="text-xs text-[#4e7397] mb-1 block">
                                {TH.qty}
                              </label>

                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) =>
                                  handleUpsellUpdateItem(
                                    item.id,

                                    "quantity",

                                    Number(e.target.value),
                                  )
                                }
                                className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm"
                              />
                            </div>

                            <div className="col-span-2">
                              <label className="text-xs text-[#4e7397] mb-1 block">
                                {TH.unitPrice}
                              </label>

                              <input
                                type="number"
                                min={0}
                                value={item.pricePerUnit}
                                readOnly
                                className="w-full p-2 border border-gray-300 rounded-md bg-slate-100 text-sm"
                              />
                            </div>

                            <div className="col-span-2">
                              <label className="text-xs text-[#4e7397] mb-1 block">
                                {TH.discount}
                              </label>

                              <input
                                type="number"
                                min={0}
                                max={
                                  (item.pricePerUnit || 0) *
                                  (item.quantity || 0)
                                }
                                value={item.discount}
                                onChange={(e) =>
                                  handleUpsellUpdateItem(
                                    item.id,

                                    "discount",

                                    Number(e.target.value),
                                  )
                                }
                                className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm"
                              />
                            </div>

                            <div className="col-span-2">
                              <label className="text-xs text-[#4e7397] mb-1 block">
                                {TH.total}
                              </label>

                              <input
                                type="number"
                                min={0}
                                max={
                                  (item.pricePerUnit || 0) *
                                  (item.quantity || 0)
                                }
                                value={lineTotal}
                                onChange={(e) =>
                                  handleUpsellUpdateItem(
                                    item.id,

                                    "line_total" as any,

                                    Number(e.target.value),
                                  )
                                }
                                className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm"
                              />
                            </div>

                            <div className="col-span-1">
                              <label className="text-xs text-[#4e7397] mb-1 block">
                                {TH.box}
                              </label>

                              {selectedUpsellOrder?.paymentMethod ===
                                PaymentMethod.COD ? (
                                <select
                                  value={item.boxNumber || 1}
                                  onChange={(e) =>
                                    handleUpsellUpdateItem(
                                      item.id,

                                      "boxNumber",

                                      Number(e.target.value),
                                    )
                                  }
                                  className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm"
                                >
                                  {Array.from(
                                    { length: numUpsellBoxes },
                                    (_, i) => i + 1,
                                  ).map((n) => (
                                    <option key={n} value={n}>
                                      {n}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="number"
                                  min={1}
                                  value={item.boxNumber || 1}
                                  onChange={(e) =>
                                    handleUpsellUpdateItem(
                                      item.id,

                                      "boxNumber",

                                      Number(e.target.value),
                                    )
                                  }
                                  className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm"
                                />
                              )}
                            </div>

                            <div className="col-span-1 flex flex-col items-center justify-center">
                              <label className="text-xs text-[#4e7397] mb-1">
                                {TH.freebieLabel}
                              </label>

                              <input
                                type="checkbox"
                                checked={item.isFreebie || false}
                                onChange={(e) =>
                                  handleUpsellUpdateItem(
                                    item.id,

                                    "isFreebie",

                                    e.target.checked,
                                  )
                                }
                                className="h-4 w-4"
                              />
                            </div>

                            <div className="col-span-1 flex items-center justify-center">
                              <button
                                onClick={() => handleUpsellRemoveItem(item.id)}
                                className="px-2 py-1 text-red-600 text-sm hover:text-red-700"
                              >
                                {TH.remove}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-2">
                <button
                  type="button"
                  onClick={handleUpsellAddNewItem}
                  className="text-sm text-blue-600 font-medium hover:underline text-left"
                >
                  {TH.addRowLabel}
                </button>
              </div>

              {/* COD Box Section */}

              {selectedUpsellOrder.paymentMethod === PaymentMethod.COD &&
                upsellItems.length > 0 && (
                  <div className="mt-6 p-4 border border-gray-300 rounded-md bg-slate-50">
                    <h4 className="font-semibold text-gray-800 mb-4">
                      รายละเอียดการเก็บเงินปลายทาง (กล่องที่เพิ่มขึ้น)
                    </h4>

                    <div className="p-3 border border-yellow-300 rounded-md bg-yellow-50 text-sm text-gray-800 mb-4">
                      โปรดระบุยอด COD ต่อกล่องให้ผลรวมเท่ากับยอดเพิ่มใหม่:{" "}
                      <strong>{formatCurrency(upsellNewItemsTotal)}</strong>
                      <span className="ml-2">
                        (ยอดรวมปัจจุบัน:{" "}
                        <span
                          className={
                            !isUpsellCodValid
                              ? "text-red-600 font-bold"
                              : "text-green-700 font-bold"
                          }
                        >
                          {formatCurrency(upsellCodTotal)}
                        </span>
                        )
                      </span>
                      <span className="block mt-1">
                        {upsellCodRemaining === 0 ? (
                          <span className="text-green-700 font-medium">
                            ครบถ้วนแล้ว
                          </span>
                        ) : upsellCodRemaining > 0 ? (
                          <span className="text-orange-600 font-medium">
                            คงเหลือ:{" "}
                            {formatCurrency(Math.abs(upsellCodRemaining))}
                          </span>
                        ) : (
                          <span className="text-red-600 font-medium">
                            เกิน: {formatCurrency(Math.abs(upsellCodRemaining))}
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        จำนวนกล่อง (สำหรับสินค้าใหม่)
                      </label>

                      <input
                        type="number"
                        min="1"
                        value={numUpsellBoxes}
                        onChange={(e) => {
                          const newValue = Math.max(1, Number(e.target.value));

                          setNumUpsellBoxes(newValue);

                          setUpsellError(null);
                        }}
                        className="w-32 px-3 py-2 border border-gray-300 rounded-md"
                      />

                      <p className="text-xs text-gray-500 mt-1">
                        จำนวนกล่องที่ต้องการสำหรับสินค้าใหม่
                        (สามารถเพิ่มได้ตามต้องการ)
                      </p>
                    </div>

                    <button
                      onClick={divideUpsellCodEqually}
                      className="text-sm text-blue-600 font-medium hover:underline mb-4"
                    >
                      แบ่งยอดเท่าๆ กัน
                    </button>

                    <div className="space-y-2">
                      {upsellBoxes.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">
                          กรุณาเลือกกล่องให้กับสินค้าก่อน
                          (ระบบจะแสดงกล่องที่เลือกไว้เท่านั้น)
                        </p>
                      ) : (
                        upsellBoxes.map((box, index) => {
                          const maxOriginalBox = getMaxOriginalBoxNumber();

                          const displayBoxNumber =
                            box.boxNumber - maxOriginalBox;

                          return (
                            <div
                              key={index}
                              className="flex items-center gap-4"
                            >
                              <label className="font-medium text-gray-800 w-32">
                                กล่องที่ {displayBoxNumber}:
                              </label>

                              <input
                                type="number"
                                placeholder="ยอด COD"
                                value={box.codAmount}
                                onChange={(e) =>
                                  handleUpsellCodBoxAmountChange(
                                    index,

                                    Number(e.target.value) || 0,
                                  )
                                }
                                className="w-40 px-3 py-2 border border-gray-300 rounded-md"
                                min="0"
                                step="0.01"
                              />

                              {displayBoxNumber === 1 &&
                                maxOriginalBox >= 1 && (
                                  <span className="text-xs text-gray-500 italic">
                                    (สามารถรวมกับกล่องที่ 1 ของต้นทาง หรือใส่ 0
                                    หากไม่รวม)
                                  </span>
                                )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {!isUpsellCodValid && (
                      <p className="text-red-600 text-sm font-medium mt-2">
                        ยอดรวม COD ไม่ถูกต้อง
                      </p>
                    )}
                  </div>
                )}

              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  {TH.addTotal}:{" "}
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(calculateUpsellNewItemsTotal())}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={onCancel}
                    className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
                    disabled={upsellSaving}
                  >
                    {TH.cancel}
                  </button>

                  <button
                    onClick={handleUpsellSave}
                    disabled={upsellSaving}
                    className="px-5 py-2 rounded-md bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-60"
                  >
                    {upsellSaving ? TH.saving : TH.save}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Upsell Success Modal */}

          {showUpsellSuccessModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
              <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>

                <h3 className="text-lg font-semibold text-[#0e141b]">
                  สร้างคำสั่งซื้อเพิ่มเติมสำเร็จ
                </h3>

                {selectedUpsellOrder && (
                  <p className="mt-1 text-sm text-[#4e7397]">
                    หมายเลขคำสั่งซื้อ {selectedUpsellOrder.id}
                  </p>
                )}

                <p className="mt-4 text-sm text-[#4e7397]">
                  สามารถกลับไปยังหน้าหลักเพื่อดำเนินงานต่อได้ทันที
                </p>

                <div className="mt-6 flex justify-center">
                  <button
                    onClick={() => {
                      setShowUpsellSuccessModal(false);

                      if (onUpsellSuccess) {
                        onUpsellSuccess();
                      } else {
                        onCancel();
                      }
                    }}
                    className="inline-flex items-center rounded-lg bg-green-600 px-5 py-2.5 font-semibold text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                  >
                    กลับสู่หน้าหลัก
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Upsell Product Selector Modal */}

          {upsellProductSelectorOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
              <div className="bg-white rounded-lg w-full max-w-[1200px] p-4 shadow-xl max-h-[85vh] overflow-hidden flex flex-col">
                <div className="flex gap-4 h-[70vh]">
                  <div className="w-64 border-r pr-4 overflow-auto">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-semibold">ประเภท</h3>

                      <button
                        onClick={() => {
                          setUpsellProductSelectorOpen(false);

                          setUpsellEditingItemId(null);
                        }}
                        className="px-2 py-1 border rounded"
                      >
                        ปิด
                      </button>
                    </div>

                    <ul className="space-y-2 text-sm">
                      {upsellSelectorTab === "products" && (
                        <li
                          className={`p-2 rounded ${!leftFilter ? "bg-slate-100" : ""} cursor-pointer`}
                          onClick={() => {
                            setLeftFilter(null);

                            setUpsellSelectorSearchTerm("");
                          }}
                        >
                          ทั้งหมด
                        </li>
                      )}

                      {upsellSelectorTab === "promotions" && (
                        <>
                          <li
                            className={`p-2 rounded ${leftFilter === -1 ? "bg-slate-100" : ""} cursor-pointer`}
                            onClick={() => {
                              setLeftFilter(-1);

                              setUpsellSelectorSearchTerm("");
                            }}
                          >
                            รายการโปรโมชั่น
                          </li>

                          {promotionsSafe.map((p) => (
                            <li
                              key={p.id}
                              className={`p-2 rounded ${leftFilter === p.id ? "bg-slate-100" : ""} cursor-pointer`}
                              onClick={() => {
                                setLeftFilter(p.id);

                                setUpsellSelectorSearchTerm("");
                              }}
                            >
                              {p.name}
                            </li>
                          ))}
                        </>
                      )}
                    </ul>
                  </div>

                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="mb-3">
                      <input
                        type="text"
                        placeholder={`ค้นหา ${upsellSelectorTab === "products" ? "SKU, ชื่อสินค้า" : "ชื่อโปรโมชั่น"}`}
                        value={upsellSelectorSearchTerm}
                        onChange={(e) =>
                          setUpsellSelectorSearchTerm(e.target.value)
                        }
                        className="w-full p-2 border rounded"
                      />
                    </div>

                    <div className="flex-1 overflow-auto">
                      {upsellSelectorTab === "products" && (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-[#4e7397] border-b">
                              <th className="p-2">SKU</th>

                              <th className="p-2">สินค้า</th>

                              <th className="p-2">ราคาขาย</th>

                              <th className="p-2">เลือก</th>
                            </tr>
                          </thead>

                          <tbody>
                            {products

                              .filter(
                                (pr) =>
                                  !upsellSelectorSearchTerm ||
                                  `${pr.sku} ${pr.name}`

                                    .toLowerCase()

                                    .includes(
                                      upsellSelectorSearchTerm.toLowerCase(),
                                    ),
                              )

                              .map((p) => (
                                <tr key={p.id} className="border-b">
                                  <td className="p-2 align-top">{p.sku}</td>

                                  <td className="p-2 align-top">{p.name}</td>

                                  <td className="p-2 align-top">
                                    {p.price.toFixed(2)}
                                  </td>

                                  <td className="p-2 align-top">
                                    <button
                                      onClick={() =>
                                        handleUpsellAddProductById(p.id)
                                      }
                                      className="text-blue-600"
                                    >
                                      เลือก
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      )}

                      {upsellSelectorTab === "promotions" && (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-[#4e7397] border-b">
                              <th className="p-2">ชื่อโปรโมชั่น</th>

                              <th className="p-2">เลือก</th>
                            </tr>
                          </thead>

                          <tbody>
                            {promotionsSafe

                              .filter(
                                (pr) =>
                                  !upsellSelectorSearchTerm ||
                                  pr.name

                                    .toLowerCase()

                                    .includes(
                                      upsellSelectorSearchTerm.toLowerCase(),
                                    ),
                              )

                              .map((p) => (
                                <tr key={p.id} className="border-b">
                                  <td className="p-2 align-top">{p.name}</td>

                                  <td className="p-2 align-top">
                                    <button
                                      onClick={() =>
                                        handleUpsellAddPromotionById(p.id)
                                      }
                                      className="text-blue-600"
                                    >
                                      เลือก
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isUpsellMode) {
    return renderUpsellView();
  }

  const commonInputClass =
    "w-full p-2.5 border border-gray-300 rounded-md bg-white text-[#0e141b] focus:ring-1 focus:ring-blue-500 focus:border-blue-500";

  const commonLabelClass = "block text-sm font-medium text-[#0e141b] mb-1.5";

  const onFocusSelectAll = (
    e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const el = e.target as HTMLInputElement;

    if (typeof el.select === "function") el.select();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}

      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="w-full mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#0e141b]">
              สร้างคำสั่งซื้อ
            </h1>

            <p className="text-[#4e7397]">
              กรอกข้อมูลลูกค้า สินค้า และการชำระเงินในหน้าเดียว
            </p>
          </div>

          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
          >
            ยกเลิก
          </button>
        </div>
      </div>

      {/* Main Content */}

      <div className="w-full mx-auto p-4 flex flex-col lg:flex-row gap-4">
        <div className="flex-1 space-y-4 min-w-0">
          {/* Left Column: Customer Information & Shipping Address */}

          <div className="space-y-4">
            {/* Section 1: Customer Information */}

            {
              <div className="bg-white rounded-lg border border-gray-300 p-6">
                <h2 className="text-lg font-semibold text-[#0e141b] mb-4 pb-3 border-b">
                  ข้อมูลลูกค้า
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className={commonLabelClass}>
                      ค้นหาลูกค้า (ชื่อ / เบอร์โทร)
                    </label>

                    <input
                      type="text"
                      ref={customerSearchInputRef}
                      value={searchTerm}
                      onChange={(e) => {
                        clearValidationErrorFor("customerSelector");

                        setSearchTerm(e.target.value);

                        setSelectedCustomer(null);

                        setIsCreatingNewCustomer(false);
                      }}
                      placeholder="พิมพ์เพื่อค้นหา..."
                      className={commonInputClass}
                      disabled={loadingCustomerData}
                    />

                    {loadingCustomerData && (
                      <div className="mt-2 text-sm text-blue-600 flex items-center">
                        <svg
                          className="animate-spin h-4 w-4 mr-2"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />

                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        กำลังโหลดข้อมูลลูกค้า...
                      </div>
                    )}

                    {searchResults.length > 0 &&
                      !selectedCustomer &&
                      !loadingCustomerData && (
                        <ul className="mt-2 border border-gray-300 rounded-md bg-white max-h-48 overflow-auto">
                          {searchResults.map((c) => (
                            <li
                              key={
                                c.id ||
                                c.customerId ||
                                c.customerRefId ||
                                `${c.phone}-${c.firstName}-${c.lastName}`
                              }
                              onClick={() => handleSelectCustomer(c)}
                              className="p-2 hover:bg-slate-50 cursor-pointer text-[#0e141b] border-b last:border-b-0"
                            >
                              {`${c.firstName} ${c.lastName}`} - {c.phone}
                            </li>
                          ))}
                        </ul>
                      )}

                    {!selectedCustomer &&
                      searchTerm &&
                      searchResults.length === 0 &&
                      !isCreatingNewCustomer && (
                        <button
                          onClick={() => {
                            startCreatingNewCustomer();
                          }}
                          className="mt-2 text-sm text-blue-600 font-medium hover:underline"
                        >
                          ไม่พบลูกค้านี้ในระบบ? สร้างรายชื่อใหม่
                        </button>
                      )}
                  </div>

                  {(selectedCustomer || isCreatingNewCustomer) && (
                    <>
                      <div className="p-4 border border-gray-300 rounded-md bg-slate-50">
                        {isCreatingNewCustomer ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className={commonLabelClass}>
                                ชื่อ <span className="text-red-500">*</span>
                              </label>

                              <input
                                type="text"
                                ref={newCustomerFirstNameRef}
                                value={newCustomerFirstName}
                                onChange={(e) => {
                                  clearValidationErrorFor(
                                    "newCustomerFirstName",
                                  );

                                  setNewCustomerFirstName(e.target.value);
                                }}
                                className={commonInputClass}
                              />
                            </div>

                            <div>
                              <label className={commonLabelClass}>
                                นามสกุล
                              </label>

                              <input
                                type="text"
                                value={newCustomerLastName}
                                onChange={(e) =>
                                  setNewCustomerLastName(e.target.value)
                                }
                                className={commonInputClass}
                              />
                            </div>

                            <div className="col-span-2 grid md:grid-cols-2 gap-4">
                              <div>
                                <label className={commonLabelClass}>
                                  เบอร์โทรศัพท์{" "}
                                  <span className="text-red-500">*</span>
                                </label>

                                <input
                                  type="text"
                                  ref={newCustomerPhoneRef}
                                  value={newCustomerPhone}
                                  onChange={handleNewCustomerPhoneChange}
                                  className={commonInputClass}
                                />

                                {newCustomerPhoneError && (
                                  <p className="text-xs text-red-500 mt-1">
                                    {newCustomerPhoneError}
                                  </p>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className={commonLabelClass}>
                                    เบอร์สำรอง
                                  </label>
                                  <input
                                    type="text"
                                    value={newCustomerBackupPhone}
                                    onChange={
                                      handleNewCustomerBackupPhoneChange
                                    }
                                    className={commonInputClass}
                                    placeholder="เช่น 0XXXXXXXXX"
                                  />
                                </div>
                                <div>
                                  <label className={commonLabelClass}>
                                    สถานะลูกค้า{" "}
                                    <span className="text-red-500">*</span>
                                  </label>
                                  <select
                                    ref={customerStatusRef}
                                    value={customerStatus}
                                    onChange={(e) =>
                                      setCustomerStatus(e.target.value)
                                    }
                                    className={commonInputClass}
                                  >
                                    <option value="">กรุณาเลือก</option>
                                    <option value="New Customer">
                                      ลูกค้าใหม่
                                    </option>
                                    <option value="Reorder Customer">
                                      ลูกค้ารีออเดอร์
                                    </option>
                                  </select>
                                </div>
                              </div>

                              {newCustomerBackupPhoneError && (
                                <p className="text-xs text-red-500 mt-1">
                                  {newCustomerBackupPhoneError}
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className={commonLabelClass}>
                                ชื่อ <span className="text-red-500">*</span>
                              </label>

                              <input
                                type="text"
                                value={editedCustomerFirstName}
                                onChange={(e) =>
                                  setEditedCustomerFirstName(e.target.value)
                                }
                                className={commonInputClass}
                                placeholder="กรุณากรอกชื่อ"
                              />
                            </div>

                            <div>
                              <label className={commonLabelClass}>
                                นามสกุล
                              </label>

                              <input
                                type="text"
                                value={editedCustomerLastName}
                                onChange={(e) =>
                                  setEditedCustomerLastName(e.target.value)
                                }
                                className={commonInputClass}
                                placeholder="กรุณากรอกนามสกุล"
                              />
                            </div>

                            <div className="col-span-2 grid md:grid-cols-2 gap-4">
                              <div>
                                <label className={commonLabelClass}>
                                  เบอร์โทรศัพท์{" "}
                                  <span className="text-red-500">*</span>
                                </label>

                                <input
                                  type="text"
                                  value={editedCustomerPhone}
                                  onChange={handleEditedCustomerPhoneChange}
                                  className={commonInputClass}
                                  placeholder="กรุณากรอกเบอร์โทรศัพท์"
                                />

                                {editedCustomerPhoneError && (
                                  <p className="text-xs text-red-500 mt-1">
                                    {editedCustomerPhoneError}
                                  </p>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className={commonLabelClass}>
                                    เบอร์สำรอง
                                  </label>
                                  <input
                                    type="text"
                                    value={editedCustomerBackupPhone}
                                    onChange={
                                      handleEditedCustomerBackupPhoneChange
                                    }
                                    className={commonInputClass}
                                    placeholder="เช่น 0XXXXXXXXX"
                                  />
                                </div>
                                <div>
                                  <label className={commonLabelClass}>
                                    สถานะลูกค้า{" "}
                                    <span className="text-red-500">*</span>
                                  </label>
                                  <select
                                    ref={customerStatusRef}
                                    value={customerStatus}
                                    onChange={(e) =>
                                      setCustomerStatus(e.target.value)
                                    }
                                    className={commonInputClass}
                                  >
                                    <option value="">กรุณาเลือก</option>
                                    <option value="New Customer">
                                      ลูกค้าใหม่
                                    </option>
                                    <option value="Reorder Customer">
                                      ลูกค้ารีออเดอร์
                                    </option>
                                  </select>
                                </div>
                              </div>

                              {editedCustomerBackupPhoneError && (
                                <p className="text-xs text-red-500 mt-1">
                                  {editedCustomerBackupPhoneError}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={commonLabelClass}>
                            ชื่อใน Facebook
                          </label>

                          <input
                            type="text"
                            value={facebookName}
                            onChange={(e) => setFacebookName(e.target.value)}
                            className={commonInputClass}
                          />
                        </div>

                        <div>
                          <label className={commonLabelClass}>LINE ID</label>

                          <input
                            type="text"
                            value={lineId}
                            onChange={(e) => setLineId(e.target.value)}
                            className={commonInputClass}
                          />
                        </div>
                      </div>

                      <div>
                        <label className={commonLabelClass}>
                          ช่องทางการขาย <span className="text-red-500">*</span>
                        </label>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <select
                            ref={salesChannelRef}
                            value={salesChannel}
                            onChange={(e) => {
                              clearValidationErrorFor("salesChannel");

                              const channel = e.target.value;

                              setSalesChannel(channel);

                              // Check if selected platform requires a page selection (e.g., not phone call)

                              const selectedPlatform = platforms.find(
                                (p) => p.name === channel,
                              );

                              if (
                                !selectedPlatform ||
                                selectedPlatform.name === "โทร"
                              ) {
                                setSalesChannelPageId(null);

                                clearValidationErrorFor("salesChannelPage");
                              }
                            }}
                            className={commonInputClass}
                          >
                            <option value="">เลือกช่องทางการขาย</option>

                            {platforms

                              .filter((p) => p.active)

                              .sort(
                                (a, b) =>
                                  (a.sortOrder || 0) - (b.sortOrder || 0),
                              )

                              .map((platform) => (
                                <option key={platform.id} value={platform.name}>
                                  {platform.displayName || platform.name}
                                </option>
                              ))}
                          </select>

                          {(() => {
                            if (!salesChannel) return false;

                            const selectedPlatform = platforms.find(
                              (p) => p.name === salesChannel,
                            );

                            // Show page dropdown if:

                            // 1. Platform is not "โทร" AND has showPagesFrom set

                            // 2. OR platform doesn't have showPagesFrom (uses its own pages)

                            const hasShowPagesFrom =
                              selectedPlatform?.showPagesFrom &&
                              selectedPlatform.showPagesFrom.trim() !== "";

                            return (
                              selectedPlatform &&
                              selectedPlatform.name !== "โทร" &&
                              (hasShowPagesFrom ||
                                !selectedPlatform.showPagesFrom)
                            );
                          })() && (
                              <select
                                ref={salesChannelPageRef}
                                value={salesChannelPageId ?? ""}
                                onChange={(e) => {
                                  clearValidationErrorFor("salesChannelPage");

                                  setSalesChannelPageId(
                                    e.target.value
                                      ? Number(e.target.value)
                                      : null,
                                  );
                                }}
                                className={commonInputClass}
                              >
                                <option value="">เลือกเพจ</option>

                                {(() => {
                                  // Filter pages by selected platform (dynamic, no hardcode)

                                  // If platform has show_pages_from, use that instead of the platform name

                                  if (!salesChannel) return [];

                                  const selectedPlatform = platforms.find(
                                    (p) => p.name === salesChannel,
                                  );

                                  if (!selectedPlatform) {
                                    console.log(
                                      "🔍 Platform not found:",

                                      salesChannel,
                                    );

                                    return [];
                                  }

                                  // Determine which platform name to use for filtering pages

                                  // If showPagesFrom is set and not empty, use it; otherwise use the platform's own name

                                  const hasShowPagesFrom =
                                    selectedPlatform.showPagesFrom &&
                                    typeof selectedPlatform.showPagesFrom ===
                                    "string" &&
                                    selectedPlatform.showPagesFrom.trim() !== "";

                                  // Only return empty if showPagesFrom is explicitly set to empty string

                                  // If showPagesFrom is null or undefined, use the platform's own name

                                  if (selectedPlatform.showPagesFrom === "") {
                                    console.log(
                                      "🔍 Platform has showPagesFrom set to empty string:",

                                      selectedPlatform,
                                    );

                                    return [];
                                  }

                                  const platformToFilter = hasShowPagesFrom
                                    ? selectedPlatform.showPagesFrom
                                    : salesChannel;

                                  console.log("🔍 Filtering pages:", {
                                    salesChannel,

                                    showPagesFrom: selectedPlatform.showPagesFrom,

                                    platformToFilter,

                                    totalPages: pages.length,

                                    pages: pages.map((p: any) => ({
                                      name: p.name,

                                      platform: p.platform,

                                      active: p.active,
                                    })),
                                  });

                                  const filteredPages = pages.filter((pg) => {
                                    const pagePlatform = (pg as any).platform;

                                    if (!pagePlatform) return false;

                                    // Case-insensitive comparison: compare page platform with platformToFilter

                                    const isPlatformMatch =
                                      pagePlatform.toLowerCase() ===
                                      platformToFilter.toLowerCase();

                                    // Treat active as boolean-like (supports 1/0, '1'/'0', 'true'/'false')

                                    const v: any = (pg as any).active;

                                    const isActive =
                                      typeof v === "boolean"
                                        ? v
                                        : typeof v === "number"
                                          ? v !== 0
                                          : typeof v === "string"
                                            ? v.trim() !== "" &&
                                            v !== "0" &&
                                            v.toLowerCase() !== "false"
                                            : Boolean(v);

                                    return isPlatformMatch && isActive;
                                  });

                                  console.log("🔍 Filtered pages result:", {
                                    count: filteredPages.length,

                                    pages: filteredPages.map((p: any) => p.name),
                                  });

                                  return filteredPages
                                    .sort((a, b) =>
                                      a.name.localeCompare(b.name, "th"),
                                    )
                                    .map((pg) => (
                                      <option key={pg.id} value={pg.id}>
                                        {pg.name}
                                      </option>
                                    ));
                                })()}
                              </select>
                            )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            }

            {/* Section 2: Shipping Address */}

            {(selectedCustomer || isCreatingNewCustomer) && (
              <div
                ref={shippingAddressSectionRef}
                className="bg-white rounded-lg border border-gray-300 p-6"
              >
                <h2 className="text-lg font-semibold text-[#0e141b] mb-4 pb-3 border-b">
                  ที่อยู่จัดส่ง
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className={commonLabelClass}>ที่อยู่จัดส่ง</label>

                    {/* Profile Address Option */}

                    <div className="mb-3">
                      <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="addressOption"
                          value="profile"
                          checked={selectedAddressOption === "profile"}
                          onChange={(e) =>
                            handleAddressOptionChange(e.target.value)
                          }
                          disabled={isCreatingNewCustomer}
                          className="mr-3"
                        />

                        <div className="flex-1">
                          <div className="flex items-center">
                            <div className="font-medium">
                              ที่อยู่เดียวกับข้อมูลลูกค้า
                            </div>

                            <div className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full flex items-center">
                              <svg
                                className="w-3 h-3 mr-1"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                              ที่อยู่หลัก
                            </div>
                          </div>

                          {(selectedCustomer?.address?.recipientFirstName ||
                            selectedCustomer?.address?.recipientLastName) && (
                              <div className="text-xs text-gray-500">
                                ชื่อผู้รับ:{" "}
                                {`${selectedCustomer.address.recipientFirstName || ""} ${selectedCustomer.address.recipientLastName || ""}`.trim()}
                              </div>
                            )}

                          {selectedCustomer?.address && (
                            <div className="text-sm text-gray-600 mt-1">
                              {selectedCustomer.address.street || ""}{" "}
                              {selectedCustomer.address.subdistrict || ""}{" "}
                              {selectedCustomer.address.district || ""}{" "}
                              {selectedCustomer.address.province || ""}{" "}
                              {selectedCustomer.address.postalCode || ""}
                            </div>
                          )}
                        </div>
                      </label>
                    </div>

                    {/* Customer Addresses */}

                    {addressOptions.length > 0 ? (
                      addressOptions.map((address) => (
                        <div key={address.id} className="mb-3">
                          <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                            <input
                              type="radio"
                              name="addressOption"
                              value={address.id}
                              checked={
                                selectedAddressOption === address.id.toString()
                              }
                              onChange={(e) =>
                                handleAddressOptionChange(e.target.value)
                              }
                              disabled={isCreatingNewCustomer}
                              className="mr-3"
                            />

                            <div className="flex-1">
                              <div className="flex items-center">
                                <div className="text-sm flex-1">
                                  {address.address} {address.sub_district}{" "}
                                  {address.district} {address.province}{" "}
                                  {address.zip_code}
                                </div>
                              </div>

                              {(address.recipient_first_name ||
                                address.recipient_last_name) && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    ชื่อผู้รับ:{" "}
                                    {`${address.recipient_first_name || ""} ${address.recipient_last_name || ""}`.trim()}
                                  </div>
                                )}
                            </div>

                            <div className="flex items-center space-x-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();

                                  e.stopPropagation();

                                  handleSetPrimaryAddress(address.id);
                                }}
                                disabled={isCreatingNewCustomer}
                                className="px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium"
                                title="ตั้งค่าเป็นที่อยู่หลัก"
                              >
                                ตั้งเป็นที่อยู่หลัก
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();

                                  e.stopPropagation();

                                  handleDeleteAddress(address.id);
                                }}
                                disabled={isCreatingNewCustomer}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="ลบที่อยู่"
                              >
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </div>
                          </label>
                        </div>
                      ))
                    ) : (
                      <div className="mb-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
                        <div className="text-sm text-gray-500 text-center">
                          ไม่มีที่อยู่เพิ่มเติม
                        </div>
                      </div>
                    )}

                    {/* New Address Option */}

                    <div className="mb-3">
                      <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="addressOption"
                          value="new"
                          checked={selectedAddressOption === "new"}
                          onChange={(e) =>
                            handleAddressOptionChange(e.target.value)
                          }
                          disabled={isCreatingNewCustomer}
                          className="mr-3"
                        />

                        <div className="flex-1">
                          <div className="font-medium text-blue-600">
                            + เพิ่มที่อยู่ใหม่
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className={commonLabelClass}>
                          ชื่อ (ผู้รับ) <span className="text-red-500">*</span>
                        </label>

                        <input
                          type="text"
                          name="recipientFirstName"
                          value={shippingAddress.recipientFirstName || ""}
                          onChange={handleShippingAddressChange}
                          className={commonInputClass}
                          placeholder="กรุณากรอกชื่อผู้รับ"
                        />
                      </div>

                      <div>
                        <label className={commonLabelClass}>
                          นามสกุล (ผู้รับ)
                        </label>

                        <input
                          type="text"
                          name="recipientLastName"
                          value={shippingAddress.recipientLastName || ""}
                          onChange={handleShippingAddressChange}
                          className={commonInputClass}
                          placeholder="กรุณากรอกนามสกุลผู้รับ"
                        />
                      </div>
                    </div>

                    <div>
                      <label className={commonLabelClass}>
                        บ้านเลขที่, ถนน <span className="text-red-500">*</span>
                      </label>

                      <input
                        type="text"
                        name="street"
                        value={shippingAddress.street}
                        onChange={handleShippingAddressChange}
                        className={commonInputClass}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="relative province-dropdown-container">
                        <label className={commonLabelClass}>
                          จังหวัด <span className="text-red-500">*</span>
                        </label>

                        <input
                          type="text"
                          value={
                            selectedProvince && !provinceSearchTerm
                              ? provinces.find((p) => p.id === selectedProvince)
                                ?.name_th || ""
                              : provinceSearchTerm
                          }
                          onChange={(e) => {
                            const newValue = e.target.value;

                            setProvinceSearchTerm(newValue);

                            setShowProvinceDropdown(true);

                            // If postal code is entered, clear results when editing province manually

                            if (postalCodeResults.length > 0) {
                              setPostalCodeResults([]);

                              setShowPostalCodeDropdown(false);

                              setShippingAddress((prev) => ({
                                ...prev,

                                postalCode: "",
                              }));
                            }

                            // If user is typing/deleting, clear selectedProvince to allow editing

                            if (selectedProvince) {
                              const currentProvinceName =
                                provinces.find((p) => p.id === selectedProvince)
                                  ?.name_th || "";

                              // If the typed value doesn't match the selected province, clear selection

                              if (newValue !== currentProvinceName) {
                                setSelectedProvince(null);

                                setSelectedGeography(null);

                                setSelectedDistrict(null);

                                setSelectedSubDistrict(null);

                                setShippingAddress((prev) => ({
                                  ...prev,

                                  province: "",

                                  district: "",

                                  subdistrict: "",
                                }));
                              }
                            }
                          }}
                          onFocus={() => setShowProvinceDropdown(true)}
                          onKeyDown={(e) => {
                            // Allow backspace and delete to clear selection

                            if (
                              (e.key === "Backspace" || e.key === "Delete") &&
                              selectedProvince
                            ) {
                              const currentProvinceName =
                                provinces.find((p) => p.id === selectedProvince)
                                  ?.name_th || "";

                              const input = e.target as HTMLInputElement;

                              // If cursor is at the end or all text is selected, allow clearing

                              if (
                                input.selectionStart ===
                                currentProvinceName.length ||
                                input.selectionEnd - input.selectionStart ===
                                currentProvinceName.length
                              ) {
                                setSelectedProvince(null);

                                setSelectedGeography(null);

                                setSelectedDistrict(null);

                                setSelectedSubDistrict(null);

                                setProvinceSearchTerm("");

                                setShippingAddress((prev) => ({
                                  ...prev,

                                  province: "",

                                  district: "",

                                  subdistrict: "",

                                  postalCode: "",
                                }));
                              }
                            }
                          }}
                          disabled={addressLoading}
                          className={
                            commonInputClass +
                            (addressLoading ? " bg-slate-100" : "")
                          }
                          placeholder="ค้นหาหรือเลือกจังหวัด"
                        />

                        {showProvinceDropdown && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                            {postalCodeResults.length > 0 &&
                              filteredProvinces.length === 0 &&
                              provinces.length > 0 ? (
                              <div className="px-3 py-2 text-yellow-600 text-sm bg-yellow-50">
                                ⚠️ กรุณาเลือกรหัสไปรษณีย์ก่อน
                                หรือไม่มีจังหวัดที่ตรงกับรหัสไปรษณีย์{" "}
                                {shippingAddress.postalCode}
                              </div>
                            ) : filteredProvinces.length > 0 ? (
                              filteredProvinces.map((province) => (
                                <div
                                  key={province.id}
                                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                                  onClick={() => {
                                    // If postal code is entered, clear it when changing province

                                    if (postalCodeResults.length > 0) {
                                      setPostalCodeResults([]);

                                      setShippingAddress((prev) => ({
                                        ...prev,

                                        postalCode: "",
                                      }));
                                    }

                                    setSelectedProvince(province.id);

                                    setProvinceSearchTerm(province.name_th);

                                    setShowProvinceDropdown(false);

                                    setSelectedDistrict(null);

                                    setSelectedSubDistrict(null);

                                    setShippingAddress((prev) => ({
                                      ...prev,

                                      district: "",

                                      subdistrict: "",
                                    }));
                                  }}
                                >
                                  {province.name_th}
                                </div>
                              ))
                            ) : (
                              <div className="px-3 py-2 text-gray-500">
                                ไม่พบจังหวัดที่ค้นหา
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="relative district-dropdown-container">
                        <label className={commonLabelClass}>
                          อำเภอ/เขต <span className="text-red-500">*</span>
                        </label>

                        <input
                          type="text"
                          value={
                            selectedDistrict && !districtSearchTerm
                              ? districts.find((d) => d.id === selectedDistrict)
                                ?.name_th || ""
                              : districtSearchTerm
                          }
                          onChange={(e) => {
                            const newValue = e.target.value;

                            setDistrictSearchTerm(newValue);

                            setShowDistrictDropdown(true);

                            // If postal code is entered, clear results when editing district manually

                            if (postalCodeResults.length > 0) {
                              setPostalCodeResults([]);

                              setShowPostalCodeDropdown(false);

                              setShippingAddress((prev) => ({
                                ...prev,

                                postalCode: "",
                              }));
                            }

                            // If user is typing/deleting, clear selectedDistrict to allow editing

                            if (selectedDistrict) {
                              const currentDistrictName =
                                districts.find((d) => d.id === selectedDistrict)
                                  ?.name_th || "";

                              // If the typed value doesn't match the selected district, clear selection

                              if (newValue !== currentDistrictName) {
                                setSelectedDistrict(null);

                                setSelectedSubDistrict(null);

                                setShippingAddress((prev) => ({
                                  ...prev,

                                  district: "",

                                  subdistrict: "",
                                }));
                              }
                            }
                          }}
                          onFocus={() => setShowDistrictDropdown(true)}
                          onKeyDown={(e) => {
                            // Allow backspace and delete to clear selection

                            if (
                              (e.key === "Backspace" || e.key === "Delete") &&
                              selectedDistrict
                            ) {
                              const currentDistrictName =
                                districts.find((d) => d.id === selectedDistrict)
                                  ?.name_th || "";

                              const input = e.target as HTMLInputElement;

                              // If cursor is at the end or all text is selected, allow clearing

                              if (
                                input.selectionStart ===
                                currentDistrictName.length ||
                                input.selectionEnd - input.selectionStart ===
                                currentDistrictName.length
                              ) {
                                setSelectedDistrict(null);

                                setSelectedSubDistrict(null);

                                setDistrictSearchTerm("");

                                setShippingAddress((prev) => ({
                                  ...prev,

                                  district: "",

                                  subdistrict: "",

                                  postalCode: "",
                                }));
                              }
                            }
                          }}
                          disabled={!selectedProvince || addressLoading}
                          className={
                            commonInputClass +
                            (!selectedProvince || addressLoading
                              ? " bg-slate-100"
                              : "")
                          }
                          placeholder="ค้นหาหรือเลือกอำเภอ/เขต"
                        />

                        {showDistrictDropdown && selectedProvince && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                            {filteredDistricts.length > 0 ? (
                              filteredDistricts.map((district) => (
                                <div
                                  key={district.id}
                                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                                  onClick={() => {
                                    setSelectedDistrict(district.id);

                                    setDistrictSearchTerm("");

                                    setShowDistrictDropdown(false);

                                    setSelectedSubDistrict(null);
                                  }}
                                >
                                  {district.name_th}
                                </div>
                              ))
                            ) : (
                              <div className="px-3 py-2 text-gray-500">
                                ไม่พบอำเภอ/เขตที่ค้นหา
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="relative subdistrict-dropdown-container">
                        <label className={commonLabelClass}>
                          ตำบล/แขวง <span className="text-red-500">*</span>
                        </label>

                        <input
                          type="text"
                          value={
                            selectedSubDistrict && !subDistrictSearchTerm
                              ? subDistricts.find(
                                (sd) => sd.id === selectedSubDistrict,
                              )?.name_th || ""
                              : subDistrictSearchTerm
                          }
                          onChange={(e) => {
                            const newValue = e.target.value;

                            setSubDistrictSearchTerm(newValue);

                            setShowSubDistrictDropdown(true);

                            // If user is typing/deleting, clear selectedSubDistrict to allow editing

                            if (selectedSubDistrict) {
                              const currentSubDistrictName =
                                subDistricts.find(
                                  (sd) => sd.id === selectedSubDistrict,
                                )?.name_th || "";

                              // If the typed value doesn't match the selected subdistrict, clear selection

                              if (newValue !== currentSubDistrictName) {
                                setSelectedSubDistrict(null);

                                setShippingAddress((prev) => ({
                                  ...prev,

                                  subdistrict: "",

                                  postalCode: "",
                                }));
                              }
                            }
                          }}
                          onFocus={() => setShowSubDistrictDropdown(true)}
                          onKeyDown={(e) => {
                            // Allow backspace and delete to clear selection

                            if (
                              (e.key === "Backspace" || e.key === "Delete") &&
                              selectedSubDistrict
                            ) {
                              const currentSubDistrictName =
                                subDistricts.find(
                                  (sd) => sd.id === selectedSubDistrict,
                                )?.name_th || "";

                              const input = e.target as HTMLInputElement;

                              // If cursor is at the end or all text is selected, allow clearing

                              if (
                                input.selectionStart ===
                                currentSubDistrictName.length ||
                                input.selectionEnd - input.selectionStart ===
                                currentSubDistrictName.length
                              ) {
                                setSelectedSubDistrict(null);

                                setSubDistrictSearchTerm("");

                                setShippingAddress((prev) => ({
                                  ...prev,

                                  subdistrict: "",

                                  postalCode: "",
                                }));
                              }
                            }
                          }}
                          disabled={!selectedDistrict || addressLoading}
                          className={
                            commonInputClass +
                            (!selectedDistrict || addressLoading
                              ? " bg-slate-100"
                              : "")
                          }
                          placeholder="ค้นหาหรือเลือกตำบล/แขวง"
                        />

                        {showSubDistrictDropdown && selectedDistrict && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                            {filteredSubDistricts.length > 0 ? (
                              filteredSubDistricts.map((subDistrict) => (
                                <div
                                  key={subDistrict.id}
                                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                                  onClick={() => {
                                    console.log(
                                      "🖱️ Subdistrict clicked:",

                                      subDistrict.name_th,

                                      "ID:",

                                      subDistrict.id,

                                      "ZIP:",

                                      subDistrict.zip_code,
                                    );

                                    setSelectedSubDistrict(subDistrict.id);

                                    setSubDistrictSearchTerm("");

                                    setShowSubDistrictDropdown(false);
                                  }}
                                >
                                  {subDistrict.name_th} ({subDistrict.zip_code})
                                </div>
                              ))
                            ) : (
                              <div className="px-3 py-2 text-gray-500">
                                ไม่พบตำบล/แขวงที่ค้นหา
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="relative postal-code-dropdown-container">
                        <label className={commonLabelClass}>
                          รหัสไปรษณีย์ <span className="text-red-500">*</span>
                        </label>

                        <input
                          ref={postalCodeInputRef}
                          type="text"
                          name="postalCode"
                          value={shippingAddress.postalCode}
                          onChange={handleShippingAddressChange}
                          onFocus={() => {
                            if (postalCodeResults.length > 0) {
                              setShowPostalCodeDropdown(true);
                            }
                          }}
                          disabled={addressLoading}
                          maxLength={5}
                          className={
                            commonInputClass +
                            (addressLoading ? " bg-slate-100" : "")
                          }
                          placeholder="กรอกรหัสไปรษณีย์เพื่อค้นหาที่อยู่ (5 หลัก)"
                        />

                        {showPostalCodeDropdown &&
                          postalCodeResults.length > 0 && (
                            <div
                              className="absolute z-[100] w-full mt-1 bg-white border-2 border-blue-500 rounded-md shadow-xl max-h-60 overflow-auto"
                              style={{ top: "100%", left: 0 }}
                            >
                              <div className="px-3 py-2 bg-blue-50 border-b border-blue-200 text-xs font-medium text-blue-700 sticky top-0">
                                พบ {postalCodeResults.length}{" "}
                                ที่อยู่สำหรับรหัสไปรษณีย์{" "}
                                {shippingAddress.postalCode}
                              </div>

                              {postalCodeResults.map((result, index) => (
                                <div
                                  key={index}
                                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                                  onClick={() => {
                                    // Auto-fill province, district, and subdistrict from postal code

                                    setAddressLoading(true);

                                    setShowPostalCodeDropdown(false);

                                    // Ensure provinces are loaded

                                    let provincesPromise =
                                      Promise.resolve(provinces);

                                    if (provinces.length === 0) {
                                      provincesPromise = fetch(
                                        `${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=provinces`,
                                      )
                                        .then((res) => res.json())

                                        .then((data) => {
                                          if (data.success) {
                                            setProvinces(data.data || []);

                                            return data.data || [];
                                          }

                                          return [];
                                        });
                                    }

                                    provincesPromise

                                      .then((provs) => {
                                        const province = provs.find(
                                          (p: any) =>
                                            p.id === result.province_id,
                                        );

                                        if (province) {
                                          setSelectedProvince(province.id);

                                          setSelectedGeography(
                                            province.geography_id,
                                          );

                                          setProvinceSearchTerm(
                                            province.name_th,
                                          );

                                          setShowProvinceDropdown(false);

                                          // Load districts for this province

                                          return fetch(
                                            `${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=districts&id=${province.id}`,
                                          ).then((res) => res.json());
                                        }

                                        setAddressLoading(false);

                                        return { success: false, data: [] };
                                      })

                                      .then((data) => {
                                        if (data.success) {
                                          setDistricts(data.data || []);

                                          // Find and set district

                                          const district = data.data.find(
                                            (d: any) =>
                                              d.id === result.district_id,
                                          );

                                          if (district) {
                                            setSelectedDistrict(district.id);

                                            setDistrictSearchTerm(
                                              district.name_th,
                                            );

                                            setShowDistrictDropdown(false);

                                            // Load subdistricts for this district

                                            return fetch(
                                              `${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=sub_districts&id=${district.id}`,
                                            ).then((res) => res.json());
                                          }
                                        }

                                        setAddressLoading(false);

                                        return { success: false, data: [] };
                                      })

                                      .then((data) => {
                                        if (data.success) {
                                          setSubDistricts(data.data || []);

                                          // Find and set subdistrict

                                          const subDistrict = data.data.find(
                                            (sd: any) =>
                                              sd.id === result.id &&
                                              sd.zip_code === result.zip_code,
                                          );

                                          if (subDistrict) {
                                            setSelectedSubDistrict(
                                              subDistrict.id,
                                            );

                                            setSubDistrictSearchTerm(
                                              subDistrict.name_th,
                                            );

                                            setShowSubDistrictDropdown(false);

                                            setShippingAddress((prev) => ({
                                              ...prev,

                                              province:
                                                result.province ||
                                                prev.province,

                                              district:
                                                result.district ||
                                                prev.district,

                                              subdistrict:
                                                result.sub_district ||
                                                prev.subdistrict,

                                              postalCode:
                                                result.zip_code ||
                                                prev.postalCode,
                                            }));
                                          }
                                        }

                                        setAddressLoading(false);

                                        setPostalCodeResults([]);
                                      })

                                      .catch((error) => {
                                        console.error(
                                          "Error loading address data:",

                                          error,
                                        );

                                        setAddressLoading(false);
                                      });
                                  }}
                                >
                                  <div className="font-medium text-gray-900">
                                    {result.sub_district} ({result.zip_code})
                                  </div>

                                  <div className="text-xs text-gray-500 mt-0.5">
                                    {result.district}, {result.province}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                      </div>
                    </div>

                    {selectedAddressOption === "new" && (
                      <div className="flex items-center pt-2">
                        <input
                          type="checkbox"
                          id="update-profile-address"
                          checked={updateProfileAddress}
                          onChange={(e) =>
                            setUpdateProfileAddress(e.target.checked)
                          }
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />

                        <label
                          htmlFor="update-profile-address"
                          className="ml-2 text-sm text-[#0e141b]"
                        >
                          อัพเดตเป็นที่อยู่หลัก
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={commonLabelClass}>
                        วันที่จัดส่ง <span className="text-red-500">*</span>
                      </label>

                      <div className="relative">
                        <input
                          type="text"
                          readOnly
                          value={
                            orderData.deliveryDate
                              ? (() => {
                                const [y, m, d] =
                                  orderData.deliveryDate.split("-");
                                return `${d}/${m}/${y}`;
                              })()
                              : ""
                          }
                          placeholder="dd/mm/yyyy"
                          className={commonInputClass}
                        />
                        <input
                          type="date"
                          ref={deliveryDateRef}
                          value={orderData.deliveryDate}
                          min={(() => {
                            return new Date().toISOString().split("T")[0];
                          })()}
                          max={(() => {
                            const now = new Date();
                            const nextMonth = new Date(
                              now.getFullYear(),
                              now.getMonth() + 1,
                              7,
                            );
                            return nextMonth.toISOString().split("T")[0];
                          })()}
                          onChange={(e) => {
                            const selectedDate = e.target.value;
                            const now = new Date();
                            const nextMonth = new Date(
                              now.getFullYear(),
                              now.getMonth() + 1,
                              7,
                            );
                            const maxDate = nextMonth
                              .toISOString()
                              .split("T")[0];
                            if (selectedDate > maxDate) {
                              const maxDateObj = new Date(maxDate);
                              const maxDateStr = `${maxDateObj.getDate()}/${maxDateObj.getMonth() + 1}/${maxDateObj.getFullYear()}`;
                              alert(
                                `วันที่จัดส่งต้องไม่เกินวันที่ 7 ของเดือนถัดไป (สูงสุด ${maxDateStr})`,
                              );
                              updateOrderData("deliveryDate", maxDate);
                              return;
                            }
                            updateOrderData("deliveryDate", selectedDate);
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-5 h-5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 9v7.5"
                            />
                          </svg>
                        </div>
                      </div>

                      {(() => {
                        // แสดงข้อความเตือนถ้าวันที่เลือกเกินวันที่ 7 ของเดือนถัดไป

                        if (!orderData.deliveryDate) return null;

                        const now = new Date();

                        const nextMonth = new Date(
                          now.getFullYear(),

                          now.getMonth() + 1,

                          7,
                        );

                        const maxDate = nextMonth.toISOString().split("T")[0];

                        if (orderData.deliveryDate > maxDate) {
                          const maxDateObj = new Date(maxDate);

                          const maxDateStr = `${maxDateObj.getDate()}/${maxDateObj.getMonth() + 1}/${maxDateObj.getFullYear()}`;

                          return (
                            <p className="text-red-600 text-xs mt-1">
                              วันที่จัดส่งต้องไม่เกินวันที่ 7 ของเดือนถัดไป
                              (สูงสุด {maxDateStr})
                            </p>
                          );
                        }

                        return null;
                      })()}
                    </div>

                    <div>
                      <label className={commonLabelClass}>หมายเหตุ</label>

                      <input
                        type="text"
                        value={orderData.notes || ""}
                        onChange={(e) =>
                          updateOrderData("notes", e.target.value)
                        }
                        className={commonInputClass}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                      <label className={commonLabelClass}>
                        คลังจัดส่ง (อัตโนมัติจากจังหวัด)
                      </label>

                      <input
                        type="text"
                        value={(() => {
                          const w = (warehouses || []).find(
                            (x) => x.id === warehouseId,
                          );

                          return w ? w.name : "-";
                        })()}
                        readOnly
                        className={commonInputClass + " bg-slate-100"}
                      />
                    </div>

                    <div>
                      <label className={commonLabelClass}>
                        ขนส่งที่ต้องการใช้{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={orderData.shippingProvider || ""}
                        onChange={(e) =>
                          updateOrderData("shippingProvider", e.target.value)
                        }
                        className={commonInputClass}
                      >
                        <option value="">เลือกขนส่ง</option>
                        {SHIPPING_PROVIDERS.map((provider) => (
                          <option key={provider} value={provider}>
                            {provider}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Middle Column: Products, Payment Method and Order Summary */}

          <div className="space-y-6">
            {/* Section 4: Payment Method */}
            {(selectedCustomer || isCreatingNewCustomer) && (
              <div className="bg-white rounded-lg border border-gray-300 p-6">
                <h2 className="text-lg font-semibold text-[#0e141b] mb-4 pb-3 border-b">
                  วิธีการชำระเงิน
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className={commonLabelClass}>
                      เลือกวิธีการชำระเงิน{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      ref={paymentMethodRef}
                      value={orderData.paymentMethod ?? ""}
                      onChange={(e) =>
                        updateOrderData(
                          "paymentMethod",
                          e.target.value
                            ? (e.target.value as PaymentMethod)
                            : undefined,
                        )
                      }
                      className={commonInputClass}
                    >
                      <option value="">เลือกวิธีการชำระเงิน</option>
                      <option value={PaymentMethod.Transfer}>โอนเงิน</option>
                      <option value={PaymentMethod.COD}>
                        เก็บเงินปลายทาง (COD)
                      </option>
                      <option value={PaymentMethod.PayAfter}>
                        รับสินค้าก่อน
                      </option>
                    </select>
                  </div>

                  {orderData.paymentMethod === PaymentMethod.Transfer && (
                    <div
                      ref={transferSlipSectionRef}
                      className="space-y-4 p-4 border border-blue-300 rounded-md bg-blue-50"
                    >
                      <p className="text-sm text-[#0e141b]">
                        แนบสลิปโอนเงินได้หลายภาพตามต้องการ
                        (ระบุธนาคาร/เวลาโอนต่อสลิป)
                      </p>
                      {transferSlipUploads.length > 0 && (
                        <div className="flex flex-wrap gap-4">
                          {transferSlipUploads.map((slip) => (
                            <div
                              key={slip.id}
                              className="relative w-56 border border-blue-200 bg-white rounded-md overflow-hidden p-2 space-y-2"
                            >
                              <img
                                src={slip.dataUrl}
                                alt={slip.name || "payment slip"}
                                className="object-cover w-full h-24 rounded"
                              />
                              <button
                                type="button"
                                onClick={() => removeTransferSlip(slip.id)}
                                className="absolute top-1 right-1 bg-white/80 text-red-600 rounded-full px-2 leading-none font-bold hover:bg-red-50"
                                title="ลบ"
                              >
                                ×
                              </button>
                              <div className="space-y-2 text-xs">
                                <div>
                                  <label className="block text-gray-600 mb-1">
                                    ธนาคารที่รับโอน
                                  </label>
                                  <select
                                    value={slip.bankAccountId ?? ""}
                                    onChange={(e) =>
                                      setTransferSlipUploads((prev) =>
                                        prev.map((s) =>
                                          s.id === slip.id
                                            ? {
                                              ...s,
                                              bankAccountId:
                                                Number(e.target.value) ||
                                                undefined,
                                            }
                                            : s,
                                        ),
                                      )
                                    }
                                    className="w-full border rounded px-2 py-1 text-sm"
                                  >
                                    <option value="">เลือกธนาคาร</option>
                                    {bankAccounts.map((bank) => (
                                      <option key={bank.id} value={bank.id}>
                                        {bank.bank} - {bank.bank_number}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-gray-600 mb-1">
                                    เวลาที่รับโอน
                                  </label>
                                  <input
                                    type="datetime-local"
                                    value={slip.transferDate || ""}
                                    onChange={(e) =>
                                      setTransferSlipUploads((prev) =>
                                        prev.map((s) =>
                                          s.id === slip.id
                                            ? {
                                              ...s,
                                              transferDate: e.target.value,
                                            }
                                            : s,
                                        ),
                                      )
                                    }
                                    className="w-full border rounded px-2 py-1 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-gray-600 mb-1">
                                    จำนวนเงิน
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
                                          ? null
                                          : Number(e.target.value);
                                      setTransferSlipUploads((prev) =>
                                        prev.map((s) =>
                                          s.id === slip.id
                                            ? { ...s, amount: nextAmount }
                                            : s,
                                        ),
                                      );
                                    }}
                                    className="w-full border rounded px-2 py-1 text-sm"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <label className="flex flex-col items-center justify-center w-full md:w-auto px-4 py-3 border border-dashed border-blue-400 rounded-md bg-white text-sm text-blue-600 font-medium cursor-pointer hover:bg-blue-50">
                        <span>เลือกไฟล์สลิป</span>
                        <span className="text-xs text-blue-400 mt-1">
                          รองรับ .jpg, .jpeg, .png และหลายไฟล์ในครั้งเดียว
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={handleTransferSlipUpload}
                        />
                      </label>
                      {transferSlipUploads.length === 0 && (
                        <p className="text-xs text-red-600 font-medium">
                          กรุณาอัปโหลดสลิปก่อนบันทึกออเดอร์
                        </p>
                      )}
                    </div>
                  )}

                  {orderData.paymentMethod === PaymentMethod.COD && (
                    <div
                      ref={codSectionRef}
                      className="space-y-4 p-4 border border-gray-300 rounded-md bg-slate-50"
                    >
                      <h4 className="font-semibold text-[#0e141b]">
                        รายละเอียดการเก็บเงินปลายทาง
                      </h4>
                      <div className="p-3 border border-yellow-300 rounded-md bg-yellow-50 text-sm text-[#0e141b]">
                        โปรดระบุยอด COD ต่อกล่องให้ผลรวมเท่ากับยอดสุทธิ:{" "}
                        <strong>฿{totalAmount.toFixed(2)}</strong>
                        <span className="ml-2">
                          (ยอดรวมปัจจุบัน:{" "}
                          <span
                            className={
                              !isCodValid
                                ? "text-red-600 font-bold"
                                : "text-green-700 font-bold"
                            }
                          >
                            ฿{codTotal.toFixed(2)}
                          </span>
                          )
                        </span>
                        <span className="block mt-1">
                          {codRemaining === 0 ? (
                            <span className="text-green-700 font-medium">
                              ครบถ้วนแล้ว
                            </span>
                          ) : codRemaining > 0 ? (
                            <span className="text-orange-600 font-medium">
                              คงเหลือ: ฿{Math.abs(codRemaining).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-red-600 font-medium">
                              เกิน: ฿{Math.abs(codRemaining).toFixed(2)}
                            </span>
                          )}
                        </span>
                      </div>
                      <div>
                        <label className={commonLabelClass}>จำนวนกล่อง</label>
                        <input
                          type="number"
                          min="1"
                          max={(() => {
                            // จำนวนกล่องต้องไม่เกินจำนวนรายการสินค้า (parent items only)
                            const parentItems = (orderData.items || []).filter(
                              (it) => !it.parentItemId,
                            );
                            return parentItems.length || 1;
                          })()}
                          value={numBoxes}
                          onChange={(e) => {
                            clearValidationErrorFor("cod");
                            const newValue = Math.max(
                              1,
                              Number(e.target.value),
                            );
                            // จำนวนกล่องต้องไม่เกินจำนวนรายการสินค้า (parent items only)
                            const parentItems = (orderData.items || []).filter(
                              (it) => !it.parentItemId,
                            );
                            const maxBoxes = parentItems.length || 1;
                            if (newValue > maxBoxes) {
                              alert(
                                `จำนวนกล่องต้องไม่เกินจำนวนรายการสินค้า (สูงสุด ${maxBoxes} กล่อง)`,
                              );
                              return;
                            }
                            setNumBoxes(newValue);
                          }}
                          onFocus={onFocusSelectAll}
                          className={commonInputClass}
                        />
                        {(() => {
                          const parentItems = (orderData.items || []).filter(
                            (it) => !it.parentItemId,
                          );
                          const maxBoxes = parentItems.length || 1;
                          if (numBoxes > maxBoxes) {
                            return (
                              <p className="text-red-600 text-xs mt-1">
                                จำนวนกล่องเกินจำนวนรายการสินค้า (สูงสุด{" "}
                                {maxBoxes} กล่อง)
                              </p>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <button
                        onClick={divideCodEqually}
                        className="text-sm text-blue-600 font-medium hover:underline"
                      >
                        แบ่งยอดเท่าๆ กัน
                      </button>
                      <div className="space-y-2">
                        {orderData.boxes?.map((box, index) => (
                          <div key={index} className="flex items-center gap-4">
                            <label className="font-medium text-[#0e141b] w-24">
                              กล่อง #{box.boxNumber}:
                            </label>
                            <input
                              type="number"
                              placeholder="ยอด COD"
                              value={box.codAmount}
                              onChange={(e) =>
                                handleCodBoxAmountChange(
                                  index,
                                  Number(e.target.value),
                                )
                              }
                              onFocus={onFocusSelectAll}
                              className={commonInputClass}
                            />
                          </div>
                        ))}
                      </div>
                      {!isCodValid && (
                        <p className="text-red-600 text-sm font-medium">
                          ยอดรวม COD ไม่ถูกต้อง
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Section 3: Products */}

            {(selectedCustomer || isCreatingNewCustomer) && (
              <div
                ref={itemsSectionRef}
                className="bg-white rounded-lg border border-gray-300 p-6"
              >
                <h2 className="text-lg font-semibold text-[#0e141b] mb-4 pb-3 border-b">
                  รายการสินค้า
                </h2>

                {/* Product Selection Tabs */}

                <div className="mb-4 border-b border-gray-200 flex justify-between items-center">
                  <ul className="flex -mb-px text-sm font-medium text-center">
                    <li className="mr-2">
                      <button
                        onClick={() => setSelectorTab("products")}
                        className={`inline-block py-2 px-4 border-b-2 rounded-t-lg ${selectorTab === "products"
                          ? "text-blue-600 border-blue-600"
                          : "text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300"
                          }`}
                      >
                        สินค้าปกติ
                      </button>
                    </li>
                    <li className="mr-2">
                      <button
                        onClick={() => setSelectorTab("promotions")}
                        className={`inline-block py-2 px-4 border-b-2 rounded-t-lg ${selectorTab === "promotions"
                          ? "text-blue-600 border-blue-600"
                          : "text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300"
                          }`}
                      >
                        โปรโมชั่น/เซ็ตสินค้า
                      </button>
                    </li>
                  </ul>

                  {(() => {
                    // Check if any SKU appears more than 3 times
                    const skuCounts = (orderData.items || []).reduce(
                      (acc, item) => {
                        if (!item.parentItemId && item.productId) {
                          acc[item.productId] = (acc[item.productId] || 0) + 1;
                        }
                        return acc;
                      },
                      {} as Record<number, number>,
                    );
                    const hasManySameSku = Object.values(skuCounts).some(
                      (count) => count > 3,
                    );

                    if (hasManySameSku) {
                      return (
                        <button
                          onClick={() => {
                            const currentItems = (orderData.items || []).filter(
                              (it) => !it.parentItemId,
                            );
                            const newNumBoxes = currentItems.length;
                            setNumBoxes(newNumBoxes);

                            // Update items to have boxNumber corresponding to their index + 1
                            const updatedItems = (orderData.items || []).map(
                              (it) => {
                                if (!it.parentItemId) {
                                  // Find index in the filtered list
                                  const idx = currentItems.findIndex(
                                    (c) => c.id === it.id,
                                  );
                                  return { ...it, boxNumber: idx + 1 };
                                }
                                return it;
                              },
                            );
                            updateOrderData("items", updatedItems);

                            // Update boxes with COD amounts
                            const newBoxes = currentItems.map((it, idx) => {
                              const baseTotal =
                                (it.quantity || 0) * (it.pricePerUnit || 0);
                              const total = Math.max(
                                0,
                                baseTotal - (it.discount || 0),
                              );
                              return {
                                boxNumber: idx + 1,
                                codAmount: total,
                              };
                            });
                            updateOrderData("boxes", newBoxes);
                          }}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm font-medium hover:bg-blue-200 transition-colors"
                        >
                          คำนวณกล่องอัตโนมัติ
                        </button>
                      );
                    }
                    return null;
                  })()}
                </div>

                <div className="space-y-3">
                  {(orderData.items || [])

                    .filter((it) => !it.parentItemId)

                    .map((item, index) => (
                      <div
                        key={item.id}
                        className="grid gap-2 items-start p-3 border border-gray-200 rounded-md bg-slate-50"
                        style={{
                          gridTemplateColumns: "repeat(17, minmax(0, 1fr))",
                        }}
                      >
                        <div className="col-span-1 flex flex-col items-center justify-center">
                          <label className="text-xs text-[#4e7397] mb-1 block text-center">
                            ลำดับ
                          </label>
                          <span className="text-sm font-medium text-gray-600 text-center">
                            {index + 1}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-[#4e7397] mb-1 block">
                            SKU
                          </label>

                          <input
                            type="text"
                            placeholder="SKU"
                            value={(() => {
                              if (item.productId) {
                                const product = products.find(
                                  (p) => p.id === item.productId,
                                );

                                return product?.sku || "";
                              }

                              return "";
                            })()}
                            readOnly
                            className="w-full p-2 border border-gray-300 rounded-md bg-slate-100 text-[#0e141b] text-sm"
                            disabled={true}
                          />
                        </div>

                        <div className="col-span-3">
                          <label className="text-xs text-[#4e7397] mb-1 block">
                            ชื่อสินค้า
                          </label>

                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="ชื่อสินค้า"
                              value={item.productName}
                              onChange={(e) =>
                                updateOrderData(
                                  "items",

                                  orderData.items?.map((it) =>
                                    it.id === item.id
                                      ? { ...it, productName: e.target.value }
                                      : it,
                                  ),
                                )
                              }
                              className="w-full p-2 border border-gray-300 rounded-md bg-white text-[#0e141b] text-sm"
                              disabled={item.isPromotionParent}
                            />

                            {/* button to open product selector */}

                            <button
                              onClick={() =>
                                openProductSelector(selectorTab, item.id)
                              }
                              className="px-2 py-1 bg-white border rounded text-sm"
                            >
                              เลือก
                            </button>
                          </div>
                        </div>

                        <div className="col-span-2">
                          <label className="text-xs text-[#4e7397] mb-1 block">
                            จำนวน
                          </label>

                          <input
                            type="number"
                            placeholder="จำนวน"
                            value={item.quantity ?? 1}
                            min={1}
                            step={1}
                            onChange={(e) => {
                              const nextQty = clampQuantity(e.target.value);

                              const baseTotal = item.isFreebie
                                ? 0
                                : nextQty * (item.pricePerUnit || 0);

                              // ป้องกันไม่ให้ส่วนลดเกินยอดขายรวมทั้งหมดเมื่อจำนวนเปลี่ยน

                              const currentDiscount = item.discount || 0;

                              const clampedDiscount = Math.max(
                                0,

                                Math.min(currentDiscount, baseTotal),
                              );

                              updateOrderData(
                                "items",

                                orderData.items?.map((it) =>
                                  it.id === item.id
                                    ? {
                                      ...it,

                                      quantity: nextQty,

                                      discount: clampedDiscount,
                                    }
                                    : it,
                                ),
                              );
                            }}
                            onFocus={onFocusSelectAll}
                            className="w-full p-2 border border-gray-300 rounded-md bg-white text-[#0e141b] text-sm"
                            disabled={false}
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="text-xs text-[#4e7397] mb-1 block">
                            ราคา
                          </label>

                          <input
                            type="number"
                            placeholder="ราคา"
                            value={item.pricePerUnit}
                            readOnly
                            className="w-full p-2 border border-gray-300 rounded-md bg-slate-100 text-[#0e141b] text-sm"
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="text-xs text-[#4e7397] mb-1 block">
                            ส่วนลด
                          </label>

                          <input
                            type="number"
                            placeholder="ส่วนลด"
                            value={item.discount || 0}
                            onChange={(e) => {
                              const discountValue = Number(e.target.value) || 0;

                              const baseTotal = item.isFreebie
                                ? 0
                                : (item.quantity || 0) *
                                (item.pricePerUnit || 0);

                              // ป้องกันไม่ให้ส่วนลดเกินยอดขายรวมทั้งหมด

                              const clampedDiscount = Math.max(
                                0,

                                Math.min(discountValue, baseTotal),
                              );

                              updateOrderData(
                                "items",

                                orderData.items?.map((it) =>
                                  it.id === item.id
                                    ? {
                                      ...it,

                                      discount: clampedDiscount,
                                    }
                                    : it,
                                ),
                              );
                            }}
                            onFocus={onFocusSelectAll}
                            className="w-full p-2 border border-gray-300 rounded-md bg-white text-[#0e141b] text-sm"
                            min={0}
                            max={
                              item.isFreebie
                                ? 0
                                : (item.quantity || 0) *
                                (item.pricePerUnit || 0)
                            }
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="text-xs text-[#4e7397] mb-1 block">
                            ยอดรวม
                          </label>

                          <input
                            type="number"
                            placeholder="ยอดรวม"
                            value={(() => {
                              if (item.isFreebie) return 0;

                              const baseTotal =
                                (item.quantity || 0) * (item.pricePerUnit || 0);

                              return Math.max(
                                0,

                                baseTotal - (item.discount || 0),
                              );
                            })()}
                            onChange={(e) => {
                              const totalValue = Number(e.target.value) || 0;

                              if (item.isFreebie) return;

                              const baseTotal =
                                (item.quantity || 0) * (item.pricePerUnit || 0);

                              // ป้องกันไม่ให้ยอดรวมเกินยอดขายรวมทั้งหมด

                              const clampedTotal = Math.max(
                                0,

                                Math.min(totalValue, baseTotal),
                              );

                              const calculatedDiscount = Math.max(
                                0,

                                baseTotal - clampedTotal,
                              );

                              updateOrderData(
                                "items",

                                orderData.items?.map((it) =>
                                  it.id === item.id
                                    ? {
                                      ...it,

                                      discount: calculatedDiscount,
                                    }
                                    : it,
                                ),
                              );
                            }}
                            onFocus={onFocusSelectAll}
                            className="w-full p-2 border border-gray-300 rounded-md bg-white text-[#0e141b] text-sm"
                            disabled={item.isFreebie}
                            min={0}
                            max={
                              item.isFreebie
                                ? 0
                                : (item.quantity || 0) *
                                (item.pricePerUnit || 0)
                            }
                          />
                        </div>

                        <div className="col-span-1">
                          <label className="text-xs text-[#4e7397] mb-1 block">
                            กล่อง
                          </label>

                          <select
                            value={item.boxNumber || 1}
                            onChange={(e) =>
                              updateOrderData(
                                "items",

                                orderData.items?.map((it) =>
                                  it.id === item.id
                                    ? {
                                      ...it,

                                      boxNumber: Math.max(
                                        1,

                                        Math.min(
                                          Number(e.target.value),

                                          numBoxes,
                                        ),
                                      ),
                                    }
                                    : it,
                                ),
                              )
                            }
                            onFocus={onFocusSelectAll}
                            className="w-full p-2 border border-gray-300 rounded-md bg-white text-[#0e141b] text-sm"
                          >
                            {Array.from(
                              { length: numBoxes },

                              (_, i) => i + 1,
                            ).map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-1 flex flex-col items-center justify-end h-full pb-2">
                          <label className="text-xs text-[#4e7397] mb-1 block">
                            แถม
                          </label>

                          <input
                            type="checkbox"
                            title="ของแถม"
                            checked={item.isFreebie}
                            onChange={(e) =>
                              updateOrderData(
                                "items",

                                orderData.items?.map((it) =>
                                  it.id === item.id
                                    ? { ...it, isFreebie: e.target.checked }
                                    : it,
                                ),
                              )
                            }
                            className="h-4 w-4"
                          />
                        </div>

                        <div className="col-span-1 flex items-end justify-center h-full pb-2">
                          <button
                            onClick={() => {
                              const current = orderData.items || [];

                              const id = item.id;

                              const next = current.filter(
                                (it) => it.id !== id && it.parentItemId !== id,
                              );

                              updateOrderData("items", next);
                            }}
                            className="text-red-500 hover:text-red-700 text-sm font-medium"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                              className="w-5 h-5"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}

                  <button
                    onClick={() => {
                      const currentItems = orderData.items || [];
                      if (currentItems.length === 0) {
                        // If no items, add a default empty item
                        updateOrderData("items", [
                          ...currentItems,
                          {
                            id: Date.now(),
                            productName: "",
                            quantity: 1,
                            pricePerUnit: 0,
                            discount: 0,
                            isFreebie: false,
                            boxNumber: 1,
                          },
                        ]);
                      } else {
                        // If items exist, copy the last one
                        const lastItem = currentItems[currentItems.length - 1];
                        const countStr = window.prompt(
                          "ต้องการคัดลอกกี่รายการ?",
                          "1",
                        );
                        if (countStr) {
                          const count = parseInt(countStr, 10);
                          if (!isNaN(count) && count > 0) {
                            const newItems = [];
                            for (let i = 0; i < count; i++) {
                              newItems.push({
                                ...lastItem,
                                id: Date.now() + i, // Ensure unique ID
                              });
                            }
                            updateOrderData("items", [
                              ...currentItems,
                              ...newItems,
                            ]);
                          }
                        }
                      }
                    }}
                    className="text-sm text-blue-600 font-medium hover:underline"
                  >
                    + คัดลอกรายการล่าสุด
                  </button>

                  <div className="mt-3">
                    <button
                      onClick={() => openProductSelector(selectorTab)}
                      className="px-3 py-2 bg-blue-600 text-white rounded-md mr-2"
                    >
                      {selectorTab === "products"
                        ? "เลือกสินค้า"
                        : "เลือกโปรโมชั่น"}
                    </button>
                  </div>

                  {/* Product / Promotion Selector Modal */}

                  {productSelectorOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                      <div className="bg-white rounded-lg w-full max-w-[1200px] p-4 shadow-xl max-h-[85vh] overflow-hidden flex flex-col">
                        <div className="flex gap-4 h-[70vh]">
                          <div className="w-64 border-r pr-4 overflow-auto">
                            <div className="mb-4 flex items-center justify-between">
                              <h3 className="font-semibold">ประเภท</h3>

                              <button
                                onClick={closeProductSelector}
                                className="px-2 py-1 border rounded"
                              >
                                ปิด
                              </button>
                            </div>

                            <ul className="space-y-2 text-sm">
                              {selectorTab === "products" && (
                                <li
                                  className={`p-2 rounded ${!leftFilter ? "bg-slate-100" : ""} cursor-pointer`}
                                  onClick={() => {
                                    setLeftFilter(null);

                                    setSelectorSearchTerm("");
                                  }}
                                >
                                  ทั้งหมด
                                </li>
                              )}

                              {selectorTab === "promotions" && (
                                <>
                                  <li
                                    className={`p-2 rounded ${leftFilter === -1 ? "bg-slate-100" : ""} cursor-pointer`}
                                    onClick={() => {
                                      setLeftFilter(-1);

                                      setSelectorSearchTerm("");
                                    }}
                                  >
                                    รายการโปรโมชั่น
                                  </li>

                                  {promotionsSafe.map((p) => (
                                    <li
                                      key={p.id}
                                      className={`p-2 rounded ${leftFilter === p.id ? "bg-slate-100" : ""} cursor-pointer`}
                                      onClick={() => {
                                        setLeftFilter(p.id);

                                        setSelectorSearchTerm("");
                                      }}
                                    >
                                      {p.name}
                                    </li>
                                  ))}
                                </>
                              )}
                            </ul>
                          </div>

                          <div className="flex-1 flex flex-col min-w-0">
                            <div className="mb-3">
                              <input
                                type="text"
                                placeholder={`ค้นหา ${selectorTab === "products" ? "SKU, ชื่อสินค้า" : "ชื่อโปรโมชั่น"}`}
                                value={selectorSearchTerm}
                                onChange={(e) =>
                                  setSelectorSearchTerm(e.target.value)
                                }
                                className="w-full p-2 border rounded"
                              />
                            </div>

                            <div className="flex-1 overflow-auto">
                              {selectorTab === "products" && (
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-left text-[#4e7397] border-b">
                                      <th className="p-2">SKU</th>

                                      <th className="p-2">สินค้า</th>

                                      <th className="p-2">ราคาขาย</th>

                                      <th className="p-2">เลือก</th>
                                    </tr>
                                  </thead>

                                  <tbody>
                                    {products

                                      .filter(
                                        (pr) =>
                                          !selectorSearchTerm ||
                                          `${pr.sku} ${pr.name}`

                                            .toLowerCase()

                                            .includes(
                                              selectorSearchTerm.toLowerCase(),
                                            ),
                                      )

                                      .map((p) => (
                                        <tr key={p.id} className="border-b">
                                          <td className="p-2 align-top">
                                            {p.sku}
                                          </td>

                                          <td className="p-2 align-top">
                                            {p.name}
                                          </td>

                                          <td className="p-2 align-top">
                                            {p.price.toFixed(2)}
                                          </td>

                                          <td className="p-2 align-top">
                                            <button
                                              onClick={() =>
                                                addProductById(p.id)
                                              }
                                              className="text-blue-600"
                                            >
                                              เลือก
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              )}

                              {selectorTab === "promotions" && (
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-left text-[#4e7397] border-b">
                                      <th className="p-2">ชื่อโปรโมชั่น</th>

                                      <th className="p-2">รายการ</th>

                                      <th className="p-2">ราคาขาย</th>

                                      <th className="p-2">สถานะ</th>

                                      <th className="p-2">เลือก</th>
                                    </tr>
                                  </thead>

                                  <tbody>
                                    {promotionsSafe

                                      .filter((pm) => {
                                        // Filter only active promotions

                                        if (!pm.active) return false;

                                        if (leftFilter && leftFilter !== -1)
                                          return (
                                            String(pm.id) === String(leftFilter)
                                          );

                                        if (!selectorSearchTerm) return true;

                                        return `${pm.name}`

                                          .toLowerCase()

                                          .includes(
                                            selectorSearchTerm.toLowerCase(),
                                          );
                                      })

                                      .map((pm) => (
                                        <tr key={pm.id} className="border-b">
                                          <td className="p-2 align-top">
                                            {pm.name}
                                          </td>

                                          <td className="p-2 align-top">
                                            {(pm.items || [])

                                              .map((it: any) => {
                                                const prodLabel =
                                                  it.product_name ??
                                                  it.product?.name ??
                                                  it.sku ??
                                                  it.product_sku ??
                                                  "";

                                                const priceText = it.is_freebie
                                                  ? "ฟรี"
                                                  : `฿${(it.price_override !== null && it.price_override !== undefined ? Number(it.price_override) : 0).toFixed(2)}`;

                                                return `${it.quantity} x ${prodLabel} (${priceText})`;
                                              })

                                              .join(", ")}
                                          </td>

                                          <td className="p-2 align-top">
                                            {calcPromotionSetPrice(pm).toFixed(
                                              2,
                                            )}
                                          </td>

                                          <td className="p-2 align-top">
                                            <span
                                              className={`px-2 py-1 text-xs rounded-full ${pm.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                                            >
                                              {pm.active
                                                ? "Active"
                                                : "Inactive"}
                                            </span>
                                          </td>

                                          <td className="p-2 align-top">
                                            <button
                                              onClick={() =>
                                                addPromotionByIdFixed(pm.id)
                                              }
                                              className={`px-3 py-1 rounded text-white ${pm.active ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"}`}
                                              disabled={!pm.active}
                                            >
                                              เลือก
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          {(selectedCustomer || isCreatingNewCustomer) && (
            <div className="mt-6 flex justify-end gap-3 pb-6">
              <button
                onClick={handleSave}
                disabled={
                  !isCodValid ||
                  (isCreatingNewCustomer && !!newCustomerPhoneError)
                }
                className="px-6 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                บันทึกคำสั่งซื้อ
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Sticky Order Summary */}
        {(selectedCustomer || isCreatingNewCustomer) && (
          <div className="w-full lg:w-80 shrink-0">
            <div className="sticky top-4">
              <OrderSummary
                orderData={orderData}
                onUpdateOrder={updateOrderData}
              />
            </div>
          </div>
        )}
      </div>

      {/* Success Modal */}

      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <h3 className="text-lg font-semibold text-[#0e141b]">
              สร้างคำสั่งซื้อสำเร็จ
            </h3>

            {createdOrderId && (
              <p className="mt-1 text-sm text-[#4e7397]">
                หมายเลขคำสั่งซื้อ {createdOrderId}
              </p>
            )}

            <p className="mt-4 text-sm text-[#4e7397]">
              สามารถกลับไปยังหน้าหลักเพื่อดำเนินงานต่อได้ทันที
            </p>

            <div className="mt-6 flex justify-center">
              <button
                onClick={() => {
                  setShowSuccessModal(false);

                  // On success, call onSuccess callback (goes to Dashboard)

                  if (onSuccess) {
                    onSuccess();
                  } else {
                    onCancel();
                  }
                }}
                className="inline-flex items-center rounded-lg bg-green-600 px-5 py-2.5 font-semibold text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                กลับสู่หน้าหลัก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { CreateOrderPage };
