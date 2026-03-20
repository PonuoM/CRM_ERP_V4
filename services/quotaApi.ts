/**
 * Quota System — Service Layer
 */
import { apiFetch } from './api';
import type {
  QuotaProduct,
  QuotaRateSchedule,
  QuotaAllocation,
  QuotaSummary,
} from '../types';

const QUOTA_API = 'Quota/quota.php';

// ============================================================
// Quota Products
// ============================================================

export async function listQuotaProducts(companyId: number): Promise<QuotaProduct[]> {
  const res = await apiFetch(`${QUOTA_API}?action=list_products&companyId=${companyId}`);
  return (res.data || []).map(mapQuotaProduct);
}

export async function createQuotaProduct(payload: {
  productId: number;
  companyId: number;
  displayName: string;
  csvLabel?: string;
  quotaCost?: number;
}): Promise<{ success: boolean; id?: number }> {
  return apiFetch(QUOTA_API, {
    method: 'POST',
    body: JSON.stringify({ action: 'create_product', ...payload }),
  });
}

/** Create a brand new product + quota product in one transaction */
export async function createQuotaProductWithNew(payload: {
  companyId: number;
  displayName: string;
  csvLabel?: string;
  quotaCost?: number;
  sku: string;
  productName?: string;
  price?: number;
  category?: string;
  shop?: string;
  description?: string;
}): Promise<{ success: boolean; id?: number; productId?: number }> {
  return apiFetch(QUOTA_API, {
    method: 'POST',
    body: JSON.stringify({ action: 'create_product_with_quota', ...payload }),
  });
}

export async function updateQuotaProduct(payload: {
  id: number;
  displayName?: string;
  csvLabel?: string;
  isActive?: boolean;
  quotaCost?: number;
}): Promise<{ success: boolean }> {
  return apiFetch(QUOTA_API, {
    method: 'POST',
    body: JSON.stringify({ action: 'update_product', ...payload }),
  });
}

// ============================================================
// Rate Schedules
// ============================================================

export async function getActiveRate(quotaProductId: number): Promise<QuotaRateSchedule | null> {
  const res = await apiFetch(`${QUOTA_API}?action=get_rate&quotaProductId=${quotaProductId}`);
  return res.data ? mapRateSchedule(res.data) : null;
}

export async function listRateSchedules(companyId: number): Promise<QuotaRateSchedule[]> {
  const res = await apiFetch(`${QUOTA_API}?action=list_rates&companyId=${companyId}`);
  return (res.data || []).map(mapRateSchedule);
}

export async function createRateSchedule(payload: {
  rateName?: string;
  salesPerQuota: number;
  effectiveDate: string;
  orderDateField: 'order_date' | 'delivery_date';
  calcPeriodStart?: string;
  calcPeriodEnd?: string;
  usageStartDate?: string;
  usageEndDate?: string;
  requireConfirm?: boolean;
  createdBy?: number;
  scopeRates: Array<{ quotaProductId: number; salesPerQuota: number }>;
}): Promise<{ success: boolean; id?: number }> {
  return apiFetch(QUOTA_API, {
    method: 'POST',
    body: JSON.stringify({ action: 'create_rate', quotaMode: 'confirm', ...payload }),
  });
}

export async function updateRateSchedule(payload: {
  id: number;
  rateName?: string;
  salesPerQuota?: number;
  effectiveDate?: string;
  orderDateField?: 'order_date' | 'delivery_date';
  calcPeriodStart?: string | null;
  calcPeriodEnd?: string | null;
  usageStartDate?: string | null;
  usageEndDate?: string | null;
  requireConfirm?: boolean | null;
  scopeRates?: Array<{ quotaProductId: number; salesPerQuota: number }>;
}): Promise<{ success: boolean }> {
  return apiFetch(QUOTA_API, {
    method: 'POST',
    body: JSON.stringify({ action: 'update_rate', ...payload }),
  });
}

export async function deleteRateSchedule(id: number): Promise<{ success: boolean }> {
  return apiFetch(QUOTA_API, {
    method: 'POST',
    body: JSON.stringify({ action: 'delete_rate', id }),
  });
}

