import React, { useState, useMemo, useEffect } from 'react';
import { Customer, Order, LineItem, PaymentMethod, PaymentStatus, OrderStatus, Product, Promotion, Page, CodBox, Address, CustomerLifecycleStatus, CustomerBehavioralStatus, CustomerGrade } from '../types';

const emptyAddress: Address = { street: '', subdistrict: '', district: '', province: '', postalCode: '' };

interface CreateOrderPageProps {
  customers: Customer[];
  products: Product[];
  promotions: Promotion[];
  pages?: Page[];
  onSave: (payload: { 
    order: Partial<Omit<Order, 'id' | 'orderDate' | 'companyId' | 'creatorId'>>, 
    newCustomer?: Omit<Customer, 'id' | 'companyId' | 'totalPurchases' | 'totalCalls' | 'tags' | 'assignmentHistory'>,
    customerUpdate?: Partial<Pick<Customer, 'address' | 'facebookName' | 'lineId'>> 
  }) => void;
  onCancel: () => void;
  initialData?: { customer: Customer };
}

// Order Summary Component
const OrderSummary: React.FC<{ orderData: Partial<Order> }> = ({ orderData }) => {
  const subTotal = useMemo(() => {
    return orderData.items?.reduce((acc, item) => {
      const itemTotal = (item.quantity || 0) * (item.pricePerUnit || 0) - (item.discount || 0);
      return acc + (item.isFreebie ? 0 : itemTotal);
    }, 0) || 0;
  }, [orderData.items]);

  const totalAmount = useMemo(() => {
    return subTotal + (orderData.shippingCost || 0) - (orderData.billDiscount || 0);
  }, [subTotal, orderData.shippingCost, orderData.billDiscount]);
  
  return (
    <div className="bg-slate-50 border border-gray-300 rounded-lg p-6 sticky top-6">
      <h3 className="font-semibold text-lg mb-4 pb-2 border-b text-[#0e141b]">สรุปคำสั่งซื้อ</h3>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between text-[#4e7397]">
          <span>ยอดรวมสินค้า</span>
          <span className="text-[#0e141b] font-medium">฿{subTotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[#4e7397]">
          <span>ค่าขนส่ง</span>
          <span className="text-[#0e141b] font-medium">฿{(orderData.shippingCost || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[#4e7397]">
          <span>ส่วนลดท้ายบิล</span>
          <span className="text-red-600 font-medium">-฿{(orderData.billDiscount || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-lg border-t pt-3 mt-3">
          <span className="text-[#0e141b]">ยอดสุทธิ</span>
          <span className="text-green-600">฿{totalAmount.toFixed(2)}</span>
        </div>
      </div>
      
      {orderData.items && orderData.items.length > 0 && (
        <div className="mt-6 pt-6 border-t">
          <h4 className="font-medium text-sm mb-3 text-[#0e141b]">รายการสินค้า ({orderData.items.length})</h4>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {orderData.items.map((item, idx) => (
              <div key={item.id} className="text-xs p-2 bg-white rounded border">
                <div className="font-medium text-[#0e141b]">{item.productName || '(ไม่ระบุ)'}</div>
                <div className="text-[#4e7397] mt-1">
                  {item.quantity} × ฿{item.pricePerUnit.toFixed(2)}
                  {item.discount > 0 && <span> - ฿{item.discount}</span>}
                  {item.isFreebie && <span className="ml-2 text-green-600">(ของแถม)</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const CreateOrderPage: React.FC<CreateOrderPageProps> = ({ customers, products, promotions, pages = [], onSave, onCancel, initialData }) => {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(initialData?.customer || null);
  const [isCreatingNewCustomer, setIsCreatingNewCustomer] = useState(false);
  const [newCustomerFirstName, setNewCustomerFirstName] = useState('');
  const [newCustomerLastName, setNewCustomerLastName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerPhoneError, setNewCustomerPhoneError] = useState('');

  const [orderData, setOrderData] = useState<Partial<Order>>({
    items: [{ id: Date.now(), productName: '', quantity: 1, pricePerUnit: 0, discount: 0, isFreebie: false, boxNumber: 1 }],
    shippingCost: 0,
    billDiscount: 0,
    paymentMethod: PaymentMethod.Transfer,
    deliveryDate: new Date(Date.now() + 864e5).toISOString().split('T')[0],
    customerId: initialData?.customer?.id,
    boxes: [{ boxNumber: 1, codAmount: 0 }],
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [numBoxes, setNumBoxes] = useState(1);
  // Product selector modal state
  const [productSelectorOpen, setProductSelectorOpen] = useState(false);
  const [selectorTab, setSelectorTab] = useState<'products' | 'promotions'>('products');
  const [selectorSearchTerm, setSelectorSearchTerm] = useState('');
  const [leftFilter, setLeftFilter] = useState<number | null>(null);
  // track item ids with locked price (selected from product list)
  const [lockedItemIds, setLockedItemIds] = useState<number[]>([]);
  
  const [facebookName, setFacebookName] = useState("");
  const [lineId, setLineId] = useState("");
  const [salesChannel, setSalesChannel] = useState("");
  const [salesChannelPageId, setSalesChannelPageId] = useState<number | null>(null);

  const [useProfileAddress, setUseProfileAddress] = useState(true);
  const [shippingAddress, setShippingAddress] = useState<Address>(emptyAddress);
  const [saveNewAddress, setSaveNewAddress] = useState(false);

  const subTotal = useMemo(() => orderData.items?.reduce((acc, item) => acc + (item.quantity || 0) * (item.pricePerUnit || 0) - (item.discount || 0), 0) || 0, [orderData.items]);
  const totalAmount = useMemo(() => subTotal + (orderData.shippingCost || 0) - (orderData.billDiscount || 0), [subTotal, orderData.shippingCost, orderData.billDiscount]);
  
  const codTotal = useMemo(() => {
    return orderData.boxes?.reduce((sum, box) => sum + (box.codAmount || 0), 0) || 0;
  }, [orderData.boxes]);

  const isCodValid = useMemo(() => {
    if(orderData.paymentMethod !== PaymentMethod.COD) return true;
    return codTotal.toFixed(2) === totalAmount.toFixed(2) && totalAmount > 0;
  }, [orderData.paymentMethod, totalAmount, codTotal]);

  useEffect(() => {
    if (initialData?.customer) {
      handleSelectCustomer(initialData.customer);
    }
  }, [initialData]);
  
  useEffect(() => {
    if (orderData.paymentMethod === PaymentMethod.COD) {
      if (!orderData.boxes || orderData.boxes.length !== numBoxes) {
        const newBoxes: CodBox[] = Array.from({ length: numBoxes }, (_, i) => ({
          boxNumber: i + 1,
          codAmount: orderData.boxes?.[i]?.codAmount || 0,
        }));
        updateOrderData('boxes', newBoxes);
      }
    } else {
      updateOrderData('boxes', []);
    }
  }, [numBoxes, orderData.paymentMethod]);
  
  const handleUseProfileAddressToggle = (checked: boolean) => {
    setUseProfileAddress(checked);
    if (checked && selectedCustomer?.address) {
      setShippingAddress(selectedCustomer.address);
    } else {
      setShippingAddress(emptyAddress);
    }
  }

  const searchResults = useMemo(() => {
    if (!searchTerm || isCreatingNewCustomer) return [];
    const lowerSearchTerm = searchTerm.toLowerCase();
    return customers.filter(c => 
      (`${c.firstName} ${c.lastName}`).toLowerCase().includes(lowerSearchTerm) || 
      c.phone.includes(searchTerm)
    );
  }, [searchTerm, customers, isCreatingNewCustomer]);

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsCreatingNewCustomer(false);
    setOrderData(prev => ({ ...prev, customerId: customer.id }));
    setSearchTerm(`${customer.firstName} ${customer.lastName}`);
    setFacebookName(customer.facebookName || '');
    setLineId(customer.lineId || '');
    if (customer.address) {
      setUseProfileAddress(true);
      setShippingAddress(customer.address);
    } else {
      setUseProfileAddress(false);
      setShippingAddress(emptyAddress);
    }
  };

  const startCreatingNewCustomer = () => {
    setIsCreatingNewCustomer(true);
    setSelectedCustomer(null);
    setOrderData(prev => ({...prev, customerId: undefined}));
    
    if (/^0[0-9]{9}$/.test(searchTerm)) {
      setNewCustomerPhone(searchTerm);
      setNewCustomerFirstName('');
      setNewCustomerLastName('');
      setNewCustomerPhoneError('');
    } else {
      const nameParts = searchTerm.split(' ').filter(p => p);
      setNewCustomerFirstName(nameParts.shift() || '');
      setNewCustomerLastName(nameParts.join(' '));
      setNewCustomerPhone('');
      setNewCustomerPhoneError('กรุณากรอกเบอร์โทรศัพท์');
    }
    setFacebookName('');
    setLineId('');
    setShippingAddress(emptyAddress);
    setUseProfileAddress(false);
  }
  
  const updateOrderData = (field: keyof Order, value: any) => {
    setOrderData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleShippingAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShippingAddress(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  
  const handleNewCustomerPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length > 10) return;
    setNewCustomerPhone(value);

    if (value.length === 0) {
      setNewCustomerPhoneError('กรุณากรอกเบอร์โทรศัพท์');
    } else if (value.length !== 10) {
      setNewCustomerPhoneError('เบอร์โทรต้องมี 10 หลัก');
    } else if (value[0] !== '0') {
      setNewCustomerPhoneError('เบอร์โทรต้องขึ้นต้นด้วย 0');
    } else {
      setNewCustomerPhoneError('');
    }
  };

  const handleSave = () => {
    const isAddressIncomplete = Object.values(shippingAddress).some(val => (val as string).trim() === '');
    if (isAddressIncomplete) { alert('กรุณากรอกที่อยู่จัดส่งให้ครบถ้วน'); return; }
    if(!orderData.items || orderData.items.length === 0 || orderData.items.every(i => !i.productName)) { alert('กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ'); return; }
    if(orderData.paymentMethod === PaymentMethod.COD && !isCodValid) { alert('ยอด COD ในแต่ละกล่องรวมกันไม่เท่ากับยอดสุทธิ'); return; }

    const finalOrderData: Partial<Order> = {
      ...orderData,
      shippingAddress,
      totalAmount,
      paymentStatus: orderData.paymentMethod === PaymentMethod.Transfer ? PaymentStatus.Unpaid : PaymentStatus.Unpaid,
      orderStatus: OrderStatus.Pending,
      salesChannel: salesChannel,
      // @ts-ignore - backend supports this field; added in schema
      salesChannelPageId: salesChannel === 'Facebook' ? salesChannelPageId || undefined : undefined,
    };

    const payload: Parameters<typeof onSave>[0] = { order: finalOrderData };
    
    if (isCreatingNewCustomer) {
      if (!newCustomerFirstName.trim() || !newCustomerPhone.trim()) {
        alert('กรุณากรอกชื่อและเบอร์โทรศัพท์สำหรับลูกค้าใหม่');
        return;
      }
      if(newCustomerPhoneError) {
        alert(`เบอร์โทรศัพท์ไม่ถูกต้อง: ${newCustomerPhoneError}`);
        return;
      }

      (payload as any).newCustomer = {
        firstName: newCustomerFirstName,
        lastName: newCustomerLastName,
        phone: newCustomerPhone,
        facebookName: facebookName,
        lineId: lineId,
        address: shippingAddress,
        province: shippingAddress.province,
        assignedTo: null,
        dateAssigned: new Date().toISOString(),
        ownershipExpires: new Date(new Date().setDate(new Date().getDate() + 90)).toISOString(),
        lifecycleStatus: CustomerLifecycleStatus.New,
        behavioralStatus: CustomerBehavioralStatus.Warm,
        grade: CustomerGrade.D,
      };
    } else {
      if(!selectedCustomer) { alert('กรุณาเลือกลูกค้า'); return; }
      const hasSocialsChanged = facebookName !== (selectedCustomer?.facebookName || '') || lineId !== (selectedCustomer?.lineId || '');

      if ((!useProfileAddress && saveNewAddress) || hasSocialsChanged) {
        const customerUpdate: Partial<Pick<Customer, 'address' | 'facebookName' | 'lineId'>> = {};
        if (!useProfileAddress && saveNewAddress) {
          customerUpdate.address = shippingAddress;
        }
        if (hasSocialsChanged) {
          customerUpdate.facebookName = facebookName;
          customerUpdate.lineId = lineId;
        }
        (payload as any).customerUpdate = customerUpdate;
      }
    }
    
    onSave(payload);
  }

  const handleCodBoxAmountChange = (index: number, amount: number) => {
    const updatedBoxes = [...(orderData.boxes || [])];
    updatedBoxes[index].codAmount = amount;
    updateOrderData('boxes', updatedBoxes);
  };

  const divideCodEqually = () => {
    if (numBoxes <= 0 || totalAmount <= 0) return;
    const amountPerBox = totalAmount / numBoxes;
    const newBoxes = Array.from({ length: numBoxes }, (_, i) => ({
      boxNumber: i + 1,
      codAmount: 0
    }));

    let distributedAmount = 0;
    for(let i = 0; i < numBoxes -1; i++) {
      const roundedAmount = Math.floor(amountPerBox * 100) / 100;
      newBoxes[i].codAmount = roundedAmount;
      distributedAmount += roundedAmount;
    }
    newBoxes[numBoxes - 1].codAmount = parseFloat((totalAmount - distributedAmount).toFixed(2));
    
    updateOrderData('boxes', newBoxes);
  };

  // --- Product selection helpers ---
  const openProductSelector = (tab: 'products' | 'promotions' = 'products') => {
    setSelectorTab(tab);
    setProductSelectorOpen(true);
  };
  const closeProductSelector = () => setProductSelectorOpen(false);

  // Use real data from props (no client-side hardcode). If backend hasn't returned yet use empty arrays until loaded.
  const productsSafe = Array.isArray(products) ? products : [];
  const promotionsSafe = Array.isArray(promotions) ? promotions : [];

  const addProductById = (productId: number) => {
    const p = productsSafe.find(pr => pr.id === productId);
    if (!p) return;
    const newId = Date.now() + Math.floor(Math.random() * 1000);
    const newItem: LineItem = { id: newId, productName: p.name, quantity: 1, pricePerUnit: p.price, discount: 0, isFreebie: false, boxNumber: 1 };
    updateOrderData('items', [...(orderData.items || []), newItem]);
    setLockedItemIds(prev => [...prev, newId]);
    closeProductSelector();
  };

  const addPromotionById = (promoId: number | string) => {
    const promo = promotionsSafe.find(p => String(p.id) === String(promoId));
    if (!promo) return;
    const itemsToAdd: LineItem[] = [];
    for (const part of (promo.items || [])) {
      // part may contain productId and joined product info
      const prod = productsSafe.find(pr => pr.id === (part.productId ?? part.product_id)) || productsSafe.find(pr => pr.sku === (part.product?.sku || part.sku || part.product_sku));
      if (!prod) continue;
      const qty = Number(part.quantity || 1);
      const isFreeFlag = !!part.isFreebie || !!part.is_freebie;
      for (let i = 0; i < qty; i++) {
        const isFree = isFreeFlag; // promotion_items marks freebies per item; adjust if freeIndexes exist in future
        const newId = Date.now() + Math.floor(Math.random() * 1000) + i;
        itemsToAdd.push({ id: newId, productName: prod.name, quantity: 1, pricePerUnit: isFree ? 0 : prod.price, discount: 0, isFreebie: isFree, boxNumber: 1 });
        if (!isFree) setLockedItemIds(prev => [...prev, newId]);
      }
    }
    updateOrderData('items', [...(orderData.items || []), ...itemsToAdd]);
    closeProductSelector();
  };

  const commonInputClass = "w-full p-2.5 border border-gray-300 rounded-md bg-white text-[#0e141b] focus:ring-1 focus:ring-blue-500 focus:border-blue-500";
  const commonLabelClass = "block text-sm font-medium text-[#0e141b] mb-1.5";

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#0e141b] mb-2">สร้างคำสั่งซื้อใหม่</h1>
          <p className="text-[#4e7397]">กรอกข้อมูลลูกค้า สินค้า และการชำระเงินในหน้าเดียว</p>
        </div>

        {/* Main Content: 2 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Form */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Section 1: Customer Information */}
            <div className="bg-white rounded-lg border border-gray-300 p-6">
              <h2 className="text-lg font-semibold text-[#0e141b] mb-4 pb-3 border-b">ข้อมูลลูกค้า</h2>
              
              <div className="space-y-4">
                <div>
                  <label className={commonLabelClass}>ค้นหาลูกค้า (ชื่อ / เบอร์โทร)</label>
                  <input 
                    type="text" 
                    value={searchTerm} 
                    onChange={e => { setSearchTerm(e.target.value); setSelectedCustomer(null); setIsCreatingNewCustomer(false); }} 
                    placeholder="พิมพ์เพื่อค้นหา..." 
                    className={commonInputClass}
                  />
                  {searchResults.length > 0 && !selectedCustomer && (
                    <ul className="mt-2 border border-gray-300 rounded-md bg-white max-h-48 overflow-auto">
                      {searchResults.map(c => (
                        <li 
                          key={c.id} 
                          onClick={() => handleSelectCustomer(c)} 
                          className="p-2 hover:bg-slate-50 cursor-pointer text-[#0e141b] border-b last:border-b-0"
                        >
                          {`${c.firstName} ${c.lastName}`} - {c.phone}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!selectedCustomer && searchTerm && searchResults.length === 0 && !isCreatingNewCustomer && (
                    <button 
                      onClick={startCreatingNewCustomer} 
                      className="mt-2 text-sm text-blue-600 font-medium hover:underline"
                    >
                      ไม่พบลูกค้านี้ในระบบ? สร้างรายชื่อใหม่
                    </button>
                  )}
                </div>
                
                {(selectedCustomer || isCreatingNewCustomer) && (
                  <>
                    <div className="p-4 border border-gray-300 rounded-md bg-slate-50">
                      {isCreatingNewCustomer ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className={commonLabelClass}>ชื่อ <span className="text-red-500">*</span></label>
                            <input type="text" value={newCustomerFirstName} onChange={e => setNewCustomerFirstName(e.target.value)} className={commonInputClass} />
                          </div>
                          <div>
                            <label className={commonLabelClass}>นามสกุล</label>
                            <input type="text" value={newCustomerLastName} onChange={e => setNewCustomerLastName(e.target.value)} className={commonInputClass} />
                          </div>
                          <div className="col-span-2">
                            <label className={commonLabelClass}>เบอร์โทรศัพท์ <span className="text-red-500">*</span></label>
                            <input type="text" value={newCustomerPhone} onChange={handleNewCustomerPhoneChange} className={commonInputClass} />
                            {newCustomerPhoneError && <p className="text-xs text-red-500 mt-1">{newCustomerPhoneError}</p>}
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <p><strong className="font-medium text-[#0e141b]">ชื่อ:</strong> <span className="text-[#4e7397]">{`${selectedCustomer?.firstName} ${selectedCustomer?.lastName}`}</span></p>
                          <p><strong className="font-medium text-[#0e141b]">เบอร์โทร:</strong> <span className="text-[#4e7397]">{selectedCustomer?.phone}</span></p>
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={commonLabelClass}>ชื่อใน Facebook</label>
                        <input type="text" value={facebookName} onChange={e => setFacebookName(e.target.value)} className={commonInputClass} />
                      </div>
                      <div>
                        <label className={commonLabelClass}>LINE ID</label>
                        <input type="text" value={lineId} onChange={e => setLineId(e.target.value)} className={commonInputClass} />
                      </div>
                    </div>
                    
                    <div>
                      <label className={commonLabelClass}>ช่องทางการขาย</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <select value={salesChannel} onChange={e => { setSalesChannel(e.target.value); if (e.target.value !== 'Facebook') setSalesChannelPageId(null); }} className={commonInputClass}>
                          <option value="">เลือกช่องทางการขาย</option>
                          <option value="Facebook">Facebook</option>
                          <option value="Line">Line</option>
                          <option value="TikTok">TikTok</option>
                          <option value="โทร">โทร</option>
                        </select>
                        {salesChannel === 'Facebook' && (
                          <select value={salesChannelPageId ?? ''} onChange={e => setSalesChannelPageId(e.target.value ? Number(e.target.value) : null)} className={commonInputClass}>
                            <option value="">เลือกเพจ</option>
                            {pages.map(pg => (
                              <option key={pg.id} value={pg.id}>{pg.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Section 2: Shipping Address */}
            {(selectedCustomer || isCreatingNewCustomer) && (
              <div className="bg-white rounded-lg border border-gray-300 p-6">
                <h2 className="text-lg font-semibold text-[#0e141b] mb-4 pb-3 border-b">ที่อยู่จัดส่ง</h2>
                
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input 
                      type="checkbox" 
                      id="use-profile-address"
                      checked={useProfileAddress}
                      onChange={(e) => handleUseProfileAddressToggle(!useProfileAddress)}
                      disabled={!selectedCustomer?.address || isCreatingNewCustomer}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="use-profile-address" className="ml-2 text-sm text-[#0e141b]">ใช้ที่อยู่เดียวกับข้อมูลลูกค้า</label>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className={commonLabelClass}>บ้านเลขที่, ถนน</label>
                        <input type="text" name="street" value={shippingAddress.street} onChange={handleShippingAddressChange} disabled={useProfileAddress} className={commonInputClass} />
                      </div>
                      <div>
                        <label className={commonLabelClass}>ตำบล/แขวง</label>
                        <input type="text" name="subdistrict" value={shippingAddress.subdistrict} onChange={handleShippingAddressChange} disabled={useProfileAddress} className={commonInputClass} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className={commonLabelClass}>อำเภอ/เขต</label>
                        <input type="text" name="district" value={shippingAddress.district} onChange={handleShippingAddressChange} disabled={useProfileAddress} className={commonInputClass} />
                      </div>
                      <div>
                        <label className={commonLabelClass}>จังหวัด</label>
                        <input type="text" name="province" value={shippingAddress.province} onChange={handleShippingAddressChange} disabled={useProfileAddress} className={commonInputClass} />
                      </div>
                      <div>
                        <label className={commonLabelClass}>รหัสไปรษณีย์</label>
                        <input type="text" name="postalCode" value={shippingAddress.postalCode} onChange={handleShippingAddressChange} disabled={useProfileAddress} className={commonInputClass} />
                      </div>
                    </div>
                    {!useProfileAddress && selectedCustomer && (
                      <div className="flex items-center pt-2">
                        <input type="checkbox" id="save-new-address" checked={saveNewAddress} onChange={e => setSaveNewAddress(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <label htmlFor="save-new-address" className="ml-2 text-sm text-[#0e141b]">บันทึกที่อยู่ใหม่นี้เป็นที่อยู่หลัก</label>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={commonLabelClass}>วันที่จัดส่ง</label>
                      <input type="date" value={orderData.deliveryDate} onChange={e => updateOrderData('deliveryDate', e.target.value)} className={commonInputClass} />
                    </div>
                    <div>
                      <label className={commonLabelClass}>หมายเหตุ</label>
                      <input type="text" value={orderData.notes || ''} onChange={e => updateOrderData('notes', e.target.value)} className={commonInputClass} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section 3: Products */}
            {(selectedCustomer || isCreatingNewCustomer) && (
              <div className="bg-white rounded-lg border border-gray-300 p-6">
                <h2 className="text-lg font-semibold text-[#0e141b] mb-4 pb-3 border-b">รายการสินค้า</h2>
                
                <div className="space-y-3">
                  {orderData.items?.map((item, index) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-start p-3 border border-gray-200 rounded-md bg-slate-50">
                      <div className="col-span-4">
                        <label className="text-xs text-[#4e7397] mb-1 block">ชื่อสินค้า</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="ชื่อสินค้า" 
                            value={item.productName} 
                            onChange={e => updateOrderData('items', orderData.items?.map((it, i) => i === index ? {...it, productName: e.target.value} : it))} 
                            className="w-full p-2 border border-gray-300 rounded-md bg-white text-[#0e141b] text-sm"
                            disabled={lockedItemIds.includes(item.id)}
                          />
                          {/* button to open product selector */}
                          <button onClick={() => openProductSelector('products')} className="px-2 py-1 bg-white border rounded text-sm">เลือก</button>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-[#4e7397] mb-1 block">จำนวน</label>
                        <input 
                          type="number" 
                          placeholder="จำนวน" 
                          value={item.quantity} 
                          onChange={e => updateOrderData('items', orderData.items?.map((it, i) => i === index ? {...it, quantity: Number(e.target.value)} : it))} 
                          className="w-full p-2 border border-gray-300 rounded-md bg-white text-[#0e141b] text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-[#4e7397] mb-1 block">ราคา</label>
                        <input 
                          type="number" 
                          placeholder="ราคา" 
                          value={item.pricePerUnit} 
                          onChange={e => updateOrderData('items', orderData.items?.map((it, i) => i === index ? {...it, pricePerUnit: Number(e.target.value)} : it))} 
                          className="w-full p-2 border border-gray-300 rounded-md bg-white text-[#0e141b] text-sm"
                          disabled={lockedItemIds.includes(item.id)}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-[#4e7397] mb-1 block">ส่วนลด</label>
                        <input 
                          type="number" 
                          placeholder="ส่วนลด" 
                          value={item.discount} 
                          onChange={e => updateOrderData('items', orderData.items?.map((it, i) => i === index ? {...it, discount: Number(e.target.value)} : it))} 
                          className="w-full p-2 border border-gray-300 rounded-md bg-white text-[#0e141b] text-sm"
                        />
                      </div>
                      <div className="col-span-1 flex flex-col items-center justify-end h-full pb-2">
                        <label className="text-xs text-[#4e7397] mb-1 block">แถม</label>
                        <input 
                          type="checkbox" 
                          title="ของแถม" 
                          checked={item.isFreebie} 
                          onChange={e => updateOrderData('items', orderData.items?.map((it, i) => i === index ? {...it, isFreebie: e.target.checked} : it))} 
                          className="h-4 w-4"
                        />
                      </div>
                      <div className="col-span-1 flex items-end justify-center h-full pb-2">
                        <button 
                          onClick={() => updateOrderData('items', orderData.items?.filter((_, i) => i !== index))} 
                          className="text-red-500 hover:text-red-700 text-sm font-medium"
                        >
                          ลบ
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  <button 
                    onClick={() => updateOrderData('items', [...(orderData.items || []), { id: Date.now(), productName: '', quantity: 1, pricePerUnit: 0, discount: 0, isFreebie: false, boxNumber: 1 }])} 
                    className="text-sm text-blue-600 font-medium hover:underline"
                  >
                    + เพิ่มรายการสินค้า
                  </button>
        <div className="mt-3">
          <button onClick={() => openProductSelector('products')} className="px-3 py-2 bg-white border rounded-md mr-2">เลือกสินค้า</button>
          <button onClick={() => openProductSelector('promotions')} className="px-3 py-2 bg-white border rounded-md">เลือกโปรโมชั่น</button>
        </div>
        {/* Product / Promotion Selector Modal */}
        {productSelectorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg w-full max-w-[1200px] p-4 shadow-xl max-h-[85vh] overflow-hidden flex flex-col">
              <div className="flex gap-4 h-[70vh]">
                <div className="w-64 border-r pr-4 overflow-auto">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold">ประเภท</h3>
                    <button onClick={closeProductSelector} className="px-2 py-1 border rounded">ปิด</button>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className={`p-2 rounded ${!leftFilter && selectorTab === 'products' ? 'bg-slate-100' : ''} cursor-pointer`} onClick={() => { setSelectorTab('products'); setLeftFilter(null); setSelectorSearchTerm(''); }}>ทั้งหมด</li>
                    <li className={`p-2 rounded ${selectorTab === 'promotions' && leftFilter === -1 ? 'bg-slate-100' : ''} cursor-pointer`} onClick={() => { setSelectorTab('promotions'); setLeftFilter(-1); setSelectorSearchTerm(''); }}>รายการโปรโมชั่น</li>
                    {promotionsSafe.map(p => (
                      <li key={p.id} className={`p-2 rounded ${leftFilter === p.id ? 'bg-slate-100' : ''} cursor-pointer`} onClick={() => { setSelectorTab('promotions'); setLeftFilter(p.id); setSelectorSearchTerm(''); }}>{p.name}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex-1 flex flex-col min-w-0">
                  <div className="mb-3">
                    <input
                      type="text"
                      placeholder="ใส่ SKU ID, ชื่อ"
                      value={selectorSearchTerm}
                      onChange={e => setSelectorSearchTerm(e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>

                  <div className="flex-1 overflow-auto">
                    {selectorTab === 'products' && (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-[#4e7397] border-b">
                            <th className="p-2">SKU</th>
                            <th className="p-2">สินค้า</th>
                            <th className="p-2">ราคาขาย</th>
                            <th className="p-2">เลือก</th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.filter(pr => !selectorSearchTerm || `${pr.sku} ${pr.name}`.toLowerCase().includes(selectorSearchTerm.toLowerCase())).map(p => (
                            <tr key={p.id} className="border-b">
                              <td className="p-2 align-top">{p.sku}</td>
                              <td className="p-2 align-top">{p.name}</td>
                              <td className="p-2 align-top">{p.price.toFixed(2)}</td>
                              <td className="p-2 align-top"><button onClick={() => addProductById(p.id)} className="text-blue-600">เลือก</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {selectorTab === 'promotions' && (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-[#4e7397] border-b">
                            <th className="p-2">ชื่อโปรโมชั่น</th>
                            <th className="p-2">รายการ</th>
                            <th className="p-2">ราคาขาย</th>
                            <th className="p-2">เลือก</th>
                          </tr>
                        </thead>
                        <tbody>
                          {promotionsSafe.filter(pm => {
                            if (leftFilter && leftFilter !== -1) return String(pm.id) === String(leftFilter);
                            if (!selectorSearchTerm) return true;
                            return `${pm.name}`.toLowerCase().includes(selectorSearchTerm.toLowerCase());
                          }).map(pm => (
                            <tr key={pm.id} className="border-b">
                              <td className="p-2 align-top">{pm.name}</td>
                              <td className="p-2 align-top">{(pm.items || []).map((it: any) => {
                                const prodLabel = it.product_name ?? it.product?.name ?? it.sku ?? it.product_sku ?? '';
                                return `${it.quantity} x ${prodLabel}`;
                              }).join(', ')}</td>
                              <td className="p-2 align-top">{(pm.items || []).reduce((acc: number, it: any) => acc + (Number(it.product_price ?? it.price_override ?? 0) * Number(it.quantity || 1)), 0).toFixed(2)}</td>
                              <td className="p-2 align-top"><button onClick={() => addPromotionById(pm.id)} className="text-blue-600">เลือก</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <label className={commonLabelClass}>ค่าขนส่ง</label>
                      <input type="number" value={orderData.shippingCost} onChange={e => updateOrderData('shippingCost', Number(e.target.value))} className={commonInputClass} />
                    </div>
                    <div>
                      <label className={commonLabelClass}>ส่วนลดท้ายบิล</label>
                      <input type="number" value={orderData.billDiscount} onChange={e => updateOrderData('billDiscount', Number(e.target.value))} className={commonInputClass} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section 4: Payment Method */}
            {(selectedCustomer || isCreatingNewCustomer) && (
              <div className="bg-white rounded-lg border border-gray-300 p-6">
                <h2 className="text-lg font-semibold text-[#0e141b] mb-4 pb-3 border-b">วิธีการชำระเงิน</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className={commonLabelClass}>เลือกวิธีการชำระเงิน</label>
                    <select value={orderData.paymentMethod} onChange={e => updateOrderData('paymentMethod', e.target.value as PaymentMethod)} className={commonInputClass}>
                      <option value={PaymentMethod.Transfer}>โอนเงิน</option>
                      <option value={PaymentMethod.COD}>เก็บเงินปลายทาง (COD)</option>
                      <option value={PaymentMethod.PayAfter}>รับสินค้าก่อน</option>
                    </select>
                  </div>

                  {orderData.paymentMethod === PaymentMethod.Transfer && (
                    <div className="p-4 border border-blue-300 rounded-md bg-blue-50 text-sm text-[#0e141b]">
                      หากยังไม่แนบสลิป ระบบจะย้ายออเดอร์ไปที่แท็บ "รอสลิป" เพื่ออัปโหลดภายหลัง
                    </div>
                  )}
                  
                  {orderData.paymentMethod === PaymentMethod.COD && (
                    <div className="space-y-4 p-4 border border-gray-300 rounded-md bg-slate-50">
                      <h4 className="font-semibold text-[#0e141b]">รายละเอียดการเก็บเงินปลายทาง</h4>
                      <div className="p-3 border border-yellow-300 rounded-md bg-yellow-50 text-sm text-[#0e141b]">
                        โปรดระบุยอด COD ต่อกล่องให้ผลรวมเท่ากับยอดสุทธิ: <strong>฿{totalAmount.toFixed(2)}</strong>
                        <span className="ml-2">(ยอดรวมปัจจุบัน: <span className={!isCodValid ? 'text-red-600 font-bold' : 'text-green-700 font-bold'}>฿{codTotal.toFixed(2)}</span>)</span>
                      </div>
                      <div>
                        <label className={commonLabelClass}>จำนวนกล่อง</label>
                        <input type="number" min="1" value={numBoxes} onChange={e => setNumBoxes(Math.max(1, Number(e.target.value)))} className={commonInputClass} />
                      </div>
                      <button onClick={divideCodEqually} className="text-sm text-blue-600 font-medium hover:underline">แบ่งยอดเท่าๆ กัน</button>
                      <div className="space-y-2">
                        {orderData.boxes?.map((box, index) => (
                          <div key={index} className="flex items-center gap-4">
                            <label className="font-medium text-[#0e141b] w-24">กล่อง #{box.boxNumber}:</label>
                            <input type="number" placeholder="ยอด COD" value={box.codAmount} onChange={e => handleCodBoxAmountChange(index, Number(e.target.value))} className={commonInputClass} />
                          </div>
                        ))}
                      </div>
                      {!isCodValid && <p className="text-red-600 text-sm font-medium">ยอดรวม COD ไม่ถูกต้อง</p>}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Order Summary (Sticky) */}
          <div className="lg:col-span-1">
            <OrderSummary orderData={{...orderData, totalAmount}} />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel} className="px-6 py-2.5 bg-white border border-gray-300 text-[#0e141b] rounded-lg hover:bg-slate-50 font-medium">
            ยกเลิก
          </button>
          <button 
            onClick={handleSave} 
            disabled={!isCodValid || (isCreatingNewCustomer && !!newCustomerPhoneError)} 
            className="px-6 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            บันทึกคำสั่งซื้อ
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateOrderPage;

