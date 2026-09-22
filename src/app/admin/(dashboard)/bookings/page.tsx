"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import StatusBadge from "@/components/admin/StatusBadge";
import {
  GENDER_LABELS,
  YEAR_LEVEL_LABELS,
  FACULTY_LABELS,
  TOPIC_LABELS,
  FORMAT_LABELS,
} from "@/lib/formOptions";

type Booking = {
  id: string;
  clientName: string;
  studentId: string | null;
  gender: string;
  yearLevel: string;
  faculty: string;
  major: string;
  topicCategory: string;
  topicOther: string | null;
  consultationFormat: string;
  clientPhone: string;
  clientEmail: string;
  lineId: string;
  note: string | null;
  status: string;
  lineNotified: boolean;
  createdAt: string;
  slot: {
    date: string;
    startsAt: string;
    endsAt: string;
    counselor: { name: string; color: string };
  };
};

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function topicLabel(b: Booking) {
  if (b.topicCategory === "OTHER") return b.topicOther || TOPIC_LABELS.OTHER;
  return TOPIC_LABELS[b.topicCategory] || b.topicCategory;
}

function BookingsInner() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") || "";
  const [status, setStatus] = useState(initialStatus);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);

  function load(currentStatus: string) {
    const qs = currentStatus ? `?status=${currentStatus}` : "";
    fetch(`/api/admin/bookings${qs}`)
      .then((res) => res.json())
      .then((data) => setBookings(data.bookings))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(status);
  }, [status]);

  function handleStatusChange(newStatus: string) {
    setLoading(true);
    setStatus(newStatus);
  }

  async function updateStatus(id: string, newStatus: string) {
    await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    load(status);
    setDetailBooking(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">การจอง</h1>
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="field mt-0 w-auto"
        >
          <option value="">ทั้งหมด</option>
          <option value="PENDING">รอยืนยัน</option>
          <option value="CONFIRMED">ยืนยันแล้ว</option>
          <option value="CANCELLED">ยกเลิก</option>
          <option value="COMPLETED">เสร็จสิ้น</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-black/50">กำลังโหลด...</p>
      ) : bookings.length === 0 ? (
        <p className="text-sm text-black/50">ไม่มีรายการ</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-black/5 text-left dark:bg-white/10">
              <tr>
                <th className="p-2">วันที่/เวลา</th>
                <th className="p-2">ผู้ให้คำปรึกษา</th>
                <th className="p-2">ผู้จอง</th>
                <th className="p-2">คณะ/สาขา</th>
                <th className="p-2">หัวข้อ</th>
                <th className="p-2">สถานะ</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-t border-black/5 align-top dark:border-white/10">
                  <td className="p-2">
                    {formatDate(b.slot.date)}
                    <br />
                    {formatDateTime(b.slot.startsAt)}-{formatDateTime(b.slot.endsAt)}
                  </td>
                  <td className="p-2">{b.slot.counselor.name}</td>
                  <td className="p-2">{b.clientName}</td>
                  <td className="p-2">
                    {FACULTY_LABELS[b.faculty] || b.faculty}
                    <br />
                    <span className="text-xs text-black/50 dark:text-white/50">{b.major}</span>
                  </td>
                  <td className="p-2">{topicLabel(b)}</td>
                  <td className="p-2">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => setDetailBooking(b)}
                      className="btn-link"
                    >
                      ดูรายละเอียด
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailBooking && (
        <BookingDetailModal
          booking={detailBooking}
          onClose={() => setDetailBooking(null)}
          onUpdateStatus={(newStatus) => updateStatus(detailBooking.id, newStatus)}
        />
      )}
    </div>
  );
}

function detailField(label: string, value: string) {
  return (
    <div className="flex justify-between gap-4 border-b border-black/5 py-1.5 text-sm last:border-0 dark:border-white/10">
      <span className="text-black/50 dark:text-white/50">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function BookingDetailModal({
  booking,
  onClose,
  onUpdateStatus,
}: {
  booking: Booking;
  onClose: () => void;
  onUpdateStatus: (status: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">รายละเอียดการจอง</h3>
          <StatusBadge status={booking.status} />
        </div>

        <div className="mb-3 rounded-lg bg-black/5 p-2 text-sm dark:bg-white/10">
          {formatDate(booking.slot.date)} · {formatDateTime(booking.slot.startsAt)}-
          {formatDateTime(booking.slot.endsAt)} น. กับ {booking.slot.counselor.name}
        </div>

        <div className="flex flex-col">
          {detailField("ชื่อ-นามสกุล", booking.clientName)}
          {detailField("เลขระเบียน", booking.studentId || "-")}
          {detailField("เพศ", GENDER_LABELS[booking.gender] || booking.gender)}
          {detailField("ชั้นปี", YEAR_LEVEL_LABELS[booking.yearLevel] || booking.yearLevel)}
          {detailField("คณะ/โรงเรียน/วิทยาเขต", FACULTY_LABELS[booking.faculty] || booking.faculty)}
          {detailField("หลักสูตร/สาขาวิชา", booking.major)}
          {detailField("เรื่องที่ขอรับคำปรึกษา", topicLabel(booking))}
          {detailField(
            "รูปแบบการให้คำปรึกษา",
            FORMAT_LABELS[booking.consultationFormat] || booking.consultationFormat
          )}
          {detailField("เบอร์โทรศัพท์", booking.clientPhone)}
          {detailField("E-mail", booking.clientEmail)}
          {detailField("ID Line", booking.lineId)}
          {detailField("รายละเอียดเพิ่มเติม", booking.note || "-")}
          {detailField("แจ้งเตือน LINE กลุ่ม", booking.lineNotified ? "ส่งแล้ว" : "ยังไม่ได้ส่ง")}
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            onClick={onClose}
            className="btn btn-ghost"
          >
            ปิด
          </button>
          {booking.status !== "CONFIRMED" && (
            <button
              onClick={() => onUpdateStatus("CONFIRMED")}
              className="btn btn-success"
            >
              ยืนยัน
            </button>
          )}
          {booking.status !== "COMPLETED" && (
            <button
              onClick={() => onUpdateStatus("COMPLETED")}
              className="btn btn-primary"
            >
              เสร็จสิ้น
            </button>
          )}
          {booking.status !== "CANCELLED" && (
            <button
              onClick={() => onUpdateStatus("CANCELLED")}
              className="btn btn-danger"
            >
              ยกเลิก
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BookingsPage() {
  return (
    <Suspense>
      <BookingsInner />
    </Suspense>
  );
}
