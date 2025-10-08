

import React, { useState, useMemo, useEffect } from 'react';
import { Customer, Order, LineItem, PaymentMethod, PaymentStatus, OrderStatus, Product, CodBox, Address, CustomerLifecycleStatus, CustomerBehavioralStatus, CustomerGrade } from '../types';
import { X, Plus, Trash2, User, Home, ShoppingBag, Truck, CreditCard, Check, Search, AlertTriangle, ChevronRight, ChevronLeft, Facebook, MessageSquare, PlusCircle } from 'lucide-react';

const emptyAddress: Address = { street: '', subdistrict: '', district: '', province: '', postalCode: '' };

// Main Modal Props
interface CreateOrderModalProps {
  customers: Customer[];
  products: Product[];
  onSave: (payload: { 
    order: Partial<Omit<Order, 'id' | 'orderDate' | 'companyId' | 'creatorId'>>, 
    newCustomer?: Omit<Customer, 'id' | 'companyId' | 'totalPurchases' | 'totalCalls' | 'tags' | 'assignmentHistory'>,
    customerUpdate?: Partial<Pick<Customer, 'address' | 'facebookName' | 'lineId'>> 
  }) => void;
  onClose: () => void;
  initialData?: { customer: Customer };
}

// Stepper UI Component
const Stepper: React.FC<{ currentStep: number }> = ({ currentStep }) => {
  const steps = [
    { num: 1, label: 'ลูกค้า & ที่อยู่', icon: User },
    { num: 2, label: 'สินค้า', icon: ShoppingBag },
    { num: 3, label: 'ชำระเงิน & สรุป', icon: CreditCard },
  ];
  return (
    <div className="flex items-center justify-between border-b pb-4 mb-6">
      {steps.map((step, index) => (
        <React.Fragment key={step.num}>
          <div className="flex flex-col items-center text-center w-28">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                currentStep >= step.num ? 'bg-[#2E7D32] text-white' : 'bg-gray-200 text-gray-500'
              }`}>
              {currentStep > step.num ? <Check size={20} /> : <step.icon size={20} />}
            </div>
            <p className={`text-xs mt-2 transition-colors ${currentStep >= step.num ? 'text-[#2E7D32] font-semibold' : 'text-gray-500'}`}>{step.label}</p>
          </div>
          {index < steps.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${currentStep > step.num ? 'bg-[#2E7D32]' : 'bg-gray-200'}`}></div>}
        </React.Fragment>
      ))}
    </div>
  );
};

// Order Summary Panel Component
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
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg h-full">
          <h3 className="font-semibold text-lg mb-4 border-b pb-2 text-gray-700">สรุปรายการ</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">ยอดรวมสินค้า</span><span>{subTotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">ค่าขนส่ง</span><span>{(orderData.shippingCost || 0).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">ส่วนลดท้ายบิล</span><span className="text-red-600">-{ (orderData.billDiscount || 0).toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2"><span className="text-gray-800">ยอดสุทธิ</span><span className="text-[#2E7D32]">฿{totalAmount.toFixed(2)}</span></div>
          </div>
      </div>
  );
};

