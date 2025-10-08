import React, { useState, useEffect } from 'react';
import { Customer, User, CallHistory } from '../types';
import Modal from './Modal';
import { Plus, X } from 'lucide-react';

interface LogCallModalProps {
  customer: Customer;
  user: User;
  // FIX: Change customerId type from number to string to match the Customer type.
  onSave: (callLog: Omit<CallHistory, 'id'>, customerId: string, newFollowUpDate?: string, newTags?: string[]) => void;
  onClose: () => void;
}

const callStatusOptions = ['รับสาย', 'ได้คุย', 'ไม่รับสาย', 'สายไม่ว่าง', 'ติดสายซ้อน', 'ไม่มีสัญญาณ'];
const conversationResultOptions = ['สินค้ายังไม่หมด', 'ใช้แล้วไม่เห็นผล', 'ยังไม่ได้ลองใช้', 'ยังไม่ถึงรอบใช้งาน', 'สั่งช่องทางอื่นแล้ว', 'ไม่สะดวกคุย', 'ติดสายซ้อน', 'ฝากส่งไม่ได้ใช้เอง', 'คนอื่นรับสายแทน', 'เลิกทำสวน', 'ไม่สนใจ', 'ห้ามติดต่อ', 'ได้คุย', 'ขายได้'];
const nonConversationResultOptions = ['ไม่รับสาย', 'สายไม่ว่าง', 'ติดสายซ้อน', 'ไม่มีสัญญาณ'];
const allCallResultOptions = [...new Set([...conversationResultOptions, ...nonConversationResultOptions])];


const LogCallModal: React.FC<LogCallModalProps> = ({ customer, user, onSave, onClose }) => {
  const [status, setStatus] = useState('');
  const [callResult, setCallResult] = useState('');
  const [duration, setDuration] = useState('0');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [cropType, setCropType] = useState('');
  const [areaSize, setAreaSize] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);

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


  const handleAddTag = () => {
    if (tagInput && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
      setIsAddingTag(false);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };


  const handleSave = () => {
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

    onSave(newCallLog, customer.id, nextFollowUpDate, tags);
  };

  const nowForInput = new Date().toISOString().slice(0, 16);

  return (
    <Modal title="บันทึกการโทร" onClose={onClose}>
      <div className="space-y-6 text-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-gray-700 font-medium mb-1">สถานะการโทร</label>
                <select 
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500"
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
                    disabled={isResultDisabled}
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
                    className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500" 
                    placeholder="0"
                    style={{ colorScheme: 'light' }}
                />
            </div>
            <div>
                <label className="block text-gray-700 font-medium mb-1">วันที่คาดว่าจะติดต่อครั้งถัดไป</label>
                 <input 
                    type="datetime-local"
                    min={nowForInput}
                    value={nextFollowUpDate}
                    onChange={(e) => setNextFollowUpDate(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500" 
                    style={{ colorScheme: 'light' }}
                />
            </div>
        </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
                <label className="block text-gray-700 font-medium mb-1">พืชพันธุ์</label>
                <input 
                    type="text"
                    value={cropType}
                    onChange={(e) => setCropType(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500" 
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
                    className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500" 
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
                rows={4}
                className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                placeholder="รายละเอียดเพิ่มเติม..."
                style={{ colorScheme: 'light' }}
            ></textarea>
        </div>
         <div>
            <label className="block text-gray-700 font-medium mb-1">เพิ่ม Tag</label>
            {isAddingTag ? (
                <div className="flex items-center space-x-2">
                    <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        className="flex-grow p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                        placeholder="พิมพ์ Tag แล้วกด Enter"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                        autoFocus
                        style={{ colorScheme: 'light' }}
                    />
                    <button onClick={handleAddTag} className="px-4 py-2 bg-green-600 text-white rounded-md font-semibold hover:bg-green-700">เพิ่ม</button>
                    <button onClick={() => setIsAddingTag(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">ยกเลิก</button>
                </div>
            ) : (
                <button 
                    onClick={() => setIsAddingTag(true)}
                    className="w-full flex items-center justify-center py-2 px-4 border-2 border-dashed border-gray-300 rounded-md text-gray-500 hover:border-green-500 hover:text-green-600 transition-colors"
                >
                    <Plus size={16} className="mr-2"/> เพิ่ม Tag
                </button>
            )}
             <div className="mt-2 p-2 min-h-[40px] bg-gray-50 rounded-md border">
                {tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => (
                            <span key={tag} className="flex items-center bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full">
                                {tag}
                                <button onClick={() => handleRemoveTag(tag)} className="ml-1.5 text-green-600 hover:text-green-800">
                                    <X size={12} />
                                </button>
                            </span>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-400 text-xs italic">Tags ที่เพิ่มจะแสดงที่นี่</p>
                )}
            </div>
        </div>
      </div>
      <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
        <button
          onClick={onClose}
          className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold"
        >
          ยกเลิก
        </button>
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-[#2E7D32] text-white font-semibold rounded-lg hover:bg-green-800"
        >
          บันทึก
        </button>
      </div>
    </Modal>
  );
};

export default LogCallModal;