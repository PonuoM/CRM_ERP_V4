export const formatThaiAddressPart = (
  part: string,
  type: 'subdistrict' | 'district' | 'province',
  provinceName: string
): string => {
  if (!part) return '';

  let cleanedPart = part.trim();
  
  // Clean existing prefixes to avoid duplication
  if (type === 'subdistrict') {
    cleanedPart = cleanedPart.replace(/^(ต\.|ตำบล|แขวง)\s*/i, '');
  } else if (type === 'district') {
    cleanedPart = cleanedPart.replace(/^(อ\.|อำเภอ|เขต)\s*/i, '');
  } else if (type === 'province') {
    cleanedPart = cleanedPart.replace(/^(จ\.|จังหวัด)\s*/i, '');
  }

  if (!cleanedPart) return '';

  const isBangkok = provinceName.includes('กรุงเทพ');

  switch (type) {
    case 'subdistrict':
      return isBangkok ? `แขวง${cleanedPart}` : `ตำบล${cleanedPart}`;
    case 'district':
      return isBangkok ? `เขต${cleanedPart}` : `อำเภอ${cleanedPart}`;
    case 'province':
      // Always add prefix except if Bangkok
      return isBangkok ? `กรุงเทพมหานคร` : `จังหวัด${cleanedPart}`;
    default:
      return cleanedPart;
  }
};

export const formatFullThaiAddress = (
  street?: string | null,
  subdistrict?: string | null,
  district?: string | null,
  province?: string | null,
  postalCode?: string | null
): string => {
  const parts: string[] = [];
  const prov = province || '';

  if (street?.trim()) {
    parts.push(street.trim());
  }
  
  if (subdistrict?.trim()) {
    parts.push(formatThaiAddressPart(subdistrict, 'subdistrict', prov));
  }

  if (district?.trim()) {
    parts.push(formatThaiAddressPart(district, 'district', prov));
  }

  if (prov.trim()) {
    parts.push(formatThaiAddressPart(prov, 'province', prov));
  }

  if (postalCode?.trim()) {
    parts.push(postalCode.trim());
  }

  return parts.length > 0 ? parts.join(', ') : '-';
};
