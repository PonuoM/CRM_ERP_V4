import React, { useMemo, useState, useEffect, useRef } from 'react';
import { CallHistory, Customer, User, UserRole } from '@/types';
import { PhoneIncoming, PhoneOutgoing, Phone, Search, Filter, Calendar, User as UserIcon, Play, Pause, Download } from 'lucide-react';

interface CallHistoryPageProps {
  currentUser: User;
  calls: CallHistory[];
  customers: Customer[];
  users: User[];
}

const formatDate = (dateString: string) => {
  try {
    // Handle the format "2025-10-09 03:23:08" from the API
    const date = new Date(dateString);
    // Add 7 hours to convert from UTC to Asia/Bangkok
    date.setHours(date.getHours() + 7);
    return date.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return dateString;
  }
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

// JavaScript version of getRecordingsData function
const getRecordingsData = async (currentUser?: User) => {
  // Try to get recordings data with token refresh logic
  const maxRetries = 2; // Allow one retry after token refresh
  let retryCount = 0;
  let authResult = null;
  let lastError = null;
  
  // API Configuration parameters
  const apiConfig: any = {
    baseUrl: '/onecall/orktrack/rest/recordings',
    range: 'custom',
    sort: '',
    page: 1,
    pagesize: 20,
    maxresults: 0,
    includetags: true,
    includemetadata: true,
    includeprograms: true
  };
  
  // Add party parameter for Telesale users
  if (currentUser && currentUser.role === UserRole.Telesale && currentUser.phone) {
    // Format phone number from 0945547598 to +66945547598
    const formattedPhone = currentUser.phone.startsWith('0')
      ? '+66' + currentUser.phone.substring(1)
      : '+66' + currentUser.phone;
    
    apiConfig.party = formattedPhone;
  }
  
  while (retryCount < maxRetries) {
    // If first attempt or after token refresh, authenticate
    if (retryCount === 0 || authResult === null) {
      authResult = await authenticateOneCall();
      
      if (!authResult.success) {
        return {
          success: false,
          error: 'Authentication failed: ' + authResult.error,
          http_code: authResult.http_code,
          auth_response: authResult.data,
          debug_info: authResult.debug_info || null
        };
      }
      
      if (!authResult.token) {
        return {
          success: false,
          error: 'Authentication token not found in response',
          http_code: authResult.http_code,
          auth_response: authResult.data,
          debug_info: authResult.debug_info || null
        };
      }
    }
    
    // Calculate startdate as today's date at midnight (00:00:00) minus 7 hours
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0); // Set time to 00:00:00
    startDate.setHours(startDate.getHours() - 7); // Subtract 7 hours for timezone adjustment
    
    // Format as YYYYMMDD_HHMMSS
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const day = String(startDate.getDate()).padStart(2, '0');
    const hours = String(startDate.getHours()).padStart(2, '0');
    const minutes = String(startDate.getMinutes()).padStart(2, '0');
    const seconds = String(startDate.getSeconds()).padStart(2, '0');
    const startDateFormatted = `${year}${month}${day}_${hours}${minutes}${seconds}`;
    
    // Build URL with parameters
    const params = new URLSearchParams();
    params.append('range', apiConfig.range);
    params.append('startdate', startDateFormatted);
    params.append('sort', apiConfig.sort);
    params.append('page', apiConfig.page.toString());
    params.append('pagesize', apiConfig.pagesize.toString());
    params.append('maxresults', apiConfig.maxresults.toString());
    params.append('includetags', apiConfig.includetags.toString());
    params.append('includemetadata', apiConfig.includemetadata.toString());
    params.append('includeprograms', apiConfig.includeprograms.toString());
    
    // Add party parameter if it exists
    if (apiConfig.party) {
      params.append('party', apiConfig.party);
    }
    
    const apiUrl = `${apiConfig.baseUrl}?${params.toString()}`;
    
    const headers = {
      'Authorization': authResult.token,
      'Accept': 'application/json'
    };
    
    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: headers
      });
      
      const httpCode = response.status;
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${httpCode}`);
      }
      
      const responseText = await response.text();
      
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = responseText;
      }
      
      // Check for invalid token error
      if (responseData && responseData.error &&
          (responseData.error.toLowerCase().includes('invalid access token') ||
           responseData.error.toLowerCase().includes('invalid token') ||
           responseData.error.toLowerCase().includes('unauthorized'))) {
        
        // If this is the first attempt, try to refresh the token
        if (retryCount === 0) {
          authResult = null; // Force re-authentication
          retryCount++;
          continue;
        }
      }
      
      // If we got here, either the request was successful or we've already tried to refresh the token
      return {
        success: true,
        data: responseData,
        http_code: httpCode,
        auth_data: authResult.data,
        token_refreshed: retryCount > 0,
        api_url: apiUrl,
        debug_info: authResult.debug_info || null
      };
    } catch (error) {
      lastError = {
        success: false,
        error: error.message || 'Unknown error',
        http_code: 0
      };
      retryCount++;
      continue;
    }
  }
  
  // If we've exhausted all retries, return the last error
  return lastError || {
    success: false,
    error: 'Max retries exceeded',
    http_code: 0,
    debug_info: authResult ? authResult.debug_info : null
  };
};

// Function to export recordings data to CSV
const exportToCSV = (data: any) => {
  if (!data || !data.objects || data.objects.length === 0) {
    alert('ไม่มีข้อมูลสำหรับส่งออก');
    return;
  }

  // Create CSV content
  const headers = ['ID', 'Datetime', 'Duration', 'Agent', 'Direction', 'Status', 'Customer', 'Customer Phone'];
  const rows = data.objects.map((recording: any) => {
    // Format datetime with timezone adjustment
    const date = new Date(recording.timestamp);
    date.setHours(date.getHours() + 7);
    const formattedDate = date.toLocaleString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    return [
      recording.id,
      formattedDate,
      recording.duration || '',
      recording.localParty || '',
      recording.direction === 'IN' ? 'รับสาย' : 'โทรออก',
      'ได้คุย',
      'Unknown',
      recording.remoteParty || ''
    ];
  });

  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // Create a blob and download link
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `recordings_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const CallHistoryPage: React.FC<CallHistoryPageProps> = ({ currentUser, calls, customers, users }) => {
  const [qCustomer, setQCustomer] = useState('');
  const [qCustomerPhone, setQCustomerPhone] = useState('');
  const [qAgentPhone, setQAgentPhone] = useState('');
  const [status, setStatus] = useState('all');
  const [direction, setDirection] = useState('all');
  const [range, setRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [recordingsData, setRecordingsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [accessToken, setAccessToken] = useState<string>('');
  
  // Audio player state
  const [currentPlayingId, setCurrentPlayingId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentUserFull = `${currentUser.firstName} ${currentUser.lastName}`.trim();
  const isPrivileged = currentUser.role === UserRole.SuperAdmin || currentUser.role === UserRole.AdminControl;

  const customersById = useMemo(() => {
    const map: Record<string, Customer> = {};
    customers.forEach(c => { map[c.id] = c; });
    return map;
  }, [customers]);

  // Function to handle recording playback with Authorization header
  const playRecording = async (recordingURL: string, id: number) => {
    // If clicking on the currently playing recording, toggle play/pause
    if (currentPlayingId === id) {
      if (isPlaying) {
        pauseAudio();
      } else {
        resumeAudio();
      }
      return;
    }
    
    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (!accessToken) {
      // Try to authenticate again if we don't have a token
      try {
        const authResult = await authenticateOneCall();
        if (authResult.success && authResult.token) {
          setAccessToken(authResult.token);
        } else {
          alert('ไม่สามารถยืนยันตัวตนได้: ' + authResult.error);
          return;
        }
      } catch (error) {
        alert('เกิดข้อผิดพลาดในการยืนยันตัวตน: ' + error.message);
        return;
      }
    }
    
    try {
      // We need to use the proxy for the recording URL as well
      const proxyURL = recordingURL.replace('https://onecallvoicerecord.dtac.co.th', '/onecall');
      
      // Fetch the audio file with Authorization header
      const response = await fetch(proxyURL, {
        method: 'GET',
        headers: {
          'Authorization': accessToken
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Convert the response to a blob
      const blob = await response.blob();
      
      // Create a URL for the blob
      const audioUrl = URL.createObjectURL(blob);
      
      // Create a new audio element to play the recording
      const audio = new Audio();
      audio.src = audioUrl;
      audioRef.current = audio;
      
      // Set up event listeners
      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration);
        setCurrentTime(0);
      });
      
      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime);
      });
      
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        setCurrentPlayingId(null);
        URL.revokeObjectURL(audioUrl);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      });
      
      // Play the audio
      audio.play().then(() => {
        setIsPlaying(true);
        setCurrentPlayingId(id);
        
        // Update time every second
        intervalRef.current = setInterval(() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }, 1000);
      }).catch(error => {
        alert('ไม่สามารถเล่นเสียงได้: ' + error.message);
      });
    } catch (error) {
      alert('ไม่สามารถดึงข้อมูลเสียงได้: ' + error.message);
    }
  };
  
  // Function to pause audio
  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  };
  
  // Function to resume audio
  const resumeAudio = () => {
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        
        // Update time every second
        intervalRef.current = setInterval(() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }, 1000);
      }).catch(error => {
        alert('ไม่สามารถเล่นเสียงต่อได้: ' + error.message);
      });
    }
  };
  
  // Function to format time in MM:SS format
  const formatTime = (time: number) => {
    if (isNaN(time)) return '00:00';
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Function to handle slider change
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };
  
  // Function to download audio file
  const downloadRecording = async (recordingURL: string, id: number) => {
    if (!accessToken) {
      // Try to authenticate again if we don't have a token
      try {
        const authResult = await authenticateOneCall();
        if (authResult.success && authResult.token) {
          setAccessToken(authResult.token);
        } else {
          alert('ไม่สามารถยืนยันตัวตนได้: ' + authResult.error);
          return;
        }
      } catch (error) {
        alert('เกิดข้อผิดพลาดในการยืนยันตัวตน: ' + error.message);
        return;
      }
    }
    
    try {
      // We need to use the proxy for the recording URL as well
      const proxyURL = recordingURL.replace('https://onecallvoicerecord.dtac.co.th', '/onecall');
      
      // Fetch the audio file with Authorization header
      const response = await fetch(proxyURL, {
        method: 'GET',
        headers: {
          'Authorization': accessToken
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Convert the response to a blob
      const blob = await response.blob();
      
      // Create a URL for the blob
      const audioUrl = URL.createObjectURL(blob);
      
      // Create a download link
      const link = document.createElement('a');
      link.href = audioUrl;
      link.setAttribute('download', `recording_${id}.mp3`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the object URL
      URL.revokeObjectURL(audioUrl);
    } catch (error) {
      alert('ไม่สามารถดาวน์โหลดไฟล์เสียงได้: ' + error.message);
    }
  };
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Load recordings data on component mount
  useEffect(() => {
    const loadRecordings = async () => {
      setIsLoading(true);
      setIsDataLoading(true);
      try {
        // First, authenticate to get the access token
        const authResult = await authenticateOneCall();
        if (authResult.success && authResult.token) {
          setAccessToken(authResult.token);
          
          // Then load recordings data with current user info
          const result = await getRecordingsData(currentUser);
          if (result.success && result.data) {
            setRecordingsData(result.data);
          } else {
            // Handle error silently
          }
        } else {
          // Handle error silently
        }
      } catch (error) {
        // Handle error silently
      } finally {
        setIsLoading(false);
        setIsDataLoading(false);
      }
    };

    loadRecordings();
  }, [currentUser]);

  // Filter recordings data instead of database calls
  const filteredRecordings = useMemo(() => {
    if (!recordingsData || !recordingsData.objects) return [];
    
    return recordingsData.objects.filter((recording: any) => {
      // Apply filters based on the new data structure
      if (qCustomer && !("Unknown".toLowerCase().includes(qCustomer.toLowerCase()))) return false;
      if (qCustomerPhone && !recording.remoteParty?.includes(qCustomerPhone)) return false;
      if (qAgentPhone && !recording.localParty?.includes(qAgentPhone)) return false;
      
      // Status filter - all recordings have status "ได้คุย"
      if (status !== 'all' && status !== 'ได้คุย') return false;
      
      // Direction filter
      if (direction !== 'all' && recording.direction !== direction) return false;
      
      // Date range filter
      if (range.start || range.end) {
        // Handle the format "2025-10-09 03:23:08" from the API
        const recordingDate = new Date(recording.timestamp);
        // Add 7 hours to convert from UTC to Asia/Bangkok
        recordingDate.setHours(recordingDate.getHours() + 7);
        
        if (range.start && recordingDate < new Date(range.start)) return false;
        if (range.end) {
          const e = new Date(range.end);
          e.setHours(23,59,59,999);
          if (recordingDate > e) return false;
        }
      }
      
      return true;
    }).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [recordingsData, qCustomer, qCustomerPhone, qAgentPhone, status, direction, range]);

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
            <div className="flex items-end gap-2">
              <button
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                disabled
              >
                <Search className="w-4 h-4" />
                ค้นหา
              </button>
              <button
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                onClick={() => exportToCSV(recordingsData)}
                disabled={!recordingsData || isLoading}
              >
                <Phone className="w-4 h-4" />
                ส่งออก CSV
              </button>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {isLoading || isDataLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                <span>กำลังโหลดข้อมูล...</span>
              </div>
            ) : (
              <span>พบข้อมูลทั้งหมด <span className="font-semibold text-gray-800">{filteredRecordings.length}</span> รายการ</span>
            )}
          </div>
          {recordingsData && recordingsData.objects && (
            <div className="text-xs text-gray-500">
              Recordings: {recordingsData.objects.length} items
            </div>
          )}
        </div>

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
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">เบอร์โทรลูกค้า</th>
                  <th className="py-3 px-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isDataLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <div className="flex flex-col items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3"></div>
                        <p className="text-gray-500 text-sm font-medium">กำลังดึงข้อมูลบันทึกการโทร...</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredRecordings.map((recording: any) => {
                      // Direction icon based on recording.direction
                      const dirIcon = recording.direction === 'IN' ?
                        <PhoneIncoming className="w-4 h-4 text-green-500" /> :
                        <PhoneOutgoing className="w-4 h-4 text-red-500" />;
                      
                      const dirText = recording.direction === 'IN' ? 'รับสาย' : 'โทรออก';
                      
                      return (
                        <tr key={recording.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 text-sm text-gray-600 font-medium">{recording.id}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">{formatDate(recording.timestamp)}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{recording.duration || '-'}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                                <UserIcon className="w-3 h-3 text-blue-600" />
                              </div>
                              {recording.localParty || '-'}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {dirIcon}
                              <span className="text-sm text-gray-600">{dirText}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">{recording.remoteParty || '-'}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="min-w-[250px] flex items-center gap-2">
                              <button
                                className="inline-flex items-center p-1.5 border border-transparent text-xs font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 transition-colors"
                                onClick={() => downloadRecording(recording.recordingURL, recording.id)}
                                title="ดาวน์โหลดไฟล์เสียง"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <div className="flex-1 min-w-[200px]">
                                {currentPlayingId === recording.id ? (
                                  <div className="w-full">
                                    <div className="flex items-center gap-2 mb-1">
                                      <button
                                        className="text-blue-700 hover:text-blue-900"
                                        onClick={() => isPlaying ? pauseAudio() : resumeAudio()}
                                      >
                                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                      </button>
                                      <input
                                        type="range"
                                        min="0"
                                        max={duration || 0}
                                        value={currentTime}
                                        onChange={handleSliderChange}
                                        className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                                        style={{
                                          background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${(currentTime / (duration || 1)) * 100}%, #DBEAFE ${(currentTime / (duration || 1)) * 100}%, #DBEAFE 100%)`
                                        }}
                                      />
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-xs text-gray-600">{formatTime(currentTime)}</span>
                                      <span className="text-xs text-gray-600">{formatTime(duration)}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors w-full justify-center"
                                    onClick={() => playRecording(recording.recordingURL, recording.id)}
                                    disabled={currentPlayingId !== null}
                                  >
                                    <Phone className="w-3 h-3 mr-1" />
                                    เล่นเสียง
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredRecordings.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center">
                          <div className="flex flex-col items-center">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                              <Search className="w-6 h-6 text-gray-400" />
                            </div>
                            <p className="text-gray-500 text-sm font-medium">ไม่พบข้อมูล</p>
                            <p className="text-gray-400 text-xs mt-1">ลองปรับเปลี่ยนเงื่อนไขการค้นหาหรือกดปุ่ม "ดึงข้อมูล" เพื่อโหลดข้อมูลการโทร</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
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

