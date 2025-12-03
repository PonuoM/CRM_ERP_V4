
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

interface TagManagementModalProps {
  customer: Customer;
  user: User;
  systemTags: Tag[];
  onAddTag: (customerId: string, tag: Tag) => void;
  onRemoveTag: (customerId: string, tagId: number) => void;
  onCreateUserTag: (tagName: string) => Promise<Tag | null>;
  onUpdateUserTag: (tagId: number, payload: { name?: string; color?: string }) => Promise<void> | void;
  onDeleteUserTag: (tagId: number) => Promise<void> | void;
  onClose: () => void;
}

const TagManagementModal: React.FC<TagManagementModalProps> = ({
  customer,
  user,
  systemTags,
  onAddTag,
  onRemoveTag,
  onCreateUserTag,
  onUpdateUserTag,
  onDeleteUserTag,
  onClose,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [newTagName, setNewTagName] = useState('');
    const [editingTagId, setEditingTagId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('#9333EA');
    const [saving, setSaving] = useState(false);

    const availableTags = useMemo(() => {
        const customerTagIds = new Set(customer.tags.map(t => t.id));
        const allTags = [...systemTags, ...user.customTags].filter(t => !customerTagIds.has(t.id));
        if (!searchTerm) return allTags;
        return allTags.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [systemTags, user.customTags, customer.tags, searchTerm]);

    const handleCreateTag = () => {
        if (!newTagName.trim()) return;
        const handleCreate = async () => {
            const newTag = await onCreateUserTag(newTagName.trim());
            if (newTag) {
                onAddTag(customer.id, newTag);
                setNewTagName('');
            }
        };
        handleCreate();
    }

    const startEdit = (tag: Tag) => {
        setEditingTagId(tag.id);
        setEditName(tag.name);
        setEditColor(tag.color || '#9333EA');
    };

    const handleSaveEdit = async () => {
        if (!editingTagId) return;
        setSaving(true);
        try {
            await onUpdateUserTag(editingTagId, { name: editName.trim(), color: editColor });
            setEditingTagId(null);
        } catch (e) {
            alert('Unable to update tag');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (tagId: number) => {
        if (!confirm('คุณต้องการลบ Tag นี้ใช่หรือไม่?')) return;
        try {
            await onDeleteUserTag(tagId);
            if (editingTagId === tagId) setEditingTagId(null);
        } catch (e) {
            alert('Unable to delete tag');
        }
    };

    return (
        <Modal title={`จัดการ Tag สำหรับ: ${customer.firstName} ${customer.lastName}`} onClose={onClose}>
            <div className="space-y-4 text-sm">
                <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Tag ปัจจุบัน</h4>
                    <div className="flex flex-wrap gap-2 p-2 min-h-[40px] bg-gray-50 rounded-md border">
                        {customer.tags.length > 0 ? customer.tags.map(tag => {
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
                                    <button onClick={() => onRemoveTag(customer.id, tag.id)} className="ml-1.5 opacity-70 hover:opacity-100"><X size={14} /></button>
                                </span>
                            );
                        }) : <p className="text-gray-400 italic">ไม่มี Tag</p>}
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
                                    onClick={() => onAddTag(customer.id, tag)} 
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
                <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-800 mb-2">จัดการ Tag ที่สร้าง</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {user.customTags.length === 0 && <p className="text-sm text-gray-500">ยังไม่มี Tag ที่สร้าง</p>}
                        {user.customTags.map((tag) => {
                            const isEditing = editingTagId === tag.id;
                            const tagColor = tag.color || '#9333EA';
                            const bgColor = tagColor.startsWith('#') ? tagColor : `#${tagColor}`;
                            return (
                                <div key={tag.id} className="px-3 py-2 bg-gray-50 rounded border flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <span className="w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: bgColor }} />
                                        {isEditing ? (
                                            <div className="flex flex-col flex-1 min-w-0 gap-1">
                                                <input
                                                    className="border rounded px-2 py-1 text-sm w-full"
                                                    value={editName}
                                                    onChange={e => setEditName(e.target.value)}
                                                />
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="color"
                                                        value={editColor}
                                                        onChange={e => setEditColor(e.target.value)}
                                                        className="w-16 h-8 border rounded"
                                                    />
                                                    <input
                                                        className="border rounded px-2 py-1 text-sm flex-1"
                                                        value={editColor}
                                                        onChange={e => setEditColor(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="font-medium truncate text-gray-900">{tag.name}</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isEditing ? (
                                            <>
                                                <button
                                                    className="px-3 py-1 bg-green-600 text-white rounded text-xs"
                                                    onClick={handleSaveEdit}
                                                    disabled={saving}
                                                >
                                                    {saving ? 'Saving...' : 'Save'}
                                                </button>
                                                <button
                                                    className="px-3 py-1 border rounded text-xs"
                                                    onClick={() => setEditingTagId(null)}
                                                    disabled={saving}
                                                >
                                                    Cancel
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button className="text-blue-600 text-sm hover:underline" onClick={() => startEdit(tag)}>Manage</button>
                                                <button className="text-red-600 text-sm hover:underline" onClick={() => handleDelete(tag.id)}>Delete</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
             <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
                <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">ปิด</button>
            </div>
        </Modal>
    );
};

export default TagManagementModal;
