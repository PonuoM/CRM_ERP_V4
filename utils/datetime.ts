/**
 * Timezone utility functions for handling Thailand (UTC+7) datetime correctly
 * 
 * Problem: datetime-local inputs don't include timezone info, causing 7-hour shift
 * when using toISOString() which converts to UTC
 * 
 * Solution: These utilities maintain local Thailand time throughout the conversion process
 */

/**
 * Convert ISO string from database to datetime-local format for input value
 * @param isoString ISO datetime string from database (e.g., "2025-11-28T19:55:00")
 * @returns datetime-local format string (e.g., "2025-11-28T19:55")
 */
export function toLocalDatetimeString(isoString: string | undefined | null): string {
    if (!isoString) return '';

    try {
        // Parse the ISO string
        const date = new Date(isoString);

        // Check if valid date
        if (isNaN(date.getTime())) return '';

        // Format as YYYY-MM-DDTHH:mm for datetime-local input
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (error) {
        console.error('Error converting datetime to local string:', error);
        return '';
    }
}

/**
 * Convert datetime-local input value to ISO string for database storage
 * Important: This preserves the local time without converting to UTC
 * @param localString datetime-local format string (e.g., "2025-11-28T19:55")
 * @returns ISO string maintaining local time (e.g., "2025-11-28T19:55:00")
 */
export function fromLocalDatetimeString(localString: string): string {
    if (!localString) return '';

    try {
        // Parse the local datetime string
        const date = new Date(localString);

        // Check if valid date
        if (isNaN(date.getTime())) return '';

        // Format as ISO string but maintaining local time (not converting to UTC)
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    } catch (error) {
        console.error('Error converting local string to datetime:', error);
        return '';
    }
}

/**
 * Format datetime for display in Thai format
 * @param isoString ISO datetime string
 * @returns Formatted string for display (e.g., "28/11/2025 19:55")
 */
export function formatThaiDateTime(isoString: string | undefined | null): string {
    if (!isoString) return '-';

    try {
        const date = new Date(isoString);

        if (isNaN(date.getTime())) return '-';

        // Format as DD/MM/YYYY HH:mm
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (error) {
        console.error('Error formatting Thai datetime:', error);
        return '-';
    }
}

/**
 * Get current datetime in datetime-local format
 * @returns Current datetime as YYYY-MM-DDTHH:mm
 */
export function getCurrentLocalDatetime(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Convert a Date object to an ISO-like string in Thailand timezone (UTC+7)
 * Used for sending dates to backend which expects Thai time in datetime fields
 * @param date optional Date object (default: now)
 * @returns string in format "YYYY-MM-DDTHH:mm:ss.sss" (Thai time)
 */
export function toThaiIsoString(date?: Date): string {
    const d = date ? new Date(date) : new Date();
    // Offset for Thailand is +7 hours = +25200000 ms
    // We want the string to represent Thai time, so we add 7 hours to UTC
    const thaiValues = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));

    const year = thaiValues.getFullYear();
    const month = String(thaiValues.getMonth() + 1).padStart(2, '0');
    const day = String(thaiValues.getDate()).padStart(2, '0');
    const hours = String(thaiValues.getHours()).padStart(2, '0');
    const minutes = String(thaiValues.getMinutes()).padStart(2, '0');
    const seconds = String(thaiValues.getSeconds()).padStart(2, '0');
    const ms = String(thaiValues.getMilliseconds()).padStart(3, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}`;
}
