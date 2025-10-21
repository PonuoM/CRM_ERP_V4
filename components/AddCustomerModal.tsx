


import React, { useState, useMemo } from 'react';
import { Customer, User, UserRole, CustomerLifecycleStatus, Address, CustomerBehavioralStatus, CustomerGrade } from '../types';
import Modal from './Modal';
import { User as UserIcon, MapPin, Briefcase, PlusCircle, Facebook, MessageSquare, ShoppingCart } from 'lucide-react';

interface AddCustomerModalProps {
  onSave: (customerData: Omit<Customer, 'id' | 'companyId' | 'totalPurchases' | 'totalCalls' | 'tags'> & { ownershipDays?: number }, andCreateOrder: boolean) => void;
  onClose: () => void;
  companyUsers: User[];
}

const emptyAddress: Address = { street: '', subdistrict: '', district: '', province: '', postalCode: '' };

const FormSection: React.FC<{ icon: React.ElementType, title: string, children: React.ReactNode }> = ({ icon: Icon, title, children }) => (
    <div className="border-t pt-4 first:border-t-0 first:pt-0">
        <h3 className="text-md font-semibold text-gray-700 mb-3 flex items-center">
            <Icon className="w-5 h-5 mr-2 text-gray-400" />
            {title}
        </h3>
        {children}
    </div>
);


