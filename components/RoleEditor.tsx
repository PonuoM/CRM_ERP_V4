import React, { useState, useEffect } from 'react';
import { Role, createRole, updateRole } from '@/services/roleApi';
import { X, Save, AlertCircle } from 'lucide-react';

interface RoleEditorProps {
    role: Role | null; // null = create new, otherwise = edit
    onClose: () => void;
    onSave: () => void;
}

export default function RoleEditor({ role, onClose, onSave }: RoleEditorProps) {
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isEditMode = !!role;

    useEffect(() => {
        if (role) {
            setCode(role.code);
            setName(role.name);
            setDescription(role.description || '');
            setIsActive(role.is_active);
        } else {
            setCode('');
            setName('');
            setDescription('');
            setIsActive(true);
        }
    }, [role]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        // Validation
        if (!code.trim() || !name.trim()) {
            setError('กรุณากรอก รหัส และ ชื่อ Role');
            return;
        }

        // Code validation (lowercase, underscore only)
        if (!/^[a-z_]+$/.test(code)) {
            setError('รหัส Role ต้องเป็นตัวอักษรภาษาอังกฤษตัวเล็กและ _ เท่านั้น (เช่น warehouse_staff)');
            return;
        }

        try {
            setSaving(true);

            if (isEditMode && role) {
                // Update existing role
                await updateRole(role.id, {
                    name,
                    description: description.trim() || undefined,
                    isActive,
                });
            } else {
                // Create new role
                await createRole({
                    code: code.trim(),
                    name: name.trim(),
                    description: description.trim() || undefined,
                    isActive,
                });
            }

            onSave();
            onClose();
        } catch (err: any) {
            setError(err.message || 'เกิดข้อผิดพลาดในการบันทึก');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col font-sans">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
                    <h3 className="text-lg font-bold text-gray-800">
                        {isEditMode ? `แก้ไข Role: ${role.name}` : 'เพิ่ม Role ใหม่'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                        disabled={saving}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-6">
                    {error && (
                        <div className="mb-6 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-lg flex items-center gap-3 text-sm">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-5">
                        {/* Code */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                รหัส Role <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toLowerCase())}
                                disabled={isEditMode || saving}
                                placeholder="เช่น warehouse_staff"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-50 disabled:text-gray-500 transition-all font-mono text-sm"
                                maxLength={64}
                            />
                            <p className="mt-1.5 text-xs text-gray-500">
                                ใช้ตัวอักษรภาษาอังกฤษตัวเล็กและ _ เท่านั้น (ไม่สามารถแก้ไขได้ภายหลัง)
                            </p>
                        </div>

                        {/* Name */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                ชื่อ Role <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={saving}
                                placeholder="เช่น พนักงานคลังสินค้า"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-50 transition-all"
                                maxLength={128}
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                คำอธิบาย
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                disabled={saving}
                                placeholder="อธิบายหน้าที่ของ Role นี้..."
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-50 transition-all resize-none"
                            />
                        </div>

                        {/* Is Active */}
                        <div className="pt-2">
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <div className="relative flex items-center mt-0.5">
                                    <input
                                        type="checkbox"
                                        checked={isActive}
                                        onChange={(e) => setIsActive(e.target.checked)}
                                        disabled={saving}
                                        className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                    />
                                </div>
                                <div>
                                    <span className="text-sm font-medium text-gray-900 group-hover:text-green-700 transition-colors">
                                        เปิดใช้งาน Role นี้
                                    </span>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {isActive
                                            ? 'Role นี้สามารถกำหนดให้กับ User ได้'
                                            : 'Role นี้จะถูกซ่อนและไม่สามารถกำหนดให้กับ User ใหม่ได้'}
                                    </p>
                                </div>
                            </label>
                        </div>

                        {isEditMode && role?.is_system && (
                            <div className="bg-amber-50 border border-amber-100 text-amber-800 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                <span>นี่เป็น Role ระบบ สามารถแก้ไขได้เฉพาะชื่อและคำอธิบาย</span>
                            </div>
                        )}
                    </div>
                </form>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:opacity-50 font-medium text-sm shadow-sm"
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 shadow-sm font-medium text-sm"
                    >
                        {saving ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                กำลังบันทึก...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                บันทึก
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
