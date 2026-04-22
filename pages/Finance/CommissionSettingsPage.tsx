import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { Settings, Save, RefreshCw, AlertCircle, Users, CheckCircle, Tag, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '../../services/api';

interface CommissionSettingsPageProps {
  currentUser: User;
}

interface Tier {
  min: number;
  max: number | null;
  percent: number;
}

interface CategoryRule {
  type: 'fixed_per_qty' | 'tiered_percent' | 'percent_of_item';
  value?: number;
  tier_base?: string;
  apply_to?: string;
  tiers?: Tier[];
}

interface RuleSet {
  [category: string]: CategoryRule;
}

interface CommissionConfig {
  general: {
    digging_basket_keys: string[];
    delivery_max_day: number;
    payment_max_day: number;
  };
  rules: {
    self: RuleSet;
    team: RuleSet;
    digging: RuleSet;
  };
}

const DEFAULT_CONFIG: CommissionConfig = {
  general: {
    digging_basket_keys: ["49", "50"],
    delivery_max_day: 5,
    payment_max_day: 20
  },
  rules: {
    self: {
      "กระสอบใหญ่": { type: 'fixed_per_qty', value: 16 },
      "กระสอบเล็ก": { type: 'fixed_per_qty', value: 8 },
      "ชีวภัณฑ์": { 
        type: 'tiered_percent', 
        tier_base: 'total_sales_all_products', 
        apply_to: 'specific_product_sales',
        tiers: [
          { min: 1, max: 150000, percent: 3 },
          { min: 150001, max: 300000, percent: 4 },
          { min: 300001, max: null, percent: 5 }
        ]
      }
    },
    team: {
      "กระสอบใหญ่": { type: 'fixed_per_qty', value: 3 },
      "กระสอบเล็ก": { type: 'fixed_per_qty', value: 1.5 },
      "ชีวภัณฑ์": { 
        type: 'tiered_percent', 
        tier_base: 'total_sales_all_products', 
        apply_to: 'specific_product_sales',
        tiers: [
          { min: 1, max: 100000, percent: 0.5 },
          { min: 100001, max: 300000, percent: 1 },
          { min: 300001, max: null, percent: 1.5 }
        ]
      }
    },
    digging: {
      "กระสอบใหญ่": { type: 'fixed_per_qty', value: 20 },
      "กระสอบเล็ก": { type: 'fixed_per_qty', value: 10 },
      "ชีวภัณฑ์": { type: 'percent_of_item', value: 10 }
    }
  }
};

const ROLES = [
  { id: 7, name: 'Telesale' },
  { id: 6, name: 'Supervisor Telesale' },
  { id: 3, name: 'Telesale (Other)' }
];

export default function CommissionSettingsPage({ currentUser }: CommissionSettingsPageProps) {
  const [activeRole, setActiveRole] = useState<number>(7);
  const [config, setConfig] = useState<CommissionConfig>(JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'self' | 'team' | 'digging'>('general');

  const loadSettings = async (roleId: number) => {
    setIsLoading(true);
    try {
      const res = await apiFetch(`Commission/settings.php?company_id=${currentUser.companyId}&role_id=${roleId}`);
      if (res.ok && res.data) {
        setConfig(res.data.config_data || JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
      } else {
        // Fallback to default if not found
        setConfig(JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
      }
    } catch (e) {
      console.error('Failed to load settings', e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadSettings(activeRole);
  }, [activeRole, currentUser.companyId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await apiFetch('Commission/settings.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: currentUser.companyId,
          role_id: activeRole,
          user_id: currentUser.id,
          config_data: config
        })
      });
      if (res.ok) {
        alert('บันทึกการตั้งค่าตอมมิชชันสำเร็จ');
      } else {
        alert('เกิดข้อผิดพลาด: ' + res.error);
      }
    } catch (e: any) {
      alert('เกิดข้อผิดพลาด: ' + e.message);
    }
    setIsSaving(false);
  };

  const updateGeneral = (field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      general: { ...prev.general, [field]: value }
    }));
  };

  const updateRuleValue = (section: 'self' | 'team' | 'digging', category: string, value: number) => {
    setConfig(prev => {
      const next = { ...prev };
      if (!next.rules[section][category]) return next;
      next.rules[section][category].value = value;
      return next;
    });
  };

  const updateTier = (section: 'self' | 'team' | 'digging', category: string, tierIndex: number, field: keyof Tier, value: any) => {
    setConfig(prev => {
      const next = { ...prev };
      const rule = next.rules[section][category];
      if (rule.tiers && rule.tiers[tierIndex]) {
        rule.tiers[tierIndex] = { ...rule.tiers[tierIndex], [field]: value === '' ? null : Number(value) };
      }
      return next;
    });
  };

  const addTier = (section: 'self' | 'team' | 'digging', category: string) => {
    setConfig(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const rule = next.rules[section][category];
      if (rule.tiers) {
        rule.tiers.push({ min: 0, max: null, percent: 0 });
      }
      return next;
    });
  };

  const removeTier = (section: 'self' | 'team' | 'digging', category: string, tierIndex: number) => {
    setConfig(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const rule = next.rules[section][category];
      if (rule.tiers) {
        rule.tiers.splice(tierIndex, 1);
      }
      return next;
    });
  };

  const renderRuleSet = (section: 'self' | 'team' | 'digging') => {
    const rules = config.rules[section] || {};
    
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {Object.entries(rules).map(([category, rule]) => (
          <div key={category} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
              <Tag className="w-5 h-5 text-indigo-500" />
              หมวดหมู่: {category}
            </h3>
            
            {rule.type === 'fixed_per_qty' && (
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-600">ราคากระสอบละ (บาท):</label>
                <input 
                  type="number"
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={rule.value || 0}
                  onChange={e => updateRuleValue(section, category, parseFloat(e.target.value))}
                />
              </div>
            )}
            
            {rule.type === 'percent_of_item' && (
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-600">คิดเป็นเปอร์เซ็นต์ของมูลค่า (%):</label>
                <input 
                  type="number"
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={rule.value || 0}
                  onChange={e => updateRuleValue(section, category, parseFloat(e.target.value))}
                />
              </div>
            )}
            
            {rule.type === 'tiered_percent' && rule.tiers && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <AlertCircle className="w-4 h-4 text-indigo-500" />
                  คำนวณขั้นบันไดโดยดูจาก <strong>ยอดขายรวมทุกประเภท</strong> แต่นำ % กลับมาคูณเฉพาะยอดขายของ <strong>{category}</strong>
                </div>
                
                <div className="grid grid-cols-12 gap-2 text-sm font-medium text-gray-600 px-2">
                  <div className="col-span-4">ยอดขาย (ตั้งแต่)</div>
                  <div className="col-span-4">ถึง (เว้นว่าง = ไม่มีลิมิต)</div>
                  <div className="col-span-3">ได้รับเปอร์เซ็นต์ (%)</div>
                  <div className="col-span-1"></div>
                </div>
                
                {rule.tiers.map((tier, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center bg-gray-50/50 p-2 rounded-lg border border-gray-100 hover:border-indigo-200 transition-colors">
                    <div className="col-span-4">
                      <input 
                        type="number" 
                        value={tier.min}
                        onChange={e => updateTier(section, category, i, 'min', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-indigo-500"
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-4">
                      <input 
                        type="number" 
                        value={tier.max === null ? '' : tier.max}
                        onChange={e => updateTier(section, category, i, 'max', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-indigo-500"
                        placeholder="ไม่สิ้นสุด"
                      />
                    </div>
                    <div className="col-span-3">
                      <input 
                        type="number" 
                        step="0.1"
                        value={tier.percent}
                        onChange={e => updateTier(section, category, i, 'percent', e.target.value)}
                        className="w-full px-3 py-2 border border-blue-300 bg-blue-50/50 rounded-lg outline-none focus:border-indigo-500 font-medium text-indigo-700"
                      />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button 
                        onClick={() => removeTier(section, category, i)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                
                <button 
                  onClick={() => addTier(section, category)}
                  className="mt-2 flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium px-3 py-2 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  <Plus className="w-4 h-4" /> เพิ่มขั้นบันได
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50/50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center shadow-inner">
                <Settings className="w-6 h-6 text-indigo-600" />
              </div>
              ตั้งค่าเรตค่าคอมมิชชัน
            </h1>
            <p className="text-sm text-gray-500 mt-2 ml-1">กำหนดขั้นตอนและอัตราการจัดแบ่งค่าคอมมิชชันแยกตามบทบาท (Role)</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => loadSettings(activeRole)}
              className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-indigo-600 transition-colors"
              title="โหลดข้อมูลใหม่"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin text-indigo-500' : ''}`} />
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              บันทึกการตั้งค่า
            </button>
          </div>
        </div>

        {/* Role Selector Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {ROLES.map(role => (
            <button
              key={role.id}
              onClick={() => setActiveRole(role.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all duration-200 ${
                activeRole === role.id 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 ring-2 ring-indigo-600 ring-offset-2' 
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
              }`}
            >
              <Users className={`w-4 h-4 ${activeRole === role.id ? 'text-indigo-200' : 'text-gray-400'}`} />
              {role.name}
              {activeRole === role.id && <CheckCircle className="w-4 h-4 ml-1 opacity-70" />}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Inner Tabs */}
            <div className="flex overflow-x-auto border-b border-gray-100 bg-gray-50/80 p-2 gap-1">
              <button 
                onClick={() => setActiveTab('general')}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-white text-indigo-700 shadow-sm border border-gray-200' : 'text-gray-600 hover:bg-gray-200/50'}`}
              >
                เงื่อนไขทั่วไป (General)
              </button>
              <button 
                onClick={() => setActiveTab('self')}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'self' ? 'bg-white text-indigo-700 shadow-sm border border-gray-200' : 'text-gray-600 hover:bg-gray-200/50'}`}
              >
                ยอดขายส่วนตัว (Self Sales)
              </button>
              {activeRole === 6 && (
                <button 
                  onClick={() => setActiveTab('team')}
                  className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'team' ? 'bg-white text-indigo-700 shadow-sm border border-gray-200' : 'text-gray-600 hover:bg-gray-200/50'}`}
                >
                  ยอดขายทีม (Team Sales)
                </button>
              )}
              <button 
                onClick={() => setActiveTab('digging')}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'digging' ? 'bg-white text-indigo-700 shadow-sm border border-gray-200' : 'text-gray-600 hover:bg-gray-200/50'}`}
              >
                ออเดอร์ขุด (Digging)
              </button>
            </div>

            <div className="p-6 bg-gray-50/30">
              {/* General Tab */}
              {activeTab === 'general' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="bg-white p-5 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center gap-6 shadow-sm">
                    <div className="flex-1">
                      <h3 className="text-gray-800 font-semibold mb-1">วันสิ้นสุดการส่งสินค้า (เดือนถัดไป)</h3>
                      <p className="text-xs text-gray-500">ออเดอร์ที่ถูกกดยืนยันการส่งหลังวันที่ที่กำหนด จะไม่ถูกนำมาคิดในรอบบิลปัจจุบัน</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 font-medium">วันที่</span>
                      <input 
                        type="number" 
                        min="1" max="31"
                        value={config.general.delivery_max_day || ''}
                        onChange={e => updateGeneral('delivery_max_day', Number(e.target.value))}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 outline-none block text-center font-medium"
                      />
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center gap-6 shadow-sm">
                    <div className="flex-1">
                      <h3 className="text-gray-800 font-semibold mb-1">วันสิ้นสุดการรับชำระเงิน (เดือนถัดไป)</h3>
                      <p className="text-xs text-gray-500">ออเดอร์ที่เก็บเงินปลายทางสำเร็จหรือโอนเงินสำเร็จหลังวันที่ที่กำหนด จะไม่ถูกนำมาคิดในรอบบิลปัจจุบัน</p>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="text-sm text-gray-500 font-medium">วันที่</span>
                       <input 
                        type="number" 
                        min="1" max="31"
                        value={config.general.payment_max_day || ''}
                        onChange={e => updateGeneral('payment_max_day', Number(e.target.value))}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 outline-none block text-center font-medium"
                      />
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center gap-6 shadow-sm">
                    <div className="flex-1">
                      <h3 className="text-gray-800 font-semibold mb-1">ตะกร้า "ออเดอร์ขุด" (Basket ID)</h3>
                      <p className="text-xs text-gray-500">ใส่คั่นด้วยเครื่องหมายลูกน้ำสำหรับตะกร้าเก่าแบบ 49, 50</p>
                    </div>
                    <div className="w-full sm:w-64">
                       <input 
                        type="text" 
                        value={config.general.digging_basket_keys?.join(', ') || ''}
                        onChange={e => updateGeneral('digging_basket_keys', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 outline-none block"
                        placeholder="เช่น 49, 50"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Other Tabs */}
              {activeTab === 'self' && renderRuleSet('self')}
              {activeTab === 'team' && renderRuleSet('team')}
              {activeTab === 'digging' && renderRuleSet('digging')}

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
