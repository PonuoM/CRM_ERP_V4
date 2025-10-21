import React, { useState, useEffect } from 'react';
import { Search, UserCheck, UserX, RefreshCw, Link, Unlink, Check, X, AlertCircle, ExternalLink, Users, Database } from 'lucide-react';
import { listAdminPageUsers, AdminPageUser, listUserPancakeMappings, createUserPancakeMapping, UserPancakeMapping } from '../services/api';

interface AdminPageUserFromDB {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
}

interface PageUserFromDB {
  id: number;
  user_id: number | null;
  page_user_id: string;
  page_user_name: string;
  page_count: number;
  created_at: string;
  updated_at: string;
}

interface PancakeUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  created_at: string;
  last_active?: string;
}

const PancakeUserIntegrationPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'mappings' | 'search'>('mappings');
  const [internalUsers, setInternalUsers] = useState<AdminPageUserFromDB[]>([]);
  const [pageUsers, setPageUsers] = useState<PageUserFromDB[]>([]);
  const [userMappings, setUserMappings] = useState<UserPancakeMapping[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInternalUser, setSelectedInternalUser] = useState<AdminPageUserFromDB | null>(null);
  const [selectedPageUser, setSelectedPageUser] = useState<PageUserFromDB | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingPageUsers, setLoadingPageUsers] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ดึงข้อมูล Admin Page users จาก API
  useEffect(() => {
    loadAdminPageUsers();
    loadPageUsers();
    loadUserMappings();
  }, []);

  const loadAdminPageUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await fetch('api/get_admin_page_users.php');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const adminUsers: AdminPageUserFromDB[] = await response.json();
      setInternalUsers(adminUsers);
    } catch (error) {
      console.error('Failed to load Admin Page users:', error);
      showMessage('error', 'ไม่สามารถโหลดข้อมูลผู้ใช้ Admin Page ได้ กรุณาตรวจสอบ API connection');
      setInternalUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadPageUsers = async () => {
    setLoadingPageUsers(true);
    try {
      const response = await fetch('api/get_page_users.php');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const pageUsersData: PageUserFromDB[] = await response.json();
      setPageUsers(pageUsersData);
    } catch (error) {
      console.error('Failed to load page users:', error);
      showMessage('error', 'ไม่สามารถโหลดข้อมูลผู้ใช้เพจได้ กรุณาตรวจสอบ API connection');
      setPageUsers([]);
    } finally {
      setLoadingPageUsers(false);
    }
  };

  const loadUserMappings = async () => {
    try {
      const mappings = await listUserPancakeMappings();
      setUserMappings(mappings);
    } catch (error) {
      console.error('Failed to load user mappings:', error);
      setUserMappings([]);
    }
  };


  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleMapUsers = async () => {
    if (!selectedInternalUser || !selectedPageUser) {
      showMessage('error', 'กรุณาเลือกผู้ใช้ทั้งสองระบบ');
      return;
    }

    setLoading(true);
    try {
      // Update the page_user record with the internal user ID
      const response = await fetch('api/update_page_user_connection.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pageUserId: selectedPageUser.id,
          internalUserId: selectedInternalUser.id
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error || 'Failed to update user connection');
      }

      showMessage('success', 'เชื่อมต่อผู้ใช้สำเร็จแล้ว');
      
      // Reload page users to reflect the changes
      await loadPageUsers();
      
      setSelectedInternalUser(null);
      setSelectedPageUser(null);
    } catch (error) {
      console.error('Failed to create mapping:', error);
      showMessage('error', 'ไม่สามารถเชื่อมต่อผู้ใช้ได้ กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  };

  const handleUnmapUsers = async (mappingId: number) => {
    setLoading(true);
    try {
      // ในระบบจริง เราจะเรียก API ลบ
      // await deleteUserPancakeMapping(mappingId);

      // ชั่วครายว่าสำเร็จ
      setUserMappings(userMappings.filter(m => m.id !== mappingId));
      showMessage('success', 'ยกเลิกการเชื่อมต่อสำเร็จแล้ว');
    } catch (error) {
      console.error('Failed to delete mapping:', error);
      showMessage('error', 'ไม่สามารถยกเลิกการเชื่อมต่อได้');
    } finally {
      setLoading(false);
    }
  };

  const getInternalUser = (id: number) => internalUsers.find(u => u.id === id);
  const getPageUser = (id: number) => pageUsers.find(u => u.id === id);

  const filteredInternalUsers = internalUsers.filter(user =>
    user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPageUsers = pageUsers.filter(user =>
    user.page_user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.page_user_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">เชื่อมต่อผู้ใช้กับ Pancake</h1>
              <p className="text-gray-600">จัดการการเชื่อมต่อ user ภายในกับ user จาก Pancake API</p>
            </div>
          </div>
          <button
            onClick={() => window.open('https://pancake.in.th', '_blank')}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            เปิด Pancake
          </button>
        </div>
      </div>

      {/* Alert Message */}
      {message && (
        <div className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message.type === 'success' ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex gap-1 p-1">
            <button
              onClick={() => setActiveTab('mappings')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'mappings'
                  ? 'bg-orange-100 text-orange-700'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Link className="w-4 h-4" />
                การเชื่อมต่อทั้งหมด
              </div>
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'search'
                  ? 'bg-orange-100 text-orange-700'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                ค้นหาและเชื่อมต่อ
              </div>
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'mappings' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">รายการการเชื่อมต่อทั้งหมด</h2>
                <div className="text-sm text-gray-600">
                  พบ {userMappings.length} การเชื่อมต่อ
                </div>
              </div>

              <div className="space-y-3">
                {userMappings.map(mapping => {
                  const internalUser = getInternalUser(mapping.id_user);

                  if (!internalUser) return null;

                  return (
                    <div key={mapping.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <UserCheck className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {internalUser.first_name} {internalUser.last_name}
                            </div>
                            <div className="text-sm text-gray-600">{internalUser.email}</div>
                            <div className="text-xs text-gray-500">
                              {internalUser.role}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right text-sm text-gray-500">
                          เชื่อมต่อเมื่อ {mapping.created_at?.split('T')[0]}
                        </div>
                        <button
                          onClick={() => handleUnmapUsers(mapping.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="ยกเลิกการเชื่อมต่อ"
                        >
                          <Unlink className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {userMappings.length === 0 && (
                  <div className="text-center py-12">
                    <UserX className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">ยังไม่มีการเชื่อมต่อผู้ใช้</p>
                    <p className="text-sm text-gray-500 mt-2">ไปที่หน้า "ค้นหาและเชื่อมต่อ" เพื่อเริ่มสร้างการเชื่อมต่อ</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'search' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-6">ค้นหาและเชื่อมต่อผู้ใช้</h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Internal Users */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">
                    ผู้ใช้ Admin Page (Active)
                    <span className="ml-2 text-xs text-gray-500">
                      ({internalUsers.length} คน)
                    </span>
                  </h3>
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="ค้นหาผู้ใช้ Admin Page..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      disabled={loadingUsers}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100"
                    />
                  </div>

                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {loadingUsers ? (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-2" />
                        <span className="text-gray-600">กำลังโหลดข้อมูล...</span>
                      </div>
                    ) : filteredInternalUsers.length === 0 ? (
                      <div className="text-center py-8">
                        <UserX className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">ไม่พบผู้ใช้ Admin Page</p>
                        <p className="text-sm text-gray-500 mt-2">
                          ตรวจสอบว่ามีผู้ใช้ที่มีสถานะ Active และ Role เป็น Admin Page
                        </p>
                      </div>
                    ) : (
                      filteredInternalUsers.map(user => (
                        <div
                          key={user.id}
                          onClick={() => setSelectedInternalUser(user)}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedInternalUser?.id === user.id
                              ? 'border-orange-500 bg-orange-50'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="font-medium text-gray-900">
                            {user.first_name} {user.last_name}
                          </div>
                          <div className="text-sm text-gray-600">{user.email}</div>
                          <div className="text-xs text-gray-500">
                            {user.role}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Page Users */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">
                    ผู้ใช้เพจทั้งหมด
                    <span className="ml-2 text-xs text-gray-500">
                      ({pageUsers.length} คน)
                    </span>
                  </h3>
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="ค้นหาผู้ใช้เพจ..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      disabled={loadingPageUsers}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100"
                    />
                  </div>

                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {loadingPageUsers ? (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-2" />
                        <span className="text-gray-600">กำลังโหลดข้อมูล...</span>
                      </div>
                    ) : filteredPageUsers.length === 0 ? (
                      <div className="text-center py-8">
                        <UserX className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">ไม่พบข้อมูลผู้ใช้เพจ</p>
                      </div>
                    ) : (
                      filteredPageUsers.map(user => (
                        <div
                          key={user.id}
                          onClick={() => setSelectedPageUser(user)}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedPageUser?.id === user.id
                              ? 'border-orange-500 bg-orange-50'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className={`font-medium ${user.user_id === null ? 'text-red-600' : 'text-gray-900'}`}>
                            {user.page_user_name}
                            {user.user_id === null && (
                              <span className="ml-2 text-xs text-red-500">(ยังไม่มีการเชื่อมต่อ)</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">จำนวนเพจ: {user.page_count}</div>
                          <div className="text-xs text-gray-500">
                            ID: {user.page_user_id} • อัปเดตเมื่อ {user.updated_at?.split('T')[0]}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  {loadingUsers || loadingPageUsers ? (
                    <span className="text-blue-600">
                      กำลังโหลดข้อมูล...
                    </span>
                  ) : selectedInternalUser && selectedPageUser ? (
                    <span className="text-green-600">✓ เลือกผู้ใช้ครบแล้ว</span>
                  ) : (
                    <span>กรุณาเลือกผู้ใช้ทั้งสองระบบ</span>
                  )}
                </div>

                <button
                  onClick={handleMapUsers}
                  disabled={!selectedInternalUser || !selectedPageUser || loading}
                  className="flex items-center gap-2 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link className="w-4 h-4" />
                  )}
                  เชื่อมต่อผู้ใช้
                </button>
              </div>

              {/* Preview Selected Users */}
              {selectedInternalUser && selectedPageUser && (
                <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <h4 className="font-medium text-gray-900 mb-3">ตัวอย่างการเชื่อมต่อ:</h4>
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-sm text-gray-600">ผู้ใช้ภายใน:</div>
                      <div className="font-medium">
                        {selectedInternalUser.first_name} {selectedInternalUser.last_name}
                      </div>
                    </div>
                    <div className="text-orange-500">→</div>
                    <div>
                      <div className="text-sm text-gray-600">ผู้ใช้เพจ:</div>
                      <div className={`font-medium ${selectedPageUser.user_id === null ? 'text-red-600' : 'text-gray-900'}`}>
                        {selectedPageUser.page_user_name}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PancakeUserIntegrationPage;
