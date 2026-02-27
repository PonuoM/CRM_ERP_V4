import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { User, UserRole } from "@/types";
import { Role } from "@/services/roleApi";
import {
    Phone,
    PhoneIncoming,
    PhoneOff,
    Clock,
    Timer,
    Coffee,
    Calendar,
    ChevronDown,
    RefreshCw,
    TrendingUp,
    TrendingDown,
} from "lucide-react";
import resolveApiBasePath from "@/utils/apiBasePath";

// ===== OneCall API Integration =====

// Authenticate with OneCall API
const authenticateOneCall = async () => {
    const loginUrl = `${import.meta.env.BASE_URL}onecall/orktrack/rest/user/login?version=orktrack&accesspolicy=all&licenseinfo=true`;

    try {
        const sessionUserStr = localStorage.getItem("sessionUser");
        if (!sessionUserStr) {
            return { success: false, error: "No session user found" };
        }

        const sessionUser = JSON.parse(sessionUserStr);
        const companyId = sessionUser.company_id;

        const usernameKey = `ONECALL_USERNAME_${companyId}`;
        const passwordKey = `ONECALL_PASSWORD_${companyId}`;

        const apiBase = resolveApiBasePath();
        const [usernameRes, passwordRes] = await Promise.all([
            fetch(`${apiBase}/Marketing_DB/get_env.php?key=${usernameKey}`, {
                headers: { "Content-Type": "application/json" },
            }),
            fetch(`${apiBase}/Marketing_DB/get_env.php?key=${passwordKey}`, {
                headers: { "Content-Type": "application/json" },
            }),
        ]);

        if (!usernameRes.ok || !passwordRes.ok) {
            return { success: false, error: "Failed to fetch OneCall credentials" };
        }

        const usernameData = await usernameRes.json();
        const passwordData = await passwordRes.json();

        if (!usernameData.success || !passwordData.success) {
            return { success: false, error: "OneCall credentials not found" };
        }

        const username = usernameData.value?.replace(/^\"|\"$/g, "");
        const password = passwordData.value?.replace(/^\"|\"$/g, "");

        if (!username || !password) {
            return { success: false, error: "OneCall credentials are empty" };
        }

        const authString = `${username}:${password}`;
        const base64Auth = btoa(authString);

        const response = await fetch(loginUrl, {
            method: "POST",
            headers: {
                Accept: "application/json",
                Authorization: `Basic ${base64Auth}`,
            },
        });

        if (!response.ok) {
            return { success: false, error: `HTTP Error: ${response.status}` };
        }

        const responseData = await response.json();
        const token = responseData?.accesstoken;

        return { success: true, token, data: responseData };
    } catch (error: any) {
        console.error("OneCall auth error:", error);
        return { success: false, error: error.message || "Authentication failed" };
    }
};

// Fetch talk time data from OneCall API
const fetchTalkTimeFromAPI = async (date: string, userPhone?: string) => {
    try {
        const authResult = await authenticateOneCall();
        if (!authResult.success || !authResult.token) {
            return { success: false, error: authResult.error };
        }

        // Format date for API (YYYYMMDD_HHMMSS format, UTC-7)
        const formatDateForAPI = (dateString: string, isEndDate: boolean = false) => {
            const date = new Date(dateString);
            if (isEndDate) {
                date.setHours(23, 59, 59, 999);
            } else {
                date.setHours(0, 0, 0, 0);
            }
            date.setHours(date.getHours() - 7); // Convert to UTC

            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            const hours = String(date.getHours()).padStart(2, "0");
            const minutes = String(date.getMinutes()).padStart(2, "0");
            const seconds = String(date.getSeconds()).padStart(2, "0");

            return `${year}${month}${day}_${hours}${minutes}${seconds}`;
        };

        const startDateFormatted = formatDateForAPI(date);
        const endDateFormatted = formatDateForAPI(date, true);

        const params = new URLSearchParams({
            range: "custom",
            startdate: startDateFormatted,
            enddate: endDateFormatted,
            sort: "",
            page: "1",
            pagesize: "10000",  // Increased to get all recordings for the day
            maxresults: "-1",
            includetags: "true",
            includemetadata: "true",
            includeprograms: "true",
        });

        const searchUrl = `${import.meta.env.BASE_URL}onecall/orktrack/rest/recordings?${params.toString()}`;

        const response = await fetch(searchUrl, {
            method: "GET",
            headers: {
                Authorization: authResult.token,
                Accept: "application/json",
            },
        });

        if (!response.ok) {
            return { success: false, error: `HTTP error! status: ${response.status}` };
        }

        const responseData = await response.json();
        const recordings = responseData.objects || [];  // Changed from 'recordings' to 'objects'

        console.log(`📞 OneCall API returned ${recordings.length} recordings (total: ${responseData.resultCount || 0})`);

        // Filter by user phone if specified
        let filteredRecordings = recordings;
        if (userPhone) {
            // Try multiple phone formats for matching
            const phoneFormats = [
                userPhone,                          // 66812345678
                `+${userPhone}`,                    // +66812345678
                userPhone.replace(/^66/, '0'),      // 0812345678
            ];

            filteredRecordings = recordings.filter((r: any) => {
                const localMatch = phoneFormats.some(format =>
                    r.localParty === format || r.localParty?.replace(/\+/g, '') === userPhone
                );
                const remoteMatch = phoneFormats.some(format =>
                    r.remoteParty === format || r.remoteParty?.replace(/\+/g, '') === userPhone
                );
                return localMatch || remoteMatch;
            });

            console.log(`🔍 Filtered to ${filteredRecordings.length} recordings for phone ${userPhone}`);
            console.log(`📊 Sample phone formats from API:`, recordings.slice(0, 5).map((r: any) => ({
                localParty: r.localParty,
                remoteParty: r.remoteParty
            })));
            console.log(`🔎 Phone formats we're matching:`, phoneFormats);
        }

        // Process to hourly format
        const hourlyData = processRecordingsToHourly(filteredRecordings);
        const summary = calculateSummary(filteredRecordings);

        return { success: true, hourly: hourlyData, summary };
    } catch (error: any) {
        console.error("OneCall API fetch error:", error);
        return { success: false, error: error.message || "Failed to fetch data" };
    }
};

// Process recordings to hourly format
const processRecordingsToHourly = (recordings: any[]) => {
    const hourlyMap: Record<number, { total: number; talked: number; totalSeconds: number }> = {};

    // Initialize all 24 hours
    for (let h = 0; h < 24; h++) {
        hourlyMap[h] = { total: 0, talked: 0, totalSeconds: 0 };
    }

    // Process each recording
    recordings.forEach((rec: any) => {
        // Parse timestamp and convert to Thailand time (UTC+7)
        const timestamp = new Date(rec.timestamp);
        // Add 7 hours to convert UTC to Thailand time
        timestamp.setHours(timestamp.getHours() + 7);
        const hour = timestamp.getHours();
        const duration = parseInt(rec.duration) || 0;

        hourlyMap[hour].total++;
        hourlyMap[hour].totalSeconds += duration;
        if (duration >= 40) {
            hourlyMap[hour].talked++;
        }
    });

    // Convert to array format
    return Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        label: `${String(h).padStart(2, "0")}:00-${String((h + 1) % 24).padStart(2, "0")}:00`,
        total_calls: hourlyMap[h].total,
        talked_calls: hourlyMap[h].talked,
        total_minutes: Math.round((hourlyMap[h].totalSeconds / 60) * 100) / 100,
        avg_minutes: hourlyMap[h].total > 0
            ? Math.round((hourlyMap[h].totalSeconds / hourlyMap[h].total / 60) * 100) / 100
            : 0,
    }));
};

