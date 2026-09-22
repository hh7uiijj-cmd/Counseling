"use client";

import { useEffect, useState } from "react";
import { dateKey } from "@/lib/calendarGrid";

const TODAY_KEY = (() => {
  const d = new Date();
  return dateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
})();

type Counselor = { id: string; name: string; active: boolean };
type Slot = {
  id: string;
  date: string;
  startsAt: string;
  endsAt: string;
  counselor: { id: string; name: string; color: string };
  booking: { status: string; clientName: string } | null;
};
type ClosedDate = { id: string; date: string; reason: string | null };

const WEEKDAYS = [
  { value: 1, label: "จ" },
  { value: 2, label: "อ" },
  { value: 3, label: "พ" },
  { value: 4, label: "พฤ" },
  { value: 5, label: "ศ" },
  { value: 6, label: "ส" },
  { value: 0, label: "อา" },
];

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

export default function SlotsPage() {
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [closedDates, setClosedDates] = useState<ClosedDate[]>([]);
  const [loading, setLoading] = useState(true);

  const [counselorId, setCounselorId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("16:00");
  const [duration, setDuration] = useState(60);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [closeDateInput, setCloseDateInput] = useState("");
  const [closeReason, setCloseReason] = useState("");

  function load() {
    Promise.all([
      fetch("/api/admin/counselors").then((r) => r.json()),
      fetch(`/api/admin/slots?from=${TODAY_KEY}`).then((r) => r.json()),
      fetch("/api/admin/closed-dates").then((r) => r.json()),
    ]).then(([c, s, cd]) => {
      setCounselors(c.counselors.filter((x: Counselor) => x.active));
      if (!counselorId && c.counselors.length > 0) setCounselorId(c.counselors[0].id);
      setSlots(s.slots);
      setClosedDates(cd.closedDates);
      setLoading(false);
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function handleBulkCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const res = await fetch("/api/admin/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        counselorId,
        startDate,
        endDate,
        daysOfWeek: days,
        startTime,
        endTime,
        slotDurationMinutes: duration,
      }),
    });
    setSubmitting(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.message || "เกิดข้อผิดพลาด กรุณาตรวจสอบข้อมูล");
      return;
    }
    setMessage(`สร้างคิวสำเร็จ ${data.created} คิว`);
    load();
  }

  async function handleDeleteSlot(id: string) {
    const res = await fetch(`/api/admin/slots/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.message || "ไม่สามารถลบคิวนี้ได้");
      return;
    }
    load();
  }

  async function handleAddClosedDate(e: React.FormEvent) {
    e.preventDefault();
    if (!closeDateInput) return;
    await fetch("/api/admin/closed-dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: closeDateInput, reason: closeReason || undefined }),
    });
    setCloseDateInput("");
    setCloseReason("");
    load();
  }

  async function handleRemoveClosedDate(id: string) {
    await fetch(`/api/admin/closed-dates/${id}`, { method: "DELETE" });
    load();
  }

  const upcomingSlots = slots.slice(0, 100);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">จัดการคิวว่าง</h1>

      <section className="rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 font-medium">สร้างคิวว่าง (รองรับสร้างซ้ำหลายวัน)</h2>
        <form onSubmit={handleBulkCreate} className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <label className="text-sm">
              ผู้ให้คำปรึกษา
              <select
                value={counselorId}
                onChange={(e) => setCounselorId(e.target.value)}
                className="mt-1 block rounded-lg border border-black/20 p-2 text-sm dark:border-white/20 dark:bg-transparent"
              >
                {counselors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              จากวันที่
              <input
                required
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 block rounded-lg border border-black/20 p-2 text-sm dark:border-white/20 dark:bg-transparent"
              />
            </label>
            <label className="text-sm">
              ถึงวันที่
              <input
                required
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 block rounded-lg border border-black/20 p-2 text-sm dark:border-white/20 dark:bg-transparent"
              />
            </label>
          </div>

          <div>
            <p className="mb-1 text-sm">วันในสัปดาห์ที่เปิดให้จอง</p>
            <div className="flex gap-2">
              {WEEKDAYS.map((d) => (
                <button
                  type="button"
                  key={d.value}
                  onClick={() => toggleDay(d.value)}
                  className={[
                    "h-8 w-10 rounded-lg border text-xs",
                    days.includes(d.value)
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-black/20 dark:border-white/20",
                  ].join(" ")}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="text-sm">
              เวลาเริ่ม
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 block rounded-lg border border-black/20 p-2 text-sm dark:border-white/20 dark:bg-transparent"
              />
            </label>
            <label className="text-sm">
              เวลาสิ้นสุด
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 block rounded-lg border border-black/20 p-2 text-sm dark:border-white/20 dark:bg-transparent"
              />
            </label>
            <label className="text-sm">
              ความยาวแต่ละคิว (นาที)
              <input
                type="number"
                min={5}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="mt-1 block w-28 rounded-lg border border-black/20 p-2 text-sm dark:border-white/20 dark:bg-transparent"
              />
            </label>
          </div>

          {message && <p className="text-sm text-blue-700">{message}</p>}

          <div>
            <button
              type="submit"
              disabled={submitting || !counselorId}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "กำลังสร้าง..." : "สร้างคิวว่าง"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 font-medium">วันหยุด / ปิดทำการ</h2>
        <form onSubmit={handleAddClosedDate} className="mb-3 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            วันที่
            <input
              type="date"
              value={closeDateInput}
              onChange={(e) => setCloseDateInput(e.target.value)}
              className="mt-1 block rounded-lg border border-black/20 p-2 text-sm dark:border-white/20 dark:bg-transparent"
            />
          </label>
          <label className="text-sm">
            เหตุผล (ถ้ามี)
            <input
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
              className="mt-1 block rounded-lg border border-black/20 p-2 text-sm dark:border-white/20 dark:bg-transparent"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            เพิ่มวันปิดทำการ
          </button>
        </form>
        <ul className="flex flex-wrap gap-2">
          {closedDates.map((cd) => (
            <li
              key={cd.id}
              className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs dark:bg-white/10"
            >
              {formatDate(cd.date)} {cd.reason ? `(${cd.reason})` : ""}
              <button
                onClick={() => handleRemoveClosedDate(cd.id)}
                className="text-red-600 hover:underline"
              >
                ลบ
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 font-medium">คิวที่สร้างไว้ (ล่าสุด 100 รายการ)</h2>
        {loading ? (
          <p className="text-sm text-black/50">กำลังโหลด...</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-black/5 text-left dark:bg-white/10">
                <tr>
                  <th className="p-2">วันที่</th>
                  <th className="p-2">เวลา</th>
                  <th className="p-2">ผู้ให้คำปรึกษา</th>
                  <th className="p-2">สถานะ</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {upcomingSlots.map((s) => (
                  <tr key={s.id} className="border-t border-black/5 dark:border-white/10">
                    <td className="p-2">{formatDate(s.date)}</td>
                    <td className="p-2">
                      {formatDateTime(s.startsAt)}-{formatDateTime(s.endsAt)}
                    </td>
                    <td className="p-2">{s.counselor.name}</td>
                    <td className="p-2">
                      {s.booking && s.booking.status !== "CANCELLED" ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                          จองแล้ว: {s.booking.clientName}
                        </span>
                      ) : (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                          ว่าง
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      <button
                        onClick={() => handleDeleteSlot(s.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        ลบคิว
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
