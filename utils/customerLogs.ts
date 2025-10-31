import {
  CustomerBehavioralStatus,
  CustomerLifecycleStatus,
  CustomerLog,
  User,
} from "../types";

const parseJsonSafely = (value: any) => {
  if (value === null || typeof value === "undefined" || value === "") return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn("Failed to parse customer log JSON field", value, error);
    return null;
  }
};

export const actionLabels: Record<CustomerLog["actionType"], string> = {
  create: "สร้างข้อมูลลูกค้า",
  update: "ปรับปรุงข้อมูลลูกค้า",
  delete: "ลบข้อมูลลูกค้า",
};

const bucketLabels: Record<string, string> = {
  ready: "ตะกร้าพร้อมแจก",
  assigned: "มอบหมายแล้ว",
  waiting_return: "รอส่งคืน",
  stock: "สต็อก",
};

const lifecycleLabels: Record<string, string> = {
  [CustomerLifecycleStatus.New]: "ลูกค้าใหม่",
  [CustomerLifecycleStatus.Old]: "ลูกค้าเดิม",
  [CustomerLifecycleStatus.FollowUp]: "ติดตาม",
  [CustomerLifecycleStatus.Old3Months]: "ลูกค้าเกิน 3 เดือน",
  [CustomerLifecycleStatus.DailyDistribution]: "ลูกค้าแจกประจำวัน",
};

const behavioralLabels: Record<string, string> = {
  [CustomerBehavioralStatus.Hot]: "ลูกค้ากลุ่ม Hot",
  [CustomerBehavioralStatus.Warm]: "ลูกค้ากลุ่ม Warm",
  [CustomerBehavioralStatus.Cold]: "ลูกค้ากลุ่ม Cold",
  [CustomerBehavioralStatus.Frozen]: "ลูกค้ากลุ่ม Frozen",
};

const fieldLabelMap: Record<string, string> = {
  bucket_type: "ตะกร้าปัจจุบัน",
  lifecycle_status: "สถานะลูกค้า",
  behavioral_status: "ระดับความสนใจ",
  assigned_to: "ผู้ดูแล",
  email: "อีเมล",
  phone: "เบอร์โทร",
  first_name: "ชื่อ",
  last_name: "นามสกุล",
  ownership_expires: "วันหมดสิทธิ์ครอบครอง",
  date_assigned: "วันที่มอบหมาย",
  follow_up_date: "วันติดตาม",
  do_reason: "เหตุผลการ DO",
  grade: "เกรดลูกค้า",
};

export const formatCustomerLogFieldLabel = (field: string) =>
  fieldLabelMap[field] ?? field;

