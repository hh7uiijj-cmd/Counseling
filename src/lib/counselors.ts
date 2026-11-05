type Member = {
  id?: string;
  name: string;
  title?: string | null;
  color?: string;
  photoUrl?: string | null;
  lineUserId?: string | null;
  active?: boolean;
};

/** A shift has two seats: `counselor` (seat 1) and `partner` (seat 2). Either may be empty. */
type SlotWithMembers = {
  counselor: Member | null;
  partner?: Member | null;
};

export const SEATS_PER_SHIFT = 2;

/** Position shown to clients. Every counselor in the project is a 3rd-year student, so it is pre-filled (and used when empty). */
export const DEFAULT_COUNSELOR_TITLE = "นักศึกษาชั้นปีที่ 3";

/** Counselors currently sitting a slot (0, 1 or 2 of them). */
export function slotMembers<T extends Member>(slot: {
  counselor: T | null;
  partner?: T | null;
}): T[] {
  return [slot.counselor, slot.partner].filter((m): m is T => Boolean(m));
}

export const OPEN_SHIFT_LABEL = "ว่าง (รอลงเวร)";

/** "A และ B" when full, "A (รออีก 1 คน)" with one seat taken, or a placeholder when empty. */
export function slotCounselorLabel(slot: SlotWithMembers) {
  const names = slotMembers(slot).map((m) => m.name);
  if (names.length === 0) return OPEN_SHIFT_LABEL;
  if (names.length < SEATS_PER_SHIFT) return `${names.join(" และ ")} (รออีก ${SEATS_PER_SHIFT - names.length} คน)`;
  return names.join(" และ ");
}

/** A slot can be booked by clients only once both seats are filled by active counselors. */
export function slotIsActive(slot: SlotWithMembers) {
  const members = slotMembers(slot);
  return members.length === SEATS_PER_SHIFT && members.every((m) => m.active !== false);
}
