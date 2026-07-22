import React, { useState } from 'react';
import Modal from './Modal';
import { Download } from 'lucide-react';

export type CallStatsCategory = 'held' | 'not_called' | 'called_no_appt' | 'called_and_appt' | 'appt_no_call';
export type UserFilterType = 'active_only' | 'active_and_inactive_with_customers' | 'all';

export const PREDEFINED_BASKETS = [
    'Upsell',
    'ลูกค้าใหม่',
    'ส่วนตัว 1-2 เดือน',
    'ส่วนตัวโอกาสสุดท้าย',
    'หาคนดูแลใหม่',
    'รอคนมาจีบให้ติด',
    'ถังกลาง 6-9 เดือน',
    'ถังกลาง 9-12 เดือน',
    'ถังกลาง 1-3 ปี'
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedOptions: Record<CallStatsCategory, boolean>, userFilter: UserFilterType, selectedBaskets: string[]) => void;
  isExporting?: boolean;
}

const ExportCallStatsModal: React.FC<Props> = ({ isOpen, onClose, onConfirm, isExporting = false }) => {
  const [options, setOptions] = useState<Record<CallStatsCategory, boolean>>({
    held: true,
    not_called: true,
    called_no_appt: true,
    called_and_appt: true,
    appt_no_call: true
  });
  
  const [userFilter, setUserFilter] = useState<UserFilterType>('active_and_inactive_with_customers');
  const [selectedBaskets, setSelectedBaskets] = useState<string[]>([...PREDEFINED_BASKETS, 'อื่นๆ']);

  if (!isOpen) return null;

  const handleToggle = (key: CallStatsCategory) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleBasket = (basket: string) => {
    setSelectedBaskets(prev => prev.includes(basket) ? prev.filter(b => b !== basket) : [...prev, basket]);
  };

  const hasSelection = Object.values(options).some(v => v);
  const hasBasketSelection = selectedBaskets.length > 0;

  return (
    <Modal onClose={onClose} title="เลือกข้อมูลที่ต้องการ Export">
      <div className="p-4 space-y-4">
        <div className="space-y-4">
          <div>
            <p className="font-semibold text-gray-800 mb-2">1. เลือกกลุ่มพนักงาน (แถว)</p>
            <div className="space-y-2 pl-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="radio" name="userFilter" value="active_only" checked={userFilter === 'active_only'} onChange={() => setUserFilter('active_only')} className="w-4 h-4 text-orange-600" />
                <span className="text-gray-700 text-sm">เฉพาะ Active (พนักงานที่ยังทำงานอยู่)</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="radio" name="userFilter" value="active_and_inactive_with_customers" checked={userFilter === 'active_and_inactive_with_customers'} onChange={() => setUserFilter('active_and_inactive_with_customers')} className="w-4 h-4 text-orange-600" />
                <span className="text-gray-700 text-sm">รวม Active + Inactive (เฉพาะคนที่มีรายชื่อลูกค้า)</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="radio" name="userFilter" value="all" checked={userFilter === 'all'} onChange={() => setUserFilter('all')} className="w-4 h-4 text-orange-600" />
                <span className="text-gray-700 text-sm">ทุกคน (แสดงหมดแม้จะไม่มีรายชื่อ)</span>
              </label>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="font-semibold text-gray-800 mb-2">2. เลือกประเภทสถานะการโทร (คอลัมน์)</p>
            <div className="space-y-2 pl-2">
          <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
            <input type="checkbox" checked={options.held} onChange={() => handleToggle('held')} className="w-5 h-5 text-orange-600 rounded" />
            <span className="font-medium text-gray-700">ในมือ (Total Held)</span>
          </label>
          <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
            <input type="checkbox" checked={options.not_called} onChange={() => handleToggle('not_called')} className="w-5 h-5 text-orange-600 rounded" />
            <span className="font-medium text-gray-700">ยังไม่โทร</span>
          </label>
          <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
            <input type="checkbox" checked={options.called_no_appt} onChange={() => handleToggle('called_no_appt')} className="w-5 h-5 text-orange-600 rounded" />
            <span className="font-medium text-gray-700">โทรแล้วไม่นัดหมาย</span>
          </label>
          <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
            <input type="checkbox" checked={options.called_and_appt} onChange={() => handleToggle('called_and_appt')} className="w-5 h-5 text-orange-600 rounded" />
            <span className="font-medium text-gray-700">โทรแล้วนัดหมาย</span>
          </label>
          <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
            <input type="checkbox" checked={options.appt_no_call} onChange={() => handleToggle('appt_no_call')} className="w-5 h-5 text-orange-600 rounded" />
            <span className="font-medium text-gray-700">นัดหมายแล้วไม่มีโทร</span>
          </label>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="font-semibold text-gray-800 mb-2">3. เลือกถัง (Buckets) ที่ต้องการส่งออกและรวมยอด</p>
            <div className="grid grid-cols-2 gap-2 pl-2">
              {[...PREDEFINED_BASKETS, 'อื่นๆ'].map(b => (
                <label key={b} className="flex items-center gap-3 p-2 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                  <input type="checkbox" checked={selectedBaskets.includes(b)} onChange={() => toggleBasket(b)} className="w-4 h-4 text-orange-600 rounded" />
                  <span className="font-medium text-gray-700 text-sm">{b}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 border-t pt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors" disabled={isExporting}>
            ยกเลิก
          </button>
          <button
            onClick={() => onConfirm(options, userFilter, selectedBaskets)}
            disabled={isExporting || !hasSelection || !hasBasketSelection}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 border border-transparent rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                กำลังเตรียมไฟล์...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Download size={16} />
                ดาวน์โหลด
              </span>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
export default ExportCallStatsModal;

