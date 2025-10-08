import React, { useMemo, useState } from 'react';
import { CallHistory } from '@/types';
import { Phone, PhoneIncoming, Clock3, Users as UsersIcon, ChevronDown } from 'lucide-react';
import StatCard from '@/components/StatCard';

interface CallsDashboardProps {
  calls?: CallHistory[];
}

// Calls overview focused on layout only (neutral labels, no brand colors/names)
const CallsDashboard: React.FC<CallsDashboardProps> = ({ calls = [] }) => {
  const [month, setMonth] = useState<string>(() => String(new Date().getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState<string>(() => String(new Date().getFullYear()));

  const { totalCalls, answeredCalls, totalMinutes, avgMinutes } = useMemo(() => {
    const start = new Date(Number(year), Number(month) - 1, 1);
    const end = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);

    const monthly = calls.filter(c => {
      const d = new Date(c.date);
      return d >= start && d <= end;
    });

    const totalCalls = monthly.length;
    // Placeholder assumptions: status === 'answered' is considered answered
    const answeredCalls = monthly.filter(c => String(c.status).toLowerCase().includes('answer')).length;
    const totalMinutes = monthly.reduce((sum, c) => sum + Math.max(0, Math.round((c.duration || 0) / 60)), 0);
    const avgMinutes = totalCalls > 0 ? totalMinutes / totalCalls : 0;

    return { totalCalls, answeredCalls, totalMinutes, avgMinutes };
  }, [calls, month, year]);

  const monthOptions = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const yearOptions = [String(new Date().getFullYear()), String(new Date().getFullYear() - 1)];

  return (
    <div className="p-6">
      {/* Filters (layout only) */}
      <div className="bg-white border rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">เดือน</label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              {monthOptions.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">ปี</label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">มุมมอง</label>
            <button className="w-full border rounded-md px-3 py-2 text-sm flex items-center justify-between">
              <span>รายเดือน</span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard title="จำนวนสายทั้งหมด" value={totalCalls.toString()} subtext="ช่วงนี้" icon={Phone} />
        <StatCard title="รับสาย" value={answeredCalls.toString()} subtext="ช่วงนี้" icon={PhoneIncoming} />
        <StatCard title="เวลาสนทนา (นาที)" value={totalMinutes.toString()} subtext="รวม" icon={Clock3} />
        <StatCard title="เฉลี่ยต่อสาย (นาที)" value={avgMinutes.toFixed(2)} subtext="ต่อสาย" icon={UsersIcon} />
      </div>

      {/* Chart and summary table (placeholders) */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-md font-semibold text-gray-700 mb-4">แนวโน้มรายวัน</h3>
          <svg width="100%" height="260" viewBox="0 0 600 260" className="w-full">
            <line x1="40" y1="220" x2="580" y2="220" stroke="#E5E7EB" />
            <line x1="40" y1="180" x2="580" y2="180" stroke="#E5E7EB" />
            <line x1="40" y1="140" x2="580" y2="140" stroke="#E5E7EB" />
            <line x1="40" y1="100" x2="580" y2="100" stroke="#E5E7EB" />
            {/* Bars (static for layout) */}
            {[60, 120, 90, 150, 80, 110, 70].map((h, i) => (
              <rect key={i} x={60 + i * 70} y={220 - h} width="40" height={h} fill="#93C5FD" rx="4" />
            ))}
          </svg>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-md font-semibold text-gray-700">สรุปพนักงาน</h3>
            <button className="border px-3 py-1.5 rounded text-sm">ส่งออก</button>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500">
                <tr>
                  <th className="py-2 px-3 font-medium">พนักงาน</th>
                  <th className="py-2 px-3 font-medium">จำนวนสาย</th>
                  <th className="py-2 px-3 font-medium">รับสาย</th>
                  <th className="py-2 px-3 font-medium">เวลาสนทนา (นาที)</th>
                  <th className="py-2 px-3 font-medium">เฉลี่ยต่อสาย</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="py-2 px-3">—</td>
                  <td className="py-2 px-3">—</td>
                  <td className="py-2 px-3">—</td>
                  <td className="py-2 px-3">—</td>
                  <td className="py-2 px-3">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallsDashboard;
