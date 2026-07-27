import React, { useState, useEffect, useMemo } from 'react';
import { Tag } from '../types';
import Modal from './Modal';
import { X, Search } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { apiFetch } from '@/services/api';
// Helper function to get contrasting text color (black or white)
const getContrastColor = (hexColor: string): string => {
  const color = hexColor.replace('#', '');
  if (color.length !== 6) return '#FFFFFF';
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#000000' : '#FFFFFF';
};

interface OrderTagManagementModalProps {
  orderId: string;
  assignedTags: Tag[];
  currentUser?: any;
  onClose: () => void;
  onTagsUpdated: () => void;
}

const OrderTagManagementModal: React.FC<OrderTagManagementModalProps> = ({
  orderId,
  assignedTags,
  currentUser,
  onClose,
  onTagsUpdated
}) => {
  const toast = useToast();
  const [systemTags, setSystemTags] = useState<Tag[]>([]);
  const [userTags, setUserTags] = useState<Tag[]>([]);
  const [localAssignedTags, setLocalAssignedTags] = useState<Tag[]>(assignedTags);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [newTagName, setNewTagName] = useState('');
  
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#E5E7EB');

  const fetchTags = async () => {
    try {
      const [sysRes, usrRes] = await Promise.all([
        apiFetch('order_tags?type=SYSTEM'),
        apiFetch(`order_tags?type=USER`)
      ]);
      if (Array.isArray(sysRes)) setSystemTags(sysRes);
      if (Array.isArray(usrRes)) setUserTags(usrRes);
    } catch (err) {
      console.error('Error fetching tags', err);
      toast.error('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลป้ายกำกับได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  useEffect(() => {
    setLocalAssignedTags(assignedTags);
  }, [assignedTags]);

  const allAvailableTags = useMemo(() => {
    return [...systemTags, ...userTags].filter(
      tag => !localAssignedTags.find(at => at.id === tag.id)
    );
  }, [systemTags, userTags, localAssignedTags]);

  const filteredTags = useMemo(() => {
    if (!searchTerm) return allAvailableTags;
    return allAvailableTags.filter(tag => 
      tag.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allAvailableTags, searchTerm]);

  const handleAddTag = async (tag: Tag) => {
    // Optimistic UI Update
    setLocalAssignedTags(prev => [...prev, tag]);
    try {
      const data = await apiFetch('order_tag_assignments', {
        method: 'POST',
        body: JSON.stringify({ orderId, tagId: tag.id })
      });
      if (data.ok) {
        onTagsUpdated();
      } else {
        // Revert on error
        setLocalAssignedTags(prev => prev.filter(t => t.id !== tag.id));
        toast.error('ข้อผิดพลาด', data.error || 'Failed to assign tag');
      }
    } catch (err) {
      // Revert on error
      setLocalAssignedTags(prev => prev.filter(t => t.id !== tag.id));
      toast.error('ข้อผิดพลาด', 'Error assigning tag');
    }
  };

  const handleRemoveTag = async (tagId: number) => {
    const tagToRemove = localAssignedTags.find(t => t.id === tagId);
    // Optimistic UI Update
    setLocalAssignedTags(prev => prev.filter(t => t.id !== tagId));
    try {
      const data = await apiFetch(`order_tag_assignments?orderId=${orderId}&tagId=${tagId}`, {
        method: 'DELETE'
      });
      if (data.ok) {
        onTagsUpdated();
      } else {
        // Revert on error
        if (tagToRemove) setLocalAssignedTags(prev => [...prev, tagToRemove]);
        toast.error('ข้อผิดพลาด', 'Failed to remove tag');
      }
    } catch (err) {
      // Revert on error
      if (tagToRemove) setLocalAssignedTags(prev => [...prev, tagToRemove]);
      toast.error('ข้อผิดพลาด', 'Error removing tag');
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const data = await apiFetch('order_tags', {
        method: 'POST',
        body: JSON.stringify({ name: newTagName, type: 'USER' })
      });
      if (data.ok) {
        setNewTagName('');
        setUserTags([...userTags, data.tag]);
        toast.success('สำเร็จ', 'สร้างป้ายกำกับสำเร็จ');
      } else {
        toast.error('ข้อผิดพลาด', data.message || data.error || 'Failed to create tag');
      }
    } catch (err) {
      toast.error('ข้อผิดพลาด', 'Error creating tag');
    }
  };

  const handleDeleteUserTag = async (tagId: number) => {
    if (!window.confirm('คุณต้องการลบป้ายกำกับนี้ใช่หรือไม่? การลบจะทำให้ป้ายนี้หายไปจากทุกออเดอร์ที่เคยแปะไว้')) return;
    try {
      const data = await apiFetch(`order_tags?id=${tagId}`, {
        method: 'DELETE'
      });
      if (data.ok) {
        setUserTags(userTags.filter(t => t.id !== tagId));
        onTagsUpdated(); // Refresh in case it was on this order
        toast.success('สำเร็จ', 'ลบป้ายกำกับสำเร็จ');
      } else {
        toast.error('ข้อผิดพลาด', 'Failed to delete tag');
      }
    } catch (err) {
      toast.error('ข้อผิดพลาด', 'Error deleting tag');
    }
  };

  const startEdit = (tag: Tag) => {
    setEditingTagId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color || '#E5E7EB');
  };

  const handleSaveEdit = async () => {
    if (!editingTagId || !editName.trim()) return;
    setSaving(true);
    try {
      const data = await apiFetch(`order_tags?id=${editingTagId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editName, color: editColor })
      });
      if (data.ok) {
        setUserTags(userTags.map(t => t.id === editingTagId ? { ...t, name: editName, color: editColor } : t));
        setEditingTagId(null);
        onTagsUpdated();
        toast.success('สำเร็จ', 'แก้ไขป้ายกำกับสำเร็จ');
      } else {
        toast.error('ข้อผิดพลาด', 'Failed to update tag');
      }
    } catch (err) {
      toast.error('ข้อผิดพลาด', 'Error updating tag');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Modal isOpen={true} onClose={onClose} title="จัดการป้ายกำกับออเดอร์">
        <div className="p-8 text-center text-gray-500">กำลังโหลดข้อมูล...</div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={true} onClose={onClose} title={`จัดการป้ายกำกับออเดอร์ (${orderId})`}>
      <div className="space-y-6">
        <div>
          <h4 className="font-semibold text-gray-800 mb-2 flex justify-between items-center">
            <span>ป้ายกำกับปัจจุบัน</span>
            <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {localAssignedTags.length} ป้าย
            </span>
          </h4>
          <div className="flex flex-wrap gap-2 p-3 min-h-[60px] bg-gray-50 rounded-md border border-gray-200">
            {localAssignedTags.length > 0 ? localAssignedTags.map(tag => {
              const tagColor = tag.color || '#9333EA';
              const bgColor = tagColor.startsWith('#') ? tagColor : `#${tagColor}`;
              const textColor = getContrastColor(bgColor);
              return (
                <span 
                  key={tag.id} 
                  className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full group pr-1.5"
                  style={{ backgroundColor: bgColor, color: textColor }}
                >
                  {tag.name}
                  <button 
                    onClick={() => handleRemoveTag(tag.id)}
                    className="ml-1.5 p-0.5 rounded-full hover:bg-black hover:bg-opacity-20 transition-colors focus:outline-none"
                    aria-label="Remove tag"
                  >
                    <X size={12} strokeWidth={3} />
                  </button>
                </span>
              );
            }) : <p className="text-sm text-gray-400 italic py-1">ยังไม่มีป้ายกำกับ</p>}
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            เพิ่มป้ายกำกับ
            <span className="text-xs font-normal text-gray-500">คลิกที่ป้ายเพื่อเพิ่ม</span>
          </h4>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="ค้นหาป้ายกำกับ..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
              style={{ colorScheme: 'light' }}
            />
          </div>
          <div className="flex flex-wrap gap-2 p-3 min-h-[60px] max-h-48 overflow-y-auto border border-gray-200 rounded-md bg-white">
            {filteredTags.length > 0 ? filteredTags.map(tag => {
              const tagColor = tag.color || '#9333EA';
              const bgColor = tagColor.startsWith('#') ? tagColor : `#${tagColor}`;
              const textColor = getContrastColor(bgColor);
              return (
                <button 
                  key={tag.id} 
                  onClick={() => handleAddTag(tag)} 
                  className="flex items-center text-xs font-medium px-2.5 py-1 rounded-full transition-opacity hover:opacity-80 border border-transparent shadow-sm"
                  style={{ backgroundColor: bgColor, color: textColor }}
                >
                  {tag.name}
                </button>
              );
            }) : <p className="text-center text-gray-400 text-sm py-2 w-full">ไม่พบป้ายกำกับที่ค้นหา</p>}
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-semibold text-gray-800 mb-2">สร้างป้ายกำกับเพิ่มเติม (ระดับบริษัท)</h4>
          <div className="flex items-center space-x-2">
            <input 
              type="text" 
              placeholder="ชื่อป้ายกำกับใหม่..." 
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
              style={{ colorScheme: 'light' }}
            />
            <button 
              onClick={handleCreateTag} 
              disabled={!newTagName.trim()}
              className="bg-green-50 text-green-700 font-semibold py-2 px-4 rounded-md hover:bg-green-100 disabled:opacity-50 transition-colors text-sm border border-green-200"
            >
              สร้างป้าย
            </button>
          </div>

        </div>

        {userTags.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="font-semibold text-gray-800 mb-3">จัดการป้ายกำกับ (ระดับบริษัท)</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {userTags.map((tag) => {
                const isEditing = editingTagId === tag.id;
                const tagColor = tag.color || '#9333EA';
                const bgColor = tagColor.startsWith('#') ? tagColor : `#${tagColor}`;
                return (
                  <div key={tag.id} className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0 shadow-sm" style={{ backgroundColor: bgColor }} />
                      {isEditing ? (
                        <div className="flex flex-col flex-1 min-w-0 gap-2 w-full">
                          <input
                            className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full focus:ring-1 focus:ring-blue-500 outline-none"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            placeholder="ชื่อป้าย"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={editColor}
                              onChange={e => setEditColor(e.target.value)}
                              className="w-10 h-8 p-0 border-0 rounded cursor-pointer"
                            />
                            <input
                              className="border border-gray-300 rounded px-2 py-1.5 text-sm flex-1 font-mono uppercase focus:ring-1 focus:ring-blue-500 outline-none"
                              value={editColor}
                              onChange={e => setEditColor(e.target.value)}
                              placeholder="#FFFFFF"
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="font-medium text-sm text-gray-800 truncate">{tag.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isEditing ? (
                        <div className="flex flex-col gap-1">
                          <button
                            className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 font-medium"
                            onClick={handleSaveEdit}
                            disabled={saving}
                          >
                            {saving ? 'บันทึก...' : 'บันทึก'}
                          </button>
                          <button
                            className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300 font-medium"
                            onClick={() => setEditingTagId(null)}
                            disabled={saving}
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button 
                            className="text-blue-600 text-xs font-medium hover:text-blue-800 hover:underline px-2 py-1 rounded hover:bg-blue-50" 
                            onClick={() => startEdit(tag)}
                          >
                            แก้ไข
                          </button>
                          <button 
                            className="text-red-600 text-xs font-medium hover:text-red-800 hover:underline px-2 py-1 rounded hover:bg-red-50" 
                            onClick={() => handleDeleteUserTag(tag.id)}
                          >
                            ลบ
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      
      <div className="flex justify-end pt-5 border-t mt-6">
        <button onClick={onClose} className="px-5 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors focus:ring-2 focus:ring-gray-300 outline-none">
          ปิดหน้าต่าง
        </button>
      </div>
    </Modal>
  );
};

export default OrderTagManagementModal;
