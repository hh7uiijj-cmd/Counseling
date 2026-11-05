"use client";

import { useEffect, useState } from "react";
import { todayKey } from "@/lib/calendarGrid";
import { COUNSELOR_ROLE_LABEL } from "@/lib/counselors";
import {
  GENDER_OPTIONS,
  YEAR_LEVEL_OPTIONS,
  FACULTY_OPTIONS,
  TOPIC_OPTIONS,
  FORMAT_OPTIONS,
} from "@/lib/formOptions";

type DaySummary = {
  date: string;
  totalSlots: number;
  availableSlots: number;
  counselorNames: string[];
  closed: boolean;
};

type SlotMember = {
  id: string;
  name: string;
  fullName: string | null;
  photoUrl: string | null;
  color: string;
};

type SlotItem = {
  id: string;
  members: SlotMember[];
  counselorId: string;
  counselorName: string;
  counselorColor: string;
  startTime: string;
  endTime: string;
  available: boolean;
};

function MemberAvatar({ member }: { member: SlotMember }) {
  if (member.photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.photoUrl}
        alt={member.name}
        className="h-12 w-12 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
      style={{ backgroundColor: member.color }}
    >
      {member.name.trim().charAt(0)}
    </span>
  );
}

function thaiDateLabelLocal(dateKeyStr: string) {
  const [y, m, d] = dateKeyStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

const UPCOMING_FRIDAYS = 8;

const pad2 = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** The next `count` Fridays starting from today (today counts if it is a Friday). */
function upcomingFridays(count: number) {
  const out: string[] = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  while (out.length < count) {
    if (d.getDay() === 5) out.push(keyOf(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export default function BookingCalendar() {
  const [fridays] = useState(() => upcomingFridays(UPCOMING_FRIDAYS));
  const [days, setDays] = useState<Record<string, DaySummary>>({});
  const [loadingDays, setLoadingDays] = useState(true);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotItem[] | null>(null);
  const [dateClosed, setDateClosed] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
  const [openSlotId, setOpenSlotId] = useState<string | null>(null);

  const [bookingSlot, setBookingSlot] = useState<SlotItem | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Summaries (open seats per Friday) for the months the listed Fridays fall in.
  useEffect(() => {
    let cancelled = false;
    const months = [...new Set(fridays.map((f) => f.slice(0, 7)))];
    Promise.all(
      months.map((m) =>
        fetch(`/api/availability?month=${m}`)
          .then((res) => res.json())
          .then((data) => data.days as DaySummary[])
          .catch(() => [] as DaySummary[])
      )
    )
      .then((lists) => {
        if (cancelled) return;
        const map: Record<string, DaySummary> = {};
        for (const d of lists.flat()) map[d.date] = d;
        setDays(map);
      })
      .finally(() => !cancelled && setLoadingDays(false));
    return () => {
      cancelled = true;
    };
  }, [fridays, refreshKey]);

  function selectDate(dateKeyStr: string) {
    setSelectedDate(dateKeyStr);
    setSlots(null);
    setOpenSlotId(null);
    setLoadingDay(true);
    fetch(`/api/availability/${dateKeyStr}`)
      .then((res) => res.json())
      .then((data) => {
        setSlots(data.slots);
        setDateClosed(Boolean(data.closed));
      })
      .finally(() => setLoadingDay(false));
  }

  return (
    <div className="grid gap-4 sm:gap-6 md:grid-cols-[1fr_380px]">
      <div className="card p-3 sm:p-4">
        <h2 className="mb-1 text-base font-semibold text-brand-blue-dark sm:text-lg">
          เลือกวันศุกร์ที่ต้องการ
        </h2>
        <p className="mb-3 text-xs text-black/60 dark:text-white/70">
          โครงการเปิดให้คำปรึกษาทุกวันศุกร์ เวลา 09:00-12:00 และ 13:00-16:00 น.
        </p>

        <ul className="flex flex-col gap-2">
          {fridays.map((key) => {
            const summary = days[key];
            const isSelected = key === selectedDate;
            const closed = summary?.closed;
            const open = summary && !closed ? summary.availableSlots : 0;
            return (
              <li key={key}>
                <button
                  onClick={() => selectDate(key)}
                  className={[
                    "flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition hover:border-brand-blue active:scale-[0.99]",
                    isSelected
                      ? "border-brand-pink ring-2 ring-brand-pink-light"
                      : "border-black/10 dark:border-white/10",
                  ].join(" ")}
                >
                  <span className="font-medium">
                    {key === todayKey() ? "วันนี้ · " : ""}
                    {thaiDateLabelLocal(key)}
                  </span>
                  {closed ? (
                    <span className="shrink-0 rounded-full bg-gray-200 px-2.5 py-1 text-xs text-gray-600 dark:bg-white/10 dark:text-white/70">
                      ปิดทำการ
                    </span>
                  ) : !summary ? (
                    <span className="shrink-0 text-xs text-black/40 dark:text-white/60">
                      {loadingDays ? "กำลังโหลด..." : "ยังไม่เปิดให้จอง"}
                    </span>
                  ) : open > 0 ? (
                    <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-xs text-green-800">
                      ว่าง {open} คิว
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-1 text-xs text-red-700">
                      เต็มแล้ว
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="card p-3 sm:p-4">
        {!selectedDate && (
          <p className="text-sm text-black/50 dark:text-white/65">
            เลือกวันศุกร์ทางซ้ายเพื่อดูช่วงเวลาที่ว่าง
          </p>
        )}

        {selectedDate && (
          <div>
            <h3 className="mb-3 font-semibold">{thaiDateLabelLocal(selectedDate)}</h3>

            {loadingDay && <p className="text-sm text-black/50 dark:text-white/65">กำลังโหลด...</p>}

            {!loadingDay && dateClosed && (
              <p className="text-sm text-gray-500">วันนี้ปิดทำการ</p>
            )}

            {!loadingDay && !dateClosed && slots && slots.length === 0 && (
              <p className="text-sm text-black/50 dark:text-white/65">ยังไม่มีคิวเปิดให้จองในวันนี้</p>
            )}

            {!loadingDay && !dateClosed && slots && slots.length > 0 && (
              <ul className="flex flex-col gap-2">
                {slots.map((slot) => {
                  const expanded = openSlotId === slot.id;
                  return (
                    <li
                      key={slot.id}
                      className="rounded-lg border border-black/10 text-sm dark:border-white/10"
                    >
                      <button
                        onClick={() => setOpenSlotId(expanded ? null : slot.id)}
                        aria-expanded={expanded}
                        className="flex w-full items-center justify-between gap-2 p-2.5 text-left"
                      >
                        <span className="font-medium">
                          {slot.startTime} - {slot.endTime} น.
                        </span>
                        <span className="flex items-center gap-2">
                          {slot.available ? (
                            <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs text-green-800">
                              ว่าง
                            </span>
                          ) : (
                            <span className="rounded-full bg-gray-200 px-2.5 py-1 text-xs text-gray-600 dark:bg-white/10 dark:text-white/70">
                              ไม่ว่าง
                            </span>
                          )}
                          <span aria-hidden className="text-xs text-black/40 dark:text-white/50">
                            {expanded ? "▲" : "▼"}
                          </span>
                        </span>
                      </button>

                      {expanded && (
                        <div className="flex flex-col gap-3 border-t border-black/10 p-2.5 dark:border-white/10">
                          <p className="text-xs text-black/60 dark:text-white/70">ผู้ให้คำปรึกษาในช่วงเวลานี้</p>
                          <div className="flex flex-col gap-2.5">
                            {slot.members.map((m) => (
                              <div key={m.id} className="flex items-center gap-3">
                                <MemberAvatar member={m} />
                                <div>
                                  <p className="font-medium">{m.fullName || m.name}</p>
                                  {m.fullName && (
                                    <p className="text-xs text-black/60 dark:text-white/70">
                                      ชื่อเล่น: {m.name}
                                    </p>
                                  )}
                                  <p className="text-xs text-black/50 dark:text-white/65">
                                    {COUNSELOR_ROLE_LABEL}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                          {slot.available ? (
                            <button
                              onClick={() => setBookingSlot(slot)}
                              className="btn btn-primary btn-sm self-start"
                            >
                              จองคิวนี้
                            </button>
                          ) : (
                            <p className="text-xs text-gray-500">ช่วงเวลานี้มีผู้จองแล้ว</p>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {bookingSlot && selectedDate && (
        <BookingModal
          slot={bookingSlot}
          dateLabel={thaiDateLabelLocal(selectedDate)}
          onClose={() => setBookingSlot(null)}
          onSuccess={() => {
            setBookingSlot(null);
            selectDate(selectedDate);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

const inputClass = "field";

function BookingModal({
  slot,
  dateLabel,
  onClose,
  onSuccess,
}: {
  slot: SlotItem;
  dateLabel: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [clientName, setClientName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [gender, setGender] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [faculty, setFaculty] = useState("");
  const [major, setMajor] = useState("");
  const [topicCategory, setTopicCategory] = useState("");
  const [topicOther, setTopicOther] = useState("");
  const [consultationFormat, setConsultationFormat] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [lineId, setLineId] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: slot.id,
          clientName,
          studentId: studentId || undefined,
          gender,
          yearLevel,
          faculty,
          major,
          topicCategory,
          topicOther: topicOther || undefined,
          consultationFormat,
          clientPhone,
          clientEmail,
          lineId,
          note: note || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "slot_taken") {
          setError("ขออภัย คิวนี้เพิ่งถูกจองไปแล้ว กรุณาเลือกเวลาอื่น");
        } else if (data.error === "date_closed") {
          setError("วันนี้ปิดทำการแล้ว กรุณาเลือกวันอื่น");
        } else {
          setError("กรุณาตรวจสอบข้อมูลในฟอร์มอีกครั้ง");
        }
        return;
      }
      setSuccess(true);
      setTimeout(onSuccess, 1500);
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
      <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-4 shadow-xl sm:p-6">
        {success ? (
          <div className="text-center">
            <p className="text-lg font-semibold text-brand-pink-dark">จองคิวสำเร็จ!</p>
            <p className="mt-2 text-sm text-black/60 dark:text-white/75">
              ระบบได้บันทึกการจองของคุณแล้ว เจ้าหน้าที่ศูนย์ให้คำปรึกษาจะติดต่อกลับเพื่อยืนยันวันเวลาที่นัดหมาย
              ผ่านเบอร์โทรศัพท์ 0-2244-5006
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold text-brand-blue-dark">จองคิวให้คำปรึกษา</h3>
            <p className="text-sm text-black/60 dark:text-white/75">
              {dateLabel} · {slot.startTime}-{slot.endTime} น. กับ {slot.counselorName}
            </p>

            <label className="text-sm font-medium">
              ชื่อ-นามสกุล *
              <input
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className={inputClass}
              />
            </label>

            <label className="text-sm font-medium">
              เลขระเบียน
              <input
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className={inputClass}
              />
            </label>

            <label className="text-sm font-medium">
              เพศ *
              <select required value={gender} onChange={(e) => setGender(e.target.value)} className={inputClass}>
                <option value="" disabled>
                  เลือกเพศ
                </option>
                {GENDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              ชั้นปี *
              <select
                required
                value={yearLevel}
                onChange={(e) => setYearLevel(e.target.value)}
                className={inputClass}
              >
                <option value="" disabled>
                  เลือกชั้นปี
                </option>
                {YEAR_LEVEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              คณะ/โรงเรียน/วิทยาเขต/ศูนย์การศึกษา *
              <select
                required
                value={faculty}
                onChange={(e) => setFaculty(e.target.value)}
                className={inputClass}
              >
                <option value="" disabled>
                  เลือกคณะ/โรงเรียน/วิทยาเขต
                </option>
                {FACULTY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              หลักสูตร/สาขาวิชา *
              <input
                required
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                className={inputClass}
              />
            </label>

            <label className="text-sm font-medium">
              เรื่องที่ขอรับคำปรึกษา *
              <select
                required
                value={topicCategory}
                onChange={(e) => setTopicCategory(e.target.value)}
                className={inputClass}
              >
                <option value="" disabled>
                  เลือกเรื่องที่ขอรับคำปรึกษา
                </option>
                {TOPIC_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            {topicCategory === "OTHER" && (
              <label className="text-sm font-medium">
                ระบุรายละเอียด *
                <input
                  required
                  value={topicOther}
                  onChange={(e) => setTopicOther(e.target.value)}
                  className={inputClass}
                />
              </label>
            )}

            <label className="text-sm font-medium">
              รูปแบบการให้คำปรึกษา *
              <select
                required
                value={consultationFormat}
                onChange={(e) => setConsultationFormat(e.target.value)}
                className={inputClass}
              >
                <option value="" disabled>
                  เลือกรูปแบบ
                </option>
                {FORMAT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              เบอร์โทรศัพท์มือถือ *
              <input
                required
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className={inputClass}
              />
            </label>

            <label className="text-sm font-medium">
              E-mail Address *
              <input
                required
                type="email"
                maxLength={254}
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className={inputClass}
              />
            </label>

            <label className="text-sm font-medium">
              ID Line *
              <input
                required
                value={lineId}
                onChange={(e) => setLineId(e.target.value)}
                className={inputClass}
              />
            </label>

            <label className="text-sm font-medium">
              รายละเอียดเพิ่มเติม (ถ้ามี)
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className={inputClass}
              />
            </label>

            <div className="rounded-lg bg-black/5 p-3 text-xs text-black/60 dark:bg-white/10 dark:text-white/60">
              <p className="mb-1 font-medium">รายละเอียดการรับคำปรึกษา</p>
              <ol className="list-decimal space-y-1 pl-4">
                <li>
                  เมื่อเจ้าหน้าที่ศูนย์ให้คำปรึกษาได้รับข้อมูลแล้ว จะติดต่อกลับเพื่อตรวจสอบความถูกต้องของวันเวลาที่นัดหมาย
                  ผ่านเบอร์โทรศัพท์ 0-2244-5006
                </li>
                <li>
                  Online: เจ้าหน้าที่จะส่งลิงก์ MS Teams ให้ตาม E-mail ที่ให้ไว้ (กรณีรับคำปรึกษาออนไลน์
                  กรุณานัดหมายล่วงหน้าอย่างน้อย 2 ชั่วโมง)
                </li>
              </ol>
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} className="btn btn-ghost">
                ยกเลิก
              </button>
              <button type="submit" disabled={submitting} className="btn btn-primary">
                {submitting ? "กำลังส่ง..." : "ยืนยันการจอง"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
