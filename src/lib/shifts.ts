import { effectivePhotoUrl } from "@/lib/photos";
import { BookingStatus } from "@/generated/prisma/enums";
import { buildMentionTextMessage, pushMessageToGroup } from "@/lib/line";
import { SEATS_PER_SHIFT, slotCounselorLabel, slotMembers } from "@/lib/counselors";
import { thaiDateLabel, toDateKey, toTimeKey } from "@/lib/dates";

type Person = { id: string; name: string; lineUserId: string | null };

export type ShiftSlot = {
  id: string;
  date: Date;
  startsAt: Date;
  endsAt: Date;
  counselorId: string | null;
  partnerId: string | null;
  counselor: Person | null;
  partner: Person | null;
  booking?: { status: BookingStatus } | null;
};

/** Is this counselor sitting one of the shift's two seats? */
export function isMember(slot: { counselorId: string | null; partnerId: string | null }, counselorId: string) {
  return slot.counselorId === counselorId || slot.partnerId === counselorId;
}

/** Which seat column a counselor holds on a shift, if any. */
export function seatOf(slot: { counselorId: string | null; partnerId: string | null }, counselorId: string) {
  if (slot.counselorId === counselorId) return "counselorId" as const;
  if (slot.partnerId === counselorId) return "partnerId" as const;
  return null;
}

export function seatsTaken(slot: { counselorId: string | null; partnerId: string | null }) {
  return (slot.counselorId ? 1 : 0) + (slot.partnerId ? 1 : 0);
}

export function hasActiveBooking(slot: { booking?: { status: BookingStatus } | null }) {
  const status = slot.booking?.status;
  return status === BookingStatus.PENDING || status === BookingStatus.CONFIRMED;
}

/** True once a shift is too close to start (or already started) to be released or swapped. */
export function isLocked(slot: { startsAt: Date }, cutoffHours: number, now = new Date()) {
  return slot.startsAt.getTime() - cutoffHours * 3600_000 < now.getTime();
}

export function toShiftItem(slot: ShiftSlot, cutoffHours: number, now = new Date()) {
  const dateKey = toDateKey(slot.date);
  return {
    id: slot.id,
    dateKey,
    dateLabel: thaiDateLabel(dateKey),
    startTime: toTimeKey(slot.startsAt),
    endTime: toTimeKey(slot.endsAt),
    pairLabel: slotCounselorLabel(slot),
    members: slotMembers(slot).map((m) => ({
      id: m.id,
      name: m.name,
      photoUrl: effectivePhotoUrl(m as { id: string; photoUrl?: string | null; photoUpdatedAt?: Date | null }),
    })),
    seatsOpen: SEATS_PER_SHIFT - seatsTaken(slot),
    hasBooking: hasActiveBooking(slot),
    locked: isLocked(slot, cutoffHours, now),
  };
}

export function shiftText(slot: { date: Date; startsAt: Date; endsAt: Date }) {
  const dateKey = toDateKey(slot.date);
  return `${thaiDateLabel(dateKey)} ${toTimeKey(slot.startsAt)}-${toTimeKey(slot.endsAt)} น.`;
}

/**
 * Posts a shift notice (sign-up, release, swap) to the LINE group, tagging whoever has a linked LINE account.
 * ON by default; set SHIFT_AUTO_NOTIFY=false to silence these (the admin "ประกาศลง LINE" page still works). Never throws.
 */
export async function notifyGroup(people: Person[], text: string) {
  if (process.env.SHIFT_AUTO_NOTIFY === "false") return;
  try {
    const unique = [...new Map(people.map((p) => [p.id, p])).values()];
    const mentionable = unique.flatMap((p) =>
      p.lineUserId ? [{ name: p.name, lineUserId: p.lineUserId }] : []
    );
    await pushMessageToGroup([buildMentionTextMessage(mentionable, text)]);
  } catch (err) {
    console.error("Failed to send shift notification", err);
  }
}
