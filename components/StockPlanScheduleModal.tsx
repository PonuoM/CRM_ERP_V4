import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CalendarPlus } from 'lucide-react';
import { User } from '@/types';
import { addStockPlanExpectation } from '@/services/api';
import { PendingStockPlanRow } from '@/pages/StockArrivalPlanningPage';

interface StockPlanScheduleModalProps {
  pending: PendingStockPlanRow;
  currentUser?: User;
  onClose: () => void;
  onSaved: () => void;
}

const StockPlanScheduleModal: React.FC<StockPlanScheduleModalProps> = ({ pending, currentUser, onClose, onSaved }) => {
  const [expectedDate, setExpectedDate] = useState(pending.plan.planned_date.slice(0, 10));
  const [expectedQty, setExpectedQty] = useState<number | ''>(pending.remaining_qty);
  const [soNumber, setSoNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!expectedDate) {
      setError('กรุณาระบุวันที่คาดว่าจะเข้า');
      return;
    }
    if (!expectedQty || expectedQty <= 0 || expectedQty > pending.remaining_qty) {
      setError(`จำนวนต้องมากกว่า 0 และไม่เกินจำนวนที่เหลือ (${pending.remaining_qty})`);
      return;
    }

    setSaving(true);
    try {
      await addStockPlanExpectation({
        item_id: pending.item.id,
        expected_qty: Number(expectedQty),
        expected_date: expectedDate,
        so_number: soNumber || undefined,
        user_id: currentUser?.id,
      });
      onSaved();
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col">
        <header className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <CalendarPlus className="text-blue-600" size={20} />
            กำหนดวันที่คาดว่าจะเข้า
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-200">
            <X size={20} />
          </button>
        </header>

        <div className="p-4 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <div className="font-medium text-gray-800">{pending.item.sku} {pending.item.product_name}</div>
            <div className="text-gray-500">แพลนรวม {pending.item.planned_qty} · ยังไม่กำหนดวันที่ {pending.remaining_qty} ชิ้น</div>
          </div>

          {error && <div className="bg-red-50 border-l-4 border-red-400 p-3 text-sm text-red-700">{error}</div>}

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">เลข SO (ถ้ามี)</label>
            <input
              type="text"
              value={soNumber}
              onChange={e => setSoNumber(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="เลข SO ที่เปิดไว้"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">วันที่คาดว่าจะเข้า</label>
              <input
                type="date"
                value={expectedDate}
                onChange={e => setExpectedDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">จำนวน</label>
              <input
                type="text"
                inputMode="numeric"
                value={expectedQty}
                onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '');
                  setExpectedQty(digits === '' ? '' : parseInt(digits, 10));
                }}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400">
            ถ้าจำนวนที่กำหนดน้อยกว่าที่เหลือ ({pending.remaining_qty}) ส่วนที่เหลือจะยังคงค้างไว้ให้กำหนดวันที่เพิ่มได้อีกภายหลัง
          </p>
        </div>

        <footer className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="bg-white border border-gray-300 text-gray-700 font-medium text-sm rounded-lg py-2.5 px-5 hover:bg-gray-50">
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-blue-600 text-white font-medium text-sm rounded-lg py-2.5 px-6 hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
};

export default StockPlanScheduleModal;
