import { toDateKey, toTimeKey } from "@/lib/dates";
import { slotCounselorLabel } from "@/lib/counselors";
import { TOPIC_LABELS, FACULTY_LABELS, FORMAT_LABELS } from "@/lib/formOptions";
import { ConsultationTopic } from "@/generated/prisma/enums";
import type { buildBookingFlexMessage } from "@/lib/line";

type BookingForCard = {
  id: string;
  clientName: string;
  studentId: string | null;
  faculty: string;
  major: string;
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
    faculty: FACULTY_LABELS[booking.faculty] || booking.faculty,
    major: booking.major,
    clientPhone: booking.clientPhone,
    lineId: booking.lineId,
    consultationFormat: FORMAT_LABELS[booking.consultationFormat] || booking.consultationFormat,
    topic,
    dateKey: toDateKey(slot.date),
    startTime: toTimeKey(slot.startsAt),
    endTime: toTimeKey(slot.endsAt),
  };
}
