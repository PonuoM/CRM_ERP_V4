import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import LoyaltyDashboardView from '../components/loyalty/LoyaltyDashboardView';
import { DashboardStats, LoyaltySettings } from '../components/loyalty/types';

const LoyaltyDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [settings, setSettings] = useState<LoyaltySettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKPI = async () => {
      try {
        const [kpiRes, settingsRes] = await Promise.all([
          apiFetch('shopee_loyalty?action=dashboard_stats'),
          apiFetch('shopee_loyalty?action=settings')
        ]);
        if (kpiRes.stats) {
          setData(kpiRes.stats);
        }
        if (settingsRes.settings) {
          setSettings(settingsRes.settings);
        }
      } catch (err) {
        console.error('Failed to load KPI', err);
      } finally {
        setLoading(false);
      }
    };
    fetchKPI();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">กำลังโหลด Dashboard...</div>;
  }

  if (!data || !settings) {
    return <div className="p-8 text-center text-red-500">ไม่สามารถโหลดข้อมูลแดชบอร์ดได้</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <LoyaltyDashboardView stats={data} settings={settings} />
    </div>
  );
};

export default LoyaltyDashboard;
