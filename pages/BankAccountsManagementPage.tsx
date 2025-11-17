import React, { useState, useEffect } from 'react';
import { User, Company } from '../types';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import Modal from '../components/Modal';
import { listBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount } from '../services/api';

interface BankAccount {
  id: number;
  bank: string;
  bankNumber: string;
  companyId: number;
  isActive: boolean;
}

interface BankAccountsManagementPageProps {
  currentUser: User;
  companies: Company[];
}

const BankAccountsManagementPage: React.FC<BankAccountsManagementPageProps> = ({ 
  currentUser, 
  companies 
}) => {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(
    currentUser?.companyId || null
  );
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBankAccount, setEditingBankAccount] = useState<BankAccount | null>(null);

  // Fetch bank accounts
  const fetchBankAccounts = async (companyId?: number) => {
    setLoading(true);
    try {
      const data = await listBankAccounts(companyId || undefined, false);
      setBankAccounts(
        Array.isArray(data)
          ? data.map((b: any) => ({
              id: b.id,
              bank: b.bank,
              bankNumber: b.bank_number,
              companyId: b.company_id,
              isActive: Boolean(b.is_active),
            }))
          : []
      );
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
      alert('เกิดข้อผิดพลาดในการดึงข้อมูลบัญชีธนาคาร');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCompanyId) {
      fetchBankAccounts(selectedCompanyId);
    }
  }, [selectedCompanyId]);

  const filteredBankAccounts = bankAccounts.filter(account => {
    const matchesSearch = 
      account.bank.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.bankNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesActive = showActiveOnly ? account.isActive : true;
    return matchesSearch && matchesActive;
  }).sort((a, b) => {
    // Sort by bank name first, then by bank number
    if (a.bank !== b.bank) {
      return a.bank.localeCompare(b.bank);
    }
    return a.bankNumber.localeCompare(b.bankNumber);
  });

  const handleAddBankAccount = async (newBankAccount: Omit<BankAccount, 'id'>) => {
    try {
      const result = await createBankAccount({
        bank: newBankAccount.bank,
        bankNumber: newBankAccount.bankNumber,
        companyId: newBankAccount.companyId,
        isActive: newBankAccount.isActive,
      });
      
      await fetchBankAccounts(selectedCompanyId || undefined);
      setIsAddModalOpen(false);
      alert('เพิ่มบัญชีธนาคารสำเร็จ');
    } catch (error: any) {
      console.error('Failed to create bank account:', error);
      const errorMsg = error?.data?.message || error?.message || 'เกิดข้อผิดพลาดในการเพิ่มบัญชีธนาคาร';
      alert(errorMsg);
    }
  };

  const handleEditBankAccount = async (updatedBankAccount: BankAccount) => {
    try {
      await updateBankAccount(updatedBankAccount.id, {
        bank: updatedBankAccount.bank,
        bankNumber: updatedBankAccount.bankNumber,
        isActive: updatedBankAccount.isActive,
      });
      
      await fetchBankAccounts(selectedCompanyId || undefined);
      setIsEditModalOpen(false);
      setEditingBankAccount(null);
      alert('แก้ไขบัญชีธนาคารสำเร็จ');
    } catch (error: any) {
      console.error('Failed to update bank account:', error);
      const errorMsg = error?.data?.message || error?.message || 'เกิดข้อผิดพลาดในการแก้ไขบัญชีธนาคาร';
      alert(errorMsg);
    }
  };

  const handleDeleteBankAccount = async (id: number) => {
    if (window.confirm('คุณแน่ใจหรือไม่ที่จะลบบัญชีธนาคารนี้?')) {
      try {
        await deleteBankAccount(id);
        await fetchBankAccounts(selectedCompanyId || undefined);
        alert('ลบบัญชีธนาคารสำเร็จ');
      } catch (error: any) {
        console.error('Failed to delete bank account:', error);
        const errorMsg = error?.data?.message || error?.message || 'เกิดข้อผิดพลาดในการลบบัญชีธนาคาร';
        alert(errorMsg);
      }
    }
  };

  const handleToggleActive = async (account: BankAccount) => {
    try {
      await updateBankAccount(account.id, {
        isActive: !account.isActive,
      });
      await fetchBankAccounts(selectedCompanyId || undefined);
    } catch (error: any) {
      console.error('Failed to toggle bank account active status:', error);
      alert('เกิดข้อผิดพลาดในการเปลี่ยนสถานะบัญชีธนาคาร');
    }
  };

  const currentCompany = companies.find(c => c.id === selectedCompanyId);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">จัดการบัญชีธนาคาร</h2>
        {selectedCompanyId && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            เพิ่มบัญชีธนาคาร
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">บริษัท</label>
            <select
              value={selectedCompanyId || ''}
              onChange={(e) => setSelectedCompanyId(Number(e.target.value) || null)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="">เลือกบริษัท</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">ค้นหา</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="ค้นหาชื่อธนาคารหรือเลขบัญชี..."
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">แสดงเฉพาะบัญชีที่ใช้งาน</span>
            </label>
          </div>
        </div>
      </div>

      {/* Bank Accounts List */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">กำลังโหลด...</div>
      ) : filteredBankAccounts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {selectedCompanyId ? 'ไม่มีบัญชีธนาคาร' : 'กรุณาเลือกบริษัท'}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ธนาคาร</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">เลขบัญชี</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredBankAccounts.map((account) => (
                <tr key={account.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{account.bank}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{account.bankNumber}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(account)}
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        account.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {account.isActive ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingBankAccount(account);
                          setIsEditModalOpen(true);
                        }}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="แก้ไข"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteBankAccount(account.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="ลบ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Bank Account Modal */}
      {isAddModalOpen && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="เพิ่มบัญชีธนาคาร"
        >
          <AddBankAccountModal
            companies={companies}
            selectedCompanyId={selectedCompanyId}
            onSave={handleAddBankAccount}
            onCancel={() => setIsAddModalOpen(false)}
          />
        </Modal>
      )}

      {/* Edit Bank Account Modal */}
      {isEditModalOpen && editingBankAccount && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingBankAccount(null);
          }}
          title="แก้ไขบัญชีธนาคาร"
        >
          <EditBankAccountModal
            bankAccount={editingBankAccount}
            onSave={handleEditBankAccount}
            onCancel={() => {
              setIsEditModalOpen(false);
              setEditingBankAccount(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
};

interface AddBankAccountModalProps {
  companies: Company[];
  selectedCompanyId: number | null;
  onSave: (bankAccount: Omit<BankAccount, 'id'>) => void;
  onCancel: () => void;
}

const AddBankAccountModal: React.FC<AddBankAccountModalProps> = ({
  companies,
  selectedCompanyId,
  onSave,
  onCancel,
}) => {
  const [bank, setBank] = useState('');
  const [bankNumber, setBankNumber] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [companyId, setCompanyId] = useState<number | null>(selectedCompanyId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bank.trim() || !bankNumber.trim() || !companyId) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    onSave({
      bank: bank.trim(),
      bankNumber: bankNumber.trim(),
      companyId,
      isActive,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          บริษัท <span className="text-red-500">*</span>
        </label>
        <select
          value={companyId || ''}
          onChange={(e) => setCompanyId(Number(e.target.value) || null)}
          className="w-full border rounded-md px-3 py-2 text-sm"
          required
        >
          <option value="">เลือกบริษัท</option>
          {companies.map(company => (
            <option key={company.id} value={company.id}>{company.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          ชื่อธนาคาร <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={bank}
          onChange={(e) => setBank(e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm"
          placeholder="เช่น กรุงเทพ, กสิกรไทย, ไทยพาณิชย์"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          เลขบัญชี <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={bankNumber}
          onChange={(e) => setBankNumber(e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm"
          placeholder="กรอกเลขบัญชีธนาคาร"
          required
        />
      </div>
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm text-gray-700">ใช้งาน</span>
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50 transition-colors"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          บันทึก
        </button>
      </div>
    </form>
  );
};

interface EditBankAccountModalProps {
  bankAccount: BankAccount;
  onSave: (bankAccount: BankAccount) => void;
  onCancel: () => void;
}

const EditBankAccountModal: React.FC<EditBankAccountModalProps> = ({
  bankAccount,
  onSave,
  onCancel,
}) => {
  const [bank, setBank] = useState(bankAccount.bank);
  const [bankNumber, setBankNumber] = useState(bankAccount.bankNumber);
  const [isActive, setIsActive] = useState(bankAccount.isActive);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bank.trim() || !bankNumber.trim()) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    onSave({
      ...bankAccount,
      bank: bank.trim(),
      bankNumber: bankNumber.trim(),
      isActive,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          ชื่อธนาคาร <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={bank}
          onChange={(e) => setBank(e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm"
          placeholder="เช่น กรุงเทพ, กสิกรไทย, ไทยพาณิชย์"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          เลขบัญชี <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={bankNumber}
          onChange={(e) => setBankNumber(e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm"
          placeholder="กรอกเลขบัญชีธนาคาร"
          required
        />
      </div>
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm text-gray-700">ใช้งาน</span>
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50 transition-colors"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          บันทึก
        </button>
      </div>
    </form>
  );
};

export default BankAccountsManagementPage;