const AddCustomerModal: React.FC<AddCustomerModalProps> = ({ onSave, onClose, companyUsers }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [facebookName, setFacebookName] = useState('');
  const [lineId, setLineId] = useState('');
  const [address, setAddress] = useState<Address>(emptyAddress);
  const [lifecycleStatus, setLifecycleStatus] = useState<CustomerLifecycleStatus>(CustomerLifecycleStatus.New);
  
  const [assignmentType, setAssignmentType] = useState<'basket' | 'agent'>('basket');
  const [assignedTo, setAssignedTo] = useState<number | null>(null);
  const [ownershipDays, setOwnershipDays] = useState<number>(30);

  const telesaleAgents = useMemo(() => {
    return companyUsers.filter(u => u.role === UserRole.Telesale || u.role === UserRole.Supervisor);
  }, [companyUsers]);

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length > 10) return;
    setPhone(value);

    if (value.length === 0) {
      setPhoneError('');
    } else if (value.length !== 10) {
      setPhoneError('เบอร์โทรต้องมี 10 หลัก');
    } else if (value[0] !== '0') {
      setPhoneError('เบอร์โทรต้องขึ้นต้นด้วย 0');
    } else {
      setPhoneError('');
    }
  };

  const handleSave = (andCreateOrder: boolean) => {
    if (!firstName.trim() || !phone.trim()) {
      alert('กรุณากรอกชื่อและเบอร์โทรศัพท์');
      return;
    }
    if (phoneError) {
      alert(`เบอร์โทรศัพท์ไม่ถูกต้อง: ${phoneError}`);
      return;
    }


    const finalAssignedTo = assignmentType === 'agent' ? assignedTo : null;
    if (assignmentType === 'agent' && !finalAssignedTo) {
        alert('กรุณาเลือกพนักงานที่จะมอบหมาย');
        return;
    }

    const customerData = {
      firstName,
      lastName,
      phone,
      facebookName,
      lineId,
      address,
      province: address.province,
      assignedTo: finalAssignedTo,
      lifecycleStatus,
      ownershipDays: assignmentType === 'agent' ? ownershipDays : 30,
      dateAssigned: '',
      ownershipExpires: '',
      behavioralStatus: CustomerBehavioralStatus.Warm,
      grade: CustomerGrade.D,
    };
    onSave(customerData, andCreateOrder);
  };

  const commonInputClass = "w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500";
  const commonSelectClass = "w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500";
  const commonLabelClass = "block text-sm font-medium text-gray-700 mb-1";


  return (
    <Modal 
      title="เพิ่มรายชื่อลูกค้าใหม่" 
      onClose={onClose}
      requireConfirmation={true}
      confirmationMessage="คุณต้องการปิดหน้าต่างนี้หรือไม่? ข้อมูลที่ยังไม่ได้บันทึกจะหายไป"
    >
      <div className="space-y-6 text-sm">
        
        <FormSection icon={UserIcon} title="ข้อมูลส่วนตัว">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className={commonLabelClass}>ชื่อ <span className="text-red-500">*</span></label>
                    <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className={commonInputClass} style={{ colorScheme: 'light' }} />
                </div>
                <div>
                    <label className={commonLabelClass}>นามสกุล</label>
                    <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className={commonInputClass} style={{ colorScheme: 'light' }} />
                </div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                    <label className={commonLabelClass}>เบอร์โทรศัพท์ <span className="text-red-500">*</span></label>
                    <input type="text" value={phone} onChange={handlePhoneChange} className={commonInputClass} style={{ colorScheme: 'light' }}/>
                    {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
                </div>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                    <label className={`${commonLabelClass} flex items-center`}><Facebook size={16} className="mr-2 text-blue-600"/> ชื่อ Facebook</label>
                    <input type="text" value={facebookName} onChange={e => setFacebookName(e.target.value)} className={commonInputClass} style={{ colorScheme: 'light' }}/>
                </div>
                <div>
                    <label className={`${commonLabelClass} flex items-center`}><MessageSquare size={16} className="mr-2 text-green-500"/> LINE ID</label>
                    <input type="text" value={lineId} onChange={e => setLineId(e.target.value)} className={commonInputClass} style={{ colorScheme: 'light' }}/>
                </div>
             </div>
        </FormSection>

        <FormSection icon={MapPin} title="ที่อยู่">
            <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className={commonLabelClass}>บ้านเลขที่, ถนน</label>
                        <input type="text" name="street" value={address.street} onChange={handleAddressChange} className={commonInputClass} style={{ colorScheme: 'light' }} />
                    </div>
                    <div>
                        <label className={commonLabelClass}>ตำบล/แขวง</label>
                        <input type="text" name="subdistrict" value={address.subdistrict} onChange={handleAddressChange} className={commonInputClass} style={{ colorScheme: 'light' }} />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label className={commonLabelClass}>อำเภอ/เขต</label>
                        <input type="text" name="district" value={address.district} onChange={handleAddressChange} className={commonInputClass} style={{ colorScheme: 'light' }} />
                    </div>
                    <div>
                        <label className={commonLabelClass}>จังหวัด</label>
                        <input type="text" name="province" value={address.province} onChange={handleAddressChange} className={commonInputClass} style={{ colorScheme: 'light' }} />
                    </div>
                    <div>
                        <label className={commonLabelClass}>รหัสไปรษณีย์</label>
                        <input type="text" name="postalCode" value={address.postalCode} onChange={handleAddressChange} className={commonInputClass} style={{ colorScheme: 'light' }} />
                    </div>
                </div>
            </div>
        </FormSection>
        
        <FormSection icon={Briefcase} title="การมอบหมายและสถานะ">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className={commonLabelClass}>สถานะลูกค้า</label>
                    <select value={lifecycleStatus} onChange={e => setLifecycleStatus(e.target.value as CustomerLifecycleStatus)} className={commonSelectClass} style={{ colorScheme: 'light' }}>
                        {Object.values(CustomerLifecycleStatus).map(s => <option key={s} value={s} className="text-black">{s}</option>)}
                    </select>
                </div>
                <div>
                    <label className={commonLabelClass}>ตำแหน่งที่จัดเก็บ</label>
                    <div className="flex space-x-4 pt-2">
                        <div className="flex items-center">
                            <input type="radio" id="assign-basket" name="assignment" value="basket" checked={assignmentType === 'basket'} onChange={() => setAssignmentType('basket')} className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300" />
                            <label htmlFor="assign-basket" className="ml-2 text-gray-900">ตระกร้าแจก</label>
                        </div>
                        <div className="flex items-center">
                            <input type="radio" id="assign-agent" name="assignment" value="agent" checked={assignmentType === 'agent'} onChange={() => setAssignmentType('agent')} className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300" />
                            <label htmlFor="assign-agent" className="ml-2 text-gray-900">มอบหมายให้พนักงาน</label>
                        </div>
                    </div>
                </div>
             </div>
             {assignmentType === 'agent' && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 bg-gray-50 rounded-md border">
                    <div>
                        <label className={commonLabelClass}>เลือกพนักงาน</label>
                        <select onChange={e => setAssignedTo(Number(e.target.value))} className={commonSelectClass} defaultValue="" style={{ colorScheme: 'light' }}>
                            <option value="" disabled className="text-gray-500">-- เลือกพนักงาน --</option>
                            {telesaleAgents.map(agent => <option key={agent.id} value={agent.id} className="text-black">{`${agent.firstName} ${agent.lastName}`}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={commonLabelClass}>กำหนดวันคงเหลือ (วัน)</label>
                        <input type="number" min="1" value={ownershipDays} onChange={e => setOwnershipDays(Number(e.target.value))} className={commonInputClass} style={{ colorScheme: 'light' }} />
                    </div>
                 </div>
             )}
        </FormSection>
      </div>
      <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
        <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold">ยกเลิก</button>
        <button onClick={() => handleSave(false)} disabled={!!phoneError} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 flex items-center disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed">
            <PlusCircle size={16} className="mr-2"/>
            บันทึกข้อมูล
        </button>
         <button onClick={() => handleSave(true)} disabled={!!phoneError} className="px-4 py-2 bg-green-100 text-green-700 font-semibold rounded-lg hover:bg-green-200 flex items-center disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed">
            <ShoppingCart size={16} className="mr-2"/>
            บันทึกและสร้างออเดอร์
        </button>
      </div>
    </Modal>
  );
};

export default AddCustomerModal;