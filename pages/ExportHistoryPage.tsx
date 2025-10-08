import React, { useEffect, useMemo, useState } from 'react';
import { downloadExportUrl, listExports } from '../services/api';

interface Row {
  id: number;
  filename: string;
  file_path: string;
  orders_count: number;
  user_id?: number;
  exported_by?: string;
  created_at: string;
  download_count: number;
}

const ExportHistoryPage: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const data = await listExports();
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError('โหลดประวัติการส่งออกไม่สำเร็จ');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const warning = 'ระบบเก็บไฟล์ย้อนหลังสูงสุด 30 วัน ไฟล์ที่เก่ากว่าจะถูกลบอัตโนมัติ';

  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-800">ประวัติการส่งออกสำหรับคลังสินค้า</h2>
        <p className="text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-md px-3 py-2 inline-block mt-2">{warning}</p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {loading ? (
          <div className="p-6 text-gray-500">กำลังโหลด...</div>
        ) : error ? (
          <div className="p-6 text-red-600">{error}</div>
        ) : (
          <table className="w-full text-sm text-left text-gray-600">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th className="px-4 py-3">ชื่อไฟล์</th>
                <th className="px-4 py-3">วันที่/เวลา</th>
                <th className="px-4 py-3">จำนวนออเดอร์</th>
                <th className="px-4 py-3">ผู้ส่งออก</th>
                <th className="px-4 py-3">จำนวนดาวน์โหลดซ้ำ</th>
                <th className="px-4 py-3">การทำงาน</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b">
                  <td className="px-4 py-3 font-medium text-gray-800">{r.filename}</td>
                  <td className="px-4 py-3">{new Date(r.created_at).toLocaleString('th-TH')}</td>
                  <td className="px-4 py-3">{r.orders_count.toLocaleString()}</td>
                  <td className="px-4 py-3">{r.exported_by || '-'}</td>
                  <td className="px-4 py-3">{r.download_count}</td>
                  <td className="px-4 py-3">
                    <a href={downloadExportUrl(r.id)} className="text-blue-600 hover:underline">ดาวน์โหลด</a>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-gray-500" colSpan={6}>ไม่พบประวัติใน 30 วันที่ผ่านมา</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ExportHistoryPage;

