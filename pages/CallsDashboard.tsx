import React, { useMemo, useState, useEffect } from "react";
import { CallHistory, User, UserRole } from "@/types";
import {
  Phone,
  PhoneIncoming,
  Clock3,
  Users as UsersIcon,
  ChevronDown,
  Calendar,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import StatCard from "@/components/StatCard";
import LineChart from "@/components/LineChart";
import PieChart from "@/components/PieChart";
import OnecallLoginSidebar from "@/components/common/OnecallLoginSidebar";

interface CallsDashboardProps {
  calls?: CallHistory[];
  user?: User;
}

// JavaScript version of authenticateOneCall function
const authenticateOneCall = async () => {
  // Use reverse proxy path (works in dev + prod)
  const loginUrl = `${import.meta.env.BASE_URL}onecall/orktrack/rest/user/login?version=orktrack&accesspolicy=all&licenseinfo=true`;

  try {
    // Get current user from localStorage
    const sessionUserStr = localStorage.getItem("sessionUser");
    if (!sessionUserStr) {
      return {
        success: false,
        error: "No session user found",
      };
    }

    const sessionUser = JSON.parse(sessionUserStr);
    const companyId = sessionUser.company_id;

    // Get credentials from env table
    const usernameKey = `ONECALL_USERNAME_${companyId}`;
    const passwordKey = `ONECALL_PASSWORD_${companyId}`;

    const [usernameRes, passwordRes] = await Promise.all([
      fetch(
        `${import.meta.env.BASE_URL}api/Marketing_DB/get_env.php?key=${usernameKey}`,
        {
          headers: { "Content-Type": "application/json" },
        },
      ),
      fetch(
        `${import.meta.env.BASE_URL}api/Marketing_DB/get_env.php?key=${passwordKey}`,
        {
          headers: { "Content-Type": "application/json" },
        },
      ),
    ]);

    if (!usernameRes.ok || !passwordRes.ok) {
      return {
        success: false,
        error: "Failed to fetch OneCall credentials from database",
      };
    }

    const usernameData = await usernameRes.json();
    const passwordData = await passwordRes.json();

    if (!usernameData.success || !passwordData.success) {
      return {
        success: false,
        error: "OneCall credentials not found in database",
      };
    }

    const username = usernameData.value;
    const password = passwordData.value;

    if (!username || !password) {
      return {
        success: false,
        error: "OneCall credentials are empty",
      };
    }

    // Remove quotes from username and password if present
    const cleanUsername = username.replace(/^"|"$/g, "");
    const cleanPassword = password.replace(/^"|"$/g, "");

    // Create auth string and encode it (Postman Basic Auth style)
    const authString = `${cleanUsername}:${cleanPassword}`;
    const base64Auth = btoa(authString);

    // Create headers with Authorization header (Postman style)
    const headers = {
      Accept: "application/json",
      Authorization: `Basic ${base64Auth}`,
    };

    const response = await fetch(loginUrl, {
      method: "POST",
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

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP Error: ${httpCode}`,
        http_code: httpCode,
      };
    }

    // Extract token from response (adjust based on actual response structure)
    let token = null;
    if (
      responseData &&
      typeof responseData === "object" &&
      responseData.accesstoken
    ) {
      token = responseData.accesstoken;
    }

    return {
      success: true,
      data: responseData,
      token: token,
      http_code: httpCode,
    };
  } catch (error) {
    console.error("Error in authenticateOneCall:", error);
    return {
      success: false,
      error: error.message || "Authentication failed",
    };
  }
};

// Function to fetch recordings data
const fetchRecordingsData = async (startDate: string, endDate: string) => {
  try {
    // First, authenticate to get the access token
    const authResult = await authenticateOneCall();

    if (!authResult.success || !authResult.token) {
      return {
        success: false,
        error: "Authentication failed: " + authResult.error,
      };
    }

    // Format dates for API
    const formatDateForAPI = (
      dateString: string,
      isEndDate: boolean = false,
    ) => {
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
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");

      return `${year}${month}${day}_${hours}${minutes}${seconds}`;
    };

    const startDateFormatted = formatDateForAPI(startDate);
    const endDateFormatted = formatDateForAPI(endDate, true);

    // Build URL parameters
    const params = new URLSearchParams();
    params.append("range", "custom");
    params.append("startdate", startDateFormatted);
    params.append("enddate", endDateFormatted);
    params.append("sort", "");
    params.append("page", "1");
    params.append("pagesize", "10");
    params.append("maxresults", "-1");
    params.append("includetags", "true");
    params.append("includemetadata", "true");
    params.append("includeprograms", "true");

    const searchUrl = `${import.meta.env.BASE_URL}onecall/orktrack/rest/recordings?${params.toString()}`;

    const response = await fetch(searchUrl, {
      method: "GET",
      headers: {
        Authorization: authResult.token,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP error! status: ${response.status}`,
      };
    }

    const responseText = await response.text();

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = responseText;
    }

    return {
      success: true,
      data: responseData,
      token: authResult.token,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to fetch recordings data",
    };
  }
};

