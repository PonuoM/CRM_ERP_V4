import React from 'react';
import { Target, TrendingUp, Users, DollarSign, Award, ChevronUp, ChevronDown } from 'lucide-react';
import { DashboardStats, LoyaltySettings } from './types';

interface LoyaltyDashboardViewProps {
  stats: DashboardStats;
  settings: LoyaltySettings;
  compact?: boolean;
}

const LoyaltyDashboardView: React.FC<LoyaltyDashboardViewProps> = ({ stats, settings, compact = false }) => {
  const getProgressStatus = (current: number, target: number) => {
    if (!target) target = 1; // avoid division by zero
    const percent = (current / target) * 100;
    if (percent >= 100) return { color: 'text-green-600', bg: 'bg-green-100', icon: <ChevronUp className="h-4 w-4" /> };
    if (percent >= 80) return { color: 'text-yellow-600', bg: 'bg-yellow-100', icon: <ChevronUp className="h-4 w-4" /> };
    return { color: 'text-red-600', bg: 'bg-red-100', icon: <ChevronDown className="h-4 w-4" /> };
  };

  const aovStatus = getProgressStatus(stats.aov, settings.target_aov);
  const rrStatus = getProgressStatus(stats.repeat_rate, settings.target_repeat_rate);
  const currentMonth = new Date().toLocaleString('th-TH', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      {!compact && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Target className="h-6 w-6 text-blue-500" />
              Loyalty KPI Dashboard
            </h1>
            <p className="text-gray-500 mt-1">วัดผลประสิทธิภาพโครงการเทียบกับเป้าหมาย</p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* AOV Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">AOV (ยอดซื้อต่อบิล)</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-2">฿{stats.aov.toLocaleString()}</h3>
            </div>
            <div className={`p-3 rounded-lg ${aovStatus.bg} ${aovStatus.color}`}>
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className={`flex items-center font-medium ${aovStatus.color}`}>
              {aovStatus.icon}
              {Math.abs(stats.aov - settings.baseline_aov).toFixed(0)} บาทจากเดิม
            </span>
            <span className="text-gray-400">| เป้า: ฿{settings.target_aov}</span>
          </div>
          {/* Progress Bar */}
          <div className="mt-4 w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min((stats.aov/settings.target_aov)*100, 100)}%` }}></div>
          </div>
        </div>

        {/* Repeat Rate Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Repeat Rate</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-2">{stats.repeat_rate}%</h3>
            </div>
            <div className={`p-3 rounded-lg ${rrStatus.bg} ${rrStatus.color}`}>
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className={`flex items-center font-medium ${rrStatus.color}`}>
              {rrStatus.icon}
              {Math.abs(stats.repeat_rate - settings.baseline_repeat_rate).toFixed(2)}% จากเดิม
            </span>
            <span className="text-gray-400">| เป้า: {settings.target_repeat_rate}%</span>
          </div>
          <div className="mt-4 w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min((stats.repeat_rate/settings.target_repeat_rate)*100, 100)}%` }}></div>
          </div>
        </div>

        {/* Members Enrolled */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">ลูกค้าสะสมแต้ม</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-2">{stats.total_members} คน</h3>
            </div>
            <div className="p-3 rounded-lg bg-purple-100 text-purple-600">
              <Users className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className={`font-medium ${stats.total_members >= settings.target_members ? 'text-green-600' : 'text-gray-500'}`}>เป้าหมาย: {settings.target_members} คน</span>
          </div>
          <div className="mt-4 w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${Math.min((stats.total_members/settings.target_members)*100, 100)}%` }}></div>
          </div>
        </div>

        {/* 10-Point Members */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">ลูกค้า {settings.points_for_coupon} แต้ม</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-2">{stats.members_10_points} คน</h3>
            </div>
            <div className="p-3 rounded-lg bg-orange-100 text-orange-600">
              <Award className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className={`font-medium ${stats.members_10_points >= settings.target_10_points ? 'text-green-600' : 'text-gray-500'}`}>เป้าหมาย: {settings.target_10_points} คน</span>
          </div>
          <div className="mt-4 w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${Math.min((stats.members_10_points/settings.target_10_points)*100, 100)}%` }}></div>
          </div>
        </div>
      </div>

      {/* Summary Chart/Panel */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">รายงานผู้บริหารประจำเดือน (Executive Report)</h2>
          <span className="text-sm text-gray-500">เดือน: {currentMonth}</span>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">ยอดขายรวมจากสมาชิก</span>
                <span className="font-bold">฿{stats.member_sales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">สัดส่วนยอดขายสมาชิกเทียบยอดรวมทั้งหมด</span>
                <span className={`font-bold ${stats.member_sales_percent >= settings.target_sales_percent ? 'text-green-600' : 'text-red-500'}`}>
                  {stats.member_sales_percent}% (เป้า: {settings.target_sales_percent}%)
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">การเติบโต AOV (เทียบฐานเดิม)</span>
                <span className="font-bold text-blue-600">
                  {settings.baseline_aov > 0 ? `+${(((stats.aov - settings.baseline_aov) / settings.baseline_aov) * 100).toFixed(2)}%` : '0%'}
                </span>
              </div>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-6 flex flex-col justify-center items-center text-center">
              <Award className="w-12 h-12 text-blue-500 mb-2" />
              <h4 className="text-lg font-bold text-gray-900 mb-1">สรุปความสำเร็จโครงการ</h4>
              <p className="text-sm text-gray-600">
                มีลูกค้าสะสมแต้มจำนวน <strong>{stats.total_members} ราย</strong> 
                และมีผู้ที่สะสมถึงเป้ารับคูปองแล้ว <strong>{stats.members_10_points} ราย</strong> 
                โดยมีอัตราการซื้อซ้ำอยู่ที่ <strong>{stats.repeat_rate}%</strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoyaltyDashboardView;
