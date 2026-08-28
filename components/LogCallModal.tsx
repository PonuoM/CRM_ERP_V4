import React, { useState, useEffect } from 'react';
import { Customer, User, CallHistory, Tag, TagType } from '../types';
import Modal from './Modal';
import { Plus, X, Info } from 'lucide-react';
import TagSelectionModal from './TagSelectionModal';
import FarmPlotEditor, { PlotDraft, makeEmptyPlot, plotsToDrafts } from './FarmPlotEditor';
import CallCustomerButton from './CallCustomerButton';
import { getCustomerPlots, saveCustomerPlots } from '../services/api';

/**
 * One labelled field.
 *
 * The label row is a fixed height and carries at most a short phrase; anything longer goes into the
 * tooltip. Two fields side by side used to fall out of line whenever one label wrapped to a second
 * line, which is what made this form look untidy no matter how the inputs were styled.
 */
const Field: React.FC<{
  label: string;
  hint?: string;
  required?: boolean;
  accent?: string;
  children: React.ReactNode;
}> = ({ label, hint, required, accent, children }) => (
  <div className="flex flex-col">
    <div className="flex h-6 items-center gap-1">
      <label className="font-medium text-gray-700">{label}</label>
      {required && <span className="text-red-500">*</span>}
      {accent && <span className="text-xs font-normal text-green-700">{accent}</span>}
      {hint && (
        <span title={hint} className="cursor-help text-gray-400 hover:text-gray-600" aria-label={hint}>
          <Info size={14} />
        </span>
      )}
    </div>
    {children}
  </div>
);

// Helper function to get contrasting text color (black or white)
const getContrastColor = (hexColor: string): string => {
  // Remove # if present
  const color = hexColor.replace('#', '');
  // Convert to RGB
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);
  // Calculate brightness
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  // Return black or white based on brightness
  return brightness > 128 ? '#000000' : '#FFFFFF';
};

/** What the handset reported about a call that has just finished. */
export interface CompletedCall {
  /** Seconds actually spent talking, measured from answer to hang-up. */
  durationSec: number;
  /** False when nobody picked up — the statuses that claim a conversation are then untruthful. */
  answered: boolean;
}

interface LogCallModalProps {
  customer: Customer;
  user: User;
  systemTags: Tag[];
  /**
   * Present when this form was opened by hanging up a call the CRM placed.
   *
   * The duration then comes from the radio instead of from memory, and the statuses that assert a
   * conversation are refused on a call nobody answered — a telesale cannot log "ได้คุย" on a phone
   * that rang out, which is exactly the number every report downstream depends on.
   */
  completedCall?: CompletedCall;
  // FIX: Change customerId type from number to string to match the Customer type.
  onSave: (callLog: Omit<CallHistory, 'id'>, customerId: string, newFollowUpDate?: string, newTags?: Tag[]) => Promise<void>;
  onCreateUserTag: (tagName: string) => Promise<Tag | null>;
  onClose: () => void;
}

const callStatusOptions = ['รับสาย', 'ได้คุย', 'ไม่รับสาย', 'สายไม่ว่าง', 'ติดสายซ้อน', 'ไม่มีสัญญาณ', 'ตัดสายทิ้ง'];
const conversationResultOptions = ['สินค้ายังไม่หมด', 'ใช้แล้วไม่เห็นผล', 'ยังไม่ได้ลองใช้', 'ยังไม่ถึงรอบใช้งาน', 'สั่งช่องทางอื่นแล้ว', 'ไม่สะดวกคุย', 'ติดสายซ้อน', 'ฝากส่งไม่ได้ใช้เอง', 'คนอื่นรับสายแทน', 'เลิกทำสวน', 'ไม่สนใจ', 'ห้ามติดต่อ', 'ได้คุย', 'ขายได้', 'ตัดสายทิ้ง'];
const nonConversationResultOptions = ['ไม่รับสาย', 'สายไม่ว่าง', 'ติดสายซ้อน', 'ไม่มีสัญญาณ', 'ตัดสายทิ้ง'];
const allCallResultOptions = [...new Set([...conversationResultOptions, ...nonConversationResultOptions])];