// Function to save batch data to database
const saveBatchToDatabase = async (
  startDate: string,
  endDate: string,
  amountRecord: number,
) => {
  try {
    const requestData = {
      startdate: startDate,
      enddate: endDate,
      amount_record: amountRecord,
    };

    const response = await fetch(
      `${import.meta.env.BASE_URL}api/Onecall_DB/onecall_batch.php`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Failed to save batch: ${response.status} - ${errorText}`,
      };
    }

    const responseText = await response.text();

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return {
        success: false,
        error: "Invalid JSON response from batch save API",
      };
    }

    if (!data.success) {
      return {
        success: false,
        error: data.error || "Unknown error from batch save API",
      };
    }

    if (!data.id) {
      return {
        success: false,
        error: "No batch ID returned from API",
      };
    }

    return {
      success: true,
      batchId: data.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to save batch to database",
    };
  }
};

// Function to save log data to database
const saveLogToDatabase = async (logs: any[], batchId: number) => {
  try {
    const requestData = {
      logs: logs,
      batch_id: batchId,
    };

    const response = await fetch(
      `${import.meta.env.BASE_URL}api/Onecall_DB/onecall_logs.php`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Failed to save logs: ${response.status} - ${errorText}`,
      };
    }

    const responseText = await response.text();

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return {
        success: false,
        error: "Invalid JSON response from log save API",
      };
    }

    if (!data.success) {
      return {
        success: false,
        error: data.error || "Unknown error from log save API",
      };
    }

    return {
      success: true,
      duplicates: data.duplicates || null,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to save logs to database",
    };
  }
};

