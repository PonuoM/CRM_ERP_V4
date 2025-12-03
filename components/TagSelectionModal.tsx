import React, { useState, useMemo } from 'react';
import { Customer, Tag, TagType, User } from '../types';
import Modal from './Modal';
import { X, Search } from 'lucide-react';

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

interface TagSelectionModalProps {
  customer: Customer;
  user: User;
  systemTags: Tag[];
  selectedTags: Tag[];
  onAddTag: (tag: Tag) => void;
  onRemoveTag: (tag: Tag) => void;
  onCreateUserTag: (tagName: string) => Promise<Tag | null>;
  onClose: () => void;
}

const TagSelectionModal: React.FC<TagSelectionModalProps> = ({ 
  customer, 
  user, 
  systemTags, 
  selectedTags, 
  onAddTag, 
  onRemoveTag, 
  onCreateUserTag, 
  onClose 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [newTagName, setNewTagName] = useState('');

  const availableTags = useMemo(() => {
    const selectedTagIds = new Set(selectedTags.map(t => t.id));
    const allTags = [...systemTags, ...user.customTags].filter(t => !selectedTagIds.has(t.id));
    if (!searchTerm) return allTags;
    return allTags.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [systemTags, user.customTags, selectedTags, searchTerm]);

  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    const handleCreate = async () => {
      const newTag = await onCreateUserTag(newTagName.trim());
      if (newTag) {
        onAddTag(newTag);
        setNewTagName('');
      }
    };
    handleCreate();
  };

  return (
    <Modal title="เลือก Tag" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div>
          <h4 className="font-semibold text-gray-800 mb-2">Tag ที่เลือก</h4>
          <div className="flex flex-wrap gap-2 p-2 min-h-[40px] bg-gray-50 rounded-md border">
            {selectedTags.length > 0 ? selectedTags.map(tag => {
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
                  <button onClick={() => onRemoveTag(tag)} className="ml-1.5 opacity-70 hover:opacity-100">
                    <X size={14} />
                  </button>
                </span>
              );
            }) : <p className="text-gray-400 italic">ไม่มี Tag ที่เลือก</p>}
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-semibold text-gray-800 mb-2">เพิ่ม Tag ที่มีอยู่</h4>
          <div className="relative mb-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="ค้นหา Tag..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2 py-2 border rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500"
              style={{ colorScheme: 'light' }}
            />
          </div>
          <div className="flex flex-wrap gap-2 p-2 min-h-[60px] max-h-48 overflow-y-auto border rounded-md bg-white">
            {availableTags.length > 0 ? availableTags.map(tag => {
              const tagColor = tag.color || '#9333EA';
              const bgColor = tagColor.startsWith('#') ? tagColor : `#${tagColor}`;
              const textColor = getContrastColor(bgColor);
              return (
                <button 
                  key={tag.id} 
                  onClick={() => onAddTag(tag)} 
                  className="flex items-center text-xs font-medium px-2.5 py-1 rounded-full transition-opacity hover:opacity-80"
                  style={{ backgroundColor: bgColor, color: textColor }}
                >
                  {tag.name}
                </button>
              );
            }) : <p className="text-center text-gray-400 p-2 w-full">ไม่พบ Tag</p>}
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-semibold text-gray-800 mb-2">หรือสร้าง Tag ใหม่</h4>
          <div className="flex items-center space-x-2">
            <input 
              type="text" 
              placeholder="ชื่อ Tag ใหม่..." 
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              className="flex-grow px-3 py-2 border rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
              style={{ colorScheme: 'light' }}
            />
            <button onClick={handleCreateTag} className="bg-blue-100 text-blue-700 font-semibold py-2 px-4 rounded-md hover:bg-blue-200">
              สร้างและเพิ่ม
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">คุณสามารถสร้าง Tag ส่วนตัวได้อีก {Math.max(0, 10 - user.customTags.length)} อัน</p>
        </div>
      </div>
      <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
        <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">ปิด</button>
      </div>
    </Modal>
  );
};

export default TagSelectionModal;

