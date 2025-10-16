import React, { useState } from 'react';
import { Promotion, Product, PromotionItem } from '../types';
import { apiFetch } from '../services/api';

interface CreatePromotionPageProps {
  products: Product[];
  onSuccess: () => void;
}

const CreatePromotionPage: React.FC<CreatePromotionPageProps> = ({
  products,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    startDate: '',
    endDate: '',
    active: true
  });
  
  const [promotionItems, setPromotionItems] = useState<PromotionItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [itemForm, setItemForm] = useState({
    quantity: 1,
    isFreebie: false,
    priceOverride: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleItemFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setItemForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : 
               name === 'quantity' ? parseInt(value) || 0 :
               name === 'priceOverride' ? (value ? parseFloat(value) : '') : value
    }));
  };

  const addPromotionItem = () => {
    if (!selectedProductId) {
      setError('กรุณาเลือกสินค้า');
      return;
    }

    const newItem: PromotionItem = {
      id: Date.now(), // temporary ID
      promotionId: 0, // will be set by server
      productId: selectedProductId,
      quantity: itemForm.quantity,
      isFreebie: itemForm.isFreebie,
      priceOverride: itemForm.priceOverride ? parseFloat(itemForm.priceOverride) : undefined
    };

    setPromotionItems(prev => [...prev, newItem]);
    
    // Reset form
    setSelectedProductId(null);
    setItemForm({
      quantity: 1,
      isFreebie: false,
      priceOverride: ''
    });
    setError('');
  };

  const removePromotionItem = (id: number) => {
    setPromotionItems(prev => prev.filter(item => item.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      setError('กรุณากรอกชื่อโปรโมชั่น');
      return;
    }

    if (promotionItems.length === 0) {
      setError('กรุณาเพิ่มสินค้าในโปรโมชั่นอย่างน้อย 1 รายการ');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const promotionData = {
        ...formData,
        items: promotionItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          isFreebie: item.isFreebie,
          priceOverride: item.priceOverride
        }))
      };

      await apiFetch('promotions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(promotionData)
      });

      onSuccess();
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการสร้างโปรโมชั่น กรุณาลองใหม่อีกครั้ง');
      console.error('Error creating promotion:', err);
    } finally {
      setLoading(false);
    }
  };

  const getProductName = (productId: number) => {
    const product = products.find(p => p.id === productId);
    return product ? product.name : `Product #${productId}`;
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">สร้างโปรโมชั่นใหม่</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">ข้อมูลโปรโมชั่น</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                ชื่อโปรโมชั่น *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </div>
            
            <div>
              <label htmlFor="sku" className="block text-sm font-medium text-gray-700 mb-1">
                รหัสโปรโมชั่น
              </label>
              <input
                type="text"
                id="sku"
                name="sku"
                value={formData.sku}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          
          <div className="mt-4">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              รายละเอียด
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                วันที่เริ่มต้น
              </label>
              <input
                type="date"
                id="startDate"
                name="startDate"
                value={formData.startDate}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                วันที่สิ้นสุด
              </label>
              <input
                type="date"
                id="endDate"
                name="endDate"
                value={formData.endDate}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          
          <div className="mt-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="active"
                checked={formData.active}
                onChange={handleInputChange}
                className="mr-2 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">เปิดใช้งานทันที</span>
            </label>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">รายการสินค้าในโปรโมชั่น</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label htmlFor="product" className="block text-sm font-medium text-gray-700 mb-1">
                เลือกสินค้า
              </label>
              <select
                id="product"
                value={selectedProductId || ''}
                onChange={(e) => setSelectedProductId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">-- เลือกสินค้า --</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} (คงเหลือ: {product.stock})
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
                จำนวน
              </label>
              <input
                type="number"
                id="quantity"
                name="quantity"
                value={itemForm.quantity}
                onChange={handleItemFormChange}
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            
            <div>
              <label htmlFor="priceOverride" className="block text-sm font-medium text-gray-700 mb-1">
                ราคาพิเศษ (ถ้ามี)
              </label>
              <input
                type="number"
                id="priceOverride"
                name="priceOverride"
                value={itemForm.priceOverride}
                onChange={handleItemFormChange}
                step="0.01"
                min="0"
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            
            <div className="flex items-end">
              <button
                type="button"
                onClick={addPromotionItem}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                เพิ่มสินค้า
              </button>
            </div>
          </div>
          
          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              id="isFreebie"
              name="isFreebie"
              checked={itemForm.isFreebie}
              onChange={handleItemFormChange}
              className="mr-2 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
            />
            <label htmlFor="isFreebie" className="text-sm text-gray-700">
              สินค้านี้เป็นของแถม (ฟรี)
            </label>
          </div>
          
          {promotionItems.length > 0 && (
            <div className="mt-4">
              <h4 className="text-md font-medium text-gray-900 mb-2">สินค้าที่เพิ่มแล้ว:</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        สินค้า
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        จำนวน
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ราคาพิเศษ
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ประเภท
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        การจัดการ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {promotionItems.map(item => (
                      <tr key={item.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {getProductName(item.productId)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.priceOverride ? `฿${item.priceOverride}` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {item.isFreebie ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              ของแถม
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                              สินค้าหลัก
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <button
                            type="button"
                            onClick={() => removePromotionItem(item.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            ลบ
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
          >
            {loading ? 'กำลังบันทึก...' : 'สร้างโปรโมชั่น'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreatePromotionPage;
