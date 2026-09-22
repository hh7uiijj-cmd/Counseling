"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import StatusBadge from "@/components/admin/StatusBadge";

type Booking = {
  id: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  topic: string | null;
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

function BookingsInner() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") || "";
  const [status, setStatus] = useState(initialStatus);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

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
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">การจอง</h1>
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="rounded-lg border border-black/20 p-2 text-sm dark:border-white/20 dark:bg-transparent"
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
                <th className="p-2">ติดต่อ</th>
                <th className="p-2">หัวข้อ</th>
                <th className="p-2">สถานะ</th>
                <th className="p-2">แจ้งไลน์แล้ว</th>
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
                    {b.clientPhone}
                    {b.clientEmail ? <br /> : null}
                    {b.clientEmail}
                  </td>
                  <td className="p-2">{b.topic || "-"}</td>
                  <td className="p-2">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="p-2">{b.lineNotified ? "✅" : "—"}</td>
                  <td className="p-2">
                    <div className="flex flex-col gap-1">
                      {b.status !== "CONFIRMED" && (
                        <button
                          onClick={() => updateStatus(b.id, "CONFIRMED")}
                          className="text-xs text-green-700 hover:underline"
                        >
                          ยืนยัน
                        </button>
                      )}
                      {b.status !== "COMPLETED" && (
                        <button
                          onClick={() => updateStatus(b.id, "COMPLETED")}
                          className="text-xs text-blue-700 hover:underline"
                        >
                          เสร็จสิ้น
                        </button>
                      )}
                      {b.status !== "CANCELLED" && (
                        <button
                          onClick={() => updateStatus(b.id, "CANCELLED")}
                          className="text-xs text-red-600 hover:underline"
                        >
                          ยกเลิก
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
