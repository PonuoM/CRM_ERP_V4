import { User } from '../types';

/**
 * Generate main order ID in format: yymmdd-xxxxxusernameสุ่ม2หลัก
 * Example: 251118-00001thanu3e
 * @param user - User object with username
 * @param companyId - Company ID for sequence
 * @returns Main order ID
 */
export const generateMainOrderId = async (user: User, companyId: number): Promise<string> => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePrefix = `${yy}${mm}${dd}`;
  const monthPrefix = `${yy}${mm}`;
  
  // Get sequence number for today (call API to get next sequence)
  const sequence = await getNextOrderSequence(datePrefix, companyId, monthPrefix);
  const sequenceStr = String(sequence).padStart(5, '0');
  
  // Use username instead of user ID
  const username = String(user.username || '').toLowerCase().replace(/\s+/g, '');
  
  // Generate random 2 characters (alphanumeric)
  const randomChars = Math.random().toString(36).substring(2, 4);
  
  // Format: yymmdd-xxxxxusernameสุ่ม2หลัก
  // Example: 251118-00001thanu3e (where thanu is user.username and 3e is random)
  const orderId = `${datePrefix}-${sequenceStr}${username}${randomChars}`;
  
  // Debug log
  console.log('Generated Order ID:', {
    datePrefix,
    sequence,
    sequenceStr,
    username,
    randomChars,
    orderId
  });
  
  return orderId;
};

/**
 * Get next order sequence number for a given date prefix
 * @param datePrefix - Date prefix (yymmdd)
 * @param companyId - Company ID
 * @returns Next sequence number
 */
const getNextOrderSequence = async (datePrefix: string, companyId: number, monthPrefix: string): Promise<number> => {
  try {
    const params = new URLSearchParams({
      datePrefix,
      companyId: String(companyId),
      period: 'month',
      monthPrefix,
    });
    const response = await fetch(`api/index.php/orders/sequence?${params.toString()}`);
    const data = await response.json();
    return data.sequence || 1;
  } catch (error) {
    console.error('Failed to get order sequence:', error);
    return 1; // Fallback to 1
  }
};

