import React, { useState, useMemo } from 'react';
import { Product, User, Company, UserRole } from '../types';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';

interface ProductManagementPageProps {
  products: Product[];
  openModal: (type: string, data?: any) => void;
  currentUser: User;
  allCompanies: Company[];
}

const ProductManagementPage: React.FC<ProductManagementPageProps> = ({ products, openModal, currentUser, allCompanies }) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [companyFilter, setCompanyFilter] = useState<string>('');

  const handleDelete = (product: Product) => {
    openModal('confirmDelete', {
      id: product.id,
      name: product.name,
      type: 'product'
    });
  };

  const productCategories = useMemo(() => {
    return [...new Set(products.map(p => p.category))];
  }, [products]);

  const isSuperAdmin = currentUser.role === UserRole.SuperAdmin;

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const categoryMatch = !categoryFilter || product.category === categoryFilter;
      const companyMatch = !isSuperAdmin || !companyFilter || product.companyId === parseInt(companyFilter);
      return categoryMatch && companyMatch;
    });
  }, [products, categoryFilter, companyFilter, isSuperAdmin]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">จัดการสินค้า</h2>
          <p className="text-gray-600">จัดการข้อมูลสินค้าทั้งหมดในระบบ</p>
        </div>
        <button
          onClick={() => openModal('addProduct')}
          className="bg-green-100 text-green-700 font-semibold text-sm rounded-md py-2 px-4 flex items-center hover:bg-green-200 shadow-sm"
        >
          <PlusCircle size={16} className="mr-2"/>
          เพิ่มสินค้าใหม่
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-6 flex items-center space-x-4">
        <div className="flex-1">
          <label htmlFor="category-filter" className="block text-sm font-medium text-gray-700 mb-1">กรองตามหมวดหมู่</label>
          <select
            id="category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500"
            style={{ colorScheme: 'light' }}
          >
            <option value="">ทุกหมวดหมู่</option>
            {productCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        {isSuperAdmin && (
          <div className="flex-1">
            <label htmlFor="company-filter" className="block text-sm font-medium text-gray-700 mb-1">กรองตามบริษัท</label>
            <select
              id="company-filter"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500"
              style={{ colorScheme: 'light' }}
            >
              <option value="">ทุกบริษัท</option>
              {allCompanies.map(company => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm text-left text-gray-500">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3">ID</th>
              <th scope="col" className="px-6 py-3">รหัสสินค้า (SKU)</th>
              <th scope="col" className="px-6 py-3">ชื่อสินค้า</th>
              <th scope="col" className="px-6 py-3">ต้นทุน</th>
              <th scope="col" className="px-6 py-3">ราคาขาย</th>
              <th scope="col" className="px-6 py-3">สต็อก</th>
              <th scope="col" className="px-6 py-3 text-right">การดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => (
              <tr key={product.id} className="bg-white border-b hover:bg-gray-50">
                <td className="px-6 py-4 font-mono text-xs">{product.id}</td>
                <td className="px-6 py-4 font-mono text-xs">{product.sku}</td>
                <td className="px-6 py-4 font-medium text-gray-900">{product.name}</td>
                <td className="px-6 py-4">฿{product.cost.toLocaleString()}</td>
                <td className="px-6 py-4">฿{product.price.toLocaleString()}</td>
                <td className="px-6 py-4">{product.stock.toLocaleString()}</td>
                <td className="px-6 py-4 flex items-center justify-end space-x-2">
                  <button onClick={() => openModal('editProduct', product)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"><Edit size={16} /></button>
                  <button onClick={() => handleDelete(product)} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredProducts.length === 0 && (
          <div className="text-center py-10 text-gray-500">
            ไม่พบข้อมูลสินค้า
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductManagementPage;