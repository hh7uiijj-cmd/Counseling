import { BookingStatus } from "@/generated/prisma/enums";
import { buildMentionTextMessage, pushMessageToGroup } from "@/lib/line";
import { slotCounselorLabel, slotMembers } from "@/lib/counselors";
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

export function ownsSlot(slot: { counselorId: string | null; partnerId: string | null }, counselorId: string) {
  return slot.counselorId === counselorId || slot.partnerId === counselorId;
}

export function hasActiveBooking(slot: { booking?: { status: BookingStatus } | null }) {
  const status = slot.booking?.status;
  return status === BookingStatus.PENDING || status === BookingStatus.CONFIRMED;
}

/** True once a shift is too close to start (or already started) for the pair to release or swap it. */
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
    hasBooking: hasActiveBooking(slot),
    locked: isLocked(slot, cutoffHours, now),
  };
}

export function shiftText(slot: ShiftSlot) {
  const dateKey = toDateKey(slot.date);
  return `${thaiDateLabel(dateKey)} ${toTimeKey(slot.startsAt)}-${toTimeKey(slot.endsAt)} น.`;
}

/** Post a message to the LINE group, tagging whoever has a linked LINE account. Never throws. */
export async function notifyGroup(people: Person[], text: string) {
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

export function pairPeople(slot: ShiftSlot): Person[] {
  return slotMembers(slot);
}
