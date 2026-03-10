import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Ban } from 'lucide-react';
import { getCancellationTypes, manageCancellationTypes } from '../services/api';

interface CancelConfirmModalProps {
  orderId: string;
  onConfirm: (orderId: string, cancellationTypeId: number, notes: string) => void;
  onClose: () => void;
}

const CancelConfirmModal: React.FC<CancelConfirmModalProps> = ({ orderId, onConfirm, onClose }) => {
  const [defaultTypeId, setDefaultTypeId] = useState<number>(0);
  const [defaultTypeLabel, setDefaultTypeLabel] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadDefault = async () => {
      try {
        // Fetch cancellation types and default setting
        const res = await manageCancellationTypes('GET');
        if (res?.status === 'success') {
          const types = res.data || [];
          const defId = res.default_cancellation_type_id;
          if (defId && types.length > 0) {
            const found = types.find((t: any) => t.id == defId);
            if (found) {
              setDefaultTypeId(Number(found.id));
              setDefaultTypeLabel(found.label);
            } else if (types.length > 0) {
              setDefaultTypeId(Number(types[0].id));
              setDefaultTypeLabel(types[0].label);
            }
          } else if (types.length > 0) {
            setDefaultTypeId(Number(types[0].id));
            setDefaultTypeLabel(types[0].label);
          }
        }
      } catch (err) {
        console.error('Failed to load default cancellation type:', err);
      } finally {
        setLoading(false);
      }
    };
    loadDefault();
  }, []);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(orderId, defaultTypeId, notes);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-[fadeIn_0.2s_ease-out]">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Ban className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">ยืนยันการยกเลิก</h3>
              <p className="text-white/80 text-xs">คำสั่งซื้อ #{orderId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              คุณต้องการยกเลิกคำสั่งซื้อนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้โดยอัตโนมัติ
            </p>
          </div>

          {/* Default type display (locked) */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              ประเภทการยกเลิก
            </label>
            {loading ? (
              <div className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-400 animate-pulse">
                กำลังโหลด...
              </div>
            ) : (
              <div className="w-full p-3 bg-orange-50 rounded-lg border border-orange-200 text-sm font-medium text-orange-800 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 bg-orange-200 rounded-full text-[10px] font-bold text-orange-700">
                  ✓
                </span>
                {defaultTypeLabel || 'ไม่พบค่าเริ่มต้น'}
                <span className="ml-auto text-[10px] bg-orange-200 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                  ค่าเริ่มต้น
                </span>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="mb-2">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              หมายเหตุการยกเลิก <span className="text-gray-400">(ไม่บังคับ)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ระบุเหตุผลในการยกเลิก..."
              rows={3}
              className="w-full p-3 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none transition-shadow"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting || loading || !defaultTypeId}
            className="px-5 py-2.5 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                กำลังดำเนินการ...
              </>
            ) : (
              <>
                <Ban className="w-4 h-4" />
                ยืนยันยกเลิกคำสั่งซื้อ
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelConfirmModal;
