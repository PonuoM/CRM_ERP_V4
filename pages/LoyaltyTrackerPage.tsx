import React, { useEffect, useState } from 'react';
import { Gift, Award, Search, ChevronDown, ChevronUp, Loader2, Package, Settings } from 'lucide-react';
import { apiFetch } from '../services/api';
import LoyaltyDashboardView from '../components/loyalty/LoyaltyDashboardView';
import LoyaltySettingsModal from '../components/loyalty/LoyaltySettingsModal';
import { LoyaltyMember, LoyaltyOrder, LoyaltyCoupon, LoyaltySettings, DashboardStats } from '../components/loyalty/types';



const LoyaltyTrackerPage: React.FC = () => {
  const [members, setMembers] = useState<LoyaltyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;
  
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  
  // Local caching state
  const [userOrdersCache, setUserOrdersCache] = useState<Record<string, LoyaltyOrder[]>>({});
  const [userCouponsCache, setUserCouponsCache] = useState<Record<string, LoyaltyCoupon[]>>({});
  
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'coupons'>('orders');

  const [settings, setSettings] = useState<LoyaltySettings>({ 
    spend_per_point: 1500, points_for_coupon: 10, coupon_prefix: 'CAT3000', coupon_discount: 300, coupon_min_spend: 1500, coupon_expiry_days: 30,
    baseline_aov: 696.00, target_aov: 850.00, baseline_repeat_rate: 17.78, target_repeat_rate: 25.00, target_members: 100, target_10_points: 20, target_sales_percent: 30.00,
    points_calculation_mode: 'capped'
  });
  const [showSettings, setShowSettings] = useState(false);
  
  const [mainTab, setMainTab] = useState<'members' | 'dashboard'>('members');
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  const userOrders = expandedUser ? userOrdersCache[expandedUser] || [] : [];
  const userCoupons = expandedUser ? userCouponsCache[expandedUser] || [] : [];

  const toggleExpand = async (username: string) => {
    if (expandedUser === username) {
      setExpandedUser(null);
      return;
    }
    
    setExpandedUser(username);
    setActiveTab('orders');
    
    // Check cache first
    if (userOrdersCache[username] && userCouponsCache[username]) {
      return;
    }

    setLoadingOrders(true);
    setLoadingCoupons(true);
    try {
      const [ordersRes, couponsRes] = await Promise.all([
        apiFetch(`shopee_loyalty?action=member_orders&username=${encodeURIComponent(username)}`),
        apiFetch(`shopee_loyalty?action=member_coupons&username=${encodeURIComponent(username)}`)
      ]);
      setUserOrdersCache(prev => ({ ...prev, [username]: ordersRes.orders || [] }));
      setUserCouponsCache(prev => ({ ...prev, [username]: couponsRes.coupons || [] }));
    } catch (err) {
      console.error('Failed to fetch user details', err);
    } finally {
      setLoadingOrders(false);
      setLoadingCoupons(false);
    }
  };

  const handleUpdateCoupon = async (couponId: number, currentStatus: string) => {
    if (!expandedUser) return;
    const newStatus = currentStatus === 'active' ? 'used' : 'active';
    try {
      const res = await apiFetch('shopee_loyalty?action=update_coupon', {
        method: 'POST',
        body: JSON.stringify({ coupon_id: couponId, status: newStatus })
      });
      if (res.ok) {
        setUserCouponsCache(prev => ({
          ...prev,
          [expandedUser]: (prev[expandedUser] || []).map(c => 
            c.id === couponId 
              ? { ...c, status: newStatus, used_at: newStatus === 'used' ? new Date().toISOString() : null } 
              : c
          )
        }));
      }
    } catch (err) {
      console.error('Failed to update coupon', err);
    }
  };

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const [res, settingsRes] = await Promise.all([
        apiFetch('shopee_loyalty?action=members'),
        apiFetch('shopee_loyalty?action=settings')
      ]);
      setMembers(res.members || []);
      if (settingsRes.settings) {
        setSettings(settingsRes.settings);
      }
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    setLoadingDashboard(true);
    try {
      const res = await apiFetch('shopee_loyalty?action=dashboard_stats');
      if (res.stats) {
        setDashboardStats(res.stats);
      }
      if (res.settings) {
        setSettings(res.settings);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard stats', err);
    } finally {
      setLoadingDashboard(false);
    }
  };

  useEffect(() => {
    if (mainTab === 'dashboard') {
      fetchDashboardStats();
    }
  }, [mainTab]);

  const handleSaveSettings = async (newSettings: LoyaltySettings) => {
    try {
      const res = await apiFetch('shopee_loyalty?action=settings', {
        method: 'POST',
        body: JSON.stringify(newSettings)
      });
      if (res.ok) {
        setSettings(res.settings);
        setShowSettings(false);
        if (mainTab === 'dashboard') {
            fetchDashboardStats();
        }
      }
    } catch (err) {
      console.error('Failed to save settings', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const filteredMembers = members.filter(m => 
    m.shopee_username.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const totalPages = Math.ceil(filteredMembers.length / ITEMS_PER_PAGE);
  const currentMembers = filteredMembers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Award className="h-6 w-6 text-yellow-500" />
            Shopee Loyalty Tracker
          </h1>
          <p className="text-gray-500 mt-1">ติดตามยอดสะสมแต้มและข้อมูลคูปองของลูกค้า Shopee</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อผู้ใช้ Shopee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-64"
            />
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
            title="ตั้งค่าการแจกแต้ม"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setMainTab('members')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              mainTab === 'members'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            รายชื่อสมาชิก
          </button>
          <button
            onClick={() => setMainTab('dashboard')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              mainTab === 'dashboard'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            แดชบอร์ดวัดผล (KPIs)
          </button>
        </nav>
      </div>

      {mainTab === 'members' && (
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-6 py-4 font-medium w-10"></th>
                <th className="px-6 py-4 font-medium">ลำดับ</th>
                <th className="px-6 py-4 font-medium">Shopee Username</th>
                <th className="px-6 py-4 font-medium text-right">ยอดใช้จ่ายรวม</th>
                <th className="px-6 py-4 font-medium text-center">แต้มสะสม</th>
                <th className="px-6 py-4 font-medium">สถานะ</th>
                <th className="px-6 py-4 font-medium text-center">คูปองที่ได้</th>
                <th className="px-6 py-4 font-medium">คูปองล่าสุด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin w-5 h-5" /> กำลังโหลดข้อมูล...
                    </div>
                  </td>
                </tr>
              ) : currentMembers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    ไม่พบข้อมูลสมาชิก
                  </td>
                </tr>
              ) : (
                currentMembers.map((member, index) => {
                  const actualIndex = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                  const targetPoints = settings.points_for_coupon;
                  const currentPointsMod = member.total_points % targetPoints;
                  const isEligible = member.total_points >= targetPoints && currentPointsMod === 0;
                  const progress = member.total_points > 0 && isEligible ? 100 : Math.round((currentPointsMod / targetPoints) * 100);

                  return (
                    <React.Fragment key={member.shopee_username}>
                      <tr 
                        className={`hover:bg-gray-50 transition-colors cursor-pointer ${expandedUser === member.shopee_username ? 'bg-blue-50/30' : ''}`}
                        onClick={() => toggleExpand(member.shopee_username)}
                      >
                        <td className="px-4 py-4 text-gray-400 text-center">
                          {expandedUser === member.shopee_username ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </td>
                        <td className="px-6 py-4 text-gray-500">{actualIndex}</td>
                        <td className="px-6 py-4 font-medium text-gray-900">{member.shopee_username}</td>
                        <td className="px-6 py-4 text-right text-gray-600">฿{(member.total_spent || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="font-bold text-gray-900 text-lg">{member.total_points}</span>
                            <span className="text-gray-500 text-xs">แต้ม</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 w-48">
                          {isEligible ? (
                            <div className="flex items-center gap-1.5 text-green-600 font-medium bg-green-50 px-2.5 py-1 rounded-full w-max text-xs border border-green-200">
                              <Gift className="h-3.5 w-3.5" />
                              <span>พร้อมรับคูปอง</span>
                            </div>
                          ) : (
                            <div className="w-full">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-500">สะสมแต้ม</span>
                                <span className="font-medium text-gray-700">{progress}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-500 h-2 rounded-full transition-all" 
                                  style={{ width: `${progress}%` }}
                                ></div>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {member.coupons_count > 0 ? (
                            <span className="inline-flex items-center justify-center bg-purple-100 text-purple-700 h-6 w-6 rounded-full font-bold text-xs">
                              {member.coupons_count}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {member.latest_coupon ? (
                            <code className="bg-gray-100 text-gray-800 px-2 py-1 rounded border border-gray-200 font-mono text-xs">
                              {member.latest_coupon}
                            </code>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>

                      {expandedUser === member.shopee_username && (
                        <tr>
                          <td colSpan={8} className="px-0 py-0 bg-gray-50 border-b border-gray-200">
                            <div className="px-6 py-4">
                              <div className="flex border-b border-gray-200 mb-4">
                                <button 
                                  className={`px-4 py-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'orders' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                  onClick={() => setActiveTab('orders')}
                                >
                                  <Package size={16} /> ประวัติการสั่งซื้อ ({userOrders.length})
                                </button>
                                <button 
                                  className={`px-4 py-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'coupons' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                  onClick={() => setActiveTab('coupons')}
                                >
                                  <Gift size={16} /> คูปองสะสม ({userCoupons.length})
                                </button>
                              </div>

                              {activeTab === 'orders' && (
                                <div>
                                  {loadingOrders ? (
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                      <Loader2 size={16} className="animate-spin" /> กำลังโหลดประวัติ...
                                    </div>
                                  ) : userOrders.length > 0 ? (
                                    <div className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
                                      <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-100 text-gray-600">
                                          <tr>
                                            <th className="px-4 py-2 font-medium">วันที่สั่งซื้อ</th>
                                            <th className="px-4 py-2 font-medium">Order ID</th>
                                            <th className="px-4 py-2 font-medium">รายการสินค้า</th>
                                            <th className="px-4 py-2 font-medium text-right">ยอดชำระสุทธิ</th>
                                            <th className="px-4 py-2 font-medium text-center">แต้มที่ได้รับ</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                          {userOrders.map(order => (
                                            <tr key={order.order_id} className="hover:bg-gray-50">
                                              <td className="px-4 py-2 text-gray-600">
                                                {new Date(order.order_date).toLocaleString('th-TH')}
                                              </td>
                                              <td className="px-4 py-2 font-mono text-gray-800">{order.order_id}</td>
                                              <td className="px-4 py-3 text-gray-700">
                                                {order.items_summary ? (
                                                  <div className="flex flex-col gap-1.5 mt-1">
                                                    {order.items_summary.split('||').map((item, idx) => (
                                                      <div key={idx} className="flex items-start gap-2 text-[11px] leading-tight">
                                                        <div className="w-3 h-3 mt-0.5 border-l border-b border-gray-300 rounded-bl-sm flex-shrink-0"></div>
                                                        <span className="text-gray-600 break-words line-clamp-2">{item}</span>
                                                      </div>
                                                    ))}
                                                  </div>
                                                ) : (
                                                  <span className="text-gray-400">-</span>
                                                )}
                                              </td>
                                              <td className="px-4 py-2 text-right text-gray-900 font-medium">
                                                ฿{Number(order.total_amount).toLocaleString()}
                                              </td>
                                              <td className="px-4 py-2 text-center">
                                                {order.points_earned > 0 ? (
                                                  <span className="inline-flex items-center gap-1 text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded text-[11px]">
                                                    +{order.points_earned} แต้ม
                                                  </span>
                                                ) : (
                                                  <span className="text-gray-400">-</span>
                                                )}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-500">ไม่มีประวัติการสั่งซื้อในระบบ</p>
                                  )}
                                </div>
                              )}

                              {activeTab === 'coupons' && (
                                <div>
                                  {loadingCoupons ? (
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                      <Loader2 size={16} className="animate-spin" /> กำลังโหลดข้อมูลคูปอง...
                                    </div>
                                  ) : userCoupons.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                      {userCoupons.map(coupon => (
                                        <div key={coupon.id} className={`border rounded-lg p-4 relative overflow-hidden ${coupon.status === 'used' ? 'bg-gray-50 border-gray-200' : 'bg-white border-purple-200 shadow-sm'}`}>
                                          {coupon.status === 'used' && (
                                            <div className="absolute top-3 right-3 text-xs font-bold text-gray-400 border border-gray-300 rounded px-2 py-1 transform rotate-12">
                                              USED
                                            </div>
                                          )}
                                          <div className="flex justify-between items-start mb-2">
                                            <div>
                                              <span className="text-xs text-gray-500 block mb-1">รหัสคูปอง</span>
                                              <code className={`font-mono text-lg font-bold px-2 py-1 rounded ${coupon.status === 'used' ? 'bg-gray-200 text-gray-500' : 'bg-purple-100 text-purple-800'}`}>
                                                {coupon.code}
                                              </code>
                                            </div>
                                          </div>
                                          <div className="mt-3 text-sm">
                                            <div className="flex justify-between mb-1">
                                              <span className="text-gray-500">ส่วนลด:</span>
                                              <span className="font-medium text-gray-900">฿{Number(coupon.discount_value).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between mb-1">
                                              <span className="text-gray-500">ขั้นต่ำ:</span>
                                              <span className="font-medium text-gray-900">฿{Number(coupon.min_spend).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between mb-3 text-xs text-gray-400">
                                              <span>สร้างเมื่อ: {new Date(coupon.created_at).toLocaleDateString('th-TH')}</span>
                                            </div>
                                          </div>
                                          <button
                                            onClick={() => handleUpdateCoupon(coupon.id, coupon.status)}
                                            className={`w-full py-2 rounded text-xs font-medium transition-colors ${coupon.status === 'active' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                                          >
                                            {coupon.status === 'active' ? 'ทำเครื่องหมายว่าใช้งานแล้ว' : 'ยกเลิกสถานะใช้งานแล้ว'}
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-500">ยังไม่มีคูปองสะสม</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-white">
            <div className="text-sm text-gray-500">
              แสดง {((currentPage - 1) * ITEMS_PER_PAGE) + 1} ถึง {Math.min(currentPage * ITEMS_PER_PAGE, filteredMembers.length)} จากทั้งหมด {filteredMembers.length} รายการ
            </div>
            <div className="flex gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                ก่อนหน้า
              </button>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                ถัดไป
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {mainTab === 'dashboard' && dashboardStats && (
        <LoyaltyDashboardView stats={dashboardStats} settings={settings} />
      )}

      {showSettings && (
        <LoyaltySettingsModal 
          initialSettings={settings} 
          onSave={handleSaveSettings} 
          onClose={() => setShowSettings(false)} 
        />
      )}
    </div>
  );
};

export default LoyaltyTrackerPage;