export async function confirmQuota(payload: {
  quotaProductId: number;
  userId: number;
  rateScheduleId: number;
  confirmedBy?: number;
}): Promise<{ success: boolean; confirmedQuota?: number; totalSales?: number }> {
  return apiFetch(QUOTA_API, {
    method: 'POST',
    body: JSON.stringify({ action: 'confirm_quota', ...payload }),
  });
}

// ============================================================
// Quota Allocations
// ============================================================

export async function listQuotaAllocations(params: {
  quotaProductId?: number;
  userId?: number;
  companyId?: number;
}): Promise<QuotaAllocation[]> {
  const qs = new URLSearchParams({ action: 'list_allocations' });
  if (params.quotaProductId) qs.set('quotaProductId', String(params.quotaProductId));
  if (params.userId) qs.set('userId', String(params.userId));
  if (params.companyId) qs.set('companyId', String(params.companyId));
  const res = await apiFetch(`${QUOTA_API}?${qs.toString()}`);
  return (res.data || []).map(mapAllocation);
}

export async function allocateQuota(payload: {
  quotaProductId: number;
  userId: number;
  companyId: number;
  quantity: number;
  source?: 'auto' | 'admin';
  sourceDetail?: string;
  allocatedBy?: number;
  periodStart?: string;
  periodEnd?: string;
  validFrom?: string;
  validUntil?: string;
}): Promise<{ success: boolean; id?: number }> {
  return apiFetch(QUOTA_API, {
    method: 'POST',
    body: JSON.stringify({ action: 'allocate', source: 'admin', ...payload }),
  });
}

// ============================================================
// Quota Usage
// ============================================================

export async function useQuota(payload: {
  quotaProductId: number;
  userId: number;
  companyId: number;
  orderId: string;
  quantityUsed: number;
  periodStart?: string;
  periodEnd?: string;
}): Promise<{ success: boolean; id?: number }> {
  return apiFetch(QUOTA_API, {
    method: 'POST',
    body: JSON.stringify({ action: 'use_quota', ...payload }),
  });
}

/**
 * Auto-record quota usage for an order.
 * Scans order_items, matches to quota_products, inserts quota_usage rows.
 * Safe to call multiple times (INSERT IGNORE skips duplicates).
 */
export async function recordOrderUsage(payload: {
  orderId: string;
  companyId: number;
  userId: number;
}): Promise<{ success: boolean; recorded: number }> {
  return apiFetch(QUOTA_API, {
    method: 'POST',
    body: JSON.stringify({ action: 'record_order_usage', ...payload }),
  });
}

// ============================================================
// Calculation & Summary
// ============================================================

export async function calculateUserQuota(
  quotaProductId: number,
  userId: number,
): Promise<{
  autoQuota: number;
  adminQuota: number;
  totalQuota: number;
  totalUsed: number;
  remaining: number;
  totalSales: number;
  salesPerQuota: number;
  quotaMode: string;
  periodStart?: string;
  periodEnd?: string;
}> {
  const res = await apiFetch(
    `${QUOTA_API}?action=calculate&quotaProductId=${quotaProductId}&userId=${userId}`,
  );
  return res.data;
}

export async function getQuotaSummary(
  companyId: number,
  quotaProductId: number,
): Promise<QuotaSummary[]> {
  const res = await apiFetch(
    `${QUOTA_API}?action=summary&companyId=${companyId}&quotaProductId=${quotaProductId}`,
  );
  return res.data || [];
}

export async function getSummaryByRate(
  companyId: number,
  rateScheduleId: number | 'all',
): Promise<QuotaSummary[]> {
  const res = await apiFetch(
    `${QUOTA_API}?action=summary_by_rate&companyId=${companyId}&rateScheduleId=${rateScheduleId}`,
  );
  return res.data || [];
}

export async function bulkConfirmQuota(payload: {
  rateScheduleId: number;
  userIds: number[];
  confirmedBy?: number;
  companyId: number;
}): Promise<{ success: boolean; confirmed: number; results: Array<{ userId: number; confirmedQuota: number; totalSales: number }> }> {
  return apiFetch(QUOTA_API, {
    method: 'POST',
    body: JSON.stringify({ action: 'bulk_confirm_quota', ...payload }),
  });
}

