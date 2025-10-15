import React, { useEffect, useMemo, useState } from 'react';
import { Page, User } from '@/types';
import Modal from '@/components/Modal';
import { createPage, updatePage, listPages } from '@/services/api';


// Function to sync pages from pages.fm API to database
const syncPagesWithDatabase = async (currentUser?: User) => {
  try {
    const accessToken = (import.meta as any).env.VITE_PANCAKE_ACCESS_TOKEN || '';
    
    if (!accessToken) {
      console.error('ACCESS_TOKEN not found in environment variables');
      return { success: false, error: 'ACCESS_TOKEN not found' };
    }

    // Build URL with access_token parameter
    const url = new URL('https://pages.fm/api/v1/pages');
    url.searchParams.append('access_token', accessToken);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Pages.fm API Response:', data);
    
    // Sync data with database if we have categorized pages
    if (data && data.categorized && currentUser) {
      try {
        // Combine activated and inactivated pages
        const allPages = [
          ...(data.categorized.activated || []),
          ...(data.categorized.inactivated || [])
        ];
        
        // Prepare pages data for sync
        const pagesToSync = allPages.map((page: any) => {
          // Count users for this page
          const userCount = page.users && Array.isArray(page.users) ? page.users.length : 0;
          
          return {
            id: page.id,
            name: page.name,
            platform: page.platform,
            is_activated: page.is_activated,
            category: page.is_activated ? 'activated' : 'inactivated',
            user_count: userCount
          };
        });
        
        // Sync with database using the new endpoint
        console.log('Preparing to sync pages:', pagesToSync.length, 'pages');
        console.log('Company ID:', currentUser.companyId || 1);
        
        const response = await fetch('api/Page_DB/sync_pages.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            pages: pagesToSync,
            companyId: currentUser.companyId || 1
          })
        });
        
        console.log('Sync response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Sync response error:', errorText);
          throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
        }
        
        const result = await response.json();
        console.log('Sync response result:', result);
        
        // Debug: Log error details if they exist
        if (result.errorDetails && result.errorDetails.length > 0) {
          console.log('Error details:', result.errorDetails);
        } else {
          console.log('No error details found in response');
        }
        
        if (!result.ok) {
          throw new Error(result.error || 'Database sync failed');
        }
        
        console.log(`Pages synced with database successfully. Total: ${result.synced}, Inserted: ${result.inserted}, Updated: ${result.updated}, Skipped: ${result.skipped}, Errors: ${result.errors}`);
        return { success: true, count: pagesToSync.length, inserted: result.inserted, updated: result.updated, skipped: result.skipped, errors: result.errors, pages: pagesToSync, errorDetails: result.errorDetails };
      } catch (syncError) {
        console.error('Error syncing pages with database:', syncError);
        return { success: false, error: 'Database sync failed' };
      }
    }
    
    return { success: false, error: 'No categorized data found' };
  } catch (error) {
    console.error('Error fetching pages from pages.fm API:', error);
    return { success: false, error: 'API fetch failed' };
  }
};

interface PagesManagementPageProps {
  pages?: Page[];
  currentUser?: User;
}

