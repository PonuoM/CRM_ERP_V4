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

