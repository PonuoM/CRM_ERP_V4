import React, { useState, useEffect } from 'react';
import { Search, UserCheck, UserX, RefreshCw, Link, Unlink, Check, X, AlertCircle, ExternalLink, Users, Database } from 'lucide-react';
import { listAdminPageUsers, AdminPageUser, listUserPancakeMappings, createUserPancakeMapping, UserPancakeMapping } from '../services/api';

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
  const [internalUsers, setInternalUsers] = useState<AdminPageUser[]>([]);
  const [pancakeUsers, setPancakeUsers] = useState<PancakeUser[]>([]);
  const [userMappings, setUserMappings] = useState<UserPancakeMapping[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInternalUser, setSelectedInternalUser] = useState<AdminPageUser | null>(null);
  const [selectedPancakeUser, setSelectedPancakeUser] = useState<PancakeUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ดึงข้อมูล Admin Page users จาก API
  useEffect(() => {
    loadAdminPageUsers();
    loadUserMappings();
    loadMockPancakeUsers();
  }, []);

  const loadAdminPageUsers = async () => {
    setLoadingUsers(true);
    try {
      const adminUsers = await listAdminPageUsers();
      const mappedUsers: AdminPageUser[] = adminUsers.map((user) => ({
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email || '',
        role: user.role,
        department: 'Admin Page',
        phone: user.phone || '',
      }));
      setInternalUsers(mappedUsers);
    } catch (error) {
      console.error('Failed to load Admin Page users:', error);
      showMessage('error', 'ไม่สามารถโหลดข้อมูลผู้ใช้ Admin Page ได้ กรุณาตรวจสอบ API connection');
      setInternalUsers([]);
    } finally {
      setLoadingUsers(false);
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

  const loadMockPancakeUsers = () => {
    setPancakeUsers([
      { id: 'pancake_001', name: 'สมชาย ใจดี', email: 'somchai@pancake.com', phone: '0812345678', avatar: '', created_at: '2024-01-15', last_active: '2024-12-20' },
      { id: 'pancake_002', name: 'TIK TOK SHOP', email: 'TIKTOK@Gmail.com', phone: '', avatar: '', created_at: '2024-10-02', last_active: null },
      { id: 'pancake_003', name: 'วิชัย มีสุข', email: 'wichai@pancake.com', phone: '0834567890', avatar: '', created_at: '2024-02-01', last_active: '2024-12-18' },
      { id: 'pancake_004', name: 'นฤมล สุขใจ', email: 'narumol@pancake.com', phone: '0845678901', avatar: '', created_at: '2024-02-10', last_active: '2024-12-17' },
      { id: 'pancake_005', name: 'ประเสริฐ รุ่งเรือง', email: 'prasert@pancake.com', phone: '0856789012', avatar: '', created_at: '2024-03-01', last_active: '2024-12-16' },
    ]);
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleMapUsers = async () => {
    if (!selectedInternalUser || !selectedPancakeUser) {
      showMessage('error', 'กรุณาเลือกผู้ใช้ทั้งสองระบบ');
      return;
    }

    setLoading(true);
    try {
      await createUserPancakeMapping(selectedInternalUser.id, selectedPancakeUser.id);

      // โหลดข้อมูลใหม่
      await loadUserMappings();

      setSelectedInternalUser(null);
      setSelectedPancakeUser(null);
      showMessage('success', 'เชื่อมต่อผู้ใช้สำเร็จแล้ว');
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
  const getPancakeUser = (id: string) => pancakeUsers.find(u => u.id === id);
  const getUnmappedPancakeUsers = () => {
    const mappedIds = userMappings.map(m => m.id_panake);
    return pancakeUsers.filter(u => !mappedIds.includes(u.id));
  };

  const filteredInternalUsers = internalUsers.filter(user =>
    user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPancakeUsers = getUnmappedPancakeUsers().filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
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
                  const pancakeUser = getPancakeUser(mapping.id_panake);

                  if (!internalUser || !pancakeUser) return null;

                  return (
                    <div key={mapping.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <UserCheck className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {internalUser.firstName} {internalUser.lastName}
                            </div>
                            <div className="text-sm text-gray-600">{internalUser.email}</div>
                            <div className="text-xs text-gray-500">
                              {internalUser.role} • {internalUser.department}
                            </div>
                          </div>
                        </div>

                        <div className="text-gray-400">
                          <Link className="w-4 h-4" />
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-orange-100 rounded-lg">
                            <Users className="w-4 h-4 text-orange-600" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{pancakeUser.name}</div>
                            <div className="text-sm text-gray-600">{pancakeUser.email}</div>
                            <div className="text-xs text-gray-500">
                              ID: {pancakeUser.id} • สร้างเมื่อ {pancakeUser.created_at}
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
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-sm text-gray-600">{user.email}</div>
                          <div className="text-xs text-gray-500">
                            {user.role} • {user.department}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Pancake Users */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">
                    ผู้ใช้จาก Pancake (ยังไม่เชื่อมต่อ)
                    <span className="ml-2 text-xs text-gray-500">
                      ({getUnmappedPancakeUsers().length} คน)
                    </span>
                  </h3>
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="ค้นหาผู้ใช้ Pancake..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>

                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {filteredPancakeUsers.map(user => (
                      <div
                        key={user.id}
                        onClick={() => setSelectedPancakeUser(user)}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedPancakeUser?.id === user.id
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-600">{user.email}</div>
                        <div className="text-xs text-gray-500">
                          ID: {user.id} • สร้างเมื่อ {user.created_at}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  {loadingUsers ? (
                    <span className="text-blue-600">
                      กำลังโหลดข้อมูลผู้ใช้ Admin Page...
                    </span>
                  ) : selectedInternalUser && selectedPancakeUser ? (
                    <span className="text-green-600">✓ เลือกผู้ใช้ครบแล้ว</span>
                  ) : (
                    <span>กรุณาเลือกผู้ใช้ทั้งสองระบบ</span>
                  )}
                </div>

                <button
                  onClick={handleMapUsers}
                  disabled={!selectedInternalUser || !selectedPancakeUser || loading}
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
              {selectedInternalUser && selectedPancakeUser && (
                <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <h4 className="font-medium text-gray-900 mb-3">ตัวอย่างการเชื่อมต่อ:</h4>
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-sm text-gray-600">ผู้ใช้ภายใน:</div>
                      <div className="font-medium">
                        {selectedInternalUser.firstName} {selectedInternalUser.lastName}
                      </div>
                    </div>
                    <div className="text-orange-500">→</div>
                    <div>
                      <div className="text-sm text-gray-600">ผู้ใช้ Pancake:</div>
                      <div className="font-medium">{selectedPancakeUser.name}</div>
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
