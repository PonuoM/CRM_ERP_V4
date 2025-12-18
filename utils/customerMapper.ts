import { Customer, Tag, TagType, CustomerBehavioralStatus, CustomerLifecycleStatus } from "@/types";
import { calculateCustomerGrade } from "./customerGrade";

export const mapCustomerFromApi = (r: any): Customer => {
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
            r.lifecycle_status === "New"
                ? CustomerLifecycleStatus.New
                : r.lifecycle_status === "Old"
                    ? CustomerLifecycleStatus.Old
                    : r.lifecycle_status === "FollowUp"
                        ? CustomerLifecycleStatus.FollowUp
                        : r.lifecycle_status === "Old3Months"
                            ? CustomerLifecycleStatus.Old3Months
                            : r.lifecycle_status === "DailyDistribution"
                                ? CustomerLifecycleStatus.DailyDistribution
                                : (r.lifecycle_status ?? CustomerLifecycleStatus.New),
        behavioralStatus: (r.behavioral_status ??
            "Cold") as CustomerBehavioralStatus,
        grade: calculateCustomerGrade(totalPurchases),
        tags: Array.isArray(r.tags)
            ? r.tags.map((t: any) => ({
                id: Number(t.id),
                name: t.name,
                type:
                    (t.type as "SYSTEM" | "USER") === "SYSTEM"
                        ? TagType.System
                        : TagType.User,
                color: t.color ?? undefined,
            }))
            : [],
        assignmentHistory: [],
        totalPurchases,
        totalCalls: Number(r.total_calls || 0),
        facebookName: r.facebook_name ?? undefined,
        lineId: r.line_id ?? undefined,
        isInWaitingBasket: Boolean(r.is_in_waiting_basket ?? false),
        waitingBasketStartDate: r.waiting_basket_start_date ?? undefined,
        isBlocked: Boolean(r.is_blocked ?? false),
    };
};
