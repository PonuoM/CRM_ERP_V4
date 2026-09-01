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

/**
 * ชื่อเหตุการณ์ตามที่มาของการเปลี่ยน
 *
 * `action_type` มีแค่ create/update/delete ทุกอย่างจึงขึ้นว่า "ปรับปรุงข้อมูลลูกค้า" เหมือนกันหมด
 * ทั้งที่การขาย การโอนให้คนอื่น การดึงคืน และการย้ายถังตามกฎ คือคนละเรื่องกันสิ้นเชิงสำหรับคนอ่าน
 * ที่มาจริงอยู่ใน api_source ซึ่งฝั่ง API ส่งมาให้แล้ว ตารางนี้แค่แปลให้เป็นภาษาคน
 */
const eventLabels: Record<string, string> = {
  // ---- การแจกและการถือครอง ----
  distribution_v2: "แจกลูกค้า",
  distribution_v2_undo: "ยกเลิกการแจก",
  "basket_config/distribute": "แจกลูกค้า",
  "basket_config/reclaim": "ดึงคืนเข้าถังกลาง",
  "basket_config/transfer": "โอนให้พนักงานคนอื่น",
  "transfer_request/approve": "โอนตามคำขอที่อนุมัติแล้ว",
  monthly_cron: "ระบบดึงคืนรอบเดือน",
  "cron/basket_return_to_owner": "ระบบคืนลูกค้าให้เจ้าของเดิม",
  "ownership/status_check": "หมดสิทธิ์ครอบครอง ระบบปลดออก",
  "ownership/redistribute": "ส่งกลับเข้าคิวแจกใหม่",
  "ownership/retrieve": "ดึงลูกค้ากลับมาดูแล",
  "ownership/followup_quota": "ต่อเวลาติดตาม",

  // ---- การขาย ----
  "ownership/sale": "ปิดการขายได้",
  "orders/proxy_sale_claim": "ขายแทนแล้วโอนเข้าผู้ดูแล",
  "orders/batch_export": "เปิดบิล/ส่งออก",
  "import/sales": "นำเข้ายอดขาย",
  "import/sales_fast": "นำเข้ายอดขาย",

  // ---- คนแก้ไขเอง ----
  "index/customer_update": "แก้ไขข้อมูลลูกค้า",
  "index/blocked_customers": "จัดการลูกค้าบล็อค",

  // ---- กฎอัตโนมัติของถัง ----
  "basket_routing_v2/picking_upsell_sold": "ขายได้ → เข้าถัง Upsell",
  "basket_routing_v2/picking_upsell_not_sold": "ไม่ปิดการขาย → ออกจากถัง Upsell",
  "basket_routing_v2/picking_dist_to_pool": "หมดเวลาถือครอง → คืนถังกลาง",
  "basket_routing_v2/pending_admin_owned": "รอแอดมินปิดบิล",
  "basket_routing_v2/pending_admin_unowned": "รอแอดมินปิดบิล (ยังไม่มีเจ้าของ)",
  "basket_routing_v2/picking_telesale_own": "เทเลปิดบิลเอง",
  "basket_routing_v2/picking_upsell_return_39": "คืนถังส่วนตัว 1-2 เดือน",
  "basket_routing_v2/cancelled_dist_to_pool": "ยกเลิกบิล → คืนถังกลาง",
  "cron/process_picking_baskets": "ระบบจัดถังตามกฎ",
  "cron/basket_reevaluate_safety": "ระบบตรวจทานถังซ้ำ",
  "cron/full_recalc_baskets": "ระบบคำนวณถังใหม่ทั้งหมด",
  "cron/process_upsell_51_exit": "หมดเวลาถัง Upsell",
  "cron/process_upsell_by_others": "Upsell โดยพนักงานคนอื่น",
  "cron/process_upsell_distribution": "แจกถัง Upsell",
  "cron/upsell_exit_handler": "ออกจากถัง Upsell",
};

/**
 * ที่มาที่บอกได้แค่ว่า "ไม่รู้"
 *
 * direct_db คือ UPDATE ที่วิ่งเข้ามาโดยไม่มีใครติดป้ายไว้ ส่วน unknown_api คือของเก่าก่อนระบบ audit
 * แยกให้เห็นชัดดีกว่ากลบเป็น "ปรับปรุงข้อมูลลูกค้า" เพราะแถวพวกนี้แปลว่ายังมีช่องโหว่ให้ปิด
 */
