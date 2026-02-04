import React, { useState, useEffect } from 'react';
import { Customer, User, CallHistory, Tag, TagType } from '../types';
import Modal from './Modal';
import { Plus, X } from 'lucide-react';
import TagSelectionModal from './TagSelectionModal';

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

interface LogCallModalProps {
  customer: Customer;
  user: User;
  systemTags: Tag[];
  // FIX: Change customerId type from number to string to match the Customer type.
  onSave: (callLog: Omit<CallHistory, 'id'>, customerId: string, newFollowUpDate?: string, newTags?: Tag[]) => Promise<void>;
  onCreateUserTag: (tagName: string) => Promise<Tag | null>;
  onClose: () => void;
}

const callStatusOptions = ['รับสาย', 'ได้คุย', 'ไม่รับสาย', 'สายไม่ว่าง', 'ติดสายซ้อน', 'ไม่มีสัญญาณ', 'ตัดสายทิ้ง'];
const conversationResultOptions = ['สินค้ายังไม่หมด', 'ใช้แล้วไม่เห็นผล', 'ยังไม่ได้ลองใช้', 'ยังไม่ถึงรอบใช้งาน', 'สั่งช่องทางอื่นแล้ว', 'ไม่สะดวกคุย', 'ติดสายซ้อน', 'ฝากส่งไม่ได้ใช้เอง', 'คนอื่นรับสายแทน', 'เลิกทำสวน', 'ไม่สนใจ', 'ห้ามติดต่อ', 'ได้คุย', 'ขายได้', 'ตัดสายทิ้ง'];
const nonConversationResultOptions = ['ไม่รับสาย', 'สายไม่ว่าง', 'ติดสายซ้อน', 'ไม่มีสัญญาณ', 'ตัดสายทิ้ง'];
const allCallResultOptions = [...new Set([...conversationResultOptions, ...nonConversationResultOptions])];


const LogCallModal: React.FC<LogCallModalProps> = ({ customer, user, systemTags, onSave, onCreateUserTag, onClose }) => {
  const [status, setStatus] = useState('');
  const [callResult, setCallResult] = useState('');
  const [duration, setDuration] = useState('0');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [cropType, setCropType] = useState('');
  const [areaSize, setAreaSize] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // New state

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


  const handleSave = async () => {
    if (!status) {
      alert('กรุณาเลือกสถานะการโทร');
      return;
    }
    if (!callResult) {
      alert('กรุณาเลือกผลการโทร');
      return;
    }

    const newCallLog: Omit<CallHistory, 'id'> = {
      customerId: customer.id,
      date: new Date().toISOString(),
      // FIX: Replaced non-existent 'name' property with 'firstName' and 'lastName' for the user object.
      caller: `${user.firstName} ${user.lastName}`,
      status,
      result: callResult,
      duration: parseInt(duration, 10) || 0,
      cropType: cropType || undefined,
      areaSize: areaSize || undefined,
      notes: notes || undefined,
    };

    setIsSaving(true);
    try {
      await onSave(newCallLog, customer.id, nextFollowUpDate, selectedTags);
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

  return (
    <Modal title="บันทึกการโทร" onClose={!isSaving ? onClose : () => { }}>
      <div className="space-y-6 text-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 font-medium mb-1">สถานะการโทร</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={isSaving}
              className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 disabled:text-gray-500"
              style={{ colorScheme: 'light' }}
            >
              <option value="" disabled className="text-gray-500">เลือกสถานะการโทร</option>
              {callStatusOptions.map(opt => <option key={opt} value={opt} className="text-black">{opt}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-1">ผลการโทร</label>
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
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 font-medium mb-1">ระยะเวลา (นาที)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              disabled={isSaving}
              className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
              placeholder="0"
              style={{ colorScheme: 'light' }}
            />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-1">
              วันที่คาดว่าจะติดต่อครั้งถัดไป
              <span className="text-xs text-green-600 ml-1">(ใส่วันที่เพื่อสร้างนัดหมายอัตโนมัติ)</span>
            </label>
            <input
              type="datetime-local"
              min={nowForInput}
              value={nextFollowUpDate}
              onChange={(e) => setNextFollowUpDate(e.target.value)}
              disabled={isSaving}
              className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
              placeholder=""
              style={{ colorScheme: 'light' }}
            />
            <p className="text-xs text-gray-500 mt-1">
              หมายเหตุ: หากใส่วันที่ ระบบจะสร้างนัดหมายให้อัตโนมัติ
              หากไม่ต้องการสร้างนัดหมาย ไม่ต้องใส่วันที่
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 font-medium mb-1">พืชพันธุ์</label>
            <input
              type="text"
              value={cropType}
              onChange={(e) => setCropType(e.target.value)}
              disabled={isSaving}
              className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
              placeholder="เช่น มะม่วง, ทุเรียน, ลำไย"
              style={{ colorScheme: 'light' }}
            />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-1">ขนาดสวน</label>
            <input
              type="text"
              value={areaSize}
              onChange={(e) => setAreaSize(e.target.value)}
              disabled={isSaving}
              className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
              placeholder="เช่น 5 ไร่, 2,000 ตารางวา"
              style={{ colorScheme: 'light' }}
            />
          </div>
        </div>
        <div>
          <label className="block text-gray-700 font-medium mb-1">หมายเหตุ</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSaving}
            rows={4}
            className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
            placeholder="รายละเอียดเพิ่มเติม..."
            style={{ colorScheme: 'light' }}
          ></textarea>
        </div>
        <div>
          <label className="block text-gray-700 font-medium mb-1">เพิ่ม Tag</label>
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
        </div>

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