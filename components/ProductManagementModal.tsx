import React, { useState, useEffect, useMemo } from 'react';
import { Product, Warehouse } from '../types';
import { ArrowLeft, Edit, PlusCircle, X, CheckSquare, RefreshCcw, Info, BarChart3, Folder, Tag, AlignLeft, ShoppingCart, DollarSign, Archive, Calculator, Package, Plus, Trash2 } from 'lucide-react';
import { listProductLots } from '@/services/api';
import { saveProductWithLots, deleteProductWithLots } from '@/services/productApi';

interface ProductManagementModalProps {
  product?: Product;
  onSave: (product: Omit<Product, 'id'> | Product) => void;
  onClose: () => void;
  companyId: number;
  warehouses?: Warehouse[];
  products?: Product[];
}

const FormField: React.FC<{ icon: React.ElementType, label: string, required?: boolean, hint?: string, children: React.ReactNode }> = ({ icon: Icon, label, required, hint, children }) => (
  <div>
    <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
      <Icon size={16} className="mr-2 text-gray-400" />
      {label} {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
  </div>
);

const productCategories = ['ปุ๋ย', 'ยาฆ่าแมลง', 'เมล็ดพันธุ์', 'วัสดุปลูก', 'อุปกรณ์การเกษตร'];
const productUnits = ['กระสอบ', 'ขวด', 'ซอง', 'ถุง', 'ชิ้น', 'กิโลกรัม'];


const ProductManagementModal: React.FC<ProductManagementModalProps> = ({ product, onSave, onClose, companyId, warehouses = [], products = [] }) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'lots'>('basic');

  // ดึงรายการร้านค้าที่มีอยู่แล้ว (เฉพาะบริษัทตัวเอง)
  const existingShops = useMemo(() => {
    const shops = products
      .filter(p => p.companyId === companyId && p.shop)
      .map(p => p.shop!)
      .filter((shop, index, self) => self.indexOf(shop) === index) // unique
      .sort();
    return shops;
  }, [products, companyId]);

  const getInitialState = () => ({
    sku: product?.sku || '',
    name: product?.name || '',
    description: product?.description || '',
    category: product?.category || '',
    unit: product?.unit || '',
    cost: product?.cost.toString() || '0',
    price: product?.price.toString() || '0',
    stock: product?.stock.toString() || '0',
    shop: product?.shop || '',
  });

  const [formData, setFormData] = useState(getInitialState);

  // State for managing lots
  const [lots, setLots] = useState<Array<{
    id?: number;
    lotNumber: string;
    warehouseId: number;
    quantity: number;
    purchaseDate: string;
    expiryDate?: string;
    unitCost: number;
    notes?: string;
  }>>([]);

  // Load existing lots when editing a product
  useEffect(() => {
    setFormData(getInitialState());

    // Load existing lots if editing a product
    if (product && product.id) {
      loadProductLots(product.id);
    } else {
      // Clear lots when adding a new product
      setLots([]);
    }
  }, [product]);

  const loadProductLots = async (productId: number) => {
    try {
      const productLots = await listProductLots({ productId });
      const formattedLots = productLots.map((lot: any) => ({
        id: lot.id,
        lotNumber: lot.lot_number,
        warehouseId: lot.warehouse_id,
        quantity: parseFloat(lot.quantity_remaining),
        purchaseDate: lot.purchase_date,
        expiryDate: lot.expiry_date || '',
        unitCost: parseFloat(lot.unit_cost),
        notes: lot.notes || ''
      }));
      setLots(formattedLots);
    } catch (error) {
      console.error('Error loading product lots:', error);
    }
  };

  const { profit, margin } = useMemo(() => {
    const costNum = parseFloat(formData.cost) || 0;
    const priceNum = parseFloat(formData.price) || 0;
    if (priceNum > 0 && costNum >= 0) {
      const profitVal = priceNum - costNum;
      const marginVal = (profitVal / priceNum) * 100;
      return { profit: profitVal, margin: marginVal };
    }
    return { profit: 0, margin: 0 };
  }, [formData.cost, formData.price]);

  // Functions for managing lots
  const addLot = () => {
    const newLot = {
      lotNumber: '',
      warehouseId: warehouses.length > 0 ? warehouses[0].id : 1,
      quantity: 0,
      purchaseDate: new Date().toISOString().split('T')[0],
      expiryDate: '',
      unitCost: parseFloat(formData.cost) || 0,
      notes: ''
    };
    setLots([...lots, newLot]);
  };

  const updateLot = (index: number, field: string, value: any) => {
    const updatedLots = [...lots];
    updatedLots[index] = { ...updatedLots[index], [field]: value };
    setLots(updatedLots);
  };

  const removeLot = (index: number) => {
    setLots(lots.filter((_, i) => i !== index));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  const handleSave = async () => {
    if (!formData.sku || !formData.name || !formData.unit || !formData.cost || !formData.price || !formData.stock) {
      alert('กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบถ้วน');
      return;
    }

    // Validate lots if any
    if (activeTab === 'lots') {
      for (const lot of lots) {
        if (!lot.lotNumber || !lot.warehouseId || lot.quantity <= 0) {
          alert('กรุณากรอกข้อมูล Lot ให้ครบถ้วน (Lot Number, คลังสินค้า, จำนวน)');
          return;
        }
      }
    }

    const productData = {
      sku: formData.sku,
      name: formData.name,
      description: formData.description,
      category: formData.category,
      unit: formData.unit,
      cost: parseFloat(formData.cost) || 0,
      price: parseFloat(formData.price) || 0,
      stock: parseInt(formData.stock, 10) || 0,
      companyId,
      shop: formData.shop || undefined,
      lots: activeTab === 'lots' ? lots : [],
    };

    try {
      const result = await saveProductWithLots({ ...productData, id: product?.id });
      if (result.success) {
        onSave({ ...productData, id: result.id || product?.id });
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      console.error(error);
      alert('Failed to save product.');
    }
  };

  const handleDelete = async () => {
    if (!product?.id) return;
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const result = await deleteProductWithLots(product.id);
      if (result.success) {
        onClose();
        window.location.reload();
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      console.error(error);
      alert('Failed to delete product.');
    }
  };

  const title = product ? `แก้ไขสินค้า: ${product.name}` : 'เพิ่มสินค้าใหม่';
  const buttonLabel = product ? 'บันทึกการเปลี่ยนแปลง' : 'บันทึกสินค้า';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4">
      <div className="bg-[#F9FAFB] rounded-lg shadow-xl w-full max-w-6xl h-full max-h-[95vh] flex flex-col">
        <header className="flex justify-between items-center p-4 border-b flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center"><PlusCircle className="mr-3 text-gray-600" />{title}</h2>
          <button onClick={onClose} className="bg-gray-200 text-gray-700 font-semibold text-sm rounded-md py-2 px-4 flex items-center hover:bg-gray-300">
            <ArrowLeft size={16} className="mr-2" />
            กลับไปรายการสินค้า
          </button>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - Tab Navigation */}
          <div className="w-64 bg-white border-r p-4 flex-shrink-0">
            <nav className="space-y-2">
              <button
                onClick={() => setActiveTab('basic')}
                className={`w-full text-left px-4 py-3 rounded-lg flex items-center ${activeTab === 'basic'
                  ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
                  }`}
              >
                <Package size={18} className="mr-3" />
                ข้อมูลสินค้า
              </button>
              <button
                onClick={() => setActiveTab('lots')}
                className={`w-full text-left px-4 py-3 rounded-lg flex items-center ${activeTab === 'lots'
                  ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
                  }`}
              >
                <Package size={18} className="mr-3" />
                จัดการ Lot
                {lots.length > 0 && (
                  <span className="ml-auto bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
                    {lots.length}
                  </span>
                )}
              </button>
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'basic' && (
              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-6">
                    <div className="p-4 border rounded-md">
                      <h4 className="font-semibold text-gray-600 mb-4 flex items-center"><Folder size={16} className="mr-2" />ข้อมูลพื้นฐาน</h4>
                      <div className="space-y-4">
                        <FormField label="รหัสสินค้า (SKU)" required icon={Tag}>
                          <input type="text" name="sku" value={formData.sku} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-black" placeholder="เช่น PRD-001" />
                        </FormField>
                        <FormField label="ชื่อสินค้า" required icon={Folder}>
                          <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-black" placeholder="กรอกชื่อสินค้า" />
                        </FormField>
                        <FormField label="หมวดหมู่" icon={BarChart3}>
                          <select name="category" value={formData.category} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-black">
                            <option value="">เลือกหมวดหมู่</option>
                            {productCategories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </FormField>
                        <FormField label="หน่วยนับ" required icon={Info}>
                          <select name="unit" value={formData.unit} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-black">
                            <option value="">เลือกหน่วย</option>
                            {productUnits.map(unit => (
                              <option key={unit} value={unit}>{unit}</option>
                            ))}
                          </select>
                        </FormField>
                        <FormField label="ร้านค้า" icon={ShoppingCart} hint="เลือกจากรายการที่มีอยู่ หรือพิมพ์เพิ่มใหม่">
                          <div className="relative">
                            <input
                              type="text"
                              name="shop"
                              value={formData.shop}
                              onChange={handleChange}
                              list="shop-list"
                              className="w-full p-2 border rounded-md bg-white text-black"
                              placeholder="เลือกหรือพิมพ์ชื่อร้านค้า"
                            />
                            {existingShops.length > 0 && (
                              <datalist id="shop-list">
                                {existingShops.map((shop, index) => (
                                  <option key={index} value={shop} />
                                ))}
                              </datalist>
                            )}
                          </div>
                        </FormField>
                      </div>
                    </div>
                    <div className="p-4 border rounded-md">
                      <h4 className="font-semibold text-gray-600 mb-4 flex items-center"><AlignLeft size={16} className="mr-2" />รายละเอียดเพิ่มเติม</h4>
                      <FormField label="รายละเอียดสินค้า" icon={AlignLeft}>
                        <textarea name="description" value={formData.description} onChange={handleChange} rows={5} className="w-full p-2 border rounded-md bg-white text-black" placeholder="อธิบายรายละเอียดของสินค้า..."></textarea>
                      </FormField>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    <div className="p-4 border rounded-md">
                      <h4 className="font-semibold text-gray-600 mb-4 flex items-center"><DollarSign size={16} className="mr-2" />ราคาและสต็อก</h4>
                      <div className="space-y-4">
                        <FormField label="ต้นทุน (บาท)" required icon={ShoppingCart}>
                          <input type="number" name="cost" value={formData.cost} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-black" />
                        </FormField>
                        <FormField label="ราคาขาย (บาท)" required icon={Tag}>
                          <input type="number" name="price" value={formData.price} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-black" />
                        </FormField>
                        <FormField label="จำนวนคงเหลือ" required icon={Archive}>
                          <input type="number" name="stock" value={formData.stock} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-black" />
                        </FormField>
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg border">
                      <h4 className="font-semibold text-gray-600 mb-3 flex items-center"><Calculator size={16} className="mr-2" />การคำนวณกำไร</h4>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">กำไรต่อหน่วย:</span>
                        <span className="font-bold text-lg text-green-700">฿{profit.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm mt-1">
                        <span className="text-gray-500">อัตรากำไร:</span>
                        <span className="font-bold text-lg text-green-700">{margin.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'lots' && (
              <div className="bg-white p-6 rounded-lg shadow-md border">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                    <Package size={18} className="mr-3 text-gray-500" />
                    จัดการ Lot ของสินค้า
                  </h3>
                  <button
                    onClick={addLot}
                    className="bg-green-100 text-green-700 font-semibold text-sm rounded-md py-2 px-4 flex items-center hover:bg-green-200"
                  >
                    <Plus size={16} className="mr-2" />
                    เพิ่ม Lot ใหม่
                  </button>
                </div>

                {lots.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 border-2 border-dashed rounded-lg">
                    <Package size={48} className="mx-auto mb-4 text-gray-300" />
                    <p>ยังไม่มีข้อมูล Lot</p>
                    <p className="text-sm mt-2">คลิก "เพิ่ม Lot ใหม่" เพื่อเพิ่มข้อมูล Lot ของสินค้า</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {lots.map((lot, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-4">
                          <h4 className="font-medium text-gray-800">Lot #{index + 1}</h4>
                          <button
                            onClick={() => removeLot(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Lot Number</label>
                            <input
                              type="text"
                              value={lot.lotNumber}
                              onChange={(e) => updateLot(index, 'lotNumber', e.target.value)}
                              className="w-full p-2 border rounded-md"
                              placeholder="เช่น LOT-2024-001"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">คลังสินค้า</label>
                            <select
                              value={lot.warehouseId}
                              onChange={(e) => updateLot(index, 'warehouseId', parseInt(e.target.value))}
                              className="w-full p-2 border rounded-md"
                            >
                              {warehouses.map(warehouse => (
                                <option key={warehouse.id} value={warehouse.id}>
                                  {warehouse.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">จำนวน</label>
                            <input
                              type="number"
                              value={lot.quantity}
                              onChange={(e) => updateLot(index, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-full p-2 border rounded-md"
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">วันที่รับเข้า</label>
                            <input
                              type="date"
                              value={lot.purchaseDate}
                              onChange={(e) => updateLot(index, 'purchaseDate', e.target.value)}
                              className="w-full p-2 border rounded-md"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">วันหมดอายุ</label>
                            <input
                              type="date"
                              value={lot.expiryDate}
                              onChange={(e) => updateLot(index, 'expiryDate', e.target.value)}
                              className="w-full p-2 border rounded-md"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ต้นทุนต่อหน่วย</label>
                            <input
                              type="number"
                              value={lot.unitCost}
                              onChange={(e) => updateLot(index, 'unitCost', parseFloat(e.target.value) || 0)}
                              className="w-full p-2 border rounded-md"
                              placeholder="0"
                            />
                          </div>
                          <div className="md:col-span-2 lg:col-span-3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
                            <textarea
                              value={lot.notes}
                              onChange={(e) => updateLot(index, 'notes', e.target.value)}
                              className="w-full p-2 border rounded-md"
                              rows={2}
                              placeholder="หมายเหตุเพิ่มเติม..."
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <footer className="p-4 border-t flex justify-end space-x-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="bg-gray-200 text-gray-700 font-semibold text-sm rounded-md py-2 px-4 hover:bg-gray-300"
          >
            ยกเลิก
          </button>
          {product && (
            <button
              onClick={handleDelete}
              className="bg-red-100 text-red-700 font-semibold text-sm rounded-md py-2 px-4 hover:bg-red-200 mr-auto"
            >
              <Trash2 size={16} className="mr-2 inline" />
              ลบสินค้า
            </button>
          )}
          <button
            onClick={handleSave}
            className="bg-green-600 text-white font-semibold text-sm rounded-md py-2 px-4 hover:bg-green-700"
          >
            {buttonLabel}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ProductManagementModal;