import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader, ArrowRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { apiFetch } from '../services/api';

interface ShopeeOrderRow {
  order_id: string;
  status: string;
  username: string;
  order_date: string;
  total_amount: number;
}

const ShopeeLoyaltyImport: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<ShopeeOrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ imported: number; coupons: number } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setSuccess(null);
    setParsedData([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const mappedData: ShopeeOrderRow[] = [];
        data.forEach((row, index) => {
          // Normalize keys to handle whitespace or slight variations
          const getVal = (possibleKeys: string[]) => {
            const key = Object.keys(row).find(k => possibleKeys.some(pk => k.includes(pk)));
            return key ? row[key] : null;
          };

          const orderId = getVal(['หมายเลขคำสั่งซื้อ']);
          const status = getVal(['สถานะการสั่งซื้อ']);
          const username = getVal(['ชื่อผู้ใช้', 'ผู้ซื้อ']);
          const orderDate = getVal(['วันที่ทำการสั่งซื้อ']);
          const totalAmount = getVal(['จำนวนเงินทั้งหมด', 'ราคาสินค้าที่ชำระ']);

          if (orderId && username && status) {
            mappedData.push({
              order_id: String(orderId),
              status: String(status),
              username: String(username),
              order_date: String(orderDate || ''),
              total_amount: parseFloat(String(totalAmount || '0').replace(/,/g, '')) || 0
            });
          }
        });

        if (mappedData.length === 0) {
          setError('ไม่พบข้อมูลคำสั่งซื้อในไฟล์นี้ หรือหัวคอลัมน์ไม่ตรงกับรูปแบบของ Shopee');
        } else {
          setParsedData(mappedData);
        }
      } catch (err) {
        setError('เกิดข้อผิดพลาดในการอ่านไฟล์ โปรดตรวจสอบว่าเป็นไฟล์ Excel หรือ CSV ที่ถูกต้อง');
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiFetch('shopee_loyalty?action=import', {
        method: 'POST',
        body: JSON.stringify({ orders: parsedData })
      });
      if (response && response.ok) {
        setSuccess({
          imported: response.imported,
          coupons: response.couponsGenerated
        });
        setFile(null);
        setParsedData([]);
      } else {
        setError(response.message || 'เกิดข้อผิดพลาดในการนำเข้า');
      }
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Shopee Loyalty Import</h1>
        <p className="text-gray-500 mt-1">อัปโหลดไฟล์คำสั่งซื้อจาก Shopee เพื่อให้ระบบคำนวณแต้มสะสมให้อัตโนมัติ</p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center hover:bg-gray-50 transition-colors">
          <input
            type="file"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={handleFileUpload}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center">
            <Upload className="h-12 w-12 text-blue-500 mb-4" />
            <span className="text-lg font-medium text-gray-900">คลิกเพื่อเลือกไฟล์ Shopee (CSV/Excel)</span>
            <span className="text-sm text-gray-500 mt-2">ระบบจะดึงเฉพาะคอลัมน์: หมายเลขคำสั่งซื้อ, สถานะ, ชื่อผู้ใช้, วันที่, ยอดเงิน</span>
          </label>
        </div>

        {file && (
          <div className="mt-6 flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex items-center space-x-3">
              <FileText className="h-6 w-6 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500">พบข้อมูลที่อ่านได้: {parsedData.length} แถว</p>
              </div>
            </div>
            
            <button
              onClick={handleImport}
              disabled={loading || parsedData.length === 0}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
            >
              {loading ? (
                <Loader className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <span>นำเข้าข้อมูล</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-lg flex items-start space-x-3 border border-green-100">
            <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5 text-green-500" />
            <div>
              <p className="font-medium text-green-900">นำเข้าข้อมูลสำเร็จ!</p>
              <ul className="mt-2 space-y-1 text-sm">
                <li>ออเดอร์ที่ถูกบันทึก/สะสมแต้มใหม่: <strong>{success.imported}</strong> รายการ</li>
                <li>สร้างคูปองส่วนลดอัตโนมัติ: <strong>{success.coupons}</strong> ใบ</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {parsedData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="font-medium text-gray-900">ตัวอย่างข้อมูลที่จะถูกนำเข้า (5 แถวแรก)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 bg-white border-b uppercase">
                <tr>
                  <th className="px-6 py-3 font-medium">หมายเลขคำสั่งซื้อ</th>
                  <th className="px-6 py-3 font-medium">สถานะ</th>
                  <th className="px-6 py-3 font-medium">ชื่อผู้ใช้ (Shopee)</th>
                  <th className="px-6 py-3 font-medium">วันที่สั่งซื้อ</th>
                  <th className="px-6 py-3 font-medium text-right">ยอดเงิน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {parsedData.slice(0, 5).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{row.order_id}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        row.status.includes('สำเร็จ') ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{row.username}</td>
                    <td className="px-6 py-4 text-gray-500">{row.order_date}</td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                      ฿{row.total_amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShopeeLoyaltyImport;
