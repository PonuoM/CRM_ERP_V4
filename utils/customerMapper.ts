import { Customer, CustomerLifecycleStatus, CustomerBehavioralStatus, Tag } from "../types";
import { calculateCustomerGrade } from "./customerGrade";

// Helper to normalize lifecycle status (copy from App.tsx or import if available)
export function normalizeLifecycleStatusValue(
    val: any
): CustomerLifecycleStatus | null {
    if (!val) return null;
    // If it's already a valid enum value, return it
    if (Object.values(CustomerLifecycleStatus).includes(val as any)) {
        return val as CustomerLifecycleStatus;
    }
    // Map legacy thai strings if needed
    if (val === "ลูกค้าใหม่") return CustomerLifecycleStatus.New;
    if (val === "ลูกค้าติดตาม") return CustomerLifecycleStatus.FollowUp;
    if (val === "ลูกค้าสนใจ") return CustomerLifecycleStatus.New;
    if (val === "ลูกค้าสั่งซื้อ") return CustomerLifecycleStatus.Old;
    if (val === "ลูกค้าสิ้นหวัง") return CustomerLifecycleStatus.Old;
    if (val === "ลูกค้าเก่า") return CustomerLifecycleStatus.Old;
    if (val === "ลูกค้าแจกรายวัน") return CustomerLifecycleStatus.DailyDistribution;

    return CustomerLifecycleStatus.New;
}

export function mapCustomerFromApi(r: any, tagsByCustomer: Record<string, Tag[]> = {}): Customer {
    const totalPurchases = Number(r.total_purchases || 0);
    const pk = r.customer_id ?? r.id ?? r.pk ?? null;
    const refId =
        r.customer_ref_id ??
        r.customer_ref ??
        r.customer_refid ??
        r.customerId ??
        null;
    const resolvedId =
        pk != null ? String(pk) : refId != null ? String(refId) : "";

    return {
        id: resolvedId,
        pk: pk != null ? Number(pk) : undefined,
        customerId: refId ?? undefined,
        customerRefId: refId ?? undefined,
        firstName: r.first_name,
        lastName: r.last_name,
        phone: r.phone,
        backupPhone: r.backup_phone ?? r.backupPhone ?? "",
        email: r.email ?? undefined,
        address: {
            recipientFirstName: r.recipient_first_name || "",
            recipientLastName: r.recipient_last_name || "",
            street: r.street || "",
            subdistrict: r.subdistrict || "",
            district: r.district || "",
            province: r.province || "",
            postalCode: r.postal_code || "",
        },
        province: r.province || "",
        companyId: r.company_id,
        assignedTo:
            r.assigned_to !== null && typeof r.assigned_to !== "undefined"
                ? Number(r.assigned_to)
                : null,
        dateAssigned: r.date_assigned,
        dateRegistered: r.date_registered ?? undefined,
        followUpDate: r.follow_up_date ?? undefined,
        ownershipExpires: r.ownership_expires ?? "",
        lifecycleStatus:
            normalizeLifecycleStatusValue(r.lifecycle_status) ??
            CustomerLifecycleStatus.New,
        behavioralStatus:
            (r.behavioral_status ?? "Cold") as CustomerBehavioralStatus,
        grade: calculateCustomerGrade(totalPurchases),
        tags: (Array.isArray(r.tags) ? r.tags : []) || tagsByCustomer[resolvedId] || [],
        assignmentHistory: [],
        totalPurchases,
        orderCount: Number(r.order_count || 0),
        totalCalls: Number(r.total_calls || 0),
        facebookName: r.facebook_name ?? undefined,
        lineId: r.line_id ?? undefined,
        isInWaitingBasket: Boolean(r.is_in_waiting_basket ?? false),
        waitingBasketStartDate: r.waiting_basket_start_date ?? undefined,
        isBlocked: Boolean(r.is_blocked ?? false),
        lastCallNote: r.last_call_note ?? undefined,
        last_call_date: r.last_call_date ?? undefined,
        last_call_id: r.last_call_id ?? undefined,
        isUpsellEligible: Boolean(r.is_upsell_eligible ?? r.isUpsellEligible ?? false),
        firstOrderDate: r.first_order_date ?? r.firstOrderDate ?? undefined,
        lastOrderDate: r.last_order_date ?? r.lastOrderDate ?? undefined,
        // Basket routing field - current_basket_key stores basket_config.id (as string/number)
        current_basket_key: r.current_basket_key ?? undefined,
        // AI Specific Fields (pass through if present)
        ai_priority_score: r.ai_priority_score,
        ai_insight: r.ai_insight,
        // Joined appointment data (from attach_next_appointments_to_customers)
        next_appointment_id: r.next_appointment_id ?? undefined,
        next_appointment_date: r.next_appointment_date ?? undefined,
        next_appointment_title: r.next_appointment_title ?? undefined,
        next_appointment_status: r.next_appointment_status ?? undefined,
        next_appointment_notes: r.next_appointment_notes ?? undefined,
        // Joined call status data (from attach_call_status_to_customers)
        last_call_date_by_owner: r.last_call_date_by_owner ?? undefined,
        call_count_by_owner: r.call_count_by_owner ?? 0,
        last_call_result_by_owner: r.last_call_result_by_owner ?? undefined,
        // Personal info
        birthDate: r.birth_date ?? undefined,
    } as any; // Cast as any to allow extra fields like aiScore
}
