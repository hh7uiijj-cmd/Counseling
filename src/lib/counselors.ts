type Member = {
  id?: string;
  name: string;
  title?: string | null;
  color?: string;
  photoUrl?: string | null;
  lineUserId?: string | null;
  active?: boolean;
};

/** `counselor` is null for an open shift that no pair has claimed yet. */
type SlotWithMembers = {
  counselor: Member | null;
  partner?: Member | null;
};

/** All counselors sitting a slot: the main counselor first, then the partner (if any). */
export function slotMembers<T extends Member>(slot: {
  counselor: T | null;
  partner?: T | null;
}): T[] {
  return [slot.counselor, slot.partner].filter((m): m is T => Boolean(m));
}

export const OPEN_SHIFT_LABEL = "ว่าง (รอลงเวร)";

/** "A และ B" for paired slots, "A" for solo slots, or a placeholder for open shifts. */
export function slotCounselorLabel(slot: SlotWithMembers) {
  const names = slotMembers(slot).map((m) => m.name);
  return names.length > 0 ? names.join(" และ ") : OPEN_SHIFT_LABEL;
}

/** A slot is bookable only when it is claimed and every counselor on it is active. */
export function slotIsActive(slot: SlotWithMembers) {
  return slot.counselor != null && slotMembers(slot).every((m) => m.active !== false);
}
