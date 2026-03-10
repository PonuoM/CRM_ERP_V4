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
    ChevronLeft,
    ChevronRight,
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

        const username = usernameData.value?.replace(/^"|"$/g, "");
        const password = passwordData.value?.replace(/^"|"$/g, "");

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
const fetchTalkTimeFromAPI = async (date: string, userPhones?: string[]) => {
    try {
        const authResult = await authenticateOneCall();
        if (!authResult.success || !authResult.token) {
            return { success: false, error: authResult.error };
        }

        // Format date for API (YYYYMMDD_HHMMSS format, UTC-7)
        const formatDateForAPI = (dateString: string, isEndDate: boolean = false) => {
            const dateObj = new Date(dateString);
            if (isEndDate) {
                dateObj.setHours(23, 59, 59, 999);
            } else {
                dateObj.setHours(0, 0, 0, 0);
            }
            dateObj.setHours(dateObj.getHours() - 7); // Convert to UTC

            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, "0");
            const day = String(dateObj.getDate()).padStart(2, "0");
            const hours = String(dateObj.getHours()).padStart(2, "0");
            const minutes = String(dateObj.getMinutes()).padStart(2, "0");
            const seconds = String(dateObj.getSeconds()).padStart(2, "0");

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
        const recordings = responseData.objects || [];

        console.log(`📞 OneCall API returned ${recordings.length} recordings`);

        // Filter by user phones if specified
        let filteredRecordings = recordings;
        if (userPhones && userPhones.length > 0) {
            // Try multiple phone formats for matching all phones
            const allPhoneFormats = userPhones.flatMap(phone => [
                phone,                          // 66812345678
                `+${phone}`,                    // +66812345678
                phone.replace(/^66/, '0'),      // 0812345678
            ]);

            filteredRecordings = recordings.filter((r: any) => {
                const localPartyRaw = r.localParty || '';
                const localPartyNoPlus = localPartyRaw.replace(/\+/g, '');
                const remotePartyRaw = r.remoteParty || '';
                const remotePartyNoPlus = remotePartyRaw.replace(/\+/g, '');

                const localMatch = allPhoneFormats.includes(localPartyRaw) || allPhoneFormats.includes(localPartyNoPlus);
                const remoteMatch = allPhoneFormats.includes(remotePartyRaw) || allPhoneFormats.includes(remotePartyNoPlus);

                return localMatch || remoteMatch;
            });
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

interface DailyMonthData {
    date: string;
    total_calls: number;
    connected_calls: number;
    talked_calls: number;
    missed_calls: number;
    total_minutes: number;
    avg_minutes: number;
    answer_rate: number;
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
    const [teamUsersLoaded, setTeamUsersLoaded] = useState(false);
    const [summary, setSummary] = useState<SummaryData | null>(null);
    const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
    const [monthlyData, setMonthlyData] = useState<DailyMonthData[]>([]);
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
        if (!currentUserId || !currentCompanyId) {
            setTeamUsersLoaded(true);
            return;
        }

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
            } finally {
                setTeamUsersLoaded(true);
            }
        };

        fetchTeamUsers();
    }, [currentUserId, currentCompanyId, userRole, isSystem, apiBase]);

    // Cache configuration
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    // One-time cleanup: clear all old talktime cache entries on mount
    // This prevents stale data from old cache key format being served
    useEffect(() => {
        try {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith("talktime_cache_")) {
                    keysToRemove.push(key);
                }
            }
            if (keysToRemove.length > 0) {
                keysToRemove.forEach(key => localStorage.removeItem(key));
                console.log(`🧹 Cleared ${keysToRemove.length} old talktime cache entries`);
            }
        } catch { }
    }, []); // Run once on mount

    // Generate unique cache key per user + date
    const getCacheKey = useCallback(() => {
        const userId = selectedUserId || (isSystem ? "all" : String(currentUserId));
        return `talktime_cache_${currentCompanyId}_${userId}_${selectedDate}`;
    }, [currentCompanyId, selectedUserId, currentUserId, selectedDate, isSystem]);

    // Load from cache helper
    const loadFromCache = useCallback(() => {
        try {
            const cacheKey = getCacheKey();
            const cached = localStorage.getItem(cacheKey);
            if (!cached) return false;

            const { data, timestamp } = JSON.parse(cached);

            // Check if cache is still valid (within 5 minutes)
            const isValid = Date.now() - timestamp < CACHE_DURATION;

            // Skip cache if data is empty (0 calls) — force fresh fetch
            const hasData = data?.summary?.total_calls > 0 || (data?.monthly?.length > 0);

            if (isValid && data && hasData) {
                console.log(`✅ Loading from cache (age: ${Math.round((Date.now() - timestamp) / 1000)}s)`);
                setHourlyData(data.hourly || []);
                setSummary(data.summary || null);
                setMonthlyData(data.monthly || []);
                return true; // Cache hit
            }

            // Remove stale or empty cache entry
            if (!isValid || !hasData) {
                localStorage.removeItem(cacheKey);
            }
        } catch (err) {
            console.error("Cache load error:", err);
        }
        return false; // Cache miss
    }, [getCacheKey]);

    // Save to cache helper
    const saveToCache = useCallback((hourly: HourlyData[], summaryData: SummaryData | null, monthly: DailyMonthData[]) => {
        try {
            const cacheKey = getCacheKey();
            localStorage.setItem(cacheKey, JSON.stringify({
                data: { hourly, summary: summaryData, monthly },
                timestamp: Date.now()
            }));
            console.log(`💾 Saved to cache: ${cacheKey}`);
        } catch (err) {
            console.error("Cache save error:", err);
        }
    }, [getCacheKey]);

    // Fetch talk time data
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
            const params = new URLSearchParams({
                date: selectedDate,
            });

            if (currentCompanyId) {
                params.append("company_id", String(currentCompanyId));
            }

            params.append("is_system", isSystem ? "1" : "0");

            if (selectedUserId) {
                params.append("user_id", selectedUserId);
            } else if (currentUserId && !isSystem) {
                // Only auto-send current user's ID for non-system users (Telesale/Supervisor)
                // System users with empty selectedUserId = "All Users" → don't filter
                params.append("user_id", String(currentUserId));
            }

            // Always fetch monthly data from DB in parallel
            const monthlyPromise = fetch(`${apiBase}/Onecall_DB/get_talktime_daily_month.php?${params}`).then(res => res.json());

            let hourlyDataRes: any = { success: false, error: "Not run" };

            // Check if selected date is today (in local timezone)
            const d = new Date();
            const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const isToday = selectedDate === todayStr;

            if (isToday) {
                console.log("📞 Fetching today's data from OneCall API directly...");
                let userPhones: string[] | undefined;
                const shouldFilterByUser = !isSystem || (selectedUserId && selectedUserId !== "");

                if (shouldFilterByUser) {
                    const userId = selectedUserId || String(currentUserId);
                    if (userId && userId !== "") {
                        if (selectedUserId === "") {
                            // "All Users" selected by a Supervisor (isSystem is false)
                            // We need to fetch ALL phones of their team from teamUsers
                            const phones = teamUsers
                                .map(u => u.phone)
                                .filter(p => p != null && p.trim() !== "")
                                .map(p => p.replace(/^0/, "66"));

                            if (phones.length > 0) {
                                userPhones = phones;
                                console.log(`🔍 Filtering by team phones: ${phones.length} users`);
                            } else {
                                console.log("🚫 Supervisor's team has no phones - returning empty data");
                                hourlyDataRes = {
                                    success: true,
                                    summary: { total_calls: 0, talked_calls: 0, total_minutes: 0, avg_minutes: 0, avg_talk_minutes: 0, avg_idle_minutes: 0 },
                                    hourly: []
                                };
                            }
                        } else {
                            // Specific user selected
                            const selectedUser = teamUsers.find(u => String(u.id) === userId);
                            if (selectedUser && selectedUser.phone) {
                                userPhones = [selectedUser.phone.replace(/^0/, "66")];
                                console.log(`🔍 Filtering by phone: ${userPhones[0]} (user: ${selectedUser.name})`);
                            } else if (!isSystem) {
                                console.log("🚫 Telesale user without phone - returning empty data");
                                hourlyDataRes = {
                                    success: true,
                                    summary: { total_calls: 0, talked_calls: 0, total_minutes: 0, avg_minutes: 0, avg_talk_minutes: 0, avg_idle_minutes: 0 },
                                    hourly: []
                                };
                            }
                        }
                    }
                }

                // If not early exited, fetch from API
                if (!hourlyDataRes.success && hourlyDataRes.error === "Not run") {
                    const apiResult = await fetchTalkTimeFromAPI(selectedDate, userPhones);
                    if (apiResult.success) {
                        hourlyDataRes = { success: true, summary: apiResult.summary, hourly: apiResult.hourly };
                        console.log("✅ OneCall API data loaded successfully");
                    } else {
                        console.warn("⚠️ OneCall API failed, falling back to database...", apiResult.error);
                        hourlyDataRes = await fetch(`${apiBase}/Onecall_DB/get_talktime_hourly.php?${params}`).then(res => res.json());
                    }
                }
            } else {
                console.log("💾 Fetching historical data from Database...");
                hourlyDataRes = await fetch(`${apiBase}/Onecall_DB/get_talktime_hourly.php?${params}`).then(res => res.json());
            }

            const monthlyDataRes = await monthlyPromise;

            if (hourlyDataRes.success && monthlyDataRes.success) {
                setSummary(hourlyDataRes.summary);
                setHourlyData(hourlyDataRes.hourly || []);
                setMonthlyData(monthlyDataRes.data || []);
                saveToCache(hourlyDataRes.hourly || [], hourlyDataRes.summary, monthlyDataRes.data || []);
                console.log("✅ Data loaded successfully");
            } else {
                setError(hourlyDataRes.error || monthlyDataRes.error || "Failed to load data");
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

    useEffect(() => {
        if (currentUserId && teamUsersLoaded) {
            // Try to load from cache first
            if (!loadFromCache()) {
                // Cache miss - fetch from server
                fetchData();
            }
        }
    }, [selectedDate, selectedUserId, currentUserId, loadFromCache, teamUsersLoaded]);

    // Manual refresh handler
    const handleManualRefresh = () => {
        console.log("🔄 Manual refresh triggered");
        // Clear cache for current selection
        const cacheKey = getCacheKey();
        localStorage.removeItem(cacheKey);
        // Fetch new data
        fetchData();
    };

    // Date Navigation
    const handlePrevDay = () => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() - 1);
        // Correctly handle local vs UTC timezone string conversion
        const prevDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        setSelectedDate(prevDateStr);
    };

    const handleNextDay = () => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + 1);
        const nextDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        setSelectedDate(nextDateStr);
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
                    <div className="flex items-center gap-1 bg-white px-1 py-1 rounded-lg border shadow-sm">
                        <button
                            onClick={handlePrevDay}
                            className="p-1 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                            title="วันก่อนหน้า (Previous Day)"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-2 px-2 border-x border-gray-200">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent outline-none text-sm cursor-pointer"
                            />
                        </div>

                        <button
                            onClick={handleNextDay}
                            className="p-1 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                            title="วันถัดไป (Next Day)"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
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

            {/* Monthly Summary Table */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden mt-6">
                <div className="p-4 sm:p-6 border-b border-gray-100 bg-white">
                    <h2 className="text-lg font-semibold text-gray-900">สรุปข้อมูลการโทรรายวัน (ตลอดเดือน {new Date(selectedDate).toLocaleString('th-TH', { month: 'long', year: 'numeric' })})</h2>
                    <p className="text-sm text-gray-500 mt-1">ภาพรวมการทำงานในแต่ละวันภายในเดือนที่เลือก</p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left align-middle whitespace-nowrap">
                        <thead className="text-xs text-gray-700 bg-gray-50 uppercase border-b">
                            <tr>
                                <th scope="col" className="px-5 py-4 font-semibold text-gray-900 border-r w-32">วันที่</th>
                                <th scope="col" className="px-5 py-4 font-semibold text-gray-900 border-r w-32">วัน</th>
                                <th scope="col" className="px-5 py-4 font-semibold text-center text-gray-900">สาย<span className="text-xs text-gray-500 font-normal ml-1">(ทั้งหมด)</span></th>
                                <th scope="col" className="px-5 py-4 font-semibold text-center text-orange-600" title="เวลาทั้งหมดของทุกสายที่โทร">นาที</th>
                                <th scope="col" className="px-5 py-4 font-semibold text-center text-emerald-600">รับสาย</th>
                                <th scope="col" className="px-5 py-4 font-semibold text-center text-blue-600" title="รับสายและคุยตั้งแต่ 40 วินาทีขึ้นไป">ได้คุย <span className="text-xs text-gray-500 font-normal ml-1">(≥40วิ)</span></th>
                                <th scope="col" className="px-5 py-4 font-semibold text-center text-red-500">ไม่ได้รับ</th>
                                <th scope="col" className="px-5 py-4 font-semibold text-center text-gray-900">% รับสาย</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {monthlyData.length > 0 ? (
                                monthlyData.map((row) => {
                                    // Make weekend rows stand out slightly
                                    const dateObj = new Date(row.date);
                                    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

                                    return (
                                        <tr
                                            key={row.date}
                                            className={`hover:bg-gray-50 transition-colors group ${isWeekend ? 'bg-orange-50/20' : ''} ${row.date === selectedDate ? 'bg-blue-50/40 text-blue-900' : ''}`}
                                        >
                                            <td className="px-5 py-3 border-r font-medium text-gray-900">
                                                {row.date === selectedDate ? (
                                                    <span className="flex items-center gap-2">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                        {dateObj.toLocaleDateString("en-GB")}
                                                    </span>
                                                ) : (
                                                    dateObj.toLocaleDateString("en-GB")
                                                )}
                                            </td>
                                            <td className="px-5 py-3 border-r text-gray-600">
                                                {dateObj.toLocaleDateString("th-TH", { weekday: 'long' })}
                                            </td>
                                            <td className="px-5 py-3 text-center text-gray-700">{row.total_calls > 0 ? row.total_calls.toLocaleString() : '-'}</td>
                                            <td className="px-5 py-3 text-center text-gray-700">{row.total_minutes > 0 ? row.total_minutes.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}</td>
                                            <td className="px-5 py-3 text-center text-emerald-600 font-medium">{row.connected_calls > 0 ? row.connected_calls.toLocaleString() : '-'}</td>
                                            <td className="px-5 py-3 text-center font-medium text-blue-600">{row.talked_calls > 0 ? row.talked_calls.toLocaleString() : '-'}</td>
                                            <td className="px-5 py-3 text-center text-red-500">{row.missed_calls > 0 ? row.missed_calls.toLocaleString() : '-'}</td>
                                            <td className="px-5 py-3 text-center">
                                                {row.total_calls > 0 ? (
                                                    <span className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-medium ${row.answer_rate >= 80 ? 'bg-emerald-100 text-emerald-700' : row.answer_rate >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                                        {row.answer_rate}%
                                                    </span>
                                                ) : '-'}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={8} className="px-5 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <PhoneOff className="w-8 h-8 text-gray-300" />
                                            <span>ไม่มีข้อมูลการโทรในเดือนนี้</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>

                        {/* Footer (Total Row) */}
                        {monthlyData.length > 0 && (
                            <tfoot className="bg-gray-100/80 font-bold border-t border-gray-200">
                                <tr>
                                    <td colSpan={2} className="px-5 py-4 border-r text-gray-900 text-right">รวมทั้งเดือน</td>
                                    <td className="px-5 py-4 text-center text-gray-900">{monthlyData.reduce((sum, r) => sum + r.total_calls, 0).toLocaleString()}</td>
                                    <td className="px-5 py-4 text-center text-gray-900">{monthlyData.reduce((sum, r) => sum + r.total_minutes, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                    <td className="px-5 py-4 text-center text-emerald-600 font-black">{monthlyData.reduce((sum, r) => sum + r.connected_calls, 0).toLocaleString()}</td>
                                    <td className="px-5 py-4 text-center text-blue-600 font-black">{monthlyData.reduce((sum, r) => sum + r.talked_calls, 0).toLocaleString()}</td>
                                    <td className="px-5 py-4 text-center text-red-600">{monthlyData.reduce((sum, r) => sum + r.missed_calls, 0).toLocaleString()}</td>
                                    <td className="px-5 py-4 text-center text-gray-900">
                                        {(() => {
                                            const total = monthlyData.reduce((sum, r) => sum + r.total_calls, 0);
                                            const connected = monthlyData.reduce((sum, r) => sum + r.connected_calls, 0);
                                            return total > 0 ? (
                                                <span className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-medium ${(connected / total * 100) >= 80 ? 'bg-emerald-100 text-emerald-700' : (connected / total * 100) >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                                    {(connected / total * 100).toFixed(2)}%
                                                </span>
                                            ) : '-';
                                        })()}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
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
