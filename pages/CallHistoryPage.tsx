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
    maxresults: -1,
    includetags: true,
    includemetadata: true,
    includeprograms: true
  };
  
  // Add party parameter for Telesale and Supervisor users
  if (currentUser && currentUser.role === UserRole.Telesale && currentUser.phone) {
    // Format phone number from 0945547598 to +66945547598
    const formattedPhone = currentUser.phone.startsWith('0')
      ? '+66' + currentUser.phone.substring(1)
      : '+66' + currentUser.phone;
    
    apiConfig.party = formattedPhone;
  } else if (currentUser && currentUser.role === UserRole.Supervisor && currentUser.phone) {
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

// TypeScript types for datetime state management
interface DateTimeRange {
  start: string;
  end: string;
}

const CallHistoryPage: React.FC<CallHistoryPageProps> = ({ currentUser, calls, customers, users }) => {
  const [qCustomer, setQCustomer] = useState('');
  const [qCustomerPhone, setQCustomerPhone] = useState('');
  const [qAgentPhone, setQAgentPhone] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [status, setStatus] = useState('all');
  const [direction, setDirection] = useState('all');
  const [range, setRange] = useState<DateTimeRange>({ start: '', end: '' });
  const [datetimeRange, setDatetimeRange] = useState<DateTimeRange>({ start: '', end: '' });
  const [recordingsData, setRecordingsData] = useState<any>(null);
  const [filteredRecordings, setFilteredRecordings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [accessToken, setAccessToken] = useState<string>('');
  const [searchedAgent, setSearchedAgent] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalResults, setTotalResults] = useState(0);
  const [nextPageUri, setNextPageUri] = useState('');
  const [prevPageUri, setPrevPageUri] = useState('');
  const [limitReached, setLimitReached] = useState(false);
  
  // Audio player state
  const [currentPlayingId, setCurrentPlayingId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [pausedAudios, setPausedAudios] = useState<Map<number, number>>(new Map());
  const [activeAudios, setActiveAudios] = useState<Set<number>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstLoad = useRef(true);
  
  // (Removed) Employee call overview state

  const currentUserFull = `${currentUser.firstName} ${currentUser.lastName}`.trim();
  const isPrivileged = currentUser.role === UserRole.SuperAdmin || currentUser.role === UserRole.AdminControl;

  const customersById = useMemo(() => {
    const map: Record<string, Customer> = {};
    customers.forEach(c => { map[c.id] = c; });
    return map;
  }, [customers]);

  // Filter users for supervisor
  const supervisedAgents = useMemo(() => {
    if (currentUser.role === UserRole.Supervisor) {
      return users.filter(user =>
        user.role === UserRole.Telesale && user.supervisorId === currentUser.id
      );
    }
    return [];
  }, [currentUser, users]);
  
  // Filter users for admin
  const adminUsers = useMemo(() => {
    if (currentUser.role === UserRole.AdminControl || currentUser.role === UserRole.SuperAdmin) {
      return users.filter(user =>
        user.role === UserRole.Supervisor || user.role === UserRole.Telesale
      );
    }
    return [];
  }, [currentUser, users]);

  // (Removed) Employee call overview fetch/effect

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
    
    // If there's a currently playing audio, pause it and save its position
    if (audioRef.current && currentPlayingId !== null) {
      // Save the current position of the paused audio
      const pausedPosition = audioRef.current.currentTime;
      setPausedAudios(prev => new Map(prev).set(currentPlayingId, pausedPosition));
      
      // Pause the current audio
      audioRef.current.pause();
      audioRef.current = null;
      
      // Clear interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      // Reset playing state
      setIsPlaying(false);
    }
    
    // Check if this audio was previously paused
    const savedPosition = pausedAudios.get(id) || 0;
    
    // Set loading state
    setIsAudioLoading(true);
    setCurrentPlayingId(id);
    setCurrentTime(savedPosition);
    
    // Add this audio to active audios
    setActiveAudios(prev => new Set(prev).add(id));
    
    if (!accessToken) {
      // Try to authenticate again if we don't have a token
      try {
        const authResult = await authenticateOneCall();
        if (authResult.success && authResult.token) {
          setAccessToken(authResult.token);
        } else {
          alert('ไม่สามารถยืนยันตัวตนได้: ' + authResult.error);
          setIsAudioLoading(false);
          setCurrentPlayingId(null);
          return;
        }
      } catch (error) {
        alert('เกิดข้อผิดพลาดในการยืนยันตัวตน: ' + error.message);
        setIsAudioLoading(false);
        setCurrentPlayingId(null);
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
        // Use saved position if available, otherwise start from 0
        const savedPosition = pausedAudios.get(id) || 0;
        audio.currentTime = savedPosition;
        setCurrentTime(savedPosition);
      });
      
      audio.addEventListener('canplay', () => {
        // Audio is ready to play
        setIsAudioLoading(false);
      });
      
      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime);
      });
      
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        setIsAudioLoading(false);
        setCurrentPlayingId(null);
        // Remove from paused audios when it ends
        setPausedAudios(prev => {
          const newMap = new Map(prev);
          newMap.delete(id);
          return newMap;
        });
        // Remove from active audios when it ends
        setActiveAudios(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
        URL.revokeObjectURL(audioUrl);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      });
      
      audio.addEventListener('error', () => {
        alert('ไม่สามารถเล่นไฟล์เสียงได้');
        setIsAudioLoading(false);
        setCurrentPlayingId(null);
      });
      
      // Play the audio
      audio.play().then(() => {
        setIsPlaying(true);
        
        // Update time every second
        intervalRef.current = setInterval(() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }, 1000);
      }).catch(error => {
        alert('ไม่สามารถเล่นเสียงได้: ' + error.message);
        setIsAudioLoading(false);
        setCurrentPlayingId(null);
      });
    } catch (error) {
      alert('ไม่สามารถดึงข้อมูลเสียงได้: ' + error.message);
      setIsAudioLoading(false);
      setCurrentPlayingId(null);
    }
  };
  
  // Function to pause audio
  const pauseAudio = () => {
    if (audioRef.current && currentPlayingId !== null) {
      // Save the current position
      const pausedPosition = audioRef.current.currentTime;
      setPausedAudios(prev => new Map(prev).set(currentPlayingId, pausedPosition));
      
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
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
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
    }
  }, [currentUser]);

  // Function to create search parameters for SuperAdmin and AdminControl users
  const createSearchParams = () => {
    // Default parameters
    const params: any = {
      baseUrl: '/onecall/orktrack/rest/recordings',
      range: 'custom',
      sort: '',
      page: 1,
      pagesize: 20,
      maxresults: -1,
      includetags: true,
      includemetadata: true,
      includeprograms: true
    };
    
    // Add startdate as today at midnight UTC+7 converted to UTC+0
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0); // Set to midnight
    startDate.setHours(startDate.getHours() - 7); // Convert from UTC+7 to UTC+0
    
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const day = String(startDate.getDate()).padStart(2, '0');
    const hours = String(startDate.getHours()).padStart(2, '0');
    const minutes = String(startDate.getMinutes()).padStart(2, '0');
    const seconds = String(startDate.getSeconds()).padStart(2, '0');
    params.startdate = `${year}${month}${day}_${hours}${minutes}${seconds}`;
    
    // Add date range if specified
    if (datetimeRange.start) {
      const startDate = new Date(datetimeRange.start);
      startDate.setHours(startDate.getHours() - 7); // Convert to UTC
      const year = startDate.getFullYear();
      const month = String(startDate.getMonth() + 1).padStart(2, '0');
      const day = String(startDate.getDate()).padStart(2, '0');
      const hours = String(startDate.getHours()).padStart(2, '0');
      const minutes = String(startDate.getMinutes()).padStart(2, '0');
      const seconds = String(startDate.getSeconds()).padStart(2, '0');
      params.startdate = `${year}${month}${day}_${hours}${minutes}${seconds}`;
    }
    
    if (datetimeRange.end) {
      const endDate = new Date(datetimeRange.end);
      endDate.setHours(endDate.getHours() - 7); // Convert to UTC
      const year = endDate.getFullYear();
      const month = String(endDate.getMonth() + 1).padStart(2, '0');
      const day = String(endDate.getDate()).padStart(2, '0');
      const hours = String(endDate.getHours()).padStart(2, '0');
      const minutes = String(endDate.getMinutes()).padStart(2, '0');
      const seconds = String(endDate.getSeconds()).padStart(2, '0');
      params.enddate = `${year}${month}${day}_${hours}${minutes}${seconds}`;
      params.maxresults = -1; // Set to -1 when enddate is set
    }
    
    // Add direction filter if specified
    if (direction !== 'all') {
      params.direction = direction;
    }
    
    // Handle phone filters
    const hasCustomerPhone = qCustomerPhone && qCustomerPhone.trim() !== '';
    const hasSelectedAgent = selectedAgent && selectedAgent.trim() !== '';
    
    // Format phone numbers to +66 format
    const formatPhoneToPlus66 = (phone: string) => {
      // Remove any non-digit characters first
      const digitsOnly = phone.replace(/\D/g, '');
      
      // If starts with 0, remove 0 and add +66
      if (digitsOnly.startsWith('0')) {
        return '+66' + digitsOnly.substring(1);
      }
      // If starts with 66, add + at the beginning
      else if (digitsOnly.startsWith('66')) {
        return '+' + digitsOnly;
      }
      // If starts with +66, return as is
      else if (digitsOnly.startsWith('66') && phone.startsWith('+')) {
        return phone;
      }
      // Default case: add +66
      else {
        return '+66' + digitsOnly;
      }
    };
    
    // Case 1: Only one phone is specified
    if ((hasCustomerPhone && !hasSelectedAgent) || (!hasCustomerPhone && hasSelectedAgent)) {
      const phone = hasCustomerPhone ? qCustomerPhone : selectedAgent;
      if (phone) {
        params.party = formatPhoneToPlus66(phone);
      }
    }
    // Case 2: Both phones are specified - return two sets of parameters
    else if (hasCustomerPhone && hasSelectedAgent) {
      const formattedCustomerPhone = formatPhoneToPlus66(qCustomerPhone);
      const formattedAgentPhone = formatPhoneToPlus66(selectedAgent);
      
      const params1 = { ...params };
      params1.localparty = formattedAgentPhone;
      params1.remoteparty = formattedCustomerPhone;
      delete params1.party; // Remove party parameter
      
      const params2 = { ...params };
      params2.localparty = formattedCustomerPhone;
      params2.remoteparty = formattedAgentPhone;
      delete params2.party; // Remove party parameter
      
      return { params: [params1, params2], isDualRequest: true };
    }
    
    return { params: [params], isDualRequest: false };
  };

  // Function to filter recordings data based on current filter values
  const filterRecordings = async () => {
    if (!recordingsData || !recordingsData.objects) {
      setFilteredRecordings([]);
      return;
    }
    
    // Set search loading state
    setIsSearchLoading(true);
    
    try {
      // First, authenticate to get the access token
      const authResult = await authenticateOneCall();
      if (!authResult.success || !authResult.token) {
        setIsSearchLoading(false);
        return;
      }
      
      setAccessToken(authResult.token);
      
      // Use different logic based on user role
      if (currentUser && (currentUser.role === UserRole.AdminControl || currentUser.role === UserRole.SuperAdmin)) {
        // Use the new createSearchParams function for AdminControl and SuperAdmin
        const { params: paramsList, isDualRequest } = createSearchParams();
        
        if (isDualRequest) {
          // Execute both requests in parallel
          const requests = paramsList.map(paramObj => {
            const urlParams = new URLSearchParams();
            Object.entries(paramObj).forEach(([key, value]) => {
              if (value !== undefined && value !== null) {
                urlParams.append(key, value.toString());
              }
            });
            
            const url = `${paramObj.baseUrl}?${urlParams.toString()}`;
            
            return fetch(url, {
              method: 'GET',
              headers: {
                'Authorization': authResult.token,
                'Accept': 'application/json'
              }
            });
          });
          
          const responses = await Promise.all(requests);
          
          // Parse all responses
          const allObjects: any[] = [];
          
          for (const response of responses) {
            if (response.ok) {
              const responseText = await response.text();
              let responseData;
              try {
                responseData = JSON.parse(responseText);
              } catch (e) {
                responseData = responseText;
              }
              
              if (responseData && responseData.objects) {
                allObjects.push(...responseData.objects);
              }
            }
          }
          
          // Remove duplicates based on recording ID
          const uniqueObjects = allObjects.filter((obj: any, index: number, self: any[]) =>
            index === self.findIndex((t: any) => t.id === obj.id)
          );
          
          // Sort by timestamp (newest first)
          uniqueObjects.sort((a: any, b: any) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          
          // Update state with merged results
          const mergedData = {
            objects: uniqueObjects,
            page: 1,
            pageSize: 20,
            resultCount: uniqueObjects.length
          };
          
          setRecordingsData(mergedData);
          setFilteredRecordings(uniqueObjects);
          setSearchedAgent(selectedAgent);
          setCurrentPage(1);
          setPageSize(20);
          setTotalResults(uniqueObjects.length);
          setNextPageUri('');
          setPrevPageUri('');
          setLimitReached(false);
        } else {
          // Single request
          const paramObj = paramsList[0];
          const urlParams = new URLSearchParams();
          Object.entries(paramObj).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              urlParams.append(key, value.toString());
            }
          });
          
          const url = `${paramObj.baseUrl}?${urlParams.toString()}`;
          
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': authResult.token,
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            const responseText = await response.text();
            let responseData;
            try {
              responseData = JSON.parse(responseText);
            } catch (e) {
              responseData = responseText;
            }
            
            if (responseData && responseData.objects) {
              setRecordingsData(responseData);
              setFilteredRecordings(responseData.objects);
              setSearchedAgent(selectedAgent);
              setCurrentPage(responseData.page || 1);
              setPageSize(responseData.pageSize || 20);
              setTotalResults(responseData.resultCount || 0);
              setNextPageUri(responseData.nextPageUri || '');
              setPrevPageUri(responseData.prevPageUri || '');
              setLimitReached(responseData.limitReached || false);
            }
          }
        }
      } else {
        // Use the original logic for other user roles
        // API Configuration parameters (default values)
        const apiConfig: any = {
          baseUrl: '/onecall/orktrack/rest/recordings',
          range: 'custom',
          sort: '',
          page: 1,
          pagesize: pageSize,
          maxresults: -1,
          includetags: true,
          includemetadata: true,
          includeprograms: true
        };
        
        // Build URL parameters
        const params = new URLSearchParams();
        
        // Add default parameters
        params.append('range', apiConfig.range);
        params.append('sort', apiConfig.sort);
        params.append('page', apiConfig.page.toString());
        params.append('pagesize', apiConfig.pagesize.toString());
        params.append('maxresults', apiConfig.maxresults.toString());
        params.append('includetags', apiConfig.includetags.toString());
        params.append('includemetadata', apiConfig.includemetadata.toString());
        params.append('includeprograms', apiConfig.includeprograms.toString());
        
        // Add filter parameters
        if (qCustomer) params.append('customer', qCustomer);
        if (qCustomerPhone) params.append('customerPhone', qCustomerPhone);
        if (qAgentPhone) params.append('agentPhone', qAgentPhone);
        if (status !== 'all') params.append('status', status);
        if (direction !== 'all') params.append('direction', direction);
        
        // Handle startdate parameter
        let startDateFormatted = '';
        if (datetimeRange.start) {
          // Format datetime for API
          const startDate = new Date(datetimeRange.start);
          startDate.setHours(startDate.getHours() - 7); // Convert to UTC
          const year = startDate.getFullYear();
          const month = String(startDate.getMonth() + 1).padStart(2, '0');
          const day = String(startDate.getDate()).padStart(2, '0');
          const hours = String(startDate.getHours()).padStart(2, '0');
          const minutes = String(startDate.getMinutes()).padStart(2, '0');
          const seconds = String(startDate.getSeconds()).padStart(2, '0');
          startDateFormatted = `${year}${month}${day}_${hours}${minutes}${seconds}`;
          params.append('startdate', startDateFormatted);
        } else {
          // Set default startdate as today's date at midnight (00:00:00) minus 7 hours
          const startDate = new Date();
          startDate.setHours(0, 0, 0, 0); // Set time to 00:00:00
          startDate.setHours(startDate.getHours() - 7); // Subtract 7 hours for timezone adjustment
          
          const year = startDate.getFullYear();
          const month = String(startDate.getMonth() + 1).padStart(2, '0');
          const day = String(startDate.getDate()).padStart(2, '0');
          const hours = String(startDate.getHours()).padStart(2, '0');
          const minutes = String(startDate.getMinutes()).padStart(2, '0');
          const seconds = String(startDate.getSeconds()).padStart(2, '0');
          startDateFormatted = `${year}${month}${day}_${hours}${minutes}${seconds}`;
          params.append('startdate', startDateFormatted);
        }
        
        if (datetimeRange.end) {
          // Format datetime for API
          const endDate = new Date(datetimeRange.end);
          endDate.setHours(endDate.getHours() - 7); // Convert to UTC
          const year = endDate.getFullYear();
          const month = String(endDate.getMonth() + 1).padStart(2, '0');
          const day = String(endDate.getDate()).padStart(2, '0');
          const hours = String(endDate.getHours()).padStart(2, '0');
          const minutes = String(endDate.getMinutes()).padStart(2, '0');
          const seconds = String(endDate.getSeconds()).padStart(2, '0');
          const endDateFormatted = `${year}${month}${day}_${hours}${minutes}${seconds}`;
          params.append('enddate', endDateFormatted);
          
          // Set maxresults to -1 when enddate is set
          params.set('maxresults', '-1');
        }
        
        // Add party parameter for Supervisor users (use selectedAgent if set, otherwise use current user's phone)
        if (currentUser && currentUser.role === UserRole.Supervisor) {
          const phoneToUse = selectedAgent || currentUser.phone;
          if (phoneToUse) {
            const formattedPhone = phoneToUse.startsWith('0')
              ? '+66' + phoneToUse.substring(1)
              : '+66' + phoneToUse;
            params.append('party', formattedPhone);
          }
        }
        // Add party parameter for Telesale users
        else if (currentUser && currentUser.role === UserRole.Telesale && currentUser.phone) {
          const formattedPhone = currentUser.phone.startsWith('0')
            ? '+66' + currentUser.phone.substring(1)
            : '+66' + currentUser.phone;
          params.append('party', formattedPhone);
        }
        
        // Create the search URL
        const searchUrl = `${apiConfig.baseUrl}?${params.toString()}`;
        
        // Special handling for users with customer phone and selected agent
        if (qCustomerPhone && (currentUser.role === UserRole.Telesale || currentUser.role === UserRole.Supervisor)) {
          // Get the phone number to use
          const agentPhone = currentUser.role === UserRole.Supervisor && selectedAgent
            ? selectedAgent
            : currentUser.phone;
          
          if (agentPhone) {
            // Format phone numbers to +66 format
            const formatPhoneToPlus66 = (phone: string) => {
              // Remove any non-digit characters first
              const digitsOnly = phone.replace(/\D/g, '');
              
              // If starts with 0, remove 0 and add +66
              if (digitsOnly.startsWith('0')) {
                return '+66' + digitsOnly.substring(1);
              }
              // If starts with 66, add + at the beginning
              else if (digitsOnly.startsWith('66')) {
                return '+' + digitsOnly;
              }
              // If starts with +66, return as is
              else if (digitsOnly.startsWith('66') && phone.startsWith('+')) {
                return phone;
              }
              // Default case: add +66
              else {
                return '+66' + digitsOnly;
              }
            };
            
            const formattedCustomerPhone = formatPhoneToPlus66(qCustomerPhone);
            const formattedAgentPhone = formatPhoneToPlus66(agentPhone);
            
            // First request: localparty = agent phone, remoteparty = customer phone
            const params1 = new URLSearchParams(params.toString());
            params1.delete('party');
            params1.append('localparty', formattedAgentPhone);
            params1.append('remoteparty', formattedCustomerPhone);
            
            const searchUrl1 = `${apiConfig.baseUrl}?${params1.toString()}`;
            
            // Second request: localparty = customer phone, remoteparty = agent phone
            const params2 = new URLSearchParams(params.toString());
            params2.delete('party');
            params2.append('localparty', formattedCustomerPhone);
            params2.append('remoteparty', formattedAgentPhone);
            
            const searchUrl2 = `${apiConfig.baseUrl}?${params2.toString()}`;
            
            // Execute both requests in parallel
            const [response1, response2] = await Promise.all([
              fetch(searchUrl1, {
                method: 'GET',
                headers: {
                  'Authorization': authResult.token,
                  'Accept': 'application/json'
                }
              }),
              fetch(searchUrl2, {
                method: 'GET',
                headers: {
                  'Authorization': authResult.token,
                  'Accept': 'application/json'
                }
              })
            ]);
            
            // Parse both responses
            let responseData1, responseData2;
            
            if (response1.ok) {
              const responseText1 = await response1.text();
              try {
                responseData1 = JSON.parse(responseText1);
              } catch (e) {
                responseData1 = responseText1;
              }
            }
            
            if (response2.ok) {
              const responseText2 = await response2.text();
              try {
                responseData2 = JSON.parse(responseText2);
              } catch (e) {
                responseData2 = responseText2;
              }
            }
            
            // Merge the results
            const mergedData = {
              objects: [
                ...(responseData1?.objects || []),
                ...(responseData2?.objects || [])
              ]
            };
            
            // Remove duplicates based on recording ID
            const uniqueObjects = mergedData.objects.filter((obj: any, index: number, self: any[]) =>
              index === self.findIndex((t: any) => t.id === obj.id)
            );
            
            mergedData.objects = uniqueObjects;
            
            // Sort by timestamp (newest first)
            mergedData.objects.sort((a: any, b: any) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            
            // Update state with merged results
            setRecordingsData(mergedData);
            setFilteredRecordings(mergedData.objects);
            setSearchedAgent(selectedAgent);
            setCurrentPage(1);
            setPageSize(20);
            setTotalResults(mergedData.objects.length);
            setNextPageUri('');
            setPrevPageUri('');
            setLimitReached(false);
          }
        } else {
          // Normal request
          const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
              'Authorization': authResult.token,
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            const responseText = await response.text();
            let responseData;
            try {
              responseData = JSON.parse(responseText);
            } catch (e) {
              responseData = responseText;
            }
            
            if (responseData && responseData.objects) {
              setRecordingsData(responseData);
              setFilteredRecordings(responseData.objects);
              setSearchedAgent(selectedAgent);
              setCurrentPage(responseData.page || 1);
              setPageSize(responseData.pageSize || 20);
              setTotalResults(responseData.resultCount || 0);
              setNextPageUri(responseData.nextPageUri || '');
              setPrevPageUri(responseData.prevPageUri || '');
              setLimitReached(responseData.limitReached || false);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error filtering recordings:', error);
    } finally {
      setIsSearchLoading(false);
    }
  };
  
  // Function to handle page change
  const handlePageChange = async (page: number) => {
    setCurrentPage(page);
    
    // Create a new request with the selected page number
    setIsSearchLoading(true);
    
    try {
      // First, authenticate to get the access token
      const authResult = await authenticateOneCall();
      if (authResult.success && authResult.token) {
        // Build URL parameters with the selected page
        const params = new URLSearchParams();
        
        // Add default parameters
        params.append('range', 'custom');
        params.append('sort', '');
        params.append('page', page.toString());
        params.append('pagesize', pageSize.toString());
        params.append('maxresults', '-1');
        params.append('includetags', 'true');
        params.append('includemetadata', 'true');
        params.append('includeprograms', 'true');
        
        // Use default startdate (today's date at midnight) - not from filter
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0); // Set time to 00:00:00
        startDate.setHours(startDate.getHours() - 7); // Subtract 7 hours for timezone adjustment
        
        const year = startDate.getFullYear();
        const month = String(startDate.getMonth() + 1).padStart(2, '0');
        const day = String(startDate.getDate()).padStart(2, '0');
        const hours = String(startDate.getHours()).padStart(2, '0');
        const minutes = String(startDate.getMinutes()).padStart(2, '0');
        const seconds = String(startDate.getSeconds()).padStart(2, '0');
        const startDateFormatted = `${year}${month}${day}_${hours}${minutes}${seconds}`;
        params.append('startdate', startDateFormatted);
        
        // Add party parameter based on user role
        if (currentUser && (currentUser.role === UserRole.AdminControl || currentUser.role === UserRole.SuperAdmin) && selectedAgent) {
          const formattedPhone = selectedAgent.startsWith('0')
            ? '+66' + selectedAgent.substring(1)
            : '+66' + selectedAgent;
          params.append('party', formattedPhone);
        } else if (currentUser && currentUser.role === UserRole.Supervisor) {
          const phoneToUse = selectedAgent || currentUser.phone;
          if (phoneToUse) {
            const formattedPhone = phoneToUse.startsWith('0')
              ? '+66' + phoneToUse.substring(1)
              : '+66' + phoneToUse;
            params.append('party', formattedPhone);
          }
        } else if (currentUser && currentUser.role === UserRole.Telesale && currentUser.phone) {
          const formattedPhone = currentUser.phone.startsWith('0')
            ? '+66' + currentUser.phone.substring(1)
            : '+66' + currentUser.phone;
          params.append('party', formattedPhone);
        }
        
        const searchUrl = `/onecall/orktrack/rest/recordings?${params.toString()}`;
        
        const response = await fetch(searchUrl, {
          method: 'GET',
          headers: {
            'Authorization': authResult.token,
            'Accept': 'application/json'
          }
        });
        
        if (response.ok) {
          const responseText = await response.text();
          let responseData;
          try {
            responseData = JSON.parse(responseText);
          } catch (e) {
            responseData = responseText;
          }
          
          if (responseData && responseData.objects) {
            setRecordingsData(responseData);
            setFilteredRecordings(responseData.objects);
            
            // Update pagination state
            setCurrentPage(responseData.page || page);
            setPageSize(responseData.pageSize || pageSize);
            setTotalResults(responseData.resultCount || 0);
            setNextPageUri(responseData.nextPageUri || '');
            setPrevPageUri(responseData.prevPageUri || '');
            setLimitReached(responseData.limitReached || false);
          }
        }
      }
    } catch (error) {
      // If there's an error, revert to the previous page
      setCurrentPage(currentPage);
    } finally {
      setIsSearchLoading(false);
    }
  };
  
  // Function to handle page size change
  const handlePageSizeChange = async (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page
    
    // Create a new request with the selected page size
    setIsSearchLoading(true);
    
    try {
      // First, authenticate to get the access token
      const authResult = await authenticateOneCall();
      if (authResult.success && authResult.token) {
        // Build URL parameters with the selected page size
        const params = new URLSearchParams();
        
        // Add default parameters
        params.append('range', 'custom');
        params.append('sort', '');
        params.append('page', '1'); // Reset to first page
        params.append('pagesize', newPageSize.toString());
        params.append('maxresults', '-1');
        params.append('includetags', 'true');
        params.append('includemetadata', 'true');
        params.append('includeprograms', 'true');
        
        // Use default startdate (today's date at midnight) - not from filter
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0); // Set time to 00:00:00
        startDate.setHours(startDate.getHours() - 7); // Subtract 7 hours for timezone adjustment
        
        const year = startDate.getFullYear();
        const month = String(startDate.getMonth() + 1).padStart(2, '0');
        const day = String(startDate.getDate()).padStart(2, '0');
        const hours = String(startDate.getHours()).padStart(2, '0');
        const minutes = String(startDate.getMinutes()).padStart(2, '0');
        const seconds = String(startDate.getSeconds()).padStart(2, '0');
        const startDateFormatted = `${year}${month}${day}_${hours}${minutes}${seconds}`;
        params.append('startdate', startDateFormatted);
        
        // Add party parameter based on user role
        if (currentUser && (currentUser.role === UserRole.AdminControl || currentUser.role === UserRole.SuperAdmin) && selectedAgent) {
          const formattedPhone = selectedAgent.startsWith('0')
            ? '+66' + selectedAgent.substring(1)
            : '+66' + selectedAgent;
          params.append('party', formattedPhone);
        } else if (currentUser && currentUser.role === UserRole.Supervisor) {
          const phoneToUse = selectedAgent || currentUser.phone;
          if (phoneToUse) {
            const formattedPhone = phoneToUse.startsWith('0')
              ? '+66' + phoneToUse.substring(1)
              : '+66' + phoneToUse;
            params.append('party', formattedPhone);
          }
        } else if (currentUser && currentUser.role === UserRole.Telesale && currentUser.phone) {
          const formattedPhone = currentUser.phone.startsWith('0')
            ? '+66' + currentUser.phone.substring(1)
            : '+66' + currentUser.phone;
          params.append('party', formattedPhone);
        }
        
        const searchUrl = `/onecall/orktrack/rest/recordings?${params.toString()}`;
        
        const response = await fetch(searchUrl, {
          method: 'GET',
          headers: {
            'Authorization': authResult.token,
            'Accept': 'application/json'
          }
        });
        
        if (response.ok) {
          const responseText = await response.text();
          let responseData;
          try {
            responseData = JSON.parse(responseText);
          } catch (e) {
            responseData = responseText;
          }
          
          if (responseData && responseData.objects) {
            setRecordingsData(responseData);
            setFilteredRecordings(responseData.objects);
            
            // Update pagination state
            setCurrentPage(responseData.page || 1);
            setPageSize(responseData.pageSize || newPageSize);
            setTotalResults(responseData.resultCount || 0);
            setNextPageUri(responseData.nextPageUri || '');
            setPrevPageUri(responseData.prevPageUri || '');
            setLimitReached(responseData.limitReached || false);
          }
        }
      }
    } catch (error) {
      // If there's an error, revert to the previous page size
      setPageSize(pageSize);
    } finally {
      setIsSearchLoading(false);
    }
  };
  
  // Function to fetch next page using nextPageUri
  const fetchNextPage = async () => {
    if (nextPageUri && !limitReached && !isSearchLoading) {
      setIsSearchLoading(true);
      try {
        // Use proxy URL
        const proxyUrl = nextPageUri.replace('https://onecallvoicerecord.dtac.co.th', '/onecall');
        
        // Update page number immediately for better UX
        const urlParams = new URLSearchParams(nextPageUri.split('?')[1]);
        const nextPageNum = parseInt(urlParams.get('page') || '1');
        setCurrentPage(nextPageNum);
        
        const response = await fetch(proxyUrl, {
          method: 'GET',
          headers: {
            'Authorization': accessToken,
            'Accept': 'application/json'
          }
        });
        
        if (response.ok) {
          const responseText = await response.text();
          let responseData;
          try {
            responseData = JSON.parse(responseText);
          } catch (e) {
            responseData = responseText;
          }
          
          if (responseData && responseData.objects) {
            setRecordingsData(responseData);
            setFilteredRecordings(responseData.objects);
            
            // Update pagination state
            setCurrentPage(responseData.page || 1);
            setPageSize(responseData.pageSize || 20);
            setTotalResults(responseData.resultCount || 0);
            setNextPageUri(responseData.nextPageUri || '');
            setPrevPageUri(responseData.prevPageUri || '');
            setLimitReached(responseData.limitReached || false);
          }
        }
      } catch (error) {
        // If there's an error, revert to the previous page
        setCurrentPage(currentPage);
      } finally {
        setIsSearchLoading(false);
      }
    }
  };
  
  // Function to fetch previous page using prevPageUri
  const fetchPrevPage = async () => {
    if (prevPageUri && !isSearchLoading) {
      setIsSearchLoading(true);
      try {
        // Use proxy URL
        const proxyUrl = prevPageUri.replace('https://onecallvoicerecord.dtac.co.th', '/onecall');
        
        // Update page number immediately for better UX
        const urlParams = new URLSearchParams(prevPageUri.split('?')[1]);
        const prevPageNum = parseInt(urlParams.get('page') || '1');
        setCurrentPage(prevPageNum);
        
        const response = await fetch(proxyUrl, {
          method: 'GET',
          headers: {
            'Authorization': accessToken,
            'Accept': 'application/json'
          }
        });
        
        if (response.ok) {
          const responseText = await response.text();
          let responseData;
          try {
            responseData = JSON.parse(responseText);
          } catch (e) {
            responseData = responseText;
          }
          
          if (responseData && responseData.objects) {
            setRecordingsData(responseData);
            setFilteredRecordings(responseData.objects);
            
            // Update pagination state
            setCurrentPage(responseData.page || 1);
            setPageSize(responseData.pageSize || 20);
            setTotalResults(responseData.resultCount || 0);
            setNextPageUri(responseData.nextPageUri || '');
            setPrevPageUri(responseData.prevPageUri || '');
            setLimitReached(responseData.limitReached || false);
          }
        }
      } catch (error) {
        // If there's an error, revert to the previous page
        setCurrentPage(currentPage);
      } finally {
        setIsSearchLoading(false);
      }
    }
  };
  
  // Initialize filtered recordings when recordings data is loaded
  useEffect(() => {
    if (recordingsData && recordingsData.objects) {
      setFilteredRecordings(recordingsData.objects);
      
      // Update pagination state
      setCurrentPage(recordingsData.page || 1);
      setPageSize(recordingsData.pageSize || 20);
      setTotalResults(recordingsData.resultCount || 0);
      setNextPageUri(recordingsData.nextPageUri || '');
      setPrevPageUri(recordingsData.prevPageUri || '');
      setLimitReached(recordingsData.limitReached || false);
    }
  }, [recordingsData]);

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="w-full">
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
                วันที่และเวลาโทร (เริ่ม)
              </label>
              <input
                type="datetime-local"
                value={datetimeRange.start}
                onChange={e=>{
                  const newStart = e.target.value;
                  setDatetimeRange(prev => ({ ...prev, start: newStart, end: '' }));
                  
                  // Convert to UTC timestamp by subtracting 7 hours
                  if (newStart) {
                    const startDate = new Date(newStart);
                    startDate.setHours(startDate.getHours() - 7);
                    setRange(prev => ({ ...prev, start: startDate.toISOString().split('T')[0] }));
                  } else {
                    setRange(prev => ({ ...prev, start: '' }));
                  }
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Calendar className="w-4 h-4 text-gray-400" />
                วันที่และเวลาโทร (สิ้นสุด)
              </label>
              <input
                type="datetime-local"
                value={datetimeRange.end}
                min={datetimeRange.start}
                disabled={!datetimeRange.start}
                onChange={e=>{
                  const newEnd = e.target.value;
                  setDatetimeRange(prev => ({ ...prev, end: newEnd }));
                  
                  // Convert to UTC timestamp by subtracting 7 hours
                  if (newEnd) {
                    const endDate = new Date(newEnd);
                    endDate.setHours(endDate.getHours() - 7);
                    setRange(prev => ({ ...prev, end: endDate.toISOString().split('T')[0] }));
                  } else {
                    setRange(prev => ({ ...prev, end: '' }));
                  }
                }}
                className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                  !datetimeRange.start ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
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
            {currentUser.role === UserRole.Supervisor ? (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <UserIcon className="w-4 h-4 text-gray-400" />
                  พนักงานขาย
                </label>
                <select
                  value={selectedAgent}
                  onChange={e=>setSelectedAgent(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value={currentUser.phone || ''}>{currentUser.firstName} (ตัวคุณ)</option>
                  {supervisedAgents.map(agent => (
                    <option key={agent.id} value={agent.phone || ''}>
                      {agent.firstName} {agent.lastName}
                    </option>
                  ))}
                </select>
              </div>
            ) : (currentUser.role === UserRole.AdminControl || currentUser.role === UserRole.SuperAdmin) ? (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <UserIcon className="w-4 h-4 text-gray-400" />
                  พนักงานขาย
                </label>
                <select
                  value={selectedAgent}
                  onChange={e=>setSelectedAgent(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value=''>ทั้งหมด</option>
                  {adminUsers.map(user => (
                    <option key={user.id} value={user.phone || ''}>
                      {user.firstName} {user.lastName} ({user.role})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
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
            )}
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
                onClick={filterRecordings}
                disabled={isSearchLoading}
              >
                {isSearchLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {isSearchLoading ? 'กำลังค้นหา...' : 'ค้นหา'}
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

        {/* Employee Call Overview Table (removed)
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-700">ภาพรวมการโทรของพนักงาน</h2>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">เดือน:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                onClick={fetchEmployeeCallData}
                disabled={isLoadingEmployeeData}
              >
                {isLoadingEmployeeData ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {isLoadingEmployeeData ? 'กำลังโหลด...' : 'ดึงข้อมูล'}
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">รายชื่อพนักงาน</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ตำแหน่ง</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">เบอร์โทร</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">วันที่ทำงาน</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">เวลาโทร (นาที)</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">สายที่ได้คุย</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">โทรทั้งหมด</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">เวลาโทร/วัน (นาที)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoadingEmployeeData ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <div className="flex flex-col items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3"></div>
                        <p className="text-gray-500 text-sm font-medium">กำลังโหลดข้อมูล...</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {employeeCallData.length > 0 ? (
                      employeeCallData.map((employee) => (
                        <tr key={employee.user_id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 text-sm text-gray-800">{employee.first_name}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{employee.role}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{employee.phone}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{employee.working_days}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{employee.total_minutes}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{employee.connected_calls}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{employee.total_calls}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{employee.minutes_per_workday}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-12 text-center">
                          <div className="flex flex-col items-center">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                              <UserIcon className="w-6 h-6 text-gray-400" />
                            </div>
                            <p className="text-gray-500 text-sm font-medium">ไม่พบข้อมูล</p>
                            <p className="text-gray-400 text-xs mt-1">ลองเลือกเดือนอื่นหรือกดปุ่ม "ดึงข้อมูล" เพื่อโหลดข้อมูลใหม่</p>
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

*/}
        {/* Results Summary */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {isLoading || isDataLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                <span>กำลังโหลดข้อมูล...</span>
              </div>
            ) : isSearchLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                <span>กำลังค้นหาข้อมูล...</span>
              </div>
            ) : (
              <span>พบข้อมูลทั้งหมด <span className="font-semibold text-gray-800">{totalResults}</span> รายการ</span>
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
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Datetime</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Duration</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">พนักงานขาย</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">เบอร์ต้นทาง</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Direction</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">เบอร์ปลายทาง</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">สถานะ</th>
                  <th className="py-3 px-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isDataLoading || isSearchLoading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center">
                      <div className="flex flex-col items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3"></div>
                        <p className="text-gray-500 text-sm font-medium">
                          {isSearchLoading ? 'กำลังค้นหาข้อมูล...' : 'กำลังดึงข้อมูลบันทึกการโทร...'}
                        </p>
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
                      
                      // Determine status based on duration
                      const getStatus = (duration: number) => {
                        if (duration <= 40) {
                          return {
                            text: 'ไม่ได้คุย',
                            className: 'text-red-600 bg-red-100'
                          };
                        } else {
                          return {
                            text: 'ได้คุย',
                            className: 'text-green-600 bg-green-100'
                          };
                        }
                      };
                      
                      const status = getStatus(recording.duration || 0);
                      
                      // Get agent name based on phone number matching
                      const getAgentName = () => {
                        // Format phone numbers for comparison
                        const formatPhone = (phone: string) => {
                          if (!phone) return '';
                          // Remove any non-digit characters
                          const digitsOnly = phone.replace(/\D/g, '');
                          // If it starts with 66, remove it
                          if (digitsOnly.startsWith('66')) {
                            return digitsOnly.substring(2);
                          }
                          // If it starts with 0, remove it
                          if (digitsOnly.startsWith('0')) {
                            return digitsOnly.substring(1);
                          }
                          return digitsOnly;
                        };
                        
                        const localParty = formatPhone(recording.localParty || '');
                        const remoteParty = formatPhone(recording.remoteParty || '');
                        
                        // Check if local party matches any supervisor or telesale
                        let matchedUser = users.find(user =>
                          (user.role === UserRole.Supervisor || user.role === UserRole.Telesale) &&
                          formatPhone(user.phone || '') === localParty
                        );
                        
                        // If not found in local party, check remote party
                        if (!matchedUser) {
                          matchedUser = users.find(user =>
                            (user.role === UserRole.Supervisor || user.role === UserRole.Telesale) &&
                            formatPhone(user.phone || '') === remoteParty
                          );
                        }
                        
                        // Return the first name if found, otherwise 'Unknown'
                        return matchedUser ? matchedUser.firstName : 'Unknown';
                      };
                      
                      const agentName = getAgentName();
                      
                      return (
                        <tr key={recording.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 text-sm text-gray-600 font-medium">{recording.id}</td>
                          <td className="py-3 px-4 text-sm text-gray-800 whitespace-normal">{formatDate(recording.timestamp)}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{recording.duration || '-'}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                                <UserIcon className="w-3 h-3 text-blue-600" />
                              </div>
                              {agentName}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">{recording.localParty || '-'}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {dirIcon}
                              <span className="text-sm text-gray-600">{dirText}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">{recording.remoteParty || '-'}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${status.className}`}>
                              {status.text}
                            </span>
                          </td>
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
                                {activeAudios.has(recording.id) || currentPlayingId === recording.id ? (
                                  <div className="w-full">
                                    {/* Show loading if this specific audio is loading */}
                                    {currentPlayingId === recording.id && isAudioLoading ? (
                                      <div className="flex items-center justify-center py-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                                        <span className="text-xs text-gray-600">กำลังโหลด...</span>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="flex items-center gap-2 mb-1">
                                          <button
                                            className="text-blue-700 hover:text-blue-900"
                                            onClick={() => {
                                              // If this is the currently playing audio, toggle play/pause
                                              if (currentPlayingId === recording.id) {
                                                if (isPlaying) {
                                                  pauseAudio();
                                                } else {
                                                  resumeAudio();
                                                }
                                              } else {
                                                // If another audio is playing, pause it first
                                                if (currentPlayingId !== null && isPlaying) {
                                                  pauseAudio();
                                                }
                                                // Then play this audio
                                                playRecording(recording.recordingURL, recording.id);
                                              }
                                            }}
                                          >
                                            {currentPlayingId === recording.id && isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                          </button>
                                          <input
                                            type="range"
                                            min="0"
                                            max={duration || 0}
                                            value={currentPlayingId === recording.id ? currentTime : (pausedAudios.get(recording.id) || 0)}
                                            onChange={currentPlayingId === recording.id ? handleSliderChange : (e) => {
                                              // Update paused position for non-currently playing audios
                                              const newTime = parseFloat(e.target.value);
                                              setPausedAudios(prev => new Map(prev).set(recording.id, newTime));
                                            }}
                                            className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                                            style={{
                                              background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${((currentPlayingId === recording.id ? currentTime : (pausedAudios.get(recording.id) || 0)) / (duration || 1)) * 100}%, #DBEAFE ${((currentPlayingId === recording.id ? currentTime : (pausedAudios.get(recording.id) || 0)) / (duration || 1)) * 100}%, #DBEAFE 100%)`
                                            }}
                                          />
                                        </div>
                                        <div className="flex justify-start">
                                          <span className="text-xs text-gray-600">{formatTime(currentPlayingId === recording.id ? currentTime : (pausedAudios.get(recording.id) || 0))}</span>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors w-full justify-center"
                                    onClick={() => playRecording(recording.recordingURL, recording.id)}
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
                        <td colSpan={9} className="py-12 text-center">
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
          
          {/* Pagination Controls */}
          {totalResults > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 mt-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>แสดงหน้า</span>
                  <span className="font-semibold">{currentPage}</span>
                  <span>จากทั้งหมด</span>
                  <span className="font-semibold">{Math.ceil(totalResults / pageSize)}</span>
                  <span>หน้า</span>
                  <span className="mx-2">|</span>
                  <span>แสดง</span>
                  <select
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span>รายการต่อหน้า</span>
                  <span className="mx-2">|</span>
                  <span>ทั้งหมด</span>
                  <span className="font-semibold">{totalResults}</span>
                  <span>รายการ</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchPrevPage}
                    disabled={!prevPageUri || currentPage <= 1 || isSearchLoading}
                    className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {/* Generate page numbers */}
                    {(() => {
                      const totalPages = Math.ceil(totalResults / pageSize);
                      const maxVisiblePages = 5;
                      
                      // If there are no pages or only one page, don't show pagination
                      if (totalPages <= 1) return null;
                      
                      // Calculate the range of page numbers to show
                      let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                      let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                      
                      // Adjust if we're at the end
                      if (endPage - startPage < maxVisiblePages - 1) {
                        startPage = Math.max(1, endPage - maxVisiblePages + 1);
                      }
                      
                      // Create array of page numbers to show
                      const pageNumbers = [];
                      for (let i = startPage; i <= endPage; i++) {
                        pageNumbers.push(i);
                      }
                      
                      return pageNumbers.map(pageNum => (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          disabled={isSearchLoading}
                          className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed'
                          }`}
                        >
                          {pageNum}
                        </button>
                      ));
                    })()}
                  </div>
                  
                  <button
                    onClick={fetchNextPage}
                    disabled={!nextPageUri || limitReached || isSearchLoading}
                    className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallHistoryPage;

