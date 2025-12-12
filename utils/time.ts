export function getRemainingTimeRounded(expiryDate: string): { text: string; color: string } {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diff = expiry.getTime() - now.getTime();
  if (!isFinite(diff) || diff <= 0) {
    return { text: 'หมดอายุ', color: 'text-red-500' };
  }

  const dayMs = 1000 * 60 * 60 * 24;
  const daysExact = diff / dayMs;

  if (daysExact < 1) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return { text: `${hours} ชั่วโมง`, color: 'text-red-500 font-semibold' };
  }

  const displayDays = Math.ceil(daysExact); // round up so 90d shows as 90
  const color = daysExact < 5 ? 'text-orange-500 font-semibold' : 'text-gray-600';
  return { text: `${displayDays} วัน`, color };
}

/**
 * Format date and time string for Thailand timezone (UTC+7 / Asia/Bangkok)
 * @param dateString - ISO date string or date string from API
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date/time string in Thai locale with Asia/Bangkok timezone
 */
export function formatThaiDateTime(
  dateString: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateString) return "-";

  try {
    const date = dateString instanceof Date ? dateString : new Date(dateString);
    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
      dateStyle: options?.dateStyle || "short",
      timeStyle: options?.timeStyle || "medium",
      ...options,
    });
  } catch {
    return "-";
  }
}

/**
 * Format date only for Thailand timezone
 * Always returns dd/mm/yyyy format for consistency across all browsers
 * @param dateString - ISO date string or date string from API
 * @returns Formatted date string in dd/mm/yyyy format
 */
export function formatThaiDate(
  dateString: string | Date | null | undefined
): string {
  if (!dateString) return "-";

  try {
    const date = dateString instanceof Date ? dateString : new Date(dateString);
    if (Number.isNaN(date.getTime())) return "-";

    // Convert to Thailand timezone
    const thaiDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));

    // Format as dd/mm/yyyy
    const day = String(thaiDate.getDate()).padStart(2, '0');
    const month = String(thaiDate.getMonth() + 1).padStart(2, '0');
    const year = thaiDate.getFullYear();

    return `${day}/${month}/${year}`;
  } catch {
    return "-";
  }
}

/**
 * Format time only for Thailand timezone
 * @param dateString - ISO date string or date string from API
 * @returns Formatted time string in Thai locale with Asia/Bangkok timezone
 */
export function formatThaiTime(
  dateString: string | Date | null | undefined
): string {
  if (!dateString) return "-";

  try {
    const date = dateString instanceof Date ? dateString : new Date(dateString);
    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleTimeString("th-TH", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

