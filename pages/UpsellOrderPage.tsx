import React, { useState, useEffect, useMemo } from "react";
import { Customer, Order, Product, User, LineItem, PaymentMethod, CodBox } from "../types";
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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [upsellBoxes, setUpsellBoxes] = useState<CodBox[]>([]);
  const [numUpsellBoxes, setNumUpsellBoxes] = useState(1);

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

  // Get max box number from original order items
  const getMaxOriginalBoxNumber = () => {
    if (!selectedOrder?.items) return 0;
    const maxBox = Math.max(...selectedOrder.items.map((item: any) => item.boxNumber || 1));
    return maxBox;
  };

  // Calculate unique box numbers from new items
  const getUniqueBoxNumbers = () => {
    const boxNumbers = new Set<number>();
    newItems.forEach(item => {
      if (item.boxNumber) {
        boxNumbers.add(item.boxNumber);
      }
    });
    return Array.from(boxNumbers).sort((a, b) => a - b);
  };

  // Update upsell boxes when numUpsellBoxes changes
  useEffect(() => {
    if (selectedOrder?.paymentMethod !== PaymentMethod.COD) {
      if (upsellBoxes.length > 0) {
        setUpsellBoxes([]);
      }
      return;
    }
    
    const maxOriginalBox = getMaxOriginalBoxNumber();
    
    // Always create boxes from 1 to numUpsellBoxes (preserve existing codAmount)
    const newBoxes: CodBox[] = [];
    for (let i = 1; i <= numUpsellBoxes; i++) {
      const actualBoxNumber = maxOriginalBox + i;
      // Try to preserve existing codAmount if box number matches
      const existingBox = upsellBoxes.find(b => b.boxNumber === actualBoxNumber);
      newBoxes.push({
        boxNumber: actualBoxNumber,
        codAmount: existingBox?.codAmount || 0,
      });
    }
    
    // Only update if boxes changed (compare by boxNumber only, not codAmount)
    const currentBoxNumbers = new Set(upsellBoxes.map(b => b.boxNumber));
    const newBoxNumbers = new Set(newBoxes.map(b => b.boxNumber));
    const boxesChanged = currentBoxNumbers.size !== newBoxNumbers.size || 
      !Array.from(currentBoxNumbers).every((n: number) => newBoxNumbers.has(n));
    
    if (boxesChanged) {
      setUpsellBoxes(newBoxes);
    }
  }, [numUpsellBoxes, selectedOrder?.id, selectedOrder?.paymentMethod]);

  // Calculate COD totals
  const newItemsTotal = useMemo(() => calculateNewItemsTotal(), [newItems]);
  const codTotal = useMemo(() => {
    return upsellBoxes.reduce((sum, box) => sum + (box.codAmount || 0), 0);
  }, [upsellBoxes]);
  const codRemaining = newItemsTotal - codTotal;
  const isCodValid = Math.abs(codRemaining) < 0.01; // Allow small floating point differences

  const handleCodBoxAmountChange = (index: number, amount: number) => {
    const updatedBoxes = [...upsellBoxes];
    updatedBoxes[index].codAmount = amount;
    setUpsellBoxes(updatedBoxes);
  };

  const divideCodEqually = () => {
    if (numUpsellBoxes <= 0 || newItemsTotal <= 0) return;
    const amountPerBox = newItemsTotal / numUpsellBoxes;
    const newBoxes: CodBox[] = [];
    const maxOriginalBox = getMaxOriginalBoxNumber();
    
    let distributedAmount = 0;
    for (let i = 0; i < numUpsellBoxes - 1; i++) {
      const roundedAmount = Math.floor(amountPerBox * 100) / 100;
      newBoxes.push({
        boxNumber: maxOriginalBox + i + 1,
        codAmount: roundedAmount,
      });
      distributedAmount += roundedAmount;
    }
    newBoxes.push({
      boxNumber: maxOriginalBox + numUpsellBoxes,
      codAmount: parseFloat((newItemsTotal - distributedAmount).toFixed(2)),
    });
    
    setUpsellBoxes(newBoxes);
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

    // Validate COD boxes if payment method is COD
    if (selectedOrder.paymentMethod === PaymentMethod.COD) {
      // Check if all items have box number assigned
      const itemsWithoutBox = newItems.filter(
        item => !item.isFreebie && (!item.boxNumber || item.boxNumber < 1 || item.boxNumber > numUpsellBoxes)
      );
      if (itemsWithoutBox.length > 0) {
        setError("กรุณาเลือกกล่องให้ครบทุกรายการสินค้า");
        return;
      }

      // Get boxes that actually have items (don't require all boxes from 1 to numUpsellBoxes)
      const uniqueBoxes = new Set<number>();
      newItems.forEach(item => {
        if (!item.isFreebie && item.boxNumber && item.boxNumber >= 1 && item.boxNumber <= numUpsellBoxes) {
          uniqueBoxes.add(item.boxNumber);
        }
      });
      
      // Validate COD amounts - only check boxes that have items
      if (!isCodValid) {
        setError(`ยอด COD ในแต่ละกล่องรวมกันต้องเท่ากับยอดสุทธิ (${newItemsTotal.toFixed(2)} บาท)`);
        return;
      }
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
      
      // Show success modal
      setShowSuccessModal(true);
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
            setUpsellBoxes([]);
            setNumUpsellBoxes(1);
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
                      {selectedOrder.paymentMethod === PaymentMethod.COD && (
                        <th className="px-4 py-2 text-center">กล่อง</th>
                      )}
                      <th className="px-4 py-2 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {newItems.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <select
                              value={item.productId || ""}
                              onChange={(e) => handleProductSelect(item.id, Number(e.target.value))}
                              className="flex-1 px-2 py-1 border border-gray-300 rounded"
                            >
                              <option value="">เลือกสินค้า</option>
                              {products.map(product => (
                                <option key={product.id} value={product.id}>
                                  {product.name} - ฿{product.price?.toLocaleString()}
                                </option>
                              ))}
                            </select>
                            {selectedOrder.paymentMethod === PaymentMethod.COD && item.boxNumber && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded whitespace-nowrap">
                                กล่องที่ {item.boxNumber}
                              </span>
                            )}
                          </div>
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
                        {selectedOrder.paymentMethod === PaymentMethod.COD && (
                          <td className="px-4 py-2 text-center">
                            <select
                              value={item.boxNumber || 1}
                              onChange={(e) => handleUpdateNewItem(item.id, "boxNumber", Number(e.target.value))}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                            >
                              {Array.from({ length: numUpsellBoxes }, (_, i) => i + 1).map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                          </td>
                        )}
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

            {/* COD Box Section */}
            {selectedOrder.paymentMethod === PaymentMethod.COD && newItems.length > 0 && (
              <div className="mt-6 p-4 border border-gray-300 rounded-md bg-slate-50">
                <h4 className="font-semibold text-gray-800 mb-4">
                  รายละเอียดการเก็บเงินปลายทาง (กล่องที่เพิ่มขึ้น)
                </h4>
                <div className="p-3 border border-yellow-300 rounded-md bg-yellow-50 text-sm text-gray-800 mb-4">
                  โปรดระบุยอด COD ต่อกล่องให้ผลรวมเท่ากับยอดเพิ่มใหม่:{" "}
                  <strong>฿{newItemsTotal.toFixed(2)}</strong>
                  <span className="ml-2">
                    (ยอดรวมปัจจุบัน:{" "}
                    <span
                      className={
                        !isCodValid
                          ? "text-red-600 font-bold"
                          : "text-green-700 font-bold"
                      }
                    >
                      ฿{codTotal.toFixed(2)}
                    </span>
                    )
                  </span>
                  <span className="block mt-1">
                    {codRemaining === 0 ? (
                      <span className="text-green-700 font-medium">
                        ครบถ้วนแล้ว
                      </span>
                    ) : codRemaining > 0 ? (
                      <span className="text-orange-600 font-medium">
                        คงเหลือ: ฿{Math.abs(codRemaining).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-red-600 font-medium">
                        เกิน: ฿{Math.abs(codRemaining).toFixed(2)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    จำนวนกล่อง (สำหรับสินค้าใหม่)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={numUpsellBoxes}
                    onChange={(e) => {
                      const newValue = Math.max(1, Number(e.target.value));
                      setNumUpsellBoxes(newValue);
                      setError(null);
                    }}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    จำนวนกล่องที่ต้องการสำหรับสินค้าใหม่ (สามารถเพิ่มได้ตามต้องการ)
                  </p>
                </div>
                <button
                  onClick={divideCodEqually}
                  className="text-sm text-blue-600 font-medium hover:underline mb-4"
                >
                  แบ่งยอดเท่าๆ กัน
                </button>
                <div className="space-y-2">
                  {upsellBoxes.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">
                      กรุณาเลือกกล่องให้กับสินค้าก่อน (ระบบจะแสดงกล่องที่เลือกไว้เท่านั้น)
                    </p>
                  ) : (
                    upsellBoxes.map((box, index) => {
                      const maxOriginalBox = getMaxOriginalBoxNumber();
                      const displayBoxNumber = box.boxNumber - maxOriginalBox;
                      return (
                        <div key={index} className="flex items-center gap-4">
                          <label className="font-medium text-gray-800 w-32">
                            กล่องที่ {displayBoxNumber}:
                          </label>
                          <input
                            type="number"
                            placeholder="ยอด COD"
                            value={box.codAmount}
                            onChange={(e) =>
                              handleCodBoxAmountChange(
                                index,
                                Number(e.target.value) || 0,
                              )
                            }
                            className="w-40 px-3 py-2 border border-gray-300 rounded-md"
                            min="0"
                            step="0.01"
                          />
                          {displayBoxNumber === 1 && maxOriginalBox >= 1 && (
                            <span className="text-xs text-gray-500 italic">
                              (สามารถรวมกับกล่องที่ 1 ของต้นทาง หรือใส่ 0 หากไม่รวม)
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                {!isCodValid && (
                  <p className="text-red-600 text-sm font-medium mt-2">
                    ยอดรวม COD ไม่ถูกต้อง
                  </p>
                )}
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

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#0e141b]">
              สร้างคำสั่งซื้อเพิ่มเติมสำเร็จ
            </h3>
            {selectedOrder && (
              <p className="mt-1 text-sm text-[#4e7397]">
                หมายเลขคำสั่งซื้อ {selectedOrder.id}
              </p>
            )}
            <p className="mt-4 text-sm text-[#4e7397]">
              สามารถกลับไปยังหน้าหลักเพื่อดำเนินงานต่อได้ทันที
            </p>
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  if (onSuccess) {
                    onSuccess();
                  } else {
                    onCancel();
                  }
                }}
                className="inline-flex items-center rounded-lg bg-green-600 px-5 py-2.5 font-semibold text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                กลับสู่หน้าหลัก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpsellOrderPage;
