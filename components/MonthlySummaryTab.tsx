import React, { useState, useMemo } from 'react';
import { useMonthlySummary } from '../hooks/useMonthlySummary';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Download, AlertCircle, FileSpreadsheet, ChevronDown, ChevronRight } from 'lucide-react';
import { downloadDataFile } from '../utils/exportUtils';
import ExportTypeModal from './ExportTypeModal';

interface Props {
  companyId: number;
}

export default function MonthlySummaryTab({ companyId }: Props) {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const { summary, loading, error } = useMonthlySummary(companyId, month);
  const [showExportModal, setShowExportModal] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (groupId: string) => {
    setExpandedRows(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const displayRows = useMemo(() => {
    let centralRow = null;
    const regularRows: any[] = [];
    const basketRows: any[] = [];

    summary.forEach((row: any) => {
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
        start_balance: basketRows.reduce((sum, r) => sum + r.start_balance, 0),
        new_created: basketRows.reduce((sum, r) => sum + r.new_created, 0),
        received: basketRows.reduce((sum, r) => sum + r.received, 0),
        lost: basketRows.reduce((sum, r) => sum + r.lost, 0),
        current_balance: basketRows.reduce((sum, r) => sum + r.current_balance, 0),
        children: basketRows
      };
      return [centralRow, ...regularRows];
    }
    return regularRows;
  }, [summary]);

  const handleExport = (type: 'csv' | 'xlsx') => {
    if (!summary || summary.length === 0) return;

    const data = summary.map((s) => ({
      'กลุ่ม/พนักงาน': s.name,
      'ยอดยกมาต้นเดือน': s.start_balance,
      'สร้างใหม่เอง': s.new_created,
      'ได้รับแจกเพิ่ม': s.received,
      'ถูกดึง/โอนออก': s.lost,
      'ยอดคงเหลือสิ้นเดือน': s.current_balance,
    }));

    downloadDataFile(data, `Monthly_Distribution_Summary_${month}`, type);
    setShowExportModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">เลือกเดือน:</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => setShowExportModal(true)}
          disabled={loading || summary.length === 0}
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

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-700">
            <thead className="bg-gray-50 border-b border-gray-200 font-medium text-gray-900">
              <tr>
                <th className="px-4 py-3">พนักงาน / ตะกร้า</th>
                <th className="px-4 py-3 text-right">ยอดยกมาต้นเดือน</th>
                <th className="px-4 py-3 text-right text-purple-600">สร้างใหม่เอง (ในเดือน)</th>
                <th className="px-4 py-3 text-right text-green-600">ได้รับแจกเพิ่ม (ในเดือน)</th>
                <th className="px-4 py-3 text-right text-red-600">ถูกดึง/โอนออก (ในเดือน)</th>
                <th className="px-4 py-3 text-right font-bold text-blue-700">ยอดคงเหลือ (สิ้นเดือน)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>กำลังประมวลผลข้อมูล...</span>
                    </div>
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    ไม่มีข้อมูลความเคลื่อนไหวในเดือนนี้
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
                      <td className="px-4 py-3 text-right">{row.start_balance.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-purple-600">{row.new_created.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-green-600">+{row.received.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-red-600">-{row.lost.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-bold text-blue-700">{row.current_balance.toLocaleString()}</td>
                    </tr>
                    {row.isParent && expandedRows[row.group_id] && row.children.map((child: any) => (
                      <tr key={child.group_id} className="bg-blue-50/20 hover:bg-blue-50/40">
                         <td className="px-4 py-3 pl-10 text-gray-700 text-sm">{child.name.includes('(') ? child.name.split('(')[1].replace(')', '') : child.name}</td>
                         <td className="px-4 py-3 text-right text-gray-600 text-sm">{child.start_balance.toLocaleString()}</td>
                         <td className="px-4 py-3 text-right text-purple-600/80 text-sm">{child.new_created.toLocaleString()}</td>
                         <td className="px-4 py-3 text-right text-green-600/80 text-sm">+{child.received.toLocaleString()}</td>
                         <td className="px-4 py-3 text-right text-red-600/80 text-sm">-{child.lost.toLocaleString()}</td>
                         <td className="px-4 py-3 text-right font-semibold text-blue-700/80 text-sm">{child.current_balance.toLocaleString()}</td>
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
