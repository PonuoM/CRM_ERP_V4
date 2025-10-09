import React, { useState } from 'react';
import { Company, User } from '../types';
import { Plus, Edit, Trash2, Building2, MapPin, Phone, Mail, FileText } from 'lucide-react';
import Modal from '../components/Modal';
import { createCompany, updateCompany, deleteCompany } from '../services/api';

interface CompanyManagementPageProps {
  companies: Company[];
  currentUser?: User;
  onCompanyChange: (companies: Company[]) => void;
}

const CompanyManagementPage: React.FC<CompanyManagementPageProps> = ({ 
  companies, 
  currentUser, 
  onCompanyChange 
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.taxId?.includes(searchTerm) ||
    company.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddCompany = async (newCompany: Omit<Company, 'id'>) => {
    try {
      const result = await createCompany({
        name: newCompany.name,
        address: newCompany.address,
        phone: newCompany.phone,
        email: newCompany.email,
        taxId: newCompany.taxId,
      });
      
      const company: Company = {
        id: result.id,
        ...newCompany,
      };
      onCompanyChange([...companies, company]);
      setIsAddModalOpen(false);
      alert('เพิ่มบริษัทสำเร็จ');
    } catch (error) {
      console.error('Failed to create company:', error);
      alert('เกิดข้อผิดพลาดในการเพิ่มบริษัท');
    }
  };

  const handleEditCompany = async (updatedCompany: Company) => {
    try {
      await updateCompany(updatedCompany.id, {
        name: updatedCompany.name,
        address: updatedCompany.address,
        phone: updatedCompany.phone,
        email: updatedCompany.email,
        taxId: updatedCompany.taxId,
      });
      
      onCompanyChange(companies.map(c => c.id === updatedCompany.id ? updatedCompany : c));
      setIsEditModalOpen(false);
      setEditingCompany(null);
      alert('แก้ไขบริษัทสำเร็จ');
    } catch (error) {
      console.error('Failed to update company:', error);
      alert('เกิดข้อผิดพลาดในการแก้ไขบริษัท');
    }
  };

  const handleDeleteCompany = async (id: number) => {
    if (window.confirm('คุณแน่ใจหรือไม่ที่จะลบบริษัทนี้?')) {
      try {
        await deleteCompany(id);
        onCompanyChange(companies.filter(c => c.id !== id));
        alert('ลบบริษัทสำเร็จ');
      } catch (error) {
        console.error('Failed to delete company:', error);
        alert('เกิดข้อผิดพลาดในการลบบริษัท อาจมีข้อมูลที่เกี่ยวข้องอยู่');
      }
    }
  };

  return (
    <div className="p-6 bg-[#F5F5F5] min-h-full">
      <div className="w-full">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">จัดการบริษัท</h1>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Plus size={16} />
            <span>เพิ่มบริษัท</span>
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="ค้นหาบริษัท..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Companies Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">บริษัท</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ที่อยู่</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ติดต่อ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">เลขประจำตัวผู้เสียภาษี</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCompanies.map((company) => (
                  <tr key={company.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Building2 className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{company.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm text-gray-900">
                        <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="max-w-xs truncate">{company.address}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        {company.phone && (
                          <div className="flex items-center text-sm text-gray-900">
                            <Phone className="h-4 w-4 text-gray-400 mr-2" />
                            <span>{company.phone}</span>
                          </div>
                        )}
                        {company.email && (
                          <div className="flex items-center text-sm text-gray-900">
                            <Mail className="h-4 w-4 text-gray-400 mr-2" />
                            <span>{company.email}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <FileText className="h-4 w-4 text-gray-400 mr-2" />
                        <span>{company.taxId || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setEditingCompany(company);
                            setIsEditModalOpen(true);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteCompany(company.id)}
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

        {filteredCompanies.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">ไม่พบบริษัท</h3>
            <p className="mt-1 text-sm text-gray-500">เริ่มต้นด้วยการเพิ่มบริษัทใหม่</p>
          </div>
        )}
      </div>

      {/* Add Company Modal */}
      {isAddModalOpen && (
        <AddCompanyModal
          onClose={() => setIsAddModalOpen(false)}
          onSave={handleAddCompany}
        />
      )}

      {/* Edit Company Modal */}
      {isEditModalOpen && editingCompany && (
        <EditCompanyModal
          company={editingCompany}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingCompany(null);
          }}
          onSave={handleEditCompany}
        />
      )}
    </div>
  );
};

// Add Company Modal Component
const AddCompanyModal: React.FC<{
  onClose: () => void;
  onSave: (company: Omit<Company, 'id'>) => void;
}> = ({ onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    taxId: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('กรุณากรอกชื่อบริษัท');
      return;
    }
    onSave(formData);
    setFormData({ name: '', address: '', phone: '', email: '', taxId: '' });
  };

  return (
    <Modal title="เพิ่มบริษัท" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อบริษัท *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ที่อยู่</label>
          <textarea
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรศัพท์</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
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
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">เลขประจำตัวผู้เสียภาษี</label>
          <input
            type="text"
            value={formData.taxId}
            onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
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

// Edit Company Modal Component
const EditCompanyModal: React.FC<{
  company: Company;
  onClose: () => void;
  onSave: (company: Company) => void;
}> = ({ company, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: company.name,
    address: company.address || '',
    phone: company.phone || '',
    email: company.email || '',
    taxId: company.taxId || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('กรุณากรอกชื่อบริษัท');
      return;
    }
    onSave({ ...company, ...formData });
  };

  return (
    <Modal title="แก้ไขบริษัท" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อบริษัท *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ที่อยู่</label>
          <textarea
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรศัพท์</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
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
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">เลขประจำตัวผู้เสียภาษี</label>
          <input
            type="text"
            value={formData.taxId}
            onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
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

export default CompanyManagementPage;