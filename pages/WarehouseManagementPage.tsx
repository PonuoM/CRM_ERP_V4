import React, { useState } from 'react';
import { Warehouse, Company, User } from '../types';
import { Plus, Edit, Trash2, MapPin, Phone, Mail, User as UserIcon, Building2 } from 'lucide-react';
import Modal from '../components/Modal';
import { createWarehouse, updateWarehouse, deleteWarehouse } from '../services/api';

interface WarehouseManagementPageProps {
  warehouses: Warehouse[];
  companies: Company[];
  currentUser?: User;
  onWarehouseChange: (warehouses: Warehouse[]) => void;
}

const WarehouseManagementPage: React.FC<WarehouseManagementPageProps> = ({ 
  warehouses, 
  companies,
  currentUser, 
  onWarehouseChange 
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredWarehouses = warehouses.filter(warehouse =>
    warehouse.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    warehouse.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    warehouse.province?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    warehouse.managerName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddWarehouse = async (newWarehouse: Omit<Warehouse, 'id'>) => {
    try {
      const result = await createWarehouse({
        name: newWarehouse.name,
        companyId: newWarehouse.companyId,
        address: newWarehouse.address,
        province: newWarehouse.province,
        district: newWarehouse.district,
        subdistrict: newWarehouse.subdistrict,
        postalCode: newWarehouse.postalCode,
        phone: newWarehouse.phone,
        email: newWarehouse.email,
        managerName: newWarehouse.managerName,
        managerPhone: newWarehouse.managerPhone,
        responsibleProvinces: newWarehouse.responsibleProvinces,
        isActive: newWarehouse.isActive,
      });
      
      const warehouse: Warehouse = {
        id: result.id,
        ...newWarehouse,
      };
      onWarehouseChange([...warehouses, warehouse]);
      setIsAddModalOpen(false);
      alert('เพิ่มคลังสินค้าสำเร็จ');
    } catch (error) {
      console.error('Failed to create warehouse:', error);
      alert('เกิดข้อผิดพลาดในการเพิ่มคลังสินค้า');
    }
  };

  const handleEditWarehouse = async (updatedWarehouse: Warehouse) => {
    try {
      await updateWarehouse(updatedWarehouse.id, {
        name: updatedWarehouse.name,
        companyId: updatedWarehouse.companyId,
        address: updatedWarehouse.address,
        province: updatedWarehouse.province,
        district: updatedWarehouse.district,
        subdistrict: updatedWarehouse.subdistrict,
        postalCode: updatedWarehouse.postalCode,
        phone: updatedWarehouse.phone,
        email: updatedWarehouse.email,
        managerName: updatedWarehouse.managerName,
        managerPhone: updatedWarehouse.managerPhone,
        responsibleProvinces: updatedWarehouse.responsibleProvinces,
        isActive: updatedWarehouse.isActive,
      });
      
      onWarehouseChange(warehouses.map(w => w.id === updatedWarehouse.id ? updatedWarehouse : w));
      setIsEditModalOpen(false);
      setEditingWarehouse(null);
      alert('แก้ไขคลังสินค้าสำเร็จ');
    } catch (error) {
      console.error('Failed to update warehouse:', error);
      alert('เกิดข้อผิดพลาดในการแก้ไขคลังสินค้า');
    }
  };

  const handleDeleteWarehouse = async (id: number) => {
    if (window.confirm('คุณแน่ใจหรือไม่ที่จะลบคลังสินค้านี้?')) {
      try {
        await deleteWarehouse(id);
        onWarehouseChange(warehouses.filter(w => w.id !== id));
        alert('ลบคลังสินค้าสำเร็จ');
      } catch (error) {
        console.error('Failed to delete warehouse:', error);
        alert('เกิดข้อผิดพลาดในการลบคลังสินค้า อาจมีข้อมูลที่เกี่ยวข้องอยู่');
      }
    }
  };

  return (
    <div className="p-6 bg-[#F5F5F5] min-h-full">
      <div className="w-full">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">จัดการคลังสินค้า</h1>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Plus size={16} />
            <span>เพิ่มคลังสินค้า</span>
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="ค้นหาคลังสินค้า..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Warehouses Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">คลังสินค้า</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">บริษัท</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ที่อยู่</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ผู้จัดการ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">จังหวัดที่รับผิดชอบ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">สถานะ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredWarehouses.map((warehouse) => (
                  <tr key={warehouse.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Building2 className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{warehouse.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{warehouse.companyName}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm text-gray-900">
                        <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                        <div>
                          <div className="max-w-xs truncate">{warehouse.address}</div>
                          <div className="text-xs text-gray-500">
                            {warehouse.subdistrict} {warehouse.district} {warehouse.province} {warehouse.postalCode}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="flex items-center text-sm text-gray-900">
                          <UserIcon className="h-4 w-4 text-gray-400 mr-2" />
                          <span>{warehouse.managerName}</span>
                        </div>
                        {warehouse.managerPhone && (
                          <div className="flex items-center text-sm text-gray-500">
                            <Phone className="h-4 w-4 text-gray-400 mr-2" />
                            <span>{warehouse.managerPhone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        <div className="flex flex-wrap gap-1">
                          {warehouse.responsibleProvinces.slice(0, 3).map((province, index) => (
                            <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                              {province}
                            </span>
                          ))}
                          {warehouse.responsibleProvinces.length > 3 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                              +{warehouse.responsibleProvinces.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        warehouse.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {warehouse.isActive ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setEditingWarehouse(warehouse);
                            setIsEditModalOpen(true);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteWarehouse(warehouse.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredWarehouses.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">ไม่พบคลังสินค้า</h3>
            <p className="mt-1 text-sm text-gray-500">เริ่มต้นด้วยการเพิ่มคลังสินค้าใหม่</p>
          </div>
        )}
      </div>

      {/* Add Warehouse Modal */}
      {isAddModalOpen && (
        <AddWarehouseModal
          companies={companies}
          onClose={() => setIsAddModalOpen(false)}
          onSave={handleAddWarehouse}
        />
      )}

      {/* Edit Warehouse Modal */}
      {isEditModalOpen && editingWarehouse && (
        <EditWarehouseModal
          warehouse={editingWarehouse}
          companies={companies}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingWarehouse(null);
          }}
          onSave={handleEditWarehouse}
        />
      )}
    </div>
  );
};

// Add Warehouse Modal Component
const AddWarehouseModal: React.FC<{
  companies: Company[];
  onClose: () => void;
  onSave: (warehouse: Omit<Warehouse, 'id'>) => void;
}> = ({ companies, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    companyId: companies[0]?.id || 1,
    companyName: companies[0]?.name || '',
    address: '',
    province: '',
    district: '',
    subdistrict: '',
    postalCode: '',
    phone: '',
    email: '',
    managerName: '',
    managerPhone: '',
    responsibleProvinces: [] as string[],
    isActive: true,
  });

  const handleCompanyChange = (companyId: number) => {
    const company = companies.find(c => c.id === companyId);
    setFormData({
      ...formData,
      companyId,
      companyName: company?.name || '',
    });
  };

  const handleProvinceAdd = (province: string) => {
    if (province && !formData.responsibleProvinces.includes(province)) {
      setFormData({
        ...formData,
        responsibleProvinces: [...formData.responsibleProvinces, province],
      });
    }
  };

  const handleProvinceRemove = (province: string) => {
    setFormData({
      ...formData,
      responsibleProvinces: formData.responsibleProvinces.filter(p => p !== province),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('กรุณากรอกชื่อคลังสินค้า');
      return;
    }
    onSave(formData);
  };

  return (
    <Modal title="เพิ่มคลังสินค้า" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อคลังสินค้า *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">บริษัท *</label>
            <select
              value={formData.companyId}
              onChange={(e) => handleCompanyChange(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              {companies.map(company => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ที่อยู่ *</label>
          <textarea
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">จังหวัด *</label>
            <input
              type="text"
              value={formData.province}
              onChange={(e) => setFormData({ ...formData, province: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">อำเภอ *</label>
            <input
              type="text"
              value={formData.district}
              onChange={(e) => setFormData({ ...formData, district: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ตำบล *</label>
            <input
              type="text"
              value={formData.subdistrict}
              onChange={(e) => setFormData({ ...formData, subdistrict: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">รหัสไปรษณีย์</label>
            <input
              type="text"
              value={formData.postalCode}
              onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรศัพท์</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อผู้จัดการ *</label>
            <input
              type="text"
              value={formData.managerName}
              onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรผู้จัดการ</label>
            <input
              type="tel"
              value={formData.managerPhone}
              onChange={(e) => setFormData({ ...formData, managerPhone: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">จังหวัดที่รับผิดชอบ</label>
          <div className="space-y-2">
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="เพิ่มจังหวัด..."
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleProvinceAdd(e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const input = document.querySelector('input[placeholder="เพิ่มจังหวัด..."]') as HTMLInputElement;
                  if (input?.value) {
                    handleProvinceAdd(input.value);
                    input.value = '';
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                เพิ่ม
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.responsibleProvinces.map((province, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                >
                  {province}
                  <button
                    type="button"
                    onClick={() => handleProvinceRemove(province)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="isActive"
            checked={formData.isActive}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
            ใช้งาน
          </label>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            บันทึก
          </button>
        </div>
      </form>
    </Modal>
  );
};

// Edit Warehouse Modal Component
const EditWarehouseModal: React.FC<{
  warehouse: Warehouse;
  companies: Company[];
  onClose: () => void;
  onSave: (warehouse: Warehouse) => void;
}> = ({ warehouse, companies, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: warehouse.name,
    companyId: warehouse.companyId,
    companyName: warehouse.companyName,
    address: warehouse.address,
    province: warehouse.province,
    district: warehouse.district,
    subdistrict: warehouse.subdistrict,
    postalCode: warehouse.postalCode,
    phone: warehouse.phone,
    email: warehouse.email,
    managerName: warehouse.managerName,
    managerPhone: warehouse.managerPhone,
    responsibleProvinces: warehouse.responsibleProvinces,
    isActive: warehouse.isActive,
  });

  const handleCompanyChange = (companyId: number) => {
    const company = companies.find(c => c.id === companyId);
    setFormData({
      ...formData,
      companyId,
      companyName: company?.name || '',
    });
  };

  const handleProvinceAdd = (province: string) => {
    if (province && !formData.responsibleProvinces.includes(province)) {
      setFormData({
        ...formData,
        responsibleProvinces: [...formData.responsibleProvinces, province],
      });
    }
  };

  const handleProvinceRemove = (province: string) => {
    setFormData({
      ...formData,
      responsibleProvinces: formData.responsibleProvinces.filter(p => p !== province),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('กรุณากรอกชื่อคลังสินค้า');
      return;
    }
    onSave({ ...warehouse, ...formData });
  };

  return (
    <Modal title="แก้ไขคลังสินค้า" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อคลังสินค้า *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">บริษัท *</label>
            <select
              value={formData.companyId}
              onChange={(e) => handleCompanyChange(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              {companies.map(company => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ที่อยู่ *</label>
          <textarea
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">จังหวัด *</label>
            <input
              type="text"
              value={formData.province}
              onChange={(e) => setFormData({ ...formData, province: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">อำเภอ *</label>
            <input
              type="text"
              value={formData.district}
              onChange={(e) => setFormData({ ...formData, district: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ตำบล *</label>
            <input
              type="text"
              value={formData.subdistrict}
              onChange={(e) => setFormData({ ...formData, subdistrict: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">รหัสไปรษณีย์</label>
            <input
              type="text"
              value={formData.postalCode}
              onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรศัพท์</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อผู้จัดการ *</label>
            <input
              type="text"
              value={formData.managerName}
              onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรผู้จัดการ</label>
            <input
              type="tel"
              value={formData.managerPhone}
              onChange={(e) => setFormData({ ...formData, managerPhone: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">จังหวัดที่รับผิดชอบ</label>
          <div className="space-y-2">
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="เพิ่มจังหวัด..."
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleProvinceAdd(e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const input = document.querySelector('input[placeholder="เพิ่มจังหวัด..."]') as HTMLInputElement;
                  if (input?.value) {
                    handleProvinceAdd(input.value);
                    input.value = '';
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                เพิ่ม
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.responsibleProvinces.map((province, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                >
                  {province}
                  <button
                    type="button"
                    onClick={() => handleProvinceRemove(province)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="isActive"
            checked={formData.isActive}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
            ใช้งาน
          </label>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            บันทึก
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default WarehouseManagementPage;