// Main Modal Component
const CreateOrderModal: React.FC<CreateOrderModalProps> = ({ customers, products, onSave, onClose, initialData }) => {
  const [currentStep, setCurrentStep] = useState(1);
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
  
  const [facebookName, setFacebookName] = useState("");
  const [lineId, setLineId] = useState("");
  const [salesChannel, setSalesChannel] = useState("");


  // Address State
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
    
    // Check if search term is a valid phone number, if not, assume it's a name
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

  const handleNext = () => setCurrentStep(prev => Math.min(prev + 1, 3));
  const handleBack = () => setCurrentStep(prev => Math.max(prev - 1, 1));
  
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


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <header className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-semibold text-gray-800">สร้างคำสั่งซื้อใหม่</h2>
              <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-100"><X size={20} /></button>
            </header>
            <main className="p-6 flex-grow overflow-y-auto">
              <Stepper currentStep={currentStep} />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  
                    {/* Step 1: Customer */}
                    {currentStep === 1 && (
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-lg font-semibold mb-2">1. ข้อมูลลูกค้า</h3>
                          <div className="relative">
                              <label className="block text-sm font-medium text-gray-700">ค้นหาลูกค้า (ชื่อ / เบอร์โทร)</label>
                              <Search size={16} className="absolute left-3 top-9 text-gray-400"/>
                              <input type="text" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setSelectedCustomer(null); setIsCreatingNewCustomer(false); }} placeholder="พิมพ์เพื่อค้นหา..." className="w-full pl-10 p-2 border rounded-md bg-white text-gray-900" style={{ colorScheme: 'light' }}/>
                              {searchResults.length > 0 && !selectedCustomer && (
                                  <ul className="absolute z-10 w-full bg-white border rounded-md mt-1 shadow-lg max-h-60 overflow-auto">
                                      {searchResults.map(c => <li key={c.id} onClick={() => handleSelectCustomer(c)} className="p-2 hover:bg-gray-100 cursor-pointer text-gray-900">{`${c.firstName} ${c.lastName}`} - {c.phone}</li>)}
                                  </ul>
                              )}
                              {!selectedCustomer && searchTerm && searchResults.length === 0 && !isCreatingNewCustomer && (
                                <button onClick={startCreatingNewCustomer} className="mt-2 text-sm text-blue-600 font-medium flex items-center hover:underline">
                                  <PlusCircle size={16} className="mr-1"/>
                                  ไม่พบลูกค้านี้ในระบบ? สร้างรายชื่อใหม่
                                </button>
                              )}
                          </div>
                          
                          {(selectedCustomer || isCreatingNewCustomer) && (
                            <>
                              <div className="mt-2 p-4 border rounded-md bg-green-50 grid grid-cols-2 gap-4 text-sm text-gray-900" style={{color: '#000000'}}>
                                  {isCreatingNewCustomer ? (
                                    <>
                                       <div>
                                            <label className="block text-xs font-medium text-gray-600">ชื่อ <span className="text-red-500">*</span></label>
                                            <input type="text" value={newCustomerFirstName} onChange={e => setNewCustomerFirstName(e.target.value)} className="w-full p-1.5 border rounded-md bg-white" style={{colorScheme: 'light'}} />
                                       </div>
                                       <div>
                                            <label className="block text-xs font-medium text-gray-600">นามสกุล</label>
                                            <input type="text" value={newCustomerLastName} onChange={e => setNewCustomerLastName(e.target.value)} className="w-full p-1.5 border rounded-md bg-white" style={{colorScheme: 'light'}} />
                                       </div>
                                       <div className="col-span-2">
                                            <label className="block text-xs font-medium text-gray-600">เบอร์โทรศัพท์ <span className="text-red-500">*</span></label>
                                            <input type="text" value={newCustomerPhone} onChange={handleNewCustomerPhoneChange} className="w-full p-1.5 border rounded-md bg-white" style={{colorScheme: 'light'}} />
                                            {newCustomerPhoneError && <p className="text-xs text-red-500 mt-1">{newCustomerPhoneError}</p>}
                                       </div>
                                    </>
                                  ) : (
                                    <>
                                        <p><strong className="font-medium text-gray-800">ชื่อ:</strong> {`${selectedCustomer?.firstName} ${selectedCustomer?.lastName}`}</p>
                                        <p><strong className="font-medium text-gray-800">เบอร์โทร:</strong> {selectedCustomer?.phone}</p>
                                    </>
                                  )}
                              </div>
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                  <div>
                                      <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                                          <Facebook size={16} className="text-blue-600" />
                                          <span className="ml-2">ชื่อใน Facebook</span>
                                      </label>
                                      <input type="text" value={facebookName} onChange={e => setFacebookName(e.target.value)} className="w-full p-2 border rounded-md bg-white text-gray-900" style={{ colorScheme: 'light' }} />
                                  </div>
                                  <div>
                                      <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                                          <MessageSquare size={16} className="text-green-500" />
                                          <span className="ml-2">LINE ID</span>
                                      </label>
                                      <input type="text" value={lineId} onChange={e => setLineId(e.target.value)} className="w-full p-2 border rounded-md bg-white text-gray-900" style={{ colorScheme: 'light' }} />
                                  </div>
                              </div>
                              <div className="mt-4">
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                      ช่องทางการขาย
                                  </label>
                                  <select value={salesChannel} onChange={e => setSalesChannel(e.target.value)} className="w-full p-2 border rounded-md bg-white text-gray-900" style={{ colorScheme: 'light' }}>
                                      <option value="">เลือกช่องทางการขาย</option>
                                      <option value="Facebook">Facebook</option>
                                      <option value="Line">Line</option>
                                      <option value="TikTok">TikTok</option>
                                      <option value="โทร">โทร</option>
                                  </select>
                              </div>
                            </>
                          )}
                        </div>

                        {(selectedCustomer || isCreatingNewCustomer) && (
                          <div className="border-t pt-4">
                            <h3 className="text-lg font-semibold mb-2">ที่อยู่จัดส่ง</h3>
                            <div className="flex items-center mb-4">
                               <input 
                                  type="checkbox" 
                                  id="use-profile-address"
                                  checked={useProfileAddress}
                                  onChange={(e) => {
                                    e.preventDefault();
                                    handleUseProfileAddressToggle(!useProfileAddress);
                                  }}
                                  disabled={!selectedCustomer?.address || isCreatingNewCustomer}
                                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                               />
                               <label htmlFor="use-profile-address" className="ml-2 block text-sm text-gray-900">ใช้ที่อยู่เดียวกับข้อมูลลูกค้า</label>
                            </div>
                            
                            <div className="space-y-3 p-4 border rounded-md bg-gray-50">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600">บ้านเลขที่, ถนน</label>
                                    <input type="text" name="street" value={shippingAddress.street} onChange={handleShippingAddressChange} disabled={useProfileAddress} className="w-full p-2 text-sm border rounded-md bg-white text-gray-900 disabled:bg-gray-200" style={{ colorScheme: 'light' }}/>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600">ตำบล/แขวง</label>
                                    <input type="text" name="subdistrict" value={shippingAddress.subdistrict} onChange={handleShippingAddressChange} disabled={useProfileAddress} className="w-full p-2 text-sm border rounded-md bg-white text-gray-900 disabled:bg-gray-200" style={{ colorScheme: 'light' }}/>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600">อำเภอ/เขต</label>
                                    <input type="text" name="district" value={shippingAddress.district} onChange={handleShippingAddressChange} disabled={useProfileAddress} className="w-full p-2 text-sm border rounded-md bg-white text-gray-900 disabled:bg-gray-200" style={{ colorScheme: 'light' }}/>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600">จังหวัด</label>
                                    <input type="text" name="province" value={shippingAddress.province} onChange={handleShippingAddressChange} disabled={useProfileAddress} className="w-full p-2 text-sm border rounded-md bg-white text-gray-900 disabled:bg-gray-200" style={{ colorScheme: 'light' }}/>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600">รหัสไปรษณีย์</label>
                                    <input type="text" name="postalCode" value={shippingAddress.postalCode} onChange={handleShippingAddressChange} disabled={useProfileAddress} className="w-full p-2 text-sm border rounded-md bg-white text-gray-900 disabled:bg-gray-200" style={{ colorScheme: 'light' }}/>
                                  </div>
                                </div>
                                {!useProfileAddress && selectedCustomer && (
                                  <div className="flex items-center pt-2">
                                      <input type="checkbox" id="save-new-address" checked={saveNewAddress} onChange={e => setSaveNewAddress(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                                      <label htmlFor="save-new-address" className="ml-2 block text-sm text-gray-900">บันทึกที่อยู่ใหม่นี้เป็นที่อยู่หลัก</label>
                                  </div>
                                )}
                            </div>
                          </div>
                        )}
                        
                        <div className="border-t pt-4">
                             <label className="block text-sm font-medium text-gray-700">วันที่จัดส่ง</label>
                             <input type="date" value={orderData.deliveryDate} onChange={e => updateOrderData('deliveryDate', e.target.value)} className="w-full p-2 border rounded-md bg-white text-gray-900" style={{ colorScheme: 'light' }}/>
                        </div>
                         <div>
                             <label className="block text-sm font-medium text-gray-700">หมายเหตุ</label>
                             <textarea value={orderData.notes} onChange={e => updateOrderData('notes', e.target.value)} className="w-full p-2 border rounded-md bg-white text-gray-900" rows={2} style={{ colorScheme: 'light' }}></textarea>
                        </div>
                      </div>
                    )}
                    
                    {/* Step 2: Products */}
                    {currentStep === 2 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold">2. รายการสินค้า</h3>
                            {orderData.items?.map((item, index) => (
                                <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                                    <input type="text" placeholder="ชื่อสินค้า" value={item.productName} onChange={e => updateOrderData('items', orderData.items?.map((it, i) => i === index ? {...it, productName: e.target.value} : it))} className="col-span-4 p-2 border rounded-md bg-white text-gray-900" style={{ colorScheme: 'light' }} />
                                    <input type="number" placeholder="จำนวน" value={item.quantity} onChange={e => updateOrderData('items', orderData.items?.map((it, i) => i === index ? {...it, quantity: Number(e.target.value)} : it))} className="col-span-2 p-2 border rounded-md bg-white text-gray-900" style={{ colorScheme: 'light' }} />
                                    <input type="number" placeholder="ราคา" value={item.pricePerUnit} onChange={e => updateOrderData('items', orderData.items?.map((it, i) => i === index ? {...it, pricePerUnit: Number(e.target.value)} : it))} className="col-span-2 p-2 border rounded-md bg-white text-gray-900" style={{ colorScheme: 'light' }} />
                                    <input type="number" placeholder="ส่วนลด" value={item.discount} onChange={e => updateOrderData('items', orderData.items?.map((it, i) => i === index ? {...it, discount: Number(e.target.value)} : it))} className="col-span-2 p-2 border rounded-md bg-white text-gray-900" style={{ colorScheme: 'light' }} />
                                    <div className="col-span-1 flex items-center justify-center"><input type="checkbox" title="ของแถม" checked={item.isFreebie} onChange={e => updateOrderData('items', orderData.items?.map((it, i) => i === index ? {...it, isFreebie: e.target.checked} : it))} className="h-4 w-4"/></div>
                                    <button onClick={() => updateOrderData('items', orderData.items?.filter((_, i) => i !== index))} className="col-span-1 text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                                </div>
                            ))}
                             <button onClick={() => updateOrderData('items', [...(orderData.items || []), { id: Date.now(), productName: '', quantity: 1, pricePerUnit: 0, discount: 0, isFreebie: false, boxNumber: 1 }])} className="flex items-center text-sm text-green-600 font-medium"><Plus size={16} className="mr-1" /> เพิ่มรายการ</button>
                             <div className="grid grid-cols-2 gap-4 border-t pt-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">ค่าขนส่ง</label>
                                    <input type="number" value={orderData.shippingCost} onChange={e => updateOrderData('shippingCost', Number(e.target.value))} className="w-full p-2 border rounded-md bg-white text-gray-900" style={{ colorScheme: 'light' }} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">ส่วนลดท้ายบิล</label>
                                    <input type="number" value={orderData.billDiscount} onChange={e => updateOrderData('billDiscount', Number(e.target.value))} className="w-full p-2 border rounded-md bg-white text-gray-900" style={{ colorScheme: 'light' }} />
                                </div>
                             </div>
                        </div>
                    )}
                    
                    {/* Step 3: Payment & COD */}
                    {currentStep === 3 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold">3. ชำระเงิน & สรุป</h3>
                             <div>
                                <label className="block text-sm font-medium text-gray-700">วิธีการชำระเงิน</label>
                                <select value={orderData.paymentMethod} onChange={e => updateOrderData('paymentMethod', e.target.value as PaymentMethod)} className="w-full p-2 border rounded-md bg-white text-gray-900" style={{ colorScheme: 'light' }}>
                                    <option value={PaymentMethod.Transfer} className="text-black">โอนเงิน</option>
                                    <option value={PaymentMethod.COD} className="text-black">เก็บเงินปลายทาง (COD)</option>
                                    <option value={PaymentMethod.PayAfter} className="text-black">รับสินค้าก่อน</option>
                                </select>
                            </div>

                            {orderData.paymentMethod === PaymentMethod.Transfer && (
                                <div className="p-4 border rounded-md bg-blue-50 text-sm space-y-2 text-gray-900" style={{color: '#000000'}}>
                                    <p>หากยังไม่แนบสลิป ระบบจะย้ายออเดอร์ไปที่แท็บ "รอสลิป" เพื่ออัปโหลดภายหลัง</p>
                                    <button className="px-3 py-1.5 bg-white border rounded-md text-gray-700 hover:bg-gray-100">แนบสลิป</button>
                                </div>
                            )}
                             
                            {orderData.paymentMethod === PaymentMethod.COD && (
                                <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                                    <h4 className="font-semibold text-gray-800">รายละเอียดการเก็บเงินปลายทาง</h4>
                                    <div className="p-4 border rounded-md bg-yellow-50 text-gray-900 flex items-center text-sm flex-wrap" style={{color: '#000000'}}>
                                        <AlertTriangle size={16} className="mr-2 text-yellow-600"/>
                                        <span>โปรดระบุยอด COD ต่อกล่องให้ผลรวมเท่ากับยอดสุทธิ: <strong className="text-yellow-900">฿{totalAmount.toFixed(2)}</strong></span>
                                        <span className="ml-2 font-medium">(ยอดรวมปัจจุบัน: 
                                            <span className={!isCodValid ? 'text-red-600 font-bold' : 'text-green-700 font-bold'}> ฿{codTotal.toFixed(2)}</span>)
                                        </span>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">จำนวนกล่อง</label>
                                        <input type="number" min="1" value={numBoxes} onChange={e => setNumBoxes(Math.max(1, Number(e.target.value)))} className="w-full p-2 border rounded-md bg-white text-gray-900" style={{ colorScheme: 'light' }} />
                                    </div>
                                    <button onClick={divideCodEqually} className="text-sm text-blue-600 font-medium hover:underline">แบ่งยอดเท่าๆ กัน</button>
                                    <div className="space-y-2">
                                        {orderData.boxes?.map((box, index) => (
                                            <div key={index} className="flex items-center gap-4">
                                                <label className="font-medium text-gray-800">กล่อง #{box.boxNumber}:</label>
                                                <input type="number" placeholder="ยอด COD" value={box.codAmount} onChange={e => handleCodBoxAmountChange(index, Number(e.target.value))} className="w-full p-2 border rounded-md bg-white text-gray-900" style={{ colorScheme: 'light' }} />
                                            </div>
                                        ))}
                                    </div>
                                    {!isCodValid && <p className="text-red-600 text-sm">ยอดรวม COD ไม่ถูกต้อง</p>}
                                </div>
                            )}
                        </div>
                    )}

                </div>
                <div className="lg:col-span-1">
                  <div className="sticky top-6">
                    <OrderSummary orderData={{...orderData, totalAmount}} />
                  </div>
                </div>
              </div>
            </main>
            <footer className="flex justify-between items-center p-4 border-t bg-white flex-shrink-0">
                <div>
                     <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">ยกเลิก</button>
                </div>
                <div className="flex items-center space-x-2">
                    {currentStep > 1 && <button onClick={handleBack} className="px-4 py-2 bg-white border text-gray-800 rounded-lg hover:bg-gray-50 flex items-center"><ChevronLeft size={16} className="mr-1"/> ย้อนกลับ</button>}
                    {currentStep < 3 && <button onClick={handleNext} disabled={!selectedCustomer && !isCreatingNewCustomer} className="px-4 py-2 bg-[#2E7D32] text-white rounded-lg hover:bg-green-800 flex items-center disabled:bg-gray-300">ถัดไป <ChevronRight size={16} className="ml-1"/></button>}
                    {currentStep === 3 && <button onClick={handleSave} disabled={!isCodValid || (isCreatingNewCustomer && !!newCustomerPhoneError)} className="px-6 py-2 bg-[#2E7D32] text-white font-semibold rounded-lg hover:bg-green-800 disabled:bg-gray-300">บันทึกออเดอร์</button>}
                </div>
            </footer>
        </div>
    </div>
  );
};

export default CreateOrderModal;



