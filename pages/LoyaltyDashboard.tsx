import React, { useEffect, useState } from 'react';
import { Target, TrendingUp, Users, DollarSign, Award, ChevronUp, ChevronDown } from 'lucide-react';
import { apiFetch } from '../services/api';

interface KPIData {
  aov: number;
  repeatRate: number;
  membersWithPoints: number;
  membersWith10Points: number;
  totalSales: number;
  totalUsers: number;
}

const LoyaltyDashboard: React.FC = () => {
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKPI = async () => {
      try {
        const res = await apiFetch('shopee_loyalty?action=kpi');
        setData(res);
      } catch (err) {
        console.error('Failed to load KPI', err);
      } finally {
        setLoading(false);
      }
    };
    fetchKPI();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">กำลังโหลด Dashboard...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">ไม่สามารถโหลดข้อมูล KPI ได้</div>;
  }

  // Targets
  const targetAOV = 850;
  const targetRepeatRate = 25;
  const baselineAOV = 696;
  const baselineRepeatRate = 17.78;

  const getProgressStatus = (current: number, target: number) => {
    const percent = (current / target) * 100;
    if (percent >= 100) return { color: 'text-green-600', bg: 'bg-green-100', icon: <ChevronUp className="h-4 w-4" /> };
    if (percent >= 80) return { color: 'text-yellow-600', bg: 'bg-yellow-100', icon: <ChevronUp className="h-4 w-4" /> };
    return { color: 'text-red-600', bg: 'bg-red-100', icon: <ChevronDown className="h-4 w-4" /> };
  };

  const aovStatus = getProgressStatus(data.aov, targetAOV);
  const rrStatus = getProgressStatus(data.repeatRate, targetRepeatRate);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="h-6 w-6 text-blue-500" />
            Loyalty KPI Dashboard
          </h1>
          <p className="text-gray-500 mt-1">วัดผลประสิทธิภาพโครงการ Shopee Loyalty เทียบกับเป้าหมาย</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* AOV Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">AOV (ยอดซื้อต่อบิล)</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-2">฿{data.aov.toLocaleString()}</h3>
            </div>
            <div className={`p-3 rounded-lg ${aovStatus.bg} ${aovStatus.color}`}>
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className={`flex items-center font-medium ${aovStatus.color}`}>
              {aovStatus.icon}
              {Math.abs(data.aov - baselineAOV).toFixed(0)} บาทจากเดิม
            </span>
            <span className="text-gray-400">| เป้า: ฿{targetAOV}</span>
          </div>
          {/* Progress Bar */}
          <div className="mt-4 w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min((data.aov/targetAOV)*100, 100)}%` }}></div>
          </div>
        </div>

        {/* Repeat Rate Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Repeat Rate</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-2">{data.repeatRate}%</h3>
            </div>
            <div className={`p-3 rounded-lg ${rrStatus.bg} ${rrStatus.color}`}>
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className={`flex items-center font-medium ${rrStatus.color}`}>
              {rrStatus.icon}
              {Math.abs(data.repeatRate - baselineRepeatRate).toFixed(2)}% จากเดิม
            </span>
            <span className="text-gray-400">| เป้า: {targetRepeatRate}%</span>
          </div>
          <div className="mt-4 w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min((data.repeatRate/targetRepeatRate)*100, 100)}%` }}></div>
          </div>
        </div>

        {/* Members Enrolled */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">สมาชิกร่วมสะสมแต้ม</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-2">{data.membersWithPoints}</h3>
            </div>
            <div className="p-3 rounded-lg bg-purple-100 text-purple-600">
              <Users className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="text-gray-500">เป้าหมาย: 100 คน</span>
          </div>
          <div className="mt-4 w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${Math.min((data.membersWithPoints/100)*100, 100)}%` }}></div>
          </div>
        </div>

        {/* 10-Point Members */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">ลูกค้า 10 แต้ม (คูปอง)</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-2">{data.membersWith10Points}</h3>
            </div>
            <div className="p-3 rounded-lg bg-orange-100 text-orange-600">
              <Award className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="text-gray-500">เป้าหมาย: 20 คน</span>
          </div>
          <div className="mt-4 w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${Math.min((data.membersWith10Points/20)*100, 100)}%` }}></div>
          </div>
        </div>
      </div>

      {/* Summary Chart/Panel */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-medium text-gray-900">ภาพรวมโครงการ (Project Summary)</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <p className="text-sm text-gray-500">ยอดขายรวมจาก Shopee (ตั้งแต่วันเริ่มแคมเปญ)</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">฿{data.totalSales.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">จำนวนลูกค้าทั้งหมด</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data.totalUsers} คน</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">สัดส่วนยอดขายเป้าหมาย</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">30%</p>
              <p className="text-xs text-gray-400 mt-1">ยอดขายที่มาจากโปรแกรมสะสมแต้ม</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoyaltyDashboard;
