// OneCall realtime API helper for Monitor pages.
// Mirrors the logic used by TalkTimeDashboard so today's data can be fetched
// live (call_import_logs only catches up overnight).

import resolveApiBasePath from "@/utils/apiBasePath";

interface OneCallRecording {
    timestamp: string;
    duration: string | number;
    localParty?: string;
    remoteParty?: string;
    direction?: string;
}

interface OneCallAuthResult {
    success: boolean;
    token?: string;
    error?: string;
}

const authenticateOneCall = async (): Promise<OneCallAuthResult> => {
    const loginUrl = `${import.meta.env.BASE_URL}onecall/orktrack/rest/user/login?version=orktrack&accesspolicy=all&licenseinfo=true`;
    try {
        const sessionUserStr = localStorage.getItem("sessionUser");
        if (!sessionUserStr) return { success: false, error: "No session user" };
        const sessionUser = JSON.parse(sessionUserStr);
        const companyId = sessionUser.company_id;

        const apiBase = resolveApiBasePath();
        const [userRes, passRes] = await Promise.all([
            fetch(`${apiBase}/Marketing_DB/get_env.php?key=ONECALL_USERNAME_${companyId}`, {
                headers: { "Content-Type": "application/json" },
            }),
            fetch(`${apiBase}/Marketing_DB/get_env.php?key=ONECALL_PASSWORD_${companyId}`, {
                headers: { "Content-Type": "application/json" },
            }),
        ]);
        if (!userRes.ok || !passRes.ok) return { success: false, error: "Failed to fetch credentials" };
        const userData = await userRes.json();
        const passData = await passRes.json();
        if (!userData.success || !passData.success) return { success: false, error: "Credentials missing" };

        const username = (userData.value || "").replace(/^"|"$/g, "");
        const password = (passData.value || "").replace(/^"|"$/g, "");
        if (!username || !password) return { success: false, error: "Empty credentials" };

        const res = await fetch(loginUrl, {
            method: "POST",
            headers: {
                Accept: "application/json",
                Authorization: `Basic ${btoa(`${username}:${password}`)}`,
            },
        });
        if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
        const body = await res.json();
        return { success: true, token: body?.accesstoken };
    } catch (e: any) {
        return { success: false, error: e?.message || "Auth failed" };
    }
};

