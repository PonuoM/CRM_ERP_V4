import React, { useState, useEffect } from 'react';
import { Role, listRoles, deleteRole } from '@/services/roleApi';
import RoleEditor from '@/components/RoleEditor';
import PermissionEditor from '@/components/PermissionEditor';
import { Key, Pencil, Trash2, RotateCcw, Plus, X, Users, Shield } from 'lucide-react';

interface RoleManagementPageProps {
    onClose?: () => void;
}

export default function RoleManagementPage({ onClose }: RoleManagementPageProps) {
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [includeInactive, setIncludeInactive] = useState(false);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [showRoleEditor, setShowRoleEditor] = useState(false);
    const [showPermissionEditor, setShowPermissionEditor] = useState(false);

    useEffect(() => {
        loadRoles();
    }, [includeInactive]);

    async function loadRoles() {
        try {
            setLoading(true);
            setError(null);
            const data = await listRoles(includeInactive);
            setRoles(data.roles || []);
        } catch (err: any) {
            setError(err.message || 'Failed to load roles');
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(role: Role) {
        if (role.is_system) {
            alert('ไม่สามารถลบ Role ระบบได้');
            return;
        }

        if (!confirm(`คุณแน่ใจหรือไม่ที่จะลบ Role "${role.name}"?`)) {
            return;
        }

        try {
            await deleteRole(role.id);
            loadRoles();
        } catch (err: any) {
            alert(err.message || 'Failed to delete role');
        }
    }

    function handleEdit(role: Role) {
        setSelectedRole(role);
        setShowRoleEditor(true);
    }

    function handleManagePermissions(role: Role) {
        setSelectedRole(role);
        setShowPermissionEditor(true);
    }

    function handleAddNew() {
        setSelectedRole(null);
        setShowRoleEditor(true);
    }

    function handleEditorClose() {
        setShowRoleEditor(false);
        // Do not close Permission Editor here, handled separately or by its own close
        setSelectedRole(null);
    }

    function handlePermissionEditorClose() {
        setShowPermissionEditor(false);
        setSelectedRole(null);
        // Reload roles in case permissions somehow affect list (unlikely but safe)
        loadRoles();
    }

    function handleEditorSave() {
        loadRoles();
        handleEditorClose();
        // Dispatch event to notify App.tsx to reload current user permissions
        window.dispatchEvent(new CustomEvent('role-permissions-updated'));
    }

    // View Switching: If Permission Editor is active, show it fully
    if (showPermissionEditor && selectedRole) {
        return (
            <div className="h-full w-full bg-white relative">
                <PermissionEditor
                    role={selectedRole}
                    onClose={handlePermissionEditorClose}
                    onSave={() => {
                        loadRoles();
                        handlePermissionEditorClose();
                        window.dispatchEvent(new CustomEvent('role-permissions-updated'));
                    }}
                />
            </div>
        );
    }

    // Default View: Role List Page
    return (
        <div className="p-6 md:p-8 h-full flex flex-col bg-[#F5F5F5] font-sans overflow-hidden">
            {/* Header */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <Shield className="w-6 h-6 text-green-600" />
                        </div>
                        Role Management
                    </h1>
                    <p className="text-gray-500 mt-1 ml-14">จัดการบทบาทและสิทธิ์การเข้าถึงของผู้ใช้งาน</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={loadRoles}
                        className="p-2.5 text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-green-600 transition-colors shadow-sm"
                        title="รีเฟรชข้อมูล"
                    >
                        <RotateCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={handleAddNew}
                        className="px-5 py-2.5 bg-green-600 text-white rounded-xl shadow-lg hover:bg-green-700 transition-all font-medium flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        สร้าง Role ใหม่
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="mb-6 flex items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex-shrink-0">
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-1.5 hover:bg-gray-50 rounded-lg transition-colors">
                        <input
                            type="checkbox"
                            checked={includeInactive}
                            onChange={(e) => setIncludeInactive(e.target.checked)}
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                        />
                        <span className="text-sm font-medium text-gray-700">แสดง Role ที่ไม่ใช้งาน</span>
                    </label>
                </div>
                <div className="text-sm text-gray-500 font-medium bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                    ทั้งหมด {roles.length} Roles
                </div>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto">
                {loading && (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <div className="animate-spin rounded-full h-10 w-10 border-2 border-green-500 border-t-transparent mb-4"></div>
                        <span>กำลังโหลดข้อมูล...</span>
                    </div>
                )}

                {error && (
                    <div className="mx-auto max-w-2xl bg-red-50 border border-red-100 text-red-600 px-6 py-4 rounded-xl flex items-center gap-3 shadow-sm">
                        <X className="w-5 h-5" />
                        <span>{error}</span>
                    </div>
                )}

                {!loading && !error && roles.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-8">
                        {roles.map((role) => (
                            <div
                                key={role.id}
                                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all group relative overflow-hidden flex flex-col"
                            >
                                <div className={`absolute top-0 right-0 p-3 ${role.is_active ? 'opacity-0' : 'opacity-100'}`}>
                                    <span className="px-2 py-1 bg-red-100 text-red-600 text-xs rounded-md font-medium">Inactive</span>
                                </div>

                                <div className="flex items-start justify-between mb-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${role.is_system ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                                        {role.is_system ? <Shield className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {role.is_system && (
                                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full border border-blue-100 uppercase tracking-wide">System</span>
                                        )}
                                    </div>
                                </div>

                                <h3 className="text-lg font-bold text-gray-800 mb-1">{role.name}</h3>
                                <p className="text-sm text-gray-400 font-mono mb-4 px-2 py-0.5 bg-gray-50 rounded w-fit">{role.code}</p>

                                <p className="text-sm text-gray-500 line-clamp-2 mb-6 h-10 leading-relaxed">
                                    {role.description || 'ไม่มีคำอธิบาย'}
                                </p>

                                <div className="mt-auto grid grid-cols-2 gap-3 pt-4 border-t border-gray-50">
                                    <button
                                        onClick={() => handleManagePermissions(role)}
                                        className="col-span-2 py-2.5 rounded-lg bg-green-50 text-green-700 font-medium hover:bg-green-100 hover:shadow-sm transition-all flex items-center justify-center gap-2 border border-green-100"
                                    >
                                        <Key className="w-4 h-4" />
                                        จัดการสิทธิ์ & เมนู
                                    </button>
                                    <button
                                        onClick={() => handleEdit(role)}
                                        disabled={role.is_system}
                                        className="py-2 rounded-lg border border-gray-100 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                        แก้ไขข้อมูล
                                    </button>
                                    <button
                                        onClick={() => handleDelete(role)}
                                        disabled={role.is_system}
                                        className="py-2 rounded-lg border border-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        ลบ
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Role Editor Modal */}
            {showRoleEditor && (
                <RoleEditor
                    role={selectedRole}
                    onClose={handleEditorClose}
                    onSave={handleEditorSave}
                />
            )}
        </div>
    );
}
