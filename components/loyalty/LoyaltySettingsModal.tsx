import React, { useState } from 'react';
import { Settings, X, Save, Loader2 } from 'lucide-react';
import { LoyaltySettings } from './types';

interface LoyaltySettingsModalProps {
  initialSettings: LoyaltySettings;
  onSave: (settings: LoyaltySettings) => Promise<void>;
  onClose: () => void;
}

const LoyaltySettingsModal: React.FC<LoyaltySettingsModalProps> = ({ initialSettings, onSave, onClose }) => {
  const [editSettings, setEditSettings] = useState<LoyaltySettings>(initialSettings);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(editSettings);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b shrink-0">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-500" />
            ตั้งค่าระบบสะสมแต้มและเป้าหมาย
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto grow">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Column 1: Core Settings */}
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-bold text-gray-800 border-b pb-2 mb-3">ตั้งค่าการสะสมแต้ม</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">วิธีการคำนวณแต้ม</label>
                    <div className="space-y-2">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="points_calculation_mode"
                          value="capped"
                          checked={editSettings.points_calculation_mode === 'capped'}
                          onChange={(e) => setEditSettings({...editSettings, points_calculation_mode: e.target.value as 'capped' | 'proportional'})}
                          className="mt-0.5 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-800">จำกัด 1 แต้มต่อออเดอร์ (ไม่ทบ)</div>
                          <p className="text-xs text-gray-500">แจก 1 แต้มเมื่อยอดถึงเกณฑ์ขั้นต่ำ (ไม่ว่ายอดจะสูงแค่ไหนก็ได้ 1 แต้ม)</p>
                        </div>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="points_calculation_mode"
                          value="proportional"
                          checked={editSettings.points_calculation_mode === 'proportional'}
                          onChange={(e) => setEditSettings({...editSettings, points_calculation_mode: e.target.value as 'capped' | 'proportional'})}
                          className="mt-0.5 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-800">ทบแต้มตามยอดสั่งซื้อ (แบบทบ)</div>
                          <p className="text-xs text-gray-500">ได้ 1 แต้มต่อทุกๆ ยอดขั้นต่ำ (เช่น ยอด 16,500 ÷ 1,500 = 11 แต้ม)</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ยอดใช้จ่ายต่อ 1 แต้ม (บาท)</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={editSettings.spend_per_point}
                        onChange={(e) => setEditSettings({...editSettings, spend_per_point: Number(e.target.value)})}
                        className="w-full pl-3 pr-10 py-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                      />
                      <span className="absolute right-3 top-2 text-gray-400">฿</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">ยอดใช้จ่ายหารด้วยจำนวนนี้ ปัดเศษทิ้งเป็นจำนวนแต้ม</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">แต้มที่ต้องสะสมเพื่อรับคูปอง (แต้ม)</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={editSettings.points_for_coupon}
                        onChange={(e) => setEditSettings({...editSettings, points_for_coupon: Number(e.target.value)})}
                        className="w-full pl-3 pr-10 py-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                      />
                      <span className="absolute right-3 top-2 text-gray-400">⭐</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">เมื่อสะสมครบจำนวนนี้ ระบบจะแจกคูปอง 1 ใบอัตโนมัติ</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-gray-800 border-b pb-2 mb-3">คุณสมบัติของคูปองที่จะแจก</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ตัวอักษรนำหน้าคูปอง (Prefix)</label>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={10}
                        value={editSettings.coupon_prefix}
                        onChange={(e) => setEditSettings({...editSettings, coupon_prefix: e.target.value.toUpperCase()})}
                        className="w-full pl-3 pr-4 py-2 border rounded focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                        placeholder="เช่น CAT3000"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">คูปองที่สุ่มใหม่จะขึ้นต้นด้วยอักษรนี้</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ส่วนลดคูปอง (บาท)</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={editSettings.coupon_discount}
                        onChange={(e) => setEditSettings({...editSettings, coupon_discount: Number(e.target.value)})}
                        className="w-full pl-3 pr-10 py-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                      />
                      <span className="absolute right-3 top-2 text-gray-400">฿</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ยอดซื้อขั้นต่ำของคูปอง (บาท)</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={editSettings.coupon_min_spend}
                        onChange={(e) => setEditSettings({...editSettings, coupon_min_spend: Number(e.target.value)})}
                        className="w-full pl-3 pr-10 py-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                      />
                      <span className="absolute right-3 top-2 text-gray-400">฿</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">อายุการใช้งานคูปอง (วัน)</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={editSettings.coupon_expiry_days}
                        onChange={(e) => setEditSettings({...editSettings, coupon_expiry_days: Number(e.target.value)})}
                        className="w-full pl-3 pr-10 py-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                      />
                      <span className="absolute right-3 top-2 text-gray-400">วัน</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: KPI Targets */}
            <div>
              <h4 className="text-sm font-bold text-gray-800 border-b pb-2 mb-3">เป้าหมาย KPI แดชบอร์ด</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">AOV ฐานเดิม (฿)</label>
                  <input
                    type="number"
                    value={editSettings.baseline_aov}
                    onChange={(e) => setEditSettings({...editSettings, baseline_aov: Number(e.target.value)})}
                    className="w-full px-3 py-1.5 border rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">AOV เป้าหมาย (฿)</label>
                  <input
                    type="number"
                    value={editSettings.target_aov}
                    onChange={(e) => setEditSettings({...editSettings, target_aov: Number(e.target.value)})}
                    className="w-full px-3 py-1.5 border rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ซื้อซ้ำ ฐานเดิม (%)</label>
                  <input
                    type="number"
                    value={editSettings.baseline_repeat_rate}
                    onChange={(e) => setEditSettings({...editSettings, baseline_repeat_rate: Number(e.target.value)})}
                    className="w-full px-3 py-1.5 border rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ซื้อซ้ำ เป้าหมาย (%)</label>
                  <input
                    type="number"
                    value={editSettings.target_repeat_rate}
                    onChange={(e) => setEditSettings({...editSettings, target_repeat_rate: Number(e.target.value)})}
                    className="w-full px-3 py-1.5 border rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">เป้าหมายสมาชิกรวม</label>
                  <input
                    type="number"
                    value={editSettings.target_members}
                    onChange={(e) => setEditSettings({...editSettings, target_members: Number(e.target.value)})}
                    className="w-full px-3 py-1.5 border rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">เป้าหมายลูกค้า 10 แต้ม</label>
                  <input
                    type="number"
                    value={editSettings.target_10_points}
                    onChange={(e) => setEditSettings({...editSettings, target_10_points: Number(e.target.value)})}
                    className="w-full px-3 py-1.5 border rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">เป้าหมายสัดส่วนยอดขายสมาชิกเทียบทั้งหมด (%)</label>
                  <input
                    type="number"
                    value={editSettings.target_sales_percent}
                    onChange={(e) => setEditSettings({...editSettings, target_sales_percent: Number(e.target.value)})}
                    className="w-full px-3 py-1.5 border rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 p-3 rounded text-sm text-blue-800 mt-6">
            <strong>หมายเหตุ:</strong> การตั้งค่าใหม่จะมีผลกับ <b>"การสร้างคูปองใบใหม่"</b> และ <b>"นำเข้าออเดอร์ใหม่"</b> เท่านั้น จะไม่ส่งผลกับแต้มหรือคูปองในอดีต
          </div>
        </div>
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-100 text-gray-700 transition-colors text-sm font-medium"
          >
            ยกเลิก
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            บันทึกการตั้งค่า
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoyaltySettingsModal;
