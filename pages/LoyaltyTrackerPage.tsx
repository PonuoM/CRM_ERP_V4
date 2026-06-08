import React, { useEffect, useState } from 'react';
import { Gift, Award, Clock, Search, ExternalLink } from 'lucide-react';
import { apiFetch } from '../services/api';

interface LoyaltyMember {
  shopee_username: string;
  total_points: number;
  created_at: string;
  coupons_count: number;
  latest_coupon: string | null;
  total_spent: number;
}

const LoyaltyTrackerPage: React.FC = () => {
  const [members, setMembers] = useState<LoyaltyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('shopee_loyalty?action=members');
      setMembers(res.members || []);
    } catch (err) {
      console.error('Failed to fetch members', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const filteredMembers = members.filter(m => 
    m.shopee_username.toLowerCase().includes(search.toLowerCase())
  );

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
      </div>

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-6 py-4 font-medium">ลำดับ</th>
                <th className="px-6 py-4 font-medium">Shopee Username</th>
                <th className="px-6 py-4 font-medium">ยอดใช้จ่ายรวม</th>
                <th className="px-6 py-4 font-medium">แต้มสะสม</th>
                <th className="px-6 py-4 font-medium">สถานะ</th>
                <th className="px-6 py-4 font-medium">คูปองที่ได้</th>
                <th className="px-6 py-4 font-medium">คูปองล่าสุด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    ไม่พบข้อมูลสมาชิก (ลองอัปโหลดไฟล์ Shopee เข้าระบบ)
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member, index) => {
                  const isEligible = member.total_points >= 10 && member.total_points % 10 === 0;
                  const progress = (member.total_points % 10) * 10; // 0 to 90%

                  return (
                    <tr key={member.shopee_username} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-gray-500">{index + 1}</td>
                      <td className="px-6 py-4 font-medium text-gray-900">{member.shopee_username}</td>
                      <td className="px-6 py-4 text-gray-600">฿{(member.total_spent || 0).toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
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
                      <td className="px-6 py-4 text-gray-600">
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
                          <div className="flex items-center gap-2">
                            <code className="bg-gray-100 text-gray-800 px-2 py-1 rounded border border-gray-200 font-mono text-xs">
                              {member.latest_coupon}
                            </code>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LoyaltyTrackerPage;