// Calculate summary statistics
const calculateSummary = (recordings: any[]) => {
    const totalCalls = recordings.length;
    const talkedCalls = recordings.filter((r: any) => (parseInt(r.duration) || 0) >= 40).length;
    const totalSeconds = recordings.reduce((sum: number, r: any) => sum + (parseInt(r.duration) || 0), 0);
    const talkedSeconds = recordings
        .filter((r: any) => (parseInt(r.duration) || 0) >= 40)
        .reduce((sum: number, r: any) => sum + (parseInt(r.duration) || 0), 0);

    // Calculate idle time (gaps between calls)
    const sortedRecordings = [...recordings].sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let totalIdleSeconds = 0;
    let idleCount = 0;
    for (let i = 1; i < sortedRecordings.length; i++) {
        const gap = (new Date(sortedRecordings[i].timestamp).getTime() -
            new Date(sortedRecordings[i - 1].timestamp).getTime()) / 1000;
        if (gap > 0 && gap < 3000) { // Max 50 minutes gap (excludes lunch/after-work)
            totalIdleSeconds += gap;
            idleCount++;
        }
    }

    return {
        total_calls: totalCalls,
        talked_calls: talkedCalls,
        total_minutes: Math.round((totalSeconds / 60) * 100) / 100,
        avg_minutes: totalCalls > 0 ? Math.round((totalSeconds / totalCalls / 60) * 100) / 100 : 0,
        avg_talk_minutes: talkedCalls > 0 ? Math.round((talkedSeconds / talkedCalls / 60) * 100) / 100 : 0,
        avg_idle_minutes: idleCount > 0 ? Math.round((totalIdleSeconds / idleCount / 60) * 100) / 100 : 0,
    };
};