const PagesManagementPage: React.FC<PagesManagementPageProps> = ({ pages = [], currentUser }) => {
  const [keyword, setKeyword] = useState('');
  const [team, setTeam] = useState('all');
  const [status, setStatus] = useState('all');
  const [items, setItems] = useState<Page[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [showHiddenPages, setShowHiddenPages] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch pages from API
  const fetchPages = async () => {
    setLoading(true);
    try {
      const pagesData = await listPages(currentUser?.companyId);
      setItems(pagesData);
      console.log('Fetched pages:', pagesData);
      console.log('Pages with still_in_list = 0:', pagesData.filter(p => p.still_in_list === 0));
    } catch (error) {
      console.error('Error fetching pages:', error);
      // Use initial pages if API fails
      setItems(pages);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPages();
  }, [currentUser?.companyId]);

  // Filter pages based on still_in_list
  const visiblePages = useMemo(() => {
    const filtered = items.filter(p => p.still_in_list !== 0);
    console.log('Visible pages:', filtered);
    return filtered;
  }, [items]);

  const hiddenPages = useMemo(() => {
    const filtered = items.filter(p => p.still_in_list === 0);
    console.log('Hidden pages:', filtered);
    return filtered;
  }, [items]);

  const filtered = useMemo(() => {
    const k = keyword.toLowerCase();
    return visiblePages.filter(p => (
      (!k || p.name.toLowerCase().includes(k)) &&
      (status === 'all' || (status === 'active' ? p.active : !p.active))
    ));
  }, [visiblePages, keyword, status]);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">เพจ</h2>
      
      
      {/* Sync Results Table */}
      {syncResult && syncResult.success && syncResult.pages && (
        <div className="bg-white p-4 rounded-lg shadow-sm border mb-4">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">ผลลัพธ์การอัปเดตข้อมูล</h3>
          <div className={`mb-4 p-3 rounded-md ${syncResult.errors > 0 ? 'bg-red-50' : 'bg-blue-50'}`}>
            <p className={`text-sm ${syncResult.errors > 0 ? 'text-red-800' : 'text-blue-800'}`}>
              อัปเดตสำเร็จ: {syncResult.count} เพจ (เพิ่ม {syncResult.inserted}, อัปเดต {syncResult.updated}, ข้าม {syncResult.skipped}, ข้อผิดพลาด {syncResult.errors})
            </p>
          </div>
          
          {/* Error Details */}
          {syncResult.errorDetails && syncResult.errorDetails.length > 0 && (
            <div className="mb-4">
              <h4 className="text-md font-semibold text-red-700 mb-2">รายละเอียดข้อผิดพลาด:</h4>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-gray-500">
                    <tr>
                      <th className="py-2 px-3 font-medium">Page ID</th>
                      <th className="py-2 px-3 font-medium">Operation</th>
                      <th className="py-2 px-3 font-medium">Raw Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncResult.errorDetails.map((error: any, index: number) => (
                      <tr key={index} className="border-t">
                        <td className="py-2 px-3">{error.pageId}</td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            error.operation === 'insert'
                              ? 'text-green-600 bg-green-100'
                              : 'text-blue-600 bg-blue-100'
                          }`}>
                            {error.operation}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-red-600 font-mono text-xs whitespace-pre-wrap">{error.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Raw Error Messages */}
              <div className="mt-4">
                <h4 className="text-md font-semibold text-red-700 mb-2">Raw Error Messages:</h4>
                <div className="bg-gray-100 p-3 rounded-md overflow-auto">
                  <pre className="text-xs font-mono text-red-600 whitespace-pre-wrap">
                    {syncResult.errorDetails.map((error: any, index: number) => (
                      <div key={index}>
                        <strong>Page {error.pageId} ({error.operation}):</strong> {error.error}
                      </div>
                    ))}
                  </pre>
                </div>
              </div>
            </div>
          )}
          
          {/* SQL Commands */}
          <div className="mb-4">
            <div className="flex space-x-4 mb-2">
              <button
                className="px-3 py-1 bg-green-600 text-white text-sm rounded"
                onClick={() => {
                  const sqlTextarea = document.getElementById('insert-sql-textarea') as HTMLTextAreaElement;
                  if (sqlTextarea) {
                    sqlTextarea.select();
                    document.execCommand('copy');
                  }
                }}
              >
                คัดลอก Insert SQL
              </button>
              <button
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded"
                onClick={() => {
                  const sqlTextarea = document.getElementById('update-sql-textarea') as HTMLTextAreaElement;
                  if (sqlTextarea) {
                    sqlTextarea.select();
                    document.execCommand('copy');
                  }
                }}
              >
                คัดลอก Update SQL
              </button>
            </div>
            
            {/* Insert SQL */}
            {syncResult.insertSQLs && syncResult.insertSQLs.length > 0 && (
              <div className="mb-4">
                <h4 className="text-md font-semibold text-gray-700 mb-2">คำสั่ง Insert SQL ({syncResult.insertSQLs.length} รายการ):</h4>
                <textarea
                  id="insert-sql-textarea"
                  className="w-full h-32 p-2 border rounded-md text-xs font-mono bg-gray-50"
                  value={syncResult.insertSQLs.join(';\n')}
                  readOnly
                />
              </div>
            )}
            
            {/* Update SQL */}
            {syncResult.updateSQLs && syncResult.updateSQLs.length > 0 && (
              <div className="mb-4">
                <h4 className="text-md font-semibold text-gray-700 mb-2">คำสั่ง Update SQL ({syncResult.updateSQLs.length} รายการ):</h4>
                <textarea
                  id="update-sql-textarea"
                  className="w-full h-32 p-2 border rounded-md text-xs font-mono bg-gray-50"
                  value={syncResult.updateSQLs.join(';\n')}
                  readOnly
                />
              </div>
            )}
          </div>
          
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500">
                <tr>
                  <th className="py-2 px-3 font-medium">Page ID</th>
                  <th className="py-2 px-3 font-medium">Name</th>
                  <th className="py-2 px-3 font-medium">Platform</th>
                  <th className="py-2 px-3 font-medium">Active</th>
                  <th className="py-2 px-3 font-medium">ผู้ดูแล</th>
                </tr>
              </thead>
              <tbody>
                {syncResult.pages.map((page: any, index: number) => (
                  <tr key={index} className="border-t">
                    <td className="py-2 px-3">{page.id}</td>
                    <td className="py-2 px-3">{page.name}</td>
                    <td className="py-2 px-3">{page.platform}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        page.is_activated
                          ? 'text-green-600 bg-green-100'
                          : 'text-red-600 bg-red-100'
                      }`}>
                        {page.is_activated ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      </span>
                    </td>
                    <td className="py-2 px-3">{page.user_count || 0} คน</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">คำค้น</label>
            <input value={keyword} onChange={e=>setKeyword(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="ค้นหา" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">ทีม</label>
            <select value={team} onChange={e=>setTeam(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
              <option value="all">ทั้งหมด</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">สถานะ</label>
            <select value={status} onChange={e=>setStatus(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
              <option value="all">ทั้งหมด</option>
              <option value="active">ใช้งาน</option>
              <option value="inactive">ไม่ใช้งาน</option>
            </select>
          </div>
          <div className="flex items-end space-x-2">
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm disabled:opacity-50"
              onClick={async () => {
                if (!currentUser) {
                  alert('ไม่พบข้อมูลผู้ใช้');
                  return;
                }
                
                setSyncing(true);
                try {
                  const result = await syncPagesWithDatabase(currentUser);
                  setSyncResult(result);
                  if (result.success) {
                    alert(`อัปเดตข้อมูลสำเร็จ: ${result.count} เพจ (เพิ่ม ${result.inserted}, อัปเดต ${result.updated}, ข้าม ${result.skipped}, ข้อผิดพลาด ${result.errors})`);
                    // Refresh pages data after sync
                    fetchPages();
                  } else {
                    alert(`อัปเดตข้อมูลล้มเหลว: ${result.error}`);
                  }
                } catch (error) {
                  console.error('Sync error:', error);
                  alert('เกิดข้อผิดพลาดในการอัปเดตข้อมูล');
                } finally {
                  setSyncing(false);
                }
              }}
              disabled={syncing}
            >
              {syncing ? 'กำลังอัปเดต...' : 'อัปเดตข้อมูล'}
            </button>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border overflow-auto">
        <div className="p-4 border-b">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              จำนวนเพจที่แสดง: <span className="font-semibold text-gray-800">{visiblePages.length}</span> เพจ
              {loading && <span className="ml-2 text-blue-600">กำลังโหลด...</span>}
              {hiddenPages.length > 0 && (
                <span className="ml-4">
                  (ซ่อนอยู่: <span className="font-semibold text-red-600">{hiddenPages.length}</span> เพจ)
                </span>
              )}
            </p>
            <div className="flex space-x-2">
              <button
                className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200"
                onClick={() => fetchPages()}
                disabled={loading}
              >
                {loading ? 'กำลังโหลด...' : 'รีเฟรช'}
              </button>
              {hiddenPages.length > 0 && (
                <button
                  className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                  onClick={() => setShowHiddenPages(!showHiddenPages)}
                >
                  {showHiddenPages ? 'ซ่อนเพจที่ถูกซ่อน' : 'แสดงเพจที่ถูกซ่อน'}
                </button>
              )}
            </div>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500">
            <tr>
              <th className="py-2 px-3 font-medium">ชื่อเพจ</th>
              <th className="py-2 px-3 font-medium">URL</th>
              <th className="py-2 px-3 font-medium">สถานะ</th>
              <th className="py-2 px-3 font-medium">ผู้ดูแล</th>
              <th className="py-2 px-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-t">
                <td className="py-2 px-3">{p.name}</td>
                <td className="py-2 px-3">{p.url ? (<a href={p.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{p.url}</a>) : (<span className="text-gray-400">-</span>)}</td>
                <td className="py-2 px-3">
                  <span className={p.active ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                    {p.active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                  </span>
                </td>
                <td className="py-2 px-3">
                  {syncResult && syncResult.pages && syncResult.pages.find((sp: any) => sp.id === p.id)
                    ? syncResult.pages.find((sp: any) => sp.id === p.id).user_count || 0
                    : 0
                  } คน
                </td>
                <td className="py-2 px-3 text-right"><ManagePageButton page={p} onSaved={(updatedPage)=> setItems(prev => prev.map(x => x.id === updatedPage.id ? updatedPage : x))} /></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr className="border-t"><td colSpan={5} className="py-6 text-center text-gray-500">ไม่พบข้อมูล</td></tr>
            )}
          </tbody>
        </table>
        
        {/* Hidden Pages Section */}
        {showHiddenPages && hiddenPages.length > 0 && (
          <div className="border-t">
            <div className="p-4 bg-gray-50">
              <h3 className="text-md font-semibold text-gray-700 mb-3">เพจที่ถูกซ่อน ({hiddenPages.length} เพจ)</h3>
              <table className="w-full text-sm">
                <thead className="text-left text-gray-500">
                  <tr>
                    <th className="py-2 px-3 font-medium">ชื่อเพจ</th>
                    <th className="py-2 px-3 font-medium">URL</th>
                    <th className="py-2 px-3 font-medium">สถานะ</th>
                    <th className="py-2 px-3 font-medium">ผู้ดูแล</th>
                    <th className="py-2 px-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {hiddenPages.map(p => (
                    <tr key={p.id} className="border-t opacity-60">
                      <td className="py-2 px-3">{p.name}</td>
                      <td className="py-2 px-3">{p.url ? (<a href={p.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{p.url}</a>) : (<span className="text-gray-400">-</span>)}</td>
                      <td className="py-2 px-3">
                        <span className={p.active ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                          {p.active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        {syncResult && syncResult.pages && syncResult.pages.find((sp: any) => sp.id === p.id)
                          ? syncResult.pages.find((sp: any) => sp.id === p.id).user_count || 0
                          : 0
                        } คน
                      </td>
                      <td className="py-2 px-3 text-right"><ManagePageButton page={p} onSaved={(updatedPage)=> setItems(prev => prev.map(x => x.id === updatedPage.id ? updatedPage : x))} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PagesManagementPage;

const ManagePageButton: React.FC<{ page: Page; onSaved: (updatedPage: Page) => void }> = ({ page, onSaved }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(page.name);
  const [url, setUrl] = useState(page.url || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePage(page.id, { name, url: url || undefined });
      onSaved({ ...page, name, url: url || undefined });
      setOpen(false);
    } catch (error) {
      console.error('Failed to update page:', error);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button className="text-blue-600 hover:underline" onClick={() => setOpen(true)}>จัดการ</button>
      {open && (
        <Modal title={`จัดการเพจ: ${page.name}`} onClose={() => setOpen(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">ชื่อ</label>
              <input className="w-full border rounded-md px-3 py-2 text-sm" value={name} onChange={e=>setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">URL</label>
              <input className="w-full border rounded-md px-3 py-2 text-sm" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://facebook.com/..." />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                className="px-4 py-2 border rounded-md text-sm"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                ยกเลิก
              </button>
              <button
                className="px-4 py-2 bg-green-600 text-white rounded-md text-sm disabled:opacity-50"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};




