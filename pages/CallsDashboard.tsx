import React, { useMemo, useState } from 'react';
import { CallHistory } from '@/types';
import { Phone, PhoneIncoming, Clock3, Users as UsersIcon, ChevronDown, Calendar, Download } from 'lucide-react';
import StatCard from '@/components/StatCard';

interface CallsDashboardProps {
  calls?: CallHistory[];
}

// JavaScript version of authenticateOneCall function
const authenticateOneCall = async () => {
  console.log('=== DEBUG: authenticateOneCall called ===');
  
  // Use proxy to avoid CORS issues
  const loginUrl = '/onecall/orktrack/rest/user/login?version=orktrack&accesspolicy=all&licenseinfo=true';
  console.log('=== DEBUG: Login URL ===', loginUrl);
  
  // Get credentials from environment variables (in React, these would be from .env file)
  const username = (import.meta as any).env.VITE_USERNAME_ONECALL || '';
  const password = (import.meta as any).env.VITE_PASSWORD_ONECALL || '';
  
  console.log('=== DEBUG: Credentials ===', {
    hasUsername: !!username,
    usernameLength: username.length,
    hasPassword: !!password,
    passwordLength: password.length
  });
  
  if (!username || !password) {
    console.error('=== DEBUG: Missing credentials ===');
    return {
      success: false,
      error: 'Username or password not found in environment variables'
    };
  }
  
  // Remove quotes from username and password if present
  const cleanUsername = username.replace(/^"|"$/g, '');
  const cleanPassword = password.replace(/^"|"$/g, '');
  
  console.log('=== DEBUG: Cleaned credentials ===', {
    cleanUsernameLength: cleanUsername.length,
    cleanPasswordLength: cleanPassword.length
  });
  
  // Create auth string and encode it (Postman Basic Auth style)
  const authString = `${cleanUsername}:${cleanPassword}`;
  const base64Auth = btoa(authString);
  
  console.log('=== DEBUG: Auth string created ===', { authStringLength: authString.length });
  
  // Create headers with Authorization header (Postman style)
  const headers = {
    'Accept': 'application/json',
    'Authorization': `Basic ${base64Auth}`
  };
  
  console.log('=== DEBUG: Request headers created ===');
  
  try {
    console.log('=== DEBUG: Sending authentication request ===');
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: headers,
      // SSL verification is handled by the browser, but for development we might need to handle CORS issues
    });
    
    const httpCode = response.status;
    console.log('=== DEBUG: Authentication response status ===', httpCode);
    
    const responseText = await response.text();
    console.log('=== DEBUG: Authentication response text (first 200 chars) ===', responseText.substring(0, 200));
    
    // Try to parse as JSON, if fails, keep as text
    let responseData;
    try {
      responseData = JSON.parse(responseText);
      console.log('=== DEBUG: Authentication response parsed as JSON ===', {
        hasAccessToken: !!responseData.accesstoken,
        hasData: !!responseData
      });
    } catch (e) {
      console.error('=== DEBUG: Failed to parse authentication response ===', e);
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
      console.error('=== DEBUG: Authentication failed ===', httpCode);
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
      console.log('=== DEBUG: Token extracted ===', { tokenLength: token.length });
    } else {
      console.error('=== DEBUG: No token found in response ===');
    }
    
    console.log('=== DEBUG: Authentication completed successfully ===');
    return {
      success: true,
      data: responseData,
      token: token,
      http_code: httpCode,
      debug_info: debugInfo
    };
  } catch (error) {
    console.error('=== DEBUG: Authentication error ===', error);
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

// Function to fetch recordings data
const fetchRecordingsData = async (startDate: string, endDate: string) => {
  console.log('=== DEBUG: fetchRecordingsData called ===', { startDate, endDate });
  
  try {
    // First, authenticate to get the access token
    console.log('=== DEBUG: Authenticating with OneCall API ===');
    const authResult = await authenticateOneCall();
    
    console.log('=== DEBUG: Authentication result ===', {
      success: authResult.success,
      hasToken: !!authResult.token,
      error: authResult.error
    });
    
    if (!authResult.success || !authResult.token) {
      console.error('=== DEBUG: Authentication failed ===');
      return {
        success: false,
        error: 'Authentication failed: ' + authResult.error
      };
    }
    
    // Format dates for API
    const formatDateForAPI = (dateString: string, isEndDate: boolean = false) => {
      const date = new Date(dateString);
      
      // For end date, set time to 23:59:59
      if (isEndDate) {
        date.setHours(23, 59, 59, 999);
      } else {
        // For start date, set time to 00:00:00
        date.setHours(0, 0, 0, 0);
      }
      
      // Convert to UTC by subtracting 7 hours
      date.setHours(date.getHours() - 7);
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      
      return `${year}${month}${day}_${hours}${minutes}${seconds}`;
    };
    
    const startDateFormatted = formatDateForAPI(startDate);
    const endDateFormatted = formatDateForAPI(endDate, true);
    
    console.log('=== DEBUG: Formatted dates ===', { startDateFormatted, endDateFormatted });
    
    // Build URL parameters
    const params = new URLSearchParams();
    params.append('range', 'custom');
    params.append('startdate', startDateFormatted);
    params.append('enddate', endDateFormatted);
    params.append('sort', '');
    params.append('page', '1');
    params.append('pagesize', '100');
    params.append('maxresults', '-1');
    params.append('includetags', 'true');
    params.append('includemetadata', 'true');
    params.append('includeprograms', 'true');
    
    const searchUrl = `/onecall/orktrack/rest/recordings?${params.toString()}`;
    console.log('=== DEBUG: Fetch URL ===', searchUrl);
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': authResult.token,
        'Accept': 'application/json'
      }
    });
    
    console.log('=== DEBUG: Response status ===', response.status);
    
    if (!response.ok) {
      console.error('=== DEBUG: Fetch failed ===', response.status);
      return {
        success: false,
        error: `HTTP error! status: ${response.status}`
      };
    }
    
    const responseText = await response.text();
    console.log('=== DEBUG: Response text (first 200 chars) ===', responseText.substring(0, 200));
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
      console.log('=== DEBUG: Parsed response data ===', {
        page: responseData.page,
        pageSize: responseData.pageSize,
        resultCount: responseData.resultCount,
        objectsCount: responseData.objects ? responseData.objects.length : 0
      });
    } catch (e) {
      console.error('=== DEBUG: Failed to parse response ===', e);
      responseData = responseText;
    }
    
    console.log('=== DEBUG: fetchRecordingsData completed ===');
    return {
      success: true,
      data: responseData,
      token: authResult.token
    };
  } catch (error) {
    console.error('=== DEBUG: fetchRecordingsData error ===', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch recordings data'
    };
  }
};

