import React, { useState, useEffect } from 'react';
import UniversalDateRangePicker from '@/components/UniversalDateRangePicker';
import { useToast } from '@/components/Toast';
import { format } from 'date-fns';

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
  cancelled_at: string;
  returned_at: string;
  creator_name: string;
  audio_links: string[];
}

const ReturnedOrdersReportPage: React.FC = () => {
  const { addToast } = useToast();
  
  // State
  const [activeTab, setActiveTab] = useState<'Returned' | 'Cancelled'>('Returned');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    new Date()
  ]);
  const [data, setData] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingAudio, setProcessingAudio] = useState<string | null>(null);

  // Filters
  const [userId, setUserId] = useState<string>('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const start = dateRange[0] ? format(dateRange[0], 'yyyy-MM-dd') : '';
      const end = dateRange[1] ? format(dateRange[1], 'yyyy-MM-dd') : '';
      
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/returned_orders_report?start_date=${start}&end_date=${end}&status_type=${activeTab}&user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const json = await res.json();
      if (json.ok) {
        setData(json.data);
      } else {
        addToast(json.message || 'Failed to fetch data', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'An error occurred', 'error');
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
      const token = localStorage.getItem('token');
      const res = await fetch('/api/returned_orders_report/auto-match', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ order_id: orderId })
      });
      const json = await res.json();
      if (json.ok) {
        addToast(json.message, 'success');
        fetchData(); // refresh to show new audio
      } else {
        addToast(json.message, 'error');
      }
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setProcessingAudio(null);
    }
  };

  const handleManualAttach = async (orderId: string) => {
    const url = prompt('Enter Audio URL:');
    if (!url) return;
    
    try {
      setProcessingAudio(orderId);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/returned_orders_report/manual-audio', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ order_id: orderId, audio_url: url })
      });
      const json = await res.json();
      if (json.ok) {
        addToast('Audio attached successfully', 'success');
        fetchData();
      } else {
        addToast(json.message, 'error');
      }
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setProcessingAudio(null);
    }
  };

  // Summary calc
  const totalOrders = data.length;
  const totalAmount = data.reduce((sum, item) => sum + parseFloat(item.total_amount as any || 0), 0);

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
        <header className="flex justify-between items-center p-4 bg-white border-b shadow-sm">
          <h1 className="text-2xl font-semibold">Special Orders Report</h1>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                  <UniversalDateRangePicker
                    startDate={dateRange[0]}
                    endDate={dateRange[1]}
                    onChange={(update) => setDateRange(update)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                  <input 
                    type="text" 
                    value={userId} 
                    onChange={e => setUserId(e.target.value)} 
                    placeholder="User ID..."
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={fetchData}
                  className="bg-gray-800 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition"
                  disabled={loading}
                >
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-white border rounded-lg p-4 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Total {activeTab} Orders</p>
                    <p className="text-3xl font-bold text-gray-800">{totalOrders}</p>
                  </div>
                  <div className={`p-3 rounded-full ${activeTab === 'Returned' ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'}`}>
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  </div>
                </div>
                <div className="bg-white border rounded-lg p-4 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Total Amount</p>
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Audio Links</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading data...</td>
                      </tr>
                    ) : data.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No {activeTab.toLowerCase()} orders found in this period.</td>
                      </tr>
                    ) : (
                      data.map((order, idx) => (
                        <tr key={`${order.order_id}-${idx}`} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-mono text-sm text-blue-600">{order.order_id}</span>
                            <div className="text-xs text-gray-500 mt-1">{order.creator_name}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            <div><span className="font-medium text-gray-700">Ord:</span> {order.order_date?.substring(0,10)}</div>
                            {activeTab === 'Returned' && order.returned_at && (
                              <div className="text-orange-600 mt-1"><span className="font-medium">Ret:</span> {order.returned_at?.substring(0,10)}</div>
                            )}
                            {activeTab === 'Cancelled' && order.cancelled_at && (
                              <div className="text-red-600 mt-1"><span className="font-medium">Can:</span> {order.cancelled_at?.substring(0,10)}</div>
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
                          <td className="px-4 py-3">
                            {order.audio_links && order.audio_links.length > 0 ? (
                              <div className="flex flex-col gap-2">
                                {order.audio_links.map((link, i) => (
                                  <audio key={i} controls src={link} className="h-8 w-48" preload="none"></audio>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 italic">No audio attached</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                            <div className="flex flex-col gap-2 items-center">
                              <button 
                                onClick={() => handleAutoMatch(order.order_id)}
                                disabled={processingAudio === order.order_id}
                                className="text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1 rounded w-full flex justify-center items-center gap-1 disabled:opacity-50"
                              >
                                {processingAudio === order.order_id ? 'Matching...' : 'Auto Match'}
                              </button>
                              <button 
                                onClick={() => handleManualAttach(order.order_id)}
                                disabled={processingAudio === order.order_id}
                                className="text-gray-600 hover:text-gray-900 bg-gray-100 px-3 py-1 rounded w-full text-xs"
                              >
                                Manual Attach
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
    </div>
  );
};

export default ReturnedOrdersReportPage;
