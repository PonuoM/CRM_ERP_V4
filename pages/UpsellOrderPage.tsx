import React, { useState, useEffect } from "react";
import { Customer, Order, Product, User, LineItem } from "../types";
import { ArrowLeft, ShoppingCart, Plus, Trash2, Save, X } from "lucide-react";
import { getUpsellOrders, addUpsellItems } from "@/services/api";
import { formatThaiDateTime } from "@/utils/time";

interface UpsellOrderPageProps {
  customer: Customer;
  products: Product[];
  users: User[];
  currentUser: User;
  onCancel: () => void;
  onSuccess?: () => void;
}

const UpsellOrderPage: React.FC<UpsellOrderPageProps> = ({
  customer,
  products,
  users,
  currentUser,
  onCancel,
  onSuccess,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newItems, setNewItems] = useState<LineItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadOrders = async () => {
      try {
        setLoading(true);
        const customerId = customer.id || customer.customerId || customer.customerRefId;
        if (!customerId) {
          setError("ไม่พบรหัสลูกค้า");
          return;
        }
        const upsellOrders = await getUpsellOrders(customerId);
        setOrders(upsellOrders as any);
        if (upsellOrders.length > 0) {
          setSelectedOrder(upsellOrders[0] as any);
        }
      } catch (err: any) {
        setError(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [customer]);

  const usersById = new Map(users.map(u => [u.id, u]));

  const getCreatorName = (creatorId: number | null | undefined) => {
    if (!creatorId) return "ไม่ระบุ";
    const user = usersById.get(creatorId);
    return user ? `${user.firstName} ${user.lastName}` : `ID: ${creatorId}`;
  };

  const handleAddNewItem = () => {
    setNewItems([
      ...newItems,
      {
        id: Date.now(),
        productId: null,
        productName: "",
        quantity: 1,
        pricePerUnit: 0,
        discount: 0,
        isFreebie: false,
        boxNumber: 1,
      },
    ]);
  };

  const handleRemoveNewItem = (id: number) => {
    setNewItems(newItems.filter(item => item.id !== id));
  };

  const handleUpdateNewItem = (id: number, field: string, value: any) => {
    setNewItems(newItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleProductSelect = (itemId: number, productId: number) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setNewItems(newItems.map(item => 
        item.id === itemId 
          ? { 
              ...item, 
              productId: product.id,
              productName: product.name,
              pricePerUnit: product.price || 0,
            } 
          : item
      ));
    }
  };

  const calculateItemTotal = (item: LineItem) => {
    if (item.isFreebie) return 0;
    return (item.pricePerUnit * item.quantity) - item.discount;
  };

  const calculateNewItemsTotal = () => {
    return newItems.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  };

  const handleSave = async () => {
    if (!selectedOrder) {
      setError("กรุณาเลือกออเดอร์");
      return;
    }

    if (newItems.length === 0) {
      setError("กรุณาเพิ่มรายการสินค้า");
      return;
    }

    // Validate all items have product
    const invalidItems = newItems.filter(item => !item.productId || !item.productName);
    if (invalidItems.length > 0) {
      setError("กรุณาเลือกสินค้าทุกรายการ");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const itemsToAdd = newItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        pricePerUnit: item.pricePerUnit,
        discount: item.discount || 0,
        isFreebie: item.isFreebie || false,
        boxNumber: item.boxNumber || 1,
        promotionId: item.promotionId || null,
        parentItemId: item.parentItemId || null,
        isPromotionParent: item.isPromotionParent || false,
      }));

      await addUpsellItems(selectedOrder.id, currentUser.id, itemsToAdd);
      
      if (onSuccess) {
        onSuccess();
      } else {
        onCancel();
      }
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-500">กำลังโหลดข้อมูล...</div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <p className="text-yellow-800">ไม่พบออเดอร์ที่สามารถ Upsell ได้</p>
        </div>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          <ArrowLeft size={16} className="inline mr-2" />
          กลับ
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">เพิ่มรายการ Upsell</h1>
          <p className="text-gray-600 mt-1">
            ลูกค้า: {customer.firstName} {customer.lastName} ({customer.phone})
          </p>
        </div>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 flex items-center"
        >
          <ArrowLeft size={16} className="mr-2" />
          กลับ
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Order Selection */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          เลือกออเดอร์
        </label>
        <select
          value={selectedOrder?.id || ""}
          onChange={(e) => {
            const order = orders.find(
              (o) => String(o.id) === String(e.target.value),
            );
            setSelectedOrder(order || null);
            setNewItems([]);
            setError(null);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- ???????????? --</option>
          {orders.map((order) => (
            <option key={order.id} value={order.id}>
              ??????? {order.id} - {formatThaiDateTime(order.orderDate)} - ?{Number(order.totalAmount ?? 0).toLocaleString()}
            </option>
          ))}
        </select>
      </div>

      {selectedOrder && (
        <>
          {/* Existing Items (Read-only) */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <ShoppingCart size={20} className="mr-2" />
              รายการเดิม (ไม่สามารถแก้ไขได้)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">สินค้า</th>
                    <th className="px-4 py-2 text-right">จำนวน</th>
                    <th className="px-4 py-2 text-right">ราคาต่อหน่วย</th>
                    <th className="px-4 py-2 text-right">ส่วนลด</th>
                    <th className="px-4 py-2 text-right">รวม</th>
                    <th className="px-4 py-2 text-left">ผู้ขาย</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items && selectedOrder.items.length > 0 ? (
                    selectedOrder.items.map((item: any) => (
                      <tr key={item.id} className="border-b">
                        <td className="px-4 py-2">
                          {item.productName || `Product ID: ${item.productId}`}
                          {item.isFreebie && (
                            <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                              ของแถม
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">{item.quantity}</td>
                        <td className="px-4 py-2 text-right">฿{item.pricePerUnit.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right">฿{item.discount.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-semibold">
                          ฿{calculateItemTotal(item as LineItem).toLocaleString()}
                        </td>
                        <td className="px-4 py-2">
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            {getCreatorName(item.creatorId)}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 text-center text-gray-500">
                        ไม่มีรายการ
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-right font-semibold">
                      ยอดรวมเดิม:
                    </td>
                    <td colSpan={2} className="px-4 py-2 text-right font-bold text-lg">
                      ฿{selectedOrder.totalAmount.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* New Items */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                <Plus size={20} className="mr-2" />
                เพิ่มรายการใหม่
              </h2>
              <button
                onClick={handleAddNewItem}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
              >
                <Plus size={16} className="mr-2" />
                เพิ่มรายการ
              </button>
            </div>

            {newItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">สินค้า</th>
                      <th className="px-4 py-2 text-right">จำนวน</th>
                      <th className="px-4 py-2 text-right">ราคาต่อหน่วย</th>
                      <th className="px-4 py-2 text-right">ส่วนลด</th>
                      <th className="px-4 py-2 text-right">รวม</th>
                      <th className="px-4 py-2 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {newItems.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="px-4 py-2">
                          <select
                            value={item.productId || ""}
                            onChange={(e) => handleProductSelect(item.id, Number(e.target.value))}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                          >
                            <option value="">เลือกสินค้า</option>
                            {products.map(product => (
                              <option key={product.id} value={product.id}>
                                {product.name} - ฿{product.price?.toLocaleString()}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateNewItem(item.id, "quantity", Number(e.target.value))}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-right"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.pricePerUnit}
                            onChange={(e) => handleUpdateNewItem(item.id, "pricePerUnit", Number(e.target.value))}
                            className="w-32 px-2 py-1 border border-gray-300 rounded text-right"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.discount}
                            onChange={(e) => handleUpdateNewItem(item.id, "discount", Number(e.target.value))}
                            className="w-32 px-2 py-1 border border-gray-300 rounded text-right"
                          />
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">
                          ฿{calculateItemTotal(item).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => handleRemoveNewItem(item.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-right font-semibold">
                        ยอดรวมใหม่:
                      </td>
                      <td colSpan={2} className="px-4 py-2 text-right font-bold text-lg text-blue-600">
                        ฿{calculateNewItemsTotal().toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-right font-semibold">
                        ยอดรวมทั้งหมด:
                      </td>
                      <td colSpan={2} className="px-4 py-2 text-right font-bold text-xl text-green-600">
                        ฿{(selectedOrder.totalAmount + calculateNewItemsTotal()).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>ยังไม่มีรายการใหม่</p>
                <p className="text-sm mt-2">กดปุ่ม "เพิ่มรายการ" เพื่อเริ่มต้น</p>
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-4">
            <button
              onClick={onCancel}
              className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSave}
              disabled={saving || newItems.length === 0}
              className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
            >
              {saving ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <Save size={16} className="mr-2" />
                  บันทึก
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default UpsellOrderPage;