const LogCallModal: React.FC<LogCallModalProps> = ({ customer, user, systemTags, completedCall, onSave, onCreateUserTag, onClose }) => {
  const [status, setStatus] = useState('');
  const [callResult, setCallResult] = useState('');
  /**
   * The measured call, whether it came from the page that opened this form or from the call button
   * inside it. One source of truth so the duration and the blocked statuses cannot disagree.
   */
  const [liveCall, setLiveCall] = useState<CompletedCall | undefined>(completedCall);

  // Seconds when the system measured them, minutes when a person types them — the label switches
  // with the source so the number on screen always means what it says.
  const [duration, setDuration] = useState(
    completedCall ? String(completedCall.durationSec) : '0',
  );
  const isAutoTimed = !!liveCall;
  /** Statuses that assert a conversation happened. Unavailable when the call was never answered. */
  const conversationStatuses = ['รับสาย', 'ได้คุย'];
  const blockedStatuses = liveCall && !liveCall.answered ? conversationStatuses : [];

  /** A call finished while this form was open — adopt its numbers over anything typed so far. */
  const adoptCall = (call: CompletedCall) => {
    setLiveCall(call);
    setDuration(String(call.durationSec));
    if (!call.answered && conversationStatuses.includes(status)) {
      // The agent may have pre-selected "ได้คุย" before dialling. The call says otherwise.
      setStatus('');
    }
  };
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // New state

  // ข้อมูลสวน — 1 ลูกค้ามีได้หลายชุด (ดู migration 088)
  const [plots, setPlots] = useState<PlotDraft[]>([makeEmptyPlot()]);
  const [plotsLoaded, setPlotsLoaded] = useState(false);

  // โหลดของเดิมมาแสดง เพื่อให้เทเล "ยืนยัน" แทนที่จะต้องถามใหม่ทุกสาย
  useEffect(() => {
    let alive = true;
    getCustomerPlots(customer.id)
      .then((r) => {
        if (!alive) return;
        const drafts = plotsToDrafts(r?.plots || []);
        setPlots(drafts.length > 0 ? drafts : [makeEmptyPlot()]);
      })
      .catch(() => { /* อ่านไม่ได้ก็ให้กรอกใหม่ได้ ไม่ต้องบล็อกการบันทึกสาย */ })
      .finally(() => { if (alive) setPlotsLoaded(true); });
    return () => { alive = false; };
  }, [customer.id]);

  const isResultDisabled = nonConversationResultOptions.includes(status);

  useEffect(() => {
    if (isResultDisabled) {
      setCallResult(status);
    } else if (status) { // if status is 'รับสาย' or 'ได้คุย'
      // If the current result is one of the auto-fill ones, clear it
      if (nonConversationResultOptions.includes(callResult)) {
        setCallResult('');
      }
    }
  }, [status]);


  const handleAddTag = (tag: Tag) => {
    if (!selectedTags.some(t => t.id === tag.id)) {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleRemoveTag = (tagToRemove: Tag) => {
    setSelectedTags(selectedTags.filter(tag => tag.id !== tagToRemove.id));
  };


  // Whether notes are required (min 10 chars) based on call status
  const isNotesRequired = status === 'รับสาย' || status === 'ได้คุย';
  const notesMinLength = 10;
  const isNotesValid = !isNotesRequired || notes.trim().length >= notesMinLength;

  const handleSave = async () => {
    if (blockedStatuses.includes(status)) {
      // The dropdown already refuses this; the check repeats here because the value can also arrive
      // from a stale render or the devtools, and a false "ได้คุย" corrupts every report downstream.
      alert('ลูกค้าไม่ได้รับสาย จึงเลือกสถานะนี้ไม่ได้');
      return;
    }
    if (!status) {
      alert('กรุณาเลือกสถานะการโทร');
      return;
    }
    if (!callResult) {
      alert('กรุณาเลือกผลการโทร');
      return;
    }
    if (isNotesRequired && !isNotesValid) {
      alert(`กรุณากรอกหมายเหตุอย่างน้อย ${notesMinLength} ตัวอักษร เมื่อเลือกสถานะ "${status}"`);
      return;
    }
    if (nextFollowUpDate) {
      const followUp = new Date(nextFollowUpDate);
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 30);
      if (followUp.getTime() > maxDate.getTime()) {
        alert('ไม่สามารถนัดหมายเกิน 30 วันจากวันปัจจุบันได้');
        return;
      }
    }

    // ชุดที่กรอกอะไรไว้จริงเท่านั้น — ชุดว่างที่ผู้ใช้กดเพิ่มแล้วไม่ได้กรอก ไม่ต้องเก็บ
    const filledPlots = plots.filter(
      (p) => p.cropName.trim() !== '' || p.sizeValue !== '' || p.isHomeGarden || p.note.trim() !== ''
    );

    // ยังเขียนลง call_history เหมือนเดิม เพื่อคงบันทึกว่าคุยอะไรในสายนั้นไว้เป็นหลักฐาน
    const firstPlot = filledPlots[0];
    const newCallLog: Omit<CallHistory, 'id'> = {
      customerId: customer.id,
      date: new Date().toISOString(),
      // FIX: Replaced non-existent 'name' property with 'firstName' and 'lastName' for the user object.
      caller: `${user.firstName} ${user.lastName}`,
      callerId: user.id,
      status,
      result: callResult,
      duration: parseInt(duration, 10) || 0,
      cropType: filledPlots.map((p) => p.cropName).filter(Boolean).join(', ') || undefined,
      areaSize: firstPlot && firstPlot.sizeValue
        ? `${firstPlot.sizeValue} ${firstPlot.sizeUnit}`
        : undefined,
      notes: notes || undefined,
    };

    setIsSaving(true);
    try {
      await onSave(newCallLog, customer.id, nextFollowUpDate, selectedTags);

      // บันทึกข้อมูลสวนแยกอีกที — ถ้าพลาดต้องไม่ทำให้การบันทึกสายล้มตาม
      // (สายที่โทรไปแล้วสำคัญกว่าข้อมูลสวนที่ยังกรอกใหม่ได้)
      try {
        await saveCustomerPlots({
          customerId: customer.id,
          userId: user.id,
          plots: filledPlots.map((p) => ({
            cropId: p.cropId,
            cropName: p.cropId ? undefined : (p.cropName.trim() || undefined),
            sizeValue: p.sizeValue !== '' ? Number(p.sizeValue) : null,
            sizeUnit: p.sizeValue !== '' ? p.sizeUnit : null,
            isHomeGarden: p.isHomeGarden,
            note: p.note.trim() || null,
          })),
        });
      } catch (plotErr) {
        console.error('save customer plots failed', plotErr);
      }
    } catch (error) {
      console.error("Error saving log:", error);
      alert("เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่");
      setIsSaving(false);
    }
    // Note: We don't set isSaving(false) on success because the parent usually closes the modal,
    // explicitly or implicitly. But if the modal stays open for some reason, we might want to?
    // Based on user request, modal closes after request success. 
  };

  const nowForInput = new Date().toISOString().slice(0, 16);
  const maxFollowUpForInput = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 16);
  })();

  return (
    <Modal title="บันทึกการโทร" onClose={!isSaving ? onClose : () => { }}>
      <div className="space-y-5 text-sm">
        {/* Calling belongs at the top: the agent dials, talks, hangs up, and only then has anything
            to write down. Hidden for anyone without a registered handset. */}
        <CallCustomerButton
          customerId={customer.customerId ?? customer.id}
          customerName={`${customer.firstName} ${customer.lastName}`}
          onCallEnded={(s) =>
            adoptCall({ durationSec: s.duration_sec ?? 0, answered: !!s.answered_at })
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="สถานะการโทร" required>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={isSaving}
              className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 disabled:text-gray-500"
              style={{ colorScheme: 'light' }}
            >
              <option value="" disabled className="text-gray-500">เลือกสถานะการโทร</option>
              {callStatusOptions.map(opt => (
                <option
                  key={opt}
                  value={opt}
                  disabled={blockedStatuses.includes(opt)}
                  className={blockedStatuses.includes(opt) ? 'text-gray-400' : 'text-black'}
                >
                  {opt}{blockedStatuses.includes(opt) ? ' (ลูกค้าไม่รับสาย)' : ''}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="ผลการโทร"
            required
            hint={
              isResultDisabled
                ? 'สถานะที่เลือกไม่มีการสนทนา ระบบจึงเติมผลการโทรให้ตรงกันอัตโนมัติ'
                : undefined
            }
          >
            <select
              value={callResult}
              onChange={(e) => setCallResult(e.target.value)}
              disabled={isResultDisabled || isSaving}
              className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 disabled:text-gray-500"
              style={{ colorScheme: 'light' }}
            >
              <option value="" disabled className="text-gray-500">เลือกผลการโทร</option>
              {(isResultDisabled ? [status] : conversationResultOptions).map(opt => <option key={opt} value={opt} className="text-black">{opt}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label={isAutoTimed ? 'ระยะเวลา (วินาที)' : 'ระยะเวลา (นาที)'}
            accent={isAutoTimed ? 'จับเวลาให้แล้ว' : undefined}
            hint={
              isAutoTimed
                ? 'จับเวลาจริงตั้งแต่ลูกค้ารับสายจนวางสาย แก้ไขไม่ได้'
                : 'กรอกเองสำหรับสายที่โทรนอกระบบ'
            }
          >
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              disabled={isSaving || isAutoTimed}
              readOnly={isAutoTimed}
              className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
              placeholder="0"
              style={{ colorScheme: 'light' }}
            />
            {isAutoTimed && !liveCall!.answered && (
              <p className="mt-1 text-xs text-amber-700">
                ลูกค้าไม่ได้รับสาย — เลือก "รับสาย" หรือ "ได้คุย" ไม่ได้
              </p>
            )}
          </Field>

          <Field
            label="ติดต่อครั้งถัดไป"
            hint="ใส่วันที่แล้วระบบจะสร้างนัดหมายให้อัตโนมัติ ไม่ต้องการนัดหมายก็เว้นว่างไว้ — นัดได้ไม่เกิน 30 วันจากวันนี้"
          >
            <input
              type="datetime-local"
              min={nowForInput}
              max={maxFollowUpForInput}
              value={nextFollowUpDate}
              onChange={(e) => setNextFollowUpDate(e.target.value)}
              disabled={isSaving}
              className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
              placeholder=""
              style={{ colorScheme: 'light' }}
            />
            {nextFollowUpDate && (
              <p className="mt-1 text-xs text-green-700">จะสร้างนัดหมายให้อัตโนมัติเมื่อบันทึก</p>
            )}
          </Field>
        </div>
        {plotsLoaded && (
          <FarmPlotEditor
            plots={plots}
            onChange={setPlots}
            disabled={isSaving}
            userId={user.id}
            showNudge={isNotesRequired}
          />
        )}
        <Field
          label="หมายเหตุ"
          required={isNotesRequired}
          hint={
            isNotesRequired
              ? `สถานะที่เลือกเป็นสายที่ได้คุย จึงต้องบันทึกว่าคุยอะไรอย่างน้อย ${notesMinLength} ตัวอักษร`
              : undefined
          }
        >
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSaving}
            rows={4}
            className={`w-full p-2 border rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 ${
              isNotesRequired && notes.length > 0 && !isNotesValid
                ? 'border-red-400'
                : 'border-gray-300'
            }`}
            placeholder={isNotesRequired ? `กรุณากรอกอย่างน้อย ${notesMinLength} ตัวอักษร...` : 'รายละเอียดเพิ่มเติม...'}
            style={{ colorScheme: 'light' }}
          ></textarea>
          {isNotesRequired && (
            <p className={`text-xs mt-1 ${isNotesValid ? 'text-green-600' : 'text-red-500'}`}>
              {notes.trim().length}/{notesMinLength} ตัวอักษร
              {isNotesValid ? ' ✓' : ` (ต้องอย่างน้อย ${notesMinLength} ตัวอักษร)`}
            </p>
          )}
        </Field>

        <Field label="Tag" hint="ติดป้ายให้ลูกค้ารายนี้ เช่น สนใจสินค้า ลูกค้าเก่า">
          <button
            onClick={() => setShowTagModal(true)}
            disabled={isSaving}
            className={`w-full flex items-center justify-center py-2 px-4 border-2 border-dashed border-gray-300 rounded-md text-gray-500 transition-colors ${isSaving ? 'bg-gray-100 cursor-not-allowed' : 'hover:border-green-500 hover:text-green-600'}`}
          >
            <Plus size={16} className="mr-2" /> เพิ่ม Tag
          </button>
          <div className="mt-2 p-2 min-h-[40px] bg-gray-50 rounded-md border">
            {selectedTags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((tag) => {
                  const tagColor = tag.color || '#9333EA';
                  const bgColor = tagColor.startsWith('#') ? tagColor : `#${tagColor}`;
                  const textColor = getContrastColor(bgColor);
                  return (
                    <span
                      key={tag.id}
                      className="flex items-center text-xs font-medium px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: bgColor, color: textColor }}
                    >
                      {tag.name}
                      <button onClick={() => handleRemoveTag(tag)} disabled={isSaving} className="ml-1.5 opacity-70 hover:opacity-100 disabled:opacity-30">
                        <X size={12} />
                      </button>
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-400 text-xs italic">Tags ที่เลือกจะแสดงที่นี่</p>
            )}
          </div>
        </Field>

        {showTagModal && (
          <TagSelectionModal
            customer={customer}
            user={user}
            systemTags={systemTags}
            selectedTags={selectedTags}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
            onCreateUserTag={onCreateUserTag}
            onClose={() => setShowTagModal(false)}
          />
        )}
      </div>
      <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
        <button
          onClick={onClose}
          disabled={isSaving}
          className={`px-6 py-2 bg-gray-500 text-white rounded-lg font-semibold ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-600'}`}
        >
          ยกเลิก
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`px-6 py-2 bg-[#2E7D32] text-white font-semibold rounded-lg flex items-center ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-800'}`}
        >
          {isSaving ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              กำลังบันทึก...
            </>
          ) : (
            'บันทึก'
          )}
        </button>
      </div>
    </Modal>
  );
};

export default LogCallModal;