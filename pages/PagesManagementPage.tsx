import React, { useMemo, useState } from 'react';
import { Page } from '@/types';
import Modal from '@/components/Modal';

interface PagesManagementPageProps {
  pages?: Page[];
}

const PagesManagementPage: React.FC<PagesManagementPageProps> = ({ pages = [] }) => {
  const [keyword, setKeyword] = useState('');
  const [team, setTeam] = useState('all');
  const [status, setStatus] = useState('all');

  const filtered = useMemo(() => {
    const k = keyword.toLowerCase();
    return pages.filter(p => (
      (!k || p.name.toLowerCase().includes(k)) &&
      (status === 'all' || (status === 'active' ? p.active : !p.active))
    ));
  }, [pages, keyword, status]);

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
            <button className="px-4 py-2 bg-red-600 text-white rounded-md text-sm mr-2">เพิ่มเพจ Facebook</button>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500">
            <tr>
              <th className="py-2 px-3 font-medium"><input type="checkbox" /></th>
              <th className="py-2 px-3 font-medium">เพจ</th>
              <th className="py-2 px-3 font-medium">ใช้งาน</th>
              <th className="py-2 px-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-t">
                <td className="py-2 px-3"><input type="checkbox" /></td>
                <td className="py-2 px-3">{p.name}</td>
                <td className="py-2 px-3">
                  <label className="inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only" defaultChecked={p.active} />
                    <div className="w-10 h-5 bg-gray-200 rounded-full peer checked:bg-pink-500"></div>
                  </label>
                </td>
                <td className="py-2 px-3 text-right"><ManagePageButton page={p} /></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr className="border-t"><td colSpan={4} className="py-6 text-center text-gray-500">No pages</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PagesManagementPage;

const ManagePageButton: React.FC<{ page: Page }> = ({ page }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(page.name);
  const [url, setUrl] = useState(page.url || '');
  const [active, setActive] = useState(page.active);
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
              <input className="w-full border rounded-md px-3 py-2 text-sm" value={url} onChange={e=>setUrl(e.target.value)} />
            </div>
            <label className="inline-flex items-center space-x-2">
              <input type="checkbox" checked={active} onChange={()=>setActive(!active)} />
              <span>ใช้งาน</span>
            </label>
            <div className="flex justify-end space-x-2">
              <button className="px-4 py-2 border rounded-md text-sm" onClick={() => setOpen(false)}>ยกเลิก</button>
              <button className="px-4 py-2 bg-green-600 text-white rounded-md text-sm" onClick={() => setOpen(false)}>บันทึก</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
