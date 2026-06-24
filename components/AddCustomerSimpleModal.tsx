import React, { useEffect, useRef, useState } from 'react';
import { createCustomer, checkCustomerDuplicate, DuplicateCustomerMatch } from '@/services/api';

interface AddCustomerSimpleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: number;
}

type DupState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'clear' }
  | { status: 'found'; matches: DuplicateCustomerMatch[] }
  | { status: 'error'; message: string };

const AddCustomerSimpleModal: React.FC<AddCustomerSimpleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
}) => {
  const [newCustomer, setNewCustomer] = useState({ firstName: '', lastName: '', phone: '' });
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [dup, setDup] = useState<DupState>({ status: 'idle' });
  const dupReqIdRef = useRef(0);

  // Debounced duplicate check: triggers when phone has >= 9 digits
  useEffect(() => {
    if (!isOpen) return;
    const digits = newCustomer.phone.replace(/\D/g, '');
    const core = digits.replace(/^0+/, '');
    if (core.length < 9) {
      setDup({ status: 'idle' });
      return;
    }
    setDup({ status: 'checking' });
    const myReqId = ++dupReqIdRef.current;
    const timer = window.setTimeout(async () => {
      try {
        const res = await checkCustomerDuplicate({ phone: newCustomer.phone, companyId });
        if (myReqId !== dupReqIdRef.current) return; // outdated response
        const matches = res?.matches || [];
        setDup(matches.length > 0 ? { status: 'found', matches } : { status: 'clear' });
      } catch (e: any) {
        if (myReqId !== dupReqIdRef.current) return;
        setDup({ status: 'error', message: e?.message || 'เช็คเบอร์ซ้ำไม่สำเร็จ' });
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [newCustomer.phone, companyId, isOpen]);

  // Reset state every time modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setNewCustomer({ firstName: '', lastName: '', phone: '' });
      setDup({ status: 'idle' });
      setIsCreatingCustomer(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!newCustomer.firstName || !newCustomer.phone) {
      alert('กรุณากรอกชื่อและเบอร์โทรศัพท์');
      return;
    }
    if (newCustomer.phone.length < 9) {
      alert('เบอร์โทรศัพท์ต้องมีอย่างน้อย 9 หลัก');
      return;
    }
    // Block creation entirely when a duplicate exists
    if (dup.status === 'found') {
      const first = dup.matches[0];
      const name = `${first.first_name ?? ''} ${first.last_name ?? ''}`.trim() || '(ไม่มีชื่อ)';
      const caretaker = first.assigned_to_name || 'ไม่มีผู้ดูแล';
      alert(`เบอร์นี้มีในระบบแล้ว: ${name}\nผู้ดูแล: ${caretaker}\n\nไม่สามารถบันทึกซ้ำได้`);
      return;
    }
    if (dup.status === 'checking') {
      alert('กำลังตรวจสอบเบอร์ซ้ำ กรุณารอสักครู่');
      return;
    }
    setIsCreatingCustomer(true);
    try {
      await createCustomer({
        firstName: newCustomer.firstName,
        lastName: newCustomer.lastName,
        phone: newCustomer.phone,
        companyId: companyId,
        lifecycleStatus: 'New',
        behavioralStatus: 'Warm',
        grade: 'D',
      });
      onSuccess();
      onClose();
      setNewCustomer({ firstName: '', lastName: '', phone: '' });
      setDup({ status: 'idle' });
    } catch (error: any) {
      console.error('Error creating customer:', error);
      // Surface server-side duplicate phone messaging if present
      const apiMsg = error?.data?.message || error?.message;
      alert(apiMsg ? `ไม่สามารถเพิ่มลูกค้าได้: ${apiMsg}` : 'ไม่สามารถเพิ่มลูกค้าได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  const renderDupBanner = () => {
    if (dup.status === 'checking') {
      return (
        <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />
          กำลังตรวจสอบเบอร์ซ้ำในระบบ...
        </div>
      );
    }
    if (dup.status === 'clear') {
      return (
        <div className="mt-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
          ✅ ไม่พบเบอร์นี้ในระบบ — สามารถเพิ่มเป็นลูกค้าใหม่ได้
        </div>
      );
    }
    if (dup.status === 'error') {
      return (
        <div className="mt-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
          ⚠️ ตรวจสอบเบอร์ซ้ำไม่สำเร็จ: {dup.message}
        </div>
      );
    }
    if (dup.status === 'found') {
      return (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 space-y-1">
          <div className="font-medium">
            🚨 พบเบอร์นี้ในระบบแล้ว ({dup.matches.length} รายการ)
          </div>
          <ul className="space-y-1">
            {dup.matches.map((m, idx) => {
              const name = `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || '(ไม่มีชื่อ)';
              const caretaker = m.assigned_to_name || 'ไม่มีผู้ดูแล';
              const fieldLabel =
                m.matched_field === 'backup_phone' ? 'เบอร์สำรอง' : 'เบอร์หลัก';
              return (
                <li key={`${m.customer_id}-${idx}`} className="leading-snug">
                  • <span className="font-medium">{name}</span>
                  {' '}<span className="text-red-600">({fieldLabel}: {m.phone || m.backup_phone || '-'})</span>
                  <br />
                  <span className="ml-3 text-red-700">
                    ผู้ดูแล: <span className="font-medium">{caretaker}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg overflow-hidden shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">เพิ่มลูกค้าใหม่</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={newCustomer.firstName}
              onChange={e => setNewCustomer({ ...newCustomer, firstName: e.target.value })}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 border-gray-300"
              placeholder="ชื่อ"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">นามสกุล</label>
            <input
              type="text"
              value={newCustomer.lastName}
              onChange={e => setNewCustomer({ ...newCustomer, lastName: e.target.value })}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 border-gray-300"
              placeholder="นามสกุล"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรศัพท์ <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={newCustomer.phone}
              onChange={e => {
                const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                setNewCustomer({ ...newCustomer, phone: val });
              }}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 ${
                dup.status === 'found'
                  ? 'border-red-400 focus:ring-red-500'
                  : dup.status === 'clear'
                  ? 'border-green-400 focus:ring-green-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              placeholder="เบอร์โทรศัพท์ (10 หลัก)"
            />
            {renderDupBanner()}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border text-gray-700 rounded-md hover:bg-gray-50 font-medium text-sm"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            disabled={
              isCreatingCustomer ||
              dup.status === 'checking' ||
              dup.status === 'found'
            }
            className={`px-4 py-2 text-white rounded-md font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
              dup.status === 'found'
                ? 'bg-red-400'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
            title={
              dup.status === 'found'
                ? 'พบเบอร์ซ้ำในระบบ ไม่สามารถบันทึกได้'
                : dup.status === 'checking'
                ? 'กำลังตรวจสอบเบอร์ซ้ำ...'
                : ''
            }
          >
            {isCreatingCustomer
              ? 'กำลังบันทึก...'
              : dup.status === 'found'
              ? 'มีเบอร์นี้ในระบบแล้ว'
              : 'บันทึกข้อมูล'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddCustomerSimpleModal;
