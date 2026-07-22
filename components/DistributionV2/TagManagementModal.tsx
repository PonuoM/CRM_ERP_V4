import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, Loader2, Save } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToast } from '../Toast';

interface Tag {
    id: number;
    session_tag: string;
    color: string;
}

interface TagManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    companyId: string | number;
    onTagsUpdated: () => void;
}

const COLORS = [
    '#E5E7EB', // Gray (Default)
    '#FCA5A5', // Red
    '#FCD34D', // Yellow
    '#86EFAC', // Green
    '#93C5FD', // Blue
    '#C4B5FD', // Purple
    '#F9A8D4', // Pink
    '#FDBA74', // Orange
];

const TagManagementModal: React.FC<TagManagementModalProps> = ({ isOpen, onClose, companyId, onTagsUpdated }) => {
    const [tags, setTags] = useState<Tag[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const { toast, confirm: confirmToast } = useToast();
    
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('');

    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState(COLORS[0]);

    useEffect(() => {
        if (isOpen && companyId) {
            fetchTags();
        }
    }, [isOpen, companyId]);

    const fetchTags = async () => {
        setLoading(true);
        try {
            const res = await apiFetch(`SessionTags/index.php?action=get_tags&companyId=${companyId}`);
            if (res?.ok) {
                // map tag_name to session_tag for consistency with frontend
                const mappedTags = (res.data || []).map((t: any) => ({
                    ...t,
                    session_tag: t.tag_name
                }));
                setTags(mappedTags);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setSaving(true);
        try {
            const res = await apiFetch(`SessionTags/index.php?action=create_tag&companyId=${companyId}`, {
                method: 'POST',
                body: JSON.stringify({ tag_name: newName.trim(), color: newColor })
            });
            if (res?.ok) {
                setNewName('');
                setNewColor(COLORS[0]);
                await fetchTags();
                onTagsUpdated();
            } else {
                toast('error', 'ข้อผิดพลาด', res?.error || 'Failed to create tag');
            }
        } catch (e) {
            console.error(e);
            toast('error', 'ข้อผิดพลาด', 'Error creating tag');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async (id: number) => {
        if (!editName.trim()) return;
        setSaving(true);
        try {
            const res = await apiFetch(`SessionTags/index.php?action=update_tag&companyId=${companyId}`, {
                method: 'PUT',
                body: JSON.stringify({ id, tag_name: editName.trim(), color: editColor })
            });
            if (res?.ok) {
                setEditingId(null);
                await fetchTags();
                onTagsUpdated();
            } else {
                toast('error', 'ข้อผิดพลาด', res?.error || 'Failed to update tag');
            }
        } catch (e) {
            console.error(e);
            toast('error', 'ข้อผิดพลาด', 'Error updating tag');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        const confirmed = await confirmToast({ type: 'warning', title: 'ยืนยันการลบ Tag', message: 'ข้อมูลประวัติเก่าๆ ที่เคยใช้ Tag นี้จะไม่แสดงชื่อ Tag อีกต่อไป', confirmText: 'ยืนยัน', cancelText: 'ยกเลิก' });
        if (!confirmed) return;
        setSaving(true);
        try {
            const res = await apiFetch(`SessionTags/index.php?action=delete_tag&companyId=${companyId}`, {
                method: 'DELETE',
                body: JSON.stringify({ id })
            });
            if (res?.ok) {
                await fetchTags();
                onTagsUpdated();
            } else {
                toast('error', 'ข้อผิดพลาด', res?.error || 'Failed to delete tag');
            }
        } catch (e) {
            console.error(e);
            toast('error', 'ข้อผิดพลาด', 'Error deleting tag');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">จัดการป้ายกำกับ (Session Tags)</h2>
                        <p className="text-sm text-gray-500 mt-1">เพิ่ม ลบ หรือแก้ไขชื่อป้ายกำกับเพื่อใช้ในการแจกงาน</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
                    {/* Create New Tag */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex gap-3 items-end">
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">สร้าง Tag ใหม่</label>
                            <input 
                                type="text"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                placeholder="ชื่อ Tag..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">เลือกสี</label>
                            <div className="flex gap-1 p-1 border border-gray-200 rounded-lg bg-gray-50">
                                {COLORS.map(c => (
                                    <button 
                                        key={c}
                                        onClick={() => setNewColor(c)}
                                        className={`w-8 h-8 rounded-md transition-all ${newColor === c ? 'ring-2 ring-offset-1 ring-blue-500 scale-110 shadow-sm' : 'hover:scale-105'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>
                        <button 
                            onClick={handleCreate}
                            disabled={!newName.trim() || saving}
                            className="h-[42px] px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            เพิ่ม
                        </button>
                    </div>

                    {/* Tag List */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        {loading ? (
                            <div className="p-8 flex justify-center text-gray-400">
                                <Loader2 className="w-8 h-8 animate-spin" />
                            </div>
                        ) : tags.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                ยังไม่มี Tag ในระบบ
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">ป้ายกำกับ (Tag)</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-48">สี (Color)</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right w-32">จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {tags.map(tag => (
                                        <tr key={tag.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-4 py-3">
                                                {editingId === tag.id ? (
                                                    <input 
                                                        type="text"
                                                        value={editName}
                                                        onChange={e => setEditName(e.target.value)}
                                                        className="w-full px-2 py-1 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                    />
                                                ) : (
                                                    <span 
                                                        className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium"
                                                        style={{ 
                                                            backgroundColor: `${tag.color}20`, 
                                                            color: tag.color === '#E5E7EB' ? '#374151' : tag.color,
                                                            border: `1px solid ${tag.color}` 
                                                        }}
                                                    >
                                                        {tag.session_tag}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {editingId === tag.id ? (
                                                    <div className="flex gap-1 flex-wrap">
                                                        {COLORS.map(c => (
                                                            <button 
                                                                key={c}
                                                                onClick={() => setEditColor(c)}
                                                                className={`w-6 h-6 rounded-md transition-all ${editColor === c ? 'ring-2 ring-offset-1 ring-blue-500 scale-110 shadow-sm' : 'hover:scale-105'}`}
                                                                style={{ backgroundColor: c }}
                                                            />
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                                        <div className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: tag.color }} />
                                                        {tag.color}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {editingId === tag.id ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button 
                                                            onClick={() => handleUpdate(tag.id)}
                                                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                            title="บันทึก"
                                                        >
                                                            <Save className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => setEditingId(null)}
                                                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                                                            title="ยกเลิก"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button 
                                                            onClick={() => {
                                                                setEditingId(tag.id);
                                                                setEditName(tag.session_tag);
                                                                setEditColor(tag.color);
                                                            }}
                                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDelete(tag.id)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TagManagementModal;