export const formatCustomerLogValue = (
  field: string,
  value: unknown,
  usersById: Map<number, User>,
): string => {
  if (value === null || typeof value === "undefined") return "-";

  if (field === "assigned_to") {
    const numericId = Number(value);
    if (!Number.isNaN(numericId)) {
      const assignedUser = usersById.get(numericId);
      return assignedUser
        ? `${assignedUser.firstName} ${assignedUser.lastName}`
        : `ผู้ใช้ ID ${numericId}`;
    }
  }
  if (field === "bucket_type") {
    return bucketLabels[String(value)] ?? String(value);
  }
  if (field === "lifecycle_status") {
    return lifecycleLabels[String(value)] ?? String(value);
  }
  if (field === "behavioral_status") {
    return behavioralLabels[String(value)] ?? String(value);
  }
  if (typeof value === "boolean") {
    return value ? "ใช่" : "ไม่ใช่";
  }
  if (typeof value === "number") {
    return value.toLocaleString("th-TH");
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return "-";
    const tryDate = new Date(trimmed);
    if (
      !Number.isNaN(tryDate.getTime()) &&
      /\d{4}-\d{2}-\d{2}/.test(trimmed)
    ) {
      return tryDate.toLocaleString("th-TH", {
        dateStyle: "medium",
        timeStyle: trimmed.length > 10 ? "short" : undefined,
      });
    }
    return trimmed;
  }
  if (Array.isArray(value) || typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

export const parseCustomerLogRow = (row: any): CustomerLog => {
  const parsedOld = parseJsonSafely(row?.old_values);
  const parsedNew = parseJsonSafely(row?.new_values);
  const parsedChanged = parseJsonSafely(row?.changed_fields);

  return {
    id: Number(row?.id ?? 0),
    customerId: row?.customer_id ?? "",
    actionType: (row?.action_type ?? "update") as CustomerLog["actionType"],
    bucketType: row?.bucket_type ?? null,
    lifecycleStatus: row?.lifecycle_status ?? null,
    assignedTo:
      row?.assigned_to === null || typeof row?.assigned_to === "undefined"
        ? null
        : Number(row.assigned_to),
    oldValues:
      parsedOld && typeof parsedOld === "object" && !Array.isArray(parsedOld)
        ? parsedOld
        : null,
    newValues:
      parsedNew && typeof parsedNew === "object" && !Array.isArray(parsedNew)
        ? parsedNew
        : null,
    changedFields: Array.isArray(parsedChanged)
      ? parsedChanged.filter(
          (field: any) => typeof field === "string" && field.trim().length > 0,
        )
      : null,
    createdBy:
      row?.created_by === null || typeof row?.created_by === "undefined"
        ? null
        : Number(row.created_by),
    createdByName: row?.created_by_name ?? null,
    createdAt: row?.created_at ?? "",
  };
};

export const buildCustomerLogChanges = (
  log: CustomerLog,
): Array<{ field: string; oldValue: unknown; newValue: unknown }> => {
  const candidateFields =
    (log.changedFields && log.changedFields.length
      ? log.changedFields
      : Array.from(
          new Set([
            ...Object.keys((log.oldValues as Record<string, unknown>) ?? {}),
            ...Object.keys((log.newValues as Record<string, unknown>) ?? {}),
          ]),
        )) || [];

  return candidateFields
    .map((field) => {
      const oldValue =
        log.oldValues && Object.prototype.hasOwnProperty.call(log.oldValues, field)
          ? (log.oldValues as Record<string, unknown>)[field]
          : undefined;
      const newValue =
        log.newValues && Object.prototype.hasOwnProperty.call(log.newValues, field)
          ? (log.newValues as Record<string, unknown>)[field]
          : undefined;

      if (
        log.actionType === "update" &&
        (oldValue === newValue || (oldValue == null && newValue == null))
      ) {
        return null;
      }

      return { field, oldValue, newValue };
    })
    .filter(
      (
        item,
      ): item is { field: string; oldValue: unknown; newValue: unknown } =>
        Boolean(item),
    );
};

export const summarizeCustomerLogChanges = (
  log: CustomerLog,
  usersById: Map<number, User>,
  options?: { allowedFields?: string[] },
): string[] => {
  const allowedFields = options?.allowedFields;
  let entries = buildCustomerLogChanges(log);

  if (
    log.actionType === "create" &&
    (!entries.length || allowedFields?.length)
  ) {
    const newValues = (log.newValues as Record<string, unknown>) ?? {};
    const fields = allowedFields?.length
      ? allowedFields
      : Object.keys(newValues);
    entries = fields
      .filter((field) => field in newValues)
      .map((field) => ({
        field,
        oldValue: undefined,
        newValue: newValues[field],
      }));
  }

  const summaries: string[] = [];

  for (const { field, oldValue, newValue } of entries) {
    if (allowedFields && !allowedFields.includes(field)) continue;

    const label = formatCustomerLogFieldLabel(field);
    const oldText = formatCustomerLogValue(field, oldValue, usersById);
    const newText = formatCustomerLogValue(field, newValue, usersById);

    const hasOld =
      oldValue !== null &&
      typeof oldValue !== "undefined" &&
      oldText !== "-" &&
      oldText !== "";
    const hasNew =
      newValue !== null &&
      typeof newValue !== "undefined" &&
      newText !== "-" &&
      newText !== "";

    if (
      log.actionType === "update" &&
      hasOld &&
      hasNew &&
      oldText === newText
    ) {
      continue;
    }

    if (!hasOld && !hasNew) continue;

    if (log.actionType === "create") {
      if (hasNew) {
        summaries.push(`${label}: ${newText}`);
      }
      continue;
    }

    if (hasOld && hasNew) {
      summaries.push(`${label}: ${oldText} → ${newText}`);
      continue;
    }

    if (hasOld && !hasNew) {
      summaries.push(`${label}: ${oldText} → -`);
      continue;
    }

    if (!hasOld && hasNew) {
      summaries.push(`${label}: - → ${newText}`);
    }
  }

  return summaries;
};
