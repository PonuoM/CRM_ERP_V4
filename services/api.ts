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
  error?: string;
};

const base = 'api/index.php/'; // works with or without Apache rewrite

export async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null; // non-JSON response
  }

  if (!res.ok) {
    const errMsg = (data && (data.message || data.error)) || res.statusText || 'API error';
    const err = new Error(`API ${res.status}: ${errMsg}`);
    (err as any).status = res.status;
    (err as any).data = data ?? text;
    throw err;
  }
  return data;
}

export async function health(): Promise<{ ok: boolean; status: string }> {
  return apiFetch('health');
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  return apiFetch('auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

// Attendance APIs
export async function listAttendance(params: { userId?: number; date?: string; start?: string; end?: string; roleOnly?: 'telesale'|'all'; kpis?: boolean; companyId?: number }) {
  const qs = new URLSearchParams();
  if (params.userId) qs.set('userId', String(params.userId));
  if (params.date) qs.set('date', params.date);
  if (params.start) qs.set('start', params.start);
  if (params.end) qs.set('end', params.end);
  if (params.roleOnly) qs.set('roleOnly', params.roleOnly);
  if (params.companyId) qs.set('companyId', String(params.companyId));
  const path = params.kpis ? 'attendance/kpis' : 'attendance';
  return apiFetch(`${path}${qs.toString() ? `?${qs}` : ''}`);
}

export async function checkInAttendance(userId: number) {
  return apiFetch('attendance/check_in', { method: 'POST', body: JSON.stringify({ userId }) });
}

export async function listCustomers(params?: { q?: string; companyId?: number; bucket?: string; userId?: number }) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.companyId) qs.set('companyId', String(params.companyId));
  if (params?.bucket) qs.set('bucket', params.bucket);
  if (params?.userId) qs.set('userId', String(params.userId));
  const query = qs.toString();
  return apiFetch(`customers${query ? `?${query}` : ''}`);
}

