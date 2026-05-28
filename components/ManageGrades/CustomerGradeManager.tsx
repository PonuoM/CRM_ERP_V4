import React, { useState, useEffect } from 'react';
import { CustomerGradeConfig, CustomerGradeSettings } from '@/types';
import { getCustomerGradesConfig, saveCustomerGradesConfig, recalculateAllCustomerGrades } from '@/services/api';
import ConfirmModal from '../ConfirmModal';

const CustomerGradeManager: React.FC = () => {
  const [grades, setGrades] = useState<CustomerGradeConfig[]>([]);
  const [settings, setSettings] = useState<CustomerGradeSettings>({
    calc_mode: 'all',
    time_range_type: 'fixed',
    fixed_start_date: '',
    fixed_end_date: '',
    relative_days: 365
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchGrades();
  }, []);

  const fetchGrades = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getCustomerGradesConfig();
      if (res?.status === 'success') {
        setGrades(res.data || []);
        if (res.settings) {
          setSettings(res.settings);
        }
      }
    } catch (err) {
      setMessage({ text: 'ดึงข้อมูลเกรดไม่สำเร็จ', type: 'error' });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleRecalculateClick = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmRecalculate = async () => {
    setShowConfirmModal(false);
    setRecalculating(true);
    setMessage({ text: 'กำลังประมวลผลเกรดลูกค้าทั้งหมด กรุณารอสักครู่...', type: 'success' });
    
    try {
      const res = await recalculateAllCustomerGrades();
      if (res?.status === 'success') {
        setMessage({ text: res.message || 'ประมวลผลเสร็จสมบูรณ์', type: 'success' });
      } else {
        setMessage({ text: res?.message || 'ประมวลผลไม่สำเร็จ', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'เกิดข้อผิดพลาด', type: 'error' });
    } finally {
      setRecalculating(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleSave = async () => {
    // Validation
    const emptyName = grades.find(g => !g.grade_name || g.grade_name.trim() === '');
    if (emptyName) {
      setMessage({ text: 'กรุณากรอกชื่อเกรดให้ครบถ้วนทุกรายการ', type: 'error' });
      return;
    }
    const negativeAmount = grades.find(g => g.min_order_amount < 0);
    if (negativeAmount) {
      setMessage({ text: 'ยอดสะสมขั้นต่ำไม่สามารถติดลบได้', type: 'error' });
      return;
    }
    const names = grades.map(g => g.grade_name.trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      setMessage({ text: 'มีชื่อเกรดซ้ำกัน กรุณาแก้ไข', type: 'error' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      // Sort grades descending before saving
      const sortedGrades = [...grades].sort((a, b) => b.min_order_amount - a.min_order_amount);
      setGrades(sortedGrades); // Update UI to reflect the sorted state

      const res = await saveCustomerGradesConfig(sortedGrades, settings);
      if (res?.status === 'success') {
        setMessage({ text: 'บันทึกข้อมูลเรียบร้อย', type: 'success' });
        // Don't await fetchGrades() here, it causes the UI to blink "loading" and hides the toast
        fetchGrades(true);
      } else {
        setMessage({ text: res?.message || 'บันทึกข้อมูลไม่สำเร็จ', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'บันทึกข้อมูลไม่สำเร็จ', type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleAddGrade = () => {
    setGrades([...grades, { grade_name: '', min_order_amount: 0, color_theme: 'bg-gray-100 text-gray-800' }]);
  };

  const handleRemoveGrade = (index: number) => {
    const newGrades = [...grades];
    newGrades.splice(index, 1);
    setGrades(newGrades);
  };

  const handleChange = (index: number, field: keyof CustomerGradeConfig, value: any) => {
    const newGrades = [...grades];
    newGrades[index] = { ...newGrades[index], [field]: value };
    setGrades(newGrades);
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">กำลังโหลด...</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">จัดการเกณฑ์ระดับลูกค้า (Customer Grade)</h2>
          <p className="text-sm text-gray-500 mt-1">
            กำหนดระดับเกรดและยอดสั่งซื้อสะสมขั้นต่ำที่จะได้เกรดนั้น ระบบจะจัดเรียงระดับเกรดจากยอดซื้อมากไปน้อยอัตโนมัติ
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRecalculateClick}
            disabled={recalculating || saving}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              recalculating 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50'
            }`}
          >
            {recalculating ? (
              <><span className="animate-spin h-4 w-4 border-2 border-indigo-400 border-t-transparent rounded-full"></span> ประมวลผล...</>
            ) : (
              'ประมวลผลเกรดลูกค้าทั้งหมด'
            )}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || recalculating}
            className={`px-4 py-2 rounded-lg font-medium text-white transition-colors flex items-center gap-2 ${
              saving || recalculating ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 mb-6 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Settings Section */}
      <div className="mb-8 p-4 bg-gray-50 border rounded-lg">
        <h3 className="font-semibold text-gray-700 mb-4">เงื่อนไขการคำนวณยอดขาย</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">โหมดการคำนวณ (Calculation Mode)</label>
            <select
              id="calcModeSelect"
              value={settings.calc_mode}
              onChange={e => setSettings({ ...settings, calc_mode: e.target.value })}
              className="w-full px-3 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            >
              <option value="all">คิดทุกออเดอร์ (ยอดสั่งซื้อรวมทั้งหมด)</option>
              <option value="order_date">คิดตามช่วงเวลาที่สั่งซื้อ (Order Date)</option>
              <option value="delivery_date">คิดตามช่วงเวลาที่จัดส่งสำเร็จ (Delivery Date)</option>
            </select>
          </div>

          {settings.calc_mode !== 'all' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">รูปแบบช่วงเวลา</label>
              <div className="flex items-center gap-4 mb-3">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio text-indigo-600 focus:ring-indigo-500"
                    name="time_range_type"
                    value="fixed"
                    checked={settings.time_range_type === 'fixed'}
                    onChange={e => setSettings({ ...settings, time_range_type: e.target.value })}
                  />
                  <span className="ml-2 text-sm text-gray-700">กำหนดวันที่คงที่</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio text-indigo-600 focus:ring-indigo-500"
                    name="time_range_type"
                    value="relative"
                    checked={settings.time_range_type === 'relative'}
                    onChange={e => setSettings({ ...settings, time_range_type: e.target.value })}
                  />
                  <span className="ml-2 text-sm text-gray-700">นับย้อนหลัง x วัน</span>
                </label>
              </div>

              {settings.time_range_type === 'fixed' ? (
                <div className="flex gap-2 items-center">
                  <input
                    type="date"
                    value={settings.fixed_start_date || ''}
                    onChange={e => setSettings({ ...settings, fixed_start_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                  <span className="text-gray-500">ถึง</span>
                  <input
                    type="date"
                    value={settings.fixed_end_date || ''}
                    onChange={e => setSettings({ ...settings, fixed_end_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={settings.relative_days}
                    onChange={e => setSettings({ ...settings, relative_days: Number(e.target.value) })}
                    className="w-24 px-3 py-2 border rounded-md text-sm"
                  />
                  <span className="text-sm text-gray-600">วัน นับจากปัจจุบัน</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-y text-gray-600 text-sm">
              <th className="py-3 px-4 font-medium w-1/4">ชื่อเกรด (เช่น A+, VIP)</th>
              <th className="py-3 px-4 font-medium w-1/4">ยอดสะสมขั้นต่ำ (บาท)</th>
              <th className="py-3 px-4 font-medium w-1/3">สีแสดงผล</th>
              <th className="py-3 px-4 font-medium w-32 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {grades.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-500">
                  ไม่มีเกรดในระบบ กรุณาเพิ่มเกรดใหม่
                </td>
              </tr>
            ) : grades.map((grade, idx) => (
              <tr key={idx} className="border-b hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4">
                  <input
                    type="text"
                    value={grade.grade_name}
                    onChange={(e) => handleChange(idx, 'grade_name', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="เช่น A+"
                  />
                </td>
                <td className="py-3 px-4">
                  <input
                    type="number"
                    value={grade.min_order_amount}
                    onChange={(e) => handleChange(idx, 'min_order_amount', Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="0"
                  />
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-2 items-center">
                    <select
                      value={grade.color_theme}
                      onChange={(e) => handleChange(idx, 'color_theme', e.target.value)}
                      className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                    >
                      <option value="bg-gray-100 text-gray-800">เทา (Default)</option>
                      <option value="bg-purple-100 text-purple-800">ม่วง</option>
                      <option value="bg-blue-100 text-blue-800">ฟ้า</option>
                      <option value="bg-green-100 text-green-800">เขียว</option>
                      <option value="bg-yellow-100 text-yellow-800">เหลืองทอง</option>
                      <option value="bg-orange-100 text-orange-800">ส้ม</option>
                      <option value="bg-red-100 text-red-800">แดง</option>
                      <option value="bg-pink-100 text-pink-800">ชมพู</option>
                      <option value="bg-indigo-100 text-indigo-800">คราม</option>
                    </select>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${grade.color_theme}`}>
                      ตัวอย่าง
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4 text-center">
                  <button
                    onClick={() => handleRemoveGrade(idx)}
                    className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition-colors"
                    title="ลบ"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showConfirmModal && (
        <ConfirmModal
          title="ยืนยันการประมวลผล"
          message="คุณต้องการประมวลผลเกรดของลูกค้าทุกคนในบริษัทใหม่ทั้งหมดใช่หรือไม่? (อาจใช้เวลาสักครู่)"
          type="info"
          confirmText="เริ่มประมวลผล"
          onConfirm={handleConfirmRecalculate}
          onClose={() => setShowConfirmModal(false)}
        />
      )}

      <div className="mt-4">
        <button
          onClick={handleAddGrade}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          เพิ่มระดับเกรด
        </button>
      </div>
    </div>
  );
};

export default CustomerGradeManager;
