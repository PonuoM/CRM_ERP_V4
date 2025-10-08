import React, { useMemo, useState } from 'react';
import { User } from '@/types';
import Modal from '@/components/Modal';

interface TeamsManagementPageProps {
  users?: User[];
}

const TeamsManagementPage: React.FC<TeamsManagementPageProps> = ({ users = [] }) => {
  const [keyword, setKeyword] = useState('');

  const rows = useMemo(() => {
    const k = keyword.toLowerCase();
    return users
      .map(u => ({ id: u.id, username: u.username, displayName: `${u.firstName} ${u.lastName}`, teamId: u.teamId ?? null }))
      .filter(r => !k || r.username.toLowerCase().includes(k) || r.displayName.toLowerCase().includes(k));
  }, [users, keyword]);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">ทีม</h2>
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">คำค้น</label>
            <input value={keyword} onChange={e=>setKeyword(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="ค้นหาผู้ใช้" />
          </div>
          <div className="flex items-end">
            <button className="px-4 py-2 bg-green-600 text-white rounded-md text-sm">เพิ่มทีม</button>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500">
            <tr>
              <th className="py-2 px-3 font-medium">ชื่อผู้ใช้</th>
              <th className="py-2 px-3 font-medium">ชื่อแสดง</th>
              <th className="py-2 px-3 font-medium">ทีม</th>
              <th className="py-2 px-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t">
                <td className="py-2 px-3">{r.username}</td>
                <td className="py-2 px-3">{r.displayName}</td>
                <td className="py-2 px-3">{r.teamId ?? '-'}</td>
                <td className="py-2 px-3 text-right"><ManageTeamButton userRow={r} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr className="border-t"><td colSpan={4} className="py-6 text-center text-gray-500">No users</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TeamsManagementPage;

const ManageTeamButton: React.FC<{ userRow: { id: number; username: string; displayName: string; teamId: number | null } }> = ({ userRow }) => {
  const [open, setOpen] = useState(false);
  const [teamId, setTeamId] = useState<number | ''>(userRow.teamId ?? '');
  return (
    <>
      <button className="text-blue-600 hover:underline" onClick={() => setOpen(true)}>Manage</button>
      {open && (
        <Modal title={`จัดการทีม: ${userRow.displayName}`} onClose={() => setOpen(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">รหัสทีม</label>
              <input type="number" value={teamId as any} onChange={e=>setTeamId(e.target.value === '' ? '' : Number(e.target.value))} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="กรอกรหัสทีม" />
              <p className="text-xs text-gray-500 mt-1">เดโม: กำหนดเป็นตัวเลขใดๆ ได้</p>
            </div>
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
