import React, { useEffect, useState } from 'react';
import { listRoles, Role } from '@/services/roleApi';
import PermissionEditor from '@/components/PermissionEditor';
import { Shield, type LucideIcon, Users, Edit3, Lock, Plus } from 'lucide-react';

const PermissionsPage: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const res = await listRoles(true); // Include inactive?
      setRoles(res.roles || []);
    } catch (error) {
      console.error("Failed to fetch roles", error);
    } finally {
      setLoading(false);
    }
  };

  // If editing, show the Editor Component (Full Screen / Inline)
  if (editingRole) {
    return (
      <div className="h-full w-full bg-white relative">
        <PermissionEditor
          role={editingRole}
          onClose={() => setEditingRole(null)}
          onSave={fetchRoles} // Refresh list or logic after save
        />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 h-full flex flex-col bg-[#F5F5F5] font-sans">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <Shield className="w-8 h-8 text-green-600" />
            Role Management
          </h1>
          <p className="text-gray-500 mt-1">จัดการบทบาทและสิทธิ์การเข้าถึงของผู้ใช้งาน</p>
        </div>
        <button className="px-5 py-2.5 bg-green-600 text-white rounded-xl shadow-lg hover:bg-green-700 transition-all font-medium flex items-center gap-2">
          <Plus className="w-5 h-5" />
          สร้าง Role ใหม่
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-green-500 border-t-transparent"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {roles.map((role) => (
            <div
              key={role.id}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all group relative overflow-hidden"
            >
              <div className={`absolute top-0 right-0 p-3 ${role.is_active ? 'opacity-0' : 'opacity-100'}`}>
                <span className="px-2 py-1 bg-red-100 text-red-600 text-xs rounded-md font-medium">Inactive</span>
              </div>

              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-green-50 group-hover:text-green-600 transition-colors">
                  <Users className="w-6 h-6" />
                </div>
              </div>

              <h3 className="text-lg font-bold text-gray-800 mb-1">{role.name}</h3>
              <p className="text-sm text-gray-400 font-mono mb-4">{role.code}</p>

              <p className="text-sm text-gray-500 line-clamp-2 mb-6 h-10">
                {role.description || 'ไม่มีคำอธิบาย'}
              </p>

              <button
                onClick={() => setEditingRole(role)}
                className="w-full py-2.5 rounded-lg border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 hover:text-green-600 hover:border-green-200 transition-all flex items-center justify-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                จัดการสิทธิ์ & เมนู
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PermissionsPage;