// Function to save batch data to database
const saveBatchToDatabase = async (startDate: string, endDate: string, amountRecord: number) => {
  console.log('=== DEBUG: saveBatchToDatabase called ===', { startDate, endDate, amountRecord });
  
  try {
    const requestData = {
      startdate: startDate,
      enddate: endDate,
      amount_record: amountRecord
    };
    
    console.log('=== DEBUG: Sending batch data ===', requestData);
    console.log('=== DEBUG: Fetch URL ===', '/api/onecall_batch.php');
    
    const response = await fetch('/api/onecall_batch.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });
    
    console.log('=== DEBUG: Batch save response status ===', response.status);
    console.log('=== DEBUG: Batch save response headers ===', response.headers);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('=== DEBUG: Batch save error response ===', errorText);
      return {
        success: false,
        error: `Failed to save batch: ${response.status} - ${errorText}`
      };
    }
    
    const responseText = await response.text();
    console.log('=== DEBUG: Batch save response text ===', responseText);
    
    let data;
    try {
      data = JSON.parse(responseText);
      console.log('=== DEBUG: Batch save response parsed ===', data);
    } catch (e) {
      console.error('=== DEBUG: Failed to parse batch save response ===', e);
      return {
        success: false,
        error: 'Invalid JSON response from batch save API'
      };
    }
    
    if (!data.success) {
      console.error('=== DEBUG: Batch save API returned error ===', data.error);
      return {
        success: false,
        error: data.error || 'Unknown error from batch save API'
      };
    }
    
    if (!data.id) {
      console.error('=== DEBUG: No batch ID returned from API ===');
      return {
        success: false,
        error: 'No batch ID returned from API'
      };
    }
    
    console.log('=== DEBUG: Batch saved successfully with ID ===', data.id);
    return {
      success: true,
      batchId: data.id
    };
  } catch (error) {
    console.error('=== DEBUG: Batch save error ===', error);
    return {
      success: false,
      error: error.message || 'Failed to save batch to database'
    };
  }
};

