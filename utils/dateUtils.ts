/**
 * Date utilities for CRM ERP V4
 * Reusable functions for Thai timezone handling and date formatting
 */

/**
 * Safely parse dates that might be in SQL format "YYYY-MM-DD HH:MM:SS"
 */
export const parseDateSafe = (dateStr: string | undefined | null | number): number => {
    if (!dateStr) return 0;
    if (typeof dateStr === "number") return dateStr;
    // Replace space with T for ISO compliance if it looks like SQL format
    const safeStr = dateStr.replace(" ", "T");
    const time = new Date(safeStr).getTime();
    return isNaN(time) ? 0 : time;
};

/**
 * Format date/time in Thailand timezone with CE year (ค.ศ.)
 */
export const formatThaiDateTime = (date: Date | undefined | null): string => {
    if (!date || Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("en-GB", {
        timeZone: "Asia/Bangkok",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

/**
 * Format date only in Thailand timezone with CE year (ค.ศ.)
 */
export const formatThaiDate = (date: Date | undefined | null): string => {
    if (!date || Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-GB", {
        timeZone: "Asia/Bangkok",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
};

/**
 * Get current time in Thailand timezone (UTC+7)
 */
export const getThailandNow = (): Date => {
    return new Date();
};

/**
 * Get midnight (00:00) of today in Thailand timezone
 */
export const getThailandMidnight = (): Date => {
    const now = new Date();
    const thaiDateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }); // YYYY-MM-DD format
    const midnight = new Date(thaiDateStr + "T00:00:00+07:00");
    return midnight;
};

/**
 * Calculate days until expiration
 */
export const getDaysUntilExpiration = (expireDate: string): number => {
    const now = new Date();
    const expiry = new Date(expireDate);
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

/**
 * Calculate days since a given date
 */
export const getDaysSince = (dateStr: string | undefined | null): number => {
    if (!dateStr) return Infinity;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return Infinity;
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
};

/**
 * Format relative time (e.g., "2 วันก่อน", "เมื่อสักครู่")
 */
export const formatRelativeTime = (date: Date | string | undefined | null): string => {
    if (!date) return "-";
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "-";

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHours === 0) {
            const diffMins = Math.floor(diffMs / (1000 * 60));
            if (diffMins < 5) return "เมื่อสักครู่";
            return `${diffMins} นาทีก่อน`;
        }
        return `${diffHours} ชั่วโมงก่อน`;
    }
    if (diffDays === 1) return "เมื่อวาน";
    if (diffDays < 7) return `${diffDays} วันก่อน`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} สัปดาห์ก่อน`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} เดือนก่อน`;
    return `${Math.floor(diffDays / 365)} ปีก่อน`;
};
