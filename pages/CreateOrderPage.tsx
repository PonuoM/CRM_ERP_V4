import React, { useState, useMemo, useEffect } from 'react';
import { Customer, Order, LineItem, PaymentMethod, PaymentStatus, OrderStatus, Product, Promotion, Page, CodBox, Address, CustomerLifecycleStatus, CustomerBehavioralStatus, CustomerGrade, Warehouse } from '../types';

const emptyAddress: Address = { street: '', subdistrict: '', district: '', province: '', postalCode: '' };

interface CreateOrderPageProps {
  customers: Customer[];
  products: Product[];
  promotions: Promotion[];
  pages?: Page[];
  warehouses?: Warehouse[];
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
  const visibleItems = useMemo(() => (orderData.items || []).filter(it => !it.parentItemId), [orderData.items]);
  const goodsSum = useMemo(() => {
    return visibleItems.reduce((acc, item) => acc + (item.isFreebie ? 0 : (item.quantity || 0) * (item.pricePerUnit || 0)), 0);
  }, [visibleItems]);
  const itemsDiscount = useMemo(() => {
    return visibleItems.reduce((acc, item) => acc + (item.isFreebie ? 0 : (item.discount || 0)), 0);
  }, [visibleItems]);
  const subTotal = useMemo(() => goodsSum - itemsDiscount, [goodsSum, itemsDiscount]);
  const billDiscountPercent = Number(orderData.billDiscount || 0);
  const billDiscountAmount = (subTotal * billDiscountPercent) / 100;
  const totalAmount = useMemo(() => subTotal + (orderData.shippingCost || 0) - billDiscountAmount, [subTotal, orderData.shippingCost, billDiscountAmount]);
  
