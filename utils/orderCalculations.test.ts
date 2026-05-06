import { describe, it, expect } from 'vitest';
import { calculateOrderTotal } from './orderCalculations';

describe('calculateOrderTotal', () => {
  it('should correctly sum items and subtract discounts', () => {
    const items = [
      { pricePerUnit: 100, quantity: 2, discount: 10, isFreebie: false, boxNumber: 1 },
      { pricePerUnit: 50, quantity: 1, discount: 0, isFreebie: false, boxNumber: 1 }
    ];
    // Subtotal: (200 - 10) + 50 = 240. Plus shipping 20, minus bill discount 30 = 230
    const result = calculateOrderTotal(items, 20, 30);
    expect(result.totalAmount).toBe(230);
  });

  it('should exclude freebies from sum and discount', () => {
    const items = [
      { pricePerUnit: 100, quantity: 2, discount: 10, isFreebie: false, boxNumber: 1 },
      { pricePerUnit: 500, quantity: 1, discount: 50, isFreebie: true, boxNumber: 1 }
    ];
    // Subtotal: 190. Plus shipping 0, minus bill discount 0 = 190
    const result = calculateOrderTotal(items, 0, 0);
    expect(result.totalAmount).toBe(190);
  });

  it('should exclude child items from double counting', () => {
    const items = [
      { id: 1, pricePerUnit: 1000, quantity: 1, discount: 0, isFreebie: false, boxNumber: 1, isPromotionParent: 1 },
      { id: 2, pricePerUnit: 500, quantity: 2, discount: 0, isFreebie: false, boxNumber: 1, parentItemId: 1 } // child
    ];
    // Subtotal should only be 1000. 
    const result = calculateOrderTotal(items, 0, 0);
    expect(result.totalAmount).toBe(1000);
  });

  it('should calculate returned box items as 0 value', () => {
    const items = [
      { pricePerUnit: 100, quantity: 1, discount: 10, isFreebie: false, boxNumber: 1 }, // Retained: 90
      { pricePerUnit: 200, quantity: 1, discount: 20, isFreebie: false, boxNumber: 2 }  // Returned: 0
    ];
    const boxes = [
      { boxNumber: 1, returnStatus: null },
      { boxNumber: 2, returnStatus: 'returned' }
    ];
    // Subtotal: 90. Shipping: 10. Bill Discount: 0. Total: 100.
    const result = calculateOrderTotal(items, 10, 0, boxes);
    expect(result.totalAmount).toBe(100);
  });

  it('should consider both returnStatus="returned" and status="RETURNED" as returned', () => {
    const items = [
      { pricePerUnit: 100, quantity: 1, discount: 10, isFreebie: false, boxNumber: 1 },
      { pricePerUnit: 200, quantity: 1, discount: 20, isFreebie: false, boxNumber: 2 }
    ];
    const boxes = [
      { boxNumber: 1, status: 'RETURNED' }, // Using status instead of returnStatus
      { boxNumber: 2, status: 'DELIVERED' }
    ];
    // Box 1 is returned (0). Box 2 is delivered (180). Total = 180.
    const result = calculateOrderTotal(items, 0, 0, boxes);
    expect(result.totalAmount).toBe(180);
  });

  it('should treat explicit returnStatus=null as NOT returned, overriding status=RETURNED', () => {
    const items = [
      { pricePerUnit: 100, quantity: 1, discount: 0, isFreebie: false, boxNumber: 1 }
    ];
    const boxes = [
      { boxNumber: 1, returnStatus: null, status: 'RETURNED' }
    ];
    // Since returnStatus is explicitly null, it should NOT be returned.
    const result = calculateOrderTotal(items, 0, 0, boxes);
    expect(result.totalAmount).toBe(100);
  });
});
