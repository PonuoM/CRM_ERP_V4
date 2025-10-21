import React, { useEffect, useMemo, useState } from 'react';
import { Warehouse } from '../types';
import { listAllocations, updateAllocation, listOrders, listWarehouses, listCustomers } from '@/services/api';
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

const OrderAllocationPage: React.FC = () => {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([] as any);
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [status, setStatus] = useState<'PENDING'|'ALLOCATED'|'PICKED'|'SHIPPED'|'CANCELLED'>('PENDING');
  const [loading, setLoading] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

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

  const handleAllocate = async (row: Allocation, patch: Partial<{ warehouse_id: number; lot_number?: string; allocated_quantity?: number; status?: string }>) => {
    const payload: any = {};
    if (patch.warehouse_id !== undefined) payload.warehouseId = patch.warehouse_id;
    // Only include lotNumber if it's explicitly provided (not empty or "-")
    if (patch.lot_number !== undefined && patch.lot_number && patch.lot_number !== '-') {
      payload.lotNumber = patch.lot_number;
    }
    // If lot number is not provided or is "-", don't include it in the payload
    // This will trigger automatic FIFO lot assignment in the backend
    if (patch.allocated_quantity !== undefined) payload.allocatedQuantity = patch.allocated_quantity;
    if (patch.status !== undefined) payload.status = patch.status;
    await updateAllocation(row.id, payload);
    const refreshed = await listAllocations({ status });
    setAllocations(refreshed as any);
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
        isExpanded: expandedOrders.has(orderId)
      };
    });
  }, [allocations, orderMap, customerMap, expandedOrders]);

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

  // Function to allocate all items in an order to the same warehouse
  const handleAllocateOrder = async (orderData: any, warehouseId: number) => {
    const { orderId, items } = orderData;
    
    try {
      // Update all items in the order
      for (const item of items) {
        const defaultQty = remaining(item);
        // Don't include lot_number to trigger automatic FIFO assignment
        await handleAllocate(item, {
          warehouse_id: warehouseId,
          allocated_quantity: defaultQty,
          status: 'ALLOCATED'
        });
      }
      
      // Refresh the allocations
      const refreshed = await listAllocations({ status });
      setAllocations(refreshed as any);
    } catch (error) {
      console.error('Failed to allocate order:', error);
      alert('เกิดข้อผิดพลาดในการจัดสรรออเดอร์');
    }
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
              const { orderId, order, customer, suggested, items, totalRequired, totalAllocated, isFullyAllocated, isExpanded } = orderData;
              
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
                          value={String(items[0]?.warehouse_id ?? suggested ?? '')}
                          onChange={e => {
                            if (e.target.value) {
                              handleAllocateOrder(orderData, Number(e.target.value));
                            }
                          }}
                          className="border rounded px-2 py-1 min-w-[160px]"
                        >
                          <option value="">เลือกคลัง...</option>
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
                            const warehouseId = suggested || items[0]?.warehouse_id || (warehouses.length > 0 ? warehouses[0].id : null);
                            if (warehouseId) {
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
                              const defaultQty = remaining(item);
                              return (
                                <div key={item.id} className="flex items-center gap-3 bg-white p-2 rounded border">
                                  <div className="flex-1">
                                    <div className="text-sm font-medium">
                                      {(item as any).product_name || `สินค้า #${item.product_id}`}
                                      {item.is_freebie && <span className="ml-2 text-xs bg-pink-100 text-pink-800 px-2 py-0.5 rounded">ของแถม</span>}
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
                                      value={String((item.warehouse_id ?? suggested ?? ''))}
                                      onChange={e => handleAllocate(item, { warehouse_id: e.target.value ? Number(e.target.value) : (undefined as any) })}
                                      className="border rounded px-2 py-1 min-w-[120px] text-xs"
                                    >
                                      <option value="">ไม่ระบุ</option>
                                      {warehouses.map(w => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <input type="text" defaultValue={item.lot_number || ''} placeholder="ระบุ Lot (เว้นว่างสำหรับ FIFO)"
                                      onBlur={e => handleAllocate(item, { lot_number: e.target.value })}
                                      className="border rounded px-2 py-1 w-20 text-xs" />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <input type="number" min={0} defaultValue={defaultQty}
                                      onBlur={e => {
                                        const v = Number(e.target.value || 0);
                                        if (v >= 0) handleAllocate(item, { allocated_quantity: v });
                                      }}
                                      className="border rounded px-2 py-1 w-16 text-xs" />
                                    <button
                                      onClick={() => handleAllocate(item, { allocated_quantity: defaultQty, status: 'ALLOCATED' })}
                                      className="px-2 py-1 bg-blue-600 text-white rounded text-xs">
                                      จัดสรร
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
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