  return (
    <div className="bg-slate-50 border border-gray-300 rounded-lg p-6 sticky top-6">
      <h3 className="font-semibold text-lg mb-4 pb-2 border-b text-[#0e141b]">สรุปคำสั่งซื้อ</h3>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between text-[#4e7397]">
          <span>ยอดรวมสินค้า</span>
          <span className="text-[#0e141b] font-medium">฿{goodsSum.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[#4e7397]">
          <span>ส่วนลดรายการสินค้า</span>
          <span className="text-red-600 font-medium">-฿{itemsDiscount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[#4e7397]">
          <span>ค่าขนส่ง</span>
          <span className="text-[#0e141b] font-medium">฿{(orderData.shippingCost || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[#4e7397]">
          <span>ส่วนลดท้ายบิล</span>
          <span className="text-red-600 font-medium">-฿{billDiscountAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-lg border-t pt-3 mt-3">
          <span className="text-[#0e141b]">ยอดสุทธิ</span>
          <span className="text-green-600">฿{totalAmount.toFixed(2)}</span>
        </div>
      </div>
      
      {visibleItems.length > 0 && (
        <div className="mt-6 pt-6 border-t">
          <h4 className="font-medium text-sm mb-3 text-[#0e141b]">รายการสินค้า ({visibleItems.length})</h4>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {visibleItems.map((item, idx) => (
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

const CreateOrderPage: React.FC<CreateOrderPageProps> = ({
  customers,
  products,
  promotions,
  pages = [],
  warehouses = [],
  onSave,
  onCancel,
  initialData
}) => {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(initialData?.customer || null);
  const [isCreatingNewCustomer, setIsCreatingNewCustomer] = useState(false);
  const [newCustomerFirstName, setNewCustomerFirstName] = useState('');
  const [newCustomerLastName, setNewCustomerLastName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerPhoneError, setNewCustomerPhoneError] = useState('');
  
  // Address data state
  const [geographies, setGeographies] = useState<any[]>([]);
  const [provinces, setProvinces] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [subDistricts, setSubDistricts] = useState<any[]>([]);
  const [selectedGeography, setSelectedGeography] = useState<number | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<number | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<number | null>(null);
  const [selectedSubDistrict, setSelectedSubDistrict] = useState<number | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  
  // Search state for address dropdowns
  const [provinceSearchTerm, setProvinceSearchTerm] = useState('');
  const [districtSearchTerm, setDistrictSearchTerm] = useState('');
  const [subDistrictSearchTerm, setSubDistrictSearchTerm] = useState('');
  const [showProvinceDropdown, setShowProvinceDropdown] = useState(false);
  const [showDistrictDropdown, setShowDistrictDropdown] = useState(false);
  const [showSubDistrictDropdown, setShowSubDistrictDropdown] = useState(false);

  const [orderData, setOrderData] = useState<Partial<Order>>({
    items: [{ id: Date.now(), productName: '', quantity: 1, pricePerUnit: 0, discount: 0, isFreebie: false, boxNumber: 1 }],
    shippingCost: 0,
    billDiscount: 0,
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
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  

  // สรุปยอด: สินค้ารวม, ส่วนลดตามรายการ, ส่วนลดท้ายบิลเป็น %
  const goodsSum = useMemo(() =>
    (orderData.items || [])
      .filter(it => !it.parentItemId)
      .reduce((acc, item) => acc + (item.isFreebie ? 0 : (item.quantity || 0) * (item.pricePerUnit || 0)), 0),
  [orderData.items]);
  const itemsDiscount = useMemo(() =>
    (orderData.items || [])
      .filter(it => !it.parentItemId)
      .reduce((acc, item) => acc + (item.isFreebie ? 0 : (item.discount || 0)), 0),
  [orderData.items]);
  const subTotal = useMemo(() => goodsSum - itemsDiscount, [goodsSum, itemsDiscount]);
  const billDiscountPercent = useMemo(() => Number(orderData.billDiscount || 0), [orderData.billDiscount]);
  const billDiscountAmount = useMemo(() => (subTotal * billDiscountPercent) / 100, [subTotal, billDiscountPercent]);
  const totalAmount = useMemo(() => subTotal + (orderData.shippingCost || 0) - billDiscountAmount, [subTotal, orderData.shippingCost, billDiscountAmount]);

  useEffect(() => {
    const province = (shippingAddress.province || '').trim();
    if (!province) { setWarehouseId(null); return; }
    const matched = (warehouses || []).find(w => {
      const list = Array.isArray(w.responsibleProvinces) ? w.responsibleProvinces : [];
      return w.isActive && list.includes(province);
    });
    setWarehouseId(matched ? matched.id : null);
  }, [shippingAddress.province, warehouses]);
  
  // Load address data on component mount
  useEffect(() => {
    loadAddressData();
  }, []);
  
  // Function to load address data from API
  const loadAddressData = async () => {
    setAddressLoading(true);
    try {
      // Load geographies
      const geoResponse = await fetch('/api/Address_DB/get_address_data.php?endpoint=geographies');
      if (geoResponse.ok) {
        const geoData = await geoResponse.json();
        if (geoData.success) setGeographies(geoData.data || []);
      }
      
      // Load all provinces
      const provResponse = await fetch('/api/Address_DB/get_address_data.php?endpoint=provinces');
      if (provResponse.ok) {
        const provData = await provResponse.json();
        if (provData.success) setProvinces(provData.data || []);
      }
    } catch (error) {
      console.error('Error loading address data:', error);
    } finally {
      setAddressLoading(false);
    }
  };
  
  // Load districts when province is selected
  useEffect(() => {
    if (selectedProvince) {
      fetch(`/api/Address_DB/get_address_data.php?endpoint=districts&id=${selectedProvince}`)
        .then(response => response.json())
        .then(data => {
          if (data.success) setDistricts(data.data || []);
        })
        .catch(error => console.error('Error loading districts:', error));
    } else {
      setDistricts([]);
      setSubDistricts([]);
      setSelectedDistrict(null);
      setSelectedSubDistrict(null);
    }
  }, [selectedProvince]);
  
  // Load sub-districts when district is selected
  useEffect(() => {
    if (selectedDistrict) {
      fetch(`/api/Address_DB/get_address_data.php?endpoint=sub_districts&id=${selectedDistrict}`)
        .then(response => response.json())
        .then(data => {
          if (data.success) setSubDistricts(data.data || []);
        })
        .catch(error => console.error('Error loading sub-districts:', error));
    } else {
      setSubDistricts([]);
      setSelectedSubDistrict(null);
    }
  }, [selectedDistrict]);
  
  // Update shipping address when sub-district is selected
  useEffect(() => {
    if (selectedSubDistrict) {
      const subDistrict = subDistricts.find(sd => sd.id === selectedSubDistrict);
      const district = districts.find(d => d.id === subDistrict?.district_id);
      const province = provinces.find(p => p.id === district?.province_id);
      
      setShippingAddress(prev => ({
        ...prev,
        subdistrict: subDistrict?.name_th || '',
        district: district?.name_th || '',
        province: province?.name_th || '',
        postalCode: subDistrict?.zip_code || ''
      }));
    }
  }, [selectedSubDistrict, subDistricts, districts, provinces]);
  
  // Initialize address selections from existing address
  useEffect(() => {
    if (!useProfileAddress && shippingAddress.province) {
      // Find province by name
      const province = provinces.find(p => p.name_th === shippingAddress.province);
      if (province) {
        setSelectedProvince(province.id);
        setSelectedGeography(province.geography_id);
      }
    }
  }, [shippingAddress.province, provinces, useProfileAddress]);
  
  // Initialize district when districts are loaded
  useEffect(() => {
    if (!useProfileAddress && shippingAddress.district && selectedProvince && districts.length > 0) {
      const district = districts.find(d => d.name_th === shippingAddress.district);
      if (district) {
        setSelectedDistrict(district.id);
      }
    }
  }, [shippingAddress.district, selectedProvince, districts, useProfileAddress]);
  
  // Initialize sub-district when sub-districts are loaded
  useEffect(() => {
    if (!useProfileAddress && shippingAddress.subdistrict && selectedDistrict && subDistricts.length > 0) {
      const subDistrict = subDistricts.find(sd => sd.name_th === shippingAddress.subdistrict);
      if (subDistrict) {
        setSelectedSubDistrict(subDistrict.id);
      }
    }
  }, [shippingAddress.subdistrict, selectedDistrict, subDistricts, useProfileAddress]);
  
  // Filtered lists for search
  const filteredProvinces = useMemo(() => {
    if (!provinceSearchTerm) return provinces;
    return provinces.filter(p =>
      p.name_th.toLowerCase().includes(provinceSearchTerm.toLowerCase()) ||
      p.name_en.toLowerCase().includes(provinceSearchTerm.toLowerCase())
    );
  }, [provinces, provinceSearchTerm]);
  
  const filteredDistricts = useMemo(() => {
    if (!districtSearchTerm) return districts;
    return districts.filter(d =>
      d.name_th.toLowerCase().includes(districtSearchTerm.toLowerCase()) ||
      d.name_en.toLowerCase().includes(districtSearchTerm.toLowerCase())
    );
  }, [districts, districtSearchTerm]);
  
  const filteredSubDistricts = useMemo(() => {
    if (!subDistrictSearchTerm) return subDistricts;
    return subDistricts.filter(sd =>
      sd.name_th.toLowerCase().includes(subDistrictSearchTerm.toLowerCase()) ||
      sd.name_en.toLowerCase().includes(subDistrictSearchTerm.toLowerCase()) ||
      sd.zip_code.includes(subDistrictSearchTerm)
    );
  }, [subDistricts, subDistrictSearchTerm]);
  
  const codTotal = useMemo(() => {
    return orderData.boxes?.reduce((sum, box) => sum + (box.codAmount || 0), 0) || 0;
  }, [orderData.boxes]);

  const isCodValid = useMemo(() => {
    if(orderData.paymentMethod !== PaymentMethod.COD) return true;
    return codTotal.toFixed(2) === totalAmount.toFixed(2) && totalAmount > 0;
  }, [orderData.paymentMethod, totalAmount, codTotal]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchTerm || isCreatingNewCustomer) return [];
    const lowerSearchTerm = searchTerm.toLowerCase();
    return customers.filter(c =>
      (`${c.firstName} ${c.lastName}`).toLowerCase().includes(lowerSearchTerm) ||
      c.phone.includes(searchTerm)
    );
  }, [searchTerm, customers, isCreatingNewCustomer]);

  // Handler for profile address toggle
  const handleUseProfileAddressToggle = (checked: boolean) => {
    setUseProfileAddress(checked);
    if (checked && selectedCustomer?.address) {
      setShippingAddress(selectedCustomer.address);
      // Reset custom address selections when using profile address
      setSelectedProvince(null);
      setSelectedDistrict(null);
      setSelectedSubDistrict(null);
      // Reset search terms and close dropdowns
      setProvinceSearchTerm('');
      setDistrictSearchTerm('');
      setSubDistrictSearchTerm('');
      setShowProvinceDropdown(false);
      setShowDistrictDropdown(false);
      setShowSubDistrictDropdown(false);
    } else {
      setShippingAddress(emptyAddress);
      // Reset address selections when switching to custom address
      setSelectedProvince(null);
      setSelectedDistrict(null);
      setSelectedSubDistrict(null);
      // Reset search terms and close dropdowns
      setProvinceSearchTerm('');
      setDistrictSearchTerm('');
      setSubDistrictSearchTerm('');
      setShowProvinceDropdown(false);
      setShowDistrictDropdown(false);
      setShowSubDistrictDropdown(false);
    }
  };

  useEffect(() => {
    if (initialData?.customer) {
      handleSelectCustomer(initialData.customer);
    }
  }, [initialData]);
  
  // หมายเหตุ: ทุกวิธีการชำระเงินต้องระบุจำนวนกล่อง (COD เท่านั้นที่ต้องกรอกยอด COD ต่อกล่อง)
  useEffect(() => {
    const newBoxes: CodBox[] = Array.from({ length: numBoxes }, (_, i) => ({
      boxNumber: i + 1,
      codAmount: orderData.boxes?.[i]?.codAmount || 0,
    }));
    updateOrderData('boxes', newBoxes);
  }, [numBoxes]);
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      
      // Check if click is outside any of the dropdown containers
      if (!target.closest('.province-dropdown-container')) {
        setShowProvinceDropdown(false);
      }
      if (!target.closest('.district-dropdown-container')) {
        setShowDistrictDropdown(false);
      }
      if (!target.closest('.subdistrict-dropdown-container')) {
        setShowSubDistrictDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // ปรับ boxNumber ของแต่ละรายการสินค้าให้อยู่ในช่วง 1..numBoxes เมื่อจำนวนกล่องเปลี่ยน
  useEffect(() => {
    if (!orderData.items) return;
    const clamped = orderData.items.map(it => ({
      ...it,
      boxNumber: Math.min(Math.max(it.boxNumber || 1, 1), numBoxes),
    }));
    const changed = JSON.stringify(clamped) !== JSON.stringify(orderData.items);
    if (changed) updateOrderData('items', clamped);
  }, [numBoxes, orderData.items]);
  

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsCreatingNewCustomer(false);
    setOrderData(prev => ({ ...prev, customerId: customer.id }));
    setSearchTerm(`${customer.firstName} ${customer.lastName}`);
    setFacebookName(customer.facebookName || '');
    setLineId(customer.lineId || '');
    // Reset address selections
    setSelectedProvince(null);
    setSelectedDistrict(null);
    setSelectedSubDistrict(null);
    // Reset search terms and close dropdowns
    setProvinceSearchTerm('');
    setDistrictSearchTerm('');
    setSubDistrictSearchTerm('');
    setShowProvinceDropdown(false);
    setShowDistrictDropdown(false);
    setShowSubDistrictDropdown(false);
    
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
    
    // Reset address selections
    setSelectedProvince(null);
    setSelectedDistrict(null);
    setSelectedSubDistrict(null);
    // Reset search terms and close dropdowns
    setProvinceSearchTerm('');
    setDistrictSearchTerm('');
    setSubDistrictSearchTerm('');
    setShowProvinceDropdown(false);
    setShowDistrictDropdown(false);
    setShowSubDistrictDropdown(false);
    
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

  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const handleSave = () => {
    const isAddressIncomplete = Object.values(shippingAddress).some(val => (val as string).trim() === '');
    if (isAddressIncomplete) { alert('กรุณากรอกที่อยู่จัดส่งให้ครบถ้วน'); return; }
    if (!orderData.deliveryDate) { alert('กรุณาเลือกวันที่จัดส่ง'); return; }
    if (!orderData.items || orderData.items.length === 0 || orderData.items.every(i => !i.productName)) { alert('กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ'); return; }
    if (!orderData.paymentMethod) { alert('กรุณาเลือกวิธีการชำระเงิน'); return; }
    if (!salesChannel) { alert('กรุณาเลือกช่องทางการสั่งซื้อ'); return; }
    if (salesChannel !== 'โทร' && !salesChannelPageId) { alert('กรุณาเลือกเพจของช่องทางการสั่งซื้อ'); return; }
    if (orderData.paymentMethod === PaymentMethod.COD && !isCodValid) { alert('ยอด COD ในแต่ละกล่องรวมกันไม่เท่ากับยอดสุทธิ'); return; }

    const finalOrderData: Partial<Order> = {
      ...orderData,
      shippingAddress,
      totalAmount,
      paymentStatus: orderData.paymentMethod === PaymentMethod.Transfer ? PaymentStatus.Unpaid : PaymentStatus.Unpaid,
      orderStatus: OrderStatus.Pending,
      salesChannel: salesChannel,
      // @ts-ignore - backend supports this field; added in schema
      salesChannelPageId: (salesChannel && salesChannel !== 'โทร') ? salesChannelPageId || undefined : undefined,
      warehouseId: warehouseId || undefined,
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
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
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

  // Utilities สำหรับความปลอดภัยกับข้อมูลจาก API
  const toNumber = (v: any, fallback = 0): number => {
    if (v === null || v === undefined) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const toBool = (v: any): boolean => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      if (s === '0' || s === 'false' || s === '') return false;
      if (s === '1' || s === 'true') return true;
      const n = Number(s);
      if (Number.isFinite(n)) return n !== 0;
      return true;
    }
    return false;
  };

  // คำนวณราคารวมของโปรโมชั่นจากราคา/ชิ้น (price_override) x จำนวน โดยไม่คิดของแถม
  const calcPromotionTotal = (promo: Promotion) => {
    const items = Array.isArray(promo?.items) ? promo.items : [];
    let total = 0;
    for (const part of items as any[]) {
      const prod =
        productsSafe.find(pr => pr.id === (part.productId ?? part.product_id)) ||
        productsSafe.find(pr => pr.sku === (part.product?.sku || part.sku || part.product_sku));
      const qty = toNumber(part.quantity, 1);
      const isFree = toBool(part.isFreebie) || toBool(part.is_freebie);
      // ลำดับการเลือกใช้ราคา: ราคา override ต่อชิ้น -> ราคา product ที่มาจาก API join (product_price) -> ราคาสินค้าที่โหลดในหน้าจอ
      const price = isFree
        ? 0
        : toNumber((part as any).price_override ?? (part as any).priceOverride ?? (part as any).product_price, prod?.price ?? 0);
      total += price * qty;
    }
    return total;
  };

  // ราคาชุดทั้งหมด (รวมทุกชิ้น ไม่หักของแถม)
  const calcPromotionSetPrice = (promo: Promotion) => {
    const items = Array.isArray(promo?.items) ? promo.items : [];
    let sum = 0;
    for (const part of items as any[]) {
      const prod =
        productsSafe.find(pr => pr.id === (part.productId ?? part.product_id)) ||
        productsSafe.find(pr => pr.sku === (part.product?.sku || part.sku || part.product_sku));
      const qty = toNumber(part.quantity, 1);
      const isFree = toBool((part as any).isFreebie) || toBool((part as any).is_freebie);
      if (isFree) {
        // ของแถม ไม่นับราคาในราคารวมของชุด
        continue;
      }
      const override = toNumber((part as any).price_override ?? (part as any).priceOverride, NaN);
      const joinedPrice = toNumber((part as any).product_price, NaN);
      const basePrice = toNumber(prod?.price, 0);

      // ตรวจสอบ price_override:
      // - ถ้า override >= basePrice (หรือไม่มี basePriceชัดเจน) และมีจำนวน > 1
      //   ให้ตรวจสอบว่าเป็น "ราคารวมของกลุ่มนี้" (ไม่คูณ qty)
      // - มิฉะนั้น ใช้เป็น "ราคาต่อชิ้น" แล้วคูณด้วย qty
      if (Number.isFinite(override)) {
        const comparator = basePrice > 0 ? basePrice : (Number.isFinite(joinedPrice) ? joinedPrice : 0);
        if (qty > 1 && comparator > 0 && override >= comparator) {
          sum += override; // ราคาทั้งกลุ่ม
        } else {
          sum += override * qty; // ราคาต่อชิ้น
        }
      } else {
        // ไม่มี override -> ใช้ราคาสินค้า (joinedPrice หรือ basePrice) x qty
        const unit = Number.isFinite(joinedPrice) ? joinedPrice : basePrice;
        sum += unit * qty;
      }
    }
    return sum;
  };

  // ถ้ามีแถวว่าง ให้แทนที่แถวว่างแรกด้วยรายการใหม่ มิฉะนั้นให้ต่อท้าย
  const replaceEmptyRowOrAppend = (newItem: LineItem) => {
    const items = orderData.items || [];
    const emptyIndex = items.findIndex(it => !it.productName || String(it.productName).trim() === '');
    if (emptyIndex !== -1) {
      const existingId = items[emptyIndex].id;
      const merged = { ...newItem, id: existingId };
      const next = items.map((it, i) => (i === emptyIndex ? merged : it));
      updateOrderData('items', next);
      setLockedItemIds(prev => (prev.includes(existingId) ? prev : [...prev, existingId]));
    } else {
      updateOrderData('items', [...items, newItem]);
      setLockedItemIds(prev => (prev.includes(newItem.id) ? prev : [...prev, newItem.id]));
    }
  };

  // ใช้ฟังก์ชันด้านบนเพื่อเพิ่มโปรโมชั่นเข้ารายการ ด้วยราคาที่ถูกต้อง
  const addPromotionByIdFixed = (promoId: number | string) => {
    const promo = promotionsSafe.find(p => String(p.id) === String(promoId));
    if (!promo) return;
    
    // Create separate line items for each product in the promotion
    const promotionItems = promo.items || [];
    const promotionName = promo.name || 'โปรโมชั่น';
    
    // Track all new items to add
    const newItemsToAdd: LineItem[] = [];
    const newLockedIds: number[] = [];
    
    // Create parent item (promotion header)
    const parentId = Date.now() + Math.floor(Math.random() * 1000);
    const parentItem: LineItem = {
      id: parentId,
      productName: `📦 ${promotionName}`,
      quantity: 1, // 1 set of promotion
      pricePerUnit: 0, // Will be calculated from child items
      discount: 0,
      isFreebie: false,
      boxNumber: 1,
      productId: undefined, // No specific product for parent
      promotionId: promo.id,
      parentItemId: undefined, // Parent has no parent
      isPromotionParent: true
    };
    
    // รวมราคาชุดจากชิ้นย่อยที่ต้องจ่าย แล้วค่อยตั้งราคาให้ parent
    // so totals won't double-count. We'll also replace an empty row with this parent.
    let totalSetPrice = 0;
    
    for (const part of promotionItems) {
      // part may contain productId and joined product info
      const prod = productsSafe.find(pr => pr.id === (part.productId ?? part.product_id)) || productsSafe.find(pr => pr.sku === (part.product?.sku || part.sku || part.product_sku));
      if (!prod) continue;
      
      const qty = Number(part.quantity || 1);
      const isFreeFlag = !!part.isFreebie || !!part.is_freebie;
      
      // IMPORTANT: Always use price_override for promotion items if available
      // If price_override is null or 0 and item is not a freebie, use the regular product price
      const itemPrice = isFreeFlag ? 0 : (
        part.price_override !== null && part.price_override !== undefined ? Number(part.price_override) : prod.price
      );
      
      // Create a separate line item for each product in the promotion
      const newId = Date.now() + Math.floor(Math.random() * 1000);
      const productLineItem: LineItem = {
        id: newId,
        productName: `${prod.name}${isFreeFlag ? ' (ของแถม)' : ''}`,
        quantity: qty,
        pricePerUnit: itemPrice,
        discount: 0,
        isFreebie: isFreeFlag,
        boxNumber: 1,
        productId: prod.id,
        promotionId: promo.id,
        parentItemId: parentId, // Link to parent
        isPromotionParent: false
      };
      
      newItemsToAdd.push(productLineItem);
      newLockedIds.push(newId);
      if (!isFreeFlag) { totalSetPrice += itemPrice * qty; }
      
      // Totals are taken from child items; parent stays 0
    }
    
    // ตั้งราคารวมของชุดไว้ที่ parent
    parentItem.pricePerUnit = calcPromotionSetPrice(promo);
    const existing = orderData.items || [];
    const emptyIndex = existing.findIndex(it => !it.productName || String(it.productName).trim() === '');
    let next: LineItem[];
    if (emptyIndex !== -1) {
      next = existing.slice();
      // preserve the existing id for stability when replacing the empty row
      const existingId = next[emptyIndex].id;
      next[emptyIndex] = { ...parentItem, id: existingId };
      newLockedIds.push(existingId);
    } else {
      next = [...existing, parentItem];
      newLockedIds.push(parentId);
    }
    next = [...next, ...newItemsToAdd];
    
    updateOrderData('items', next);
    setLockedItemIds(prev => [...prev, ...newLockedIds, ...newItemsToAdd.map(i => i.id)]);
    closeProductSelector();
  };

  const addProductById = (productId: number) => {
    const p = productsSafe.find(pr => pr.id === productId);
    if (!p) return;
    const newId = Date.now() + Math.floor(Math.random() * 1000);
    const newItem: LineItem = { id: newId, productName: p.name, quantity: 1, pricePerUnit: p.price, discount: 0, isFreebie: false, boxNumber: 1 };
    replaceEmptyRowOrAppend(newItem);
    closeProductSelector();
  };

  const addPromotionById = (promoId: number | string) => {
    const promo = promotionsSafe.find(p => String(p.id) === String(promoId));
    if (!promo) return;
    
    // Create separate line items for each product in the promotion
    const promotionItems = promo.items || [];
    const promotionName = promo.name || 'โปรโมชั่น';
    
    // Track all new items to add
    const newItemsToAdd: LineItem[] = [];
    const newLockedIds: number[] = [];
    
    // Create parent item (promotion header)
    const parentId = Date.now() + Math.floor(Math.random() * 1000);
    const parentItem: LineItem = {
      id: parentId,
      productName: `📦 ${promotionName}`,
      quantity: 1, // 1 set of promotion
      pricePerUnit: 0, // Will be calculated from child items
      discount: 0,
      isFreebie: false,
      boxNumber: 1,
      productId: undefined, // No specific product for parent
      promotionId: promo.id,
      parentItemId: undefined, // Parent has no parent
      isPromotionParent: true
    };
    
    newItemsToAdd.push(parentItem);
    newLockedIds.push(parentId);
    
    // Calculate total price for parent item
    let totalPromotionPrice = 0;
    
    for (const part of promotionItems) {
      // part may contain productId and joined product info
      const prod = productsSafe.find(pr => pr.id === (part.productId ?? part.product_id)) || productsSafe.find(pr => pr.sku === (part.product?.sku || part.sku || part.product_sku));
      if (!prod) continue;
      
      const qty = Number(part.quantity || 1);
      const isFreeFlag = !!part.isFreebie || !!part.is_freebie;
      
      // IMPORTANT: Always use price_override for promotion items if available
      // If price_override is null or 0 and item is not a freebie, use the regular product price
      const itemPrice = isFreeFlag ? 0 : (
        part.price_override !== null && part.price_override !== undefined ? Number(part.price_override) : prod.price
      );
      
      // Create a separate line item for each product in the promotion
      const newId = Date.now() + Math.floor(Math.random() * 1000);
      const productLineItem: LineItem = {
        id: newId,
        productName: `${prod.name}${isFreeFlag ? ' (ของแถม)' : ''}`,
        quantity: qty,
        pricePerUnit: itemPrice,
        discount: 0,
        isFreebie: isFreeFlag,
        boxNumber: 1,
        productId: prod.id,
        promotionId: promo.id,
        parentItemId: parentId, // Link to parent
        isPromotionParent: false
      };
      
      newItemsToAdd.push(productLineItem);
      newLockedIds.push(newId);
      
      // Add to total price (only non-freebie items)
      if (!isFreeFlag) {
        totalPromotionPrice += itemPrice * qty;
      }
    }
    
    // Update parent item with total price
    parentItem.pricePerUnit = totalPromotionPrice;
    
    // Add all new items to the order
    updateOrderData('items', [...(orderData.items || []), ...newItemsToAdd]);
    setLockedItemIds(prev => [...prev, ...newLockedIds]);
    closeProductSelector();
  };

  const commonInputClass = "w-full p-2.5 border border-gray-300 rounded-md bg-white text-[#0e141b] focus:ring-1 focus:ring-blue-500 focus:border-blue-500";
  const commonLabelClass = "block text-sm font-medium text-[#0e141b] mb-1.5";
  const onFocusSelectAll = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const el = e.target as HTMLInputElement;
    if (typeof el.select === 'function') el.select();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#0e141b]">สร้างคำสั่งซื้อ</h1>
            <p className="text-[#4e7397]">กรอกข้อมูลลูกค้า สินค้า และการชำระเงินในหน้าเดียว</p>
          </div>
          <button onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
            ยกเลิก
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto p-6">
        
        
        <div className="space-y-6">
          {/* Left Column: Customer Information & Shipping Address */}
          <div className="space-y-6">
             
            {/* Section 1: Customer Information */}
            {
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
                        {salesChannel && salesChannel !== 'โทร' && (
                          <select value={salesChannelPageId ?? ''} onChange={e => setSalesChannelPageId(e.target.value ? Number(e.target.value) : null)} className={commonInputClass}>
                            <option value="">เลือกเพจ</option>
                            {(() => {
                              // Map sales channel to platform values (case insensitive)
                              const platformMap: { [key: string]: string[] } = {
                                'Facebook': ['facebook', 'Facebook'],
                                'Line': ['line', 'Line'],
                                'TikTok': ['tiktok', 'tiktok_business_messaging', 'TikTok']
                              };
                              const validPlatforms = platformMap[salesChannel] || [];
                              
                              // Debug: Log the filtering process
                              const filteredPages = pages.filter(pg => {
                                // Convert both to lowercase for case-insensitive comparison
                                const pagePlatformLower = (pg as any).platform?.toLowerCase() || '';
                                const isPlatformMatch = validPlatforms.some(platform => platform.toLowerCase() === pagePlatformLower);
                                // Treat active as boolean-like (supports 1/0, '1'/'0', 'true'/'false')
                                const v: any = (pg as any).active;
                                const isActive = (typeof v === 'boolean') ? v : (typeof v === 'number') ? v !== 0 : (typeof v === 'string') ? (v.trim() !== '' && v !== '0' && v.toLowerCase() !== 'false') : Boolean(v);
                                return isPlatformMatch && isActive;
                              });
                              
                              // Debug: Log the results
                              console.log('Sales Channel:', salesChannel);
                              console.log('Valid Platforms:', validPlatforms);
                              console.log('All Pages:', pages);
                              console.log('Filtered Pages:', filteredPages);
                              
                              return filteredPages.map(pg => (
                                <option key={pg.id} value={pg.id}>{pg.name}</option>
                              ));
                            })()}
                          </select>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            }

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
                    <div>
                      <label className={commonLabelClass}>บ้านเลขที่, ถนน</label>
                      <input type="text" name="street" value={shippingAddress.street} onChange={handleShippingAddressChange} disabled={useProfileAddress} className={commonInputClass} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="relative province-dropdown-container">
                        <label className={commonLabelClass}>จังหวัด</label>
                        <input
                          type="text"
                          value={selectedProvince ? provinces.find(p => p.id === selectedProvince)?.name_th || '' : provinceSearchTerm}
                          onChange={(e) => {
                            setProvinceSearchTerm(e.target.value);
                            setShowProvinceDropdown(true);
                          }}
                          onFocus={() => setShowProvinceDropdown(true)}
                          disabled={useProfileAddress || addressLoading}
                          className={commonInputClass}
                          placeholder="ค้นหาหรือเลือกจังหวัด"
                        />
                        {showProvinceDropdown && !useProfileAddress && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                            {filteredProvinces.length > 0 ? (
                              filteredProvinces.map(province => (
                                <div
                                  key={province.id}
                                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                                  onClick={() => {
                                    setSelectedProvince(province.id);
                                    setProvinceSearchTerm('');
                                    setShowProvinceDropdown(false);
                                    setSelectedDistrict(null);
                                    setSelectedSubDistrict(null);
                                  }}
                                >
                                  {province.name_th}
                                </div>
                              ))
                            ) : (
                              <div className="px-3 py-2 text-gray-500">ไม่พบจังหวัดที่ค้นหา</div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="relative district-dropdown-container">
                        <label className={commonLabelClass}>อำเภอ/เขต</label>
                        <input
                          type="text"
                          value={selectedDistrict ? districts.find(d => d.id === selectedDistrict)?.name_th || '' : districtSearchTerm}
                          onChange={(e) => {
                            setDistrictSearchTerm(e.target.value);
                            setShowDistrictDropdown(true);
                          }}
                          onFocus={() => setShowDistrictDropdown(true)}
                          disabled={useProfileAddress || !selectedProvince || addressLoading}
                          className={commonInputClass}
                          placeholder="ค้นหาหรือเลือกอำเภอ/เขต"
                        />
                        {showDistrictDropdown && !useProfileAddress && selectedProvince && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                            {filteredDistricts.length > 0 ? (
                              filteredDistricts.map(district => (
                                <div
                                  key={district.id}
                                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                                  onClick={() => {
                                    setSelectedDistrict(district.id);
                                    setDistrictSearchTerm('');
                                    setShowDistrictDropdown(false);
                                    setSelectedSubDistrict(null);
                                  }}
                                >
                                  {district.name_th}
                                </div>
                              ))
                            ) : (
                              <div className="px-3 py-2 text-gray-500">ไม่พบอำเภอ/เขตที่ค้นหา</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="relative subdistrict-dropdown-container">
                        <label className={commonLabelClass}>ตำบล/แขวง</label>
                        <input
                          type="text"
                          value={selectedSubDistrict ? subDistricts.find(sd => sd.id === selectedSubDistrict)?.name_th || '' : subDistrictSearchTerm}
                          onChange={(e) => {
                            setSubDistrictSearchTerm(e.target.value);
                            setShowSubDistrictDropdown(true);
                          }}
                          onFocus={() => setShowSubDistrictDropdown(true)}
                          disabled={useProfileAddress || !selectedDistrict || addressLoading}
                          className={commonInputClass}
                          placeholder="ค้นหาหรือเลือกตำบล/แขวง"
                        />
                        {showSubDistrictDropdown && !useProfileAddress && selectedDistrict && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                            {filteredSubDistricts.length > 0 ? (
                              filteredSubDistricts.map(subDistrict => (
                                <div
                                  key={subDistrict.id}
                                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                                  onClick={() => {
                                    setSelectedSubDistrict(subDistrict.id);
                                    setSubDistrictSearchTerm('');
                                    setShowSubDistrictDropdown(false);
                                  }}
                                >
                                  {subDistrict.name_th} ({subDistrict.zip_code})
                                </div>
                              ))
                            ) : (
                              <div className="px-3 py-2 text-gray-500">ไม่พบตำบล/แขวงที่ค้นหา</div>
                            )}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className={commonLabelClass}>รหัสไปรษณีย์</label>
                        <input
                          type="text"
                          name="postalCode"
                          value={shippingAddress.postalCode}
                          onChange={handleShippingAddressChange}
                          disabled={useProfileAddress || !!selectedSubDistrict}
                          className={commonInputClass}
                          placeholder="รหัสไปรษณีย์จะถูกกรอกอัตโนมัติ"
                        />
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div>
                        <label className={commonLabelClass}>คลังจัดส่ง (อัตโนมัติจากจังหวัด)</label>
                        <input type="text" value={(() => { const w = (warehouses || []).find(x => x.id === warehouseId); return w ? w.name : '-'; })()} readOnly className={commonInputClass + ' bg-slate-100'} />
                      </div>
                    </div>
                </div>
              </div>
            )}
          </div>

          {/* Middle Column: Products, Payment Method and Order Summary */}
          <div className="space-y-6">
            {/* Section 3: Products */}
            {(selectedCustomer || isCreatingNewCustomer) && (
              <div className="bg-white rounded-lg border border-gray-300 p-6">
                <h2 className="text-lg font-semibold text-[#0e141b] mb-4 pb-3 border-b">รายการสินค้า</h2>
                
                {/* Product Selection Tabs */}
                <div className="mb-4 border-b border-gray-200">
                  <ul className="flex -mb-px text-sm font-medium text-center">
                    <li className="mr-2">
                      <button
                        onClick={() => setSelectorTab('products')}
                        className={`inline-block py-2 px-4 border-b-2 rounded-t-lg ${
                          selectorTab === 'products'
                            ? 'text-blue-600 border-blue-600'
                            : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        สินค้าปกติ
                      </button>
                    </li>
                    <li className="mr-2">
                      <button
                        onClick={() => setSelectorTab('promotions')}
                        className={`inline-block py-2 px-4 border-b-2 rounded-t-lg ${
                          selectorTab === 'promotions'
                            ? 'text-blue-600 border-blue-600'
                            : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        โปรโมชั่น/เซ็ตสินค้า
                      </button>
                    </li>
                  </ul>
                </div>
                
                <div className="space-y-3">
                  {(orderData.items || []).filter(it => !it.parentItemId).map((item, index) => (
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
                            disabled={item.isPromotionParent}
                          />
                          {/* button to open product selector */}
                          <button onClick={() => openProductSelector(selectorTab)} className="px-2 py-1 bg-white border rounded text-sm">เลือก</button>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-[#4e7397] mb-1 block">จำนวน</label>
                        <input
                          type="number"
                          placeholder="จำนวน"
                          value={item.quantity}
                          onChange={e => updateOrderData('items', orderData.items?.map((it, i) => i === index ? {...it, quantity: Number(e.target.value)} : it))}
                          onFocus={onFocusSelectAll}
                          className="w-full p-2 border border-gray-300 rounded-md bg-white text-[#0e141b] text-sm"
                          disabled={false}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-[#4e7397] mb-1 block">ราคา</label>
                        <input
                          type="number"
                          placeholder="ราคา"
                          value={item.pricePerUnit}
                          onChange={e => updateOrderData('items', orderData.items?.map((it, i) => i === index ? {...it, pricePerUnit: Number(e.target.value)} : it))}
                          onFocus={onFocusSelectAll}
                          className="w-full p-2 border border-gray-300 rounded-md bg-white text-[#0e141b] text-sm"
                          disabled={item.isPromotionParent}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-[#4e7397] mb-1 block">ส่วนลด</label>
                        <input
                          type="number"
                          placeholder="ส่วนลด"
                          value={item.discount}
                          onChange={e => updateOrderData('items', orderData.items?.map((it, i) => i === index ? {...it, discount: Number(e.target.value)} : it))}
                          onFocus={onFocusSelectAll}
                          className="w-full p-2 border border-gray-300 rounded-md bg-white text-[#0e141b] text-sm"
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="text-xs text-[#4e7397] mb-1 block">กล่อง</label>
                        <select
                          value={item.boxNumber || 1}
                          onChange={e => updateOrderData('items', orderData.items?.map((it, i) => i === index ? { ...it, boxNumber: Math.max(1, Math.min(Number(e.target.value), numBoxes)) } : it))}
                          onFocus={onFocusSelectAll}
                          className="w-full p-2 border border-gray-300 rounded-md bg-white text-[#0e141b] text-sm"
                        >
                          {Array.from({ length: numBoxes }, (_, i) => i + 1).map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
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
                          onClick={() => {
                            const current = orderData.items || [];
                            const id = item.id;
                            const next = current.filter(it => it.id !== id && it.parentItemId !== id);
                            updateOrderData('items', next);
                          }}
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
          <button onClick={() => openProductSelector(selectorTab)} className="px-3 py-2 bg-blue-600 text-white rounded-md mr-2">
            {selectorTab === 'products' ? 'เลือกสินค้า' : 'เลือกโปรโมชั่น'}
          </button>
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
                    {selectorTab === 'products' && (
                      <li className={`p-2 rounded ${!leftFilter ? 'bg-slate-100' : ''} cursor-pointer`} onClick={() => { setLeftFilter(null); setSelectorSearchTerm(''); }}>ทั้งหมด</li>
                    )}
                    {selectorTab === 'promotions' && (
                      <>
                        <li className={`p-2 rounded ${leftFilter === -1 ? 'bg-slate-100' : ''} cursor-pointer`} onClick={() => { setLeftFilter(-1); setSelectorSearchTerm(''); }}>รายการโปรโมชั่น</li>
                        {promotionsSafe.map(p => (
                          <li key={p.id} className={`p-2 rounded ${leftFilter === p.id ? 'bg-slate-100' : ''} cursor-pointer`} onClick={() => { setLeftFilter(p.id); setSelectorSearchTerm(''); }}>{p.name}</li>
                        ))}
                      </>
                    )}
                  </ul>
                </div>
                <div className="flex-1 flex flex-col min-w-0">
                  <div className="mb-3">
                    <input
                      type="text"
                      placeholder={`ค้นหา ${selectorTab === 'products' ? 'SKU, ชื่อสินค้า' : 'ชื่อโปรโมชั่น'}`}
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
                            <th className="p-2">สถานะ</th>
                            <th className="p-2">เลือก</th>
                          </tr>
                        </thead>
                        <tbody>
                          {promotionsSafe.filter(pm => {
                            // Filter only active promotions
                            if (!pm.active) return false;
                            if (leftFilter && leftFilter !== -1) return String(pm.id) === String(leftFilter);
                            if (!selectorSearchTerm) return true;
                            return `${pm.name}`.toLowerCase().includes(selectorSearchTerm.toLowerCase());
                          }).map(pm => (
                            <tr key={pm.id} className="border-b">
                              <td className="p-2 align-top">{pm.name}</td>
                              <td className="p-2 align-top">{(pm.items || []).map((it: any) => {
                                const prodLabel = it.product_name ?? it.product?.name ?? it.sku ?? it.product_sku ?? '';
                                const priceText = it.is_freebie ? 'ฟรี' : `฿${(it.price_override !== null && it.price_override !== undefined ? Number(it.price_override) : 0).toFixed(2)}`;
                                return `${it.quantity} x ${prodLabel} (${priceText})`;
                              }).join(', ')}</td>
                              <td className="p-2 align-top">{calcPromotionSetPrice(pm).toFixed(2)}</td>
                              <td className="p-2 align-top">
                                <span className={`px-2 py-1 text-xs rounded-full ${pm.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                  {pm.active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="p-2 align-top">
                                <button
                                  onClick={() => addPromotionByIdFixed(pm.id)}
                                  className={`px-3 py-1 rounded text-white ${pm.active ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
                                  disabled={!pm.active}
                                >
                                  เลือก
                                </button>
                              </td>
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
                      <input type="number" value={orderData.shippingCost} onChange={e => updateOrderData('shippingCost', Number(e.target.value))} onFocus={onFocusSelectAll} className={commonInputClass} />
                    </div>
                    <div>
                      <label className={commonLabelClass}>ส่วนลดท้ายบิล (%)</label>
                      <input type="number" value={orderData.billDiscount} onChange={e => updateOrderData('billDiscount', Number(e.target.value))} onFocus={onFocusSelectAll} className={commonInputClass} />
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
                    <select value={orderData.paymentMethod ?? ''} onChange={e => updateOrderData('paymentMethod', (e.target.value ? (e.target.value as PaymentMethod) : undefined))} className={commonInputClass}>
                      <option value="">เลือกวิธีการชำระเงิน</option>
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
                      <input type="number" min="1" value={numBoxes} onChange={e => setNumBoxes(Math.max(1, Number(e.target.value)))} onFocus={onFocusSelectAll} className={commonInputClass} />
                      </div>
                      <button onClick={divideCodEqually} className="text-sm text-blue-600 font-medium hover:underline">แบ่งยอดเท่าๆ กัน</button>
                      <div className="space-y-2">
                        {orderData.boxes?.map((box, index) => (
                          <div key={index} className="flex items-center gap-4">
                            <label className="font-medium text-[#0e141b] w-24">กล่อง #{box.boxNumber}:</label>
                            <input type="number" placeholder="ยอด COD" value={box.codAmount} onChange={e => handleCodBoxAmountChange(index, Number(e.target.value))} onFocus={onFocusSelectAll} className={commonInputClass} />
                          </div>
                        ))}
                      </div>
                      {!isCodValid && <p className="text-red-600 text-sm font-medium">ยอดรวม COD ไม่ถูกต้อง</p>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Order Summary */}
            {
            <div className="bg-slate-50 border border-gray-300 rounded-lg p-6">
              <h3 className="font-semibold text-lg mb-4 pb-2 border-b text-[#0e141b]">สรุปคำสั่งซื้อ</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-[#4e7397]">
                  <span>ยอดรวมสินค้า</span>
                  <span className="text-[#0e141b] font-medium">฿{subTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#4e7397]">
                  <span>ส่วนลดรายการสินค้า</span>
                  <span className="text-red-600 font-medium">-฿{itemsDiscount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#4e7397]">
                  <span>ค่าขนส่ง</span>
                  <span className="text-[#0e141b] font-medium">฿{(orderData.shippingCost || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#4e7397]">
                  <span>ส่วนลดท้ายบิล ({billDiscountPercent}%)</span>
                  <span className="text-red-600 font-medium">-฿{billDiscountAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-3 mt-3">
                  <span className="text-[#0e141b]">ยอดสุทธิ</span>
                  <span className="text-green-600">฿{totalAmount.toFixed(2)}</span>
                </div>
              </div>
              
              {orderData.items && orderData.items.length > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <h4 className="font-medium text-sm mb-3 text-[#0e141b]">รายการสินค้า ({(orderData.items || []).filter(it => !it.parentItemId).length})</h4>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {(orderData.items || []).filter(it => !it.parentItemId).map((item, idx) => (
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
            }
          </div>
        </div>

                {/* Footer Actions */}
        <div className="mt-6 flex justify-end gap-3 pb-6">
          <button
            onClick={handleSave}
            disabled={!isCodValid || (isCreatingNewCustomer && !!newCustomerPhoneError)}
            className="px-6 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            บันทึกคำสั่งซื้อ
          </button>
        </div>

        
      </div>
      
      {/* Success Message Popup */}
      {showSuccessMessage && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          บันทึกคำสั่งซื้อสำเร็จแล้ว
        </div>
      )}
    </div>
  );
};

export default CreateOrderPage;







