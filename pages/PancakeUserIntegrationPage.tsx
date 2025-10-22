import React, { useState, useEffect } from 'react';
import { Search, UserCheck, UserX, RefreshCw, Link, Unlink, Check, X, AlertCircle, ExternalLink, Users, Database } from 'lucide-react';
import { listAdminPageUsers, AdminPageUser, listUserPancakeMappings, createUserPancakeMapping, UserPancakeMapping } from '../services/api';
import PageIconFront from '@/components/PageIconFront';

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

interface PageWithUsers {
  page_id: string;
  page_name: string;
  platform: string;
  active: boolean;
  url: string;
  users: Array<{
    page_user_id: string;
    page_user_name: string;
    internal_user_id: number | null;
    is_connected: boolean;
    status: string;
  }>;
}

const PancakeUserIntegrationPage: React.FC<{ currentUser?: any }> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'mappings' | 'search'>('mappings');
  const [internalUsers, setInternalUsers] = useState<AdminPageUserFromDB[]>([]);
  const [pageUsers, setPageUsers] = useState<PageUserFromDB[]>([]);
  const [pagesWithUsers, setPagesWithUsers] = useState<PageWithUsers[]>([]);
  const [userMappings, setUserMappings] = useState<UserPancakeMapping[]>([]);
  const [internalSearchTerm, setInternalSearchTerm] = useState('');
  const [pageUserSearchTerm, setPageUserSearchTerm] = useState('');
  const [pageUserFilter, setPageUserFilter] = useState<'all' | 'connected' | 'unconnected'>('all');
  const [selectedInternalUser, setSelectedInternalUser] = useState<AdminPageUserFromDB | null>(null);
  const [selectedPageUser, setSelectedPageUser] = useState<PageUserFromDB | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingPageUsers, setLoadingPageUsers] = useState(false);
  const [loadingPagesWithUsers, setLoadingPagesWithUsers] = useState(false);
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ดึงข้อมูล Admin Page users จาก API
  useEffect(() => {
    loadAdminPageUsers();
    loadPageUsers();
    loadPagesWithUsers();
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

  const loadPagesWithUsers = async () => {
    setLoadingPagesWithUsers(true);
    try {
      const response = await fetch('api/get_pages_with_users.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          companyId: currentUser?.companyId || 1
        })
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const pagesData: PageWithUsers[] = await response.json();
      setPagesWithUsers(pagesData);
    } catch (error) {
      console.error('Failed to load pages with users:', error);
      showMessage('error', 'ไม่สามารถโหลดข้อมูลเพจและผู้ใช้ได้ กรุณาตรวจสอบ API connection');
      setPagesWithUsers([]);
    } finally {
      setLoadingPagesWithUsers(false);
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
      
      // Reload all data to reflect the changes
      await Promise.all([
        loadPageUsers(),
        loadPagesWithUsers()
      ]);
      
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

  const togglePageExpansion = (pageId: string) => {
    setExpandedPages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pageId)) {
        newSet.delete(pageId);
      } else {
        newSet.add(pageId);
      }
      return newSet;
    });
  };

  const handleUserClick = (user: any) => {
    // Find the corresponding page user in the pageUsers array
    const correspondingPageUser = pageUsers.find(pu => pu.page_user_id === user.page_user_id);
    
    if (correspondingPageUser) {
      // Select the page user
      setSelectedPageUser(correspondingPageUser);
      
      // Switch to the search tab
      setActiveTab('search');
      
      // Clear any selected internal user to allow new selection
      setSelectedInternalUser(null);
      
      // Scroll to the selected user after a short delay to ensure the tab has switched
      setTimeout(() => {
        const selectedUserElement = document.querySelector(`[data-page-user-id="${user.page_user_id}"]`);
        if (selectedUserElement) {
          selectedUserElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  };

  const getInternalUser = (id: number) => internalUsers.find(u => u.id === id);
  const getPageUser = (id: number) => pageUsers.find(u => u.id === id);

  const filteredInternalUsers = internalUsers.filter(user =>
    user.first_name.toLowerCase().includes(internalSearchTerm.toLowerCase()) ||
    user.last_name.toLowerCase().includes(internalSearchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(internalSearchTerm.toLowerCase())
  );

  const filteredPageUsers = pageUsers.filter(user => {
    // Apply search filter
    const matchesSearch = pageUserSearchTerm === '' ||
      user.page_user_name.toLowerCase().includes(pageUserSearchTerm.toLowerCase()) ||
      user.page_user_id.toLowerCase().includes(pageUserSearchTerm.toLowerCase());
    
    // Apply connection status filter
    const matchesFilter = pageUserFilter === 'all' ||
      (pageUserFilter === 'connected' && user.user_id !== null) ||
      (pageUserFilter === 'unconnected' && user.user_id === null);
    
    return matchesSearch && matchesFilter;
  });

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
                <h2 className="text-lg font-semibold text-gray-900">รายการเพจและผู้ใช้</h2>
                <div className="text-sm text-gray-600">
                  พบ {pagesWithUsers.length} เพจ
                </div>
              </div>

              <div className="space-y-3">
                {loadingPagesWithUsers ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-2" />
                    <span className="text-gray-600">กำลังโหลดข้อมูลเพจและผู้ใช้...</span>
                  </div>
                ) : pagesWithUsers.length === 0 ? (
                  <div className="text-center py-12">
                    <UserX className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">ไม่พบข้อมูลเพจ</p>
                    <p className="text-sm text-gray-500 mt-2">กรุณาอัปเดตข้อมูลเพจจากหน้า Pages Management</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pagesWithUsers.map(page => (
                      <div key={page.page_id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div
                          className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => togglePageExpansion(page.page_id)}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <PageIconFront platform={page.platform || 'unknown'} />
                              <div>
                                <div className="font-medium text-gray-900">
                                  {page.page_name}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {page.active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-600">
                                {page.users.length}
                              </span>
                              {expandedPages.has(page.page_id) ? (
                                <X className="w-4 h-4 text-gray-500" />
                              ) : (
                                <Check className="w-4 h-4 text-gray-500" />
                              )}
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <div className="text-sm text-gray-600">
                              ผู้ใช้ทั้งหมด
                            </div>
                            <div className="text-xs text-gray-500">
                              {page.users.filter(u => u.is_connected).length} เชื่อมต่อแล้ว
                            </div>
                          </div>
                        </div>
                        
                        {expandedPages.has(page.page_id) && (
                          <div className="p-4 bg-white border-t border-gray-200">
                            <h4 className="font-medium text-gray-900 mb-3">ผู้ใช้ในเพจ:</h4>
                            {page.users.length === 0 ? (
                              <p className="text-sm text-gray-500">ไม่มีผู้ใช้ในเพจนี้</p>
                            ) : (
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {page.users.map(user => (
                                  <div
                                    key={user.page_user_id}
                                    className={`flex items-center justify-between p-2 border border-gray-100 rounded ${!user.is_connected ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                                    onClick={() => !user.is_connected && handleUserClick(user)}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className={`w-2 h-2 rounded-full ${user.is_connected ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <div className={`text-sm font-medium ${user.is_connected ? 'text-green-900' : 'text-gray-900'} ${!user.is_connected ? 'hover:text-blue-600' : ''}`}>
                                            {user.page_user_name}
                                          </div>
                                          {/* Status Badge */}
                                          {user.status === 'active' && (
                                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                              active
                                            </span>
                                          )}
                                          {user.status === 'removed' && (
                                            <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                                              removed
                                            </span>
                                          )}
                                          {user.status !== 'active' && user.status !== 'removed' && (
                                            <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                                              {user.status}
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          ID: {user.page_user_id}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {user.is_connected ? (
                                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                          เชื่อมต่อ
                                        </span>
                                      ) : (
                                        <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                                          ไม่เชื่อมต่อ
                                        </span>
                                      )}
                                      {!user.is_connected && (
                                        <div className="text-xs text-blue-600">
                                          คลิกเพื่อเชื่อมต่อ
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
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
                      value={internalSearchTerm}
                      onChange={(e) => setInternalSearchTerm(e.target.value)}
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
                      value={pageUserSearchTerm}
                      onChange={(e) => setPageUserSearchTerm(e.target.value)}
                      disabled={loadingPageUsers}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setPageUserFilter('all')}
                      className={`px-3 py-1.5 text-sm rounded-md ${
                        pageUserFilter === 'all'
                          ? 'bg-orange-100 text-orange-700 border border-orange-300'
                          : 'bg-gray-100 text-gray-700 border border-gray-300'
                      }`}
                    >
                      ทั้งหมด
                    </button>
                    <button
                      onClick={() => setPageUserFilter('connected')}
                      className={`px-3 py-1.5 text-sm rounded-md ${
                        pageUserFilter === 'connected'
                          ? 'bg-green-100 text-green-700 border border-green-300'
                          : 'bg-gray-100 text-gray-700 border border-gray-300'
                      }`}
                    >
                      เชื่อมต่อแล้ว
                    </button>
                    <button
                      onClick={() => setPageUserFilter('unconnected')}
                      className={`px-3 py-1.5 text-sm rounded-md ${
                        pageUserFilter === 'unconnected'
                          ? 'bg-red-100 text-red-700 border border-red-300'
                          : 'bg-gray-100 text-gray-700 border border-gray-300'
                      }`}
                    >
                      ยังไม่เชื่อมต่อ
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    {pageUserFilter === 'all' && `แสดงทั้งหมด ${pageUsers.length} รายการ`}
                    {pageUserFilter === 'connected' && `แสดงเฉพาะที่เชื่อมต่อแล้ว ${pageUsers.filter(u => u.user_id !== null).length} รายการ`}
                    {pageUserFilter === 'unconnected' && `แสดงเฉพาะที่ยังไม่เชื่อมต่อ ${pageUsers.filter(u => u.user_id === null).length} รายการ`}
                  </div>

                  <div className="max-h-80 overflow-y-auto space-y-2">
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
                      filteredPageUsers.map(user => {
                        // Get the internal user if this page user is connected
                        const internalUser = user.user_id ? getInternalUser(user.user_id) : null;
                        
                        return (
                          <div
                            key={user.id}
                            data-page-user-id={user.page_user_id}
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
                            {internalUser && (
                              <div className="text-sm text-green-600">
                                เชื่อมต่อกับ: {internalUser.first_name} {internalUser.last_name}
                              </div>
                            )}
                            <div className="text-sm text-gray-600">จำนวนเพจ: {user.page_count}</div>
                            <div className="text-xs text-gray-500">
                              ID: {user.page_user_id} • อัปเดตเมื่อ {user.updated_at?.split('T')[0]}
                            </div>
                          </div>
                        );
                      })
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
                        {selectedPageUser.user_id && (
                          <span className="ml-2 text-sm text-green-600">
                            (เชื่อมต่อกับ: {getInternalUser(selectedPageUser.user_id)?.first_name} {getInternalUser(selectedPageUser.user_id)?.last_name})
                          </span>
                        )}
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
