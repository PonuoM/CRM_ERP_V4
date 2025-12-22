
import {
    Order,
    LineItem,
    TrackingDetail,
    CodBox,
    PaymentMethod,
    OrderStatus,
    PaymentStatus,
    TrackingEntry,
} from "../types";

export const fromApiOrderStatus = (s: any): OrderStatus => {
    switch (String(s)) {
        case "Pending":
            return "Pending" as OrderStatus;
        case "AwaitingVerification":
            return "AwaitingVerification" as OrderStatus;
        case "Confirmed":
            return "Confirmed" as OrderStatus;
        case "Preparing":
            return "Preparing" as OrderStatus;
        case "Picking":
            return "Picking" as OrderStatus;
        case "Shipping":
            return "Shipping" as OrderStatus;
        case "PreApproved":
            return "PreApproved" as OrderStatus;
        case "Delivered":
            return "Delivered" as OrderStatus;
        case "Returned":
            return "Returned" as OrderStatus;
        case "Cancelled":
            return "Cancelled" as OrderStatus;
        case "Claiming":
            return "Claiming" as OrderStatus;
        case "BadDebt":
            return "BadDebt" as OrderStatus;
        default:
            return "Pending" as OrderStatus;
    }
};

export const fromApiPaymentStatus = (s: any): PaymentStatus => {
    switch (String(s)) {
        case "Unpaid":
            return "Unpaid" as PaymentStatus;
        case "PendingVerification":
            return "PendingVerification" as PaymentStatus;
        case "Verified":
            return "Verified" as PaymentStatus;
        case "PreApproved":
            return "PreApproved" as PaymentStatus;
        case "Approved":
            return "Approved" as PaymentStatus;
        case "Paid":
            return "Paid" as PaymentStatus;
        default:
            return "Unpaid" as PaymentStatus;
    }
};

export const fromApiPaymentMethod = (s: any): PaymentMethod => {
    const raw = String(s ?? "").trim();
    const value = raw.toLowerCase();
    if (value === "cod" || value === "c.o.d" || value === "cash_on_delivery") {
        return PaymentMethod.COD;
    }
    if (value === "transfer" || value === "bank_transfer" || value === "โอน" || value === "1,,-,t") {
        return PaymentMethod.Transfer;
    }
    if (value === "payafter" || value === "pay_after" || value === "pay-after" || value === "เก็บเงินปลายทางแบบผ่อน") {
        return PaymentMethod.PayAfter;
    }
    if (value === "claim" || value === "ส่งเคลม") {
        // Note: Assuming Claim/FreeGift are valid PaymentMethods based on usage in App.tsx
        return "Claim" as PaymentMethod;
    }
    if (value === "freegift" || value === "free_gift" || value === "ส่งของแถม") {
        return "FreeGift" as PaymentMethod;
    }
    // Default to COD if unknown or empty, as seen in legacy logic
    return PaymentMethod.COD;
};

export const mapTrackingDetailsFromApi = (raw: any): TrackingDetail[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((t: any) => {
        const orderId = t.order_id ?? t.orderId ?? undefined;
        const parentOrderId = t.parent_order_id ?? t.parentOrderId ?? undefined;
        const trackingNumber = t.tracking_number ?? t.trackingNumber ?? "";
        const boxNumRaw = t.box_number ?? t.boxNumber;
        const boxNumber =
            boxNumRaw !== undefined &&
                boxNumRaw !== null &&
                !Number.isNaN(Number(boxNumRaw))
                ? Number(boxNumRaw)
                : undefined;

        return {
            orderId,
            parentOrderId,
            trackingNumber,
            boxNumber,
            order_id: orderId,
            parent_order_id: parentOrderId,
            tracking_number: trackingNumber,
            box_number: boxNumber,
        };
    });
};

export const mapOrderBoxesFromApi = (raw: any, trackingDetails: any[]): CodBox[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((b: any) => {
        const boxNumRaw = b.box_number ?? b.boxNumber;
        const boxNumber =
            boxNumRaw !== undefined &&
                boxNumRaw !== null &&
                !Number.isNaN(Number(boxNumRaw))
                ? Number(boxNumRaw)
                : 1; // Default to 1 if missing? App.tsx uses similar check
        const codAmount = Number(
            b.cod_amount ?? b.codAmount ?? b.collection_amount ?? b.collectionAmount ?? 0,
        );
        const collectionAmount = Number(
            b.collection_amount ?? b.collectionAmount ?? codAmount ?? 0,
        );
        const collectedAmount = Number(b.collected_amount ?? b.collectedAmount ?? 0);
        const waivedAmount = Number(b.waived_amount ?? b.waivedAmount ?? 0);
        const paymentMethodRaw = b.payment_method ?? b.paymentMethod;
        const trackingForBox =
            typeof boxNumber === "number"
                ? trackingDetails.find((t: any) => {
                    const tBox = t.box_number ?? t.boxNumber;
                    return (
                        tBox !== undefined &&
                        tBox !== null &&
                        Number(tBox) === boxNumber
                    );
                })
                : undefined;

        return {
            boxNumber,
            codAmount,
            collectionAmount,
            collectedAmount,
            waivedAmount,
            paymentMethod: paymentMethodRaw ? fromApiPaymentMethod(paymentMethodRaw) : undefined,
            trackingNumber: trackingForBox?.trackingNumber,
        };
    });
};

