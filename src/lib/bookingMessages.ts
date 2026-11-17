import { toDateKey, toTimeKey } from "@/lib/dates";
import { slotCounselorLabel } from "@/lib/counselors";
import { TOPIC_LABELS, FACULTY_LABELS, FORMAT_LABELS } from "@/lib/formOptions";
import { ConsultationTopic } from "@/generated/prisma/enums";
import type { buildBookingFlexMessage } from "@/lib/line";

type BookingForCard = {
  id: string;
  clientName: string;
  studentId: string | null;
  clientType: string;
  faculty: string | null;
  major: string | null;
  department: string | null;
  clientPhone: string;
  lineId: string;
  consultationFormat: string;
  topicCategory: string;
  topicOther: string | null;
};

type SlotForCard = {
  date: Date;
  startsAt: Date;
  endsAt: Date;
  counselor: { name: string } | null;
  partner?: { name: string } | null;
};

/** "คณะ/สาขา" for students, "หน่วยงาน" for staff (บุคลากร). */
export function affiliationLabel(b: { clientType: string }) {
  return b.clientType === "STAFF" ? "บุคลากร · หน่วยงาน" : "นักศึกษา · คณะ/สาขา";
}

export function affiliationValue(b: {
  clientType: string;
  faculty: string | null;
  major: string | null;
  department: string | null;
}) {
  if (b.clientType === "STAFF") return b.department || "-";
  const faculty = b.faculty ? FACULTY_LABELS[b.faculty] || b.faculty : "-";
  return `${faculty} / ${b.major || "-"}`;
}

/** Parameters for `buildBookingFlexMessage`, shared by the new-booking push and the "คิวใหม่" reply. */
export function bookingCardParams(
  booking: BookingForCard,
  slot: SlotForCard,
): Parameters<typeof buildBookingFlexMessage>[0] {
  const topic =
    booking.topicCategory === ConsultationTopic.OTHER
      ? booking.topicOther || TOPIC_LABELS.OTHER
      : TOPIC_LABELS[booking.topicCategory as keyof typeof TOPIC_LABELS];
  return {
    bookingId: booking.id,
    counselorName: slotCounselorLabel(slot),
    clientName: booking.clientName,
    studentId: booking.studentId,
    affiliationLabel: affiliationLabel(booking),
    affiliation: affiliationValue(booking),
    clientPhone: booking.clientPhone,
    lineId: booking.lineId,
    consultationFormat: FORMAT_LABELS[booking.consultationFormat] || booking.consultationFormat,
    topic,
    dateKey: toDateKey(slot.date),
    startTime: toTimeKey(slot.startsAt),
    endTime: toTimeKey(slot.endsAt),
  };
}
