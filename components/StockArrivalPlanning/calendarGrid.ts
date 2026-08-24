/**
 * ตารางปฏิทินรายเดือน (เริ่มวันจันทร์) — ใช้ร่วมกันระหว่างปฏิทินบนหน้าจอกับ Export Excel
 * เพื่อให้ทั้งสองที่แบ่งสัปดาห์/วันเติมหัวท้ายเดือนเหมือนกันเสมอ
 */

export interface CalendarCell {
  dateStr: string;
  isCurrentMonth: boolean;
}

export const WEEKDAY_NAMES_TH = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];

export const MONTH_NAMES_TH = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

/** แบ่งเดือนเป็นสัปดาห์ละ 7 ช่อง พร้อมเติมวันจากเดือนก่อน/ถัดไปให้สัปดาห์เต็ม */
export const buildMonthWeeks = (year: number, month: number): CalendarCell[][] => {
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();

  // getDay() -> Sun=0, Mon=1, ... ; เราต้องการ Mon=0, ..., Sun=6
  const startWeekday = (firstDayOfMonth.getDay() + 6) % 7;

  const cells: CalendarCell[] = [];

  // วันเติมจากเดือนก่อน
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = month === 1 ? 12 : month - 1;
    const y = month === 1 ? year - 1 : year;
    cells.push({
      dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      isCurrentMonth: false,
    });
  }

  // วันในเดือนปัจจุบัน
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      dateStr: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      isCurrentMonth: true,
    });
  }

  // วันเติมจากเดือนถัดไป
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    const m = month === 12 ? 1 : month + 1;
    const y = month === 12 ? year + 1 : year;
    cells.push({
      dateStr: `${y}-${String(m).padStart(2, '0')}-${String(nextDay++).padStart(2, '0')}`,
      isCurrentMonth: false,
    });
  }

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
};

/** ป้ายสัปดาห์จากวันจันทร์ของสัปดาห์นั้น -> { monthNo: 8, weekNo: 2 } = M8 W2 */
export const weekLabelOf = (mondayDateStr: string) => {
  const [, mMonth, mDay] = mondayDateStr.split('-').map(Number);
  return { monthNo: mMonth, weekNo: Math.floor((mDay - 1) / 7) + 1 };
};

/** ป้ายรายการในช่องปฏิทิน (ใช้ทั้งบนหน้าจอและใน Excel) */
export const calendarItemLabel = (
  name: string | number | null | undefined,
  qty: number | null | undefined,
) => `${name ?? ''} · ${qty ?? 0}`;