const formatDateForOneCall = (dateStr: string, isEnd: boolean) => {
    const d = new Date(dateStr);
    if (isEnd) d.setHours(23, 59, 59, 999);
    else d.setHours(0, 0, 0, 0);
    d.setHours(d.getHours() - 7); // UTC offset
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${y}${m}${day}_${hh}${mm}${ss}`;
};

export interface OneCallFetchResult {
    success: boolean;
    error?: string;
    recordings?: OneCallRecording[];
}

export const fetchOneCallRecordings = async (date: string): Promise<OneCallFetchResult> => {
    const auth = await authenticateOneCall();
    if (!auth.success || !auth.token) return { success: false, error: auth.error };

    const params = new URLSearchParams({
        range: "custom",
        startdate: formatDateForOneCall(date, false),
        enddate: formatDateForOneCall(date, true),
        sort: "",
        page: "1",
        pagesize: "10000",
        maxresults: "-1",
        includetags: "true",
        includemetadata: "true",
        includeprograms: "true",
    });

    const url = `${import.meta.env.BASE_URL}onecall/orktrack/rest/recordings?${params}`;
    try {
        const res = await fetch(url, {
            method: "GET",
            headers: { Authorization: auth.token, Accept: "application/json" },
        });
        if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
        const data = await res.json();
        return { success: true, recordings: data.objects || [] };
    } catch (e: any) {
        return { success: false, error: e?.message || "Fetch failed" };
    }
};

// Normalize a phone for matching: strip + and leading 0/66 ambiguity.
const normalizePhone = (raw: string): string[] => {
    if (!raw) return [];
    const clean = String(raw).replace(/[^\d+]/g, "");
    const noPlus = clean.replace(/^\+/, "");
    const variants = new Set<string>();
    if (clean) variants.add(clean);
    if (noPlus) variants.add(noPlus);
    if (noPlus.startsWith("66")) variants.add("0" + noPlus.slice(2));
    if (noPlus.startsWith("0")) variants.add("66" + noPlus.slice(1));
    return Array.from(variants);
};

export interface MemberAccumulator {
    user_id: number;
    total_calls: number;
    connected_calls: number;
    talked_calls: number;
    total_seconds: number;
    morning_calls: number;
    afternoon_calls: number;
}

export interface AggregatedRealtime {
    team_totals: {
        total_calls: number;
        connected_calls: number;
        talked_calls: number;
        total_minutes: number;
        talk_rate: number;
        answer_rate: number;
        active_users: number;
    };
    hourly: Array<{
        hour: number;
        label: string;
        period: "morning" | "afternoon";
        total_calls: number;
        talked_calls: number;
    }>;
    members: Record<number, MemberAccumulator>;
}

// Build phone → user_id map and aggregate recordings by user/hour.
export const aggregateOneCallByUsers = (
    recordings: OneCallRecording[],
    users: { user_id: number; phone?: string }[],
): AggregatedRealtime => {
    const phoneToUser = new Map<string, number>();
    users.forEach((u) => {
        if (!u.phone) return;
        normalizePhone(u.phone).forEach((p) => phoneToUser.set(p, u.user_id));
    });

    const members: Record<number, MemberAccumulator> = {};
    const ensure = (uid: number): MemberAccumulator => {
        if (!members[uid]) {
            members[uid] = {
                user_id: uid,
                total_calls: 0,
                connected_calls: 0,
                talked_calls: 0,
                total_seconds: 0,
                morning_calls: 0,
                afternoon_calls: 0,
            };
        }
        return members[uid];
    };

    // Hourly 0..23
    const hourlyMap: Record<number, { total: number; talked: number }> = {};
    for (let h = 0; h < 24; h++) hourlyMap[h] = { total: 0, talked: 0 };

    const totals = {
        total_calls: 0,
        connected_calls: 0,
        talked_calls: 0,
        total_seconds: 0,
    };

    recordings.forEach((rec) => {
        // OneCall returns UTC; shift to Bangkok (+7)
        const ts = new Date(rec.timestamp);
        ts.setHours(ts.getHours() + 7);
        const hour = ts.getHours();
        const dur = parseInt(String(rec.duration), 10) || 0;
        const connected = dur > 0;
        // เกณฑ์ "สายที่ได้คุย": duration >= 30 วินาที
        const talked = dur >= 30;

        // Match to a user via phone
        const candidates: string[] = [];
        if (rec.localParty) candidates.push(...normalizePhone(rec.localParty));
        if (rec.remoteParty) candidates.push(...normalizePhone(rec.remoteParty));
        let matchedUid: number | null = null;
        for (const c of candidates) {
            const uid = phoneToUser.get(c);
            if (uid) {
                matchedUid = uid;
                break;
            }
        }

        if (matchedUid) {
            const m = ensure(matchedUid);
            m.total_calls += 1;
            if (connected) m.connected_calls += 1;
            if (talked) m.talked_calls += 1;
            m.total_seconds += dur;
            if (hour <= 12) m.morning_calls += 1;
            else m.afternoon_calls += 1;
        }

        // Team totals + hourly use all matched recordings (so unattributed calls
        // don't inflate per-user totals but still show in team aggregate).
        // Use matched only — unmatched are usually non-telesale traffic.
        if (matchedUid) {
            totals.total_calls += 1;
            if (connected) totals.connected_calls += 1;
            if (talked) totals.talked_calls += 1;
            totals.total_seconds += dur;
            hourlyMap[hour].total += 1;
            if (talked) hourlyMap[hour].talked += 1;
        }
    });

    const hourly = [];
    for (let h = 8; h <= 18; h++) {
        hourly.push({
            hour: h,
            label: `${String(h).padStart(2, "0")}:00`,
            period: (h <= 12 ? "morning" : "afternoon") as "morning" | "afternoon",
            total_calls: hourlyMap[h].total,
            talked_calls: hourlyMap[h].talked,
        });
    }

    const activeUsers = Object.values(members).filter((m) => m.total_calls > 0).length;
    return {
        team_totals: {
            total_calls: totals.total_calls,
            connected_calls: totals.connected_calls,
            talked_calls: totals.talked_calls,
            total_minutes: Math.round((totals.total_seconds / 60) * 10) / 10,
            talk_rate: totals.total_calls > 0 ? totals.talked_calls / totals.total_calls : 0,
            answer_rate: totals.total_calls > 0 ? totals.connected_calls / totals.total_calls : 0,
            active_users: activeUsers,
        },
        hourly,
        members,
    };
};

export const isToday = (dateStr: string): boolean => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return dateStr === `${y}-${m}-${day}`;
};
