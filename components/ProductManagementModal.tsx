import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '../types';
import { ArrowLeft, Edit, PlusCircle, X, CheckSquare, RefreshCcw, Info, BarChart3, Folder, Tag, AlignLeft, ShoppingCart, DollarSign, Archive, Calculator } from 'lucide-react';

interface ProductManagementModalProps {
  product?: Product;
  onSave: (product: Omit<Product, 'id'> | Product) => void;
  onClose: () => void;
  companyId: number;
}

const FormField: React.FC<{ icon: React.ElementType, label: string, required?: boolean, hint?: string, children: React.ReactNode }> = ({ icon: Icon, label, required, hint, children }) => (
    <div>
        <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
            <Icon size={16} className="mr-2 text-gray-400"/>
            {label} {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {children}
        {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
);

const productCategories = ['ปุ๋ย', 'ยาฆ่าแมลง', 'เมล็ดพันธุ์', 'วัสดุปลูก', 'อุปกรณ์การเกษตร'];
const productUnits = ['กระสอบ', 'ขวด', 'ซอง', 'ถุง', 'ชิ้น', 'กิโลกรัม'];


const ProductManagementModal: React.FC<ProductManagementModalProps> = ({ product, onSave, onClose, companyId }) => {
  const getInitialState = () => ({
      sku: product?.sku || '',
      name: product?.name || '',
      description: product?.description || '',
      category: product?.category || '',
      unit: product?.unit || '',
      cost: product?.cost.toString() || '0',
      price: product?.price.toString() || '0',
      stock: product?.stock.toString() || '0',
  });
  
  const [formData, setFormData] = useState(getInitialState);

  useEffect(() => {
    setFormData(getInitialState());
  }, [product]);

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
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({...prev, [name]: value}));
  }

  const handleSave = () => {
    if(!formData.sku || !formData.name || !formData.unit || !formData.cost || !formData.price || !formData.stock) {
        alert('กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบถ้วน');
        return;
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
    };

    if (product) {
      onSave({ ...productData, id: product.id });
    } else {
      onSave(productData);
    }
  };

  const title = product ? `แก้ไขสินค้า: ${product.name}` : 'เพิ่มสินค้าใหม่';
  const buttonLabel = product ? 'บันทึกการเปลี่ยนแปลง' : 'บันทึกสินค้า';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4">
      <div className="bg-[#F9FAFB] rounded-lg shadow-xl w-full max-w-6xl h-full max-h-[95vh] flex flex-col">
        <header className="flex justify-between items-center p-4 border-b flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center"><PlusCircle className="mr-3 text-gray-600"/>{title}</h2>
          <button onClick={onClose} className="bg-gray-200 text-gray-700 font-semibold text-sm rounded-md py-2 px-4 flex items-center hover:bg-gray-300">
             <ArrowLeft size={16} className="mr-2"/>
             กลับไปรายการสินค้า
          </button>
        </header>

        <main className="flex-grow overflow-y-auto p-6">
            <div className="bg-white p-6 rounded-lg shadow-md border">
                 <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center"><Edit size={18} className="mr-3 text-gray-500"/>ข้อมูลสินค้า</h3>
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
                    {/* Left Column */}
                    <div className="space-y-6">
                        <div className="p-4 border rounded-md">
                            <h4 className="font-semibold text-gray-600 mb-4 flex items-center"><Info size={16} className="mr-2"/>ข้อมูลพื้นฐาน</h4>
                            <div className="space-y-4">
                                <FormField label="รหัสสินค้า" required hint="รหัสสินค้าที่ไม่ซ้ำกับสินค้าอื่น" icon={BarChart3}>
                                    <input type="text" name="sku" value={formData.sku} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-black" />
                                </FormField>
                                <FormField label="ชื่อสินค้า" required icon={Tag}>
                                    <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-black" />
                                </FormField>
                                 <FormField label="หมวดหมู่" icon={Folder}>
                                    <select name="category" value={formData.category} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-black">
                                        <option value="">เลือกหมวดหมู่</option>
                                        {productCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                </FormField>
                                <FormField label="หน่วย" required icon={ShoppingCart}>
                                    <select name="unit" value={formData.unit} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-black">
                                        <option value="">เลือกหน่วย</option>
                                        {productUnits.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </FormField>
                            </div>
                        </div>
                        <FormField label="รายละเอียดสินค้า" icon={AlignLeft}>
                            <textarea name="description" value={formData.description} onChange={handleChange} rows={5} className="w-full p-2 border rounded-md bg-white text-black" placeholder="อธิบายรายละเอียดของสินค้า..."></textarea>
                        </FormField>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        <div className="p-4 border rounded-md">
                            <h4 className="font-semibold text-gray-600 mb-4 flex items-center"><DollarSign size={16} className="mr-2"/>ราคาและสต็อก</h4>
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
                             <h4 className="font-semibold text-gray-600 mb-3 flex items-center"><Calculator size={16} className="mr-2"/>การคำนวณกำไร</h4>
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
        </main>
        
        <footer className="flex justify-between items-center p-4 border-t bg-gray-50 flex-shrink-0">
            <button onClick={onClose} className="px-5 py-2.5 bg-white border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-100 font-semibold flex items-center">
                <X size={16} className="mr-2"/>
                ยกเลิก
            </button>
            <div className="flex items-center space-x-3">
                <button onClick={() => setFormData(getInitialState())} className="px-5 py-2.5 bg-white border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-100 font-semibold flex items-center">
                    <RefreshCcw size={16} className="mr-2"/>
                    รีเซ็ต
                </button>
                <button onClick={handleSave} className="px-5 py-2.5 bg-[#2E7D32] text-white rounded-lg hover:bg-green-800 font-semibold flex items-center">
                    <CheckSquare size={16} className="mr-2"/>
                    {buttonLabel}
                </button>
            </div>
        </footer>

      </div>
    </div>
  );
};

export default ProductManagementModal;