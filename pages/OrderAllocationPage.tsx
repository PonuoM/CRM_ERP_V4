import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Warehouse } from '../types';
import {
  listAllocations,
  updateAllocation,
  listOrders,
  listWarehouses,
  listCustomers,
  listProductLots,
  ProductLot,
} from '@/services/api';
import { ChevronDown, ChevronRight } from 'lucide-react';

type Allocation = {
  id: number;
  order_id: string;
  order_item_id?: number | null;
  product_id: number;
  product_name?: string;
  promotion_id?: number | null;
  is_freebie: 0 | 1;
  required_quantity: number;
  allocated_quantity: number;
  warehouse_id?: number | null;
  lot_number?: string | null;
  status: 'PENDING' | 'ALLOCATED' | 'PICKED' | 'SHIPPED' | 'CANCELLED';
};

type PendingAllocationState = {
  warehouseId?: number | null;
  lotNumber?: string;
  quantity?: number;
};

const OrderAllocationPage: React.FC = () => {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([] as any);
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [status, setStatus] = useState<'PENDING'|'ALLOCATED'|'PICKED'|'SHIPPED'|'CANCELLED'>('PENDING');
  const [loading, setLoading] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [lotOptions, setLotOptions] = useState<Record<string, ProductLot[]>>({});
  const [lotLoadingMap, setLotLoadingMap] = useState<Record<string, boolean>>({});
  const [pendingAllocations, setPendingAllocations] = useState<Record<number, PendingAllocationState>>({});
  const [selectedAllocIds, setSelectedAllocIds] = useState<Set<number>>(new Set());
  const [orderWarehouseValues, setOrderWarehouseValues] = useState<Record<string, number | null>>({});
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const pendingLotFetch = useRef<Set<string>>(new Set());

  const makeLotKey = (productId: number, warehouseId?: number | null) =>
    `${productId}-${warehouseId ?? 'none'}`;

  const loadLots = useCallback(
    async (productId: number, warehouseId?: number | null, force = false) => {
      if (!warehouseId) return;
      const key = makeLotKey(productId, warehouseId);
      if (!force && lotOptions[key] !== undefined) return;
      if (pendingLotFetch.current.has(key)) return;
      pendingLotFetch.current.add(key);
      setLotLoadingMap((prev) => ({ ...prev, [key]: true }));
      try {
        const lots = await listProductLots({
          warehouseId,
          productId,
          status: 'Active',
        });
        const filtered = lots.filter(
          (lot) => Number(lot.quantity_remaining) > 0,
        );
        setLotOptions((prev) => ({ ...prev, [key]: filtered }));
      } catch (error) {
        console.error('Failed to load product lots', error);
        setLotOptions((prev) => ({ ...prev, [key]: [] }));
      } finally {
        pendingLotFetch.current.delete(key);
        setLotLoadingMap((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    [lotOptions],
  );

  const updatePendingAllocation = useCallback(
    (allocationId: number, updates: Partial<PendingAllocationState>) => {
      setPendingAllocations((prev) => {
        const next = { ...prev };
        const current = next[allocationId] ?? {};
        const merged: PendingAllocationState = { ...current, ...updates };
        if (updates.warehouseId !== undefined && updates.warehouseId !== null) {
          merged.lotNumber = '__AUTO__';
        } else if (Object.prototype.hasOwnProperty.call(updates, 'warehouseId')) {
          delete merged.lotNumber;
        }
        const cleaned: PendingAllocationState = {};
        if (merged.warehouseId !== undefined) cleaned.warehouseId = merged.warehouseId;
        if (merged.lotNumber !== undefined) cleaned.lotNumber = merged.lotNumber;
        if (merged.quantity !== undefined) cleaned.quantity = merged.quantity;
        if (Object.keys(cleaned).length === 0) {
          delete next[allocationId];
        } else {
          next[allocationId] = cleaned;
        }
        return next;
      });
      setSelectedAllocIds((prev) => {
        const next = new Set(prev);
        next.add(allocationId);
        return next;
      });
    },
    [],
  );

  const toggleAllocationSelection = useCallback((allocationId: number) => {
    setSelectedAllocIds((prev) => {
      const next = new Set(prev);
      if (next.has(allocationId)) {
        next.delete(allocationId);
      } else {
        next.add(allocationId);
      }
      return next;
    });
  }, []);

  const selectAllocationItems = useCallback((allocationIds: number[], selected: boolean) => {
    setSelectedAllocIds((prev) => {
      const next = new Set(prev);
      allocationIds.forEach((id) => {
        if (selected) {
          next.add(id);
        } else {
          next.delete(id);
        }
      });
      return next;
    });
  }, []);

  const clearPendingForItems = useCallback((allocationIds: number[]) => {
    setPendingAllocations((prev) => {
      const next = { ...prev };
      allocationIds.forEach((id) => {
        delete next[id];
      });
      return next;
    });
  }, []);

  const setOrderWarehouseOverride = useCallback(
    (orderId: string, warehouseId?: number | null) => {
      setOrderWarehouseValues((prev) => {
        const next = { ...prev };
        if (warehouseId === undefined || warehouseId === null) {
          delete next[orderId];
        } else {
          next[orderId] = warehouseId;
        }
        return next;
      });
    },
    [],
  );

  useEffect(() => { (async () => {
    try {
      setLoading(true);
      const [ws, os, cs, as] = await Promise.all([
        listWarehouses(),
        listOrders(),
        listCustomers({}),
        listAllocations({ status }),
      ]);
      setWarehouses(ws as any);
      setOrders(os as any);
      setCustomers(cs as any);
      setAllocations(as as any);
    } finally { setLoading(false); }
  })(); }, [status]);

  useEffect(() => {
    allocations.forEach((a) => {
      if (a.warehouse_id) {
        loadLots(a.product_id, a.warehouse_id);
      }
    });
  }, [allocations, loadLots]);

  const orderMap = useMemo(() => {
    const m = new Map<string, any>();
    (orders || []).forEach((o: any) => m.set(String(o.id), o));
    return m;
  }, [orders]);

  const customerMap = useMemo(() => {
    const m = new Map<string, any>();
    (customers || []).forEach((c: any) => m.set(String(c.id), c));
    return m;
  }, [customers]);

  const suggestWarehouseId = (orderId: string): number | undefined => {
    const o = orderMap.get(String(orderId));
    if (!o) return undefined;
    const province = (o.province || '').trim();
    if (!province) return undefined;
    const matched = warehouses.find(w => {
      const resp: any = (w as any).responsibleProvinces;
      const list = Array.isArray(resp) ? resp : String(resp || '').split(',').map((s: string) => s.trim()).filter(Boolean);
      return list.includes(province);
    });
    return matched?.id;
  };

  const getWarehouseName = (id?: number | null) => warehouses.find(w => w.id === id)?.name || (id ? `คลัง ${id}` : '-');


  const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  };

  const formatLotLabel = (lot: ProductLot) => {
    const qtyNumber = Number(lot.quantity_remaining);
    const qtyLabel = Number.isNaN(qtyNumber)
      ? String(lot.quantity_remaining)
      : qtyNumber.toLocaleString();
    const expiryPart = lot.expiry_date
      ? `, expire ${formatDate(lot.expiry_date)}`
      : '';
    return `${lot.lot_number} (qty ${qtyLabel}, received ${formatDate(lot.purchase_date)}${expiryPart})`;
  };

  const remaining = (a: Allocation) => Math.max(0, a.required_quantity - a.allocated_quantity);

  // Group allocations by order ID
  const ordersWithAllocations = useMemo(() => {
    const grouped = new Map<string, Allocation[]>();
    allocations.forEach(a => {
      if (!grouped.has(a.order_id)) {
        grouped.set(a.order_id, []);
      }
      grouped.get(a.order_id)!.push(a);
    });
    
    // Convert to array and sort
    return Array.from(grouped.entries()).map(([orderId, items]) => {
      const order = orderMap.get(String(orderId));
      const customer = order ? customerMap.get(String(order.customer_id)) : null;
      const suggested = suggestWarehouseId(orderId);
      const pendingWarehouseValues = items
        .map((item) => pendingAllocations[item.id]?.warehouseId)
        .filter((value): value is number => typeof value === 'number');
      const uniformPendingWarehouse = pendingWarehouseValues.length > 0 && pendingWarehouseValues.every((value) => value === pendingWarehouseValues[0])
        ? pendingWarehouseValues[0]
        : undefined;
      const orderWarehouseValue = Object.prototype.hasOwnProperty.call(orderWarehouseValues, orderId)
        ? orderWarehouseValues[orderId]
        : undefined;
      const orderLevelWarehouse = orderWarehouseValue ?? uniformPendingWarehouse ?? order?.warehouse_id ?? (items.find((item) => item.warehouse_id != null)?.warehouse_id ?? null) ?? suggested ?? null;
      const headerSelectValue = orderLevelWarehouse != null ? String(orderLevelWarehouse) : '';
      
      // Calculate totals for the order
      const totalRequired = items.reduce((sum, item) => sum + item.required_quantity, 0);
      const totalAllocated = items.reduce((sum, item) => sum + item.allocated_quantity, 0);
      const isFullyAllocated = items.every(item => item.allocated_quantity >= item.required_quantity);
      
      return {
        orderId,
        order,
        customer,
        suggested,
        items,
        totalRequired,
        totalAllocated,
        isFullyAllocated,
        isExpanded: expandedOrders.has(orderId),
        orderWarehouseValue: orderLevelWarehouse,
        headerWarehouseSelectValue: headerSelectValue,
      };
    });
  }, [allocations, orderMap, customerMap, expandedOrders, orderWarehouseValues, pendingAllocations]);

  useEffect(() => {
    ordersWithAllocations.forEach(({ items, suggested, isExpanded, orderWarehouseValue }) => {
      if (!isExpanded) return;
      items.forEach((item) => {
        const pending = pendingAllocations[item.id];
        const targetWarehouse =
          pending?.warehouseId ??
          item.warehouse_id ??
          orderWarehouseValue ??
          suggested ??
          null;
        if (targetWarehouse) {
          loadLots(item.product_id, targetWarehouse);
        }
      });
    });
  }, [ordersWithAllocations, loadLots, pendingAllocations]);

  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  // Function to allocate all items in an order to the same warehouse (pending selection)
  const handleAllocateOrder = (orderData: any, warehouseId?: number) => {
    const { orderId, items } = orderData;
    const allocationIds = items.map((item) => item.id);

    if (warehouseId === undefined) {
      setOrderWarehouseOverride(orderId, undefined);
      clearPendingForItems(allocationIds);
      selectAllocationItems(allocationIds, false);
      return;
    }

    setOrderWarehouseOverride(orderId, warehouseId);
    setPendingAllocations((prev) => {
      const next = { ...prev };
      items.forEach((item: Allocation) => {
        const current = next[item.id] ?? {};
        next[item.id] = { ...current, warehouseId, lotNumber: '__AUTO__' };
      });
      return next;
    });
    selectAllocationItems(allocationIds, true);
    items.forEach((item: Allocation) => {
      loadLots(item.product_id, warehouseId, true);
    });
  };

  const handleConfirmSelected = async (orderData: any) => {
    const { orderId, items, order, suggested, orderWarehouseValue } = orderData;
    const selectedItems = items.filter((item) => selectedAllocIds.has(item.id));
    if (!selectedItems.length) return;

    setConfirmingOrderId(orderId);
    try {
      for (const item of selectedItems) {
        const pending = pendingAllocations[item.id] ?? {};
        const warehouseId =
          pending.warehouseId ??
          item.warehouse_id ??
          (orderWarehouseValue ?? order?.warehouse_id ?? null) ??
          suggested ??
          null;
        if (!warehouseId) {
          console.warn('Missing warehouse for allocation', item.id);
          continue;
        }
        const quantity =
          pending.quantity ??
          (item.allocated_quantity > 0 ? item.allocated_quantity : item.required_quantity);
        const lotChoice = pending.lotNumber ?? (item.lot_number ?? '__AUTO__');

        const payload: any = {
          warehouseId,
          allocatedQuantity: quantity,
          status: 'ALLOCATED',
        };
        if (lotChoice !== '__AUTO__') {
          payload.lotNumber = lotChoice;
        }

        await updateAllocation(item.id, payload);
      }

      const refreshed = await listAllocations({ status });
      setAllocations(refreshed as any);

      const affectedIds = selectedItems.map((item: Allocation) => item.id);
      clearPendingForItems(affectedIds);
      selectAllocationItems(affectedIds, false);
      setOrderWarehouseOverride(orderId, undefined);
    } catch (error) {
      console.error('Failed to confirm allocations', error);
      alert('ยืนยันการจัดสรรไม่สำเร็จ');
    } finally {
      setConfirmingOrderId(null);
    }
  };

  const handleResetSelections = (orderData: any) => {
    const { orderId, items } = orderData;
    const allocationIds = items.map((item) => item.id);
    clearPendingForItems(allocationIds);
    selectAllocationItems(allocationIds, false);
    setOrderWarehouseOverride(orderId, undefined);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-[#0e141b]">จัดสรรคลังสำหรับออเดอร์</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-[#4e7397]">สถานะ:</label>
          <select value={status} onChange={e => setStatus(e.target.value as any)} className="border rounded px-2 py-1">
            {['PENDING','ALLOCATED','PICKED','SHIPPED','CANCELLED'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white border rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-[#4e7397]">
              <th className="p-2">ออเดอร์</th>
              <th className="p-2">ลูกค้า</th>
              <th className="p-2">รายการสินค้า</th>
              <th className="p-2">จำนวน/สถานะ</th>
              <th className="p-2">คลัง (แนะนำ)</th>
              <th className="p-2">การจัดสรร</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3" colSpan={6}>กำลังโหลด...</td></tr>
            ) : ordersWithAllocations.length === 0 ? (
              <tr><td className="p-3" colSpan={6}>ไม่พบรายการ</td></tr>
            ) : ordersWithAllocations.map(orderData => {
              const { orderId, order, customer, suggested, items, totalRequired, totalAllocated, isFullyAllocated, isExpanded, orderWarehouseValue, headerWarehouseSelectValue } = orderData;
              
              return (
                <React.Fragment key={orderId}>
                  <tr className="border-t hover:bg-gray-50">
                    <td className="p-2 align-top">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleOrderExpansion(orderId)}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                        <div>
                          <div className="font-medium text-[#0e141b]">{orderId}</div>
                          {order && (
                            <div className="text-xs text-[#4e7397]">{order.province || '-'} • {new Date(order.order_date).toLocaleDateString()}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-2 align-top">
                      {customer ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.id : '-'}
                    </td>
                    <td className="p-2 align-top">
                      <div className="text-[#0e141b]">
                        {items.length} รายการสินค้า
                        {items.some(item => item.is_freebie) && ' (รวมของแถม)'}
                      </div>
                    </td>
                    <td className="p-2 align-top">
                      <div className="flex items-center gap-2">
                        <span>จัดสรร {totalAllocated}/{totalRequired}</span>
                        {isFullyAllocated ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">ครบ</span>
                        ) : (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">ไม่ครบ</span>
                        )}
                      </div>
                    </td>
                    <td className="p-2 align-top">
                      <div className="flex items-center gap-1">
                        <select
                          value={headerWarehouseSelectValue}
                          onChange={e => {
                            const value = e.target.value;
                            handleAllocateOrder(orderData, value ? Number(value) : undefined);
                          }}
                          className="border rounded px-2 py-1 min-w-[160px]"
                        >
                          <option value="">เลือกคลัง</option>
                          {warehouses.map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                          ))}
                        </select>
                        {suggested && <span className="text-xs text-green-700">แนะนำ: {getWarehouseName(suggested)}</span>}
                      </div>
                    </td>
                    <td className="p-2 align-top">
                      {isFullyAllocated ? (
                        <span className="px-3 py-1 bg-green-600 text-white rounded text-sm">จัดสรรแล้ว</span>
                      ) : (
                        <button
                          onClick={() => {
                            const warehouseId =
                              orderWarehouseValue ??
                              (headerWarehouseSelectValue ? Number(headerWarehouseSelectValue) : null);
                            if (warehouseId != null) {
                              handleAllocateOrder(orderData, warehouseId);
                            } else {
                              alert('กรุณาเลือกคลังสินค้า');
                            }
                          }}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                          จัดสรรทั้งหมด
                        </button>
                      )}
                    </td>
                  </tr>
                  
                  {/* Expanded row showing item details */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={6} className="p-0">
                        <div className="bg-gray-50 p-3 border-l-4 border-blue-500">
                          <h4 className="font-medium text-sm mb-2">รายละเอียดสินค้าในออเดอร์</h4>
                          <div className="space-y-2">
                            {items.map(item => {
                              const pending = pendingAllocations[item.id] ?? {};
                              const quantityValue =
                                pending.quantity !== undefined
                                  ? pending.quantity
                                  : item.allocated_quantity > 0
                                    ? item.allocated_quantity
                                    : item.required_quantity;
                              const resolvedWarehouseId =
                                pending.warehouseId ??
                                item.warehouse_id ??
                                orderLevelWarehouse ??
                                suggested ??
                                null;
                              const warehouseSelectValue = resolvedWarehouseId != null ? String(resolvedWarehouseId) : '';
                              const lotKeyForItem = resolvedWarehouseId ? makeLotKey(item.product_id, resolvedWarehouseId) : '';
                              const lots = lotKeyForItem ? lotOptions[lotKeyForItem] : undefined;
                              const lotsLoading = lotKeyForItem ? !!lotLoadingMap[lotKeyForItem] : false;
                              const lotSelectValue = pending.lotNumber ?? (item.lot_number ?? '__AUTO__');
                              const isSelected = selectedAllocIds.has(item.id);
                              return (
                                <div key={item.id} className="flex items-center gap-3 bg-white p-2 rounded border">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                                        checked={isSelected}
                                        onChange={() => toggleAllocationSelection(item.id)}
                                      />
                                      <div className="text-sm font-medium">
                                        {(item as any).product_name || `สินค้า #${item.product_id}`}
                                        {item.is_freebie && <span className="ml-2 text-xs bg-pink-100 text-pink-800 px-2 py-0.5 rounded">ของแถม</span>}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-sm text-gray-600 w-16 text-center">
                                    {item.required_quantity}
                                  </div>
                                  <div className="text-sm text-gray-600 w-16 text-center">
                                    {item.allocated_quantity}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <select
                                      value={warehouseSelectValue}
                                      onChange={e => {
                                        const value = e.target.value;
                                        const newWarehouseId = value ? Number(value) : undefined;
                                        updatePendingAllocation(item.id, { warehouseId: newWarehouseId });
                                        if (newWarehouseId !== undefined) {
                                          loadLots(item.product_id, newWarehouseId, true);
                                        }
                                      }}
                                      className="border rounded px-2 py-1 min-w-[120px] text-xs"
                                    >
                                      <option value="">เลือกคลัง</option>
                                      {warehouses.map(w => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <select
                                      value={lotSelectValue}
                                      disabled={!resolvedWarehouseId}
                                      onFocus={() => {
                                        if (resolvedWarehouseId) {
                                          loadLots(item.product_id, resolvedWarehouseId);
                                        }
                                      }}
                                      onChange={e => {
                                        updatePendingAllocation(item.id, { lotNumber: e.target.value });
                                      }}
                                      className="border rounded px-2 py-1 min-w-[220px] text-xs"
                                    >
                                      <option value="__AUTO__">
                                        {resolvedWarehouseId
                                          ? lotsLoading
                                            ? "กำลังโหลด.."
                                            : "Auto (FIFO)"
                                          : "เลือกคลังก่อน"}
                                      </option>
                                      {lots?.map(lot => (
                                        <option key={lot.id} value={lot.lot_number}>
                                          {formatLotLabel(lot)}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (resolvedWarehouseId) {
                                          loadLots(item.product_id, resolvedWarehouseId, true);
                                        }
                                      }}
                                      disabled={!resolvedWarehouseId}
                                      className="px-2 py-1 border rounded text-xs text-blue-600 disabled:opacity-50"
                                    >
                                      โหลดใหม่
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      min={0}
                                      value={quantityValue}
                                      onChange={e => {
                                        const value = e.target.value;
                                        if (value === '') {
                                          updatePendingAllocation(item.id, { quantity: undefined });
                                        } else {
                                          updatePendingAllocation(item.id, { quantity: Number(value) });
                                        }
                                      }}
                                      className="border rounded px-2 py-1 w-16 text-xs"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => updatePendingAllocation(item.id, { lotNumber: '__AUTO__' })}
                                      className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
                                    >
                                      ตั้งค่า Auto FIFO
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          <div className="flex items-center justify-between mt-4">
                            <span className="text-xs text-gray-500">เลือกแถวและกดยืนยันเพื่อบันทึกการจัดสรร</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => selectAllocationItems(items.map((item) => item.id), true)}
                                className="px-2 py-1 border rounded text-xs text-gray-600"
                              >
                                เลือกทั้งหมด
                              </button>
                              <button
                                type="button"
                                onClick={() => handleResetSelections(orderData)}
                                className="px-2 py-1 border rounded text-xs text-gray-600"
                              >
                                ล้างค่า
                              </button>
                              <button
                                type="button"
                                onClick={() => handleConfirmSelected(orderData)}
                                disabled={confirmingOrderId === orderId || !items.some((item) => selectedAllocIds.has(item.id))}
                                className="px-3 py-1 bg-blue-600 text-white rounded text-xs disabled:opacity-50"
                              >
                                {confirmingOrderId === orderId ? 'กำลังยืนยัน...' : 'ยืนยันการจัดสรร'}
                              </button>
                            </div>
                          </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrderAllocationPage;