export async function listUsers() {
  return apiFetch('users');
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
}) {
  return apiFetch('users', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateUser(id: number, payload: Partial<{
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
}>) {
  return apiFetch(`users/${encodeURIComponent(String(id))}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteUser(id: number) {
  return apiFetch(`users/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
}

export async function listProducts() {
  return apiFetch('products');
}

export async function createProduct(payload: any) {
  return apiFetch('products', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateProduct(id: number, payload: any) {
  return apiFetch(`products/${encodeURIComponent(String(id))}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteProduct(id: number) {
  return apiFetch(`products/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
}

export async function listPromotions() {
  return apiFetch('promotions');
}

export async function createPromotion(promotionData: any) {
  return apiFetch('promotions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(promotionData)
  });
}

export async function updatePromotion(id: number, promotionData: any) {
  return apiFetch(`promotions/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(promotionData)
  });
}

export async function deletePromotion(id: number) {
  return apiFetch(`promotions/${id}`, {
    method: 'DELETE'
  });
}

export async function listPages(companyId?: number) {
  const qs = new URLSearchParams();
  if (companyId) qs.set('companyId', String(companyId));
  return apiFetch(`pages${companyId ? `?${qs}` : ''}`);
}

export async function createPage(payload: { name: string; platform?: string; url?: string; companyId: number; active?: boolean; }) {
  return apiFetch('pages', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updatePage(id: number, payload: Partial<{ name: string; platform: string; url?: string; companyId: number; active: boolean; }>) {
  return apiFetch(`pages/${encodeURIComponent(String(id))}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function listOrders() {
  return apiFetch('orders');
}

export async function listAppointments(customerId?: string) {
  const qs = new URLSearchParams();
  if (customerId) qs.set('customerId', customerId);
  return apiFetch(`appointments${customerId ? `?${qs}` : ''}`);
}

export async function listCallHistory(customerId?: string) {
  const qs = new URLSearchParams();
  if (customerId) qs.set('customerId', customerId);
  return apiFetch(`call_history${customerId ? `?${qs}` : ''}`);
}

// Marketing: Ad spend
export async function listAdSpend(pageId?: number) {
  const qs = new URLSearchParams();
  if (pageId) qs.set('pageId', String(pageId));
  return apiFetch(`ad_spend${pageId ? `?${qs}` : ''}`);
}

export async function createAdSpend(payload: { pageId: number; date?: string; amount: number; notes?: string }) {
  return apiFetch('ad_spend', { method: 'POST', body: JSON.stringify(payload) });
}

// Mutations
export async function createCustomer(payload: any) {
  return apiFetch('customers', { method: 'POST', body: JSON.stringify(payload) });
}

export async function createOrder(payload: any) {
  return apiFetch('orders', { method: 'POST', body: JSON.stringify(payload) });
}

export async function patchOrder(id: string, payload: any) {
  return apiFetch(`orders/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function updateCustomer(id: string, payload: any) {
  return apiFetch(`customers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function createAppointment(payload: any) {
  return apiFetch('appointments', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateAppointment(id: number, payload: any) {
  return apiFetch(`appointments/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function createCall(payload: any) {
  return apiFetch('call_history', { method: 'POST', body: JSON.stringify(payload) });
}

export async function listTags() {
  return apiFetch('tags');
}

export async function createTag(payload: any) {
  return apiFetch('tags', { method: 'POST', body: JSON.stringify(payload) });
}

export async function deleteTag(id: number) {
  return apiFetch(`tags/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
}

// Role permissions (menu visibility/usage)
export async function getRolePermissions(role: string) {
  const qs = new URLSearchParams({ role });
  return apiFetch(`permissions?${qs}`);
}

export async function saveRolePermissions(role: string, data: any) {
  return apiFetch('permissions', { method: 'PUT', body: JSON.stringify({ role, data }) });
}

export async function listActivities(customerId?: string) {
  const qs = new URLSearchParams();
  if (customerId) qs.set('customerId', customerId);
  return apiFetch(`activities${customerId ? `?${qs}` : ''}`);
}

export async function createActivity(payload: any) {
  return apiFetch('activities', { method: 'POST', body: JSON.stringify(payload) });
}

export async function addCustomerTag(customerId: string, tagId: number) {
  return apiFetch('customer_tags', { method: 'POST', body: JSON.stringify({ customerId, tagId }) });
}

export async function removeCustomerTag(customerId: string, tagId: number) {
  const qs = new URLSearchParams({ customerId, tagId: String(tagId) });
  return apiFetch(`customer_tags?${qs}`, { method: 'DELETE' });
}

export async function listCustomerTags(customerId?: string) {
  const qs = new URLSearchParams();
  if (customerId) qs.set('customerId', customerId);
  return apiFetch(`customer_tags${customerId ? `?${qs}` : ''}`);
}

export async function listDoDashboard(userId: number, companyId?: number) {
  const qs = new URLSearchParams();
  qs.set('userId', String(userId));
  if (companyId) qs.set('companyId', String(companyId));
  return apiFetch(`do_dashboard?${qs}`);
}

// Export history
export async function listExports() {
  return apiFetch('exports');
}

export async function createExportLog(payload: { filename: string; contentBase64: string; ordersCount: number; userId?: number; exportedBy?: string; }) {
  return apiFetch('exports', { method: 'POST', body: JSON.stringify(payload) });
}

export function downloadExportUrl(id: number | string) {
  return `api/index.php/exports/${encodeURIComponent(String(id))}?download=1`;
}

// Order slips (multi-image)
export async function createOrderSlip(orderId: string, contentBase64: string) {
  return apiFetch('order_slips', { method: 'POST', body: JSON.stringify({ orderId, contentBase64 }) });
}

export async function listOrderSlips(orderId: string) {
  const qs = new URLSearchParams({ orderId });
  return apiFetch(`order_slips?${qs}`);
}

export async function deleteOrderSlip(id: number) {
  return apiFetch(`order_slips/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
}

// ==================== Companies API ====================
export async function listCompanies() {
  return apiFetch('companies');
}

export async function getCompany(id: number) {
  return apiFetch(`companies/${encodeURIComponent(String(id))}`);
}

export async function createCompany(payload: { name: string; address?: string; phone?: string; email?: string; taxId?: string }) {
  return apiFetch('companies', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateCompany(id: number, payload: Partial<{ name: string; address?: string; phone?: string; email?: string; taxId?: string }>) {
  return apiFetch(`companies/${encodeURIComponent(String(id))}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteCompany(id: number) {
  return apiFetch(`companies/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
}

// ==================== Warehouses API ====================
export async function listWarehouses(companyId?: number) {
  const qs = companyId ? new URLSearchParams({ companyId: String(companyId) }) : '';
  return apiFetch(`warehouses${qs ? '?' + qs : ''}`);
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
  return apiFetch('warehouses', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateWarehouse(id: number, payload: Partial<{
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
}>) {
  return apiFetch(`warehouses/${encodeURIComponent(String(id))}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteWarehouse(id: number) {
  return apiFetch(`warehouses/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
}

// ==================== Inventory Queries ====================
export async function listWarehouseStocks(params?: { warehouseId?: number; productId?: number; lotNumber?: string }) {
  const qs = new URLSearchParams();
  if (params?.warehouseId) qs.set('warehouseId', String(params.warehouseId));
  if (params?.productId) qs.set('productId', String(params.productId));
  if (params?.lotNumber) qs.set('lotNumber', params.lotNumber);
  const query = qs.toString();
  return apiFetch(`warehouse_stocks${query ? `?${query}` : ''}`);
}

export async function getProductTotalStock(productId: number) {
  return apiFetch(`products/${productId}/total_stock`);
}

export async function listProductLots(params?: { warehouseId?: number; productId?: number; status?: string; lotNumber?: string }) {
  const qs = new URLSearchParams();
  if (params?.warehouseId) qs.set('warehouseId', String(params.warehouseId));
  if (params?.productId) qs.set('productId', String(params.productId));
  if (params?.status) qs.set('status', params.status);
  if (params?.lotNumber) qs.set('lotNumber', params.lotNumber);
  const query = qs.toString();
  return apiFetch(`product_lots${query ? `?${query}` : ''}`);
}

export async function createProductLot(lotData: any) {
  return apiFetch('product_lots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lotData)
  });
}

export async function updateProductLot(lotId: number, lotData: any) {
  return apiFetch(`product_lots/${lotId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lotData)
  });
}

export async function deleteProductLot(lotId: number) {
  return apiFetch(`product_lots/${lotId}`, { method: 'DELETE' });
}

export async function listStockMovements(params?: { warehouseId?: number; productId?: number; lotNumber?: string; type?: string }) {
  const qs = new URLSearchParams();
  if (params?.warehouseId) qs.set('warehouseId', String(params.warehouseId));
  if (params?.productId) qs.set('productId', String(params.productId));
  if (params?.lotNumber) qs.set('lotNumber', params.lotNumber);
  if (params?.type) qs.set('type', params.type);
  const query = qs.toString();
  return apiFetch(`stock_movements${query ? `?${query}` : ''}`);
}

export async function listCallOverview(params?: { month?: string; userId?: number; companyId?: number }) {
  const qs = new URLSearchParams();
  if (params?.month) qs.set('month', params.month);
  if (params?.userId) qs.set('userId', String(params.userId));
  if (params?.companyId) qs.set('companyId', String(params.companyId));
  const query = qs.toString();
  return apiFetch('call_overview' + (query ? ('?' + query) : ''));
}

