import React, { useState, useEffect } from 'react';
import UniversalDateRangePicker from '@/components/UniversalDateRangePicker';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import { apiFetch } from '@/services/api';
import { format } from 'date-fns';

interface AudioLink {
  url: string;
  date?: string;
  notes?: string;
}

interface OrderData {
  order_id: string;
  order_date: string;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  payment_method: string;
  order_status: string;
  cancel_type: string;
  cancel_notes: string;
  admin_resolution_notes?: string;
  cancelled_at: string;
  returned_at: string;
  creator_name: string;
  audio_links: AudioLink[];
}

const ReturnedOrdersReportPage: React.FC = () => {
  const toast = useToast();
  
  // State
  const [activeTab, setActiveTab] = useState<'Returned' | 'Cancelled'>('Returned');
  const [dateRange, setDateRange] = useState({
    start: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [data, setData] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingAudio, setProcessingAudio] = useState<string | null>(null);
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [modalOrderId, setModalOrderId] = useState<string>('');
  const [modalAudioUrl, setModalAudioUrl] = useState<string>('');
  const [modalAudioDate, setModalAudioDate] = useState<string>('');
  const [modalAudioNotes, setModalAudioNotes] = useState<string>('');

  // Summary Modal
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [summaryOrderId, setSummaryOrderId] = useState<string>('');
  const [summaryText, setSummaryText] = useState<string>('');

  // Filters
  const [userId, setUserId] = useState<string>('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const start = dateRange.start;
      const end = dateRange.end;
      
      const json = await apiFetch(`returned_orders_report?start_date=${start}&end_date=${end}&status_type=${activeTab}&user_id=${userId}`);
      
      if (json && json.ok) {
        setData(json.data);
      } else {
        toast.error('ข้อผิดพลาด', json?.message || 'ไม่สามารถดึงข้อมูลได้');
      }
    } catch (err: any) {
      toast.error('ข้อผิดพลาด', err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleAutoMatch = async (orderId: string) => {
    try {
      setProcessingAudio(orderId);
      const json = await apiFetch('returned_orders_report/auto-match', {
        method: 'POST',
        body: JSON.stringify({ order_id: orderId })
      });
      
      if (json && json.ok) {
        toast.success('สำเร็จ', json.message || 'จับคู่ไฟล์เสียงสำเร็จ');
        fetchData(); // refresh to show new audio
      } else {
        toast.error('ข้อผิดพลาด', json?.message);
      }
    } catch (err: any) {
      toast.error('ข้อผิดพลาด', err.message);
    } finally {
      setProcessingAudio(null);
    }
  };

  const handleManualAttach = (orderId: string) => {
    setModalOrderId(orderId);
    setModalAudioUrl('');
    setModalAudioDate('');
    setModalAudioNotes('');
    setIsAudioModalOpen(true);
  };

  const submitManualAttach = async () => {
    if (!modalAudioUrl.trim()) {
      toast.error('ข้อผิดพลาด', 'กรุณาระบุลิงก์ไฟล์เสียง');
      return;
    }
    
    try {
      setIsAudioModalOpen(false);
      setProcessingAudio(modalOrderId);
      const json = await apiFetch('returned_orders_report/manual-audio', {
        method: 'POST',
        body: JSON.stringify({ 
          order_id: modalOrderId, 
          audio_url: modalAudioUrl,
          audio_date: modalAudioDate,
          notes: modalAudioNotes
        })
      });
      
      if (json && json.ok) {
        toast.success('สำเร็จ', 'แนบไฟล์เสียงเรียบร้อยแล้ว');
        fetchData();
      } else {
        toast.error('ข้อผิดพลาด', json?.message);
      }
    } catch (err: any) {
      toast.error('ข้อผิดพลาด', err.message);
    } finally {
      setProcessingAudio(null);
    }
  };

  const handleEditSummary = (orderId: string, currentSummary: string) => {
    setSummaryOrderId(orderId);
    setSummaryText(currentSummary || '');
    setIsSummaryModalOpen(true);
  };

  const submitSummary = async () => {
    try {
      setIsSummaryModalOpen(false);
      const json = await apiFetch('returned_orders_report/summary', {
        method: 'POST',
        body: JSON.stringify({ order_id: summaryOrderId, summary: summaryText })
      });
      
      if (json && json.ok) {
        toast.success('สำเร็จ', 'บันทึกสรุปออเดอร์เรียบร้อยแล้ว');
        fetchData();
      } else {
        toast.error('ข้อผิดพลาด', json?.message);
      }
    } catch (err: any) {
      toast.error('ข้อผิดพลาด', err.message);
    }
  };

  // Summary calc
  const totalOrders = data.length;
  const totalAmount = data.reduce((sum, item) => sum + parseFloat(item.total_amount as any || 0), 0);

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
        <header className="flex justify-between items-center p-4 bg-white border-b shadow-sm">
          <h1 className="text-2xl font-semibold">รายงานออเดอร์ตีกลับและยกเลิก</h1>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="flex border-b">
              <button
                className={`flex-1 py-4 text-center font-medium ${activeTab === 'Returned' ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50/30' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('Returned')}
              >
                ออเดอร์ตีกลับ (Returned)
              </button>
              <button
                className={`flex-1 py-4 text-center font-medium ${activeTab === 'Cancelled' ? 'border-b-2 border-red-500 text-red-600 bg-red-50/30' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('Cancelled')}
              >
                ออเดอร์ยกเลิก (Cancelled)
              </button>
            </div>

            <div className="p-6">
              {/* Filters */}
              <div className="flex flex-wrap gap-4 items-end mb-6 bg-gray-50 p-4 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ช่วงวันที่</label>
                  <UniversalDateRangePicker
                    value={dateRange}
                    onChange={(update) => setDateRange(update)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">รหัสพนักงาน</label>
                  <input 
                    type="text" 
                    value={userId} 
                    onChange={e => setUserId(e.target.value)} 
                    placeholder="รหัสพนักงาน..."
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={fetchData}
                  className="bg-gray-800 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition"
                  disabled={loading}
                >
                  {loading ? 'กำลังค้นหา...' : 'ค้นหา'}
                </button>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-white border rounded-lg p-4 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">รวมออเดอร์{activeTab === 'Returned' ? 'ตีกลับ' : 'ยกเลิก'}</p>
                    <p className="text-3xl font-bold text-gray-800">{totalOrders}</p>
                  </div>
                  <div className={`p-3 rounded-full ${activeTab === 'Returned' ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'}`}>
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  </div>
                </div>
                <div className="bg-white border rounded-lg p-4 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">ยอดเงินรวม</p>
                    <p className="text-3xl font-bold text-green-600">฿{totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                  </div>
                  <div className="p-3 rounded-full bg-green-100 text-green-600">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto border rounded-lg shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">รหัสออเดอร์</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">วันที่</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ลูกค้า</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ยอดเงิน</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">เหตุผล</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">สรุปออเดอร์</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ไฟล์เสียง</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">กำลังโหลดข้อมูล...</td>
                      </tr>
                    ) : data.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">ไม่พบข้อมูลในช่วงเวลานี้</td>
                      </tr>
                    ) : (
                      data.map((order, idx) => (
                        <tr key={`${order.order_id}-${idx}`} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-mono text-sm text-blue-600">{order.order_id}</span>
                            <div className="text-xs text-gray-500 mt-1">{order.creator_name}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            <div><span className="font-medium text-gray-700">สร้าง:</span> {order.order_date?.substring(0,10)}</div>
                            {activeTab === 'Returned' && order.returned_at && (
                              <div className="text-orange-600 mt-1"><span className="font-medium">ตีกลับ:</span> {order.returned_at?.substring(0,10)}</div>
                            )}
                            {activeTab === 'Cancelled' && order.cancelled_at && (
                              <div className="text-red-600 mt-1"><span className="font-medium">ยกเลิก:</span> {order.cancelled_at?.substring(0,10)}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">{order.customer_name}</div>
                            <div className="text-sm text-gray-500">{order.customer_phone}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                            ฿{parseFloat(order.total_amount as any || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                            <div className="text-xs font-normal text-gray-500 mt-1">{order.payment_method}</div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="font-medium text-gray-800">{order.cancel_type || '-'}</div>
                            <div className="text-gray-500 text-xs mt-1 max-w-xs truncate" title={order.cancel_notes}>{order.cancel_notes}</div>
                          </td>
                          <td className="px-4 py-3 text-sm max-w-[200px]">
                            <div className="flex justify-between items-start gap-2 group">
                              <div className="text-gray-600 text-xs whitespace-pre-wrap line-clamp-3" title={order.admin_resolution_notes}>
                                {order.admin_resolution_notes || <span className="text-gray-400 italic">ไม่มีสรุป</span>}
                              </div>
                              <button onClick={() => handleEditSummary(order.order_id, order.admin_resolution_notes || '')} className="text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" title="แก้ไขสรุปออเดอร์">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {order.audio_links && order.audio_links.length > 0 ? (
                              <div className="flex flex-col gap-3">
                                {order.audio_links.map((link, i) => (
                                  <div key={i} className="flex flex-col gap-1 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                                    <a 
                                      href={link.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 hover:underline text-sm flex items-center gap-1"
                                      title="ฟังไฟล์เสียงบน Google Drive"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                      ไฟล์เสียงที่ {i + 1}
                                    </a>
                                    {link.date && (
                                      <div className="text-xs text-gray-500 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                        </svg>
                                        {(() => {
                                          try {
                                            const d = new Date(link.date.replace(' ', 'T'));
                                            return isNaN(d.getTime()) ? link.date : format(d, 'dd/MM/yyyy HH:mm');
                                          } catch {
                                            return link.date;
                                          }
                                        })()}
                                      </div>
                                    )}
                                    {link.notes && <div className="text-xs text-gray-500 bg-gray-50 p-1 rounded italic">{link.notes}</div>}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 italic">ไม่มีไฟล์เสียง</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                            <div className="flex flex-col gap-2 items-center">
                              <button 
                                onClick={() => handleAutoMatch(order.order_id)}
                                disabled={processingAudio === order.order_id}
                                className="text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1 rounded w-full flex justify-center items-center gap-1 disabled:opacity-50"
                              >
                                {processingAudio === order.order_id ? 'กำลังจับคู่...' : 'จับคู่อัตโนมัติ'}
                              </button>
                              <button 
                                onClick={() => handleManualAttach(order.order_id)}
                                disabled={processingAudio === order.order_id}
                                className="text-gray-600 hover:text-gray-900 bg-gray-100 px-3 py-1 rounded w-full text-xs disabled:opacity-50"
                              >
                                แนบลิงก์เอง
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Audio Modal */}
        {isAudioModalOpen && (
          <Modal title="แนบลิงก์ไฟล์เสียง" onClose={() => setIsAudioModalOpen(false)} size="md">
            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ลิงก์ไฟล์เสียงสำหรับออเดอร์ <span className="font-bold text-blue-600">{modalOrderId}</span>
              </label>
              <input
                type="url"
                value={modalAudioUrl}
                onChange={e => setModalAudioUrl(e.target.value)}
                placeholder="https://example.com/audio.mp3"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                autoFocus
              />
              
              <label className="block text-sm font-medium text-gray-700 mb-2">
                วันที่และเวลาของไฟล์เสียง (ไม่บังคับ)
              </label>
              <input
                type="datetime-local"
                value={modalAudioDate}
                onChange={e => setModalAudioDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              />

              <label className="block text-sm font-medium text-gray-700 mb-2">
                หมายเหตุเพิ่มเติม (ไม่บังคับ)
              </label>
              <textarea
                value={modalAudioNotes}
                onChange={e => setModalAudioNotes(e.target.value)}
                placeholder="เช่น ไฟล์เสียงสั้นเกินไป, ลูกค้าไม่พอใจ ฯลฯ"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                rows={3}
              />

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsAudioModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={submitManualAttach}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  บันทึก
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Summary Modal */}
        {isSummaryModalOpen && (
          <Modal title="ระบุสรุปออเดอร์" onClose={() => setIsSummaryModalOpen(false)} size="md">
            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                สรุปออเดอร์สำหรับออเดอร์ <span className="font-bold text-blue-600">{summaryOrderId}</span>
              </label>
              <textarea
                value={summaryText}
                onChange={e => setSummaryText(e.target.value)}
                placeholder="เช่น หักเงินพนักงาน เนื่องจากผิดกฏการขาย ในวันที่ 2026-07-01..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                rows={5}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsSummaryModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={submitSummary}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  บันทึก
                </button>
              </div>
            </div>
          </Modal>
        )}
    </div>
  );
};

export default ReturnedOrdersReportPage;