/** Get pending confirmation counts per confirm-mode rate (lightweight) */
export async function getPendingCounts(
  companyId: number,
): Promise<Record<number, number>> {
  const res = await apiFetch(
    `${QUOTA_API}?action=pending_counts&companyId=${companyId}`,
  );
  // data is { rateId: count } — convert keys to numbers
  const raw = res.data || {};
  const result: Record<number, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    result[Number(k)] = Number(v);
  }
  return result;
}

// ============================================================
// User Quota Detail (per-rate breakdown)
// ============================================================

export interface UserQuotaDetailItem {
  rateScheduleId: number;
  rateName?: string;
  productLabel: string;
  quotaMode: string;
  modeLabel: string;
  salesPerQuota: number;
  totalSales: number;
  autoQuota: number;
  adminQuota: number;
  totalQuota: number;
  totalUsed: number;
  remaining: number;
  periodStart?: string;
  periodEnd?: string;
  pendingAutoQuota?: number;
  isConfirmed?: boolean;
  isExpired?: boolean;
}

export async function getUserQuotaDetail(params: {
  companyId: number;
  userId: number;
  rateScheduleId?: number | 'all';
}): Promise<UserQuotaDetailItem[]> {
  const qs = new URLSearchParams({
    action: 'user_quota_detail',
    companyId: String(params.companyId),
    userId: String(params.userId),
  });
  if (params.rateScheduleId !== undefined) qs.set('rateScheduleId', String(params.rateScheduleId));
  const res = await apiFetch(`${QUOTA_API}?${qs.toString()}`);
  return res.data || [];
}

// ============================================================
// Mappers — snake_case → camelCase
// ============================================================

function mapQuotaProduct(r: any): QuotaProduct {
  return {
    id: Number(r.id),
    productId: Number(r.product_id),
    companyId: Number(r.company_id),
    displayName: r.display_name || '',
    csvLabel: r.csv_label || undefined,
    quotaCost: r.quota_cost != null ? Number(r.quota_cost) : 1,
    productName: r.product_name || undefined,
    productSku: r.product_sku || undefined,
    productPrice: r.product_price != null ? Number(r.product_price) : undefined,
    isActive: r.is_active == 1,
  };
}

function mapRateSchedule(r: any): QuotaRateSchedule {
  // Parse scope_rates from backend
  const rawScopeRates = r.scope_rates || [];
  const scopeRates = rawScopeRates.map((sr: any) => ({
    quotaProductId: Number(sr.quota_product_id),
    salesPerQuota: Number(sr.sales_per_quota),
    displayName: sr.display_name || undefined,
  }));
  return {
    id: Number(r.id),
    rateName: r.rate_name || undefined,
    quotaProductId: Number(r.quota_product_id),
    salesPerQuota: Number(r.sales_per_quota),
    effectiveDate: r.effective_date,
    orderDateField: r.order_date_field || 'order_date',
    quotaMode: 'confirm',
    calcPeriodStart: r.calc_period_start || undefined,
    calcPeriodEnd: r.calc_period_end || undefined,
    usageStartDate: r.usage_start_date || undefined,
    usageEndDate: r.usage_end_date || undefined,
    requireConfirm: r.require_confirm != null ? r.require_confirm == 1 : undefined,
    createdBy: r.created_by ? Number(r.created_by) : undefined,
    createdByName: r.created_by_name || undefined,
    createdAt: r.created_at || undefined,
    scopeRates,
    scopeProductIds: scopeRates.map((sr: any) => sr.quotaProductId),
  };
}

function mapAllocation(r: any): QuotaAllocation {
  return {
    id: Number(r.id),
    quotaProductId: Number(r.quota_product_id),
    userId: Number(r.user_id),
    companyId: Number(r.company_id),
    quantity: Number(r.quantity),
    source: r.source,
    sourceDetail: r.source_detail || undefined,
    allocatedBy: r.allocated_by ? Number(r.allocated_by) : undefined,
    periodStart: r.period_start || undefined,
    periodEnd: r.period_end || undefined,
    valid_from: r.valid_from || undefined,
    valid_until: r.valid_until || undefined,
    createdAt: r.created_at,
    userFirstName: r.user_first_name || undefined,
    userLastName: r.user_last_name || undefined,
    allocatedByFirstName: r.allocated_by_first_name || undefined,
    allocatedByLastName: r.allocated_by_last_name || undefined,
  };
}
