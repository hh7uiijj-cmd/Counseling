const BKK_OFFSET = "+07:00";

/** Combine a YYYY-MM-DD date and HH:mm time into a UTC instant, assuming Asia/Bangkok (UTC+7). */
export function bangkokDateTime(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00${BKK_OFFSET}`);
}

/**
 * Represent a YYYY-MM-DD calendar date for a Prisma `@db.Date` column (Slot.date,
 * ClosedDate.date). These columns have no timezone, so the value must be built as
 * plain UTC midnight — NOT via `bangkokDateTime`, whose +07:00 offset lands on the
 * previous UTC day and gets stored one day early.
 */
export function dateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** Format a Date as YYYY-MM-DD in Asia/Bangkok. */
export function toDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Format a Date as HH:mm in Asia/Bangkok. */
export function toTimeKey(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function thaiDateLabel(dateStr: string): string {
  const date = bangkokDateTime(dateStr, "12:00");
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}
