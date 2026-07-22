import React, { useState } from 'react';
import { useTimeTravel } from '../hooks/useTimeTravel';
import { format, subHours } from 'date-fns';
import { th } from 'date-fns/locale';
import { Download, AlertCircle, FileSpreadsheet, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { downloadDataFile } from '../utils/exportUtils';
import ExportTypeModal from './ExportTypeModal';
import ExportCallStatsModal, { CallStatsCategory, UserFilterType, PREDEFINED_BASKETS } from './ExportCallStatsModal';
import { apiFetch } from '../services/api';
import * as ExcelJS from 'exceljs';

interface Props {
  companyId: number;
}

export default function TimeTravelTab({ companyId }: Props) {
  // Default to 1 hour ago
  const [targetTime, setTargetTime] = useState(format(subHours(new Date(), 1), "yyyy-MM-dd'T'HH:mm"));
  const [submittedTime, setSubmittedTime] = useState(targetTime);
  const { snapshotData, loading, error } = useTimeTravel(companyId, submittedTime);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [isExportingStats, setIsExportingStats] = useState(false);
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

  const handleExportCallStats = async (options: Record<CallStatsCategory, boolean>, userFilter: UserFilterType, selectedBaskets: string[]) => {
    setIsExportingStats(true);
    try {
      const result = await apiFetch(`distribution_movement/export_time_travel_call_stats?target_time=${submittedTime.replace('T', ' ')}:00`);
      if (result.ok && result.data && result.allUsers) {
        // Define the exact order requested by the user
        const predefinedOrder = [
            'Upsell',
            'ลูกค้าใหม่',
            'ส่วนตัว 1-2 เดือน',
            'ส่วนตัวโอกาสสุดท้าย',
            'หาคนดูแลใหม่',
            'รอคนมาจีบให้ติด',
            'ถังกลาง 6-9 เดือน',
            'ถังกลาง 9-12 เดือน',
            'ถังกลาง 1-3 ปี'
        ];

        // Find all unique baskets and filter by selection, then sort by predefined order
        const uniqueBaskets = Array.from(new Set(result.data.map((r: any) => r.basket_name || 'ไม่ระบุถัง')))
            .filter((b: string) => {
                if (selectedBaskets.includes(b)) return true;
                if (selectedBaskets.includes('อื่นๆ') && !PREDEFINED_BASKETS.includes(b)) return true;
                return false;
            })
            .sort((a: any, b: any) => {
                const indexA = predefinedOrder.indexOf(a);
                const indexB = predefinedOrder.indexOf(b);
                
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;
                return a.localeCompare(b, 'th'); // fallback
            }) as string[];
            
        // Append Total Basket
        uniqueBaskets.push('รวมทุกถัง');
        
        // Pivot data by Agent
        const agentMap: Record<string, any> = {};

        // Helper to init agent columns
        const initAgent = (userId: string, name: string, isActive: boolean) => {
           if (!agentMap[userId]) {
              agentMap[userId] = { 
                 'ชื่อพนักงาน': name + (!isActive ? ' (ระงับ)' : ''),
                 'is_active': isActive 
              };
              uniqueBaskets.forEach(b => {
                agentMap[userId][`${b}_ในมือ`] = 0;
                agentMap[userId][`${b}_ยังไม่โทร`] = 0;
                agentMap[userId][`${b}_โทรแล้วไม่นัดหมาย`] = 0;
                agentMap[userId][`${b}_โทรแล้วนัดหมาย`] = 0;
                agentMap[userId][`${b}_นัดหมายแล้วไม่มีโทร`] = 0;
              });
           }
        };

        // If 'all', initialize everyone
        if (userFilter === 'all') {
            result.allUsers.forEach((u: any) => {
                const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || `(ID: ${u.id})`;
                initAgent(String(u.id), name, u.status === 'active');
            });
        }
        
        result.data.forEach((row: any) => {
          const userId = String(row.assigned_to);
          const agentName = `${row.first_name || ''} ${row.last_name || ''}`.trim() || `(ID: ${userId})`;
          const isActive = row.status === 'active';
          
          if (userFilter === 'active_only' && !isActive) return;

          initAgent(userId, agentName, isActive);
          
          const b = row.basket_name || 'ไม่ระบุถัง';
          
          // Only process this row if the basket is in uniqueBaskets (except for the total column itself)
          if (!uniqueBaskets.includes(b)) return;
          
          agentMap[userId][`${b}_ในมือ`] += Number(row.total_held) || 0;
          agentMap[userId][`${b}_ยังไม่โทร`] += Number(row.not_called) || 0;
          agentMap[userId][`${b}_โทรแล้วไม่นัดหมาย`] += Number(row.called_no_appt) || 0;
          agentMap[userId][`${b}_โทรแล้วนัดหมาย`] += Number(row.called_and_appt) || 0;
          agentMap[userId][`${b}_นัดหมายแล้วไม่มีโทร`] += Number(row.appt_no_call) || 0;

          const totalB = 'รวมทุกถัง';
          agentMap[userId][`${totalB}_ในมือ`] += Number(row.total_held) || 0;
          agentMap[userId][`${totalB}_ยังไม่โทร`] += Number(row.not_called) || 0;
          agentMap[userId][`${totalB}_โทรแล้วไม่นัดหมาย`] += Number(row.called_no_appt) || 0;
          agentMap[userId][`${totalB}_โทรแล้วนัดหมาย`] += Number(row.called_and_appt) || 0;
          agentMap[userId][`${totalB}_นัดหมายแล้วไม่มีโทร`] += Number(row.appt_no_call) || 0;
        });

        // Sort agents alphabetically
        const sortedAgents = Object.values(agentMap).sort((a: any, b: any) => 
            a['ชื่อพนักงาน'].localeCompare(b['ชื่อพนักงาน'], 'th')
        );

        const columnsToInclude = [];
        if (options.held) columnsToInclude.push('ในมือ');
        if (options.not_called) columnsToInclude.push('ยังไม่โทร');
        if (options.called_no_appt) columnsToInclude.push('โทรแล้วไม่นัดหมาย');
        if (options.called_and_appt) columnsToInclude.push('โทรแล้วนัดหมาย');
        if (options.appt_no_call) columnsToInclude.push('นัดหมายแล้วไม่มีโทร');

        // Build 2-row header for Excel/CSV
        const headerRow1 = ['']; // Empty top-left cell
        const headerRow2 = [''];

        uniqueBaskets.forEach(b => {
            headerRow1.push(`[${b}]`); // Span basket name
            for(let i=1; i<columnsToInclude.length; i++) headerRow1.push(''); // Fill empty strings for merge
            headerRow2.push(...columnsToInclude);
        });

        const exportData: any[] = [headerRow1, headerRow2];

        // Fill data rows
        sortedAgents.forEach((agentData: any) => {
            const row = [agentData['ชื่อพนักงาน']];
            uniqueBaskets.forEach(b => {
                if (options.held) row.push(agentData[`${b}_ในมือ`]);
                if (options.not_called) row.push(agentData[`${b}_ยังไม่โทร`]);
                if (options.called_no_appt) row.push(agentData[`${b}_โทรแล้วไม่นัดหมาย`]);
                if (options.called_and_appt) row.push(agentData[`${b}_โทรแล้วนัดหมาย`]);
                if (options.appt_no_call) row.push(agentData[`${b}_นัดหมายแล้วไม่มีโทร`]);
            });
            exportData.push(row);
        });

        // Use ExcelJS to format the colors
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Call Stats');
        
        // Add all rows
        worksheet.addRows(exportData);

        const palette = ['FFE3F2FD', 'FFE8F5E9', 'FFFFF3E0', 'FFF3E5F5', 'FFFBE9E7'];
        const getColorForBasket = (basketName: string, index: number) => {
            const name = basketName.toLowerCase();
            if (name.includes('upsell')) return 'FFFF9900'; // Orange
            if (name.includes('ลูกค้าใหม่')) return 'FFFFCC00'; // Yellow
            if (name.includes('1-2')) return 'FF00B050'; // Green
            if (name.includes('โอกาสสุดท้าย')) return 'FFFF0000'; // Red
            if (name.includes('หาคนดูแลใหม่')) return 'FFF4B084'; // Peach/Light Brown
            if (name.includes('รอคนมาจีบให้ติด')) return 'FFA6A6A6'; // Grey
            if (name.includes('6-9')) return 'FF00B0F0'; // Light Blue
            if (name.includes('9-12')) return 'FF7030A0'; // Purple
            if (name.includes('1-3')) return 'FF0070C0'; // Dark Blue
            if (name.includes('รวมทุกถัง')) return 'FF333333'; // Dark grey
            return palette[index % palette.length];
        };

        // Style the first column
        worksheet.mergeCells(1, 1, 2, 1);
        const cellA1 = worksheet.getCell(1, 1);
        cellA1.value = 'ชื่อพนักงาน';
        cellA1.alignment = { vertical: 'middle', horizontal: 'center' };
        cellA1.font = { bold: true };
        cellA1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } } as ExcelJS.FillPattern;
        worksheet.getColumn(1).width = 25; // Widen first column
        
        const borderStyle: Partial<ExcelJS.Borders> = {
            top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
        };
        cellA1.border = borderStyle;

        uniqueBaskets.forEach((basket, i) => {
            const startCol = 2 + (i * columnsToInclude.length);
            const endCol = startCol + columnsToInclude.length - 1;
            const bgColor = getColorForBasket(basket, i);
            const fill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
            
            // Text color (dark text for light backgrounds/yellow, white for dark backgrounds)
            let textColor = 'FFFFFFFF'; 
            const lightColors = ['FFFFCC00', 'FFFF9900', 'FFF4B084'];
            if (lightColors.includes(bgColor) || bgColor.startsWith('FFFFF') || bgColor.startsWith('FFE')) {
               textColor = 'FF000000';
            }

            // Merge basket title
            if (endCol > startCol) {
                worksheet.mergeCells(1, startCol, 1, endCol);
            }
            const titleCell = worksheet.getCell(1, startCol);
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            titleCell.font = { bold: true, color: { argb: textColor } };
            titleCell.fill = fill;
            titleCell.border = borderStyle;

            // Style sub-headers (row 2)
            for (let c = startCol; c <= endCol; c++) {
                const subCell = worksheet.getCell(2, c);
                subCell.fill = fill;
                subCell.font = { bold: true, color: { argb: textColor } };
                subCell.alignment = { horizontal: 'center', vertical: 'middle' };
                subCell.border = borderStyle;
                worksheet.getColumn(c).width = 12; // Adjust width slightly
            }
        });

        // Trigger download
        const formattedExportTime = submittedTime.replace('T', '_').replace(':', '-');
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Time_Travel_CallStats_${formattedExportTime}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setShowStatsModal(false);
      } else {
        alert('เกิดข้อผิดพลาดในการดึงข้อมูลสถิติการโทร: ' + (result.message || ''));
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ (Network Error)');
    } finally {
      setIsExportingStats(false);
    }
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
        <div className="flex gap-2">
          <button
            onClick={() => setShowExportModal(true)}
            disabled={loading || snapshotData.length === 0}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium disabled:opacity-50 transition-colors"
          >
            <FileSpreadsheet size={18} />
            Export ปกติ
          </button>
          <button
            onClick={() => setShowStatsModal(true)}
            disabled={loading || snapshotData.length === 0}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium disabled:opacity-50 transition-colors"
          >
            <FileSpreadsheet size={18} />
            Export ผลการโทร
          </button>
        </div>
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

      {showStatsModal && (
        <ExportCallStatsModal
          isOpen={showStatsModal}
          onClose={() => setShowStatsModal(false)}
          onConfirm={handleExportCallStats}
          isExporting={isExportingStats}
        />
      )}
    </div>
  );
}
