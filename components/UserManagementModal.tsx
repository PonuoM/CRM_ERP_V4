import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, Company } from '../types';
// FIX: Import 'PlusCircle' icon from 'lucide-react'.
import { ArrowLeft, Edit, User as UserIcon, Lock, Contact, Mail, Phone, Users as UsersIcon, Building, UserCheck, X, CheckSquare, PlusCircle } from 'lucide-react';

interface UserManagementModalProps {
  user?: User;
  onSave: (user: Omit<User, 'id' | 'customTags'> | User) => void;
  onClose: () => void;
  currentUser: User;
  allUsers: User[];
  allCompanies: Company[];
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


const UserManagementModal: React.FC<UserManagementModalProps> = (props) => {
  const { user, onSave, onClose, currentUser, allUsers, allCompanies } = props;
  
  const [formData, setFormData] = useState({
      username: '',
      password: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      role: UserRole.Telesale,
      companyId: currentUser.companyId,
      supervisorId: '',
  });

  const isSuperAdmin = currentUser.role === UserRole.SuperAdmin;

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username,
        password: '', // Don't pre-fill password for security
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email || '',
        phone: user.phone || '',
        role: user.role,
        companyId: user.companyId,
        supervisorId: user.supervisorId?.toString() || '',
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({...prev, [name]: value}));
  }

  const supervisors = useMemo(() => {
    return allUsers.filter(u => u.role === UserRole.Supervisor && u.companyId === formData.companyId);
  }, [allUsers, formData.companyId]);


  const handleSave = () => {
    if(!formData.username || !formData.firstName || !formData.lastName || !formData.role) {
        alert('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
        return;
    }
    if(!user && !formData.password) { // Require password for new users
        alert('กรุณากรอกรหัสผ่านสำหรับผู้ใช้ใหม่');
        return;
    }

    const userToSave: Omit<User, 'id' | 'customTags'> = {
        username: formData.username,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        role: formData.role,
        companyId: isSuperAdmin ? formData.companyId : currentUser.companyId,
        supervisorId: formData.supervisorId ? parseInt(formData.supervisorId) : undefined,
    };
    
    if (user) {
        onSave({ ...user, ...userToSave, password: formData.password || user.password });
    } else {
        onSave(userToSave);
    }
  };

  const title = user ? `แก้ไขผู้ใช้: ${user.firstName}` : 'สร้างผู้ใช้ใหม่';
  const buttonLabel = user ? 'บันทึกการเปลี่ยนแปลง' : 'สร้างผู้ใช้';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4">
      <div className="bg-[#F9FAFB] rounded-lg shadow-xl w-full max-w-4xl h-full max-h-[95vh] flex flex-col">
        <header className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center"><PlusCircle className="mr-3 text-gray-600"/>{title}</h2>
          <button onClick={onClose} className="bg-gray-200 text-gray-700 font-semibold text-sm rounded-md py-2 px-4 flex items-center hover:bg-gray-300">
             <ArrowLeft size={16} className="mr-2"/>
             กลับไปรายการผู้ใช้
          </button>
        </header>

        <main className="flex-grow overflow-y-auto p-6">
            <div className="bg-white p-6 rounded-lg shadow-md border">
                <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center"><Edit size={18} className="mr-3 text-gray-500"/>ข้อมูลผู้ใช้ใหม่</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <FormField label="ชื่อผู้ใช้" required hint="ชื่อผู้ใช้สำหรับเข้าระบบ (ไม่ซ้ำกับผู้อื่น)" icon={UserIcon}>
                        <input type="text" name="username" value={formData.username} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-black" />
                    </FormField>
                    <FormField label="รหัสผ่าน" required={!user} hint="รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" icon={Lock}>
                        <input type="password" name="password" value={formData.password} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-black" placeholder={user ? 'ปล่อยว่างไว้หากไม่ต้องการเปลี่ยน' : ''} />
                    </FormField>
                    <FormField label="ชื่อ-นามสกุล" required icon={Contact}>
                        <div className="flex gap-4">
                            <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-black" placeholder="ชื่อจริง"/>
                            <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-black" placeholder="นามสกุล"/>
                        </div>
                    </FormField>
                    <FormField label="อีเมล" icon={Mail}>
                        <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-black" />
                    </FormField>
                    <FormField label="เบอร์โทรศัพท์" icon={Phone}>
                         <input type="text" name="phone" value={formData.phone} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-black" />
                    </FormField>
                    <FormField label="บทบาท" required icon={UsersIcon}>
                        <select name="role" value={formData.role} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-black">
                           {Object.values(UserRole).filter(r => isSuperAdmin || r !== UserRole.SuperAdmin).map(r => <option key={r} value={r} className="text-black">{r}</option>)}
                        </select>
                    </FormField>
                    {isSuperAdmin && (
                        <FormField label="บริษัท" icon={Building}>
                             <select name="companyId" value={formData.companyId} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-black">
                                {allCompanies.map(c => <option key={c.id} value={c.id} className="text-black">{c.name}</option>)}
                            </select>
                        </FormField>
                    )}
                    {formData.role === UserRole.Telesale && (
                        <FormField label="หัวหน้าทีม" icon={UserCheck}>
                             <select name="supervisorId" value={formData.supervisorId} onChange={handleChange} className="w-full p-2 border rounded-md bg-white text-black">
                                <option value="" className="text-black">ไม่มี</option>
                                {supervisors.map(s => <option key={s.id} value={s.id} className="text-black">{s.firstName} {s.lastName}</option>)}
                            </select>
                        </FormField>
                    )}
                </div>
            </div>
        </main>

        <footer className="flex justify-end space-x-3 p-4 border-t bg-gray-50 flex-shrink-0">
            <button onClick={onClose} className="px-5 py-2.5 bg-white border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-100 font-semibold flex items-center">
                <X size={16} className="mr-2"/>
                ยกเลิก
            </button>
            <button onClick={handleSave} className="px-5 py-2.5 bg-[#2E7D32] text-white rounded-lg hover:bg-green-800 font-semibold flex items-center">
                <CheckSquare size={16} className="mr-2"/>
                {buttonLabel}
            </button>
        </footer>
      </div>
    </div>
  );
};

export default UserManagementModal;