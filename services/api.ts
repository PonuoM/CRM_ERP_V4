import resolveApiBasePath from "@/utils/apiBasePath";

export type LoginResponse = {
  ok: boolean;
  user?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    role: string;
    company_id: number;
    team_id?: number;
    supervisor_id?: number;
  };
  token?: string;
  error?: string;
};

const apiBasePath =
  typeof window === "undefined" ? "/api" : resolveApiBasePath();
const base = `${apiBasePath.replace(/\/$/, "")}/index.php/`; // works with or without Apache rewrite

export async function apiFetch(path: string, init?: RequestInit) {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  const headers: any = { "Content-Type": "application/json", ...(init?.headers || {}) };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let url = `${base}${path}`;

  // Direct file access for inventory and product modules (bypassing index.php router)
  if (path.startsWith('inventory/') || path.startsWith('Product_DB/')) {
    const directBase = apiBasePath.replace(/\/$/, "");
    url = `${directBase}/${path}`;
  }

  const res = await fetch(url, {
    ...init,
    headers,
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null; // non-JSON response
  }

  if (!res.ok) {
    if (res.status === 401) {
      if (typeof window !== "undefined") {
        console.error("!!! 401 UNAUTHORIZED DETECTED - Auto-logout disabled for debugging !!!");
        // localStorage.removeItem("sessionUser");
        // localStorage.removeItem("authToken");
        // Force reload to trigger index.tsx check
        // if (!window.location.search.includes('login')) {
        //   window.location.reload();
        // }
      }
    }
    const errMsg =
      (data && (data.message || data.error)) || res.statusText || "API error";
    const err = new Error(`API ${res.status}: ${errMsg}`);
    (err as any).status = res.status;
    (err as any).data = data ?? text;
    throw err;
  }
  return data;
}

export async function health(): Promise<{ ok: boolean; status: string }> {
  return apiFetch("health");
}

export async function login(
  username: string,
  password: string,
): Promise<LoginResponse> {
  return apiFetch("auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

// Attendance APIs
export async function listAttendance(params: {
  userId?: number;
  date?: string;
  start?: string;
  end?: string;
  roleOnly?: "telesale" | "all";
  kpis?: boolean;
  companyId?: number;
}) {
  const qs = new URLSearchParams();
  if (params.userId) qs.set("userId", String(params.userId));
  if (params.date) qs.set("date", params.date);
  if (params.start) qs.set("start", params.start);
  if (params.end) qs.set("end", params.end);
  if (params.roleOnly) qs.set("roleOnly", params.roleOnly);
  if (params.companyId) qs.set("companyId", String(params.companyId));
  const path = params.kpis ? "attendance/kpis" : "attendance";
  return apiFetch(`${path}${qs.toString() ? `?${qs}` : ""}`);
}

export async function checkInAttendance(userId: number) {
  return apiFetch("attendance/check_in", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export async function listCustomers(params?: {
  q?: string;
  companyId?: number;
  bucket?: string;
  userId?: number;
  source?: "new_sale" | "waiting_return" | "stock";
  freshDays?: number; // only for source=new_sale
  province?: string;
  lifecycle?: string;
  behavioral?: string;
  assignedTo?: number;
  page?: number;
  pageSize?: number;
  // Advanced filters
  name?: string;
  phone?: string;
  grade?: string;
  hasOrders?: "all" | "yes" | "no";
  dateAssignedStart?: string;
  dateAssignedEnd?: string;
  ownershipStart?: string;
  ownershipEnd?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.companyId) qs.set("companyId", String(params.companyId));
  if (params?.bucket) qs.set("bucket", params.bucket);
  if (params?.userId) qs.set("userId", String(params.userId));
  if (params?.source) qs.set("source", params.source);
  if (params?.freshDays != null) qs.set("freshDays", String(params.freshDays));
  if (params?.province) qs.set("province", params.province);
  if (params?.lifecycle) qs.set("lifecycle", params.lifecycle);
  if (params?.behavioral) qs.set("behavioral", params.behavioral);
  if (params?.assignedTo) qs.set("assignedTo", String(params.assignedTo));
  if (params?.page) qs.set("page", String(params.page));
  if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
  // Pass userId to context (e.g. for upsell exclusion)
  if (params?.userId) qs.set("userId", String(params.userId));
  // Advanced filters
  if (params?.name) qs.set("name", params.name);
  if (params?.phone) qs.set("phone", params.phone);
  if (params?.grade) qs.set("grade", params.grade);
  if (params?.hasOrders && params.hasOrders !== "all") qs.set("hasOrders", params.hasOrders);
  if (params?.dateAssignedStart) qs.set("dateAssignedStart", params.dateAssignedStart);
  if (params?.dateAssignedEnd) qs.set("dateAssignedEnd", params.dateAssignedEnd);
  if (params?.ownershipStart) qs.set("ownershipStart", params.ownershipStart);
  if (params?.ownershipEnd) qs.set("ownershipEnd", params.ownershipEnd);

  const query = qs.toString();
  const response = await apiFetch(`customers${query ? `?${query}` : ""}`);

  // Normalize response to { total, data }
  if (Array.isArray(response)) {
    return { total: response.length, data: response };
  }
  return response as { total: number; data: any[] };
}

export async function listCustomersBySource(
  source: "new_sale" | "waiting_return" | "stock",
  opts?: { q?: string; companyId?: number; freshDays?: number },
) {
  return listCustomers({
    q: opts?.q,
    companyId: opts?.companyId,
    source,
    freshDays: opts?.freshDays,
  });
}

export async function listUsers(companyId?: number) {
  const qs = new URLSearchParams();
  if (companyId) qs.set("companyId", String(companyId));
  return apiFetch(`users${companyId ? `?${qs}` : ""}`);
}

export async function getCustomerStats(companyId: number) {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  const headers: any = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Use direct fetch for standalone PHP endpoint
  const url = `${apiBasePath.replace(/\/$/, "")}/customer/customer_stats.php?company_id=${companyId}`;

  const res = await fetch(
    url,
    {
      method: "GET",
      headers,
    }
  );

  if (!res.ok) {
    throw new Error(`Stats fetch failed: ${res.statusText}`);
  }

  return await res.json();
}

export async function getTelesaleUsers(companyId: number) {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  const headers: any = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${apiBasePath.replace(/\/$/, "")}/User_DB/telesale.php?company_id=${companyId}`;

  const res = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    throw new Error(`Telesale users fetch failed: ${res.statusText}`);
  }

  return await res.json();
}

export async function bulkDistributeCustomers(payload: {
  companyId: number;
  count: number;
  agentIds: number[];
  targetStatus: string;
  ownershipDays: number;
  filters?: {
    mode?: string;
    grade?: string;
  };
}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  const headers: any = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${apiBasePath.replace(/\/$/, "")}/customer/bulk_distribute.php`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Bulk distribution failed: ${res.statusText}`);
  }

  return await res.json();
}

// Admin Page users (Active only)
export interface AdminPageUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  role: string;
  company_id: number;
  team_id?: number;
  supervisor_id?: number;
  status?: string;
}

export async function listAdminPageUsers(): Promise<AdminPageUser[]> {
  // Use server filtering by status, then filter role on client to minimize server changes
  const qs = new URLSearchParams({ status: "active" });
  const users = await apiFetch(`users?${qs}`);
  return (Array.isArray(users) ? users : []).filter(
    (u: any) =>
      String(u.role) === "Admin Page" &&
      String(u.status || "active") === "active",
  );
}

export async function createUser(payload: {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  role: string;
  companyId: number;
  teamId?: number;
  supervisorId?: number;
  status?: "active" | "inactive" | "resigned";
}) {
  return apiFetch("users", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateUser(
  id: number,
  payload: Partial<{
    username: string;
    password: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    role: string;
    companyId: number;
    teamId?: number;
    supervisorId?: number;
    status?: "active" | "inactive" | "resigned";
  }>,
) {
  return apiFetch(`users/${encodeURIComponent(String(id))}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });


}

export async function deleteUser(id: number) {
  return apiFetch(`users/${encodeURIComponent(String(id))}`, {
    method: "DELETE",
  });
}

export async function listProducts(companyId?: number) {
  const qs = new URLSearchParams();
  if (companyId) qs.set("companyId", String(companyId));
  return apiFetch(`products${companyId ? `?${qs}` : ""}`);
}

export async function listPromotions(companyId?: number) {
  const qs = new URLSearchParams();
  if (companyId) qs.set("companyId", String(companyId));
  return apiFetch(`promotions${companyId ? `?${qs}` : ""}`);
}


export async function createProduct(payload: any) {
  return apiFetch("products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateProduct(id: number, payload: any) {
  return apiFetch(`products/${encodeURIComponent(String(id))}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteProduct(id: number) {
  return apiFetch(`products/${encodeURIComponent(String(id))}`, {
    method: "DELETE",
  });
}

export async function createPromotion(promotionData: any) {
  return apiFetch("promotions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(promotionData),
  });
}

export async function updatePromotion(id: number, promotionData: any) {
  return apiFetch(`promotions/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(promotionData),
  });
}

export async function deletePromotion(id: number) {
  return apiFetch(`promotions/${id}`, {
    method: "DELETE",
  });
}

export async function listPlatforms(
  companyId?: number,
  activeOnly?: boolean,
  userRole?: string,
) {
  const qs = new URLSearchParams();
  if (companyId) qs.set("companyId", String(companyId));
  if (activeOnly) qs.set("active", "true");
  if (userRole) qs.set("userRole", userRole);
  return apiFetch(`platforms${qs.toString() ? `?${qs}` : ""}`);
}

export async function createPlatform(payload: {
  name: string;
  displayName?: string;
  description?: string;
  companyId: number;
  active?: boolean;
  sortOrder?: number;
  showPagesFrom?: string | null;
  roleShow?: string[];
}) {
  return apiFetch("platforms", {
    method: "POST",
    body: JSON.stringify({
      name: payload.name,
      displayName: payload.displayName || payload.name,
      description: payload.description,
      companyId: payload.companyId,
      active: payload.active ?? true,
      sortOrder: payload.sortOrder ?? 0,
      showPagesFrom: payload.showPagesFrom && payload.showPagesFrom.trim() !== '' ? payload.showPagesFrom : null,
      roleShow: Array.isArray(payload.roleShow) && payload.roleShow.length > 0 ? payload.roleShow : null,
    }),
  });
}

export async function updatePlatform(id: number, payload: {
  name?: string;
  displayName?: string;
  description?: string;
  active?: boolean;
  sortOrder?: number;
  showPagesFrom?: string | null;
  roleShow?: string[] | null;
}) {
  // Build payload with showPagesFrom handling
  const updatePayload: any = { ...payload };

  // If showPagesFrom is explicitly provided (even if null), include it in the update
  if (payload.showPagesFrom !== undefined) {
    updatePayload.showPagesFrom = payload.showPagesFrom && payload.showPagesFrom.trim() !== ''
      ? payload.showPagesFrom
      : null;
  }

  if (payload.roleShow !== undefined) {
    updatePayload.roleShow =
      Array.isArray(payload.roleShow) && payload.roleShow.length > 0
        ? payload.roleShow
        : null;
  }

  return apiFetch(`platforms/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updatePayload),
  });
}

export async function deletePlatform(id: number) {
  return apiFetch(`platforms/${id}`, {
    method: "DELETE",
  });
}

// Bank Account API functions
export async function listBankAccounts(companyId?: number, activeOnly?: boolean) {
  const qs = new URLSearchParams();
  if (companyId) qs.set("companyId", String(companyId));
  if (activeOnly) qs.set("active", "true");
  return apiFetch(`bank_accounts${qs.toString() ? `?${qs}` : ""}`);
}

export async function createBankAccount(payload: {
  bank: string;
  bankNumber: string;
  companyId: number;
  isActive?: boolean;
}) {
  return apiFetch("bank_accounts", {
    method: "POST",
    body: JSON.stringify({
      bank: payload.bank,
      bankNumber: payload.bankNumber,
      companyId: payload.companyId,
      isActive: payload.isActive !== undefined ? payload.isActive : true,
    }),
  });
}

export async function updateBankAccount(id: number, payload: {
  bank?: string;
  bankNumber?: string;
  isActive?: boolean;
}) {
  return apiFetch(`bank_accounts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteBankAccount(id: number) {
  return apiFetch(`bank_accounts/${id}`, {
    method: "DELETE",
  });
}

export async function listPages(companyId?: number, pageType?: string, active?: number, checkPancakeShow?: boolean) {
  const qs = new URLSearchParams();
  if (companyId) qs.set("companyId", String(companyId));
  if (pageType) qs.set("page_type", pageType);
  if (active !== undefined) qs.set("active", String(active));
  if (checkPancakeShow) qs.set("CheckPancakeShow", "1");
  return apiFetch(`pages${qs.toString() ? `?${qs}` : ""}`);
}

export async function createPage(payload: {
  name: string;
  platform?: string;
  url?: string;
  companyId: number;
  active?: boolean;
}) {
  return apiFetch("pages", { method: "POST", body: JSON.stringify(payload) });
}

export async function updatePage(
  id: number,
  payload: Partial<{
    name: string;
    platform: string;
    url?: string;
    companyId: number;
    active: boolean;
  }>,
) {
  return apiFetch(`pages/${encodeURIComponent(String(id))}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// Fix: make params optional
export async function listOrders(params: {
  companyId?: number;
  page?: number;
  pageSize?: number;
  // Filter parameters
  orderId?: string;
  trackingNumber?: string;
  orderDateStart?: string;
  orderDateEnd?: string;
  deliveryDateStart?: string;
  deliveryDateEnd?: string;
  paymentMethod?: string;
  paymentStatus?: string | string[];
  customerName?: string;
  customerPhone?: string;
  creatorId?: number;
  orderStatus?: string | string[];
  tab?: string;
  signal?: AbortSignal;
} = {}): Promise<{
  ok: boolean;
  orders: any[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  tabCounts?: Record<string, number>;
}> {
  const qs = new URLSearchParams();
  const safeParams = params || {};
  if (safeParams.companyId) qs.set("companyId", String(safeParams.companyId));
  if (safeParams.page) qs.set("page", String(safeParams.page));
  if (safeParams.pageSize) qs.set("pageSize", String(safeParams.pageSize));

  // Add filter parameters
  if (safeParams.orderId) qs.set("orderId", safeParams.orderId);
  if (safeParams.trackingNumber) qs.set("trackingNumber", safeParams.trackingNumber);
  if (safeParams.orderDateStart) qs.set("orderDateStart", safeParams.orderDateStart);
  if (safeParams.orderDateEnd) qs.set("orderDateEnd", safeParams.orderDateEnd);
  if (safeParams.deliveryDateStart) qs.set("deliveryDateStart", safeParams.deliveryDateStart);
  if (safeParams.deliveryDateEnd) qs.set("deliveryDateEnd", safeParams.deliveryDateEnd);
  if (safeParams.paymentMethod) qs.set("paymentMethod", safeParams.paymentMethod);
  if (safeParams.paymentStatus) {
    if (Array.isArray(safeParams.paymentStatus)) {
      params.paymentStatus.forEach(s => qs.append("paymentStatus[]", s));
    } else {
      qs.set("paymentStatus", params.paymentStatus);
    }
  }
  if (params.customerName) qs.set("customerName", params.customerName);
  if (params.customerPhone) qs.set("customerPhone", params.customerPhone);
  if (params.creatorId) qs.set("creatorId", String(params.creatorId));
  if (params.orderStatus) {
    if (Array.isArray(params.orderStatus)) {
      params.orderStatus.forEach(s => qs.append("orderStatus[]", s));
    } else {
      qs.set("orderStatus", params.orderStatus);
    }
  }
  if (params.tab) qs.set("tab", params.tab);

  return apiFetch(`orders${qs.toString() ? `?${qs}` : ""}`, { signal: params.signal });
}

export async function getOrderCounts(companyId: number): Promise<{
  ok: boolean;
  tabCounts: Record<string, number>;
}> {
  return apiFetch(`order_counts?companyId=${companyId}`);
}

export async function getOrder(id: string) {
  return apiFetch(`orders/${encodeURIComponent(id)}`);
}

export async function listAppointments(customerId?: string) {
  const qs = new URLSearchParams();
  if (customerId) qs.set("customerId", customerId);
  return apiFetch(`appointments${customerId ? `?${qs}` : ""}`);
}

export async function listCallHistory(customerId?: string) {
  const qs = new URLSearchParams();
  if (customerId) qs.set("customerId", customerId);
  return apiFetch(`call_history${customerId ? `?${qs}` : ""}`);
}

// Marketing: Ad spend
export async function listAdSpend(pageId?: number) {
  const qs = new URLSearchParams();
  if (pageId) qs.set("pageId", String(pageId));
  return apiFetch(`ad_spend${pageId ? `?${qs}` : ""}`);
}

export async function createAdSpend(payload: {
  pageId: number;
  date?: string;
  amount: number;
  notes?: string;
}) {
  return apiFetch("ad_spend", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Mutations
export async function createCustomer(payload: any) {
  return apiFetch("customers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Helper to generate boxes based on items and payment method
function enrichOrderWithBoxes(payload: any) {
  if (payload.items && Array.isArray(payload.items)) {
    // Calculate max box number from items
    const maxBoxNumber = Math.max(
      ...payload.items.map((item: any) => item.boxNumber || item.box_number || 1),
      1
    );

    // Generate boxes array
    const boxes = [];
    for (let boxNum = 1; boxNum <= maxBoxNumber; boxNum++) {
      // Get items for this box
      const boxItems = payload.items.filter(
        (item: any) => (item.boxNumber || item.box_number || 1) === boxNum
      );

      // Calculate box amount
      let boxAmount = 0;

      if (payload.paymentMethod === 'Transfer' || payload.payment_method === 'Transfer') {
        // Transfer: Box 1 gets total, others get 0
        boxAmount = boxNum === 1 ? (payload.totalAmount || payload.total_amount || 0) : 0;
      } else {
        // Other methods: Calculate from items in this box
        boxAmount = boxItems.reduce((sum: number, item: any) => {
          const quantity = item.quantity || 0;
          const pricePerUnit = item.pricePerUnit || item.price_per_unit || 0;
          const discount = item.discount || 0;
          const isFreebie = item.isFreebie || item.is_freebie || false;

          const itemTotal = (pricePerUnit * quantity) - discount;
          return sum + (isFreebie ? 0 : itemTotal);
        }, 0);
      }

      boxes.push({
        box_number: boxNum,
        cod_amount: boxAmount,
        collection_amount: boxAmount,
        payment_method: payload.paymentMethod || payload.payment_method || null,
        status: 'PENDING'
      });
    }

    // Add boxes to payload
    payload.boxes = boxes;
  }
}

export async function updateOrder(id: string | number, data: any) {
  enrichOrderWithBoxes(data);
  return apiFetch(`orders/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function createOrder(payload: any) {
  return apiFetch("orders", { method: "POST", body: JSON.stringify(payload) });
}



export async function updateCustomer(id: string, payload: any) {
  return apiFetch(`customers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function patchOrder(id: string, payload: any) {
  enrichOrderWithBoxes(payload);

  // DEBUG: Log generated boxes
  console.log('Generated boxes:', {
    orderId: id,
    maxBoxNumber: payload.boxes?.length ? Math.max(...payload.boxes.map((b: any) => b.box_number)) : 0,
    boxesCount: payload.boxes?.length,
    boxes: payload.boxes,
    paymentMethod: payload.paymentMethod || payload.payment_method
  });

  // DEBUG: Log final payload
  console.log('patchOrder payload:', {
    orderId: id,
    hasBoxes: !!payload.boxes,
    boxesCount: payload.boxes?.length,
    payload: payload
  });

  return apiFetch(`orders/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}


export async function createAppointment(payload: any) {
  return apiFetch("appointments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAppointment(id: number, payload: any) {
  return apiFetch(`appointments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function createCall(payload: any) {
  return apiFetch("call_history", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listTags(params?: { type?: "SYSTEM" | "USER"; userId?: number }) {
  const qs = new URLSearchParams();
  if (params?.type) qs.set("type", params.type);
  if (params?.userId) qs.set("userId", String(params.userId));
  const query = qs.toString();
  return apiFetch(`tags${query ? `?${query}` : ""}`);
}

export async function createTag(payload: any) {
  return apiFetch("tags", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateTag(id: number, payload: { name?: string; color?: string }) {
  return apiFetch(`tags/${encodeURIComponent(String(id))}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteTag(id: number) {
  return apiFetch(`tags/${encodeURIComponent(String(id))}`, {
    method: "DELETE",
  });
}

// Role permissions (menu visibility/usage)
export async function getRolePermissions(role: string) {
  const qs = new URLSearchParams({ role });
  return apiFetch(`permissions?${qs}`);
}

export async function saveRolePermissions(role: string, data: any) {
  return apiFetch("permissions", {
    method: "PUT",
    body: JSON.stringify({ role, data }),
  });
}

export async function listActivities(customerId?: string) {
  const qs = new URLSearchParams();
  if (customerId) qs.set("customerId", customerId);
  return apiFetch(`activities${customerId ? `?${qs}` : ""}`);
}

export async function listCustomerLogs(
  customerId?: string,
  opts?: { limit?: number },
) {
  const qs = new URLSearchParams();
  if (customerId) qs.set("customerId", customerId);
  if (opts?.limit != null) qs.set("limit", String(opts.limit));
  const query = qs.toString();
  return apiFetch(`customer_logs${query ? `?${query}` : ""}`);
}

export async function createActivity(payload: any) {
  return apiFetch("activities", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Customer blocks
export async function createCustomerBlock(payload: {
  customerId: string;
  reason: string;
  blockedBy: number;
}) {
  return apiFetch("customer_blocks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listCustomerBlocks(customerId?: string) {
  const qs = new URLSearchParams();
  if (customerId) qs.set("customerId", customerId);
  return apiFetch(`customer_blocks${customerId ? `?${qs}` : ""}`);
}

export async function getOrderStats(companyId: number, month?: string, year?: string) {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const params = new URLSearchParams();
  params.set("company_id", String(companyId));
  if (month) params.set("month", month);
  if (year) params.set("year", year);

  const res = await fetch(`${apiBasePath}/Orders/order_stats.php?${params.toString()}`, {
    method: "GET",
    headers,
  });
  return res.json();
}

export async function unblockCustomerBlock(id: number, unblockedBy: number) {
  return apiFetch(`customer_blocks/${encodeURIComponent(String(id))}`, {
    method: "PATCH",
    body: JSON.stringify({ active: false, unblockedBy }),
  });
}

export async function addCustomerTag(customerId: string, tagId: number) {
  return apiFetch("customer_tags", {
    method: "POST",
    body: JSON.stringify({ customerId, tagId }),
  });
}

export async function removeCustomerTag(customerId: string, tagId: number) {
  const qs = new URLSearchParams({ customerId, tagId: String(tagId) });
  return apiFetch(`customer_tags?${qs}`, { method: "DELETE" });
}

export async function listCustomerTags(customerId?: string) {
  const qs = new URLSearchParams();
  if (customerId) qs.set("customerId", customerId);
  return apiFetch(`customer_tags${customerId ? `?${qs}` : ""}`);
}

export async function listDoDashboard(userId: number, companyId?: number) {
  const qs = new URLSearchParams();
  qs.set("userId", String(userId));
  if (companyId) qs.set("companyId", String(companyId));
  return apiFetch(`do_dashboard?${qs}`);
}

// Export history
export async function listExports() {
  return apiFetch("exports");
}

export async function createExportLog(payload: {
  filename: string;
  contentBase64: string;
  ordersCount: number;
  userId?: number;
  exportedBy?: string;
}) {
  return apiFetch("exports", { method: "POST", body: JSON.stringify(payload) });
}

export function downloadExportUrl(id: number | string) {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  let url = `api/index.php/exports/${encodeURIComponent(String(id))}?download=1`;
  if (token) {
    url += `&token=${encodeURIComponent(token)}`;
  }
  return url;
}

// Order slips (multi-image)
export async function createOrderSlip(
  orderId: string,
  contentBase64: string,
  options?: {
    bankAccountId?: number;
    transferDate?: string;
    amount?: number;
    uploadedBy?: number;
    uploadedByName?: string;
  }
) {
  return apiFetch("order_slips", {
    method: "POST",
    body: JSON.stringify({
      orderId,
      contentBase64,
      ...(options?.bankAccountId !== undefined && { bankAccountId: options.bankAccountId }),
      ...(options?.transferDate !== undefined && { transferDate: options.transferDate }),
      ...(options?.amount !== undefined && { amount: options.amount }),
      ...(options?.uploadedBy !== undefined && {
        uploadedBy: options.uploadedBy,
        uploadBy: options.uploadedBy,
        upload_by: options.uploadedBy,
      }),
      ...(options?.uploadedByName !== undefined && {
        uploadedByName: options.uploadedByName,
        uploadByName: options.uploadedByName,
        upload_by_name: options.uploadedByName,
      }),
    }),
  });
}

export async function listOrderSlips(orderId: string) {
  const qs = new URLSearchParams({ orderId });
  return apiFetch(`order_slips?${qs}`);
}

export async function deleteOrderSlip(id: number) {
  return apiFetch(`order_slips/${encodeURIComponent(String(id))}`, {
    method: "DELETE",
  });
}

// Upload slip image using FormData (for file upload)
export async function uploadSlipImageFile(orderId: string, file: File): Promise<{ success: boolean; url?: string; message?: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("order_id", orderId);

  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  const headers: any = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Use direct fetch for FormData (not through apiFetch which expects JSON)
  const res = await fetch(
    `${apiBasePath.replace(/\/$/, "")}/Slip_DB/upload_slip_image.php`,
    {
      method: "POST",
      headers,
      body: form,
    },
  );

  if (!res.ok) {
    throw new Error(`Upload failed: ${res.statusText}`);
  }

  const data = await res.json();
  return data;
}

// Create order slip with additional payment information
// Create order slip with additional payment information
export async function createOrderSlipWithPayment(data: {
  orderId: string;
  amount: number;
  bankAccountId: number;
  transferDate: string;
  url?: string | null;
  companyId?: number;
  uploadBy?: number;
  uploadByName?: string;
}): Promise<{ success: boolean; message?: string; data?: any }> {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  const headers: any = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Use direct fetch for legacy PHP endpoint (not through apiFetch router)
  const res = await fetch(
    `${apiBasePath.replace(/\/$/, "")}/Slip_DB/insert_order_slip.php`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        order_id: data.orderId,
        amount: data.amount,
        bank_account_id: data.bankAccountId,
        transfer_date: data.transferDate,
        url: data.url,
        company_id: data.companyId,
        upload_by: data.uploadBy,
        upload_by_name: data.uploadByName,
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`Request failed: ${res.statusText}`);
  }

  return await res.json();
}

// ==================== Companies API ====================
export async function listCompanies() {
  return apiFetch("companies");
}

export async function getCompany(id: number) {
  return apiFetch(`companies/${encodeURIComponent(String(id))}`);
}

export async function createCompany(payload: {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  taxId?: string;
}) {
  return apiFetch("companies", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCompany(
  id: number,
  payload: Partial<{
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    taxId?: string;
  }>,
) {
  return apiFetch(`companies/${encodeURIComponent(String(id))}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteCompany(id: number) {
  return apiFetch(`companies/${encodeURIComponent(String(id))}`, {
    method: "DELETE",
  });
}

// ==================== Warehouses API ====================
export async function listWarehouses(companyId?: number) {
  const qs = companyId
    ? new URLSearchParams({ companyId: String(companyId) })
    : "";
  return apiFetch(`warehouses${qs ? "?" + qs : ""}`);
}

export async function getWarehouse(id: number) {
  return apiFetch(`warehouses/${encodeURIComponent(String(id))}`);
}

export async function createWarehouse(payload: {
  name: string;
  companyId: number;
  address: string;
  province: string;
  district: string;
  subdistrict: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  managerName: string;
  managerPhone?: string;
  responsibleProvinces: string[];
  isActive?: boolean;
}) {
  return apiFetch("warehouses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateWarehouse(
  id: number,
  payload: Partial<{
    name: string;
    companyId: number;
    address: string;
    province: string;
    district: string;
    subdistrict: string;
    postalCode?: string;
    phone?: string;
    email?: string;
    managerName: string;
    managerPhone?: string;
    responsibleProvinces: string[];
    isActive: boolean;
  }>,
) {
  return apiFetch(`warehouses/${encodeURIComponent(String(id))}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteWarehouse(id: number) {
  return apiFetch(`warehouses/${encodeURIComponent(String(id))}`, {
    method: "DELETE",
  });
}

// ==================== Inventory Queries ====================
export async function listWarehouseStocks(params?: {
  warehouseId?: number;
  productId?: number;
  lotNumber?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.warehouseId) qs.set("warehouseId", String(params.warehouseId));
  if (params?.productId) qs.set("productId", String(params.productId));
  if (params?.lotNumber) qs.set("lotNumber", params.lotNumber);
  const query = qs.toString();
  return apiFetch(`warehouse_stocks${query ? `?${query}` : ""}`);
}

export async function getProductTotalStock(productId: number) {
  return apiFetch(`products/${productId}/total_stock`);
}

export interface ProductLot {
  id: number;
  lot_number: string;
  product_id: number;
  warehouse_id: number;
  purchase_date: string;
  expiry_date: string | null;
  quantity_received: number;
  quantity_remaining: number;
  unit_cost: number;
  status: string;
  notes?: string | null;
}

export async function listProductLots(params?: {
  warehouseId?: number;
  productId?: number;
  status?: string;
  lotNumber?: string;
}): Promise<ProductLot[]> {
  const qs = new URLSearchParams();
  if (params?.warehouseId != null) qs.set("warehouseId", String(params.warehouseId));
  if (params?.productId != null) qs.set("productId", String(params.productId));
  if (params?.status) qs.set("status", params.status);
  if (params?.lotNumber) qs.set("lotNumber", params.lotNumber);
  const query = qs.toString();
  return apiFetch(`product_lots${query ? `?${query}` : ""}`);
}

export async function createProductLot(lotData: any) {
  return apiFetch("product_lots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lotData),
  });
}

export async function updateProductLot(lotId: number, lotData: any) {
  return apiFetch(`product_lots/${lotId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lotData),
  });
}

export async function deleteProductLot(lotId: number) {
  return apiFetch(`product_lots/${lotId}`, { method: "DELETE" });
}

export async function listStockMovements(params?: {
  warehouseId?: number;
  productId?: number;
  lotNumber?: string;
  type?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.warehouseId) qs.set("warehouseId", String(params.warehouseId));
  if (params?.productId) qs.set("productId", String(params.productId));
  if (params?.lotNumber) qs.set("lotNumber", params.lotNumber);
  if (params?.type) qs.set("type", params.type);
  const query = qs.toString();
  return apiFetch(`stock_movements${query ? `?${query}` : ""}`);
}

export async function listCallOverview(params?: {
  month?: string;
  userId?: number;
  companyId?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.month) qs.set("month", params.month);
  if (params?.userId) qs.set("userId", String(params.userId));
  if (params?.companyId) qs.set("companyId", String(params.companyId));
  const query = qs.toString();
  return apiFetch("call_overview" + (query ? "?" + query : ""));
}

// ==================== Allocations (Backoffice) ====================
export async function listAllocations(params?: {
  orderId?: string;
  status?: "PENDING" | "ALLOCATED" | "PICKED" | "SHIPPED" | "CANCELLED";
}) {
  const qs = new URLSearchParams();
  if (params?.orderId) qs.set("order_id", params.orderId);
  if (params?.status) qs.set("status", params.status);
  const query = qs.toString();
  return apiFetch(`allocations${query ? `?${query}` : ""}`);
}

export async function updateAllocation(
  id: number,
  payload: Partial<{
    warehouseId: number;
    lotNumber?: string;
    allocatedQuantity?: number;
    status?: string;
    allowNegativeStock?: boolean;
  }>,
) {
  return apiFetch(`allocations/${encodeURIComponent(String(id))}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// ==================== User Pancake Mapping API ====================
export interface UserPancakeMapping {
  id: number;
  id_user: number;
  id_panake: string;
  created_at: string;
}

export async function listUserPancakeMappings(): Promise<UserPancakeMapping[]> {
  return apiFetch("user_pancake_mappings");
}

export async function createUserPancakeMapping(
  id_user: number,
  id_panake: string,
): Promise<UserPancakeMapping> {
  return apiFetch("user_pancake_mappings", {
    method: "POST",
    body: JSON.stringify({ id_user, id_panake }),
  });
}

export async function updateUserPancakeMapping(
  id: number,
  id_user: number,
  id_panake: string,
): Promise<UserPancakeMapping> {
  return apiFetch(`user_pancake_mappings/${id}`, {
    method: "PUT",
    body: JSON.stringify({ id_user, id_panake }),
  });
}

export async function deleteUserPancakeMapping(id: number): Promise<void> {
  return apiFetch(`user_pancake_mappings/${id}`, {
    method: "DELETE",
  });
}

// Customer Order Tracking Functions
export async function updateCustomerOrderTracking(
  customerId: string,
  orderDate: string,
): Promise<{
  success: boolean;
  customer_id?: string;
  first_order_date?: string;
  last_order_date?: string;
  order_count?: number;
  is_new_customer?: boolean;
  is_repeat_customer?: boolean;
  error?: string;
}> {
  return apiFetch("update_customer_order_tracking.php", {
    method: "POST",
    body: JSON.stringify({
      action: "update_single",
      customer_id: customerId,
      order_date: orderDate,
    }),
  });
}

export async function updateAllCustomersOrderTracking(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  return apiFetch("update_customer_order_tracking.php", {
    method: "POST",
    body: JSON.stringify({
      action: "update_all",
    }),
  });
}

// Page User Management APIs
export interface PageUser {
  id: number;
  user_id: number | null;
  page_user_id: string;
  page_user_name: string;
  page_count: number;
  created_at: string;
  updated_at: string;
}

export interface PageWithUsers {
  page_id: string;
  page_name: string;
  platform: string;
  active: boolean;
  url: string | null;
  users: Array<{
    page_user_id: string;
    page_user_name: string;
    internal_user_id: number | null;
    is_connected: boolean;
    status: string;
  }>;
}

export async function getPageUsers(): Promise<PageUser[]> {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  const headers: any = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch("api/get_page_users.php", { headers });
  if (!response.ok) {
    throw new Error("Failed to fetch page users");
  }
  const users = await response.json();
  return Array.isArray(users) ? users : [];
}

export async function getPagesWithUsers(
  companyId: number,
): Promise<PageWithUsers[]> {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  const headers: any = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch("api/get_pages_with_users.php", {
    method: "POST",
    headers,
    body: JSON.stringify({ companyId }),
  });
  if (!response.ok) {
    throw new Error("Failed to fetch pages with users");
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function updatePageUserConnection(
  pageUserId: number,
  internalUserId: number | null,
): Promise<{ ok: boolean; message?: string }> {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  const headers: any = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch("api/update_page_user_connection.php", {
    method: "POST",
    headers,
    body: JSON.stringify({
      pageUserId,
      internalUserId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update page user connection");
  }

  return await response.json();
}

// Upsell API functions
export async function checkUpsellEligibility(
  customerId: string | number,
  userId?: number,
): Promise<{ hasEligibleOrders: boolean; eligibleCount: number }> {
  const qs = new URLSearchParams({ customerId: String(customerId) });
  if (userId != null) {
    qs.set("userId", String(userId));
  }
  return apiFetch(`upsell/check?${qs.toString()}`);
}

export async function getUpsellOrders(customerId: string | number, userId?: number): Promise<any[]> {
  const qs = new URLSearchParams({ customerId: String(customerId) });
  if (userId != null) {
    qs.set("userId", String(userId));
  }
  return apiFetch(`upsell/orders?${qs.toString()}`);
}

export async function addUpsellItems(orderId: string, creatorId: number, items: any[]): Promise<{ success: boolean; orderId: string; newTotalAmount: number; items: any[] }> {
  return apiFetch("upsell/items", {
    method: "POST",
    body: JSON.stringify({ orderId, creatorId, items }),
  });
}

export async function listSentOrders(params: {
  month?: number;
  year?: number;
  startDate?: string;
  endDate?: string;
  bankId?: number;
  q?: string;
}) {
  const qs = new URLSearchParams();
  if (params.month) qs.set("month", String(params.month));
  if (params.year) qs.set("year", String(params.year));
  if (params.startDate) qs.set("startDate", params.startDate);
  if (params.endDate) qs.set("endDate", params.endDate);
  if (params.bankId) qs.set("bankId", String(params.bankId));
  if (params.q) qs.set("q", params.q);
  return apiFetch(`accounting_orders_sent?${qs.toString()}`);
}

export async function listApprovedOrders(params: {
  month: number;
  year: number;
  bankId?: number;
  q?: string;
}) {
  const qs = new URLSearchParams({
    month: String(params.month),
    year: String(params.year),
  });
  if (params.bankId) qs.set("bankId", String(params.bankId));
  if (params.q) qs.set("q", params.q);
  return apiFetch(`accounting_orders_approved?${qs.toString()}`);
}

export async function listStatementReport(params: {
  month: number;
  year: number;
  bankId?: number;
  q?: string;
}) {
  const qs = new URLSearchParams({
    month: String(params.month),
    year: String(params.year),
  });
  if (params.bankId) qs.set("bankId", String(params.bankId));
  if (params.q) qs.set("q", params.q);
  return apiFetch(`accounting_statement_report?${qs.toString()}`);
}

export async function getDashboardStats(params: {
  month: number;
  year: number;
}) {
  const qs = new URLSearchParams({
    month: String(params.month),
    year: String(params.year),
  });
  return apiFetch(`accounting_dashboard_stats?${qs.toString()}`);
  return apiFetch(`accounting_dashboard_stats?${qs.toString()}`);
}

export async function listOutstandingOrders(params: {
  month: number;
  year: number;
}) {
  const qs = new URLSearchParams({
    month: String(params.month),
    year: String(params.year),
  });
  return apiFetch(`accounting_outstanding_orders?${qs.toString()}`);
}

export async function updateOrderStatus(payload: {
  orderId: string | number;
  status: string;
  note?: string;
}) {
  return apiFetch(`accounting_update_order_status`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}


export async function updateOrderSlip(
  id: number,
  payload: {
    amount?: number;
    bankAccountId?: number;
    transferDate?: string;
    url?: string;
    updatedBy?: number;
    companyId?: number;
  }
) {
  const legacyBase =
    typeof window === "undefined" ? "/api" : resolveApiBasePath();
  const url = `${legacyBase.replace(/\/$/, "")}/Slip_DB/update_order_slip.php`;

  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  const headers: any = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      id: id,
      amount: payload.amount,
      bank_account_id: payload.bankAccountId,
      transfer_date: payload.transferDate,
      url: payload.url,
      updated_by: payload.updatedBy,
      company_id: payload.companyId,
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (data && (data.message || data.error)) ||
      res.statusText ||
      "Failed to update slip";
    throw new Error(message);
  }
  return data;
}

export async function listAIPriority(userId: number, companyId?: number) {
  const qs = new URLSearchParams();
  qs.set("userId", String(userId));
  if (companyId) qs.set("companyId", String(companyId));
  return apiFetch(`ai_priority?${qs}`);
}
// ... existing code ...
export async function createStockTransaction(payload: {
  type: 'receive' | 'adjustment';
  transaction_date: string;
  notes?: string;
  items: Array<{
    product_id: number;
    warehouse_id: number;
    quantity: number;
    lot_id?: number | null;
    new_lot_number?: string;
    mfg_date?: string;
    exp_date?: string;
    cost_price?: number;
    adjustment_type: 'add' | 'reduce' | 'receive';
    remarks?: string;
  }>;
  user_id?: number;
  document_number_manual?: string;
}) {
  return apiFetch("inventory/create_transaction.php", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listStockTransactions(params: {
  page?: number;
  pageSize?: number;
  type?: string;
  search?: string;
  month?: number;
  year?: number;
}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.type) qs.set("type", params.type);
  if (params.search) qs.set("search", params.search);
  if (params.month) qs.set("month", String(params.month));
  if (params.year) qs.set("year", String(params.year));

  return apiFetch(`inventory/list_transactions.php?${qs.toString()}`);
}

export async function getProductStockLocations(productId: number) {
  return apiFetch(`inventory/get_product_stock_locations.php?productId=${productId}`);
}

export async function getStockTransaction(id: number) {
  return apiFetch(`inventory/get_transaction.php?id=${id}`);
}

export async function updateStockTransaction(payload: any) {
  return apiFetch("inventory/update_transaction.php", {
    method: "POST", // or PUT
    body: JSON.stringify(payload),
  });
}

export async function deleteStockTransaction(id: number) {
  return apiFetch(`inventory/delete_transaction.php?id=${id}`, {
    method: "DELETE"
  });
}

export async function apiSyncTrackingNumbers(updates: {
  sub_order_id: string;
  tracking_number: string;
  shipping_provider: string;
}[]) {
  return apiFetch('sync_tracking', {
    method: 'POST',
    body: JSON.stringify({ updates })
  });
}

export async function validateTrackingBulk(items: { orderId: string; trackingNumber: string }[]) {
  return apiFetch('validate_tracking_bulk', {
    method: 'POST',
    body: JSON.stringify({ items })
  });
}