export const mapOrderFromApi = (r: any): Order => {
    const trackingDetails = mapTrackingDetailsFromApi(
        r.tracking_details ?? r.trackingDetails,
    );
    const boxes = mapOrderBoxesFromApi(r.boxes, trackingDetails);

    // Map Items
    const items: LineItem[] = Array.isArray(r.items)
        ? r.items.map((i: any) => ({
            id: i.id,
            productName: i.product_name ?? i.productName ?? "",
            quantity: Number(i.quantity ?? 0),
            pricePerUnit: Number(i.price_per_unit ?? i.pricePerUnit ?? 0),
            discount: Number(i.discount ?? 0),
            isFreebie: Boolean(i.is_freebie ?? i.isFreebie),
            boxNumber: Number(i.box_number ?? i.boxNumber ?? 1),
            productId: i.product_id ?? i.productId,
            promotionId: i.promotion_id ?? i.promotionId,
            parentItemId: i.parent_item_id ?? i.parentItemId,
            isPromotionParent: Boolean(i.is_promotion_parent ?? i.isPromotionParent),
            creatorId: i.creator_id ?? i.creatorId,
            originalQuantity: i.original_quantity ?? i.originalQuantity,
            sku: i.sku,
        }))
        : [];

    // Map Tracking Entries (simple strings or objects)
    const trackingNumbers: string[] = [];
    if (Array.isArray(r.tracking_numbers ?? r.trackingNumbers)) {
        (r.tracking_numbers ?? r.trackingNumbers).forEach((t: any) => {
            if (typeof t === "string") trackingNumbers.push(t);
            else if (t.tracking_number) trackingNumbers.push(t.tracking_number);
        });
    }

    return {
        id: String(r.id),
        customerId: String(r.customer_id ?? r.customerId),
        customerStatus: r.customer_status,
        customerRefId: r.customer_ref_id ? Number(r.customer_ref_id) : undefined,
        companyId: r.company_id ?? r.companyId,
        creatorId: typeof r.creator_id === "number" ? r.creator_id : Number(r.creator_id) || 0,
        orderDate: r.order_date ?? r.orderDate,
        deliveryDate: r.delivery_date ?? r.deliveryDate ?? "",
        shippingAddress: {
            recipientFirstName: r.recipient_first_name ?? r.recipientFirstName ?? "",
            recipientLastName: r.recipient_last_name ?? r.recipientLastName ?? "",
            street: r.address ?? r.street ?? "",
            subdistrict: r.subdistrict ?? "",
            district: r.district ?? "",
            province: r.province ?? "",
            postalCode: r.postal_code ?? r.postalCode ?? "",
        },
        shippingProvider: r.shipping_provider ?? r.shippingProvider,
        items,
        shippingCost: Number(r.shipping_cost ?? r.shippingCost ?? 0),
        billDiscount: Number(r.bill_discount ?? r.billDiscount ?? 0),
        totalAmount: Number(r.total_amount ?? r.totalAmount ?? 0),
        paymentMethod: fromApiPaymentMethod(r.payment_method ?? r.paymentMethod),
        paymentStatus: fromApiPaymentStatus(r.payment_status ?? r.paymentStatus),
        slipUrl: r.slip_url ?? r.slipUrl,
        amountPaid: Number(r.amount_paid ?? r.amountPaid ?? 0),
        codAmount: Number(r.cod_amount ?? r.codAmount ?? 0),
        orderStatus: fromApiOrderStatus(r.order_status ?? r.orderStatus),
        trackingNumbers,
        trackingDetails,
        boxes,
        notes: r.notes,
        warehouseId: r.warehouse_id ?? r.warehouseId,
        salesChannel: r.sales_channel ?? r.salesChannel,
        salesChannelPageId: r.sales_channel_page_id ?? r.salesChannelPageId,
        bankAccountId: r.bank_account_id ?? r.bankAccountId,
        transferDate: r.transfer_date ?? r.transferDate,
        reconcileAction: r.reconcile_action ?? r.reconcileAction,
        slips: Array.isArray(r.slips) ? r.slips.map((s: any) => ({
            id: s.id,
            url: s.url,
            createdAt: s.created_at ?? s.createdAt,
            uploadedBy: s.uploaded_by ?? s.uploadedBy,
            uploadedByName: s.uploaded_by_name ?? s.uploadedByName,
        })) : [],
        verificationInfo: r.verified_by ? {
            verifiedBy: r.verified_by,
            verifiedByName: r.verified_by_name ?? "",
            verifiedAt: r.verified_at ?? "",
        } : undefined
    };
};