// Custom Date Picker Component
const CustomDatePicker: React.FC<{
  value: string;
  onChange: (date: string) => void;
  batches: any[];
  placeholder: string;
  minDate?: string;
  disabled?: boolean;
}> = ({ value, onChange, batches, placeholder, minDate, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Helper function to get all dates from batches
  const getExistingDates = () => {
    const dates = new Set<string>();
    batches.forEach((batch) => {
      const start = new Date(batch.startdate);
      const end = new Date(batch.enddate);
      const current = new Date(start);

      while (current <= end) {
        dates.add(current.toISOString().split("T")[0]);
        current.setDate(current.getDate() + 1);
      }
    });
    return dates;
  };

  const existingDates = getExistingDates();
  // Use local date string for today to avoid timezone issues
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    const current = new Date(startDate);

    for (let i = 0; i < 42; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  };

  const handleDateSelect = (date: Date) => {
    // Use local date string to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;

    // Check if it's today
    if (dateStr === today) {
      return; // Don't allow selection of today
    }

    // Check min date constraint
    if (minDate && dateStr < minDate) {
      return;
    }

    onChange(dateStr);
    setIsOpen(false);
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return placeholder;
    return dateStr; // Show the raw date string (e.g., "2025-11-09")
  };

  return (
    <div className="relative">
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full border rounded-md px-3 py-2 text-sm cursor-pointer flex items-center justify-between ${
          disabled ? "bg-gray-100 cursor-not-allowed text-gray-400" : "bg-white"
        }`}
      >
        <span className={value ? "text-gray-900" : "text-gray-400"}>
          {formatDisplayDate(value)}
        </span>
        <Calendar className="w-4 h-4 text-gray-400" />
      </div>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-50 p-3 w-80">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() =>
                setCurrentMonth(
                  new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth() - 1,
                  ),
                )
              }
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="font-medium text-sm">
              {currentMonth.toLocaleDateString("th-TH", {
                month: "long",
                year: "numeric",
              })}
            </div>
            <button
              onClick={() =>
                setCurrentMonth(
                  new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth() + 1,
                  ),
                )
              }
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-gray-500 p-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {generateCalendarDays().map((date, index) => {
              // Use local date string to match handleDateSelect format
              const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
              const isCurrentMonth =
                date.getMonth() === currentMonth.getMonth();
              const isExisting = existingDates.has(dateStr);
              const isToday = dateStr === today;
              const isSelected = value === dateStr;
              const isDisabled =
                dateStr === today || (minDate && dateStr < minDate);

              return (
                <button
                  key={index}
                  onClick={() => handleDateSelect(date)}
                  disabled={isDisabled}
                  className={`p-1 text-xs rounded relative ${
                    !isCurrentMonth ? "text-gray-300" : ""
                  } ${isDisabled ? "cursor-not-allowed" : "hover:bg-gray-100"} ${
                    isSelected ? "bg-blue-500 text-white hover:bg-blue-600" : ""
                  }`}
                >
                  <span
                    className={`block ${isToday && !isSelected ? "text-orange-500 font-semibold" : ""}`}
                  >
                    {date.getDate()}
                  </span>
                  {isExisting && !isSelected && (
                    <div
                      className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full ${
                        isToday ? "bg-orange-500" : "bg-green-500"
                      }`}
                    />
                  )}
                  {isToday && !isSelected && (
                    <div className="absolute top-0 right-0 w-2 h-2 bg-orange-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>มีข้อมูลในระบบ</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <span>วันนี้ (ไม่สามารถเลือกได้)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Calls overview focused on layout only (neutral labels, no brand colors/names)
const CallsDashboard: React.FC<CallsDashboardProps> = ({
  calls = [],
  user,
}) => {
  const [month, setMonth] = useState<string>(() =>
    String(new Date().getMonth() + 1).padStart(2, "0"),
  );
  const [year, setYear] = useState<string>(() =>
    String(new Date().getFullYear()),
  );

  // State for date range selection
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // State for modal
  const [showModal, setShowModal] = useState<boolean>(false);
  const [resultCount, setResultCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveProgress, setSaveProgress] = useState<number>(0);
  const [saveTotal, setSaveTotal] = useState<number>(0);
  const [accessToken, setAccessToken] = useState<string>("");

  // State for batch CRUD
  const [batches, setBatches] = useState<any[]>([]);
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false);
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
  const [isEditingBatch, setIsEditingBatch] = useState<boolean>(false);
  const [batchStartDate, setBatchStartDate] = useState<string>("");
  const [batchEndDate, setBatchEndDate] = useState<string>("");
  const [batchAmount, setBatchAmount] = useState<number>(0);

  // State for users
  const [users, setUsers] = useState<any[]>([]);
  // Selected employee (must be declared before use)
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  // Derive current company id from prop or session
  const currentCompanyId = useMemo(() => {
    if (user && typeof user.companyId === "number") return user.companyId;
    try {
      const sessionUserStr = localStorage.getItem("sessionUser");
      if (sessionUserStr) {
        const su = JSON.parse(sessionUserStr);
        if (su && typeof su.company_id === "number") return su.company_id;
      }
    } catch {}
    return undefined as number | undefined;
  }, [user]);

  // Only show employees from the same company as current user
  const usersForFilter = useMemo(() => {
    if (!Array.isArray(users)) return [] as any[];
    if (currentCompanyId == null) return users;
    return users.filter((u) => {
      const cid = typeof u.company_id === "number" ? u.company_id : u.companyId;
      return cid === currentCompanyId;
    });
  }, [users, currentCompanyId]);

  // Ensure selected user stays within the filtered list
  useEffect(() => {
    if (!selectedUserId) return;
    const exists = usersForFilter.some((u) => String(u.id) === String(selectedUserId));
    if (!exists) setSelectedUserId("");
  }, [usersForFilter, selectedUserId]);

  // State for sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAdminControl =
    user?.role === UserRole.SuperAdmin || user?.role === UserRole.AdminControl;

  const [dashboardStats, setDashboardStats] = useState({
    totalCalls: 0,
    answeredCalls: 0,
    totalMinutes: 0,
    avgMinutes: 0,
  });
  const [employeeSummary, setEmployeeSummary] = useState<any[]>([]);
  const [dailySeries, setDailySeries] = useState<
    { date: string; count: number; total_minutes: number }[]
  >([]);
  const [talkSummary, setTalkSummary] = useState<{
    talked: number;
    not_talked: number;
  }>({ talked: 0, not_talked: 0 });

  // Function to fetch dashboard stats
  const fetchDashboardStats = async () => {
    try {
      const userParam = selectedUserId
        ? `&user_id=${encodeURIComponent(selectedUserId)}`
        : "";
      const response = await fetch(
        `${import.meta.env.BASE_URL}api/Onecall_DB/get_dashboard_stats.php?month=${month}&year=${year}${userParam}`,
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        setDashboardStats(data.data);
      } else {
        console.error("Failed to fetch dashboard stats:", data.error);
      }
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    }
  };

  const fetchEmployeeSummary = async () => {
    try {
      const userParam = selectedUserId
        ? `&user_id=${encodeURIComponent(selectedUserId)}`
        : "";
      const resp = await fetch(
        `${import.meta.env.BASE_URL}api/Onecall_DB/get_employee_summary.php?month=${month}&year=${year}${userParam}`,
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data && data.success && Array.isArray(data.data)) {
        setEmployeeSummary(data.data);
      } else {
        setEmployeeSummary([]);
      }
    } catch (e) {
      console.error("get_employee_summary", e);
      setEmployeeSummary([]);
    }
  };

  // Fetch daily aggregated series (full month)
  const fetchDailySeries = async () => {
    try {
      const userParam = selectedUserId
        ? `&user_id=${encodeURIComponent(selectedUserId)}`
        : "";
      const resp = await fetch(
        `${import.meta.env.BASE_URL}api/Onecall_DB/get_daily_calls.php?month=${month}&year=${year}${userParam}`,
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data && data.success && Array.isArray(data.data)) {
        setDailySeries(data.data);
      } else {
        setDailySeries([]);
      }
    } catch (e) {
      console.error("Error fetching daily series:", e);
      setDailySeries([]);
    }
  };

  // Fetch talked vs not-talked summary (duration >= 40 is talked)
  const fetchTalkSummary = async () => {
    try {
      const userParam = selectedUserId
        ? `&user_id=${encodeURIComponent(selectedUserId)}`
        : "";
      const resp = await fetch(
        `${import.meta.env.BASE_URL}api/Onecall_DB/get_talk_summary.php?month=${month}&year=${year}${userParam}`,
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data && data.success && data.data) {
        setTalkSummary({
          talked: data.data.talked || 0,
          not_talked: data.data.not_talked || 0,
        });
      } else {
        setTalkSummary({ talked: 0, not_talked: 0 });
      }
    } catch (e) {
      console.error("Error fetching talk summary:", e);
      setTalkSummary({ talked: 0, not_talked: 0 });
    }
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) =>
    String(i + 1).padStart(2, "0"),
  );
  const yearOptions = [
    String(new Date().getFullYear()),
    String(new Date().getFullYear() - 1),
  ];

  // Function to handle update button click
  const handleUpdateClick = async () => {
    if (!startDate || !endDate) {
      alert("กรุณาเลือกช่วงวันที่");
      return;
    }

    setIsLoading(true);

    try {
      const result = await fetchRecordingsData(startDate, endDate);

      if (result.success && result.data) {
        setResultCount(result.data.resultCount || 0);
        setAccessToken(result.token || "");
        setShowModal(true);
      } else {
        alert("ไม่สามารถดึงข้อมูลได้: " + result.error);
      }
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการดึงข้อมูล: " + error.message);
    } finally {
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
      const batchResult = await saveBatchToDatabase(
        startDate,
        endDate,
        resultCount,
      );

      if (!batchResult.success) {
        alert("ไม่สามารถบันทึกข้อมูล Batch: " + batchResult.error);
        setIsSaving(false);
        return;
      }

      const batchId = batchResult.batchId;

      // Step 2: Fetch and save log data in batches of 1000
      let page = 1;
      const pageSize = 1000;
      let totalSaved = 0;

      while (totalSaved < resultCount) {
        // Format dates for API
        const formatDateForAPI = (
          dateString: string,
          isEndDate: boolean = false,
        ) => {
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
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const day = String(date.getDate()).padStart(2, "0");
          const hours = String(date.getHours()).padStart(2, "0");
          const minutes = String(date.getMinutes()).padStart(2, "0");
          const seconds = String(date.getSeconds()).padStart(2, "0");

          return `${year}${month}${day}_${hours}${minutes}${seconds}`;
        };

        const startDateFormatted = formatDateForAPI(startDate);
        const endDateFormatted = formatDateForAPI(endDate, true);

        // Build URL parameters
        const params = new URLSearchParams();
        params.append("range", "custom");
        params.append("startdate", startDateFormatted);
        params.append("enddate", endDateFormatted);
        params.append("sort", "");
        params.append("page", page.toString());
        params.append("pagesize", "1000");
        params.append("maxresults", "-1");
        params.append("includetags", "true");
        params.append("includemetadata", "true");
        params.append("includeprograms", "true");

        const searchUrl = `${import.meta.env.BASE_URL}onecall/orktrack/rest/recordings?${params.toString()}`;

        const response = await fetch(searchUrl, {
          method: "GET",
          headers: {
            Authorization: accessToken,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseText = await response.text();

        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch (e) {
          responseData = responseText;
        }

        if (responseData && responseData.objects) {
          // Transform data for database
          const logs = responseData.objects.map((obj: any) => {
            const transformed = {
              id: obj.id,
              timestamp: obj.timestamp,
              duration: obj.duration,
              localParty: obj.localParty,
              remoteParty: obj.remoteParty,
              direction: obj.direction,
              phone_telesale: obj.userDto?.firstname || "",
              batch_id: batchId,
            };

            return transformed;
          });

          // Save logs to database
          const logResult = await saveLogToDatabase(logs, batchId);

          if (!logResult.success) {
            alert("ไม่สามารถบันทึกข้อมูล Log: " + logResult.error);
            setIsSaving(false);
            return;
          }

          // Log duplicate information if available
          if (logResult.duplicates && logResult.duplicates.count > 0) {
            console.log(`=== Duplicate logs found ===`);
            console.log(`Total duplicates: ${logResult.duplicates.count}`);
            console.log(
              `Duplicate IDs: ${logResult.duplicates.ids.join(", ")}`,
            );

            // Log detailed comparison for each duplicate
            logResult.duplicates.details.forEach((duplicate: any) => {
              console.log(`=== Duplicate ID: ${duplicate.id} ===`);
              console.log(`Request data:`, duplicate.request_data);
              console.log(`Database data:`, duplicate.database_data);

              // Compare specific fields
              const requestData = duplicate.request_data;
              const dbData = duplicate.database_data;

              console.log(`Field comparison:`);
              console.log(
                `  - timestamp: Request=${requestData.timestamp}, DB=${dbData.timestamp}, Match=${requestData.timestamp === dbData.timestamp}`,
              );
              console.log(
                `  - duration: Request=${requestData.duration}, DB=${dbData.duration}, Match=${requestData.duration === dbData.duration}`,
              );
              console.log(
                `  - localParty: Request=${requestData.localParty}, DB=${dbData.localParty}, Match=${requestData.localParty === dbData.localParty}`,
              );
              console.log(
                `  - remoteParty: Request=${requestData.remoteParty}, DB=${dbData.remoteParty}, Match=${requestData.remoteParty === dbData.remoteParty}`,
              );
              console.log(
                `  - direction: Request=${requestData.direction}, DB=${dbData.direction}, Match=${requestData.direction === dbData.direction}`,
              );
              console.log(
                `  - phone_telesale: Request=${requestData.phone_telesale}, DB=${dbData.phone_telesale}, Match=${requestData.phone_telesale === dbData.phone_telesale}`,
              );
            });
          }

          totalSaved += logs.length;
          setSaveProgress(totalSaved);
          page++;
        } else {
          break;
        }
      }

      alert("บันทึกข้อมูลสำเร็จ");
      setShowModal(false);
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Function to fetch batches
  const fetchBatches = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}api/Onecall_DB/onecall_batch_crud.php`,
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        setBatches(data.data || []);
      } else {
        console.error("Failed to fetch batches:", data.error);
      }
    } catch (error) {
      console.error("Error fetching batches:", error);
    }
  };

  // Function to fetch users with telesale and supervisor roles
  const fetchUsers = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}api/Onecall_DB/get_users.php`,
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        // Map role values to UserRole enum
        const mappedUsers = (data.data || []).map((user: any) => {
          let mappedRole = user.role;

          // Map 'Supervisor Telesale' to UserRole.Supervisor
          if (user.role === "Supervisor Telesale") {
            mappedRole = UserRole.Supervisor;
          }

          return {
            ...user,
            role: mappedRole,
          };
        });

        setUsers(mappedUsers);
      } else {
        console.error("Failed to fetch users:", data.error);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  // Function to delete batch
  const deleteBatch = async (batchId: number) => {
    if (
      !confirm("คุณต้องการลบข้อมูลนี้และข้อมูลที่เกี่ยวข้องทั้งหมดใช่หรือไม่?")
    ) {
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}api/Onecall_DB/onecall_batch_crud.php?id=${batchId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        alert("ลบข้อมูลสำเร็จ");
        fetchBatches();
      } else {
        alert("ไม่สามารถลบข้อมูลได้: " + data.error);
      }
    } catch (error) {
      console.error("Error deleting batch:", error);
      alert("เกิดข้อผิดพลาดในการลบข้อมูล: " + error.message);
    }
  };

  // Function to open batch modal for editing
  const openEditBatchModal = (batch: any) => {
    setSelectedBatch(batch);
    setBatchStartDate(batch.startdate);
    setBatchEndDate(batch.enddate);
    setBatchAmount(batch.amount_record);
    setIsEditingBatch(true);
    setShowBatchModal(true);
  };

  // Function to open batch modal for creating
  const openCreateBatchModal = () => {
    setSelectedBatch(null);
    setBatchStartDate("");
    setBatchEndDate("");
    setBatchAmount(0);
    setIsEditingBatch(false);
    setShowBatchModal(true);
  };

  // Function to save batch (create or update)
  const saveBatch = async () => {
    if (!batchStartDate || !batchEndDate || batchAmount <= 0) {
      alert("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    try {
      const requestData = {
        startdate: batchStartDate,
        enddate: batchEndDate,
        amount_record: batchAmount,
      };

      const url =
        isEditingBatch && selectedBatch
          ? `${import.meta.env.BASE_URL}api/Onecall_DB/onecall_batch_crud.php?id=${selectedBatch.id}`
          : `${import.meta.env.BASE_URL}api/Onecall_DB/onecall_batch_crud.php`;

      const method = isEditingBatch ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        alert(isEditingBatch ? "อัปเดตข้อมูลสำเร็จ" : "สร้างข้อมูลสำเร็จ");
        setShowBatchModal(false);
        fetchBatches();
      } else {
        alert("ไม่สามารถบันทึกข้อมูลได้: " + data.error);
      }
    } catch (error) {
      console.error("Error saving batch:", error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + error.message);
    }
  };

  // Fetch batches and users on component mount
  useEffect(() => {
    fetchBatches();
    fetchUsers();
  }, []);

  // Update dashboard stats when component mounts or when month/year changes
  useEffect(() => {
    if (month && year) {
      fetchDashboardStats();
      fetchEmployeeSummary();
      fetchDailySeries();
      fetchTalkSummary();
    }
  }, [month, year, selectedUserId]);

  // Handle Onecall login
  const handleOnecallLogin = (username: string, password: string) => {
    console.log("Onecall login successful:", {
      username: username,
      password: "***",
    });

    // You can add additional logic here after successful login
    // For example, store the token, update state, etc.
    alert("เข้าสู่ระบบ Onecall สำเร็จ");
  };

  return (
    <>
      {/* Fixed Sidebar Toggle Button (restricted) */}
      {isAdminControl && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed right-0 top-1/2 transform -translate-y-1/2 z-40 bg-blue-600 text-white p-3 rounded-l-lg shadow-lg hover:bg-blue-700 transition-all duration-300 flex items-center justify-center"
          title="จัดการข้อมูล OneCall"
          style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {/* Off-canvas Sidebar (restricted) */}
      {isAdminControl && (
        <div
          className={`fixed inset-0 z-50 ${sidebarOpen ? "" : "pointer-events-none"}`}
        >
          <div
            className={`fixed inset-0 z-50 ${sidebarOpen ? "" : "pointer-events-none"}`}
          >
            {/* Backdrop */}
            <div
              className={`absolute inset-0 bg-black bg-opacity-50 transition-opacity ${sidebarOpen ? "opacity-100" : "opacity-0"}`}
              onClick={() => setSidebarOpen(false)}
            />

            {/* Sidebar */}
            <div
              className={`absolute right-0 top-0 h-full w-96 bg-white shadow-xl transform transition-transform ${sidebarOpen ? "translate-x-0" : "translate-x-full"}`}
            >
              {/* Sidebar Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-700">
                  จัดการข้อมูล OneCall
                </h3>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sidebar Content */}
              <div className="p-4 overflow-y-auto h-full pb-20">
                {/* Date Range Selection */}
                <div className="bg-gray-50 border rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="w-5 h-5 text-gray-500" />
                    <h3 className="text-lg font-semibold text-gray-700">
                      อัปเดตข้อมูล OneCall
                    </h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        วันที่เริ่มต้น
                      </label>
                      <CustomDatePicker
                        value={startDate}
                        onChange={(date) => setStartDate(date)}
                        batches={batches}
                        placeholder="เลือกวันที่เริ่มต้น"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        วันที่สิ้นสุด
                      </label>
                      <CustomDatePicker
                        value={endDate}
                        onChange={(date) => setEndDate(date)}
                        batches={batches}
                        placeholder="เลือกวันที่สิ้นสุด"
                        minDate={startDate}
                        disabled={!startDate}
                      />
                    </div>
                    <div>
                      <button
                        onClick={handleUpdateClick}
                        disabled={!startDate || !endDate || isLoading}
                        className={`w-full border rounded-md px-3 py-2 text-sm flex items-center justify-center gap-2 ${
                          !startDate || !endDate || isLoading
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-blue-600 text-white hover:bg-blue-700"
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

                {/* Batch Management Table */}
                <div className="bg-gray-50 border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-md font-semibold text-gray-700">
                      ข้อมูล Batch
                    </h3>
                  </div>
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-gray-500">
                        <tr>
                          <th className="py-2 px-2 font-medium text-xs">ID</th>
                          <th className="py-2 px-2 font-medium text-xs">
                            วันที่เริ่ม
                          </th>
                          <th className="py-2 px-2 font-medium text-xs">
                            วันที่สิ้นสุด
                          </th>
                          <th className="py-2 px-2 font-medium text-xs">
                            รายการ
                          </th>
                          <th className="py-2 px-2 font-medium text-xs">
                            จัดการ
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {batches.length > 0 ? (
                          batches.map((batch) => (
                            <tr key={batch.id} className="border-t">
                              <td className="py-2 px-2 text-xs">{batch.id}</td>
                              <td className="py-2 px-2 text-xs">
                                {batch.startdate}
                              </td>
                              <td className="py-2 px-2 text-xs">
                                {batch.enddate}
                              </td>
                              <td className="py-2 px-2 text-xs">
                                {batch.amount_record}
                              </td>
                              <td className="py-2 px-2">
                                <button
                                  onClick={() => deleteBatch(batch.id)}
                                  className="text-red-600 hover:text-red-800 text-xs"
                                >
                                  ลบ
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr className="border-t">
                            <td className="py-2 px-2 text-xs" colSpan={5}>
                              ไม่มีข้อมูล
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Onecall Login Sidebar Component */}
      <OnecallLoginSidebar currentUser={user} onLogin={handleOnecallLogin} />

      <div className="p-6">
        {/* Filters (layout only) */}
        <div className="bg-white border rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">เดือน</label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
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
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                พนักงาน
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="">ทั้งหมด</option>
                {usersForFilter.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstname} {user.lastname} ({user.role})
                  </option>
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

        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <StatCard
            title="จำนวนสายทั้งหมด"
            value={dashboardStats.totalCalls.toString()}
            subtext="ช่วงนี้"
            icon={Phone}
          />
          <StatCard
            title="รับสาย"
            value={dashboardStats.answeredCalls.toString()}
            subtext="ช่วงนี้"
            icon={PhoneIncoming}
          />
          <StatCard
            title="เวลาสนทนา (นาที)"
            value={dashboardStats.totalMinutes.toString()}
            subtext="รวม"
            icon={Clock3}
          />
          <StatCard
            title="เฉลี่ยต่อสาย (นาที)"
            value={dashboardStats.avgMinutes.toFixed(2)}
            subtext="ต่อวันทำการ"
            icon={UsersIcon}
          />
        </div>

        {/* Daily line chart (Full month) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <LineChart
            title="Daily Calls (Full Month)"
            yLabel="Calls"
            data={(dailySeries && dailySeries.length ? dailySeries : []).map(
              (d) => ({
                label: d.date.substring(0, 10),
                value: d.count || 0,
              }),
            )}
            color="#34D399"
            xTickEvery={7}
            height={220}
          />
          <PieChart
            title="ได้คุย vs ไม่ได้คุย"
            data={[
              {
                label: "ได้คุย (>=40s)",
                value: talkSummary.talked,
                color: "#34D399",
              },
              {
                label: "ไม่ได้คุย (<40s)",
                value: talkSummary.not_talked,
                color: "#E5E7EB",
              },
            ]}
            size={260}
          />
        </div>

        {/* Removed employee summary grid as requested */}
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              ยืนยันการอัปเดตข้อมูล
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              พบข้อมูลทั้งหมด{" "}
              <span className="font-semibold text-blue-600">{resultCount}</span>{" "}
              รายการ ในช่วงวันที่ {startDate} ถึง {endDate}
            </p>

            {!isSaving ? (
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowModal(false);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={() => {
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
