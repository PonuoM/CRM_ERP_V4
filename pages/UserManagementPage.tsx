import React, { useState, useMemo } from 'react';
import { User, UserRole, Company, UserStatus } from '../types';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';

interface UserManagementPageProps {
  users: User[];
  openModal: (type: string, data?: any) => void;
  onToggleStatus: (userId: number, status: Exclude<UserStatus, 'resigned'>) => Promise<void>;
  currentUser: User;
  allCompanies: Company[];
}

const UserManagementPage: React.FC<UserManagementPageProps> = ({
  users,
  openModal,
  onToggleStatus,
  currentUser,
  allCompanies,
}) => {
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [companyFilter, setCompanyFilter] = useState<string>("");
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);

  const handleDelete = (user: User) => {
    openModal("confirmDelete", {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      type: "user",
    });
  };

  const isSuperAdmin = currentUser.role === UserRole.SuperAdmin;

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const roleMatch = !roleFilter || user.role === roleFilter;
      const companyMatch = !isSuperAdmin || !companyFilter || user.companyId === parseInt(companyFilter);
      return roleMatch && companyMatch;
    });
  }, [users, roleFilter, companyFilter, isSuperAdmin]);

  const handleStatusToggle = async (user: User, shouldActivate: boolean) => {
    if (user.status === 'resigned') {
      return;
    }
    const targetStatus: Exclude<UserStatus, 'resigned'> = shouldActivate ? 'active' : 'inactive';
    if ((user.status ?? 'active') === targetStatus) {
      return;
    }
    try {
      setStatusUpdatingId(user.id);
      await onToggleStatus(user.id, targetStatus);
    } catch (error) {
      console.error('Failed to change user status', error);
      alert('Unable to update user status. Please try again.');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">จัดการผู้ใช้</h2>
          <p className="text-gray-600">จัดการข้อมูลผู้ใช้งานในระบบ</p>
        </div>
        <button
          onClick={() => openModal("addUser")}
          className="bg-green-100 text-green-700 font-semibold text-sm rounded-md py-2 px-4 flex items-center hover:bg-green-200 shadow-sm"
        >
          <PlusCircle size={16} className="mr-2" />
          เพิ่มผู้ใช้ใหม่
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-6 flex items-center space-x-4">
        <div className="flex-1">
          <label htmlFor="role-filter" className="block text-sm font-medium text-gray-700 mb-1">กรองตามตำแหน่ง</label>
          <select 
            id="role-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500"
            style={{ colorScheme: 'light' }}
          >
            <option value="">ทุกตำแหน่ง</option>
            {Object.values(UserRole).map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>
        {isSuperAdmin && (
          <div className="flex-1">
            <label htmlFor="company-filter" className="block text-sm font-medium text-gray-700 mb-1">กรองตามบริษัท</label>
            <select
              id="company-filter"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500"
              style={{ colorScheme: "light" }}
            >
              <option value="">ทุกบริษัท</option>
              {allCompanies.map(company => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm text-left text-gray-500">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3">ID</th>
              <th scope="col" className="px-6 py-3">Username</th>
              <th scope="col" className="px-6 py-3">ชื่อ-นามสกุล</th>
              <th scope="col" className="px-6 py-3">อีเมล</th>
              <th scope="col" className="px-6 py-3">เบอร์โทรศัพท์</th>
              <th scope="col" className="px-6 py-3">ตำแหน่ง</th>
              <th scope="col" className="px-6 py-3">Team ID</th>
              <th scope="col" className="px-6 py-3">Status</th>
              <th scope="col" className="px-6 py-3 text-right">การดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className="bg-white border-b hover:bg-gray-50">
                <td className="px-6 py-4 font-mono text-xs">{user.id}</td>
                <td className="px-6 py-4 font-medium text-gray-900">
                  {user.username}
                </td>
                <td className="px-6 py-4 font-medium text-gray-900">{`${user.firstName} ${user.lastName}`}</td>
                <td className="px-6 py-4">{user.email || "-"}</td>
                <td className="px-6 py-4">{user.phone || "-"}</td>
                <td className="px-6 py-4">{user.role}</td>
                <td className="px-6 py-4">{user.teamId || "-"}</td>
                <td className="px-6 py-4">
                  {user.status === 'resigned' ? (
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                      Resigned
                    </span>
                  ) : (
                    <div className="flex items-center space-x-3">
                      <label
                        className={`inline-flex items-center ${statusUpdatingId === user.id ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                      >
                        <div className="relative">
                          <input
                            type="checkbox"
                            className="peer sr-only"
                            checked={(user.status ?? 'active') === 'active'}
                            onChange={(e) => handleStatusToggle(user, e.target.checked)}
                            disabled={statusUpdatingId === user.id}
                            aria-label={`Toggle status for ${user.username}`}
                          />
                          <div className="h-5 w-10 rounded-full bg-gray-200 transition-colors peer-checked:bg-green-500"></div>
                          <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"></div>
                        </div>
                      </label>
                      <span className="text-sm font-medium text-gray-700">
                        {(user.status ?? 'active') === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 flex items-center justify-end space-x-2">
                  <button
                    onClick={() => openModal("editUser", user)}
                    className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(user)}
                    className="p-2 text-red-600 hover:bg-red-100 rounded-full"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredUsers.length === 0 && (
          <div className="text-center py-10 text-gray-500">
            ไม่พบข้อมูลผู้ใช้
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagementPage;
