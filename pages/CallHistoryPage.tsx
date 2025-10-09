import React, { useMemo, useState } from 'react';
import { CallHistory, Customer, User, UserRole } from '@/types';
import { PhoneIncoming, PhoneOutgoing, Phone, Search, Filter, Calendar, User as UserIcon } from 'lucide-react';

interface CallHistoryPageProps {
  currentUser: User;
  calls: CallHistory[];
  customers: Customer[];
  users: User[];
}

const formatDate = (iso: string) => {
  try { return new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'medium' }); } catch { return iso; }
};

// JavaScript version of authenticateOneCall function
const authenticateOneCall = async () => {
  // Use proxy to avoid CORS issues
  const loginUrl = '/onecall/orktrack/rest/user/login?version=orktrack&accesspolicy=all&licenseinfo=true';
  
  // Get credentials from environment variables (in React, these would be from .env file)
  const username = (import.meta as any).env.VITE_USERNAME_ONECALL || '';
  const password = (import.meta as any).env.VITE_PASSWORD_ONECALL || '';
  
  if (!username || !password) {
    return {
      success: false,
      error: 'Username or password not found in environment variables'
    };
  }
  
  // Remove quotes from username and password if present
  const cleanUsername = username.replace(/^"|"$/g, '');
  const cleanPassword = password.replace(/^"|"$/g, '');
  
  // Create auth string and encode it (Postman Basic Auth style)
  const authString = `${cleanUsername}:${cleanPassword}`;
  const base64Auth = btoa(authString);
  
  // Create headers with Authorization header (Postman style)
  const headers = {
    'Accept': 'application/json',
    'Authorization': `Basic ${base64Auth}`
  };
  
  try {
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: headers,
      // SSL verification is handled by the browser, but for development we might need to handle CORS issues
    });
    
    const httpCode = response.status;
    const responseText = await response.text();
    
    // Try to parse as JSON, if fails, keep as text
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = responseText;
    }
    
    // Create debug information
    const debugInfo = {
      request_url: loginUrl,
      request_method: 'POST',
      request_headers: headers,
      request_body: 'none',
      request_auth: {
        username: username,
        password: password,
        clean_username: cleanUsername,
        clean_password: cleanPassword,
        auth_string: authString,
        base64_encoded: base64Auth,
        authorization_header: `Basic ${base64Auth}`,
        postman_style: 'Using Authorization header instead of CURLOPT_USERPWD'
      },
      response_http_code: httpCode,
      response_headers: response.headers,
      response_body: responseData
    };
    
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP Error: ${httpCode}`,
        http_code: httpCode,
        debug_info: debugInfo
      };
    }
    
    // Extract token from response (adjust based on actual response structure)
    let token = null;
    if (responseData && typeof responseData === 'object' && responseData.accesstoken) {
      token = responseData.accesstoken;
    }
    
    return {
      success: true,
      data: responseData,
      token: token,
      http_code: httpCode,
      debug_info: debugInfo
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to fetch',
      debug_info: {
        request_url: loginUrl,
        request_method: 'POST',
        error: error,
        note: 'This might be a CORS issue. Check if the Vite proxy is configured correctly.'
      }
    };
  }
};

// Test function for authentication
const test_auth = async () => {
  console.log('Testing OneCall authentication...');
  try {
    const result = await authenticateOneCall();
    console.log('Authentication result:', result);
    return result;
  } catch (error) {
    console.error('Error in test_auth:', error);
    return {
      success: false,
      error: error.message || 'Unknown error in test_auth',
      debug_info: {
        error: error,
        note: 'This error occurred in the test_auth function itself.'
      }
    };
  }
};

test_auth()

const CallHistoryPage: React.FC<CallHistoryPageProps> = ({ currentUser, calls, customers, users }) => {
  const [qCustomer, setQCustomer] = useState('');
  const [qCustomerPhone, setQCustomerPhone] = useState('');
  const [qAgentPhone, setQAgentPhone] = useState('');
  const [status, setStatus] = useState('all');
  const [direction, setDirection] = useState('all');
  const [range, setRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [authTest, setAuthTest] = useState<any>(null);

  const currentUserFull = `${currentUser.firstName} ${currentUser.lastName}`.trim();
  const isPrivileged = currentUser.role === UserRole.SuperAdmin || currentUser.role === UserRole.AdminControl;

  const customersById = useMemo(() => {
    const map: Record<string, Customer> = {};
    customers.forEach(c => { map[c.id] = c; });
    return map;
  }, [customers]);

  const filtered = useMemo(() => {
    return calls.filter(call => {
      // Role-based: non-privileged see only own calls
      if (!isPrivileged && call.caller !== currentUserFull) return false;

      // Date range
      if (range.start || range.end) {
        const d = new Date(call.date);
        if (range.start && d < new Date(range.start)) return false;
        if (range.end) {
          const e = new Date(range.end);
          e.setHours(23,59,59,999);
          if (d > e) return false;
        }
      }

      // Join customer
      const cust = customersById[call.customerId];
      const custName = cust ? `${cust.firstName} ${cust.lastName}` : '';
      const custPhone = cust?.phone || '';

      if (qCustomer && !custName.toLowerCase().includes(qCustomer.toLowerCase())) return false;
      if (qCustomerPhone && !custPhone.includes(qCustomerPhone)) return false;
      if (qAgentPhone && !(call.caller?.includes(qAgentPhone))) return false; // we don't have agent phone; keep as contains

      // Status filter (simple contains)
      if (status !== 'all') {
        const s = (call.status || '').toLowerCase();
        if (!s.includes(status.toLowerCase())) return false;
      }

      // Direction placeholder: if duration>0 -> outgoing assumed; we mark both as outgoing
      if (direction !== 'all') {
        // Without explicit field, treat all as outgoing for now
        if (direction === 'in') return false;
      }

      return true;
    }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [calls, isPrivileged, currentUserFull, range, qCustomer, qCustomerPhone, qAgentPhone, status, direction, customersById]);

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Phone className="w-6 h-6 text-blue-600" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">ประวัติการโทร</h1>
          </div>
          <p className="text-gray-600 ml-11">ค้นหาและดูประวัติการโทรทั้งหมดในระบบ</p>
        </div>

        {/* Filter Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-700">ตัวกรองการค้นหา</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Calendar className="w-4 h-4 text-gray-400" />
                วันที่โทร (เริ่ม)
              </label>
              <input
                type="date"
                value={range.start}
                onChange={e=>setRange(r=>({ ...r, start: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Calendar className="w-4 h-4 text-gray-400" />
                วันที่โทร (สิ้นสุด)
              </label>
              <input
                type="date"
                value={range.end}
                onChange={e=>setRange(r=>({ ...r, end: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <UserIcon className="w-4 h-4 text-gray-400" />
                ชื่อลูกค้า
              </label>
              <input
                value={qCustomer}
                onChange={e=>setQCustomer(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="ค้นหาชื่อลูกค้า"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Phone className="w-4 h-4 text-gray-400" />
                เบอร์โทรลูกค้า
              </label>
              <input
                value={qCustomerPhone}
                onChange={e=>setQCustomerPhone(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="เช่น 08xxxxxxx"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <UserIcon className="w-4 h-4 text-gray-400" />
                เบอร์/ชื่อพนักงานขาย
              </label>
              <input
                value={qAgentPhone}
                onChange={e=>setQAgentPhone(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="ค้นหา"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Direction</label>
              <select
                value={direction}
                onChange={e=>setDirection(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="all">ทั้งหมด</option>
                <option value="out">โทรออก</option>
                <option value="in">รับสาย</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">สถานะ</label>
              <select
                value={status}
                onChange={e=>setStatus(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="all">ทั้งหมด</option>
                <option value="รับ">รับสาย</option>
                <option value="ไม่รับ">ไม่รับ</option>
                <option value="พลาด">พลาด</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                onClick={() => {
                  test_auth().then(result => {
                    setAuthTest(result);
                    console.log('Auth test result stored in state:', result);
                  });
                }}
              >
                <Search className="w-4 h-4" />
                ค้นหา
              </button>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            พบข้อมูลทั้งหมด <span className="font-semibold text-gray-800">{filtered.length}</span> รายการ
          </div>
          {authTest && (
            <div className="text-xs text-gray-500">
              Auth Test: {authTest.success ? 'Success' : 'Failed'}
            </div>
          )}
        </div>

        {/* Auth Test Result */}
        {authTest && (
          <div className="mb-4 p-3 bg-gray-100 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700">Authentication Test Result</h3>
              <button
                onClick={() => setAuthTest(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <pre className="text-xs text-gray-600 overflow-auto max-h-40">
              {JSON.stringify(authTest, null, 2)}
            </pre>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Datetime</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Duration</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ตัวแทนขาย</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Direction</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ลูกค้า</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">เบอร์โทรลูกค้า</th>
                  <th className="py-3 px-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map(call => {
                  const cust = customersById[call.customerId];
                  const st = call.status || '';
                  const isAnswered = st.includes('รับ');
                  const isMissed = st.includes('พลาด');
                  const isRejected = st.includes('ไม่รับ');
                  
                  let statusBadge = '';
                  if (isAnswered) {
                    statusBadge = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">รับสาย</span>;
                  } else if (isMissed) {
                    statusBadge = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">พลาด</span>;
                  } else if (isRejected) {
                    statusBadge = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">ไม่รับ</span>;
                  } else {
                    statusBadge = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{st}</span>;
                  }
                  
                  return (
                    <tr key={call.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 text-sm text-gray-600 font-medium">{call.id}</td>
                      <td className="py-3 px-4 text-sm text-gray-800">{formatDate(call.date)}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{call.duration ?? '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-800">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                            <UserIcon className="w-3 h-3 text-blue-600" />
                          </div>
                          {call.caller}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <PhoneOutgoing className="w-4 h-4 text-red-500" />
                          <span className="text-sm text-gray-600">โทรออก</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">{statusBadge}</td>
                      <td className="py-3 px-4 text-sm text-gray-800">
                        {cust ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                              <UserIcon className="w-3 h-3 text-gray-600" />
                            </div>
                            {`${cust.firstName} ${cust.lastName}`}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{cust?.phone || '-'}</td>
                      <td className="py-3 px-4 text-right">
                        <button className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors">
                          <Phone className="w-3 h-3 mr-1" />
                          เล่นเสียง
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center">
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                          <Search className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-gray-500 text-sm font-medium">ไม่พบข้อมูล</p>
                        <p className="text-gray-400 text-xs mt-1">ลองปรับเปลี่ยนเงื่อนไขการค้นหา</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallHistoryPage;

