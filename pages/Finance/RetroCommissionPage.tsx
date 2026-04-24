import React, { useState, useEffect } from 'react';
import { Search, AlertCircle, RefreshCw, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { User } from '../../types';
import APP_BASE_PATH from '../../appBasePath';

interface Metrics {
  total_sales: number;
  large_bag_qty: number;
  large_bag_sales: number;
  small_bag_qty: number;
  small_bag_sales: number;
  bio_qty: number;
  bio_sales: number;
  digging_qty: number;
  digging_sales: number;
}

interface UserSimResult {
  user_id: number;
  name: string;
  role_id: number | null;
  old_commission: number;
  new_commission: number;
  metrics: Metrics;
}

interface RetroCommissionPageProps {
  currentUser: User;
}

const RetroCommissionPage: React.FC<RetroCommissionPageProps> = ({ currentUser }) => {
  const user = currentUser;
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<UserSimResult[]>([]);
  const [error, setError] = useState('');
  
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const fetchData = async () => {
    if (!user?.company_id) return;
    setLoading(true);
    setData([]);
    setError('');
    
    try {
      const cacheBuster = new Date().getTime();
      const res = await fetch(`${APP_BASE_PATH}api/Commission/simulate_retro.php?company_id=${user.company_id}&month=${selectedMonth}&year=${selectedYear}&_t=${cacheBuster}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      const json = await res.json();
      
      if (!res.ok || !json.ok) {
         throw new Error(json.error || 'Failed to fetch simulation data');
      }
      
      setData(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch when user, month, or year changes
  useEffect(() => {
    if (user?.company_id) {
       fetchData();
    }
  }, [user?.company_id, selectedMonth, selectedYear]);

  // Aggregation
  let totalOld = 0;
  let totalNew = 0;
  data.forEach(r => {
      totalOld += r.old_commission;
      totalNew += r.new_commission;
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">ตรวจสอบค่าคอมมิชชันย้อนหลัง (Simulation)</h1>
        <p className="text-gray-600 mt-1">เทียบผลคำนวณจากกฎ Dynamic Engine ใหม่ เทียบกับ ประวัติการ Stamp ค่าเดิม (ต้องเป็นเดือนที่เคย Stamp ระบบเดิมไว้แล้ว)</p>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-wrap gap-4 items-end">
         <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เดือน</label>
            <select 
               className="h-10 px-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
               value={selectedMonth}
               onChange={(e) => setSelectedMonth(Number(e.target.value))}
            >
               {Array.from({length: 12}).map((_, i) => (
                  <option key={i+1} value={i+1}>เดือน {i+1}</option>
               ))}
            </select>
         </div>
         <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ปี</label>
            <select 
               className="h-10 px-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
               value={selectedYear}
               onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
               {[currentYear-1, currentYear, currentYear+1].map(y => (
                  <option key={y} value={y}>{y}</option>
               ))}
            </select>
         </div>
         <button 
            onClick={fetchData} 
            disabled={loading}
            className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
         >
            {loading ? <RefreshCw className="animate-spin w-4 h-4 mr-2" /> : <Search className="w-4 h-4 mr-2" />}
            ประมวลผล
         </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 mb-6">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">เกิดข้อผิดพลาด</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
          <div className="flex justify-center items-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    นักขาย
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ยอดขายรวม
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    กระสอบใหญ่
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    กระสอบเล็ก
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ชีวภัณฑ์
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ลูกค้าขุด
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-100">
                    Stamp เดิม
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50">
                    คำนวณใหม่ (Dynamic)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.length === 0 ? (
                    <tr>
                        <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                            ไม่พบข้อมูลสำหรับเดือนที่เลือก หรือยังไม่มีการ Stamp ค่าของเดือนนี้ในระบบ
                        </td>
                    </tr>
                ) : (
                    data.map((row) => {
                        const diff = row.new_commission - row.old_commission;
                        const isDiff = Math.abs(diff) > 10;
                        return (
                          <tr key={row.user_id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{row.name}</div>
                              <div className="text-xs text-gray-500">ID: {row.user_id}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                              {row.metrics.total_sales.toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                              {row.metrics.large_bag_qty > 0 && <div className="text-blue-600 font-medium">{row.metrics.large_bag_qty} ใบ</div>}
                              <div className="text-gray-500">{row.metrics.large_bag_sales.toLocaleString()}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                              {row.metrics.small_bag_qty > 0 && <div className="text-blue-600 font-medium">{row.metrics.small_bag_qty} ใบ</div>}
                              <div className="text-gray-500">{row.metrics.small_bag_sales.toLocaleString()}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                              <div className="text-gray-500">{row.metrics.bio_sales.toLocaleString()}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                              <div className="text-orange-600 font-medium">{row.metrics.digging_sales.toLocaleString()}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-500 bg-gray-50">
                              {row.old_commission.toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right bg-blue-50/30">
                              <div className={`text-lg font-bold flex items-center justify-end ${isDiff ? 'text-red-600' : 'text-green-600'}`}>
                                 {isDiff ? <ExclamationIcon className="w-4 h-4 mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                                 {row.new_commission.toLocaleString(undefined, {minimumFractionDigits: 2})}
                              </div>
                              {isDiff && (
                                  <div className={`text-xs mt-1 flex items-center justify-end ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {diff > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                                      {diff > 0 ? '+' : ''}{diff.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                  </div>
                              )}
                            </td>
                          </tr>
                        );
                    })
                )}
              </tbody>
              {data.length > 0 && (
                  <tfoot className="bg-gray-100 font-semibold">
                      <tr>
                          <td colSpan={6} className="px-6 py-4 text-right text-sm text-gray-900 uppercase">
                              ยอดรวม
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                              {totalOld.toLocaleString(undefined, {minimumFractionDigits: 2})}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm border-t-2 border-blue-200">
                              <div className={Math.abs(totalNew - totalOld) > 10 ? 'text-red-600' : 'text-green-600'}>
                                  {totalNew.toLocaleString(undefined, {minimumFractionDigits: 2})}
                              </div>
                          </td>
                      </tr>
                  </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
      
      <div className="mt-4 text-xs text-gray-500 bg-gray-50 p-3 rounded border border-gray-200">
          <span className="font-bold">หมายเหตุ:</span> ระบบจะดึงยอดเฉพาะ Order ที่ <u>เคย Stamp ลงใน Commission Batch</u> ของเดือนนั้นๆ แล้วนำมาประมวลผลย้อนหลังผ่าน Dynamic Engine ปัจจุบัน
      </div>
    </div>
  );
};

const ExclamationIcon = ({className}: {className: string}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
)

export default RetroCommissionPage;