// Function to save log data to database
const saveLogToDatabase = async (logs: any[], batchId: number) => {
  console.log('=== DEBUG: saveLogToDatabase called ===', { logsCount: logs.length, batchId });
  
  try {
    const requestData = {
      logs: logs,
      batch_id: batchId
    };
    
    console.log('=== DEBUG: Sending log data ===', {
      logs: logs.length,
      batch_id: batchId,
      first_log: logs[0] || null
    });
    console.log('=== DEBUG: Fetch URL ===', '/api/onecall_logs.php');
    
    const response = await fetch('/api/onecall_logs.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });
    
    console.log('=== DEBUG: Log save response status ===', response.status);
    console.log('=== DEBUG: Log save response headers ===', response.headers);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('=== DEBUG: Log save error response ===', errorText);
      return {
        success: false,
        error: `Failed to save logs: ${response.status} - ${errorText}`
      };
    }
    
    const responseText = await response.text();
    console.log('=== DEBUG: Log save response text ===', responseText);
    
    let data;
    try {
      data = JSON.parse(responseText);
      console.log('=== DEBUG: Log save response parsed ===', data);
    } catch (e) {
      console.error('=== DEBUG: Failed to parse log save response ===', e);
      return {
        success: false,
        error: 'Invalid JSON response from log save API'
      };
    }
    
    if (!data.success) {
      console.error('=== DEBUG: Log save API returned error ===', data.error);
      return {
        success: false,
        error: data.error || 'Unknown error from log save API'
      };
    }
    
    console.log('=== DEBUG: Logs saved successfully ===', data.count || logs.length);
    return {
      success: true
    };
  } catch (error) {
    console.error('=== DEBUG: Log save error ===', error);
    return {
      success: false,
      error: error.message || 'Failed to save logs to database'
    };
  }
};

