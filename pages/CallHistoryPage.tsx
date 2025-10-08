import React, { useMemo, useState } from 'react';
import { CallHistory, Customer, User, UserRole } from '@/types';
import { PhoneIncoming, PhoneOutgoing } from 'lucide-react';

interface CallHistoryPageProps {
  currentUser: User;
  calls: CallHistory[];
  customers: Customer[];
  users: User[];
}

const formatDate = (iso: string) => {
  try { return new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'medium' }); } catch { return iso; }
};

const CallHistoryPage: React.FC<CallHistoryPageProps> = ({ currentUser, calls, customers, users }) => {
  const [qCustomer, setQCustomer] = useState('');
  const [qCustomerPhone, setQCustomerPhone] = useState('');
  const [qAgentPhone, setQAgentPhone] = useState('');
  const [status, setStatus] = useState('all');
  const [direction, setDirection] = useState('all');
  const [range, setRange] = useState<{ start: string; end: string }>({ start: '', end: '' });

  const currentUserFull = `${currentUser.firstName} ${currentUser.lastName}`.trim();
  const isPrivileged = currentUser.role === UserRole.SuperAdmin || currentUser.role === UserRole.AdminControl;

  const customersById = useMemo(() => {
    const map: Record<string, Customer> = {};
    customers.forEach(c => { map[c.id] = c; });
    return map;
  }, [customers]);

  const filtered = useMemo(() => {
    return calls.filter(call => {
      // Role-based: non-privileged see only own calls
      if (!isPrivileged && call.caller !== currentUserFull) return false;

      // Date range
      if (range.start || range.end) {
        const d = new Date(call.date);
        if (range.start && d < new Date(range.start)) return false;
        if (range.end) {
          const e = new Date(range.end);
          e.setHours(23,59,59,999);
          if (d > e) return false;
        }
      }

      // Join customer
      const cust = customersById[call.customerId];
      const custName = cust ? `${cust.firstName} ${cust.lastName}` : '';
      const custPhone = cust?.phone || '';

      if (qCustomer && !custName.toLowerCase().includes(qCustomer.toLowerCase())) return false;
      if (qCustomerPhone && !custPhone.includes(qCustomerPhone)) return false;
      if (qAgentPhone && !(call.caller?.includes(qAgentPhone))) return false; // we don't have agent phone; keep as contains

      // Status filter (simple contains)
      if (status !== 'all') {
        const s = (call.status || '').toLowerCase();
        if (!s.includes(status.toLowerCase())) return false;
      }

      // Direction placeholder: if duration>0 -> outgoing assumed; we mark both as outgoing
      if (direction !== 'all') {
        // Without explicit field, treat all as outgoing for now
        if (direction === 'in') return false;
      }

      return true;
    }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [calls, isPrivileged, currentUserFull, range, qCustomer, qCustomerPhone, qAgentPhone, status, direction, customersById]);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">ประวัติการโทร</h2>
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">วันที่โทร (เริ่ม)</label>
            <input type="date" value={range.start} onChange={e=>setRange(r=>({ ...r, start: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">วันที่โทร (สิ้นสุด)</label>
            <input type="date" value={range.end} onChange={e=>setRange(r=>({ ...r, end: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">ชื่อลูกค้า</label>
            <input value={qCustomer} onChange={e=>setQCustomer(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="ค้นหาชื่อลูกค้า" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">เบอร์โทรลูกค้า</label>
            <input value={qCustomerPhone} onChange={e=>setQCustomerPhone(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="เช่น 08xxxxxxx" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">เบอร์/ชื่อพนักงานขาย</label>
            <input value={qAgentPhone} onChange={e=>setQAgentPhone(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="ค้นหา" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Direction</label>
            <select value={direction} onChange={e=>setDirection(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
              <option value="all">ทั้งหมด</option>
              <option value="out">โทรออก</option>
              <option value="in">รับสาย</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">สถานะ</label>
            <select value={status} onChange={e=>setStatus(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
              <option value="all">ทั้งหมด</option>
              <option value="รับ">รับสาย</option>
              <option value="ไม่รับ">ไม่รับ</option>
              <option value="พลาด">พลาด</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="px-4 py-2 bg-gray-700 text-white rounded-md text-sm" onClick={()=>{ /* filters already apply live */ }}>ค้นหา</button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500">
            <tr>
              <th className="py-2 px-3 font-medium">ID</th>
              <th className="py-2 px-3 font-medium">Datetime</th>
              <th className="py-2 px-3 font-medium">Duration</th>
              <th className="py-2 px-3 font-medium">ตัวแทนขาย</th>
              <th className="py-2 px-3 font-medium">Direction</th>
              <th className="py-2 px-3 font-medium">Status</th>
              <th className="py-2 px-3 font-medium">ลูกค้า</th>
              <th className="py-2 px-3 font-medium">เบอร์โทรลูกค้า</th>
              <th className="py-2 px-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(call => {
              const cust = customersById[call.customerId];
              const dirIcon = <PhoneOutgoing className="w-4 h-4 text-red-500"/>;
              const st = call.status || '';
              const stClass = st.includes('รับ') ? 'text-green-600' : 'text-gray-600';
              return (
                <tr key={call.id} className="border-t">
                  <td className="py-2 px-3 text-gray-600">{call.id}</td>
                  <td className="py-2 px-3">{formatDate(call.date)}</td>
                  <td className="py-2 px-3">{call.duration ?? '-'}</td>
                  <td className="py-2 px-3">{call.caller}</td>
                  <td className="py-2 px-3">{dirIcon}</td>
                  <td className={`py-2 px-3 ${stClass}`}>{call.status}</td>
                  <td className="py-2 px-3">{cust ? `${cust.firstName} ${cust.lastName}` : '-'}</td>
                  <td className="py-2 px-3">{cust?.phone || '-'}</td>
                  <td className="py-2 px-3 text-right">
                    <button className="text-blue-600 hover:underline">เล่นเสียง</button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr className="border-t"><td colSpan={9} className="py-8 text-center text-gray-500">ไม่พบข้อมูล</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CallHistoryPage;

