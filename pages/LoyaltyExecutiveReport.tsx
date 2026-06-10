import React, { useEffect, useState } from 'react';
import { FileText, Printer, Download } from 'lucide-react';
import { apiFetch } from '../services/api';

interface KPIData {
  aov: number;
  repeatRate: number;
  membersWithPoints: number;
  membersWith10Points: number;
  totalSales: number;
  totalUsers: number;
}

const LoyaltyExecutiveReport: React.FC = () => {
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKPI = async () => {
      try {
        const res = await apiFetch('shopee_loyalty?action=dashboard_stats');
        if (res.stats) {
          setData({
            aov: res.stats.aov,
            repeatRate: res.stats.repeat_rate,
            membersWithPoints: res.stats.members_with_points,
            membersWith10Points: res.stats.members_10_points,
            totalSales: res.stats.member_sales,
            totalUsers: res.stats.total_members
          });
        }
      } catch (err) {
        console.error('Failed to load KPI for report', err);
      } finally {
        setLoading(false);
      }
    };
    fetchKPI();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="p-8 text-center text-gray-500">กำลังสร้างรายงาน...</div>;
  if (!data) return <div className="p-8 text-center text-red-500">ไม่สามารถโหลดข้อมูลรายงานได้</div>;

  const monthNamesThai = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  const currentMonth = monthNamesThai[new Date().getMonth()];
  const currentYear = new Date().getFullYear() + 543; // Thai year

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="h-6 w-6 text-indigo-500" />
          รายงานผู้บริหาร (Executive Report)
        </h1>
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Printer className="h-4 w-4" />
          พิมพ์รายงาน
        </button>
      </div>

      <div className="bg-white p-10 rounded-xl border border-gray-200 shadow-sm print:shadow-none print:border-none print:p-0">
        
        {/* Report Header */}
        <div className="text-center border-b-2 border-gray-900 pb-6 mb-8">
          <h2 className="text-3xl font-bold text-gray-900 uppercase tracking-wide">Executive Summary</h2>
          <p className="text-lg text-gray-600 mt-2">โครงการสะสมแต้ม Shopee Loyalty Program</p>
          <p className="text-sm text-gray-500 mt-1">ประจำเดือน {currentMonth} {currentYear}</p>
        </div>

        {/* Report Body */}
        <div className="space-y-8 text-gray-800 leading-relaxed text-lg">
          
          <section>
            <h3 className="text-xl font-bold text-gray-900 border-l-4 border-indigo-500 pl-3 mb-4">1. ภาพรวมยอดขาย (Sales Performance)</h3>
            <p>
              นับตั้งแต่เริ่มโครงการ (1 กรกฎาคม 2569) ระบบสามารถสร้างยอดขายรวมจากลูกค้าที่เข้าร่วมโครงการผ่านช่องทาง Shopee ทั้งสิ้น <strong>฿{data.totalSales.toLocaleString()}</strong> 
              โดยมีฐานลูกค้าที่เกิดการสั่งซื้อจริงจำนวน <strong>{data.totalUsers} ราย</strong>
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-gray-900 border-l-4 border-blue-500 pl-3 mb-4">2. การวิเคราะห์พฤติกรรมลูกค้า (Customer Behavior Analysis)</h3>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>
                <strong>ยอดซื้อเฉลี่ยต่อบิล (AOV):</strong> ปัจจุบันอยู่ที่ <strong>฿{data.aov.toLocaleString()}</strong> 
                {data.aov >= 850 ? ' ซึ่งบรรลุเป้าหมายที่ตั้งไว้ (850 บาท)' : ' ซึ่งยังต่ำกว่าเป้าหมายที่ตั้งไว้ (850 บาท)'} 
                เมื่อเทียบกับฐานเดิมก่อนเริ่มโครงการที่ 696 บาท
              </li>
              <li>
                <strong>อัตราการซื้อซ้ำ (Repeat Rate):</strong> ปัจจุบันอยู่ที่ <strong>{data.repeatRate}%</strong> 
                {data.repeatRate >= 25 ? ' ซึ่งบรรลุเป้าหมายที่ตั้งไว้ (25%)' : ' ซึ่งกำลังเติบโตเข้าใกล้เป้าหมาย (25%)'} 
                เพิ่มขึ้นจากฐานเดิมที่ 17.78%
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-gray-900 border-l-4 border-green-500 pl-3 mb-4">3. ความคืบหน้าการสะสมแต้ม (Loyalty Engagement)</h3>
            <p>
              ปัจจุบันมีลูกค้าที่ได้รับสิทธิ์และเริ่มสะสมแต้มอย่างเป็นทางการแล้วจำนวน <strong>{data.membersWithPoints} ราย</strong> (เป้าหมาย 100 ราย) 
              และมีลูกค้าที่สะสมครบ 10 แต้ม ซึ่งได้รับคูปองส่วนลด 300 บาทไปแล้วจำนวน <strong>{data.membersWith10Points} ราย</strong> (เป้าหมาย 20 ราย)
            </p>
          </section>

          <section className="bg-gray-50 p-6 rounded-lg border border-gray-100 mt-8">
            <h3 className="text-lg font-bold text-gray-900 mb-2">สรุปความเห็นและข้อเสนอแนะ (Conclusion & Recommendation)</h3>
            <p className="text-base text-gray-700">
              โครงการ Shopee Loyalty Program สามารถกระตุ้นให้ลูกค้าเกิดการซื้อซ้ำและรักษายอดสั่งซื้อต่อบิลได้ดี 
              แนะนำให้ทีมการตลาดนำรายชื่อลูกค้าที่ได้แต้ม 8-9 แต้มไปทำแคมเปญกระตุ้น (Retargeting) เพื่อเร่งให้ลูกค้าปิดยอดครบ 10 แต้ม ซึ่งจะช่วยดันยอดขายรวมให้สูงขึ้นในเดือนถัดไป
            </p>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-gray-200 text-sm text-gray-500 flex justify-between">
          <p>เอกสารสร้างอัตโนมัติจากระบบ CRM/ERP</p>
          <p>วันที่พิมพ์: {new Date().toLocaleDateString('th-TH')}</p>
        </div>
      </div>
    </div>
  );
};

export default LoyaltyExecutiveReport;
