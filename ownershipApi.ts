import { apiFetch } from './services/api';

export interface OwnershipAction {
  action: 'sale' | 'followup' | 'redistribute' | 'retrieve';
  customerId: string;
  data?: any;
}

/**
 * Record a sale for a customer
 * Adds +90 days (max 90 days remaining)
 */
export async function recordSale(customerId: string) {
  return apiFetch('ownership', {
    method: 'POST',
    body: JSON.stringify({
      action: 'sale',
      customerId
    })
  });
}

/**
 * Record a follow-up for a customer
 * Adds +90 days only on first follow-up
 */
export async function recordFollowUp(customerId: string, data?: any) {
  return apiFetch('ownership', {
    method: 'POST',
    body: JSON.stringify({
      action: 'followup',
      customerId,
      data
    })
  });
}

/**
 * Redistribute a customer (new or old who hasn't sold)
 * Starts with 30 days
 */
export async function redistributeCustomer(customerId: string) {
  return apiFetch('ownership', {
    method: 'POST',
    body: JSON.stringify({
      action: 'redistribute',
      customerId
    })
  });
}

/**
 * Retrieve a customer (no waiting basket, go directly to distribution)
 */
export async function retrieveCustomer(customerId: string) {
  return apiFetch('ownership', {
    method: 'POST',
    body: JSON.stringify({
      action: 'retrieve',
      customerId
    })
  });
}

/**
 * Get customer ownership status
 */
export async function getCustomerOwnershipStatus(customerId: string) {
  return apiFetch(`ownership/${customerId}`);
}

/**
 * Get all customers with updated ownership status
 */
export async function getAllCustomersWithOwnershipStatus() {
  return apiFetch('ownership');
}
