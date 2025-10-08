
import React, { useState, useMemo } from 'react';
import { Customer, Tag, TagType, User } from '../types';
import Modal from './Modal';
import { X, Search } from 'lucide-react';

interface TagManagementModalProps {
  customer: Customer;
  user: User;
  systemTags: Tag[];
  onAddTag: (customerId: string, tag: Tag) => void;
  onRemoveTag: (customerId: string, tagId: number) => void;
  onCreateUserTag: (tagName: string) => Tag | null;
  onClose: () => void;
}

const TagManagementModal: React.FC<TagManagementModalProps> = ({ customer, user, systemTags, onAddTag, onRemoveTag, onCreateUserTag, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [newTagName, setNewTagName] = useState('');

    const availableTags = useMemo(() => {
        const customerTagIds = new Set(customer.tags.map(t => t.id));
        const allTags = [...systemTags, ...user.customTags].filter(t => !customerTagIds.has(t.id));
        if (!searchTerm) return allTags;
        return allTags.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [systemTags, user.customTags, customer.tags, searchTerm]);

    const handleCreateTag = () => {
        if (!newTagName.trim()) return;
        const newTag = onCreateUserTag(newTagName.trim());
        if (newTag) {
            onAddTag(customer.id, newTag);
            setNewTagName('');
        }
    }

    return (
        <Modal title={`จัดการ Tag สำหรับ: ${customer.firstName} ${customer.lastName}`} onClose={onClose}>
            <div className="space-y-4 text-sm">
                <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Tag ปัจจุบัน</h4>
                    <div className="flex flex-wrap gap-2 p-2 min-h-[40px] bg-gray-50 rounded-md border">
                        {customer.tags.length > 0 ? customer.tags.map(tag => (
                            <span key={tag.id} className={`flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${tag.type === TagType.System ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                                {tag.name}
                                <button onClick={() => onRemoveTag(customer.id, tag.id)} className="ml-1.5 opacity-70 hover:opacity-100"><X size={14} /></button>
                            </span>
                        )) : <p className="text-gray-400 italic">ไม่มี Tag</p>}
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
                    <div className="max-h-32 overflow-y-auto border rounded-md p-1 bg-white">
                        {availableTags.length > 0 ? availableTags.map(tag => (
                            <button key={tag.id} onClick={() => onAddTag(customer.id, tag)} className="w-full text-left p-2 hover:bg-gray-100 rounded text-gray-900">
                                {tag.name}
                            </button>
                        )) : <p className="text-center text-gray-400 p-2">ไม่พบ Tag</p>}
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
                            className="w-full px-3 py-2 border rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                            style={{ colorScheme: 'light' }}
                        />
                        <button onClick={handleCreateTag} className="bg-blue-100 text-blue-700 font-semibold py-2 px-4 rounded-md hover:bg-blue-200">
                            สร้างและเพิ่ม
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">คุณสามารถสร้าง Tag ส่วนตัวได้อีก {10 - user.customTags.length} อัน</p>
                </div>
            </div>
             <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
                <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">ปิด</button>
            </div>
        </Modal>
    );
};

export default TagManagementModal;
