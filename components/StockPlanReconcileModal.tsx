import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, PackageCheck } from 'lucide-react';
import { User } from '@/types';
import { recordStockPlanActual } from '@/services/api';
import { StockPlanExpectation } from '@/pages/StockArrivalPlanningPage';

interface StockPlanReconcileModalProps {
  expectation: StockPlanExpectation;
  currentUser?: User;
  onClose: () => void;
  onSaved: () => void;
}

const StockPlanReconcileModal: React.FC<StockPlanReconcileModalProps> = ({ expectation, currentUser, onClose, onSaved }) => {
  const [actualDate, setActualDate] = useState(expectation.expected_date.slice(0, 10));
  const [actualQty, setActualQty] = useState<number | ''>(expectation.expected_qty);
  const [decision, setDecision] = useState<'reschedule' | 'close_short' | null>(null);
  const [newDate, setNewDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const diff = (actualQty === '' ? 0 : actualQty) - expectation.expected_qty;
  const isMismatchShort = diff < 0;

  const label = useMemo(() => {
    if (diff === 0) return { text: 'ตรงตามที่คาดไว้', className: 'text-green-600' };
    if (diff > 0) return { text: `เกินที่คาดไว้ ${diff} ชิ้น`, className: 'text-blue-600' };
    return { text: `ขาดจากที่คาดไว้ ${Math.abs(diff)} ชิ้น`, className: 'text-red-600' };
  }, [diff]);

  const handleSubmit = async () => {
    setError(null);

    if (actualQty === '' || actualQty < 0) {
      setError('กรุณาระบุจำนวนจริงที่เข้า');
      return;
    }
    if (!actualDate) {
      setError('กรุณาระบุวันที่เข้าจริง');
      return;
    }
    if (isMismatchShort) {
      if (!decision) {
        setError('กรุณาเลือกว่าจะ "เลื่อนวันที่ (จำนวนที่เหลือ)" หรือ "ปิดเคส (ไม่มีมาส่งเพิ่มแล้ว)"');
        return;
      }
      if (decision === 'reschedule' && !newDate) {
        setError('กรุณาระบุวันที่คาดว่าจะเข้าใหม่ สำหรับจำนวนที่เหลือ');
        return;
      }
      if (decision === 'close_short' && !note.trim()) {
        setError('กรุณาระบุหมายเหตุก่อนปิดเคส');
        return;
      }
    }

    setSaving(true);
    try {
      await recordStockPlanActual({
        expectation_id: expectation.id,
        actual_qty: Number(actualQty),
        actual_date: actualDate,
        decision: isMismatchShort ? decision! : undefined,
        new_date: decision === 'reschedule' ? newDate : undefined,
        note: note || undefined,
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
            <PackageCheck className="text-blue-600" size={20} />
            ยืนยันรับเข้า
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-200">
            <X size={20} />
          </button>
        </header>

        <div className="p-4 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <div className="font-medium text-gray-800">{expectation.item.sku} {expectation.item.product_name}</div>
            <div className="text-gray-500">คาดว่าจะเข้า {expectation.expected_date.slice(0, 10)} · จำนวน {expectation.expected_qty} ชิ้น</div>
          </div>

          {error && <div className="bg-red-50 border-l-4 border-red-400 p-3 text-sm text-red-700">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">วันที่เข้าจริง</label>
              <input
                type="date"
                value={actualDate}
                onChange={e => setActualDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">จำนวนที่เข้าจริง</label>
              <input
                type="text"
                inputMode="numeric"
                value={actualQty}
                onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '');
                  setActualQty(digits === '' ? '' : parseInt(digits, 10));
                }}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          <p className={`text-sm font-medium ${label.className}`}>{label.text}</p>

          {isMismatchShort && (
            <div className="border rounded-lg p-3 bg-yellow-50 space-y-3">
              <p className="text-sm font-medium text-gray-700">จำนวนไม่ครบ กรุณาเลือกดำเนินการกับส่วนที่เหลือ ({Math.abs(diff)} ชิ้น):</p>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="decision" checked={decision === 'reschedule'} onChange={() => setDecision('reschedule')} />
                  เลื่อนวันที่คาดว่าจะเข้า
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="decision" checked={decision === 'close_short'} onChange={() => setDecision('close_short')} />
                  ไม่มีมาส่งเพิ่มแล้ว (ปิดเคส)
                </label>
              </div>

              {decision === 'reschedule' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">วันที่คาดว่าจะเข้าใหม่ (สำหรับ {Math.abs(diff)} ชิ้น)</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              หมายเหตุ {decision === 'close_short' ? <span className="text-red-500">*จำเป็น</span> : '(ถ้ามี)'}
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="เหตุผลที่ไม่ครบ / รายละเอียดเพิ่มเติม"
            />
          </div>
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
            {saving ? 'กำลังบันทึก...' : 'ยืนยัน'}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
};

export default StockPlanReconcileModal;