const opaqueSources = new Set(["direct_db", "unknown_api", ""]);

export const isOpaqueLogSource = (apiSource?: string | null): boolean =>
  opaqueSources.has((apiSource ?? "").trim());

/** ชื่อเหตุการณ์ที่จะขึ้นเป็นหัวข้อของแต่ละบรรทัดในฟีด */
export const describeCustomerLogEvent = (log: CustomerLog): string => {
  if (log.actionType !== "update") return actionLabels[log.actionType];

  const source = (log.apiSource ?? "").trim();
  const known = eventLabels[source];
  if (known) return known;

  if (isOpaqueLogSource(source)) {
    // ไม่เดาแทนข้อมูลที่ไม่มี บอกตรง ๆ ว่าไม่รู้ที่มา แล้วให้รายละเอียดข้างล่างเล่าเท่าที่เล่าได้
    return "ไม่ทราบที่มา";
  }

  // ที่มาใหม่ที่ยังไม่ได้แปล ดีกว่าโชว์ว่า "ปรับปรุงข้อมูลลูกค้า" เพราะอย่างน้อยตามรอยกลับไปได้
  return `ปรับปรุงข้อมูลลูกค้า (${source})`;
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
  current_basket_key: "ถัง",
  backup_phone: "เบอร์สำรอง",
  recipient_phone: "เบอร์ผู้รับ",
  facebook_name: "ชื่อ Facebook",
  line_id: "LINE ID",
  birth_date: "วันเกิด",
  street: "ที่อยู่",
  subdistrict: "ตำบล/แขวง",
  district: "อำเภอ/เขต",
  province: "จังหวัด",
  postal_code: "รหัสไปรษณีย์",
  is_blocked: "สถานะบล็อค",
};

export const formatCustomerLogFieldLabel = (field: string) =>
  fieldLabelMap[field] ?? field;

export const formatCustomerLogValue = (
  field: string,
  value: unknown,
  usersById: Map<number, User>,
  /** basket id → ชื่อถัง จากแถวนั้น ๆ ที่ฝั่ง API แนบมาให้ */
  basketLabels?: Record<string, string> | null,
  /** user id → ชื่อ จากฝั่ง API ครอบคลุมพนักงานที่ปิดบัญชีไปแล้วซึ่งไม่มีในรายชื่อฝั่งหน้าเว็บ */
  userLabels?: Record<string, string> | null,
): string => {
  if (value === null || typeof value === "undefined") return "-";

  if (field === "current_basket_key") {
    const key = String(value);
    // ไม่มีชื่อก็ยังบอกเลขไว้ ดีกว่าเงียบ ถังที่ถูกลบไปแล้วยังต้องตามรอยได้
    return basketLabels?.[key] ?? `ถัง ${key}`;
  }
  if (field === "is_blocked") {
    return String(value) === "1" || value === true ? "ถูกบล็อค" : "ปกติ";
  }

  if (field === "assigned_to") {
    const numericId = Number(value);
    if (!Number.isNaN(numericId)) {
      const assignedUser = usersById.get(numericId);
      if (assignedUser) return `${assignedUser.firstName} ${assignedUser.lastName}`;
      // รายชื่อฝั่งหน้าเว็บมาช้าและไม่มีคนที่ปิดบัญชี ฝั่ง API จึงส่งชื่อสำรองมาให้
      const fromServer = userLabels?.[String(numericId)];
      return fromServer || `ผู้ใช้ ID ${numericId}`;
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
    apiSource: row?.api_source ?? null,
    basketLabels:
      row?.basket_labels && typeof row.basket_labels === "object"
        ? (row.basket_labels as Record<string, string>)
        : null,
    userLabels:
      row?.user_labels && typeof row.user_labels === "object"
        ? (row.user_labels as Record<string, string>)
        : null,
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
    const oldText = formatCustomerLogValue(field, oldValue, usersById, log.basketLabels, log.userLabels);
    const newText = formatCustomerLogValue(field, newValue, usersById, log.basketLabels, log.userLabels);

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
