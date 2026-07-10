export const calculateOrderTotal = (
  items: any[],
  shippingCost: number,
  billDiscount: number,
  boxes?: any[]
) => {
  // Exclude child promotion items (parentItemId != null) to avoid double-counting
  const billableItems = items.filter((item: any) => {
    const isChildItem = item.parentItemId || item.parent_item_id;
    return !isChildItem;
  });

  // Helper to check if an item belongs to a returned box
  const isItemInReturnedBox = (item: any) => {
    if (!boxes || boxes.length === 0) return false;
    const boxNumber = Number(item.boxNumber || item.box_number || 1);
    const box = boxes.find(b => b.boxNumber === boxNumber);
    if (!box) return false;

    // If the UI explicitly has a return status (e.g. 'good', 'returned', 'damaged'), it's returned
    if (box.returnStatus) {
      return true;
    }

    // If the UI explicitly cleared the return status (null or empty string), it's NOT returned
    // This allows the calculation to instantly update when user selects "รอตรวจสอบ / ไม่ระบุ"
    if (box.returnStatus === null || box.returnStatus === "") {
      return false;
    }

    // Fallback to backend status if returnStatus is undefined
    return String(box.status).toUpperCase() === 'RETURNED';
  };

  let goodsSum = 0;
  let itemsDiscount = 0;
  let rawGoodsSum = 0;
  let rawItemsDiscount = 0;

  billableItems.forEach(item => {
    const isFreebie = item.isFreebie || item.is_freebie;
    const price = Number(item.pricePerUnit || item.price_per_unit || 0);
    const qty = Number(item.quantity || item.quantity || 0);
    const disc = Number(item.discount || 0);
    const monthlyDisc = Number(item.monthlyDiscount || item.monthly_discount || 0);

    const itemTotal = isFreebie ? 0 : qty * price;
    const itemDisc = isFreebie ? 0 : disc + monthlyDisc;

    // Always add to raw totals
    rawGoodsSum += itemTotal;
    rawItemsDiscount += itemDisc;

    // Only add to net totals if NOT in returned box
    if (!isItemInReturnedBox(item)) {
      goodsSum += itemTotal;
      itemsDiscount += itemDisc;
    }
  });

  const itemsSubtotal = goodsSum - itemsDiscount;
  const rawItemsSubtotal = rawGoodsSum - rawItemsDiscount;
  
  const billDiscountAmount = Number(billDiscount) || 0;
  
  const totalAmount = itemsSubtotal + (Number(shippingCost) || 0) - billDiscountAmount;
  const rawTotalAmount = rawItemsSubtotal + (Number(shippingCost) || 0) - billDiscountAmount;

  const returnedAmount = rawTotalAmount - totalAmount;

  return {
    itemsSubtotal,
    itemsDiscount,
    totalAmount,
    rawItemsSubtotal,
    rawItemsDiscount,
    rawTotalAmount,
    returnedAmount
  };
};
