import React from 'react';
import { ProductSummary, TonDivisorRow, formatTon } from './types';

interface StockPlanReportProps {
  productSummaries: ProductSummary[];
  reportDivisorRows: TonDivisorRow[];
  reportTotals: {
    totalModels: number;
    totalQty: number;
    confirmedModels: number;
    confirmedQty: number;
    outstandingModels: number;
    outstandingQty: number;
  };
}

const StockPlanReport: React.FC<StockPlanReportProps> = ({ productSummaries, reportDivisorRows, reportTotals }) => {
  const reportTonDivisorMap = React.useMemo(() => {
    const map: Record<number, number> = {};
    reportDivisorRows.forEach(r => { if (r.divisor) map[r.product_id] = r.divisor; });
    return map;
  }, [reportDivisorRows]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="text-sm text-gray-500 mb-1">แพลนทั้งหมด</div>
          <div className="text-2xl font-bold text-gray-800">{reportTotals.totalQty.toLocaleString()} <span className="text-sm font-normal text-gray-400">ชิ้น</span></div>
          <div className="text-xs text-gray-400 mt-1">{reportTotals.totalModels} รุ่น</div>
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="text-sm text-gray-500 mb-1">สำเร็จ (ยืนยันรับเข้าแล้ว)</div>
          <div className="text-2xl font-bold text-green-600">{reportTotals.confirmedQty.toLocaleString()} <span className="text-sm font-normal text-gray-400">ชิ้น</span></div>
          <div className="text-xs text-gray-400 mt-1">{reportTotals.confirmedModels} รุ่น</div>
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="text-sm text-gray-500 mb-1">ค้างส่ง</div>
          <div className="text-2xl font-bold text-orange-600">{reportTotals.outstandingQty.toLocaleString()} <span className="text-sm font-normal text-gray-400">ชิ้น</span></div>
          <div className="text-xs text-gray-400 mt-1">{reportTotals.outstandingModels} รุ่นที่เหลือ</div>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl border shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">รุ่น</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">ยอดรวมทั้งหมด/ชิ้น</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">ยอดรับเข้า/ชิ้น</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">ยอดค้างรับเข้า/ชิ้น</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">ยอดรับเข้า/ตัน</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">ยอดค้างรับเข้า/ตัน</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {productSummaries.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">ไม่มีแพลนในเดือนนี้</td></tr>
            )}
            {productSummaries.map(p => {
              const outstandingQty = Math.max(p.totalQty - p.receivedQty, 0);
              const divisor = reportTonDivisorMap[p.product_id];
              const receivedTon = formatTon(p.receivedQty, divisor);
              const outstandingTon = formatTon(outstandingQty, divisor);
              return (
                <tr key={p.product_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{p.sku ? `${p.sku} - ` : ''}{p.product_name ?? p.product_id}</td>
                  <td className="px-4 py-3 text-right">{p.totalQty.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-green-700">{p.receivedQty.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-orange-700">{outstandingQty.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">{receivedTon ?? <span className="text-gray-300">ยังไม่ตั้งค่า</span>}</td>
                  <td className="px-4 py-3 text-right">{outstandingTon ?? <span className="text-gray-300">ยังไม่ตั้งค่า</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StockPlanReport;
