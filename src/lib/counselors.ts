type Member = {
  id?: string;
  name: string;
  title?: string | null;
  color?: string;
  photoUrl?: string | null;
  lineUserId?: string | null;
  active?: boolean;
};

type SlotWithMembers = {
  counselor: Member;
  partner?: Member | null;
};

/** All counselors sitting a slot: the main counselor first, then the partner (if any). */
export function slotMembers<T extends Member>(slot: {
  counselor: T;
  partner?: T | null;
}): T[] {
  return slot.partner ? [slot.counselor, slot.partner] : [slot.counselor];
}

/** "A และ B" for paired slots, or just "A" for solo slots. */
export function slotCounselorLabel(slot: SlotWithMembers) {
  return slotMembers(slot)
    .map((m) => m.name)
    .join(" และ ");
}

/** A slot is bookable only while every counselor on it is active. */
export function slotIsActive(slot: SlotWithMembers) {
  return slotMembers(slot).every((m) => m.active !== false);
}