// Calls overview focused on layout only (neutral labels, no brand colors/names)
const CallsDashboard: React.FC<CallsDashboardProps> = ({ calls = [] }) => {
  const [month, setMonth] = useState<string>(() => String(new Date().getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState<string>(() => String(new Date().getFullYear()));
  
  // State for date range selection
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // State for modal
  const [showModal, setShowModal] = useState<boolean>(false);
  const [resultCount, setResultCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveProgress, setSaveProgress] = useState<number>(0);
  const [saveTotal, setSaveTotal] = useState<number>(0);
  const [accessToken, setAccessToken] = useState<string>('');

  const { totalCalls, answeredCalls, totalMinutes, avgMinutes } = useMemo(() => {
    const start = new Date(Number(year), Number(month) - 1, 1);
    const end = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);

    const monthly = calls.filter(c => {
      const d = new Date(c.date);
      return d >= start && d <= end;
    });

    const totalCalls = monthly.length;
    // Placeholder assumptions: status === 'answered' is considered answered
    const answeredCalls = monthly.filter(c => String(c.status).toLowerCase().includes('answer')).length;
    const totalMinutes = monthly.reduce((sum, c) => sum + Math.max(0, Math.round((c.duration || 0) / 60)), 0);
    const avgMinutes = totalCalls > 0 ? totalMinutes / totalCalls : 0;

    return { totalCalls, answeredCalls, totalMinutes, avgMinutes };
  }, [calls, month, year]);

  const monthOptions = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const yearOptions = [String(new Date().getFullYear()), String(new Date().getFullYear() - 1)];

  // Function to handle update button click
  const handleUpdateClick = async () => {
    if (!startDate || !endDate) {
      alert('กรุณาเลือกช่วงวันที่');
      return;
    }
    
    console.log('=== DEBUG: Starting update process ===');
    console.log('=== DEBUG: Date range ===', { startDate, endDate });
    
    setIsLoading(true);
    
    try {
      console.log('=== DEBUG: Fetching recordings data ===');
      const result = await fetchRecordingsData(startDate, endDate);
      
      console.log('=== DEBUG: Fetch result ===', result);
      
      if (result.success && result.data) {
        console.log('=== DEBUG: Setting state with fetched data ===', {
          resultCount: result.data.resultCount,
          hasToken: !!result.token
        });
        
        setResultCount(result.data.resultCount || 0);
        setAccessToken(result.token || '');
        console.log('=== DEBUG: About to show modal ===');
        setShowModal(true);
        console.log('=== DEBUG: Modal should be visible now ===');
      } else {
        console.error('=== DEBUG: Fetch failed ===', result.error);
        alert('ไม่สามารถดึงข้อมูลได้: ' + result.error);
      }
    } catch (error) {
      console.error('=== DEBUG: Update process error ===', error);
      alert('เกิดข้อผิดพลาดในการดึงข้อมูล: ' + error.message);
    } finally {
      console.log('=== DEBUG: Update process completed ===');
      setIsLoading(false);
    }
  };
  
  // Function to handle confirm button click in modal
  const handleConfirmClick = async () => {
    setIsSaving(true);
    setSaveProgress(0);
    setSaveTotal(resultCount);
    
    try {
      // Step 1: Save batch data
      console.log('=== DEBUG: Starting batch save process ===');
      console.log('Batch data:', { startDate, endDate, resultCount });
      const batchResult = await saveBatchToDatabase(startDate, endDate, resultCount);
      
      if (!batchResult.success) {
        console.error('=== DEBUG: Batch save failed ===', batchResult.error);
        alert('ไม่สามารถบันทึกข้อมูล Batch: ' + batchResult.error);
        setIsSaving(false);
        return;
      }
      
      const batchId = batchResult.batchId;
      console.log('=== DEBUG: Batch saved successfully with ID ===', batchId);
      
      // Step 2: Fetch and save log data in batches of 100
      let page = 1;
      const pageSize = 100;
      let totalSaved = 0;
      
      console.log('=== DEBUG: Starting log fetch process ===');
      console.log('Total records to fetch:', resultCount);
      
      while (totalSaved < resultCount) {
        console.log(`=== DEBUG: Fetching page ${page} ===`);
        
        // Format dates for API
        const formatDateForAPI = (dateString: string, isEndDate: boolean = false) => {
          const date = new Date(dateString);
          
          // For end date, set time to 23:59:59
          if (isEndDate) {
            date.setHours(23, 59, 59, 999);
          } else {
            // For start date, set time to 00:00:00
            date.setHours(0, 0, 0, 0);
          }
          
          // Convert to UTC by subtracting 7 hours
          date.setHours(date.getHours() - 7);
          
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          
          return `${year}${month}${day}_${hours}${minutes}${seconds}`;
        };
        
        const startDateFormatted = formatDateForAPI(startDate);
        const endDateFormatted = formatDateForAPI(endDate, true);
        
        console.log('=== DEBUG: Formatted dates ===', { startDateFormatted, endDateFormatted });
        
        // Build URL parameters
        const params = new URLSearchParams();
        params.append('range', 'custom');
        params.append('startdate', startDateFormatted);
        params.append('enddate', endDateFormatted);
        params.append('sort', '');
        params.append('page', page.toString());
        params.append('pagesize', pageSize.toString());
        params.append('maxresults', '-1');
        params.append('includetags', 'true');
        params.append('includemetadata', 'true');
        params.append('includeprograms', 'true');
        
        const searchUrl = `/onecall/orktrack/rest/recordings?${params.toString()}`;
        console.log('=== DEBUG: Fetch URL ===', searchUrl);
        
        const response = await fetch(searchUrl, {
          method: 'GET',
          headers: {
            'Authorization': accessToken,
            'Accept': 'application/json'
          }
        });
        
        console.log('=== DEBUG: Response status ===', response.status);
        
        if (!response.ok) {
          console.error('=== DEBUG: Fetch failed ===', response.status);
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseText = await response.text();
        console.log('=== DEBUG: Response text (first 200 chars) ===', responseText.substring(0, 200));
        
        let responseData;
        try {
          responseData = JSON.parse(responseText);
          console.log('=== DEBUG: Parsed response data ===', {
            page: responseData.page,
            pageSize: responseData.pageSize,
            resultCount: responseData.resultCount,
            objectsCount: responseData.objects ? responseData.objects.length : 0
          });
        } catch (e) {
          console.error('=== DEBUG: Failed to parse response ===', e);
          responseData = responseText;
        }
        
        if (responseData && responseData.objects) {
          // Transform data for database
          console.log('=== DEBUG: Transforming data for database ===');
          const logs = responseData.objects.map((obj: any) => {
            const transformed = {
              id: obj.id,
              timestamp: obj.timestamp,
              duration: obj.duration,
              localParty: obj.localParty,
              remoteParty: obj.remoteParty,
              direction: obj.direction,
              phone_telesale: obj.userDto?.firstname || '',
              batch_id: batchId
            };
            
            console.log(`=== DEBUG: Transformed log ${obj.id} ===`, transformed);
            return transformed;
          });
          
          console.log(`=== DEBUG: Transformed ${logs.length} logs ===`);
          
          // Save logs to database
          console.log('=== DEBUG: Saving logs to database ===', { logs: logs.length, batchId });
          const logResult = await saveLogToDatabase(logs, batchId);
          
          if (!logResult.success) {
            console.error('=== DEBUG: Log save failed ===', logResult.error);
            alert('ไม่สามารถบันทึกข้อมูล Log: ' + logResult.error);
            setIsSaving(false);
            return;
          }
          
          console.log('=== DEBUG: Logs saved successfully ===');
          
          totalSaved += logs.length;
          setSaveProgress(totalSaved);
          page++;
          
          console.log(`=== DEBUG: Progress update ===`, { totalSaved, resultCount });
        } else {
          console.error('=== DEBUG: No objects in response ===');
          break;
        }
      }
      
      console.log('=== DEBUG: All logs saved successfully ===');
      alert('บันทึกข้อมูลสำเร็จ');
      setShowModal(false);
    } catch (error) {
      console.error('=== DEBUG: Error in save process ===', error);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <>
      <div className="p-6">
        {/* Filters (layout only) */}
        <div className="bg-white border rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">เดือน</label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                {monthOptions.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ปี</label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">มุมมอง</label>
              <button className="w-full border rounded-md px-3 py-2 text-sm flex items-center justify-between">
                <span>รายเดือน</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Date Range Selection */}
        <div className="bg-white border rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-700">อัปเดตข้อมูล OneCall</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">วันที่เริ่มต้น</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">วันที่สิ้นสุด</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                disabled={!startDate}
                className={`w-full border rounded-md px-3 py-2 text-sm ${!startDate ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleUpdateClick}
                disabled={!startDate || !endDate || isLoading}
                className={`w-full border rounded-md px-3 py-2 text-sm flex items-center justify-center gap-2 ${
                  !startDate || !endDate || isLoading
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>กำลังดึงข้อมูล...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>อัปเดต</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <StatCard title="จำนวนสายทั้งหมด" value={totalCalls.toString()} subtext="ช่วงนี้" icon={Phone} />
          <StatCard title="รับสาย" value={answeredCalls.toString()} subtext="ช่วงนี้" icon={PhoneIncoming} />
          <StatCard title="เวลาสนทนา (นาที)" value={totalMinutes.toString()} subtext="รวม" icon={Clock3} />
          <StatCard title="เฉลี่ยต่อสาย (นาที)" value={avgMinutes.toFixed(2)} subtext="ต่อสาย" icon={UsersIcon} />
        </div>

        {/* Chart and summary table (placeholders) */}
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-md font-semibold text-gray-700 mb-4">แนวโน้มรายวัน</h3>
            <svg width="100%" height="260" viewBox="0 0 600 260" className="w-full">
              <line x1="40" y1="220" x2="580" y2="220" stroke="#E5E7EB" />
              <line x1="40" y1="180" x2="580" y2="180" stroke="#E5E7EB" />
              <line x1="40" y1="140" x2="580" y2="140" stroke="#E5E7EB" />
              <line x1="40" y1="100" x2="580" y2="100" stroke="#E5E7EB" />
              {/* Bars (static for layout) */}
              {[60, 120, 90, 150, 80, 110, 70].map((h, i) => (
                <rect key={i} x={60 + i * 70} y={220 - h} width="40" height={h} fill="#93C5FD" rx="4" />
              ))}
            </svg>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-md font-semibold text-gray-700">สรุปพนักงาน</h3>
              <button className="border px-3 py-1.5 rounded text-sm">ส่งออก</button>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-gray-500">
                  <tr>
                    <th className="py-2 px-3 font-medium">พนักงาน</th>
                    <th className="py-2 px-3 font-medium">จำนวนสาย</th>
                    <th className="py-2 px-3 font-medium">รับสาย</th>
                    <th className="py-2 px-3 font-medium">เวลาสนทนา (นาที)</th>
                    <th className="py-2 px-3 font-medium">เฉลี่ยต่อสาย</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="py-2 px-3">—</td>
                    <td className="py-2 px-3">—</td>
                    <td className="py-2 px-3">—</td>
                    <td className="py-2 px-3">—</td>
                    <td className="py-2 px-3">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">ยืนยันการอัปเดตข้อมูล</h3>
            <p className="text-sm text-gray-600 mb-6">
              พบข้อมูลทั้งหมด <span className="font-semibold text-blue-600">{resultCount}</span> รายการ
              ในช่วงวันที่ {startDate} ถึง {endDate}
            </p>
             
            {!isSaving ? (
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    console.log('=== DEBUG: Cancel button clicked ===');
                    setShowModal(false);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={() => {
                    console.log('=== DEBUG: Confirm button clicked ===');
                    handleConfirmClick();
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                >
                  ยืนยัน
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
                <p className="text-center text-sm text-gray-600">
                  กำลังบันทึกข้อมูล...
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${(saveProgress / saveTotal) * 100}%` }}
                  ></div>
                </div>
                <p className="text-center text-xs text-gray-500">
                  {saveProgress} / {saveTotal} รายการ
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default CallsDashboard;
