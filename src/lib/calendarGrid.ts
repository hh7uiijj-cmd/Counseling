export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function dateKey(year: number, month1to12: number, day: number) {
  return `${year}-${pad2(month1to12)}-${pad2(day)}`;
}

/** Build a 6-week (42 cell) grid for the given year/month (1-12), starting on Sunday. */
export function buildMonthGrid(year: number, month1to12: number) {
  const monthIndex = month1to12 - 1;
  const firstOfMonth = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay(); // 0=Sun

  const cells: { key: string; day: number; inMonth: boolean }[] = [];

  // leading days from previous month
  const prevMonthDays = new Date(year, monthIndex, 0).getDate();
  for (let i = startWeekday - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const prevMonth = monthIndex === 0 ? 12 : month1to12 - 1;
    const prevYear = monthIndex === 0 ? year - 1 : year;
    cells.push({ key: dateKey(prevYear, prevMonth, day), day, inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ key: dateKey(year, month1to12, day), day, inMonth: true });
  }

  while (cells.length % 7 !== 0 || cells.length < 42) {
    const last = cells[cells.length - 1];
    const [y, m, d] = last.key.split("-").map(Number);
    const next = new Date(y, m - 1, d + 1);
    cells.push({
      key: dateKey(next.getFullYear(), next.getMonth() + 1, next.getDate()),
      day: next.getDate(),
      inMonth: false,
    });
    if (cells.length >= 42) break;
  }

  return cells;
}

export const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

export const THAI_WEEKDAYS_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

export function todayKey() {
  const now = new Date();
  return dateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
