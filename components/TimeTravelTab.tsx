import React, { useState } from 'react';
import { useTimeTravel } from '../hooks/useTimeTravel';
import { format, subHours } from 'date-fns';
import { th } from 'date-fns/locale';
import { Download, AlertCircle, FileSpreadsheet, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { downloadDataFile } from '../utils/exportUtils';
import ExportTypeModal from './ExportTypeModal';

interface Props {
  companyId: number;
}

export default function TimeTravelTab({ companyId }: Props) {
  // Default to 1 hour ago
  const [targetTime, setTargetTime] = useState(format(subHours(new Date(), 1), "yyyy-MM-dd'T'HH:mm"));
  const [submittedTime, setSubmittedTime] = useState(targetTime);
  const { snapshotData, loading, error } = useTimeTravel(companyId, submittedTime);
  const [showExportModal, setShowExportModal] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (groupId: string) => {
    setExpandedRows(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const displayRows = React.useMemo(() => {
    let centralRow = null;
    const regularRows: any[] = [];
    const basketRows: any[] = [];

    snapshotData.forEach((row: any) => {
      if (row.group_id === 'CENTRAL' || (typeof row.group_id === 'string' && row.group_id.startsWith('BASKET_'))) {
        basketRows.push(row);
      } else {
        regularRows.push(row);
      }
    });

    if (basketRows.length > 0) {
      centralRow = {
        group_id: 'AGGREGATED_CENTRAL',
        name: 'ตะกร้ากลาง (Distribution)',
        isCentral: true,
        snapshot_balance: basketRows.reduce((sum, r) => sum + r.snapshot_balance, 0),
        current_balance: basketRows.reduce((sum, r) => sum + r.current_balance, 0),
        new_since: basketRows.reduce((sum, r) => sum + r.new_since, 0),
        received_since: basketRows.reduce((sum, r) => sum + r.received_since, 0),
        lost_since: basketRows.reduce((sum, r) => sum + r.lost_since, 0),
        children: basketRows
      };
      return [centralRow, ...regularRows];
    }
    return regularRows;
  }, [snapshotData]);

  const handleExport = (type: 'csv' | 'xlsx') => {
    if (!snapshotData || snapshotData.length === 0) return;

    const data = snapshotData.map((s) => ({
      'กลุ่ม/พนักงาน': s.name,
      'ยอดคงเหลือ ณ เวลานั้น (Snapshot)': s.snapshot_balance,
      'ยอดปัจจุบัน': s.current_balance,
      'สร้างใหม่ (ตั้งแต่นั้น)': s.new_since,
      'รับเข้า (ตั้งแต่นั้น)': s.received_since,
      'ถูกดึงออก (ตั้งแต่นั้น)': s.lost_since,
    }));

    const formattedExportTime = submittedTime.replace('T', '_').replace(':', '-');
    downloadDataFile(data, `Time_Travel_Snapshot_${formattedExportTime}`, type);
    setShowExportModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-end gap-4 w-full sm:w-auto">
          <div className="flex-1 sm:w-64">
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Clock size={16} /> ระบุวัน-เวลาที่ต้องการย้อนดู:
            </label>
            <input
              type="datetime-local"
              value={targetTime}
              onChange={(e) => setTargetTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setSubmittedTime(targetTime)}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-colors"
          >
            คำนวณยอด (Time Travel)
          </button>
        </div>
        <button
          onClick={() => setShowExportModal(true)}
          disabled={loading || snapshotData.length === 0}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium disabled:opacity-50 transition-colors"
        >
          <FileSpreadsheet size={18} />
          Export Data
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
        <p>
          <strong>สมการคำนวณย้อนหลัง (Rollback):</strong> ระบบจะนำยอดปัจจุบัน ลบด้วยกิจกรรมที่เกิดขึ้นหลังจากเวลาที่คุณระบุ เพื่อหาสถานะในอดีตอย่างแม่นยำ
        </p>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 border-b border-gray-200 font-medium text-gray-900">
              <tr>
                <th className="px-4 py-3">พนักงาน / ตะกร้า</th>
                <th className="px-4 py-3 text-right bg-blue-50/50">ยอดคงเหลือ (ณ เวลานั้น)</th>
                <th className="px-4 py-3 text-right">ยอดปัจจุบัน</th>
                <th className="px-4 py-3 text-right text-gray-500">สร้างใหม่ (หลังจากเวลานั้น)</th>
                <th className="px-4 py-3 text-right text-gray-500">รับเข้า (หลังจากเวลานั้น)</th>
                <th className="px-4 py-3 text-right text-gray-500">ถูกดึงออก (หลังจากเวลานั้น)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>กำลังคำนวณย้อนเวลา...</span>
                    </div>
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    ไม่พบข้อมูลสำหรับช่วงเวลานี้
                  </td>
                </tr>
              ) : (
                displayRows.map((row) => (
                  <React.Fragment key={row.group_id}>
                    <tr 
                      className={`hover:bg-gray-50 ${row.isParent ? 'bg-blue-50/50 cursor-pointer select-none' : ''}`}
                      onClick={() => row.isParent && toggleRow(row.group_id)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-2">
                        {row.isParent && (
                           expandedRows[row.group_id] ? <ChevronDown size={16} className="text-blue-600" /> : <ChevronRight size={16} className="text-blue-600" />
                        )}
                        <span className={row.isParent ? "text-blue-700" : ""}>{row.name}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-blue-700 bg-blue-50/30">
                        {row.snapshot_balance.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">{row.current_balance.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{row.new_since.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{row.received_since.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{row.lost_since.toLocaleString()}</td>
                    </tr>
                    {row.isParent && expandedRows[row.group_id] && row.children.map((child: any) => (
                      <tr key={child.group_id} className="bg-blue-50/20 hover:bg-blue-50/40">
                         <td className="px-4 py-3 pl-10 text-gray-700 text-sm">{child.name.includes('(') ? child.name.split('(')[1].replace(')', '') : child.name}</td>
                         <td className="px-4 py-3 text-right font-semibold text-blue-700/80 text-sm bg-blue-50/30">{child.snapshot_balance.toLocaleString()}</td>
                         <td className="px-4 py-3 text-right text-gray-600 text-sm">{child.current_balance.toLocaleString()}</td>
                         <td className="px-4 py-3 text-right text-gray-500/80 text-sm">{child.new_since.toLocaleString()}</td>
                         <td className="px-4 py-3 text-right text-gray-500/80 text-sm">{child.received_since.toLocaleString()}</td>
                         <td className="px-4 py-3 text-right text-gray-500/80 text-sm">{child.lost_since.toLocaleString()}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showExportModal && (
        <ExportTypeModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          onConfirm={handleExport}
        />
      )}
    </div>
  );
}
