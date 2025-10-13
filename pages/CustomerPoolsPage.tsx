import React, { useMemo, useState } from 'react';
import { Customer, User, ModalType } from '@/types';
import { Users, Clock, PackageOpen, UserCheck, Eye, PhoneCall } from 'lucide-react';
import { getRemainingTimeRounded } from '@/utils/time';

interface CustomerPoolsPageProps {
  customers: Customer[];
  users: User[];
  currentUser: User;
  onViewCustomer: (customer: Customer) => void;
  openModal?: (type: ModalType, data: any) => void;
}

type PoolTab = 'ready' | 'basket' | 'assigned';

const dayDiff = (from?: string) => {
  if (!from) return null;
  const start = new Date(from);
  const now = new Date();
  const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diff < 0 ? 0 : diff;
};

const CustomerPoolsPage: React.FC<CustomerPoolsPageProps> = ({ customers, users, currentUser, onViewCustomer, openModal }) => {
  const [active, setActive] = useState<PoolTab>('ready');
  const [search, setSearch] = useState('');

  const getUserName = (id: number | null) => {
    if (id === null || typeof id === 'undefined') return '-';
    const u = users.find(x => x.id === id);
    return u ? `${u.firstName} ${u.lastName}` : '-';
  };

  // Pools
  const readyToDistribute = useMemo(() => {
    return customers.filter(c => (c.assignedTo === null || typeof c.assignedTo === 'undefined') && !c.isInWaitingBasket);
  }, [customers]);

  const inWaitingBasket = useMemo(() => customers.filter(c => !!c.isInWaitingBasket), [customers]);

  const underCare = useMemo(() => customers.filter(c => c.assignedTo !== null && typeof c.assignedTo !== 'undefined'), [customers]);

  // Counts
  const counts = {
    ready: readyToDistribute.length,
    basket: inWaitingBasket.length,
    assigned: underCare.length,
  };

  // Active list with search
  const filteredList = useMemo(() => {
    const lower = search.trim().toLowerCase();
    const base = active === 'ready' ? readyToDistribute : active === 'basket' ? inWaitingBasket : underCare;
    if (!lower) return base;
    return base.filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(lower) || c.phone.includes(lower));
  }, [active, search, readyToDistribute, inWaitingBasket, underCare]);

  // Render helpers
  const renderTimeCell = (c: Customer) => {
    if (active === 'ready') {
      const days = dayDiff(c.waitingBasketStartDate);
      return <span className="text-gray-700">{typeof days === 'number' ? `${days} วันในตะกร้า` : '-'}</span>;
    }
    if (active === 'basket') {
      const daysIn = dayDiff(c.waitingBasketStartDate) ?? 0;
      const remaining = Math.max(0, 30 - daysIn);
      const color = remaining <= 5 ? 'text-orange-600 font-semibold' : 'text-gray-700';
      return <span className={color}>{remaining} วันคงเหลือ</span>;
    }
    // assigned
    const rem = getRemainingTimeRounded(c.ownershipExpires);
    return <span className={rem.color}>{rem.text}</span>;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">ตระกร้าลูกค้า</h1>
        <p className="text-gray-600 mt-1">ดูจำนวนลูกค้าแต่ละสถานะ และกดเพื่อดูรายละเอียด</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button onClick={() => setActive('ready')} className={`bg-white border rounded-lg p-4 text-left hover:shadow ${active==='ready'?'ring-2 ring-blue-500':''}`}>
          <div className="flex items-center">
            <PackageOpen className="text-blue-600 mr-3" />
            <div>
              <div className="text-sm text-gray-600">ลูกค้าพร้อมแจก</div>
              <div className="text-2xl font-semibold text-gray-900">{counts.ready.toLocaleString()}</div>
            </div>
          </div>
        </button>
        <button onClick={() => setActive('basket')} className={`bg-white border rounded-lg p-4 text-left hover:shadow ${active==='basket'?'ring-2 ring-blue-500':''}`}>
          <div className="flex items-center">
            <Clock className="text-amber-600 mr-3" />
            <div>
              <div className="text-sm text-gray-600">ลูกค้าพัก (ตะกร้า 30 วัน)</div>
              <div className="text-2xl font-semibold text-gray-900">{counts.basket.toLocaleString()}</div>
            </div>
          </div>
        </button>
        <button onClick={() => setActive('assigned')} className={`bg-white border rounded-lg p-4 text-left hover:shadow ${active==='assigned'?'ring-2 ring-blue-500':''}`}>
          <div className="flex items-center">
            <UserCheck className="text-green-600 mr-3" />
            <div>
              <div className="text-sm text-gray-600">ลูกค้าอยู่ระหว่างการดูแล</div>
              <div className="text-2xl font-semibold text-gray-900">{counts.assigned.toLocaleString()}</div>
            </div>
          </div>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 border rounded-lg">
        <div className="flex items-center space-x-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหา: ชื่อ/เบอร์โทร"
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-80"
          />
        </div>
      </div>

      {/* List */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-6 py-3 border-b flex items-center justify-between">
          <div className="text-lg font-semibold text-gray-800">
            {active === 'ready' && 'ลูกค้าพร้อมแจก'}
            {active === 'basket' && 'ลูกค้าพัก (ตะกร้า 30 วัน)'}
            {active === 'assigned' && 'ลูกค้าที่อยู่ในการดูแล'}
          </div>
          <div className="text-sm text-gray-500">{filteredList.length.toLocaleString()} รายการ</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-gray-700">
            <thead className="bg-gray-50 text-xs uppercase">
              <tr>
                <th className="px-6 py-3 text-left">ลูกค้า</th>
                <th className="px-6 py-3 text-left">จังหวัด</th>
                <th className="px-6 py-3 text-left">{active==='assigned' ? 'เวลาที่เหลือ' : active==='basket' ? 'เวลาที่เหลือ (30 วัน)' : 'อยู่ในตะกร้าแล้ว'}</th>
                {active==='assigned' && <th className="px-6 py-3 text-left">ผู้ดูแล</th>}
                <th className="px-6 py-3 text-left">การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map(c => (
                <tr key={c.id} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">{c.firstName} {c.lastName}</span>
                      <span className="text-xs text-gray-500">{c.phone}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3">{c.province}</td>
                  <td className="px-6 py-3">{renderTimeCell(c)}</td>
                  {active==='assigned' && <td className="px-6 py-3">{getUserName(c.assignedTo)}</td>}
                  <td className="px-6 py-3 flex items-center space-x-2">
                    <button onClick={() => onViewCustomer(c)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full" title="ข้อมูลลูกค้า"><Eye size={16} /></button>
                    {openModal && <button onClick={() => openModal('logCall', c)} className="p-2 text-green-600 hover:bg-green-100 rounded-full" title="โทร/บันทึกการโทร"><PhoneCall size={16} /></button>}
                  </td>
                </tr>
              ))}
              {filteredList.length === 0 && (
                <tr>
                  <td className="px-6 py-8 text-center text-gray-500" colSpan={active==='assigned' ? 5 : 4}>ไม่พบข้อมูล</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CustomerPoolsPage;
