import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { getCancellationDashboardStats } from '../services/api';
import DateRangePicker from '../components/DateRangePicker';
import { XCircle, FileSpreadsheet, LayoutDashboard, CheckSquare } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '../components/Toast';

// Sub-components
import CancellationStatsTab from '../components/cancellation/CancellationStatsTab';
import CancellationAcknowledgeTab from '../components/cancellation/CancellationAcknowledgeTab';

interface CancellationDashboardPageProps {
  user: User;
}

export default function CancellationDashboardPage({ user }: CancellationDashboardPageProps) {
  const [activeTab, setActiveTab] = useState<'stats' | 'acknowledge'>('stats');
  
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [stats, setStats] = useState<any[]>([]);
  const [reasons, setReasons] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any>({ daily: [], monthly: [], yearly: [] });
  const [timelineMode, setTimelineMode] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { error: toastError } = useToast();

  useEffect(() => {
    // Only fetch stats if on the stats tab (or fetch anyway to keep it updated)
    fetchStats();
  }, [dateRange]);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCancellationDashboardStats({
        dateStart: dateRange.start || undefined,
        dateEnd: dateRange.end || undefined
      });
      if (res && res.ok) {
        setStats(res.salespersonStats || []);
        setReasons(res.reasonsBreakdown || []);
        setTimeline(res.timeline || { daily: [], monthly: [], yearly: [] });
      } else {
        setError(res?.error || 'Failed to load stats');
      }
    } catch (e: any) {
      setError(e.message || 'Error loading stats');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const dataToExport = stats.map(s => ({
      'รหัสพนักงาน': s.user_id,
      'ชื่อพนักงาน': s.name,
      'ออเดอร์รวมทั้งหมด': s.total_orders,
      'ออเดอร์ที่ถูกยกเลิก': s.cancelled_count,
      'อัตรายกเลิก (%)': s.cancellation_rate,
      'มูลค่าความเสียหาย': s.cancelled_value
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cancellation_Stats");
    XLSX.writeFile(wb, `Cancellation_Stats_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 font-sans animate-fade-in">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">แดชบอร์ดยกเลิก (Cancellation Dashboard)</h1>
              <p className="text-xs text-gray-500">ติดตามสถิติและจัดการออเดอร์ที่ถูกยกเลิก</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            {activeTab === 'stats' && (
              <button 
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export Excel
              </button>
            )}
          </div>
        </div>
        
        {/* Tab Navigation */}
        <div className="px-6 flex gap-6">
          <button
            onClick={() => setActiveTab('stats')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
              activeTab === 'stats' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            ภาพรวมสถิติ
          </button>
          
          {(user.role === 'Supervisor Telesale' || user.role === 'Admin' || user.role === 'SuperAdmin' || user.role === 'Super Admin') && (
            <button
              onClick={() => setActiveTab('acknowledge')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                activeTab === 'acknowledge' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              รอรับทราบ (Pending)
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'stats' ? (
          loading ? (
            <div className="flex items-center justify-center h-64 text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-500 border-t-transparent mr-3"></div>
              กำลังโหลดข้อมูล...
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg">
              {error}
            </div>
          ) : (
            <CancellationStatsTab 
              stats={stats} 
              timeline={timeline} 
              timelineMode={timelineMode} 
              setTimelineMode={setTimelineMode} 
              reasons={reasons} 
            />
          )
        ) : (
          <CancellationAcknowledgeTab dateRange={dateRange} />
        )}
      </div>
    </div>
  );
}