// ===== End OneCall API Integration =====

interface TalkTimeDashboardProps {
    user?: User;
}

interface HourlyData {
    hour: number;
    label: string;
    total_calls: number;
    talked_calls: number;
    total_minutes: number;
    avg_minutes: number;
}

interface SummaryData {
    total_calls: number;
    talked_calls: number;
    total_minutes: number;
    avg_minutes: number;
    avg_talk_minutes: number;
    avg_idle_minutes: number;
}

interface TeamUser {
    id: number;
    name: string;
    phone: string;
    role: string;
}

// Custom Stat Card for Talk Time
const TalkTimeStatCard: React.FC<{
    title: string;
    value: React.ReactNode;
    subtitle: string;
    icon: React.ReactNode;
    color: "blue" | "green" | "yellow" | "purple" | "orange" | "red";
    trend?: { value: number; isUp: boolean };
    tooltip?: string;
}> = ({ title, value, subtitle, icon, color, trend, tooltip }) => {
    const iconColorClasses = {
        blue: "text-blue-600 bg-blue-100",
        green: "text-green-600 bg-green-100",
        yellow: "text-yellow-600 bg-yellow-100",
        purple: "text-purple-600 bg-purple-100",
        orange: "text-orange-600 bg-orange-100",
        red: "text-red-600 bg-red-100",
    };

    const textColorClasses = {
        blue: "text-blue-600",
        green: "text-green-600",
        yellow: "text-yellow-600",
        purple: "text-purple-600",
        orange: "text-orange-600",
        red: "text-red-600",
    };

    return (
        <div className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm group relative overflow-hidden">
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-500 truncate">{title}</p>
                    <div className="mt-1 flex items-baseline gap-1 flex-wrap">
                        <span className={`text-xl sm:text-2xl font-bold ${textColorClasses[color]}`}>{value}</span>
                        <span className="text-xs text-gray-400 whitespace-nowrap">{subtitle}</span>
                    </div>
                    {trend && (
                        <div className={`flex items-center gap-1 mt-1 text-xs ${trend.isUp ? "text-green-600" : "text-red-600"}`}>
                            {trend.isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            <span>{trend.value.toFixed(1)}%</span>
                        </div>
                    )}
                </div>
                <div className={`p-2 rounded-lg flex-shrink-0 ${iconColorClasses[color]}`}>
                    {icon}
                </div>
            </div>

            {/* Tooltip */}
            {tooltip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
                    <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl max-w-xs">
                        {tooltip}
                        {/* Arrow */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                            <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const TalkTimeDashboard: React.FC<TalkTimeDashboardProps> = ({ user }) => {
    const apiBase = useMemo(() => resolveApiBasePath(), []);

    // State
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const now = new Date();
        return now.toISOString().split("T")[0];
    });
    const [selectedUserId, setSelectedUserId] = useState<string>("");
    const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
    const [summary, setSummary] = useState<SummaryData | null>(null);
    const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Ref to prevent duplicate API calls
    const fetchingRef = useRef(false);

    // Derive user info
    const currentUserId = user?.id;
    const currentCompanyId = useMemo(() => {
        if (user && typeof user.companyId === "number") return user.companyId;
        try {
            const sessionUserStr = localStorage.getItem("sessionUser");
            if (sessionUserStr) {
                const su = JSON.parse(sessionUserStr);
                if (su?.company_id) return su.company_id;
            }
        } catch { }
        return null;
    }, [user]);

    const userRole = user?.role || "";
    // Check if user has system access based on role
    // Super Admin, Admin Control, and CEO have is_system = 1
    const isSystem = userRole === UserRole.SuperAdmin ||
        userRole === UserRole.AdminControl ||
        userRole === UserRole.CEO ||
        String(userRole) === "Super Admin" ||
        String(userRole) === "Admin Control" ||
        String(userRole) === "CEO" ||
        String(userRole).toLowerCase() === "ceo";
    const isSupervisor = userRole === UserRole.Supervisor || String(userRole) === "Supervisor Telesale";
    const isTelesale = userRole === UserRole.Telesale || String(userRole) === "Telesale";

    // Can select other users?
    const canSelectUsers = isSystem || isSupervisor;

    // Fetch team users for dropdown
    useEffect(() => {
        if (!currentUserId || !currentCompanyId) return;

        const fetchTeamUsers = async () => {
            try {
                const params = new URLSearchParams({
                    user_id: String(currentUserId),
                    company_id: String(currentCompanyId),
                    role: String(userRole),
                    is_system: isSystem ? "1" : "0",
                });

                const res = await fetch(`${apiBase}/Onecall_DB/get_team_users.php?${params}`);
                const data = await res.json();

                if (data.success) {
                    setTeamUsers(data.users || []);
                    // Default to current user
                    if (!selectedUserId && data.users?.length > 0) {
                        setSelectedUserId(String(currentUserId));
                    }
                }
            } catch (err) {
                console.error("Failed to fetch team users:", err);
            }
        };

        fetchTeamUsers();
    }, [currentUserId, currentCompanyId, userRole, isSystem, apiBase]);

    // Cache configuration
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    // Generate unique cache key per user + date
    const getCacheKey = useCallback(() => {
        const userId = selectedUserId || String(currentUserId);
        return `talktime_cache_${currentCompanyId}_${userId}_${selectedDate}`;
    }, [currentCompanyId, selectedUserId, currentUserId, selectedDate]);

    // Load from cache helper
    const loadFromCache = useCallback(() => {
        try {
            const cacheKey = getCacheKey();
            const cached = localStorage.getItem(cacheKey);
            if (!cached) return false;

            const { data, timestamp } = JSON.parse(cached);

            // Check if cache is still valid (within 5 minutes)
            const isValid = Date.now() - timestamp < CACHE_DURATION;

            if (isValid && data) {
                console.log(`✅ Loading from cache (age: ${Math.round((Date.now() - timestamp) / 1000)}s)`);
                setHourlyData(data.hourly || []);
                setSummary(data.summary || null);
                return true; // Cache hit
            }
        } catch (err) {
            console.error("Cache load error:", err);
        }
        return false; // Cache miss
    }, [getCacheKey]);

    // Save to cache helper
    const saveToCache = useCallback((hourly: HourlyData[], summaryData: SummaryData | null) => {
        try {
            const cacheKey = getCacheKey();
            localStorage.setItem(cacheKey, JSON.stringify({
                data: { hourly, summary: summaryData },
                timestamp: Date.now()
            }));
            console.log(`💾 Saved to cache: ${cacheKey}`);
        } catch (err) {
            console.error("Cache save error:", err);
        }
    }, [getCacheKey]);

    // Fetch talk time data - HYBRID APPROACH
    const fetchData = async () => {
        // Prevent duplicate calls
        if (fetchingRef.current) {
            console.log("⏭️ Skipping duplicate fetch call");
            return;
        }

        fetchingRef.current = true;
        setIsLoading(true);
        setError(null);

        try {
            // Calculate days difference
            const selectedDateObj = new Date(selectedDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            selectedDateObj.setHours(0, 0, 0, 0);
            const daysDiff = Math.floor((today.getTime() - selectedDateObj.getTime()) / (1000 * 60 * 60 * 24));

            console.log(`📅 Date selected: ${selectedDate}, Days ago: ${daysDiff}`);

            // Determine data source
            const useAPI = daysDiff < 15;
            console.log(`🔄 Data source: ${useAPI ? "OneCall API (recent)" : "Database (historical)"}`);

            if (useAPI) {
                // ===== USE ONECALL API =====
                console.log("📞 Fetching from OneCall API...");

                // Get user phone for filtering (if not System user AND specific user selected)
                let userPhone: string | undefined;
                // Only filter by user if:
                // 1. Not a system user (system users can see all when "All" is selected), OR
                // 2. A specific user is selected (not empty string)
                const shouldFilterByUser = !isSystem || (selectedUserId && selectedUserId !== "");

                if (shouldFilterByUser) {
                    const userId = selectedUserId || String(currentUserId);
                    if (userId && userId !== "") {
                        // Get phone from teamUsers array (already fetched) instead of API call
                        const selectedUser = teamUsers.find(u => String(u.id) === userId);
                        if (selectedUser && selectedUser.phone) {
                            // Normalize phone to 66XXXXXXXXX format
                            userPhone = selectedUser.phone.replace(/^0/, "66");
                            console.log(`🔍 Filtering by phone: ${userPhone} (user: ${selectedUser.name})`);
                        } else {
                            console.warn(`⚠️ No phone found for user ${userId}`);
                            // For non-system users (Telesale), if no phone found, show empty data
                            if (!isSystem) {
                                console.log("🚫 Telesale user without phone - returning empty data");
                                setSummary({
                                    total_calls: 0,
                                    talked_calls: 0,
                                    total_minutes: 0,
                                    avg_minutes: 0,
                                    avg_talk_minutes: 0,
                                    avg_idle_minutes: 0,
                                });
                                setHourlyData([]);
                                return; // Exit early
                            }
                        }
                    }
                } else {
                    console.log("📊 Showing all users data (no phone filter)");
                }

                const apiResult = await fetchTalkTimeFromAPI(selectedDate, userPhone);

                if (apiResult.success) {
                    setSummary(apiResult.summary);
                    setHourlyData(apiResult.hourly || []);
                    saveToCache(apiResult.hourly || [], apiResult.summary);
                    console.log("✅ OneCall API data loaded successfully");
                } else {
                    console.warn("⚠️ OneCall API failed, falling back to database...");
                    // Fallback to database
                    await fetchFromDatabase();
                }
            } else {
                // ===== USE DATABASE =====
                await fetchFromDatabase();
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Network error";
            setError(message);
            console.error("❌ Talk time fetch error:", err);
        } finally {
            setIsLoading(false);
            fetchingRef.current = false; // Reset to allow next fetch
        }
    };

    // Fetch from database (fallback or historical data)
    const fetchFromDatabase = async () => {
        console.log("💾 Fetching from Database...");

        const params = new URLSearchParams({
            date: selectedDate,
        });

        if (currentCompanyId) {
            params.append("company_id", String(currentCompanyId));
        }

        params.append("is_system", isSystem ? "1" : "0");

        if (selectedUserId) {
            params.append("user_id", selectedUserId);
        } else if (currentUserId) {
            params.append("user_id", String(currentUserId));
        }

        const res = await fetch(`${apiBase}/Onecall_DB/get_talktime_hourly.php?${params}`);
        const data = await res.json();

        if (data.success) {
            setSummary(data.summary);
            setHourlyData(data.hourly || []);
            saveToCache(data.hourly || [], data.summary);
            console.log("✅ Database data loaded successfully");
        } else {
            setError(data.error || "Failed to load data from database");
        }
    };

    useEffect(() => {
        if (currentUserId) {
            // Try to load from cache first
            if (!loadFromCache()) {
                // Cache miss - fetch from server
                fetchData();
            }
        }
    }, [selectedDate, selectedUserId, currentUserId, loadFromCache]);

    // Manual refresh handler
    const handleManualRefresh = () => {
        console.log("🔄 Manual refresh triggered");
        // Clear cache for current selection
        const cacheKey = getCacheKey();
        localStorage.removeItem(cacheKey);
        // Fetch new data
        fetchData();
    };

    // Find max for chart scaling
    const maxCalls = useMemo(() => {
        if (!hourlyData.length) return 10;
        return Math.max(...hourlyData.map((h) => h.total_calls), 10);
    }, [hourlyData]);

    return (
        <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">แดชบอร์ด Talk Time</h1>
                    <p className="text-sm text-gray-500">สถิติการโทรประจำวัน</p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Date Picker */}
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border shadow-sm">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent outline-none text-sm"
                        />
                    </div>

                    {/* User Selector (for Supervisor and System users) */}
                    {canSelectUsers && (
                        <div className="relative">
                            <select
                                value={selectedUserId}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setSelectedUserId(value);
                                    console.log(`👤 User selected: ${value === "" ? "All" : value}`);
                                }}
                                className="appearance-none bg-white px-4 py-2 pr-8 rounded-lg border shadow-sm text-sm outline-none cursor-pointer"
                            >
                                {/* Add "All Users" option for System users and Supervisors */}
                                <option value="">ทั้งหมด (All Users)</option>
                                {teamUsers.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                    )}

                    {/* Refresh Button */}
                    <button
                        onClick={handleManualRefresh}
                        disabled={isLoading}
                        className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        title="รีเฟรชข้อมูล"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}

            {/* Loading Overlay */}
            {isLoading && (
                <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 shadow-xl flex flex-col items-center gap-3">
                        <RefreshCw className="w-8 h-8 text-green-600 animate-spin" />
                        <p className="text-gray-700 font-medium">กำลังโหลดข้อมูล...</p>
                    </div>
                </div>
            )}

            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <TalkTimeStatCard
                    title="จำนวนการรับสาย"
                    value={summary?.total_calls || 0}
                    subtitle="(สาย)"
                    icon={<Phone className="w-5 h-5" />}
                    color="blue"
                />
                <TalkTimeStatCard
                    title="จำนวนสายที่ได้คุย"
                    value={summary?.talked_calls || 0}
                    subtitle="(สาย)"
                    icon={<PhoneIncoming className="w-5 h-5" />}
                    color="green"
                />
                <TalkTimeStatCard
                    title="ระยะเวลาการสนทนา"
                    value={summary?.total_minutes?.toFixed(2) || "0.00"}
                    subtitle="(นาที)"
                    icon={<Clock className="w-5 h-5" />}
                    color="yellow"
                />
                <TalkTimeStatCard
                    title="ค่าเฉลี่ยระยะเวลาสนทนา"
                    value={summary?.avg_talk_minutes?.toFixed(2) || "0.00"}
                    subtitle="(นาที)"
                    icon={<Timer className="w-5 h-5" />}
                    color="purple"
                />
                <TalkTimeStatCard
                    title="เวลาพักระหว่างสาย"
                    value={summary?.avg_idle_minutes?.toFixed(2) || "0.00"}
                    subtitle="(นาที)"
                    icon={<Coffee className="w-5 h-5" />}
                    color="orange"
                    tooltip="ค่าเฉลี่ยเวลาว่างระหว่างการโทรแต่ละครั้ง (ไม่รวมช่วงพักเที่ยงและหลังเลิกงาน)"
                />
                <TalkTimeStatCard
                    title="สายที่ไม่ได้คุย"
                    value={(summary?.total_calls || 0) - (summary?.talked_calls || 0)}
                    subtitle="(สาย)"
                    icon={<PhoneOff className="w-5 h-5" />}
                    color="red"
                />
            </div>

            {/* Hourly Chart */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">สถิติรายชั่วโมง</h2>

                {/* Legend */}
                <div className="flex items-center gap-6 mb-4 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-500 rounded"></div>
                        <span>สายที่ได้คุย</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-500 rounded"></div>
                        <span>สายที่ไม่ได้คุย</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-amber-100 rounded"></div>
                        <span>ระยะเวลาสนทนา (นาที)</span>
                    </div>
                </div>

                {/* Chart */}
                <div className="relative">
                    <div className="min-w-[800px] overflow-x-auto overflow-y-visible pb-20">
                        {/* Y-axis markers */}
                        <div className="flex items-end gap-1 h-64 relative overflow-visible">
                            {/* Y-axis labels */}
                            <div className="absolute left-0 top-0 bottom-8 w-8 flex flex-col justify-between text-xs text-gray-400">
                                <span>{maxCalls}</span>
                                <span>{Math.floor(maxCalls / 2)}</span>
                                <span>0</span>
                            </div>

                            {/* Bars */}
                            <div className="ml-10 flex-1 flex items-end gap-1">
                                {hourlyData
                                    .filter((h) => h.hour >= 6 && h.hour <= 23) // Show only 06:00-23:00
                                    .map((h) => {
                                        const notTalked = h.total_calls - h.talked_calls;
                                        const talkedHeight = (h.talked_calls / maxCalls) * 200;
                                        const notTalkedHeight = (notTalked / maxCalls) * 200;
                                        const minutesHeight = (h.total_minutes / (maxCalls * 2)) * 200;

                                        return (
                                            <div key={h.hour} className="flex-1 flex flex-col items-center group relative">
                                                {/* Bars container - using relative positioning for layering */}
                                                <div className="relative flex items-end justify-center h-52 w-full">
                                                    {/* Background bar: Total Minutes (Amber/Cream) - wider */}
                                                    <div
                                                        className="absolute bottom-0 w-12 bg-amber-100/70 rounded-t transition-all group-hover:bg-amber-200/80"
                                                        style={{ height: `${minutesHeight}px` }}
                                                    ></div>

                                                    {/* Foreground bars container - centered on top of background */}
                                                    <div className="relative flex items-end gap-1 z-10">
                                                        {/* Talked calls (Green) */}
                                                        <div
                                                            className="w-6 bg-green-500 rounded-t transition-all group-hover:bg-green-600"
                                                            style={{ height: `${talkedHeight}px` }}
                                                        ></div>
                                                        {/* Not talked (Red) */}
                                                        <div
                                                            className="w-6 bg-red-500 rounded-t transition-all group-hover:bg-red-600"
                                                            style={{ height: `${notTalkedHeight}px` }}
                                                        ></div>
                                                    </div>
                                                </div>

                                                {/* X-axis label */}
                                                <span className="text-[10px] text-gray-500 mt-2">
                                                    {h.label.split("-")[0]}
                                                </span>

                                                {/* Tooltip - positioned to the right side */}
                                                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden group-hover:block z-50 pointer-events-none">
                                                    <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl">
                                                        <div className="font-medium mb-1">{h.label}</div>
                                                        <div>รับสาย: {h.total_calls} สาย</div>
                                                        <div>ได้คุย: {h.talked_calls} สาย</div>
                                                        <div>เวลา: {h.total_minutes.toFixed(1)} นาที</div>
                                                        {/* Arrow pointing left */}
                                                        <div className="absolute right-full top-1/2 -translate-y-1/2 mr-px">
                                                            <div className="w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-gray-900"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>

                        {/* X-axis label */}
                        <div className="text-center text-sm text-gray-500 mt-4">ช่วงเวลา</div>
                    </div>
                </div>
            </div>

            {/* Current User Info */}
            {!canSelectUsers && (
                <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
                    <strong>หมายเหตุ:</strong> คุณกำลังดูข้อมูลของตัวเองเท่านั้น
                </div>
            )}
        </div>
    );
};

export default TalkTimeDashboard;
