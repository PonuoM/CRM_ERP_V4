import React, { useEffect, useMemo, useState } from 'react';
import { Page, User } from '@/types';
import Modal from '@/components/Modal';
import { createPage, updatePage } from '@/services/api';

interface PagesManagementPageProps {
  pages?: Page[];
  currentUser?: User;
}

const PagesManagementPage: React.FC<PagesManagementPageProps> = ({ pages = [], currentUser }) => {
  const [keyword, setKeyword] = useState('');
  const [team, setTeam] = useState('all');
  const [status, setStatus] = useState('all');
  const [items, setItems] = useState<Page[]>(pages);

  useEffect(() => { setItems(pages); }, [pages]);

  const filtered = useMemo(() => {
    const k = keyword.toLowerCase();
    return items.filter(p => (
      (!k || p.name.toLowerCase().includes(k)) &&
      (status === 'all' || (status === 'active' ? p.active : !p.active))
    ));
  }, [items, keyword, status]);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">เพจ</h2>
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
          <div className="flex items-end">
            <AddPageButton currentUser={currentUser} onCreated={(p)=> setItems(prev => [p, ...prev])} />
          </div>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500">
            <tr>
              <th className="py-2 px-3 font-medium"><input type="checkbox" /></th>
              <th className="py-2 px-3 font-medium">ชื่อเพจ</th>
              <th className="py-2 px-3 font-medium">URL</th>
              <th className="py-2 px-3 font-medium">สถานะ</th>
              <th className="py-2 px-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-t">
                <td className="py-2 px-3"><input type="checkbox" /></td>
                <td className="py-2 px-3">{p.name}</td>
                <td className="py-2 px-3">{p.url ? (<a href={p.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{p.url}</a>) : (<span className="text-gray-400">-</span>)}</td>
                <td className="py-2 px-3">
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={!!p.active}
                      onChange={async (e) => {
                        const checked = e.target.checked;
                        try { await updatePage(p.id, { active: checked }); } catch {}
                        setItems(prev => prev.map(x => x.id === p.id ? { ...x, active: checked } : x));
                      }}
                    />
                    <div className="w-10 h-5 bg-gray-200 rounded-full transition-colors peer-checked:bg-green-500 relative after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:bg-white after:rounded-full after:shadow after:transition-all peer-checked:after:translate-x-5"></div>
                  </label>
                </td>
                <td className="py-2 px-3 text-right"><ManagePageButton page={p} onSaved={(updatedPage)=> setItems(prev => prev.map(x => x.id === updatedPage.id ? updatedPage : x))} /></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr className="border-t"><td colSpan={5} className="py-6 text-center text-gray-500">ไม่พบข้อมูล</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PagesManagementPage;

const ManagePageButton: React.FC<{ page: Page; onSaved: (updatedPage: Page) => void }> = ({ page, onSaved }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(page.name);
  const [url, setUrl] = useState(page.url || '');
  const [active, setActive] = useState(page.active);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePage(page.id, { name, url: url || undefined, active });
      onSaved({ ...page, name, url: url || undefined, active });
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
            <label className="relative inline-flex items-center cursor-pointer select-none space-x-2">
              <input type="checkbox" className="sr-only peer" checked={active} onChange={()=>setActive(!active)} />
              <div className="w-10 h-5 bg-gray-200 rounded-full transition-colors peer-checked:bg-green-500 relative after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:bg-white after:rounded-full after:shadow after:transition-all peer-checked:after:translate-x-5"></div>
              <span>ใช้งาน</span>
            </label>
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

const AddPageButton: React.FC<{ currentUser?: User; onCreated: (p: Page)=>void }> = ({ currentUser, onCreated }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [active, setActive] = useState(true);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      alert('กรุณากรอกชื่อเพจ');
      return;
    }
    
    setCreating(true);
    try {
      const res = await createPage({ 
        name: name.trim(), 
        url: url.trim() || undefined, 
        companyId: currentUser?.companyId || 1, 
        active 
      });
      const id = Number((res as any)?.id || Date.now());
      onCreated({ 
        id, 
        name: name.trim(), 
        url: url.trim() || undefined, 
        platform: 'Facebook', 
        companyId: currentUser?.companyId || 1, 
        active 
      } as any);
      setOpen(false);
      setName('');
      setUrl('');
      setActive(true);
    } catch (error) {
      console.error('Failed to create page:', error);
      alert('เกิดข้อผิดพลาดในการสร้างเพจ');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <button className="px-4 py-2 bg-red-600 text-white rounded-md text-sm mr-2" onClick={() => setOpen(true)}>เพิ่มเพจ Facebook</button>
      {open && (
        <Modal title="เพิ่มเพจ" onClose={() => setOpen(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">ชื่อ</label>
              <input 
                className="w-full border rounded-md px-3 py-2 text-sm" 
                value={name} 
                onChange={e=>setName(e.target.value)} 
                placeholder="ชื่อเพจ Facebook"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">URL</label>
              <input 
                className="w-full border rounded-md px-3 py-2 text-sm" 
                value={url} 
                onChange={e=>setUrl(e.target.value)} 
                placeholder="https://facebook.com/..."
              />
            </div>
            <label className="inline-flex items-center space-x-2">
              <input type="checkbox" checked={active} onChange={()=>setActive(!active)} />
              <span>ใช้งาน</span>
            </label>
            <div className="flex justify-end space-x-2">
              <button 
                className="px-4 py-2 border rounded-md text-sm" 
                onClick={() => setOpen(false)}
                disabled={creating}
              >
                ยกเลิก
              </button>
              <button 
                className="px-4 py-2 bg-green-600 text-white rounded-md text-sm disabled:opacity-50" 
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? 'กำลังสร้าง...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};



