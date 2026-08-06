import React, { useState } from 'react';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { StockPlanNote, noteStamp } from './types';

interface StockPlanNotesProps {
  planId: number;
  notes: StockPlanNote[];
  /** เพิ่มหมายเหตุได้หรือไม่ (สิทธิ์จัดการ) */
  canAdd: boolean;
  /** id ของผู้ใช้ปัจจุบัน — ใช้ตัดสินว่าลบหมายเหตุของตัวเองได้ */
  currentUserId?: number;
  /** Super Admin ลบของคนอื่นได้ในกรณีฉุกเฉิน */
  isSuperAdmin?: boolean;
  onAdd: (planId: number, note: string) => Promise<void>;
  onDelete: (noteId: number) => Promise<void>;
}

const StockPlanNotes: React.FC<StockPlanNotesProps> = ({
  planId,
  notes,
  canAdd,
  currentUserId,
  isSuperAdmin,
  onAdd,
  onDelete,
}) => {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const submit = async () => {
    const text = draft.trim();
    if (!text || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onAdd(planId, text);
      setDraft('');
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (noteId: number) => {
    if (!confirm('ลบหมายเหตุนี้ใช่หรือไม่?')) return;
    setDeletingId(noteId);
    setError(null);
    try {
      await onDelete(noteId);
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'ลบไม่สำเร็จ');
    } finally {
      setDeletingId(null);
    }
  };

  // ไม่มีหมายเหตุและเพิ่มไม่ได้ -> ไม่ต้องรกแถบข้าง
  if (notes.length === 0 && !canAdd) return null;

  return (
    <div className="bg-gray-50/70 border-t px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 mb-2">
        <MessageSquare size={12} /> หมายเหตุ ({notes.length})
      </div>

      {notes.length > 0 && (
        <ol className="space-y-2 mb-2">
          {notes.map((n, idx) => {
            const canDelete = (!!currentUserId && n.created_by === currentUserId) || !!isSuperAdmin;
            return (
              <li key={n.id} className="relative pl-4 group">
                <span className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full bg-blue-400" />
                {idx < notes.length - 1 && (
                  <span className="absolute left-[2.5px] top-3.5 bottom-[-8px] w-px bg-gray-200" />
                )}
                <div className="flex items-start gap-1.5">
                  <p className="flex-1 text-xs text-gray-700 whitespace-pre-wrap break-words">{n.note}</p>
                  {canDelete && (
                    <button
                      onClick={() => remove(n.id)}
                      disabled={deletingId === n.id}
                      className="shrink-0 text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:opacity-50"
                      title="ลบหมายเหตุ (ลบได้เฉพาะของตัวเอง)"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {n.created_by_name || 'ไม่ทราบผู้บันทึก'} · {noteStamp(n.created_at)}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {canAdd && (
        <div className="flex items-end gap-1.5">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              // Enter = บันทึก, Shift+Enter = ขึ้นบรรทัดใหม่
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="เพิ่มหมายเหตุ เช่น ของกำลังออกแล้ว / ติดกรมศุลกากร"
            className="flex-1 border rounded-lg px-2 py-1.5 text-xs resize-y focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          />
          <button
            onClick={submit}
            disabled={saving || draft.trim() === ''}
            className="shrink-0 bg-blue-600 text-white rounded-lg p-2 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            title="บันทึกหมายเหตุ (Enter)"
          >
            {saving ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={13} />}
          </button>
        </div>
      )}

      {error && <p className="text-[11px] text-red-600 mt-1.5">{error}</p>}
    </div>
  );
};

export default StockPlanNotes;
